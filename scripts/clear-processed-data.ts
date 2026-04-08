import { BigQuery } from "@google-cloud/bigquery";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "encompass-476415";
const DATASET_ID = "call_information";

const TABLES_TO_CLEAR = [
  "call_info",
  "call_observations",
  "call_qa_pairs",
  "barriers",
  "call_qa_results",
  "batch_processing",
  "known_context_details",
];

const CONFIG_TABLES = [
  "client_pathway",
  "observations",
  "context_parameters",
  "call_qa_prompts",
  "settings",
];

async function clearProcessedData(dryRun: boolean) {
  const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
  let client: BigQuery;

  if (serviceAccountKey) {
    const credentials = JSON.parse(serviceAccountKey);
    client = new BigQuery({ projectId: PROJECT_ID, credentials });
  } else {
    client = new BigQuery({ projectId: PROJECT_ID });
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(dryRun ? "  DRY RUN — no data will be deleted" : "  LIVE RUN — data WILL be deleted");
  console.log(`${"=".repeat(60)}\n`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Dataset: ${DATASET_ID}\n`);

  console.log("Config tables (NOT touched):");
  for (const t of CONFIG_TABLES) {
    console.log(`  ✓ ${t} — SAFE`);
  }
  console.log("");

  console.log("Processed data tables to clear:");
  for (const table of TABLES_TO_CLEAR) {
    try {
      const [exists] = await client.dataset(DATASET_ID).table(table).exists();
      if (!exists) {
        console.log(`  ⊘ ${table} — does not exist, skipping`);
        continue;
      }

      const countQuery = `SELECT COUNT(*) as cnt FROM \`${PROJECT_ID}.${DATASET_ID}.${table}\``;
      const [countRows] = await client.query({ query: countQuery });
      const rowCount = countRows[0]?.cnt || 0;

      if (rowCount === 0) {
        console.log(`  ⊘ ${table} — already empty`);
        continue;
      }

      if (dryRun) {
        console.log(`  ▸ ${table} — ${Number(rowCount).toLocaleString()} rows (would delete)`);
      } else {
        const deleteQuery = `DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.${table}\` WHERE TRUE`;
        await client.query({ query: deleteQuery });
        console.log(`  ✗ ${table} — deleted ${Number(rowCount).toLocaleString()} rows`);
      }
    } catch (err: any) {
      console.error(`  ⚠ ${table} — error: ${err.message}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  if (dryRun) {
    console.log("  Dry run complete. To actually delete, run with --confirm");
    console.log("  npx tsx scripts/clear-processed-data.ts --confirm");
  } else {
    console.log("  All processed data cleared successfully.");
  }
  console.log(`${"=".repeat(60)}\n`);
}

const args = process.argv.slice(2);
const isConfirmed = args.includes("--confirm");
clearProcessedData(!isConfirmed);
