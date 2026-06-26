"use client";

import { CSSProperties, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Trophy,
  User,
  Users
} from "lucide-react";
import { FootballPosition, PreferredFoot, RegistrationStatus } from "@flms/shared";
import { api } from "@/lib/api";
import { clearAuth } from "@/lib/auth";

type Section =
  | "Dashboard"
  | "My Team"
  | "Players"
  | "Fixtures"
  | "Submit Lineup"
  | "Results"
  | "Standings"
  | "Messages"
  | "Profile & Settings";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at?: string;
}

interface League {
  id: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
  seasons?: Season[];
}

interface Season {
  id: string;
  name: string;
  season_year: number | null;
  format: string;
  phase?: string;
  max_players_per_team: number | null;
  lineup_size?: number | null;
  substitute_limit?: number | null;
  leagues?: League | League[] | null;
}

interface TeamRecord {
  id: string;
  season_id: string;
  team_id: string;
  manager_id: string;
  status: string;
  rejection_reason?: string | null;
  created_at: string;
  teams?: {
    id: string;
    name: string;
    short_name: string;
    logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    accent_color?: string | null;
  } | null;
  seasons?: Season | Season[] | null;
}

interface PlayerRecord {
  id: string;
  player_id: string;
  position: string;
  football_position?: FootballPosition | null;
  position_category?: string | null;
  shirt_number: number | null;
  status: string;
  preferred_foot?: PreferredFoot | null;
  player_status?: string | null;
  player_code?: string | null;
  identity_mode?: string | null;
  is_generated?: boolean | null;
  created_at: string;
  rejection_reason?: string | null;
  removal_reason?: string | null;
  suspension_reason?: string | null;
  players?: {
    full_name: string;
    date_of_birth?: string | null;
    id_type?: string | null;
    id_number_last4?: string | null;
    generated_identity_number?: string | null;
    avatar_url?: string | null;
  } | null;
}

type PositionBreakdown = Record<FootballPosition, number>;

interface SquadSummary {
  total: number;
  approved: number;
  pending: number;
  draft: number;
  rejected: number;
  removed: number;
  suspended: number;
  max_squad_size: number;
  remaining_slots: number;
  distribution?: {
    goalkeepers: number;
    defenders: number;
    midfielders: number;
    forwards: number;
  };
}

interface FixtureRecord {
  id: string;
  round_no: number;
  stage: string;
  kickoff_at: string | null;
  venue: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team_registration_id: string;
  away_team_registration_id: string;
  home_team?: { id: string; teams?: TeamRecord["teams"] } | null;
  away_team?: { id: string; teams?: TeamRecord["teams"] } | null;
  lineups?: Array<{ team_registration_id: string; status: string; formation: string }>;
}

interface StandingRecord {
  team_registration_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  team_registrations?: { id: string; teams?: TeamRecord["teams"] } | null;
}

interface MessageRecord {
  id: string;
  related_type: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

interface DashboardPayload {
  profile: Profile;
  active_team: TeamRecord | null;
  teams: TeamRecord[];
  squad_summary: SquadSummary | null;
  fixtures: FixtureRecord[];
  results: FixtureRecord[];
  standings: StandingRecord[];
  messages: MessageRecord[];
}

interface PlayerLeagueStatsPayload {
  season_stats: Record<string, number | string | null> | null;
  match_stats: Array<Record<string, number | string | null>>;
}

const menu: { label: Section; icon: ReactNode }[] = [
  { label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { label: "My Team", icon: <ShieldAlert size={18} /> },
  { label: "Players", icon: <Users size={18} /> },
  { label: "Fixtures", icon: <CalendarDays size={18} /> },
  { label: "Submit Lineup", icon: <Home size={18} /> },
  { label: "Results", icon: <Trophy size={18} /> },
  { label: "Standings", icon: <CheckCircle2 size={18} /> },
  { label: "Messages", icon: <Mail size={18} /> },
  { label: "Profile & Settings", icon: <User size={18} /> }
];

const positions = [
  FootballPosition.GK,
  FootballPosition.CB,
  FootballPosition.LB,
  FootballPosition.RB,
  FootballPosition.DM,
  FootballPosition.CM,
  FootballPosition.AM,
  FootballPosition.LW,
  FootballPosition.RW,
  FootballPosition.ST
];

const teamColorPalette = [
  "#111827", "#1F2937", "#374151", "#4B5563", "#6B7280",
  "#0F172A", "#1E293B", "#334155", "#475569", "#64748B",
  "#581C87", "#6D28D9", "#7E22CE", "#9333EA", "#A855F7",
  "#1E3A8A", "#1D4ED8", "#2563EB", "#3B82F6", "#60A5FA",
  "#164E63", "#0891B2", "#06B6D4", "#22D3EE", "#67E8F9",
  "#064E3B", "#047857", "#059669", "#10B981", "#34D399",
  "#14532D", "#15803D", "#16A34A", "#22C55E", "#4ADE80",
  "#713F12", "#B45309", "#D97706", "#F59E0B", "#FBBF24",
  "#7C2D12", "#C2410C", "#EA580C", "#F97316", "#FB923C",
  "#7F1D1D", "#B91C1C", "#DC2626", "#EF4444", "#F87171",
  "#831843", "#BE185D", "#DB2777", "#EC4899", "#F472B6"
];

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function statusClass(status?: string | null) {
  if (status === "APPROVED" || status === "ACTIVE" || status === "CONFIRMED") return "bg-green-50 text-green-700 ring-green-200";
  if (status === "PENDING" || status === "SUBMITTED") return "bg-yellow-50 text-yellow-700 ring-yellow-200";
  if (status === "DRAFT") return "bg-slate-100 text-slate-700 ring-slate-200";
  if (status === "REJECTED" || status === "REMOVED" || status === "SUSPENDED" || status === "KICKED_OUT") {
    return "bg-red-50 text-red-700 ring-red-200";
  }
  return "bg-purple-50 text-purple-700 ring-purple-200";
}

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function initials(name?: string | null) {
  return (name ?? "NA")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function opponentName(fixture: FixtureRecord, activeTeamId?: string) {
  const opponent = fixture.home_team_registration_id === activeTeamId ? fixture.away_team : fixture.home_team;
  return opponent?.teams?.name ?? "Opponent pending";
}

function matchLabel(fixture: FixtureRecord) {
  return `${fixture.home_team?.teams?.name ?? "Home"} vs ${fixture.away_team?.teams?.name ?? "Away"}`;
}

export default function ManagerDashboardPage() {
  const [section, setSection] = useState<Section>(() => sectionFromPath());
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teamDetail, setTeamDetail] = useState<{ players: PlayerRecord[]; squad_summary: SquadSummary } | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRecord | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);

  async function load() {
    setLoading(true);
    setMessage("");
    const [dashboard, leagueData] = await Promise.all([
      api<DashboardPayload>("/manager/dashboard"),
      api<{ leagues: League[] }>("/manager/leagues")
    ]);
    setPayload(dashboard);
    setLeagues(leagueData.leagues);
    const activeId = selectedTeamId || dashboard.active_team?.id || "";
    setSelectedTeamId(activeId);
    if (activeId) {
      const detail = await api<{ players: PlayerRecord[]; squad_summary: SquadSummary }>(`/manager/teams/${activeId}`);
      setTeamDetail({ players: detail.players, squad_summary: detail.squad_summary });
    } else {
      setTeamDetail(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Failed to load manager panel");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeTeam(teamId: string) {
    setSelectedTeamId(teamId);
    if (!teamId) return setTeamDetail(null);
    const detail = await api<{ players: PlayerRecord[]; squad_summary: SquadSummary }>(`/manager/teams/${teamId}`);
    setTeamDetail({ players: detail.players, squad_summary: detail.squad_summary });
  }

  const activeTeam = useMemo(() => {
    return payload?.teams.find((team) => team.id === selectedTeamId) ?? payload?.active_team ?? null;
  }, [payload, selectedTeamId]);

  const activeSeason = one(activeTeam?.seasons);
  const activeLeague = one(activeSeason?.leagues);
  const unreadMessages = payload?.messages.filter((item) => !item.read_at).length ?? 0;
  const teamPrimary = activeTeam?.teams?.primary_color || "#6D28D9";
  const teamSecondary = activeTeam?.teams?.secondary_color || "#111827";
  const teamAccent = activeTeam?.teams?.accent_color || "#F59E0B";
  const teamText = getReadableTextColor(teamPrimary);

  return (
    <div
      className="min-h-screen bg-[#F8FAFC] text-slate-950"
      style={
        {
          "--team-primary": teamPrimary,
          "--team-secondary": teamSecondary,
          "--team-accent": teamAccent,
          "--team-primary-text": teamText
        } as CSSProperties
      }
    >
      <ManagerSidebar
        profile={payload?.profile ?? null}
        activeTeam={activeTeam}
        section={section}
        unreadMessages={unreadMessages}
        onSection={setSection}
      />
      <main className="min-h-screen lg:pl-72">
        <ManagerTopbar
          profile={payload?.profile ?? null}
          teams={payload?.teams ?? []}
          activeTeamId={selectedTeamId}
          activeLeague={activeLeague}
          activeSeason={activeSeason}
          unreadMessages={unreadMessages}
          onTeamChange={(teamId) => void changeTeam(teamId).catch((error) => setMessage(error.message))}
        />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {message ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div> : null}
          {loading ? (
            <LoadingState label="Loading manager dashboard..." />
          ) : (
            <SectionView
              section={section}
              profile={payload?.profile ?? null}
              leagues={leagues}
              activeTeam={activeTeam}
              activeSeason={activeSeason}
              activeLeague={activeLeague}
              summary={teamDetail?.squad_summary ?? payload?.squad_summary ?? null}
              players={teamDetail?.players ?? []}
              fixtures={payload?.fixtures ?? []}
              results={payload?.results ?? []}
              standings={payload?.standings ?? []}
              messages={payload?.messages ?? []}
              onRefresh={() => void load().catch((error) => setMessage(error.message))}
              onCreateTeam={() => void load().catch((error) => setMessage(error.message))}
              onGenerate={() => setGenerateOpen(true)}
              onPlayerClick={setSelectedPlayer}
            />
          )}
        </div>
      </main>

      {generateOpen && activeTeam && (
        <GenerateSquadModal
          team={activeTeam}
          summary={teamDetail?.squad_summary ?? payload?.squad_summary ?? null}
          onClose={() => setGenerateOpen(false)}
          onPlayerClick={setSelectedPlayer}
          onGenerated={() => {
            setGenerateOpen(false);
            void load().catch((error) => setMessage(error.message));
          }}
        />
      )}
      {selectedPlayer ? (
        <PlayerDetailModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          onDeleted={() => {
            setSelectedPlayer(null);
            void load().catch((error) => setMessage(error.message));
          }}
        />
      ) : null}
    </div>
  );
}

function sectionFromPath(): Section {
  if (typeof window === "undefined") return "Dashboard";
  const path = window.location.pathname;
  if (path.includes("/my-team")) return "My Team";
  if (path.includes("/players")) return "Players";
  if (path.includes("/fixtures")) return "Fixtures";
  if (path.includes("/submit-lineup")) return "Submit Lineup";
  if (path.includes("/results")) return "Results";
  if (path.includes("/standings")) return "Standings";
  if (path.includes("/messages")) return "Messages";
  if (path.includes("/profile")) return "Profile & Settings";
  return "Dashboard";
}

function ManagerSidebar({
  profile,
  activeTeam,
  section,
  unreadMessages,
  onSection
}: {
  profile: Profile | null;
  activeTeam: TeamRecord | null;
  section: Section;
  unreadMessages: number;
  onSection: (section: Section) => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-[var(--team-secondary)] text-white shadow-2xl lg:flex">
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-6">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--team-primary)]">
          <Trophy size={22} />
        </div>
        <div>
          <p className="text-lg font-black tracking-wide">Scoreline</p>
          <p className="text-xs uppercase tracking-[0.3em] text-purple-200">Manager</p>
        </div>
      </div>
      <div className="mx-4 mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={profile?.full_name ?? profile?.email ?? "Manager"} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{profile?.full_name ?? "Manager"}</p>
            <p className="truncate text-xs text-slate-300">{activeTeam?.teams?.name ?? "No team selected"}</p>
          </div>
        </div>
      </div>
      <nav className="mt-5 flex-1 space-y-1 px-4">
        {menu.map((item) => (
          <button
            key={item.label}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-all duration-200 ${
              section === item.label ? "bg-[var(--team-primary)] text-[var(--team-primary-text)] shadow-lg shadow-purple-950/30" : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
            onClick={() => onSection(item.label)}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.label === "Messages" && unreadMessages > 0 ? (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{unreadMessages}</span>
            ) : null}
          </button>
        ))}
      </nav>
      <button
        className="m-4 flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
        onClick={() => {
          clearAuth();
          window.location.href = "/login";
        }}
      >
        <LogOut size={18} />
        Logout
      </button>
    </aside>
  );
}

function ManagerTopbar({
  profile,
  teams,
  activeTeamId,
  activeLeague,
  activeSeason,
  unreadMessages,
  onTeamChange
}: {
  profile: Profile | null;
  teams: TeamRecord[];
  activeTeamId: string;
  activeLeague: League | null;
  activeSeason: Season | null;
  unreadMessages: number;
  onTeamChange: (teamId: string) => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-[var(--team-primary)] focus:ring-4 focus:ring-purple-100"
            value={activeTeamId}
            onChange={(event) => onTeamChange(event.target.value)}
          >
            {teams.length === 0 ? <option value="">No team yet</option> : null}
            {teams.map((team) => {
              const season = one(team.seasons);
              const league = one(season?.leagues);
              return (
                <option key={team.id} value={team.id}>
                  {league?.name ?? "League"} - {season?.name ?? "Season"} / {team.teams?.name ?? "Team"}
                </option>
              );
            })}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {activeLeague?.name ?? "Select a league"} · {activeSeason?.name ?? "No season selected"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative rounded-full bg-slate-100 p-3 text-slate-700">
            <Bell size={18} />
            {unreadMessages > 0 ? <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{unreadMessages}</span> : null}
          </div>
          <Avatar name={profile?.full_name ?? profile?.email ?? "Manager"} />
        </div>
      </div>
    </header>
  );
}

function SectionView(props: {
  section: Section;
  profile: Profile | null;
  leagues: League[];
  activeTeam: TeamRecord | null;
  activeSeason: Season | null;
  activeLeague: League | null;
  summary: SquadSummary | null;
  players: PlayerRecord[];
  fixtures: FixtureRecord[];
  results: FixtureRecord[];
  standings: StandingRecord[];
  messages: MessageRecord[];
  onRefresh: () => void;
  onCreateTeam: () => void;
  onGenerate: () => void;
  onPlayerClick: (player: PlayerRecord) => void;
}) {
  if (!props.activeTeam && props.section !== "Profile & Settings") {
    return <CreateTeamEmpty leagues={props.leagues} onCreated={props.onCreateTeam} />;
  }
  if (props.section === "Dashboard") return <DashboardSection {...props} />;
  if (props.section === "My Team") return <MyTeamSection {...props} />;
  if (props.section === "Players") return <PlayersSection {...props} />;
  if (props.section === "Fixtures") return <FixturesSection {...props} />;
  if (props.section === "Submit Lineup") return <SubmitLineupSection {...props} />;
  if (props.section === "Results") return <ResultsSection {...props} />;
  if (props.section === "Standings") return <StandingsSection {...props} />;
  if (props.section === "Messages") return <MessagesSection {...props} />;
  return <ProfileSection profile={props.profile} />;
}

function DashboardSection({
  profile,
  activeTeam,
  activeLeague,
  activeSeason,
  summary,
  fixtures,
  results,
  messages,
  onGenerate
}: Parameters<typeof SectionView>[0]) {
  const nextMatch = fixtures.find((fixture) => fixture.status !== "FINAL");
  const latestResult = results[0];
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--team-primary)]">Manager Dashboard</p>
        <h1 className="mt-2 text-4xl font-black">Welcome back, {profile?.full_name ?? "Manager"}</h1>
        <p className="mt-2 text-slate-600">
          Team: <b>{activeTeam?.teams?.name}</b> · League: <b>{activeLeague?.name}</b> · Season: <b>{activeSeason?.name}</b>
        </p>
      </div>
      <TeamHero team={activeTeam} season={activeSeason} league={activeLeague} summary={summary} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard label="Team Status" value={activeTeam?.status ?? "-"} color="purple" />
        <DashboardCard label="Approved Players" value={summary?.approved ?? 0} color="green" />
        <DashboardCard label="Pending Players" value={summary?.pending ?? 0} color="yellow" />
        <DashboardCard label="Remaining Slots" value={summary?.remaining_slots ?? 0} color="slate" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Upcoming Fixture">
          {nextMatch ? <FixtureMini fixture={nextMatch} activeTeamId={activeTeam?.id} /> : <EmptyState label="No fixtures yet. Fixtures will appear after admin generates them." />}
        </Panel>
        <Panel title="Latest Result">
          {latestResult ? <FixtureMini fixture={latestResult} activeTeamId={activeTeam?.id} /> : <EmptyState label="No results yet. Results will appear after matches are confirmed." />}
        </Panel>
        <Panel title="Admin Messages">
          {messages.length ? (
            <div className="space-y-3">
              {messages.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                  <p className="font-semibold">{item.related_type.replaceAll("_", " ")}</p>
                  <p className="mt-1 line-clamp-2 text-slate-600">{item.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No messages yet." />
          )}
        </Panel>
      </div>
      <Panel title="Quick Actions">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ActionButton label="Open My Team" />
          <ActionButton label="Generate Squad" onClick={onGenerate} />
          <ActionButton label="Add Player" />
          <ActionButton label="Submit Lineup" />
          <ActionButton label="View Fixtures" />
        </div>
      </Panel>
    </div>
  );
}

function MyTeamSection({ activeTeam, activeSeason, activeLeague, summary, onGenerate, onRefresh }: Parameters<typeof SectionView>[0]) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const canEditTeam = activeTeam?.status === RegistrationStatus.DRAFT || activeTeam?.status === RegistrationStatus.PENDING;
  return (
    <div className="space-y-6">
      <PageTitle title="My Team" subtitle="Team profile, admin status, and squad capacity." />
      <TeamHero team={activeTeam} season={activeSeason} league={activeLeague} summary={summary} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Team Profile">
          <Detail label="Team Name" value={activeTeam?.teams?.name} />
          <Detail label="Team Short Name" value={activeTeam?.teams?.short_name} />
          <Detail label="Logo URL" value={activeTeam?.teams?.logo_url || "Not set"} />
          <Detail label="Primary Color" value={activeTeam?.teams?.primary_color || "#6D28D9"} />
          <Detail label="Secondary Color" value={activeTeam?.teams?.secondary_color || "#0B1626"} />
          <Detail label="Accent Color" value={activeTeam?.teams?.accent_color || "#16A34A"} />
          <Detail label="Registered Date" value={activeTeam?.created_at ? formatDate(activeTeam.created_at) : "-"} />
          <Detail label="Team Status" value={activeTeam?.status} />
          {canEditTeam ? (
            <button className="mt-5 rounded-2xl border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-bold text-[var(--team-primary)] transition hover:-translate-y-0.5 hover:bg-purple-100" onClick={() => setSettingsOpen(true)}>
              Team Settings
            </button>
          ) : null}
        </Panel>
        <Panel title="Squad Summary">
          <StatGrid summary={summary} />
          <button className="mt-5 rounded-2xl bg-[var(--team-primary)] px-5 py-3 text-sm font-bold text-[var(--team-primary-text)] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-200" onClick={onGenerate}>
            Generate Squad
          </button>
        </Panel>
      </div>
      {activeTeam?.rejection_reason ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{activeTeam.rejection_reason}</div> : null}
      {settingsOpen && activeTeam ? (
        <TeamSettingsModal
          team={activeTeam}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

function PlayersSection({ players, summary, onGenerate, onPlayerClick, activeTeam, onRefresh }: Parameters<typeof SectionView>[0]) {
  const [tab, setTab] = useState("ALL");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<PlayerRecord | null>(null);
  const statusFiltered = tab === "ALL" ? players : players.filter((player) => player.status === tab || player.player_status === tab);
  const positionFiltered =
    positionFilter === "ALL" ? statusFiltered : statusFiltered.filter((player) => (player.position_category ?? "").toUpperCase() === positionFilter);
  const filtered = positionFiltered.filter((player) => {
    const text = `${player.players?.full_name ?? ""} ${player.player_code ?? ""} ${player.shirt_number ?? ""}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });
  async function submitAll() {
    const ids = players.filter((player) => player.status === RegistrationStatus.DRAFT).map((player) => player.id);
    if (!activeTeam || ids.length === 0) return;
    await api(`/manager/teams/${activeTeam.id}/submit-players`, { method: "POST", body: JSON.stringify({ playerIds: ids }) });
    onRefresh();
  }
  async function removePlayer(player: PlayerRecord) {
    await api(`/manager/players/${player.id}`, { method: "DELETE" });
    onRefresh();
  }
  return (
    <div className="space-y-6">
      <PageTitle title="Players" subtitle="Players for this team. Draft and Pending players can be edited until admin approval." />
      <div className="flex flex-wrap gap-3">
        <button className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 text-sm font-bold text-[var(--team-primary-text)] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-200" onClick={onGenerate}>
          Generate Squad
        </button>
        <button className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-[var(--team-primary)] hover:text-[var(--team-primary)]">
          Add Player
        </button>
        <button className="rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-bold text-green-700 transition hover:bg-green-100" onClick={() => void submitAll()}>
          Submit Draft Players
        </button>
      </div>
      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto]">
        <input
          className="manager-input"
          placeholder="Search by player name, code, or jersey number"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[var(--team-primary)]">
          Search
        </button>
      </div>
      <Tabs values={["ALL", "GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"]} value={positionFilter} onChange={setPositionFilter} />
      <Tabs values={["ALL", "DRAFT", "PENDING", "APPROVED", "REJECTED", "REMOVED", "SUSPENDED"]} value={tab} onChange={setTab} />
      <PlayerTable
        players={filtered}
        onPlayerClick={onPlayerClick}
        onEdit={setEditing}
        onRemove={(player) => void removePlayer(player)}
        emptyLabel={summary?.total ? "No players match this filter." : "No players yet. Click Generate Squad to create your squad."}
      />
      {editing ? (
        <EditDraftPlayerModal
          player={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

function FixturesSection({ fixtures, activeTeam }: Parameters<typeof SectionView>[0]) {
  return (
    <div className="space-y-6">
      <PageTitle title="Fixtures" subtitle="Upcoming and scheduled matches for your selected team." />
      <FixtureTable fixtures={fixtures.filter((fixture) => fixture.status !== "FINAL")} activeTeamId={activeTeam?.id} emptyLabel="No fixtures yet. Fixtures will appear after admin generates them." />
    </div>
  );
}

function SubmitLineupSection({ fixtures, players, activeTeam, onPlayerClick }: Parameters<typeof SectionView>[0]) {
  const approved = players.filter((player) => player.status === RegistrationStatus.APPROVED && player.player_status === "ACTIVE");
  const nextMatch = fixtures.find((fixture) => fixture.status !== "FINAL");
  return (
    <div className="space-y-6">
      <PageTitle title="Submit Lineup" subtitle="Only approved, active players can be selected. Full visual lineup submission will use these real records." />
      {!nextMatch ? <EmptyState label="No upcoming fixture is available for lineup submission." /> : null}
      {nextMatch ? (
        <Panel title={`Lineup for ${opponentName(nextMatch, activeTeam?.id)}`}>
          <div className="mb-4 rounded-2xl bg-purple-50 p-4 text-sm text-purple-800">
            Fixture: {formatDate(nextMatch.kickoff_at)} · Venue: {nextMatch.venue ?? "TBA"}
          </div>
          {approved.length < 11 ? (
            <EmptyState label="You need at least 11 approved active players before submitting a lineup." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="rounded-3xl bg-gradient-to-b from-green-500 to-green-700 p-6 text-white">
                <p className="mb-4 font-bold">Pitch Preview</p>
                <div className="grid grid-cols-4 gap-3">
                  {approved.slice(0, 11).map((player) => (
                    <button key={player.id} className="rounded-2xl bg-white/15 p-3 text-center text-xs backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/25" onClick={() => onPlayerClick(player)}>
                      <Avatar name={player.players?.full_name ?? "Player"} small />
                      <p className="mt-2 font-bold">#{player.shirt_number}</p>
                      <p className="truncate">{player.players?.full_name}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="font-bold">Available Players</p>
                <div className="mt-3 max-h-96 space-y-2 overflow-auto">
                  {approved.map((player) => (
                    <button key={player.id} className="flex w-full items-center justify-between rounded-2xl bg-slate-50 p-3 text-left text-sm transition hover:bg-purple-50" onClick={() => onPlayerClick(player)}>
                      <span>{player.players?.full_name}</span>
                      <span className="font-bold text-[var(--team-primary)]">{player.football_position ?? player.position}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function ResultsSection({ results, activeTeam }: Parameters<typeof SectionView>[0]) {
  return (
    <div className="space-y-6">
      <PageTitle title="Results" subtitle="Confirmed results only. Manager cannot edit result or stats." />
      <FixtureTable fixtures={results} activeTeamId={activeTeam?.id} emptyLabel="No results yet. Results will appear after matches are confirmed." />
    </div>
  );
}

function StandingsSection({ standings, activeTeam }: Parameters<typeof SectionView>[0]) {
  return (
    <div className="space-y-6">
      <PageTitle title="Standings" subtitle="League table for the selected season." />
      <Panel title="Table">
        {standings.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {["Rank", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((head) => (
                    <th key={head} className="px-4 py-3">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standings.map((row, index) => (
                  <tr key={row.team_registration_id} className={`border-t ${row.team_registration_id === activeTeam?.id ? "bg-purple-50" : "bg-white"}`}>
                    <td className="px-4 py-3 font-bold">{index + 1}</td>
                    <td className="px-4 py-3 font-semibold">{row.team_registrations?.teams?.name ?? "Team"}</td>
                    <td className="px-4 py-3">{row.played}</td>
                    <td className="px-4 py-3">{row.won}</td>
                    <td className="px-4 py-3">{row.drawn}</td>
                    <td className="px-4 py-3">{row.lost}</td>
                    <td className="px-4 py-3">{row.goals_for}</td>
                    <td className="px-4 py-3">{row.goals_against}</td>
                    <td className="px-4 py-3">{row.goal_difference}</td>
                    <td className="px-4 py-3 font-black text-[var(--team-primary)]">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No standings yet." />
        )}
      </Panel>
    </div>
  );
}

function MessagesSection({ messages }: Parameters<typeof SectionView>[0]) {
  const [selected, setSelected] = useState<MessageRecord | null>(messages[0] ?? null);
  return (
    <div className="space-y-6">
      <PageTitle title="Messages" subtitle="Admin notices for teams, players, lineups, and matches." />
      {messages.length === 0 ? <EmptyState label="No messages yet." /> : null}
      {messages.length ? (
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <Panel title="Inbox">
            <div className="space-y-2">
              {messages.map((item) => (
                <button key={item.id} className={`w-full rounded-2xl p-3 text-left text-sm transition hover:bg-purple-50 ${selected?.id === item.id ? "bg-purple-50" : "bg-slate-50"}`} onClick={() => setSelected(item)}>
                  <p className="font-bold">{item.related_type.replaceAll("_", " ")}</p>
                  <p className="mt-1 truncate text-slate-500">{item.message}</p>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Message Detail">
            <p className="text-sm text-slate-500">{selected ? formatDate(selected.created_at) : ""}</p>
            <p className="mt-4 leading-7 text-slate-700">{selected?.message}</p>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function ProfileSection({ profile }: { profile: Profile | null }) {
  return (
    <div className="space-y-6">
      <PageTitle title="Profile & Settings" subtitle="Manager account information." />
      <Panel title="Profile">
        <Detail label="Full Name" value={profile?.full_name ?? "Manager"} />
        <Detail label="Email" value={profile?.email} />
        <Detail label="Role" value="Manager" />
        <Detail label="Joined On" value={profile?.created_at ? formatDate(profile.created_at) : "-"} />
      </Panel>
    </div>
  );
}

function CreateTeamEmpty({ leagues, onCreated }: { leagues: League[]; onCreated: () => void }) {
  const seasons = leagues.flatMap((league) => (league.seasons ?? []).map((season) => ({ ...season, league })));
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6D28D9");
  const [secondaryColor, setSecondaryColor] = useState("#111827");
  const [accentColor, setAccentColor] = useState("#F59E0B");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/manager/teams", {
        method: "POST",
        body: JSON.stringify({
          season_id: seasonId,
          name,
          short_name: shortName,
          logo_url: logoUrl || undefined,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor
        })
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Panel title="Create/Register Team">
        <p className="mb-5 text-slate-600">No team created yet. Create a team to get started. The team will be stored in the database.</p>
        {seasons.length === 0 ? <EmptyState label="No leagues/seasons are open yet. Ask admin to create a league and season first." /> : null}
        <form className="space-y-4" onSubmit={submit}>
          <select className="manager-input" value={seasonId} onChange={(event) => setSeasonId(event.target.value)} required>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.league.name} - {season.name}
              </option>
            ))}
          </select>
          <input className="manager-input" placeholder="Team name" value={name} onChange={(event) => setName(event.target.value)} required />
          <input className="manager-input" placeholder="Team short name" value={shortName} onChange={(event) => setShortName(event.target.value)} required />
          <input className="manager-input" placeholder="Team logo URL (optional)" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} />
          <div className="grid gap-3 md:grid-cols-3">
            <ColorField label="Primary Color" value={primaryColor} onChange={setPrimaryColor} />
            <ColorField label="Secondary Color" value={secondaryColor} onChange={setSecondaryColor} />
            <ColorField label="Accent Color" value={accentColor} onChange={setAccentColor} />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button disabled={saving || seasons.length === 0} className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 font-bold text-[var(--team-primary-text)] transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50">
            {saving ? "Saving..." : "Create Team"}
          </button>
        </form>
      </Panel>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="text-sm font-bold text-slate-700">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-500">{value.toUpperCase()}</span>
      </div>
      <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-3">
          <input className="h-11 w-11 shrink-0 cursor-pointer rounded-xl border-0 bg-transparent p-0" type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
          <div className="grid flex-1 grid-cols-10 gap-1.5">
            {teamColorPalette.map((color) => (
              <button
                key={`${label}-${color}`}
                type="button"
                className={`h-6 rounded-md border transition hover:scale-110 ${value.toLowerCase() === color.toLowerCase() ? "border-slate-950 ring-2 ring-slate-300" : "border-white"}`}
                style={{ backgroundColor: color }}
                onClick={() => onChange(color)}
                title={color}
                aria-label={`${label} ${color}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamSettingsModal({ team, onClose, onSaved }: { team: TeamRecord; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(team.teams?.name ?? "");
  const [shortName, setShortName] = useState(team.teams?.short_name ?? "");
  const [logoUrl, setLogoUrl] = useState(team.teams?.logo_url ?? "");
  const [primaryColor, setPrimaryColor] = useState(team.teams?.primary_color ?? "#6D28D9");
  const [secondaryColor, setSecondaryColor] = useState(team.teams?.secondary_color ?? "#0B1626");
  const [accentColor, setAccentColor] = useState(team.teams?.accent_color ?? "#16A34A");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(`/manager/teams/${team.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          short_name: shortName,
          logo_url: logoUrl || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor
        })
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update team settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur">
      <form className="mx-auto my-6 max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onSubmit={save}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[var(--team-primary)]">Team Settings</p>
            <h2 className="text-2xl font-black">{team.teams?.name}</h2>
          </div>
          <button type="button" className="rounded-full bg-slate-100 px-4 py-2 font-bold transition hover:bg-slate-200" onClick={onClose}>Close</button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Team Name<input className="manager-input mt-2" value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label className="text-sm font-bold">Short Name<input className="manager-input mt-2" value={shortName} onChange={(event) => setShortName(event.target.value)} required /></label>
          <label className="text-sm font-bold sm:col-span-2">Logo URL<input className="manager-input mt-2" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} /></label>
          <ColorField label="Primary Color" value={primaryColor} onChange={setPrimaryColor} />
          <ColorField label="Secondary Color" value={secondaryColor} onChange={setSecondaryColor} />
          <ColorField label="Accent Color" value={accentColor} onChange={setAccentColor} />
        </div>
        <p className="mt-4 rounded-2xl bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">
          Team settings can be changed until admin approval.
        </p>
        {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-2xl border px-5 py-3 font-bold" onClick={onClose}>Cancel</button>
          <button disabled={saving} className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 font-bold text-[var(--team-primary-text)] disabled:opacity-50">
            {saving ? "Saving..." : "Save Team Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

function GenerateSquadModal({
  team,
  summary,
  onClose,
  onPlayerClick,
  onGenerated
}: {
  team: TeamRecord;
  summary: SquadSummary | null;
  onClose: () => void;
  onPlayerClick: (player: PlayerRecord) => void;
  onGenerated: () => void;
}) {
  const max = summary?.max_squad_size ?? one(team.seasons)?.max_players_per_team ?? 22;
  const current = summary?.total ?? 0;
  const remaining = Math.max(0, max - current);
  const [step, setStep] = useState(1);
  const [target, setTarget] = useState(remaining);
  const [breakdown, setBreakdown] = useState<PositionBreakdown>(() => suggestedPositionBreakdown(remaining));
  const [generated, setGenerated] = useState<PlayerRecord[]>([]);
  const [editing, setEditing] = useState<PlayerRecord | null>(null);
  const [error, setError] = useState("");

  const breakdownTotal = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const grouped = groupedBreakdown(breakdown);
  const currentGoalkeepers = summary?.distribution?.goalkeepers ?? 0;
  const breakdownError = validateBreakdown(breakdown, target, remaining, current, currentGoalkeepers);

  async function generate() {
    setStep(3);
    setError("");
    try {
      const result = await api<{ generated_players: PlayerRecord[] }>(`/manager/teams/${team.id}/generate-squad`, {
        method: "POST",
        body: JSON.stringify({
          targetGenerateCount: target,
          positionBreakdown: breakdown,
          identityTypeMode: "mixed_generated",
          overwriteDraftPlayers: false
        })
      });
      setGenerated(result.generated_players);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate squad");
      setStep(2);
    }
  }

  function updateBreakdown(position: FootballPosition, value: number) {
    setBreakdown((currentBreakdown) => ({ ...currentBreakdown, [position]: Math.max(0, value) }));
  }

  async function removeDraft(player: PlayerRecord) {
    await api(`/manager/players/${player.id}`, { method: "DELETE" });
    setGenerated((currentPlayers) => currentPlayers.filter((item) => item.id !== player.id));
  }

  async function submitForApproval(playerIds: string[]) {
    await api(`/manager/teams/${team.id}/submit-players`, {
      method: "POST",
      body: JSON.stringify({ playerIds })
    });
    onGenerated();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--team-primary)]">Generate Squad</p>
            <h2 className="text-2xl font-black">{team.teams?.name}</h2>
          </div>
          <button className="rounded-full bg-slate-100 px-4 py-2 font-bold transition hover:bg-slate-200" onClick={onClose}>Close</button>
        </div>
        {error ? <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {step === 1 ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <DashboardCard label="Current Squad Size" value={current} color="slate" />
              <DashboardCard label="Max Squad Size" value={max} color="purple" />
              <DashboardCard label="Remaining Slots" value={remaining} color="green" />
            </div>
            <label className="block text-sm font-bold text-slate-700">Target Generate Count</label>
            <input
              className="manager-input"
              type="number"
              min={1}
              max={remaining}
              value={target}
              onChange={(event) => {
                const next = Number(event.target.value);
                setTarget(next);
                setBreakdown(suggestedPositionBreakdown(next));
              }}
            />
            <div className="flex justify-end gap-3">
              <button className="rounded-2xl border px-5 py-3 font-bold" onClick={onClose}>Cancel</button>
              <button className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 font-bold text-[var(--team-primary-text)] disabled:opacity-50" disabled={remaining === 0} onClick={() => setStep(2)}>Continue</button>
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {positions.map((position) => (
                <label key={position} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">{position}</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold outline-none focus:border-[var(--team-primary)]"
                    type="number"
                    min={0}
                    value={breakdown[position] ?? 0}
                    onChange={(event) => updateBreakdown(position, Number(event.target.value))}
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <DashboardCard label="Goalkeepers" value={grouped.goalkeepers} color="slate" />
              <DashboardCard label="Defenders" value={grouped.defenders} color="green" />
              <DashboardCard label="Midfielders" value={grouped.midfielders} color="yellow" />
              <DashboardCard label="Forwards" value={grouped.forwards} color="purple" />
            </div>
            <p className={`text-sm font-bold ${breakdownError ? "text-red-600" : "text-green-700"}`}>
              {breakdownError ?? `Total Selected: ${breakdownTotal} / ${target}. Remaining Slots: ${Math.max(0, target - breakdownTotal)}`}
            </p>
            <div className="flex justify-end gap-3">
              <button className="rounded-2xl border px-5 py-3 font-bold" onClick={() => setStep(1)}>Back</button>
              <button disabled={Boolean(breakdownError)} className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 font-bold text-[var(--team-primary-text)] disabled:opacity-50" onClick={() => void generate()}>Generate Players</button>
            </div>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="mt-8 space-y-3 text-slate-700">
            {["Selecting Bangladeshi names", "Assigning positions", "Assigning realistic jersey numbers", "Creating numeric NID/Birth ID values", "Saving draft players"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                <RefreshCcw className="animate-spin text-[var(--team-primary)]" size={18} />
                <span className="font-semibold">{item}</span>
              </div>
            ))}
          </div>
        ) : null}
        {step === 4 ? (
          <div className="mt-6 space-y-5">
            <PlayerTable
              players={generated}
              onPlayerClick={onPlayerClick}
              onEdit={setEditing}
              onRemove={(player) => void removeDraft(player).catch((err) => setError(err instanceof Error ? err.message : "Failed to remove player"))}
              emptyLabel="No players were created."
            />
            <div className="flex justify-end gap-3">
              <button
                className="rounded-2xl border border-green-200 bg-green-50 px-5 py-3 font-bold text-green-700 transition hover:bg-green-100"
                onClick={() => void submitForApproval(generated.map((player) => player.id))}
                disabled={generated.length === 0}
              >
                Submit All for Approval
              </button>
              <button className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 font-bold text-[var(--team-primary-text)]" onClick={onGenerated}>Done</button>
            </div>
          </div>
        ) : null}
      </div>
      {editing ? (
        <EditDraftPlayerModal
          player={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setGenerated((items) => items.map((item) => (item.id === updated.id ? updated : item)));
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PlayerTable({
  players,
  onPlayerClick,
  onEdit,
  onRemove,
  emptyLabel
}: {
  players: PlayerRecord[];
  onPlayerClick: (player: PlayerRecord) => void;
  onEdit?: (player: PlayerRecord) => void;
  onRemove?: (player: PlayerRecord) => void;
  emptyLabel: string;
}) {
  if (players.length === 0) return <EmptyState label={emptyLabel} />;
  const canEdit = (player: PlayerRecord) => player.status === RegistrationStatus.DRAFT || player.status === RegistrationStatus.PENDING;
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {["Avatar", "Code", "Player Name", "Position", "Category", "No.", "ID Type", "ID Number", "Foot", "Status", "Action"].map((head) => (
              <th key={head} className="px-4 py-3">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id} className="border-t transition hover:bg-purple-50/40">
              <td className="px-4 py-3"><Avatar name={player.players?.full_name ?? "Player"} src={player.players?.avatar_url} small /></td>
              <td className="px-4 py-3 font-mono text-xs">{player.player_code ?? "-"}</td>
              <td className="px-4 py-3">
                <button className="text-left font-bold transition hover:text-[var(--team-primary)] hover:underline" onClick={() => onPlayerClick(player)}>
                  {player.players?.full_name ?? "-"}
                </button>
              </td>
              <td className="px-4 py-3">{player.football_position ?? player.position}</td>
              <td className="px-4 py-3">{player.position_category ?? "-"}</td>
              <td className="px-4 py-3 font-bold">#{player.shirt_number ?? "-"}</td>
              <td className="px-4 py-3">{player.players?.id_type ?? "-"}</td>
              <td className="px-4 py-3 font-mono text-xs">{player.players?.generated_identity_number ?? "-"}</td>
              <td className="px-4 py-3">{player.preferred_foot ?? "UNKNOWN"}</td>
              <td className="px-4 py-3"><StatusBadge status={player.status} /></td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button className="rounded-xl bg-purple-50 px-3 py-2 text-xs font-bold text-[var(--team-primary)] transition hover:bg-[var(--team-primary)] hover:text-[var(--team-primary-text)]" onClick={() => onPlayerClick(player)}>
                    Open
                  </button>
                  {canEdit(player) && onEdit ? (
                    <button className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200" onClick={() => onEdit(player)}>
                      Edit
                    </button>
                  ) : null}
                  {canEdit(player) && onRemove ? (
                    <button className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100" onClick={() => onRemove(player)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditDraftPlayerModal({ player, onClose, onSaved }: { player: PlayerRecord; onClose: () => void; onSaved: (player: PlayerRecord) => void }) {
  const [fullName, setFullName] = useState(player.players?.full_name ?? "");
  const [position, setPosition] = useState<FootballPosition>((player.football_position as FootballPosition) ?? FootballPosition.CM);
  const [jersey, setJersey] = useState(String(player.shirt_number ?? ""));
  const [preferredFoot, setPreferredFoot] = useState<PreferredFoot>((player.preferred_foot as PreferredFoot) ?? PreferredFoot.RIGHT);
  const [avatarUrl, setAvatarUrl] = useState(player.players?.avatar_url ?? "");
  const [idType, setIdType] = useState<string>(player.players?.id_type === "BIRTH_ID" ? "BIRTH_ID" : "NID");
  const [identityNumber, setIdentityNumber] = useState(player.players?.generated_identity_number ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await api<{ player_registration: PlayerRecord }>(`/manager/players/${player.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName,
          football_position: position,
          shirt_number: Number(jersey),
          preferred_foot: preferredFoot,
          avatar_url: avatarUrl || null,
          id_type: idType,
          generated_identity_number: identityNumber
        })
      });
      onSaved(data.player_registration);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update draft player");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur">
      <form className="mx-auto my-6 max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onSubmit={save}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[var(--team-primary)]">Edit Player</p>
            <h2 className="text-2xl font-black">{player.players?.full_name}</h2>
          </div>
          <button type="button" className="rounded-full bg-slate-100 px-4 py-2 font-bold" onClick={onClose}>Close</button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Full Name<input className="manager-input mt-2" value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
          <label className="text-sm font-bold">Position
            <select className="manager-input mt-2" value={position} onChange={(event) => setPosition(event.target.value as FootballPosition)}>
              {positions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">Jersey Number<input className="manager-input mt-2" type="number" min={1} max={99} value={jersey} onChange={(event) => setJersey(event.target.value)} required /></label>
          <label className="text-sm font-bold">Preferred Foot
            <select className="manager-input mt-2" value={preferredFoot} onChange={(event) => setPreferredFoot(event.target.value as PreferredFoot)}>
              {Object.values(PreferredFoot).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold sm:col-span-2">Avatar URL<input className="manager-input mt-2" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} /></label>
          <label className="text-sm font-bold">ID Type
            <select className="manager-input mt-2" value={idType} onChange={(event) => setIdType(event.target.value)}>
              <option value="NID">NID</option>
              <option value="BIRTH_ID">Birth ID</option>
            </select>
          </label>
          <label className="text-sm font-bold">ID Number<input className="manager-input mt-2" inputMode="numeric" pattern="[0-9]*" value={identityNumber} onChange={(event) => setIdentityNumber(event.target.value.replace(/\D/gu, ""))} required /></label>
        </div>
        <div className="mt-4 rounded-2xl bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">
          If you change position, you may need to adjust the jersey number manually. It must remain unique in this squad.
        </div>
        {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-2xl border px-5 py-3 font-bold" onClick={onClose}>Cancel</button>
          <button disabled={saving} className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 font-bold text-[var(--team-primary-text)] disabled:opacity-50">
            {saving ? "Saving..." : "Save Player"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PlayerDetailModal({ player, onClose, onDeleted }: { player: PlayerRecord; onClose: () => void; onDeleted: () => void }) {
  const [tab, setTab] = useState<"Personal Data" | "League Stats">("Personal Data");
  const [error, setError] = useState("");
  const [stats, setStats] = useState<PlayerLeagueStatsPayload | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const canDelete = player.status === RegistrationStatus.DRAFT || player.status === RegistrationStatus.PENDING;
  const isGoalkeeper = (player.football_position ?? player.position) === FootballPosition.GK;

  useEffect(() => {
    let alive = true;
    setStatsLoading(true);
    api<PlayerLeagueStatsPayload>(`/manager/players/${player.id}/league-stats`)
      .then((payload) => {
        if (alive) setStats(payload);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Failed to load player stats");
      })
      .finally(() => {
        if (alive) setStatsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [player.id]);

  async function deletePlayer() {
    setError("");
    try {
      await api(`/manager/players/${player.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete player");
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 backdrop-blur">
      <div className="mx-auto my-6 max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={player.players?.full_name ?? "Player"} src={player.players?.avatar_url} />
            <div>
              <h2 className="text-2xl font-black">{player.players?.full_name}</h2>
              <p className="text-sm text-slate-500">{player.football_position ?? player.position} · #{player.shirt_number ?? "-"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {canDelete ? (
              <button className="rounded-full bg-red-50 px-4 py-2 font-bold text-red-700 transition hover:bg-red-100" onClick={() => void deletePlayer()}>Delete</button>
            ) : null}
            <button className="rounded-full bg-slate-100 px-4 py-2 font-bold transition hover:bg-slate-200" onClick={onClose}>Close</button>
          </div>
        </div>
        {error ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p> : null}
        <Tabs values={["Personal Data", "League Stats"]} value={tab} onChange={(value) => setTab(value as typeof tab)} />
        {tab === "Personal Data" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Detail label="Player Code" value={player.player_code ?? "-"} />
            <Detail label="Full Name" value={player.players?.full_name} />
            <Detail label="Date of Birth" value={player.players?.date_of_birth ?? "Not provided"} />
            <Detail label="Age" value={player.players?.date_of_birth ? calculateAge(player.players.date_of_birth) : "-"} />
            <Detail label="Position" value={player.football_position ?? player.position} />
            <Detail label="Jersey Number" value={player.shirt_number ? `#${player.shirt_number}` : "-"} />
            <Detail label="Preferred Foot" value={player.preferred_foot ?? "UNKNOWN"} />
            <Detail label="ID Type" value={player.players?.id_type ?? "-"} />
            <Detail label="ID Number" value={player.players?.generated_identity_number ?? "-"} />
            <Detail label="Masked ID" value={player.players?.id_number_last4 ? `****${player.players.id_number_last4}` : "-"} />
            <Detail label="Approval Status" value={player.status} />
            <Detail label="Player Status" value={player.player_status ?? "ACTIVE"} />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {statsLoading ? <LoadingState label="Loading player league stats..." /> : null}
            {!statsLoading ? (
              <>
                <PlayerStatsGrid stats={stats?.season_stats ?? null} isGoalkeeper={isGoalkeeper} />
                <Panel title="Match-by-match">
                  {stats?.match_stats?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="text-xs uppercase text-slate-500">
                          <tr>
                            {["Match", "Minutes", "Goals/Conceded", "Assists/Saves", "Pass Accuracy", "Cards", "Rating"].map((head) => (
                              <th key={head} className="px-3 py-2">{head}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {stats.match_stats.map((row, index) => (
                            <tr key={`${row.id ?? index}`} className="border-t">
                              <td className="px-3 py-2 font-semibold">{String(row.fixture_id ?? "Match")}</td>
                              <td className="px-3 py-2">{statValue(row.minutes_played)}</td>
                              <td className="px-3 py-2">{isGoalkeeper ? statValue(row.goals_conceded) : statValue(row.goals)}</td>
                              <td className="px-3 py-2">{isGoalkeeper ? statValue(row.saves) : statValue(row.assists)}</td>
                              <td className="px-3 py-2">{percentage(row.accurate_passes, row.total_passes)}</td>
                              <td className="px-3 py-2">{statValue(row.yellow_cards)}Y / {statValue(row.red_cards)}R</td>
                              <td className="px-3 py-2 font-black text-[var(--team-primary)]">{statValue(row.rating)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState label="No confirmed match stats yet. Hidden ability scores are not shown to managers." />
                  )}
                </Panel>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerStatsGrid({ stats, isGoalkeeper }: { stats: Record<string, number | string | null> | null; isGoalkeeper: boolean }) {
  const items: Array<[string, string]> = isGoalkeeper
    ? [
        ["Matches Played", "matches_played"],
        ["Starts", "starts"],
        ["Minutes Played", "minutes_played"],
        ["Saves", "saves"],
        ["Goals Conceded", "goals_conceded"],
        ["Accurate Passes", "accurate_passes"],
        ["Accurate Long Balls", "accurate_long_balls"],
        ["Diving Saves", "diving_saves"],
        ["Saves Inside Box", "saves_inside_box"],
        ["Clearances", "clearances"],
        ["Clean Sheets", "clean_sheets"],
        ["Average Rating", "average_rating"],
        ["Best Rating", "best_match_rating"],
        ["Lowest Rating", "lowest_match_rating"]
      ]
    : [
        ["Matches Played", "matches_played"],
        ["Starts", "starts"],
        ["Minutes Played", "minutes_played"],
        ["Goals", "goals"],
        ["Assists", "assists"],
        ["Shots", "shots"],
        ["Shots on Target", "shots_on_target"],
        ["Shot Accuracy", "shot_accuracy"],
        ["Chances Created", "chances_created"],
        ["Big Chances Missed", "big_chances_missed"],
        ["Total Passes", "total_passes"],
        ["Accurate Passes", "accurate_passes"],
        ["Pass Accuracy", "pass_accuracy"],
        ["Dribbles Attempted", "dribbles_attempted"],
        ["Successful Dribbles", "successful_dribbles"],
        ["Dribble Success Rate", "dribble_success_rate"],
        ["Dispossessed", "dispossessed"],
        ["Tackles", "tackles"],
        ["Interceptions", "interceptions"],
        ["Clearances", "clearances"],
        ["Blocks", "blocks"],
        ["Fouls Committed", "fouls_committed"],
        ["Yellow Cards", "yellow_cards"],
        ["Red Cards", "red_cards"],
        ["Average Rating", "average_rating"],
        ["Best Rating", "best_match_rating"],
        ["Lowest Rating", "lowest_match_rating"]
      ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, key]) => (
        <Detail key={key} label={label} value={formatStat(stats, key)} />
      ))}
    </div>
  );
}

function statValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "0";
  if (typeof value === "number" && Number.isFinite(value)) return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

function formatStat(stats: Record<string, number | string | null> | null, key: string) {
  if (!stats) return "0";
  if (key === "shot_accuracy") return percentage(stats.shots_on_target, stats.shots);
  if (key === "pass_accuracy") return percentage(stats.accurate_passes, stats.total_passes);
  if (key === "dribble_success_rate") return percentage(stats.successful_dribbles, stats.dribbles_attempted);
  return statValue(stats[key]);
}

function percentage(numerator: unknown, denominator: unknown) {
  const top = typeof numerator === "number" ? numerator : Number(numerator ?? 0);
  const bottom = typeof denominator === "number" ? denominator : Number(denominator ?? 0);
  if (!bottom || !Number.isFinite(top) || !Number.isFinite(bottom)) return "0%";
  return `${Math.round((top / bottom) * 100)}%`;
}

function FixtureTable({ fixtures, activeTeamId, emptyLabel }: { fixtures: FixtureRecord[]; activeTeamId?: string | undefined; emptyLabel: string }) {
  if (fixtures.length === 0) return <EmptyState label={emptyLabel} />;
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {["Date", "Opponent", "Venue", "Home/Away", "Competition", "Status", "Score", "Action"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}
          </tr>
        </thead>
        <tbody>
          {fixtures.map((fixture) => (
            <tr key={fixture.id} className="border-t">
              <td className="px-4 py-3">{formatDate(fixture.kickoff_at)}</td>
              <td className="px-4 py-3 font-bold">{opponentName(fixture, activeTeamId)}</td>
              <td className="px-4 py-3">{fixture.venue ?? "TBA"}</td>
              <td className="px-4 py-3">{fixture.home_team_registration_id === activeTeamId ? "Home" : "Away"}</td>
              <td className="px-4 py-3">{fixture.stage}</td>
              <td className="px-4 py-3"><StatusBadge status={fixture.status} /></td>
              <td className="px-4 py-3 font-bold">{fixture.home_score === null ? "-" : `${fixture.home_score} - ${fixture.away_score}`}</td>
              <td className="px-4 py-3"><button className="rounded-xl bg-purple-50 px-3 py-2 text-xs font-bold text-[var(--team-primary)]">Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamHero({ team, season, league, summary }: { team: TeamRecord | null; season: Season | null; league: League | null; summary: SquadSummary | null }) {
  return (
    <div className="rounded-[2rem] p-6 text-white shadow-xl" style={{ background: "linear-gradient(135deg, var(--team-secondary), var(--team-primary))" }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={team?.teams?.name ?? "Team"} src={team?.teams?.logo_url} />
          <div>
            <h2 className="text-3xl font-black">{team?.teams?.name ?? "No team"}</h2>
            <p className="text-sm text-purple-100">{league?.name ?? "League"} · {season?.name ?? "Season"}</p>
          </div>
        </div>
        <StatusBadge status={team?.status ?? "NO TEAM"} />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <MiniStat label="Approved" value={summary?.approved ?? 0} />
        <MiniStat label="Pending" value={summary?.pending ?? 0} />
        <MiniStat label="Draft" value={summary?.draft ?? 0} />
        <MiniStat label="Capacity" value={`${summary?.total ?? 0}/${summary?.max_squad_size ?? "-"}`} />
      </div>
    </div>
  );
}

function FixtureMini({ fixture, activeTeamId }: { fixture: FixtureRecord; activeTeamId?: string | undefined }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <p className="font-black">{matchLabel(fixture)}</p>
      <p className="mt-2 text-sm text-slate-500">{formatDate(fixture.kickoff_at)} · {fixture.venue ?? "TBA"}</p>
      <p className="mt-2 text-sm">Opponent: <b>{opponentName(fixture, activeTeamId)}</b></p>
      <StatusBadge status={fixture.status} />
    </div>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-4xl font-black">{title}</h1>
      <p className="mt-2 text-slate-600">{subtitle}</p>
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

function DashboardCard({ label, value, color }: { label: string; value: ReactNode; color: "purple" | "green" | "yellow" | "slate" }) {
  const colors = {
    purple: "bg-purple-50 text-[var(--team-primary)]",
    green: "bg-green-50 text-[#16A34A]",
    yellow: "bg-yellow-50 text-[#B45309]",
    slate: "bg-slate-100 text-slate-700"
  };
  return (
    <div className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-3xl font-black ${colors[color]}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-xs uppercase tracking-widest text-purple-100">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function StatGrid({ summary }: { summary: SquadSummary | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Detail label="Approved Players" value={summary?.approved ?? 0} />
      <Detail label="Pending Players" value={summary?.pending ?? 0} />
      <Detail label="Draft Players" value={summary?.draft ?? 0} />
      <Detail label="Rejected Players" value={summary?.rejected ?? 0} />
      <Detail label="Current Squad Size" value={summary?.total ?? 0} />
      <Detail label="Max Squad Size" value={summary?.max_squad_size ?? 0} />
      <Detail label="Remaining Slots" value={summary?.remaining_slots ?? 0} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 break-words font-bold text-slate-900">{value ?? "-"}</p>
    </div>
  );
}

function calculateAge(dateOfBirth: string) {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "-";
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday = today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function StatusBadge({ status }: { status?: string | null }) {
  return <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ring-1 ${statusClass(status)}`}>{status?.replaceAll("_", " ") ?? "-"}</span>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500">{label}</div>;
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex items-center gap-3 rounded-3xl bg-white px-6 py-4 font-bold shadow-sm">
        <RefreshCcw className="animate-spin text-[var(--team-primary)]" size={20} />
        {label}
      </div>
    </div>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left font-bold transition hover:-translate-y-0.5 hover:border-[var(--team-primary)] hover:bg-purple-50 hover:text-[var(--team-primary)]" onClick={onClick}>
      {label}
      <ChevronRight size={18} />
    </button>
  );
}

function Tabs({ values, value, onChange }: { values: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="my-5 flex flex-wrap gap-2">
      {values.map((item) => (
        <button key={item} className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition ${item === value ? "bg-[var(--team-primary)] text-[var(--team-primary-text)]" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-[var(--team-primary)]"}`} onClick={() => onChange(item)}>
          {item.replaceAll("_", " ")}
        </button>
      ))}
    </div>
  );
}

function Avatar({ name, src, small = false }: { name: string; src?: string | null | undefined; small?: boolean }) {
  const size = small ? "h-9 w-9 text-xs" : "h-12 w-12";
  if (src) return <img src={src} alt={name} className={`${size} rounded-2xl object-cover ring-2 ring-white`} />;
  return <div className={`${size} grid place-items-center rounded-2xl bg-[var(--team-primary)] font-black text-[var(--team-primary-text)]`}>{initials(name)}</div>;
}

function previewDistribution(size: number) {
  if (size <= 0) return { goalkeepers: 0, defenders: 0, midfielders: 0, forwards: 0 };
  const goalkeepers = Math.max(1, Math.round(size * 0.12));
  const defenders = Math.max(1, Math.round(size * 0.32));
  const midfielders = Math.max(1, Math.round(size * 0.32));
  const forwards = Math.max(0, size - goalkeepers - defenders - midfielders);
  return { goalkeepers, defenders, midfielders, forwards };
}

function suggestedPositionBreakdown(size: number): PositionBreakdown {
  const empty = {
    [FootballPosition.GK]: 0,
    [FootballPosition.CB]: 0,
    [FootballPosition.LB]: 0,
    [FootballPosition.RB]: 0,
    [FootballPosition.DM]: 0,
    [FootballPosition.CM]: 0,
    [FootballPosition.AM]: 0,
    [FootballPosition.LW]: 0,
    [FootballPosition.RW]: 0,
    [FootballPosition.ST]: 0
  };
  if (size <= 0) return empty;
  if (size === 18) return { ...empty, GK: 2, CB: 3, LB: 1, RB: 2, DM: 2, CM: 2, AM: 2, LW: 1, RW: 1, ST: 2 };
  if (size === 22) return { ...empty, GK: 3, CB: 3, LB: 2, RB: 2, DM: 2, CM: 3, AM: 2, LW: 1, RW: 1, ST: 3 };
  if (size === 25) return { ...empty, GK: 3, CB: 4, LB: 2, RB: 2, DM: 2, CM: 4, AM: 2, LW: 2, RW: 2, ST: 2 };
  const broad = previewDistribution(size);
  return {
    ...empty,
    GK: broad.goalkeepers,
    CB: Math.ceil(broad.defenders * 0.45),
    LB: Math.floor(broad.defenders * 0.275),
    RB: broad.defenders - Math.ceil(broad.defenders * 0.45) - Math.floor(broad.defenders * 0.275),
    DM: Math.floor(broad.midfielders * 0.3),
    CM: Math.ceil(broad.midfielders * 0.4),
    AM: broad.midfielders - Math.floor(broad.midfielders * 0.3) - Math.ceil(broad.midfielders * 0.4),
    LW: Math.floor(broad.forwards * 0.25),
    RW: Math.floor(broad.forwards * 0.25),
    ST: broad.forwards - Math.floor(broad.forwards * 0.25) * 2
  };
}

function groupedBreakdown(breakdown: PositionBreakdown) {
  return {
    goalkeepers: breakdown.GK,
    defenders: breakdown.CB + breakdown.LB + breakdown.RB,
    midfielders: breakdown.DM + breakdown.CM + breakdown.AM,
    forwards: breakdown.LW + breakdown.RW + breakdown.ST
  };
}

function validateBreakdown(breakdown: PositionBreakdown, target: number, remaining: number, currentSize: number, currentGoalkeepers: number) {
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  if (target > remaining) return `You only have ${remaining} remaining squad slots.`;
  if (total !== target) return `Total selected players must equal ${target}.`;
  if (currentSize + target >= 11 && currentGoalkeepers + breakdown.GK < 1) return "You need at least 1 goalkeeper.";
  if (currentSize + target >= 18 && currentGoalkeepers + breakdown.GK < 2) return "Recommended minimum 2 GK for squads 18+.";
  if (currentSize + target >= 22 && currentGoalkeepers + breakdown.GK < 3) return "Recommended minimum 3 GK for squads 22+.";
  return "";
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
