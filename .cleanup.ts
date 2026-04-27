import { BigQuery } from "@google-cloud/bigquery";
import { computeActivationObjectiveResults } from "./server/activationObjectives";
import { storage } from "./server/storage";

const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY!);
const enc = "encompass-476415";
const bq = new BigQuery({ projectId: enc, credentials });
const targetId = "96b328ab-3a76-4f45-b976-700367cff54f";

async function tryDelete(): Promise<boolean> {
  try {
    await bq.query({
      query: `DELETE FROM \`${enc}.call_information.call_activation_objectives\` WHERE call_id = "${targetId}"`,
      location: "US",
    });
    return true;
  } catch (err: any) {
    if (err.message?.includes("streaming buffer")) {
      console.log("  → still in streaming buffer, will retry");
      return false;
    }
    throw err;
  }
}

async function main() {
  const [current] = await bq.query({
    query: `SELECT COUNT(*) c FROM \`${enc}.call_information.call_activation_objectives\` WHERE call_id = "${targetId}"`,
  });
  console.log(`Current row count for call: ${current[0].c}`);

  console.log("\nAttempting DELETE...");
  const maxAttempts = 12; // up to 60 min
  for (let i = 1; i <= maxAttempts; i++) {
    console.log(`Attempt ${i}/${maxAttempts} at ${new Date().toISOString()}...`);
    const ok = await tryDelete();
    if (ok) {
      console.log("  ✓ DELETE succeeded");
      break;
    }
    if (i === maxAttempts) {
      console.log("  ✗ Streaming buffer still blocking after 60 min — will need manual cleanup later");
      return;
    }
    await new Promise(r => setTimeout(r, 5 * 60 * 1000)); // 5 min
  }

  const [afterDelete] = await bq.query({
    query: `SELECT COUNT(*) c FROM \`${enc}.call_information.call_activation_objectives\` WHERE call_id = "${targetId}"`,
  });
  console.log(`Rows after DELETE: ${afterDelete[0].c}`);

  console.log("\nRe-inserting fresh 2 rows from response_json...");
  const objectives = await storage.getActiveActivationObjectives(1);
  const interactions = await storage.getActiveActivationInteractions(1);
  const activeObs = await storage.getActiveObservations(1);

  const [calls] = await bq.query({
    query: `SELECT call_id, processed_at, call_date, response_json FROM \`${enc}.call_information.call_info\` WHERE call_id = "${targetId}" ORDER BY processed_at DESC LIMIT 1`,
  });
  const c = calls[0];
  const analysis = JSON.parse(c.response_json);
  const extractions = analysis?.activation_objectives || [];
  const callDateRaw = c.call_date?.value || c.call_date;
  const callDateIso = callDateRaw ? new Date(callDateRaw).toISOString() : new Date().toISOString();
  const procRaw = c.processed_at?.value || c.processed_at;
  const procIso = procRaw ? new Date(procRaw).toISOString() : new Date().toISOString();

  const results = computeActivationObjectiveResults({
    callId: targetId, callDate: callDateIso, contextValues: {},
    objectives, activeInteractions: interactions, observations: activeObs,
    extractions, processedAt: procIso,
  });

  const rows = results.map(r => ({
    call_id: targetId, objective_id: r.objectiveId, objective_name: r.objectiveName,
    interaction_id: r.interactionId ?? null, interaction_key: r.interactionKey || null, interaction_name: r.interactionName || null,
    call_date: r.callDate || null, anchor_event_date: r.anchorEventDate || null, target_date: r.targetDate || null,
    days_remaining: r.daysRemaining, band_label: r.bandLabel || null, extracted_value: r.extractedValue || null,
    current_stage_id: r.currentStageId || null, current_stage_name: r.currentStageName || null,
    on_track: r.onTrack, on_track_status: r.onTrackStatus || null, is_eligible: r.isEligible,
    exclusion_reason: r.exclusionReason || null, rationale: r.rationale || null,
    observations: (r.observations && r.observations.length > 0) ? JSON.stringify(r.observations) : null,
    processed_at: r.processedAt,
  }));

  await bq.dataset("call_information").table("call_activation_objectives").insert(rows);
  console.log(`Inserted ${rows.length} fresh row(s).`);

  const [final] = await bq.query({
    query: `SELECT objective_name, extracted_value, current_stage_name, on_track_status FROM \`${enc}.call_information.call_activation_objectives\` WHERE call_id = "${targetId}" ORDER BY objective_id`,
  });
  console.log("\nFinal state:");
  console.log(JSON.stringify(final, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
