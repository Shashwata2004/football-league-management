import { z } from "zod";
import {
  FootballPosition,
  IdType,
  PlayerAbilityRating,
  PlayerLifecycleStatus,
  PlayerPosition,
  PreferredFoot,
  RegistrationStatus,
  RoleRequestStatus,
  SeasonFormat,
  SeasonPhase,
  VenueSide,
} from "./enums.js";

export const uuidSchema = z.string().uuid();

export const roleRequestDecisionSchema = z.object({
  status: z.enum([RoleRequestStatus.APPROVED, RoleRequestStatus.REJECTED]),
  reason: z.string().max(500).optional(),
});

export const createLeagueSchema = z.object({
  name: z.string().trim().min(2).max(120),
  short_name: z.string().trim().min(2).max(20).optional(),
  logo_url: z.string().trim().max(500).optional(),
  organizer_name: z.string().trim().min(2).max(120).optional(),
  country: z.string().trim().max(80).optional(),
  description: z.string().trim().max(1000).optional(),
});

export const createSeasonSchema = z
  .object({
    league_id: uuidSchema,
    name: z.string().trim().min(2).max(120),
    season_year: z.number().int().min(1900).max(2200).optional(),
    registration_start_date: z.string().date().optional(),
    registration_deadline: z.string().date().optional(),
    format: z.enum([
      SeasonFormat.SINGLE_ROUND_ROBIN,
      SeasonFormat.DOUBLE_ROUND_ROBIN,
      SeasonFormat.GROUP_STAGE_KNOCKOUT,
    ]),
    round_format: z
      .enum([SeasonFormat.SINGLE_ROUND_ROBIN, SeasonFormat.DOUBLE_ROUND_ROBIN])
      .optional(),
    start_date: z.string().date().optional(),
    end_date: z.string().date().optional(),
    total_teams: z.number().int().min(2).max(128).optional(),
    min_players_per_team: z.number().int().min(1).max(60).optional(),
    max_players_per_team: z.number().int().min(1).max(60).optional(),
    lineup_size: z.number().int().min(1).max(22).optional(),
    substitute_limit: z.number().int().min(0).max(15).optional(),
    lineup_submission_deadline_hours: z
      .number()
      .int()
      .min(1)
      .max(168)
      .optional(),
    group_count: z.number().int().min(1).max(16).optional(),
    teams_per_group: z.number().int().min(2).max(16).optional(),
    qualifiers_per_group: z.number().int().min(1).max(4).optional(),
    best_third_place_teams: z.number().int().min(0).max(16).optional(),
    total_knockout_teams: z.number().int().min(0).max(64).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.min_players_per_team &&
      value.max_players_per_team &&
      value.min_players_per_team > value.max_players_per_team
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum players cannot be greater than maximum players",
        path: ["min_players_per_team"],
      });
    }
    if (
      value.registration_start_date &&
      value.registration_deadline &&
      value.registration_start_date > value.registration_deadline
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Registration start date cannot be after registration deadline",
        path: ["registration_start_date"],
      });
    }
    if (
      value.start_date &&
      value.end_date &&
      value.start_date > value.end_date
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Season start date cannot be after season end date",
        path: ["start_date"],
      });
    }
    if (value.format === SeasonFormat.GROUP_STAGE_KNOCKOUT) {
      if (
        !value.group_count ||
        !value.teams_per_group ||
        !value.qualifiers_per_group ||
        value.best_third_place_teams === undefined ||
        !value.total_knockout_teams
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Group, team, qualifier, best third-place, and total knockout team settings are required",
        });
        return;
      }
      const total =
        value.group_count * value.qualifiers_per_group +
        value.best_third_place_teams;
      if (total !== value.total_knockout_teams) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Total knockout teams must equal group qualifiers plus best third-place teams",
          path: ["total_knockout_teams"],
        });
      }
      if (![4, 8, 16, 32, 64].includes(total)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Total knockout qualifiers must be exactly 4, 8, 16, 32, or 64",
        });
      }
    }
  });

export const updateSeasonScheduleSchema = z.object({
  kickoff_at: z.string().datetime().nullable().optional(),
  venue: z.string().trim().max(160).nullable().optional(),
});

export const updateSeasonPhaseSchema = z.object({
  phase: z.enum([
    SeasonPhase.REGISTRATION_OPEN,
    SeasonPhase.REGISTRATION_CLOSED,
    SeasonPhase.ACTIVE,
    SeasonPhase.COMPLETED,
  ]),
});

export const teamRegistrationSchema = z.object({
  season_id: uuidSchema,
  name: z.string().trim().min(2).max(120),
  short_name: z.string().trim().min(2).max(12),
  logo_url: z.string().trim().max(2000).nullable().optional(),
  primary_color: z.string().trim().max(30).optional(),
  secondary_color: z.string().trim().max(30).optional(),
  accent_color: z.string().trim().max(30).optional(),
  home_jersey_url: z.string().trim().max(2000).nullable().optional(),
  away_jersey_url: z.string().trim().max(2000).nullable().optional(),
  gk_home_jersey_url: z.string().trim().max(2000).nullable().optional(),
  gk_away_jersey_url: z.string().trim().max(2000).nullable().optional(),
});

export const registrationDecisionSchema = z.object({
  status: z.enum([RegistrationStatus.APPROVED, RegistrationStatus.REJECTED]),
  reason: z.string().trim().max(500).optional(),
});

export const positionBreakdownSchema = z.object({
  GK: z.number().int().min(0).max(60).default(0),
  CB: z.number().int().min(0).max(60).default(0),
  LB: z.number().int().min(0).max(60).default(0),
  RB: z.number().int().min(0).max(60).default(0),
  DM: z.number().int().min(0).max(60).default(0),
  CM: z.number().int().min(0).max(60).default(0),
  AM: z.number().int().min(0).max(60).default(0),
  LW: z.number().int().min(0).max(60).default(0),
  RW: z.number().int().min(0).max(60).default(0),
  ST: z.number().int().min(0).max(60).default(0),
});

export const generateSquadSchema = z
  .object({
    targetSquadSize: z.number().int().min(1).max(60).optional(),
    targetGenerateCount: z.number().int().min(1).max(60).optional(),
    positionBreakdown: positionBreakdownSchema.optional(),
    identityTypeMode: z
      .enum(["mixed_generated", "generated_nid", "generated_birth_id"])
      .optional()
      .default("mixed_generated"),
    overwriteDraftPlayers: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    const target = value.targetGenerateCount ?? value.targetSquadSize;
    if (!target) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Target squad size or target generate count is required",
      });
    }
    if (value.positionBreakdown) {
      const total = Object.values(value.positionBreakdown).reduce(
        (sum, count) => sum + count,
        0,
      );
      if (target && total !== target) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["positionBreakdown"],
          message: `Total selected players must equal ${target}.`,
        });
      }
      if (target && target >= 11 && value.positionBreakdown.GK < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["positionBreakdown", "GK"],
          message: "You need at least 1 goalkeeper.",
        });
      }
    }
  });

export const submitPlayersSchema = z.object({
  playerIds: z.array(uuidSchema).min(1).max(60),
});

export const updateDraftPlayerSchema = z.object({
  full_name: z.string().trim().min(2).max(160).optional(),
  position: z
    .enum([
      FootballPosition.GK,
      FootballPosition.CB,
      FootballPosition.LB,
      FootballPosition.RB,
      FootballPosition.DM,
      FootballPosition.CM,
      FootballPosition.AM,
      FootballPosition.LW,
      FootballPosition.RW,
      FootballPosition.ST,
    ])
    .optional(),
  football_position: z
    .enum([
      FootballPosition.GK,
      FootballPosition.CB,
      FootballPosition.LB,
      FootballPosition.RB,
      FootballPosition.DM,
      FootballPosition.CM,
      FootballPosition.AM,
      FootballPosition.LW,
      FootballPosition.RW,
      FootballPosition.ST,
    ])
    .optional(),
  shirt_number: z.number().int().min(1).max(99).optional(),
  preferred_foot: z
    .enum([
      PreferredFoot.LEFT,
      PreferredFoot.RIGHT,
      PreferredFoot.BOTH,
      PreferredFoot.UNKNOWN,
    ])
    .optional(),
  avatar_url: z.string().trim().max(500).nullable().optional(),
  id_type: z.enum([IdType.NID, IdType.BIRTH_ID]).optional(),
  generated_identity_number: z.string().trim().min(6).max(80).optional(),
});

export const playerAbilityDecisionSchema = z.object({
  ability_rating: z.enum([
    PlayerAbilityRating.LOW,
    PlayerAbilityRating.MODERATE,
    PlayerAbilityRating.HIGH,
  ]),
  football_position: z
    .enum([
      FootballPosition.GK,
      FootballPosition.CB,
      FootballPosition.LB,
      FootballPosition.RB,
      FootballPosition.DM,
      FootballPosition.CM,
      FootballPosition.AM,
      FootballPosition.LW,
      FootballPosition.RW,
      FootballPosition.ST,
    ])
    .optional(),
});

export const playerLifecycleDecisionSchema = z.object({
  player_status: z.enum([
    PlayerLifecycleStatus.ACTIVE,
    PlayerLifecycleStatus.PENDING,
    PlayerLifecycleStatus.APPROVED,
    PlayerLifecycleStatus.REJECTED,
    PlayerLifecycleStatus.REMOVED,
    PlayerLifecycleStatus.SUSPENDED,
  ]),
  reason: z.string().trim().max(500).optional(),
});

export const playerSubmissionSchema = z.object({
  team_registration_id: uuidSchema,
  full_name: z.string().trim().min(2).max(160),
  date_of_birth: z.string().date(),
  nationality: z.string().trim().max(80).optional(),
  position: z.enum([
    PlayerPosition.GK,
    PlayerPosition.DEF,
    PlayerPosition.MID,
    PlayerPosition.FWD,
  ]),
  football_position: z
    .enum([
      FootballPosition.GK,
      FootballPosition.CB,
      FootballPosition.LB,
      FootballPosition.RB,
      FootballPosition.DM,
      FootballPosition.CM,
      FootballPosition.AM,
      FootballPosition.LW,
      FootballPosition.RW,
      FootballPosition.ST,
    ])
    .optional(),
  preferred_foot: z
    .enum([
      PreferredFoot.LEFT,
      PreferredFoot.RIGHT,
      PreferredFoot.BOTH,
      PreferredFoot.UNKNOWN,
    ])
    .optional(),
  shirt_number: z.number().int().min(1).max(99).optional(),
  avatar_url: z.string().trim().max(500).optional(),
  id_type: z.enum([IdType.NID, IdType.BIRTH_ID]),
  id_number: z.string().trim().min(6).max(40),
  proof_storage_path: z.string().trim().max(500).optional(),
});

export const hiddenAttributesSchema = z.object({
  player_registration_id: uuidSchema,
  pace: z.number().int().min(1).max(99),
  shooting: z.number().int().min(1).max(99),
  passing: z.number().int().min(1).max(99),
  dribbling: z.number().int().min(1).max(99),
  defending: z.number().int().min(1).max(99),
  physical: z.number().int().min(1).max(99),
  goalkeeping: z.number().int().min(1).max(99),
});

export const lineupPlayerInputSchema = z.object({
  player_registration_id: uuidSchema,
  is_starter: z.boolean(),
  position: z.enum([
    PlayerPosition.GK,
    PlayerPosition.DEF,
    PlayerPosition.MID,
    PlayerPosition.FWD,
  ]),
  slot_key: z.string().trim().max(80).nullable().optional(),
  display_role: z.string().trim().max(20).nullable().optional(),
  player_natural_position: z
    .enum([
      FootballPosition.GK,
      FootballPosition.CB,
      FootballPosition.LB,
      FootballPosition.RB,
      FootballPosition.DM,
      FootballPosition.CM,
      FootballPosition.AM,
      FootballPosition.LW,
      FootballPosition.RW,
      FootballPosition.ST,
    ])
    .nullable()
    .optional(),
  display_order: z.number().int().min(0).max(30).optional(),
  is_captain: z.boolean().optional(),
});

export const lineupSubmissionSchema = z.object({
  fixture_id: uuidSchema,
  team_registration_id: uuidSchema,
  side: z.enum([VenueSide.HOME, VenueSide.AWAY]),
  formation: z.string().trim().min(3).max(30),
  playing_style: z.string().trim().min(3).max(50).optional(),
  captain_id: uuidSchema.optional().nullable(),
  players: z.array(lineupPlayerInputSchema).min(11).max(60),
});

export const generateFixturesSchema = z.object({
  season_id: uuidSchema,
});

export const simulateMatchSchema = z.object({
  fixture_id: uuidSchema,
});

export const editableTeamStatsSchema = z.object({
  possession: z.number().int().min(0).max(100),
  expected_goals: z.number().min(0).max(10).default(0),
  shots: z.number().int().min(0).max(40),
  shots_off_target: z.number().int().min(0).max(40).default(0),
  shots_on_target: z.number().int().min(0).max(25),
  hit_woodwork: z.number().int().min(0).max(10).default(0),
  big_chances: z.number().int().min(0).max(15),
  big_chances_missed: z.number().int().min(0).max(15),
  passes: z.number().int().min(0).max(1200),
  accurate_passes: z.number().int().min(0).max(1200),
  tackles: z.number().int().min(0).max(40).default(0),
  interceptions: z.number().int().min(0).max(40).default(0),
  blocks: z.number().int().min(0).max(30).default(0),
  clearances: z.number().int().min(0).max(80).default(0),
  keeper_saves: z.number().int().min(0).max(30).default(0),
  fouls: z.number().int().min(0).max(40),
  yellow_cards: z.number().int().min(0).max(8),
  red_cards: z.number().int().min(0).max(3),
  corners: z.number().int().min(0).max(25),
});

export const editSimulationSchema = z.object({
  fixture_id: uuidSchema,
  home_score: z.number().int().min(0).max(20),
  away_score: z.number().int().min(0).max(20),
  home_stats: editableTeamStatsSchema,
  away_stats: editableTeamStatsSchema,
});

export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type UpdateSeasonPhaseInput = z.infer<typeof updateSeasonPhaseSchema>;
export type TeamRegistrationInput = z.infer<typeof teamRegistrationSchema>;
export type PlayerSubmissionInput = z.infer<typeof playerSubmissionSchema>;
export type PlayerAbilityDecisionInput = z.infer<
  typeof playerAbilityDecisionSchema
>;
export type PlayerLifecycleDecisionInput = z.infer<
  typeof playerLifecycleDecisionSchema
>;
export type HiddenAttributesInput = z.infer<typeof hiddenAttributesSchema>;
export type LineupSubmissionInput = z.infer<typeof lineupSubmissionSchema>;
export type EditSimulationInput = z.infer<typeof editSimulationSchema>;
