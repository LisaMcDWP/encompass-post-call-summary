import { BigQuery } from "@google-cloud/bigquery";
const saKey = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
const projectId = "encompass-476415";
const bq = new BigQuery({ projectId, credentials: saKey });
const tableRef = `\`${projectId}.call_information.interaction_info\``;

// Distribution of dup counts
const [dist] = await bq.query({
  query: `
    SELECT dup_count, COUNT(*) AS num_call_ids
    FROM (SELECT call_id, COUNT(*) AS dup_count FROM ${tableRef} GROUP BY call_id)
    GROUP BY dup_count
    ORDER BY dup_count DESC
  `,
  location: "US",
});
console.log("Distribution of rows-per-call_id:");
dist.forEach(r => console.log(`  ${r.dup_count} rows × ${r.num_call_ids} call_ids = ${r.dup_count * r.num_call_ids} total rows`));

// Group dup call_ids by date
const [byDate] = await bq.query({
  query: `
    WITH dup AS (
      SELECT call_id FROM ${tableRef} GROUP BY call_id HAVING COUNT(*) > 1
    )
    SELECT DATE(processed_at) AS day, processing_source, COUNT(*) AS row_count
    FROM ${tableRef}
    WHERE call_id IN (SELECT call_id FROM dup)
    GROUP BY day, processing_source
    ORDER BY day DESC, processing_source
  `,
  location: "US",
});
console.log("\nDuplicate-call rows by day & source:");
byDate.forEach(r => console.log(`  ${r.day?.value || r.day} ${r.processing_source}: ${r.row_count}`));

// Check care_flow_id pattern for dups
const [careFlow] = await bq.query({
  query: `
    WITH dup AS (
      SELECT call_id FROM ${tableRef} GROUP BY call_id HAVING COUNT(*) > 1
    )
    SELECT care_flow_id, COUNT(DISTINCT call_id) AS distinct_calls, COUNT(*) AS total_rows
    FROM ${tableRef}
    WHERE call_id IN (SELECT call_id FROM dup)
    GROUP BY care_flow_id
    ORDER BY total_rows DESC
    LIMIT 10
  `,
  location: "US",
});
console.log("\nTop care_flow_ids in duplicates:");
careFlow.forEach(r => console.log(`  cf=${r.care_flow_id}: ${r.distinct_calls} distinct calls, ${r.total_rows} rows`));
