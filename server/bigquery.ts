import { BigQuery } from "@google-cloud/bigquery";
import type { ObservationResult, QAPair } from "./gemini";

const DATASET_ID = "call_information";
const CALL_INFO_TABLE_ID = "call_info";
const OBSERVATIONS_TABLE_ID = "call_observations";
const QA_PAIRS_TABLE_ID = "call_qa_pairs";
const BATCH_PROCESSING_TABLE_ID = "batch_processing";

export interface CallInfoRow {
  call_id: string;
  care_flow_id: string | null;
  processed_datetime: { value: string } | string | null;
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
  request_body: string | null;
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
  if (tableExists) {
    return;
  }
  {
    await dataset.createTable(CALL_INFO_TABLE_ID, {
      schema: {
        fields: [
          { name: "call_id", type: "STRING", mode: "REQUIRED" },
          { name: "care_flow_id", type: "STRING", mode: "NULLABLE" },
          { name: "processed_datetime", type: "TIMESTAMP", mode: "NULLABLE" },
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
  if (tableExists) {
    return;
  }
  {
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
let qaPairsInitialized = false;

async function migrateCallInfoColumns(): Promise<void> {
  try {
    const client = getBigQueryClient();
    const dataset = client.dataset(DATASET_ID);
    const table = dataset.table(CALL_INFO_TABLE_ID);
    const [metadata] = await table.getMetadata();
    const fields = metadata.schema?.fields || [];
    const hasRequestBody = fields.some((f: any) => f.name === "request_body");
    if (!hasRequestBody) {
      await client.query({
        query: `ALTER TABLE \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\` ADD COLUMN request_body STRING`,
        location: "US",
      });
      console.log("Added request_body column to call_info table.");
    }
  } catch (err: any) {
    console.error("Migration check for call_info columns:", err.message);
  }
}

export async function initializeCallTables(): Promise<void> {
  try {
    await ensureCallInfoTable();
    callInfoInitialized = true;
    console.log("BigQuery table call_info ready.");
    await ensureObservationsTable();
    observationsInitialized = true;
    console.log("BigQuery table call_observations ready.");
    await migrateCallInfoColumns();
  } catch (err: any) {
    console.error("Failed to initialize call tables:", err.message);
  }
}

export interface CallInfoEntry {
  callId: string;
  careFlowId?: string | null;
  processedDatetime?: string | null;
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
  requestBody?: string;
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
      processed_datetime: entry.processedDatetime || null,
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
      request_body: entry.requestBody || null,
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

async function ensureQAPairsTable() {
  const client = getBigQueryClient();
  const dataset = await ensureDataset();
  const table = dataset.table(QA_PAIRS_TABLE_ID);
  const [tableExists] = await table.exists();
  if (tableExists) {
    return;
  }
  await dataset.createTable(QA_PAIRS_TABLE_ID, {
    schema: {
      fields: [
        { name: "call_id", type: "STRING", mode: "REQUIRED" },
        { name: "sequence_number", type: "INTEGER", mode: "REQUIRED" },
        { name: "question", type: "STRING", mode: "REQUIRED" },
        { name: "answer", type: "STRING", mode: "REQUIRED" },
        { name: "asked_by", type: "STRING", mode: "NULLABLE" },
        { name: "answered_by", type: "STRING", mode: "NULLABLE" },
        { name: "observation_name", type: "STRING", mode: "NULLABLE" },
        { name: "observation_display_name", type: "STRING", mode: "NULLABLE" },
        { name: "category", type: "STRING", mode: "NULLABLE" },
      ],
    },
  });
  console.log(`Created BigQuery table: ${DATASET_ID}.${QA_PAIRS_TABLE_ID}`);
}

export async function insertCallQAPairs(callId: string, qaPairs: QAPair[]): Promise<void> {
  try {
    if (!qaPairsInitialized) {
      await ensureQAPairsTable();
      qaPairsInitialized = true;
    }

    if (!qaPairs || qaPairs.length === 0) return;

    const validPairs = qaPairs.filter(qa =>
      qa.question && typeof qa.question === "string" && qa.question.trim().length > 0 &&
      qa.answer && typeof qa.answer === "string" && qa.answer.trim().length > 0
    );

    if (validPairs.length === 0) {
      console.log(`No valid Q&A pairs to insert for call ${callId} (${qaPairs.length} dropped due to missing question/answer)`);
      return;
    }

    if (validPairs.length < qaPairs.length) {
      console.warn(`Dropped ${qaPairs.length - validPairs.length} invalid Q&A pairs for call ${callId}`);
    }

    const client = getBigQueryClient();
    const rows = validPairs.map((qa, index) => ({
      call_id: callId,
      sequence_number: index + 1,
      question: qa.question,
      answer: qa.answer,
      asked_by: qa.asked_by || null,
      answered_by: qa.answered_by || null,
      observation_name: qa.observation_name || null,
      observation_display_name: qa.observation_display_name || null,
      category: qa.category || null,
    }));

    await client
      .dataset(DATASET_ID)
      .table(QA_PAIRS_TABLE_ID)
      .insert(rows);

    console.log(`BigQuery call_qa_pairs inserted: ${rows.length} rows for call ${callId}`);
  } catch (error: any) {
    console.error("Failed to insert call_qa_pairs:", error.message);
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
    processed_datetime: extractTimestamp(row.processed_datetime),
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
    request_body: row.request_body ? JSON.parse(row.request_body) : null,
  }));
}

export interface BatchProcessingRow {
  batch_id: string;
  bland_call_id: string;
  transcript: string;
  source_type: string;
  created_at: string;
  status: string;
  error_message: string | null;
  result_call_id: string | null;
  processed_at: string | null;
  batch_label: string | null;
  care_flow_id: string | null;
}

let batchTableInitialized = false;

async function ensureBatchProcessingTable(): Promise<void> {
  const client = getBigQueryClient();
  const dataset = await ensureDataset();
  const table = dataset.table(BATCH_PROCESSING_TABLE_ID);
  const [tableExists] = await table.exists();
  if (tableExists) return;

  await dataset.createTable(BATCH_PROCESSING_TABLE_ID, {
    schema: {
      fields: [
        { name: "batch_id", type: "STRING", mode: "REQUIRED" },
        { name: "bland_call_id", type: "STRING", mode: "REQUIRED" },
        { name: "transcript", type: "STRING", mode: "REQUIRED" },
        { name: "source_type", type: "STRING", mode: "NULLABLE" },
        { name: "created_at", type: "TIMESTAMP", mode: "REQUIRED" },
        { name: "status", type: "STRING", mode: "REQUIRED" },
        { name: "error_message", type: "STRING", mode: "NULLABLE" },
        { name: "result_call_id", type: "STRING", mode: "NULLABLE" },
        { name: "processed_at", type: "TIMESTAMP", mode: "NULLABLE" },
        { name: "batch_label", type: "STRING", mode: "NULLABLE" },
        { name: "care_flow_id", type: "STRING", mode: "NULLABLE" },
      ],
    },
  });
  console.log(`Created BigQuery table: ${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}`);
}

async function migrateBatchProcessingColumns(): Promise<void> {
  try {
    const client = getBigQueryClient();
    const dataset = client.dataset(DATASET_ID);
    const table = dataset.table(BATCH_PROCESSING_TABLE_ID);
    const [exists] = await table.exists();
    if (!exists) return;

    const [metadata] = await table.getMetadata();
    const fields = metadata.schema?.fields || [];
    const hasCareFlowId = fields.some((f: any) => f.name === "care_flow_id");
    if (!hasCareFlowId) {
      await client.query({
        query: `ALTER TABLE \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\` ADD COLUMN care_flow_id STRING`,
        location: "US",
      });
      console.log("Added care_flow_id column to batch_processing table.");
    }
  } catch (err: any) {
    console.error("Migration check for batch_processing columns:", err.message);
  }
}

export async function initializeBatchTable(): Promise<void> {
  try {
    await ensureBatchProcessingTable();
    batchTableInitialized = true;
    console.log("BigQuery batch_processing table ready.");
    await migrateBatchProcessingColumns();
  } catch (err: any) {
    console.error("Failed to initialize batch_processing table:", err.message);
  }
}

export async function queryBlandCalls(filters: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  callIds?: string[];
  answeredBy?: string;
  minDuration?: number;
  maxDuration?: number;
  requiredTags?: string[];
  excludeTags?: string[];
  processedFilter?: "unprocessed" | "processed" | "all";
}): Promise<any[]> {
  const client = getBigQueryClient();
  const conditions: string[] = [];
  const params: Record<string, any> = {};

  if (filters.callIds && filters.callIds.length > 0) {
    conditions.push("c.call_id IN UNNEST(@callIds)");
    params.callIds = filters.callIds;
  }
  if (filters.startDate) {
    conditions.push("c.created_at >= @startDate");
    params.startDate = filters.startDate;
  }
  if (filters.endDate) {
    conditions.push("c.created_at <= @endDate");
    params.endDate = filters.endDate;
  }
  if (filters.answeredBy) {
    conditions.push("c.answered_by = @answeredBy");
    params.answeredBy = filters.answeredBy;
  }
  if (filters.minDuration !== undefined && filters.minDuration > 0) {
    conditions.push("c.call_length >= @minDuration");
    params.minDuration = filters.minDuration;
  }
  if (filters.maxDuration !== undefined && filters.maxDuration > 0) {
    conditions.push("c.call_length <= @maxDuration");
    params.maxDuration = filters.maxDuration;
  }
  if (filters.requiredTags && filters.requiredTags.length > 0) {
    conditions.push(`c.call_id IN (
      SELECT call_id FROM \`${client.projectId}.Bland.tags\`
      WHERE tag IN UNNEST(@requiredTags)
      GROUP BY call_id
      HAVING COUNT(DISTINCT tag) = @requiredTagCount
    )`);
    params.requiredTags = filters.requiredTags;
    params.requiredTagCount = filters.requiredTags.length;
  }
  if (filters.excludeTags && filters.excludeTags.length > 0) {
    conditions.push(`c.call_id NOT IN (
      SELECT call_id FROM \`${client.projectId}.Bland.tags\`
      WHERE tag IN UNNEST(@excludeTags)
    )`);
    params.excludeTags = filters.excludeTags;
  }
  conditions.push("c.concatenated_transcript IS NOT NULL");
  conditions.push("LENGTH(TRIM(c.concatenated_transcript)) > 0");

  if (filters.processedFilter === "unprocessed") {
    conditions.push(`c.call_id NOT IN (
      SELECT source_id FROM \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\`
      WHERE source_id IS NOT NULL
    )`);
  } else if (filters.processedFilter === "processed") {
    conditions.push(`c.call_id IN (
      SELECT source_id FROM \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\`
      WHERE source_id IS NOT NULL
    )`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rowLimit = Math.min(filters.limit || 100, 500);

  const query = `
    SELECT c.call_id, c.created_at, c.call_length, c.status, c.summary, 
           LENGTH(c.concatenated_transcript) as transcript_length,
           c.to_number, c.from_number, c.answered_by, c.pathway_id,
           v.variable_value as care_flow_id,
           ARRAY_AGG(DISTINCT t.tag IGNORE NULLS) as tags
    FROM \`${client.projectId}.Bland.calls\` c
    LEFT JOIN \`${client.projectId}.Bland.variables\` v
      ON c.call_id = v.call_id AND v.variable_name = 'awell_care_flow_id'
    LEFT JOIN \`${client.projectId}.Bland.tags\` t
      ON c.call_id = t.call_id AND t.tag IS NOT NULL AND t.tag != ''
    ${whereClause}
    GROUP BY c.call_id, c.created_at, c.call_length, c.status, c.summary,
             c.concatenated_transcript, c.to_number, c.from_number, c.answered_by, c.pathway_id,
             v.variable_value
    ORDER BY c.created_at DESC
    LIMIT ${rowLimit}
  `;

  const [rows] = await client.query({ query, params, location: "US" });
  return rows as any[];
}

export async function getDistinctTags(): Promise<string[]> {
  const client = getBigQueryClient();
  const query = `
    SELECT DISTINCT tag
    FROM \`${client.projectId}.Bland.tags\`
    WHERE tag IS NOT NULL AND tag != ''
    ORDER BY tag
  `;
  const [rows] = await client.query({ query, location: "US" });
  return (rows as any[]).map(r => r.tag);
}

export async function loadBlandCallsToBatch(
  callIds: string[],
  batchLabel: string | null
): Promise<{ loaded: number; skipped: number }> {
  if (!batchTableInitialized) {
    await ensureBatchProcessingTable();
    batchTableInitialized = true;
  }

  const client = getBigQueryClient();
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const existingQuery = `
    SELECT bland_call_id FROM \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    WHERE bland_call_id IN UNNEST(@callIds) AND status IN ('pending', 'processing', 'completed')
  `;
  const [existingRows] = await client.query({ query: existingQuery, params: { callIds }, location: "US" });
  const existingIds = new Set((existingRows as any[]).map(r => r.bland_call_id));

  const newCallIds = callIds.filter(id => !existingIds.has(id));
  if (newCallIds.length === 0) {
    return { loaded: 0, skipped: callIds.length };
  }

  const transcriptQuery = `
    SELECT c.call_id, c.concatenated_transcript, c.status,
           v.variable_value as care_flow_id
    FROM \`${client.projectId}.Bland.calls\` c
    LEFT JOIN \`${client.projectId}.Bland.variables\` v
      ON c.call_id = v.call_id AND v.variable_name = 'awell_care_flow_id'
    WHERE c.call_id IN UNNEST(@callIds)
    AND c.concatenated_transcript IS NOT NULL
    AND LENGTH(TRIM(c.concatenated_transcript)) > 0
  `;
  const [transcriptRows] = await client.query({ query: transcriptQuery, params: { callIds: newCallIds }, location: "US" });

  if ((transcriptRows as any[]).length === 0) {
    return { loaded: 0, skipped: callIds.length };
  }

  const validRows = (transcriptRows as any[]);
  const now = new Date().toISOString();

  const valuesClauses = validRows.map((_, i) =>
    `(@batchId, @callId_${i}, @transcript_${i}, 'bland_call', @now, 'pending', CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS TIMESTAMP), @batchLabel, @careFlowId_${i})`
  ).join(",\n    ");

  const params: Record<string, any> = {
    batchId,
    now,
    batchLabel: batchLabel || null,
  };
  const types: Record<string, string> = {
    batchId: "STRING",
    now: "STRING",
    batchLabel: "STRING",
  };

  validRows.forEach((row, i) => {
    params[`callId_${i}`] = row.call_id;
    params[`transcript_${i}`] = row.concatenated_transcript;
    params[`careFlowId_${i}`] = row.care_flow_id || null;
    types[`callId_${i}`] = "STRING";
    types[`transcript_${i}`] = "STRING";
    types[`careFlowId_${i}`] = "STRING";
  });

  const insertQuery = `
    INSERT INTO \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    (batch_id, bland_call_id, transcript, source_type, created_at, status, error_message, result_call_id, processed_at, batch_label, care_flow_id)
    VALUES ${valuesClauses}
  `;

  await client.query({ query: insertQuery, params, types, location: "US" });

  return { loaded: validRows.length, skipped: callIds.length - validRows.length };
}

export async function getBatchItems(filters?: {
  status?: string;
  batchLabel?: string;
  limit?: number;
}): Promise<any[]> {
  const client = getBigQueryClient();
  const conditions: string[] = [];
  const params: Record<string, any> = {};

  if (filters?.status) {
    conditions.push("status = @status");
    params.status = filters.status;
  }
  if (filters?.batchLabel) {
    conditions.push("batch_label = @batchLabel");
    params.batchLabel = filters.batchLabel;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rowLimit = Math.min(filters?.limit || 200, 1000);

  const query = `
    SELECT batch_id, bland_call_id, source_type, created_at, status, 
           error_message, result_call_id, processed_at, batch_label,
           care_flow_id, LENGTH(transcript) as transcript_length
    FROM \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${rowLimit}
  `;

  const [rows] = await client.query({ query, params, location: "US" });
  return (rows as any[]).map(row => ({
    ...row,
    created_at: extractTimestamp(row.created_at),
    processed_at: extractTimestamp(row.processed_at),
  }));
}

export async function getBatchSummary(): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  batches: { batch_id: string; batch_label: string | null; count: number; status_counts: Record<string, number> }[];
}> {
  const client = getBigQueryClient();

  try {
    const [tableExists] = await client.dataset(DATASET_ID).table(BATCH_PROCESSING_TABLE_ID).exists();
    if (!tableExists) {
      return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, batches: [] };
    }
  } catch {
    return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, batches: [] };
  }

  const statusQuery = `
    SELECT status, COUNT(*) as cnt
    FROM \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    GROUP BY status
  `;
  const [statusRows] = await client.query({ query: statusQuery, location: "US" });

  const counts: Record<string, number> = {};
  (statusRows as any[]).forEach(r => { counts[r.status] = Number(r.cnt); });

  const batchQuery = `
    SELECT batch_id, batch_label, status, COUNT(*) as cnt
    FROM \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    GROUP BY batch_id, batch_label, status
    ORDER BY MIN(created_at) DESC
  `;
  const [batchRows] = await client.query({ query: batchQuery, location: "US" });

  const batchMap = new Map<string, { batch_id: string; batch_label: string | null; count: number; status_counts: Record<string, number> }>();
  (batchRows as any[]).forEach(r => {
    if (!batchMap.has(r.batch_id)) {
      batchMap.set(r.batch_id, { batch_id: r.batch_id, batch_label: r.batch_label, count: 0, status_counts: {} });
    }
    const b = batchMap.get(r.batch_id)!;
    b.count += Number(r.cnt);
    b.status_counts[r.status] = Number(r.cnt);
  });

  return {
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    pending: counts["pending"] || 0,
    processing: counts["processing"] || 0,
    completed: counts["completed"] || 0,
    failed: counts["failed"] || 0,
    batches: Array.from(batchMap.values()),
  };
}

export async function getPendingBatchItems(limit = 10, batchId?: string): Promise<any[]> {
  const client = getBigQueryClient();
  const batchFilter = batchId ? "AND batch_id = @batchId" : "";
  const query = `
    SELECT batch_id, bland_call_id, transcript, source_type, batch_label, care_flow_id
    FROM \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    WHERE status = 'pending' ${batchFilter}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  const params: Record<string, any> = {};
  if (batchId) params.batchId = batchId;
  const [rows] = await client.query({ query, params, location: "US" });
  return rows as any[];
}

const VALID_BATCH_STATUSES = new Set(["pending", "processing", "completed", "failed"]);

export async function updateBatchItemStatus(
  blandCallId: string,
  status: string,
  resultCallId?: string,
  errorMessage?: string
): Promise<number> {
  if (!VALID_BATCH_STATUSES.has(status)) {
    throw new Error(`Invalid batch status: ${status}`);
  }

  const client = getBigQueryClient();
  const params: Record<string, any> = {
    status,
    blandCallId,
    resultCallId: resultCallId || null,
    errorMessage: errorMessage ? errorMessage.substring(0, 1000) : null,
  };

  const types: Record<string, string> = {
    status: "STRING",
    blandCallId: "STRING",
    resultCallId: "STRING",
    errorMessage: "STRING",
  };

  const setProcessedAt = (status === "completed" || status === "failed")
    ? ", processed_at = CURRENT_TIMESTAMP()" : "";

  const fromStatus = status === "processing" ? "'pending'" : "'pending', 'processing'";

  const query = `
    UPDATE \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    SET status = @status, result_call_id = @resultCallId, error_message = @errorMessage ${setProcessedAt}
    WHERE bland_call_id = @blandCallId AND status IN (${fromStatus})
  `;

  const [, , metadata] = await client.query({ query, params, types, location: "US" });
  const affected = Number((metadata as any)?.dmlStats?.updatedRowCount || (metadata as any)?.numDmlAffectedRows || 0);
  return affected;
}

export async function recreateBatch(oldBatchId: string): Promise<{ newBatchId: string; count: number }> {
  const client = getBigQueryClient();
  const readQuery = `
    SELECT bland_call_id, transcript, source_type, batch_label, care_flow_id
    FROM \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    WHERE batch_id = @oldBatchId
  `;
  const [rows] = await client.query({ query: readQuery, params: { oldBatchId }, location: "US" });
  const items = rows as any[];

  if (items.length === 0) {
    throw new Error(`No items found for batch ${oldBatchId}`);
  }

  const newBatchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();

  const valuesClauses = items.map((_, i) =>
    `(@newBatchId, @callId_${i}, @transcript_${i}, 'bland_call', @now, 'pending', CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS TIMESTAMP), @batchLabel_${i}, @careFlowId_${i})`
  ).join(",\n    ");

  const params: Record<string, any> = { newBatchId, now };
  const types: Record<string, string> = { newBatchId: "STRING", now: "STRING" };

  items.forEach((item, i) => {
    params[`callId_${i}`] = item.bland_call_id;
    params[`transcript_${i}`] = item.transcript;
    params[`batchLabel_${i}`] = item.batch_label || null;
    params[`careFlowId_${i}`] = item.care_flow_id || null;
    types[`callId_${i}`] = "STRING";
    types[`transcript_${i}`] = "STRING";
    types[`batchLabel_${i}`] = "STRING";
    types[`careFlowId_${i}`] = "STRING";
  });

  const insertQuery = `
    INSERT INTO \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    (batch_id, bland_call_id, transcript, source_type, created_at, status, error_message, result_call_id, processed_at, batch_label, care_flow_id)
    VALUES ${valuesClauses}
  `;

  await client.query({ query: insertQuery, params, types, location: "US" });

  const deleteQuery = `
    DELETE FROM \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    WHERE batch_id = @oldBatchId
  `;
  try {
    await client.query({ query: deleteQuery, params: { oldBatchId }, location: "US" });
  } catch {
  }

  return { newBatchId, count: items.length };
}

export async function resetFailedBatchItems(batchId?: string): Promise<number> {
  const client = getBigQueryClient();
  const condition = batchId ? `AND batch_id = @batchId` : "";
  const query = `
    UPDATE \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    SET status = 'pending', error_message = NULL, processed_at = NULL, result_call_id = NULL
    WHERE status = 'failed' ${condition}
  `;
  const params: Record<string, any> = {};
  if (batchId) params.batchId = batchId;

  const [, , response] = await client.query({ query, params, location: "US" });
  return Number((response as any)?.dmlStats?.updatedRowCount || (response as any)?.numDmlAffectedRows || 0);
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
    processed_datetime: extractTimestamp(row.processed_datetime),
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
    request_body: row.request_body ? JSON.parse(row.request_body) : null,
  } : null;

  return { callInfo, observations: obsRows as CallObservationRow[] };
}
