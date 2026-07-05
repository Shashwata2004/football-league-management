import {
  FootballPosition,
  MatchEventType,
  PlayerPosition,
  VenueSide,
  type PlayerAbilityRating,
} from "@flms/shared";
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
  expected_goals: number;
  shots: number;
  shots_off_target: number;
  shots_on_target: number;
  hit_woodwork: number;
  big_chances: number;
  big_chances_missed: number;
  passes: number;
  accurate_passes: number;
  tackles: number;
  interceptions: number;
  blocks: number;
  clearances: number;
  keeper_saves: number;
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
  clean_sheet?: boolean;
  penalty_scored?: number;
  penalty_missed?: number;
  penalty_saved_for_gk?: number;
  dribbles_attempted: number;
  successful_dribbles: number;
  dribbled_past?: number;
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
  reason:
    | "LOW_RATING"
    | "FATIGUE"
    | "TACTICAL_CHANGE"
    | "YELLOW_CARD_RISK"
    | "INJURY_PLACEHOLDER"
    | "INJURY";
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

type Strength = {
  attack: number;
  midfield: number;
  defense: number;
  keeper: number;
  overall: number;
};

const tierRanges: Record<PlayerAbilityRating, [number, number]> = {
  LOW: [49, 54],
  MODERATE: [55, 72],
  HIGH: [73, 88],
};

const outfieldKeys = [
  "shooting",
  "passing",
  "dribbling",
  "defending",
  "physical",
  "pace",
  "stamina",
] as const;
const gkKeys = [
  "shot_stopping",
  "reflexes",
  "positioning",
  "handling",
  "diving",
  "distribution",
  "physical",
  "communication",
] as const;
type OutfieldKey = (typeof outfieldKeys)[number];
type GkKey = (typeof gkKeys)[number];
type Range = [number, number];
type OutfieldRanges = Record<OutfieldKey, Range>;

const positionAbilityRanges: Record<
  Exclude<FootballPosition, typeof FootballPosition.GK>,
  Record<PlayerAbilityRating, OutfieldRanges>
> = {
  ST: {
    LOW: {
      shooting: [58, 66],
      passing: [49, 58],
      dribbling: [52, 62],
      defending: [10, 20],
      physical: [50, 60],
      pace: [56, 66],
      stamina: [49, 59],
    },
    MODERATE: {
      shooting: [67, 79],
      passing: [58, 68],
      dribbling: [62, 74],
      defending: [15, 30],
      physical: [59, 70],
      pace: [66, 78],
      stamina: [58, 70],
    },
    HIGH: {
      shooting: [78, 92],
      passing: [67, 80],
      dribbling: [73, 88],
      defending: [20, 40],
      physical: [70, 84],
      pace: [76, 92],
      stamina: [68, 84],
    },
  },
  LW: {
    LOW: {
      shooting: [55, 64],
      passing: [51, 60],
      dribbling: [58, 69],
      defending: [18, 30],
      physical: [48, 58],
      pace: [66, 76],
      stamina: [52, 63],
    },
    MODERATE: {
      shooting: [62, 76],
      passing: [58, 70],
      dribbling: [68, 82],
      defending: [24, 40],
      physical: [56, 68],
      pace: [76, 88],
      stamina: [62, 76],
    },
    HIGH: {
      shooting: [74, 90],
      passing: [68, 82],
      dribbling: [80, 92],
      defending: [32, 50],
      physical: [66, 80],
      pace: [84, 92],
      stamina: [74, 88],
    },
  },
  RW: {
    LOW: {
      shooting: [55, 64],
      passing: [51, 60],
      dribbling: [58, 69],
      defending: [18, 30],
      physical: [48, 58],
      pace: [66, 76],
      stamina: [52, 63],
    },
    MODERATE: {
      shooting: [62, 76],
      passing: [58, 70],
      dribbling: [68, 82],
      defending: [24, 40],
      physical: [56, 68],
      pace: [76, 88],
      stamina: [62, 76],
    },
    HIGH: {
      shooting: [74, 90],
      passing: [68, 82],
      dribbling: [80, 92],
      defending: [32, 50],
      physical: [66, 80],
      pace: [84, 92],
      stamina: [74, 88],
    },
  },
  AM: {
    LOW: {
      shooting: [50, 60],
      passing: [57, 67],
      dribbling: [54, 66],
      defending: [24, 38],
      physical: [48, 58],
      pace: [50, 62],
      stamina: [52, 64],
    },
    MODERATE: {
      shooting: [60, 74],
      passing: [66, 80],
      dribbling: [64, 78],
      defending: [32, 46],
      physical: [56, 68],
      pace: [60, 74],
      stamina: [62, 76],
    },
    HIGH: {
      shooting: [72, 88],
      passing: [78, 92],
      dribbling: [76, 92],
      defending: [40, 54],
      physical: [66, 78],
      pace: [70, 84],
      stamina: [72, 86],
    },
  },
  CM: {
    LOW: {
      shooting: [42, 54],
      passing: [55, 66],
      dribbling: [48, 60],
      defending: [45, 58],
      physical: [48, 60],
      pace: [45, 56],
      stamina: [55, 66],
    },
    MODERATE: {
      shooting: [52, 66],
      passing: [66, 80],
      dribbling: [58, 72],
      defending: [52, 66],
      physical: [58, 72],
      pace: [54, 68],
      stamina: [66, 80],
    },
    HIGH: {
      shooting: [62, 76],
      passing: [78, 92],
      dribbling: [70, 84],
      defending: [60, 78],
      physical: [68, 82],
      pace: [62, 76],
      stamina: [78, 92],
    },
  },
  DM: {
    LOW: {
      shooting: [28, 42],
      passing: [52, 62],
      dribbling: [42, 54],
      defending: [58, 66],
      physical: [54, 66],
      pace: [44, 56],
      stamina: [55, 66],
    },
    MODERATE: {
      shooting: [38, 54],
      passing: [62, 76],
      dribbling: [52, 66],
      defending: [66, 80],
      physical: [64, 78],
      pace: [54, 68],
      stamina: [66, 80],
    },
    HIGH: {
      shooting: [48, 62],
      passing: [74, 88],
      dribbling: [62, 76],
      defending: [78, 92],
      physical: [76, 92],
      pace: [62, 76],
      stamina: [78, 92],
    },
  },
  CB: {
    LOW: {
      shooting: [12, 24],
      passing: [40, 52],
      dribbling: [20, 35],
      defending: [58, 66],
      physical: [55, 66],
      pace: [40, 54],
      stamina: [50, 62],
    },
    MODERATE: {
      shooting: [20, 34],
      passing: [50, 64],
      dribbling: [32, 50],
      defending: [66, 80],
      physical: [66, 80],
      pace: [50, 64],
      stamina: [60, 74],
    },
    HIGH: {
      shooting: [28, 42],
      passing: [60, 74],
      dribbling: [44, 65],
      defending: [78, 92],
      physical: [78, 92],
      pace: [60, 74],
      stamina: [70, 84],
    },
  },
  LB: {
    LOW: {
      shooting: [18, 30],
      passing: [46, 58],
      dribbling: [42, 55],
      defending: [55, 64],
      physical: [48, 60],
      pace: [55, 66],
      stamina: [54, 66],
    },
    MODERATE: {
      shooting: [28, 42],
      passing: [56, 70],
      dribbling: [50, 64],
      defending: [64, 78],
      physical: [58, 72],
      pace: [66, 80],
      stamina: [66, 80],
    },
    HIGH: {
      shooting: [38, 52],
      passing: [68, 82],
      dribbling: [58, 72],
      defending: [76, 90],
      physical: [68, 82],
      pace: [78, 92],
      stamina: [76, 90],
    },
  },
  RB: {
    LOW: {
      shooting: [18, 30],
      passing: [46, 58],
      dribbling: [42, 55],
      defending: [55, 64],
      physical: [48, 60],
      pace: [55, 66],
      stamina: [54, 66],
    },
    MODERATE: {
      shooting: [28, 42],
      passing: [56, 70],
      dribbling: [50, 64],
      defending: [64, 78],
      physical: [58, 72],
      pace: [66, 80],
      stamina: [66, 80],
    },
    HIGH: {
      shooting: [38, 52],
      passing: [68, 82],
      dribbling: [58, 72],
      defending: [76, 90],
      physical: [68, 82],
      pace: [78, 92],
      stamina: [76, 90],
    },
  },
};

const outfieldOverallWeights: Record<
  Exclude<FootballPosition, typeof FootballPosition.GK>,
  Record<OutfieldKey, number>
> = {
  ST: {
    shooting: 0.28,
    pace: 0.2,
    dribbling: 0.18,
    physical: 0.14,
    passing: 0.12,
    stamina: 0.08,
    defending: 0,
  },
  LW: {
    pace: 0.34,
    dribbling: 0.3,
    shooting: 0.18,
    passing: 0.08,
    stamina: 0.06,
    physical: 0.04,
    defending: 0,
  },
  RW: {
    pace: 0.34,
    dribbling: 0.3,
    shooting: 0.18,
    passing: 0.08,
    stamina: 0.06,
    physical: 0.04,
    defending: 0,
  },
  AM: {
    passing: 0.28,
    dribbling: 0.22,
    shooting: 0.2,
    pace: 0.12,
    stamina: 0.1,
    physical: 0.08,
    defending: 0,
  },
  CM: {
    passing: 0.26,
    stamina: 0.18,
    dribbling: 0.16,
    defending: 0.16,
    physical: 0.12,
    shooting: 0.12,
    pace: 0,
  },
  DM: {
    defending: 0.3,
    passing: 0.2,
    physical: 0.16,
    stamina: 0.16,
    pace: 0.1,
    dribbling: 0.08,
    shooting: 0,
  },
  CB: {
    defending: 0.36,
    physical: 0.18,
    stamina: 0.14,
    passing: 0.12,
    pace: 0.1,
    dribbling: 0.06,
    shooting: 0.04,
  },
  LB: {
    defending: 0.24,
    pace: 0.2,
    stamina: 0.18,
    passing: 0.14,
    dribbling: 0.14,
    physical: 0.08,
    shooting: 0.02,
  },
  RB: {
    defending: 0.24,
    pace: 0.2,
    stamina: 0.18,
    passing: 0.14,
    dribbling: 0.14,
    physical: 0.08,
    shooting: 0.02,
  },
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

function clampDecimal(value: number, min: number, max: number, decimals = 2) {
  return Number(Math.max(min, Math.min(max, value)).toFixed(decimals));
}

function pick<T>(items: T[], random: () => number) {
  if (items.length === 0) {
    throw new AppError(400, "Cannot pick from an empty simulation pool");
  }
  return items[
    Math.min(items.length - 1, Math.floor(random() * items.length))
  ]!;
}

function pickWeighted<T>(
  items: T[],
  weightForItem: (item: T) => number,
  random: () => number,
) {
  if (items.length === 0) {
    throw new AppError(400, "Cannot pick from an empty weighted pool");
  }
  const weighted = items.map((item) => ({
    item,
    weight: Math.max(0.01, weightForItem(item)),
  }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = random() * Math.max(total, 0.01);
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.item;
  }
  return weighted[weighted.length - 1]!.item;
}

function detailedPosition(player: SimPlayer): FootballPosition {
  if (player.football_position) return player.football_position;
  if (player.position === PlayerPosition.GK) return FootballPosition.GK;
  if (player.position === PlayerPosition.DEF) return FootballPosition.CB;
  if (player.position === PlayerPosition.MID) return FootballPosition.CM;
  return FootballPosition.ST;
}

function isPositionIn(position: FootballPosition, positions: FootballPosition[]) {
  return positions.includes(position);
}

function playerOverall(player: SimPlayer) {
  if (detailedPosition(player) === FootballPosition.GK) {
    return (
      (player.shot_stopping ?? player.goalkeeping) * 0.18 +
      (player.reflexes ?? player.goalkeeping) * 0.18 +
      (player.positioning ?? player.goalkeeping) * 0.16 +
      (player.handling ?? player.goalkeeping) * 0.14 +
      (player.diving ?? player.goalkeeping) * 0.14 +
      (player.distribution ?? player.passing) * 0.08 +
      player.physical * 0.07 +
      (player.communication ?? player.physical) * 0.05
    );
  }
  return (
    player.shooting * 0.14 +
    player.passing * 0.16 +
    player.dribbling * 0.15 +
    player.defending * 0.14 +
    player.physical * 0.14 +
    player.pace * 0.14 +
    (player.stamina ?? player.physical) * 0.13
  );
}

function roleAbilityScoreForPosition(role: FootballPosition, player: SimPlayer) {
  if (role === FootballPosition.GK) return gkStrength(player);
  if (role === FootballPosition.CB) {
    return (
      player.defending * 0.38 +
      player.physical * 0.22 +
      (player.stamina ?? player.physical) * 0.14 +
      player.passing * 0.12 +
      player.pace * 0.1 +
      player.dribbling * 0.04
    );
  }
  if (role === FootballPosition.LB || role === FootballPosition.RB) {
    return (
      player.defending * 0.25 +
      player.pace * 0.22 +
      (player.stamina ?? player.physical) * 0.18 +
      player.passing * 0.14 +
      player.dribbling * 0.12 +
      player.physical * 0.09
    );
  }
  if (role === FootballPosition.DM) {
    return (
      player.defending * 0.27 +
      player.passing * 0.23 +
      (player.stamina ?? player.physical) * 0.17 +
      player.physical * 0.15 +
      player.dribbling * 0.09 +
      player.pace * 0.09
    );
  }
  if (role === FootballPosition.CM) {
    return (
      player.passing * 0.29 +
      (player.stamina ?? player.physical) * 0.2 +
      player.dribbling * 0.15 +
      player.defending * 0.14 +
      player.physical * 0.11 +
      player.shooting * 0.11
    );
  }
  if (role === FootballPosition.AM) {
    return (
      player.passing * 0.27 +
      player.dribbling * 0.22 +
      player.shooting * 0.19 +
      player.pace * 0.15 +
      (player.stamina ?? player.physical) * 0.09 +
      player.physical * 0.08
    );
  }
  if (role === FootballPosition.LW || role === FootballPosition.RW) {
    return (
      player.pace * 0.28 +
      player.dribbling * 0.25 +
      player.shooting * 0.17 +
      player.passing * 0.15 +
      (player.stamina ?? player.physical) * 0.09 +
      player.physical * 0.06
    );
  }
  return (
    player.shooting * 0.36 +
    player.pace * 0.2 +
    player.physical * 0.14 +
    player.dribbling * 0.14 +
    player.passing * 0.09 +
    (player.stamina ?? player.physical) * 0.07
  );
}

function substitutionCompatibilityScore(
  targetRole: FootballPosition,
  incoming: SimPlayer,
) {
  const incomingPosition = detailedPosition(incoming);
  if (targetRole === FootballPosition.GK) {
    return incomingPosition === FootballPosition.GK ? 95 : -999;
  }
  if (incomingPosition === FootballPosition.GK) return -999;
  if (incomingPosition === targetRole) return 95;

  if (
    targetRole === FootballPosition.ST &&
    isPositionIn(incomingPosition, [
      FootballPosition.LW,
      FootballPosition.RW,
      FootballPosition.AM,
    ])
  ) {
    return 70;
  }
  if (
    targetRole === FootballPosition.AM &&
    isPositionIn(incomingPosition, [
      FootballPosition.CM,
      FootballPosition.LW,
      FootballPosition.RW,
      FootballPosition.ST,
    ]) &&
    incoming.passing >= 58 &&
    incoming.dribbling >= 58
  ) {
    return incomingPosition === FootballPosition.CM ? 68 : 72;
  }
  if (
    (targetRole === FootballPosition.LW || targetRole === FootballPosition.RW) &&
    isPositionIn(incomingPosition, [
      FootballPosition.AM,
      FootballPosition.ST,
      FootballPosition.LW,
      FootballPosition.RW,
    ]) &&
    incoming.pace >= 58 &&
    incoming.dribbling >= 56
  ) {
    return 68;
  }
  if (
    targetRole === FootballPosition.DM &&
    isPositionIn(incomingPosition, [
      FootballPosition.CM,
      FootballPosition.CB,
      FootballPosition.LB,
      FootballPosition.RB,
    ]) &&
    incoming.defending >= 55 &&
    incoming.passing >= 52
  ) {
    return incomingPosition === FootballPosition.CM ? 72 : 62;
  }
  if (
    targetRole === FootballPosition.CM &&
    isPositionIn(incomingPosition, [FootballPosition.DM, FootballPosition.AM])
  ) {
    return 70;
  }
  if (
    targetRole === FootballPosition.CB &&
    isPositionIn(incomingPosition, [
      FootballPosition.DM,
      FootballPosition.LB,
      FootballPosition.RB,
    ]) &&
    incoming.defending >= 58 &&
    incoming.physical >= 55
  ) {
    return incomingPosition === FootballPosition.DM ? 66 : 62;
  }
  if (
    (targetRole === FootballPosition.LB || targetRole === FootballPosition.RB) &&
    isPositionIn(incomingPosition, [
      FootballPosition.CB,
      FootballPosition.LB,
      FootballPosition.RB,
    ])
  ) {
    return 64;
  }
  return -999;
}

function substitutionFitScore(
  targetRole: FootballPosition,
  incoming: SimPlayer,
  random: () => number,
) {
  const compatibility = substitutionCompatibilityScore(targetRole, incoming);
  if (compatibility < 0) return -999;
  const roleScore = roleAbilityScoreForPosition(targetRole, incoming);
  return (
    compatibility * 1.15 +
    roleScore * 1.25 +
    playerOverall(incoming) * 0.25 +
    (incoming.stamina ?? incoming.physical) * 0.18 +
    random() * 6
  );
}

function dribbleCap(position: FootballPosition) {
  if (position === FootballPosition.CB) return [2, 1] as const;
  if (position === FootballPosition.LB || position === FootballPosition.RB)
    return [5, 3] as const;
  if (position === FootballPosition.DM) return [4, 2] as const;
  if (position === FootballPosition.CM) return [5, 3] as const;
  if (position === FootballPosition.AM) return [7, 5] as const;
  if (position === FootballPosition.LW || position === FootballPosition.RW)
    return [9, 6] as const;
  if (position === FootballPosition.ST) return [6, 4] as const;
  return [0, 0] as const;
}

function avg(players: SimPlayer[], selector: (player: SimPlayer) => number) {
  return (
    players.reduce((sum, player) => sum + selector(player), 0) /
    Math.max(players.length, 1)
  );
}

function avgNumbers(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return Number(
    (valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1),
  );
}

function distributeCount(
  total: number,
  players: SimPlayer[],
  weightForPlayer: (player: SimPlayer) => number,
  random: () => number,
) {
  const result = new Map<string, number>();
  if (total <= 0 || players.length === 0) return result;
  const weighted = players.map((player) => ({
    player,
    weight: Math.max(1, weightForPlayer(player)),
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
    result.set(
      selected.player_registration_id,
      (result.get(selected.player_registration_id) ?? 0) + 1,
    );
  }
  return result;
}

function countById(ids: string[]) {
  const result = new Map<string, number>();
  for (const id of ids) result.set(id, (result.get(id) ?? 0) + 1);
  return result;
}

function allocateIntegerTotal<T>(
  total: number,
  items: T[],
  idForItem: (item: T) => string,
  weightForItem: (item: T) => number,
) {
  const result = new Map<string, number>();
  if (total <= 0 || items.length === 0) return result;
  const weighted = items.map((item) => ({
    item,
    id: idForItem(item),
    weight: Math.max(0.01, weightForItem(item)),
  }));
  const weightTotal = weighted.reduce((sum, item) => sum + item.weight, 0);
  const raw = weighted.map((item) => {
    const value = (total * item.weight) / Math.max(weightTotal, 0.01);
    const floor = Math.floor(value);
    result.set(item.id, floor);
    return { ...item, fraction: value - floor };
  });
  let assigned = [...result.values()].reduce((sum, value) => sum + value, 0);
  for (const item of raw.sort((a, b) => b.fraction - a.fraction)) {
    if (assigned >= total) break;
    result.set(item.id, (result.get(item.id) ?? 0) + 1);
    assigned += 1;
  }
  return result;
}

function allocateCappedIntegerTotal<T>(
  total: number,
  items: T[],
  idForItem: (item: T) => string,
  minForItem: (item: T) => number,
  maxForItem: (item: T) => number,
  weightForItem: (item: T) => number,
) {
  const result = new Map<string, number>();
  if (items.length === 0) return result;
  let assigned = 0;
  for (const item of items) {
    const id = idForItem(item);
    const min = Math.max(0, Math.min(minForItem(item), maxForItem(item)));
    result.set(id, min);
    assigned += min;
  }
  let remaining = Math.max(0, total - assigned);
  while (remaining > 0) {
    const available = items.filter(
      (item) => (result.get(idForItem(item)) ?? 0) < maxForItem(item),
    );
    if (available.length === 0) break;
    const weights = available.map((item) => ({
      item,
      id: idForItem(item),
      capacity: maxForItem(item) - (result.get(idForItem(item)) ?? 0),
      weight: Math.max(0.01, weightForItem(item)),
    }));
    const weightTotal = weights.reduce((sum, item) => sum + item.weight, 0);
    let progressed = false;
    for (const item of weights.sort((a, b) => b.weight - a.weight)) {
      if (remaining <= 0) break;
      const share = Math.max(
        1,
        Math.round((remaining * item.weight) / Math.max(weightTotal, 0.01)),
      );
      const add = Math.min(item.capacity, share, remaining);
      if (add > 0) {
        result.set(item.id, (result.get(item.id) ?? 0) + add);
        remaining -= add;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return result;
}

function allocateWeightedRandomCappedTotal<T>(
  total: number,
  items: T[],
  idForItem: (item: T) => string,
  maxForItem: (item: T) => number,
  weightForItem: (item: T) => number,
  random: () => number,
) {
  const result = new Map<string, number>();
  for (const item of items) result.set(idForItem(item), 0);
  for (let i = 0; i < total; i += 1) {
    const available = items.filter(
      (item) => (result.get(idForItem(item)) ?? 0) < maxForItem(item),
    );
    if (!available.length) break;
    const weighted = available.map((item) => {
      const current = result.get(idForItem(item)) ?? 0;
      const fatiguePenalty = Math.max(0.35, 1 - current * 0.11);
      const matchNoise = 0.55 + random() * 0.9;
      return {
        item,
        id: idForItem(item),
        weight: Math.max(0.01, weightForItem(item) * fatiguePenalty * matchNoise),
      };
    });
    const weightTotal = weighted.reduce((sum, item) => sum + item.weight, 0);
    let cursor = random() * Math.max(weightTotal, 0.01);
    let selected = weighted[weighted.length - 1]!;
    for (const item of weighted) {
      cursor -= item.weight;
      if (cursor <= 0) {
        selected = item;
        break;
      }
    }
    result.set(selected.id, (result.get(selected.id) ?? 0) + 1);
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
  const gk = starters.find(
    (player) => detailedPosition(player) === FootballPosition.GK,
  );
  const outfield = starters.filter(
    (player) => detailedPosition(player) !== FootballPosition.GK,
  );
  const attack = avg(outfield, (player) => {
    const pos = detailedPosition(player);
    const value = player.shooting + player.dribbling + player.pace;
    const weight =
      pos === FootballPosition.ST ||
      pos === FootballPosition.LW ||
      pos === FootballPosition.RW
        ? 1.25
        : pos === FootballPosition.AM
          ? 1.05
          : 0.72;
    return (value / 3) * weight;
  });
  const midfield = avg(outfield, (player) => {
    const pos = detailedPosition(player);
    const value =
      player.passing + (player.stamina ?? player.physical) + player.dribbling;
    const weight =
      pos === FootballPosition.CM ||
      pos === FootballPosition.AM ||
      pos === FootballPosition.DM
        ? 1.2
        : 0.82;
    return (value / 3) * weight;
  });
  const defense = avg(outfield, (player) => {
    const pos = detailedPosition(player);
    const value =
      player.defending + player.physical + (player.stamina ?? player.physical);
    const weight =
      pos === FootballPosition.CB ||
      pos === FootballPosition.LB ||
      pos === FootballPosition.RB ||
      pos === FootballPosition.DM
        ? 1.22
        : 0.68;
    return (value / 3) * weight;
  });
  const keeper = gk ? gkStrength(gk) : 45;
  return {
    attack,
    midfield,
    defense,
    keeper,
    overall: attack * 0.34 + midfield * 0.29 + defense * 0.25 + keeper * 0.12,
  };
}

function poissonGoals(lambda: number, random: () => number) {
  const limit = Math.exp(-lambda);
  let product = 1;
  let goals = 0;

  while (goals < 9) {
    product *= random();
    if (product <= limit) break;
    goals += 1;
  }

  return goals;
}

function teamGoals(
  expected: number,
  random: () => number,
  mismatch: number,
  matchTempo = 1,
) {
  const finishingSwing = 0.82 + random() * 0.42;
  const upsetSpike = random() > 0.88 ? random() * 0.42 : 0;
  const chaosSpike = random() > 0.965 ? random() * 0.65 : 0;
  const lambda = clampDecimal(
    expected * matchTempo * finishingSwing + upsetSpike + chaosSpike,
    0.08,
    mismatch > 22 ? 2.65 : 2.35,
  );
  const goals = poissonGoals(lambda, random);
  const cap = mismatch > 22 && random() > 0.9 ? 6 : 5;
  return clamp(goals, 0, cap);
}

function makeTeamStats(
  own: Strength,
  opp: Strength,
  possession: number,
  goals: number,
  seed: string,
  side: VenueSide,
  matchTempo = 1,
): SimTeamStats {
  const random = rng(`${seed}:team:${side}`);
  const chanceEdge = own.attack - opp.defense * 0.72 - opp.keeper * 0.28;
  const dominanceBonus = Math.max(0, chanceEdge) * 0.045;
  const lowTempo = random() < 0.18 ? -2 : 0;
  const highTempo = random() > 0.92 ? 3 : 0;
  const tempoShotBoost = (matchTempo - 1) * 4.5;
  let shots = clamp(
    6 +
      dominanceBonus +
      goals * 1.05 +
      random() * 5 +
      lowTempo +
      highTempo +
      tempoShotBoost,
    2,
    random() > 0.965 ? 25 : 21,
  );
  const shotsOnTarget = clamp(
    Math.max(goals, shots * (0.24 + own.attack / 760) + random() * 1.4),
    goals,
    Math.min(shots, random() > 0.965 ? 11 : 9),
  );
  const bigChances = clamp(
    goals + Math.max(0, chanceEdge) / 36 + random() * 1.35,
    goals,
    Math.min(shots, random() > 0.96 ? 5 : 4),
  );
  const bigChancesMissed = clamp(
    bigChances - goals + random() * 0.65,
    0,
    Math.max(0, bigChances - Math.min(goals, bigChances)),
  );
  shots = Math.max(shots, goals + bigChancesMissed, shotsOnTarget);
  const passes = clamp(
    175 + possession * 4.2 + own.midfield * 1.25 + random() * 65,
    160,
    680,
  );
  const accuracy = clamp(
    65 + own.midfield * 0.23 - opp.defense * 0.06 + random() * 5,
    58,
    91,
  );
  const fouls = clamp(
    8 + random() * 10 + Math.max(0, opp.midfield - own.midfield) * 0.05,
    4,
    20,
  );
  const yellowCards = clamp(fouls / 6 + random() * 1.6, 0, 4);
  const redCards = random() > 0.965 ? 1 : 0;
  const hitWoodwork = clamp(
    (shots - shotsOnTarget) * 0.08 + random() * 0.7,
    0,
    3,
  );
  return {
    possession,
    shots,
    shots_off_target: clamp(shots - shotsOnTarget, 0, shots),
    shots_on_target: shotsOnTarget,
    hit_woodwork: hitWoodwork,
    big_chances: bigChances,
    big_chances_missed: bigChancesMissed,
    expected_goals: calculateExpectedGoalsFromStats({
      goals,
      shots,
      shotsOnTarget,
      bigChances,
      bigChancesMissed,
      hitWoodwork,
    }),
    passes,
    accurate_passes: clamp((passes * accuracy) / 100, 0, passes),
    tackles: 0,
    interceptions: 0,
    blocks: 0,
    clearances: 0,
    keeper_saves: 0,
    fouls,
    yellow_cards: yellowCards,
    red_cards: redCards,
    corners: clamp(shots / 3 + random() * 3, 0, 10),
    offsides: clamp(random() * 4, 0, 6),
  };
}

function calculateExpectedGoalsFromStats(input: {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  bigChances: number;
  bigChancesMissed: number;
  hitWoodwork: number;
}) {
  const raw =
    input.shots * 0.025 +
    input.shotsOnTarget * 0.045 +
    input.bigChances * 0.24 +
    input.bigChancesMissed * 0.065 +
    input.hitWoodwork * 0.06;
  const realisticLowScoreCap =
    input.goals <= 1 && raw > 1.85 ? 1.85 + (raw - 1.85) * 0.2 : raw;
  const finishingFloor = input.goals > 0 ? Math.min(0.32 + input.goals * 0.28, 1.25) : 0.04;
  return clampDecimal(Math.max(realisticLowScoreCap, finishingFloor), 0.04, 3.6);
}

function playerActiveWindow(
  player: SimPlayer,
  substitutions: SimSubstitution[],
) {
  const subIn = substitutions.find(
    (sub) => sub.player_in_registration_id === player.player_registration_id,
  );
  const subOut = substitutions.find(
    (sub) => sub.player_out_registration_id === player.player_registration_id,
  );
  const start = player.is_starter ? 1 : subIn?.minute;
  const end = subOut?.minute ?? 90;
  return {
    start: start ?? null,
    end,
    minutes:
      start === undefined || start === null ? 0 : Math.max(0, end - start + 1),
  };
}

function isPlayerActiveAtMinute(
  player: SimPlayer,
  substitutions: SimSubstitution[],
  minute: number,
) {
  const window = playerActiveWindow(player, substitutions);
  return window.start !== null && minute >= window.start && minute <= window.end;
}

function distributeGoals(
  players: SimPlayer[],
  substitutions: SimSubstitution[],
  goals: number,
  seed: string,
  side: VenueSide,
) {
  const random = rng(`${seed}:goals:${side}`);
  const outfield = players.filter(
    (player) => detailedPosition(player) !== FootballPosition.GK,
  );
  const scoreWeight = (player: SimPlayer) => {
    const pos = detailedPosition(player);
    const roleWeight =
      pos === FootballPosition.ST
        ? 5
        : pos === FootballPosition.LW || pos === FootballPosition.RW
          ? 4
          : pos === FootballPosition.AM
            ? 3
            : pos === FootballPosition.CM
              ? 2
              : 1;
    return (
      roleWeight *
      (player.shooting * 0.42 +
        player.pace * 0.22 +
        player.dribbling * 0.2 +
        player.passing * 0.1 +
        playerOverall(player) * 0.06)
    );
  };
  const assistWeight = (player: SimPlayer) => {
    const pos = detailedPosition(player);
    const roleWeight =
      pos === FootballPosition.AM
        ? 4
        : pos === FootballPosition.CM ||
            pos === FootballPosition.LW ||
            pos === FootballPosition.RW
          ? 3
          : pos === FootballPosition.ST
            ? 1.8
            : pos === FootballPosition.LB || pos === FootballPosition.RB
              ? 1.4
              : 0.5;
    return (
      roleWeight *
      (player.passing * 0.42 +
        player.dribbling * 0.26 +
        player.pace * 0.16 +
        playerOverall(player) * 0.16)
    );
  };
  const scorers: string[] = [];
  const assists: string[] = [];
  const events: SimMatchEvent[] = [];
  for (let i = 0; i < goals; i += 1) {
    const minute = clamp(
      8 + ((i + 1) * 78) / (goals + 1) + (random() - 0.5) * 12,
      1,
      90,
    );
    const activeOutfield = outfield.filter((player) =>
      isPlayerActiveAtMinute(player, substitutions, minute),
    );
    const scoringPool = activeOutfield.length ? activeOutfield : outfield;
    const scorer = pickWeighted(scoringPool, scoreWeight, random);
    const assister = scoringPool.filter(
      (player) =>
        player.player_registration_id !== scorer.player_registration_id,
    );
    scorers.push(scorer.player_registration_id);
    if (assister.length && random() > 0.22) {
      const assistPlayer = pickWeighted(assister, assistWeight, random);
      assists.push(assistPlayer.player_registration_id);
      events.push({
        minute,
        side,
        type: MatchEventType.GOAL,
        player_registration_id: scorer.player_registration_id,
        related_player_registration_id: assistPlayer.player_registration_id,
      });
    } else {
      events.push({
        minute,
        side,
        type: MatchEventType.GOAL,
        player_registration_id: scorer.player_registration_id,
      });
    }
  }
  return { scorers, assists, events };
}

function generateSubstitutions(
  players: SimPlayer[],
  seed: string,
  side: VenueSide,
): SimSubstitution[] {
  const random = rng(`${seed}:subs:${side}`);
  const starters = players.filter(
    (player) =>
      player.is_starter && detailedPosition(player) !== FootballPosition.GK,
  );
  const bench = players.filter(
    (player) =>
      !player.is_starter && detailedPosition(player) !== FootballPosition.GK,
  );
  if (!starters.length || !bench.length) return [];
  const count = Math.min(starters.length, bench.length, clamp(2 + random() * 3, 0, 5));
  const usedOut = new Set<string>();
  const usedIn = new Set<string>();

  const outgoingPriority = starters
    .map((player) => {
      const role = detailedPosition(player);
      const roleScore = roleAbilityScoreForPosition(role, player);
      const stamina = player.stamina ?? player.physical;
      const lowRoleFitPressure = Math.max(0, 76 - roleScore) * 1.25;
      const fatiguePressure = Math.max(0, 74 - stamina) * 0.75;
      const tacticalPressure =
        isPositionIn(role, [
          FootballPosition.ST,
          FootballPosition.LW,
          FootballPosition.RW,
          FootballPosition.AM,
        ])
          ? 7
          : 3;
      return {
        player,
        role,
        roleScore,
        stamina,
        priority:
          lowRoleFitPressure +
          fatiguePressure +
          tacticalPressure +
          random() * 18,
      };
    })
    .sort((a, b) => b.priority - a.priority);

  const substitutions: SimSubstitution[] = [];
  for (const target of outgoingPriority) {
    if (substitutions.length >= count) break;
    if (usedOut.has(target.player.player_registration_id)) continue;

    const candidates = bench
      .filter((player) => !usedIn.has(player.player_registration_id))
      .map((player) => ({
        player,
        score: substitutionFitScore(target.role, player, random),
      }))
      .filter((candidate) => candidate.score >= 145)
      .sort((a, b) => b.score - a.score);

    if (!candidates.length) continue;

    const incoming =
      candidates.length > 1 && random() > 0.82
        ? candidates[1]!.player
        : candidates[0]!.player;

    usedOut.add(target.player.player_registration_id);
    usedIn.add(incoming.player_registration_id);

    const reason: SimSubstitution["reason"] =
      random() > 0.94 && substitutions.length === 0
        ? "INJURY_PLACEHOLDER"
        : target.roleScore < 61
          ? "LOW_RATING"
          : target.stamina < 62
            ? "FATIGUE"
            : random() > 0.78
              ? "YELLOW_CARD_RISK"
              : "TACTICAL_CHANGE";

    const earlyPoorPerformance =
      reason === "LOW_RATING" || target.priority > 38;
    const minute = earlyPoorPerformance
      ? clamp(45 + random() * 17 + substitutions.length * 2, 45, 64)
      : reason === "FATIGUE"
        ? clamp(56 + random() * 18 + substitutions.length * 2, 56, 78)
        : clamp(64 + random() * 20 + substitutions.length * 2, 64, 86);

    substitutions.push({
      minute,
      side,
      player_out_registration_id: target.player.player_registration_id,
      player_in_registration_id: incoming.player_registration_id,
      reason,
    });
  }

  return substitutions.sort((a, b) => a.minute - b.minute);
}

function generateSpecialEvents(
  players: SimPlayer[],
  seed: string,
  side: VenueSide,
  substitutions: SimSubstitution[],
): SimMatchEvent[] {
  const random = rng(`${seed}:special:${side}`);
  const outfield = players.filter(
    (player) => detailedPosition(player) !== FootballPosition.GK,
  );
  const events: SimMatchEvent[] = [];
  if (outfield.length && random() > 0.86) {
    const minute = clamp(18 + random() * 66, 1, 90);
    const activeOutfield = outfield.filter((player) =>
      isPlayerActiveAtMinute(player, substitutions, minute),
    );
    const pool = activeOutfield.length ? activeOutfield : outfield;
    const takerPool = outfield.filter((player) => {
      const position = detailedPosition(player);
      return (
        position === FootballPosition.ST ||
        position === FootballPosition.LW ||
        position === FootballPosition.RW ||
          position === FootballPosition.AM
      );
    });
    const activeTakerPool = (takerPool.length ? takerPool : pool).filter(
      (player) => isPlayerActiveAtMinute(player, substitutions, minute),
    );
    const taker = pick(activeTakerPool.length ? activeTakerPool : pool, random);
    events.push({
      minute,
      side,
      type:
        random() > 0.5
          ? MatchEventType.PENALTY_SAVED
          : MatchEventType.PENALTY_MISS,
      player_registration_id: taker.player_registration_id,
    });
  }
  if (outfield.length && random() > 0.8) {
    const minute = clamp(12 + random() * 78, 1, 90);
    const activeOutfield = outfield.filter((player) =>
      isPlayerActiveAtMinute(player, substitutions, minute),
    );
    const shooter = pick(activeOutfield.length ? activeOutfield : outfield, random);
    events.push({
      minute,
      side,
      type: MatchEventType.HIT_WOODWORK,
      player_registration_id: shooter.player_registration_id,
    });
  }
  for (const substitution of substitutions) {
    if (
      substitution.reason === "INJURY" ||
      substitution.reason === "INJURY_PLACEHOLDER"
    ) {
      events.push({
        minute: substitution.minute,
        side,
        type: MatchEventType.INJURY,
        player_registration_id: substitution.player_out_registration_id,
      });
    }
  }
  const subbedIn = players.filter((player) =>
    substitutions.some(
      (sub) => sub.player_in_registration_id === player.player_registration_id,
    ),
  );
  if (subbedIn.length && random() > 0.9) {
    const injuredSub = pick(subbedIn, random);
    const subInMinute =
      substitutions.find(
        (sub) =>
          sub.player_in_registration_id === injuredSub.player_registration_id,
      )?.minute ?? 45;
    events.push({
      minute: clamp(subInMinute + 5 + random() * 28, subInMinute + 1, 90),
      side,
      type: MatchEventType.INJURY,
      player_registration_id: injuredSub.player_registration_id,
    });
  }
  return events;
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
  substitutions: SimSubstitution[],
) {
  const starters = players.filter((player) => player.is_starter);
  const benchIn = players.filter((player) =>
    substitutions.some(
      (sub) => sub.player_in_registration_id === player.player_registration_id,
    ),
  );
  const active = [...starters, ...benchIn];
  const { scorers, assists, events } = distributeGoals(
    players,
    substitutions,
    ownGoals,
    seed,
    side,
  );
  const goalsByPlayer = countById(scorers);
  const assistsByPlayer = countById(assists);
  const random = rng(`${seed}:players:${side}`);
  const cardSelectionRandom = rng(`${seed}:card-selection:${side}`);
  const cardRiskRank = [...active]
    .map((player) => {
      const position = detailedPosition(player);
      const roleRisk =
        position === FootballPosition.CB || position === FootballPosition.DM
          ? 1.35
          : position === FootballPosition.LB || position === FootballPosition.RB
            ? 1.2
            : position === FootballPosition.CM
              ? 1
              : 0.55;
      return {
        player,
        risk:
          (player.defending * 0.45 + player.physical * 0.35 + (player.stamina ?? player.physical) * 0.2) *
            roleRisk +
          cardSelectionRandom() * 28,
      };
    })
    .sort((a, b) => b.risk - a.risk);
  const yellowSet = new Set(
    cardRiskRank
      .slice(0, teamStats.yellow_cards)
      .map((item) => item.player.player_registration_id),
  );
  const redSet = new Set(
    teamStats.red_cards
      ? [cardRiskRank.find((item) => !yellowSet.has(item.player.player_registration_id))?.player.player_registration_id]
      : [],
  );
  const outfieldActive = active.filter(
    (player) => detailedPosition(player) !== FootballPosition.GK,
  );
  const chanceCreatorWeight = (player: SimPlayer) => {
    const position = detailedPosition(player);
    const roleWeight =
      position === FootballPosition.AM
        ? 1.65
        : position === FootballPosition.CM
          ? 1.35
          : position === FootballPosition.LW || position === FootballPosition.RW
            ? 1.45
            : position === FootballPosition.ST
              ? 1.15
              : position === FootballPosition.LB ||
                  position === FootballPosition.RB
                ? 1
                : position === FootballPosition.DM
                  ? 0.9
                  : 0.45;
    return (
      (player.passing * 0.55 + player.dribbling * 0.25 + player.pace * 0.2) *
      roleWeight
    );
  };
  const bigChanceCreatedByPlayer = distributeCount(
    teamStats.big_chances,
    outfieldActive,
    chanceCreatorWeight,
    random,
  );
  const bigChanceMissedByPlayer = distributeCount(
    teamStats.big_chances_missed,
    outfieldActive.filter((player) => {
      const position = detailedPosition(player);
      return (
        position === FootballPosition.ST ||
        position === FootballPosition.LW ||
        position === FootballPosition.RW ||
        position === FootballPosition.AM
      );
    }).length
      ? outfieldActive.filter((player) => {
          const position = detailedPosition(player);
          return (
            position === FootballPosition.ST ||
            position === FootballPosition.LW ||
            position === FootballPosition.RW ||
            position === FootballPosition.AM
          );
        })
      : outfieldActive,
    (player) => {
      const position = detailedPosition(player);
      const roleWeight =
        position === FootballPosition.ST
          ? 1.7
          : position === FootballPosition.LW || position === FootballPosition.RW
            ? 1.35
            : position === FootballPosition.AM
              ? 1.1
              : 0.45;
      return (
        (player.shooting * 0.55 + player.pace * 0.2 + player.dribbling * 0.25) *
        roleWeight
      );
    },
    random,
  );
  const playerId = (player: SimPlayer) => player.player_registration_id;
  const passByPlayer = allocateIntegerTotal(
    teamStats.passes,
    active,
    playerId,
    (player) => {
      const position = detailedPosition(player);
      const minutesMultiplier = substitutions.some(
        (sub) => sub.player_in_registration_id === player.player_registration_id,
      )
        ? 0.38
        : substitutions.some(
              (sub) =>
                sub.player_out_registration_id === player.player_registration_id,
            )
          ? 0.68
          : 1;
      const roleWeight =
        position === FootballPosition.GK
          ? 0.48
          : position === FootballPosition.CM || position === FootballPosition.DM
            ? 1.28
            : position === FootballPosition.CB
              ? 1.02
              : position === FootballPosition.LB ||
                  position === FootballPosition.RB
                ? 0.92
                : position === FootballPosition.AM
                  ? 1.05
                  : 0.7;
      return (
        (position === FootballPosition.GK
          ? player.distribution ?? player.passing
          : player.passing) *
        roleWeight *
        minutesMultiplier
      );
    },
  );
  const accuratePassByPlayer = allocateIntegerTotal(
    teamStats.accurate_passes,
    active,
    playerId,
    (player) => {
      const position = detailedPosition(player);
      const passes = passByPlayer.get(player.player_registration_id) ?? 0;
      const passing =
        position === FootballPosition.GK
          ? player.distribution ?? player.passing
          : player.passing;
      return passes * (0.58 + passing / 285);
    },
  );
  const shotCapForPosition = (position: FootballPosition) =>
    position === FootballPosition.ST
      ? 6
      : position === FootballPosition.LW || position === FootballPosition.RW
        ? 5
        : position === FootballPosition.AM
          ? 4
          : position === FootballPosition.CM
            ? 3
            : position === FootballPosition.LB ||
                position === FootballPosition.RB ||
                position === FootballPosition.DM
              ? 2
              : position === FootballPosition.CB
                ? 1
                : 0;
  const shotByPlayer = allocateCappedIntegerTotal(
    teamStats.shots,
    outfieldActive,
    playerId,
    (player) =>
      (goalsByPlayer.get(player.player_registration_id) ?? 0) +
      (bigChanceMissedByPlayer.get(player.player_registration_id) ?? 0),
    (player) => shotCapForPosition(detailedPosition(player)),
    (player) => {
      const position = detailedPosition(player);
      const roleWeight =
        position === FootballPosition.ST
          ? 1.9
          : position === FootballPosition.LW || position === FootballPosition.RW
            ? 1.55
            : position === FootballPosition.AM
              ? 1.25
              : position === FootballPosition.CM
                ? 0.65
                : position === FootballPosition.LB ||
                    position === FootballPosition.RB
                  ? 0.32
                  : position === FootballPosition.DM
                    ? 0.22
                    : 0.1;
      return (
        (player.shooting * 0.48 + player.pace * 0.22 + player.dribbling * 0.3) *
        roleWeight
      );
    },
  );
  const shotsOnTargetByPlayer = allocateCappedIntegerTotal(
    teamStats.shots_on_target,
    outfieldActive,
    playerId,
    (player) => goalsByPlayer.get(player.player_registration_id) ?? 0,
    (player) => shotByPlayer.get(player.player_registration_id) ?? 0,
    (player) => {
      const shots = shotByPlayer.get(player.player_registration_id) ?? 0;
      return shots * (0.35 + player.shooting / 240);
    },
  );
  const defensiveRandom = rng(`${seed}:team-defense:${side}`);
  const defensivePressure = Math.max(0, 50 - teamStats.possession) / 50;
  const opponentPressure = Math.min(1, opponentShotsOnTarget / 9);
  const rareDefensiveChaos = defensiveRandom() > 0.965;
  const totalTackles = clamp(
    12 + defensivePressure * 8 + opponentPressure * 4 + defensiveRandom() * 7,
    9,
    rareDefensiveChaos ? 34 : 27,
  );
  const totalInterceptions = clamp(
    6 + defensivePressure * 5 + defensiveRandom() * 5,
    4,
    rareDefensiveChaos ? 21 : 17,
  );
  const totalBlocks = clamp(
    1 + opponentPressure * 2 + defensiveRandom() * 2.5,
    0,
    rareDefensiveChaos ? 8 : 5,
  );
  const totalClearances = clamp(
    9 + defensivePressure * 8 + opponentPressure * 6 + defensiveRandom() * 6,
    5,
    rareDefensiveChaos ? 34 : 25,
  );
  const tackleByPlayer = allocateWeightedRandomCappedTotal(
    totalTackles,
    outfieldActive,
    playerId,
    (player) => {
      const position = detailedPosition(player);
      return position === FootballPosition.DM
        ? 7
        : position === FootballPosition.LB || position === FootballPosition.RB
          ? 6
          : position === FootballPosition.CM || position === FootballPosition.CB
            ? 5
            : 2;
    },
    (player) => {
      const position = detailedPosition(player);
      const roleWeight =
        position === FootballPosition.DM
          ? 1.45
          : position === FootballPosition.LB || position === FootballPosition.RB
            ? 1.25
            : position === FootballPosition.CM
              ? 1.05
              : position === FootballPosition.CB
                ? 0.95
          : position === FootballPosition.AM
            ? 0.55
            : 0.32;
      return (player.defending * 0.7 + player.physical * 0.3) * roleWeight;
    },
    defensiveRandom,
  );
  const interceptionByPlayer = allocateWeightedRandomCappedTotal(
    totalInterceptions,
    outfieldActive,
    playerId,
    (player) => {
      const position = detailedPosition(player);
      return position === FootballPosition.CB || position === FootballPosition.DM
        ? 5
        : position === FootballPosition.CM ||
            position === FootballPosition.LB ||
            position === FootballPosition.RB
          ? 4
          : 2;
    },
    (player) => {
      const position = detailedPosition(player);
      const roleWeight =
        position === FootballPosition.CB || position === FootballPosition.DM
          ? 1.35
          : position === FootballPosition.CM
            ? 1.1
            : position === FootballPosition.LB || position === FootballPosition.RB
              ? 0.95
              : 0.35;
      return (player.defending * 0.75 + (player.stamina ?? player.physical) * 0.25) * roleWeight;
    },
    defensiveRandom,
  );
  const blockByPlayer = allocateWeightedRandomCappedTotal(
    totalBlocks,
    outfieldActive,
    playerId,
    (player) => {
      const position = detailedPosition(player);
      return position === FootballPosition.CB
        ? 3
        : position === FootballPosition.DM ||
            position === FootballPosition.LB ||
            position === FootballPosition.RB
          ? 2
          : 1;
    },
    (player) => {
      const position = detailedPosition(player);
      const roleWeight =
        position === FootballPosition.CB
          ? 1.8
          : position === FootballPosition.DM
            ? 1.1
            : position === FootballPosition.LB || position === FootballPosition.RB
              ? 0.8
              : 0.18;
      return (player.defending * 0.8 + player.physical * 0.2) * roleWeight;
    },
    defensiveRandom,
  );
  const clearanceByPlayer = allocateWeightedRandomCappedTotal(
    totalClearances,
    outfieldActive,
    playerId,
    (player) => {
      const position = detailedPosition(player);
      return position === FootballPosition.CB
        ? 9
        : position === FootballPosition.LB || position === FootballPosition.RB
          ? 5
          : position === FootballPosition.DM
            ? 4
            : 2;
    },
    (player) => {
      const position = detailedPosition(player);
      const roleWeight =
        position === FootballPosition.CB
          ? 2
          : position === FootballPosition.LB || position === FootballPosition.RB
            ? 1.1
            : position === FootballPosition.DM
              ? 0.8
              : 0.22;
      return (player.defending * 0.55 + player.physical * 0.45) * roleWeight;
    },
    defensiveRandom,
  );

  const stats = active.map((player) => {
      const position = detailedPosition(player);
      const subOut = substitutions.find(
        (sub) =>
          sub.player_out_registration_id === player.player_registration_id,
      );
      const subIn = substitutions.find(
        (sub) =>
          sub.player_in_registration_id === player.player_registration_id,
      );
      const minutes = subOut ? subOut.minute : subIn ? 90 - subIn.minute : 90;
      const playerGoals = goalsByPlayer.get(player.player_registration_id) ?? 0;
      const playerAssists =
        assistsByPlayer.get(player.player_registration_id) ?? 0;
      const yellow = yellowSet.has(player.player_registration_id) ? 1 : 0;
      const red = redSet.has(player.player_registration_id) ? 1 : 0;

      if (position === FootballPosition.GK) {
        const saves = clamp(opponentShotsOnTarget - opponentGoals, 0, 14);
        const divingSaves = clamp(
          saves *
            (0.25 + (player.diving ?? player.goalkeeping) / 260) *
            random(),
          0,
          saves,
        );
        const savesInsideBox = clamp(
          saves * (0.45 + random() * 0.35),
          0,
          saves,
        );
        const passes = passByPlayer.get(player.player_registration_id) ?? 0;
        const accuratePasses = Math.min(
          passes,
          accuratePassByPlayer.get(player.player_registration_id) ?? 0,
        );
        const rating = ratingForGoalkeeper({
          saves,
          goalsConceded: opponentGoals,
          divingSaves,
          savesInsideBox,
          yellow,
          red,
          won,
          lost,
        });
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
          clean_sheet: opponentGoals === 0 && minutes >= 60,
          penalty_scored: 0,
          penalty_missed: 0,
          penalty_saved_for_gk: 0,
          dribbles_attempted: 0,
          successful_dribbles: 0,
          dribbled_past: 0,
          dispossessed: 0,
          yellow_cards: yellow,
          red_cards: red,
          rating,
        };
      }

      const [attemptCap, successCap] = dribbleCap(position);
      const passes = passByPlayer.get(player.player_registration_id) ?? 0;
      const accuratePasses = Math.min(
        passes,
        accuratePassByPlayer.get(player.player_registration_id) ?? 0,
      );
      const dribblesAttempted = clamp(
        Math.max(
          0,
          (player.dribbling - 48) / 18 + random() * 1.8 - 1.05,
        ) *
          (minutes / 90) *
          (position === FootballPosition.CB
            ? 0.45
            : position === FootballPosition.DM
              ? 0.65
              : position === FootballPosition.LB || position === FootballPosition.RB
                ? 0.85
                : 1),
        0,
        attemptCap,
      );
      const successfulDribbles = clamp(
        dribblesAttempted * (0.35 + player.dribbling / 260),
        0,
        successCap,
      );
      const bigChancesCreated =
        bigChanceCreatedByPlayer.get(player.player_registration_id) ?? 0;
      const bigChancesMissed =
        bigChanceMissedByPlayer.get(player.player_registration_id) ?? 0;
      const shots = shotByPlayer.get(player.player_registration_id) ?? 0;
      const shotsOnTarget =
        shotsOnTargetByPlayer.get(player.player_registration_id) ?? 0;
      const chancesCreated = clamp(
        Math.max(
          bigChancesCreated,
          playerAssists +
            (position === FootballPosition.AM ||
            position === FootballPosition.CM
              ? random() * 4
              : random() * 2),
        ),
        Math.max(playerAssists, bigChancesCreated),
        8,
      );
      const tackles = tackleByPlayer.get(player.player_registration_id) ?? 0;
      const interceptions =
        interceptionByPlayer.get(player.player_registration_id) ?? 0;
      const clearances =
        clearanceByPlayer.get(player.player_registration_id) ?? 0;
      const blocks = blockByPlayer.get(player.player_registration_id) ?? 0;
      const dispossessed = clamp(
        random() *
          (position === FootballPosition.ST ||
          position === FootballPosition.LW ||
          position === FootballPosition.RW
            ? 4
            : 2),
        0,
        6,
      );
      const dribbledPast = clamp(
        (position === FootballPosition.CB
          ? 0.7
          : position === FootballPosition.LB || position === FootballPosition.RB
            ? 1.1
            : position === FootballPosition.DM
              ? 0.9
              : position === FootballPosition.CM
                ? 0.55
                : 0.25) *
          (1.25 - Math.min(player.defending, 92) / 120) *
          (1 + random() * 2.2),
        0,
        position === FootballPosition.LB || position === FootballPosition.RB
          ? 5
          : position === FootballPosition.CB || position === FootballPosition.DM
            ? 4
            : 2,
      );
      const foulsCommitted = clamp(
        random() * 3 +
          (position === FootballPosition.CB || position === FootballPosition.DM
            ? 1
            : 0),
        0,
        5,
      );
      const rating = ratingForOutfield({
        goals: playerGoals,
        assists: playerAssists,
        chancesCreated,
        passAccuracy: passes ? accuratePasses / passes : 0,
        successfulDribbles,
        tackles,
        interceptions,
        clearances,
        dribbledPast,
        bigChancesMissed,
        dispossessed,
        yellow,
        red,
        won,
        lost,
        position,
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
        clean_sheet:
          opponentGoals === 0 &&
          minutes >= 60 &&
          (position === FootballPosition.CB ||
            position === FootballPosition.LB ||
            position === FootballPosition.RB ||
            position === FootballPosition.DM),
        penalty_scored: 0,
        penalty_missed: 0,
        penalty_saved_for_gk: 0,
        dribbles_attempted: dribblesAttempted,
        successful_dribbles: successfulDribbles,
        dribbled_past: dribbledPast,
        dispossessed,
        yellow_cards: yellow,
        red_cards: red,
        rating,
      };
    });
  const cardEventRandom = rng(`${seed}:cards:${side}`);
  const cardEvents = stats.flatMap((stat) => {
    const playerEvents: SimMatchEvent[] = [];
    if (stat.yellow_cards > 0) {
      playerEvents.push({
        minute: clamp(18 + cardEventRandom() * 66, 1, 90),
        side,
        type: MatchEventType.YELLOW_CARD,
        player_registration_id: stat.player_registration_id,
      });
    }
    if (stat.red_cards > 0) {
      playerEvents.push({
        minute: clamp(35 + cardEventRandom() * 50, 1, 90),
        side,
        type: MatchEventType.RED_CARD,
        player_registration_id: stat.player_registration_id,
      });
    }
    return playerEvents;
  });
  return {
    stats,
    events: [...events, ...cardEvents].sort((a, b) => a.minute - b.minute),
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
  dribbledPast: number;
  bigChancesMissed: number;
  dispossessed: number;
  yellow: number;
  red: number;
  won: boolean;
  lost: boolean;
  position: FootballPosition;
}) {
  const defensiveBonus =
    input.position === FootballPosition.CB ||
    input.position === FootballPosition.LB ||
    input.position === FootballPosition.RB ||
    input.position === FootballPosition.DM
      ? (input.tackles + input.interceptions + input.clearances) * 0.06
      : 0;
  const dribbledPastPenalty =
    input.position === FootballPosition.CB ||
    input.position === FootballPosition.LB ||
    input.position === FootballPosition.RB ||
    input.position === FootballPosition.DM
      ? input.dribbledPast * 0.13
      : input.dribbledPast * 0.05;
  const value =
    6.5 +
    input.goals * 0.72 +
    input.assists * 0.45 +
    input.chancesCreated * 0.08 +
    Math.max(0, input.passAccuracy - 0.75) * 1.2 +
    input.successfulDribbles * 0.06 +
    defensiveBonus -
    dribbledPastPenalty -
    input.bigChancesMissed * 0.18 -
    input.dispossessed * 0.08 -
    input.yellow * 0.25 -
    input.red * 1.1 +
    (input.won ? 0.18 : 0) -
    (input.lost ? 0.16 : 0);
  return Number(
    Math.max(input.red ? 4.8 : 5.5, Math.min(9.8, value)).toFixed(1),
  );
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
  return Number(
    Math.max(input.red ? 4.8 : 5.5, Math.min(9.8, value)).toFixed(1),
  );
}

function applyPenaltyMissEvents(
  stats: SimPlayerStats[],
  events: SimMatchEvent[],
  opponentStats: SimPlayerStats[],
) {
  for (const event of events) {
    if (
      event.type !== MatchEventType.PENALTY_MISS &&
      event.type !== MatchEventType.PENALTY_SAVED
    ) {
      continue;
    }
    const player = stats.find(
      (stat) => stat.player_registration_id === event.player_registration_id,
    );
    if (!player) continue;
    player.shots += 1;
    if (event.type === MatchEventType.PENALTY_SAVED) {
      player.shots_on_target = (player.shots_on_target ?? 0) + 1;
      const opponentGk = opponentStats.find(
        (stat) => stat.position_played === FootballPosition.GK,
      );
      if (opponentGk) {
        opponentGk.saves += 1;
        opponentGk.penalty_saved_for_gk =
          (opponentGk.penalty_saved_for_gk ?? 0) + 1;
        opponentGk.rating = Number(
          Math.min(10, opponentGk.rating + 0.65).toFixed(1),
        );
      }
    }
    player.penalty_missed = (player.penalty_missed ?? 0) + 1;
    player.big_chances_missed = (player.big_chances_missed ?? 0) + 1;
    player.rating = Number(Math.max(4.8, player.rating - 0.45).toFixed(1));
  }
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

export type GeneratedAbility =
  | GeneratedGoalkeeperAbility
  | GeneratedOutfieldAbility;

function rollRange(
  random: () => number,
  [low, high]: Range,
  allowHighSpike = false,
) {
  const spike = allowHighSpike && random() > 0.94 ? random() * 4 : 0;
  return clamp(low + random() * (high - low) + spike, low, Math.min(92, high));
}

function weightedOutfieldOverall(
  position: Exclude<FootballPosition, typeof FootballPosition.GK>,
  ability: Record<OutfieldKey, number>,
) {
  const weights = outfieldOverallWeights[position];
  return clamp(
    outfieldKeys.reduce((total, key) => total + ability[key] * weights[key], 0),
    1,
    92,
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
    92,
  );
}

export function generateAbilityScores(
  tier: PlayerAbilityRating,
  position: FootballPosition,
  seed: string,
): GeneratedAbility {
  const random = rng(`${seed}:ability:${tier}:${position}`);
  const [min, max] = tierRanges[tier];
  const tierMax = tier === "HIGH" ? 92 : max;
  const roll = (low = min, high = tierMax) => {
    const veryHigh = tier === "HIGH" && random() > 0.94;
    return clamp(
      low + random() * (high - low) + (veryHigh ? random() * 4 : 0),
      low,
      high,
    );
  };
  const strong = () => roll(min, tierMax);
  const boost = (value: number, amount: number, cap = tierMax) =>
    clamp(value + amount, min, cap);
  if (position === FootballPosition.GK) {
    const ability = Object.fromEntries(
      gkKeys.map((key) => [key, strong()]),
    ) as Record<(typeof gkKeys)[number], number>;
    ability.shot_stopping = boost(ability.shot_stopping, 4);
    ability.reflexes = boost(ability.reflexes, 4);
    ability.positioning = boost(ability.positioning, 2);
    const overall_rating = weightedGoalkeeperOverall(ability);
    return {
      position: FootballPosition.GK,
      rating_tier: tier,
      ...ability,
      overall_rating,
      is_hidden_from_manager: true,
    };
  }
  const outfieldPosition = position as Exclude<
    FootballPosition,
    typeof FootballPosition.GK
  >;
  const ranges = positionAbilityRanges[outfieldPosition][tier];
  const ability = Object.fromEntries(
    outfieldKeys.map((key) => [
      key,
      rollRange(
        random,
        ranges[key],
        tier === "HIGH" &&
          [
            "shooting",
            "passing",
            "dribbling",
            "defending",
            "pace",
            "stamina",
          ].includes(key),
      ),
    ]),
  ) as Record<OutfieldKey, number>;
  const overall_rating = weightedOutfieldOverall(outfieldPosition, ability);
  return {
    position: outfieldPosition,
    rating_tier: tier,
    ...ability,
    overall_rating,
    is_hidden_from_manager: true,
  };
}

export function validateSimulationConsistency(result: SimulationResult) {
  if (result.home_stats.possession + result.away_stats.possession !== 100) {
    throw new AppError(400, "Possession must sum to 100");
  }
  for (const [label, stats, goals] of [
    ["home", result.home_stats, result.home_score],
    ["away", result.away_stats, result.away_score],
  ] as const) {
    if (stats.shots_on_target > stats.shots)
      throw new AppError(400, `${label} shots on target exceed shots`);
    if (stats.shots_off_target !== stats.shots - stats.shots_on_target)
      throw new AppError(400, `${label} shots off target is inconsistent`);
    if (stats.hit_woodwork > stats.shots_off_target)
      throw new AppError(400, `${label} woodwork exceeds off-target shots`);
    if (stats.big_chances > stats.shots)
      throw new AppError(400, `${label} big chances exceed shots`);
    if (stats.big_chances_missed > stats.big_chances)
      throw new AppError(400, `${label} missed big chances exceed big chances`);
    if (stats.accurate_passes > stats.passes)
      throw new AppError(400, `${label} accurate passes exceed passes`);
    if (goals > stats.shots_on_target)
      throw new AppError(400, `${label} goals exceed shots on target`);
    if ((stats.offsides ?? 0) < 0)
      throw new AppError(400, `${label} offsides cannot be negative`);
  }
  for (const player of result.player_stats) {
    if (player.successful_dribbles > player.dribbles_attempted)
      throw new AppError(
        400,
        "A player's successful dribbles exceed attempted dribbles",
      );
    if ((player.shots_on_target ?? 0) > player.shots)
      throw new AppError(400, "A player's shots on target exceed shots");
    if (player.accurate_passes > player.passes)
      throw new AppError(400, "A player's accurate passes exceed passes");
    if ((player.dribbled_past ?? 0) < 0)
      throw new AppError(400, "A player's dribbled past cannot be negative");
    if ((player.diving_saves ?? 0) > player.saves)
      throw new AppError(400, "A goalkeeper's diving saves exceed saves");
    if ((player.saves_inside_box ?? 0) > player.saves)
      throw new AppError(400, "A goalkeeper's saves inside box exceed saves");
  }
}

export function simulateMatch(
  homePlayers: SimPlayer[],
  awayPlayers: SimPlayer[],
  fixtureId: string,
  simulationAttempt = 1,
): SimulationResult {
  if (
    homePlayers.filter((p) => p.is_starter).length !== 11 ||
    awayPlayers.filter((p) => p.is_starter).length !== 11
  ) {
    throw new AppError(400, "Both confirmed lineups must have 11 starters");
  }
  const homeStarters = homePlayers.filter((player) => player.is_starter);
  const awayStarters = awayPlayers.filter((player) => player.is_starter);
  const home = teamStrength(homePlayers);
  const away = teamStrength(awayPlayers);
  const seed = `${fixtureId}:attempt-${simulationAttempt}:${homeStarters.map((p) => p.player_registration_id).join("|")}:${awayStarters.map((p) => p.player_registration_id).join("|")}`;
  const random = rng(seed);
  const homeQuality = home.overall * 0.7 + (35 + random() * 50) * 0.3;
  const awayQuality = away.overall * 0.7 + (35 + random() * 50) * 0.3;
  const mismatch = Math.abs(home.overall - away.overall);
  const homeExpected = Math.max(
    0.15,
    1.18 + (homeQuality - away.defense * 0.82 - away.keeper * 0.18) / 42 + 0.2,
  );
  const awayExpected = Math.max(
    0.15,
    1.08 + (awayQuality - home.defense * 0.82 - home.keeper * 0.18) / 42,
  );
  const matchTempo = clampDecimal(
    0.84 + random() * 0.34 + (random() > 0.86 ? random() * 0.28 : 0),
    0.78,
    1.45,
  );
  const homeScore = teamGoals(homeExpected, random, mismatch, matchTempo);
  const awayScore = teamGoals(awayExpected, random, mismatch, matchTempo);
  const homePossession = clamp(
    50 + (home.midfield - away.midfield) * 0.42 + (random() - 0.5) * 9,
    35,
    65,
  );
  const awayPossession = 100 - homePossession;
  const homeStats = makeTeamStats(
    home,
    away,
    homePossession,
    homeScore,
    seed,
    VenueSide.HOME,
    matchTempo,
  );
  const awayStats = makeTeamStats(
    away,
    home,
    awayPossession,
    awayScore,
    seed,
    VenueSide.AWAY,
    matchTempo,
  );
  const homeSubs = generateSubstitutions(homePlayers, seed, VenueSide.HOME);
  const awaySubs = generateSubstitutions(awayPlayers, seed, VenueSide.AWAY);
  const homeAllocated = allocateStats(
    homePlayers,
    homeStats,
    homeScore,
    awayScore,
    awayStats.shots_on_target,
    seed,
    VenueSide.HOME,
    homeScore > awayScore,
    homeScore < awayScore,
    homeSubs,
  );
  const awayAllocated = allocateStats(
    awayPlayers,
    awayStats,
    awayScore,
    homeScore,
    homeStats.shots_on_target,
    seed,
    VenueSide.AWAY,
    awayScore > homeScore,
    awayScore < homeScore,
    awaySubs,
  );
  const homeSpecialEvents = generateSpecialEvents(
    homePlayers,
    seed,
    VenueSide.HOME,
    homeSubs,
  );
  const awaySpecialEvents = generateSpecialEvents(
    awayPlayers,
    seed,
    VenueSide.AWAY,
    awaySubs,
  );
  applyPenaltyMissEvents(
    homeAllocated.stats,
    homeSpecialEvents,
    awayAllocated.stats,
  );
  applyPenaltyMissEvents(
    awayAllocated.stats,
    awaySpecialEvents,
    homeAllocated.stats,
  );
  const sumPlayerStats = (
    stats: SimPlayerStats[],
    field: keyof SimPlayerStats,
  ) => stats.reduce((total, stat) => total + Number(stat[field] ?? 0), 0);
  const finalizedHomeStats = {
    ...homeStats,
    rating: avgNumbers(homeAllocated.stats.map((stat) => stat.rating)),
    passes: sumPlayerStats(homeAllocated.stats, "passes"),
    accurate_passes: sumPlayerStats(homeAllocated.stats, "accurate_passes"),
    big_chances: sumPlayerStats(homeAllocated.stats, "big_chances_created"),
    big_chances_missed: sumPlayerStats(
      homeAllocated.stats,
      "big_chances_missed",
    ),
    shots: sumPlayerStats(homeAllocated.stats, "shots"),
    shots_on_target: sumPlayerStats(homeAllocated.stats, "shots_on_target"),
    shots_off_target: Math.max(
      0,
      sumPlayerStats(homeAllocated.stats, "shots") -
        sumPlayerStats(homeAllocated.stats, "shots_on_target"),
    ),
    tackles: sumPlayerStats(homeAllocated.stats, "tackles"),
    interceptions: sumPlayerStats(homeAllocated.stats, "interceptions"),
    blocks: sumPlayerStats(homeAllocated.stats, "blocks"),
    clearances: sumPlayerStats(homeAllocated.stats, "clearances"),
    keeper_saves: sumPlayerStats(homeAllocated.stats, "saves"),
    hit_woodwork: Math.min(
      Math.max(0, homeStats.hit_woodwork),
      Math.max(
        0,
        sumPlayerStats(homeAllocated.stats, "shots") -
          sumPlayerStats(homeAllocated.stats, "shots_on_target"),
      ),
    ),
    expected_goals: calculateExpectedGoalsFromStats({
      goals: homeScore,
      shots: sumPlayerStats(homeAllocated.stats, "shots"),
      shotsOnTarget: sumPlayerStats(homeAllocated.stats, "shots_on_target"),
      bigChances: sumPlayerStats(homeAllocated.stats, "big_chances_created"),
      bigChancesMissed: sumPlayerStats(
        homeAllocated.stats,
        "big_chances_missed",
      ),
      hitWoodwork: Math.min(
        Math.max(0, homeStats.hit_woodwork),
        Math.max(
          0,
          sumPlayerStats(homeAllocated.stats, "shots") -
            sumPlayerStats(homeAllocated.stats, "shots_on_target"),
        ),
      ),
    }),
  };
  const finalizedAwayStats = {
    ...awayStats,
    rating: avgNumbers(awayAllocated.stats.map((stat) => stat.rating)),
    passes: sumPlayerStats(awayAllocated.stats, "passes"),
    accurate_passes: sumPlayerStats(awayAllocated.stats, "accurate_passes"),
    big_chances: sumPlayerStats(awayAllocated.stats, "big_chances_created"),
    big_chances_missed: sumPlayerStats(
      awayAllocated.stats,
      "big_chances_missed",
    ),
    shots: sumPlayerStats(awayAllocated.stats, "shots"),
    shots_on_target: sumPlayerStats(awayAllocated.stats, "shots_on_target"),
    shots_off_target: Math.max(
      0,
      sumPlayerStats(awayAllocated.stats, "shots") -
        sumPlayerStats(awayAllocated.stats, "shots_on_target"),
    ),
    tackles: sumPlayerStats(awayAllocated.stats, "tackles"),
    interceptions: sumPlayerStats(awayAllocated.stats, "interceptions"),
    blocks: sumPlayerStats(awayAllocated.stats, "blocks"),
    clearances: sumPlayerStats(awayAllocated.stats, "clearances"),
    keeper_saves: sumPlayerStats(awayAllocated.stats, "saves"),
    hit_woodwork: Math.min(
      Math.max(0, awayStats.hit_woodwork),
      Math.max(
        0,
        sumPlayerStats(awayAllocated.stats, "shots") -
          sumPlayerStats(awayAllocated.stats, "shots_on_target"),
      ),
    ),
    expected_goals: calculateExpectedGoalsFromStats({
      goals: awayScore,
      shots: sumPlayerStats(awayAllocated.stats, "shots"),
      shotsOnTarget: sumPlayerStats(awayAllocated.stats, "shots_on_target"),
      bigChances: sumPlayerStats(awayAllocated.stats, "big_chances_created"),
      bigChancesMissed: sumPlayerStats(
        awayAllocated.stats,
        "big_chances_missed",
      ),
      hitWoodwork: Math.min(
        Math.max(0, awayStats.hit_woodwork),
        Math.max(
          0,
          sumPlayerStats(awayAllocated.stats, "shots") -
            sumPlayerStats(awayAllocated.stats, "shots_on_target"),
        ),
      ),
    }),
  };
  for (const stats of [finalizedHomeStats, finalizedAwayStats]) {
    stats.shots = Math.max(
      stats.shots,
      stats.shots_on_target,
      stats.big_chances,
    );
    stats.shots_off_target = Math.max(0, stats.shots - stats.shots_on_target);
    stats.hit_woodwork = Math.min(stats.hit_woodwork, stats.shots_off_target);
    stats.big_chances_missed = Math.min(
      stats.big_chances_missed,
      stats.big_chances,
    );
  }
  const result: SimulationResult = {
    home_score: homeScore,
    away_score: awayScore,
    home_stats: finalizedHomeStats,
    away_stats: finalizedAwayStats,
    player_stats: [...homeAllocated.stats, ...awayAllocated.stats],
    events: [
      ...homeAllocated.events,
      ...awayAllocated.events,
      ...homeSpecialEvents,
      ...awaySpecialEvents,
    ].sort((a, b) => a.minute - b.minute),
    substitutions: [...homeSubs, ...awaySubs].sort(
      (a, b) => a.minute - b.minute,
    ),
    simulation_seed: seed,
  };
  validateSimulationConsistency(result);
  return result;
}
