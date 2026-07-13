import { describe, expect, it } from "vitest";
import {
  crossedYellowThreshold,
  disciplinePhaseForStage,
  isStageInDisciplinePhase,
  yellowCardProgress,
} from "../src/domain/discipline.js";

describe("yellow-card discipline", () => {
  it("separates league, group and knockout accumulation phases", () => {
    expect(disciplinePhaseForStage("LEAGUE")).toBe("LEAGUE");
    expect(disciplinePhaseForStage("GROUP")).toBe("GROUP");
    expect(disciplinePhaseForStage("QUARTER_FINAL")).toBe("KNOCKOUT");
    expect(isStageInDisciplinePhase("SEMI_FINAL", "KNOCKOUT")).toBe(true);
    expect(isStageInDisciplinePhase("GROUP", "KNOCKOUT")).toBe(false);
  });

  it("detects each threshold crossing without a redundant counter", () => {
    expect(crossedYellowThreshold(1, 1, 3)).toBe(false);
    expect(crossedYellowThreshold(2, 1, 3)).toBe(true);
    expect(crossedYellowThreshold(5, 1, 3)).toBe(true);
    expect(crossedYellowThreshold(3, 0, 3)).toBe(false);
    expect(yellowCardProgress(5, 3)).toBe(2);
    expect(yellowCardProgress(6, 3)).toBe(0);
  });
});
