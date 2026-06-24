import { describe, expect, it } from "vitest";
import { PlayerPosition, VenueSide, type LineupSubmissionInput } from "@flms/shared";
import { validateLineupSubmission } from "../src/domain/lineups.js";

function lineup(overrides: Partial<LineupSubmissionInput> = {}): LineupSubmissionInput {
  return {
    fixture_id: "2c74634e-9cc7-4a63-a8ec-5e3db8a92f11",
    team_registration_id: "3c74634e-9cc7-4a63-a8ec-5e3db8a92f11",
    side: VenueSide.HOME,
    formation: "4-3-3",
    players: Array.from({ length: 11 }, (_, index) => ({
      player_registration_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      is_starter: true,
      position: index === 0 ? PlayerPosition.GK : index < 5 ? PlayerPosition.DEF : index < 8 ? PlayerPosition.MID : PlayerPosition.FWD
    })),
    ...overrides
  };
}

const registered = lineup().players.map((player) => ({
  id: player.player_registration_id,
  team_registration_id: "3c74634e-9cc7-4a63-a8ec-5e3db8a92f11",
  season_id: "4c74634e-9cc7-4a63-a8ec-5e3db8a92f11",
  status: "APPROVED"
}));

describe("lineup validation", () => {
  it("accepts exactly 11 starters with one goalkeeper", () => {
    expect(validateLineupSubmission(lineup(), registered, "4c74634e-9cc7-4a63-a8ec-5e3db8a92f11")).toBe(true);
  });

  it("rejects missing goalkeeper", () => {
    const input = lineup({
      players: lineup().players.map((player) => ({ ...player, position: PlayerPosition.DEF }))
    });
    expect(() => validateLineupSubmission(input, registered, "4c74634e-9cc7-4a63-a8ec-5e3db8a92f11")).toThrow(/goalkeeper/);
  });

  it("rejects duplicate player", () => {
    const input = lineup();
    input.players[1]!.player_registration_id = input.players[0]!.player_registration_id;
    expect(() => validateLineupSubmission(input, registered, "4c74634e-9cc7-4a63-a8ec-5e3db8a92f11")).toThrow(/duplicate/);
  });
});
