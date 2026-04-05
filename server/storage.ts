import { BigQuery } from "@google-cloud/bigquery";
import type { Observation, InsertObservation, EnumValue, ContextParameter, InsertContextParameter, CallQAPrompt, InsertCallQAPrompt, ClientPathway, InsertClientPathway } from "@shared/schema";

const DATASET_ID = "call_information";
const TABLE_ID = "observations";
const SETTINGS_TABLE_ID = "settings";
const CONTEXT_PARAMS_TABLE_ID = "context_parameters";
const CALL_QA_PROMPTS_TABLE_ID = "call_qa_prompts";
const CLIENT_PATHWAY_TABLE_ID = "client_pathway";

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
let contextParamsTableInitialized = false;
let callQAPromptsTableInitialized = false;
let clientPathwayTableInitialized = false;

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

async function ensureContextParamsTable(): Promise<void> {
  if (contextParamsTableInitialized) return;

  const client = getBigQueryClient();
  const projectId = process.env.GCP_PROJECT_ID;
  const fullTable = `${projectId}.${DATASET_ID}.${CONTEXT_PARAMS_TABLE_ID}`;

  try {
    const [rows] = await client.query({ query: `SELECT column_name FROM \`${projectId}.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${CONTEXT_PARAMS_TABLE_ID}' AND column_name = 'enum_values'` });
    if (rows.length === 0) {
      await client.query({ query: `DROP TABLE IF EXISTS \`${fullTable}\`` });
    }
    const [akRows] = await client.query({ query: `SELECT column_name FROM \`${projectId}.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${CONTEXT_PARAMS_TABLE_ID}' AND column_name = 'awell_data_point_key'` });
    if (akRows.length === 0) {
      try { await client.query({ query: `ALTER TABLE \`${fullTable}\` ADD COLUMN awell_data_point_key STRING` }); } catch {}
    }
    const [mtRows] = await client.query({ query: `SELECT column_name FROM \`${projectId}.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${CONTEXT_PARAMS_TABLE_ID}' AND column_name = 'awell_mapping_type'` });
    if (mtRows.length === 0) {
      try { await client.query({ query: `ALTER TABLE \`${fullTable}\` ADD COLUMN awell_mapping_type STRING` }); } catch {}
    }
    const [ppRows] = await client.query({ query: `SELECT column_name FROM \`${projectId}.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${CONTEXT_PARAMS_TABLE_ID}' AND column_name = 'awell_patient_profile_field'` });
    if (ppRows.length === 0) {
      try { await client.query({ query: `ALTER TABLE \`${fullTable}\` ADD COLUMN awell_patient_profile_field STRING` }); } catch {}
    }
    await client.query({
      query: `CREATE TABLE IF NOT EXISTS \`${fullTable}\` (
        id INT64 NOT NULL,
        name STRING NOT NULL,
        display_name STRING NOT NULL,
        description STRING,
        data_type STRING NOT NULL,
        enum_values STRING,
        is_active BOOL NOT NULL,
        display_order INT64 NOT NULL,
        awell_data_point_key STRING,
        awell_mapping_type STRING,
        awell_patient_profile_field STRING
      )`,
    });
    console.log(`BigQuery table ${DATASET_ID}.${CONTEXT_PARAMS_TABLE_ID} ready.`);
  } catch (err: any) {
    if (err.message?.includes("Already Exists")) {
      console.log(`BigQuery table ${DATASET_ID}.${CONTEXT_PARAMS_TABLE_ID} already exists.`);
    } else {
      throw err;
    }
  }

  contextParamsTableInitialized = true;
}

function rowToContextParameter(row: any): ContextParameter {
  let enumValues: string[] = [];
  if (row.enum_values) {
    try {
      enumValues = typeof row.enum_values === "string" ? JSON.parse(row.enum_values) : row.enum_values;
    } catch { enumValues = []; }
  }
  const mappingType = row.awell_mapping_type || (row.awell_data_point_key ? "data_point" : "none");
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description || "",
    dataType: row.data_type,
    enumValues,
    isActive: row.is_active,
    displayOrder: row.display_order,
    awellDataPointKey: row.awell_data_point_key || "",
    awellMappingType: mappingType as "none" | "data_point" | "patient_profile",
    awellPatientProfileField: row.awell_patient_profile_field || "",
  };
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
        is_active BOOL NOT NULL,
        prompt_guidance STRING
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

  try {
    await client.query({
      query: `ALTER TABLE \`${fullTable}\` ADD COLUMN IF NOT EXISTS prompt_guidance STRING`,
    });
  } catch (err: any) {
    if (!err.message?.includes("Already Exists") && !err.message?.includes("Duplicate column")) {
      console.log(`Note: Could not add prompt_guidance column (may already exist): ${err.message}`);
    }
  }

  try {
    await client.query({
      query: `ALTER TABLE \`${fullTable}\` ADD COLUMN IF NOT EXISTS description STRING`,
    });
  } catch (err: any) {
    if (!err.message?.includes("Already Exists") && !err.message?.includes("Duplicate column")) {
      console.log(`Note: Could not add description column (may already exist): ${err.message}`);
    }
  }

  tableInitialized = true;
}

async function ensureCallQAPromptsTable(): Promise<void> {
  if (callQAPromptsTableInitialized) return;

  const client = getBigQueryClient();
  const projectId = process.env.GCP_PROJECT_ID;
  const fullTable = `${projectId}.${DATASET_ID}.${CALL_QA_PROMPTS_TABLE_ID}`;

  try {
    await client.query({
      query: `CREATE TABLE IF NOT EXISTS \`${fullTable}\` (
        id INT64 NOT NULL,
        name STRING NOT NULL,
        display_name STRING NOT NULL,
        prompt_text STRING NOT NULL,
        response_type STRING DEFAULT 'enum',
        response_options STRING,
        is_active BOOL DEFAULT TRUE,
        display_order INT64 DEFAULT 0
      )`,
    });
    console.log(`BigQuery table ${DATASET_ID}.${CALL_QA_PROMPTS_TABLE_ID} ready.`);
  } catch (err: any) {
    if (err.message?.includes("Already Exists")) {
      console.log(`BigQuery table ${DATASET_ID}.${CALL_QA_PROMPTS_TABLE_ID} already exists.`);
    } else {
      throw err;
    }
  }
  callQAPromptsTableInitialized = true;
}

function rowToCallQAPrompt(row: any): CallQAPrompt {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    promptText: row.prompt_text,
    responseType: row.response_type || "enum",
    responseOptions: row.response_options ? JSON.parse(row.response_options) : [],
    isActive: row.is_active,
    displayOrder: row.display_order,
  };
}

function rowToObservation(row: any): Observation {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description || "",
    domain: row.domain,
    displayOrder: row.display_order,
    valueType: row.value_type,
    value: row.value ? JSON.parse(row.value) : [],
    isActive: row.is_active,
    promptGuidance: row.prompt_guidance || "",
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
  getContextParameters(): Promise<ContextParameter[]>;
  getActiveContextParameters(): Promise<ContextParameter[]>;
  getContextParameter(id: number): Promise<ContextParameter | undefined>;
  createContextParameter(param: InsertContextParameter): Promise<ContextParameter>;
  updateContextParameter(id: number, param: Partial<InsertContextParameter>): Promise<ContextParameter | undefined>;
  deleteContextParameter(id: number): Promise<boolean>;
  reorderContextParameters(orderedIds: number[]): Promise<void>;
  getCallQAPrompts(): Promise<CallQAPrompt[]>;
  getActiveCallQAPrompts(): Promise<CallQAPrompt[]>;
  getCallQAPrompt(id: number): Promise<CallQAPrompt | undefined>;
  createCallQAPrompt(qa: InsertCallQAPrompt): Promise<CallQAPrompt>;
  updateCallQAPrompt(id: number, qa: Partial<InsertCallQAPrompt>): Promise<CallQAPrompt | undefined>;
  deleteCallQAPrompt(id: number): Promise<boolean>;
  getClientPathway(): Promise<ClientPathway | null>;
  setClientPathway(data: InsertClientPathway): Promise<ClientPathway>;
  deleteClientPathway(): Promise<boolean>;
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
      description: observation.description || "",
      domain: observation.domain || "general",
      display_order: observation.displayOrder ?? 0,
      value_type: observation.valueType || "enum",
      value: JSON.stringify(observation.value || []),
      is_active: observation.isActive !== false,
      prompt_guidance: observation.promptGuidance || "",
    };

    await client.query({
      query: `INSERT INTO ${table} (id, name, display_name, description, domain, display_order, value_type, value, is_active, prompt_guidance) VALUES (@id, @name, @display_name, @description, @domain, @display_order, @value_type, @value, @is_active, @prompt_guidance)`,
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
    if (data.description !== undefined) { setClauses.push("description = @description"); params.description = data.description; }
    if (data.domain !== undefined) { setClauses.push("domain = @domain"); params.domain = data.domain; }
    if (data.displayOrder !== undefined) { setClauses.push("display_order = @displayOrder"); params.displayOrder = data.displayOrder; }
    if (data.valueType !== undefined) { setClauses.push("value_type = @valueType"); params.valueType = data.valueType; }
    if (data.value !== undefined) { setClauses.push("value = @value"); params.value = JSON.stringify(data.value); }
    if (data.isActive !== undefined) { setClauses.push("is_active = @isActive"); params.isActive = data.isActive; }
    if (data.promptGuidance !== undefined) { setClauses.push("prompt_guidance = @promptGuidance"); params.promptGuidance = data.promptGuidance; }

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
  private getContextParamsTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${CONTEXT_PARAMS_TABLE_ID}\``;
  }

  async getContextParameters(): Promise<ContextParameter[]> {
    await ensureContextParamsTable();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} ORDER BY display_order ASC` });
    return rows.map(rowToContextParameter);
  }

  async getActiveContextParameters(): Promise<ContextParameter[]> {
    await ensureContextParamsTable();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE is_active = TRUE ORDER BY display_order ASC` });
    return rows.map(rowToContextParameter);
  }

  async getContextParameter(id: number): Promise<ContextParameter | undefined> {
    await ensureContextParamsTable();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();
    const [rows] = await client.query({
      query: `SELECT * FROM ${table} WHERE id = @id`,
      params: { id },
    });
    return rows.length > 0 ? rowToContextParameter(rows[0]) : undefined;
  }

  private async getNextContextParamId(): Promise<number> {
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();
    const [rows] = await client.query({ query: `SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM ${table}` });
    return rows[0].next_id;
  }

  async createContextParameter(param: InsertContextParameter): Promise<ContextParameter> {
    await ensureContextParamsTable();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();
    const id = await this.getNextContextParamId();

    const row = {
      id,
      name: param.name,
      display_name: param.displayName,
      description: param.description || "",
      data_type: param.dataType || "string",
      enum_values: JSON.stringify(param.enumValues || []),
      is_active: param.isActive !== false,
      display_order: param.displayOrder ?? 0,
      awell_data_point_key: param.awellDataPointKey || "",
      awell_mapping_type: param.awellMappingType || "none",
      awell_patient_profile_field: param.awellPatientProfileField || "",
    };

    await client.query({
      query: `INSERT INTO ${table} (id, name, display_name, description, data_type, enum_values, is_active, display_order, awell_data_point_key, awell_mapping_type, awell_patient_profile_field) VALUES (@id, @name, @display_name, @description, @data_type, @enum_values, @is_active, @display_order, @awell_data_point_key, @awell_mapping_type, @awell_patient_profile_field)`,
      params: row,
    });

    return rowToContextParameter(row);
  }

  async updateContextParameter(id: number, data: Partial<InsertContextParameter>): Promise<ContextParameter | undefined> {
    await ensureContextParamsTable();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();

    const existing = await this.getContextParameter(id);
    if (!existing) return undefined;

    const setClauses: string[] = [];
    const params: Record<string, any> = { id };

    if (data.name !== undefined) { setClauses.push("name = @name"); params.name = data.name; }
    if (data.displayName !== undefined) { setClauses.push("display_name = @displayName"); params.displayName = data.displayName; }
    if (data.description !== undefined) { setClauses.push("description = @description"); params.description = data.description; }
    if (data.dataType !== undefined) { setClauses.push("data_type = @dataType"); params.dataType = data.dataType; }
    if (data.enumValues !== undefined) { setClauses.push("enum_values = @enumValues"); params.enumValues = JSON.stringify(data.enumValues); }
    if (data.isActive !== undefined) { setClauses.push("is_active = @isActive"); params.isActive = data.isActive; }
    if (data.displayOrder !== undefined) { setClauses.push("display_order = @displayOrder"); params.displayOrder = data.displayOrder; }
    if (data.awellDataPointKey !== undefined) { setClauses.push("awell_data_point_key = @awellDataPointKey"); params.awellDataPointKey = data.awellDataPointKey; }
    if (data.awellMappingType !== undefined) { setClauses.push("awell_mapping_type = @awellMappingType"); params.awellMappingType = data.awellMappingType; }
    if (data.awellPatientProfileField !== undefined) { setClauses.push("awell_patient_profile_field = @awellPatientProfileField"); params.awellPatientProfileField = data.awellPatientProfileField; }

    if (setClauses.length === 0) return existing;

    await client.query({
      query: `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = @id`,
      params,
    });

    return this.getContextParameter(id);
  }

  async deleteContextParameter(id: number): Promise<boolean> {
    await ensureContextParamsTable();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();

    const existing = await this.getContextParameter(id);
    if (!existing) return false;

    await client.query({
      query: `DELETE FROM ${table} WHERE id = @id`,
      params: { id },
    });
    return true;
  }

  async reorderContextParameters(orderedIds: number[]): Promise<void> {
    await ensureContextParamsTable();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();

    for (let i = 0; i < orderedIds.length; i++) {
      await client.query({
        query: `UPDATE ${table} SET display_order = @order WHERE id = @id`,
        params: { order: i, id: orderedIds[i] },
      });
    }
  }

  private getCallQAPromptsTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${CALL_QA_PROMPTS_TABLE_ID}\``;
  }

  private async getNextCallQAPromptId(): Promise<number> {
    const client = getBigQueryClient();
    const table = this.getCallQAPromptsTable();
    const [rows] = await client.query({ query: `SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM ${table}` });
    return rows[0].next_id;
  }

  async getCallQAPrompts(): Promise<CallQAPrompt[]> {
    await ensureCallQAPromptsTable();
    const client = getBigQueryClient();
    const table = this.getCallQAPromptsTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} ORDER BY display_order ASC` });
    return rows.map(rowToCallQAPrompt);
  }

  async getActiveCallQAPrompts(): Promise<CallQAPrompt[]> {
    await ensureCallQAPromptsTable();
    const client = getBigQueryClient();
    const table = this.getCallQAPromptsTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE is_active = TRUE ORDER BY display_order ASC` });
    return rows.map(rowToCallQAPrompt);
  }

  async getCallQAPrompt(id: number): Promise<CallQAPrompt | undefined> {
    await ensureCallQAPromptsTable();
    const client = getBigQueryClient();
    const table = this.getCallQAPromptsTable();
    const [rows] = await client.query({
      query: `SELECT * FROM ${table} WHERE id = @id`,
      params: { id },
    });
    return rows.length > 0 ? rowToCallQAPrompt(rows[0]) : undefined;
  }

  async createCallQAPrompt(qa: InsertCallQAPrompt): Promise<CallQAPrompt> {
    await ensureCallQAPromptsTable();
    const client = getBigQueryClient();
    const table = this.getCallQAPromptsTable();
    const id = await this.getNextCallQAPromptId();

    await client.query({
      query: `INSERT INTO ${table} (id, name, display_name, prompt_text, response_type, response_options, is_active, display_order)
              VALUES (@id, @name, @display_name, @prompt_text, @response_type, @response_options, @is_active, @display_order)`,
      params: {
        id,
        name: qa.name,
        display_name: qa.displayName,
        prompt_text: qa.promptText,
        response_type: qa.responseType || "enum",
        response_options: JSON.stringify(qa.responseOptions || []),
        is_active: qa.isActive !== false,
        display_order: qa.displayOrder ?? 0,
      },
    });

    return { id, name: qa.name, displayName: qa.displayName, promptText: qa.promptText, responseType: qa.responseType || "enum", responseOptions: qa.responseOptions || [], isActive: qa.isActive !== false, displayOrder: qa.displayOrder ?? 0 };
  }

  async updateCallQAPrompt(id: number, qa: Partial<InsertCallQAPrompt>): Promise<CallQAPrompt | undefined> {
    await ensureCallQAPromptsTable();
    const existing = await this.getCallQAPrompt(id);
    if (!existing) return undefined;

    const client = getBigQueryClient();
    const table = this.getCallQAPromptsTable();
    const updates: string[] = [];
    const params: any = { id };

    if (qa.name !== undefined) { updates.push("name = @name"); params.name = qa.name; }
    if (qa.displayName !== undefined) { updates.push("display_name = @display_name"); params.display_name = qa.displayName; }
    if (qa.promptText !== undefined) { updates.push("prompt_text = @prompt_text"); params.prompt_text = qa.promptText; }
    if (qa.responseType !== undefined) { updates.push("response_type = @response_type"); params.response_type = qa.responseType; }
    if (qa.responseOptions !== undefined) { updates.push("response_options = @response_options"); params.response_options = JSON.stringify(qa.responseOptions); }
    if (qa.isActive !== undefined) { updates.push("is_active = @is_active"); params.is_active = qa.isActive; }
    if (qa.displayOrder !== undefined) { updates.push("display_order = @display_order"); params.display_order = qa.displayOrder; }

    if (updates.length > 0) {
      await client.query({
        query: `UPDATE ${table} SET ${updates.join(", ")} WHERE id = @id`,
        params,
      });
    }

    return this.getCallQAPrompt(id);
  }

  async deleteCallQAPrompt(id: number): Promise<boolean> {
    await ensureCallQAPromptsTable();
    const existing = await this.getCallQAPrompt(id);
    if (!existing) return false;
    const client = getBigQueryClient();
    const table = this.getCallQAPromptsTable();
    await client.query({
      query: `DELETE FROM ${table} WHERE id = @id`,
      params: { id },
    });
    return true;
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

  private getClientPathwayTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${CLIENT_PATHWAY_TABLE_ID}\``;
  }

  async getClientPathway(): Promise<ClientPathway | null> {
    await ensureClientPathwayTable();
    const client = getBigQueryClient();
    const table = this.getClientPathwayTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} LIMIT 1` });
    if (rows.length === 0) return null;
    const row = rows[0] as any;
    return { id: row.id, client: row.client, pathway: row.pathway };
  }

  async setClientPathway(data: InsertClientPathway): Promise<ClientPathway> {
    await ensureClientPathwayTable();
    const client = getBigQueryClient();
    const table = this.getClientPathwayTable();

    await client.query({ query: `DELETE FROM ${table} WHERE TRUE` });

    const row = { id: 1, client: data.client, pathway: data.pathway };
    await client.query({
      query: `INSERT INTO ${table} (id, client, pathway) VALUES (@id, @client, @pathway)`,
      params: row,
    });
    return row;
  }

  async deleteClientPathway(): Promise<boolean> {
    await ensureClientPathwayTable();
    const client = getBigQueryClient();
    const table = this.getClientPathwayTable();
    await client.query({ query: `DELETE FROM ${table} WHERE TRUE` });
    return true;
  }
}

async function ensureClientPathwayTable(): Promise<void> {
  if (clientPathwayTableInitialized) return;

  const client = getBigQueryClient();
  const projectId = process.env.GCP_PROJECT_ID;
  const fullTable = `${projectId}.${DATASET_ID}.${CLIENT_PATHWAY_TABLE_ID}`;

  try {
    await client.query({
      query: `CREATE TABLE IF NOT EXISTS \`${fullTable}\` (
        id INT64 NOT NULL,
        client STRING NOT NULL,
        pathway STRING NOT NULL
      )`,
    });
    console.log(`BigQuery table ${DATASET_ID}.${CLIENT_PATHWAY_TABLE_ID} ready.`);
  } catch (err: any) {
    if (err.message?.includes("Already Exists")) {
      console.log(`BigQuery table ${DATASET_ID}.${CLIENT_PATHWAY_TABLE_ID} already exists.`);
    } else {
      throw err;
    }
  }

  clientPathwayTableInitialized = true;
}

export const storage = new BigQueryStorage();
