import { BigQuery } from "@google-cloud/bigquery";
const saKey = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);

async function checkPending(projectId) {
  const bq = new BigQuery({ projectId, credentials: saKey });
  const batchRef = `\`${projectId}.call_information.batch_processing\``;
  const infoRef = `\`${projectId}.call_information.interaction_info\``;

  const [statusBreakdown] = await bq.query({
    query: `SELECT status, COUNT(*) AS n FROM ${batchRef} GROUP BY status ORDER BY n DESC`,
    location: "US",
  });

  const [pendingTotal] = await bq.query({
    query: `SELECT COUNT(*) AS n FROM ${batchRef} WHERE status IN ('pending','processing')`,
    location: "US",
  });

  const [overlap] = await bq.query({
    query: `
      SELECT
        b.status AS batch_status,
        COUNT(*) AS pending_count,
        COUNTIF(i.call_id IS NOT NULL) AS already_processed_in_info,
        COUNTIF(i.call_id IS NULL) AS not_yet_processed
      FROM ${batchRef} b
      LEFT JOIN (SELECT DISTINCT call_id FROM ${infoRef}) i ON b.bland_call_id = i.call_id
      WHERE b.status IN ('pending','processing')
      GROUP BY batch_status
    `,
    location: "US",
  });

  const [byBatch] = await bq.query({
    query: `
      SELECT
        b.batch_id,
        b.batch_label,
        COUNT(*) AS total_pending,
        COUNTIF(i.call_id IS NOT NULL) AS already_processed,
        COUNTIF(i.call_id IS NULL) AS new_calls
      FROM ${batchRef} b
      LEFT JOIN (SELECT DISTINCT call_id FROM ${infoRef}) i ON b.bland_call_id = i.call_id
      WHERE b.status IN ('pending','processing')
      GROUP BY b.batch_id, b.batch_label
      ORDER BY total_pending DESC
      LIMIT 10
    `,
    location: "US",
  });

  console.log(`\n=== ${projectId} ===`);
  console.log("All status breakdown:");
  statusBreakdown.forEach(r => console.log(`  ${r.status}: ${r.n}`));
  console.log(`\nTotal pending+processing: ${pendingTotal[0].n}`);
  console.log("\nOverlap with already-processed call_ids:");
  overlap.forEach(r => console.log(`  status=${r.batch_status}: ${r.pending_count} pending, ${r.already_processed_in_info} already in interaction_info, ${r.not_yet_processed} new`));
  console.log("\nPer-batch breakdown (top 10):");
  byBatch.forEach(r => console.log(`  ${r.batch_id} [${r.batch_label || "-"}]: ${r.total_pending} pending → ${r.already_processed} already done, ${r.new_calls} new`));
}

await checkPending("encompass-476415");
await checkPending("guidewaycare-476802");
