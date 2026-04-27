import { BigQuery } from "@google-cloud/bigquery";
import { computeActivationObjectiveResults } from "./server/activationObjectives";
import { insertCallActivationObjectives } from "./server/bigquery";
import { storage } from "./server/storage";

async function main() {
  const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY!);
  const enc = "encompass-476415";
  const bq = new BigQuery({ projectId: enc, credentials });

  console.log("Loading active config for CP 1 (Encompass)...");
  const objectives = await storage.getActiveActivationObjectives(1);
  const interactions = await storage.getActiveActivationInteractions(1);
  const activeObs = await storage.getActiveObservations(1);
  console.log(`${objectives.length} objectives, ${interactions.length} interactions, ${activeObs.length} obs topics`);

  console.log("\nLoading all calls processed in last 24h with activation_objectives extractions...");
  const [calls] = await bq.query({
    query: `
      SELECT call_id, processed_at, call_date, response_json
      FROM \`${enc}.call_information.interaction_info\`
      WHERE processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
        AND status = 'success'
        AND REGEXP_CONTAINS(response_json, r'"activation_objectives"\\s*:\\s*\\[')
        AND NOT REGEXP_CONTAINS(response_json, r'"activation_objectives"\\s*:\\s*\\[\\s*\\]')
    `,
  });
  console.log(`Found ${calls.length} candidate call(s).`);

  let stageMatchedBefore = 0; // not really measurable post-hoc, just count statuses after recompute
  let unmappedAfter = 0;
  let stageMatchedAfter = 0;
  let recomputed = 0;
  const beforeSnapshot = new Map<string, string[]>();

  for (const c of calls) {
    const cid = c.call_id;
    const [existing] = await bq.query({
      query: `SELECT objective_id, on_track_status FROM \`${enc}.call_information.interaction_activation_objectives\` WHERE call_id = "${cid}"`,
    });
    beforeSnapshot.set(cid, existing.map((r: any) => `${r.objective_id}:${r.on_track_status}`));
  }

  for (const c of calls) {
    const cid = c.call_id;
    let analysis: any;
    try { analysis = JSON.parse(c.response_json); } catch { continue; }
    const extractions = Array.isArray(analysis?.activation_objectives) ? analysis.activation_objectives : [];
    const callDateRaw = c.call_date?.value || c.call_date;
    const callDateIso = callDateRaw ? new Date(callDateRaw).toISOString() : new Date().toISOString();
    const procRaw = c.processed_at?.value || c.processed_at;
    const procIso = procRaw ? new Date(procRaw).toISOString() : new Date().toISOString();

    const results = computeActivationObjectiveResults({
      callId: cid,
      callDate: callDateIso,
      contextValues: {},
      objectives, activeInteractions: interactions, observations: activeObs,
      extractions,
      processedAt: procIso,
    });

    await insertCallActivationObjectives(cid, results, enc);
    recomputed++;
    for (const r of results) {
      if (r.onTrackStatus === "unmapped_value") unmappedAfter++;
      else if (r.currentStageId) stageMatchedAfter++;
    }
  }

  console.log(`\nRecomputed ${recomputed} call(s).`);
  console.log(`After recompute across all rows: stage-matched=${stageMatchedAfter}, unmapped_value=${unmappedAfter}`);

  console.log("\n--- Spot check: call 96b328ab (your screenshot) ---");
  const targetId = "96b328ab-3a76-4f45-b976-700367cff54f";
  const before = beforeSnapshot.get(targetId);
  const [now] = await bq.query({
    query: `SELECT objective_name, extracted_value, current_stage_name, on_track_status FROM \`${enc}.call_information.interaction_activation_objectives\` WHERE call_id = "${targetId}" ORDER BY objective_id`,
  });
  console.log("BEFORE:", before);
  console.log("AFTER:", JSON.stringify(now, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
