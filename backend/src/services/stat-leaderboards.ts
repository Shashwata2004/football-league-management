import { FootballPosition } from "@flms/shared";

// Shared statistics-leaderboard engine used by the manager and fan surfaces so
// both derive identical categorized leaderboards (Top Scorer, Tackles per 90,
// Clean Sheets, ...) from the same confirmed season/match rows.

export function relatedName(value: unknown, key: string) {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object" || !(key in row)) return null;
  const resolved = (row as Record<string, unknown>)[key];
  return typeof resolved === "string" && resolved.trim() ? resolved : null;
}

export function per90(value: number, minutes: number) {
  if (!minutes || minutes <= 0) return 0;
  return Number(((value / minutes) * 90).toFixed(2));
}

export function perMatch(value: number, matches: number) {
  if (!matches || matches <= 0) return 0;
  return Number((value / matches).toFixed(2));
}

export function avg(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) return 0;
  return Number(
    (valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2),
  );
}

export type LeaderboardFormat = "number" | "decimal" | "percent" | "rating";

export function formatLeaderboardValue(
  value: number,
  format: LeaderboardFormat,
) {
  if (format === "percent") return `${Math.round(value)}%`;
  if (format === "rating") return value.toFixed(1);
  if (format === "decimal") return value.toFixed(2).replace(/\.00$/, "");
  return String(Math.round(value));
}

function numericLeaderboardField(row: object, field: PropertyKey) {
  const value = Number(
    (row as unknown as Record<PropertyKey, unknown>)[field] ?? 0,
  );
  return Number.isFinite(value) ? value : 0;
}

/**
 * Canonical player-leaderboard ordering.
 *
 * Top scorer: goals, then assists, then rating.
 * Top assister: assists, then goals, then rating.
 *
 * Name and registration id provide a deterministic final order when every
 * football metric is tied. All other leaderboards retain their primary-metric
 * ordering and use the same deterministic fallback.
 */
export function comparePlayerLeaderboardRows<
  T extends { id: string; name: string },
>(id: string, field: keyof T, left: T, right: T) {
  const fields: PropertyKey[] =
    id === "top_scorer"
      ? [field, "assists", "rating"]
      : id === "assists"
        ? [field, "goals", "rating"]
        : [field];

  for (const sortField of fields) {
    const difference =
      numericLeaderboardField(right, sortField) -
      numericLeaderboardField(left, sortField);
    if (difference !== 0) return difference;
  }

  const nameOrder = left.name.localeCompare(right.name);
  return nameOrder !== 0 ? nameOrder : left.id.localeCompare(right.id);
}

export function makeLeaderboard<
  T extends {
    id: string;
    name: string;
    team: string;
    teamLogoUrl: string | null;
    avatarUrl: string | null;
  },
>(
  id: string,
  title: string,
  rows: T[],
  field: keyof T,
  format: LeaderboardFormat,
) {
  const entries = rows
    .map((row) => ({ row, numericValue: Number(row[field] ?? 0) }))
    .filter(
      ({ numericValue }) => Number.isFinite(numericValue) && numericValue > 0,
    )
    .sort((a, b) =>
      comparePlayerLeaderboardRows(id, field, a.row, b.row),
    )
    .map(({ row, numericValue }) => ({
      id: row.id,
      name: row.name,
      subLabel: row.team,
      logoUrl: row.avatarUrl,
      teamLogoUrl: row.teamLogoUrl,
      initials:
        row.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? "")
          .join("") || "NA",
      value: formatLeaderboardValue(numericValue, format),
      numericValue,
    }));
  return { id, title, entries };
}

export function makeTeamLeaderboard<
  T extends { id: string; name: string; logoUrl: string | null },
>(
  id: string,
  title: string,
  rows: T[],
  field: keyof T,
  format: LeaderboardFormat,
) {
  const entries = rows
    .map((row) => ({ row, numericValue: Number(row[field] ?? 0) }))
    .filter(
      ({ numericValue }) => Number.isFinite(numericValue) && numericValue > 0,
    )
    .sort((a, b) => b.numericValue - a.numericValue)
    .map(({ row, numericValue }) => ({
      id: row.id,
      name: row.name,
      subLabel: "Team",
      logoUrl: row.logoUrl,
      teamLogoUrl: row.logoUrl,
      initials:
        row.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? "")
          .join("") || "TM",
      value: formatLeaderboardValue(numericValue, format),
      numericValue,
    }));
  return { id, title, entries };
}

export interface PlayerLeaderboardRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  team: string;
  teamLogoUrl: string | null;
  minutes: number;
  matches: number;
  goals: number;
  assists: number;
  goalAssists: number;
  successfulDribblesPer90: number;
  shotsOnTargetPer90: number;
  accuratePassesPer90: number;
  bigChancesCreated: number;
  bigChancesMissed: number;
  tacklesPer90: number;
  interceptionsPer90: number;
  blocksPer90: number;
  clearancesPer90: number;
  cleanSheets: number;
  savesPer90: number;
  goalsConcededPer90: number;
  yellowCards: number;
  redCards: number;
  foulsCommittedPer90: number;
  rating: number;
}

// Pure transform: turn stored season stats + confirmed match rows into the
// per-player row shape the leaderboards consume. Kept side-effect free so the
// route layer owns all data fetching.
export function buildPlayerLeaderboardRows(
  seasonStats: Array<Record<string, any>>,
  matchStats: Array<Record<string, any>>,
  playerById: Map<string, any>,
  teamById: Map<string, any>,
): PlayerLeaderboardRow[] {
  return seasonStats.map((seasonStat) => {
    const player = playerById.get(seasonStat.player_registration_id);
    const team = player ? teamById.get(player.team_registration_id) : null;
    const matchRows = matchStats.filter(
      (row) => row.player_registration_id === seasonStat.player_registration_id,
    );
    const minutes = Number(seasonStat.minutes_played ?? 0);
    const sum = (field: string) =>
      matchRows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
    const gkRows = matchRows.filter(
      (row) => row.position_played === FootballPosition.GK,
    );
    const cleanSheets = gkRows.filter(
      (row) =>
        Number(row.goals_conceded ?? 0) === 0 && Number(row.minutes ?? 0) >= 45,
    ).length;
    return {
      id: seasonStat.player_registration_id,
      name: relatedName(player?.players, "full_name") ?? "Unnamed player",
      avatarUrl: relatedName(player?.players, "avatar_url"),
      team: relatedName(team?.teams, "name") ?? "Unassigned team",
      teamLogoUrl: relatedName(team?.teams, "logo_url"),
      minutes,
      matches: Number(seasonStat.appearances ?? 0),
      goals: Number(seasonStat.goals ?? 0),
      assists: Number(seasonStat.assists ?? 0),
      goalAssists:
        Number(seasonStat.goals ?? 0) + Number(seasonStat.assists ?? 0),
      successfulDribblesPer90: per90(
        Number(seasonStat.successful_dribbles ?? 0),
        minutes,
      ),
      shotsOnTargetPer90: per90(
        Number(seasonStat.shots_on_target ?? 0),
        minutes,
      ),
      accuratePassesPer90: per90(
        Number(seasonStat.accurate_passes ?? 0),
        minutes,
      ),
      bigChancesCreated: Number(
        seasonStat.big_chances_created ?? sum("big_chances_created") ?? 0,
      ),
      bigChancesMissed: sum("big_chances_missed"),
      tacklesPer90: per90(Number(seasonStat.tackles ?? 0), minutes),
      interceptionsPer90: per90(Number(seasonStat.interceptions ?? 0), minutes),
      blocksPer90: per90(sum("blocks"), minutes),
      clearancesPer90: per90(sum("clearances"), minutes),
      cleanSheets,
      savesPer90: per90(sum("saves"), minutes),
      goalsConcededPer90: per90(sum("goals_conceded"), minutes),
      yellowCards: Number(seasonStat.yellow_cards ?? 0),
      redCards: Number(seasonStat.red_cards ?? 0),
      foulsCommittedPer90: per90(sum("fouls_committed"), minutes),
      rating: Number(seasonStat.average_rating ?? 0),
    };
  });
}

// The categorized player leaderboard sections shared across surfaces.
export function makePlayerStatSections(rows: PlayerLeaderboardRow[]) {
  return [
    {
      title: "General",
      cards: [
        makeLeaderboard(
          "minutes_played",
          "Minutes Played",
          rows,
          "minutes",
          "number",
        ),
        makeLeaderboard("rating", "Rating", rows, "rating", "rating"),
      ],
    },
    {
      title: "Attack",
      cards: [
        makeLeaderboard("top_scorer", "Top Scorer", rows, "goals", "number"),
        makeLeaderboard("assists", "Assists", rows, "assists", "number"),
        makeLeaderboard(
          "goal_assists",
          "Goal + Assists",
          rows,
          "goalAssists",
          "number",
        ),
        makeLeaderboard(
          "successful_dribbles_per_90",
          "Successful Dribbles per 90",
          rows,
          "successfulDribblesPer90",
          "decimal",
        ),
        makeLeaderboard(
          "shots_on_target_per_90",
          "Shots on Target per 90",
          rows,
          "shotsOnTargetPer90",
          "decimal",
        ),
        makeLeaderboard(
          "accurate_passes_per_90",
          "Accurate Passes per 90",
          rows,
          "accuratePassesPer90",
          "decimal",
        ),
        makeLeaderboard(
          "big_chances_created",
          "Big Chances Created",
          rows,
          "bigChancesCreated",
          "number",
        ),
        makeLeaderboard(
          "big_chances_missed",
          "Big Chances Missed",
          rows,
          "bigChancesMissed",
          "number",
        ),
      ],
    },
    {
      title: "Defense",
      cards: [
        makeLeaderboard(
          "tackles_per_90",
          "Tackles per 90",
          rows,
          "tacklesPer90",
          "decimal",
        ),
        makeLeaderboard(
          "interceptions_per_90",
          "Interceptions per 90",
          rows,
          "interceptionsPer90",
          "decimal",
        ),
        makeLeaderboard(
          "blocks_per_90",
          "Blocks per 90",
          rows,
          "blocksPer90",
          "decimal",
        ),
        makeLeaderboard(
          "clearances_per_90",
          "Clearances per 90",
          rows,
          "clearancesPer90",
          "decimal",
        ),
      ],
    },
    {
      title: "Goalkeeping",
      cards: [
        makeLeaderboard(
          "clean_sheets",
          "Clean Sheets",
          rows,
          "cleanSheets",
          "number",
        ),
        makeLeaderboard(
          "saves_per_90",
          "Saves per 90",
          rows,
          "savesPer90",
          "decimal",
        ),
        makeLeaderboard(
          "goals_conceded_per_90",
          "Goals Conceded per 90",
          rows,
          "goalsConcededPer90",
          "decimal",
        ),
      ],
    },
    {
      title: "Discipline",
      cards: [
        makeLeaderboard(
          "yellow_cards",
          "Yellow Cards",
          rows,
          "yellowCards",
          "number",
        ),
        makeLeaderboard("red_cards", "Red Cards", rows, "redCards", "number"),
        makeLeaderboard(
          "fouls_committed_per_90",
          "Fouls Committed per 90",
          rows,
          "foulsCommittedPer90",
          "decimal",
        ),
      ],
    },
  ];
}
