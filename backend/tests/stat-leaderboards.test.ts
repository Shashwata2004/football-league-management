import { describe, expect, it } from "vitest";
import { makeLeaderboard } from "../src/services/stat-leaderboards.js";

type TestPlayerRow = {
  id: string;
  name: string;
  team: string;
  teamLogoUrl: string | null;
  avatarUrl: string | null;
  goals: number;
  assists: number;
  rating: number;
};

function player(
  id: string,
  goals: number,
  assists: number,
  rating: number,
): TestPlayerRow {
  return {
    id,
    name: `Player ${id}`,
    team: "Test FC",
    teamLogoUrl: null,
    avatarUrl: null,
    goals,
    assists,
    rating,
  };
}

describe("canonical player leaderboard tie-breakers", () => {
  it("orders equal top scorers by assists and then rating", () => {
    const leaderboard = makeLeaderboard(
      "top_scorer",
      "Top Scorer",
      [
        player("a", 10, 4, 8),
        player("b", 10, 5, 7),
        player("c", 10, 5, 7.5),
      ],
      "goals",
      "number",
    );

    expect(leaderboard.entries.map((entry) => entry.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("orders equal top assisters by goals and then rating", () => {
    const leaderboard = makeLeaderboard(
      "assists",
      "Assists",
      [
        player("a", 4, 8, 8),
        player("b", 5, 8, 7),
        player("c", 5, 8, 7.5),
      ],
      "assists",
      "number",
    );

    expect(leaderboard.entries.map((entry) => entry.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });
});
