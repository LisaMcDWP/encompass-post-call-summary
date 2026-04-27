import { BigQuery } from "@google-cloud/bigquery";
import type {
  Observation, InsertObservation, EnumValue, ContextParameter, InsertContextParameter,
  CallQAPrompt, InsertCallQAPrompt, ClientPathway, InsertClientPathway,
  DispositionCategory, InsertDispositionCategory, DispositionDetail, InsertDispositionDetail,
  CallReviewItem, InsertCallReviewItem,
  ActivationObjective, InsertActivationObjective,
  ActivationObjectiveStage, ActivationObjectiveThreshold, ActivationObjectiveInteractionConfig,
  ActivationInteraction, InsertActivationInteraction,
  ObservationEnumValue,
} from "@shared/schema";
import {
  SYSTEM_STAGE_NOT_DISCUSSED,
  SYSTEM_STAGE_NOT_DISCUSSED_ID,
  SYSTEM_STAGE_NOT_DISCUSSED_VALUE,
  SYSTEM_STAGE_EXCLUDED,
  SYSTEM_STAGE_EXCLUDED_ID,
  SYSTEM_STAGE_IDS,
} from "@shared/schema";

// Match any case/whitespace variant of "not discussed" — covers legacy data
// like "Not Discussed", " not discussed ", etc.
const NORM_NOT_DISCUSSED = SYSTEM_STAGE_NOT_DISCUSSED_VALUE.trim().toLowerCase();
const isNotDiscussedLabel = (s: string | null | undefined): boolean =>
  !!s && s.trim().toLowerCase() === NORM_NOT_DISCUSSED;

// Auto-inject baseline stages on read so every objective has them without
// requiring per-objective config. Idempotent. Two system stages are injected:
//   - "Not discussed": auto-bound to the literal "Not discussed" extracted value.
//   - "Excluded": stage exists by default but no auto-mapping; users opt-in by
//     mapping specific observation values to it.
function injectSystemStages(obj: ActivationObjective): ActivationObjective {
  const stages = Array.isArray(obj.stages) ? [...obj.stages] : [];
  if (!stages.some((s) => s.id === SYSTEM_STAGE_NOT_DISCUSSED_ID)) {
    // Place after stage_unresolved (if present), otherwise at the start.
    const insertAt = stages.findIndex((s) => s.id === "stage_unresolved");
    if (insertAt >= 0) stages.splice(insertAt + 1, 0, { ...SYSTEM_STAGE_NOT_DISCUSSED });
    else stages.unshift({ ...SYSTEM_STAGE_NOT_DISCUSSED });
  }
  if (!stages.some((s) => s.id === SYSTEM_STAGE_EXCLUDED_ID)) {
    // Place right after stage_not_discussed.
    const insertAt = stages.findIndex((s) => s.id === SYSTEM_STAGE_NOT_DISCUSSED_ID);
    if (insertAt >= 0) stages.splice(insertAt + 1, 0, { ...SYSTEM_STAGE_EXCLUDED });
    else stages.unshift({ ...SYSTEM_STAGE_EXCLUDED });
  }

  // Ensure stageMappings always routes any "not discussed" variant to the
  // system stage, overriding any stale legacy mapping. Strip ALL variants
  // first, then push canonical — so nothing can shadow it on lookup.
  // No auto-mapping for "Excluded" — only user-defined observation values
  // get routed there.
  const mappings = (Array.isArray(obj.stageMappings) ? obj.stageMappings : [])
    .filter((m) => m && !isNotDiscussedLabel(m.extractedValue));
  mappings.push({
    extractedValue: SYSTEM_STAGE_NOT_DISCUSSED_VALUE,
    stageId: SYSTEM_STAGE_NOT_DISCUSSED_ID,
  });

  return { ...obj, stages, stageMappings: mappings };
}

// Strip system-managed stages + mapping from write payloads so the canonical
// definitions live only in one place (re-injected on read). Strips ALL
// case/whitespace variants of "not discussed" too, so legacy variant rows
// in BQ get cleaned up the next time the user saves the objective. User
// mappings whose stageId points to a system stage (e.g. observation value
// → "Excluded" or → "Not discussed") are PRESERVED — only the system stage
// definitions themselves are stripped.
function stripSystemStages<T extends Partial<InsertActivationObjective>>(data: T): T {
  const out: any = { ...data };
  if (Array.isArray(out.stages)) {
    out.stages = out.stages.filter(
      (s: ActivationObjectiveStage) =>
        s.id !== SYSTEM_STAGE_NOT_DISCUSSED_ID && s.id !== SYSTEM_STAGE_EXCLUDED_ID,
    );
  }
  if (Array.isArray(out.stageMappings)) {
    out.stageMappings = out.stageMappings.filter(
      (m: { extractedValue: string }) => !isNotDiscussedLabel(m.extractedValue),
    );
  }
  return out as T;
}

const DATASET_ID = "call_information";
const TABLE_ID = "observations";
const SETTINGS_TABLE_ID = "settings";
const CONTEXT_PARAMS_TABLE_ID = "context_parameters";
const CALL_QA_PROMPTS_TABLE_ID = "call_qa_prompts";
const CLIENT_PATHWAY_TABLE_ID = "client_pathway";
const DISPOSITION_CATEGORIES_TABLE_ID = "disposition_categories";
const DISPOSITION_DETAILS_TABLE_ID = "disposition_details";
const CALL_REVIEW_ITEMS_TABLE_ID = "call_review_items";
const ACTIVATION_OBJECTIVES_TABLE_ID = "activation_objectives";
const ACTIVATION_INTERACTIONS_TABLE_ID = "activation_interactions";

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
let dispositionCategoriesTableInitialized = false;
let dispositionDetailsTableInitialized = false;
let activationObjectivesTableInitialized = false;
let activationInteractionsTableInitialized = false;

async function ensureSettingsTable(): Promise<void> {
  if (settingsTableInitialized) return;

  const client = getBigQueryClient();
  const projectId = process.env.GCP_PROJECT_ID;
  const fullTable = `${projectId}.${DATASET_ID}.${SETTINGS_TABLE_ID}`;

  try {
    await client.query({
      query: `CREATE TABLE IF NOT EXISTS \`${fullTable}\` (
        key STRING NOT NULL,
        value STRING NOT NULL,
        client_pathway_id INT64
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
        awell_patient_profile_field STRING,
        client_pathway_id INT64
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
        description STRING,
        domain STRING NOT NULL,
        display_order INT64 NOT NULL,
        value_type STRING NOT NULL,
        value STRING,
        is_active BOOL NOT NULL,
        prompt_guidance STRING,
        client_pathway_id INT64
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
        display_order INT64 DEFAULT 0,
        client_pathway_id INT64
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

async function addIsGlobalColumn(client: any, fullTable: string, label: string): Promise<void> {
  try {
    await client.query({ query: `ALTER TABLE \`${fullTable}\` ADD COLUMN is_global BOOL` });
  } catch (err: any) {
    if (!err.message?.includes("already exists") && !err.message?.includes("Duplicate")) {
      console.warn(`${label} ADD COLUMN is_global:`, err.message);
    }
  }
  try {
    await client.query({ query: `ALTER TABLE \`${fullTable}\` ALTER COLUMN is_global SET DEFAULT FALSE` });
  } catch (err: any) {
    console.warn(`${label} SET DEFAULT:`, err.message);
  }
  try {
    await client.query({ query: `UPDATE \`${fullTable}\` SET is_global = FALSE WHERE is_global IS NULL` });
  } catch (err: any) {
    console.warn(`${label} backfill nulls:`, err.message);
  }
}

async function ensureDispositionCategoriesTable(): Promise<void> {
  if (dispositionCategoriesTableInitialized) return;
  const client = getBigQueryClient();
  const projectId = process.env.GCP_PROJECT_ID;
  const fullTable = `${projectId}.${DATASET_ID}.${DISPOSITION_CATEGORIES_TABLE_ID}`;
  try {
    await client.query({
      query: `CREATE TABLE IF NOT EXISTS \`${fullTable}\` (
        id INT64 NOT NULL,
        name STRING NOT NULL,
        display_name STRING NOT NULL,
        description STRING DEFAULT '',
        display_order INT64 DEFAULT 0,
        is_active BOOL DEFAULT TRUE,
        is_global BOOL DEFAULT FALSE,
        client_pathway_id INT64
      )`,
    });
    await addIsGlobalColumn(client, fullTable, "categories");
    console.log(`BigQuery table ${DATASET_ID}.${DISPOSITION_CATEGORIES_TABLE_ID} ready.`);
  } catch (err: any) {
    if (err.message?.includes("Already Exists")) {
      await addIsGlobalColumn(client, fullTable, "categories");
      console.log(`BigQuery table ${DATASET_ID}.${DISPOSITION_CATEGORIES_TABLE_ID} already exists.`);
    } else { throw err; }
  }
  dispositionCategoriesTableInitialized = true;
}

async function ensureDispositionDetailsTable(): Promise<void> {
  if (dispositionDetailsTableInitialized) return;
  const client = getBigQueryClient();
  const projectId = process.env.GCP_PROJECT_ID;
  const fullTable = `${projectId}.${DATASET_ID}.${DISPOSITION_DETAILS_TABLE_ID}`;
  try {
    await client.query({
      query: `CREATE TABLE IF NOT EXISTS \`${fullTable}\` (
        id INT64 NOT NULL,
        category_id INT64 NOT NULL,
        name STRING NOT NULL,
        display_name STRING NOT NULL,
        description STRING DEFAULT '',
        display_order INT64 DEFAULT 0,
        is_active BOOL DEFAULT TRUE,
        is_global BOOL DEFAULT FALSE,
        client_pathway_id INT64
      )`,
    });
    await addIsGlobalColumn(client, fullTable, "details");
    console.log(`BigQuery table ${DATASET_ID}.${DISPOSITION_DETAILS_TABLE_ID} ready.`);
  } catch (err: any) {
    if (err.message?.includes("Already Exists")) {
      await addIsGlobalColumn(client, fullTable, "details");
      console.log(`BigQuery table ${DATASET_ID}.${DISPOSITION_DETAILS_TABLE_ID} already exists.`);
    } else { throw err; }
  }
  dispositionDetailsTableInitialized = true;
}

let callReviewItemsTableInitialized = false;
export async function ensureCallReviewItemsTable(): Promise<void> {
  if (callReviewItemsTableInitialized) return;
  const client = getBigQueryClient();
  const projectId = process.env.GCP_PROJECT_ID;
  const fullTable = `${projectId}.${DATASET_ID}.${CALL_REVIEW_ITEMS_TABLE_ID}`;
  try {
    await client.query({
      query: `CREATE TABLE IF NOT EXISTS \`${fullTable}\` (
        id INT64 NOT NULL,
        name STRING NOT NULL,
        display_name STRING NOT NULL,
        description STRING DEFAULT '',
        category STRING DEFAULT 'General',
        display_order INT64 DEFAULT 0,
        is_active BOOL DEFAULT TRUE,
        client_pathway_id INT64
      )`,
    });
    console.log(`BigQuery table ${DATASET_ID}.${CALL_REVIEW_ITEMS_TABLE_ID} ready.`);
  } catch (err: any) {
    if (err.message?.includes("Already Exists")) {
      console.log(`BigQuery table ${DATASET_ID}.${CALL_REVIEW_ITEMS_TABLE_ID} already exists.`);
    } else { throw err; }
  }
  callReviewItemsTableInitialized = true;
}

function rowToCallReviewItem(row: any): CallReviewItem {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description || "",
    category: row.category || "General",
    displayOrder: row.display_order ?? 0,
    isActive: row.is_active,
  };
}

function rowToDispositionCategory(row: any): DispositionCategory {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description || "",
    displayOrder: row.display_order ?? 0,
    isActive: row.is_active,
    isGlobal: row.is_global ?? false,
  };
}

function rowToDispositionDetail(row: any): DispositionDetail {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    displayName: row.display_name,
    description: row.description || "",
    displayOrder: row.display_order ?? 0,
    isActive: row.is_active,
    isGlobal: row.is_global ?? false,
  };
}

function rowToObservation(row: any): Observation {
  // Legacy rows stored enum values as { label, color }. Newer rows include a
  // per-value promptHint that flows into linked-objective prompts. Backfill it
  // here so callers always see the canonical {label, color, promptHint} shape.
  // Wrap the JSON parse to guard against historically malformed `value` columns
  // — a single bad row should not 500 the entire observations endpoint.
  const VALID_COLORS = new Set(["GREEN", "YELLOW", "RED", "BLUE", "GRAY"]);
  let rawValues: unknown = [];
  if (row.value) {
    try {
      rawValues = JSON.parse(row.value);
    } catch {
      console.warn(`[observations] malformed JSON in value column for id=${row.id}; defaulting to []`);
      rawValues = [];
    }
  }
  const value = Array.isArray(rawValues)
    ? rawValues.map((v: any) => {
        if (typeof v === "string") {
          return { label: v, color: "GRAY" as const, promptHint: "" };
        }
        const color = v?.color;
        return {
          label: typeof v?.label === "string" ? v.label : "",
          color: (typeof color === "string" && VALID_COLORS.has(color) ? color : "GRAY") as
            "GREEN" | "YELLOW" | "RED" | "BLUE" | "GRAY",
          promptHint: typeof v?.promptHint === "string" ? v.promptHint : "",
        };
      })
    : [];
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description || "",
    domain: row.domain,
    displayOrder: row.display_order,
    valueType: row.value_type,
    value,
    isActive: row.is_active,
    promptGuidance: row.prompt_guidance || "",
  };
}

async function ensureActivationObjectivesTable(): Promise<void> {
  if (activationObjectivesTableInitialized) return;

  const client = getBigQueryClient();
  const projectId = process.env.GCP_PROJECT_ID;
  const fullTable = `${projectId}.${DATASET_ID}.${ACTIVATION_OBJECTIVES_TABLE_ID}`;

  try {
    await client.query({
      query: `CREATE TABLE IF NOT EXISTS \`${fullTable}\` (
        id INT64 NOT NULL,
        name STRING NOT NULL,
        display_name STRING NOT NULL,
        description STRING,
        anchor_event_type STRING NOT NULL,
        anchor_context_key STRING NOT NULL,
        interaction_context_key STRING,
        window_days INT64 NOT NULL,
        stages STRING,
        achieved_stage_id STRING,
        thresholds STRING,
        observation_name STRING,
        extracted_enum_values STRING,
        stage_mappings STRING,
        interactions STRING,
        is_active BOOL NOT NULL,
        display_order INT64 NOT NULL,
        prompt_guidance STRING,
        client_pathway_id INT64
      )`,
    });
    console.log(`BigQuery table ${DATASET_ID}.${ACTIVATION_OBJECTIVES_TABLE_ID} ready.`);
  } catch (err: any) {
    if (err.message?.includes("Already Exists")) {
      console.log(`BigQuery table ${DATASET_ID}.${ACTIVATION_OBJECTIVES_TABLE_ID} already exists.`);
    } else {
      throw err;
    }
  }

  // Idempotent migration: add new columns if missing (legacy table had `touchpoints` column).
  const migrationColumns: { col: string; type: string }[] = [
    { col: "interaction_context_key", type: "STRING" },
    { col: "interactions", type: "STRING" },
    { col: "observation_name", type: "STRING" },
    { col: "extracted_enum_values", type: "STRING" },
    { col: "stage_mappings", type: "STRING" },
    { col: "observation_topic_ids", type: "STRING" },
  ];
  for (const { col, type } of migrationColumns) {
    try {
      await client.query({
        query: `ALTER TABLE \`${fullTable}\` ADD COLUMN IF NOT EXISTS ${col} ${type}`,
      });
      console.log(`Schema migration ok for ${ACTIVATION_OBJECTIVES_TABLE_ID}: ensured column ${col}`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (!/already exists/i.test(msg)) {
        console.warn(`Schema migration warning for ${ACTIVATION_OBJECTIVES_TABLE_ID}.${col}: ${msg}`);
      }
    }
  }

  activationObjectivesTableInitialized = true;
}

function rowToActivationObjective(row: any): ActivationObjective {
  let stages: ActivationObjectiveStage[] = [];
  let thresholds: ActivationObjectiveThreshold[] = [];
  let interactionsRaw: any[] = [];
  let stageMappings: any[] = [];
  let observationTopicIds: number[] = [];
  try { if (row.stages) stages = JSON.parse(row.stages); } catch {}
  try { if (row.thresholds) thresholds = JSON.parse(row.thresholds); } catch {}
  try { if (row.interactions) interactionsRaw = JSON.parse(row.interactions); } catch {}
  try { if (row.stage_mappings) stageMappings = JSON.parse(row.stage_mappings); } catch {}
  try {
    if (row.observation_topic_ids) {
      const parsed = JSON.parse(row.observation_topic_ids);
      if (Array.isArray(parsed)) observationTopicIds = parsed.filter((id) => typeof id === "number");
    }
  } catch {}

  // Backward-compat: legacy rows stored stageMappings inside each interaction
  // config. Hoist from the first interaction that has them if the new
  // objective-level column is empty.
  if (stageMappings.length === 0) {
    for (const cfg of interactionsRaw) {
      if (Array.isArray(cfg?.stageMappings) && cfg.stageMappings.length > 0) {
        stageMappings = cfg.stageMappings;
        break;
      }
    }
  }

  // Strip legacy fields from per-interaction configs so the typed shape matches.
  const interactions: ActivationObjectiveInteractionConfig[] = interactionsRaw.map((c: any) => ({
    interactionId: c.interactionId,
    isDefault: c.isDefault === true,
    canResolveObjective: c.canResolveObjective !== false,
    inclusionRules: c.inclusionRules || { requirePcpAssigned: false, requireCompletedWithPatientOrCaregiver: true, customRules: [] },
    promptGuidance: c.promptGuidance || "",
    observationTopicIds: Array.isArray(c.observationTopicIds)
      ? c.observationTopicIds.filter((id: any) => typeof id === "number")
      : [],
  }));

  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description || "",
    anchorEventType: row.anchor_event_type,
    anchorContextKey: row.anchor_context_key,
    interactionContextKey: row.interaction_context_key || "interaction_key",
    windowDays: typeof row.window_days === "object" && row.window_days !== null
      ? Number(row.window_days.value ?? row.window_days)
      : Number(row.window_days),
    stages,
    achievedStageId: row.achieved_stage_id || "",
    thresholds,
    observationName: row.observation_name || "",
    stageMappings,
    interactions,
    isActive: row.is_active,
    displayOrder: row.display_order,
    observationTopicIds,
  };
}

async function ensureActivationInteractionsTable(): Promise<void> {
  if (activationInteractionsTableInitialized) return;

  const client = getBigQueryClient();
  const projectId = process.env.GCP_PROJECT_ID;
  const fullTable = `${projectId}.${DATASET_ID}.${ACTIVATION_INTERACTIONS_TABLE_ID}`;

  try {
    await client.query({
      query: `CREATE TABLE IF NOT EXISTS \`${fullTable}\` (
        id INT64 NOT NULL,
        client_pathway_id INT64 NOT NULL,
        \`key\` STRING NOT NULL,
        name STRING NOT NULL,
        description STRING,
        interaction_type STRING,
        expected_day_offset INT64,
        parent_interaction_id INT64,
        interval_days INT64,
        start_after_objective_id INT64,
        is_active BOOL NOT NULL,
        display_order INT64 NOT NULL
      )`,
    });
    console.log(`BigQuery table ${DATASET_ID}.${ACTIVATION_INTERACTIONS_TABLE_ID} ready.`);
  } catch (err: any) {
    if (err.message?.includes("Already Exists")) {
      console.log(`BigQuery table ${DATASET_ID}.${ACTIVATION_INTERACTIONS_TABLE_ID} already exists.`);
    } else {
      throw err;
    }
  }

  // Idempotent migration: add new columns if missing (legacy tables predate type model).
  // Hard-fail on unexpected errors so CRUD never silently runs against an unexpected schema.
  const migrationColumns: { col: string; type: string }[] = [
    { col: "interaction_type", type: "STRING" },
    { col: "parent_interaction_id", type: "INT64" },
    { col: "interval_days", type: "INT64" },
    { col: "start_after_objective_id", type: "INT64" },
  ];
  for (const { col, type } of migrationColumns) {
    try {
      await client.query({
        query: `ALTER TABLE \`${fullTable}\` ADD COLUMN IF NOT EXISTS ${col} ${type}`,
      });
      console.log(`Schema migration ok for ${ACTIVATION_INTERACTIONS_TABLE_ID}: ensured column ${col}`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (/already exists/i.test(msg)) {
        // Benign on engines that don't support ADD COLUMN IF NOT EXISTS.
        continue;
      }
      console.error(`Schema migration FAILED for ${ACTIVATION_INTERACTIONS_TABLE_ID}.${col}: ${msg}`);
      throw err;
    }
  }

  activationInteractionsTableInitialized = true;
}

function readNullableInt(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && v !== null) {
    const inner = (v as any).value;
    if (inner === null || inner === undefined) return null;
    return Number(inner);
  }
  return Number(v);
}

function rowToActivationInteraction(row: any): ActivationInteraction {
  const rawType = row.interaction_type;
  const interactionType: ActivationInteraction["interactionType"] =
    rawType === "ad_hoc" || rawType === "continuous" ? rawType : "scheduled";
  return {
    id: row.id,
    clientPathwayId: row.client_pathway_id,
    key: row.key,
    name: row.name,
    description: row.description || "",
    interactionType,
    expectedDayOffset: readNullableInt(row.expected_day_offset),
    parentInteractionId: readNullableInt(row.parent_interaction_id),
    intervalDays: readNullableInt(row.interval_days),
    startAfterObjectiveId: readNullableInt(row.start_after_objective_id),
    isActive: row.is_active,
    displayOrder: row.display_order,
  };
}

export interface IStorage {
  getClientPathways(): Promise<ClientPathway[]>;
  getClientPathway(id: number): Promise<ClientPathway | null>;
  createClientPathway(data: InsertClientPathway): Promise<ClientPathway>;
  updateClientPathway(id: number, data: Partial<InsertClientPathway>): Promise<ClientPathway | null>;
  deleteClientPathway(id: number): Promise<boolean>;

  getObservations(clientPathwayId: number): Promise<Observation[]>;
  getActiveObservations(clientPathwayId: number): Promise<Observation[]>;
  getObservation(id: number, clientPathwayId?: number): Promise<Observation | undefined>;
  createObservation(clientPathwayId: number, observation: InsertObservation): Promise<Observation>;
  updateObservation(id: number, observation: Partial<InsertObservation>, clientPathwayId?: number): Promise<Observation | undefined>;
  deleteObservation(id: number, clientPathwayId?: number): Promise<boolean>;
  reorderObservations(orderedIds: number[], clientPathwayId?: number): Promise<void>;

  getSetting(clientPathwayId: number, key: string): Promise<string | null>;
  setSetting(clientPathwayId: number, key: string, value: string): Promise<void>;
  deleteSetting(clientPathwayId: number, key: string): Promise<void>;

  getContextParameters(clientPathwayId: number): Promise<ContextParameter[]>;
  getActiveContextParameters(clientPathwayId: number): Promise<ContextParameter[]>;
  getContextParameter(id: number, clientPathwayId?: number): Promise<ContextParameter | undefined>;
  createContextParameter(clientPathwayId: number, param: InsertContextParameter): Promise<ContextParameter>;
  updateContextParameter(id: number, param: Partial<InsertContextParameter>, clientPathwayId?: number): Promise<ContextParameter | undefined>;
  deleteContextParameter(id: number, clientPathwayId?: number): Promise<boolean>;
  reorderContextParameters(orderedIds: number[], clientPathwayId?: number): Promise<void>;

  getCallQAPrompts(clientPathwayId: number): Promise<CallQAPrompt[]>;
  getActiveCallQAPrompts(clientPathwayId: number): Promise<CallQAPrompt[]>;
  getCallQAPrompt(id: number, clientPathwayId?: number): Promise<CallQAPrompt | undefined>;
  createCallQAPrompt(clientPathwayId: number, qa: InsertCallQAPrompt): Promise<CallQAPrompt>;
  updateCallQAPrompt(id: number, qa: Partial<InsertCallQAPrompt>, clientPathwayId?: number): Promise<CallQAPrompt | undefined>;
  deleteCallQAPrompt(id: number, clientPathwayId?: number): Promise<boolean>;

  getDispositionCategories(clientPathwayId: number): Promise<DispositionCategory[]>;
  getActiveDispositionCategories(clientPathwayId: number): Promise<DispositionCategory[]>;
  getDispositionCategory(id: number, clientPathwayId?: number): Promise<DispositionCategory | undefined>;
  createDispositionCategory(clientPathwayId: number, data: InsertDispositionCategory): Promise<DispositionCategory>;
  updateDispositionCategory(id: number, data: Partial<InsertDispositionCategory>, clientPathwayId?: number): Promise<DispositionCategory | undefined>;
  deleteDispositionCategory(id: number, clientPathwayId?: number): Promise<boolean>;

  getDispositionDetails(clientPathwayId: number, categoryId?: number): Promise<DispositionDetail[]>;
  getActiveDispositionDetails(clientPathwayId: number, categoryId?: number): Promise<DispositionDetail[]>;
  getDispositionDetail(id: number, clientPathwayId?: number): Promise<DispositionDetail | undefined>;
  createDispositionDetail(clientPathwayId: number, data: InsertDispositionDetail): Promise<DispositionDetail>;
  updateDispositionDetail(id: number, data: Partial<InsertDispositionDetail>, clientPathwayId?: number): Promise<DispositionDetail | undefined>;
  deleteDispositionDetail(id: number, clientPathwayId?: number): Promise<boolean>;

  getCallReviewItems(clientPathwayId: number): Promise<CallReviewItem[]>;
  getActiveCallReviewItems(clientPathwayId: number): Promise<CallReviewItem[]>;
  getCallReviewItem(id: number, clientPathwayId?: number): Promise<CallReviewItem | undefined>;
  createCallReviewItem(clientPathwayId: number, data: InsertCallReviewItem): Promise<CallReviewItem>;
  updateCallReviewItem(id: number, data: Partial<InsertCallReviewItem>, clientPathwayId?: number): Promise<CallReviewItem | undefined>;
  deleteCallReviewItem(id: number, clientPathwayId?: number): Promise<boolean>;

  getActivationObjectives(clientPathwayId: number): Promise<ActivationObjective[]>;
  getActiveActivationObjectives(clientPathwayId: number): Promise<ActivationObjective[]>;
  getActivationObjective(id: number, clientPathwayId?: number): Promise<ActivationObjective | undefined>;
  createActivationObjective(clientPathwayId: number, data: InsertActivationObjective): Promise<ActivationObjective>;
  updateActivationObjective(id: number, data: Partial<InsertActivationObjective>, clientPathwayId?: number): Promise<ActivationObjective | undefined>;
  deleteActivationObjective(id: number, clientPathwayId?: number): Promise<boolean>;
  reorderActivationObjectives(orderedIds: number[], clientPathwayId?: number): Promise<void>;

  getActivationInteractions(clientPathwayId: number): Promise<ActivationInteraction[]>;
  getActiveActivationInteractions(clientPathwayId: number): Promise<ActivationInteraction[]>;
  getActivationInteraction(id: number, clientPathwayId?: number): Promise<ActivationInteraction | undefined>;
  createActivationInteraction(clientPathwayId: number, data: InsertActivationInteraction): Promise<ActivationInteraction>;
  updateActivationInteraction(id: number, data: Partial<InsertActivationInteraction>, clientPathwayId?: number): Promise<ActivationInteraction | undefined>;
  deleteActivationInteraction(id: number, clientPathwayId?: number): Promise<boolean>;
  reorderActivationInteractions(orderedIds: number[], clientPathwayId?: number): Promise<void>;
}

export class BigQueryStorage implements IStorage {
  private getProjectTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${TABLE_ID}\``;
  }
  private getContextParamsTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${CONTEXT_PARAMS_TABLE_ID}\``;
  }
  private getCallQAPromptsTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${CALL_QA_PROMPTS_TABLE_ID}\``;
  }
  private getSettingsTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${SETTINGS_TABLE_ID}\``;
  }
  private getClientPathwayTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${CLIENT_PATHWAY_TABLE_ID}\``;
  }

  private async getNextIdForTable(tableRef: string): Promise<number> {
    const client = getBigQueryClient();
    const [rows] = await client.query({ query: `SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM ${tableRef}` });
    return rows[0].next_id;
  }

  async getClientPathways(): Promise<ClientPathway[]> {
    await ensureClientPathwayTable();
    const client = getBigQueryClient();
    const table = this.getClientPathwayTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} ORDER BY id ASC` });
    return rows.map((row: any) => ({ id: row.id, client: row.client, pathway: row.pathway, description: row.description || "", gcp_project_id: row.gcp_project_id || "", secret_key: row.secret_key || "" }));
  }

  async getClientPathway(id: number): Promise<ClientPathway | null> {
    await ensureClientPathwayTable();
    const client = getBigQueryClient();
    const table = this.getClientPathwayTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE id = @id`, params: { id } });
    if (rows.length === 0) return null;
    const row = rows[0] as any;
    return { id: row.id, client: row.client, pathway: row.pathway, description: row.description || "", gcp_project_id: row.gcp_project_id || "", secret_key: row.secret_key || "" };
  }

  async createClientPathway(data: InsertClientPathway): Promise<ClientPathway> {
    await ensureClientPathwayTable();
    const client = getBigQueryClient();
    const table = this.getClientPathwayTable();
    const id = await this.getNextIdForTable(table);
    const row = { id, client: data.client, pathway: data.pathway, description: data.description || "", gcp_project_id: data.gcp_project_id || "", secret_key: data.secret_key || "" };
    await client.query({
      query: `INSERT INTO ${table} (id, client, pathway, description, gcp_project_id, secret_key) VALUES (@id, @client, @pathway, @description, @gcp_project_id, @secret_key)`,
      params: row,
    });
    return row;
  }

  async updateClientPathway(id: number, data: Partial<InsertClientPathway>): Promise<ClientPathway | null> {
    await ensureClientPathwayTable();
    const existing = await this.getClientPathway(id);
    if (!existing) return null;
    const client = getBigQueryClient();
    const table = this.getClientPathwayTable();
    const setClauses: string[] = [];
    const params: Record<string, any> = { id };
    if (data.client !== undefined) { setClauses.push("client = @client"); params.client = data.client; }
    if (data.pathway !== undefined) { setClauses.push("pathway = @pathway"); params.pathway = data.pathway; }
    if (data.description !== undefined) { setClauses.push("description = @description"); params.description = data.description; }
    if (data.gcp_project_id !== undefined) { setClauses.push("gcp_project_id = @gcp_project_id"); params.gcp_project_id = data.gcp_project_id; }
    if (data.secret_key !== undefined) { setClauses.push("secret_key = @secret_key"); params.secret_key = data.secret_key; }
    if (setClauses.length > 0) {
      await client.query({ query: `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = @id`, params });
    }
    return this.getClientPathway(id);
  }

  async deleteClientPathway(id: number): Promise<boolean> {
    await ensureClientPathwayTable();
    await migrateConfigTablesForClientPathway();
    const client = getBigQueryClient();
    const table = this.getClientPathwayTable();
    await client.query({ query: `DELETE FROM ${table} WHERE id = @id`, params: { id } });
    await client.query({ query: `DELETE FROM ${this.getProjectTable()} WHERE client_pathway_id = @id`, params: { id } });
    await client.query({ query: `DELETE FROM ${this.getContextParamsTable()} WHERE client_pathway_id = @id`, params: { id } });
    await client.query({ query: `DELETE FROM ${this.getCallQAPromptsTable()} WHERE client_pathway_id = @id`, params: { id } });
    await client.query({ query: `DELETE FROM ${this.getSettingsTable()} WHERE client_pathway_id = @id`, params: { id } });
    try {
      await ensureActivationObjectivesTable();
      await client.query({ query: `DELETE FROM ${this.getActivationObjectivesTable()} WHERE client_pathway_id = @id`, params: { id } });
    } catch {}
    return true;
  }

  async getObservations(clientPathwayId: number): Promise<Observation[]> {
    await ensureObservationsTable();
    await migrateConfigTablesForClientPathway();
    const client = getBigQueryClient();
    const table = this.getProjectTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE client_pathway_id = @cpId ORDER BY display_order ASC`, params: { cpId: clientPathwayId } });
    return rows.map(rowToObservation);
  }

  async getActiveObservations(clientPathwayId: number): Promise<Observation[]> {
    await ensureObservationsTable();
    await migrateConfigTablesForClientPathway();
    const client = getBigQueryClient();
    const table = this.getProjectTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE client_pathway_id = @cpId AND is_active = TRUE ORDER BY display_order ASC`, params: { cpId: clientPathwayId } });
    return rows.map(rowToObservation);
  }

  async getObservation(id: number, clientPathwayId?: number): Promise<Observation | undefined> {
    await ensureObservationsTable();
    const client = getBigQueryClient();
    const table = this.getProjectTable();
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    const params: Record<string, any> = { id };
    if (clientPathwayId != null) params.cpId = clientPathwayId;
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE id = @id${cpClause}`, params });
    return rows.length > 0 ? rowToObservation(rows[0]) : undefined;
  }

  async createObservation(clientPathwayId: number, observation: InsertObservation): Promise<Observation> {
    await ensureObservationsTable();
    await migrateConfigTablesForClientPathway();
    const client = getBigQueryClient();
    const table = this.getProjectTable();
    const id = await this.getNextIdForTable(table);

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
      client_pathway_id: clientPathwayId,
    };

    await client.query({
      query: `INSERT INTO ${table} (id, name, display_name, description, domain, display_order, value_type, value, is_active, prompt_guidance, client_pathway_id) VALUES (@id, @name, @display_name, @description, @domain, @display_order, @value_type, @value, @is_active, @prompt_guidance, @client_pathway_id)`,
      params: row,
    });

    return rowToObservation(row);
  }

  async updateObservation(id: number, data: Partial<InsertObservation>, clientPathwayId?: number): Promise<Observation | undefined> {
    await ensureObservationsTable();
    const client = getBigQueryClient();
    const table = this.getProjectTable();
    const existing = await this.getObservation(id, clientPathwayId);
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

    await client.query({ query: `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = @id`, params });
    return this.getObservation(id);
  }

  async deleteObservation(id: number, clientPathwayId?: number): Promise<boolean> {
    await ensureObservationsTable();
    const client = getBigQueryClient();
    const table = this.getProjectTable();
    const existing = await this.getObservation(id, clientPathwayId);
    if (!existing) return false;
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    const params: Record<string, any> = { id };
    if (clientPathwayId != null) params.cpId = clientPathwayId;
    await client.query({ query: `DELETE FROM ${table} WHERE id = @id${cpClause}`, params });
    return true;
  }

  async reorderObservations(orderedIds: number[], clientPathwayId?: number): Promise<void> {
    await ensureObservationsTable();
    const client = getBigQueryClient();
    const table = this.getProjectTable();
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    for (let i = 0; i < orderedIds.length; i++) {
      const params: Record<string, any> = { order: i, id: orderedIds[i] };
      if (clientPathwayId != null) params.cpId = clientPathwayId;
      await client.query({ query: `UPDATE ${table} SET display_order = @order WHERE id = @id${cpClause}`, params });
    }
  }

  async getContextParameters(clientPathwayId: number): Promise<ContextParameter[]> {
    await ensureContextParamsTable();
    await migrateConfigTablesForClientPathway();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE client_pathway_id = @cpId ORDER BY display_order ASC`, params: { cpId: clientPathwayId } });
    return rows.map(rowToContextParameter);
  }

  async getActiveContextParameters(clientPathwayId: number): Promise<ContextParameter[]> {
    await ensureContextParamsTable();
    await migrateConfigTablesForClientPathway();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE client_pathway_id = @cpId AND is_active = TRUE ORDER BY display_order ASC`, params: { cpId: clientPathwayId } });
    return rows.map(rowToContextParameter);
  }

  async getContextParameter(id: number, clientPathwayId?: number): Promise<ContextParameter | undefined> {
    await ensureContextParamsTable();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    const params: Record<string, any> = { id };
    if (clientPathwayId != null) params.cpId = clientPathwayId;
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE id = @id${cpClause}`, params });
    return rows.length > 0 ? rowToContextParameter(rows[0]) : undefined;
  }

  async createContextParameter(clientPathwayId: number, param: InsertContextParameter): Promise<ContextParameter> {
    await ensureContextParamsTable();
    await migrateConfigTablesForClientPathway();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();
    const id = await this.getNextIdForTable(table);

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
      client_pathway_id: clientPathwayId,
    };

    await client.query({
      query: `INSERT INTO ${table} (id, name, display_name, description, data_type, enum_values, is_active, display_order, awell_data_point_key, awell_mapping_type, awell_patient_profile_field, client_pathway_id) VALUES (@id, @name, @display_name, @description, @data_type, @enum_values, @is_active, @display_order, @awell_data_point_key, @awell_mapping_type, @awell_patient_profile_field, @client_pathway_id)`,
      params: row,
    });

    return rowToContextParameter(row);
  }

  async updateContextParameter(id: number, data: Partial<InsertContextParameter>, clientPathwayId?: number): Promise<ContextParameter | undefined> {
    await ensureContextParamsTable();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();
    const existing = await this.getContextParameter(id, clientPathwayId);
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

    await client.query({ query: `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = @id`, params });
    return this.getContextParameter(id);
  }

  async deleteContextParameter(id: number, clientPathwayId?: number): Promise<boolean> {
    await ensureContextParamsTable();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();
    const existing = await this.getContextParameter(id, clientPathwayId);
    if (!existing) return false;
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    const params: Record<string, any> = { id };
    if (clientPathwayId != null) params.cpId = clientPathwayId;
    await client.query({ query: `DELETE FROM ${table} WHERE id = @id${cpClause}`, params });
    return true;
  }

  async reorderContextParameters(orderedIds: number[], clientPathwayId?: number): Promise<void> {
    await ensureContextParamsTable();
    const client = getBigQueryClient();
    const table = this.getContextParamsTable();
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    for (let i = 0; i < orderedIds.length; i++) {
      const params: Record<string, any> = { order: i, id: orderedIds[i] };
      if (clientPathwayId != null) params.cpId = clientPathwayId;
      await client.query({ query: `UPDATE ${table} SET display_order = @order WHERE id = @id${cpClause}`, params });
    }
  }

  async getCallQAPrompts(clientPathwayId: number): Promise<CallQAPrompt[]> {
    await ensureCallQAPromptsTable();
    await migrateConfigTablesForClientPathway();
    const client = getBigQueryClient();
    const table = this.getCallQAPromptsTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE client_pathway_id = @cpId ORDER BY display_order ASC`, params: { cpId: clientPathwayId } });
    return rows.map(rowToCallQAPrompt);
  }

  async getActiveCallQAPrompts(clientPathwayId: number): Promise<CallQAPrompt[]> {
    await ensureCallQAPromptsTable();
    await migrateConfigTablesForClientPathway();
    const client = getBigQueryClient();
    const table = this.getCallQAPromptsTable();
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE client_pathway_id = @cpId AND is_active = TRUE ORDER BY display_order ASC`, params: { cpId: clientPathwayId } });
    return rows.map(rowToCallQAPrompt);
  }

  async getCallQAPrompt(id: number, clientPathwayId?: number): Promise<CallQAPrompt | undefined> {
    await ensureCallQAPromptsTable();
    const client = getBigQueryClient();
    const table = this.getCallQAPromptsTable();
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    const params: Record<string, any> = { id };
    if (clientPathwayId != null) params.cpId = clientPathwayId;
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE id = @id${cpClause}`, params });
    return rows.length > 0 ? rowToCallQAPrompt(rows[0]) : undefined;
  }

  async createCallQAPrompt(clientPathwayId: number, qa: InsertCallQAPrompt): Promise<CallQAPrompt> {
    await ensureCallQAPromptsTable();
    await migrateConfigTablesForClientPathway();
    const client = getBigQueryClient();
    const table = this.getCallQAPromptsTable();
    const id = await this.getNextIdForTable(table);

    await client.query({
      query: `INSERT INTO ${table} (id, name, display_name, prompt_text, response_type, response_options, is_active, display_order, client_pathway_id)
              VALUES (@id, @name, @display_name, @prompt_text, @response_type, @response_options, @is_active, @display_order, @client_pathway_id)`,
      params: {
        id,
        name: qa.name,
        display_name: qa.displayName,
        prompt_text: qa.promptText,
        response_type: qa.responseType || "enum",
        response_options: JSON.stringify(qa.responseOptions || []),
        is_active: qa.isActive !== false,
        display_order: qa.displayOrder ?? 0,
        client_pathway_id: clientPathwayId,
      },
    });

    return { id, name: qa.name, displayName: qa.displayName, promptText: qa.promptText, responseType: qa.responseType || "enum", responseOptions: qa.responseOptions || [], isActive: qa.isActive !== false, displayOrder: qa.displayOrder ?? 0 };
  }

  async updateCallQAPrompt(id: number, qa: Partial<InsertCallQAPrompt>, clientPathwayId?: number): Promise<CallQAPrompt | undefined> {
    await ensureCallQAPromptsTable();
    const existing = await this.getCallQAPrompt(id, clientPathwayId);
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
      await client.query({ query: `UPDATE ${table} SET ${updates.join(", ")} WHERE id = @id`, params });
    }
    return this.getCallQAPrompt(id);
  }

  async deleteCallQAPrompt(id: number, clientPathwayId?: number): Promise<boolean> {
    await ensureCallQAPromptsTable();
    const existing = await this.getCallQAPrompt(id, clientPathwayId);
    if (!existing) return false;
    const client = getBigQueryClient();
    const table = this.getCallQAPromptsTable();
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    const params: Record<string, any> = { id };
    if (clientPathwayId != null) params.cpId = clientPathwayId;
    await client.query({ query: `DELETE FROM ${table} WHERE id = @id${cpClause}`, params });
    return true;
  }

  async getSetting(clientPathwayId: number, key: string): Promise<string | null> {
    await ensureSettingsTable();
    await migrateConfigTablesForClientPathway();
    const client = getBigQueryClient();
    const table = this.getSettingsTable();
    const [rows] = await client.query({
      query: `SELECT value FROM ${table} WHERE key = @key AND client_pathway_id = @cpId LIMIT 1`,
      params: { key, cpId: clientPathwayId },
    });
    return rows.length > 0 ? rows[0].value : null;
  }

  async setSetting(clientPathwayId: number, key: string, value: string): Promise<void> {
    await ensureSettingsTable();
    await migrateConfigTablesForClientPathway();
    const client = getBigQueryClient();
    const table = this.getSettingsTable();

    const existing = await this.getSetting(clientPathwayId, key);
    if (existing !== null) {
      await client.query({
        query: `UPDATE ${table} SET value = @value WHERE key = @key AND client_pathway_id = @cpId`,
        params: { key, value, cpId: clientPathwayId },
      });
    } else {
      await client.query({
        query: `INSERT INTO ${table} (key, value, client_pathway_id) VALUES (@key, @value, @cpId)`,
        params: { key, value, cpId: clientPathwayId },
      });
    }
  }

  async deleteSetting(clientPathwayId: number, key: string): Promise<void> {
    await ensureSettingsTable();
    await migrateConfigTablesForClientPathway();
    const client = getBigQueryClient();
    const table = this.getSettingsTable();
    await client.query({
      query: `DELETE FROM ${table} WHERE key = @key AND client_pathway_id = @cpId`,
      params: { key, cpId: clientPathwayId },
    });
  }

  private getDispositionCategoriesTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${DISPOSITION_CATEGORIES_TABLE_ID}\``;
  }
  private getDispositionDetailsTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${DISPOSITION_DETAILS_TABLE_ID}\``;
  }

  async getDispositionCategories(clientPathwayId: number): Promise<DispositionCategory[]> {
    await ensureDispositionCategoriesTable();
    const client = getBigQueryClient();
    const table = this.getDispositionCategoriesTable();
    const [rows] = await client.query({
      query: `SELECT * FROM ${table} WHERE client_pathway_id = @cpId OR is_global = TRUE ORDER BY is_global DESC, display_order, id`,
      params: { cpId: clientPathwayId },
    });
    return rows.map(rowToDispositionCategory);
  }

  async getActiveDispositionCategories(clientPathwayId: number): Promise<DispositionCategory[]> {
    await ensureDispositionCategoriesTable();
    const client = getBigQueryClient();
    const table = this.getDispositionCategoriesTable();
    const [rows] = await client.query({
      query: `SELECT * FROM ${table} WHERE (client_pathway_id = @cpId OR is_global = TRUE) AND is_active = TRUE ORDER BY is_global DESC, display_order, id`,
      params: { cpId: clientPathwayId },
    });
    return rows.map(rowToDispositionCategory);
  }

  async getDispositionCategory(id: number, clientPathwayId?: number): Promise<DispositionCategory | undefined> {
    await ensureDispositionCategoriesTable();
    const client = getBigQueryClient();
    const table = this.getDispositionCategoriesTable();
    const cpFilter = clientPathwayId ? " AND (client_pathway_id = @cpId OR is_global = TRUE)" : "";
    const params: any = { id };
    if (clientPathwayId) params.cpId = clientPathwayId;
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE id = @id${cpFilter}`, params });
    return rows.length > 0 ? rowToDispositionCategory(rows[0]) : undefined;
  }

  async createDispositionCategory(clientPathwayId: number, data: InsertDispositionCategory): Promise<DispositionCategory> {
    await ensureDispositionCategoriesTable();
    const client = getBigQueryClient();
    const table = this.getDispositionCategoriesTable();
    const [maxRows] = await client.query({ query: `SELECT COALESCE(MAX(id), 0) as maxId FROM ${table}` });
    const newId = (maxRows[0]?.maxId || 0) + 1;
    await client.query({
      query: `INSERT INTO ${table} (id, name, display_name, description, display_order, is_active, is_global, client_pathway_id) VALUES (@id, @name, @displayName, @description, @displayOrder, @isActive, @isGlobal, @cpId)`,
      params: { id: newId, name: data.name, displayName: data.displayName, description: data.description || "", displayOrder: data.displayOrder ?? 0, isActive: data.isActive ?? true, isGlobal: data.isGlobal ?? false, cpId: clientPathwayId },
    });
    return { id: newId, name: data.name, displayName: data.displayName, description: data.description || "", displayOrder: data.displayOrder ?? 0, isActive: data.isActive ?? true, isGlobal: data.isGlobal ?? false };
  }

  async updateDispositionCategory(id: number, data: Partial<InsertDispositionCategory>, clientPathwayId?: number): Promise<DispositionCategory | undefined> {
    await ensureDispositionCategoriesTable();
    const client = getBigQueryClient();
    const table = this.getDispositionCategoriesTable();
    const sets: string[] = [];
    const params: any = { id };
    if (clientPathwayId) params.cpId = clientPathwayId;
    if (data.name !== undefined) { sets.push("name = @name"); params.name = data.name; }
    if (data.displayName !== undefined) { sets.push("display_name = @displayName"); params.displayName = data.displayName; }
    if (data.description !== undefined) { sets.push("description = @description"); params.description = data.description; }
    if (data.displayOrder !== undefined) { sets.push("display_order = @displayOrder"); params.displayOrder = data.displayOrder; }
    if (data.isActive !== undefined) { sets.push("is_active = @isActive"); params.isActive = data.isActive; }
    if (data.isGlobal !== undefined) { sets.push("is_global = @isGlobal"); params.isGlobal = data.isGlobal; }
    if (sets.length === 0) return this.getDispositionCategory(id, clientPathwayId);
    const cpFilter = clientPathwayId ? " AND (client_pathway_id = @cpId OR is_global = TRUE)" : "";
    await client.query({ query: `UPDATE ${table} SET ${sets.join(", ")} WHERE id = @id${cpFilter}`, params });
    return this.getDispositionCategory(id, clientPathwayId);
  }

  async deleteDispositionCategory(id: number, clientPathwayId?: number): Promise<boolean> {
    await ensureDispositionCategoriesTable();
    await ensureDispositionDetailsTable();
    const client = getBigQueryClient();
    const catTable = this.getDispositionCategoriesTable();
    const detTable = this.getDispositionDetailsTable();
    const cpFilter = clientPathwayId ? " AND (client_pathway_id = @cpId OR is_global = TRUE)" : "";
    const params: any = { id };
    if (clientPathwayId) params.cpId = clientPathwayId;
    await client.query({ query: `DELETE FROM ${detTable} WHERE category_id = @id${cpFilter}`, params });
    await client.query({ query: `DELETE FROM ${catTable} WHERE id = @id${cpFilter}`, params });
    return true;
  }

  async getDispositionDetails(clientPathwayId: number, categoryId?: number): Promise<DispositionDetail[]> {
    await ensureDispositionDetailsTable();
    const client = getBigQueryClient();
    const table = this.getDispositionDetailsTable();
    const catFilter = categoryId ? " AND category_id = @catId" : "";
    const params: any = { cpId: clientPathwayId };
    if (categoryId) params.catId = categoryId;
    const [rows] = await client.query({
      query: `SELECT * FROM ${table} WHERE (client_pathway_id = @cpId OR is_global = TRUE)${catFilter} ORDER BY is_global DESC, display_order, id`,
      params,
    });
    return rows.map(rowToDispositionDetail);
  }

  async getActiveDispositionDetails(clientPathwayId: number, categoryId?: number): Promise<DispositionDetail[]> {
    await ensureDispositionDetailsTable();
    const client = getBigQueryClient();
    const table = this.getDispositionDetailsTable();
    const catFilter = categoryId ? " AND category_id = @catId" : "";
    const params: any = { cpId: clientPathwayId };
    if (categoryId) params.catId = categoryId;
    const [rows] = await client.query({
      query: `SELECT * FROM ${table} WHERE (client_pathway_id = @cpId OR is_global = TRUE) AND is_active = TRUE${catFilter} ORDER BY is_global DESC, display_order, id`,
      params,
    });
    return rows.map(rowToDispositionDetail);
  }

  async getDispositionDetail(id: number, clientPathwayId?: number): Promise<DispositionDetail | undefined> {
    await ensureDispositionDetailsTable();
    const client = getBigQueryClient();
    const table = this.getDispositionDetailsTable();
    const cpFilter = clientPathwayId ? " AND (client_pathway_id = @cpId OR is_global = TRUE)" : "";
    const params: any = { id };
    if (clientPathwayId) params.cpId = clientPathwayId;
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE id = @id${cpFilter}`, params });
    return rows.length > 0 ? rowToDispositionDetail(rows[0]) : undefined;
  }

  async createDispositionDetail(clientPathwayId: number, data: InsertDispositionDetail): Promise<DispositionDetail> {
    await ensureDispositionDetailsTable();
    const client = getBigQueryClient();
    const table = this.getDispositionDetailsTable();
    const [maxRows] = await client.query({ query: `SELECT COALESCE(MAX(id), 0) as maxId FROM ${table}` });
    const newId = (maxRows[0]?.maxId || 0) + 1;
    await client.query({
      query: `INSERT INTO ${table} (id, category_id, name, display_name, description, display_order, is_active, is_global, client_pathway_id) VALUES (@id, @categoryId, @name, @displayName, @description, @displayOrder, @isActive, @isGlobal, @cpId)`,
      params: { id: newId, categoryId: data.categoryId, name: data.name, displayName: data.displayName, description: data.description || "", displayOrder: data.displayOrder ?? 0, isActive: data.isActive ?? true, isGlobal: data.isGlobal ?? false, cpId: clientPathwayId },
    });
    return { id: newId, categoryId: data.categoryId, name: data.name, displayName: data.displayName, description: data.description || "", displayOrder: data.displayOrder ?? 0, isActive: data.isActive ?? true, isGlobal: data.isGlobal ?? false };
  }

  async updateDispositionDetail(id: number, data: Partial<InsertDispositionDetail>, clientPathwayId?: number): Promise<DispositionDetail | undefined> {
    await ensureDispositionDetailsTable();
    const client = getBigQueryClient();
    const table = this.getDispositionDetailsTable();
    const sets: string[] = [];
    const params: any = { id };
    if (clientPathwayId) params.cpId = clientPathwayId;
    if (data.categoryId !== undefined) { sets.push("category_id = @categoryId"); params.categoryId = data.categoryId; }
    if (data.name !== undefined) { sets.push("name = @name"); params.name = data.name; }
    if (data.displayName !== undefined) { sets.push("display_name = @displayName"); params.displayName = data.displayName; }
    if (data.description !== undefined) { sets.push("description = @description"); params.description = data.description; }
    if (data.displayOrder !== undefined) { sets.push("display_order = @displayOrder"); params.displayOrder = data.displayOrder; }
    if (data.isActive !== undefined) { sets.push("is_active = @isActive"); params.isActive = data.isActive; }
    if (data.isGlobal !== undefined) { sets.push("is_global = @isGlobal"); params.isGlobal = data.isGlobal; }
    if (sets.length === 0) return this.getDispositionDetail(id, clientPathwayId);
    const cpFilter = clientPathwayId ? " AND (client_pathway_id = @cpId OR is_global = TRUE)" : "";
    await client.query({ query: `UPDATE ${table} SET ${sets.join(", ")} WHERE id = @id${cpFilter}`, params });
    return this.getDispositionDetail(id, clientPathwayId);
  }

  async deleteDispositionDetail(id: number, clientPathwayId?: number): Promise<boolean> {
    await ensureDispositionDetailsTable();
    const client = getBigQueryClient();
    const table = this.getDispositionDetailsTable();
    const cpFilter = clientPathwayId ? " AND (client_pathway_id = @cpId OR is_global = TRUE)" : "";
    const params: any = { id };
    if (clientPathwayId) params.cpId = clientPathwayId;
    await client.query({ query: `DELETE FROM ${table} WHERE id = @id${cpFilter}`, params });
    return true;
  }

  private getCallReviewItemsTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${CALL_REVIEW_ITEMS_TABLE_ID}\``;
  }

  async getCallReviewItems(clientPathwayId: number): Promise<CallReviewItem[]> {
    await ensureCallReviewItemsTable();
    const client = getBigQueryClient();
    const table = this.getCallReviewItemsTable();
    const [rows] = await client.query({
      query: `SELECT * FROM ${table} WHERE client_pathway_id = @cpId ORDER BY display_order, id`,
      params: { cpId: clientPathwayId },
    });
    return rows.map(rowToCallReviewItem);
  }

  async getActiveCallReviewItems(clientPathwayId: number): Promise<CallReviewItem[]> {
    await ensureCallReviewItemsTable();
    const client = getBigQueryClient();
    const table = this.getCallReviewItemsTable();
    const [rows] = await client.query({
      query: `SELECT * FROM ${table} WHERE client_pathway_id = @cpId AND is_active = TRUE ORDER BY display_order, id`,
      params: { cpId: clientPathwayId },
    });
    return rows.map(rowToCallReviewItem);
  }

  async getCallReviewItem(id: number, clientPathwayId?: number): Promise<CallReviewItem | undefined> {
    await ensureCallReviewItemsTable();
    const client = getBigQueryClient();
    const table = this.getCallReviewItemsTable();
    const cpFilter = clientPathwayId ? " AND client_pathway_id = @cpId" : "";
    const params: any = { id };
    if (clientPathwayId) params.cpId = clientPathwayId;
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE id = @id${cpFilter}`, params });
    return rows.length > 0 ? rowToCallReviewItem(rows[0]) : undefined;
  }

  async createCallReviewItem(clientPathwayId: number, data: InsertCallReviewItem): Promise<CallReviewItem> {
    await ensureCallReviewItemsTable();
    const client = getBigQueryClient();
    const table = this.getCallReviewItemsTable();
    const [maxRows] = await client.query({ query: `SELECT COALESCE(MAX(id), 0) as maxId FROM ${table}` });
    const newId = (maxRows[0]?.maxId || 0) + 1;
    await client.query({
      query: `INSERT INTO ${table} (id, name, display_name, description, category, display_order, is_active, client_pathway_id) VALUES (@id, @name, @displayName, @description, @category, @displayOrder, @isActive, @cpId)`,
      params: { id: newId, name: data.name, displayName: data.displayName, description: data.description || "", category: data.category || "General", displayOrder: data.displayOrder ?? 0, isActive: data.isActive ?? true, cpId: clientPathwayId },
    });
    return { id: newId, name: data.name, displayName: data.displayName, description: data.description || "", category: data.category || "General", displayOrder: data.displayOrder ?? 0, isActive: data.isActive ?? true };
  }

  async updateCallReviewItem(id: number, data: Partial<InsertCallReviewItem>, clientPathwayId?: number): Promise<CallReviewItem | undefined> {
    await ensureCallReviewItemsTable();
    const client = getBigQueryClient();
    const table = this.getCallReviewItemsTable();
    const sets: string[] = [];
    const params: any = { id };
    if (clientPathwayId) params.cpId = clientPathwayId;
    if (data.name !== undefined) { sets.push("name = @name"); params.name = data.name; }
    if (data.displayName !== undefined) { sets.push("display_name = @displayName"); params.displayName = data.displayName; }
    if (data.description !== undefined) { sets.push("description = @description"); params.description = data.description; }
    if (data.category !== undefined) { sets.push("category = @category"); params.category = data.category; }
    if (data.displayOrder !== undefined) { sets.push("display_order = @displayOrder"); params.displayOrder = data.displayOrder; }
    if (data.isActive !== undefined) { sets.push("is_active = @isActive"); params.isActive = data.isActive; }
    if (sets.length === 0) return this.getCallReviewItem(id, clientPathwayId);
    const cpFilter = clientPathwayId ? " AND client_pathway_id = @cpId" : "";
    await client.query({ query: `UPDATE ${table} SET ${sets.join(", ")} WHERE id = @id${cpFilter}`, params });
    return this.getCallReviewItem(id, clientPathwayId);
  }

  async deleteCallReviewItem(id: number, clientPathwayId?: number): Promise<boolean> {
    await ensureCallReviewItemsTable();
    const client = getBigQueryClient();
    const table = this.getCallReviewItemsTable();
    const cpFilter = clientPathwayId ? " AND client_pathway_id = @cpId" : "";
    const params: any = { id };
    if (clientPathwayId) params.cpId = clientPathwayId;
    await client.query({ query: `DELETE FROM ${table} WHERE id = @id${cpFilter}`, params });
    return true;
  }

  private getActivationObjectivesTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${ACTIVATION_OBJECTIVES_TABLE_ID}\``;
  }

  async getActivationObjectives(clientPathwayId: number): Promise<ActivationObjective[]> {
    await ensureActivationObjectivesTable();
    const client = getBigQueryClient();
    const table = this.getActivationObjectivesTable();
    const [rows] = await client.query({
      query: `SELECT * FROM ${table} WHERE client_pathway_id = @cpId ORDER BY display_order ASC, id ASC`,
      params: { cpId: clientPathwayId },
    });
    return rows.map(rowToActivationObjective).map(injectSystemStages);
  }

  async getActiveActivationObjectives(clientPathwayId: number): Promise<ActivationObjective[]> {
    await ensureActivationObjectivesTable();
    const client = getBigQueryClient();
    const table = this.getActivationObjectivesTable();
    const [rows] = await client.query({
      query: `SELECT * FROM ${table} WHERE client_pathway_id = @cpId AND is_active = TRUE ORDER BY display_order ASC, id ASC`,
      params: { cpId: clientPathwayId },
    });
    return rows.map(rowToActivationObjective).map(injectSystemStages);
  }

  async getActivationObjective(id: number, clientPathwayId?: number): Promise<ActivationObjective | undefined> {
    await ensureActivationObjectivesTable();
    const client = getBigQueryClient();
    const table = this.getActivationObjectivesTable();
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    const params: Record<string, any> = { id };
    if (clientPathwayId != null) params.cpId = clientPathwayId;
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE id = @id${cpClause}`, params });
    return rows.length > 0 ? injectSystemStages(rowToActivationObjective(rows[0])) : undefined;
  }

  async createActivationObjective(clientPathwayId: number, data: InsertActivationObjective): Promise<ActivationObjective> {
    await ensureActivationObjectivesTable();
    const client = getBigQueryClient();
    const table = this.getActivationObjectivesTable();
    const id = await this.getNextIdForTable(table);
    data = stripSystemStages(data);

    const row = {
      id,
      name: data.name,
      display_name: data.displayName,
      description: data.description || "",
      anchor_event_type: data.anchorEventType || "discharge",
      anchor_context_key: data.anchorContextKey,
      interaction_context_key: data.interactionContextKey || "interaction_key",
      window_days: data.windowDays,
      stages: JSON.stringify(data.stages || []),
      achieved_stage_id: data.achievedStageId || "",
      thresholds: JSON.stringify(data.thresholds || []),
      observation_name: data.observationName || "",
      extracted_enum_values: "[]",
      stage_mappings: JSON.stringify(data.stageMappings || []),
      interactions: JSON.stringify(data.interactions || []),
      is_active: data.isActive !== false,
      display_order: data.displayOrder ?? 0,
      prompt_guidance: "",
      observation_topic_ids: JSON.stringify(data.observationTopicIds || []),
      client_pathway_id: clientPathwayId,
    };

    await client.query({
      query: `INSERT INTO ${table} (id, name, display_name, description, anchor_event_type, anchor_context_key, interaction_context_key, window_days, stages, achieved_stage_id, thresholds, observation_name, extracted_enum_values, stage_mappings, interactions, is_active, display_order, prompt_guidance, observation_topic_ids, client_pathway_id) VALUES (@id, @name, @display_name, @description, @anchor_event_type, @anchor_context_key, @interaction_context_key, @window_days, @stages, @achieved_stage_id, @thresholds, @observation_name, @extracted_enum_values, @stage_mappings, @interactions, @is_active, @display_order, @prompt_guidance, @observation_topic_ids, @client_pathway_id)`,
      params: row,
    });

    return rowToActivationObjective(row);
  }

  async updateActivationObjective(id: number, data: Partial<InsertActivationObjective>, clientPathwayId?: number): Promise<ActivationObjective | undefined> {
    await ensureActivationObjectivesTable();
    const client = getBigQueryClient();
    const table = this.getActivationObjectivesTable();
    const existing = await this.getActivationObjective(id, clientPathwayId);
    if (!existing) return undefined;
    data = stripSystemStages(data);

    const setClauses: string[] = [];
    const params: Record<string, any> = { id };
    if (data.name !== undefined) { setClauses.push("name = @name"); params.name = data.name; }
    if (data.displayName !== undefined) { setClauses.push("display_name = @displayName"); params.displayName = data.displayName; }
    if (data.description !== undefined) { setClauses.push("description = @description"); params.description = data.description; }
    if (data.anchorEventType !== undefined) { setClauses.push("anchor_event_type = @anchorEventType"); params.anchorEventType = data.anchorEventType; }
    if (data.anchorContextKey !== undefined) { setClauses.push("anchor_context_key = @anchorContextKey"); params.anchorContextKey = data.anchorContextKey; }
    if (data.interactionContextKey !== undefined) { setClauses.push("interaction_context_key = @interactionContextKey"); params.interactionContextKey = data.interactionContextKey; }
    if (data.windowDays !== undefined) { setClauses.push("window_days = @windowDays"); params.windowDays = data.windowDays; }
    if (data.stages !== undefined) { setClauses.push("stages = @stages"); params.stages = JSON.stringify(data.stages); }
    if (data.achievedStageId !== undefined) { setClauses.push("achieved_stage_id = @achievedStageId"); params.achievedStageId = data.achievedStageId; }
    if (data.thresholds !== undefined) { setClauses.push("thresholds = @thresholds"); params.thresholds = JSON.stringify(data.thresholds); }
    if (data.observationName !== undefined) { setClauses.push("observation_name = @observationName"); params.observationName = data.observationName; }
    if (data.stageMappings !== undefined) { setClauses.push("stage_mappings = @stageMappings"); params.stageMappings = JSON.stringify(data.stageMappings); }
    if (data.interactions !== undefined) { setClauses.push("interactions = @interactions"); params.interactions = JSON.stringify(data.interactions); }
    if (data.isActive !== undefined) { setClauses.push("is_active = @isActive"); params.isActive = data.isActive; }
    if (data.displayOrder !== undefined) { setClauses.push("display_order = @displayOrder"); params.displayOrder = data.displayOrder; }
    if (data.observationTopicIds !== undefined) { setClauses.push("observation_topic_ids = @observationTopicIds"); params.observationTopicIds = JSON.stringify(data.observationTopicIds || []); }
    if (setClauses.length === 0) return existing;

    await client.query({ query: `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = @id`, params });
    return this.getActivationObjective(id);
  }

  async deleteActivationObjective(id: number, clientPathwayId?: number): Promise<boolean> {
    await ensureActivationObjectivesTable();
    const client = getBigQueryClient();
    const table = this.getActivationObjectivesTable();
    const existing = await this.getActivationObjective(id, clientPathwayId);
    if (!existing) return false;
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    const params: Record<string, any> = { id };
    if (clientPathwayId != null) params.cpId = clientPathwayId;
    await client.query({ query: `DELETE FROM ${table} WHERE id = @id${cpClause}`, params });
    return true;
  }

  async reorderActivationObjectives(orderedIds: number[], clientPathwayId?: number): Promise<void> {
    await ensureActivationObjectivesTable();
    const client = getBigQueryClient();
    const table = this.getActivationObjectivesTable();
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    for (let i = 0; i < orderedIds.length; i++) {
      const params: Record<string, any> = { order: i, id: orderedIds[i] };
      if (clientPathwayId != null) params.cpId = clientPathwayId;
      await client.query({ query: `UPDATE ${table} SET display_order = @order WHERE id = @id${cpClause}`, params });
    }
  }

  private getActivationInteractionsTable(): string {
    const projectId = process.env.GCP_PROJECT_ID;
    return `\`${projectId}.${DATASET_ID}.${ACTIVATION_INTERACTIONS_TABLE_ID}\``;
  }

  async getActivationInteractions(clientPathwayId: number): Promise<ActivationInteraction[]> {
    await ensureActivationInteractionsTable();
    const client = getBigQueryClient();
    const table = this.getActivationInteractionsTable();
    const [rows] = await client.query({
      query: `SELECT * FROM ${table} WHERE client_pathway_id = @cpId ORDER BY display_order ASC, id ASC`,
      params: { cpId: clientPathwayId },
    });
    return rows.map(rowToActivationInteraction);
  }

  async getActiveActivationInteractions(clientPathwayId: number): Promise<ActivationInteraction[]> {
    await ensureActivationInteractionsTable();
    const client = getBigQueryClient();
    const table = this.getActivationInteractionsTable();
    const [rows] = await client.query({
      query: `SELECT * FROM ${table} WHERE client_pathway_id = @cpId AND is_active = TRUE ORDER BY display_order ASC, id ASC`,
      params: { cpId: clientPathwayId },
    });
    return rows.map(rowToActivationInteraction);
  }

  async getActivationInteraction(id: number, clientPathwayId?: number): Promise<ActivationInteraction | undefined> {
    await ensureActivationInteractionsTable();
    const client = getBigQueryClient();
    const table = this.getActivationInteractionsTable();
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    const params: Record<string, any> = { id };
    if (clientPathwayId != null) params.cpId = clientPathwayId;
    const [rows] = await client.query({ query: `SELECT * FROM ${table} WHERE id = @id${cpClause}`, params });
    return rows.length > 0 ? rowToActivationInteraction(rows[0]) : undefined;
  }

  async createActivationInteraction(clientPathwayId: number, data: InsertActivationInteraction): Promise<ActivationInteraction> {
    await ensureActivationInteractionsTable();
    const client = getBigQueryClient();
    const table = this.getActivationInteractionsTable();
    const id = await this.getNextIdForTable(table);

    // Enforce unique key per CP
    const existing = await this.getActivationInteractions(clientPathwayId);
    if (existing.some((i) => i.key === data.key)) {
      throw new Error(`Interaction key '${data.key}' already exists for this Client Pathway`);
    }

    const interactionType = data.interactionType ?? "scheduled";
    const row = {
      id,
      client_pathway_id: clientPathwayId,
      key: data.key,
      name: data.name,
      description: data.description || "",
      interaction_type: interactionType,
      expected_day_offset: data.expectedDayOffset === undefined ? null : data.expectedDayOffset,
      parent_interaction_id: data.parentInteractionId === undefined ? null : data.parentInteractionId,
      interval_days: data.intervalDays === undefined ? null : data.intervalDays,
      start_after_objective_id: data.startAfterObjectiveId === undefined ? null : data.startAfterObjectiveId,
      is_active: data.isActive !== false,
      display_order: data.displayOrder ?? 0,
    };

    await client.query({
      query: `INSERT INTO ${table} (id, client_pathway_id, \`key\`, name, description, interaction_type, expected_day_offset, parent_interaction_id, interval_days, start_after_objective_id, is_active, display_order) VALUES (@id, @client_pathway_id, @key, @name, @description, @interaction_type, @expected_day_offset, @parent_interaction_id, @interval_days, @start_after_objective_id, @is_active, @display_order)`,
      params: row,
      types: {
        expected_day_offset: "INT64",
        parent_interaction_id: "INT64",
        interval_days: "INT64",
        start_after_objective_id: "INT64",
      },
    });

    return rowToActivationInteraction(row);
  }

  async updateActivationInteraction(id: number, data: Partial<InsertActivationInteraction>, clientPathwayId?: number): Promise<ActivationInteraction | undefined> {
    await ensureActivationInteractionsTable();
    const client = getBigQueryClient();
    const table = this.getActivationInteractionsTable();
    const existing = await this.getActivationInteraction(id, clientPathwayId);
    if (!existing) return undefined;

    if (data.key !== undefined && data.key !== existing.key) {
      const all = await this.getActivationInteractions(existing.clientPathwayId);
      if (all.some((i) => i.id !== id && i.key === data.key)) {
        throw new Error(`Interaction key '${data.key}' already exists for this Client Pathway`);
      }
    }

    const setClauses: string[] = [];
    const params: Record<string, any> = { id };
    const types: Record<string, string> = {};
    if (data.key !== undefined) { setClauses.push("`key` = @key"); params.key = data.key; }
    if (data.name !== undefined) { setClauses.push("name = @name"); params.name = data.name; }
    if (data.description !== undefined) { setClauses.push("description = @description"); params.description = data.description; }
    if (data.interactionType !== undefined) {
      setClauses.push("interaction_type = @interaction_type");
      params.interaction_type = data.interactionType;
    }
    if (data.expectedDayOffset !== undefined) {
      setClauses.push("expected_day_offset = @expected_day_offset");
      params.expected_day_offset = data.expectedDayOffset;
      types.expected_day_offset = "INT64";
    }
    if (data.parentInteractionId !== undefined) {
      setClauses.push("parent_interaction_id = @parent_interaction_id");
      params.parent_interaction_id = data.parentInteractionId;
      types.parent_interaction_id = "INT64";
    }
    if (data.intervalDays !== undefined) {
      setClauses.push("interval_days = @interval_days");
      params.interval_days = data.intervalDays;
      types.interval_days = "INT64";
    }
    if (data.startAfterObjectiveId !== undefined) {
      setClauses.push("start_after_objective_id = @start_after_objective_id");
      params.start_after_objective_id = data.startAfterObjectiveId;
      types.start_after_objective_id = "INT64";
    }
    if (data.isActive !== undefined) { setClauses.push("is_active = @is_active"); params.is_active = data.isActive; }
    if (data.displayOrder !== undefined) { setClauses.push("display_order = @display_order"); params.display_order = data.displayOrder; }
    if (setClauses.length === 0) return existing;

    await client.query({
      query: `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = @id`,
      params,
      types: Object.keys(types).length > 0 ? types : undefined,
    });
    return this.getActivationInteraction(id);
  }

  async deleteActivationInteraction(id: number, clientPathwayId?: number): Promise<boolean> {
    await ensureActivationInteractionsTable();
    const client = getBigQueryClient();
    const table = this.getActivationInteractionsTable();
    const existing = await this.getActivationInteraction(id, clientPathwayId);
    if (!existing) return false;
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    const params: Record<string, any> = { id };
    if (clientPathwayId != null) params.cpId = clientPathwayId;
    await client.query({ query: `DELETE FROM ${table} WHERE id = @id${cpClause}`, params });
    return true;
  }

  async reorderActivationInteractions(orderedIds: number[], clientPathwayId?: number): Promise<void> {
    await ensureActivationInteractionsTable();
    const client = getBigQueryClient();
    const table = this.getActivationInteractionsTable();
    const cpClause = clientPathwayId != null ? " AND client_pathway_id = @cpId" : "";
    for (let i = 0; i < orderedIds.length; i++) {
      const params: Record<string, any> = { order: i, id: orderedIds[i] };
      if (clientPathwayId != null) params.cpId = clientPathwayId;
      await client.query({ query: `UPDATE ${table} SET display_order = @order WHERE id = @id${cpClause}`, params });
    }
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
        pathway STRING NOT NULL,
        description STRING,
        gcp_project_id STRING,
        secret_key STRING
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

  try {
    await client.query({
      query: `ALTER TABLE \`${fullTable}\` ADD COLUMN IF NOT EXISTS description STRING`,
    });
  } catch {}

  try {
    await client.query({
      query: `ALTER TABLE \`${fullTable}\` ADD COLUMN IF NOT EXISTS gcp_project_id STRING`,
    });
  } catch {}

  try {
    await client.query({
      query: `ALTER TABLE \`${fullTable}\` ADD COLUMN IF NOT EXISTS secret_key STRING`,
    });
  } catch {}

  clientPathwayTableInitialized = true;
}

let migrationDone = false;
async function migrateConfigTablesForClientPathway(): Promise<void> {
  if (migrationDone) return;
  const client = getBigQueryClient();
  const projectId = process.env.GCP_PROJECT_ID;

  const tables = [TABLE_ID, CONTEXT_PARAMS_TABLE_ID, CALL_QA_PROMPTS_TABLE_ID, SETTINGS_TABLE_ID];
  for (const tbl of tables) {
    const fullTable = `${projectId}.${DATASET_ID}.${tbl}`;
    try {
      const [cols] = await client.query({
        query: `SELECT column_name FROM \`${projectId}.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${tbl}' AND column_name = 'client_pathway_id'`,
      });
      if (cols.length === 0) {
        await client.query({
          query: `ALTER TABLE \`${fullTable}\` ADD COLUMN client_pathway_id INT64`,
        });
        console.log(`Added client_pathway_id column to ${tbl} table.`);
      }
    } catch (err: any) {
      if (!err.message?.includes("Duplicate column") && !err.message?.includes("Already Exists")) {
        console.error(`Migration error for ${tbl}:`, err.message);
      }
    }
  }

  try {
    const cpTable = `${projectId}.${DATASET_ID}.${CLIENT_PATHWAY_TABLE_ID}`;
    const [cpRows] = await client.query({ query: `SELECT id FROM \`${cpTable}\` ORDER BY id ASC LIMIT 1` });
    if (cpRows.length > 0) {
      const firstCpId = cpRows[0].id;
      for (const tbl of tables) {
        const fullTable = `${projectId}.${DATASET_ID}.${tbl}`;
        try {
          const [nullRows] = await client.query({ query: `SELECT COUNT(*) as cnt FROM \`${fullTable}\` WHERE client_pathway_id IS NULL` });
          if (nullRows[0]?.cnt > 0) {
            await client.query({
              query: `UPDATE \`${fullTable}\` SET client_pathway_id = @cpId WHERE client_pathway_id IS NULL`,
              params: { cpId: firstCpId },
            });
            console.log(`Backfilled ${nullRows[0].cnt} orphaned rows in ${tbl} to client_pathway_id=${firstCpId}`);
          }
        } catch (err: any) {
          console.error(`Backfill error for ${tbl}:`, err.message);
        }
      }
    }
  } catch (err: any) {
    console.error("Backfill migration error:", err.message);
  }

  migrationDone = true;
}

export const storage = new BigQueryStorage();
