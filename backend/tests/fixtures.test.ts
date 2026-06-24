import { describe, expect, it } from "vitest";
import { SeasonFormat } from "@flms/shared";
import { generateRoundRobinPairings, generateSeasonPairings } from "../src/domain/fixtures.js";

describe("fixture generation", () => {
  it("creates correct single round-robin pair count", () => {
    const fixtures = generateRoundRobinPairings(["a", "b", "c", "d"], false);
    expect(fixtures).toHaveLength(6);
  });

  it("creates correct double round-robin pair count", () => {
    const fixtures = generateRoundRobinPairings(["a", "b", "c", "d"], true);
    expect(fixtures).toHaveLength(12);
  });

  it("rejects invalid group knockout qualifier counts", () => {
    expect(() => generateSeasonPairings(SeasonFormat.GROUP_STAGE_KNOCKOUT, ["a", "b", "c", "d", "e", "f"], 3, 2)).toThrow(
      /qualifiers/
    );
  });
});
