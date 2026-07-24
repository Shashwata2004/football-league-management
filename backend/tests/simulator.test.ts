import { describe, expect, it } from "vitest";
import {
  fixtureOutcomeLabel,
  fixtureOutcomeScore,
  FootballPosition,
  hideFixtureOutcome,
  isKnockoutStage,
  MatchEventType,
  PlayerPosition,
  VenueSide,
} from "@flms/shared";
import {
  constrainPossessionForPlayingStyles,
  expectedGoalBaselines,
  expectedGoalsAfterDismissals,
  EXCEPTIONAL_PLAYER_PASS_ACCURACY_CAP,
  LEAGUE_HOME_ADVANTAGE_EXPECTED_GOALS,
  matchEventRequiresRelatedPlayer,
  maximumAccuratePassesForPlayer,
  NEUTRAL_EXPECTED_GOALS_BASELINE,
  OWN_GOAL_RATING_PENALTY,
  RED_CARD_OPPONENT_ATTACK_MULTIPLIER,
  RED_CARD_TEAM_ATTACK_MULTIPLIER,
  STANDARD_PLAYER_PASS_ACCURACY_CAP,
  simulateMatch,
  type SimPlayer,
  type SimPlayerStats,
  type SimTeamStats,
} from "../src/domain/simulator.js";

const positions = [
  FootballPosition.GK,
  FootballPosition.LB,
  FootballPosition.CB,
  FootballPosition.CB,
  FootballPosition.RB,
  FootballPosition.DM,
  FootballPosition.CM,
  FootballPosition.AM,
  FootballPosition.LW,
  FootballPosition.ST,
  FootballPosition.RW,
  FootballPosition.GK,
  FootballPosition.CB,
  FootballPosition.CM,
  FootballPosition.ST,
  FootballPosition.RW,
] as const;

function players(side: VenueSide, ability = 70): SimPlayer[] {
  return positions.map((position, index) => ({
    player_registration_id: `${side}-${ability}-${index}`,
    side,
    is_starter: index < 11,
    position:
      position === FootballPosition.GK
        ? PlayerPosition.GK
        : [
              FootballPosition.LB,
              FootballPosition.CB,
              FootballPosition.RB,
            ].includes(position)
          ? PlayerPosition.DEF
          : [
                FootballPosition.DM,
                FootballPosition.CM,
                FootballPosition.AM,
              ].includes(position)
            ? PlayerPosition.MID
            : PlayerPosition.FWD,
    football_position: position,
    pace: ability,
    shooting: position === FootballPosition.GK ? 10 : ability,
    passing: ability,
    dribbling: position === FootballPosition.GK ? 10 : ability,
    defending: position === FootballPosition.GK ? 10 : ability,
    physical: ability,
    stamina: ability,
    goalkeeping: position === FootballPosition.GK ? ability : 10,
    shot_stopping: position === FootballPosition.GK ? ability : undefined,
    reflexes: position === FootballPosition.GK ? ability : undefined,
    positioning: position === FootballPosition.GK ? ability : undefined,
    handling: position === FootballPosition.GK ? ability : undefined,
    diving: position === FootballPosition.GK ? ability : undefined,
    distribution: ability,
  }));
}

function sum(stats: SimPlayerStats[], field: keyof SimPlayerStats) {
  return stats.reduce((total, player) => total + Number(player[field] ?? 0), 0);
}

function assertTeamTotals(
  team: SimTeamStats,
  stats: SimPlayerStats[],
  goals: number,
  ownGoalsCreditedToTeam = 0,
) {
  const playerCreditedGoals = goals - ownGoalsCreditedToTeam;
  expect(sum(stats, "goals")).toBe(playerCreditedGoals);
  expect(sum(stats, "assists")).toBeLessThanOrEqual(playerCreditedGoals);
  expect(sum(stats, "shots")).toBe(team.shots);
  expect(sum(stats, "shots_on_target")).toBe(team.shots_on_target);
  expect(sum(stats, "passes")).toBe(team.passes);
  expect(sum(stats, "accurate_passes")).toBe(team.accurate_passes);
  expect(sum(stats, "big_chances_created")).toBe(team.big_chances);
  expect(sum(stats, "big_chances_missed")).toBe(team.big_chances_missed);
  expect(sum(stats, "tackles")).toBe(team.tackles);
  expect(sum(stats, "interceptions")).toBe(team.interceptions);
  expect(sum(stats, "blocks")).toBe(team.blocks);
  expect(sum(stats, "clearances")).toBe(team.clearances);
  expect(sum(stats, "fouls_committed")).toBe(team.fouls);
  expect(sum(stats, "yellow_cards")).toBe(team.yellow_cards);
  expect(sum(stats, "red_cards")).toBe(team.red_cards);
}

describe("match-stat simulator", () => {
  it("time-weights the 10v11 scoring effect from the dismissal minute", () => {
    const level = expectedGoalsAfterDismissals(1, 1, null, null);
    expect(level).toEqual({ home: 1, away: 1 });

    const halftimeHomeRed = expectedGoalsAfterDismissals(1, 1, 45, null);
    expect(halftimeHomeRed.home).toBeCloseTo(
      (1 + RED_CARD_TEAM_ATTACK_MULTIPLIER) / 2,
      6,
    );
    expect(halftimeHomeRed.away).toBeCloseTo(
      (1 + RED_CARD_OPPONENT_ATTACK_MULTIPLIER) / 2,
      6,
    );

    const lateHomeRed = expectedGoalsAfterDismissals(1, 1, 80, null);
    expect(lateHomeRed.home).toBeGreaterThan(halftimeHomeRed.home);
    expect(lateHomeRed.away).toBeLessThan(halftimeHomeRed.away);

    const simultaneousReds = expectedGoalsAfterDismissals(1, 1, 45, 45);
    expect(simultaneousReds).toEqual({ home: 1, away: 1 });
  });

  it("identifies winner-required stages and formats stored outcomes", () => {
    expect(isKnockoutStage("ROUND_OF_64")).toBe(true);
    expect(isKnockoutStage("ROUND_OF_32")).toBe(true);
    expect(isKnockoutStage("ROUND_OF_16")).toBe(true);
    expect(isKnockoutStage("QUARTER_FINAL")).toBe(true);
    expect(isKnockoutStage("SEMI_FINAL")).toBe(true);
    expect(isKnockoutStage("FINAL")).toBe(true);
    expect(isKnockoutStage("GROUP")).toBe(false);
    expect(fixtureOutcomeScore({ home_score: 1, away_score: 0 })).toBe("1 - 0");
    expect(fixtureOutcomeLabel({ extra_time_played: true })).toBe(
      "After extra time",
    );
    expect(
      fixtureOutcomeLabel({
        extra_time_played: true,
        penalties_home: 4,
        penalties_away: 3,
      }),
    ).toBe("Pen: 4 - 3");
  });

  it("removes every result field from non-final audience payloads", () => {
    expect(
      hideFixtureOutcome({
        id: "pending-fixture",
        home_score: 1,
        away_score: 1,
        extra_time_played: true,
        penalties_home: 5,
        penalties_away: 4,
        winner_team_registration_id: "home-team",
        penalty_winner_team_registration_id: "home-team",
      }),
    ).toEqual({
      id: "pending-fixture",
      home_score: null,
      away_score: null,
      extra_time_played: false,
      penalties_home: null,
      penalties_away: null,
      winner_team_registration_id: null,
      penalty_winner_team_registration_id: null,
    });
  });

  it("caps player pass accuracy at 95%, with 98% reserved for rare elite performances", () => {
    expect(STANDARD_PLAYER_PASS_ACCURACY_CAP).toBe(0.95);
    expect(EXCEPTIONAL_PLAYER_PASS_ACCURACY_CAP).toBe(0.98);
    expect(maximumAccuratePassesForPlayer(40, 89, 0.999)).toBe(38);
    expect(maximumAccuratePassesForPlayer(50, 92, 0.5)).toBe(47);
    expect(maximumAccuratePassesForPlayer(50, 92, 0.99)).toBe(49);
    expect(maximumAccuratePassesForPlayer(1, 92, 0.99)).toBe(0);
  });

  it("applies the scoring advantage only when explicitly enabled", () => {
    const leagueBaselines = expectedGoalBaselines(true);
    const neutralBaselines = expectedGoalBaselines(false);

    expect(leagueBaselines.home).toBeCloseTo(
      NEUTRAL_EXPECTED_GOALS_BASELINE + LEAGUE_HOME_ADVANTAGE_EXPECTED_GOALS,
    );
    expect(leagueBaselines.away).toBeCloseTo(NEUTRAL_EXPECTED_GOALS_BASELINE);
    expect(neutralBaselines.home).toBeCloseTo(NEUTRAL_EXPECTED_GOALS_BASELINE);
    expect(neutralBaselines.away).toBeCloseTo(NEUTRAL_EXPECTED_GOALS_BASELINE);
  });

  it("identifies event types that require a related player", () => {
    expect(matchEventRequiresRelatedPlayer(MatchEventType.ASSIST)).toBe(true);
    expect(matchEventRequiresRelatedPlayer(MatchEventType.SUBSTITUTION)).toBe(
      true,
    );
    expect(matchEventRequiresRelatedPlayer(MatchEventType.PENALTY_SAVED)).toBe(
      true,
    );
    expect(matchEventRequiresRelatedPlayer(MatchEventType.GOAL)).toBe(false);
    expect(matchEventRequiresRelatedPlayer(MatchEventType.OWN_GOAL)).toBe(
      false,
    );
  });

  it("is reproducible for the same seed and attempt", () => {
    const first = simulateMatch(
      players(VenueSide.HOME),
      players(VenueSide.AWAY),
      "repeatable",
    );
    const second = simulateMatch(
      players(VenueSide.HOME),
      players(VenueSide.AWAY),
      "repeatable",
    );
    expect(second).toEqual(first);
    expect(
      simulateMatch(
        players(VenueSide.HOME),
        players(VenueSide.AWAY),
        "repeatable",
        2,
      ).simulation_seed,
    ).not.toBe(first.simulation_seed);
  });

  it("resolves a tied knockout through extra time without changing regulation matches", () => {
    const home = players(VenueSide.HOME);
    const away = players(VenueSide.AWAY);
    let extraTimeWinner: ReturnType<typeof simulateMatch> | null = null;
    let regulationDraw: ReturnType<typeof simulateMatch> | null = null;

    for (
      let index = 0;
      index < 500 && (!extraTimeWinner || !regulationDraw);
      index += 1
    ) {
      const fixtureId = `knockout-extra-time-${index}`;
      const ordinary = simulateMatch(home, away, fixtureId);
      const knockout = simulateMatch(
        home,
        away,
        fixtureId,
        1,
        {},
        {
          requiresWinner: true,
        },
      );
      if (ordinary.home_score === ordinary.away_score)
        regulationDraw = ordinary;
      if (
        knockout.extra_time_played &&
        knockout.home_score !== knockout.away_score
      ) {
        extraTimeWinner = knockout;
      }
    }

    expect(regulationDraw).toBeTruthy();
    expect(regulationDraw!.extra_time_played).toBe(false);
    expect(regulationDraw!.penalties_home).toBeUndefined();
    expect(extraTimeWinner).toBeTruthy();
    expect(extraTimeWinner!.penalties_home).toBeUndefined();
    expect(
      extraTimeWinner!.events.some(
        (event) => event.minute >= 91 && event.minute <= 120,
      ),
    ).toBe(true);
    expect(
      extraTimeWinner!.player_stats.some((player) => player.minutes > 90),
    ).toBe(true);
    expect(
      Math.max(
        ...extraTimeWinner!.player_stats.map((player) => player.minutes),
      ),
    ).toBeLessThanOrEqual(120);
  });

  it("allows substitutions during extra time without exceeding the limit", () => {
    const home = players(VenueSide.HOME);
    const away = players(VenueSide.AWAY);
    let extraTimeSub: ReturnType<typeof simulateMatch> | null = null;

    for (let index = 0; index < 500 && !extraTimeSub; index += 1) {
      const result = simulateMatch(
        home,
        away,
        `knockout-extra-time-sub-${index}`,
        1,
        {},
        {
          requiresWinner: true,
        },
      );
      if (
        result.extra_time_played &&
        result.substitutions.some((sub) => sub.minute > 90)
      ) {
        extraTimeSub = result;
      }
    }

    expect(extraTimeSub).toBeTruthy();
    // At least one substitution landed in the 91-120 window.
    expect(
      extraTimeSub!.substitutions.some((sub) => sub.minute > 90),
    ).toBe(true);
    // No substitution occurs past the final whistle of extra time.
    expect(
      extraTimeSub!.substitutions.every((sub) => sub.minute <= 120),
    ).toBe(true);
    // The per-side substitution limit of five is still respected.
    for (const side of [VenueSide.HOME, VenueSide.AWAY]) {
      expect(
        extraTimeSub!.substitutions.filter((sub) => sub.side === side).length,
      ).toBeLessThanOrEqual(5);
    }
  });

  it("uses a separate deterministic shootout for a tied knockout", () => {
    const home = players(VenueSide.HOME);
    const away = players(VenueSide.AWAY);
    let shootout: ReturnType<typeof simulateMatch> | null = null;
    let fixtureId = "";

    for (let index = 0; index < 500 && !shootout; index += 1) {
      fixtureId = `knockout-shootout-${index}`;
      const result = simulateMatch(
        home,
        away,
        fixtureId,
        1,
        {},
        {
          requiresWinner: true,
        },
      );
      if (result.penalties_home !== undefined) shootout = result;
    }

    expect(shootout).toBeTruthy();
    expect(shootout!.extra_time_played).toBe(true);
    expect(shootout!.home_score).toBe(shootout!.away_score);
    expect(shootout!.penalties_home).not.toBe(shootout!.penalties_away);
    expect(shootout!.penalty_winner_side).toBe(
      Number(shootout!.penalties_home) > Number(shootout!.penalties_away)
        ? VenueSide.HOME
        : VenueSide.AWAY,
    );
    const matchGoalEvents = shootout!.events.filter((event) =>
      [
        MatchEventType.GOAL,
        MatchEventType.PENALTY_GOAL,
        MatchEventType.OWN_GOAL,
      ].includes(event.type),
    );
    expect(matchGoalEvents).toHaveLength(
      shootout!.home_score + shootout!.away_score,
    );
    expect(sum(shootout!.player_stats, "goals")).toBeLessThanOrEqual(
      shootout!.home_score + shootout!.away_score,
    );

    const repeated = simulateMatch(
      home,
      away,
      fixtureId,
      1,
      {},
      {
        requiresWinner: true,
      },
    );
    expect(repeated).toEqual(shootout);
  });

  it("keeps team and player totals mathematically consistent", () => {
    const home = players(VenueSide.HOME);
    const away = players(VenueSide.AWAY);
    const result = simulateMatch(home, away, "consistency");
    const homeIds = new Set(
      home.map((player) => player.player_registration_id),
    );
    const homeStats = result.player_stats.filter((player) =>
      homeIds.has(player.player_registration_id),
    );
    const awayStats = result.player_stats.filter(
      (player) => !homeIds.has(player.player_registration_id),
    );
    const homeOwnGoals = result.events.filter(
      (event) =>
        event.side === VenueSide.HOME && event.type === MatchEventType.OWN_GOAL,
    ).length;
    const awayOwnGoals = result.events.filter(
      (event) =>
        event.side === VenueSide.AWAY && event.type === MatchEventType.OWN_GOAL,
    ).length;

    expect(result.home_stats.possession + result.away_stats.possession).toBe(
      100,
    );
    assertTeamTotals(
      result.home_stats,
      homeStats,
      result.home_score,
      homeOwnGoals,
    );
    assertTeamTotals(
      result.away_stats,
      awayStats,
      result.away_score,
      awayOwnGoals,
    );
    for (const [team, goals] of [
      [result.home_stats, result.home_score],
      [result.away_stats, result.away_score],
    ] as const) {
      expect(team.shots).toBeGreaterThanOrEqual(team.shots_on_target);
      expect(team.shots_on_target).toBeGreaterThanOrEqual(goals);
      expect(team.big_chances).toBeLessThanOrEqual(team.shots);
      expect(team.big_chances_missed).toBeLessThanOrEqual(team.big_chances);
      expect(team.big_chances - team.big_chances_missed).toBeLessThanOrEqual(
        goals,
      );
      expect(team.accurate_passes).toBeLessThanOrEqual(team.passes);
    }
  });

  it("scales substitutes by actual minutes and omits unused zero-minute players", () => {
    const home = players(VenueSide.HOME);
    const result = simulateMatch(
      home,
      players(VenueSide.AWAY),
      "substitute-minutes",
    );
    const homeStats = result.player_stats.filter((stat) =>
      stat.player_registration_id.startsWith("HOME-"),
    );
    const usedSubIds = new Set(
      result.substitutions
        .filter((sub) => sub.side === VenueSide.HOME)
        .map((sub) => sub.player_in_registration_id),
    );
    const unusedBench = home.filter(
      (player) =>
        !player.is_starter && !usedSubIds.has(player.player_registration_id),
    );
    for (const player of unusedBench) {
      expect(
        result.player_stats.some(
          (stat) =>
            stat.player_registration_id === player.player_registration_id,
        ),
      ).toBe(false);
    }
    for (const substitution of result.substitutions.filter(
      (sub) => sub.side === VenueSide.HOME,
    )) {
      const incoming = homeStats.find(
        (stat) =>
          stat.player_registration_id ===
          substitution.player_in_registration_id,
      )!;
      const outgoing = homeStats.find(
        (stat) =>
          stat.player_registration_id ===
          substitution.player_out_registration_id,
      )!;
      expect(incoming.minutes).toBe(90 - substitution.minute);
      expect(outgoing.minutes).toBe(substitution.minute);
    }
  });

  it("enforces position limits and goalkeeper-specific zeroes", () => {
    const result = simulateMatch(
      players(VenueSide.HOME),
      players(VenueSide.AWAY),
      "positions",
    );
    const dribbleCaps: Partial<Record<FootballPosition, number>> = {
      CB: 2,
      LB: 5,
      RB: 5,
      DM: 4,
      CM: 5,
      AM: 7,
      LW: 9,
      RW: 9,
      ST: 6,
    };
    for (const player of result.player_stats) {
      expect(player.minutes).toBeGreaterThan(0);
      expect(player.minutes).toBeLessThanOrEqual(90);
      expect(player.accurate_passes).toBeLessThanOrEqual(player.passes);
      if (player.passes > 0) {
        expect(player.accurate_passes).toBeLessThan(player.passes);
        expect(player.accurate_passes / player.passes).toBeLessThanOrEqual(
          EXCEPTIONAL_PLAYER_PASS_ACCURACY_CAP,
        );
      }
      expect(player.shots_on_target ?? 0).toBeLessThanOrEqual(player.shots);
      expect(player.successful_dribbles).toBeLessThanOrEqual(
        player.dribbles_attempted,
      );
      if (player.position_played === FootballPosition.GK) {
        expect([
          player.goals,
          player.assists,
          player.shots,
          player.dribbles_attempted,
          player.successful_dribbles,
        ]).toEqual([0, 0, 0, 0, 0]);
      } else {
        expect(player.dribbles_attempted).toBeLessThanOrEqual(
          dribbleCaps[player.position_played!]!,
        );
      }
    }
  });

  it("varies attacker dribble attempts and outcomes across deterministic matches", () => {
    const attempts = new Set<number>();
    const outcomes = new Set<string>();
    for (let index = 0; index < 40; index += 1) {
      const result = simulateMatch(
        players(VenueSide.HOME),
        players(VenueSide.AWAY),
        `dribble-variation-${index}`,
      );
      for (const stat of result.player_stats) {
        if (
          stat.position_played !== FootballPosition.LW &&
          stat.position_played !== FootballPosition.RW &&
          stat.position_played !== FootballPosition.ST
        ) {
          continue;
        }
        attempts.add(stat.dribbles_attempted);
        outcomes.add(`${stat.successful_dribbles}/${stat.dribbles_attempted}`);
      }
    }
    expect(attempts.size).toBeGreaterThanOrEqual(5);
    expect(outcomes.size).toBeGreaterThanOrEqual(8);
    expect(outcomes.has("1/2")).toBe(true);
    expect([...outcomes].some((outcome) => outcome !== "1/2")).toBe(true);
  });

  it("keeps cards uncommon over a deterministic sample", () => {
    let yellows = 0;
    let reds = 0;
    const teamSamples = 400;
    for (let index = 0; index < teamSamples / 2; index += 1) {
      const result = simulateMatch(
        players(VenueSide.HOME),
        players(VenueSide.AWAY),
        `cards-${index}`,
      );
      yellows +=
        result.home_stats.yellow_cards + result.away_stats.yellow_cards;
      reds += result.home_stats.red_cards + result.away_stats.red_cards;
    }
    expect(yellows / teamSamples).toBeGreaterThan(0.5);
    expect(yellows / teamSamples).toBeLessThan(2.2);
    expect(reds / teamSamples).toBeLessThan(0.08);
  });

  it("keeps red-carded players on the dismissal path, not the substitution path", () => {
    let redCardResult: ReturnType<typeof simulateMatch> | null = null;
    for (let index = 0; index < 2500 && !redCardResult; index += 1) {
      const result = simulateMatch(
        players(VenueSide.HOME),
        players(VenueSide.AWAY),
        `red-substitution-${index}`,
      );
      if (result.events.some((event) => event.type === MatchEventType.RED_CARD))
        redCardResult = result;
    }
    expect(redCardResult).toBeTruthy();
    const dismissed = new Set(
      redCardResult!.events
        .filter((event) => event.type === MatchEventType.RED_CARD)
        .map((event) => event.player_registration_id),
    );
    expect(
      redCardResult!.substitutions.some((substitution) =>
        dismissed.has(substitution.player_out_registration_id),
      ),
    ).toBe(false);
    for (const redCard of redCardResult!.events.filter(
      (event) => event.type === MatchEventType.RED_CARD,
    )) {
      const subIn = redCardResult!.substitutions.find(
        (substitution) =>
          substitution.player_in_registration_id ===
          redCard.player_registration_id,
      );
      const playerStats = redCardResult!.player_stats.find(
        (stat) =>
          stat.player_registration_id === redCard.player_registration_id,
      );
      expect(playerStats?.minutes).toBe(
        Math.max(1, redCard.minute - Number(subIn?.minute ?? 0)),
      );
      expect(
        redCardResult!.events.some(
          (event) =>
            event.player_registration_id === redCard.player_registration_id &&
            event.type !== MatchEventType.RED_CARD &&
            event.minute > redCard.minute,
        ),
      ).toBe(false);
    }
  });

  it("gives the 11-player side a measurable scoring advantage after a red card", () => {
    let noRedGoalDifference = 0;
    let noRedMatches = 0;
    let homeRedGoalDifference = 0;
    let homeRedMatches = 0;
    let awayRedGoalDifference = 0;
    let awayRedMatches = 0;

    for (let index = 0; index < 4000; index += 1) {
      const result = simulateMatch(
        players(VenueSide.HOME),
        players(VenueSide.AWAY),
        `red-impact-${index}`,
      );
      const homeRed = result.events.some(
        (event) =>
          event.side === VenueSide.HOME &&
          event.type === MatchEventType.RED_CARD,
      );
      const awayRed = result.events.some(
        (event) =>
          event.side === VenueSide.AWAY &&
          event.type === MatchEventType.RED_CARD,
      );
      const goalDifference = result.home_score - result.away_score;
      if (!homeRed && !awayRed) {
        noRedGoalDifference += goalDifference;
        noRedMatches += 1;
      } else if (homeRed && !awayRed) {
        homeRedGoalDifference += goalDifference;
        homeRedMatches += 1;
      } else if (!homeRed && awayRed) {
        awayRedGoalDifference += goalDifference;
        awayRedMatches += 1;
      }
    }

    expect(homeRedMatches).toBeGreaterThan(70);
    expect(awayRedMatches).toBeGreaterThan(70);
    const noRedAverage = noRedGoalDifference / noRedMatches;
    const homeRedAverage = homeRedGoalDifference / homeRedMatches;
    const awayRedAverage = awayRedGoalDifference / awayRedMatches;
    expect(homeRedAverage).toBeLessThan(noRedAverage - 0.2);
    expect(awayRedAverage).toBeGreaterThan(noRedAverage + 0.2);
  });

  it("generates realistic pass volume and avoids tiny xG for routine high scores", () => {
    const passTotals: number[] = [];
    const passCompletionRates: number[] = [];
    const tackleTotals: number[] = [];
    for (let index = 0; index < 300; index += 1) {
      const result = simulateMatch(
        players(VenueSide.HOME),
        players(VenueSide.AWAY),
        `distribution-${index}`,
      );
      passTotals.push(result.home_stats.passes, result.away_stats.passes);
      passCompletionRates.push(
        result.home_stats.accurate_passes / result.home_stats.passes,
        result.away_stats.accurate_passes / result.away_stats.passes,
      );
      tackleTotals.push(result.home_stats.tackles, result.away_stats.tackles);
      for (const [team, goals] of [
        [result.home_stats, result.home_score],
        [result.away_stats, result.away_score],
      ] as const) {
        if (goals >= 2) {
          expect(team.expected_goals).toBeGreaterThanOrEqual(goals * 0.62);
        }
      }
    }
    const averagePasses =
      passTotals.reduce((total, passes) => total + passes, 0) /
      passTotals.length;
    expect(averagePasses).toBeGreaterThan(470);
    expect(averagePasses).toBeLessThan(620);
    const averagePassCompletion =
      passCompletionRates.reduce((total, rate) => total + rate, 0) /
      passCompletionRates.length;
    expect(averagePassCompletion).toBeGreaterThan(0.76);
    expect(averagePassCompletion).toBeLessThan(0.82);
    const averageTackles =
      tackleTotals.reduce((total, tackles) => total + tackles, 0) /
      tackleTotals.length;
    expect(averageTackles).toBeGreaterThan(8);
    expect(averageTackles).toBeLessThan(16);
    expect(tackleTotals.filter((tackles) => tackles > 18).length).toBeLessThan(
      tackleTotals.length * 0.06,
    );
  });

  it("supports varied edge cases without breaking invariants", () => {
    const find = (
      predicate: ReturnType<typeof simulateMatch> extends infer R
        ? (result: R) => boolean
        : never,
    ) => {
      for (let index = 0; index < 2500; index += 1) {
        const result = simulateMatch(
          players(VenueSide.HOME),
          players(VenueSide.AWAY),
          `edge-${index}`,
        );
        if (predicate(result)) return result;
      }
      throw new Error("Expected deterministic edge case was not found");
    };
    expect(
      find((result) => result.home_score === 0 && result.away_score === 0),
    ).toBeTruthy();
    expect(
      find((result) => result.home_score + result.away_score >= 5),
    ).toBeTruthy();
    expect(
      find(
        (result) =>
          (result.home_stats.possession < 50 &&
            result.home_score > result.away_score) ||
          (result.away_stats.possession < 50 &&
            result.away_score > result.home_score),
      ),
    ).toBeTruthy();
    expect(
      find(
        (result) =>
          result.home_stats.red_cards + result.away_stats.red_cards > 0,
      ),
    ).toBeTruthy();
    const possessionWithoutGoal = simulateMatch(
      players(VenueSide.HOME, 82),
      players(VenueSide.AWAY, 55),
      "dom-2",
    );
    expect(possessionWithoutGoal.home_stats.possession).toBeGreaterThanOrEqual(
      58,
    );
    expect(possessionWithoutGoal.home_score).toBe(0);
  });

  it("makes low-block and counter-attacking teams concede possession", () => {
    for (const playingStyle of [
      "LOW_BLOCK",
      "COUNTER_ATTACKING",
    ] as const) {
      for (let index = 0; index < 20; index += 1) {
        const result = simulateMatch(
          players(VenueSide.HOME),
          players(VenueSide.AWAY),
          `reactive-possession-${playingStyle}-${index}`,
          1,
          {},
          {
            homePlayingStyle: playingStyle,
            awayPlayingStyle: "BALANCED",
          },
        );
        expect(result.home_stats.possession).toBeLessThan(50);
        expect(
          result.home_stats.possession + result.away_stats.possession,
        ).toBe(100);
      }
    }
  });

  it("does not force a possession ceiling when both teams play reactively", () => {
    expect(
      constrainPossessionForPlayingStyles(
        56,
        "LOW_BLOCK",
        "COUNTER_ATTACKING",
      ),
    ).toBe(56);
  });

  it("gives every playing style a distinct full-match statistical identity", () => {
    type Style =
      | "BALANCED"
      | "HOLDING_POSSESSION"
      | "COUNTER_ATTACKING"
      | "HIGH_PRESS"
      | "TIKI_TAKA"
      | "WING_PLAY"
      | "LOW_BLOCK";
    const summarize = (style: Style) => {
      const samples = Array.from({ length: 60 }, (_, index) =>
        simulateMatch(
          players(VenueSide.HOME),
          players(VenueSide.AWAY),
          `style-profile-${style}-${index}`,
          1,
          {},
          {
            homePlayingStyle: style,
            awayPlayingStyle: "BALANCED",
          },
        ).home_stats,
      );
      const average = (field: keyof SimTeamStats) =>
        samples.reduce(
          (total, sample) => total + Number(sample[field] ?? 0),
          0,
        ) / samples.length;
      return {
        possession: average("possession"),
        shots: average("shots"),
        passes: average("passes"),
        passAccuracy:
          samples.reduce(
            (total, sample) =>
              total + sample.accurate_passes / Math.max(1, sample.passes),
            0,
          ) / samples.length,
        tackles: average("tackles"),
        interceptions: average("interceptions"),
        blocks: average("blocks"),
        clearances: average("clearances"),
        corners: average("corners"),
        offsides: average("offsides"),
      };
    };

    const balanced = summarize("BALANCED");
    const holding = summarize("HOLDING_POSSESSION");
    const counter = summarize("COUNTER_ATTACKING");
    const highPress = summarize("HIGH_PRESS");
    const tikiTaka = summarize("TIKI_TAKA");
    const wingPlay = summarize("WING_PLAY");
    const lowBlock = summarize("LOW_BLOCK");

    expect(holding.possession).toBeGreaterThan(balanced.possession);
    expect(holding.passes).toBeGreaterThan(balanced.passes);
    expect(holding.passAccuracy).toBeGreaterThan(balanced.passAccuracy);

    expect(counter.possession).toBeLessThan(50);
    expect(counter.passes).toBeLessThan(balanced.passes);
    expect(counter.offsides).toBeGreaterThan(balanced.offsides);

    expect(highPress.shots).toBeGreaterThan(balanced.shots);
    expect(highPress.tackles + highPress.interceptions).toBeGreaterThan(
      balanced.tackles + balanced.interceptions,
    );

    expect(tikiTaka.possession).toBeGreaterThan(holding.possession);
    expect(tikiTaka.passes).toBeGreaterThan(holding.passes);
    expect(tikiTaka.passAccuracy).toBeGreaterThan(holding.passAccuracy);

    expect(wingPlay.shots).toBeGreaterThan(balanced.shots);
    expect(wingPlay.corners).toBeGreaterThan(balanced.corners);

    expect(lowBlock.possession).toBeLessThan(counter.possession);
    expect(lowBlock.blocks).toBeGreaterThan(balanced.blocks);
    expect(lowBlock.clearances).toBeGreaterThan(balanced.clearances);
  });

  it("allows a weaker team to upset a stronger team", () => {
    const result = simulateMatch(
      players(VenueSide.HOME, 56),
      players(VenueSide.AWAY, 82),
      "upset-2",
      1,
      {},
      { applyHomeAdvantage: true },
    );
    expect(result.home_score).toBeGreaterThan(result.away_score);
  });

  it("records penalties and permits used substitutes to contribute", () => {
    let penaltyResult: ReturnType<typeof simulateMatch> | null = null;
    let savedPenaltyResult: ReturnType<typeof simulateMatch> | null = null;
    let substituteContribution: ReturnType<typeof simulateMatch> | null = null;
    for (
      let index = 0;
      index < 400 &&
      (!penaltyResult || !savedPenaltyResult || !substituteContribution);
      index += 1
    ) {
      const result = simulateMatch(
        players(VenueSide.HOME),
        players(VenueSide.AWAY),
        `events-${index}`,
      );
      if (
        result.events.some(
          (event) =>
            event.type === MatchEventType.PENALTY_GOAL ||
            event.type === MatchEventType.PENALTY_MISS ||
            event.type === MatchEventType.PENALTY_SAVED,
        )
      )
        penaltyResult = result;
      if (
        result.events.some(
          (event) => event.type === MatchEventType.PENALTY_SAVED,
        )
      ) {
        savedPenaltyResult = result;
      }
      const incoming = new Set(
        result.substitutions.map((sub) => sub.player_in_registration_id),
      );
      if (
        result.events.some(
          (event) =>
            incoming.has(event.player_registration_id) &&
            (event.type === MatchEventType.GOAL ||
              event.type === MatchEventType.PENALTY_GOAL ||
              Boolean(
                event.related_player_registration_id &&
                  incoming.has(event.related_player_registration_id),
              )),
        )
      )
        substituteContribution = result;
    }
    expect(penaltyResult).toBeTruthy();
    expect(savedPenaltyResult).toBeTruthy();
    expect(substituteContribution).toBeTruthy();
    const penaltyGoals = penaltyResult!.events.filter(
      (event) => event.type === MatchEventType.PENALTY_GOAL,
    );
    for (const event of penaltyGoals) {
      const scorer = penaltyResult!.player_stats.find(
        (stat) => stat.player_registration_id === event.player_registration_id,
      )!;
      expect(scorer.penalty_scored).toBeGreaterThan(0);
    }
    const savedPenalty = savedPenaltyResult!.events.find(
      (event) => event.type === MatchEventType.PENALTY_SAVED,
    )!;
    const savedPenaltyOpponentIds =
      savedPenalty.side === VenueSide.HOME
        ? new Set(
            players(VenueSide.AWAY).map(
              (player) => player.player_registration_id,
            ),
          )
        : new Set(
            players(VenueSide.HOME).map(
              (player) => player.player_registration_id,
            ),
          );
    expect(savedPenalty.related_player_registration_id).toBeTruthy();
    expect(
      savedPenaltyOpponentIds.has(savedPenalty.related_player_registration_id!),
    ).toBe(true);
  });

  it("attributes own goals to an active opponent and applies a major rating penalty", () => {
    const home = players(VenueSide.HOME);
    const away = players(VenueSide.AWAY);
    const homeIds = new Set(
      home.map((player) => player.player_registration_id),
    );
    const awayIds = new Set(
      away.map((player) => player.player_registration_id),
    );
    let ownGoalResult: ReturnType<typeof simulateMatch> | null = null;

    for (let index = 0; index < 1000 && !ownGoalResult; index += 1) {
      const result = simulateMatch(home, away, `own-goal-${index}`);
      if (
        result.events.some((event) => event.type === MatchEventType.OWN_GOAL)
      ) {
        ownGoalResult = result;
      }
    }

    expect(ownGoalResult).toBeTruthy();
    const ownGoals = ownGoalResult!.events.filter(
      (event) => event.type === MatchEventType.OWN_GOAL,
    );
    expect(ownGoals).toHaveLength(1);
    expect(OWN_GOAL_RATING_PENALTY).toBe(1.4);

    const event = ownGoals[0]!;
    const scorerSideIds = event.side === VenueSide.HOME ? homeIds : awayIds;
    const opponentSideIds = event.side === VenueSide.HOME ? awayIds : homeIds;
    expect(scorerSideIds.has(event.player_registration_id)).toBe(false);
    expect(opponentSideIds.has(event.player_registration_id)).toBe(true);
    expect(event.related_player_registration_id).toBeUndefined();

    const responsiblePlayer = ownGoalResult!.player_stats.find(
      (stat) => stat.player_registration_id === event.player_registration_id,
    )!;
    const creditedGoals = ownGoalResult!.events.filter(
      (candidate) =>
        candidate.player_registration_id === event.player_registration_id &&
        (candidate.type === MatchEventType.GOAL ||
          candidate.type === MatchEventType.PENALTY_GOAL),
    ).length;
    expect(responsiblePlayer.goals).toBe(creditedGoals);
    expect(responsiblePlayer.rating).toBeLessThanOrEqual(8.4);
  });

  it("uses the first configured set-piece taker who is active", () => {
    const home = players(VenueSide.HOME);
    const away = players(VenueSide.AWAY);
    const homeOrder = home
      .filter((player) => player.football_position !== FootballPosition.GK)
      .map((player) => player.player_registration_id)
      .reverse();
    const awayOrder = away
      .filter((player) => player.football_position !== FootballPosition.GK)
      .map((player) => player.player_registration_id)
      .reverse();
    let checkedPenalty = false;

    for (let attempt = 1; attempt <= 250 && !checkedPenalty; attempt += 1) {
      const result = simulateMatch(home, away, "configured-takers", attempt, {
        home: {
          penalty_taker_ids: homeOrder,
          free_kick_taker_ids: homeOrder,
        },
        away: {
          penalty_taker_ids: awayOrder,
          free_kick_taker_ids: awayOrder,
        },
      });
      const penalty = result.events.find((event) =>
        [
          MatchEventType.PENALTY_GOAL,
          MatchEventType.PENALTY_MISS,
          MatchEventType.PENALTY_SAVED,
        ].includes(event.type),
      );
      if (!penalty) continue;

      const order = penalty.side === VenueSide.HOME ? homeOrder : awayOrder;
      const teamPlayers = penalty.side === VenueSide.HOME ? home : away;
      const active = (playerId: string) => {
        const player = teamPlayers.find(
          (candidate) => candidate.player_registration_id === playerId,
        )!;
        const subIn = result.substitutions.find(
          (sub) => sub.player_in_registration_id === playerId,
        );
        const subOut = result.substitutions.find(
          (sub) => sub.player_out_registration_id === playerId,
        );
        const start = player.is_starter ? 0 : subIn?.minute;
        const end = subOut?.minute ?? 90;
        return (
          start !== undefined &&
          penalty.minute >= start &&
          penalty.minute <= end
        );
      };
      expect(penalty.player_registration_id).toBe(order.find(active));
      checkedPenalty = true;
    }

    expect(checkedPenalty).toBe(true);
  });
});
