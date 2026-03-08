import { BigQuery } from "@google-cloud/bigquery";
import type { Observation, InsertObservation, EnumValue } from "@shared/schema";

const DATASET_ID = "call_information";
const TABLE_ID = "observations";
const SETTINGS_TABLE_ID = "settings";

let bigquery: BigQuery | null = null;

function getBigQueryClient(): BigQuery {
  if (!bigquery) {
    const raw = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error("GCP_SERVICE_ACCOUNT_KEY is not set");

    const credentials = JSON.parse(raw);
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) throw new Error("GCP_PROJECT_ID is not set");

    bigquery = new BigQuery({ projectId, credentials });
  }
  return bigquery;
}

let tableInitialized = false;
let settingsTableInitialized = false;

async function ensureSettingsTable(): Promise<void> {
  if (settingsTableInitialized) return;

  const client = getBigQueryClient();
  const projectId = process.env.GCP_PROJECT_ID;
  const fullTable = `${projectId}.${DATASET_ID}.${SETTINGS_TABLE_ID}`;

  try {
    await client.query({
      query: `CREATE TABLE IF NOT EXISTS \`${fullTable}\` (
        key STRING NOT NULL,
        value STRING NOT NULL
      )`,
    });
    console.log(`BigQuery table ${DATASET_ID}.${SETTINGS_TABLE_ID} ready.`);
  } catch (err: any) {
    if (err.message?.includes("Already Exists")) {
      console.log(`BigQuery table ${DATASET_ID}.${SETTINGS_TABLE_ID} already exists.`);
    } else {
      throw err;
    }
  }

  settingsTableInitialized = true;
}

async function ensureObservationsTable(): Promise<void> {
  if (tableInitialized) return;

  const client = getBigQueryClient();
  const projectId = process.env.GCP_PROJECT_ID;
  const fullTable = `${projectId}.${DATASET_ID}.${TABLE_ID}`;

  try {
    await client.query({
      query: `CREATE TABLE IF NOT EXISTS \`${fullTable}\` (
        id INT64 NOT NULL,
        name STRING NOT NULL,
        display_name STRING NOT NULL,
        domain STRING NOT NULL,
        display_order INT64 NOT NULL,
        value_type STRING NOT NULL,
        value STRING,
        is_active BOOL NOT NULL
      )`,
    });
    console.log(`BigQuery table ${DATASET_ID}.${TABLE_ID} ready.`);
  } catch (err: any) {
    if (err.message?.includes("Already Exists")) {
      console.log(`BigQuery table ${DATASET_ID}.${TABLE_ID} already exists.`);
    } else {
      throw err;
    }
  }

  tableInitialized = true;
}

function rowToObservation(row: any): Observation {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    domain: row.domain,
    displayOrder: row.display_order,
    valueType: row.value_type,
    value: row.value ? JSON.parse(row.value) : [],
    isActive: row.is_active,
  };
}

export interface IStorage {
  getObservations(): Promise<Observation[]>;
  getActiveObservations(): Promise<Observation[]>;
  getObservation(id: number): Promise<Observation | undefined>;
  createObservation(observation: InsertObservation): Promise<Observation>;
  updateObservation(id: number, observation: Partial<InsertObservation>): Promise<Observation | undefined>;
  deleteObservation(id: number): Promise<boolean>;
  reorderObservations(orderedIds: number[]): Promise<void>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}

export class BigQueryStorage implements IStorage {
  private getProjectTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${TABLE_ID}\``;
  }

  async getObservations(): Promise<Observation[]> {
    await ensureObservationsTable();
    const client = getBigQueryClient();
    const table = this.getProjectTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} ORDER BY display_order ASC` });
    return rows.map(rowToObservation);
  }

  async getActiveObservations(): Promise<Observation[]> {
    await ensureObservationsTable();
    const client = getBigQueryClient();
    const table = this.getProjectTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE is_active = TRUE ORDER BY display_order ASC` });
    return rows.map(rowToObservation);
  }

  async getObservation(id: number): Promise<Observation | undefined> {
    await ensureObservationsTable();
    const client = getBigQueryClient();
    const table = this.getProjectTable();
    const [rows] = await client.query({
      query: `SELECT * FROM ${table} WHERE id = @id`,
      params: { id },
    });
    return rows.length > 0 ? rowToObservation(rows[0]) : undefined;
  }

  private async getNextId(): Promise<number> {
    const client = getBigQueryClient();
    const table = this.getProjectTable();
    const [rows] = await client.query({ query: `SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM ${table}` });
    return rows[0].next_id;
  }

  async createObservation(observation: InsertObservation): Promise<Observation> {
    await ensureObservationsTable();
    const client = getBigQueryClient();
    const table = this.getProjectTable();
    const id = await this.getNextId();

    const row = {
      id,
      name: observation.name,
      display_name: observation.displayName,
      domain: observation.domain || "general",
      display_order: observation.displayOrder ?? 0,
      value_type: observation.valueType || "enum",
      value: JSON.stringify(observation.value || []),
      is_active: observation.isActive !== false,
    };

    await client.query({
      query: `INSERT INTO ${table} (id, name, display_name, domain, display_order, value_type, value, is_active) VALUES (@id, @name, @display_name, @domain, @display_order, @value_type, @value, @is_active)`,
      params: row,
    });

    return rowToObservation(row);
  }

  async updateObservation(id: number, data: Partial<InsertObservation>): Promise<Observation | undefined> {
    await ensureObservationsTable();
    const client = getBigQueryClient();
    const table = this.getProjectTable();

    const existing = await this.getObservation(id);
    if (!existing) return undefined;

    const setClauses: string[] = [];
    const params: Record<string, any> = { id };

    if (data.name !== undefined) { setClauses.push("name = @name"); params.name = data.name; }
    if (data.displayName !== undefined) { setClauses.push("display_name = @displayName"); params.displayName = data.displayName; }
    if (data.domain !== undefined) { setClauses.push("domain = @domain"); params.domain = data.domain; }
    if (data.displayOrder !== undefined) { setClauses.push("display_order = @displayOrder"); params.displayOrder = data.displayOrder; }
    if (data.valueType !== undefined) { setClauses.push("value_type = @valueType"); params.valueType = data.valueType; }
    if (data.value !== undefined) { setClauses.push("value = @value"); params.value = JSON.stringify(data.value); }
    if (data.isActive !== undefined) { setClauses.push("is_active = @isActive"); params.isActive = data.isActive; }

    if (setClauses.length === 0) return existing;

    await client.query({
      query: `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = @id`,
      params,
    });

    return this.getObservation(id);
  }

  async deleteObservation(id: number): Promise<boolean> {
    await ensureObservationsTable();
    const client = getBigQueryClient();
    const table = this.getProjectTable();

    const existing = await this.getObservation(id);
    if (!existing) return false;

    await client.query({
      query: `DELETE FROM ${table} WHERE id = @id`,
      params: { id },
    });
    return true;
  }

  async reorderObservations(orderedIds: number[]): Promise<void> {
    await ensureObservationsTable();
    const client = getBigQueryClient();
    const table = this.getProjectTable();

    for (let i = 0; i < orderedIds.length; i++) {
      await client.query({
        query: `UPDATE ${table} SET display_order = @order WHERE id = @id`,
        params: { order: i, id: orderedIds[i] },
      });
    }
  }
  private getSettingsTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${SETTINGS_TABLE_ID}\``;
  }

  async getSetting(key: string): Promise<string | null> {
    await ensureSettingsTable();
    const client = getBigQueryClient();
    const table = this.getSettingsTable();
    const [rows] = await client.query({
      query: `SELECT value FROM ${table} WHERE key = @key LIMIT 1`,
      params: { key },
    });
    return rows.length > 0 ? rows[0].value : null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await ensureSettingsTable();
    const client = getBigQueryClient();
    const table = this.getSettingsTable();

    const existing = await this.getSetting(key);
    if (existing !== null) {
      await client.query({
        query: `UPDATE ${table} SET value = @value WHERE key = @key`,
        params: { key, value },
      });
    } else {
      await client.query({
        query: `INSERT INTO ${table} (key, value) VALUES (@key, @value)`,
        params: { key, value },
      });
    }
  }
}

export const storage = new BigQueryStorage();
