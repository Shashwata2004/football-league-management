import { describe, expect, it } from "vitest";
import {
  rebuildPlayerSeasonStatRows,
  rebuildStandingRows,
} from "../src/services/season-aggregate-rebuilder.js";

describe("season aggregate rebuilding", () => {
  it("derives standings from confirmed fixtures without retaining prior increments", () => {
    const fixtures = [
      {
        id: "fixture-1",
        stage: "GROUP",
        result_confirmed: true,
        home_team_registration_id: "royal",
        away_team_registration_id: "bengal",
        home_score: 3,
        away_score: 1,
      },
      {
        id: "fixture-2",
        stage: "GROUP",
        result_confirmed: true,
        home_team_registration_id: "royal",
        away_team_registration_id: "metro",
        home_score: 2,
        away_score: 1,
      },
      {
        id: "fixture-3",
        stage: "GROUP",
        result_confirmed: true,
        home_team_registration_id: "southside",
        away_team_registration_id: "royal",
        home_score: 2,
        away_score: 2,
      },
    ];
    const rows = rebuildStandingRows(
      "season",
      ["royal", "bengal", "metro", "southside"],
      fixtures,
      [
        {
          fixture_id: "fixture-1",
          team_registration_id: "royal",
          yellow_cards: 1,
          red_cards: 0,
        },
      ],
      new Map([["royal", 2]]),
      "2026-07-20T00:00:00.000Z",
    );

    expect(rows.find((row) => row.team_registration_id === "royal")).toEqual(
      expect.objectContaining({
        won: 2,
        drawn: 1,
        lost: 0,
        goals_for: 7,
        goals_against: 4,
        fair_play_score: -1,
        admin_draw_rank: 2,
      }),
    );
    expect(
      rows.find((row) => row.team_registration_id === "southside"),
    ).toEqual(
      expect.objectContaining({
        won: 0,
        drawn: 1,
        lost: 0,
        goals_for: 2,
        goals_against: 2,
      }),
    );
  });

  it("rebuilds player totals from match rows and is repeatable", () => {
    const matches = [
      {
        player_registration_id: "player-1",
        minutes: 90,
        goals: 1,
        assists: 0,
        shots: 3,
        shots_on_target: 2,
        chances_created: 1,
        big_chances_created: 0,
        passes: 40,
        accurate_passes: 35,
        dribbles_attempted: 4,
        successful_dribbles: 3,
        dribbled_past: 1,
        dispossessed: 2,
        tackles: 2,
        interceptions: 1,
        yellow_cards: 0,
        red_cards: 0,
        rating: 7.4,
      },
      {
        player_registration_id: "player-1",
        minutes: 70,
        goals: 0,
        assists: 1,
        shots: 1,
        shots_on_target: 0,
        chances_created: 2,
        big_chances_created: 1,
        passes: 30,
        accurate_passes: 24,
        dribbles_attempted: 2,
        successful_dribbles: 1,
        dribbled_past: 0,
        dispossessed: 1,
        tackles: 1,
        interceptions: 2,
        yellow_cards: 1,
        red_cards: 0,
        rating: 6.8,
      },
    ];
    const first = rebuildPlayerSeasonStatRows(
      "season",
      ["player-1"],
      matches,
      "2026-07-20T00:00:00.000Z",
    );
    const second = rebuildPlayerSeasonStatRows(
      "season",
      ["player-1"],
      matches,
      "2026-07-20T00:00:00.000Z",
    );

    expect(second).toEqual(first);
    expect(first[0]).toEqual(
      expect.objectContaining({
        appearances: 2,
        starts: 2,
        minutes_played: 160,
        goals: 1,
        assists: 1,
        total_passes: 70,
        accurate_passes: 59,
        yellow_cards: 1,
        average_rating: 7.1,
        best_match_rating: 7.4,
        lowest_match_rating: 6.8,
      }),
    );
    expect(
      rebuildPlayerSeasonStatRows(
        "season",
        ["player-without-a-match"],
        [],
        "2026-07-20T00:00:00.000Z",
      ),
    ).toEqual([]);
  });
});
