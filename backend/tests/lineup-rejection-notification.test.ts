import { describe, expect, it } from "vitest";
import { buildLineupRejectionNotice } from "../src/domain/lineup-rejection-notification.js";

const input = {
  lineupId: "lineup-1",
  submissionVersion: "2026-09-10T12:00:00.000Z",
  seasonId: "season-1",
  managerId: "manager-1",
  teamRegistrationId: "team-1",
  fixtureId: "fixture-1",
  reason: "  Replace the suspended player  ",
  adminId: "admin-1",
};

describe("lineup rejection notifications", () => {
  it("creates an actionable manager notice from the admin reason", () => {
    expect(buildLineupRejectionNotice(input)).toMatchObject({
      season_id: "season-1",
      manager_id: "manager-1",
      team_registration_id: "team-1",
      fixture_id: "fixture-1",
      related_type: "LINEUP_BLOCK",
      sender_role: "ADMIN",
      message:
        "Your lineup was rejected by the admin. Reason: Replace the suspended player. Review the requested changes and submit the lineup again.",
    });
  });

  it("uses the submission timestamp to keep retries idempotent", () => {
    const first = buildLineupRejectionNotice(input);
    const retry = buildLineupRejectionNotice(input);
    const nextSubmission = buildLineupRejectionNotice({
      ...input,
      submissionVersion: "2026-09-11T12:00:00.000Z",
    });

    expect(retry.notification_key).toBe(first.notification_key);
    expect(nextSubmission.notification_key).not.toBe(first.notification_key);
  });
});
