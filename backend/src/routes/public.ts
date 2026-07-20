import { Router } from "express";
import { hideFixtureOutcome } from "@flms/shared";
import { supabaseAdmin } from "../db/supabase.js";
import { asyncHandler } from "../errors.js";
import { loadSeasonStandings } from "../services/standings-report.js";

export const publicRouter = Router();

publicRouter.get(
  "/leagues",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("leagues")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ leagues: data });
  }),
);

publicRouter.get(
  "/leagues/:leagueId/seasons",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("seasons")
      .select("*")
      .eq("league_id", req.params.leagueId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ seasons: data });
  }),
);

publicRouter.get(
  "/seasons/:seasonId/teams",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("team_registrations")
      .select(
        "id,season_id,team_id,status,teams(name,short_name,primary_color)",
      )
      .eq("season_id", req.params.seasonId)
      .eq("status", "APPROVED")
      .order("created_at");
    if (error) throw error;
    res.json({ teams: data });
  }),
);

publicRouter.get(
  "/seasons/:seasonId/fixtures",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .select(
        "id,season_id,round_no,stage,group_name,home_team_registration_id,away_team_registration_id,kickoff_at,venue,status,home_score,away_score,extra_time_played,penalties_home,penalties_away,winner_team_registration_id,penalty_winner_team_registration_id",
      )
      .eq("season_id", req.params.seasonId)
      .order("round_no");
    if (error) throw error;
    const publicFixtures = (data ?? []).map((fixture) =>
      fixture.status === "FINAL" ? fixture : hideFixtureOutcome(fixture),
    );
    res.json({ fixtures: publicFixtures });
  }),
);

publicRouter.get(
  "/seasons/:seasonId/standings",
  asyncHandler(async (req, res) => {
    const seasonId = String(req.params.seasonId);
    const standings = await loadSeasonStandings(seasonId);
    res.json({ standings });
  }),
);

publicRouter.get(
  "/seasons/:seasonId/player-stats",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("player_season_stats")
      .select(
        "player_registration_id,appearances,starts,minutes_played,goals,assists,shots,shots_on_target,chances_created,big_chances_created,total_passes,accurate_passes,dribbles_attempted,successful_dribbles,dispossessed,tackles,interceptions,yellow_cards,red_cards,average_rating,best_match_rating,lowest_match_rating,player_of_match_count,player_season_registrations(players(full_name,avatar_url),position,football_position,shirt_number)",
      )
      .eq("season_id", req.params.seasonId)
      .order("goals", { ascending: false });
    if (error) throw error;
    res.json({ player_stats: data });
  }),
);
