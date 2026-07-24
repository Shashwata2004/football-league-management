"use client";

import {
  CSSProperties,
  FormEvent,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  Goal,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldAlert,
  Square,
  Star,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { pickCurrentSeason } from "@/lib/seasons";
import { fixtureOutcomeLabel, fixtureOutcomeScore } from "@flms/shared";
import { clearAuth, getStoredProfile, updateStoredProfile } from "@/lib/auth";
import { OwnGoalIcon } from "@/components/ui/own-goal-icon";
import { PenaltyMissIcon } from "@/components/ui/penalty-miss-icon";
import { PenaltySaveIcon } from "@/components/ui/penalty-save-icon";

// ---------------------------------------------------------------------------
// The fan experience mirrors the manager dashboard's shell (fixed sidebar,
// sticky topbar, light surface, per-team CSS-variable theming) but is entirely
// read-only and themed around the fan's PRIMARY favourite club instead of a
// managed team. Like the manager panel, this is a single client component that
// switches its content based on the URL; the routes under /dashboard/fan/* are
// thin re-exports of this file.
// ---------------------------------------------------------------------------

type Section =
  | "Home"
  | "Matches"
  | "Standings"
  | "Player Stats"
  | "Team Stats"
  | "My Teams"
  | "Discover"
  | "Profile";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface TeamSummary {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
}

interface Favorite {
  id: string;
  team_id: string;
  is_primary: boolean;
  created_at: string;
  team: TeamSummary | null;
}

interface TeamRef {
  id: string;
  teams: {
    id?: string;
    name: string;
    short_name: string | null;
    logo_url: string | null;
    primary_color?: string | null;
  } | null;
}

interface FixtureRecord {
  id: string;
  season_id: string;
  round_no: number;
  matchday_number?: number | null;
  stage: string;
  group_name?: string | null;
  home_team_registration_id: string | null;
  away_team_registration_id: string | null;
  kickoff_at: string | null;
  venue: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  extra_time_played?: boolean | null;
  penalties_home?: number | null;
  penalties_away?: number | null;
  penalty_winner_team_registration_id?: string | null;
  home_team?: TeamRef | null;
  away_team?: TeamRef | null;
  seasons?: {
    id: string;
    name: string;
    season_year: number | null;
    league_id: string;
    leagues?: {
      id: string;
      name: string;
      short_name: string | null;
      logo_url: string | null;
    } | null;
  } | null;
}

interface League {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  country?: string | null;
  seasons?: Season[];
}

interface Season {
  id: string;
  league_id: string;
  name: string;
  season_year: number | null;
  format: string;
  phase: string;
  created_at?: string | null;
  leagues?: League | League[] | null;
}

interface StandingRow {
  team_registration_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  group_name: string | null;
  position: number;
  team_registrations?: {
    id: string;
    teams: {
      id: string;
      name: string;
      short_name: string | null;
      logo_url: string | null;
    } | null;
  } | null;
}

interface DashboardPayload {
  profile: Profile;
  favorites: Favorite[];
  selected_season?: {
    id: string;
    name: string;
    phase: string;
  } | null;
  upcoming_fixtures: FixtureRecord[];
  recent_results: FixtureRecord[];
}

// ---------------------------------------------------------------------------
// Theme (mirrors manager dashboard's per-team CSS variable approach)
// ---------------------------------------------------------------------------

interface FanTheme {
  primary: string;
  secondary: string;
  accent: string;
}

const defaultFanTheme: FanTheme = {
  primary: "#2563EB",
  secondary: "#0B1220",
  accent: "#F59E0B",
};

const fanThemeStorageKey = "scoreline-fan-team-theme";

function normalizeThemeColor(
  color: string | null | undefined,
  fallback: string,
): string {
  return color && /^#[0-9a-f]{6}$/iu.test(color.trim())
    ? color.trim().toUpperCase()
    : fallback;
}

function readCachedFanTheme(): FanTheme {
  if (typeof window === "undefined") return defaultFanTheme;
  try {
    const cached = JSON.parse(
      window.localStorage.getItem(fanThemeStorageKey) ?? "null",
    ) as Partial<FanTheme> | null;
    return {
      primary: normalizeThemeColor(cached?.primary, defaultFanTheme.primary),
      secondary: normalizeThemeColor(
        cached?.secondary,
        defaultFanTheme.secondary,
      ),
      accent: normalizeThemeColor(cached?.accent, defaultFanTheme.accent),
    };
  } catch {
    return defaultFanTheme;
  }
}

function themeFromTeam(team: TeamSummary | null | undefined): FanTheme {
  return {
    primary: normalizeThemeColor(team?.primary_color, defaultFanTheme.primary),
    secondary: normalizeThemeColor(
      team?.secondary_color,
      defaultFanTheme.secondary,
    ),
    accent: normalizeThemeColor(team?.accent_color, defaultFanTheme.accent),
  };
}

function getReadableTextColor(backgroundColor: string): "#FFFFFF" | "#111827" {
  const hex = backgroundColor.replace("#", "");
  if (!/^[0-9a-f]{6}$/iu.test(hex)) return "#FFFFFF";
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "#111827" : "#FFFFFF";
}

// ---------------------------------------------------------------------------
// Small shared helpers (match manager dashboard idioms)
// ---------------------------------------------------------------------------

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function initials(name?: string | null) {
  return (name ?? "NA")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDayKey(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function matchStageLabel(stage?: string | null) {
  const normalized = (stage ?? "").toUpperCase();
  const labels: Record<string, string> = {
    GROUP: "Group",
    LEAGUE: "League",
    ROUND_OF_64: "Round of 64",
    ROUND_OF_32: "Round of 32",
    ROUND_OF_16: "Round of 16",
    QUARTER_FINAL: "Quarter Final",
    SEMI_FINAL: "Semi Final",
    FINAL: "Final",
  };
  return labels[normalized] ?? (normalized.replaceAll("_", " ") || "Match");
}

function teamName(team?: TeamRef["teams"] | null) {
  return team?.name ?? "Team";
}

const fanSectionPaths: Record<Section, string> = {
  Home: "/dashboard/fan",
  Matches: "/dashboard/fan/matches",
  Standings: "/dashboard/fan/standings",
  "Player Stats": "/dashboard/fan/player-stats",
  "Team Stats": "/dashboard/fan/team-stats",
  "My Teams": "/dashboard/fan/my-teams",
  Discover: "/dashboard/fan/discover",
  Profile: "/dashboard/fan/profile",
};

const menu: { label: Section; icon: ReactNode }[] = [
  { label: "Home", icon: <LayoutDashboard size={18} /> },
  { label: "Matches", icon: <CalendarDays size={18} /> },
  { label: "Standings", icon: <BarChart3 size={18} /> },
  { label: "Player Stats", icon: <Star size={18} /> },
  { label: "Team Stats", icon: <ShieldAlert size={18} /> },
  { label: "My Teams", icon: <Heart size={18} /> },
  { label: "Discover", icon: <Search size={18} /> },
  { label: "Profile", icon: <User size={18} /> },
];

function sectionFromPath(path: string): Section {
  if (path.includes("/matches")) return "Matches";
  if (path.includes("/standings")) return "Standings";
  if (path.includes("/player-stats")) return "Player Stats";
  if (path.includes("/team-stats")) return "Team Stats";
  if (path.includes("/my-teams")) return "My Teams";
  if (path.includes("/discover")) return "Discover";
  if (path.includes("/profile")) return "Profile";
  return "Home";
}

// ===========================================================================
// SEASON CONTEXT
// ===========================================================================

// Sections whose data is scoped to a single season. The season dropdown only
// appears in the shared header for these.
const SEASON_AWARE_SECTIONS: Section[] = [
  "Home",
  "Matches",
  "Standings",
  "Player Stats",
  "Team Stats",
  "Discover",
];

interface FanSeasonContextValue {
  seasons: Season[];
  leagueId: string;
  seasonId: string;
  selectLeagueId: (id: string) => void;
  selectSeasonId: (id: string) => void;
  loading: boolean;
}

const FanSeasonContext = createContext<FanSeasonContextValue | null>(null);

function useFanSeason(): FanSeasonContextValue {
  const ctx = useContext(FanSeasonContext);
  if (!ctx) {
    throw new Error("useFanSeason must be used within a FanSeasonProvider");
  }
  return ctx;
}

// Loads the league's seasons once and holds the single selected season shared by
// every section. Defaults to the current season (most recent ACTIVE, else newest).
function FanSeasonProvider({
  children,
  onError,
}: {
  children: ReactNode;
  onError: (message: string) => void;
}) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api<{ seasons: Season[] }>("/fan/seasons")
      .then((data) => {
        if (!alive) return;
        setSeasons(data.seasons);
        const selectedSeason =
          pickCurrentSeason(data.seasons) ?? data.seasons[0];
        setSeasonId(selectedSeason?.id ?? "");
        setLeagueId(
          selectedSeason?.league_id ??
            one(selectedSeason?.leagues)?.id ??
            "",
        );
      })
      .catch((error) =>
        onError(
          error instanceof Error ? error.message : "Failed to load seasons",
        ),
      )
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectLeagueId(nextLeagueId: string) {
    setLeagueId(nextLeagueId);
    const leagueSeasons = seasons.filter(
      (season) =>
        (season.league_id ?? one(season.leagues)?.id) === nextLeagueId,
    );
    const currentBelongsToLeague = leagueSeasons.some(
      (season) => season.id === seasonId,
    );
    if (!currentBelongsToLeague) {
      setSeasonId(
        pickCurrentSeason(leagueSeasons)?.id ?? leagueSeasons[0]?.id ?? "",
      );
    }
  }

  function selectSeasonId(nextSeasonId: string) {
    const selectedSeason = seasons.find(
      (season) => season.id === nextSeasonId,
    );
    setSeasonId(nextSeasonId);
    if (selectedSeason) {
      setLeagueId(
        selectedSeason.league_id ?? one(selectedSeason.leagues)?.id ?? "",
      );
    }
  }

  const value = useMemo(
    () => ({
      seasons,
      leagueId,
      seasonId,
      selectLeagueId,
      selectSeasonId,
      loading,
    }),
    [seasons, leagueId, seasonId, loading],
  );

  return (
    <FanSeasonContext.Provider value={value}>
      {children}
    </FanSeasonContext.Provider>
  );
}

function FanSeasonSelect({
  className,
  selectClassName,
}: {
  className?: string;
  selectClassName?: string;
}) {
  const {
    seasons,
    leagueId,
    seasonId,
    selectLeagueId,
    selectSeasonId,
  } = useFanSeason();
  if (seasons.length === 0) return null;
  const leagues = Array.from(
    new Map(
      seasons.flatMap((season) => {
        const league = one<League>(season.leagues);
        return league ? ([[league.id, league]] as const) : [];
      }),
    ).values(),
  );
  const leagueSeasons = seasons.filter(
    (season) =>
      (season.league_id ?? one(season.leagues)?.id) === leagueId,
  );
  return (
    <div className={className ?? "flex flex-wrap gap-2"}>
      <select
        aria-label="Competition"
        className={selectClassName ?? "manager-input max-w-[16rem]"}
        value={leagueId}
        onChange={(event) => selectLeagueId(event.target.value)}
      >
        {leagues.map((league) => (
          <option key={league.id} value={league.id}>
            {league.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Season"
        className={selectClassName ?? "manager-input max-w-[16rem]"}
        value={seasonId}
        onChange={(event) => selectSeasonId(event.target.value)}
      >
        {leagueSeasons.map((season) => (
          <option key={season.id} value={season.id}>
            {season.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ===========================================================================
// PAGE
// ===========================================================================

export default function FanDashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{
    matchId?: string | string[];
    teamId?: string | string[];
    playerId?: string | string[];
  }>();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<FanTheme>(readCachedFanTheme);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const section = sectionFromPath(pathname);
  const [visitedSections, setVisitedSections] = useState<Set<Section>>(
    () => new Set([section]),
  );
  const renderedSections = useMemo(() => {
    const next = [...visitedSections];
    if (!next.includes(section)) next.push(section);
    return next;
  }, [section, visitedSections]);

  const routeMatchId = pathname.includes("/dashboard/fan/matches/")
    ? Array.isArray(params.matchId)
      ? params.matchId[0]
      : params.matchId
    : undefined;
  const routeTeamId = pathname.includes("/dashboard/fan/teams/")
    ? Array.isArray(params.teamId)
      ? params.teamId[0]
      : params.teamId
    : undefined;
  const routePlayerId = pathname.includes("/dashboard/fan/players/")
    ? Array.isArray(params.playerId)
      ? params.playerId[0]
      : params.playerId
    : undefined;

  const primaryFavorite = useMemo(
    () =>
      favorites.find((favorite) => favorite.is_primary) ?? favorites[0] ?? null,
    [favorites],
  );

  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  useEffect(() => {
    setVisitedSections((current) => {
      if (current.has(section)) return current;
      const next = new Set(current);
      next.add(section);
      return next;
    });
  }, [section]);

  useEffect(() => {
    Object.values(fanSectionPaths).forEach((path) => router.prefetch(path));
  }, [router]);

  async function load() {
    setLoading(true);
    setMessage("");
    const data = await api<DashboardPayload>("/fan/dashboard");
    setDashboard(data);
    setProfile(data.profile);
    setFavorites(data.favorites);
    setLoading(false);
  }

  useEffect(() => {
    setProfile(getStoredProfile() as Profile | null);
    void load().catch((error) => {
      setMessage(
        error instanceof Error ? error.message : "Failed to load fan dashboard",
      );
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme around the primary favourite club's colours. Favourites load
  // asynchronously, so until they arrive we keep the cached palette instead
  // of flashing the default blue. Once favourites are known we recompute and
  // persist the palette.
  useEffect(() => {
    if (loading) return;
    const nextTheme = themeFromTeam(primaryFavorite?.team);
    setTheme(nextTheme);
    try {
      window.localStorage.setItem(
        fanThemeStorageKey,
        JSON.stringify(nextTheme),
      );
    } catch {
      // In-memory palette still keeps the UI themed.
    }
  }, [primaryFavorite, loading]);

  async function refreshFavorites() {
    const data = await api<{ favorites: Favorite[] }>("/fan/favorites");
    setFavorites(data.favorites);
  }

  async function addFavorite(teamId: string, makePrimary = false) {
    const data = await api<{ favorites: Favorite[] }>("/fan/favorites", {
      method: "POST",
      body: JSON.stringify({ team_id: teamId, is_primary: makePrimary }),
    });
    setFavorites(data.favorites);
    await load().catch(() => undefined);
  }

  async function removeFavorite(teamId: string) {
    const data = await api<{ favorites: Favorite[] }>(
      `/fan/favorites/${teamId}`,
      {
        method: "DELETE",
      },
    );
    setFavorites(data.favorites);
    await load().catch(() => undefined);
  }

  async function setPrimaryFavorite(teamId: string) {
    const data = await api<{ favorites: Favorite[] }>(
      `/fan/favorites/${teamId}/primary`,
      { method: "PATCH" },
    );
    setFavorites(data.favorites);
  }

  function navigateSection(next: Section) {
    setMobileNavOpen(false);
    router.push(fanSectionPaths[next]);
  }

  const teamText = getReadableTextColor(theme.primary);
  const sidebarText = getReadableTextColor(theme.secondary);
  const sidebarUsesDarkText = sidebarText === "#111827";
  const sidebarMutedText = sidebarUsesDarkText ? "#475569" : "#CBD5E1";
  const sidebarBorder = sidebarUsesDarkText
    ? "rgba(15, 23, 42, 0.12)"
    : "rgba(255, 255, 255, 0.12)";
  const sidebarPanel = sidebarUsesDarkText
    ? "rgba(15, 23, 42, 0.04)"
    : "rgba(255, 255, 255, 0.06)";
  const sidebarHover = sidebarUsesDarkText
    ? "rgba(15, 23, 42, 0.08)"
    : "rgba(255, 255, 255, 0.12)";

  const showOnboarding =
    !loading &&
    favorites.length === 0 &&
    !onboardingDismissed &&
    !routeMatchId &&
    !routeTeamId &&
    !routePlayerId;

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen bg-[#F8FAFC] text-slate-950"
      style={
        {
          "--team-primary": theme.primary,
          "--team-secondary": theme.secondary,
          "--team-accent": theme.accent,
          "--team-primary-text": teamText,
          "--team-secondary-text": sidebarText,
          "--team-sidebar-text": sidebarText,
          "--team-sidebar-muted": sidebarMutedText,
          "--team-sidebar-border": sidebarBorder,
          "--team-sidebar-panel": sidebarPanel,
          "--team-sidebar-hover": sidebarHover,
        } as CSSProperties
      }
    >
      <FanSidebar
        profile={profile}
        primaryFavorite={primaryFavorite}
        section={section}
        favoriteCount={favorites.length}
        onSection={navigateSection}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <main className="min-h-screen lg:pl-72">
        <FanSeasonProvider onError={(text) => setMessage(text)}>
          <FanTopbar
            profile={profile}
            primaryFavorite={primaryFavorite}
            section={section}
            mobileOpen={mobileNavOpen}
            onMenuOpen={() => setMobileNavOpen(true)}
          />
        <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
          {message ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          ) : null}
          {loading ? (
            <LoadingState label="Loading your dashboard..." />
          ) : (
            <>
              <div
                hidden={Boolean(routeMatchId || routePlayerId || routeTeamId)}
              >
                {renderedSections.map((renderedSection) => (
                  <div
                    key={renderedSection}
                    hidden={renderedSection !== section}
                  >
                    <FanSectionView
                      section={renderedSection}
                      profile={profile}
                      dashboard={dashboard}
                      favorites={favorites}
                      onSection={navigateSection}
                      onOpenMatch={(id) =>
                        router.push(`/dashboard/fan/matches/${id}`)
                      }
                      onOpenTeam={(id) =>
                        router.push(`/dashboard/fan/teams/${id}`)
                      }
                      onOpenPlayer={(id) =>
                        router.push(`/dashboard/fan/players/${id}`)
                      }
                      onAddFavorite={addFavorite}
                      onRemoveFavorite={removeFavorite}
                      onSetPrimary={setPrimaryFavorite}
                      onError={(text) => setMessage(text)}
                      onProfileUpdated={(next) => setProfile(next)}
                    />
                  </div>
                ))}
              </div>
              {routeMatchId ? (
                <MatchDetailView
                  matchId={routeMatchId}
                  onBack={() => router.push("/dashboard/fan/matches")}
                  onOpenPlayer={(id) =>
                    router.push(`/dashboard/fan/players/${id}`)
                  }
                />
              ) : routePlayerId ? (
                <PlayerProfileView
                  playerRegistrationId={routePlayerId}
                  onBack={() => router.back()}
                  onOpenTeam={(id) =>
                    router.push(`/dashboard/fan/teams/${id}`)
                  }
                  onOpenMatch={(id) =>
                    router.push(`/dashboard/fan/matches/${id}`)
                  }
                />
              ) : routeTeamId ? (
                <TeamProfileView
                  teamRegistrationId={routeTeamId}
                  favorites={favorites}
                  onBack={() => router.push("/dashboard/fan/discover")}
                  onOpenMatch={(id) =>
                    router.push(`/dashboard/fan/matches/${id}`)
                  }
                  onOpenPlayer={(id) =>
                    router.push(`/dashboard/fan/players/${id}`)
                  }
                  onToggleFavorite={async (teamId, isFavorite) => {
                    if (isFavorite) await removeFavorite(teamId);
                    else await addFavorite(teamId);
                  }}
                />
              ) : null}
            </>
          )}
        </div>
        </FanSeasonProvider>
      </main>

      {showOnboarding ? (
        <OnboardingModal
          onSkip={() => setOnboardingDismissed(true)}
          onPick={async (teamId) => {
            await addFavorite(teamId, true).catch((error) =>
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Failed to follow team",
              ),
            );
            setOnboardingDismissed(true);
          }}
        />
      ) : null}
    </div>
  );
}

// Player profile is served by a matches-style route; keep routing simple by
// re-using the match route detection with an extra players branch below.

// ===========================================================================
// SHELL: sidebar + topbar
// ===========================================================================

function FanSidebar({
  profile,
  primaryFavorite,
  section,
  favoriteCount,
  onSection,
  mobileOpen,
  onClose,
}: {
  profile: Profile | null;
  primaryFavorite: Favorite | null;
  section: Section;
  favoriteCount: number;
  onSection: (section: Section) => void;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close fan navigation"
        className={`fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm transition-opacity lg:hidden ${
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        id="fan-navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(88vw,18rem)] flex-col overflow-hidden bg-[var(--team-secondary)] text-[var(--team-sidebar-text)] shadow-2xl transition-transform duration-300 lg:z-30 lg:w-72 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-[var(--team-sidebar-border)] px-6 py-6">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--team-primary)] text-[var(--team-primary-text)]">
            <Trophy size={22} />
          </div>
          <div>
            <p className="text-lg font-black tracking-wide">Scoreline</p>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--team-sidebar-muted)]">
              Fan Zone
            </p>
          </div>
          <button
            type="button"
            aria-label="Close fan navigation"
            className="ml-auto grid h-10 w-10 place-items-center rounded-xl border border-[var(--team-sidebar-border)] lg:hidden"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="mx-4 mt-5 rounded-3xl border border-[var(--team-sidebar-border)] bg-[var(--team-sidebar-panel)] p-4">
          <div className="flex items-center gap-3">
            <Avatar name={profile?.full_name ?? profile?.email ?? "Fan"} />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {profile?.full_name ?? "Fan"}
              </p>
              <p className="truncate text-xs text-[var(--team-sidebar-muted)]">
                {primaryFavorite?.team?.name ?? "No favourite yet"}
              </p>
            </div>
          </div>
        </div>
        <nav className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {menu.map((item) => (
            <button
              key={item.label}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black tracking-wide transition-all duration-200 ${
                section === item.label
                  ? "bg-[var(--team-primary)] text-[var(--team-primary-text)] shadow-lg shadow-slate-950/30"
                  : "text-[var(--team-sidebar-text)] hover:bg-[var(--team-sidebar-hover)]"
              }`}
              onClick={() => {
                onClose();
                onSection(item.label);
              }}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.label === "My Teams" && favoriteCount > 0 ? (
                <span className="rounded-full bg-[var(--team-primary)] px-2 py-0.5 text-xs text-[var(--team-primary-text)] ring-1 ring-white/30">
                  {favoriteCount}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <button
          className="m-4 flex items-center gap-3 rounded-2xl border border-[var(--team-sidebar-border)] px-4 py-3 text-sm font-black tracking-wide text-[var(--team-sidebar-text)] transition hover:bg-[var(--team-sidebar-hover)]"
          onClick={() => {
            clearAuth();
            window.location.href = "/login";
          }}
        >
          <LogOut size={18} />
          Logout
        </button>
      </aside>
    </>
  );
}

function FanTopbar({
  profile,
  primaryFavorite,
  section,
  mobileOpen,
  onMenuOpen,
}: {
  profile: Profile | null;
  primaryFavorite: Favorite | null;
  section: Section;
  mobileOpen: boolean;
  onMenuOpen: () => void;
}) {
  const showSeasonSelect = SEASON_AWARE_SECTIONS.includes(section);
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 sm:gap-4">
        <button
          type="button"
          aria-label="Open fan navigation"
          aria-controls="fan-navigation"
          aria-expanded={mobileOpen}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
          onClick={onMenuOpen}
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-900 sm:text-base">
            {primaryFavorite?.team?.name
              ? `Following ${primaryFavorite.team.name}`
              : "Welcome to Scoreline"}
          </p>
          <p className="truncate text-xs text-slate-500">
            Fixtures, results, standings and player stats
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {showSeasonSelect ? (
            <FanSeasonSelect
              className="hidden items-center gap-2 sm:flex"
              selectClassName="manager-input max-w-[13rem] py-2"
            />
          ) : null}
          <div className="rounded-full bg-slate-100 p-3 text-slate-700">
            <Bell size={18} />
          </div>
          <Avatar name={profile?.full_name ?? profile?.email ?? "Fan"} />
        </div>
      </div>
      {showSeasonSelect ? (
        <div className="mx-auto mt-3 max-w-7xl sm:hidden">
          <FanSeasonSelect
            className="grid grid-cols-1 gap-2"
            selectClassName="manager-input w-full py-2"
          />
        </div>
      ) : null}
    </header>
  );
}

// ===========================================================================
// SECTION ROUTER
// ===========================================================================

interface SectionProps {
  section: Section;
  profile: Profile | null;
  dashboard: DashboardPayload | null;
  favorites: Favorite[];
  onSection: (section: Section) => void;
  onOpenMatch: (id: string) => void;
  onOpenTeam: (id: string) => void;
  onOpenPlayer: (id: string) => void;
  onAddFavorite: (teamId: string, makePrimary?: boolean) => Promise<void>;
  onRemoveFavorite: (teamId: string) => Promise<void>;
  onSetPrimary: (teamId: string) => Promise<void>;
  onError: (message: string) => void;
  onProfileUpdated: (profile: Profile) => void;
}

function FanSectionView(props: SectionProps) {
  if (props.section === "Home") return <HomeSection {...props} />;
  if (props.section === "Matches") return <MatchesSection {...props} />;
  if (props.section === "Standings") return <StandingsSection {...props} />;
  if (props.section === "Player Stats")
    return <PlayerStatsSection {...props} />;
  if (props.section === "Team Stats") return <TeamStatsSection {...props} />;
  if (props.section === "My Teams") return <MyTeamsSection {...props} />;
  if (props.section === "Discover") return <DiscoverSection {...props} />;
  return (
    <ProfileSection
      profile={props.profile}
      favorites={props.favorites}
      onProfileUpdated={props.onProfileUpdated}
      onError={props.onError}
    />
  );
}

// ===========================================================================
// SECTIONS
// ===========================================================================

function groupFixturesByCompetition(fixtures: FixtureRecord[]) {
  const groups = new Map<
    string,
    { id: string; label: string; fixtures: FixtureRecord[] }
  >();
  for (const fixture of fixtures) {
    const season = one(fixture.seasons);
    const league = one(season?.leagues);
    const id = season?.id ?? fixture.season_id;
    const label = league?.name
      ? `${league.name} · ${season?.name ?? "Season"}`
      : (season?.name ?? "Competition");
    const group = groups.get(id) ?? { id, label, fixtures: [] };
    group.fixtures.push(fixture);
    groups.set(id, group);
  }
  return Array.from(groups.values());
}

function CompetitionFixtureGroups({
  fixtures,
  onOpenMatch,
  showScore = false,
}: {
  fixtures: FixtureRecord[];
  onOpenMatch: (id: string) => void;
  showScore?: boolean;
}) {
  const groups = groupFixturesByCompetition(fixtures);
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.id}>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--team-primary)]" />
            <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">
              {group.label}
            </h3>
          </div>
          <div className="grid gap-3">
            {group.fixtures.slice(0, 6).map((fixture) => (
              <FixtureMini
                key={fixture.id}
                fixture={fixture}
                onOpen={() => onOpenMatch(fixture.id)}
                showScore={showScore}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function HomeSection({
  dashboard,
  favorites,
  onOpenMatch,
  onSection,
  onError,
}: SectionProps) {
  const { seasons, seasonId } = useFanSeason();
  const [seasonDashboard, setSeasonDashboard] =
    useState<DashboardPayload | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const primary =
    favorites.find((favorite) => favorite.is_primary) ?? favorites[0] ?? null;
  const selectedSeason = seasons.find((season) => season.id === seasonId);
  const selectedSeasonCompleted =
    selectedSeason?.phase === "COMPLETED" ||
    seasonDashboard?.selected_season?.phase === "COMPLETED";

  useEffect(() => {
    if (!seasonId) return;
    let alive = true;
    setFeedLoading(true);
    setSeasonDashboard(null);
    api<DashboardPayload>(
      `/fan/dashboard?seasonId=${encodeURIComponent(seasonId)}`,
    )
      .then((payload) => {
        if (alive) setSeasonDashboard(payload);
      })
      .catch((error) =>
        onError(
          error instanceof Error
            ? error.message
            : "Failed to load the selected season",
        ),
      )
      .finally(() => {
        if (alive) setFeedLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [seasonId, onError]);

  const activeDashboard = seasonId ? seasonDashboard : dashboard;
  const upcoming = selectedSeasonCompleted
    ? []
    : (activeDashboard?.upcoming_fixtures ?? []);
  const results = activeDashboard?.recent_results ?? [];

  return (
    <div className="space-y-6">
      <FanHero primaryFavorite={primary} favoriteCount={favorites.length} />

      {favorites.length === 0 ? (
        <Panel title="Start following a club">
          <p className="text-sm text-slate-600">
            Pick a favourite team to personalise your feed with their upcoming
            matches, recent form, and standings. Head to{" "}
            <button
              className="font-black text-[var(--team-primary)] underline"
              onClick={() => onSection("Discover")}
            >
              Discover
            </button>{" "}
            to find one.
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Upcoming matches">
          {feedLoading ? (
            <LoadingState label="Loading selected season..." />
          ) : selectedSeasonCompleted ? (
            <EmptyState label="This season has ended. There are no upcoming matches." />
          ) : upcoming.length === 0 ? (
            <EmptyState label="No upcoming matches for your teams in this season." />
          ) : (
            <CompetitionFixtureGroups
              fixtures={upcoming}
              onOpenMatch={onOpenMatch}
            />
          )}
        </Panel>
        <Panel title="Recent results">
          {feedLoading ? (
            <LoadingState label="Loading selected season..." />
          ) : results.length === 0 ? (
            <EmptyState label="No finished matches for your teams in this season." />
          ) : (
            <CompetitionFixtureGroups
              fixtures={results}
              onOpenMatch={onOpenMatch}
              showScore
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function FanHero({
  primaryFavorite,
  favoriteCount,
}: {
  primaryFavorite: Favorite | null;
  favoriteCount: number;
}) {
  const theme = themeFromTeam(primaryFavorite?.team);
  return (
    <section
      className="overflow-hidden rounded-3xl p-6 shadow-sm sm:p-8"
      style={{
        background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
        color: getReadableTextColor(theme.primary),
      }}
    >
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          name={primaryFavorite?.team?.name ?? "Scoreline"}
          src={primaryFavorite?.team?.logo_url}
        />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] opacity-80">
            Your club
          </p>
          <h1 className="break-words text-2xl font-black leading-tight sm:text-3xl">
            {primaryFavorite?.team?.name ?? "Follow a team to begin"}
          </h1>
          <p className="mt-1 text-sm opacity-80">
            {favoriteCount > 0
              ? `${favoriteCount} team${favoriteCount === 1 ? "" : "s"} followed`
              : "Personalise your Scoreline feed"}
          </p>
        </div>
      </div>
    </section>
  );
}

function MatchesSection({ favorites, onOpenMatch, onError }: SectionProps) {
  const { seasonId } = useFanSeason();
  const [fixtures, setFixtures] = useState<FixtureRecord[]>([]);
  const [scope, setScope] = useState<"ALL" | "MY_TEAMS">("ALL");
  const [dayFilter, setDayFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const favoriteTeamIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.team_id)),
    [favorites],
  );

  useEffect(() => {
    if (!seasonId) return;
    let alive = true;
    setLoading(true);
    api<{ fixtures: FixtureRecord[] }>(`/fan/seasons/${seasonId}/fixtures`)
      .then((data) => {
        if (alive) setFixtures(data.fixtures);
      })
      .catch((error) =>
        onError(
          error instanceof Error ? error.message : "Failed to load fixtures",
        ),
      )
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId]);

  const filtered = useMemo(() => {
    return fixtures.filter((fixture) => {
      if (scope === "MY_TEAMS") {
        const homeId = fixture.home_team?.teams?.id;
        const awayId = fixture.away_team?.teams?.id;
        if (
          !(homeId && favoriteTeamIds.has(homeId)) &&
          !(awayId && favoriteTeamIds.has(awayId))
        ) {
          return false;
        }
      }
      if (dayFilter) {
        return formatDayKey(fixture.kickoff_at) === dayFilter;
      }
      return true;
    });
  }, [fixtures, scope, dayFilter, favoriteTeamIds]);

  const availableDays = useMemo(() => {
    const days = new Set<string>();
    fixtures.forEach((fixture) => {
      const key = formatDayKey(fixture.kickoff_at);
      if (key) days.add(key);
    });
    return Array.from(days).sort();
  }, [fixtures]);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Matches"
        subtitle="Browse fixtures and final results across the league."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4">
        <FilterPill active={scope === "ALL"} onClick={() => setScope("ALL")}>
          All Matches
        </FilterPill>
        <FilterPill
          active={scope === "MY_TEAMS"}
          onClick={() => setScope("MY_TEAMS")}
        >
          My Teams
        </FilterPill>
        <select
          aria-label="Match day"
          className="manager-input max-w-[12rem]"
          value={dayFilter}
          onChange={(event) => setDayFilter(event.target.value)}
        >
          <option value="">All dates</option>
          {availableDays.map((day) => (
            <option key={day} value={day}>
              {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                new Date(day),
              )}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingState label="Loading fixtures..." />
      ) : filtered.length === 0 ? (
        <EmptyState label="No matches match your filters." />
      ) : (
        <div className="grid gap-3">
          {filtered.map((fixture) => (
            <FixtureMini
              key={fixture.id}
              fixture={fixture}
              onOpen={() => onOpenMatch(fixture.id)}
              showScore={fixture.status === "FINAL"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StandingsSection({ favorites, onOpenTeam, onError }: SectionProps) {
  const { seasonId } = useFanSeason();
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const favoriteTeamIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.team_id)),
    [favorites],
  );

  useEffect(() => {
    if (!seasonId) return;
    let alive = true;
    setLoading(true);
    api<{ standings: StandingRow[] }>(`/fan/seasons/${seasonId}/standings`)
      .then((data) => {
        if (alive) setStandings(data.standings);
      })
      .catch((error) =>
        onError(
          error instanceof Error ? error.message : "Failed to load standings",
        ),
      )
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [seasonId, onError]);

  const groups = useMemo(() => {
    const map = new Map<string, StandingRow[]>();
    standings.forEach((row) => {
      const key = row.group_name ?? "";
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    });
    return Array.from(map.entries());
  }, [standings]);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Standings"
        subtitle="League tables update as results are confirmed."
      />

      {loading ? (
        <LoadingState label="Loading standings..." />
      ) : standings.length === 0 ? (
        <EmptyState label="No standings available for this season yet." />
      ) : (
        groups.map(([groupName, rows]) => (
          <Panel
            key={groupName || "table"}
            title={groupName ? `Group ${groupName}` : "Table"}
          >
            <StandingsTable
              rows={rows}
              favoriteTeamIds={favoriteTeamIds}
              onOpenTeam={onOpenTeam}
            />
          </Panel>
        ))
      )}
    </div>
  );
}

interface FanStatEntry {
  id: string;
  name: string;
  subLabel: string;
  logoUrl: string | null;
  teamLogoUrl: string | null;
  initials: string;
  value: string;
  numericValue: number;
}

interface FanStatCard {
  id: string;
  title: string;
  entries: FanStatEntry[];
}

interface FanStatSection {
  title: string;
  cards: FanStatCard[];
}

function PlayerStatsSection({ onOpenPlayer, onError }: SectionProps) {
  const { seasonId } = useFanSeason();
  const [sections, setSections] = useState<FanStatSection[]>([]);
  const [openCard, setOpenCard] = useState<FanStatCard | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!seasonId) return;
    let alive = true;
    setLoading(true);
    api<{ player_sections: FanStatSection[] }>(
      `/fan/seasons/${seasonId}/stat-leaderboards`,
    )
      .then((data) => {
        if (alive) setSections(data.player_sections ?? []);
      })
      .catch((error) =>
        onError(
          error instanceof Error
            ? error.message
            : "Failed to load player stats",
        ),
      )
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [seasonId, onError]);

  const hasData = useMemo(
    () =>
      sections.some((section) =>
        section.cards.some((card) => card.entries.length > 0),
      ),
    [sections],
  );

  return (
    <div className="space-y-6">
      <PageTitle
        title="Player Stats"
        subtitle="Season leaderboards across the whole league."
      />

      {loading ? (
        <LoadingState label="Loading player stats..." />
      ) : !hasData ? (
        <EmptyState label="Player stats will appear after confirmed match results generate stats." />
      ) : (
        <div className="space-y-6">
          {sections.map((section) => {
            const cards = section.cards.filter(
              (card) => card.entries.length > 0,
            );
            if (cards.length === 0) return null;
            return (
              <div key={section.title}>
                <h3 className="mb-3 text-lg font-black text-slate-900">
                  {section.title}
                </h3>
                <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  {cards.map((card) => (
                    <FanLeaderboardCard
                      key={card.id}
                      card={card}
                      onOpen={() => setOpenCard(card)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openCard ? (
        <FanLeaderboardModal
          card={openCard}
          onOpenEntry={onOpenPlayer}
          onClose={() => setOpenCard(null)}
        />
      ) : null}
    </div>
  );
}

function TeamStatsSection({ onOpenTeam, onError }: SectionProps) {
  const { seasonId } = useFanSeason();
  const [teams, setTeams] = useState<any[]>([]);
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [sections, setSections] = useState<FanStatSection[]>([]);
  const [openCard, setOpenCard] = useState<FanStatCard | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!seasonId) return;
    let alive = true;
    setTeamFilter("ALL");
    setLoading(true);
    Promise.all([
      api<{ teams: any[] }>(`/fan/seasons/${seasonId}/teams`),
      api<{ team_sections: FanStatSection[] }>(
        `/fan/seasons/${seasonId}/stat-leaderboards?teamId=ALL`,
      ),
    ])
      .then(([teamPayload, report]) => {
        if (!alive) return;
        setTeams(teamPayload.teams ?? []);
        setSections(report.team_sections ?? []);
      })
      .catch((error) =>
        onError(
          error instanceof Error ? error.message : "Failed to load team stats",
        ),
      )
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [seasonId, onError]);

  async function changeTeamFilter(nextTeamId: string) {
    setTeamFilter(nextTeamId);
    setLoading(true);
    try {
      const report = await api<{ team_sections: FanStatSection[] }>(
        `/fan/seasons/${seasonId}/stat-leaderboards?teamId=${encodeURIComponent(nextTeamId)}`,
      );
      setSections(report.team_sections ?? []);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Failed to load team stats",
      );
    } finally {
      setLoading(false);
    }
  }

  const hasData = useMemo(
    () =>
      sections.some((section) =>
        section.cards.some((card) => card.entries.length > 0),
      ),
    [sections],
  );

  return (
    <div className="space-y-6">
      <PageTitle
        title="Team Stats"
        subtitle="Confirmed season performance across every team in the selected competition."
      />
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <label
          htmlFor="fan-team-stats-filter"
          className="text-sm font-black text-slate-700"
        >
          Team
        </label>
        <select
          id="fan-team-stats-filter"
          className="manager-input min-w-[15rem] max-w-sm"
          value={teamFilter}
          onChange={(event) => void changeTeamFilter(event.target.value)}
        >
          <option value="ALL">All season teams</option>
          {teams.map((registration) => (
            <option key={registration.id} value={registration.id}>
              {one<any>(registration.teams)?.name ?? "Team"}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingState label="Loading team stats..." />
      ) : !hasData ? (
        <EmptyState label="Team stats will appear after confirmed match results generate statistics." />
      ) : (
        <div className="space-y-6">
          {sections.map((section) => {
            const cards = section.cards.filter(
              (card) => card.entries.length > 0,
            );
            if (cards.length === 0) return null;
            return (
              <div key={section.title}>
                <h3 className="mb-3 text-lg font-black text-slate-900">
                  {section.title}
                </h3>
                <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  {cards.map((card) => (
                    <FanLeaderboardCard
                      key={card.id}
                      card={card}
                      onOpen={() => setOpenCard(card)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openCard ? (
        <FanLeaderboardModal
          card={openCard}
          onOpenEntry={onOpenTeam}
          onClose={() => setOpenCard(null)}
        />
      ) : null}
    </div>
  );
}

function FanLeaderboardCard({
  card,
  onOpen,
}: {
  card: FanStatCard;
  onOpen: () => void;
}) {
  const topEntries = card.entries.slice(0, 3);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--team-primary)] hover:shadow-xl active:translate-y-0"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h4 className="text-lg font-black text-slate-900">{card.title}</h4>
        <span className="text-2xl font-black text-slate-300">›</span>
      </div>
      <div className="divide-y divide-slate-100">
        {topEntries.map((entry, index) => (
          <FanLeaderboardRow key={entry.id} entry={entry} rank={index + 1} />
        ))}
      </div>
    </button>
  );
}

function FanLeaderboardRow({
  entry,
  rank,
  onClick,
}: {
  entry: FanStatEntry;
  rank: number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-5 shrink-0 text-sm font-black text-slate-400">
          {rank}
        </span>
        <Avatar name={entry.name} src={entry.logoUrl} small />
        <div className="min-w-0">
          <p className="truncate font-black text-slate-900">{entry.name}</p>
          <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-slate-500">
            {entry.teamLogoUrl ? (
              <img
                src={entry.teamLogoUrl}
                alt=""
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : null}
            <span className="truncate">{entry.subLabel}</span>
          </div>
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-sm font-black ${rank === 1 ? "bg-[var(--team-primary)] text-[var(--team-primary-text)]" : "bg-slate-100 text-slate-900"}`}
      >
        {entry.value}
      </span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-4 py-3 text-left transition hover:bg-purple-50"
      >
        {content}
      </button>
    );
  }
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      {content}
    </div>
  );
}

function FanLeaderboardModal({
  card,
  onOpenEntry,
  onClose,
}: {
  card: FanStatCard;
  onOpenEntry: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[var(--team-primary)]">
              Full Leaderboard
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">
              {card.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200"
          >
            Close
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {card.entries.map((entry, index) => (
            <FanLeaderboardRow
              key={entry.id}
              entry={entry}
              rank={index + 1}
              onClick={() => {
                onClose();
                onOpenEntry(entry.id);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MyTeamsSection({
  favorites,
  onOpenTeam,
  onSetPrimary,
  onRemoveFavorite,
  onSection,
  onError,
}: SectionProps) {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: () => Promise<void>, teamId: string) {
    setBusy(teamId);
    try {
      await action();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="My Teams"
        subtitle="The clubs you follow. Your primary club themes your dashboard."
      />
      {favorites.length === 0 ? (
        <Panel title="No favourites yet">
          <p className="text-sm text-slate-600">
            You are not following any clubs.{" "}
            <button
              className="font-black text-[var(--team-primary)] underline"
              onClick={() => onSection("Discover")}
            >
              Discover teams
            </button>{" "}
            to start.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {favorites.map((favorite) => (
            <div
              key={favorite.id}
              className="flex items-center gap-3 rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-sm"
            >
              <Avatar
                name={favorite.team?.name ?? "Team"}
                src={favorite.team?.logo_url}
              />
              <div className="min-w-0 flex-1">
                <button
                  className="block truncate text-left font-black text-slate-900 hover:text-[var(--team-primary)] hover:underline"
                  onClick={() => onOpenTeam(favorite.team_id)}
                  disabled={!favorite.team_id}
                >
                  {favorite.team?.name ?? "Team"}
                </button>
                <p className="truncate text-xs font-bold text-slate-500">
                  {favorite.is_primary
                    ? "Primary club"
                    : (favorite.team?.short_name ?? "")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!favorite.is_primary ? (
                  <button
                    className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-purple-50 hover:text-[var(--team-primary)] disabled:opacity-50"
                    disabled={busy === favorite.team_id}
                    onClick={() =>
                      run(
                        () => onSetPrimary(favorite.team_id),
                        favorite.team_id,
                      )
                    }
                  >
                    Set primary
                  </button>
                ) : (
                  <span className="rounded-xl bg-[var(--team-primary)] px-3 py-2 text-xs font-black text-[var(--team-primary-text)]">
                    Primary
                  </span>
                )}
                <button
                  aria-label="Unfollow"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                  disabled={busy === favorite.team_id}
                  onClick={() =>
                    run(
                      () => onRemoveFavorite(favorite.team_id),
                      favorite.team_id,
                    )
                  }
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiscoverSection({
  favorites,
  onOpenTeam,
  onAddFavorite,
  onError,
}: SectionProps) {
  const { seasonId } = useFanSeason();
  const [teams, setTeams] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const favoriteTeamIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.team_id)),
    [favorites],
  );

  useEffect(() => {
    if (!seasonId) return;
    let alive = true;
    setLoading(true);
    api<{ teams: any[] }>(`/fan/seasons/${seasonId}/teams`)
      .then((data) => {
        if (alive) setTeams(data.teams);
      })
      .catch((error) =>
        onError(
          error instanceof Error ? error.message : "Failed to load teams",
        ),
      )
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [seasonId, onError]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teams;
    return teams.filter((team) => {
      const club = one<any>(team.teams);
      return (
        club?.name?.toLowerCase().includes(needle) ||
        club?.short_name?.toLowerCase().includes(needle)
      );
    });
  }, [teams, query]);

  async function follow(teamId: string) {
    setBusy(teamId);
    try {
      await onAddFavorite(teamId);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to follow team");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Discover"
        subtitle="Explore clubs across the league and follow your favourites."
      />
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            className="manager-input pl-9"
            placeholder="Search teams"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading teams..." />
      ) : filtered.length === 0 ? (
        <EmptyState label="No teams found." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((team) => {
            const club = one<any>(team.teams);
            const isFavorite = favoriteTeamIds.has(club?.id);
            return (
              <div
                key={team.id}
                className="flex items-center gap-3 rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-sm"
              >
                <Avatar name={club?.name ?? "Team"} src={club?.logo_url} />
                <div className="min-w-0 flex-1">
                  <button
                    className="block truncate text-left font-black text-slate-900 hover:text-[var(--team-primary)] hover:underline"
                    onClick={() => onOpenTeam(team.id)}
                  >
                    {club?.name ?? "Team"}
                  </button>
                  <p className="truncate text-xs font-bold text-slate-500">
                    {club?.short_name ?? ""}
                  </p>
                </div>
                <button
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition disabled:opacity-50 ${
                    isFavorite
                      ? "bg-[var(--team-primary)] text-[var(--team-primary-text)]"
                      : "bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-[var(--team-primary)]"
                  }`}
                  disabled={busy === club?.id || !club?.id}
                  onClick={() => club?.id && follow(club.id)}
                >
                  <Heart
                    size={14}
                    className={isFavorite ? "fill-current" : ""}
                  />
                  {isFavorite ? "Following" : "Follow"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProfileSection({
  profile,
  favorites,
  onProfileUpdated,
  onError,
}: {
  profile: Profile | null;
  favorites: Favorite[];
  onProfileUpdated: (profile: Profile) => void;
  onError: (message: string) => void;
}) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  const trimmed = fullName.trim();
  const dirty = trimmed !== (profile?.full_name ?? "").trim();

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) {
      onError("Full name is required.");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const { profile: updated } = await api<{ profile: Profile }>(
        "/fan/profile",
        {
          method: "PATCH",
          body: JSON.stringify({ full_name: trimmed }),
        },
      );
      updateStoredProfile(
        updated as unknown as Parameters<typeof updateStoredProfile>[0],
      );
      onProfileUpdated(updated);
      setSaved(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save name");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Profile" subtitle="Your Scoreline fan account." />
      <Panel title="Account">
        <form onSubmit={save} className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Name
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[var(--fan-primary,#2563eb)]"
              value={fullName}
              maxLength={160}
              placeholder="Your name"
              onChange={(event) => {
                setFullName(event.target.value);
                setSaved(false);
              }}
            />
            <button
              type="submit"
              disabled={saving || !dirty || !trimmed}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          {saved && !dirty ? (
            <p className="text-sm font-semibold text-emerald-600">
              Name updated.
            </p>
          ) : null}
        </form>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Detail label="Email" value={profile?.email ?? "-"} />
          <Detail label="Role" value="Fan" />
          <Detail label="Teams followed" value={favorites.length} />
        </div>
      </Panel>
    </div>
  );
}

// ===========================================================================
// MATCH DETAIL VIEW
// ===========================================================================

interface MatchDetailPayload {
  fixture: FixtureRecord;
  lineups: any[];
  team_stats: any[];
  player_stats: any[];
  events: any[];
  substitutions: any[];
}

// A goal-type event (real goal, penalty, own goal) that we surface under the
// scoreline the way FotMob lists scorers beside each side.
const GOAL_EVENT_TYPES = ["GOAL", "PENALTY_GOAL", "OWN_GOAL"];

function eventPlayerName(event: any): string {
  const reg = one<any>(event?.player);
  return one<any>(reg?.players)?.full_name ?? "Player";
}

function MatchDetailView({
  matchId,
  onBack,
  onOpenPlayer,
}: {
  matchId: string;
  onBack: () => void;
  onOpenPlayer?: ((playerRegistrationId: string) => void) | undefined;
}) {
  const [detail, setDetail] = useState<MatchDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Summary");
  const [selectedStat, setSelectedStat] = useState<any | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<MatchDetailPayload>(`/fan/matches/${matchId}/detail`)
      .then((data) => {
        if (alive) setDetail(data);
      })
      .catch((err) => {
        if (alive)
          setError(err instanceof Error ? err.message : "Failed to load match");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [matchId]);

  if (loading) return <LoadingState label="Loading match detail..." />;
  if (error) return <ErrorBanner text={error} />;
  if (!detail) return <EmptyState label="Match not found." />;

  const fixture = detail.fixture;
  const home = fixture.home_team?.teams;
  const away = fixture.away_team?.teams;
  const homeId = fixture.home_team_registration_id;
  const isFinal = fixture.status === "FINAL";

  // Split goal events by side so we can list scorers under each crest. Own
  // goals count for the opposing team, exactly as they show up on the scoreline.
  const goals = detail.events.filter((event) =>
    GOAL_EVENT_TYPES.includes(event.type),
  );
  const scorerFor = (side: "HOME" | "AWAY") =>
    goals.filter((event) =>
      event.type === "OWN_GOAL" ? event.side !== side : event.side === side,
    );

  // Per-player match stats and the position each player actually played, so a
  // click opens the same single-match stat modal admins and managers see rather
  // than jumping straight to the season profile.
  const statByReg = new Map<string, any>();
  for (const stat of detail.player_stats) {
    statByReg.set(stat.player_registration_id, stat);
  }
  const roleByReg = new Map<string, string>();
  for (const lineup of detail.lineups) {
    for (const lp of lineup.lineup_players ?? []) {
      const natural =
        one<any>(lp.player_season_registrations)?.football_position ??
        lp.football_position ??
        null;
      let role = lp.display_role ?? null;
      if (!role || role === "SUB") role = natural;
      if (role) roleByReg.set(lp.player_registration_id, role);
    }
  }

  // A player click opens the match-stat modal when we have stats for them;
  // otherwise (rare) fall back to the season profile page.
  const handlePlayerClick = (registrationId: string) => {
    const stat = statByReg.get(registrationId);
    if (stat) setSelectedStat(stat);
    else onOpenPlayer?.(registrationId);
  };

  const tabs = ["Summary", "Lineups", "Stats", "Ratings"];

  return (
    <div className="space-y-6">
      <BackButton label="Back to Matches" onClick={onBack} />

      {/* Scoreboard header with per-side goalscorers, FotMob style. */}
      <section className="overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 bg-[var(--team-secondary)] px-5 py-3 text-xs font-bold text-[var(--team-secondary-text)]">
          <span className="inline-flex items-center gap-2">
            <StageBadge stage={fixture.stage} />
            {fixture.group_name ? (
              <span>Group {fixture.group_name}</span>
            ) : null}
          </span>
          <span>{formatDate(fixture.kickoff_at)}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 p-6">
          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            <Avatar name={teamName(home)} src={home?.logo_url} />
            <p className="truncate font-black text-slate-900">
              {teamName(home)}
            </p>
          </div>
          <div className="shrink-0 px-2 text-center">
            {isFinal ? (
              <p className="text-4xl font-black leading-none text-slate-950">
                {fixture.home_score ?? 0}
                <span className="px-2 text-slate-300">-</span>
                {fixture.away_score ?? 0}
              </p>
            ) : (
              <p className="text-2xl font-black text-slate-400">vs</p>
            )}
            <p className="mt-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
              {isFinal
                ? (fixtureOutcomeLabel(fixture) ?? "Full time")
                : String(fixture.status ?? "").replaceAll("_", " ")}
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            <Avatar name={teamName(away)} src={away?.logo_url} />
            <p className="truncate font-black text-slate-900">
              {teamName(away)}
            </p>
          </div>
        </div>
        {isFinal && goals.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 px-6 py-4 text-sm">
            <ScorerList events={scorerFor("HOME")} align="left" />
            <ScorerList events={scorerFor("AWAY")} align="right" />
          </div>
        ) : null}
        <p className="border-t border-slate-100 px-6 py-3 text-center text-xs font-bold text-slate-500">
          {fixture.venue ?? "Venue TBA"}
        </p>
      </section>

      {!isFinal ? (
        <EmptyState label="Match timeline and stats appear once the match is finalised." />
      ) : (
        <>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />

          {tab === "Summary" ? (
            <MatchTimeline
              events={detail.events}
              substitutions={detail.substitutions}
              homeId={homeId}
            />
          ) : null}

          {tab === "Lineups" ? (
            <MatchLineups
              lineups={detail.lineups}
              playerStats={detail.player_stats}
              events={detail.events}
              substitutions={detail.substitutions}
              homeId={homeId}
              home={home}
              away={away}
              onOpenPlayer={handlePlayerClick}
            />
          ) : null}

          {tab === "Stats" ? (
            detail.team_stats.length === 2 ? (
              <Panel title="Match stats">
                <MatchStatsCompare
                  stats={detail.team_stats}
                  fixture={fixture}
                  home={teamName(home)}
                  away={teamName(away)}
                />
              </Panel>
            ) : (
              <EmptyState label="No team stats recorded for this match." />
            )
          ) : null}

          {tab === "Ratings" ? (
            <MatchPlayerRatings
              playerStats={detail.player_stats}
              onOpenPlayer={handlePlayerClick}
            />
          ) : null}
        </>
      )}

      {selectedStat ? (
        <FanPlayerMatchStatModal
          stat={selectedStat}
          role={roleByReg.get(selectedStat.player_registration_id)}
          onClose={() => setSelectedStat(null)}
          onOpenProfile={
            onOpenPlayer
              ? (registrationId) => {
                  setSelectedStat(null);
                  onOpenPlayer(registrationId);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function ScorerList({
  events,
  align,
}: {
  events: any[];
  align: "left" | "right";
}) {
  if (events.length === 0) return <div />;
  return (
    <ul
      className={`space-y-1 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {events.map((event) => (
        <li
          key={event.id}
          className={`flex items-center gap-1.5 text-xs font-bold text-slate-700 ${
            align === "right" ? "justify-end" : "justify-start"
          }`}
        >
          {align === "right" ? (
            <>
              <span className="truncate">
                {eventPlayerName(event)}
                {event.type === "OWN_GOAL" ? " (OG)" : ""}
                {event.type === "PENALTY_GOAL" ? " (P)" : ""}
              </span>
              <Goal size={13} className="shrink-0 text-slate-400" />
              <span className="text-slate-400">{event.minute}'</span>
            </>
          ) : (
            <>
              <span className="text-slate-400">{event.minute}'</span>
              <Goal size={13} className="shrink-0 text-slate-400" />
              <span className="truncate">
                {eventPlayerName(event)}
                {event.type === "OWN_GOAL" ? " (OG)" : ""}
                {event.type === "PENALTY_GOAL" ? " (P)" : ""}
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

// Icon + colour for each event type on the timeline.
function eventVisual(type: string) {
  switch (type) {
    case "GOAL":
    case "PENALTY_GOAL":
      return {
        icon: <Goal size={15} />,
        ring: "ring-emerald-200",
        text: "text-emerald-600",
        label: type === "PENALTY_GOAL" ? "Penalty goal" : "Goal",
      };
    case "OWN_GOAL":
      return {
        icon: <Goal size={15} />,
        ring: "ring-red-200",
        text: "text-red-600",
        label: "Own goal",
      };
    case "YELLOW_CARD":
      return {
        icon: <Square size={13} className="fill-current" />,
        ring: "ring-amber-200",
        text: "text-amber-500",
        label: "Yellow card",
      };
    case "RED_CARD":
      return {
        icon: <Square size={13} className="fill-current" />,
        ring: "ring-red-200",
        text: "text-red-600",
        label: "Red card",
      };
    case "SUBSTITUTION":
      return {
        icon: <ArrowLeftRight size={14} />,
        ring: "ring-slate-200",
        text: "text-slate-500",
        label: "Substitution",
      };
    case "PENALTY_MISS":
    case "PENALTY_SAVED":
      return {
        icon: <ShieldAlert size={14} />,
        ring: "ring-slate-200",
        text: "text-slate-500",
        label: type === "PENALTY_SAVED" ? "Penalty saved" : "Penalty missed",
      };
    case "INJURY":
      return {
        icon: <ShieldAlert size={14} />,
        ring: "ring-red-200",
        text: "text-red-500",
        label: "Injury",
      };
    case "HIT_WOODWORK":
      return {
        icon: <Goal size={14} />,
        ring: "ring-slate-200",
        text: "text-slate-400",
        label: "Hit woodwork",
      };
    default:
      return {
        icon: <ChevronRight size={14} />,
        ring: "ring-slate-200",
        text: "text-slate-500",
        label: type.replaceAll("_", " "),
      };
  }
}

// Chronological match timeline. Home-side events sit on the left, away on the
// right, mirroring FotMob's centre-line layout. Substitutions are folded into
// the same stream so the story reads in order.
function MatchTimeline({
  events,
  substitutions,
  homeId,
}: {
  events: any[];
  substitutions: any[];
  homeId: string | null;
}) {
  const merged = useMemo(() => {
    const eventItems = events
      .filter((event) => event.type !== "SUBSTITUTION")
      .map((event) => ({
        kind: "event" as const,
        minute: event.minute ?? 0,
        data: event,
      }));
    const subItems = substitutions.map((sub) => ({
      kind: "sub" as const,
      minute: sub.minute ?? 0,
      data: sub,
    }));
    return [...eventItems, ...subItems].sort((a, b) => a.minute - b.minute);
  }, [events, substitutions]);

  if (merged.length === 0) {
    return <EmptyState label="No timeline events recorded for this match." />;
  }

  return (
    <Panel title="Match timeline">
      <ol className="space-y-2">
        {merged.map((item, index) => {
          if (item.kind === "sub") {
            const sub = item.data;
            const isHome = sub.team_registration_id === homeId;
            const inName =
              one<any>(one<any>(sub.player_in)?.players)?.full_name ?? "Player";
            const outName =
              one<any>(one<any>(sub.player_out)?.players)?.full_name ??
              "Player";
            return (
              <li
                key={`sub-${sub.id ?? index}`}
                className={`flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ${
                  isHome ? "" : "flex-row-reverse text-right"
                }`}
              >
                <span className="w-9 shrink-0 text-center text-sm font-black text-slate-500">
                  {sub.minute}'
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200">
                  <ArrowLeftRight size={14} />
                </span>
                <div className={`min-w-0 ${isHome ? "" : "text-right"}`}>
                  <p className="truncate text-sm font-bold text-emerald-600">
                    ↑ {inName}
                  </p>
                  <p className="truncate text-xs font-bold text-slate-400">
                    ↓ {outName}
                  </p>
                </div>
              </li>
            );
          }
          const event = item.data;
          const isHome = event.side === "HOME";
          const visual = eventVisual(event.type);
          const assist = one<any>(
            one<any>(event.related_player)?.players,
          )?.full_name;
          return (
            <li
              key={`ev-${event.id ?? index}`}
              className={`flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ${
                isHome ? "" : "flex-row-reverse text-right"
              }`}
            >
              <span className="w-9 shrink-0 text-center text-sm font-black text-[var(--team-primary)]">
                {event.minute}'
              </span>
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white ring-1 ${visual.ring} ${visual.text}`}
              >
                {visual.icon}
              </span>
              <div className={`min-w-0 ${isHome ? "" : "text-right"}`}>
                <p className="truncate text-sm font-bold text-slate-800">
                  {eventPlayerName(event)}
                </p>
                <p className="truncate text-xs font-bold text-slate-400">
                  {visual.label}
                  {assist &&
                  (event.type === "GOAL" || event.type === "PENALTY_GOAL")
                    ? ` · assist ${assist}`
                    : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function ratingTone(rating: number | null | undefined): string {
  if (rating == null) return "bg-slate-400";
  if (rating >= 8) return "bg-emerald-600";
  if (rating >= 7) return "bg-emerald-500";
  if (rating >= 6) return "bg-amber-500";
  return "bg-red-500";
}

type FanPlayerEventMeta = {
  goals: number;
  ownGoals: number;
  assists: number;
  yellow: boolean;
  red: boolean;
  penaltyMiss: boolean;
  penaltySaved: boolean;
  injured: boolean;
  subInMinute?: number;
  subOutMinute?: number;
};

function emptyFanPlayerEventMeta(): FanPlayerEventMeta {
  return {
    goals: 0,
    ownGoals: 0,
    assists: 0,
    yellow: false,
    red: false,
    penaltyMiss: false,
    penaltySaved: false,
    injured: false,
  };
}

function ensureFanPlayerEventMeta(
  map: Map<string, FanPlayerEventMeta>,
  playerId: string,
) {
  const existing = map.get(playerId);
  if (existing) return existing;
  const next = emptyFanPlayerEventMeta();
  map.set(playerId, next);
  return next;
}

function buildFanPlayerEventMeta(events: any[], substitutions: any[]) {
  const map = new Map<string, FanPlayerEventMeta>();
  for (const event of events) {
    const playerId = String(event.player_registration_id ?? "");
    if (!playerId) continue;
    const meta = ensureFanPlayerEventMeta(map, playerId);
    const type = String(event.type ?? "");
    if (type === "GOAL" || type === "PENALTY_GOAL") meta.goals += 1;
    if (type === "OWN_GOAL") meta.ownGoals += 1;
    if (
      (type === "GOAL" || type === "PENALTY_GOAL") &&
      event.related_player_registration_id
    ) {
      ensureFanPlayerEventMeta(
        map,
        String(event.related_player_registration_id),
      ).assists += 1;
    }
    if (type === "YELLOW_CARD") meta.yellow = true;
    if (type === "RED_CARD") meta.red = true;
    if (type === "PENALTY_MISS") meta.penaltyMiss = true;
    if (type === "PENALTY_SAVED") {
      meta.penaltyMiss = true;
      if (event.related_player_registration_id) {
        ensureFanPlayerEventMeta(
          map,
          String(event.related_player_registration_id),
        ).penaltySaved = true;
      }
    }
    if (type === "INJURY") meta.injured = true;
  }
  for (const substitution of substitutions) {
    const minute = Number(substitution.minute ?? 0);
    const outId = String(substitution.player_out_registration_id ?? "");
    const inId = String(substitution.player_in_registration_id ?? "");
    if (outId) {
      const meta = ensureFanPlayerEventMeta(map, outId);
      if (!meta.red) meta.subOutMinute = minute;
    }
    if (inId) ensureFanPlayerEventMeta(map, inId).subInMinute = minute;
  }
  return map;
}

function FanLineupEventIcons({
  meta,
  dark = false,
  overlay = false,
}: {
  meta: FanPlayerEventMeta;
  dark?: boolean;
  overlay?: boolean;
}) {
  const textClass = dark ? "text-slate-700" : "text-white";
  const badgeBase =
    "inline-grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-black shadow";
  const assistIcon = (
    <svg viewBox="0 0 20 20" className="h-3 w-3" aria-hidden="true">
      <path
        d="M4 12.8c2.8-.5 5.3-2.4 7.4-5.6l1.2-1.8 2.6 1.7-1.7 2.5 3.5 2.2c.8.5 1.1 1.4.8 2.2-.2.7-.8 1.1-1.6 1.1H4.7c-1.2 0-1.8-1.5-.7-2.3Z"
        fill="currentColor"
      />
      <path
        d="M6.5 11.7 8 14m1-4 2.1 3.2m1.7-5.8 1.5 2"
        stroke="#fff"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );

  if (overlay) {
    return (
      <div className="pointer-events-none absolute inset-0 z-20 text-[10px] font-black">
        {meta.subOutMinute ? (
          <span className="absolute -left-1 -top-3 inline-flex items-center gap-0.5 text-white drop-shadow">
            {meta.subOutMinute}'
            <span className={`${badgeBase} bg-red-500 text-white`}>↩</span>
          </span>
        ) : null}
        {meta.subInMinute ? (
          <span className="absolute -left-1 -top-3 inline-flex items-center gap-0.5 text-white drop-shadow">
            {meta.subInMinute}'
            <span className={`${badgeBase} bg-emerald-500 text-white`}>↪</span>
          </span>
        ) : null}
        {meta.yellow ? (
          <span
            className="absolute -left-2 bottom-5 h-4 w-3 rounded-[3px] border border-white/70 bg-yellow-300 shadow"
            title="Yellow card"
          />
        ) : null}
        {meta.red ? (
          <span
            className="absolute -left-2 bottom-5 h-4 w-3 rounded-[3px] border border-white/70 bg-red-500 shadow"
            title="Red card"
          />
        ) : null}
        {meta.goals ? (
          <span
            className={`${badgeBase} absolute -right-1 ${meta.ownGoals ? "bottom-5" : "bottom-0"} bg-white text-slate-950`}
            title="Goal"
          >
            ⚽{meta.goals > 1 ? meta.goals : ""}
          </span>
        ) : null}
        {meta.ownGoals ? (
          <span
            className={`${badgeBase} absolute -right-1 bottom-0 gap-0.5 bg-white text-red-600 ring-1 ring-red-200`}
            title="Own goal"
          >
            <OwnGoalIcon />
            {meta.ownGoals > 1 ? meta.ownGoals : ""}
          </span>
        ) : null}
        {meta.assists ? (
          <span
            className="absolute -left-2 bottom-0 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-black text-slate-800 shadow"
            title="Assist"
          >
            <span className="flex items-center gap-0.5">
              {assistIcon}
              {meta.assists > 1 ? meta.assists : ""}
            </span>
          </span>
        ) : null}
        {meta.penaltyMiss ? (
          <span
            className="absolute -right-1 bottom-5 drop-shadow"
            title="Penalty missed"
          >
            <PenaltyMissIcon />
          </span>
        ) : meta.penaltySaved ? (
          <span
            className="absolute -right-1 bottom-5 drop-shadow"
            title="Penalty saved"
          >
            <PenaltySaveIcon />
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`mt-0.5 flex min-h-4 items-center justify-center gap-1 text-[10px] font-black ${textClass}`}
    >
      {meta.subOutMinute ? (
        <span className="inline-flex items-center gap-0.5">
          {meta.subOutMinute}'
          <span className={`${badgeBase} bg-red-500 text-white`}>↩</span>
        </span>
      ) : null}
      {meta.subInMinute ? (
        <span className="inline-flex items-center gap-0.5">
          {meta.subInMinute}'
          <span className={`${badgeBase} bg-emerald-500 text-white`}>↪</span>
        </span>
      ) : null}
      {meta.goals ? (
        <span className={`${badgeBase} bg-white text-slate-950`} title="Goal">
          ⚽{meta.goals > 1 ? meta.goals : ""}
        </span>
      ) : null}
      {meta.ownGoals ? (
        <span
          className={`${badgeBase} gap-0.5 bg-white text-red-600 ring-1 ring-red-200`}
          title="Own goal"
        >
          <OwnGoalIcon />
          {meta.ownGoals > 1 ? meta.ownGoals : ""}
        </span>
      ) : null}
      {meta.assists ? (
        <span className={`${badgeBase} bg-white text-slate-800`} title="Assist">
          <span className="flex items-center gap-0.5">
            {assistIcon}
            {meta.assists > 1 ? meta.assists : ""}
          </span>
        </span>
      ) : null}
      {meta.penaltyMiss ? (
        <span title="Penalty missed">
          <PenaltyMissIcon className="h-4 w-4" />
        </span>
        ) : meta.penaltySaved ? (
          <span title="Penalty saved">
            <PenaltySaveIcon />
          </span>
      ) : null}
      {meta.injured ? (
        <span
          className={`${badgeBase} bg-white text-red-600 ring-1 ring-red-100`}
          title="Injury"
        >
          +
        </span>
      ) : null}
      {meta.yellow ? (
        <span
          className="h-4 w-3 rounded-[3px] border border-white/70 bg-yellow-300 shadow"
          title="Yellow card"
        />
      ) : null}
      {meta.red ? (
        <span
          className="h-4 w-3 rounded-[3px] border border-white/70 bg-red-500 shadow"
          title="Red card"
        />
      ) : null}
    </div>
  );
}

function FanTeamBadge({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string | null | undefined;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  if (logoUrl && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        onError={() => setImageFailed(true)}
        className="h-12 w-12 shrink-0 rounded-full border-4 border-white object-cover shadow"
      />
    );
  }
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-4 border-white bg-gradient-to-br from-blue-700 to-sky-400 text-center text-xs font-black text-white shadow">
      {initials(name)}
    </div>
  );
}

function averageFanLineupRating(lineup: any, statsByReg: Map<string, any>) {
  const ratings = (lineup?.lineup_players ?? [])
    .map((player: any) =>
      Number(statsByReg.get(player.player_registration_id)?.rating),
    )
    .filter((rating: number) => Number.isFinite(rating) && rating > 0);
  if (!ratings.length) return 0;
  return (
    ratings.reduce((sum: number, rating: number) => sum + rating, 0) /
    ratings.length
  );
}

function fanLineupRatingBadgeClass(value: number) {
  if (value > 7.9) return "bg-sky-500";
  if (value >= 7) return "bg-emerald-500";
  return "bg-orange-500";
}

function FanMatchPlayerNode({
  player,
  x,
  y,
  displayRole,
  stat,
  meta,
  isBest,
  onOpenPlayer,
}: {
  player: any;
  x: number;
  y: number;
  displayRole: string;
  stat?: any;
  meta?: FanPlayerEventMeta;
  isBest: boolean;
  onOpenPlayer?: ((playerRegistrationId: string) => void) | undefined;
}) {
  const registration = one<any>(player.player_season_registrations);
  const person = one<any>(registration?.players);
  const name = person?.full_name ?? "Player";
  const registrationId =
    registration?.id ?? player.player_registration_id ?? null;
  const clickable = Boolean(onOpenPlayer && registrationId);
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onOpenPlayer!(registrationId)}
      className="absolute z-10 w-[72px] -translate-x-1/2 -translate-y-1/2 text-center outline-none transition enabled:hover:-translate-y-[54%] sm:w-[96px] lg:w-[118px]"
      style={{ left: `${x}%`, top: `${y}%` }}
      title={stat ? "View match stats" : "View player profile"}
    >
      <div className="relative mx-auto h-11 w-11 sm:h-14 sm:w-14">
        <div className="grid h-full w-full place-items-center overflow-hidden rounded-full border-[3px] border-white bg-white shadow-md">
          {person?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.avatar_url}
              alt={name}
              className="h-[118%] w-full rounded-full object-cover object-top"
            />
          ) : (
            <span className="grid h-full w-full place-items-center rounded-full bg-emerald-700 text-sm font-black text-white">
              {initials(name)}
            </span>
          )}
        </div>
        {stat ? (
          <span
            className={`absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-[11px] font-black text-white shadow ${fanLineupRatingBadgeClass(Number(stat.rating))}`}
          >
            {fanFormatRating(stat.rating)}
            {isBest ? (
              <Star size={10} className="ml-0.5 inline fill-current" />
            ) : null}
          </span>
        ) : null}
        {meta ? <FanLineupEventIcons meta={meta} overlay /> : null}
      </div>
      <div className="mt-1 flex items-center justify-center gap-1">
        {meta?.injured ? (
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white text-[12px] font-black leading-none text-red-600 shadow ring-1 ring-red-100">
            +
          </span>
        ) : null}
        {player.is_captain ? (
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white text-[10px] font-black lowercase text-slate-700 shadow">
            c
          </span>
        ) : null}
        <span className="truncate text-[13px] font-black text-white drop-shadow">
          {registration?.shirt_number ?? player.shirt_number ?? "-"} {name}
        </span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">
        {player.display_role ?? displayRole}
      </p>
    </button>
  );
}

function FanLineupSideNodes({
  lineup,
  side,
  statsByReg,
  eventMetaByPlayer,
  bestRatedPlayerId,
  onOpenPlayer,
}: {
  lineup: any;
  side: "HOME" | "AWAY";
  statsByReg: Map<string, any>;
  eventMetaByPlayer: Map<string, FanPlayerEventMeta>;
  bestRatedPlayerId: string | null;
  onOpenPlayer?: ((playerRegistrationId: string) => void) | undefined;
}) {
  const slots: any[] = lineup?.formation_slots ?? [];
  const playerBySlot = new Map<string, any>(
    (lineup?.lineup_players ?? [])
      .filter((player: any) => player.is_starter && player.slot_key)
      .map((player: any) => [player.slot_key as string, player]),
  );
  return (
    <>
      {slots.map((slot) => {
        const player = playerBySlot.get(slot.slotKey);
        if (!player) return null;
        const x = side === "HOME" ? (100 - slot.y) * 0.5 : 50 + slot.y * 0.5;
        const y = side === "HOME" ? slot.x : 100 - slot.x;
        const stat = statsByReg.get(player.player_registration_id);
        const meta = eventMetaByPlayer.get(player.player_registration_id);
        return (
          <FanMatchPlayerNode
            key={`${side}-${slot.slotKey}`}
            player={player}
            x={x}
            y={y}
            displayRole={slot.displayRole}
            {...(stat ? { stat } : {})}
            {...(meta ? { meta } : {})}
            isBest={player.player_registration_id === bestRatedPlayerId}
            onOpenPlayer={onOpenPlayer}
          />
        );
      })}
    </>
  );
}

function FanMatchBenchColumn({
  title,
  players,
  statsByReg,
  eventMetaByPlayer,
  bestRatedPlayerId,
  onOpenPlayer,
}: {
  title: string;
  players: any[];
  statsByReg: Map<string, any>;
  eventMetaByPlayer: Map<string, FanPlayerEventMeta>;
  bestRatedPlayerId: string | null;
  onOpenPlayer?: ((playerRegistrationId: string) => void) | undefined;
}) {
  return (
    <div className="rounded-2xl border border-slate-200">
      <h4 className="border-b border-slate-100 py-3 text-center text-sm font-black">
        {title}
      </h4>
      <div className="divide-y divide-slate-100">
        {players.length ? (
          players.map((player) => {
            const registration = one<any>(
              player.player_season_registrations,
            );
            const person = one<any>(registration?.players);
            const name = person?.full_name ?? "Player";
            const stat = statsByReg.get(player.player_registration_id);
            const meta = eventMetaByPlayer.get(player.player_registration_id);
            const registrationId =
              registration?.id ?? player.player_registration_id;
            const clickable = Boolean(onOpenPlayer && registrationId);
            return (
              <button
                key={player.id}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onOpenPlayer!(registrationId)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition enabled:hover:bg-slate-50"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-xs font-black text-indigo-700">
                  {person?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.avatar_url}
                      alt={name}
                      className="h-[118%] w-full object-cover object-top"
                    />
                  ) : (
                    initials(name)
                  )}
                </div>
                {stat ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-black text-white ${fanLineupRatingBadgeClass(Number(stat.rating))}`}
                  >
                    {fanFormatRating(stat.rating)}
                    {player.player_registration_id === bestRatedPlayerId ? (
                      <Star size={10} className="ml-0.5 inline fill-current" />
                    ) : null}
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{name}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    #{registration?.shirt_number ?? player.shirt_number ?? "-"}{" "}
                    ·{" "}
                    {registration?.football_position ??
                      player.football_position ??
                      player.player_natural_position ??
                      "POS"}
                  </p>
                </div>
                {meta ? <FanLineupEventIcons meta={meta} dark /> : null}
              </button>
            );
          })
        ) : (
          <p className="p-4 text-center text-sm font-semibold text-slate-500">
            No substitutes listed.
          </p>
        )}
      </div>
    </div>
  );
}

function MatchLineups({
  lineups,
  playerStats,
  events,
  substitutions,
  homeId,
  home,
  away,
  onOpenPlayer,
}: {
  lineups: any[];
  playerStats: any[];
  events: any[];
  substitutions: any[];
  homeId: string | null;
  home: TeamRef["teams"] | null | undefined;
  away: TeamRef["teams"] | null | undefined;
  onOpenPlayer?: ((playerRegistrationId: string) => void) | undefined;
}) {
  const statsByReg = useMemo(() => {
    const map = new Map<string, any>();
    for (const stat of playerStats) map.set(stat.player_registration_id, stat);
    return map;
  }, [playerStats]);
  const eventMetaByPlayer = useMemo(
    () => buildFanPlayerEventMeta(events, substitutions),
    [events, substitutions],
  );
  const bestRatedPlayerId =
    [...playerStats].sort(
      (left, right) => Number(right.rating ?? 0) - Number(left.rating ?? 0),
    )[0]?.player_registration_id ?? null;

  if (lineups.length === 0) {
    return <EmptyState label="No lineups were submitted for this match." />;
  }

  const homeLineup =
    lineups.find((l) => l.team_registration_id === homeId) ?? lineups[0];
  const awayLineup =
    lineups.find((l) => l.team_registration_id !== homeId) ?? lineups[1];
  const homeName = teamName(home);
  const awayName = teamName(away);
  const homeRating = averageFanLineupRating(homeLineup, statsByReg);
  const awayRating = averageFanLineupRating(awayLineup, statsByReg);
  const homeBench = (homeLineup?.lineup_players ?? []).filter(
    (player: any) => !player.is_starter,
  );
  const awayBench = (awayLineup?.lineup_players ?? []).filter(
    (player: any) => !player.is_starter,
  );

  return (
    <div className="overflow-hidden rounded-3xl bg-[#05a967] text-white shadow-xl">
      <div className="flex flex-col gap-3 bg-emerald-700/15 px-3 py-4 text-sm font-black sm:px-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs ${fanLineupRatingBadgeClass(homeRating)}`}
          >
            {homeRating ? fanFormatRating(homeRating) : "-"}
          </span>
          <FanTeamBadge name={homeName} logoUrl={home?.logo_url} />
          <span>{homeName}</span>
          <span>{homeLineup?.formation ?? "Formation N/A"}</span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <span>{awayLineup?.formation ?? "Formation N/A"}</span>
          <span>{awayName}</span>
          <FanTeamBadge name={awayName} logoUrl={away?.logo_url} />
          <span
            className={`rounded-full px-2.5 py-1 text-xs ${fanLineupRatingBadgeClass(awayRating)}`}
          >
            {awayRating ? fanFormatRating(awayRating) : "-"}
          </span>
        </div>
      </div>
      <div className="relative h-[560px] bg-[#06a766] sm:h-[620px]">
        <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-white/10" />
        <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-white/10" />
        <div className="absolute left-0 top-1/2 h-48 w-20 -translate-y-1/2 rounded-r-3xl border-y-[5px] border-r-[5px] border-white/10" />
        <div className="absolute right-0 top-1/2 h-48 w-20 -translate-y-1/2 rounded-l-3xl border-y-[5px] border-l-[5px] border-white/10" />
        <div className="absolute inset-y-0 left-1/4 w-1 bg-white/5" />
        <div className="absolute inset-y-0 right-1/4 w-1 bg-white/5" />
        <FanLineupSideNodes
          lineup={homeLineup}
          side="HOME"
          statsByReg={statsByReg}
          eventMetaByPlayer={eventMetaByPlayer}
          bestRatedPlayerId={bestRatedPlayerId}
          onOpenPlayer={onOpenPlayer}
        />
        <FanLineupSideNodes
          lineup={awayLineup}
          side="AWAY"
          statsByReg={statsByReg}
          eventMetaByPlayer={eventMetaByPlayer}
          bestRatedPlayerId={bestRatedPlayerId}
          onOpenPlayer={onOpenPlayer}
        />
      </div>
      <div className="grid gap-5 bg-white p-5 text-slate-950 lg:grid-cols-2">
        <FanMatchBenchColumn
          title={`${homeName} substitutes`}
          players={homeBench}
          statsByReg={statsByReg}
          eventMetaByPlayer={eventMetaByPlayer}
          bestRatedPlayerId={bestRatedPlayerId}
          onOpenPlayer={onOpenPlayer}
        />
        <FanMatchBenchColumn
          title={`${awayName} substitutes`}
          players={awayBench}
          statsByReg={statsByReg}
          eventMetaByPlayer={eventMetaByPlayer}
          bestRatedPlayerId={bestRatedPlayerId}
          onOpenPlayer={onOpenPlayer}
        />
      </div>
    </div>
  );
}

// Best-to-worst player ratings across the match, matching FotMob's combined
// "player ratings" list.
function MatchPlayerRatings({
  playerStats,
  onOpenPlayer,
}: {
  playerStats: any[];
  onOpenPlayer?: ((playerRegistrationId: string) => void) | undefined;
}) {
  if (playerStats.length === 0) {
    return <EmptyState label="No player ratings recorded for this match." />;
  }

  // Ordered best-to-worst across both teams, matching FotMob's combined ratings
  // list. Names still identify which club each player belongs to via their crest.
  const sorted = [...playerStats].sort(
    (a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0),
  );

  const row = (stat: any) => {
    const reg = one<any>(stat.player_season_registrations);
    const person = one<any>(reg?.players);
    const rating = stat.rating != null ? Number(stat.rating) : null;
    const registrationId = reg?.id ?? stat.player_registration_id;
    const clickable = Boolean(onOpenPlayer && registrationId);
    return (
      <button
        key={stat.id ?? registrationId}
        type="button"
        disabled={!clickable}
        onClick={() => clickable && onOpenPlayer!(registrationId)}
        className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left transition enabled:hover:bg-purple-50"
      >
        <span className="w-6 text-center text-xs font-black text-slate-400">
          {reg?.shirt_number ?? "-"}
        </span>
        <Avatar
          name={person?.full_name ?? "Player"}
          src={person?.avatar_url}
          small
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-900">
            {person?.full_name ?? "Player"}
          </p>
          <p className="truncate text-xs font-bold text-slate-500">
            {[
              stat.goals ? `${stat.goals} G` : null,
              stat.assists ? `${stat.assists} A` : null,
              stat.minutes != null ? `${stat.minutes}'` : null,
            ]
              .filter(Boolean)
              .join(" · ") ||
              String(reg?.football_position ?? "").replaceAll("_", " ")}
          </p>
        </div>
        {rating != null ? (
          <span
            className={`rounded-lg px-2 py-1 text-sm font-black text-white ${ratingTone(rating)}`}
          >
            {rating.toFixed(1)}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <Panel title="Player ratings">
      <div className="space-y-2">{sorted.map(row)}</div>
    </Panel>
  );
}

// Single-match player stat modal, matching the admin/manager experience. Opens
// when a fan clicks a player on the pitch, bench, or ratings list. Clicking the
// player's name jumps to their full season profile page.
function FanPlayerMatchStatModal({
  stat,
  role,
  onClose,
  onOpenProfile,
}: {
  stat: any;
  role?: string | null | undefined;
  onClose: () => void;
  onOpenProfile?: ((playerRegistrationId: string) => void) | undefined;
}) {
  const player = one<any>(stat.player_season_registrations);
  const person = one<any>(player?.players);
  const name = person?.full_name ?? "Player";
  const registrationId = player?.id ?? stat.player_registration_id;
  const position =
    role ??
    stat.position_played ??
    player?.football_position ??
    player?.position ??
    "POS";
  const isGoalkeeper = position === "GK";
  const defensiveContribution =
    Number(stat.tackles ?? 0) +
    Number(stat.interceptions ?? 0) +
    Number(stat.clearances ?? 0) +
    Number(stat.blocks ?? 0);
  const sections: Array<{ title: string; items: Array<[string, unknown]> }> =
    isGoalkeeper
      ? [
          {
            title: "Top stats",
            items: [
              ["Minutes played", stat.minutes],
              ["Rating", stat.rating],
              ["Saves", stat.saves],
              ["Goals conceded", stat.goals_conceded],
            ],
          },
          {
            title: "Distribution",
            items: [
              [
                "Accurate passes",
                `${fanStatValue(stat.accurate_passes)}/${fanStatValue(stat.passes)} (${fanPercentage(stat.accurate_passes, stat.passes)})`,
              ],
              ["Accurate long balls", stat.accurate_long_balls],
            ],
          },
          {
            title: "Goalkeeping",
            items: [
              ["Diving saves", stat.diving_saves],
              ["Saves inside box", stat.saves_inside_box],
              ["Clearances", stat.clearances],
            ],
          },
          {
            title: "Discipline",
            items: [
              ["Yellow cards", stat.yellow_cards],
              ["Red cards", stat.red_cards],
            ],
          },
        ]
      : [
          {
            title: "Top stats",
            items: [
              ["Minutes played", stat.minutes],
              ["Position played", position],
              ["Rating", stat.rating],
              ["Goals", stat.goals],
              ["Assists", stat.assists],
            ],
          },
          {
            title: "Attack",
            items: [
              ["Shots", stat.shots],
              ["Shots on target", stat.shots_on_target],
              ["Shot accuracy", fanPercentage(stat.shots_on_target, stat.shots)],
              ["Chances created", stat.chances_created],
              ["Big chances created", stat.big_chances_created],
              ["Big chances missed", stat.big_chances_missed],
            ],
          },
          {
            title: "Passing + dribbling",
            items: [
              ["Total passes", stat.passes],
              [
                "Accurate passes",
                `${fanStatValue(stat.accurate_passes)}/${fanStatValue(stat.passes)} (${fanPercentage(stat.accurate_passes, stat.passes)})`,
              ],
              ["Dribbles attempted", stat.dribbles_attempted],
              [
                "Successful dribbles",
                `${fanStatValue(stat.successful_dribbles)}/${fanStatValue(stat.dribbles_attempted)} (${fanPercentage(stat.successful_dribbles, stat.dribbles_attempted)})`,
              ],
              ["Dispossessed", stat.dispossessed],
            ],
          },
          {
            title: "Defense",
            items: [
              ["Defensive contribution", defensiveContribution],
              ["Tackles", stat.tackles],
              ["Interceptions", stat.interceptions],
              ["Clearances", stat.clearances],
              ["Blocks", stat.blocks],
              ["Dribbled past", stat.dribbled_past],
            ],
          },
          {
            title: "Discipline",
            items: [
              ["Fouls committed", stat.fouls_committed],
              ["Yellow cards", stat.yellow_cards],
              ["Red cards", stat.red_cards],
            ],
          },
        ];
  const ratingNumeric = stat.rating != null ? Number(stat.rating) : null;
  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-gradient-to-b from-emerald-200 to-white p-6">
          <div className="flex items-start justify-between gap-4">
            <span className="h-10 w-10" aria-hidden="true" />
            <div className="text-center">
              <div className="relative mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full border-4 border-white bg-white text-xl font-black text-indigo-700 shadow">
                {person?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={person.avatar_url}
                    alt={name}
                    className="h-[120%] w-full object-cover object-top"
                  />
                ) : (
                  initials(name)
                )}
              </div>
              {ratingNumeric != null ? (
                <span
                  className={`mx-auto -mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-black text-white shadow ${ratingTone(ratingNumeric)}`}
                >
                  {fanFormatRating(stat.rating)}
                </span>
              ) : null}
              <button
                type="button"
                disabled={!onOpenProfile || !registrationId}
                onClick={() =>
                  onOpenProfile && registrationId
                    ? onOpenProfile(registrationId)
                    : undefined
                }
                className="mt-2 block w-full text-lg font-black text-slate-900 outline-none enabled:hover:text-[var(--team-primary)] enabled:hover:underline"
                title="View full player profile"
              >
                {name}
              </button>
              <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-black">{position}</p>
                  <p className="text-slate-500">Position</p>
                </div>
                <div>
                  <p className="font-black">
                    {player?.shirt_number ? `#${player.shirt_number}` : "-"}
                  </p>
                  <p className="text-slate-500">Number</p>
                </div>
                <div>
                  <p className="font-black">{fanStatValue(stat.minutes)}</p>
                  <p className="text-slate-500">Minutes</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-xl font-black shadow transition hover:bg-white"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <div className="space-y-6 p-6">
          {sections.map((section) => (
            <section key={section.title}>
              <h4 className="mb-3 text-lg font-black">{section.title}</h4>
              <div className="divide-y divide-slate-100">
                {section.items.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 py-2.5 text-sm"
                  >
                    <span className="font-medium text-slate-700">{label}</span>
                    <span className="text-right font-black">
                      {label === "Rating"
                        ? fanFormatRating(value)
                        : fanStatValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {onOpenProfile && registrationId ? (
            <button
              type="button"
              onClick={() => onOpenProfile(registrationId)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-[var(--team-primary)] hover:text-[var(--team-primary)]"
            >
              View full player profile
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="sticky bottom-0 w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow transition hover:bg-emerald-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchStatsCompare({
  stats,
  fixture,
  home,
  away,
}: {
  stats: any[];
  fixture: FixtureRecord;
  home: string;
  away: string;
}) {
  const homeId = fixture.home_team_registration_id;
  const homeStat =
    stats.find((stat) => stat.team_registration_id === homeId) ?? stats[0];
  const awayStat =
    stats.find((stat) => stat.team_registration_id !== homeId) ?? stats[1];
  const rows: { label: string; key: string; bar?: boolean }[] = [
    { label: "Possession %", key: "possession", bar: true },
    { label: "Expected goals (xG)", key: "expected_goals" },
    { label: "Total shots", key: "shots" },
    { label: "Shots on target", key: "shots_on_target" },
    { label: "Big chances", key: "big_chances" },
    { label: "Passes", key: "passes" },
    { label: "Accurate passes", key: "accurate_passes" },
    { label: "Corners", key: "corners" },
    { label: "Offsides", key: "offsides" },
    { label: "Tackles", key: "tackles" },
    { label: "Interceptions", key: "interceptions" },
    { label: "Fouls", key: "fouls" },
    { label: "Yellow cards", key: "yellow_cards" },
    { label: "Red cards", key: "red_cards" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-black uppercase tracking-wide text-slate-500">
        <span className="truncate">{home}</span>
        <span className="truncate text-right">{away}</span>
      </div>
      {rows.map((row) => {
        const h = Number(homeStat?.[row.key] ?? 0);
        const a = Number(awayStat?.[row.key] ?? 0);
        const total = h + a;
        const homePct = total > 0 ? (h / total) * 100 : 50;
        const fmt = (value: number) =>
          row.key === "expected_goals" ? value.toFixed(2) : value;
        return (
          <div key={row.key}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="w-12 text-left font-black text-slate-900">
                {fmt(h)}
              </span>
              <span className="flex-1 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                {row.label}
              </span>
              <span className="w-12 text-right font-black text-slate-900">
                {fmt(a)}
              </span>
            </div>
            <div className="mt-1 flex h-1.5 gap-1 overflow-hidden rounded-full">
              <div
                className="rounded-full bg-[var(--team-primary)] transition-all"
                style={{ width: `${homePct}%` }}
              />
              <div className="flex-1 rounded-full bg-slate-300" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===========================================================================
// TEAM PROFILE VIEW
// ===========================================================================

interface TeamProfilePayload {
  team: {
    id: string;
    season_id: string;
    team_id: string;
    teams: TeamSummary | null;
    seasons?: any;
  };
  players: any[];
  fixtures: FixtureRecord[];
  standings: StandingRow[];
}

function TeamProfileView({
  teamRegistrationId,
  favorites,
  onBack,
  onOpenMatch,
  onOpenPlayer,
  onToggleFavorite,
}: {
  teamRegistrationId: string;
  favorites: Favorite[];
  onBack: () => void;
  onOpenMatch: (id: string) => void;
  onOpenPlayer: (id: string) => void;
  onToggleFavorite: (teamId: string, isFavorite: boolean) => Promise<void>;
}) {
  const [payload, setPayload] = useState<TeamProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"Overview" | "Squad" | "Fixtures">("Overview");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<TeamProfilePayload>(`/fan/teams/${teamRegistrationId}/profile`)
      .then((data) => {
        if (alive) setPayload(data);
      })
      .catch((err) => {
        if (alive)
          setError(err instanceof Error ? err.message : "Failed to load team");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [teamRegistrationId]);

  const standingGroups = useMemo(() => {
    const map = new Map<string, StandingRow[]>();
    (payload?.standings ?? []).forEach((row) => {
      const key = row.group_name ?? "";
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    });
    return Array.from(map.entries());
  }, [payload?.standings]);

  if (loading) return <LoadingState label="Loading team..." />;
  if (error) return <ErrorBanner text={error} />;
  if (!payload) return <EmptyState label="Team not found." />;

  const club = payload.team.teams;
  const clubId = club?.id ?? payload.team.team_id;
  const isFavorite = favorites.some((favorite) => favorite.team_id === clubId);
  const theme = themeFromTeam(club);

  return (
    <div className="space-y-6">
      <BackButton label="Back" onClick={onBack} />
      <section
        className="overflow-hidden rounded-3xl p-6 shadow-sm sm:p-8"
        style={{
          background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
          color: getReadableTextColor(theme.primary),
        }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={club?.name ?? "Team"} src={club?.logo_url} />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-black leading-tight sm:text-3xl">
              {club?.name ?? "Team"}
            </h1>
            <p className="mt-1 text-sm opacity-80">{club?.short_name ?? ""}</p>
          </div>
          <button
            className="flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-sm font-black backdrop-blur transition hover:bg-white/25 disabled:opacity-50"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onToggleFavorite(clubId, isFavorite);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Heart size={16} className={isFavorite ? "fill-current" : ""} />
            {isFavorite ? "Following" : "Follow"}
          </button>
        </div>
      </section>

      <Tabs
        tabs={["Overview", "Squad", "Fixtures"]}
        active={tab}
        onChange={(next) => setTab(next as typeof tab)}
      />

      {tab === "Overview" ? (
        payload.standings.length === 0 ? (
          <Panel title="Standings">
            <EmptyState label="No standings yet." />
          </Panel>
        ) : (
          standingGroups.map(([groupName, rows]) => (
            <Panel
              key={groupName || "table"}
              title={groupName ? `Group ${groupName}` : "Standings"}
            >
              <StandingsTable
                rows={rows}
                favoriteTeamIds={
                  new Set(favorites.map((favorite) => favorite.team_id))
                }
                onOpenTeam={() => undefined}
                highlightRegistrationId={payload.team.id}
              />
            </Panel>
          ))
        )
      ) : null}

      {tab === "Squad" ? (
        <Panel title="Squad">
          {payload.players.length === 0 ? (
            <EmptyState label="No squad players listed." />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {payload.players.map((player: any) => {
                const identity = one<any>(player.players);
                return (
                  <button
                    key={player.id}
                    className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:bg-purple-50"
                    onClick={() => onOpenPlayer(player.id)}
                  >
                    <span className="w-6 shrink-0 text-center font-black text-slate-400">
                      {player.shirt_number ?? "-"}
                    </span>
                    <Avatar
                      name={identity?.full_name ?? "Player"}
                      src={identity?.avatar_url}
                      small
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black text-slate-900">
                        {identity?.full_name ?? "Player"}
                      </span>
                      <span className="block truncate text-xs font-bold text-slate-500">
                        {player.football_position ?? player.position ?? ""}
                      </span>
                    </span>
                    {player.overall_rating ? (
                      <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-black text-slate-700">
                        {player.overall_rating}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "Fixtures" ? (
        <Panel title="Fixtures & results">
          {payload.fixtures.length === 0 ? (
            <EmptyState label="No fixtures scheduled." />
          ) : (
            <div className="grid gap-3">
              {payload.fixtures.map((fixture) => (
                <FixtureMini
                  key={fixture.id}
                  fixture={fixture}
                  onOpen={() => onOpenMatch(fixture.id)}
                  showScore={fixture.status === "FINAL"}
                />
              ))}
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

// ===========================================================================
// PLAYER PROFILE VIEW
// ===========================================================================

interface PlayerProfilePayload {
  player: any;
  overall_rating: number | null;
  league_rating: number | null;
  season_stats: Record<string, number | string | null> | null;
  stored_season_stats: any | null;
  match_stats: any[];
}

function PlayerProfileView({
  playerRegistrationId,
  onBack,
  onOpenTeam,
  onOpenMatch,
}: {
  playerRegistrationId: string;
  onBack: () => void;
  onOpenTeam: (id: string) => void;
  onOpenMatch?: ((matchId: string) => void) | undefined;
}) {
  const [payload, setPayload] = useState<PlayerProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Season stats");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<PlayerProfilePayload>(`/fan/players/${playerRegistrationId}/profile`)
      .then((data) => {
        if (alive) setPayload(data);
      })
      .catch((err) => {
        if (alive)
          setError(
            err instanceof Error ? err.message : "Failed to load player",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [playerRegistrationId]);

  if (loading) return <LoadingState label="Loading player..." />;
  if (error) return <ErrorBanner text={error} />;
  if (!payload) return <EmptyState label="Player not found." />;

  const player = payload.player;
  const identity = one<any>(player.players);
  const teamReg = one<any>(player.team_registrations);
  const club = one<any>(teamReg?.teams);
  const season = one<any>(player.seasons);
  const stats = payload.season_stats;
  const isGoalkeeper = (player.football_position ?? player.position) === "GK";

  return (
    <div className="space-y-6">
      <BackButton label="Back" onClick={onBack} />
      <section className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar
            name={identity?.full_name ?? "Player"}
            src={identity?.avatar_url}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-words text-2xl font-black leading-tight sm:text-3xl">
                {identity?.full_name ?? "Player"}
              </h1>
              {payload.overall_rating != null ? (
                <span className="inline-flex rounded-full bg-[var(--team-primary)] px-3 py-1 text-sm font-black text-[var(--team-primary-text)]">
                  OVR {payload.overall_rating}
                </span>
              ) : null}
              <RatingCapsule value={payload.league_rating} label="League" />
            </div>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {(player.football_position ?? player.position ?? "").toString()}
              {player.shirt_number ? ` · #${player.shirt_number}` : ""}
            </p>
            {club ? (
              <button
                className="mt-1 text-sm font-black text-[var(--team-primary)] hover:underline"
                onClick={() => teamReg?.id && onOpenTeam(teamReg.id)}
              >
                {club.name}
              </button>
            ) : null}
          </div>
        </div>
        {season ? (
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400">
            {one<any>(season.leagues)?.name ?? "League"} · {season.name}
          </p>
        ) : null}
      </section>

      <PlayerSeasonHighlights stats={stats} isGoalkeeper={isGoalkeeper} />

      <Tabs
        tabs={["Season stats", "Match by match"]}
        active={tab}
        onChange={setTab}
      />

      {tab === "Season stats" ? (
        <PlayerStatsBreakdown stats={stats} isGoalkeeper={isGoalkeeper} />
      ) : (
        <Panel title="Match by match">
          <PlayerMatchLog
            rows={payload.match_stats}
            playerTeamRegistrationId={player.team_registration_id}
            isGoalkeeper={isGoalkeeper}
            onOpenMatch={onOpenMatch}
          />
        </Panel>
      )}
    </div>
  );
}

// Headline cards shown above the tabs — the numbers fans scan for first.
function PlayerSeasonHighlights({
  stats,
  isGoalkeeper,
}: {
  stats: Record<string, number | string | null> | null;
  isGoalkeeper: boolean;
}) {
  const cards: { label: string; value: ReactNode }[] = isGoalkeeper
    ? [
        { label: "Appearances", value: fanStatValue(stats?.matches_played) },
        { label: "Clean sheets", value: fanStatValue(stats?.clean_sheets) },
        { label: "Saves", value: fanStatValue(stats?.saves) },
        { label: "Goals conceded", value: fanStatValue(stats?.goals_conceded) },
        { label: "Avg rating", value: fanFormatRating(stats?.average_rating) },
        { label: "Minutes", value: fanStatValue(stats?.minutes_played) },
      ]
    : [
        { label: "Appearances", value: fanStatValue(stats?.matches_played) },
        { label: "Goals", value: fanStatValue(stats?.goals) },
        { label: "Assists", value: fanStatValue(stats?.assists) },
        { label: "Avg rating", value: fanFormatRating(stats?.average_rating) },
        { label: "Minutes", value: fanStatValue(stats?.minutes_played) },
        {
          label: "Cards",
          value: `${fanStatValue(stats?.yellow_cards)}Y / ${fanStatValue(stats?.red_cards)}R`,
        },
      ];
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {card.label}
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// Full grouped season breakdown, position-aware, matching the manager view.
function PlayerStatsBreakdown({
  stats,
  isGoalkeeper,
}: {
  stats: Record<string, number | string | null> | null;
  isGoalkeeper: boolean;
}) {
  const sections: Array<{ title: string; items: Array<[string, string]> }> =
    isGoalkeeper
      ? [
          {
            title: "General",
            items: [
              ["Matches Played", "matches_played"],
              ["Starts", "starts"],
              ["Minutes Played", "minutes_played"],
              ["Average Rating", "average_rating"],
              ["Best Rating", "best_match_rating"],
              ["Lowest Rating", "lowest_match_rating"],
            ],
          },
          {
            title: "Goalkeeping",
            items: [
              ["Saves", "saves"],
              ["Diving Saves", "diving_saves"],
              ["Saves Inside Box", "saves_inside_box"],
              ["Goals Conceded", "goals_conceded"],
              ["Clean Sheets", "clean_sheets"],
            ],
          },
          {
            title: "Distribution",
            items: [
              ["Accurate Passes", "accurate_passes"],
              ["Accurate Long Balls", "accurate_long_balls"],
              ["Clearances", "clearances"],
            ],
          },
          {
            title: "Discipline",
            items: [
              ["Fouls Committed", "fouls_committed"],
              ["Yellow Cards", "yellow_cards"],
              ["Red Cards", "red_cards"],
            ],
          },
        ]
      : [
          {
            title: "General",
            items: [
              ["Matches Played", "matches_played"],
              ["Starts", "starts"],
              ["Minutes Played", "minutes_played"],
              ["Average Rating", "average_rating"],
              ["Best Rating", "best_match_rating"],
              ["Lowest Rating", "lowest_match_rating"],
            ],
          },
          {
            title: "Attack",
            items: [
              ["Goals", "goals"],
              ["Assists", "assists"],
              ["Shots", "shots"],
              ["Shots on Target", "shots_on_target"],
              ["Shot Accuracy", "shot_accuracy"],
              ["Chances Created", "chances_created"],
              ["Big Chances Created", "big_chances_created"],
              ["Big Chances Missed", "big_chances_missed"],
            ],
          },
          {
            title: "Passing + Dribbling",
            items: [
              ["Total Passes", "total_passes"],
              ["Accurate Passes", "accurate_passes"],
              ["Pass Accuracy", "pass_accuracy"],
              ["Dribbles Attempted", "dribbles_attempted"],
              ["Successful Dribbles", "successful_dribbles"],
              ["Dribble Success Rate", "dribble_success_rate"],
              ["Dispossessed", "dispossessed"],
            ],
          },
          {
            title: "Defense",
            items: [
              ["Tackles", "tackles"],
              ["Interceptions", "interceptions"],
              ["Clearances", "clearances"],
              ["Blocks", "blocks"],
            ],
          },
          {
            title: "Discipline",
            items: [
              ["Fouls Committed", "fouls_committed"],
              ["Yellow Cards", "yellow_cards"],
              ["Red Cards", "red_cards"],
            ],
          },
        ];

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <Panel key={section.title} title={section.title}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map(([label, key]) => {
              const isRating =
                key === "average_rating" ||
                key === "best_match_rating" ||
                key === "lowest_match_rating";
              return (
                <Detail
                  key={key}
                  label={label}
                  value={
                    isRating ? (
                      <RatingCapsule value={stats?.[key]} />
                    ) : (
                      fanFormatStat(stats, key)
                    )
                  }
                />
              );
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
}

// Match-by-match log. Confirmed rows only; each row links to the match detail.
function PlayerMatchLog({
  rows,
  playerTeamRegistrationId,
  isGoalkeeper,
  onOpenMatch,
}: {
  rows: any[];
  playerTeamRegistrationId: string | null | undefined;
  isGoalkeeper: boolean;
  onOpenMatch?: ((matchId: string) => void) | undefined;
}) {
  if (!rows?.length) {
    return <EmptyState label="No confirmed match stats yet." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            {[
              "Match",
              "Min",
              isGoalkeeper ? "Conceded" : "Goals",
              isGoalkeeper ? "Saves" : "Assists",
              "Pass %",
              "Cards",
              "Rating",
            ].map((head) => (
              <th key={head} className="px-3 py-2">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const fixture = one<any>(row.fixtures);
            const homeTeam = one<any>(fixture?.home_team);
            const awayTeam = one<any>(fixture?.away_team);
            const playerIsHome =
              fixture?.home_team_registration_id === playerTeamRegistrationId;
            const opponentTeam = playerIsHome ? awayTeam : homeTeam;
            const ownTeam = playerIsHome ? homeTeam : awayTeam;
            const homeName = homeTeam?.teams?.name ?? "Home";
            const awayName = awayTeam?.teams?.name ?? "Away";
            const matchName = fixture ? `${homeName} vs ${awayName}` : "Match";
            const final = fixture?.status === "FINAL";
            const score =
              final &&
              fixture?.home_score != null &&
              fixture?.away_score != null
                ? `${fixtureOutcomeScore(fixture)}${fixtureOutcomeLabel(fixture) ? ` · ${fixtureOutcomeLabel(fixture)}` : ""}`
                : (fixture?.status ?? "Scheduled");
            const clickable = Boolean(onOpenMatch && fixture?.id);
            return (
              <tr
                key={row.id ?? index}
                className={`border-t border-slate-100 ${clickable ? "cursor-pointer transition hover:bg-purple-50/60" : ""}`}
                onClick={() => clickable && onOpenMatch!(fixture.id)}
              >
                <td className="px-3 py-2">
                  <div className="flex min-w-[220px] items-center gap-3">
                    <Avatar
                      name={
                        opponentTeam?.teams?.name ??
                        ownTeam?.teams?.name ??
                        "Opponent"
                      }
                      src={
                        opponentTeam?.teams?.logo_url ??
                        ownTeam?.teams?.logo_url
                      }
                      small
                    />
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-900">
                        {matchName}
                      </p>
                      <p className="text-xs font-bold text-slate-500">
                        {fixture
                          ? `${formatDate(fixture.kickoff_at)} · ${score}`
                          : "Fixture unavailable"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  {fanStatValue(row.minutes ?? row.minutes_played)}
                </td>
                <td className="px-3 py-2">
                  {isGoalkeeper
                    ? fanStatValue(row.goals_conceded)
                    : fanStatValue(row.goals)}
                </td>
                <td className="px-3 py-2">
                  {isGoalkeeper
                    ? fanStatValue(row.saves)
                    : fanStatValue(row.assists)}
                </td>
                <td className="px-3 py-2">
                  {fanPercentage(
                    row.accurate_passes,
                    row.passes ?? row.total_passes,
                  )}
                </td>
                <td className="px-3 py-2">
                  {fanStatValue(row.yellow_cards)}Y /{" "}
                  {fanStatValue(row.red_cards)}R
                </td>
                <td className="px-3 py-2">
                  <RatingCapsule value={row.rating} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Small coloured rating pill shared by the season grid and match log.
function RatingCapsule({ value, label }: { value: unknown; label?: string }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-400">-</span>;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric))
    return <span className="text-slate-400">-</span>;
  const tone =
    numeric >= 8
      ? "bg-emerald-600"
      : numeric >= 7
        ? "bg-emerald-500"
        : numeric >= 6
          ? "bg-amber-500"
          : "bg-red-500";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-black text-white ${tone}`}
    >
      {label ? <span className="opacity-80">{label}</span> : null}
      {numeric.toFixed(1)}
    </span>
  );
}

function fanStatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "0";
  if (typeof value === "number" && Number.isFinite(value))
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

function fanFormatRating(value: unknown, fallback = "0.0") {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(1) : fallback;
}

function fanPercentage(numerator: unknown, denominator: unknown) {
  const top = Number(numerator ?? 0);
  const bottom = Number(denominator ?? 0);
  if (!bottom || !Number.isFinite(top) || !Number.isFinite(bottom)) return "0%";
  return `${Math.round((top / bottom) * 100)}%`;
}

// Formats a single season-stat field, deriving percentage fields from their
// numerator/denominator so they stay consistent with the raw counts.
function fanFormatStat(
  stats: Record<string, number | string | null> | null,
  key: string,
) {
  if (!stats) return "0";
  if (key === "shot_accuracy")
    return fanPercentage(stats.shots_on_target, stats.shots);
  if (key === "pass_accuracy")
    return fanPercentage(stats.accurate_passes, stats.total_passes);
  if (key === "dribble_success_rate")
    return fanPercentage(stats.successful_dribbles, stats.dribbles_attempted);
  return fanStatValue(stats[key]);
}

// ===========================================================================
// SHARED PRESENTATIONAL COMPONENTS
// ===========================================================================

function Avatar({
  name,
  src,
  small = false,
}: {
  name: string;
  src?: string | null | undefined;
  small?: boolean;
}) {
  const size = small ? "h-9 w-9 text-xs" : "h-12 w-12";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${size} shrink-0 rounded-2xl object-cover ring-2 ring-white`}
      />
    );
  }
  return (
    <div
      className={`${size} grid shrink-0 place-items-center rounded-2xl bg-[var(--team-primary)] font-black text-[var(--team-primary-text)]`}
    >
      {initials(name)}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="break-words text-3xl font-black leading-tight sm:text-4xl">
        {title}
      </h1>
      {subtitle ? <p className="mt-2 text-slate-600">{subtitle}</p> : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words font-bold text-slate-900">
        {value ?? "-"}
      </p>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
        active
          ? "bg-[var(--team-primary)] text-[var(--team-primary-text)]"
          : "bg-slate-50 text-slate-700 hover:bg-purple-50"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition ${
            active === tab
              ? "bg-[var(--team-primary)] text-[var(--team-primary-text)]"
              : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-[var(--team-primary)]"
          }`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function FixtureMini({
  fixture,
  onOpen,
  showScore = false,
}: {
  fixture: FixtureRecord;
  onOpen: () => void;
  showScore?: boolean;
}) {
  const home = fixture.home_team?.teams;
  const away = fixture.away_team?.teams;
  const final = fixture.status === "FINAL";
  return (
    <button
      className="w-full rounded-3xl bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
      onClick={onOpen}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <StageBadge stage={fixture.stage} />
        <span className="text-xs font-bold text-slate-500">
          {formatDate(fixture.kickoff_at)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar name={teamName(home)} src={home?.logo_url} small />
          <span className="truncate font-black text-slate-900">
            {teamName(home)}
          </span>
        </div>
        <span className="shrink-0 rounded-2xl bg-white px-4 py-2 text-center text-lg font-black text-slate-950 shadow-sm">
          <span className="block">
            {showScore && final ? (fixtureOutcomeScore(fixture) ?? "-") : "vs"}
          </span>
          {showScore && final && fixtureOutcomeLabel(fixture) ? (
            <span className="mt-0.5 block text-[10px] font-bold text-slate-500">
              {fixtureOutcomeLabel(fixture)}
            </span>
          ) : null}
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
          <span className="truncate font-black text-slate-900">
            {teamName(away)}
          </span>
          <Avatar name={teamName(away)} src={away?.logo_url} small />
        </div>
      </div>
    </button>
  );
}

function StandingsTable({
  rows,
  favoriteTeamIds,
  onOpenTeam,
  highlightRegistrationId,
}: {
  rows: StandingRow[];
  favoriteTeamIds: Set<string>;
  onOpenTeam: (id: string) => void;
  highlightRegistrationId?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {["#", "Team", "P", "W", "D", "L", "GD", "Pts"].map((head) => (
              <th key={head} className="px-4 py-3">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const team = row.team_registrations?.teams;
            const clubId = team?.id;
            const highlight =
              row.team_registration_id === highlightRegistrationId ||
              (clubId ? favoriteTeamIds.has(clubId) : false);
            return (
              <tr
                key={row.team_registration_id}
                className={`border-t ${highlight ? "bg-green-50" : "bg-white"}`}
              >
                <td className="px-4 py-3 font-bold">{row.position}</td>
                <td className="px-4 py-3">
                  <button
                    className="flex items-center gap-3 text-left transition hover:text-[var(--team-primary)] hover:underline"
                    onClick={() => onOpenTeam(row.team_registration_id)}
                  >
                    <Avatar name={teamName(team)} src={team?.logo_url} small />
                    <span className="truncate font-black text-slate-900">
                      {teamName(team)}
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3">{row.played}</td>
                <td className="px-4 py-3">{row.won}</td>
                <td className="px-4 py-3">{row.drawn}</td>
                <td className="px-4 py-3">{row.lost}</td>
                <td className="px-4 py-3">{row.goal_difference}</td>
                <td className="px-4 py-3 font-black text-[var(--team-primary)]">
                  {row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StageBadge({ stage }: { stage?: string | null }) {
  return (
    <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-violet-700 ring-1 ring-violet-200">
      {matchStageLabel(stage)}
    </span>
  );
}

function BackButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-[var(--team-primary)] hover:text-[var(--team-primary)]"
      onClick={onClick}
    >
      <ChevronRight size={16} className="rotate-180" />
      {label}
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500">
      {label}
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
      {text}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex items-center gap-3 rounded-3xl bg-white px-6 py-4 font-bold shadow-sm">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--team-primary)]" />
        {label}
      </div>
    </div>
  );
}

function OnboardingModal({
  onSkip,
  onPick,
}: {
  onSkip: () => void;
  onPick: (teamId: string) => Promise<void>;
}) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ seasons: Season[] }>("/fan/seasons")
      .then((data) => {
        setSeasons(data.seasons);
        setSeasonId(data.seasons[0]?.id ?? "");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      );
  }, []);

  useEffect(() => {
    if (!seasonId) return;
    api<{ teams: any[] }>(`/fan/seasons/${seasonId}/teams`)
      .then((data) => setTeams(data.teams))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load teams"),
      );
  }, [seasonId]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/50 p-4 backdrop-blur">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:rounded-[2rem] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">
              Pick your club
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Follow a team to personalise your dashboard. You can skip and
              choose later.
            </p>
          </div>
          <button
            aria-label="Skip"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800"
            onClick={onSkip}
          >
            <X size={18} />
          </button>
        </div>

        {error ? <ErrorBanner text={error} /> : null}

        <select
          aria-label="Season"
          className="manager-input mb-4"
          value={seasonId}
          onChange={(event) => setSeasonId(event.target.value)}
        >
          {seasons.length === 0 ? <option value="">No seasons</option> : null}
          {seasons.map((season) => {
            const league = one(season.leagues);
            return (
              <option key={season.id} value={season.id}>
                {league?.name ?? "League"} — {season.name}
              </option>
            );
          })}
        </select>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {teams.length === 0 ? (
            <EmptyState label="No teams available yet." />
          ) : (
            teams.map((team) => {
              const club = one<any>(team.teams);
              return (
                <button
                  key={team.id}
                  className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left transition hover:bg-purple-50 disabled:opacity-50"
                  disabled={busy === club?.id || !club?.id}
                  onClick={async () => {
                    if (!club?.id) return;
                    setBusy(club.id);
                    try {
                      await onPick(club.id);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Avatar
                    name={club?.name ?? "Team"}
                    src={club?.logo_url}
                    small
                  />
                  <span className="min-w-0 flex-1 truncate font-black text-slate-900">
                    {club?.name ?? "Team"}
                  </span>
                  <Heart size={16} className="shrink-0 text-slate-400" />
                </button>
              );
            })
          )}
        </div>

        <button
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          onClick={onSkip}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
