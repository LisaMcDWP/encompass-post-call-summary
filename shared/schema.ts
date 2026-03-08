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

export const enumValueSchema = z.object({
  label: z.string(),
  color: z.enum(["GREEN", "YELLOW", "RED", "BLUE", "GRAY"]),
});

export type EnumValue = z.infer<typeof enumValueSchema>;

export const insertObservationSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  domain: z.string().default("general"),
  displayOrder: z.number().int().default(0),
  valueType: z.string().default("enum"),
  value: z.array(enumValueSchema).default([]),
  isActive: z.boolean().default(true),
  promptGuidance: z.string().optional().default(""),
});

export type InsertObservation = z.infer<typeof insertObservationSchema>;

export interface Observation {
  id: number;
  name: string;
  displayName: string;
  domain: string;
  displayOrder: number;
  valueType: string;
  value: EnumValue[];
  isActive: boolean;
  promptGuidance: string;
}
