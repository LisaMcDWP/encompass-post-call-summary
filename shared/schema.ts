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
});

export type InsertClientPathway = z.infer<typeof insertClientPathwaySchema>;

export interface ClientPathway {
  id: number;
  client: string;
  pathway: string;
  description: string;
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
});

export type InsertDispositionCategory = z.infer<typeof insertDispositionCategorySchema>;

export interface DispositionCategory {
  id: number;
  name: string;
  displayName: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
}

export const insertDispositionDetailSchema = z.object({
  categoryId: z.number().int(),
  name: z.string(),
  displayName: z.string(),
  description: z.string().default(""),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
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
