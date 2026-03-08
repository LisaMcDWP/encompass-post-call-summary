import { BigQuery } from "@google-cloud/bigquery";
import type { Observation, InsertObservation, EnumValue } from "@shared/schema";

const DATASET_ID = "transcript_analysis";
const TABLE_ID = "observations";

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

async function ensureObservationsTable(): Promise<void> {
  if (tableInitialized) return;

  const client = getBigQueryClient();
  const dataset = client.dataset(DATASET_ID);

  try {
    const [datasetExists] = await dataset.exists();
    if (!datasetExists) {
      await client.createDataset(DATASET_ID, { location: "US" });
      console.log(`Created BigQuery dataset: ${DATASET_ID}`);
    }
  } catch (err: any) {
    if (err.code === 403) {
      console.log(`BigQuery dataset ${DATASET_ID} access check failed (permissions), assuming it exists.`);
    } else {
      throw err;
    }
  }

  try {
    const table = dataset.table(TABLE_ID);
    const [tableExists] = await table.exists();
    if (!tableExists) {
      await dataset.createTable(TABLE_ID, {
        schema: {
          fields: [
            { name: "id", type: "INTEGER", mode: "REQUIRED" },
            { name: "name", type: "STRING", mode: "REQUIRED" },
            { name: "display_name", type: "STRING", mode: "REQUIRED" },
            { name: "domain", type: "STRING", mode: "REQUIRED" },
            { name: "display_order", type: "INTEGER", mode: "REQUIRED" },
            { name: "value_type", type: "STRING", mode: "REQUIRED" },
            { name: "value", type: "STRING", mode: "NULLABLE" },
            { name: "is_active", type: "BOOLEAN", mode: "REQUIRED" },
          ],
        },
      });
      console.log(`Created BigQuery table: ${DATASET_ID}.${TABLE_ID}`);
    }
  } catch (err: any) {
    if (err.code === 403) {
      console.log(`BigQuery table ${TABLE_ID} access check failed (permissions), assuming it exists.`);
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
}

export const storage = new BigQueryStorage();
