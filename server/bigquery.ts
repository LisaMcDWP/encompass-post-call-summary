import { BigQuery } from "@google-cloud/bigquery";

const DATASET_ID = "call_information";
const TABLE_ID = "api_logs";

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
          { name: "status", type: "STRING", mode: "REQUIRED" },
          { name: "error_message", type: "STRING", mode: "NULLABLE" },
        ],
      },
    });
    console.log(`Created BigQuery table: ${DATASET_ID}.${TABLE_ID}`);
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
