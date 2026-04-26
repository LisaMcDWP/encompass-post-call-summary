import { BigQuery } from "@google-cloud/bigquery";
import type { ObservationResult, QAPair, Barrier, CallQAResult } from "./gemini";
import type { CallActivationObjectiveResult } from "@shared/schema";

const DATASET_ID = "call_information";
const CALL_INFO_TABLE_ID = "call_info";
const OBSERVATIONS_TABLE_ID = "call_observations";
const QA_PAIRS_TABLE_ID = "call_qa_pairs";
const BARRIERS_TABLE_ID = "barriers";
const BATCH_PROCESSING_TABLE_ID = "batch_processing";
const CALL_QA_TABLE_ID = "call_qa_results";
const KNOWN_CONTEXT_TABLE_ID = "known_context_details";
const CALL_DISPOSITIONS_TABLE_ID = "call_dispositions";
const CALL_REVIEWS_TABLE_ID = "call_reviews";
const CALL_REVIEW_STATUSES_TABLE_ID = "call_review_statuses";
const CALL_ACTIVATION_OBJECTIVES_TABLE_ID = "call_activation_objectives";

export interface CallInfoRow {
  call_id: string;
  care_flow_id: string | null;
  processed_datetime: { value: string } | string | null;
  call_date: { value: string } | string | null;
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
  client: string | null;
  pathway: string | null;
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
const clientBigQueryMap = new Map<string, BigQuery>();

function getCentralProjectId(): string {
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) throw new Error("GCP_PROJECT_ID is not set");
  return projectId;
}

function getCentralCredentials(): any {
  const raw = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GCP_SERVICE_ACCOUNT_KEY is not set");
  return JSON.parse(raw);
}

function getBigQueryClient(): BigQuery {
  if (!bigquery) {
    const credentials = getCentralCredentials();
    const projectId = getCentralProjectId();
    bigquery = new BigQuery({ projectId, credentials });
  }
  return bigquery;
}

function getOutputBigQueryClient(targetProjectId?: string): BigQuery {
  const effectiveProjectId = targetProjectId || getCentralProjectId();
  if (effectiveProjectId === getCentralProjectId()) {
    return getBigQueryClient();
  }
  if (!clientBigQueryMap.has(effectiveProjectId)) {
    const credentials = getCentralCredentials();
    const client = new BigQuery({ projectId: effectiveProjectId, credentials });
    clientBigQueryMap.set(effectiveProjectId, client);
    console.log(`Created BigQuery client for client project: ${effectiveProjectId}`);
  }
  return clientBigQueryMap.get(effectiveProjectId)!;
}

function resolveProjectId(targetProjectId?: string): string {
  return targetProjectId || getCentralProjectId();
}

async function ensureDataset(targetProjectId?: string) {
  const client = getOutputBigQueryClient(targetProjectId);
  const dataset = client.dataset(DATASET_ID);
  const [datasetExists] = await dataset.exists();
  if (!datasetExists) {
    await client.createDataset(DATASET_ID, { location: "US" });
    console.log(`Created BigQuery dataset: ${DATASET_ID} in project ${resolveProjectId(targetProjectId)}`);
  }
  return dataset;
}

async function ensureCallInfoTable(targetProjectId?: string) {
  const client = getOutputBigQueryClient(targetProjectId);
  const dataset = await ensureDataset(targetProjectId);
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
    console.log(`Created BigQuery table: ${DATASET_ID}.${CALL_INFO_TABLE_ID} in project ${resolveProjectId(targetProjectId)}`);
  }
}

async function ensureObservationsTable(targetProjectId?: string) {
  const client = getOutputBigQueryClient(targetProjectId);
  const dataset = await ensureDataset(targetProjectId);
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
    console.log(`Created BigQuery table: ${DATASET_ID}.${OBSERVATIONS_TABLE_ID} in project ${resolveProjectId(targetProjectId)}`);
  }
}

const initializedTables = new Set<string>();

function tableInitKey(tableId: string, targetProjectId?: string): string {
  return `${resolveProjectId(targetProjectId)}:${tableId}`;
}

async function migrateCallInfoColumns(targetProjectId?: string): Promise<void> {
  try {
    const client = getOutputBigQueryClient(targetProjectId);
    const dataset = client.dataset(DATASET_ID);
    const table = dataset.table(CALL_INFO_TABLE_ID);
    const [metadata] = await table.getMetadata();
    const fields = metadata.schema?.fields || [];
    const fieldNames = new Set(fields.map((f: any) => f.name));
    if (!fieldNames.has("request_body")) {
      await client.query({
        query: `ALTER TABLE \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\` ADD COLUMN request_body STRING`,
        location: "US",
      });
      console.log("Added request_body column to call_info table.");
    }
    if (!fieldNames.has("client")) {
      await client.query({
        query: `ALTER TABLE \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\` ADD COLUMN client STRING`,
        location: "US",
      });
      console.log("Added client column to call_info table.");
    }
    if (!fieldNames.has("pathway")) {
      await client.query({
        query: `ALTER TABLE \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\` ADD COLUMN pathway STRING`,
        location: "US",
      });
      console.log("Added pathway column to call_info table.");
    }
    if (!fieldNames.has("call_date")) {
      await client.query({
        query: `ALTER TABLE \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\` ADD COLUMN call_date TIMESTAMP`,
        location: "US",
      });
      console.log("Added call_date column to call_info table.");
    }
    if (!fieldNames.has("request_headers")) {
      await client.query({
        query: `ALTER TABLE \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\` ADD COLUMN request_headers STRING`,
        location: "US",
      });
      console.log("Added request_headers column to call_info table.");
    }
    if (!fieldNames.has("response_json")) {
      await client.query({
        query: `ALTER TABLE \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\` ADD COLUMN response_json STRING`,
        location: "US",
      });
      console.log("Added response_json column to call_info table.");
    }
    if (!fieldNames.has("processing_id")) {
      await client.query({
        query: `ALTER TABLE \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\` ADD COLUMN processing_id STRING`,
        location: "US",
      });
      console.log("Added processing_id column to call_info table.");
    }
  } catch (err: any) {
    console.error("Migration check for call_info columns:", err.message);
  }
}

export async function initializeCallTables(targetProjectId?: string): Promise<void> {
  try {
    const ciKey = tableInitKey(CALL_INFO_TABLE_ID, targetProjectId);
    if (!initializedTables.has(ciKey)) {
      await ensureCallInfoTable(targetProjectId);
      initializedTables.add(ciKey);
      console.log(`BigQuery table call_info ready in project ${resolveProjectId(targetProjectId)}.`);
    }
    const obsKey = tableInitKey(OBSERVATIONS_TABLE_ID, targetProjectId);
    if (!initializedTables.has(obsKey)) {
      await ensureObservationsTable(targetProjectId);
      initializedTables.add(obsKey);
      console.log(`BigQuery table call_observations ready in project ${resolveProjectId(targetProjectId)}.`);
    }
    await migrateCallInfoColumns(targetProjectId);
  } catch (err: any) {
    console.error("Failed to initialize call tables:", err.message);
  }
}

export interface CallInfoEntry {
  callId: string;
  processingId?: string | null;
  careFlowId?: string | null;
  processedDatetime?: string | null;
  callDate?: string | null;
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
  requestHeaders?: string;
  responseJson?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  status: "success" | "success_partial" | "error";
  errorMessage?: string;
  client?: string | null;
  pathway?: string | null;
}

async function deleteExistingCallData(callId: string, tableId: string, targetProjectId?: string): Promise<void> {
  try {
    const client = getOutputBigQueryClient(targetProjectId);
    const query = `DELETE FROM \`${client.projectId}.${DATASET_ID}.${tableId}\` WHERE call_id = @callId`;
    await client.query({ query, params: { callId }, location: "US" });
  } catch (err: any) {
    console.warn(`Could not delete existing rows from ${tableId} for call ${callId}: ${err.message}`);
  }
}

export async function insertCallInfo(entry: CallInfoEntry, targetProjectId?: string): Promise<void> {
  try {
    const key = tableInitKey(CALL_INFO_TABLE_ID, targetProjectId);
    if (!initializedTables.has(key)) {
      await ensureCallInfoTable(targetProjectId);
      initializedTables.add(key);
    }

    await deleteExistingCallData(entry.callId, CALL_INFO_TABLE_ID, targetProjectId);

    const client = getOutputBigQueryClient(targetProjectId);
    const row: Record<string, any> = {
      call_id: entry.callId,
      processing_id: entry.processingId || null,
      care_flow_id: entry.careFlowId || null,
      processed_datetime: entry.processedDatetime || null,
      call_date: entry.callDate || null,
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
      request_headers: entry.requestHeaders || null,
      response_json: entry.responseJson || null,
      client: entry.client || null,
      pathway: entry.pathway || null,
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

export async function insertCallObservations(callId: string, observations: ObservationResult[], targetProjectId?: string): Promise<void> {
  try {
    const key = tableInitKey(OBSERVATIONS_TABLE_ID, targetProjectId);
    if (!initializedTables.has(key)) {
      await ensureObservationsTable(targetProjectId);
      initializedTables.add(key);
    }

    if (!observations || observations.length === 0) return;

    await deleteExistingCallData(callId, OBSERVATIONS_TABLE_ID, targetProjectId);

    const client = getOutputBigQueryClient(targetProjectId);
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

async function ensureQAPairsTable(targetProjectId?: string) {
  const client = getOutputBigQueryClient(targetProjectId);
  const dataset = await ensureDataset(targetProjectId);
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
  console.log(`Created BigQuery table: ${DATASET_ID}.${QA_PAIRS_TABLE_ID} in project ${resolveProjectId(targetProjectId)}`);
}

export async function insertCallQAPairs(callId: string, qaPairs: QAPair[], targetProjectId?: string): Promise<void> {
  try {
    const key = tableInitKey(QA_PAIRS_TABLE_ID, targetProjectId);
    if (!initializedTables.has(key)) {
      await ensureQAPairsTable(targetProjectId);
      initializedTables.add(key);
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

    await deleteExistingCallData(callId, QA_PAIRS_TABLE_ID, targetProjectId);

    const client = getOutputBigQueryClient(targetProjectId);
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

export async function ensureCallBarriersTable(targetProjectId?: string): Promise<void> {
  try {
    const dataset = await ensureDataset(targetProjectId);
    const table = dataset.table(BARRIERS_TABLE_ID);
    const [exists] = await table.exists();
    if (!exists) {
      await dataset.createTable(BARRIERS_TABLE_ID, {
        schema: {
          fields: [
            { name: "call_id", type: "STRING", mode: "REQUIRED" },
            { name: "barrier", type: "STRING", mode: "REQUIRED" },
            { name: "context", type: "STRING", mode: "NULLABLE" },
            { name: "category", type: "STRING", mode: "NULLABLE" },
            { name: "severity", type: "STRING", mode: "NULLABLE" },
            { name: "observation_name", type: "STRING", mode: "NULLABLE" },
            { name: "observation_display_name", type: "STRING", mode: "NULLABLE" },
            { name: "evidence", type: "STRING", mode: "NULLABLE" },
          ],
        },
      });
      console.log(`Created barriers table in project ${resolveProjectId(targetProjectId)}`);
    }
  } catch (error: any) {
    console.error("Failed to ensure barriers table:", error.message);
  }
}

export async function insertCallBarriers(callId: string, barriers: Barrier[], targetProjectId?: string): Promise<void> {
  try {
    if (!barriers || barriers.length === 0) {
      return;
    }

    const validBarriers = barriers.filter(
      (b) => b.barrier && typeof b.barrier === "string" && b.barrier.trim().length > 0
    );

    if (validBarriers.length === 0) {
      console.log(`No valid barriers to insert for call ${callId} (${barriers.length} dropped due to missing barrier description)`);
      return;
    }

    if (validBarriers.length < barriers.length) {
      console.warn(`Dropped ${barriers.length - validBarriers.length} invalid barriers for call ${callId}`);
    }

    await deleteExistingCallData(callId, BARRIERS_TABLE_ID, targetProjectId);

    const client = getOutputBigQueryClient(targetProjectId);
    const rows = validBarriers.map((b) => ({
      call_id: callId,
      barrier: b.barrier,
      context: b.context || null,
      category: b.category || null,
      severity: b.severity || null,
      observation_name: b.observation_name || null,
      observation_display_name: b.observation_display_name || null,
      evidence: b.evidence || null,
    }));

    await client
      .dataset(DATASET_ID)
      .table(BARRIERS_TABLE_ID)
      .insert(rows);

    console.log(`BigQuery barriers inserted: ${rows.length} rows for call ${callId}`);
  } catch (error: any) {
    console.error("Failed to insert barriers:", error.message);
    if (error.errors) {
      console.error("BigQuery errors:", JSON.stringify(error.errors));
    }
  }
}

export async function getCallBarriers(callId: string, targetProjectId?: string): Promise<any[]> {
  try {
    const client = getOutputBigQueryClient(targetProjectId);
    const query = `SELECT * FROM \`${client.projectId}.${DATASET_ID}.${BARRIERS_TABLE_ID}\` WHERE call_id = @callId`;
    const [rows] = await client.query({ query, params: { callId } });
    return rows;
  } catch (error: any) {
    console.error("Failed to get call barriers:", error.message);
    return [];
  }
}

export async function ensureCallQATable(targetProjectId?: string): Promise<void> {
  try {
    const dataset = await ensureDataset(targetProjectId);
    const table = dataset.table(CALL_QA_TABLE_ID);
    const [exists] = await table.exists();
    if (!exists) {
      await dataset.createTable(CALL_QA_TABLE_ID, {
        schema: {
          fields: [
            { name: "call_id", type: "STRING", mode: "REQUIRED" },
            { name: "name", type: "STRING", mode: "REQUIRED" },
            { name: "display_name", type: "STRING", mode: "NULLABLE" },
            { name: "value", type: "STRING", mode: "NULLABLE" },
            { name: "detail", type: "STRING", mode: "NULLABLE" },
            { name: "evidence", type: "STRING", mode: "NULLABLE" },
          ],
        },
      });
      console.log(`Created call_qa_results table in project ${resolveProjectId(targetProjectId)}`);
    }
  } catch (error: any) {
    console.error("Failed to ensure call_qa_results table:", error.message);
  }
}

export async function insertCallQAResults(callId: string, results: CallQAResult[], targetProjectId?: string): Promise<void> {
  try {
    if (!results || !Array.isArray(results) || results.length === 0) return;

    const validResults = results.filter(
      (r) => r.name && typeof r.name === "string" && r.name.trim().length > 0
    );

    if (validResults.length === 0) return;

    await deleteExistingCallData(callId, CALL_QA_TABLE_ID, targetProjectId);

    const client = getOutputBigQueryClient(targetProjectId);
    const rows = validResults.map((r) => ({
      call_id: callId,
      name: r.name,
      display_name: r.display_name || null,
      value: r.value || null,
      detail: r.detail || null,
      evidence: r.evidence || null,
    }));

    await client
      .dataset(DATASET_ID)
      .table(CALL_QA_TABLE_ID)
      .insert(rows);

    console.log(`BigQuery call_qa_results inserted: ${rows.length} rows for call ${callId}`);
  } catch (error: any) {
    console.error("Failed to insert call_qa_results:", error.message);
    if (error.errors) {
      console.error("BigQuery errors:", JSON.stringify(error.errors));
    }
  }
}

export async function getCallQAResults(callId: string, targetProjectId?: string): Promise<any[]> {
  try {
    const client = getOutputBigQueryClient(targetProjectId);
    const query = `SELECT * FROM \`${client.projectId}.${DATASET_ID}.${CALL_QA_TABLE_ID}\` WHERE call_id = @callId`;
    const [rows] = await client.query({ query, params: { callId } });
    return rows;
  } catch (error: any) {
    console.error("Failed to get call QA results:", error.message);
    return [];
  }
}

export async function ensureCallDispositionsTable(targetProjectId?: string): Promise<void> {
  try {
    const dataset = await ensureDataset(targetProjectId);
    const table = dataset.table(CALL_DISPOSITIONS_TABLE_ID);
    const [exists] = await table.exists();
    if (!exists) {
      await dataset.createTable(CALL_DISPOSITIONS_TABLE_ID, {
        schema: {
          fields: [
            { name: "call_id", type: "STRING", mode: "REQUIRED" },
            { name: "disposition_category", type: "STRING", mode: "NULLABLE" },
            { name: "disposition_category_display", type: "STRING", mode: "NULLABLE" },
            { name: "disposition_detail", type: "STRING", mode: "NULLABLE" },
            { name: "disposition_detail_display", type: "STRING", mode: "NULLABLE" },
            { name: "confidence", type: "STRING", mode: "NULLABLE" },
            { name: "evidence", type: "STRING", mode: "NULLABLE" },
            { name: "detail", type: "STRING", mode: "NULLABLE" },
          ],
        },
      });
      console.log(`Created call_dispositions table in project ${resolveProjectId(targetProjectId)}`);
    }
  } catch (error: any) {
    console.error("Failed to ensure call_dispositions table:", error.message);
  }
}

export interface CallDispositionEntry {
  disposition_category: string;
  disposition_category_display?: string;
  disposition_detail: string;
  disposition_detail_display?: string;
  confidence?: string;
  evidence?: string;
  detail?: string;
}

export async function insertCallDisposition(callId: string, disposition: CallDispositionEntry, targetProjectId?: string): Promise<void> {
  try {
    if (!disposition || !disposition.disposition_category) return;
    await deleteExistingCallData(callId, CALL_DISPOSITIONS_TABLE_ID, targetProjectId);
    const client = getOutputBigQueryClient(targetProjectId);
    const row = {
      call_id: callId,
      disposition_category: disposition.disposition_category,
      disposition_category_display: disposition.disposition_category_display || null,
      disposition_detail: disposition.disposition_detail || null,
      disposition_detail_display: disposition.disposition_detail_display || null,
      confidence: disposition.confidence || null,
      evidence: disposition.evidence || null,
      detail: disposition.detail || null,
    };
    await client.dataset(DATASET_ID).table(CALL_DISPOSITIONS_TABLE_ID).insert([row]);
    console.log(`BigQuery call_disposition inserted for call ${callId}: ${disposition.disposition_category} / ${disposition.disposition_detail}`);
  } catch (error: any) {
    console.error("Failed to insert call disposition:", error.message);
  }
}

export async function ensureCallActivationObjectivesTable(targetProjectId?: string): Promise<void> {
  try {
    const dataset = await ensureDataset(targetProjectId);
    const table = dataset.table(CALL_ACTIVATION_OBJECTIVES_TABLE_ID);
    const [exists] = await table.exists();
    if (!exists) {
      await dataset.createTable(CALL_ACTIVATION_OBJECTIVES_TABLE_ID, {
        schema: {
          fields: [
            { name: "call_id", type: "STRING", mode: "REQUIRED" },
            { name: "objective_id", type: "INTEGER", mode: "REQUIRED" },
            { name: "objective_name", type: "STRING", mode: "REQUIRED" },
            { name: "touchpoint_id", type: "STRING", mode: "NULLABLE" },
            { name: "touchpoint_name", type: "STRING", mode: "NULLABLE" },
            { name: "call_date", type: "STRING", mode: "NULLABLE" },
            { name: "anchor_event_date", type: "STRING", mode: "NULLABLE" },
            { name: "target_date", type: "STRING", mode: "NULLABLE" },
            { name: "days_remaining", type: "INTEGER", mode: "NULLABLE" },
            { name: "band_label", type: "STRING", mode: "NULLABLE" },
            { name: "extracted_value", type: "STRING", mode: "NULLABLE" },
            { name: "current_stage_id", type: "STRING", mode: "NULLABLE" },
            { name: "current_stage_name", type: "STRING", mode: "NULLABLE" },
            { name: "on_track", type: "BOOL", mode: "NULLABLE" },
            { name: "on_track_status", type: "STRING", mode: "NULLABLE" },
            { name: "is_eligible", type: "BOOL", mode: "REQUIRED" },
            { name: "exclusion_reason", type: "STRING", mode: "NULLABLE" },
            { name: "rationale", type: "STRING", mode: "NULLABLE" },
            { name: "processed_at", type: "TIMESTAMP", mode: "REQUIRED" },
          ],
        },
      });
      console.log(`Created call_activation_objectives table in project ${resolveProjectId(targetProjectId)}`);
    }
  } catch (error: any) {
    console.error("Failed to ensure call_activation_objectives table:", error.message);
  }
}

export async function insertCallActivationObjectives(callId: string, results: CallActivationObjectiveResult[], targetProjectId?: string): Promise<void> {
  try {
    const key = tableInitKey(CALL_ACTIVATION_OBJECTIVES_TABLE_ID, targetProjectId);
    if (!initializedTables.has(key)) {
      await ensureCallActivationObjectivesTable(targetProjectId);
      initializedTables.add(key);
    }

    if (!results || results.length === 0) {
      await deleteExistingCallData(callId, CALL_ACTIVATION_OBJECTIVES_TABLE_ID, targetProjectId);
      return;
    }

    await deleteExistingCallData(callId, CALL_ACTIVATION_OBJECTIVES_TABLE_ID, targetProjectId);

    const client = getOutputBigQueryClient(targetProjectId);
    const rows = results.map(r => ({
      call_id: callId,
      objective_id: r.objectiveId,
      objective_name: r.objectiveName,
      touchpoint_id: r.touchpointId || null,
      touchpoint_name: r.touchpointName || null,
      call_date: r.callDate || null,
      anchor_event_date: r.anchorEventDate || null,
      target_date: r.targetDate || null,
      days_remaining: r.daysRemaining,
      band_label: r.bandLabel || null,
      extracted_value: r.extractedValue || null,
      current_stage_id: r.currentStageId || null,
      current_stage_name: r.currentStageName || null,
      on_track: r.onTrack,
      on_track_status: r.onTrackStatus || null,
      is_eligible: r.isEligible,
      exclusion_reason: r.exclusionReason || null,
      rationale: r.rationale || null,
      processed_at: r.processedAt,
    }));

    await client
      .dataset(DATASET_ID)
      .table(CALL_ACTIVATION_OBJECTIVES_TABLE_ID)
      .insert(rows);

    console.log(`BigQuery call_activation_objectives inserted: ${rows.length} rows for call ${callId}`);
  } catch (error: any) {
    console.error("Failed to insert call_activation_objectives:", error.message);
    if (error.errors) {
      console.error("BigQuery errors:", JSON.stringify(error.errors));
    }
  }
}

export async function getCallActivationObjectives(callId: string, targetProjectId?: string): Promise<any[]> {
  try {
    const key = tableInitKey(CALL_ACTIVATION_OBJECTIVES_TABLE_ID, targetProjectId);
    if (!initializedTables.has(key)) {
      await ensureCallActivationObjectivesTable(targetProjectId);
      initializedTables.add(key);
    }
    const client = getOutputBigQueryClient(targetProjectId);
    const query = `SELECT * FROM \`${client.projectId}.${DATASET_ID}.${CALL_ACTIVATION_OBJECTIVES_TABLE_ID}\` WHERE call_id = @callId ORDER BY objective_id ASC`;
    const [rows] = await client.query({ query, params: { callId } });
    return rows;
  } catch (error: any) {
    console.error("Failed to get call activation objectives:", error.message);
    return [];
  }
}

export async function ensureCallReviewsTable(targetProjectId?: string): Promise<void> {
  try {
    const dataset = await ensureDataset(targetProjectId);
    const table = dataset.table(CALL_REVIEWS_TABLE_ID);
    const [exists] = await table.exists();
    if (!exists) {
      await dataset.createTable(CALL_REVIEWS_TABLE_ID, {
        schema: {
          fields: [
            { name: "id", type: "STRING", mode: "REQUIRED" },
            { name: "source_id", type: "STRING", mode: "REQUIRED" },
            { name: "review_item_id", type: "INTEGER", mode: "REQUIRED" },
            { name: "review_item_name", type: "STRING", mode: "REQUIRED" },
            { name: "review_item_display_name", type: "STRING", mode: "NULLABLE" },
            { name: "status", type: "STRING", mode: "REQUIRED" },
            { name: "notes", type: "STRING", mode: "NULLABLE" },
            { name: "reviewed_by", type: "STRING", mode: "NULLABLE" },
            { name: "reviewed_at", type: "TIMESTAMP", mode: "REQUIRED" },
          ],
        },
      });
      console.log(`Created call_reviews table in project ${resolveProjectId(targetProjectId)}`);
    }
  } catch (error: any) {
    console.error("Failed to ensure call_reviews table:", error.message);
  }
}

export interface CallReviewEntry {
  reviewItemId: number;
  reviewItemName: string;
  reviewItemDisplayName: string;
  status: "checked" | "flagged" | "na" | "unchecked";
  notes: string;
  reviewedBy: string;
}

export async function upsertCallReviews(sourceId: string, reviews: CallReviewEntry[], targetProjectId?: string): Promise<void> {
  try {
    await ensureCallReviewsTable(targetProjectId);
    const client = getOutputBigQueryClient(targetProjectId);
    const fullTable = `\`${client.projectId}.${DATASET_ID}.${CALL_REVIEWS_TABLE_ID}\``;
    try {
      await client.query({ query: `DELETE FROM ${fullTable} WHERE source_id = @sourceId`, params: { sourceId } });
    } catch (e: any) {
      console.warn(`Could not delete existing reviews for ${sourceId}: ${e.message}`);
    }
    if (!reviews || reviews.length === 0) return;
    const now = new Date().toISOString();
    const rows = reviews.map((r) => ({
      id: `${sourceId}_${r.reviewItemId}`,
      source_id: sourceId,
      review_item_id: r.reviewItemId,
      review_item_name: r.reviewItemName,
      review_item_display_name: r.reviewItemDisplayName || null,
      status: r.status,
      notes: r.notes || null,
      reviewed_by: r.reviewedBy || null,
      reviewed_at: now,
    }));
    await client.dataset(DATASET_ID).table(CALL_REVIEWS_TABLE_ID).insert(rows);
    console.log(`BigQuery call_reviews upserted ${rows.length} items for ${sourceId}`);
  } catch (error: any) {
    console.error("Failed to upsert call reviews:", error.message);
    throw error;
  }
}

export async function getCallReviews(sourceId: string, targetProjectId?: string): Promise<any[]> {
  try {
    await ensureCallReviewsTable(targetProjectId);
    const client = getOutputBigQueryClient(targetProjectId);
    const fullTable = `\`${client.projectId}.${DATASET_ID}.${CALL_REVIEWS_TABLE_ID}\``;
    const [rows] = await client.query({
      query: `SELECT * FROM ${fullTable} WHERE source_id = @sourceId ORDER BY review_item_id`,
      params: { sourceId },
    });
    return rows;
  } catch (error: any) {
    console.error("Failed to get call reviews:", error.message);
    return [];
  }
}

export interface CallReviewMeta {
  review_status: string;
  tags: string[];
  notes: string;
}

export async function ensureCallReviewStatusesTable(targetProjectId?: string): Promise<void> {
  try {
    const dataset = await ensureDataset(targetProjectId);
    const table = dataset.table(CALL_REVIEW_STATUSES_TABLE_ID);
    const [exists] = await table.exists();
    if (!exists) {
      await dataset.createTable(CALL_REVIEW_STATUSES_TABLE_ID, {
        schema: {
          fields: [
            { name: "call_id", type: "STRING", mode: "REQUIRED" },
            { name: "review_status", type: "STRING", mode: "REQUIRED" },
            { name: "tags", type: "STRING", mode: "NULLABLE" },
            { name: "notes", type: "STRING", mode: "NULLABLE" },
            { name: "updated_at", type: "TIMESTAMP", mode: "REQUIRED" },
          ],
        },
      });
      console.log(`Created call_review_statuses table in project ${resolveProjectId(targetProjectId)}`);
    } else {
      const [metadata] = await table.getMetadata();
      const fieldNames = new Set(metadata.schema.fields.map((f: any) => f.name));
      const bqClient = getOutputBigQueryClient(targetProjectId);
      if (!fieldNames.has("tags")) {
        await bqClient.query({
          query: `ALTER TABLE \`${bqClient.projectId}.${DATASET_ID}.${CALL_REVIEW_STATUSES_TABLE_ID}\` ADD COLUMN tags STRING`,
        });
        console.log("Added tags column to call_review_statuses table.");
      }
      if (!fieldNames.has("notes")) {
        await bqClient.query({
          query: `ALTER TABLE \`${bqClient.projectId}.${DATASET_ID}.${CALL_REVIEW_STATUSES_TABLE_ID}\` ADD COLUMN notes STRING`,
        });
        console.log("Added notes column to call_review_statuses table.");
      }
    }
  } catch (error: any) {
    console.error("Failed to ensure call_review_statuses table:", error.message);
  }
}

export async function upsertCallReviewMeta(callId: string, data: { reviewStatus?: string; tags?: string[]; notes?: string }, targetProjectId?: string): Promise<void> {
  try {
    await ensureCallReviewStatusesTable(targetProjectId);
    const client = getOutputBigQueryClient(targetProjectId);
    const fullTable = `\`${client.projectId}.${DATASET_ID}.${CALL_REVIEW_STATUSES_TABLE_ID}\``;
    let existing: any = null;
    try {
      const [rows] = await client.query({
        query: `SELECT * FROM ${fullTable} WHERE call_id = @callId ORDER BY updated_at DESC LIMIT 1`,
        params: { callId },
      });
      if ((rows as any[]).length > 0) existing = (rows as any[])[0];
    } catch {}
    try {
      await client.query({ query: `DELETE FROM ${fullTable} WHERE call_id = @callId`, params: { callId } });
    } catch (e: any) {
      console.warn(`Could not delete existing review meta for ${callId}: ${e.message}`);
    }
    const now = new Date().toISOString();
    const reviewStatus = data.reviewStatus ?? existing?.review_status ?? "not_reviewed";
    let existingTags: string[] = [];
    try { if (existing?.tags) existingTags = JSON.parse(existing.tags); } catch { existingTags = []; }
    const tags = data.tags !== undefined ? data.tags : existingTags;
    const notes = data.notes !== undefined ? data.notes : (existing?.notes ?? "");
    await client.dataset(DATASET_ID).table(CALL_REVIEW_STATUSES_TABLE_ID).insert([{
      call_id: callId,
      review_status: reviewStatus,
      tags: JSON.stringify(tags),
      notes: notes,
      updated_at: now,
    }]);
    console.log(`BigQuery call_review_meta set for ${callId}: status=${reviewStatus}, tags=${tags.length}, notes=${notes.length > 0}`);
  } catch (error: any) {
    console.error("Failed to upsert call review meta:", error.message);
    throw error;
  }
}

export async function upsertCallReviewStatus(callId: string, reviewStatus: string, targetProjectId?: string): Promise<void> {
  await upsertCallReviewMeta(callId, { reviewStatus }, targetProjectId);
}

export async function getCallReviewMeta(callId: string, targetProjectId?: string): Promise<CallReviewMeta | null> {
  try {
    await ensureCallReviewStatusesTable(targetProjectId);
    const client = getOutputBigQueryClient(targetProjectId);
    const fullTable = `\`${client.projectId}.${DATASET_ID}.${CALL_REVIEW_STATUSES_TABLE_ID}\``;
    const [rows] = await client.query({
      query: `SELECT * FROM ${fullTable} WHERE call_id = @callId ORDER BY updated_at DESC LIMIT 1`,
      params: { callId },
    });
    if ((rows as any[]).length > 0) {
      const row = (rows as any[])[0];
      return {
        review_status: row.review_status,
        tags: (() => { try { return row.tags ? JSON.parse(row.tags) : []; } catch { return []; } })(),
        notes: row.notes || "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getCallReviewStatus(callId: string, targetProjectId?: string): Promise<string | null> {
  const meta = await getCallReviewMeta(callId, targetProjectId);
  return meta?.review_status ?? null;
}

export async function getCallReviewStatusesBulk(callIds: string[], targetProjectId?: string): Promise<Record<string, string>> {
  try {
    if (callIds.length === 0) return {};
    await ensureCallReviewStatusesTable(targetProjectId);
    const client = getOutputBigQueryClient(targetProjectId);
    const fullTable = `\`${client.projectId}.${DATASET_ID}.${CALL_REVIEW_STATUSES_TABLE_ID}\``;
    const [rows] = await client.query({
      query: `SELECT call_id, review_status FROM ${fullTable} WHERE call_id IN UNNEST(@callIds) QUALIFY ROW_NUMBER() OVER (PARTITION BY call_id ORDER BY updated_at DESC) = 1`,
      params: { callIds },
    });
    const result: Record<string, string> = {};
    for (const row of rows as any[]) {
      result[row.call_id] = row.review_status;
    }
    return result;
  } catch {
    return {};
  }
}

export async function getCallReviewList(limit = 200, targetProjectId?: string, obsFilter?: { name: string; value?: string }): Promise<any[]> {
  try {
    await ensureCallReviewStatusesTable(targetProjectId);
    const client = getOutputBigQueryClient(targetProjectId);
    const ciTable = `\`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\``;
    const crsTable = `\`${client.projectId}.${DATASET_ID}.${CALL_REVIEW_STATUSES_TABLE_ID}\``;
    const obsTable = `\`${client.projectId}.${DATASET_ID}.${OBSERVATIONS_TABLE_ID}\``;
    const params: Record<string, any> = { limit };
    let obsJoin = "";
    let obsWhere = "";
    if (obsFilter?.name) {
      obsJoin = `INNER JOIN ${obsTable} obs ON c.call_id = obs.call_id AND obs.observation_name = @obsName`;
      params.obsName = obsFilter.name;
      if (obsFilter.value) {
        obsWhere = `AND obs.observation_value = @obsValue`;
        params.obsValue = obsFilter.value;
      }
    }
    const query = `
      WITH latest_calls AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY call_id ORDER BY processed_at DESC) AS rn
        FROM ${ciTable}
      ),
      latest_reviews AS (
        SELECT call_id, review_status, tags, notes, updated_at,
          ROW_NUMBER() OVER (PARTITION BY call_id ORDER BY updated_at DESC) AS rn
        FROM ${crsTable}
      )
      SELECT DISTINCT
        c.call_id, c.source_id, c.source_type, c.call_date, c.processed_at,
        c.summary, c.status, c.client, c.pathway, c.context_values,
        c.transcript_length, c.error_message,
        r.review_status, r.tags, r.notes, r.updated_at AS review_updated_at
      FROM latest_calls c
      LEFT JOIN latest_reviews r ON c.call_id = r.call_id AND r.rn = 1
      ${obsJoin}
      WHERE c.rn = 1 ${obsWhere}
      ORDER BY c.processed_at DESC
      LIMIT @limit
    `;
    const [rows] = await client.query({ query, params, location: "US" });
    return (rows as any[]).map(row => {
      let parsedTags: string[] = [];
      try { if (row.tags) parsedTags = JSON.parse(row.tags); } catch {}
      let contextValues: Record<string, string> | null = null;
      if (row.context_values) {
        try {
          const parsed = JSON.parse(row.context_values);
          if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) contextValues = parsed;
        } catch {}
      }
      return {
        call_id: row.call_id,
        source_id: row.source_id,
        source_type: row.source_type,
        call_date: extractTimestamp(row.call_date),
        processed_at: extractTimestamp(row.processed_at),
        summary: row.summary,
        status: row.status,
        client: row.client || null,
        pathway: row.pathway || null,
        context_values: contextValues,
        transcript_length: row.transcript_length,
        error_message: row.error_message,
        review_status: row.review_status || "not_reviewed",
        tags: parsedTags,
        notes: row.notes || "",
        review_updated_at: row.review_updated_at ? extractTimestamp(row.review_updated_at) : null,
      };
    });
  } catch (error: any) {
    console.error("Failed to get call review list:", error.message);
    throw error;
  }
}

export async function ensureKnownContextTable(targetProjectId?: string): Promise<void> {
  try {
    const dataset = await ensureDataset(targetProjectId);
    const table = dataset.table(KNOWN_CONTEXT_TABLE_ID);
    const [exists] = await table.exists();
    if (!exists) {
      await dataset.createTable(KNOWN_CONTEXT_TABLE_ID, {
        schema: {
          fields: [
            { name: "care_flow_id", type: "STRING", mode: "REQUIRED" },
            { name: "parameter_name", type: "STRING", mode: "REQUIRED" },
            { name: "display_name", type: "STRING", mode: "NULLABLE" },
            { name: "value_type", type: "STRING", mode: "REQUIRED" },
            { name: "value", type: "STRING", mode: "NULLABLE" },
            { name: "active_ind", type: "BOOLEAN", mode: "REQUIRED" },
            { name: "created_at", type: "TIMESTAMP", mode: "REQUIRED" },
            { name: "updated_at", type: "TIMESTAMP", mode: "NULLABLE" },
          ],
        },
      });
      console.log(`Created known_context_details table in project ${resolveProjectId(targetProjectId)}`);
    }
  } catch (error: any) {
    console.error("Failed to ensure known_context_details table:", error.message);
  }
}

export interface KnownContextRow {
  care_flow_id: string;
  parameter_name: string;
  display_name?: string;
  value_type: "text" | "enum" | "boolean";
  value: string | null;
  active_ind?: boolean;
}

export async function insertKnownContextRows(rows: KnownContextRow[], targetProjectId?: string): Promise<void> {
  try {
    if (!rows || !Array.isArray(rows) || rows.length === 0) return;
    await ensureKnownContextTable(targetProjectId);
    const client = getOutputBigQueryClient(targetProjectId);
    const now = new Date().toISOString();
    const insertRows = rows.map((r) => ({
      care_flow_id: r.care_flow_id,
      parameter_name: r.parameter_name,
      display_name: r.display_name || r.parameter_name,
      value_type: r.value_type,
      value: r.value,
      active_ind: r.active_ind !== undefined ? r.active_ind : true,
      created_at: now,
      updated_at: null,
    }));
    await client
      .dataset(DATASET_ID)
      .table(KNOWN_CONTEXT_TABLE_ID)
      .insert(insertRows);
    console.log(`BigQuery known_context_details inserted: ${insertRows.length} rows`);
  } catch (error: any) {
    console.error("Failed to insert known_context_details:", error.message);
    if (error.errors) {
      console.error("BigQuery errors:", JSON.stringify(error.errors));
    }
  }
}

export async function getKnownContextForCareFlow(careFlowId: string, activeOnly = true, targetProjectId?: string): Promise<any[]> {
  try {
    const client = getOutputBigQueryClient(targetProjectId);
    let query = `SELECT * FROM \`${client.projectId}.${DATASET_ID}.${KNOWN_CONTEXT_TABLE_ID}\` WHERE care_flow_id = @careFlowId`;
    if (activeOnly) {
      query += ` AND active_ind = TRUE`;
    }
    query += ` ORDER BY parameter_name`;
    const [rows] = await client.query({ query, params: { careFlowId } });
    return rows;
  } catch (error: any) {
    console.error("Failed to get known context details:", error.message);
    return [];
  }
}

function extractTimestamp(val: { value: string } | string | null | undefined): string | null {
  if (!val) return null;
  if (typeof val === "object" && "value" in val) return val.value;
  return String(val);
}

export async function getCallInfoList(limit = 100, targetProjectId?: string, obsFilter?: { name: string; value?: string }): Promise<any[]> {
  const client = getOutputBigQueryClient(targetProjectId);
  const obsTable = `\`${client.projectId}.${DATASET_ID}.${OBSERVATIONS_TABLE_ID}\``;
  const ciTable = `\`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\``;
  const params: Record<string, any> = { limit };
  let obsJoin = "";
  let obsWhere = "";
  if (obsFilter?.name) {
    obsJoin = `INNER JOIN ${obsTable} obs ON ci.call_id = obs.call_id AND obs.observation_name = @obsName`;
    params.obsName = obsFilter.name;
    if (obsFilter.value) {
      obsWhere = `AND obs.observation_value = @obsValue`;
      params.obsValue = obsFilter.value;
    }
  }
  const query = `
    SELECT DISTINCT ci.*
    FROM ${ciTable} ci
    ${obsJoin}
    WHERE 1=1 ${obsWhere}
    ORDER BY ci.processed_at DESC
    LIMIT @limit
  `;
  let rows: any[];
  try {
    [rows] = await client.query({ query, params, location: "US" });
  } catch (err: any) {
    if (err.message?.includes("Not found: Table")) return [];
    throw err;
  }
  const knownNonContext = new Set(["source_id", "source_type", "source_text", "care_flow_id", "processed_datetime", "context", "batch_id", "bland_call_id", "client", "pathway"]);
  return (rows as CallInfoRow[]).map(row => {
    let contextValues: Record<string, string> | null = null;
    if (row.context_values) {
      try {
        const parsed = JSON.parse(row.context_values);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) contextValues = parsed;
      } catch {}
    }
    if (!contextValues && row.request_body) {
      try {
        const rb = JSON.parse(row.request_body);
        const extracted: Record<string, string> = {};
        for (const [k, v] of Object.entries(rb)) {
          if (!knownNonContext.has(k) && v !== undefined && v !== null && v !== "") {
            extracted[k] = String(v);
          }
        }
        if (Object.keys(extracted).length > 0) contextValues = extracted;
      } catch {}
    }
    return {
      call_id: row.call_id,
      care_flow_id: row.care_flow_id,
      processed_datetime: extractTimestamp(row.processed_datetime),
      call_date: extractTimestamp(row.call_date),
      source_type: row.source_type,
      source_id: row.source_id,
      processed_at: extractTimestamp(row.processed_at),
      processing_time_ms: row.processing_time_ms,
      prompt_version: row.prompt_version,
      prompt_version_date: extractTimestamp(row.prompt_version_date),
      context_values: contextValues,
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
      client: row.client || null,
      pathway: row.pathway || null,
    };
  });
}

export async function getCallStatsByDay(days = 30, targetProjectId?: string): Promise<any[]> {
  const client = getOutputBigQueryClient(targetProjectId);
  const query = `
    SELECT
      DATE(processed_at, 'America/New_York') as date,
      IFNULL(client, 'Unknown') as client,
      IFNULL(pathway, 'Unknown') as pathway,
      IFNULL(source_type, 'unknown') as source_type,
      COUNT(*) as call_count,
      COUNTIF(status = 'success') as success_count,
      COUNTIF(status = 'error') as error_count,
      ROUND(AVG(processing_time_ms), 0) as avg_processing_ms,
      SUM(total_tokens) as total_tokens,
      ROUND(SUM(estimated_cost), 4) as total_cost
    FROM \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\`
    WHERE DATE(processed_at, 'America/New_York') >= DATE_SUB(CURRENT_DATE('America/New_York'), INTERVAL @days DAY)
    GROUP BY date, client, pathway, source_type
    ORDER BY date DESC, client, pathway, source_type
  `;
  const [rows] = await client.query({ query, params: { days }, location: "US" });
  return (rows as any[]).map(row => ({
    date: row.date?.value || row.date,
    client: row.client,
    pathway: row.pathway,
    source_type: row.source_type,
    call_count: row.call_count,
    success_count: row.success_count,
    error_count: row.error_count,
    avg_processing_ms: row.avg_processing_ms,
    total_tokens: row.total_tokens,
    total_cost: row.total_cost,
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
  bland_created_at: string | null;
}

async function ensureBatchProcessingTable(targetProjectId?: string): Promise<void> {
  const client = getOutputBigQueryClient(targetProjectId);
  const dataset = await ensureDataset(targetProjectId);
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
        { name: "context_values", type: "STRING", mode: "NULLABLE" },
      ],
    },
  });
  console.log(`Created BigQuery table: ${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID} in project ${resolveProjectId(targetProjectId)}`);
}

async function migrateBatchProcessingColumns(targetProjectId?: string): Promise<void> {
  try {
    const client = getOutputBigQueryClient(targetProjectId);
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
    const hasContextValues = fields.some((f: any) => f.name === "context_values");
    if (!hasContextValues) {
      await client.query({
        query: `ALTER TABLE \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\` ADD COLUMN context_values STRING`,
        location: "US",
      });
      console.log("Added context_values column to batch_processing table.");
    }
    const hasBlandCreatedAt = fields.some((f: any) => f.name === "bland_created_at");
    if (!hasBlandCreatedAt) {
      await client.query({
        query: `ALTER TABLE \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\` ADD COLUMN bland_created_at TIMESTAMP`,
        location: "US",
      });
      console.log("Added bland_created_at column to batch_processing table.");
    }
  } catch (err: any) {
    console.error("Migration check for batch_processing columns:", err.message);
  }
}

export async function initializeBatchTable(targetProjectId?: string): Promise<void> {
  try {
    const key = tableInitKey(BATCH_PROCESSING_TABLE_ID, targetProjectId);
    if (!initializedTables.has(key)) {
      await ensureBatchProcessingTable(targetProjectId);
      initializedTables.add(key);
      console.log(`BigQuery batch_processing table ready in project ${resolveProjectId(targetProjectId)}.`);
    }
    await migrateBatchProcessingColumns(targetProjectId);
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
}, targetProjectId?: string): Promise<any[]> {
  const client = getOutputBigQueryClient(targetProjectId);
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

  try {
    const [rows] = await client.query({ query, params, location: "US" });
    return rows as any[];
  } catch (err: any) {
    if (err.message?.includes("Not found: Table") || err.message?.includes("Not found: Dataset")) return [];
    throw err;
  }
}

export async function getDistinctTags(targetProjectId?: string): Promise<string[]> {
  const client = getOutputBigQueryClient(targetProjectId);
  const query = `
    SELECT DISTINCT tag
    FROM \`${client.projectId}.Bland.tags\`
    WHERE tag IS NOT NULL AND tag != ''
    ORDER BY tag
  `;
  try {
    const [rows] = await client.query({ query, location: "US" });
    return (rows as any[]).map(r => r.tag);
  } catch (err: any) {
    if (err.message?.includes("Not found: Table") || err.message?.includes("Not found: Dataset")) return [];
    throw err;
  }
}

export async function fetchAwellContextForCareFlows(
  careFlowIds: string[],
  contextParams: { name: string; awellDataPointKey: string; awellMappingType?: string; awellPatientProfileField?: string }[],
  targetProjectId?: string,
): Promise<Record<string, Record<string, string>>> {
  if (!careFlowIds.length || !contextParams.length) return {};

  const dataPointParams = contextParams.filter(p =>
    (p.awellMappingType === "data_point" || (!p.awellMappingType && p.awellDataPointKey)) &&
    p.awellDataPointKey && p.awellDataPointKey.trim().length > 0
  );
  const profileParams = contextParams.filter(p =>
    p.awellMappingType === "patient_profile" &&
    p.awellPatientProfileField && p.awellPatientProfileField.trim().length > 0
  );

  if (dataPointParams.length === 0 && profileParams.length === 0) return {};

  const client = getOutputBigQueryClient(targetProjectId);
  const result: Record<string, Record<string, string>> = {};

  for (const param of dataPointParams) {
    try {
      const query = `
        SELECT
          dp.care_flow_id,
          REGEXP_REPLACE(dp.value_raw, r'^"(.*)"$', r'\\1') AS value,
          dp.date
        FROM \`${client.projectId}.encompass_health.data_points_realtime\` dp
        JOIN \`${client.projectId}.encompass_health.data_point_definitions_realtime\` df
          ON df.definition_id = dp.definition_id
        WHERE df.key = @dataPointKey
          AND dp.care_flow_id IN UNNEST(@careFlowIds)
        QUALIFY ROW_NUMBER() OVER (PARTITION BY dp.care_flow_id ORDER BY dp.date DESC) = 1
      `;
      const [rows] = await client.query({
        query,
        params: { dataPointKey: param.awellDataPointKey, careFlowIds },
        location: "US",
      });

      for (const row of rows as any[]) {
        if (!result[row.care_flow_id]) result[row.care_flow_id] = {};
        result[row.care_flow_id][param.name] = row.value || "";
      }
    } catch (err: any) {
      console.error(`Failed to fetch Awell data point '${param.awellDataPointKey}':`, err.message);
    }
  }

  if (profileParams.length > 0) {
    try {
      const validFields = new Set([
        "first_name", "last_name", "name", "email", "birth_date", "sex",
        "preferred_language", "national_registry_number", "patient_code",
        "phone", "mobile_phone", "address_street", "address_city",
        "address_zip", "address_state", "address_country"
      ]);
      const requestedFields = profileParams
        .map(p => p.awellPatientProfileField!)
        .filter(f => validFields.has(f));

      if (requestedFields.length > 0) {
        const fieldSelects = requestedFields.map(f => `pp.${f}`).join(", ");
        const query = `
          SELECT cf.id AS care_flow_id, ${fieldSelects}
          FROM \`${client.projectId}.encompass_health.care_flows_realtime\` cf
          JOIN \`${client.projectId}.encompass_health.patients_realtime\` p ON p.id = cf.patient_id
          JOIN \`${client.projectId}.encompass_health.patient_profiles_realtime\` pp ON pp.id = p.profile_id
          WHERE cf.id IN UNNEST(@careFlowIds)
        `;
        const [rows] = await client.query({
          query,
          params: { careFlowIds },
          location: "US",
        });

        for (const row of rows as any[]) {
          if (!result[row.care_flow_id]) result[row.care_flow_id] = {};
          for (const param of profileParams) {
            const field = param.awellPatientProfileField!;
            if (row[field] !== undefined && row[field] !== null) {
              result[row.care_flow_id][param.name] = String(row[field]);
            }
          }
        }
      }
    } catch (err: any) {
      console.error(`Failed to fetch Awell patient profile fields:`, err.message);
    }
  }

  return result;
}

export async function loadBlandCallsToBatch(
  callIds: string[],
  batchLabel: string | null,
  contextByCareFow?: Record<string, Record<string, string>>,
  targetProjectId?: string,
): Promise<{ loaded: number; skipped: number; skippedAlreadyInBatch: number; skippedNoTranscript: number; targetProjectId: string }> {
  const key = tableInitKey(BATCH_PROCESSING_TABLE_ID, targetProjectId);
  if (!initializedTables.has(key)) {
    await ensureBatchProcessingTable(targetProjectId);
    initializedTables.add(key);
  }

  const client = getOutputBigQueryClient(targetProjectId);
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  console.log(`[batch/load] project=${client.projectId} requested=${callIds.length} sample=${callIds.slice(0,3).join(",")}`);

  const existingQuery = `
    SELECT bland_call_id FROM \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    WHERE bland_call_id IN UNNEST(@callIds) AND status IN ('pending', 'processing', 'completed')
  `;
  const [existingRows] = await client.query({ query: existingQuery, params: { callIds }, location: "US" });
  const existingIds = new Set((existingRows as any[]).map(r => r.bland_call_id));
  console.log(`[batch/load] existing in batch_processing: ${existingIds.size}`);

  const newCallIds = callIds.filter(id => !existingIds.has(id));
  if (newCallIds.length === 0) {
    return { loaded: 0, skipped: callIds.length, skippedAlreadyInBatch: existingIds.size, skippedNoTranscript: 0, targetProjectId: client.projectId };
  }

  const transcriptQuery = `
    SELECT c.call_id, c.concatenated_transcript, c.status,
           v.variable_value as care_flow_id,
           c.created_at as bland_created_at
    FROM \`${client.projectId}.Bland.calls\` c
    LEFT JOIN \`${client.projectId}.Bland.variables\` v
      ON c.call_id = v.call_id AND v.variable_name = 'awell_care_flow_id'
    WHERE c.call_id IN UNNEST(@callIds)
    AND c.concatenated_transcript IS NOT NULL
    AND LENGTH(TRIM(c.concatenated_transcript)) > 0
  `;
  const [transcriptRows] = await client.query({ query: transcriptQuery, params: { callIds: newCallIds }, location: "US" });
  console.log(`[batch/load] transcript+care_flow_id rows found: ${(transcriptRows as any[]).length} of ${newCallIds.length} new`);

  if ((transcriptRows as any[]).length === 0) {
    return { loaded: 0, skipped: callIds.length, skippedAlreadyInBatch: existingIds.size, skippedNoTranscript: newCallIds.length, targetProjectId: client.projectId };
  }

  const validRows = (transcriptRows as any[]);
  const now = new Date().toISOString();

  const valuesClauses = validRows.map((_, i) =>
    `(@batchId, @callId_${i}, @transcript_${i}, 'bland_call', @now, 'pending', CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS TIMESTAMP), @batchLabel, @careFlowId_${i}, @contextValues_${i}, @blandCreatedAt_${i})`
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
    const cfId = row.care_flow_id;
    const ctx = cfId && contextByCareFow && contextByCareFow[cfId] ? contextByCareFow[cfId] : null;
    params[`contextValues_${i}`] = ctx ? JSON.stringify(ctx) : null;
    const blandTs = row.bland_created_at?.value || row.bland_created_at || null;
    params[`blandCreatedAt_${i}`] = blandTs ? new Date(blandTs).toISOString() : null;
    types[`callId_${i}`] = "STRING";
    types[`transcript_${i}`] = "STRING";
    types[`careFlowId_${i}`] = "STRING";
    types[`contextValues_${i}`] = "STRING";
    types[`blandCreatedAt_${i}`] = "STRING";
  });

  const insertQuery = `
    INSERT INTO \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    (batch_id, bland_call_id, transcript, source_type, created_at, status, error_message, result_call_id, processed_at, batch_label, care_flow_id, context_values, bland_created_at)
    VALUES ${valuesClauses}
  `;

  await client.query({ query: insertQuery, params, types, location: "US" });

  const totalSkipped = callIds.length - validRows.length;
  const noTranscript = newCallIds.length - validRows.length;
  console.log(`[batch/load] inserted ${validRows.length} into batch ${batchId}; alreadyInBatch=${existingIds.size} noTranscript=${noTranscript}`);
  return { loaded: validRows.length, skipped: totalSkipped, skippedAlreadyInBatch: existingIds.size, skippedNoTranscript: noTranscript, targetProjectId: client.projectId };
}

export async function getBatchItems(filters?: {
  status?: string;
  batchLabel?: string;
  limit?: number;
}, targetProjectId?: string): Promise<any[]> {
  const client = getOutputBigQueryClient(targetProjectId);
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

  try {
    const [rows] = await client.query({ query, params, location: "US" });
    return (rows as any[]).map(row => ({
      ...row,
      created_at: extractTimestamp(row.created_at),
      processed_at: extractTimestamp(row.processed_at),
    }));
  } catch (err: any) {
    if (err.message?.includes("Not found: Table")) return [];
    throw err;
  }
}

export async function getBatchSummary(targetProjectId?: string): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  batches: { batch_id: string; batch_label: string | null; count: number; status_counts: Record<string, number> }[];
}> {
  const client = getOutputBigQueryClient(targetProjectId);

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

export async function getPendingBatchItems(limit = 10, batchId?: string, targetProjectId?: string): Promise<any[]> {
  const client = getOutputBigQueryClient(targetProjectId);
  const batchFilter = batchId ? "AND batch_id = @batchId" : "";
  const query = `
    SELECT batch_id, bland_call_id, transcript, source_type, batch_label, care_flow_id, context_values, bland_created_at
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

export async function claimPendingBatchItems(blandCallIds: string[], targetProjectId?: string): Promise<number> {
  if (blandCallIds.length === 0) return 0;
  const client = getOutputBigQueryClient(targetProjectId);
  const idList = blandCallIds.map(id => `'${id.replace(/'/g, "\\'")}'`).join(",");
  const query = `
    UPDATE \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    SET status = 'processing'
    WHERE bland_call_id IN (${idList}) AND status = 'pending'
  `;
  const result = await client.query({ query, location: "US" });
  const metadata = (result as any)[2] || {};
  const affected = Number(metadata?.dmlStats?.updatedRowCount || metadata?.numDmlAffectedRows || 0);
  return affected;
}

const VALID_BATCH_STATUSES = new Set(["pending", "processing", "completed", "failed"]);

export async function updateBatchItemStatus(
  blandCallId: string,
  status: string,
  resultCallId?: string,
  errorMessage?: string,
  targetProjectId?: string,
): Promise<number> {
  if (!VALID_BATCH_STATUSES.has(status)) {
    throw new Error(`Invalid batch status: ${status}`);
  }

  const client = getOutputBigQueryClient(targetProjectId);
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

  const result = await client.query({ query, params, types, location: "US" });
  const metadata = (result as any)[2] || {};
  const affected = Number(metadata?.dmlStats?.updatedRowCount || metadata?.numDmlAffectedRows || 0);
  return affected;
}

export async function bulkUpdateBatchItemStatus(
  callIds: string[],
  status: string,
  targetProjectId?: string,
): Promise<number> {
  if (!VALID_BATCH_STATUSES.has(status) || callIds.length === 0) return 0;
  const client = getOutputBigQueryClient(targetProjectId);
  const fromStatus = status === "processing" ? "'pending'" : "'pending', 'processing'";
  const idList = callIds.map(id => `'${id.replace(/'/g, "\\'")}'`).join(",");
  const setProcessedAt = (status === "completed" || status === "failed")
    ? ", processed_at = CURRENT_TIMESTAMP()" : "";
  const query = `
    UPDATE \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    SET status = '${status}' ${setProcessedAt}
    WHERE bland_call_id IN (${idList}) AND status IN (${fromStatus})
  `;
  const result = await client.query({ query, location: "US" });
  const metadata = (result as any)[2] || {};
  return Number(metadata?.dmlStats?.updatedRowCount || metadata?.numDmlAffectedRows || 0);
}

export async function bulkUpdateBatchResults(
  results: Array<{ callId: string; success: boolean; resultCallId?: string; error?: string }>,
  targetProjectId?: string,
): Promise<void> {
  if (results.length === 0) return;
  const client = getOutputBigQueryClient(targetProjectId);
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (succeeded.length > 0) {
    const idList = succeeded.map(r => `'${r.callId.replace(/'/g, "\\'")}'`).join(",");
    const whenClauses = succeeded.map(r =>
      `WHEN bland_call_id = '${r.callId.replace(/'/g, "\\'")}' THEN '${(r.resultCallId || r.callId).replace(/'/g, "\\'")}'`
    ).join("\n        ");
    const query = `
      UPDATE \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
      SET status = 'completed',
          result_call_id = CASE ${whenClauses} END,
          processed_at = CURRENT_TIMESTAMP()
      WHERE bland_call_id IN (${idList}) AND status IN ('pending', 'processing')
    `;
    await client.query({ query, location: "US" });
  }

  if (failed.length > 0) {
    const idList = failed.map(r => `'${r.callId.replace(/'/g, "\\'")}'`).join(",");
    const whenClauses = failed.map(r =>
      `WHEN bland_call_id = '${r.callId.replace(/'/g, "\\'")}' THEN '${(r.error || "Unknown error").substring(0, 1000).replace(/'/g, "\\'")}'`
    ).join("\n        ");
    const query = `
      UPDATE \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
      SET status = 'failed',
          error_message = CASE ${whenClauses} END,
          processed_at = CURRENT_TIMESTAMP()
      WHERE bland_call_id IN (${idList}) AND status IN ('pending', 'processing')
    `;
    await client.query({ query, location: "US" });
  }
}

export async function recreateBatch(oldBatchId: string, targetProjectId?: string): Promise<{ newBatchId: string; count: number }> {
  const client = getOutputBigQueryClient(targetProjectId);
  const readQuery = `
    SELECT bland_call_id, transcript, source_type, batch_label, care_flow_id, bland_created_at
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
    `(@newBatchId, @callId_${i}, @transcript_${i}, 'bland_call', @now, 'pending', CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS TIMESTAMP), @batchLabel_${i}, @careFlowId_${i}, @blandCreatedAt_${i})`
  ).join(",\n    ");

  const params: Record<string, any> = { newBatchId, now };
  const types: Record<string, string> = { newBatchId: "STRING", now: "STRING" };

  items.forEach((item, i) => {
    params[`callId_${i}`] = item.bland_call_id;
    params[`transcript_${i}`] = item.transcript;
    params[`batchLabel_${i}`] = item.batch_label || null;
    params[`careFlowId_${i}`] = item.care_flow_id || null;
    const blandTs = item.bland_created_at?.value || item.bland_created_at || null;
    params[`blandCreatedAt_${i}`] = blandTs ? new Date(blandTs).toISOString() : null;
    types[`callId_${i}`] = "STRING";
    types[`transcript_${i}`] = "STRING";
    types[`batchLabel_${i}`] = "STRING";
    types[`careFlowId_${i}`] = "STRING";
    types[`blandCreatedAt_${i}`] = "STRING";
  });

  const insertQuery = `
    INSERT INTO \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    (batch_id, bland_call_id, transcript, source_type, created_at, status, error_message, result_call_id, processed_at, batch_label, care_flow_id, bland_created_at)
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

export async function deletePendingBatchItems(targetProjectId?: string): Promise<number> {
  const client = getOutputBigQueryClient(targetProjectId);
  const query = `
    DELETE FROM \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    WHERE status = 'pending'
  `;
  const result = await client.query({ query, location: "US" });
  const meta = (result as any)[2] || {};
  return Number(meta?.dmlStats?.deletedRowCount || meta?.numDmlAffectedRows || 0);
}

export async function resetFailedBatchItems(batchId?: string, targetProjectId?: string): Promise<number> {
  const client = getOutputBigQueryClient(targetProjectId);
  const condition = batchId ? `AND batch_id = @batchId` : "";
  const query = `
    UPDATE \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
    SET status = 'pending', error_message = NULL, processed_at = NULL, result_call_id = NULL
    WHERE status IN ('failed', 'processing') ${condition}
  `;
  const params: Record<string, any> = {};
  if (batchId) params.batchId = batchId;

  const retryResult = await client.query({ query, params, location: "US" });
  const retryMeta = (retryResult as any)[2] || {};
  return Number(retryMeta?.dmlStats?.updatedRowCount || retryMeta?.numDmlAffectedRows || 0);
}

export async function getCallProcessingRuns(callId: string, targetProjectId?: string): Promise<{ run_number: number; processed_at: string; status: string; processing_time_ms: number; total_tokens: number; estimated_cost: number; prompt_version: string | null }[]> {
  const client = getOutputBigQueryClient(targetProjectId);
  const query = `
    SELECT
      ROW_NUMBER() OVER (ORDER BY processed_at ASC) AS run_number,
      processed_at, status, processing_time_ms, total_tokens, estimated_cost, prompt_version
    FROM \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\`
    WHERE call_id = @callId
    ORDER BY processed_at ASC
  `;
  const [rows] = await client.query({ query, params: { callId }, location: "US" });
  return (rows as any[]).map(r => ({
    run_number: Number(r.run_number),
    processed_at: extractTimestamp(r.processed_at),
    status: r.status,
    processing_time_ms: r.processing_time_ms,
    total_tokens: r.total_tokens,
    estimated_cost: r.estimated_cost,
    prompt_version: r.prompt_version || null,
  }));
}

export async function getCallDetail(callId: string, runIndex?: number, targetProjectId?: string): Promise<{ callInfo: any | null; observations: CallObservationRow[]; qaPairs: any[]; barriers: any[]; callQA: any[]; totalRuns: number; currentRun: number }> {
  const client = getOutputBigQueryClient(targetProjectId);

  const allRunsQuery = `
    SELECT *, ROW_NUMBER() OVER (ORDER BY processed_at ASC) AS run_number
    FROM \`${client.projectId}.${DATASET_ID}.${CALL_INFO_TABLE_ID}\`
    WHERE call_id = @callId
    ORDER BY processed_at ASC
  `;
  const [allRunRows] = await client.query({ query: allRunsQuery, params: { callId }, location: "US" });
  const allRuns = allRunRows as any[];
  const totalRuns = allRuns.length;

  const targetRun = runIndex !== undefined && runIndex >= 0 && runIndex < totalRuns ? runIndex : totalRuns - 1;
  const row = totalRuns > 0 ? allRuns[targetRun] as CallInfoRow : null;
  const currentRun = targetRun + 1;

  const obsQuery = `
    SELECT * EXCEPT(rn) FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY call_id, observation_name ORDER BY observation_name) AS rn
      FROM \`${client.projectId}.${DATASET_ID}.${OBSERVATIONS_TABLE_ID}\`
      WHERE call_id = @callId
    ) WHERE rn = 1
  `;
  const [obsRows] = await client.query({ query: obsQuery, params: { callId }, location: "US" });

  const callInfo = row ? (() => {
    const knownNonContext = new Set(["source_id", "source_type", "source_text", "care_flow_id", "processed_datetime", "context", "batch_id", "bland_call_id", "client", "pathway"]);
    let contextValues: Record<string, string> | null = null;
    if (row.context_values) {
      try {
        const parsed = JSON.parse(row.context_values);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) contextValues = parsed;
      } catch {}
    }
    if (!contextValues && row.request_body) {
      try {
        const rb = JSON.parse(row.request_body);
        const extracted: Record<string, string> = {};
        for (const [k, v] of Object.entries(rb)) {
          if (!knownNonContext.has(k) && v !== undefined && v !== null && v !== "") {
            extracted[k] = String(v);
          }
        }
        if (Object.keys(extracted).length > 0) contextValues = extracted;
      } catch {}
    }
    let responseJsonParsed: any = null;
    if ((row as any).response_json) {
      try { responseJsonParsed = JSON.parse((row as any).response_json); } catch { responseJsonParsed = (row as any).response_json; }
    }
    return {
      call_id: row.call_id,
      processing_id: (row as any).processing_id || null,
      care_flow_id: row.care_flow_id,
      processed_datetime: extractTimestamp(row.processed_datetime),
      call_date: extractTimestamp(row.call_date),
      source_type: row.source_type,
      source_id: row.source_id,
      processed_at: extractTimestamp(row.processed_at),
      processing_time_ms: row.processing_time_ms,
      prompt_version: row.prompt_version,
      prompt_version_date: extractTimestamp(row.prompt_version_date),
      context_values: contextValues,
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
      request_headers: row.request_headers ? JSON.parse(row.request_headers) : null,
      response_json: responseJsonParsed,
      client: row.client || null,
      pathway: row.pathway || null,
    };
  })() : null;

  const qaQuery = `
    SELECT * EXCEPT(rn) FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY call_id, sequence_number ORDER BY sequence_number) AS rn
      FROM \`${client.projectId}.${DATASET_ID}.${QA_PAIRS_TABLE_ID}\`
      WHERE call_id = @callId
    ) WHERE rn = 1
    ORDER BY sequence_number ASC
  `;
  let qaRows: any[] = [];
  try {
    const [rows] = await client.query({ query: qaQuery, params: { callId }, location: "US" });
    qaRows = rows;
  } catch (err: any) {
    console.warn("Q&A pairs table not found or query failed:", err.message);
  }

  let barrierRows: any[] = [];
  try {
    const barriersQuery = `
      SELECT DISTINCT *
      FROM \`${client.projectId}.${DATASET_ID}.${BARRIERS_TABLE_ID}\`
      WHERE call_id = @callId
    `;
    const [bRows] = await client.query({ query: barriersQuery, params: { callId }, location: "US" });
    barrierRows = bRows;
  } catch (err: any) {
    console.warn("Barriers table not found or query failed:", err.message);
  }

  let callQARows: any[] = [];
  try {
    const callQAQuery = `
      SELECT * EXCEPT(rn) FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY call_id, name ORDER BY name) AS rn
        FROM \`${client.projectId}.${DATASET_ID}.${CALL_QA_TABLE_ID}\`
        WHERE call_id = @callId
      ) WHERE rn = 1
    `;
    const [cqRows] = await client.query({ query: callQAQuery, params: { callId }, location: "US" });
    callQARows = cqRows;
  } catch (err: any) {
    console.warn("Call QA results table not found or query failed:", err.message);
  }

  let transcript: string | null = null;
  try {
    const blandCallId = callId.startsWith("batch_") ? callId.replace("batch_", "") : callId;
    const batchTranscriptQuery = `
      SELECT transcript
      FROM \`${client.projectId}.${DATASET_ID}.${BATCH_PROCESSING_TABLE_ID}\`
      WHERE bland_call_id = @blandCallId
      LIMIT 1
    `;
    const [btRows] = await client.query({ query: batchTranscriptQuery, params: { blandCallId }, location: "US" });
    if ((btRows as any[]).length > 0 && (btRows as any[])[0].transcript) {
      transcript = (btRows as any[])[0].transcript;
    }
    if (!transcript) {
      const blandTranscriptQuery = `
        SELECT concatenated_transcript
        FROM \`${client.projectId}.Bland.calls\`
        WHERE call_id = @blandCallId
        LIMIT 1
      `;
      const [blRows] = await client.query({ query: blandTranscriptQuery, params: { blandCallId }, location: "US" });
      if ((blRows as any[]).length > 0 && (blRows as any[])[0].concatenated_transcript) {
        transcript = (blRows as any[])[0].concatenated_transcript;
      }
    }
  } catch (err: any) {
    console.warn("Transcript fetch failed:", err.message);
  }

  let disposition: any = null;
  try {
    const dispQuery = `
      SELECT *
      FROM \`${client.projectId}.${DATASET_ID}.${CALL_DISPOSITIONS_TABLE_ID}\`
      WHERE call_id = @callId
      LIMIT 1
    `;
    const [dRows] = await client.query({ query: dispQuery, params: { callId }, location: "US" });
    if (dRows.length > 0) disposition = dRows[0];
  } catch (err: any) {
    console.warn("Disposition fetch failed:", err.message);
  }

  let reviewStatus: string | null = null;
  let reviewTags: string[] = [];
  let reviewNotes: string = "";
  try {
    const meta = await getCallReviewMeta(callId, targetProjectId);
    if (meta) {
      reviewStatus = meta.review_status;
      reviewTags = meta.tags;
      reviewNotes = meta.notes;
    }
  } catch (err: any) {
    console.warn("Review meta fetch failed:", err.message);
  }

  return { callInfo, observations: obsRows as CallObservationRow[], qaPairs: qaRows, barriers: barrierRows, callQA: callQARows, disposition, transcript, totalRuns, currentRun, reviewStatus, reviewTags, reviewNotes };
}
