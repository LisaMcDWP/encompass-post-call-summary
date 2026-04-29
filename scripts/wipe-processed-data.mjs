#!/usr/bin/env node
import { BigQuery } from "@google-cloud/bigquery";

const PROJECTS = ["encompass-476415", "guidewaycare-476802"];
const DATASET = "call_information";

const ANALYSIS_TABLES = [
  "interaction_info",
  "interaction_observations",
  "interaction_qa_pairs",
  "interaction_qa_results",
  "interaction_dispositions",
  "interaction_activation_objectives",
];

const REVIEW_TABLES = [
  "interaction_reviews",
  "interaction_review_items",
  "interaction_review_statuses",
  "call_review_statuses",
];

const BATCH_TABLES = ["batch_processing"];

const args = new Set(process.argv.slice(2));
const wipeReviews = args.has("--reviews");
const wipeBatch = args.has("--batch");
const dryRun = args.has("--dry-run");
const targets = [
  ...ANALYSIS_TABLES,
  ...(wipeReviews ? REVIEW_TABLES : []),
  ...(wipeBatch ? BATCH_TABLES : []),
];

const key = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY || "{}");

console.log(`\nMode: ${dryRun ? "DRY-RUN (no deletes)" : "LIVE WIPE"}`);
console.log(`Tables to wipe per project:\n  - ${targets.join("\n  - ")}\n`);

for (const proj of PROJECTS) {
  const bq = new BigQuery({ projectId: proj, credentials: key });
  console.log(`=== ${proj} ===`);
  const [existing] = await bq.query({
    query: `SELECT table_name FROM \`${proj}.${DATASET}.INFORMATION_SCHEMA.TABLES\``,
  });
  const have = new Set(existing.map((r) => r.table_name));
  for (const tbl of targets) {
    if (!have.has(tbl)) {
      console.log(`  skip   ${tbl} (does not exist)`);
      continue;
    }
    const fq = `\`${proj}.${DATASET}.${tbl}\``;
    if (dryRun) {
      const [c] = await bq.query({ query: `SELECT COUNT(*) AS n FROM ${fq}` });
      console.log(`  would  ${tbl} (${c[0].n} rows)`);
      continue;
    }
    const [job] = await bq.createQueryJob({
      query: `TRUNCATE TABLE ${fq}`,
      location: "US",
    });
    await job.getQueryResults();
    console.log(`  wiped  ${tbl}`);
  }
}
console.log("\nDone.");
