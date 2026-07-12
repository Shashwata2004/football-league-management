# Match-stat generation audit

## Scope and sources

This audit covers attacking, possession, defensive, and disciplinary match data. It deliberately excludes player-rating formulas and hidden-ability generation. It also does not add xG or xA.

Definitions were checked against:

- Stats Perform, **Opta Event Definitions**: https://www.statsperform.com/opta-event-definitions/
- StatsBomb, **Stats Portal Glossary**: https://stats-portal.statsbomb.com/glossary
- StatsBomb, **Open Data repository and event specification**: https://github.com/statsbomb/open-data
- FBref, **Premier League team shooting and possession tables**: https://fbref.com/en/comps/9/Premier-League-Stats (direct automated access was blocked, so FBref was used as a cross-check where indexed tables were available, not as the sole source).

For empirical range checks, 120 matches (240 team-match records) from StatsBomb's open 2015/16 Premier League event data were analysed locally. This is a calibration sample, not a claim that every competition must have the same distribution.

## Definitions adopted

| Project field            | Adopted meaning                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Goals                    | Credited goals, with own goals represented separately when supported by the event stream.                                         |
| Shots                    | Deliberate goal attempts. Penalty attempts count as shots.                                                                        |
| Shots on target          | Goals plus attempts saved by the goalkeeper (and saved-to-post). A goal therefore always counts as a shot on target.              |
| Shot accuracy            | `shots_on_target / shots`; zero when there are no shots.                                                                          |
| Assists                  | The final teammate touch leading directly to a goal. Direct penalty goals have no assist.                                         |
| Chances created          | Opta-style assists plus key passes; a key pass is the final pass before a non-goal shot.                                          |
| Passes / accurate passes | Attempted teammate deliveries / completed teammate deliveries. Pass accuracy is derived, never independently generated.           |
| Dribbles attempted       | Take-on attempts against an opponent while in possession.                                                                         |
| Successful dribbles      | Take-ons where the attacker beats the opponent and retains possession.                                                            |
| Dispossessed             | Times a player in possession loses the ball to an opponent's tackle; this is not identical to every failed dribble or miscontrol. |
| Tackles                  | Legal ground challenges on a player in controlled possession. The project records total tackles, not tackles won.                 |
| Interceptions            | Reading and cutting out an opponent's intended pass. This is distinct from a recovery.                                            |
| Clearances               | Deliberately moving the ball away from danger without an intended recipient.                                                      |
| Blocks                   | Outfield-player blocks of goal attempts.                                                                                          |
| Big chances              | Opta-style opportunities where a player should reasonably be expected to score; penalties are big chances.                        |
| Big chances missed       | Big-chance attempts that do not become goals. The project keeps the existing constraint `missed <= big chances`.                  |
| Fouls                    | Penalised infringements. Offsides are tracked separately.                                                                         |
| Possession               | Percentage share for each team; the two values must total 100.                                                                    |

## Current implementation

The simulator is in `backend/src/domain/simulator.ts`. It is deterministic for a fixture, simulation-attempt number, and the two confirmed starting lineups.

Current flow:

1. Calculate lineup attack, midfield, defence, and goalkeeper strength.
2. Generate score and possession.
3. Generate team shots, shots on target, big chances, passes, fouls, cards, corners, and offsides.
4. Generate substitutions.
5. Distribute team totals to starters and used substitutes.
6. Generate some player fields independently.
7. Re-aggregate shots, passes, big chances, tackles, interceptions, blocks, clearances, saves, and team rating from player rows.

Current generated team ranges are approximately: possession 35–65; shots 2–18 normally (rare 24); shots on target up to 8 normally; big chances up to 4 normally; passes 160–680; fouls 4–20; yellow cards 0–4; red cards 0–1; corners 0–10; offsides 0–6. Editable API caps are intentionally wider than generated ranges.

Current position caps include shots of GK 0, CB 1, FB/DM 2, CM 3, AM 4, winger 5, ST 6; and dribble attempts/successes of CB 2/1, FB 5/3, DM 4/2, CM 5/3, AM 7/5, winger 9/6, ST 6/4, GK 0/0.

The values in this section describe the implementation before the changes below.

## Empirical range cross-check

In the 120-match StatsBomb sample, per-team match medians (95th percentiles) were approximately: shots 12 (22), shots on target 4 (8), passes 471 (680), tackles 20 (31), interceptions 6 (19), clearances 25 (46), fouls 12 (20), yellow cards 1 (4), corners 5 (11), and offsides 2 (5). Provider definitions differ for some defensive events, especially blocks, so those figures are guides rather than interchangeable truths.

The current simulator's 2,000-match equal-strength calibration produced per-team means of roughly: 9.0 shots, 3.3 shots on target, 497 passes, 11.2 tackles, 7.1 interceptions, 15 clearances, 13 fouls, and 3 yellow cards. The main calibration problems are low/narrow shot and defensive-action distributions, overly high card conversion from fouls, and an unrealistically narrow passing distribution for equal-strength teams.

## Problems found

- Player minutes use separate shortcuts instead of the existing active-window helper. A substitute entering at minute 60 can be treated differently by event eligibility and stat scaling.
- Pass allocation uses fixed starter/substitute multipliers rather than actual minutes.
- Accurate passes are allocated independently and then capped per player, which can silently reduce the team completion total.
- Chances created are independently random per player rather than `assists + key passes` tied to actual team shots.
- Player fouls are independently random and do not sum to the team foul total.
- Dribbles and dispossessions are minute-scaled, but deterministic rounding makes some positions repeat the same values too often.
- Defensive team totals are distributed without actual-minute weights, allowing short substitute appearances too much defensive volume.
- The validator checks local inequalities but does not verify most team totals against player totals, goal/assist event ownership, zero-minute rows, or event/stat agreement.
- Penalty misses/saves exist, but scored penalties are never generated. Missed penalties can also increase a player's missed big chances without increasing the corresponding team big-chance source total.
- Penalty events are currently much too frequent and all generated penalty attempts are failures.
- Team cards are linked to player cards, but card recipients are chosen before player foul totals and need not have committed a foul.
- `chances_created` is ambiguous unless explicitly defined as assists plus key passes. `dribbles_attempted` should be labelled as take-ons attempted in documentation, while retaining the existing API name for compatibility.
- `tackles` means total tackles, not tackles won. Renaming it to tackles won would be incorrect without a new outcome model.
- Existing `clearances` and `blocks` are useful, defined, and already supported. Ball recoveries and duels would require a separate possession-transition/duel model, so they should not be added in this change.

## Minimal change plan

- Keep the existing seeded, rule-based architecture and team-first source of truth.
- Calibrate team shot, pass, foul/card, corner, and defensive-action distributions against the observed ranges while preserving controlled variation and upsets.
- Use one minute calculation for event eligibility and all raw-stat scaling.
- Distribute passes, accurate passes, shots, shots on target, chances created, fouls, cards, and defensive actions from team totals to active players with caps and minute-aware weights.
- Generate chances created as assists plus allocated key passes tied to non-goal shots.
- Add a rare scored-penalty path using the existing `PENALTY_GOAL` event and existing database columns; lower failed-penalty frequency.
- Strengthen consistency validation, including event ownership and team/player equality for fields that have both representations.
- Preserve all player-rating code unchanged.
- Keep the database and API shape unchanged. No migration is required because penalty events and penalty counters already exist.
- Update admin and manager score summaries to label penalty goals and penalty misses; keep event icons available for starters and used substitutes.
- Expand simulator tests for bounds, positions, minutes, totals, cards, deterministic replay, penalties, substitutes, goalkeeper limits, and seeded edge-case searches.

## Implemented calibration

The simulator continues to generate team totals first and distribute them to active players. The generated team ranges are now approximately:

- Possession: 35–65, with the two teams always summing to 100.
- Shots: normally 3–22, with a rare cap of 27.
- Shots on target: never below goals, never above shots, normally capped at 10 and rarely 12.
- Big chances: 0–5 normally and rarely 6; missed big chances never exceed big chances.
- Passes: 230–760; accurate passes are allocated under each player's pass-attempt cap.
- Fouls: 4–20 normally and rarely 23.
- Yellow cards: 0–4, generated as rare foul outcomes rather than a fixed fouls divisor.
- Red cards: 0–1 with an approximately three-percent per-team trigger before other constraints.
- Corners: normally 0–11 and rarely 14; offsides 0–6.
- Tackles: normally 7–25 and rarely 31.
- Interceptions: normally 1–16 and rarely 20.
- Blocks: normally 0–5 and rarely 7, influenced by opponent shot pressure.
- Clearances: normally 5–40 and rarely 48, influenced by possession and opponent pressure.

In a post-change 2,000-match equal-strength calibration, per-team means were approximately 11.5 shots, 3.6 shots on target, 475 passes, 16.7 tackles, 6.1 interceptions, 2.4 blocks, 23.0 clearances, 11.4 fouls, 1.3 yellow cards, 0.03 red cards, and 4.3 corners. Equal-strength simulations naturally have less variance than a sample containing teams of many strengths.

No field was added, removed, or renamed. Existing clearances and blocks were retained. Recoveries and duels were not added because the current simulator has no possession-transition or duel source of truth. Existing legacy expected-goals storage was not expanded or used as a new player statistic; xG and xA were not added by this change.
