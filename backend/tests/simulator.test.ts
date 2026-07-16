import { describe, expect, it } from "vitest";
import {
  FootballPosition,
  MatchEventType,
  PlayerPosition,
  VenueSide,
} from "@flms/shared";
import {
  OWN_GOAL_RATING_PENALTY,
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
        outcomes.add(
          `${stat.successful_dribbles}/${stat.dribbles_attempted}`,
        );
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

  it("allows a weaker team to upset a stronger team", () => {
    const result = simulateMatch(
      players(VenueSide.HOME, 56),
      players(VenueSide.AWAY, 82),
      "upset-2",
    );
    expect(result.home_score).toBeGreaterThan(result.away_score);
  });

  it("records penalties and permits used substitutes to contribute", () => {
    let penaltyResult: ReturnType<typeof simulateMatch> | null = null;
    let substituteContribution: ReturnType<typeof simulateMatch> | null = null;
    for (
      let index = 0;
      index < 400 && (!penaltyResult || !substituteContribution);
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
        return start !== undefined && penalty.minute >= start && penalty.minute <= end;
      };
      expect(penalty.player_registration_id).toBe(order.find(active));
      checkedPenalty = true;
    }

    expect(checkedPenalty).toBe(true);
  });
});
