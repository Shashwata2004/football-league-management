import { describe, expect, it } from "vitest";
import { indexPlayerSeasonContributions } from "../src/services/player-stats.js";

describe("player season contributions", () => {
  it("indexes confirmed season goal and assist totals by registration", () => {
    const contributions = indexPlayerSeasonContributions([
      {
        player_registration_id: "player-1",
        goals: 2,
        assists: 2,
      },
      {
        player_registration_id: "player-2",
        goals: 0,
        assists: 1,
      },
    ]);

    expect(contributions.get("player-1")).toEqual({ goals: 2, assists: 2 });
    expect(contributions.get("player-2")).toEqual({ goals: 0, assists: 1 });
    expect(contributions.get("missing-player")).toBeUndefined();
  });

  it("normalizes null and negative aggregate values safely", () => {
    const contributions = indexPlayerSeasonContributions([
      {
        player_registration_id: "player-1",
        goals: null,
        assists: -3,
      },
    ]);

    expect(contributions.get("player-1")).toEqual({ goals: 0, assists: 0 });
  });
});
