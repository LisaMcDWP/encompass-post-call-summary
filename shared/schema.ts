import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertContextParameterSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string().default(""),
  dataType: z.enum(["string", "number", "date", "boolean", "enum"]).default("string"),
  enumValues: z.array(z.string()).optional().default([]),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  awellDataPointKey: z.string().optional().default(""),
  awellMappingType: z.enum(["none", "data_point", "patient_profile"]).optional().default("none"),
  awellPatientProfileField: z.string().optional().default(""),
});

export type InsertContextParameter = z.infer<typeof insertContextParameterSchema>;

export interface ContextParameter {
  id: number;
  name: string;
  displayName: string;
  description: string;
  dataType: string;
  enumValues: string[];
  isActive: boolean;
  displayOrder: number;
  awellDataPointKey: string;
  awellMappingType: "none" | "data_point" | "patient_profile";
  awellPatientProfileField: string;
}

export const insertClientPathwaySchema = z.object({
  client: z.string().min(1),
  pathway: z.string().min(1),
  description: z.string().optional().default(""),
  gcp_project_id: z.string().optional().default(""),
  secret_key: z.string().optional().default(""),
});

export type InsertClientPathway = z.infer<typeof insertClientPathwaySchema>;

export interface ClientPathway {
  id: number;
  client: string;
  pathway: string;
  description: string;
  gcp_project_id: string;
  secret_key: string;
}

export const enumValueSchema = z.object({
  label: z.string(),
  color: z.enum(["GREEN", "YELLOW", "RED", "BLUE", "GRAY"]),
});

export type EnumValue = z.infer<typeof enumValueSchema>;

export const insertObservationSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string().default(""),
  domain: z.string().default("general"),
  displayOrder: z.number().int().default(0),
  valueType: z.string().default("enum"),
  value: z.array(enumValueSchema).default([]),
  isActive: z.boolean().default(true),
  promptGuidance: z.string().default(""),
});

export type InsertObservation = z.infer<typeof insertObservationSchema>;

export interface Observation {
  id: number;
  name: string;
  displayName: string;
  description: string;
  domain: string;
  displayOrder: number;
  valueType: string;
  value: EnumValue[];
  isActive: boolean;
  promptGuidance: string;
}

export const insertCallQAPromptSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  promptText: z.string(),
  responseType: z.enum(["enum", "text", "boolean"]).default("enum"),
  responseOptions: z.array(z.string()).optional().default([]),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

export type InsertCallQAPrompt = z.infer<typeof insertCallQAPromptSchema>;

export interface CallQAPrompt {
  id: number;
  name: string;
  displayName: string;
  promptText: string;
  responseType: string;
  responseOptions: string[];
  isActive: boolean;
  displayOrder: number;
}

export const insertDispositionCategorySchema = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string().default(""),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isGlobal: z.boolean().default(false),
});

export type InsertDispositionCategory = z.infer<typeof insertDispositionCategorySchema>;

export interface DispositionCategory {
  id: number;
  name: string;
  displayName: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  isGlobal: boolean;
}

export const insertDispositionDetailSchema = z.object({
  categoryId: z.number().int(),
  name: z.string(),
  displayName: z.string(),
  description: z.string().default(""),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isGlobal: z.boolean().default(false),
});

export type InsertDispositionDetail = z.infer<typeof insertDispositionDetailSchema>;

export interface DispositionDetail {
  id: number;
  categoryId: number;
  name: string;
  displayName: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  isGlobal: boolean;
}

export const insertCallReviewItemSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string().default(""),
  category: z.string().default("General"),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type InsertCallReviewItem = z.infer<typeof insertCallReviewItemSchema>;

export interface CallReviewItem {
  id: number;
  name: string;
  displayName: string;
  description: string;
  category: string;
  displayOrder: number;
  isActive: boolean;
}

export interface CallReview {
  id: string;
  sourceId: string;
  reviewItemId: number;
  reviewItemName: string;
  reviewItemDisplayName: string;
  status: "checked" | "flagged" | "na" | "unchecked";
  notes: string;
  reviewedBy: string;
  reviewedAt: string;
}

export const activationObjectiveStageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().default(""),
  order: z.number().int(),
});
export type ActivationObjectiveStage = z.infer<typeof activationObjectiveStageSchema>;

export const activationObjectiveThresholdSchema = z.object({
  bandLabel: z.enum(["early", "near_window", "at_window", "post_window", "default"]),
  bandDisplayName: z.string().default(""),
  daysRemainingMin: z.number().int().nullable(),
  daysRemainingMax: z.number().int().nullable(),
  onTrackStageIds: z.array(z.string()).default([]),
  satisfiedLabel: z.string().default("On track"),
  unsatisfiedLabel: z.string().default("At risk"),
  // Display-only hint: which configured interaction is typically expected to land in this band.
  // Has no runtime effect on extraction or scoring — purely a label for editor readability.
  expectedInteractionId: z.number().int().nullable().default(null),
});
export type ActivationObjectiveThreshold = z.infer<typeof activationObjectiveThresholdSchema>;

export const activationObjectiveStageMappingSchema = z.object({
  extractedValue: z.string().min(1),
  stageId: z.string().min(1),
});
export type ActivationObjectiveStageMapping = z.infer<typeof activationObjectiveStageMappingSchema>;

export const observationEnumValueSchema = z.object({
  label: z.string().min(1),
  color: z.enum(["GREEN", "YELLOW", "RED", "BLUE", "GRAY"]).default("GRAY"),
  promptHint: z.string().default(""),
});
export type ObservationEnumValue = z.infer<typeof observationEnumValueSchema>;

export const activationObjectiveInclusionRulesSchema = z.object({
  requirePcpAssigned: z.boolean().default(false),
  requireCompletedWithPatientOrCaregiver: z.boolean().default(true),
  customRules: z.array(z.string()).default([]),
});
export type ActivationObjectiveInclusionRules = z.infer<typeof activationObjectiveInclusionRulesSchema>;

export const activationInteractionTypeSchema = z.enum(["scheduled", "ad_hoc", "continuous"]);
export type ActivationInteractionType = z.infer<typeof activationInteractionTypeSchema>;

// Base object shape (no cross-field rules) — exposed so partial-update validators can derive from it.
export const baseActivationInteractionSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/, "Key must use lowercase letters, numbers, and underscores"),
  name: z.string().min(1),
  description: z.string().default(""),
  // Type model:
  //  - scheduled: defined touchpoint at expectedDayOffset (band evaluation applies)
  //  - ad_hoc: triggered by something surfaced in a prior call (band evaluation applies, narrower extraction)
  //  - continuous: recurring engagement after the initial window (NOT evaluated against the originating objective window)
  interactionType: activationInteractionTypeSchema.default("scheduled"),
  // Scheduled-only: expected day offset from the anchor event.
  expectedDayOffset: z.number().int().nullable().default(null),
  // Ad hoc-only: which interaction's call typically triggers this follow-up.
  parentInteractionId: z.number().int().nullable().default(null),
  // Continuous-only: cadence in days between recurrences (e.g. 7 = weekly).
  intervalDays: z.number().int().positive().nullable().default(null),
  // Continuous-only: continuous engagement begins after this objective resolves.
  startAfterObjectiveId: z.number().int().nullable().default(null),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

// Full insert schema: enforces cross-field rules and normalizes incompatible fields to null.
export const insertActivationInteractionSchema = baseActivationInteractionSchema.superRefine((val, ctx) => {
  if (val.interactionType === "continuous" && (val.intervalDays == null || val.intervalDays <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["intervalDays"],
      message: "Continuous interactions require a positive intervalDays (cadence in days).",
    });
  }
}).transform((val) => {
  switch (val.interactionType) {
    case "scheduled":
      return { ...val, parentInteractionId: null, intervalDays: null, startAfterObjectiveId: null };
    case "ad_hoc":
      return { ...val, expectedDayOffset: null, intervalDays: null, startAfterObjectiveId: null };
    case "continuous":
      return { ...val, expectedDayOffset: null, parentInteractionId: null };
  }
});
export type InsertActivationInteraction = z.infer<typeof insertActivationInteractionSchema>;

// Partial-update schema for PUT — call sites should merge with the existing record and re-validate
// through `insertActivationInteractionSchema` to keep cross-field rules enforced.
export const updateActivationInteractionSchema = baseActivationInteractionSchema.partial();
export type UpdateActivationInteraction = z.infer<typeof updateActivationInteractionSchema>;

export interface ActivationInteraction {
  id: number;
  clientPathwayId: number;
  key: string;
  name: string;
  description: string;
  interactionType: ActivationInteractionType;
  expectedDayOffset: number | null;
  parentInteractionId: number | null;
  intervalDays: number | null;
  startAfterObjectiveId: number | null;
  isActive: boolean;
  displayOrder: number;
}

export const activationObjectiveInteractionConfigSchema = z.object({
  interactionId: z.number().int(),
  isDefault: z.boolean().default(false),
  canResolveObjective: z.boolean().default(true),
  inclusionRules: activationObjectiveInclusionRulesSchema.default({
    requirePcpAssigned: false,
    requireCompletedWithPatientOrCaregiver: true,
    customRules: [],
  }),
  promptGuidance: z.string().default(""),
  observationTopicIds: z.array(z.number().int()).default([]),
});
export type ActivationObjectiveInteractionConfig = z.infer<typeof activationObjectiveInteractionConfigSchema>;

export const insertActivationObjectiveSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().default(""),
  anchorEventType: z.enum(["discharge", "enrollment", "procedure", "custom"]).default("discharge"),
  anchorContextKey: z.string().min(1),
  interactionContextKey: z.string().min(1).default("interaction_key"),
  windowDays: z.number().int().min(1),
  stages: z.array(activationObjectiveStageSchema).default([]),
  achievedStageId: z.string().default(""),
  thresholds: z.array(activationObjectiveThresholdSchema).default([]),
  observationName: z.string().default(""),
  extractedEnumValues: z.preprocess(
    (val) => {
      if (!Array.isArray(val)) return val;
      return val.map((v) =>
        typeof v === "string" ? { label: v, color: "GRAY" } : v
      );
    },
    z.array(observationEnumValueSchema).default([])
  ),
  stageMappings: z.array(activationObjectiveStageMappingSchema).default([]),
  knownContextExtractedValues: z.array(z.string()).default([]),
  excludedExtractedValues: z.array(z.string()).default([]),
  interactions: z.array(activationObjectiveInteractionConfigSchema).default([]),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  promptGuidance: z.string().default(""),
  observationTopicIds: z.array(z.number().int()).default([]),
});
export type InsertActivationObjective = z.infer<typeof insertActivationObjectiveSchema>;

export interface ActivationObjective {
  id: number;
  name: string;
  displayName: string;
  description: string;
  anchorEventType: string;
  anchorContextKey: string;
  interactionContextKey: string;
  windowDays: number;
  stages: ActivationObjectiveStage[];
  achievedStageId: string;
  thresholds: ActivationObjectiveThreshold[];
  observationName: string;
  extractedEnumValues: ObservationEnumValue[];
  stageMappings: ActivationObjectiveStageMapping[];
  knownContextExtractedValues: string[];
  excludedExtractedValues: string[];
  interactions: ActivationObjectiveInteractionConfig[];
  isActive: boolean;
  displayOrder: number;
  promptGuidance: string;
  observationTopicIds: number[];
}

export interface CallActivationObjectiveResult {
  callId: string;
  objectiveId: number;
  objectiveName: string;
  interactionId: number | null;
  interactionKey: string;
  interactionName: string;
  callDate: string;
  anchorEventDate: string | null;
  targetDate: string | null;
  daysRemaining: number | null;
  bandLabel: string | null;
  extractedValue: string | null;
  currentStageId: string | null;
  currentStageName: string | null;
  onTrack: boolean | null;
  onTrackStatus: string;
  isEligible: boolean;
  exclusionReason: string;
  rationale: string;
  observations: CallActivationObjectiveObservation[];
  processedAt: string;
}

export interface CallActivationObjectiveObservation {
  topicId: number;
  name: string;
  displayName: string;
  value: string | null;
  detail: string | null;
  evidence: string | null;
}
