import { describe, expect, it } from "vitest";
import { PlayerPosition, VenueSide } from "@flms/shared";
import { simulateMatch, type SimPlayer } from "../src/domain/simulator.js";

function players(side: VenueSide): SimPlayer[] {
  return Array.from({ length: 11 }, (_, index) => ({
    player_registration_id: `00000000-0000-4000-9000-${side === VenueSide.HOME ? "1" : "2"}${String(index).padStart(11, "0")}`,
    side,
    is_starter: true,
    position: index === 0 ? PlayerPosition.GK : index < 5 ? PlayerPosition.DEF : index < 8 ? PlayerPosition.MID : PlayerPosition.FWD,
    pace: 70 + (index % 6),
    shooting: 66 + (index % 8),
    passing: 68 + (index % 9),
    dribbling: 67 + (index % 7),
    defending: 65 + (index % 8),
    physical: 72 + (index % 5),
    goalkeeping: index === 0 ? 78 : 20
  }));
}

describe("simulator", () => {
  it("obeys core consistency caps", () => {
    const result = simulateMatch(players(VenueSide.HOME), players(VenueSide.AWAY), "8c74634e-9cc7-4a63-a8ec-5e3db8a92f11");
    expect(result.home_stats.possession + result.away_stats.possession).toBe(100);
    for (const [stats, goals] of [
      [result.home_stats, result.home_score],
      [result.away_stats, result.away_score]
    ] as const) {
      expect(stats.shots_on_target).toBeLessThanOrEqual(stats.shots);
      expect(stats.big_chances).toBeLessThanOrEqual(stats.shots);
      expect(stats.big_chances_missed).toBeLessThanOrEqual(stats.big_chances);
      expect(stats.accurate_passes).toBeLessThanOrEqual(stats.passes);
      expect(goals).toBeLessThanOrEqual(stats.shots_on_target);
    }
    for (const player of result.player_stats) {
      expect(player.successful_dribbles).toBeLessThanOrEqual(player.dribbles_attempted);
      expect(player.rating).toBeGreaterThanOrEqual(5.5);
      expect(player.rating).toBeLessThanOrEqual(9.5);
    }
  });
});
