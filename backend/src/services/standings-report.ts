import { supabaseAdmin } from "../db/supabase.js";

export interface StandingReportRow {
  standing_id: string;
  season_id: string;
  league_id: string;
  league_name: string;
  season_name: string;
  season_year: number;
  group_id: string | null;
  group_name: string | null;
  team_registration_id: string;
  team_id: string;
  team_name: string;
  team_short_name: string;
  team_logo_url: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  fair_play_score: number;
  admin_draw_rank: number | null;
  head_to_head_points: number;
  position: number;
  updated_at: string;
}

export function standingReportToApiRow(row: StandingReportRow) {
  return {
    id: row.standing_id,
    season_id: row.season_id,
    team_registration_id: row.team_registration_id,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goals_for: row.goals_for,
    goals_against: row.goals_against,
    goal_difference: row.goal_difference,
    points: row.points,
    fair_play_score: row.fair_play_score,
    admin_draw_rank: row.admin_draw_rank,
    head_to_head_points: row.head_to_head_points,
    position: row.position,
    group_id: row.group_id,
    group_name: row.group_name,
    updated_at: row.updated_at,
    team_registrations: {
      id: row.team_registration_id,
      teams: {
        id: row.team_id,
        name: row.team_name,
        short_name: row.team_short_name,
        logo_url: row.team_logo_url,
      },
    },
  };
}

export async function loadSeasonStandings(seasonId: string) {
  const { data, error } = await supabaseAdmin
    .from("season_standings_report")
    .select("*")
    .eq("season_id", seasonId)
    .order("group_name", { ascending: true, nullsFirst: true })
    .order("position", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as StandingReportRow[]).map(standingReportToApiRow);
}
