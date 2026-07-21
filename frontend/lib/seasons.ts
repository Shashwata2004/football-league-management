import { SeasonPhase } from "@flms/shared";

/**
 * Minimal shape needed to pick the "current" season. Kept intentionally loose so
 * both the full `SeasonDto` and the trimmed-down season records the dashboards
 * carry (fan/manager local `Season` interfaces) satisfy it.
 */
export interface CurrentSeasonCandidate {
  id: string;
  phase?: string | null;
  created_at?: string | null;
}

function newestFirst<T extends CurrentSeasonCandidate>(a: T, b: T): number {
  const at = a.created_at ? Date.parse(a.created_at) : 0;
  const bt = b.created_at ? Date.parse(b.created_at) : 0;
  return bt - at;
}

/**
 * Picks the season that should be selected by default across stats/standings
 * views. There is no `is_current` flag in the schema, so we define the current
 * season as the most recently created season whose `phase === 'ACTIVE'`, falling
 * back to the newest season by `created_at` when none is active.
 *
 * When `created_at` is unavailable on the candidates, the input order is
 * preserved (the backend already returns seasons newest-first), so the first
 * ACTIVE — or the first season overall — is chosen.
 */
export function pickCurrentSeason<T extends CurrentSeasonCandidate>(
  seasons: readonly T[] | null | undefined,
): T | null {
  if (!seasons || seasons.length === 0) return null;
  const active = seasons
    .filter((season) => season.phase === SeasonPhase.ACTIVE)
    .sort(newestFirst);
  if (active.length > 0) return active[0]!;
  return [...seasons].sort(newestFirst)[0] ?? null;
}

/**
 * Convenience wrapper returning just the id of {@link pickCurrentSeason}, or an
 * empty string when there are no seasons — handy for seeding `useState<string>`.
 */
export function pickCurrentSeasonId<T extends CurrentSeasonCandidate>(
  seasons: readonly T[] | null | undefined,
): string {
  return pickCurrentSeason(seasons)?.id ?? "";
}
