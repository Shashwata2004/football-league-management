interface LineupRejectionNoticeInput {
  lineupId: string;
  submissionVersion: string;
  seasonId: string;
  managerId: string;
  teamRegistrationId: string;
  fixtureId: string;
  reason: string;
  adminId: string;
}

export function buildLineupRejectionNotice(input: LineupRejectionNoticeInput) {
  const reason = input.reason.trim();

  return {
    season_id: input.seasonId,
    manager_id: input.managerId,
    team_registration_id: input.teamRegistrationId,
    fixture_id: input.fixtureId,
    notification_key: `lineup-rejected:${input.lineupId}:${input.submissionVersion}`,
    related_type: "LINEUP_BLOCK" as const,
    message: `Your lineup was rejected by the admin. Reason: ${reason}. Review the requested changes and submit the lineup again.`,
    created_by: input.adminId,
    sender_role: "ADMIN" as const,
  };
}
