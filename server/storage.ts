import { type User, type InsertUser, type Observation, type InsertObservation, observations, users } from "@shared/schema";
import { db } from "./db";
import { eq, asc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getObservations(): Promise<Observation[]>;
  getActiveObservations(): Promise<Observation[]>;
  getObservation(id: number): Promise<Observation | undefined>;
  createObservation(observation: InsertObservation): Promise<Observation>;
  updateObservation(id: number, observation: Partial<InsertObservation>): Promise<Observation | undefined>;
  deleteObservation(id: number): Promise<boolean>;
  reorderObservations(orderedIds: number[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getObservations(): Promise<Observation[]> {
    return db.select().from(observations).orderBy(asc(observations.displayOrder));
  }

  async getActiveObservations(): Promise<Observation[]> {
    return db.select().from(observations).where(eq(observations.isActive, true)).orderBy(asc(observations.displayOrder));
  }

  async getObservation(id: number): Promise<Observation | undefined> {
    const [obs] = await db.select().from(observations).where(eq(observations.id, id));
    return obs;
  }

  async createObservation(observation: InsertObservation): Promise<Observation> {
    const [obs] = await db.insert(observations).values(observation).returning();
    return obs;
  }

  async updateObservation(id: number, data: Partial<InsertObservation>): Promise<Observation | undefined> {
    const [obs] = await db.update(observations).set(data).where(eq(observations.id, id)).returning();
    return obs;
  }

  async deleteObservation(id: number): Promise<boolean> {
    const result = await db.delete(observations).where(eq(observations.id, id)).returning();
    return result.length > 0;
  }

  async reorderObservations(orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(observations).set({ displayOrder: i }).where(eq(observations.id, orderedIds[i]));
    }
  }
}

export const storage = new DatabaseStorage();
