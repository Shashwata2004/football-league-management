import { PlayerPosition, type LineupSubmissionInput } from "@flms/shared";
import { AppError } from "../errors.js";

export interface RegisteredPlayerForValidation {
  id: string;
  team_registration_id: string;
  season_id: string;
  status: string;
  player_status?: string | null;
}

export function validateLineupSubmission(
  input: LineupSubmissionInput,
  registeredPlayers: RegisteredPlayerForValidation[],
  seasonId: string
) {
  const approvedIds = new Set(
    registeredPlayers
      .filter((player) => player.status === "APPROVED" && player.team_registration_id === input.team_registration_id && player.player_status !== "REMOVED" && player.player_status !== "SUSPENDED")
      .map((player) => player.id)
  );
  const seen = new Set<string>();
  const starters = input.players.filter((player) => player.is_starter);
  const bench = input.players.filter((player) => !player.is_starter);

  if (starters.length !== 11) throw new AppError(400, "Lineup must contain exactly 11 starters");
  if (bench.length > 9) throw new AppError(400, "Bench can contain at most 9 players");
  if (starters.filter((player) => player.position === PlayerPosition.GK).length !== 1) {
    throw new AppError(400, "Lineup must contain exactly one starting goalkeeper");
  }

  for (const player of input.players) {
    if (seen.has(player.player_registration_id)) {
      throw new AppError(400, "Lineup contains a duplicate player");
    }
    seen.add(player.player_registration_id);
    if (!approvedIds.has(player.player_registration_id)) {
      throw new AppError(400, "Lineup contains a player who is not approved for this team");
    }
    const dbPlayer = registeredPlayers.find((candidate) => candidate.id === player.player_registration_id);
    if (!dbPlayer || dbPlayer.season_id !== seasonId) {
      throw new AppError(400, "Lineup contains a player from the wrong season");
    }
  }

  return true;
}
