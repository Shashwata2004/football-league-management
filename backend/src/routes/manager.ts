import { Router } from "express";
import {
  FixtureStatus,
  FootballPosition,
  generateSquadSchema,
  hiddenAttributesSchema,
  IdType,
  lineupSubmissionSchema,
  PlayerLifecycleStatus,
  PlayerPosition,
  playerSubmissionSchema,
  PreferredFoot,
  RegistrationStatus,
  submitPlayersSchema,
  teamRegistrationSchema,
  updateDraftPlayerSchema,
  UserRole
} from "@flms/shared";
import { supabaseAdmin } from "../db/supabase.js";
import { AppError, assertFound, asyncHandler } from "../errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateLineupSubmission } from "../domain/lineups.js";
import { hashIdentityNumber, identityLast4 } from "../utils/hmac.js";
import {
  categoryForFootballPosition,
  coarsePosition,
  currentDistribution,
  generateSquadPlayers,
  neededDistribution,
  suggestedPositionBreakdown,
  targetDistribution
} from "../domain/squad-generator.js";

export const managerRouter = Router();
managerRouter.use(requireAuth, requireRole(UserRole.MANAGER, UserRole.ADMIN));

async function assertManagerOwnsTeam(userId: string, teamRegistrationId: string) {
  const { data, error } = await supabaseAdmin
    .from("team_registrations")
    .select(
      "id,manager_id,season_id,team_id,status,rejection_reason,created_at,teams(*),seasons!team_registrations_season_id_fkey(id,name,season_year,format,phase,max_players_per_team,total_teams,lineup_size,substitute_limit,league_id,leagues(id,name,short_name,logo_url))"
    )
    .eq("id", teamRegistrationId)
    .single();
  if (error) throw error;
  if (data.manager_id !== userId) throw new AppError(403, "You do not manage this team registration");
  return data;
}

function footballPositionFromCoarse(position: PlayerPosition) {
  if (position === PlayerPosition.GK) return FootballPosition.GK;
  if (position === PlayerPosition.DEF) return FootballPosition.CB;
  if (position === PlayerPosition.MID) return FootballPosition.CM;
  return FootballPosition.ST;
}

function maxSquadSize(teamRegistration: Awaited<ReturnType<typeof assertManagerOwnsTeam>>) {
  const season = Array.isArray(teamRegistration.seasons) ? teamRegistration.seasons[0] : teamRegistration.seasons;
  return Number(season?.max_players_per_team ?? 22);
}

function playerCode(id: string) {
  return `PLY-${id.slice(0, 8).toUpperCase()}`;
}

function generatedIdentity(idType: IdType, year: number, sequence: number) {
  if (idType === IdType.BIRTH_ID) return `${year}${String(sequence).padStart(13, "0")}`.slice(0, 17);
  return String(1000000000 + sequence).slice(0, 10);
}

function generatedDateOfBirth(idType: IdType, year: number, sequence: number) {
  const age = idType === IdType.BIRTH_ID ? 16 + (sequence % 4) : 20 + (sequence % 14);
  const birthYear = year - age;
  const month = String((sequence % 12) + 1).padStart(2, "0");
  const day = String((sequence % 27) + 1).padStart(2, "0");
  return `${birthYear}-${month}-${day}`;
}

function validateNumericIdentity(idType: IdType, value: string) {
  if (!/^\d+$/u.test(value)) throw new AppError(400, "ID number must contain digits only.");
  if (idType === IdType.NID && ![10, 13, 17].includes(value.length)) {
    throw new AppError(400, "NID must be 10, 13, or 17 digits.");
  }
  if (idType === IdType.BIRTH_ID && value.length !== 17) {
    throw new AppError(400, "Birth ID must be 17 digits.");
  }
}

function routeParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || value.length === 0) throw new AppError(400, `${name} is required`);
  return value;
}

function relatedOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function statusCounts(players: Array<{ status?: string | null; player_status?: string | null }>) {
  return {
    total: players.length,
    approved: players.filter((player) => player.status === RegistrationStatus.APPROVED).length,
    pending: players.filter((player) => player.status === RegistrationStatus.PENDING).length,
    draft: players.filter((player) => player.status === RegistrationStatus.DRAFT).length,
    rejected: players.filter((player) => player.status === RegistrationStatus.REJECTED).length,
    removed: players.filter((player) => player.player_status === PlayerLifecycleStatus.REMOVED).length,
    suspended: players.filter((player) => player.player_status === PlayerLifecycleStatus.SUSPENDED).length
  };
}

async function loadTeamPlayers(teamRegistrationId: string) {
  const { data, error } = await supabaseAdmin
    .from("player_season_registrations")
    .select(
      "id,player_id,season_id,team_registration_id,position,football_position,position_category,shirt_number,status,preferred_foot,player_status,player_code,identity_mode,is_generated,created_by_manager_id,created_at,updated_at,rejection_reason,removal_reason,suspension_reason,players(id,full_name,date_of_birth,nationality,id_type,id_number_last4,generated_identity_number,avatar_url)"
    )
    .eq("team_registration_id", teamRegistrationId)
    .order("shirt_number", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

async function loadManagerTeams(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("team_registrations")
    .select(
      "id,season_id,team_id,manager_id,status,rejection_reason,created_at,teams(*),seasons!team_registrations_season_id_fkey(id,name,season_year,format,phase,max_players_per_team,total_teams,lineup_size,substitute_limit,league_id,leagues(id,name,short_name,logo_url))"
    )
    .eq("manager_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function assertManagerOwnsPlayerRegistration(userId: string, playerRegistrationId: string) {
  const { data, error } = await supabaseAdmin
    .from("player_season_registrations")
    .select(
      "id,player_id,season_id,team_registration_id,status,shirt_number,football_position,position_category,preferred_foot,player_status,identity_mode,is_generated,players(id,full_name,date_of_birth,nationality,id_type,id_number_last4,generated_identity_number,avatar_url),team_registrations!inner(id,manager_id,season_id,team_id,teams(*),seasons!team_registrations_season_id_fkey(id,name,league_id,leagues(id,name)))"
    )
    .eq("id", playerRegistrationId)
    .single();
  if (error) throw error;
  const teamRegistration = relatedOne(data.team_registrations);
  if (!teamRegistration || teamRegistration.manager_id !== userId) {
    throw new AppError(403, "You do not manage this player");
  }
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
        logo_url: input.logo_url ?? null,
        primary_color: input.primary_color ?? null,
        secondary_color: input.secondary_color ?? null,
        accent_color: input.accent_color ?? null
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
        status: RegistrationStatus.DRAFT
      })
      .select("*,teams(*)")
      .single();
    if (error) throw error;
    res.status(201).json({ team_registration: data });
  })
);

managerRouter.post(
  "/teams",
  asyncHandler(async (req, res) => {
    const input = teamRegistrationSchema.parse(req.body);
    const { data: team, error: teamError } = await supabaseAdmin
      .from("teams")
      .insert({
        manager_id: req.auth!.userId,
        name: input.name,
        short_name: input.short_name,
        logo_url: input.logo_url ?? null,
        primary_color: input.primary_color ?? null,
        secondary_color: input.secondary_color ?? null,
        accent_color: input.accent_color ?? null
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
        status: RegistrationStatus.DRAFT
      })
      .select("*,teams(*),seasons!team_registrations_season_id_fkey(id,name,season_year,format,max_players_per_team,league_id,leagues(id,name,short_name,logo_url))")
      .single();
    if (error) throw error;
    res.status(201).json({ team: data });
  })
);

managerRouter.get(
  "/team-registrations",
  asyncHandler(async (req, res) => {
    const data = await loadManagerTeams(req.auth!.userId);
    res.json({ team_registrations: data });
  })
);

managerRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const [profileResult, teams] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,email,full_name,role").eq("id", req.auth!.userId).single(),
      loadManagerTeams(req.auth!.userId)
    ]);
    if (profileResult.error) throw profileResult.error;
    const activeTeam = teams[0] ?? null;
    if (!activeTeam) {
      return res.json({
        profile: profileResult.data,
        active_team: null,
        teams: [],
        squad_summary: null,
        fixtures: [],
        results: [],
        standings: [],
        messages: []
      });
    }

    const players = await loadTeamPlayers(activeTeam.id);
    const season = relatedOne(activeTeam.seasons);
    const maxPlayers = Number(season?.max_players_per_team ?? 22);
    const [{ data: fixtures, error: fixturesError }, { data: results, error: resultsError }, { data: standings, error: standingsError }, { data: messages, error: messagesError }] =
      await Promise.all([
        supabaseAdmin
          .from("fixtures")
          .select("*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url))")
          .or(`home_team_registration_id.eq.${activeTeam.id},away_team_registration_id.eq.${activeTeam.id}`)
          .order("kickoff_at", { ascending: true, nullsFirst: false })
          .limit(8),
        supabaseAdmin
          .from("fixtures")
          .select("*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url))")
          .or(`home_team_registration_id.eq.${activeTeam.id},away_team_registration_id.eq.${activeTeam.id}`)
          .eq("status", FixtureStatus.FINAL)
          .order("finalized_at", { ascending: false, nullsFirst: false })
          .limit(5),
        supabaseAdmin.from("standings").select("*,team_registrations(id,teams(name,short_name,logo_url))").eq("season_id", activeTeam.season_id),
        supabaseAdmin
          .from("manager_messages")
          .select("*")
          .eq("manager_id", req.auth!.userId)
          .order("created_at", { ascending: false })
          .limit(8)
      ]);
    if (fixturesError) throw fixturesError;
    if (resultsError) throw resultsError;
    if (standingsError) throw standingsError;
    if (messagesError) throw messagesError;

    const counts = statusCounts(players);
    res.json({
      profile: profileResult.data,
      active_team: activeTeam,
      teams,
      squad_summary: {
        ...counts,
        max_squad_size: maxPlayers,
        remaining_slots: Math.max(0, maxPlayers - players.length)
      },
      fixtures: fixtures ?? [],
      results: results ?? [],
      standings: standings ?? [],
      messages: messages ?? []
    });
  })
);

managerRouter.get(
  "/leagues",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("leagues")
      .select("*,seasons(id,name,season_year,format,phase,registration_start_date,registration_deadline,start_date,end_date,max_players_per_team,lineup_size,substitute_limit,total_teams)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ leagues: data ?? [] });
  })
);

managerRouter.get(
  "/seasons",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("seasons")
      .select("*,leagues(id,name,short_name,logo_url)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ seasons: data ?? [] });
  })
);

managerRouter.get(
  "/teams/:teamId",
  asyncHandler(async (req, res) => {
    const team = await assertManagerOwnsTeam(req.auth!.userId, routeParam(req.params.teamId, "teamId"));
    const players = await loadTeamPlayers(team.id);
    const season = relatedOne(team.seasons);
    const counts = statusCounts(players);
    res.json({
      team,
      players,
      squad_summary: {
        ...counts,
        max_squad_size: maxSquadSize(team),
        remaining_slots: Math.max(0, maxSquadSize(team) - players.length),
        distribution: currentDistribution(players)
      },
      season
    });
  })
);

managerRouter.patch(
  "/teams/:teamId",
  asyncHandler(async (req, res) => {
    const teamRegistration = await assertManagerOwnsTeam(req.auth!.userId, routeParam(req.params.teamId, "teamId"));
    if (![RegistrationStatus.DRAFT, RegistrationStatus.PENDING].includes(teamRegistration.status)) {
      throw new AppError(400, "Team settings can only be edited before admin approval");
    }
    const input = teamRegistrationSchema.omit({ season_id: true }).partial().parse(req.body);
    const { data, error } = await supabaseAdmin
      .from("teams")
      .update({
        name: input.name,
        short_name: input.short_name,
        logo_url: input.logo_url,
        primary_color: input.primary_color,
        secondary_color: input.secondary_color,
        accent_color: input.accent_color,
        updated_at: new Date().toISOString()
      })
      .eq("id", teamRegistration.team_id)
      .select("*")
      .single();
    if (error) throw error;
    res.json({ team: data });
  })
);

managerRouter.post(
  "/teams/:teamId/generate-squad",
  asyncHandler(async (req, res) => {
    const input = generateSquadSchema.parse(req.body);
    const teamRegistration = await assertManagerOwnsTeam(req.auth!.userId, routeParam(req.params.teamId, "teamId"));
    const maxPlayers = maxSquadSize(teamRegistration);
    const currentSeason = relatedOne(teamRegistration.seasons);
    const requestedTotalSize = input.targetSquadSize;
    const requestedGenerateCount = input.targetGenerateCount;
    if (requestedTotalSize && requestedTotalSize > maxPlayers) {
      throw new AppError(400, `Target squad size cannot exceed league max squad size (${maxPlayers})`);
    }

    let existingPlayers = await loadTeamPlayers(teamRegistration.id);
    if (input.overwriteDraftPlayers) {
      const removable = existingPlayers.filter((player) => player.status === RegistrationStatus.DRAFT).map((player) => player.id);
      if (removable.length > 0) {
        const { error } = await supabaseAdmin.from("player_season_registrations").delete().in("id", removable);
        if (error) throw error;
        existingPlayers = await loadTeamPlayers(teamRegistration.id);
      }
    }

    const currentSize = existingPlayers.length;
    const availableSlots = Math.max(0, maxPlayers - currentSize);
    const targetSize = Math.min(requestedTotalSize ?? currentSize + (requestedGenerateCount ?? availableSlots), maxPlayers);
    const generateCount = Math.max(0, Math.min(availableSlots, requestedGenerateCount ?? targetSize - currentSize));

    if (generateCount === 0) {
      return res.json({
        generated_players: [],
        squad_summary: {
          ...statusCounts(existingPlayers),
          max_squad_size: maxPlayers,
          remaining_slots: Math.max(0, maxPlayers - currentSize),
          distribution: currentDistribution(existingPlayers)
        }
      });
    }
    if (input.positionBreakdown) {
      const breakdownTotal = Object.values(input.positionBreakdown).reduce((sum, count) => sum + count, 0);
      if (breakdownTotal !== generateCount) throw new AppError(400, `Total selected players must equal ${generateCount}.`);
      if (breakdownTotal > availableSlots) throw new AppError(400, `You only have ${availableSlots} remaining squad slots.`);
      if (currentSize + breakdownTotal > maxPlayers) throw new AppError(400, "You cannot exceed max squad size.");
      if (currentSize + breakdownTotal >= 11) {
        const currentGk = existingPlayers.filter((player) => player.football_position === FootballPosition.GK || player.position === PlayerPosition.GK).length;
        if (currentGk + input.positionBreakdown.GK < 1) throw new AppError(400, "You need at least 1 goalkeeper.");
      }
    }

    const target = targetDistribution(targetSize);
    const current = currentDistribution(existingPlayers);
    const needed = neededDistribution(target, current, generateCount);
    const positionBreakdown = input.positionBreakdown ?? (requestedGenerateCount ? suggestedPositionBreakdown(generateCount) : undefined);
    const generated = generateSquadPlayers({
      count: generateCount,
      distribution: needed,
      positionBreakdown,
      usedNames: existingPlayers.map((player) => relatedOne(player.players)?.full_name).filter(Boolean) as string[],
      usedJerseys: existingPlayers.map((player) => player.shirt_number).filter((value): value is number => typeof value === "number"),
      seed: `${teamRegistration.id}:${teamRegistration.season_id}:${currentSize}:${targetSize}`
    });

    const { data: existingIdentities, error: identityError } = await supabaseAdmin
      .from("players")
      .select("generated_identity_number")
      .not("generated_identity_number", "is", null);
    if (identityError) throw identityError;
    const usedIdentities = new Set((existingIdentities ?? []).map((row) => row.generated_identity_number).filter(Boolean) as string[]);
    let identitySequence = usedIdentities.size + 1;
    const seasonYear = Number(currentSeason?.season_year ?? new Date().getFullYear());

    const createdRegistrations = [];
    for (const [index, playerInput] of generated.entries()) {
      const idType =
        input.identityTypeMode === "generated_birth_id"
          ? IdType.BIRTH_ID
          : input.identityTypeMode === "generated_nid"
            ? IdType.NID
            : index % 8 === 0
              ? IdType.BIRTH_ID
              : IdType.NID;
      let generatedIdentityNumber = generatedIdentity(idType, seasonYear, identitySequence);
      while (usedIdentities.has(generatedIdentityNumber)) {
        identitySequence += 1;
        generatedIdentityNumber = generatedIdentity(idType, seasonYear, identitySequence);
      }
      usedIdentities.add(generatedIdentityNumber);
      identitySequence += 1;
      const generatedHash = hashIdentityNumber(generatedIdentityNumber);
      const { data: player, error: playerError } = await supabaseAdmin
        .from("players")
        .insert({
          full_name: playerInput.full_name,
          date_of_birth: generatedDateOfBirth(idType, seasonYear, identitySequence),
          nationality: "Bangladesh",
          id_type: idType,
          id_number_hash: generatedHash,
          id_number_last4: identityLast4(generatedIdentityNumber),
          generated_identity_number: generatedIdentityNumber,
          avatar_url: playerInput.avatar_url || null
        })
        .select("*")
        .single();
      if (playerError) throw playerError;

      const { data: registration, error: registrationError } = await supabaseAdmin
        .from("player_season_registrations")
        .insert({
          player_id: player.id,
          season_id: teamRegistration.season_id,
          team_registration_id: teamRegistration.id,
          position: playerInput.position,
          football_position: playerInput.football_position,
          position_category: playerInput.position_category,
          shirt_number: playerInput.shirt_number,
          preferred_foot: playerInput.preferred_foot,
          status: RegistrationStatus.DRAFT,
          player_status: PlayerLifecycleStatus.ACTIVE,
          identity_mode: "VERIFIED",
          is_generated: false,
          created_by_manager_id: req.auth!.userId
        })
        .select("*,players(*)")
        .single();
      if (registrationError) throw registrationError;

      const code = playerCode(registration.id);
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("player_season_registrations")
        .update({ player_code: code, updated_at: new Date().toISOString() })
        .eq("id", registration.id)
        .select("*,players(*)")
        .single();
      if (updateError) throw updateError;
      createdRegistrations.push(updated);
    }

    const refreshedPlayers = await loadTeamPlayers(teamRegistration.id);
    res.status(201).json({
      generated_players: createdRegistrations,
      distribution: needed,
      position_breakdown: positionBreakdown,
      squad_summary: {
        ...statusCounts(refreshedPlayers),
        max_squad_size: maxPlayers,
        remaining_slots: Math.max(0, maxPlayers - refreshedPlayers.length),
        distribution: currentDistribution(refreshedPlayers)
      }
    });
  })
);

managerRouter.post(
  "/teams/:teamId/submit-players",
  asyncHandler(async (req, res) => {
    const input = submitPlayersSchema.parse(req.body);
    const teamRegistration = await assertManagerOwnsTeam(req.auth!.userId, routeParam(req.params.teamId, "teamId"));
    const players = await loadTeamPlayers(teamRegistration.id);
    const selected = players.filter((player) => input.playerIds.includes(player.id));
    if (selected.length !== input.playerIds.length) throw new AppError(400, "Some selected players do not belong to this team");
    if (selected.some((player) => player.status !== RegistrationStatus.DRAFT)) {
      throw new AppError(400, "Only Draft players can be submitted for approval");
    }
    const jerseyNumbers = players
      .map((player) => player.shirt_number)
      .filter((number): number is number => typeof number === "number");
    if (new Set(jerseyNumbers).size !== jerseyNumbers.length) throw new AppError(400, "Player jersey numbers must be unique");

    const { data, error } = await supabaseAdmin
      .from("player_season_registrations")
      .update({ status: RegistrationStatus.PENDING, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in("id", input.playerIds)
      .eq("team_registration_id", teamRegistration.id)
      .select("*,players(*)");
    if (error) throw error;
    if (teamRegistration.status === RegistrationStatus.DRAFT) {
      const { error: teamStatusError } = await supabaseAdmin
        .from("team_registrations")
        .update({ status: RegistrationStatus.PENDING, updated_at: new Date().toISOString() })
        .eq("id", teamRegistration.id);
      if (teamStatusError) throw teamStatusError;
    }
    res.json({ player_registrations: data ?? [] });
  })
);

managerRouter.get(
  "/teams/:teamId/players",
  asyncHandler(async (req, res) => {
    const teamRegistration = await assertManagerOwnsTeam(req.auth!.userId, routeParam(req.params.teamId, "teamId"));
    const players = await loadTeamPlayers(teamRegistration.id);
    res.json({ players });
  })
);

managerRouter.post(
  "/teams/:teamId/players",
  asyncHandler(async (req, res) => {
    const teamId = routeParam(req.params.teamId, "teamId");
    const input = playerSubmissionSchema.parse({ ...req.body, team_registration_id: teamId });
    const teamRegistration = await assertManagerOwnsTeam(req.auth!.userId, teamId);
    validateNumericIdentity(input.id_type, input.id_number);
    const players = await loadTeamPlayers(teamRegistration.id);
    if (players.length >= maxSquadSize(teamRegistration)) throw new AppError(400, "Squad max size reached");
    if (input.shirt_number && players.some((player) => player.shirt_number === input.shirt_number)) {
      throw new AppError(400, "Jersey number already exists in this team");
    }

    const idHash = hashIdentityNumber(input.id_number);
    const last4 = identityLast4(input.id_number);
    const footballPosition = input.football_position ?? footballPositionFromCoarse(input.position);

    const { data: player, error: playerError } = await supabaseAdmin
      .from("players")
      .upsert(
        {
          full_name: input.full_name,
          date_of_birth: input.date_of_birth,
          nationality: input.nationality ?? "Bangladesh",
          id_type: input.id_type,
          id_number_hash: idHash,
          id_number_last4: last4,
          avatar_url: input.avatar_url ?? null
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
        team_registration_id: teamRegistration.id,
        position: coarsePosition(footballPosition),
        football_position: footballPosition,
        position_category: categoryForFootballPosition(footballPosition),
        shirt_number: input.shirt_number ?? null,
        preferred_foot: input.preferred_foot ?? PreferredFoot.UNKNOWN,
        status: RegistrationStatus.PENDING,
        player_status: PlayerLifecycleStatus.ACTIVE,
        identity_mode: "VERIFIED",
        is_generated: false,
        created_by_manager_id: req.auth!.userId
      })
      .select("*,players(*)")
      .single();
    if (error) throw error;

    const { data: updated, error: codeError } = await supabaseAdmin
      .from("player_season_registrations")
      .update({ player_code: playerCode(registration.id), updated_at: new Date().toISOString() })
      .eq("id", registration.id)
      .select("*,players(*)")
      .single();
    if (codeError) throw codeError;

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
    if (teamRegistration.status === RegistrationStatus.DRAFT) {
      const { error: teamStatusError } = await supabaseAdmin
        .from("team_registrations")
        .update({ status: RegistrationStatus.PENDING, updated_at: new Date().toISOString() })
        .eq("id", teamRegistration.id);
      if (teamStatusError) throw teamStatusError;
    }

    res.status(201).json({ player_registration: updated });
  })
);

managerRouter.patch(
  "/players/:playerId",
  asyncHandler(async (req, res) => {
    const input = updateDraftPlayerSchema.parse(req.body);
    const registration = await assertManagerOwnsPlayerRegistration(req.auth!.userId, routeParam(req.params.playerId, "playerId"));
    if (![RegistrationStatus.DRAFT, RegistrationStatus.PENDING].includes(registration.status)) {
      throw new AppError(400, "Only Draft or Pending players can be edited");
    }
    const teamRegistration = relatedOne(registration.team_registrations);
    if (!teamRegistration) throw new AppError(404, "Team registration not found");

    if (input.shirt_number !== undefined) {
      const { data: duplicate, error: duplicateError } = await supabaseAdmin
        .from("player_season_registrations")
        .select("id")
        .eq("team_registration_id", registration.team_registration_id)
        .eq("shirt_number", input.shirt_number)
        .neq("id", registration.id)
        .neq("player_status", PlayerLifecycleStatus.REMOVED)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) throw new AppError(400, "This jersey number is already taken by another player in your squad.");
    }

    if (input.generated_identity_number !== undefined || input.id_type !== undefined) {
      const nextIdType = (input.id_type ?? relatedOne(registration.players)?.id_type) as IdType | undefined;
      const nextIdentityNumber = input.generated_identity_number ?? relatedOne(registration.players)?.generated_identity_number;
      if (!nextIdType || !nextIdentityNumber) throw new AppError(400, "ID type and ID number are required.");
      validateNumericIdentity(nextIdType, nextIdentityNumber);
      const { data: duplicateIdentity, error: duplicateIdentityError } = await supabaseAdmin
        .from("players")
        .select("id")
        .eq("generated_identity_number", nextIdentityNumber)
        .neq("id", registration.player_id)
        .maybeSingle();
      if (duplicateIdentityError) throw duplicateIdentityError;
      if (duplicateIdentity) throw new AppError(400, "This ID number is already used by another player.");
    }

    if (
      input.full_name !== undefined ||
      input.avatar_url !== undefined ||
      input.id_type !== undefined ||
      input.generated_identity_number !== undefined
    ) {
      const generatedIdentityNumber = input.generated_identity_number;
      const { error: playerError } = await supabaseAdmin
        .from("players")
        .update({
          full_name: input.full_name,
          id_type: input.id_type,
          generated_identity_number: generatedIdentityNumber,
          id_number_hash: generatedIdentityNumber ? hashIdentityNumber(generatedIdentityNumber) : undefined,
          id_number_last4: generatedIdentityNumber ? identityLast4(generatedIdentityNumber) : undefined,
          avatar_url: input.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq("id", registration.player_id);
      if (playerError) throw playerError;
    }

    const footballPosition = input.football_position ?? input.position;
    const { data, error } = await supabaseAdmin
      .from("player_season_registrations")
      .update({
        football_position: footballPosition,
        position: footballPosition ? coarsePosition(footballPosition) : undefined,
        position_category: footballPosition ? categoryForFootballPosition(footballPosition) : undefined,
        shirt_number: input.shirt_number,
        preferred_foot: input.preferred_foot,
        updated_at: new Date().toISOString()
      })
      .eq("id", registration.id)
      .select("*,players(*)")
      .single();
    if (error) throw error;
    res.json({ player_registration: data });
  })
);

managerRouter.delete(
  "/players/:playerId",
  asyncHandler(async (req, res) => {
    const registration = await assertManagerOwnsPlayerRegistration(req.auth!.userId, routeParam(req.params.playerId, "playerId"));
    if (![RegistrationStatus.DRAFT, RegistrationStatus.PENDING].includes(registration.status)) {
      throw new AppError(400, "Only Draft or Pending players can be removed by manager");
    }
    const { error } = await supabaseAdmin.from("player_season_registrations").delete().eq("id", registration.id);
    if (error) throw error;
    res.status(204).send();
  })
);

managerRouter.get(
  "/players/:playerId",
  asyncHandler(async (req, res) => {
    const player = await assertManagerOwnsPlayerRegistration(req.auth!.userId, routeParam(req.params.playerId, "playerId"));
    res.json({ player });
  })
);

managerRouter.get(
  "/players/:playerId/league-stats",
  asyncHandler(async (req, res) => {
    const player = await assertManagerOwnsPlayerRegistration(req.auth!.userId, routeParam(req.params.playerId, "playerId"));
    const [{ data: seasonStats, error: seasonError }, { data: matchStats, error: matchError }] = await Promise.all([
      supabaseAdmin.from("player_season_stats").select("*").eq("player_registration_id", player.id).maybeSingle(),
      supabaseAdmin
        .from("player_match_stats")
        .select("*,fixtures(id,kickoff_at,home_score,away_score,home_team_registration_id,away_team_registration_id)")
        .eq("player_registration_id", player.id)
        .order("created_at", { ascending: false })
    ]);
    if (seasonError) throw seasonError;
    if (matchError) throw matchError;
    res.json({ season_stats: seasonStats, match_stats: matchStats ?? [] });
  })
);

managerRouter.get(
  "/fixtures",
  asyncHandler(async (req, res) => {
    const teamId = typeof req.query.teamId === "string" ? req.query.teamId : undefined;
    const teams = await loadManagerTeams(req.auth!.userId);
    const ids = teamId ? teams.filter((team) => team.id === teamId).map((team) => team.id) : teams.map((team) => team.id);
    if (ids.length === 0) return res.json({ fixtures: [] });
    const clauses = ids.flatMap((id) => [`home_team_registration_id.eq.${id}`, `away_team_registration_id.eq.${id}`]);
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .select(
        "*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url)),lineups(id,team_registration_id,status,formation)"
      )
      .or(clauses.join(","))
      .order("kickoff_at", { ascending: true, nullsFirst: false });
    if (error) throw error;
    res.json({ fixtures: data ?? [] });
  })
);

managerRouter.get(
  "/results",
  asyncHandler(async (req, res) => {
    const teams = await loadManagerTeams(req.auth!.userId);
    const ids = teams.map((team) => team.id);
    if (ids.length === 0) return res.json({ results: [] });
    const clauses = ids.flatMap((id) => [`home_team_registration_id.eq.${id}`, `away_team_registration_id.eq.${id}`]);
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .select("*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url))")
      .or(clauses.join(","))
      .eq("status", FixtureStatus.FINAL)
      .order("finalized_at", { ascending: false, nullsFirst: false });
    if (error) throw error;
    res.json({ results: data ?? [] });
  })
);

managerRouter.get(
  "/standings",
  asyncHandler(async (req, res) => {
    const teams = await loadManagerTeams(req.auth!.userId);
    const seasonId = typeof req.query.seasonId === "string" ? req.query.seasonId : relatedOne(teams[0]?.seasons)?.id;
    if (!seasonId) return res.json({ standings: [] });
    const { data, error } = await supabaseAdmin
      .from("standings")
      .select("*,team_registrations(id,teams(name,short_name,logo_url))")
      .eq("season_id", seasonId)
      .order("points", { ascending: false })
      .order("goal_difference", { ascending: false })
      .order("goals_for", { ascending: false });
    if (error) throw error;
    res.json({ standings: data ?? [] });
  })
);

managerRouter.get(
  "/messages",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("manager_messages")
      .select("*,team_registrations(id,teams(name,short_name)),player_season_registrations(id,players(full_name)),fixtures(id,kickoff_at)")
      .eq("manager_id", req.auth!.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ messages: data ?? [] });
  })
);

managerRouter.patch(
  "/messages/:messageId/read",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("manager_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", req.params.messageId)
      .eq("manager_id", req.auth!.userId)
      .select("*")
      .single();
    if (error) throw error;
    res.json({ message: data });
  })
);

managerRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,role,created_at")
      .eq("id", req.auth!.userId)
      .single();
    if (error) throw error;
    res.json({ profile: data });
  })
);

managerRouter.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const fullName = typeof req.body?.full_name === "string" ? req.body.full_name.trim().slice(0, 160) : undefined;
    if (!fullName) throw new AppError(400, "Full name is required");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq("id", req.auth!.userId)
      .select("id,email,full_name,role,created_at")
      .single();
    if (error) throw error;
    res.json({ profile: data });
  })
);

managerRouter.get(
  "/matches/:matchId/detail",
  asyncHandler(async (req, res) => {
    const teams = await loadManagerTeams(req.auth!.userId);
    const ids = teams.map((team) => team.id);
    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from("fixtures")
      .select("*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url))")
      .eq("id", req.params.matchId)
      .single();
    if (fixtureError) throw fixtureError;
    if (!ids.includes(fixture.home_team_registration_id) && !ids.includes(fixture.away_team_registration_id)) {
      throw new AppError(403, "This match does not belong to your team");
    }
    const [{ data: lineups, error: lineupsError }, { data: teamStats, error: teamStatsError }, { data: playerStats, error: playerStatsError }, { data: events, error: eventsError }, { data: substitutions, error: substitutionsError }] =
      await Promise.all([
        supabaseAdmin.from("lineups").select("*,lineup_players(*,player_season_registrations(id,shirt_number,football_position,players(full_name,avatar_url)))").eq("fixture_id", fixture.id),
        supabaseAdmin.from("team_match_stats").select("*").eq("fixture_id", fixture.id),
        supabaseAdmin.from("player_match_stats").select("*,player_season_registrations(id,shirt_number,football_position,position,players(full_name,avatar_url))").eq("fixture_id", fixture.id),
        supabaseAdmin.from("match_events").select("*").eq("fixture_id", fixture.id).order("minute", { ascending: true }),
        supabaseAdmin.from("match_substitutions").select("*").eq("fixture_id", fixture.id).order("minute", { ascending: true })
      ]);
    if (lineupsError) throw lineupsError;
    if (teamStatsError) throw teamStatsError;
    if (playerStatsError) throw playerStatsError;
    if (eventsError) throw eventsError;
    if (substitutionsError) throw substitutionsError;
    res.json({ fixture, lineups: lineups ?? [], team_stats: teamStats ?? [], player_stats: playerStats ?? [], events: events ?? [], substitutions: substitutions ?? [] });
  })
);

managerRouter.post(
  "/matches/:matchId/lineup",
  asyncHandler(async (req, res) => {
    const input = lineupSubmissionSchema.parse({ ...req.body, fixture_id: req.params.matchId });
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
  "/matches/:matchId/lineup",
  asyncHandler(async (req, res) => {
    const teams = await loadManagerTeams(req.auth!.userId);
    const ids = teams.map((team) => team.id);
    const { data: lineups, error } = await supabaseAdmin
      .from("lineups")
      .select("*,lineup_players(*,player_season_registrations(id,shirt_number,football_position,players(full_name,avatar_url)))")
      .eq("fixture_id", req.params.matchId)
      .in("team_registration_id", ids);
    if (error) throw error;
    res.json({ lineups: lineups ?? [] });
  })
);

managerRouter.post(
  "/players",
  asyncHandler(async (req, res) => {
    const input = playerSubmissionSchema.parse(req.body);
    const teamRegistration = await assertManagerOwnsTeam(req.auth!.userId, input.team_registration_id);
    validateNumericIdentity(input.id_type, input.id_number);
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
    if (teamRegistration.status === RegistrationStatus.DRAFT) {
      const { error: teamStatusError } = await supabaseAdmin
        .from("team_registrations")
        .update({ status: RegistrationStatus.PENDING, updated_at: new Date().toISOString() })
        .eq("id", teamRegistration.id);
      if (teamStatusError) throw teamStatusError;
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
