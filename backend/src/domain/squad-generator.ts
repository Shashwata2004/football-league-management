import { FootballPosition, PlayerPosition, PreferredFoot } from "@flms/shared";
import { bangladeshiPlayerNames } from "../data/bangladeshi-player-names.js";

export type PositionCategory = "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD";

export interface GeneratedSquadPlayer {
  full_name: string;
  position: PlayerPosition;
  football_position: FootballPosition;
  position_category: PositionCategory;
  shirt_number: number;
  preferred_foot: PreferredFoot;
  avatar_url: string;
}

export type PositionBreakdown = Record<FootballPosition, number>;

export interface SquadDistribution {
  goalkeepers: number;
  defenders: number;
  midfielders: number;
  forwards: number;
}

const positionOrder = [
  FootballPosition.GK,
  FootballPosition.RB,
  FootballPosition.LB,
  FootballPosition.CB,
  FootballPosition.CB,
  FootballPosition.DM,
  FootballPosition.RW,
  FootballPosition.CM,
  FootballPosition.ST,
  FootballPosition.AM,
  FootballPosition.LW
];

const preferredJerseys: Record<FootballPosition, number[]> = {
  [FootballPosition.GK]: [1, 12, 13, 16, 22, 23, 30],
  [FootballPosition.CB]: [4, 5, 6, 15, 16, 18, 20, 24, 25, 26],
  [FootballPosition.LB]: [3, 12, 15, 21, 23, 25, 29],
  [FootballPosition.RB]: [2, 12, 14, 18, 22, 24, 27],
  [FootballPosition.DM]: [6, 8, 14, 16, 18, 21, 24, 28],
  [FootballPosition.CM]: [8, 10, 14, 15, 17, 18, 20, 21, 23],
  [FootballPosition.AM]: [10, 11, 14, 17, 19, 20, 21, 22],
  [FootballPosition.LW]: [7, 10, 11, 17, 18, 21, 22, 27],
  [FootballPosition.RW]: [7, 11, 17, 18, 19, 20, 21, 23],
  [FootballPosition.ST]: [9, 10, 11, 19, 20, 21, 22, 27, 29]
};

const classicJerseys: Record<FootballPosition, number[]> = {
  [FootballPosition.GK]: [1],
  [FootballPosition.RB]: [2],
  [FootballPosition.LB]: [3],
  [FootballPosition.CB]: [4, 5],
  [FootballPosition.DM]: [6],
  [FootballPosition.CM]: [8, 6],
  [FootballPosition.AM]: [10],
  [FootballPosition.LW]: [11, 7],
  [FootballPosition.RW]: [7, 11],
  [FootballPosition.ST]: [9, 11]
};

export function categoryForFootballPosition(position: FootballPosition): PositionCategory {
  if (position === FootballPosition.GK) return "GOALKEEPER";
  if (position === FootballPosition.CB || position === FootballPosition.LB || position === FootballPosition.RB) return "DEFENDER";
  if (position === FootballPosition.DM || position === FootballPosition.CM || position === FootballPosition.AM) return "MIDFIELDER";
  return "FORWARD";
}

export function coarsePosition(position: FootballPosition): PlayerPosition {
  if (position === FootballPosition.GK) return PlayerPosition.GK;
  if (position === FootballPosition.CB || position === FootballPosition.LB || position === FootballPosition.RB) return PlayerPosition.DEF;
  if (position === FootballPosition.DM || position === FootballPosition.CM || position === FootballPosition.AM) return PlayerPosition.MID;
  return PlayerPosition.FWD;
}

export function targetDistribution(size: number): SquadDistribution {
  const goalkeepers = Math.max(1, Math.round(size * 0.12));
  let defenders = Math.round(size * 0.32);
  let midfielders = Math.round(size * 0.32);
  let forwards = size - goalkeepers - defenders - midfielders;
  while (forwards < Math.max(1, Math.floor(size * 0.2))) {
    if (defenders >= midfielders && defenders > 1) defenders -= 1;
    else if (midfielders > 1) midfielders -= 1;
    forwards += 1;
  }
  return { goalkeepers, defenders, midfielders, forwards };
}

export function currentDistribution(players: Array<{ football_position?: FootballPosition | null; position?: PlayerPosition | null }>): SquadDistribution {
  const distribution = { goalkeepers: 0, defenders: 0, midfielders: 0, forwards: 0 };
  for (const player of players) {
    const category = categoryForFootballPosition(player.football_position ?? fallbackFootballPosition(player.position));
    if (category === "GOALKEEPER") distribution.goalkeepers += 1;
    if (category === "DEFENDER") distribution.defenders += 1;
    if (category === "MIDFIELDER") distribution.midfielders += 1;
    if (category === "FORWARD") distribution.forwards += 1;
  }
  return distribution;
}

export function neededDistribution(target: SquadDistribution, current: SquadDistribution, remainingSlots: number): SquadDistribution {
  const needed = {
    goalkeepers: Math.max(0, target.goalkeepers - current.goalkeepers),
    defenders: Math.max(0, target.defenders - current.defenders),
    midfielders: Math.max(0, target.midfielders - current.midfielders),
    forwards: Math.max(0, target.forwards - current.forwards)
  };
  let total = needed.goalkeepers + needed.defenders + needed.midfielders + needed.forwards;
  while (total < remainingSlots) {
    const lowest = Object.entries(needed).sort((a, b) => a[1] - b[1])[0]?.[0] as keyof SquadDistribution;
    needed[lowest] += 1;
    total += 1;
  }
  while (total > remainingSlots) {
    const highest = Object.entries(needed).sort((a, b) => b[1] - a[1])[0]?.[0] as keyof SquadDistribution;
    needed[highest] -= 1;
    total -= 1;
  }
  return needed;
}

export function buildPositionList(distribution: SquadDistribution): FootballPosition[] {
  return [
    ...repeat(FootballPosition.GK, distribution.goalkeepers),
    ...balancedDefenders(distribution.defenders),
    ...balancedMidfielders(distribution.midfielders),
    ...balancedForwards(distribution.forwards)
  ];
}

export function suggestedPositionBreakdown(size: number): PositionBreakdown {
  if (size === 18) {
    return emptyBreakdown({ GK: 2, CB: 3, LB: 1, RB: 2, DM: 2, CM: 2, AM: 2, LW: 1, RW: 1, ST: 2 });
  }
  if (size === 22) {
    return emptyBreakdown({ GK: 3, CB: 3, LB: 2, RB: 2, DM: 2, CM: 3, AM: 2, LW: 1, RW: 1, ST: 3 });
  }
  if (size === 25) {
    return emptyBreakdown({ GK: 3, CB: 4, LB: 2, RB: 2, DM: 2, CM: 4, AM: 2, LW: 2, RW: 2, ST: 2 });
  }
  const distribution = targetDistribution(size);
  return distributionToBreakdown(distribution);
}

export function distributionToBreakdown(distribution: SquadDistribution): PositionBreakdown {
  return emptyBreakdown({
    GK: distribution.goalkeepers,
    CB: Math.ceil(distribution.defenders * 0.45),
    LB: Math.floor(distribution.defenders * 0.275),
    RB: distribution.defenders - Math.ceil(distribution.defenders * 0.45) - Math.floor(distribution.defenders * 0.275),
    DM: Math.floor(distribution.midfielders * 0.3),
    CM: Math.ceil(distribution.midfielders * 0.4),
    AM: distribution.midfielders - Math.floor(distribution.midfielders * 0.3) - Math.ceil(distribution.midfielders * 0.4),
    LW: Math.floor(distribution.forwards * 0.25),
    RW: Math.floor(distribution.forwards * 0.25),
    ST: distribution.forwards - Math.floor(distribution.forwards * 0.25) * 2
  });
}

export function buildPositionListFromBreakdown(breakdown: Partial<Record<FootballPosition, number>>): FootballPosition[] {
  const positions: FootballPosition[] = [];
  for (const position of positionOrder) {
    const current = positions.filter((item) => item === position).length;
    const target = breakdown[position] ?? 0;
    if (current < target) positions.push(position);
  }
  for (const position of Object.values(FootballPosition)) {
    const current = positions.filter((item) => item === position).length;
    const target = breakdown[position] ?? 0;
    for (let index = current; index < target; index += 1) positions.push(position);
  }
  return positions;
}

export function generateSquadPlayers(input: {
  count: number;
  distribution?: SquadDistribution | undefined;
  positionBreakdown?: Partial<Record<FootballPosition, number>> | undefined;
  usedNames: string[];
  usedJerseys: number[];
  seed: string;
}): GeneratedSquadPlayer[] {
  const random = rng(input.seed);
  const basePositions = input.positionBreakdown
    ? buildPositionListFromBreakdown(input.positionBreakdown)
    : buildPositionList(input.distribution ?? targetDistribution(input.count));
  const positions = basePositions.slice(0, input.count);
  const preferredFeet = buildPreferredFootList(positions.length, random);
  const names = shuffle(
    bangladeshiPlayerNames.filter((name) => !input.usedNames.includes(name.fullName)).map((name) => name.fullName),
    random
  );
  const usedJerseys = [...input.usedJerseys];
  return positions.map((footballPosition, index) => {
    const fullName = names[index];
    if (!fullName) throw new Error("Not enough Bangladeshi player names available for this squad.");
    const shirtNumber = assignJerseyNumber({
      position: footballPosition,
      usedNumbers: usedJerseys,
      squadContext: {
        isFirstChoiceGK: footballPosition === FootballPosition.GK && usedJerseys.includes(1) === false,
        positionIndex: positions.slice(0, index).filter((position) => position === footballPosition).length
      }
    });
    usedJerseys.push(shirtNumber);
    return {
      full_name: fullName,
      position: coarsePosition(footballPosition),
      football_position: footballPosition,
      position_category: categoryForFootballPosition(footballPosition),
      shirt_number: shirtNumber,
      preferred_foot: preferredFeet[index] ?? PreferredFoot.RIGHT,
      avatar_url: ""
    };
  });
}

export function assignJerseyNumber(params: {
  position: FootballPosition;
  usedNumbers: number[];
  squadContext?: {
    isFirstChoiceGK?: boolean;
    positionIndex?: number;
  };
}): number {
  const used = new Set(params.usedNumbers);
  const firstChoice = params.squadContext?.isFirstChoiceGK ? [1] : [];
  const candidates = [...firstChoice, ...classicJerseys[params.position], ...preferredJerseys[params.position]];
  const preferred = firstAvailable(candidates, used);
  if (preferred) return preferred;

  const fallback = firstAvailable(categoryFallback(categoryForFootballPosition(params.position)), used);
  if (fallback) return fallback;

  const emergency = firstAvailable(range(1, 99), used);
  if (!emergency) throw new Error("No available jersey numbers left");
  return emergency;
}

export function isRealisticJersey(position: FootballPosition, number: number) {
  return [...classicJerseys[position], ...preferredJerseys[position], ...categoryFallback(categoryForFootballPosition(position))].includes(number);
}

function emptyBreakdown(values: Partial<Record<FootballPosition, number>> = {}): PositionBreakdown {
  return {
    [FootballPosition.GK]: values.GK ?? 0,
    [FootballPosition.CB]: values.CB ?? 0,
    [FootballPosition.LB]: values.LB ?? 0,
    [FootballPosition.RB]: values.RB ?? 0,
    [FootballPosition.DM]: values.DM ?? 0,
    [FootballPosition.CM]: values.CM ?? 0,
    [FootballPosition.AM]: values.AM ?? 0,
    [FootballPosition.LW]: values.LW ?? 0,
    [FootballPosition.RW]: values.RW ?? 0,
    [FootballPosition.ST]: values.ST ?? 0
  };
}

function categoryFallback(category: PositionCategory) {
  if (category === "GOALKEEPER") return range(30, 40);
  return range(24, 39);
}

function firstAvailable(numbers: number[], used: Set<number>) {
  return numbers.find((number) => number >= 1 && number <= 99 && !used.has(number));
}

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function fallbackFootballPosition(position?: PlayerPosition | null): FootballPosition {
  if (position === PlayerPosition.GK) return FootballPosition.GK;
  if (position === PlayerPosition.DEF) return FootballPosition.CB;
  if (position === PlayerPosition.MID) return FootballPosition.CM;
  return FootballPosition.ST;
}

function repeat<T>(value: T, count: number) {
  return Array.from({ length: Math.max(0, count) }, () => value);
}

function balancedDefenders(count: number) {
  const positions = [FootballPosition.CB, FootballPosition.CB, FootballPosition.LB, FootballPosition.RB];
  return Array.from({ length: count }, (_, index) => positions[index % positions.length]!);
}

function balancedMidfielders(count: number) {
  const positions = [FootballPosition.CM, FootballPosition.DM, FootballPosition.AM, FootballPosition.CM];
  return Array.from({ length: count }, (_, index) => positions[index % positions.length]!);
}

function balancedForwards(count: number) {
  const positions = [FootballPosition.ST, FootballPosition.LW, FootballPosition.RW, FootballPosition.ST];
  return Array.from({ length: count }, (_, index) => positions[index % positions.length]!);
}

function buildPreferredFootList(count: number, random: () => number): PreferredFoot[] {
  const right = Math.round(count * 0.5);
  const left = Math.round(count * 0.35);
  const both = Math.max(0, count - right - left);
  return shuffle(
    [
      ...repeat(PreferredFoot.RIGHT, right),
      ...repeat(PreferredFoot.LEFT, left),
      ...repeat(PreferredFoot.BOTH, both)
    ].slice(0, count),
    random
  );
}

function shuffle<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}

function rng(seed: string) {
  let state = 2166136261;
  for (const char of seed) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
