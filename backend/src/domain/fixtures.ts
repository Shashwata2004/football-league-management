import { SeasonFormat } from "@flms/shared";
import { AppError } from "../errors.js";

export interface FixturePairing {
  round_no: number;
  stage: "LEAGUE" | "GROUP";
  home_team_registration_id: string;
  away_team_registration_id: string;
  group_name?: string;
}

export function assertValidKnockoutPath(groupCount: number, qualifiersPerGroup: number) {
  const total = groupCount * qualifiersPerGroup;
  if (![4, 8, 16, 32, 64].includes(total)) {
    throw new AppError(400, "Total knockout qualifiers must be exactly 4, 8, 16, 32, or 64");
  }
}

function balancedTeams(teamIds: string[]) {
  return teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, "__BYE__"];
}

export function generateRoundRobinPairings(teamIds: string[], doubleRound = false): FixturePairing[] {
  if (teamIds.length < 2) throw new AppError(400, "At least two approved teams are required");
  const teams = balancedTeams(teamIds);
  const rounds = teams.length - 1;
  const half = teams.length / 2;
  const pairings: FixturePairing[] = [];
  let rotation = [...teams];

  for (let round = 1; round <= rounds; round += 1) {
    for (let i = 0; i < half; i += 1) {
      const left = rotation[i];
      const right = rotation[rotation.length - 1 - i];
      if (!left || !right || left === "__BYE__" || right === "__BYE__") continue;
      const swap = round % 2 === 0;
      pairings.push({
        round_no: round,
        stage: "LEAGUE",
        home_team_registration_id: swap ? right : left,
        away_team_registration_id: swap ? left : right
      });
    }
    const fixed = rotation[0];
    const rest = rotation.slice(1);
    const moved = rest.pop();
    rotation = [fixed!, moved!, ...rest];
  }

  if (!doubleRound) return pairings;

  const reverse = pairings.map((pairing) => ({
    ...pairing,
    round_no: pairing.round_no + rounds,
    home_team_registration_id: pairing.away_team_registration_id,
    away_team_registration_id: pairing.home_team_registration_id
  }));
  return [...pairings, ...reverse];
}

export function generateGroupStagePairings(
  teamIds: string[],
  groupCount: number,
  qualifiersPerGroup: number
): FixturePairing[] {
  assertValidKnockoutPath(groupCount, qualifiersPerGroup);
  if (teamIds.length < groupCount * qualifiersPerGroup) {
    throw new AppError(400, "Not enough teams for the configured group qualification path");
  }

  const groups = Array.from({ length: groupCount }, () => [] as string[]);
  teamIds.forEach((teamId, index) => groups[index % groupCount]!.push(teamId));

  return groups.flatMap((group, groupIndex) => {
    const groupName = String.fromCharCode(65 + groupIndex);
    return generateRoundRobinPairings(group, false).map((pairing) => ({
      ...pairing,
      stage: "GROUP" as const,
      group_name: groupName
    }));
  });
}

export function generateSeasonPairings(
  format: SeasonFormat,
  teamIds: string[],
  groupCount?: number | null,
  qualifiersPerGroup?: number | null
) {
  switch (format) {
    case SeasonFormat.SINGLE_ROUND_ROBIN:
      return generateRoundRobinPairings(teamIds, false);
    case SeasonFormat.DOUBLE_ROUND_ROBIN:
      return generateRoundRobinPairings(teamIds, true);
    case SeasonFormat.GROUP_STAGE_KNOCKOUT:
      if (!groupCount || !qualifiersPerGroup) {
        throw new AppError(400, "Group count and qualifiers per group are required");
      }
      return generateGroupStagePairings(teamIds, groupCount, qualifiersPerGroup);
    default:
      throw new AppError(400, "Unsupported season format");
  }
}
