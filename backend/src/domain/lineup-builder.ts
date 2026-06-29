import { FootballPosition, PlayerPosition } from "@flms/shared";

export type NaturalPosition = FootballPosition;

export type PlayingStyle =
  | "BALANCED"
  | "HOLDING_POSSESSION"
  | "COUNTER_ATTACKING"
  | "HIGH_PRESS"
  | "TIKI_TAKA"
  | "WING_PLAY"
  | "LOW_BLOCK";

export interface FormationSlot {
  slotKey: string;
  displayRole: string;
  line: "GK" | "DEF" | "MID" | "ATT";
  x: number;
  y: number;
  primaryPositions: NaturalPosition[];
  compatiblePositions: NaturalPosition[];
  emergencyPositions: NaturalPosition[];
}

export interface LineupCandidate {
  id: string;
  player_id: string;
  football_position?: NaturalPosition | null;
  position?: string | null;
  position_category?: string | null;
  shirt_number?: number | null;
  status?: string | null;
  player_status?: string | null;
  player_code?: string | null;
  players?: {
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
  player_abilities?: PlayerAbility[] | PlayerAbility | null;
  league_rating?: number | null;
}

export interface PlayerAbility {
  rating_tier?: string | null;
  shooting?: number | null;
  passing?: number | null;
  dribbling?: number | null;
  defending?: number | null;
  physical?: number | null;
  pace?: number | null;
  stamina?: number | null;
  shot_stopping?: number | null;
  reflexes?: number | null;
  positioning?: number | null;
  handling?: number | null;
  diving?: number | null;
  distribution?: number | null;
  communication?: number | null;
  overall_rating?: number | null;
}

export interface PickedLineupPlayer {
  slotKey: string;
  displayRole: string;
  playerNaturalPosition: NaturalPosition;
  player_registration_id: string;
  fitLabel: string;
  fitScore: number;
  score: number;
}

export const PLAYING_STYLE_LABELS: Record<PlayingStyle, string> = {
  BALANCED: "Balanced Play",
  HOLDING_POSSESSION: "Holding / Possession",
  COUNTER_ATTACKING: "Counter Attacking / Transitional",
  HIGH_PRESS: "High Press / Gegenpress",
  TIKI_TAKA: "Tiki-Taka",
  WING_PLAY: "Wing Play",
  LOW_BLOCK: "Low Block"
};

export const FORMATION_LABELS: Record<string, string> = {
  "4-4-2_FLAT": "4-4-2 Flat",
  "4-4-2_DIAMOND": "4-4-2 Diamond",
  "4-4-1-1": "4-4-1-1",
  "4-3-3": "4-3-3",
  "4-2-3-1": "4-2-3-1",
  "4-1-4-1": "4-1-4-1",
  "4-5-1": "4-5-1",
  "4-3-2-1": "4-3-2-1 Christmas Tree",
  "4-2-2-2": "4-2-2-2",
  "4-1-2-1-2": "4-1-2-1-2 Narrow Diamond",
  "4-3-1-2": "4-3-1-2",
  "4-1-3-2": "4-1-3-2",
  "3-5-2": "3-5-2",
  "3-4-3": "3-4-3",
  "3-4-2-1": "3-4-2-1",
  "3-4-1-2": "3-4-1-2",
  "3-3-3-1": "3-3-3-1",
  "3-2-4-1": "3-2-4-1",
  "3-1-4-2": "3-1-4-2",
  "3-6-1": "3-6-1",
  "3-5-1-1": "3-5-1-1",
  "5-4-1": "5-4-1",
  "5-3-2": "5-3-2",
  "5-2-3": "5-2-3",
  "5-2-2-1": "5-2-2-1",
  "5-3-1-1": "5-3-1-1"
};

const FORMATIONS: Record<string, string[]> = {
  "4-4-2_FLAT": ["GK", "LB", "CB", "CB", "RB", "LM_ROLE", "CM", "CM", "RM_ROLE", "ST", "ST"],
  "4-4-2_DIAMOND": ["GK", "LB", "CB", "CB", "RB", "DM", "CM", "CM", "AM", "ST", "ST"],
  "4-4-1-1": ["GK", "LB", "CB", "CB", "RB", "LW", "CM", "CM", "RW", "AM", "ST"],
  "4-3-3": ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CM", "LW", "ST", "RW"],
  "4-2-3-1": ["GK", "LB", "CB", "CB", "RB", "DM", "DM", "LW", "AM", "RW", "ST"],
  "4-1-4-1": ["GK", "LB", "CB", "CB", "RB", "DM", "LW", "AM", "AM", "RW", "ST"],
  "4-5-1": ["GK", "LB", "CB", "CB", "RB", "LW", "CM", "DM", "CM", "RW", "ST"],
  "4-3-2-1": ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CM", "AM", "AM", "ST"],
  "4-2-2-2": ["GK", "LB", "CB", "CB", "RB", "DM", "DM", "LW", "RW", "ST", "ST"],
  "4-1-2-1-2": ["GK", "LB", "CB", "CB", "RB", "DM", "CM", "CM", "AM", "ST", "ST"],
  "4-3-1-2": ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "CM", "AM", "ST", "ST"],
  "4-1-3-2": ["GK", "LB", "CB", "CB", "RB", "DM", "LW", "AM", "RW", "ST", "ST"],
  "3-5-2": ["GK", "CB", "CB", "CB", "LWB_ROLE", "DM", "CM", "AM", "RWB_ROLE", "ST", "ST"],
  "3-4-3": ["GK", "CB", "CB", "CB", "LWB_ROLE", "CM", "CM", "RWB_ROLE", "LW", "ST", "RW"],
  "3-4-2-1": ["GK", "CB", "CB", "CB", "LWB_ROLE", "CM", "CM", "RWB_ROLE", "AM", "AM", "ST"],
  "3-4-1-2": ["GK", "CB", "CB", "CB", "LWB_ROLE", "CM", "CM", "RWB_ROLE", "AM", "ST", "ST"],
  "3-3-3-1": ["GK", "CB", "CB", "CB", "CM", "CM", "CM", "LW", "AM", "RW", "ST"],
  "3-2-4-1": ["GK", "CB", "CB", "CB", "DM", "DM", "LW", "AM", "AM", "RW", "ST"],
  "3-1-4-2": ["GK", "CB", "CB", "CB", "DM", "LW", "AM", "AM", "RW", "ST", "ST"],
  "3-6-1": ["GK", "CB", "CB", "CB", "LWB_ROLE", "DM", "CM", "CM", "AM", "RWB_ROLE", "ST"],
  "3-5-1-1": ["GK", "CB", "CB", "CB", "LWB_ROLE", "DM", "CM", "AM", "RWB_ROLE", "SS_ROLE", "ST"],
  "5-4-1": ["GK", "LB", "CB", "CB", "CB", "RB", "LW", "CM", "CM", "RW", "ST"],
  "5-3-2": ["GK", "LB", "CB", "CB", "CB", "RB", "DM", "CM", "AM", "ST", "ST"],
  "5-2-3": ["GK", "LB", "CB", "CB", "CB", "RB", "CM", "CM", "LW", "ST", "RW"],
  "5-2-2-1": ["GK", "LB", "CB", "CB", "CB", "RB", "DM", "CM", "AM", "AM", "ST"],
  "5-3-1-1": ["GK", "LB", "CB", "CB", "CB", "RB", "DM", "CM", "AM", "SS_ROLE", "ST"]
};

const FORMATION_LAYOUTS: Record<string, string[][]> = {
  "4-4-2_FLAT": [["ST", "ST"], ["LM_ROLE", "CM", "CM", "RM_ROLE"], ["LB", "CB", "CB", "RB"], ["GK"]],
  "4-4-2_DIAMOND": [["ST", "ST"], ["AM"], ["CM", "CM"], ["DM"], ["LB", "CB", "CB", "RB"], ["GK"]],
  "4-4-1-1": [["ST"], ["AM"], ["LW", "CM", "CM", "RW"], ["LB", "CB", "CB", "RB"], ["GK"]],
  "4-3-3": [["LW", "ST", "RW"], ["CM", "CM", "CM"], ["LB", "CB", "CB", "RB"], ["GK"]],
  "4-2-3-1": [["ST"], ["LW", "AM", "RW"], ["DM", "DM"], ["LB", "CB", "CB", "RB"], ["GK"]],
  "4-1-4-1": [["ST"], ["LW", "AM", "AM", "RW"], ["DM"], ["LB", "CB", "CB", "RB"], ["GK"]],
  "4-5-1": [["ST"], ["LW", "CM", "DM", "CM", "RW"], ["LB", "CB", "CB", "RB"], ["GK"]],
  "4-3-2-1": [["ST"], ["AM", "AM"], ["CM", "CM", "CM"], ["LB", "CB", "CB", "RB"], ["GK"]],
  "4-2-2-2": [["ST", "ST"], ["LW", "RW"], ["DM", "DM"], ["LB", "CB", "CB", "RB"], ["GK"]],
  "4-1-2-1-2": [["ST", "ST"], ["AM"], ["CM", "CM"], ["DM"], ["LB", "CB", "CB", "RB"], ["GK"]],
  "4-3-1-2": [["ST", "ST"], ["AM"], ["CM", "CM", "CM"], ["LB", "CB", "CB", "RB"], ["GK"]],
  "4-1-3-2": [["ST", "ST"], ["LW", "AM", "RW"], ["DM"], ["LB", "CB", "CB", "RB"], ["GK"]],
  "3-5-2": [["ST", "ST"], ["AM"], ["LWB_ROLE", "DM", "CM", "RWB_ROLE"], ["CB", "CB", "CB"], ["GK"]],
  "3-4-3": [["LW", "ST", "RW"], ["LWB_ROLE", "CM", "CM", "RWB_ROLE"], ["CB", "CB", "CB"], ["GK"]],
  "3-4-2-1": [["ST"], ["AM", "AM"], ["LWB_ROLE", "CM", "CM", "RWB_ROLE"], ["CB", "CB", "CB"], ["GK"]],
  "3-4-1-2": [["ST", "ST"], ["AM"], ["LWB_ROLE", "CM", "CM", "RWB_ROLE"], ["CB", "CB", "CB"], ["GK"]],
  "3-3-3-1": [["ST"], ["LW", "AM", "RW"], ["CM", "CM", "CM"], ["CB", "CB", "CB"], ["GK"]],
  "3-2-4-1": [["ST"], ["LW", "AM", "AM", "RW"], ["DM", "DM"], ["CB", "CB", "CB"], ["GK"]],
  "3-1-4-2": [["ST", "ST"], ["LW", "AM", "AM", "RW"], ["DM"], ["CB", "CB", "CB"], ["GK"]],
  "3-6-1": [["ST"], ["AM"], ["LWB_ROLE", "CM", "DM", "CM", "RWB_ROLE"], ["CB", "CB", "CB"], ["GK"]],
  "3-5-1-1": [["ST"], ["SS_ROLE"], ["LWB_ROLE", "DM", "CM", "AM", "RWB_ROLE"], ["CB", "CB", "CB"], ["GK"]],
  "5-4-1": [["ST"], ["LW", "CM", "CM", "RW"], ["LB", "CB", "CB", "CB", "RB"], ["GK"]],
  "5-3-2": [["ST", "ST"], ["DM", "CM", "AM"], ["LB", "CB", "CB", "CB", "RB"], ["GK"]],
  "5-2-3": [["LW", "ST", "RW"], ["CM", "CM"], ["LB", "CB", "CB", "CB", "RB"], ["GK"]],
  "5-2-2-1": [["ST"], ["AM", "AM"], ["DM", "CM"], ["LB", "CB", "CB", "CB", "RB"], ["GK"]],
  "5-3-1-1": [["ST"], ["SS_ROLE"], ["DM", "CM", "AM"], ["LB", "CB", "CB", "CB", "RB"], ["GK"]]
};

const POSITION_COMPATIBILITY: Record<NaturalPosition, { exact: NaturalPosition[]; compatible: NaturalPosition[]; emergency: NaturalPosition[] }> = {
  GK: { exact: [FootballPosition.GK], compatible: [], emergency: [] },
  CB: { exact: [FootballPosition.CB], compatible: [FootballPosition.DM], emergency: [FootballPosition.LB, FootballPosition.RB] },
  LB: { exact: [FootballPosition.LB], compatible: [FootballPosition.RB, FootballPosition.CB], emergency: [FootballPosition.LW] },
  RB: { exact: [FootballPosition.RB], compatible: [FootballPosition.LB, FootballPosition.CB], emergency: [FootballPosition.RW] },
  DM: { exact: [FootballPosition.DM], compatible: [FootballPosition.CM], emergency: [FootballPosition.CB] },
  CM: { exact: [FootballPosition.CM], compatible: [FootballPosition.DM, FootballPosition.AM], emergency: [] },
  AM: { exact: [FootballPosition.AM], compatible: [FootballPosition.CM, FootballPosition.ST], emergency: [FootballPosition.LW, FootballPosition.RW] },
  LW: { exact: [FootballPosition.LW], compatible: [FootballPosition.RW, FootballPosition.ST], emergency: [FootballPosition.LB, FootballPosition.AM] },
  RW: { exact: [FootballPosition.RW], compatible: [FootballPosition.LW, FootballPosition.ST], emergency: [FootballPosition.RB, FootballPosition.AM] },
  ST: { exact: [FootballPosition.ST], compatible: [FootballPosition.LW, FootballPosition.RW, FootballPosition.AM], emergency: [] }
};

function roleConfig(role: string) {
  if (role === "LWB_ROLE") return { displayRole: "LWB", primaryPositions: [FootballPosition.LB, FootballPosition.LW], compatiblePositions: [FootballPosition.CM, FootballPosition.DM], emergencyPositions: [] };
  if (role === "RWB_ROLE") return { displayRole: "RWB", primaryPositions: [FootballPosition.RB, FootballPosition.RW], compatiblePositions: [FootballPosition.CM, FootballPosition.DM], emergencyPositions: [] };
  if (role === "SS_ROLE") return { displayRole: "SS", primaryPositions: [FootballPosition.AM], compatiblePositions: [FootballPosition.ST], emergencyPositions: [FootballPosition.LW, FootballPosition.RW] };
  if (role === "LM_ROLE") return { displayRole: "LM", primaryPositions: [FootballPosition.LW], compatiblePositions: [FootballPosition.CM, FootballPosition.LB], emergencyPositions: [FootballPosition.AM] };
  if (role === "RM_ROLE") return { displayRole: "RM", primaryPositions: [FootballPosition.RW], compatiblePositions: [FootballPosition.CM, FootballPosition.RB], emergencyPositions: [FootballPosition.AM] };
  const natural = role as NaturalPosition;
  const config = POSITION_COMPATIBILITY[natural];
  return {
    displayRole: natural,
    primaryPositions: config.exact,
    compatiblePositions: config.compatible,
    emergencyPositions: config.emergency
  };
}

function lineForDisplayRole(displayRole: string): FormationSlot["line"] {
  if (displayRole === "GK") return "GK";
  if (["LB", "CB", "RB"].includes(displayRole)) return "DEF";
  if (["LW", "RW", "ST", "SS"].includes(displayRole)) return "ATT";
  return "MID";
}

function slotKey(displayRole: string, index: number) {
  return `${displayRole.replace(/[^A-Z0-9]/gu, "_")}_${index}`;
}

function xForRow(index: number, count: number) {
  if (count <= 1) return 50;
  if (count === 2) return [34, 66][index] ?? 50;
  if (count === 3) return [22, 50, 78][index] ?? 50;
  if (count === 4) return [13, 38, 62, 87][index] ?? 50;
  return [10, 30, 50, 70, 90][index] ?? 50;
}

function xForFormationRow(formation: string, row: string[], rowIndex: number, colIndex: number) {
  if (formation === "4-2-2-2" && rowIndex === 1 && row.length === 2 && row[0] === "LW" && row[1] === "RW") {
    return [30, 70][colIndex] ?? 50;
  }
  return xForRow(colIndex, row.length);
}

function yForRow(index: number, count: number) {
  const layouts: Record<number, number[]> = {
    4: [12, 39, 66, 88],
    5: [10, 28, 48, 68, 88],
    6: [9, 23, 38, 53, 70, 88]
  };
  const values = layouts[count] ?? layouts[5] ?? [10, 28, 48, 68, 88];
  return values[index] ?? 50;
}

export function getFormationSlots(formation: string): FormationSlot[] {
  const layout = FORMATION_LAYOUTS[formation] ?? FORMATION_LAYOUTS["4-3-3"] ?? [];
  const counts = new Map<string, number>();
  const slots: FormationSlot[] = [];
  layout.forEach((row, rowIndex) => {
    row.forEach((role, colIndex) => {
      const config = roleConfig(role);
      const roleCount = (counts.get(config.displayRole) ?? 0) + 1;
      counts.set(config.displayRole, roleCount);
      slots.push({
        ...config,
        slotKey: slotKey(config.displayRole, roleCount),
        line: lineForDisplayRole(config.displayRole),
        x: xForFormationRow(formation, row, rowIndex, colIndex),
        y: yForRow(rowIndex, layout.length)
      });
    });
  });
  return slots;
}

export function abilityOf(player: LineupCandidate): PlayerAbility {
  const value = Array.isArray(player.player_abilities) ? player.player_abilities[0] : player.player_abilities;
  return value ?? {};
}

export function naturalPosition(player: LineupCandidate): NaturalPosition {
  if (player.football_position && Object.values(FootballPosition).includes(player.football_position)) return player.football_position;
  if (player.position === PlayerPosition.GK) return FootballPosition.GK;
  if (player.position === PlayerPosition.DEF) return FootballPosition.CB;
  if (player.position === PlayerPosition.MID) return FootballPosition.CM;
  return FootballPosition.ST;
}

function val(value: number | null | undefined, fallback = 55) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function overall(player: LineupCandidate) {
  return val(abilityOf(player).overall_rating, 55);
}

function specialRoleBonus(slot: FormationSlot, player: LineupCandidate) {
  const ability = abilityOf(player);
  const pos = naturalPosition(player);
  if (slot.displayRole === "LWB") {
    if (pos === FootballPosition.LB) return val(ability.defending) * 0.3 + val(ability.stamina) * 0.25 + val(ability.pace) * 0.2 + val(ability.passing) * 0.15 + val(ability.dribbling) * 0.1;
    if (pos === FootballPosition.LW) return val(ability.pace) * 0.3 + val(ability.dribbling) * 0.25 + val(ability.passing) * 0.2 + val(ability.stamina) * 0.15 + val(ability.defending) * 0.1 - (val(ability.defending) < 50 ? 20 : 0);
  }
  if (slot.displayRole === "RWB") {
    if (pos === FootballPosition.RB) return val(ability.defending) * 0.3 + val(ability.stamina) * 0.25 + val(ability.pace) * 0.2 + val(ability.passing) * 0.15 + val(ability.dribbling) * 0.1;
    if (pos === FootballPosition.RW) return val(ability.pace) * 0.3 + val(ability.dribbling) * 0.25 + val(ability.passing) * 0.2 + val(ability.stamina) * 0.15 + val(ability.defending) * 0.1 - (val(ability.defending) < 50 ? 20 : 0);
  }
  if (slot.displayRole === "SS") {
    if (pos === FootballPosition.AM) return val(ability.passing) * 0.3 + val(ability.dribbling) * 0.25 + val(ability.shooting) * 0.25 + val(ability.stamina) * 0.2;
    if (pos === FootballPosition.ST) return val(ability.shooting) * 0.35 + val(ability.passing) * 0.25 + val(ability.dribbling) * 0.25 + val(ability.pace) * 0.15;
  }
  return 0;
}

function styleSuitability(style: PlayingStyle, slot: FormationSlot, player: LineupCandidate) {
  const ability = abilityOf(player);
  const pos = naturalPosition(player);
  if (style === "BALANCED") return 0;
  if (style === "HOLDING_POSSESSION") return (val(ability.passing) + val(ability.stamina) + (["CM", "DM", "AM", "LB", "RB"].includes(pos) ? 70 : 45)) / 3;
  if (style === "COUNTER_ATTACKING") return (val(ability.pace) + val(ability.shooting) + val(ability.dribbling) + (["LW", "RW", "ST"].includes(pos) ? 80 : 45)) / 4;
  if (style === "HIGH_PRESS") return (val(ability.stamina) + val(ability.physical) + val(ability.pace) + (["ST", "LW", "RW", "CM", "AM", "DM"].includes(pos) ? 75 : 45)) / 4;
  if (style === "TIKI_TAKA") return (val(ability.passing) + val(ability.dribbling) + val(ability.stamina) + (["CM", "AM", "DM"].includes(pos) ? 80 : 45)) / 4;
  if (style === "WING_PLAY") return (val(ability.pace) + val(ability.dribbling) + val(ability.passing) + (["LW", "RW", "LB", "RB"].includes(pos) || ["LWB", "RWB", "LM", "RM"].includes(slot.displayRole) ? 85 : 40)) / 4;
  return (val(ability.defending) + val(ability.physical) + val(ability.stamina) + (["CB", "DM", "LB", "RB"].includes(pos) ? 85 : 35)) / 4;
}

export function fitForSlot(slot: FormationSlot, player: LineupCandidate, style: PlayingStyle = "BALANCED") {
  const pos = naturalPosition(player);
  let fitScore = 0;
  let fitLabel = "Out of Position";
  if (slot.primaryPositions.includes(pos)) {
    fitScore = 1000;
    fitLabel = ["LWB", "RWB", "SS", "LM", "RM"].includes(slot.displayRole) ? `${slot.displayRole} Role Fit` : "Exact Fit";
  } else if (slot.compatiblePositions.includes(pos)) {
    fitScore = 750;
    fitLabel = "Compatible Fit";
  } else if (slot.emergencyPositions.includes(pos)) {
    fitScore = 500;
    fitLabel = "Emergency Fit";
  }
  const score =
    fitScore +
    overall(player) * 4 +
    (player.league_rating ?? 0) * 20 +
    specialRoleBonus(slot, player) +
    styleSuitability(style, slot, player) * 0.15;
  return { fitScore, fitLabel, score };
}

export function autoPickBestXI(players: LineupCandidate[], formation: string, playingStyle: PlayingStyle) {
  const selected = new Set<string>();
  const picks: PickedLineupPlayer[] = [];
  for (const slot of getFormationSlots(formation)) {
    const ranked = players
      .filter((player) => !selected.has(player.id))
      .map((player) => ({ player, ...fitForSlot(slot, player, playingStyle) }))
      .sort((a, b) => b.score - a.score || (a.player.players?.full_name ?? "").localeCompare(b.player.players?.full_name ?? ""));
    const best = ranked[0];
    if (!best) continue;
    selected.add(best.player.id);
    picks.push({
      slotKey: slot.slotKey,
      displayRole: slot.displayRole,
      playerNaturalPosition: naturalPosition(best.player),
      player_registration_id: best.player.id,
      fitLabel: best.fitLabel,
      fitScore: best.fitScore,
      score: Number(best.score.toFixed(2))
    });
  }
  return picks;
}

export function positionToCoarse(position: NaturalPosition) {
  if (position === FootballPosition.GK) return PlayerPosition.GK;
  if (position === FootballPosition.CB || position === FootballPosition.LB || position === FootballPosition.RB) return PlayerPosition.DEF;
  if (position === FootballPosition.DM || position === FootballPosition.CM || position === FootballPosition.AM) return PlayerPosition.MID;
  return PlayerPosition.FWD;
}

export function isValidPlayingStyle(value: unknown): value is PlayingStyle {
  return typeof value === "string" && Object.keys(PLAYING_STYLE_LABELS).includes(value);
}

export function isValidFormation(value: unknown): value is string {
  return typeof value === "string" && Object.keys(FORMATION_LABELS).includes(value);
}
