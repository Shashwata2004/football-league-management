import { Router } from "express";
import { supabaseAdmin } from "../db/supabase.js";
import { asyncHandler } from "../errors.js";

export const publicRouter = Router();

publicRouter.get(
  "/leagues",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin.from("leagues").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ leagues: data });
  })
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
  })
);

publicRouter.get(
  "/seasons/:seasonId/teams",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("team_registrations")
      .select("id,season_id,team_id,status,teams(name,short_name,city,primary_color)")
      .eq("season_id", req.params.seasonId)
      .eq("status", "APPROVED")
      .order("created_at");
    if (error) throw error;
    res.json({ teams: data });
  })
);

publicRouter.get(
  "/seasons/:seasonId/fixtures",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .select(
        "id,season_id,round_no,stage,group_name,home_team_registration_id,away_team_registration_id,kickoff_at,venue,status,home_score,away_score"
      )
      .eq("season_id", req.params.seasonId)
      .order("round_no");
    if (error) throw error;
    const publicFixtures = (data ?? []).map((fixture) =>
      fixture.status === "FINAL" ? fixture : { ...fixture, home_score: null, away_score: null }
    );
    res.json({ fixtures: publicFixtures });
  })
);

publicRouter.get(
  "/seasons/:seasonId/standings",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("standings")
      .select("*")
      .eq("season_id", req.params.seasonId)
      .order("points", { ascending: false })
      .order("goal_difference", { ascending: false })
      .order("goals_for", { ascending: false })
      .order("fair_play_score", { ascending: true });
    if (error) throw error;
    res.json({ standings: data });
  })
);

publicRouter.get(
  "/seasons/:seasonId/player-stats",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("player_season_stats")
      .select("player_registration_id,goals,assists,appearances,yellow_cards,red_cards,average_rating,player_season_registrations(players(full_name),position,shirt_number)")
      .eq("season_id", req.params.seasonId)
      .order("goals", { ascending: false });
    if (error) throw error;
    res.json({ player_stats: data });
  })
);
