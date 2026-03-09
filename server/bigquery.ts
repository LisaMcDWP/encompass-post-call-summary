import { BigQuery } from "@google-cloud/bigquery";
import type { ObservationResult } from "./gemini";

const DATASET_ID = "call_information";
const CALL_INFO_TABLE_ID = "call_info";
const OBSERVATIONS_TABLE_ID = "call_observations";

export interface CallInfoRow {
  call_id: string;
  care_flow_id: string | null;
  interaction_datetime: { value: string } | string | null;
  source_type: string | null;
  source_id: string | null;
  processed_at: { value: string } | string;
  processing_time_ms: number;
  prompt_version: number | null;
  prompt_version_date: { value: string } | string | null;
  context_values: string | null;
  transcript_length: number | null;
  summary: string | null;
  follow_up_areas: string | null;
  transition_status: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  status: string;
  error_message: string | null;
}

export interface CallObservationRow {
  call_id: string;
  observation_name: string;
  observation_display_name: string | null;
  observation_domain: string | null;
  observation_value_type: string | null;
  observation_value: string | null;
  observation_detail: string | null;
  observation_evidence: string | null;
  observation_confidence: string | null;
}

let bigquery: BigQuery | null = null;

function getBigQueryClient(): BigQuery {
  if (!bigquery) {
    const raw = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error("GCP_SERVICE_ACCOUNT_KEY is not set");

    const credentials = JSON.parse(raw);
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) throw new Error("GCP_PROJECT_ID is not set");

    bigquery = new BigQuery({
      projectId,
      credentials,
    });
  }
  return bigquery;
}

async function ensureDataset() {
  const client = getBigQueryClient();
  const dataset = client.dataset(DATASET_ID);
  const [datasetExists] = await dataset.exists();
  if (!datasetExists) {
    await client.createDataset(DATASET_ID, { location: "US" });
    console.log(`Created BigQuery dataset: ${DATASET_ID}`);
  }
  return dataset;
}

async function ensureCallInfoTable() {
  const client = getBigQueryClient();
  const dataset = await ensureDataset();
  const table = dataset.table(CALL_INFO_TABLE_ID);
  const [tableExists] = await table.exists();
  if (!tableExists) {
    await dataset.createTable(CALL_INFO_TABLE_ID, {
      schema: {
        fields: [
          { name: "call_id", type: "STRING", mode: "REQUIRED" },
          { name: "care_flow_id", type: "STRING", mode: "NULLABLE" },
          { name: "interaction_datetime", type: "TIMESTAMP", mode: "NULLABLE" },
          { name: "source_type", type: "STRING", mode: "NULLABLE" },
          { name: "source_id", type: "STRING", mode: "NULLABLE" },
          { name: "processed_at", type: "TIMESTAMP", mode: "REQUIRED" },
          { name: "processing_time_ms", type: "INTEGER", mode: "REQUIRED" },
          { name: "prompt_version", type: "INTEGER", mode: "NULLABLE" },
          { name: "prompt_version_date", type: "TIMESTAMP", mode: "NULLABLE" },
          { name: "context_values", type: "STRING", mode: "NULLABLE" },
          { name: "transcript_length", type: "INTEGER", mode: "NULLABLE" },
          { name: "summary", type: "STRING", mode: "NULLABLE" },
          { name: "follow_up_areas", type: "STRING", mode: "NULLABLE" },
          { name: "transition_status", type: "STRING", mode: "NULLABLE" },
          { name: "prompt_tokens", type: "INTEGER", mode: "NULLABLE" },
          { name: "completion_tokens", type: "INTEGER", mode: "NULLABLE" },
          { name: "total_tokens", type: "INTEGER", mode: "NULLABLE" },
          { name: "estimated_cost", type: "FLOAT", mode: "NULLABLE" },
          { name: "status", type: "STRING", mode: "REQUIRED" },
          { name: "error_message", type: "STRING", mode: "NULLABLE" },
        ],
      },
    });
    console.log(`Created BigQuery table: ${DATASET_ID}.${CALL_INFO_TABLE_ID}`);
  }
}

async function ensureObservationsTable() {
  const client = getBigQueryClient();
  const dataset = await ensureDataset();
  const table = dataset.table(OBSERVATIONS_TABLE_ID);
  const [tableExists] = await table.exists();
  if (!tableExists) {
    await dataset.createTable(OBSERVATIONS_TABLE_ID, {
      schema: {
        fields: [
          { name: "call_id", type: "STRING", mode: "REQUIRED" },
          { name: "observation_name", type: "STRING", mode: "REQUIRED" },
          { name: "observation_display_name", type: "STRING", mode: "NULLABLE" },
          { name: "observation_domain", type: "STRING", mode: "NULLABLE" },
          { name: "observation_value_type", type: "STRING", mode: "NULLABLE" },
          { name: "observation_value", type: "STRING", mode: "NULLABLE" },
          { name: "observation_detail", type: "STRING", mode: "NULLABLE" },
          { name: "observation_evidence", type: "STRING", mode: "NULLABLE" },
          { name: "observation_confidence", type: "STRING", mode: "NULLABLE" },
        ],
      },
    });
    console.log(`Created BigQuery table: ${DATASET_ID}.${OBSERVATIONS_TABLE_ID}`);
  }
}

let callInfoInitialized = false;
let observationsInitialized = false;

export interface CallInfoEntry {
  callId: string;
  careFlowId?: string | null;
  interactionDatetime?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  processedAt: string;
  processingTimeMs: number;
  promptVersion?: number | null;
  promptVersionDate?: string | null;
  contextValues?: Record<string, string>;
  transcriptLength?: number;
  summary?: string;
  followUpAreas?: string;
  transitionStatus?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  status: "success" | "error";
  errorMessage?: string;
}

export async function insertCallInfo(entry: CallInfoEntry): Promise<void> {
  try {
    if (!callInfoInitialized) {
      await ensureCallInfoTable();
      callInfoInitialized = true;
    }

    const client = getBigQueryClient();
    const row = {
      call_id: entry.callId,
      care_flow_id: entry.careFlowId || null,
      interaction_datetime: entry.interactionDatetime || null,
      source_type: entry.sourceType || null,
      source_id: entry.sourceId || null,
      processed_at: entry.processedAt,
      processing_time_ms: entry.processingTimeMs,
      prompt_version: entry.promptVersion ?? null,
      prompt_version_date: entry.promptVersionDate || null,
      context_values: entry.contextValues ? JSON.stringify(entry.contextValues) : null,
      transcript_length: entry.transcriptLength ?? null,
      summary: entry.summary || null,
      follow_up_areas: entry.followUpAreas || null,
      transition_status: entry.transitionStatus || null,
      prompt_tokens: entry.promptTokens ?? null,
      completion_tokens: entry.completionTokens ?? null,
      total_tokens: entry.totalTokens ?? null,
      estimated_cost: entry.estimatedCost ?? null,
      status: entry.status,
      error_message: entry.errorMessage || null,
    };

    await client
      .dataset(DATASET_ID)
      .table(CALL_INFO_TABLE_ID)
      .insert([row]);

    console.log(`BigQuery call_info inserted for call: ${entry.callId}`);
  } catch (error: any) {
    console.error("Failed to insert call_info:", error.message);
    if (error.errors) {
      console.error("BigQuery errors:", JSON.stringify(error.errors));
    }
  }
}

export async function insertCallObservations(callId: string, observations: ObservationResult[]): Promise<void> {
  try {
    if (!observationsInitialized) {
      await ensureObservationsTable();
      observationsInitialized = true;
    }

    if (!observations || observations.length === 0) return;

    const client = getBigQueryClient();
    const rows = observations.map(obs => ({
      call_id: callId,
      observation_name: obs.name,
      observation_display_name: obs.display_name,
      observation_domain: obs.domain,
      observation_value_type: obs.value_type,
      observation_value: obs.value !== null && obs.value !== undefined ? String(obs.value) : null,
      observation_detail: obs.detail || null,
      observation_evidence: obs.evidence || null,
      observation_confidence: obs.confidence || null,
    }));

    await client
      .dataset(DATASET_ID)
      .table(OBSERVATIONS_TABLE_ID)
      .insert(rows);

    console.log(`BigQuery call_observations inserted: ${rows.length} rows for call ${callId}`);
  } catch (error: any) {
    console.error("Failed to insert call_observations:", error.message);
    if (error.errors) {
      console.error("BigQuery errors:", JSON.stringify(error.errors));
    }
  }
}

function extractTimestamp(val: { value: string } | string | null | undefined): string | null {
  if (!val) return null;
  if (typeof val === "object" && "value" in val) return val.value;
  return String(val);
}

export async function getCallInfoList(limit = 100): Promise<any[]> {
  const client = getBigQueryClient();
  const query = `
    SELECT *
    FROM \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\`
    ORDER BY processed_at DESC
    LIMIT @limit
  `;
  const [rows] = await client.query({ query, params: { limit }, location: "US" });
  return (rows as CallInfoRow[]).map(row => ({
    call_id: row.call_id,
    care_flow_id: row.care_flow_id,
    interaction_datetime: extractTimestamp(row.interaction_datetime),
    source_type: row.source_type,
    source_id: row.source_id,
    processed_at: extractTimestamp(row.processed_at),
    processing_time_ms: row.processing_time_ms,
    prompt_version: row.prompt_version,
    prompt_version_date: extractTimestamp(row.prompt_version_date),
    context_values: row.context_values ? JSON.parse(row.context_values) : null,
    transcript_length: row.transcript_length,
    summary: row.summary,
    follow_up_areas: row.follow_up_areas,
    transition_status: row.transition_status,
    prompt_tokens: row.prompt_tokens,
    completion_tokens: row.completion_tokens,
    total_tokens: row.total_tokens,
    estimated_cost: row.estimated_cost,
    status: row.status,
    error_message: row.error_message,
  }));
}

export async function getCallDetail(callId: string): Promise<{ callInfo: any | null; observations: CallObservationRow[] }> {
  const client = getBigQueryClient();

  const infoQuery = `
    SELECT *
    FROM \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\`
    WHERE call_id = @callId
    LIMIT 1
  `;
  const [infoRows] = await client.query({ query: infoQuery, params: { callId }, location: "US" });
  const row = (infoRows as CallInfoRow[])[0] || null;

  const obsQuery = `
    SELECT *
    FROM \`${client.projectId}.${DATASET_ID}.${OBSERVATIONS_TABLE_ID}\`
    WHERE call_id = @callId
  `;
  const [obsRows] = await client.query({ query: obsQuery, params: { callId }, location: "US" });

  const callInfo = row ? {
    call_id: row.call_id,
    care_flow_id: row.care_flow_id,
    interaction_datetime: extractTimestamp(row.interaction_datetime),
    source_type: row.source_type,
    source_id: row.source_id,
    processed_at: extractTimestamp(row.processed_at),
    processing_time_ms: row.processing_time_ms,
    prompt_version: row.prompt_version,
    prompt_version_date: extractTimestamp(row.prompt_version_date),
    context_values: row.context_values ? JSON.parse(row.context_values) : null,
    transcript_length: row.transcript_length,
    summary: row.summary,
    follow_up_areas: row.follow_up_areas,
    transition_status: row.transition_status,
    prompt_tokens: row.prompt_tokens,
    completion_tokens: row.completion_tokens,
    total_tokens: row.total_tokens,
    estimated_cost: row.estimated_cost,
    status: row.status,
    error_message: row.error_message,
  } : null;

  return { callInfo, observations: obsRows as CallObservationRow[] };
}
