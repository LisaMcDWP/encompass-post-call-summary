import { BigQuery } from "@google-cloud/bigquery";
import type { ObservationResult } from "./gemini";

const DATASET_ID = "call_information";
const CALL_INFO_TABLE_ID = "call_info";
const OBSERVATIONS_TABLE_ID = "call_observations";

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
