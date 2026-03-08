import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, jsonb, boolean } from "drizzle-orm/pg-core";
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

export const observations = pgTable("observations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  domain: text("domain").notNull().default("general"),
  displayOrder: integer("display_order").notNull().default(0),
  valueType: text("value_type").notNull().default("enum"),
  value: jsonb("value").$type<EnumValue[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
});

export const enumValueSchema = z.object({
  label: z.string(),
  color: z.enum(["GREEN", "YELLOW", "RED", "BLUE", "GRAY"]),
});

export type EnumValue = z.infer<typeof enumValueSchema>;

export const insertObservationSchema = createInsertSchema(observations).omit({
  id: true,
});

export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type Observation = typeof observations.$inferSelect;
