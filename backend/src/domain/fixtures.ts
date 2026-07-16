import { SeasonFormat } from "@flms/shared";
import { AppError } from "../errors.js";

export interface FixturePairing {
  round_no: number;
  stage: "LEAGUE" | "GROUP";
  home_team_registration_id: string;
  away_team_registration_id: string;
  group_name?: string;
}

export interface FixtureTeam {
  id: string;
  name?: string | null;
  short_name?: string | null;
  logo_url?: string | null;
}

export interface FixtureGroup {
  id: string;
  name: string;
  locked: boolean;
  teams: FixtureTeam[];
}

export interface ScheduledFixturePreview {
  round_no: number;
  matchday_number: number;
  stage: string;
  group_id?: string | null;
  group_name?: string | null;
  home_team_registration_id?: string | null;
  away_team_registration_id?: string | null;
  home_source?: string | null;
  away_source?: string | null;
  kickoff_at?: string | null;
  status: string;
}

export interface FixturePreviewResult {
  fixtures: ScheduledFixturePreview[];
  warnings: string[];
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

export function groupRoundRobinRounds(teamIds: string[], doubleRound = false) {
  const pairings = generateRoundRobinPairings(teamIds, doubleRound);
  const rounds = new Map<number, FixturePairing[]>();
  for (const pairing of pairings) {
    rounds.set(pairing.round_no, [...(rounds.get(pairing.round_no) ?? []), pairing]);
  }
  return Array.from(rounds.entries())
    .sort(([a], [b]) => a - b)
    .map(([, fixtures]) => fixtures);
}

export function generateLeagueFixturePreview(params: {
  leagueId?: string | null;
  seasonId: string;
  teams: FixtureTeam[];
  roundFormat: "SINGLE_ROUND_ROBIN" | "DOUBLE_ROUND_ROBIN";
  startDate?: string | null;
  endDate?: string | null;
}): FixturePreviewResult {
  if (params.teams.length < 2) throw new AppError(400, "At least two approved teams are required");
  const doubleRound = params.roundFormat === SeasonFormat.DOUBLE_ROUND_ROBIN;
  const rounds = groupRoundRobinRounds(params.teams.map((team) => team.id), doubleRound);
  const warnings: string[] = [];
  const roundDates = distributeRoundDates(rounds.length, params.startDate, params.endDate, warnings);
  return {
    warnings,
    fixtures: rounds.flatMap((round, roundIndex) =>
      round.map((pairing, pairingIndex) => ({
        round_no: pairing.round_no,
        matchday_number: roundIndex + 1,
        stage: "LEAGUE",
        group_id: null,
        group_name: null,
        home_team_registration_id: pairing.home_team_registration_id,
        away_team_registration_id: pairing.away_team_registration_id,
        home_source: null,
        away_source: null,
        kickoff_at: roundDates[roundIndex] ? toEveningKickoffIso(parseDate(roundDates[roundIndex]) ?? new Date(), pairingIndex) : null,
        status: "SCHEDULED"
      }))
    )
  };
}

export function generateGroupFixturePreview(params: {
  groups: FixtureGroup[];
  roundFormat: "SINGLE_ROUND_ROBIN" | "DOUBLE_ROUND_ROBIN";
  teamsPerGroup: number;
  qualifiersPerGroup: number;
  startDate?: string | null;
  endDate?: string | null;
}): FixturePreviewResult {
  validateGroupSetup(params.groups, params.teamsPerGroup, params.qualifiersPerGroup);
  const doubleRound = params.roundFormat === SeasonFormat.DOUBLE_ROUND_ROBIN;
  const groupRoundsByGroup = new Map<string, FixturePairing[][]>();
  for (const group of params.groups) {
    groupRoundsByGroup.set(group.id, groupRoundRobinRounds(group.teams.map((team) => team.id), doubleRound));
  }
  const warnings: string[] = [];
  const currentDate = parseDate(params.startDate);
  const endDate = parseDate(params.endDate);
  if (!currentDate || !endDate) warnings.push("Season start date and end date should be set before saving fixtures.");
  const scheduled: ScheduledFixturePreview[] = [];
  const lastPlayedDateByGroup = new Map<string, Date>();
  const maxGroupMatchdays = Math.max(...Array.from(groupRoundsByGroup.values()).map((rounds) => rounds.length), 0);
  let cursor = currentDate ?? new Date();

  for (let matchdayIndex = 0; matchdayIndex < maxGroupMatchdays; matchdayIndex += 1) {
    for (const group of params.groups) {
      const roundFixtures = groupRoundsByGroup.get(group.id)?.[matchdayIndex];
      if (!roundFixtures || roundFixtures.length === 0) continue;

      while (true) {
        const lastDate = lastPlayedDateByGroup.get(group.id);
        if (!lastDate || daysBetween(lastDate, cursor) >= 2) break;
        cursor = addDays(cursor, 1);
      }

      for (const [fixtureIndex, fixture] of roundFixtures.entries()) {
        scheduled.push({
          round_no: matchdayIndex + 1,
          matchday_number: matchdayIndex + 1,
          stage: "GROUP",
          group_id: group.id,
          group_name: group.name,
          home_team_registration_id: fixture.home_team_registration_id,
          away_team_registration_id: fixture.away_team_registration_id,
          home_source: null,
          away_source: null,
          kickoff_at: toEveningKickoffIso(cursor, fixtureIndex),
          status: "SCHEDULED"
        });
      }

      lastPlayedDateByGroup.set(group.id, cursor);
      cursor = addDays(cursor, 1);
    }
  }

  if (endDate && scheduled.some((fixture) => fixture.kickoff_at && parseDate(fixture.kickoff_at)! > endDate)) {
    warnings.push("Season date range is too short for ideal World Cup-style group scheduling.");
  }

  return { fixtures: scheduled, warnings };
}

export function generateKnockoutFixturePreview(params: {
  qualifiers: Array<{ groupName: string; rank: number; team_registration_id: string }>;
  startDate?: string | null;
  endDate?: string | null;
}): FixturePreviewResult {
  const total = params.qualifiers.length;
  assertPowerOfTwoQualifiers(total);
  const warnings: string[] = [];
  const firstStage = knockoutStageForSize(total);
  const firstRoundTeams = pairFirstKnockoutRound(params.qualifiers);
  const fixtures: ScheduledFixturePreview[] = [];
  let roundSize = total;
  let roundNo = 1;
  let nextMatchNo = 1;
  let cursor = addDays(parseDate(params.startDate) ?? new Date(), 2);
  let previousRoundLabels: string[] = [];

  for (let index = 0; index < firstRoundTeams.length; index += 2) {
    previousRoundLabels.push(shortKnockoutLabel(nextMatchNo));
    nextMatchNo += 1;
    fixtures.push({
      round_no: roundNo,
      matchday_number: roundNo,
      stage: firstStage,
      home_team_registration_id: firstRoundTeams[index]?.team_registration_id ?? null,
      away_team_registration_id: firstRoundTeams[index + 1]?.team_registration_id ?? null,
      home_source: null,
      away_source: null,
      kickoff_at: toEveningKickoffIso(cursor, Math.floor(index / 2)),
      status: "SCHEDULED"
    });
  }

  while (roundSize > 2) {
    roundSize = roundSize / 2;
    roundNo += 1;
    cursor = addDays(cursor, roundSize === 2 ? 3 : 2);
    const stage = knockoutStageForSize(roundSize);
    const currentRoundMatches = roundSize / 2;
    const currentRoundLabels: string[] = [];
    for (let i = 1; i <= currentRoundMatches; i += 1) {
      const previousA = previousRoundLabels[i * 2 - 2] ?? "previous knockout match";
      const previousB = previousRoundLabels[i * 2 - 1] ?? "previous knockout match";
      currentRoundLabels.push(shortKnockoutLabel(nextMatchNo));
      nextMatchNo += 1;
      fixtures.push({
        round_no: roundNo,
        matchday_number: roundNo,
        stage,
        home_team_registration_id: null,
        away_team_registration_id: null,
        home_source: `Winner of ${previousA}`,
        away_source: `Winner of ${previousB}`,
        kickoff_at: toEveningKickoffIso(cursor, i - 1),
        status: "WAITING_FOR_TEAMS"
      });
    }
    previousRoundLabels = currentRoundLabels;
  }

  const endDate = parseDate(params.endDate);
  if (endDate && fixtures.some((fixture) => fixture.kickoff_at && parseDate(fixture.kickoff_at)! > endDate)) {
    warnings.push("Season date range is too short for ideal knockout spacing.");
  }

  return { fixtures, warnings };
}

function validateGroupSetup(groups: FixtureGroup[], teamsPerGroup: number, qualifiersPerGroup: number) {
  if (!groups.length) throw new AppError(400, "Groups must be created before generating group fixtures.");
  if (!teamsPerGroup || !qualifiersPerGroup) throw new AppError(400, "Group settings are missing.");
  if (qualifiersPerGroup >= teamsPerGroup) throw new AppError(400, "Qualifiers per group must be less than teams per group.");
  assertPowerOfTwoQualifiers(groups.length * qualifiersPerGroup);
  const seen = new Set<string>();
  for (const group of groups) {
    if (group.teams.length !== teamsPerGroup) {
      throw new AppError(400, `${group.name} must have exactly ${teamsPerGroup} teams.`);
    }
    for (const team of group.teams) {
      if (seen.has(team.id)) throw new AppError(400, "A team cannot appear in more than one group.");
      seen.add(team.id);
    }
  }
}

export function assertPowerOfTwoQualifiers(total: number) {
  if (![4, 8, 16, 32, 64].includes(total)) {
    throw new AppError(400, "Invalid knockout format. Total qualifiers must be 4, 8, 16, 32, or 64.");
  }
}

function distributeRoundDates(roundCount: number, startDate: string | null | undefined, endDate: string | null | undefined, warnings: string[]) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) {
    warnings.push("Season start date and end date should be set before saving fixtures.");
    return Array.from({ length: roundCount }, (_, index) => toEveningKickoffIso(addDays(new Date(), index * 2)));
  }
  const availableDays = Math.max(0, daysBetween(start, end));
  const interval = Math.max(Math.floor(availableDays / Math.max(roundCount - 1, 1)), 2);
  const dates = Array.from({ length: roundCount }, (_, index) => toEveningKickoffIso(addDays(start, index * interval)));
  if (dates.some((date) => parseDate(date)! > end)) {
    warnings.push("Season date range is too short for clean fixture spacing.");
  }
  return dates;
}

function pairFirstKnockoutRound(qualifiers: Array<{ groupName: string; rank: number; team_registration_id: string }>) {
  const byGroup = new Map<string, typeof qualifiers>();
  for (const qualifier of qualifiers) byGroup.set(qualifier.groupName, [...(byGroup.get(qualifier.groupName) ?? []), qualifier]);
  const groupNames = Array.from(byGroup.keys()).sort();
  const ordered: typeof qualifiers = [];
  for (let index = 0; index < groupNames.length; index += 2) {
    const groupA = byGroup.get(groupNames[index]!) ?? [];
    const groupB = byGroup.get(groupNames[index + 1]!) ?? [];
    const a1 = groupA.find((item) => item.rank === 1);
    const a2 = groupA.find((item) => item.rank === 2);
    const b1 = groupB.find((item) => item.rank === 1);
    const b2 = groupB.find((item) => item.rank === 2);
    if (a1 && b2) ordered.push(a1, b2);
    if (b1 && a2) ordered.push(b1, a2);
  }
  if (ordered.length !== qualifiers.length) {
    return qualifiers.sort((a, b) => a.groupName.localeCompare(b.groupName) || a.rank - b.rank);
  }
  return ordered;
}

function knockoutStageForSize(size: number) {
  if (size === 64) return "ROUND_OF_64";
  if (size === 32) return "ROUND_OF_32";
  if (size === 16) return "ROUND_OF_16";
  if (size === 8) return "QUARTER_FINAL";
  if (size === 4) return "SEMI_FINAL";
  return "FINAL";
}

function shortKnockoutLabel(matchNo: number) {
  return `KO${matchNo}`;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

function toEveningKickoffIso(date: Date, sequence = 0) {
  const kickoff = new Date(date);
  const utcHoursForBangladeshEvening = [12, 13, 14, 15];
  kickoff.setUTCHours(utcHoursForBangladeshEvening[sequence % utcHoursForBangladeshEvening.length]!, 0, 0, 0);
  return kickoff.toISOString();
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
