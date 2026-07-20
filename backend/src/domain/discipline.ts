export type DisciplinePhase = "LEAGUE" | "GROUP" | "KNOCKOUT";

export function disciplinePhaseForStage(stage: string): DisciplinePhase {
  if (stage === "LEAGUE") return "LEAGUE";
  if (stage === "GROUP") return "GROUP";
  return "KNOCKOUT";
}

export function isStageInDisciplinePhase(
  stage: string,
  phase: DisciplinePhase,
) {
  return disciplinePhaseForStage(stage) === phase;
}

export function crossedYellowThreshold(
  previousYellowCards: number,
  addedYellowCards: number,
  threshold: number,
) {
  if (threshold < 1 || addedYellowCards < 1) return false;
  return (
    Math.floor((previousYellowCards + addedYellowCards) / threshold) >
    Math.floor(previousYellowCards / threshold)
  );
}

export function yellowCardProgress(totalYellowCards: number, threshold: number) {
  if (threshold < 1) return 0;
  return Math.max(0, totalYellowCards) % threshold;
}
