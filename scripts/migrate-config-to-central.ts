import { BigQuery } from "@google-cloud/bigquery";

const SOURCE_PROJECT = "encompass-476415";
const TARGET_PROJECT = process.env.GCP_PROJECT_ID || "guidewaycare-476802";
const DATASET = "call_information";

const CONFIG_TABLES = [
  "client_pathway",
  "observations",
  "context_parameters",
  "settings",
  "call_qa_prompts",
  "disposition_categories",
  "disposition_details",
  "call_review_items",
];

async function main() {
  if (SOURCE_PROJECT === TARGET_PROJECT) {
    console.error("Source and target projects are the same. Nothing to migrate.");
    process.exit(1);
  }

  const creds = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY!);

  const sourceBQ = new BigQuery({ projectId: SOURCE_PROJECT, credentials: creds });
  const targetBQ = new BigQuery({ projectId: TARGET_PROJECT, credentials: creds });

  const targetDataset = targetBQ.dataset(DATASET);
  const [dsExists] = await targetDataset.exists();
  if (!dsExists) {
    await targetBQ.createDataset(DATASET, { location: "US" });
    console.log(`Created dataset ${DATASET} in ${TARGET_PROJECT}`);
  }

  for (const tableName of CONFIG_TABLES) {
    console.log(`\n--- Migrating ${tableName} ---`);

    const sourceTable = sourceBQ.dataset(DATASET).table(tableName);
    const [sourceExists] = await sourceTable.exists();
    if (!sourceExists) {
      console.log(`  Source table ${tableName} does not exist in ${SOURCE_PROJECT}. Skipping.`);
      continue;
    }

    const [sourceMetadata] = await sourceTable.getMetadata();
    const schema = sourceMetadata.schema;

    const targetTable = targetDataset.table(tableName);
    const [targetExists] = await targetTable.exists();

    if (targetExists) {
      const [countResult] = await targetBQ.query({
        query: `SELECT COUNT(*) as cnt FROM \`${TARGET_PROJECT}.${DATASET}.${tableName}\``,
      });
      const existingCount = countResult[0]?.cnt || 0;
      if (existingCount > 0) {
        console.log(`  Target table ${tableName} already has ${existingCount} rows. Skipping to avoid duplicates.`);
        continue;
      }
    } else {
      await targetDataset.createTable(tableName, { schema });
      console.log(`  Created table ${tableName} in ${TARGET_PROJECT}`);
    }

    const [rows] = await sourceBQ.query({
      query: `SELECT * FROM \`${SOURCE_PROJECT}.${DATASET}.${tableName}\``,
    });

    if (rows.length === 0) {
      console.log(`  No rows in source table ${tableName}. Skipping.`);
      continue;
    }

    const cleanRows = rows.map((row: any) => {
      const clean: any = {};
      for (const field of schema.fields) {
        const val = row[field.name];
        if (val !== undefined && val !== null) {
          if (field.type === "TIMESTAMP" && val instanceof Object && val.value) {
            clean[field.name] = val.value;
          } else {
            clean[field.name] = val;
          }
        } else {
          clean[field.name] = null;
        }
      }
      return clean;
    });

    await targetTable.insert(cleanRows);
    console.log(`  Copied ${cleanRows.length} rows to ${TARGET_PROJECT}.${DATASET}.${tableName}`);
  }

  console.log("\n=== Migration complete ===");
  console.log(`Config tables copied from ${SOURCE_PROJECT} to ${TARGET_PROJECT}`);
  console.log("\nReminder: Update the Encompass client_pathway record in the NEW project:");
  console.log(`  UPDATE client_pathway SET gcp_project_id = '${SOURCE_PROJECT}' WHERE client = 'Encompass';`);
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
