import { MatchEventType, PlayerPosition, VenueSide } from "@flms/shared";
import { AppError } from "../errors.js";

export interface SimPlayer {
  player_registration_id: string;
  position: PlayerPosition;
  side: VenueSide;
  is_starter: boolean;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  goalkeeping: number;
}

export interface SimTeamStats {
  possession: number;
  shots: number;
  shots_on_target: number;
  big_chances: number;
  big_chances_missed: number;
  passes: number;
  accurate_passes: number;
  fouls: number;
  yellow_cards: number;
  red_cards: number;
  corners: number;
}

export interface SimPlayerStats {
  player_registration_id: string;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  passes: number;
  accurate_passes: number;
  tackles: number;
  saves: number;
  dribbles_attempted: number;
  successful_dribbles: number;
  yellow_cards: number;
  red_cards: number;
  rating: number;
}

export interface SimMatchEvent {
  minute: number;
  side: VenueSide;
  type: MatchEventType;
  player_registration_id: string;
  related_player_registration_id?: string;
}

export interface SimulationResult {
  home_score: number;
  away_score: number;
  home_stats: SimTeamStats;
  away_stats: SimTeamStats;
  player_stats: SimPlayerStats[];
  events: SimMatchEvent[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function avg(players: SimPlayer[], selector: (player: SimPlayer) => number) {
  return players.reduce((sum, player) => sum + selector(player), 0) / Math.max(players.length, 1);
}

function teamStrength(players: SimPlayer[]) {
  return {
    attack: avg(players, (p) => (p.shooting * 0.45 + p.pace * 0.15 + p.dribbling * 0.2 + p.passing * 0.2)),
    midfield: avg(players, (p) => (p.passing * 0.45 + p.dribbling * 0.25 + p.physical * 0.15 + p.defending * 0.15)),
    defense: avg(players, (p) => (p.defending * 0.5 + p.physical * 0.25 + p.pace * 0.1 + p.passing * 0.15)),
    keeper: avg(players.filter((p) => p.position === PlayerPosition.GK), (p) => p.goalkeeping * 0.75 + p.physical * 0.25)
  };
}

function deterministicJitter(seed: string, index: number, spread: number) {
  let hash = 0;
  for (const char of `${seed}:${index}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ((hash % 1000) / 1000 - 0.5) * spread;
}

function makeStats(
  own: ReturnType<typeof teamStrength>,
  other: ReturnType<typeof teamStrength>,
  possession: number,
  goals: number,
  seed: string,
  sideOffset: number
): SimTeamStats {
  const chanceEdge = own.attack - other.defense + deterministicJitter(seed, sideOffset, 16);
  const shots = clamp(10 + chanceEdge * 0.18 + goals * 2, 3, 28);
  const shotsOnTarget = clamp(Math.max(goals, shots * (0.31 + own.attack / 500)), goals, shots);
  const bigChances = clamp(goals + Math.max(0, chanceEdge) / 14 + deterministicJitter(seed, sideOffset + 1, 3), goals, shots);
  const passes = clamp(260 + possession * 6 + own.midfield * 2.2 + deterministicJitter(seed, sideOffset + 2, 80), 180, 900);
  const passAccuracy = clamp(64 + own.midfield * 0.22 - other.defense * 0.05, 58, 91);
  const fouls = clamp(16 - own.defense * 0.04 + other.midfield * 0.04 + deterministicJitter(seed, sideOffset + 3, 8), 5, 28);
  const yellowCards = clamp(fouls / 6 + deterministicJitter(seed, sideOffset + 4, 2), 0, 6);
  const redCards = deterministicJitter(seed, sideOffset + 5, 100) > 48 && yellowCards > 3 ? 1 : 0;

  return {
    possession,
    shots,
    shots_on_target: shotsOnTarget,
    big_chances: bigChances,
    big_chances_missed: clamp(bigChances - goals, 0, bigChances),
    passes,
    accurate_passes: clamp((passes * passAccuracy) / 100, 0, passes),
    fouls,
    yellow_cards: yellowCards,
    red_cards: redCards,
    corners: clamp(shots / 3 + deterministicJitter(seed, sideOffset + 6, 5), 0, 14)
  };
}

function allocatePlayerStats(
  players: SimPlayer[],
  teamStats: SimTeamStats,
  goals: number,
  seed: string,
  side: VenueSide
): { stats: SimPlayerStats[]; events: SimMatchEvent[] } {
  const starters = players.filter((p) => p.is_starter);
  const attackers = starters.filter((p) => p.position === PlayerPosition.FWD || p.position === PlayerPosition.MID);
  const passBase = starters.reduce((sum, player) => sum + player.passing, 0) || 1;
  const events: SimMatchEvent[] = [];
  const goalScorers: string[] = [];
  const assistMakers: string[] = [];

  for (let i = 0; i < goals; i += 1) {
    const scorer = attackers[(i + Math.abs(Math.round(deterministicJitter(seed, i, attackers.length * 2)))) % attackers.length] ?? starters[0];
    const assister =
      starters.find((p) => p.player_registration_id !== scorer?.player_registration_id && p.position !== PlayerPosition.GK) ??
      scorer;
    if (scorer) {
      goalScorers.push(scorer.player_registration_id);
      if (assister && assister.player_registration_id !== scorer.player_registration_id) {
        assistMakers.push(assister.player_registration_id);
      }
      const event: SimMatchEvent = {
        minute: clamp(8 + (i + 1) * (82 / (goals + 1)) + deterministicJitter(seed, i + 20, 9), 1, 90),
        side,
        type: MatchEventType.GOAL,
        player_registration_id: scorer.player_registration_id
      };
      if (assister && assister.player_registration_id !== scorer.player_registration_id) {
        event.related_player_registration_id = assister.player_registration_id;
      }
      events.push(event);
    }
  }

  const yellowTarget = teamStats.yellow_cards;
  const redTarget = teamStats.red_cards;

  const stats = starters.map((player, index) => {
    const passShare = player.passing / passBase;
    const passes = clamp(teamStats.passes * passShare, 8, player.position === PlayerPosition.GK ? 55 : 115);
    const dribbleCap =
      player.position === PlayerPosition.FWD ? 9 : player.position === PlayerPosition.MID ? 7 : player.position === PlayerPosition.DEF ? 4 : 1;
    const dribblesAttempted = clamp((player.dribbling / 18) + deterministicJitter(seed, index + 40, 3), 0, dribbleCap);
    const successfulDribbles = clamp(dribblesAttempted * (0.42 + player.dribbling / 220), 0, dribblesAttempted);
    const playerGoals = goalScorers.filter((id) => id === player.player_registration_id).length;
    const assists = assistMakers.filter((id) => id === player.player_registration_id).length;
    const shots =
      player.position === PlayerPosition.GK
        ? 0
        : clamp(playerGoals + player.shooting / 35 + deterministicJitter(seed, index + 50, 2), playerGoals, 6);
    const yellowCards = index < yellowTarget ? 1 : 0;
    const redCards = index === starters.length - 1 && redTarget > 0 ? 1 : 0;
    const saves =
      player.position === PlayerPosition.GK
        ? clamp(2 + player.goalkeeping / 30 + deterministicJitter(seed, index + 60, 3), 0, 12)
        : 0;
    const rating = Math.min(
      9.5,
      Math.max(
        5.5,
        6.1 +
          playerGoals * 0.75 +
          assists * 0.45 +
          successfulDribbles * 0.08 +
          saves * 0.09 +
          (passes > 45 ? 0.2 : 0) -
          yellowCards * 0.25 -
          redCards * 0.9
      )
    );

    return {
      player_registration_id: player.player_registration_id,
      minutes: 90,
      goals: playerGoals,
      assists,
      shots,
      passes,
      accurate_passes: clamp(passes * (0.62 + player.passing / 300), 0, passes),
      tackles: player.position === PlayerPosition.FWD ? 0 : clamp(player.defending / 28 + deterministicJitter(seed, index + 70, 2), 0, 8),
      saves,
      dribbles_attempted: dribblesAttempted,
      successful_dribbles: successfulDribbles,
      yellow_cards: yellowCards,
      red_cards: redCards,
      rating: Number(rating.toFixed(1))
    };
  });

  return { stats, events };
}

export function validateSimulationConsistency(result: SimulationResult) {
  if (result.home_stats.possession + result.away_stats.possession !== 100) {
    throw new AppError(400, "Possession must sum to 100");
  }
  for (const [label, stats, goals] of [
    ["home", result.home_stats, result.home_score],
    ["away", result.away_stats, result.away_score]
  ] as const) {
    if (stats.shots_on_target > stats.shots) throw new AppError(400, `${label} shots on target exceed shots`);
    if (stats.big_chances > stats.shots) throw new AppError(400, `${label} big chances exceed shots`);
    if (stats.big_chances_missed > stats.big_chances) throw new AppError(400, `${label} missed big chances exceed big chances`);
    if (stats.accurate_passes > stats.passes) throw new AppError(400, `${label} accurate passes exceed passes`);
    if (goals > stats.shots_on_target) throw new AppError(400, `${label} goals exceed shots on target`);
    if (stats.red_cards > 3) throw new AppError(400, `${label} red cards exceed cap`);
  }
  for (const player of result.player_stats) {
    if (player.successful_dribbles > player.dribbles_attempted) {
      throw new AppError(400, "A player's successful dribbles exceed attempted dribbles");
    }
  }
}

export function simulateMatch(homePlayers: SimPlayer[], awayPlayers: SimPlayer[], fixtureId: string): SimulationResult {
  if (homePlayers.filter((p) => p.is_starter).length !== 11 || awayPlayers.filter((p) => p.is_starter).length !== 11) {
    throw new AppError(400, "Both confirmed lineups must have 11 starters");
  }
  const home = teamStrength(homePlayers);
  const away = teamStrength(awayPlayers);
  const homeExpected = Math.max(0.2, 1.25 + (home.attack - away.defense) / 38 + (home.midfield - away.midfield) / 85 + 0.18);
  const awayExpected = Math.max(0.2, 1.05 + (away.attack - home.defense) / 38 + (away.midfield - home.midfield) / 85);
  const homeScore = clamp(homeExpected + deterministicJitter(fixtureId, 1, 2.4), 0, 7);
  const awayScore = clamp(awayExpected + deterministicJitter(fixtureId, 2, 2.4), 0, 7);
  const homePossession = clamp(50 + (home.midfield - away.midfield) * 0.4 + deterministicJitter(fixtureId, 3, 8), 34, 66);
  const awayPossession = 100 - homePossession;
  const homeStats = makeStats(home, away, homePossession, homeScore, fixtureId, 10);
  const awayStats = makeStats(away, home, awayPossession, awayScore, fixtureId, 20);
  const homeAllocated = allocatePlayerStats(homePlayers, homeStats, homeScore, `${fixtureId}:home`, VenueSide.HOME);
  const awayAllocated = allocatePlayerStats(awayPlayers, awayStats, awayScore, `${fixtureId}:away`, VenueSide.AWAY);

  const result: SimulationResult = {
    home_score: homeScore,
    away_score: awayScore,
    home_stats: homeStats,
    away_stats: awayStats,
    player_stats: [...homeAllocated.stats, ...awayAllocated.stats],
    events: [...homeAllocated.events, ...awayAllocated.events].sort((a, b) => a.minute - b.minute)
  };
  validateSimulationConsistency(result);
  return result;
}
