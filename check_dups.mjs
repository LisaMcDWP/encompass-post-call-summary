import { BigQuery } from "@google-cloud/bigquery";
const saKey = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);

async function checkDuplicates(projectId) {
  const bq = new BigQuery({ projectId, credentials: saKey });
  const tableRef = `\`${projectId}.call_information.interaction_info\``;

  const [totals] = await bq.query({
    query: `SELECT COUNT(*) AS total_rows, COUNT(DISTINCT call_id) AS distinct_call_ids, COUNT(*) - COUNT(DISTINCT call_id) AS dup_overhead FROM ${tableRef}`,
    location: "US",
  });

  const [dupRows] = await bq.query({
    query: `SELECT call_id, COUNT(*) AS dup_count FROM ${tableRef} GROUP BY call_id HAVING COUNT(*) > 1 ORDER BY dup_count DESC LIMIT 30`,
    location: "US",
  });

  let topDupDetails = [];
  let bySource = [];
  if (dupRows.length > 0) {
    const top = dupRows.slice(0, 3).map(r => r.call_id);
    const [details] = await bq.query({
      query: `SELECT call_id, processing_id, processing_source, processed_at FROM ${tableRef} WHERE call_id IN UNNEST(@ids) ORDER BY call_id, processed_at`,
      params: { ids: top },
      location: "US",
    });
    topDupDetails = details;

    const [sourceBreakdown] = await bq.query({
      query: `
        WITH dup AS (
          SELECT call_id FROM ${tableRef} GROUP BY call_id HAVING COUNT(*) > 1
        )
        SELECT processing_source, COUNT(*) AS row_count
        FROM ${tableRef}
        WHERE call_id IN (SELECT call_id FROM dup)
        GROUP BY processing_source
        ORDER BY row_count DESC
      `,
      location: "US",
    });
    bySource = sourceBreakdown;
  }

  console.log(`\n=== ${projectId} ===`);
  console.log("Totals:", JSON.stringify(totals[0]));
  console.log(`Distinct call_ids appearing >1 time: ${dupRows.length}`);
  if (dupRows.length > 0) {
    console.log("Top duplicate call_ids (first 15):");
    dupRows.slice(0, 15).forEach(r => console.log(`  ${r.call_id}: ${r.dup_count} rows`));
    console.log("\nBy processing_source for all duplicate call_ids:");
    bySource.forEach(r => console.log(`  ${r.processing_source || "(null)"}: ${r.row_count} rows`));
    console.log("\nSample rows for top 3 duplicates:");
    topDupDetails.forEach(r => {
      const ts = r.processed_at?.value || r.processed_at;
      console.log(`  call=${r.call_id}  proc=${r.processing_id}  src=${r.processing_source}  at=${ts}`);
    });
  }
}

await checkDuplicates("encompass-476415");
await checkDuplicates("guidewaycare-476802");
