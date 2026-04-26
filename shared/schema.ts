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

export const insertActivationInteractionSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/, "Key must use lowercase letters, numbers, and underscores"),
  name: z.string().min(1),
  description: z.string().default(""),
  expectedDayOffset: z.number().int().nullable().default(null),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});
export type InsertActivationInteraction = z.infer<typeof insertActivationInteractionSchema>;

export interface ActivationInteraction {
  id: number;
  clientPathwayId: number;
  key: string;
  name: string;
  description: string;
  expectedDayOffset: number | null;
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
  interactions: z.array(activationObjectiveInteractionConfigSchema).default([]),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  promptGuidance: z.string().default(""),
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
  interactions: ActivationObjectiveInteractionConfig[];
  isActive: boolean;
  displayOrder: number;
  promptGuidance: string;
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
  evidence: string | null;
}
