import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  FootballPosition,
  PlayerPosition,
  type PlayerAbilityRating,
} from "@flms/shared";
import { generateAbilityScores } from "../src/domain/simulator.js";

config({ path: resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function coarseToFootballPosition(
  position?: PlayerPosition | string | null,
): FootballPosition {
  if (position === PlayerPosition.GK || position === "GK")
    return FootballPosition.GK;
  if (position === PlayerPosition.DEF || position === "DEF")
    return FootballPosition.CB;
  if (position === PlayerPosition.MID || position === "MID")
    return FootballPosition.CM;
  return FootballPosition.ST;
}

type Registration = {
  id: string;
  player_id: string;
  season_id: string;
  team_registration_id: string;
  position: string | null;
  football_position: FootballPosition | null;
  ability_rating: PlayerAbilityRating | null;
  status: string;
  player_status: string;
};

function abilityRow(registration: Registration) {
  const tier = registration.ability_rating as PlayerAbilityRating;
  const footballPosition =
    registration.football_position ??
    coarseToFootballPosition(registration.position);
  const generated = generateAbilityScores(
    tier,
    footballPosition,
    `${registration.player_id}:${tier}:${footballPosition}`,
  );
  const base = {
    player_registration_id: registration.id,
    player_id: registration.player_id,
    season_id: registration.season_id,
    team_registration_id: registration.team_registration_id,
    position: generated.position,
    rating_tier: generated.rating_tier,
    overall_rating: generated.overall_rating,
    generated_at: new Date().toISOString(),
    is_hidden_from_manager: true,
  };
  if (generated.position === FootballPosition.GK) {
    return {
      ...base,
      shooting: null,
      passing: null,
      dribbling: null,
      defending: null,
      pace: null,
      stamina: null,
      physical: generated.physical,
      shot_stopping: generated.shot_stopping,
      reflexes: generated.reflexes,
      positioning: generated.positioning,
      handling: generated.handling,
      diving: generated.diving,
      distribution: generated.distribution,
      communication: generated.communication,
    };
  }
  return {
    ...base,
    shooting: generated.shooting,
    passing: generated.passing,
    dribbling: generated.dribbling,
    defending: generated.defending,
    physical: generated.physical,
    pace: generated.pace,
    stamina: generated.stamina,
    shot_stopping: null,
    reflexes: null,
    positioning: null,
    handling: null,
    diving: null,
    distribution: null,
    communication: null,
  };
}

// 1. Find APPROVED teams whose carried-over (rated) players are still stuck as
//    DRAFT/PENDING — these were approved before auto-approval existed.
const { data: teams, error: teamsError } = await supabase
  .from("team_registrations")
  .select("id")
  .eq("status", "APPROVED");
if (teamsError) throw teamsError;

let backfilled = 0;
let approved = 0;

for (const team of teams ?? []) {
  const { data: players, error } = await supabase
    .from("player_season_registrations")
    .select(
      "id,player_id,season_id,team_registration_id,position,football_position,ability_rating,status,player_status,player_abilities(player_registration_id)",
    )
    .eq("team_registration_id", team.id)
    .in("status", ["DRAFT", "PENDING"])
    .neq("player_status", "REMOVED")
    .neq("player_status", "SUSPENDED");
  if (error) throw error;

  const carried = (players ?? []).filter((p) => Boolean(p.ability_rating));
  if (carried.length === 0) continue;

  const missing = carried.filter((p) => {
    const ability = Array.isArray(p.player_abilities)
      ? p.player_abilities[0]
      : p.player_abilities;
    return !ability;
  });
  if (missing.length > 0) {
    const rows = missing.map((p) => abilityRow(p as Registration));
    const { error: abilityError } = await supabase
      .from("player_abilities")
      .upsert(rows, { onConflict: "player_registration_id" });
    if (abilityError) throw abilityError;
    backfilled += rows.length;
  }

  const ids = carried.map((p) => p.id);
  const { data: updated, error: updateError } = await supabase
    .from("player_season_registrations")
    .update({
      status: "APPROVED",
      player_status: "ACTIVE",
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .select("id,season_id");
  if (updateError) throw updateError;
  approved += updated?.length ?? 0;

  const statsRows = (updated ?? []).map((p) => ({
    season_id: p.season_id,
    player_registration_id: p.id,
    appearances: 0,
    goals: 0,
    assists: 0,
    yellow_cards: 0,
    red_cards: 0,
    average_rating: null,
  }));
  if (statsRows.length > 0) {
    const { error: statsError } = await supabase
      .from("player_season_stats")
      .upsert(statsRows, { onConflict: "season_id,player_registration_id" });
    if (statsError) throw statsError;
  }
}

console.log(
  `Repair complete. Backfilled ${backfilled} ability rows, approved ${approved} carried-over players.`,
);
