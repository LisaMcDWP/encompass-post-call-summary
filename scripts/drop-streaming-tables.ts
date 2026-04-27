import { BigQuery } from "@google-cloud/bigquery";

async function main() {
  const creds = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY!);
  const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID || "guidewaycare-476802", credentials: creds });
  const ds = "call_information";
  const tables = ["interaction_info", "interaction_observations", "interaction_qa_results"];

  for (const t of tables) {
    try {
      await bq.dataset(ds).table(t).delete();
      console.log(`Dropped ${t}`);
    } catch (e: any) {
      console.error(`Error on ${t}: ${e.message}`);
    }
  }
  console.log("\nTables will be auto-recreated on next app startup.");
}

main();
