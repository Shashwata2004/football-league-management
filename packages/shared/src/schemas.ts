import { z } from "zod";
import {
  IdType,
  PlayerPosition,
  RegistrationStatus,
  RoleRequestStatus,
  SeasonFormat,
  VenueSide
} from "./enums.js";

export const uuidSchema = z.string().uuid();

export const roleRequestDecisionSchema = z.object({
  status: z.enum([RoleRequestStatus.APPROVED, RoleRequestStatus.REJECTED]),
  reason: z.string().max(500).optional()
});

export const createLeagueSchema = z.object({
  name: z.string().trim().min(2).max(120),
  country: z.string().trim().max(80).optional(),
  description: z.string().trim().max(1000).optional()
});

export const createSeasonSchema = z
  .object({
    league_id: uuidSchema,
    name: z.string().trim().min(2).max(120),
    format: z.enum([
      SeasonFormat.SINGLE_ROUND_ROBIN,
      SeasonFormat.DOUBLE_ROUND_ROBIN,
      SeasonFormat.GROUP_STAGE_KNOCKOUT
    ]),
    start_date: z.string().date().optional(),
    end_date: z.string().date().optional(),
    group_count: z.number().int().min(1).max(16).optional(),
    qualifiers_per_group: z.number().int().min(1).max(4).optional()
  })
  .superRefine((value, ctx) => {
    if (value.format === SeasonFormat.GROUP_STAGE_KNOCKOUT) {
      if (!value.group_count || !value.qualifiers_per_group) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "group_count and qualifiers_per_group are required for group + knockout seasons"
        });
        return;
      }
      const total = value.group_count * value.qualifiers_per_group;
      if (![4, 8, 16, 32, 64].includes(total)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Total knockout qualifiers must be exactly 4, 8, 16, 32, or 64"
        });
      }
    }
  });

export const updateSeasonScheduleSchema = z.object({
  kickoff_at: z.string().datetime().nullable().optional(),
  venue: z.string().trim().max(160).nullable().optional()
});

export const teamRegistrationSchema = z.object({
  season_id: uuidSchema,
  name: z.string().trim().min(2).max(120),
  short_name: z.string().trim().min(2).max(12),
  city: z.string().trim().max(80).optional(),
  primary_color: z.string().trim().max(30).optional()
});

export const registrationDecisionSchema = z.object({
  status: z.enum([RegistrationStatus.APPROVED, RegistrationStatus.REJECTED]),
  reason: z.string().trim().max(500).optional()
});

export const playerSubmissionSchema = z.object({
  team_registration_id: uuidSchema,
  full_name: z.string().trim().min(2).max(160),
  date_of_birth: z.string().date(),
  nationality: z.string().trim().max(80).optional(),
  position: z.enum([PlayerPosition.GK, PlayerPosition.DEF, PlayerPosition.MID, PlayerPosition.FWD]),
  shirt_number: z.number().int().min(1).max(99).optional(),
  id_type: z.enum([IdType.NID, IdType.BIRTH_ID]),
  id_number: z.string().trim().min(6).max(40),
  proof_storage_path: z.string().trim().max(500).optional()
});

export const hiddenAttributesSchema = z.object({
  player_registration_id: uuidSchema,
  pace: z.number().int().min(1).max(99),
  shooting: z.number().int().min(1).max(99),
  passing: z.number().int().min(1).max(99),
  dribbling: z.number().int().min(1).max(99),
  defending: z.number().int().min(1).max(99),
  physical: z.number().int().min(1).max(99),
  goalkeeping: z.number().int().min(1).max(99)
});

export const lineupPlayerInputSchema = z.object({
  player_registration_id: uuidSchema,
  is_starter: z.boolean(),
  position: z.enum([PlayerPosition.GK, PlayerPosition.DEF, PlayerPosition.MID, PlayerPosition.FWD])
});

export const lineupSubmissionSchema = z.object({
  fixture_id: uuidSchema,
  team_registration_id: uuidSchema,
  side: z.enum([VenueSide.HOME, VenueSide.AWAY]),
  formation: z.string().trim().min(3).max(30),
  players: z.array(lineupPlayerInputSchema).min(11).max(20)
});

export const generateFixturesSchema = z.object({
  season_id: uuidSchema
});

export const simulateMatchSchema = z.object({
  fixture_id: uuidSchema
});

export const editableTeamStatsSchema = z.object({
  possession: z.number().int().min(0).max(100),
  shots: z.number().int().min(0).max(40),
  shots_on_target: z.number().int().min(0).max(25),
  big_chances: z.number().int().min(0).max(15),
  big_chances_missed: z.number().int().min(0).max(15),
  passes: z.number().int().min(0).max(1200),
  accurate_passes: z.number().int().min(0).max(1200),
  fouls: z.number().int().min(0).max(40),
  yellow_cards: z.number().int().min(0).max(8),
  red_cards: z.number().int().min(0).max(3),
  corners: z.number().int().min(0).max(25)
});

export const editSimulationSchema = z.object({
  fixture_id: uuidSchema,
  home_score: z.number().int().min(0).max(20),
  away_score: z.number().int().min(0).max(20),
  home_stats: editableTeamStatsSchema,
  away_stats: editableTeamStatsSchema
});

export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type TeamRegistrationInput = z.infer<typeof teamRegistrationSchema>;
export type PlayerSubmissionInput = z.infer<typeof playerSubmissionSchema>;
export type HiddenAttributesInput = z.infer<typeof hiddenAttributesSchema>;
export type LineupSubmissionInput = z.infer<typeof lineupSubmissionSchema>;
export type EditSimulationInput = z.infer<typeof editSimulationSchema>;
