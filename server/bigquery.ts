import { BigQuery } from "@google-cloud/bigquery";
import type { ObservationResult } from "./gemini";

const DATASET_ID = "call_information";
const TABLE_ID = "api_logs";
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

async function ensureDatasetAndTable() {
  const client = getBigQueryClient();
  const dataset = client.dataset(DATASET_ID);

  const [datasetExists] = await dataset.exists();
  if (!datasetExists) {
    await client.createDataset(DATASET_ID, {
      location: "US",
    });
    console.log(`Created BigQuery dataset: ${DATASET_ID}`);
  }

  const table = dataset.table(TABLE_ID);
  const [tableExists] = await table.exists();
  if (!tableExists) {
    await dataset.createTable(TABLE_ID, {
      schema: {
        fields: [
          { name: "call_id", type: "STRING", mode: "REQUIRED" },
          { name: "timestamp", type: "TIMESTAMP", mode: "REQUIRED" },
          { name: "transcript_length", type: "INTEGER", mode: "REQUIRED" },
          { name: "summary", type: "STRING", mode: "NULLABLE" },
          { name: "areas_for_followup", type: "STRING", mode: "REPEATED" },
          { name: "questions_count", type: "INTEGER", mode: "NULLABLE" },
          { name: "processing_time_ms", type: "INTEGER", mode: "NULLABLE" },
          { name: "prompt_tokens", type: "INTEGER", mode: "NULLABLE" },
          { name: "completion_tokens", type: "INTEGER", mode: "NULLABLE" },
          { name: "total_tokens", type: "INTEGER", mode: "NULLABLE" },
          { name: "estimated_cost", type: "FLOAT", mode: "NULLABLE" },
          { name: "status", type: "STRING", mode: "REQUIRED" },
          { name: "error_message", type: "STRING", mode: "NULLABLE" },
        ],
      },
    });
    console.log(`Created BigQuery table: ${DATASET_ID}.${TABLE_ID}`);
  } else {
    const projectId = process.env.GCP_PROJECT_ID!;
    const fullTable = `\`${projectId}.${DATASET_ID}.${TABLE_ID}\``;
    const newCols = [
      { name: "prompt_tokens", type: "INT64" },
      { name: "completion_tokens", type: "INT64" },
      { name: "total_tokens", type: "INT64" },
      { name: "estimated_cost", type: "FLOAT64" },
    ];
    for (const col of newCols) {
      try {
        await client.query({ query: `ALTER TABLE ${fullTable} ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}` });
        await new Promise(r => setTimeout(r, 2000));
      } catch (err: any) {
        if (!err.message?.includes("already exists")) {
          console.log(`Note: Could not add ${col.name} to ${TABLE_ID}: ${err.message}`);
        }
      }
    }
  }
}

async function ensureObservationsTable() {
  const client = getBigQueryClient();
  const projectId = process.env.GCP_PROJECT_ID!;
  const dataset = client.dataset(DATASET_ID);
  const table = dataset.table(OBSERVATIONS_TABLE_ID);
  const fullTable = `\`${projectId}.${DATASET_ID}.${OBSERVATIONS_TABLE_ID}\``;
  const [tableExists] = await table.exists();
  if (!tableExists) {
    await dataset.createTable(OBSERVATIONS_TABLE_ID, {
      schema: {
        fields: [
          { name: "call_id", type: "STRING", mode: "REQUIRED" },
          { name: "care_flow_id", type: "STRING", mode: "NULLABLE" },
          { name: "interaction_datetime", type: "TIMESTAMP", mode: "NULLABLE" },
          { name: "source_type", type: "STRING", mode: "NULLABLE" },
          { name: "source_id", type: "STRING", mode: "REQUIRED" },
          { name: "processed_at", type: "TIMESTAMP", mode: "REQUIRED" },
          { name: "processing_time_ms", type: "INTEGER", mode: "REQUIRED" },
          { name: "prompt_version", type: "INTEGER", mode: "NULLABLE" },
          { name: "prompt_version_date", type: "TIMESTAMP", mode: "NULLABLE" },
          { name: "context_values", type: "STRING", mode: "NULLABLE" },
          { name: "summary", type: "STRING", mode: "NULLABLE" },
          { name: "observation_name", type: "STRING", mode: "REQUIRED" },
          { name: "observation_display_name", type: "STRING", mode: "NULLABLE" },
          { name: "observation_domain", type: "STRING", mode: "NULLABLE" },
          { name: "observation_value_type", type: "STRING", mode: "NULLABLE" },
          { name: "observation_value", type: "STRING", mode: "NULLABLE" },
          { name: "observation_detail", type: "STRING", mode: "NULLABLE" },
          { name: "observation_evidence", type: "STRING", mode: "NULLABLE" },
          { name: "observation_confidence", type: "STRING", mode: "NULLABLE" },
          { name: "prompt_tokens", type: "INTEGER", mode: "NULLABLE" },
          { name: "completion_tokens", type: "INTEGER", mode: "NULLABLE" },
          { name: "total_tokens", type: "INTEGER", mode: "NULLABLE" },
          { name: "estimated_cost", type: "FLOAT", mode: "NULLABLE" },
        ],
      },
    });
    console.log(`Created BigQuery table: ${DATASET_ID}.${OBSERVATIONS_TABLE_ID}`);
  } else {
    const newColumns = [
      { name: "observation_evidence", type: "STRING" },
      { name: "observation_confidence", type: "STRING" },
      { name: "prompt_tokens", type: "INT64" },
      { name: "completion_tokens", type: "INT64" },
      { name: "total_tokens", type: "INT64" },
      { name: "estimated_cost", type: "FLOAT64" },
    ];
    for (const col of newColumns) {
      try {
        await client.query({ query: `ALTER TABLE ${fullTable} ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}` });
        await new Promise(r => setTimeout(r, 2000));
      } catch (err: any) {
        if (!err.message?.includes("already exists")) {
          console.log(`Note: Could not add ${col.name} column to ${OBSERVATIONS_TABLE_ID}: ${err.message}`);
        }
      }
    }
  }
  console.log(`BigQuery table ${DATASET_ID}.${OBSERVATIONS_TABLE_ID} ready.`);
}

let observationsTableInitialized = false;

export interface CallObservationEntry {
  callId: string;
  careFlowId?: string | null;
  interactionDatetime?: string | null;
  sourceType?: string | null;
  sourceId: string;
  processedAt: string;
  processingTimeMs: number;
  promptVersion?: number | null;
  promptVersionDate?: string | null;
  contextValues?: Record<string, string>;
  summary?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  observations: ObservationResult[];
}

export async function insertCallObservations(entry: CallObservationEntry): Promise<void> {
  try {
    if (!observationsTableInitialized) {
      await ensureObservationsTable();
      observationsTableInitialized = true;
    }

    if (!entry.observations || entry.observations.length === 0) return;

    const client = getBigQueryClient();
    const rows = entry.observations.map(obs => ({
      call_id: entry.callId,
      care_flow_id: entry.careFlowId || null,
      interaction_datetime: entry.interactionDatetime || null,
      source_type: entry.sourceType || null,
      source_id: entry.sourceId,
      processed_at: entry.processedAt,
      processing_time_ms: entry.processingTimeMs,
      prompt_version: entry.promptVersion ?? null,
      prompt_version_date: entry.promptVersionDate || null,
      context_values: entry.contextValues ? JSON.stringify(entry.contextValues) : null,
      summary: entry.summary || null,
      observation_name: obs.name,
      observation_display_name: obs.display_name,
      observation_domain: obs.domain,
      observation_value_type: obs.value_type,
      observation_value: obs.value !== null && obs.value !== undefined ? String(obs.value) : null,
      observation_detail: obs.detail || null,
      observation_evidence: obs.evidence || null,
      observation_confidence: obs.confidence || null,
      prompt_tokens: entry.promptTokens ?? null,
      completion_tokens: entry.completionTokens ?? null,
      total_tokens: entry.totalTokens ?? null,
      estimated_cost: entry.estimatedCost ?? null,
    }));

    await client
      .dataset(DATASET_ID)
      .table(OBSERVATIONS_TABLE_ID)
      .insert(rows);

    console.log(`BigQuery call_observations inserted: ${rows.length} rows for call ${entry.callId}`);
  } catch (error: any) {
    console.error("Failed to insert call_observations:", error.message);
    if (error.errors) {
      console.error("BigQuery errors:", JSON.stringify(error.errors));
    }
  }
}

let initialized = false;

export interface LogEntry {
  callId: string;
  transcriptLength: number;
  summary?: string;
  areasForFollowUp?: string[];
  questionsCount?: number;
  processingTimeMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  status: "success" | "error";
  errorMessage?: string;
}

export async function logTooBigQuery(entry: LogEntry): Promise<void> {
  try {
    if (!initialized) {
      await ensureDatasetAndTable();
      initialized = true;
    }

    const client = getBigQueryClient();
    const row = {
      call_id: entry.callId,
      timestamp: new Date().toISOString(),
      transcript_length: entry.transcriptLength,
      summary: entry.summary || null,
      areas_for_followup: entry.areasForFollowUp || [],
      questions_count: entry.questionsCount ?? null,
      processing_time_ms: entry.processingTimeMs,
      prompt_tokens: entry.promptTokens ?? null,
      completion_tokens: entry.completionTokens ?? null,
      total_tokens: entry.totalTokens ?? null,
      estimated_cost: entry.estimatedCost ?? null,
      status: entry.status,
      error_message: entry.errorMessage || null,
    };

    await client
      .dataset(DATASET_ID)
      .table(TABLE_ID)
      .insert([row]);

    console.log(`BigQuery log inserted for call: ${entry.callId}`);
  } catch (error: any) {
    console.error("Failed to log to BigQuery:", error.message);
    if (error.errors) {
      console.error("BigQuery errors:", JSON.stringify(error.errors));
    }
  }
}
