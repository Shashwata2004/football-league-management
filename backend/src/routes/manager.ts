import { Router } from "express";
import {
  hiddenAttributesSchema,
  lineupSubmissionSchema,
  playerSubmissionSchema,
  teamRegistrationSchema,
  UserRole
} from "@flms/shared";
import { supabaseAdmin } from "../db/supabase.js";
import { AppError, assertFound, asyncHandler } from "../errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateLineupSubmission } from "../domain/lineups.js";
import { hashIdentityNumber, identityLast4 } from "../utils/hmac.js";

export const managerRouter = Router();
managerRouter.use(requireAuth, requireRole(UserRole.MANAGER, UserRole.ADMIN));

async function assertManagerOwnsTeam(userId: string, teamRegistrationId: string) {
  const { data, error } = await supabaseAdmin
    .from("team_registrations")
    .select("id,manager_id,season_id,status")
    .eq("id", teamRegistrationId)
    .single();
  if (error) throw error;
  if (data.manager_id !== userId) throw new AppError(403, "You do not manage this team registration");
  return data;
}

managerRouter.post(
  "/team-registrations",
  asyncHandler(async (req, res) => {
    const input = teamRegistrationSchema.parse(req.body);
    const { data: team, error: teamError } = await supabaseAdmin
      .from("teams")
      .insert({
        manager_id: req.auth!.userId,
        name: input.name,
        short_name: input.short_name,
        city: input.city ?? null,
        primary_color: input.primary_color ?? null
      })
      .select("*")
      .single();
    if (teamError) throw teamError;

    const { data, error } = await supabaseAdmin
      .from("team_registrations")
      .insert({
        season_id: input.season_id,
        team_id: team.id,
        manager_id: req.auth!.userId,
        status: "PENDING"
      })
      .select("*,teams(*)")
      .single();
    if (error) throw error;
    res.status(201).json({ team_registration: data });
  })
);

managerRouter.get(
  "/team-registrations",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("team_registrations")
      .select("*,teams(*)")
      .eq("manager_id", req.auth!.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ team_registrations: data });
  })
);

managerRouter.post(
  "/players",
  asyncHandler(async (req, res) => {
    const input = playerSubmissionSchema.parse(req.body);
    const teamRegistration = await assertManagerOwnsTeam(req.auth!.userId, input.team_registration_id);
    const idHash = hashIdentityNumber(input.id_number);
    const last4 = identityLast4(input.id_number);

    const { data: player, error: playerError } = await supabaseAdmin
      .from("players")
      .upsert(
        {
          full_name: input.full_name,
          date_of_birth: input.date_of_birth,
          nationality: input.nationality ?? null,
          id_type: input.id_type,
          id_number_hash: idHash,
          id_number_last4: last4
        },
        { onConflict: "id_number_hash" }
      )
      .select("*")
      .single();
    if (playerError) throw playerError;

    const { data: registration, error } = await supabaseAdmin
      .from("player_season_registrations")
      .insert({
        player_id: player.id,
        season_id: teamRegistration.season_id,
        team_registration_id: input.team_registration_id,
        position: input.position,
        shirt_number: input.shirt_number ?? null,
        status: "PENDING"
      })
      .select("*")
      .single();
    if (error) throw error;

    if (input.proof_storage_path) {
      const { error: proofError } = await supabaseAdmin.from("identity_proofs").insert({
        player_id: player.id,
        submitted_by: req.auth!.userId,
        id_type: input.id_type,
        id_number_hash: idHash,
        id_number_last4: last4,
        storage_path: input.proof_storage_path
      });
      if (proofError) throw proofError;
    }

    res.status(201).json({ player_registration: registration });
  })
);

managerRouter.post(
  "/hidden-attributes",
  asyncHandler(async (req, res) => {
    const input = hiddenAttributesSchema.parse(req.body);
    const { data: playerReg, error: regError } = await supabaseAdmin
      .from("player_season_registrations")
      .select("id,team_registration_id,status")
      .eq("id", input.player_registration_id)
      .single();
    if (regError) throw regError;
    await assertManagerOwnsTeam(req.auth!.userId, playerReg.team_registration_id);
    if (playerReg.status === "APPROVED") {
      throw new AppError(403, "Hidden attributes can only be changed by managers before admin player approval");
    }

    const { data, error } = await supabaseAdmin
      .from("player_hidden_attributes")
      .upsert(
        {
          player_registration_id: input.player_registration_id,
          submitted_by: req.auth!.userId,
          pace: input.pace,
          shooting: input.shooting,
          passing: input.passing,
          dribbling: input.dribbling,
          defending: input.defending,
          physical: input.physical,
          goalkeeping: input.goalkeeping
        },
        { onConflict: "player_registration_id" }
      )
      .select("*")
      .single();
    if (error) throw error;
    res.json({ hidden_attributes: data });
  })
);

managerRouter.post(
  "/lineups",
  asyncHandler(async (req, res) => {
    const input = lineupSubmissionSchema.parse(req.body);
    const teamRegistration = await assertManagerOwnsTeam(req.auth!.userId, input.team_registration_id);
    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from("fixtures")
      .select("*")
      .eq("id", input.fixture_id)
      .single();
    if (fixtureError) throw fixtureError;
    if (fixture.season_id !== teamRegistration.season_id) throw new AppError(400, "Fixture belongs to a different season");
    if (![fixture.home_team_registration_id, fixture.away_team_registration_id].includes(input.team_registration_id)) {
      throw new AppError(400, "Team is not assigned to this fixture");
    }
    const expectedSide = fixture.home_team_registration_id === input.team_registration_id ? "HOME" : "AWAY";
    if (input.side !== expectedSide) throw new AppError(400, "Lineup side does not match fixture assignment");

    const { data: players, error: playersError } = await supabaseAdmin
      .from("player_season_registrations")
      .select("id,team_registration_id,season_id,status")
      .eq("season_id", fixture.season_id)
      .eq("team_registration_id", input.team_registration_id);
    if (playersError) throw playersError;
    validateLineupSubmission(input, players ?? [], fixture.season_id);

    const { data: lineup, error } = await supabaseAdmin
      .from("lineups")
      .upsert(
        {
          fixture_id: input.fixture_id,
          team_registration_id: input.team_registration_id,
          side: input.side,
          formation: input.formation,
          status: "PENDING"
        },
        { onConflict: "fixture_id,team_registration_id" }
      )
      .select("*")
      .single();
    if (error) throw error;

    await supabaseAdmin.from("lineup_players").delete().eq("lineup_id", lineup.id);
    const { error: insertError } = await supabaseAdmin.from("lineup_players").insert(
      input.players.map((player) => ({
        lineup_id: lineup.id,
        player_registration_id: player.player_registration_id,
        is_starter: player.is_starter,
        position: player.position
      }))
    );
    if (insertError) throw insertError;
    res.status(201).json({ lineup: { ...lineup, players: input.players } });
  })
);

managerRouter.get(
  "/performance",
  asyncHandler(async (req, res) => {
    const { data: teams, error: teamError } = await supabaseAdmin
      .from("team_registrations")
      .select("id")
      .eq("manager_id", req.auth!.userId);
    if (teamError) throw teamError;
    const ids = (teams ?? []).map((team) => team.id);
    if (ids.length === 0) return res.json({ standings: [], player_stats: [] });

    const { data: standings, error: standingsError } = await supabaseAdmin.from("standings").select("*").in("team_registration_id", ids);
    if (standingsError) throw standingsError;

    const { data: players, error: playerError } = await supabaseAdmin
      .from("player_season_stats")
      .select("*,player_season_registrations!inner(team_registration_id,players(full_name))")
      .in("player_season_registrations.team_registration_id", ids);
    if (playerError) throw playerError;
    res.json({ standings, player_stats: players });
  })
);
