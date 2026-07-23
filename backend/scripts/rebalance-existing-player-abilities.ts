import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  FootballPosition,
  PlayerPosition,
  type PlayerAbilityRating,
} from "@flms/shared";
import { generateAbilityScores } from "../src/domain/simulator.js";

config({ path: new URL("../.env", import.meta.url).pathname });

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

type AbilityRow = {
  id: string;
  player_registration_id: string;
  rating_tier: PlayerAbilityRating;
};

type RegistrationRow = {
  id: string;
  player_id: string;
  season_id: string;
  team_registration_id: string;
  position: PlayerPosition | null;
  football_position: FootballPosition | null;
};

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

function abilityUpdate(
  registration: RegistrationRow,
  tier: PlayerAbilityRating,
) {
  const footballPosition =
    registration.football_position ??
    coarseToFootballPosition(registration.position);
  const generated = generateAbilityScores(
    tier,
    footballPosition,
    `${registration.player_id}:${tier}:${footballPosition}:rebalance-v2`,
  );
  const base = {
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

const { data: abilities, error: abilityError } = await supabase
  .from("player_abilities")
  .select("id,player_registration_id,rating_tier");

if (abilityError) throw abilityError;

const abilityRows = (abilities ?? []) as AbilityRow[];
const registrationIds = [
  ...new Set(abilityRows.map((row) => row.player_registration_id)),
];

if (registrationIds.length === 0) {
  console.log("No player abilities found to rebalance.");
  process.exit(0);
}

const { data: registrations, error: registrationError } = await supabase
  .from("player_season_registrations")
  .select(
    "id,player_id,season_id,team_registration_id,position,football_position",
  )
  .in("id", registrationIds);

if (registrationError) throw registrationError;

const registrationById = new Map(
  ((registrations ?? []) as RegistrationRow[]).map((row) => [row.id, row]),
);
let updated = 0;
const updatedPlayerIds = new Set<string>();

for (const ability of abilityRows) {
  const registration = registrationById.get(ability.player_registration_id);
  if (!registration) continue;
  // One update is enough: the database synchronizes the player's global
  // ability profile to every season registration in the same transaction.
  if (updatedPlayerIds.has(registration.player_id)) continue;
  const { error } = await supabase
    .from("player_abilities")
    .update(abilityUpdate(registration, ability.rating_tier))
    .eq("id", ability.id);
  if (error) throw error;
  updatedPlayerIds.add(registration.player_id);
  updated += 1;
}

console.log(
  `Rebalanced ${updated} global player ability profiles with position-specific ranges.`,
);
