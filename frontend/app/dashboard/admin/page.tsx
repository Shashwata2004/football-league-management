"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  ChevronRight,
  LogOut,
  Plus,
  Search,
  Trophy,
  Zap,
  X
} from "lucide-react";
import { SeasonFormat, type LeagueDto, type ProfileDto, type SeasonDto } from "@flms/shared";
import { api, publicApi } from "@/lib/api";
import { clearAuth } from "@/lib/auth";

interface LeagueWithSeasons extends LeagueDto {
  seasons: SeasonDto[];
}

type QuickAction = "menu" | "newLeague" | "newSeason";
type SeasonFormatValue = (typeof SeasonFormat)[keyof typeof SeasonFormat];

interface LeagueForm {
  name: string;
  short_name: string;
  logo_url: string;
  organizer_name: string;
}

interface SeasonForm {
  season_year: string;
  registration_start_date: string;
  registration_deadline: string;
  start_date: string;
  end_date: string;
  format: SeasonFormatValue;
  total_teams: string;
  min_players_per_team: string;
  max_players_per_team: string;
  lineup_size: string;
  substitute_limit: string;
  lineup_submission_deadline_hours: string;
  yellow_card_suspension_threshold: string;
  group_count: string;
  teams_per_group: string;
  qualifiers_per_group: string;
  best_third_place_teams: string;
  total_knockout_teams: string;
}

const currentYear = String(new Date().getFullYear());
const knockoutSizes = [4, 8, 16, 32, 64];

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function emptyLeagueForm(): LeagueForm {
  return {
    name: "",
    short_name: "",
    logo_url: "",
    organizer_name: ""
  };
}

function defaultSeasonForm(): SeasonForm {
  const today = new Date();
  return {
    season_year: currentYear,
    registration_start_date: formatDateInput(today),
    registration_deadline: formatDateInput(addMonths(today, 2)),
    start_date: formatDateInput(addDays(addMonths(today, 2), 15)),
    end_date: formatDateInput(addMonths(today, 4)),
    format: SeasonFormat.SINGLE_ROUND_ROBIN,
    total_teams: "16",
    min_players_per_team: "11",
    max_players_per_team: "22",
    lineup_size: "11",
    substitute_limit: "5",
    lineup_submission_deadline_hours: "24",
    yellow_card_suspension_threshold: "3",
    group_count: "4",
    teams_per_group: "4",
    qualifiers_per_group: "2",
    best_third_place_teams: "0",
    total_knockout_teams: "8"
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function numberValue(value: string) {
  return Number(value);
}

function seasonNameFromYear(year: string) {
  return `Season ${year.trim() || currentYear}`;
}

export default function AdminDashboard() {
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [leagues, setLeagues] = useState<LeagueWithSeasons[]>([]);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickAction, setQuickAction] = useState<QuickAction>("menu");
  const [leagueStep, setLeagueStep] = useState(1);
  const [seasonStep, setSeasonStep] = useState(1);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [leagueForm, setLeagueForm] = useState<LeagueForm>(() => emptyLeagueForm());
  const [seasonForm, setSeasonForm] = useState<SeasonForm>(() => defaultSeasonForm());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [me, leagueData] = await Promise.all([
      api<{ profile: ProfileDto }>("/me"),
      publicApi<{ leagues: LeagueDto[] }>("/public/leagues")
    ]);
    const withSeasons = await Promise.all(
      leagueData.leagues.map(async (league) => {
        const seasonData = await publicApi<{ seasons: SeasonDto[] }>(`/public/leagues/${league.id}/seasons`);
        return { ...league, seasons: seasonData.seasons };
      })
    );
    setProfile(me.profile);
    setLeagues(withSeasons);
    setLoading(false);
  }

  useEffect(() => {
    void load().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Failed to load admin portal");
      setLoading(false);
    });
  }, []);

  const filteredLeagues = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return leagues;
    return leagues.filter((league) =>
      [league.name, league.short_name, league.organizer_name].some((value) => value?.toLowerCase().includes(term))
    );
  }, [leagues, query]);

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === selectedLeagueId) ?? null,
    [leagues, selectedLeagueId]
  );
  const previousSeason = selectedLeague?.seasons[0] ?? null;
  const hasGroupKnockout = seasonForm.format === SeasonFormat.GROUP_STAGE_KNOCKOUT;
  const totalKnockoutTeams =
    numberValue(seasonForm.group_count) * numberValue(seasonForm.qualifiers_per_group) +
    numberValue(seasonForm.best_third_place_teams);
  const expectedFinalStep = hasGroupKnockout ? 6 : 5;
  const expectedSeasonFinalStep = hasGroupKnockout ? 7 : 6;

  function updateLeagueForm(field: keyof LeagueForm, value: string) {
    setLeagueForm((current) => ({ ...current, [field]: value }));
  }

  function updateSeasonForm(field: keyof SeasonForm, value: string | boolean) {
    setSeasonForm((current) => ({ ...current, [field]: value }));
  }

  function openDrawer() {
    setDrawerOpen(true);
    setQuickAction("menu");
    setLeagueStep(1);
    setSeasonStep(1);
    setMessage("");
  }

  function resetForms() {
    setLeagueForm(emptyLeagueForm());
    setSeasonForm(defaultSeasonForm());
    setSelectedLeagueId("");
    setQuickAction("menu");
    setLeagueStep(1);
    setSeasonStep(1);
  }

  function signOut() {
    clearAuth();
    window.location.href = "/login";
  }

  function copyPreviousSettings() {
    if (!previousSeason) return;
    setSeasonForm((current) => ({
      ...current,
      format: previousSeason.format,
      total_teams: String(previousSeason.total_teams ?? current.total_teams),
      min_players_per_team: String(previousSeason.min_players_per_team ?? current.min_players_per_team),
      max_players_per_team: String(previousSeason.max_players_per_team ?? current.max_players_per_team),
      lineup_size: String(previousSeason.lineup_size ?? current.lineup_size),
      substitute_limit: String(previousSeason.substitute_limit ?? current.substitute_limit),
      lineup_submission_deadline_hours: String(
        previousSeason.lineup_submission_deadline_hours ?? current.lineup_submission_deadline_hours
      ),
      yellow_card_suspension_threshold: String(
        previousSeason.yellow_card_suspension_threshold ?? current.yellow_card_suspension_threshold
      ),
      group_count: String(previousSeason.group_count ?? current.group_count),
      teams_per_group: String(previousSeason.teams_per_group ?? current.teams_per_group),
      qualifiers_per_group: String(previousSeason.qualifiers_per_group ?? current.qualifiers_per_group),
      best_third_place_teams: String(previousSeason.best_third_place_teams ?? current.best_third_place_teams),
      total_knockout_teams: String(previousSeason.total_knockout_teams ?? current.total_knockout_teams)
    }));
  }

  function validateSeason() {
    if (!seasonForm.season_year.trim()) return "Season year is required.";
    if (numberValue(seasonForm.min_players_per_team) > numberValue(seasonForm.max_players_per_team)) {
      return "Minimum players cannot be greater than maximum players.";
    }
    if (hasGroupKnockout) {
      if (numberValue(seasonForm.total_knockout_teams) !== totalKnockoutTeams) {
        return "Total knockout teams must equal group qualifiers plus best third-place teams.";
      }
      if (!knockoutSizes.includes(totalKnockoutTeams)) {
        return "Total knockout teams must be 4, 8, 16, 32, or 64.";
      }
    }
    return "";
  }

  function buildSeasonPayload(leagueId: string) {
    const base = {
      league_id: leagueId,
      name: seasonNameFromYear(seasonForm.season_year),
      season_year: numberValue(seasonForm.season_year),
      registration_start_date: optionalText(seasonForm.registration_start_date),
      registration_deadline: optionalText(seasonForm.registration_deadline),
      start_date: optionalText(seasonForm.start_date),
      end_date: optionalText(seasonForm.end_date),
      format: seasonForm.format,
      total_teams: numberValue(seasonForm.total_teams),
      min_players_per_team: numberValue(seasonForm.min_players_per_team),
      max_players_per_team: numberValue(seasonForm.max_players_per_team),
      lineup_size: numberValue(seasonForm.lineup_size),
      substitute_limit: numberValue(seasonForm.substitute_limit),
      lineup_submission_deadline_hours: numberValue(
        seasonForm.lineup_submission_deadline_hours
      ),
      yellow_card_suspension_threshold: numberValue(
        seasonForm.yellow_card_suspension_threshold
      )
    };

    if (!hasGroupKnockout) return base;

    return {
      ...base,
      group_count: numberValue(seasonForm.group_count),
      teams_per_group: numberValue(seasonForm.teams_per_group),
      qualifiers_per_group: numberValue(seasonForm.qualifiers_per_group),
      best_third_place_teams: numberValue(seasonForm.best_third_place_teams),
      total_knockout_teams: numberValue(seasonForm.total_knockout_teams)
    };
  }

  async function submitNewLeague() {
    setMessage("");
    if (!leagueForm.name.trim() || !leagueForm.short_name.trim() || !leagueForm.organizer_name.trim()) {
      setMessage("League name, short name, and organizer are required.");
      return;
    }
    const seasonError = validateSeason();
    if (seasonError) {
      setMessage(seasonError);
      return;
    }
    try {
      const leagueResponse = await api<{ league: LeagueDto }>("/admin/leagues", {
        method: "POST",
        body: JSON.stringify({
          name: leagueForm.name.trim(),
          short_name: leagueForm.short_name.trim(),
          logo_url: optionalText(leagueForm.logo_url),
          organizer_name: leagueForm.organizer_name.trim()
        })
      });
      await api<{ season: SeasonDto }>("/admin/seasons", {
        method: "POST",
        body: JSON.stringify(buildSeasonPayload(leagueResponse.league.id))
      });
      setMessage("League created and registration opened.");
      resetForms();
      setDrawerOpen(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create league.");
    }
  }

  async function submitNewSeason() {
    setMessage("");
    if (!selectedLeagueId) {
      setMessage("Select a league first.");
      return;
    }
    const seasonError = validateSeason();
    if (seasonError) {
      setMessage(seasonError);
      return;
    }
    try {
      await api<{ season: SeasonDto }>("/admin/seasons", {
        method: "POST",
        body: JSON.stringify(buildSeasonPayload(selectedLeagueId))
      });
      setMessage("Season created and registration opened.");
      resetForms();
      setDrawerOpen(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create season.");
    }
  }

  function nextLeagueStep() {
    setMessage("");
    if (leagueStep === 1 && (!leagueForm.name.trim() || !leagueForm.short_name.trim() || !leagueForm.organizer_name.trim())) {
      setMessage("League name, short name, and organizer are required.");
      return;
    }
    if (leagueStep === expectedFinalStep) return;
    setLeagueStep((step) => Math.min(step + 1, expectedFinalStep));
  }

  function nextSeasonStep() {
    setMessage("");
    if (seasonStep === 1 && !selectedLeagueId) {
      setMessage("Select a league first.");
      return;
    }
    if (seasonStep === expectedSeasonFinalStep) return;
    setSeasonStep((step) => Math.min(step + 1, expectedSeasonFinalStep));
  }

  function previousLeagueStep() {
    setMessage("");
    setLeagueStep((step) => Math.max(step - 1, 1));
  }

  function previousSeasonStep() {
    setMessage("");
    setSeasonStep((step) => Math.max(step - 1, 1));
  }

  return (
    <div className="scoreline-admin fixed inset-0 z-40 overflow-y-auto bg-[#050914] text-[#eaf6ff]">
      <style jsx global>{`
        .scoreline-admin {
          font-family: "Inter", sans-serif;
          background:
            radial-gradient(circle at 12% 0%, rgba(0, 186, 255, 0.13), transparent 28rem),
            linear-gradient(rgba(10, 22, 40, 0.66) 1px, transparent 1px),
            linear-gradient(90deg, rgba(10, 22, 40, 0.66) 1px, transparent 1px),
            #050914;
          background-size: auto, 4px 4px, 4px 4px, auto;
        }
        .scoreline-condensed {
          font-family: "Barlow Condensed", sans-serif;
        }
        .scoreline-mono {
          font-family: "DM Mono", monospace;
        }
      `}</style>

      <header className="border-b border-[#00baff]/15 bg-[#070d19]/92">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#00baff]/35 bg-[#00baff]/12 text-[#00c8ff]">
              <Zap size={20} />
            </div>
            <span className="scoreline-condensed text-lg font-black uppercase tracking-[0.16em] text-white sm:text-xl sm:tracking-[0.22em]">Scoreline</span>
            <span className="scoreline-mono rounded-full border border-[#00baff]/40 bg-[#00baff]/10 px-2 py-1 text-[10px] uppercase text-[#00c8ff]">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <button
              onClick={signOut}
              className="scoreline-mono flex items-center gap-2 text-xs text-[#49a6d8] transition-all duration-200 hover:-translate-y-0.5 hover:text-[#00c8ff] hover:drop-shadow-[0_0_8px_rgba(0,200,255,0.45)] active:translate-y-0"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#00baff]/40 bg-[#00baff]/15 text-xs font-bold text-[#83eaff]">
              {(profile?.full_name ?? profile?.email ?? "AR").slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1050px] px-4 py-8 sm:px-8 sm:py-12">
        <section className="mb-10">
          <p className="scoreline-mono mb-4 text-xs uppercase tracking-[0.35em] text-[#1b78ad]">Admin Portal</p>
          <h1 className="scoreline-condensed text-5xl font-black uppercase leading-none tracking-[-0.03em] sm:text-7xl">
            Your <span className="text-[#00c8ff]">Leagues</span>
          </h1>
          <p className="mt-4 text-[#257aad]">Select a league to open its dashboard, or create something new.</p>
        </section>

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="scoreline-mono mb-3 text-xs uppercase tracking-[0.3em] text-[#1b78ad]">
              {filteredLeagues.length} {filteredLeagues.length === 1 ? "League" : "Leagues"}
            </p>
            <div className="relative w-full md:w-[420px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#257aad]" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search leagues"
                className="scoreline-mono h-11 w-full rounded-xl border border-[#00baff]/20 bg-[#071421] pl-11 pr-4 text-sm text-[#eaf6ff] outline-none transition placeholder:text-[#257aad] focus:border-[#00c8ff]/70 focus:ring-1 focus:ring-[#00c8ff]/30"
              />
            </div>
          </div>

          <button
            onClick={openDrawer}
            className="scoreline-condensed group flex h-12 items-center justify-center gap-3 rounded-xl border border-[#00baff]/45 bg-[#00baff]/12 px-7 text-base font-black uppercase tracking-[0.18em] text-[#00c8ff] shadow-[0_0_28px_rgba(0,186,255,0.1)] transition-all duration-200 hover:-translate-y-1 hover:border-[#00c8ff]/80 hover:bg-[#00baff]/20 hover:shadow-[0_14px_38px_rgba(0,186,255,0.22)] active:translate-y-0 active:scale-[0.98]"
          >
            <Plus className="transition-transform duration-200 group-hover:rotate-90" size={18} />
            Quick Actions
          </button>
        </div>

        {message ? <p className="scoreline-mono mb-5 text-xs text-[#00c8ff]">{message}</p> : null}

        {loading ? (
          <div className="scoreline-mono rounded-2xl border border-[#00baff]/15 bg-[#070d1d] p-10 text-sm text-[#257aad]">
            Loading leagues...
          </div>
        ) : filteredLeagues.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#00baff]/25 bg-[#070d1d]/80 p-12">
            <p className="scoreline-condensed text-3xl font-black uppercase text-white">No leagues found</p>
            <p className="mt-2 text-sm text-[#257aad]">
              {query ? "No league matches your search." : "Create a league from Quick Actions to see it here."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredLeagues.map((league, index) => {
              const latestSeason = league.seasons[0];
              return (
                <article
                  key={league.id}
                    className="group min-w-0 rounded-2xl border border-[#00baff]/18 bg-[#080d21] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:-translate-y-1 hover:border-[#00c8ff]/60 hover:shadow-[0_16px_45px_rgba(0,186,255,0.12)] sm:p-6"
                >
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#00baff]/25 bg-[#00baff]/10 text-[#00c8ff]">
                        {index % 3 === 0 ? <Trophy size={19} /> : <Zap size={19} />}
                      </div>
                      <div className="min-w-0">
                        <h2 className="scoreline-condensed text-2xl font-black uppercase leading-tight text-white">
                          {league.name}
                        </h2>
                        <p className="scoreline-mono mt-1 text-xs text-[#257aad]">
                          {league.organizer_name || league.short_name || "Football"}
                        </p>
                      </div>
                    </div>
                    <span className="scoreline-mono rounded-full border border-[#00c8ff]/45 bg-[#00baff]/10 px-3 py-1.5 text-[9px] font-bold uppercase leading-[1.15] tracking-[0.18em] text-[#00c8ff] shadow-[0_0_18px_rgba(0,200,255,0.08)]">
                      Registration
                      <br />
                      Open
                    </span>
                  </div>

                  <div className="mb-5 h-px bg-[#00baff]/10" />

                  <div className="mb-6 grid grid-cols-2 gap-5">
                    <div>
                      <p className="scoreline-mono mb-2 text-[10px] uppercase tracking-[0.25em] text-[#1b78ad]">Season</p>
                      <p className="scoreline-condensed text-base font-black text-[#00c8ff]">
                        {latestSeason?.name ?? "No season"}
                      </p>
                    </div>
                    <div>
                      <p className="scoreline-mono mb-2 text-[10px] uppercase tracking-[0.25em] text-[#1b78ad]">Format</p>
                      <p className="scoreline-condensed text-base font-black text-[#00c8ff]">
                        {latestSeason?.format ? latestSeason.format.replaceAll("_", " ") : "Not set"}
                      </p>
                    </div>
                  </div>

                  {latestSeason ? (
                    <Link
                      href={`/dashboard/admin/leagues/${league.id}/seasons/${latestSeason.id}`}
                      className="scoreline-condensed flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#00baff]/35 bg-[#00baff]/8 text-base font-black uppercase tracking-[0.18em] text-[#00c8ff] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#00c8ff]/90 hover:bg-[#00baff]/18 hover:shadow-[0_12px_30px_rgba(0,186,255,0.18)] active:translate-y-0 active:scale-[0.98] group-hover:border-[#00c8ff]/75 group-hover:bg-[#00baff]/14"
                    >
                      Open Dashboard
                      <ArrowRight className="transition-transform duration-200 group-hover:translate-x-1" size={17} />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="scoreline-condensed flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[#00baff]/20 bg-[#00baff]/5 text-base font-black uppercase tracking-[0.18em] text-[#257aad]"
                    >
                      Add Season First
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      <div
        className={`fixed inset-0 z-50 bg-black/55 transition-opacity duration-300 ${
          drawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-[470px] overflow-y-auto border-l border-[#00baff]/25 bg-[#07101d] p-4 shadow-[-28px_0_70px_rgba(0,0,0,0.45)] transition-transform duration-500 ease-out sm:p-7 ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="scoreline-mono text-xs uppercase tracking-[0.32em] text-[#1b78ad]">Quick Actions</p>
            <h2 className="scoreline-condensed mt-2 text-4xl font-black uppercase text-white">
              {quickAction === "menu" ? "Create" : quickAction === "newLeague" ? "New League" : "New Season"}
            </h2>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00baff]/25 text-[#00c8ff] transition-all duration-200 hover:-translate-y-0.5 hover:rotate-90 hover:border-[#00c8ff]/70 hover:bg-[#00baff]/12 hover:shadow-[0_0_22px_rgba(0,186,255,0.18)] active:translate-y-0 active:scale-[0.95]"
          >
            <X size={18} />
          </button>
        </div>

        {quickAction === "menu" ? (
          <div className="flex min-h-[calc(100vh-150px)] flex-col justify-center gap-4">
            <QuickActionCard
              icon={<Plus size={22} />}
              title="Create New League"
              description="Set up a brand new competition"
              onClick={() => {
                setQuickAction("newLeague");
                setLeagueStep(1);
                setMessage("");
              }}
            />
            <QuickActionCard
              icon={<CalendarPlus size={22} />}
              title="Create New Season"
              description="Add a season to an existing league"
              onClick={() => {
                setQuickAction("newSeason");
                setSeasonStep(1);
                setMessage("");
              }}
            />
          </div>
        ) : quickAction === "newLeague" ? (
          <WizardFrame
            step={leagueStep}
            totalSteps={expectedFinalStep}
            title={leagueStepTitle("newLeague", leagueStep, hasGroupKnockout)}
            onBack={() => (leagueStep === 1 ? setQuickAction("menu") : previousLeagueStep())}
            onNext={leagueStep === expectedFinalStep ? undefined : nextLeagueStep}
            message={message}
            finalActions={
              leagueStep === expectedFinalStep ? (
                <FinalButton label="Open Registration" onClick={() => void submitNewLeague()} />
              ) : null
            }
          >
            {renderLeagueStep()}
          </WizardFrame>
        ) : (
          <WizardFrame
            step={seasonStep}
            totalSteps={expectedSeasonFinalStep}
            title={leagueStepTitle("newSeason", seasonStep, hasGroupKnockout)}
            onBack={() => (seasonStep === 1 ? setQuickAction("menu") : previousSeasonStep())}
            onNext={seasonStep === expectedSeasonFinalStep ? undefined : nextSeasonStep}
            message={message}
            finalActions={
              seasonStep === expectedSeasonFinalStep ? (
                <FinalButton label="Open Registration" onClick={() => void submitNewSeason()} />
              ) : null
            }
          >
            {renderSeasonStep()}
          </WizardFrame>
        )}
      </aside>
    </div>
  );

  function renderLeagueStep() {
    if (leagueStep === 1) {
      return (
        <div className="space-y-3">
          <TextInput label="League Name" value={leagueForm.name} onChange={(value) => updateLeagueForm("name", value)} />
          <TextInput
            label="League Short Name"
            value={leagueForm.short_name}
            onChange={(value) => updateLeagueForm("short_name", value)}
            placeholder="AFL"
          />
          <TextInput
            label="League Logo"
            value={leagueForm.logo_url}
            onChange={(value) => updateLeagueForm("logo_url", value)}
            placeholder="https://..."
          />
          <TextInput
            label="Organizer Name"
            value={leagueForm.organizer_name}
            onChange={(value) => updateLeagueForm("organizer_name", value)}
            placeholder="AUST Sports Club"
          />
        </div>
      );
    }
    return renderSeasonConfigurationStep(leagueStep - 1);
  }

  function renderSeasonStep() {
    if (seasonStep === 1) {
      return (
        <div className="space-y-3">
          <label className="scoreline-mono text-[10px] uppercase tracking-[0.25em] text-[#49a6d8]">Select League</label>
          <select
            value={selectedLeagueId}
            onChange={(event) => setSelectedLeagueId(event.target.value)}
            className="h-12 w-full rounded-lg border border-[#00baff]/18 bg-[#06101c] px-3 text-sm text-[#eaf6ff] outline-none focus:border-[#00c8ff]/70"
          >
            <option value="">Select League</option>
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (seasonStep === 2) {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#00baff]/18 bg-[#091827] p-5">
            <p className="scoreline-condensed text-xl font-black uppercase text-white">Copy settings from previous season?</p>
            <p className="mt-1 text-sm text-[#257aad]">
              {previousSeason ? `Previous season: ${previousSeason.name}` : "This league has no previous season yet."}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!previousSeason}
              onClick={() => {
                copyPreviousSettings();
                setSeasonStep(3);
              }}
              className="scoreline-condensed h-12 rounded-xl bg-[#00c8ff] font-black uppercase tracking-[0.16em] text-[#04101c] shadow-[0_10px_26px_rgba(0,200,255,0.16)] transition-all duration-200 hover:-translate-y-1 hover:bg-[#33d6ff] hover:shadow-[0_16px_40px_rgba(0,200,255,0.28)] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
            >
              Yes, Copy
            </button>
            <button
              type="button"
              onClick={() => {
                setSeasonForm(defaultSeasonForm());
                setSeasonStep(3);
              }}
              className="scoreline-condensed h-12 rounded-xl border border-[#00baff]/25 bg-[#00baff]/8 font-black uppercase tracking-[0.16em] text-[#00c8ff] transition-all duration-200 hover:-translate-y-1 hover:border-[#00c8ff]/70 hover:bg-[#00baff]/15 hover:shadow-[0_12px_34px_rgba(0,186,255,0.16)] active:translate-y-0 active:scale-[0.98]"
            >
              Start Fresh
            </button>
          </div>
        </div>
      );
    }

    return renderSeasonConfigurationStep(seasonStep - 2);
  }

  function renderSeasonConfigurationStep(step: number) {
    if (step === 1) {
      return (
        <div className="space-y-3">
          <TextInput
            label="Season Year"
            type="number"
            value={seasonForm.season_year}
            onChange={(value) => updateSeasonForm("season_year", value)}
            placeholder="2026"
          />
          <TextInput
            label="Registration Start Date"
            type="date"
            value={seasonForm.registration_start_date}
            onChange={(value) => updateSeasonForm("registration_start_date", value)}
          />
          <TextInput
            label="Registration Deadline"
            type="date"
            value={seasonForm.registration_deadline}
            onChange={(value) => updateSeasonForm("registration_deadline", value)}
          />
          <TextInput
            label="Season Start Date"
            type="date"
            value={seasonForm.start_date}
            onChange={(value) => updateSeasonForm("start_date", value)}
          />
          <TextInput
            label="Season End Date"
            type="date"
            value={seasonForm.end_date}
            onChange={(value) => updateSeasonForm("end_date", value)}
          />
          <p className="scoreline-mono text-xs text-[#257aad]">Season name will be saved as {seasonNameFromYear(seasonForm.season_year)}.</p>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="space-y-3">
          <FormatButton
            active={seasonForm.format === SeasonFormat.SINGLE_ROUND_ROBIN}
            title="Single Round Robin League"
            description="Every team plays once. Table topper becomes champion."
            onClick={() => updateSeasonForm("format", SeasonFormat.SINGLE_ROUND_ROBIN)}
          />
          <FormatButton
            active={seasonForm.format === SeasonFormat.DOUBLE_ROUND_ROBIN}
            title="Double Round Robin League"
            description="Every team plays home and away. Table topper becomes champion."
            onClick={() => updateSeasonForm("format", SeasonFormat.DOUBLE_ROUND_ROBIN)}
          />
          <FormatButton
            active={seasonForm.format === SeasonFormat.GROUP_STAGE_KNOCKOUT}
            title="Group Stage + Knockout"
            description="Group stage first, then a valid knockout bracket."
            onClick={() => updateSeasonForm("format", SeasonFormat.GROUP_STAGE_KNOCKOUT)}
          />
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="col-span-2">
            <TextInput
              label="Total Teams"
              type="number"
              value={seasonForm.total_teams}
              onChange={(value) => updateSeasonForm("total_teams", value)}
            />
          </div>
          <TextInput
            label="Min Players / Team"
            type="number"
            value={seasonForm.min_players_per_team}
            onChange={(value) => updateSeasonForm("min_players_per_team", value)}
          />
          <TextInput
            label="Max Players / Team"
            type="number"
            value={seasonForm.max_players_per_team}
            onChange={(value) => updateSeasonForm("max_players_per_team", value)}
          />
          <TextInput label="Lineup Size" type="number" value={seasonForm.lineup_size} onChange={(value) => updateSeasonForm("lineup_size", value)} />
          <TextInput
            label="Substitute Limit"
            type="number"
            value={seasonForm.substitute_limit}
            onChange={(value) => updateSeasonForm("substitute_limit", value)}
          />
        </div>
      );
    }

    if (step === 4) {
      return (
        <div className="space-y-4">
          <TextInput
            label="Lineup Submission Deadline"
            type="number"
            value={seasonForm.lineup_submission_deadline_hours}
            onChange={(value) => updateSeasonForm("lineup_submission_deadline_hours", value)}
            placeholder="Hours before kickoff"
          />
          <TextInput
            label="Yellow Cards for 1-Match Suspension"
            type="number"
            value={seasonForm.yellow_card_suspension_threshold}
            onChange={(value) => updateSeasonForm("yellow_card_suspension_threshold", value)}
            placeholder="Usually 3 or 5"
          />
          <p className="scoreline-mono text-xs text-[#257aad]">
            Deadline is stored in hours before kickoff. Yellow accumulation is
            reset when a group-stage season enters the knockout phase.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput
            label="Number of Groups"
            type="number"
            value={seasonForm.group_count}
            onChange={(value) => updateSeasonForm("group_count", value)}
          />
          <TextInput
            label="Teams Per Group"
            type="number"
            value={seasonForm.teams_per_group}
            onChange={(value) => updateSeasonForm("teams_per_group", value)}
          />
          <TextInput
            label="Qualify / Group"
            type="number"
            value={seasonForm.qualifiers_per_group}
            onChange={(value) => updateSeasonForm("qualifiers_per_group", value)}
          />
          <TextInput
            label="Best Third-Place"
            type="number"
            value={seasonForm.best_third_place_teams}
            onChange={(value) => updateSeasonForm("best_third_place_teams", value)}
          />
        </div>
        <TextInput
          label="Total Knockout Teams"
          type="number"
          value={seasonForm.total_knockout_teams}
          onChange={(value) => updateSeasonForm("total_knockout_teams", value)}
        />
        <div
          className={`scoreline-mono rounded-xl border p-4 text-xs ${
            knockoutSizes.includes(totalKnockoutTeams) && numberValue(seasonForm.total_knockout_teams) === totalKnockoutTeams
              ? "border-[#00ffb3]/25 bg-[#00ffb3]/8 text-[#00ffb3]"
              : "border-red-400/30 bg-red-500/8 text-red-200"
          }`}
        >
          Calculated knockout teams: {Number.isFinite(totalKnockoutTeams) ? totalKnockoutTeams : 0}. Must be 4, 8, 16, 32, or 64.
        </div>
      </div>
    );
  }
}

function leagueStepTitle(action: Exclude<QuickAction, "menu">, step: number, hasGroupKnockout: boolean) {
  const newLeagueTitles = [
    "League Basic Info",
    "Create First Season",
    "Tournament Format",
    "Team & Player Rules",
    "Match Rules",
    "Group + Knockout Rules"
  ];
  const newSeasonTitles = [
    "Select Existing League",
    "Previous Settings",
    "Season Details",
    "Tournament Format",
    "Team & Player Rules",
    "Match Rules",
    "Group + Knockout Rules"
  ];
  const titles = action === "newLeague" ? newLeagueTitles : newSeasonTitles;
  const title = titles[step - 1] ?? "Create";
  if (!hasGroupKnockout && title === "Group + Knockout Rules") return "Match Rules";
  return title;
}

function QuickActionCard({
  icon,
  title,
  description,
  onClick
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-5 rounded-2xl border border-[#00baff]/18 bg-[#091827] p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:border-[#00c8ff]/70 hover:bg-[#0a1f34] hover:shadow-[0_18px_42px_rgba(0,186,255,0.18)] active:translate-y-0 active:scale-[0.99]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#00baff]/25 bg-[#00baff]/10 text-[#00c8ff] transition-all duration-200 group-hover:scale-110 group-hover:border-[#00c8ff]/70 group-hover:bg-[#00baff]/18 group-hover:shadow-[0_0_22px_rgba(0,200,255,0.22)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="scoreline-condensed block text-xl font-black uppercase text-white">{title}</span>
        <span className="scoreline-mono text-xs text-[#257aad]">{description}</span>
      </span>
      <ChevronRight className="text-[#257aad] transition-transform duration-200 group-hover:translate-x-2 group-hover:text-[#00c8ff]" size={20} />
    </button>
  );
}

function WizardFrame({
  step,
  totalSteps,
  title,
  children,
  message,
  finalActions,
  onBack,
  onNext
}: {
  step: number;
  totalSteps: number;
  title: string;
  children: React.ReactNode;
  message: string;
  finalActions: React.ReactNode;
  onBack: () => void;
  onNext?: (() => void) | undefined;
}) {
  return (
    <form
      className="space-y-5"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onNext?.();
      }}
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="scoreline-mono text-xs uppercase tracking-[0.28em] text-[#1b78ad]">
            Step {step} / {totalSteps}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="scoreline-mono group flex items-center gap-2 text-xs uppercase text-[#49a6d8] transition-all duration-200 hover:-translate-y-0.5 hover:text-[#00c8ff] hover:drop-shadow-[0_0_8px_rgba(0,200,255,0.45)] active:translate-y-0"
          >
            <ArrowLeft className="transition-transform duration-200 group-hover:-translate-x-1" size={14} />
            Back
          </button>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#071421]">
          <div className="h-full bg-[#00c8ff] transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-[#00baff]/18 bg-[#091827] p-5">
        <h3 className="scoreline-condensed mb-5 text-2xl font-black uppercase text-white">{title}</h3>
        {children}
      </div>

      {message ? <p className="scoreline-mono text-xs text-red-200">{message}</p> : null}

      {finalActions ?? (
        <button className="scoreline-condensed group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00c8ff] font-black uppercase tracking-[0.18em] text-[#04101c] shadow-[0_10px_26px_rgba(0,200,255,0.18)] transition-all duration-200 hover:-translate-y-1 hover:bg-[#33d6ff] hover:shadow-[0_16px_42px_rgba(0,200,255,0.30)] active:translate-y-0 active:scale-[0.98]">
          Continue
          <ArrowRight className="transition-transform duration-200 group-hover:translate-x-1" size={17} />
        </button>
      )}
    </form>
  );
}

function FinalButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="scoreline-condensed h-12 w-full rounded-xl bg-[#00c8ff] font-black uppercase tracking-[0.14em] text-[#04101c] shadow-[0_10px_26px_rgba(0,200,255,0.18)] transition-all duration-200 hover:-translate-y-1 hover:bg-[#33d6ff] hover:shadow-[0_16px_42px_rgba(0,200,255,0.32)] active:translate-y-0 active:scale-[0.98]"
    >
      {label}
    </button>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="scoreline-mono text-[10px] uppercase tracking-[0.25em] text-[#49a6d8]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? label}
        className="h-12 w-full rounded-lg border border-[#00baff]/18 bg-[#06101c] px-3 text-sm text-[#eaf6ff] outline-none placeholder:text-[#257aad] focus:border-[#00c8ff]/70"
      />
    </label>
  );
}

function FormatButton({
  active,
  title,
  description,
  onClick
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ${
        active
          ? "border-[#00c8ff]/65 bg-[#00baff]/14 shadow-[0_0_24px_rgba(0,200,255,0.14)]"
          : "border-[#00baff]/18 bg-[#091827] hover:border-[#00c8ff]/55 hover:bg-[#00baff]/10 hover:shadow-[0_12px_28px_rgba(0,186,255,0.13)]"
      }`}
    >
      <span className="scoreline-condensed block text-xl font-black uppercase text-white">{title}</span>
      <span className="mt-1 block text-sm text-[#257aad]">{description}</span>
    </button>
  );
}
