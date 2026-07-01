import { FootballPosition, MatchEventType, PlayerPosition, VenueSide, type PlayerAbilityRating } from "@flms/shared";
import { AppError } from "../errors.js";

export interface SimPlayer {
  player_registration_id: string;
  position: PlayerPosition;
  football_position?: FootballPosition;
  side: VenueSide;
  is_starter: boolean;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  stamina?: number;
  goalkeeping: number;
  shot_stopping?: number;
  reflexes?: number;
  positioning?: number;
  handling?: number;
  diving?: number;
  distribution?: number;
  communication?: number;
}

export interface SimTeamStats {
  rating?: number;
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
  offsides?: number;
}

export interface SimPlayerStats {
  player_registration_id: string;
  minutes: number;
  position_played?: FootballPosition;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target?: number;
  chances_created?: number;
  big_chances_created?: number;
  big_chances_missed?: number;
  passes: number;
  accurate_passes: number;
  tackles: number;
  interceptions?: number;
  clearances?: number;
  blocks?: number;
  fouls_committed?: number;
  saves: number;
  goals_conceded?: number;
  accurate_long_balls?: number;
  diving_saves?: number;
  saves_inside_box?: number;
  dribbles_attempted: number;
  successful_dribbles: number;
  dispossessed?: number;
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

export interface SimSubstitution {
  minute: number;
  side: VenueSide;
  player_out_registration_id: string;
  player_in_registration_id: string;
  reason: "LOW_RATING" | "FATIGUE" | "TACTICAL_CHANGE" | "YELLOW_CARD_RISK" | "INJURY_PLACEHOLDER";
}

export interface SimulationResult {
  home_score: number;
  away_score: number;
  home_stats: SimTeamStats;
  away_stats: SimTeamStats;
  player_stats: SimPlayerStats[];
  events: SimMatchEvent[];
  substitutions: SimSubstitution[];
  simulation_seed: string;
  extra_time_played?: boolean;
  penalty_winner_side?: VenueSide;
  penalties_home?: number;
  penalties_away?: number;
}

type Strength = { attack: number; midfield: number; defense: number; keeper: number; overall: number };

const tierRanges: Record<PlayerAbilityRating, [number, number]> = {
  LOW: [49, 54],
  MODERATE: [55, 72],
  HIGH: [73, 88]
};

const outfieldKeys = ["shooting", "passing", "dribbling", "defending", "physical", "pace", "stamina"] as const;
const gkKeys = ["shot_stopping", "reflexes", "positioning", "handling", "diving", "distribution", "physical", "communication"] as const;
type OutfieldKey = (typeof outfieldKeys)[number];
type GkKey = (typeof gkKeys)[number];
type Range = [number, number];
type OutfieldRanges = Record<OutfieldKey, Range>;

const positionAbilityRanges: Record<Exclude<FootballPosition, typeof FootballPosition.GK>, Record<PlayerAbilityRating, OutfieldRanges>> = {
  ST: {
    LOW: { shooting: [58, 66], passing: [49, 58], dribbling: [52, 62], defending: [10, 20], physical: [50, 60], pace: [56, 66], stamina: [49, 59] },
    MODERATE: { shooting: [67, 79], passing: [58, 68], dribbling: [62, 74], defending: [15, 30], physical: [59, 70], pace: [66, 78], stamina: [58, 70] },
    HIGH: { shooting: [78, 92], passing: [67, 80], dribbling: [73, 88], defending: [20, 40], physical: [70, 84], pace: [76, 92], stamina: [68, 84] }
  },
  LW: {
    LOW: { shooting: [55, 64], passing: [51, 60], dribbling: [58, 69], defending: [18, 30], physical: [48, 58], pace: [66, 76], stamina: [52, 63] },
    MODERATE: { shooting: [62, 76], passing: [58, 70], dribbling: [68, 82], defending: [24, 40], physical: [56, 68], pace: [76, 88], stamina: [62, 76] },
    HIGH: { shooting: [74, 90], passing: [68, 82], dribbling: [80, 92], defending: [32, 50], physical: [66, 80], pace: [84, 92], stamina: [74, 88] }
  },
  RW: {
    LOW: { shooting: [55, 64], passing: [51, 60], dribbling: [58, 69], defending: [18, 30], physical: [48, 58], pace: [66, 76], stamina: [52, 63] },
    MODERATE: { shooting: [62, 76], passing: [58, 70], dribbling: [68, 82], defending: [24, 40], physical: [56, 68], pace: [76, 88], stamina: [62, 76] },
    HIGH: { shooting: [74, 90], passing: [68, 82], dribbling: [80, 92], defending: [32, 50], physical: [66, 80], pace: [84, 92], stamina: [74, 88] }
  },
  AM: {
    LOW: { shooting: [50, 60], passing: [57, 67], dribbling: [54, 66], defending: [24, 38], physical: [48, 58], pace: [50, 62], stamina: [52, 64] },
    MODERATE: { shooting: [60, 74], passing: [66, 80], dribbling: [64, 78], defending: [32, 46], physical: [56, 68], pace: [60, 74], stamina: [62, 76] },
    HIGH: { shooting: [72, 88], passing: [78, 92], dribbling: [76, 92], defending: [40, 54], physical: [66, 78], pace: [70, 84], stamina: [72, 86] }
  },
  CM: {
    LOW: { shooting: [42, 54], passing: [55, 66], dribbling: [48, 60], defending: [45, 58], physical: [48, 60], pace: [45, 56], stamina: [55, 66] },
    MODERATE: { shooting: [52, 66], passing: [66, 80], dribbling: [58, 72], defending: [52, 66], physical: [58, 72], pace: [54, 68], stamina: [66, 80] },
    HIGH: { shooting: [62, 76], passing: [78, 92], dribbling: [70, 84], defending: [60, 78], physical: [68, 82], pace: [62, 76], stamina: [78, 92] }
  },
  DM: {
    LOW: { shooting: [28, 42], passing: [52, 62], dribbling: [42, 54], defending: [58, 66], physical: [54, 66], pace: [44, 56], stamina: [55, 66] },
    MODERATE: { shooting: [38, 54], passing: [62, 76], dribbling: [52, 66], defending: [66, 80], physical: [64, 78], pace: [54, 68], stamina: [66, 80] },
    HIGH: { shooting: [48, 62], passing: [74, 88], dribbling: [62, 76], defending: [78, 92], physical: [76, 92], pace: [62, 76], stamina: [78, 92] }
  },
  CB: {
    LOW: { shooting: [12, 24], passing: [40, 52], dribbling: [20, 35], defending: [58, 66], physical: [55, 66], pace: [40, 54], stamina: [50, 62] },
    MODERATE: { shooting: [20, 34], passing: [50, 64], dribbling: [32, 50], defending: [66, 80], physical: [66, 80], pace: [50, 64], stamina: [60, 74] },
    HIGH: { shooting: [28, 42], passing: [60, 74], dribbling: [44, 65], defending: [78, 92], physical: [78, 92], pace: [60, 74], stamina: [70, 84] }
  },
  LB: {
    LOW: { shooting: [18, 30], passing: [46, 58], dribbling: [42, 55], defending: [55, 64], physical: [48, 60], pace: [55, 66], stamina: [54, 66] },
    MODERATE: { shooting: [28, 42], passing: [56, 70], dribbling: [50, 64], defending: [64, 78], physical: [58, 72], pace: [66, 80], stamina: [66, 80] },
    HIGH: { shooting: [38, 52], passing: [68, 82], dribbling: [58, 72], defending: [76, 90], physical: [68, 82], pace: [78, 92], stamina: [76, 90] }
  },
  RB: {
    LOW: { shooting: [18, 30], passing: [46, 58], dribbling: [42, 55], defending: [55, 64], physical: [48, 60], pace: [55, 66], stamina: [54, 66] },
    MODERATE: { shooting: [28, 42], passing: [56, 70], dribbling: [50, 64], defending: [64, 78], physical: [58, 72], pace: [66, 80], stamina: [66, 80] },
    HIGH: { shooting: [38, 52], passing: [68, 82], dribbling: [58, 72], defending: [76, 90], physical: [68, 82], pace: [78, 92], stamina: [76, 90] }
  }
};

const outfieldOverallWeights: Record<Exclude<FootballPosition, typeof FootballPosition.GK>, Record<OutfieldKey, number>> = {
  ST: { shooting: 0.28, pace: 0.2, dribbling: 0.18, physical: 0.14, passing: 0.12, stamina: 0.08, defending: 0 },
  LW: { pace: 0.34, dribbling: 0.3, shooting: 0.18, passing: 0.08, stamina: 0.06, physical: 0.04, defending: 0 },
  RW: { pace: 0.34, dribbling: 0.3, shooting: 0.18, passing: 0.08, stamina: 0.06, physical: 0.04, defending: 0 },
  AM: { passing: 0.28, dribbling: 0.22, shooting: 0.2, pace: 0.12, stamina: 0.1, physical: 0.08, defending: 0 },
  CM: { passing: 0.26, stamina: 0.18, dribbling: 0.16, defending: 0.16, physical: 0.12, shooting: 0.12, pace: 0 },
  DM: { defending: 0.3, passing: 0.2, physical: 0.16, stamina: 0.16, pace: 0.1, dribbling: 0.08, shooting: 0 },
  CB: { defending: 0.36, physical: 0.18, stamina: 0.14, passing: 0.12, pace: 0.1, dribbling: 0.06, shooting: 0.04 },
  LB: { defending: 0.24, pace: 0.2, stamina: 0.18, passing: 0.14, dribbling: 0.14, physical: 0.08, shooting: 0.02 },
  RB: { defending: 0.24, pace: 0.2, stamina: 0.18, passing: 0.14, dribbling: 0.14, physical: 0.08, shooting: 0.02 }
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seed: string) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function pick<T>(items: T[], random: () => number) {
  if (items.length === 0) {
    throw new AppError(400, "Cannot pick from an empty simulation pool");
  }
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
}

function detailedPosition(player: SimPlayer): FootballPosition {
  if (player.football_position) return player.football_position;
  if (player.position === PlayerPosition.GK) return FootballPosition.GK;
  if (player.position === PlayerPosition.DEF) return FootballPosition.CB;
  if (player.position === PlayerPosition.MID) return FootballPosition.CM;
  return FootballPosition.ST;
}

function dribbleCap(position: FootballPosition) {
  if (position === FootballPosition.CB) return [2, 1] as const;
  if (position === FootballPosition.LB || position === FootballPosition.RB) return [5, 3] as const;
  if (position === FootballPosition.DM) return [4, 2] as const;
  if (position === FootballPosition.CM) return [5, 3] as const;
  if (position === FootballPosition.AM) return [7, 5] as const;
  if (position === FootballPosition.LW || position === FootballPosition.RW) return [9, 6] as const;
  if (position === FootballPosition.ST) return [6, 4] as const;
  return [0, 0] as const;
}

function avg(players: SimPlayer[], selector: (player: SimPlayer) => number) {
  return players.reduce((sum, player) => sum + selector(player), 0) / Math.max(players.length, 1);
}

function avgNumbers(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1));
}

function distributeCount(
  total: number,
  players: SimPlayer[],
  weightForPlayer: (player: SimPlayer) => number,
  random: () => number
) {
  const result = new Map<string, number>();
  if (total <= 0 || players.length === 0) return result;
  const weighted = players.map((player) => ({
    player,
    weight: Math.max(1, weightForPlayer(player))
  }));
  for (let i = 0; i < total; i += 1) {
    const weightTotal = weighted.reduce((sum, item) => sum + item.weight, 0);
    let cursor = random() * weightTotal;
    let selected = weighted[weighted.length - 1]!.player;
    for (const item of weighted) {
      cursor -= item.weight;
      if (cursor <= 0) {
        selected = item.player;
        break;
      }
    }
    result.set(selected.player_registration_id, (result.get(selected.player_registration_id) ?? 0) + 1);
  }
  return result;
}

function gkStrength(player: SimPlayer) {
  return (
    (player.shot_stopping ?? player.goalkeeping) * 0.24 +
    (player.reflexes ?? player.goalkeeping) * 0.22 +
    (player.positioning ?? player.goalkeeping) * 0.18 +
    (player.handling ?? player.goalkeeping) * 0.16 +
    (player.diving ?? player.goalkeeping) * 0.14 +
    player.physical * 0.06
  );
}

function teamStrength(players: SimPlayer[]): Strength {
  const starters = players.filter((player) => player.is_starter);
  const gk = starters.find((player) => detailedPosition(player) === FootballPosition.GK);
  const outfield = starters.filter((player) => detailedPosition(player) !== FootballPosition.GK);
  const attack = avg(outfield, (player) => {
    const pos = detailedPosition(player);
    const value = player.shooting + player.dribbling + player.pace;
    const weight = pos === FootballPosition.ST || pos === FootballPosition.LW || pos === FootballPosition.RW ? 1.25 : pos === FootballPosition.AM ? 1.05 : 0.72;
    return (value / 3) * weight;
  });
  const midfield = avg(outfield, (player) => {
    const pos = detailedPosition(player);
    const value = player.passing + (player.stamina ?? player.physical) + player.dribbling;
    const weight = pos === FootballPosition.CM || pos === FootballPosition.AM || pos === FootballPosition.DM ? 1.2 : 0.82;
    return (value / 3) * weight;
  });
  const defense = avg(outfield, (player) => {
    const pos = detailedPosition(player);
    const value = player.defending + player.physical + (player.stamina ?? player.physical);
    const weight = pos === FootballPosition.CB || pos === FootballPosition.LB || pos === FootballPosition.RB || pos === FootballPosition.DM ? 1.22 : 0.68;
    return (value / 3) * weight;
  });
  const keeper = gk ? gkStrength(gk) : 45;
  return { attack, midfield, defense, keeper, overall: attack * 0.34 + midfield * 0.29 + defense * 0.25 + keeper * 0.12 };
}

function teamGoals(expected: number, random: () => number, mismatch: number) {
  const surprise = (random() - 0.5) * 1.2;
  const value = expected + surprise;
  const cap = mismatch > 22 && random() > 0.88 ? 6 : 5;
  return clamp(value, 0, cap);
}

function makeTeamStats(own: Strength, opp: Strength, possession: number, goals: number, seed: string, side: VenueSide): SimTeamStats {
  const random = rng(`${seed}:team:${side}`);
  const chanceEdge = own.attack - opp.defense * 0.72 - opp.keeper * 0.28;
  const shots = clamp(9 + chanceEdge * 0.12 + goals * 1.6 + random() * 5, 3, 26);
  const shotsOnTarget = clamp(Math.max(goals, shots * (0.28 + own.attack / 520) + random() * 2), goals, shots);
  const bigChances = clamp(goals + Math.max(0, chanceEdge) / 18 + random() * 2, goals, shots);
  const passes = clamp(235 + possession * 5.4 + own.midfield * 2.1 + random() * 90, 180, 820);
  const accuracy = clamp(65 + own.midfield * 0.23 - opp.defense * 0.06 + random() * 5, 58, 91);
  const fouls = clamp(8 + random() * 10 + Math.max(0, opp.midfield - own.midfield) * 0.05, 4, 20);
  const yellowCards = clamp(fouls / 6 + random() * 1.6, 0, 4);
  const redCards = random() > 0.965 ? 1 : 0;
  return {
    possession,
    shots,
    shots_on_target: shotsOnTarget,
    big_chances: bigChances,
    big_chances_missed: clamp(bigChances - goals + random(), 0, bigChances),
    passes,
    accurate_passes: clamp((passes * accuracy) / 100, 0, passes),
    fouls,
    yellow_cards: yellowCards,
    red_cards: redCards,
    corners: clamp(shots / 3 + random() * 3, 0, 10),
    offsides: clamp(random() * 4, 0, 6)
  };
}

function distributeGoals(starters: SimPlayer[], goals: number, seed: string, side: VenueSide) {
  const random = rng(`${seed}:goals:${side}`);
  const outfield = starters.filter((player) => detailedPosition(player) !== FootballPosition.GK);
  const scorerPool = outfield.flatMap((player) => {
    const pos = detailedPosition(player);
    const weight = pos === FootballPosition.ST ? 5 : pos === FootballPosition.LW || pos === FootballPosition.RW ? 4 : pos === FootballPosition.AM ? 3 : pos === FootballPosition.CM ? 2 : 1;
    return Array.from({ length: weight }, () => player);
  });
  const assistPool = outfield.filter((player) => detailedPosition(player) !== FootballPosition.CB);
  const scorers: string[] = [];
  const assists: string[] = [];
  const events: SimMatchEvent[] = [];
  for (let i = 0; i < goals; i += 1) {
    const scorer = pick(scorerPool, random);
    const assister = assistPool.filter((player) => player.player_registration_id !== scorer.player_registration_id);
    scorers.push(scorer.player_registration_id);
    if (assister.length && random() > 0.22) {
      const assistPlayer = pick(assister, random);
      assists.push(assistPlayer.player_registration_id);
      events.push({
        minute: clamp(8 + ((i + 1) * 78) / (goals + 1) + (random() - 0.5) * 12, 1, 90),
        side,
        type: MatchEventType.GOAL,
        player_registration_id: scorer.player_registration_id,
        related_player_registration_id: assistPlayer.player_registration_id
      });
    } else {
      events.push({
        minute: clamp(8 + ((i + 1) * 78) / (goals + 1) + (random() - 0.5) * 12, 1, 90),
        side,
        type: MatchEventType.GOAL,
        player_registration_id: scorer.player_registration_id
      });
    }
  }
  return { scorers, assists, events };
}

function generateSubstitutions(players: SimPlayer[], seed: string, side: VenueSide): SimSubstitution[] {
  const random = rng(`${seed}:subs:${side}`);
  const starters = players.filter((player) => player.is_starter && detailedPosition(player) !== FootballPosition.GK);
  const bench = players.filter((player) => !player.is_starter);
  const count = Math.min(bench.length, clamp(2 + random() * 3, 0, 5));
  const usedOut = new Set<string>();
  const usedIn = new Set<string>();
  const reasons: SimSubstitution["reason"][] = ["LOW_RATING", "FATIGUE", "TACTICAL_CHANGE", "YELLOW_CARD_RISK"];
  return Array.from({ length: count }, (_, index) => {
    const outPool = starters.filter((player) => !usedOut.has(player.player_registration_id));
    const inPool = bench.filter((player) => !usedIn.has(player.player_registration_id));
    const out = pick(outPool, random);
    const incoming = pick(inPool, random);
    usedOut.add(out.player_registration_id);
    usedIn.add(incoming.player_registration_id);
    return {
      minute: clamp(45 + random() * 40 + index * 2, 45, 85),
      side,
      player_out_registration_id: out.player_registration_id,
      player_in_registration_id: incoming.player_registration_id,
      reason: pick(reasons, random)
    };
  }).sort((a, b) => a.minute - b.minute);
}

function allocateStats(
  players: SimPlayer[],
  teamStats: SimTeamStats,
  ownGoals: number,
  opponentGoals: number,
  opponentShotsOnTarget: number,
  seed: string,
  side: VenueSide,
  won: boolean,
  lost: boolean,
  substitutions: SimSubstitution[]
) {
  const starters = players.filter((player) => player.is_starter);
  const benchIn = players.filter((player) => substitutions.some((sub) => sub.player_in_registration_id === player.player_registration_id));
  const active = [...starters, ...benchIn];
  const { scorers, assists, events } = distributeGoals(starters, ownGoals, seed, side);
  const random = rng(`${seed}:players:${side}`);
  const passWeight = active.reduce((sum, player) => sum + (detailedPosition(player) === FootballPosition.GK ? (player.distribution ?? player.passing) * 0.5 : player.passing), 0) || 1;
  const yellowSet = new Set(active.slice(0, teamStats.yellow_cards).map((player) => player.player_registration_id));
  const redSet = new Set(teamStats.red_cards ? [active[active.length - 1]?.player_registration_id] : []);
  const outfieldActive = active.filter((player) => detailedPosition(player) !== FootballPosition.GK);
  const chanceCreatorWeight = (player: SimPlayer) => {
    const position = detailedPosition(player);
    const roleWeight =
      position === FootballPosition.AM ? 1.65 :
      position === FootballPosition.CM ? 1.35 :
      position === FootballPosition.LW || position === FootballPosition.RW ? 1.45 :
      position === FootballPosition.ST ? 1.15 :
      position === FootballPosition.LB || position === FootballPosition.RB ? 1 :
      position === FootballPosition.DM ? 0.9 :
      0.45;
    return (player.passing * 0.55 + player.dribbling * 0.25 + player.pace * 0.2) * roleWeight;
  };
  const bigChanceCreatedByPlayer = distributeCount(teamStats.big_chances, outfieldActive, chanceCreatorWeight, random);
  const bigChanceMissedByPlayer = distributeCount(
    teamStats.big_chances_missed,
    outfieldActive.filter((player) => {
      const position = detailedPosition(player);
      return position === FootballPosition.ST || position === FootballPosition.LW || position === FootballPosition.RW || position === FootballPosition.AM;
    }).length
      ? outfieldActive.filter((player) => {
          const position = detailedPosition(player);
          return position === FootballPosition.ST || position === FootballPosition.LW || position === FootballPosition.RW || position === FootballPosition.AM;
        })
      : outfieldActive,
    (player) => {
      const position = detailedPosition(player);
      const roleWeight = position === FootballPosition.ST ? 1.7 : position === FootballPosition.LW || position === FootballPosition.RW ? 1.35 : position === FootballPosition.AM ? 1.1 : 0.45;
      return (player.shooting * 0.55 + player.pace * 0.2 + player.dribbling * 0.25) * roleWeight;
    },
    random
  );

  return {
    stats: active.map((player) => {
      const position = detailedPosition(player);
      const subOut = substitutions.find((sub) => sub.player_out_registration_id === player.player_registration_id);
      const subIn = substitutions.find((sub) => sub.player_in_registration_id === player.player_registration_id);
      const minutes = subOut ? subOut.minute : subIn ? 90 - subIn.minute : 90;
      const playerGoals = scorers.filter((id) => id === player.player_registration_id).length;
      const playerAssists = assists.filter((id) => id === player.player_registration_id).length;
      const yellow = yellowSet.has(player.player_registration_id) ? 1 : 0;
      const red = redSet.has(player.player_registration_id) ? 1 : 0;

      if (position === FootballPosition.GK) {
        const saves = clamp(opponentShotsOnTarget - opponentGoals, 0, 14);
        const divingSaves = clamp(saves * (0.25 + (player.diving ?? player.goalkeeping) / 260) * random(), 0, saves);
        const savesInsideBox = clamp(saves * (0.45 + random() * 0.35), 0, saves);
        const passes = clamp(18 + (player.distribution ?? player.passing) * 0.32 + random() * 10, 10, 55);
        const accuratePasses = clamp(passes * (0.55 + (player.distribution ?? player.passing) / 260), 0, passes);
        const rating = ratingForGoalkeeper({ saves, goalsConceded: opponentGoals, divingSaves, savesInsideBox, yellow, red, won, lost });
        return {
          player_registration_id: player.player_registration_id,
          minutes,
          position_played: position,
          goals: 0,
          assists: 0,
          shots: 0,
          shots_on_target: 0,
          chances_created: 0,
          big_chances_created: 0,
          big_chances_missed: 0,
          passes,
          accurate_passes: accuratePasses,
          tackles: 0,
          interceptions: 0,
          clearances: clamp(1 + random() * 3, 0, 6),
          blocks: 0,
          fouls_committed: 0,
          saves,
          goals_conceded: opponentGoals,
          accurate_long_balls: clamp(accuratePasses * 0.3, 0, accuratePasses),
          diving_saves: divingSaves,
          saves_inside_box: savesInsideBox,
          dribbles_attempted: 0,
          successful_dribbles: 0,
          dispossessed: 0,
          yellow_cards: yellow,
          red_cards: red,
          rating
        };
      }

      const [attemptCap, successCap] = dribbleCap(position);
      const share = player.passing / passWeight;
      const passes = clamp(teamStats.passes * share * (minutes / 90), 5, position === FootballPosition.CM || position === FootballPosition.DM ? 100 : 75);
      const accuratePasses = clamp(passes * (0.58 + player.passing / 290), 0, passes);
      const dribblesAttempted = clamp((player.dribbling / 18 + random() * 2.5) * (minutes / 90), 0, attemptCap);
      const successfulDribbles = clamp(dribblesAttempted * (0.35 + player.dribbling / 260), 0, successCap);
      const shotCap = position === FootballPosition.ST ? 7 : position === FootballPosition.LW || position === FootballPosition.RW ? 5 : position === FootballPosition.AM ? 4 : 2;
      const bigChancesCreated = bigChanceCreatedByPlayer.get(player.player_registration_id) ?? 0;
      const bigChancesMissed = bigChanceMissedByPlayer.get(player.player_registration_id) ?? 0;
      const shots = clamp(playerGoals + bigChancesMissed + player.shooting / 35 + random() * 2, playerGoals + bigChancesMissed, shotCap);
      const shotsOnTarget = clamp(playerGoals + shots * (0.25 + player.shooting / 330), playerGoals, shots);
      const chancesCreated = clamp(
        Math.max(bigChancesCreated, playerAssists + (position === FootballPosition.AM || position === FootballPosition.CM ? random() * 4 : random() * 2)),
        Math.max(playerAssists, bigChancesCreated),
        8
      );
      const tackles = clamp((position === FootballPosition.CB || position === FootballPosition.DM ? 2 : 0) + player.defending / 32 + random() * 2, 0, 8);
      const interceptions = clamp((position === FootballPosition.CB || position === FootballPosition.DM ? 2 : 0) + player.defending / 40 + random() * 2, 0, 7);
      const clearances = clamp(position === FootballPosition.CB ? 3 + random() * 5 : position === FootballPosition.LB || position === FootballPosition.RB ? random() * 4 : random() * 2, 0, 10);
      const blocks = clamp(position === FootballPosition.CB || position === FootballPosition.DM ? random() * 3 : random(), 0, 5);
      const dispossessed = clamp(random() * (position === FootballPosition.ST || position === FootballPosition.LW || position === FootballPosition.RW ? 4 : 2), 0, 6);
      const foulsCommitted = clamp(random() * 3 + (position === FootballPosition.CB || position === FootballPosition.DM ? 1 : 0), 0, 5);
      const rating = ratingForOutfield({
        goals: playerGoals,
        assists: playerAssists,
        chancesCreated,
        passAccuracy: passes ? accuratePasses / passes : 0,
        successfulDribbles,
        tackles,
        interceptions,
        clearances,
        bigChancesMissed,
        dispossessed,
        yellow,
        red,
        won,
        lost,
        position
      });
      return {
        player_registration_id: player.player_registration_id,
        minutes,
        position_played: position,
        goals: playerGoals,
        assists: playerAssists,
        shots,
        shots_on_target: shotsOnTarget,
        chances_created: chancesCreated,
        big_chances_created: bigChancesCreated,
        big_chances_missed: bigChancesMissed,
        passes,
        accurate_passes: accuratePasses,
        tackles,
        interceptions,
        clearances,
        blocks,
        fouls_committed: foulsCommitted,
        saves: 0,
        dribbles_attempted: dribblesAttempted,
        successful_dribbles: successfulDribbles,
        dispossessed,
        yellow_cards: yellow,
        red_cards: red,
        rating
      };
    }),
    events
  };
}

function ratingForOutfield(input: {
  goals: number;
  assists: number;
  chancesCreated: number;
  passAccuracy: number;
  successfulDribbles: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  bigChancesMissed: number;
  dispossessed: number;
  yellow: number;
  red: number;
  won: boolean;
  lost: boolean;
  position: FootballPosition;
}) {
  const defensiveBonus =
    input.position === FootballPosition.CB || input.position === FootballPosition.LB || input.position === FootballPosition.RB || input.position === FootballPosition.DM
      ? (input.tackles + input.interceptions + input.clearances) * 0.06
      : 0;
  const value =
    6.5 +
    input.goals * 0.72 +
    input.assists * 0.45 +
    input.chancesCreated * 0.08 +
    Math.max(0, input.passAccuracy - 0.75) * 1.2 +
    input.successfulDribbles * 0.06 +
    defensiveBonus -
    input.bigChancesMissed * 0.18 -
    input.dispossessed * 0.08 -
    input.yellow * 0.25 -
    input.red * 1.1 +
    (input.won ? 0.18 : 0) -
    (input.lost ? 0.16 : 0);
  return Number(Math.max(input.red ? 4.8 : 5.5, Math.min(9.8, value)).toFixed(1));
}

function ratingForGoalkeeper(input: {
  saves: number;
  goalsConceded: number;
  divingSaves: number;
  savesInsideBox: number;
  yellow: number;
  red: number;
  won: boolean;
  lost: boolean;
}) {
  const value =
    6.5 +
    (input.goalsConceded === 0 ? 0.45 : 0) +
    input.saves * 0.15 +
    input.divingSaves * 0.12 +
    input.savesInsideBox * 0.08 -
    input.goalsConceded * 0.28 -
    input.yellow * 0.25 -
    input.red * 1.1 +
    (input.won ? 0.18 : 0) -
    (input.lost ? 0.16 : 0);
  return Number(Math.max(input.red ? 4.8 : 5.5, Math.min(9.8, value)).toFixed(1));
}

export type GeneratedGoalkeeperAbility = {
  position: typeof FootballPosition.GK;
  rating_tier: PlayerAbilityRating;
  shot_stopping: number;
  reflexes: number;
  positioning: number;
  handling: number;
  diving: number;
  distribution: number;
  physical: number;
  communication: number;
  overall_rating: number;
  is_hidden_from_manager: true;
};

export type GeneratedOutfieldAbility = {
  position: Exclude<FootballPosition, typeof FootballPosition.GK>;
  rating_tier: PlayerAbilityRating;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  pace: number;
  stamina: number;
  overall_rating: number;
  is_hidden_from_manager: true;
};

export type GeneratedAbility = GeneratedGoalkeeperAbility | GeneratedOutfieldAbility;

function rollRange(random: () => number, [low, high]: Range, allowHighSpike = false) {
  const spike = allowHighSpike && random() > 0.94 ? random() * 4 : 0;
  return clamp(low + random() * (high - low) + spike, low, Math.min(92, high));
}

function weightedOutfieldOverall(position: Exclude<FootballPosition, typeof FootballPosition.GK>, ability: Record<OutfieldKey, number>) {
  const weights = outfieldOverallWeights[position];
  return clamp(
    outfieldKeys.reduce((total, key) => total + ability[key] * weights[key], 0),
    1,
    92
  );
}

function weightedGoalkeeperOverall(ability: Record<GkKey, number>) {
  return clamp(
    ability.shot_stopping * 0.22 +
      ability.reflexes * 0.18 +
      ability.positioning * 0.16 +
      ability.handling * 0.14 +
      ability.diving * 0.14 +
      ability.distribution * 0.08 +
      ability.physical * 0.05 +
      ability.communication * 0.03,
    1,
    92
  );
}

export function generateAbilityScores(tier: PlayerAbilityRating, position: FootballPosition, seed: string): GeneratedAbility {
  const random = rng(`${seed}:ability:${tier}:${position}`);
  const [min, max] = tierRanges[tier];
  const tierMax = tier === "HIGH" ? 92 : max;
  const roll = (low = min, high = tierMax) => {
    const veryHigh = tier === "HIGH" && random() > 0.94;
    return clamp(low + random() * (high - low) + (veryHigh ? random() * 4 : 0), low, high);
  };
  const strong = () => roll(min, tierMax);
  const boost = (value: number, amount: number, cap = tierMax) => clamp(value + amount, min, cap);
  if (position === FootballPosition.GK) {
    const ability = Object.fromEntries(gkKeys.map((key) => [key, strong()])) as Record<(typeof gkKeys)[number], number>;
    ability.shot_stopping = boost(ability.shot_stopping, 4);
    ability.reflexes = boost(ability.reflexes, 4);
    ability.positioning = boost(ability.positioning, 2);
    const overall_rating = weightedGoalkeeperOverall(ability);
    return { position: FootballPosition.GK, rating_tier: tier, ...ability, overall_rating, is_hidden_from_manager: true };
  }
  const outfieldPosition = position as Exclude<FootballPosition, typeof FootballPosition.GK>;
  const ranges = positionAbilityRanges[outfieldPosition][tier];
  const ability = Object.fromEntries(
    outfieldKeys.map((key) => [key, rollRange(random, ranges[key], tier === "HIGH" && ["shooting", "passing", "dribbling", "defending", "pace", "stamina"].includes(key))])
  ) as Record<OutfieldKey, number>;
  const overall_rating = weightedOutfieldOverall(outfieldPosition, ability);
  return { position: outfieldPosition, rating_tier: tier, ...ability, overall_rating, is_hidden_from_manager: true };
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
    if ((stats.offsides ?? 0) < 0) throw new AppError(400, `${label} offsides cannot be negative`);
  }
  for (const player of result.player_stats) {
    if (player.successful_dribbles > player.dribbles_attempted) throw new AppError(400, "A player's successful dribbles exceed attempted dribbles");
    if ((player.shots_on_target ?? 0) > player.shots) throw new AppError(400, "A player's shots on target exceed shots");
    if (player.accurate_passes > player.passes) throw new AppError(400, "A player's accurate passes exceed passes");
    if ((player.diving_saves ?? 0) > player.saves) throw new AppError(400, "A goalkeeper's diving saves exceed saves");
    if ((player.saves_inside_box ?? 0) > player.saves) throw new AppError(400, "A goalkeeper's saves inside box exceed saves");
  }
}

export function simulateMatch(homePlayers: SimPlayer[], awayPlayers: SimPlayer[], fixtureId: string): SimulationResult {
  if (homePlayers.filter((p) => p.is_starter).length !== 11 || awayPlayers.filter((p) => p.is_starter).length !== 11) {
    throw new AppError(400, "Both confirmed lineups must have 11 starters");
  }
  const homeStarters = homePlayers.filter((player) => player.is_starter);
  const awayStarters = awayPlayers.filter((player) => player.is_starter);
  const home = teamStrength(homePlayers);
  const away = teamStrength(awayPlayers);
  const seed = `${fixtureId}:${homeStarters.map((p) => p.player_registration_id).join("|")}:${awayStarters.map((p) => p.player_registration_id).join("|")}`;
  const random = rng(seed);
  const homeQuality = home.overall * 0.7 + (35 + random() * 50) * 0.3;
  const awayQuality = away.overall * 0.7 + (35 + random() * 50) * 0.3;
  const mismatch = Math.abs(home.overall - away.overall);
  const homeExpected = Math.max(0.15, 1.18 + (homeQuality - away.defense * 0.82 - away.keeper * 0.18) / 42 + 0.2);
  const awayExpected = Math.max(0.15, 1.08 + (awayQuality - home.defense * 0.82 - home.keeper * 0.18) / 42);
  const homeScore = teamGoals(homeExpected, random, mismatch);
  const awayScore = teamGoals(awayExpected, random, mismatch);
  const homePossession = clamp(50 + (home.midfield - away.midfield) * 0.42 + (random() - 0.5) * 9, 35, 65);
  const awayPossession = 100 - homePossession;
  const homeStats = makeTeamStats(home, away, homePossession, homeScore, seed, VenueSide.HOME);
  const awayStats = makeTeamStats(away, home, awayPossession, awayScore, seed, VenueSide.AWAY);
  const homeSubs = generateSubstitutions(homePlayers, seed, VenueSide.HOME);
  const awaySubs = generateSubstitutions(awayPlayers, seed, VenueSide.AWAY);
  const homeAllocated = allocateStats(homePlayers, homeStats, homeScore, awayScore, awayStats.shots_on_target, seed, VenueSide.HOME, homeScore > awayScore, homeScore < awayScore, homeSubs);
  const awayAllocated = allocateStats(awayPlayers, awayStats, awayScore, homeScore, homeStats.shots_on_target, seed, VenueSide.AWAY, awayScore > homeScore, awayScore < homeScore, awaySubs);
  const sumPlayerStats = (stats: SimPlayerStats[], field: keyof SimPlayerStats) => stats.reduce((total, stat) => total + Number(stat[field] ?? 0), 0);
  const finalizedHomeStats = {
    ...homeStats,
    rating: avgNumbers(homeAllocated.stats.map((stat) => stat.rating)),
    big_chances: sumPlayerStats(homeAllocated.stats, "big_chances_created"),
    big_chances_missed: sumPlayerStats(homeAllocated.stats, "big_chances_missed")
  };
  const finalizedAwayStats = {
    ...awayStats,
    rating: avgNumbers(awayAllocated.stats.map((stat) => stat.rating)),
    big_chances: sumPlayerStats(awayAllocated.stats, "big_chances_created"),
    big_chances_missed: sumPlayerStats(awayAllocated.stats, "big_chances_missed")
  };
  const result: SimulationResult = {
    home_score: homeScore,
    away_score: awayScore,
    home_stats: finalizedHomeStats,
    away_stats: finalizedAwayStats,
    player_stats: [...homeAllocated.stats, ...awayAllocated.stats],
    events: [...homeAllocated.events, ...awayAllocated.events].sort((a, b) => a.minute - b.minute),
    substitutions: [...homeSubs, ...awaySubs].sort((a, b) => a.minute - b.minute),
    simulation_seed: seed
  };
  validateSimulationConsistency(result);
  return result;
}
