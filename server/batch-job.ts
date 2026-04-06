import { getPendingBatchItems, updateBatchItemStatus, initializeBatchTable, ensureCallQATable, initializeCallTables } from "./bigquery";
import { insertCallInfo, insertCallObservations, insertCallQAResults } from "./bigquery";
import { analyzeTranscript, buildPromptTemplate, DEFAULT_SUMMARY_INSTRUCTION } from "./gemini";
import { storage } from "./storage";
import { createHash } from "crypto";

async function getPromptWithVersion(clientPathwayId: number) {
  const activeObs = await storage.getActiveObservations(clientPathwayId);
  const summaryInstruction = await storage.getSetting(clientPathwayId, "summary_instruction");
  const observationsGuidance = await storage.getSetting(clientPathwayId, "observations_prompt_guidance");
  const barriersGuidance = await storage.getSetting(clientPathwayId, "barriers_prompt_guidance");
  const contextParams = await storage.getActiveContextParameters(clientPathwayId);
  const callQAPrompts = await storage.getActiveCallQAPrompts(clientPathwayId);
  const prompt = buildPromptTemplate(activeObs, summaryInstruction || undefined, contextParams, observationsGuidance || undefined, barriersGuidance || undefined, callQAPrompts);

  const hash = createHash("sha256").update(prompt).digest("hex");
  const storedHash = await storage.getSetting(clientPathwayId, "prompt_hash");

  let version = parseInt(await storage.getSetting(clientPathwayId, "prompt_version") || "0", 10);
  let versionDate = await storage.getSetting(clientPathwayId, "prompt_version_date") || new Date().toISOString();

  if (hash !== storedHash) {
    version = version + 1;
    versionDate = new Date().toISOString();
    await storage.setSetting(clientPathwayId, "prompt_hash", hash);
    await storage.setSetting(clientPathwayId, "prompt_version", String(version));
    await storage.setSetting(clientPathwayId, "prompt_version_date", versionDate);
  }

  return { prompt, promptVersion: version, promptVersionDate: versionDate };
}

async function processBatch() {
  const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10", 10);
  const DELAY_MS = parseInt(process.env.BATCH_DELAY_MS || "1000", 10);

  console.log(`Batch job starting. Batch size: ${BATCH_SIZE}, Delay: ${DELAY_MS}ms`);

  await initializeBatchTable();
  await ensureCallQATable();
  await initializeCallTables();

  const allCPs = await storage.getClientPathways();
  if (allCPs.length === 0) {
    console.log("No client/pathway configurations found. Job complete.");
    return;
  }
  const requestedCpId = process.env.CLIENT_PATHWAY_ID ? parseInt(process.env.CLIENT_PATHWAY_ID, 10) : null;
  const batchCP = requestedCpId ? allCPs.find(cp => cp.id === requestedCpId) || allCPs[0] : allCPs[0];
  const cpId = batchCP.id;

  const pendingItems = await getPendingBatchItems(BATCH_SIZE);
  console.log(`Found ${pendingItems.length} pending items to process (using client/pathway: ${batchCP.client}/${batchCP.pathway}).`);

  if (pendingItems.length === 0) {
    console.log("No pending items. Job complete.");
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const item of pendingItems) {
    console.log(`Processing: ${item.bland_call_id}`);
    const claimed = await updateBatchItemStatus(item.bland_call_id, "processing");
    if (claimed === 0) {
      console.log(`Skipped (already claimed): ${item.bland_call_id}`);
      continue;
    }

    try {
      const activeObs = await storage.getActiveObservations(cpId);
      const summaryInstruction = await storage.getSetting(cpId, "summary_instruction");
      const observationsGuidance = await storage.getSetting(cpId, "observations_prompt_guidance");
      const barriersGuidance = await storage.getSetting(cpId, "barriers_prompt_guidance");
      const contextParams = await storage.getActiveContextParameters(cpId);
      const { promptVersion, promptVersionDate } = await getPromptWithVersion(cpId);

      const sourceId = `batch_${item.bland_call_id}`;
      const startTime = Date.now();

      let batchContext: Record<string, string> = {};
      if (item.context_values) {
        try { batchContext = JSON.parse(item.context_values); } catch {}
      }

      const batchCallQAPrompts = await storage.getActiveCallQAPrompts(cpId);
      const { analysis, tokenUsage } = await analyzeTranscript(
        sourceId,
        item.transcript.trim(),
        activeObs,
        undefined,
        summaryInstruction || undefined,
        contextParams,
        batchContext,
        observationsGuidance || undefined,
        barriersGuidance || undefined,
        batchCallQAPrompts
      );

      const processingTimeMs = Date.now() - startTime;
      const processedAt = new Date().toISOString();
      const blandTs = (item as any).bland_created_at?.value || (item as any).bland_created_at || null;
      const callDate = blandTs ? new Date(blandTs).toISOString() : null;

      await insertCallInfo({
        callId: sourceId,
        careFlowId: item.care_flow_id || null,
        callDate,
        sourceType: item.source_type || "bland_call",
        sourceId: item.bland_call_id,
        processedAt,
        processingTimeMs,
        promptVersion,
        promptVersionDate,
        contextValues: Object.keys(batchContext).length > 0 ? batchContext : undefined,
        transcriptLength: item.transcript.length,
        summary: analysis.summary,
        followUpAreas: analysis.follow_up_areas,
        transitionStatus: analysis.transition_status,
        promptTokens: tokenUsage.promptTokens,
        completionTokens: tokenUsage.completionTokens,
        totalTokens: tokenUsage.totalTokens,
        estimatedCost: tokenUsage.estimatedCost,
        status: "success",
        requestBody: JSON.stringify({ batch_id: item.batch_id, bland_call_id: item.bland_call_id }),
        client: batchCP.client || null,
        pathway: batchCP.pathway || null,
      });

      await insertCallObservations(sourceId, analysis.observations);
      await insertCallQAResults(sourceId, analysis.call_qa || []);
      await updateBatchItemStatus(item.bland_call_id, "completed", sourceId);

      successCount++;
      console.log(`Completed: ${item.bland_call_id} → ${sourceId} (${processingTimeMs}ms)`);
    } catch (err: any) {
      failCount++;
      console.error(`Failed: ${item.bland_call_id} - ${err.message}`);
      await updateBatchItemStatus(item.bland_call_id, "failed", undefined, err.message);
    }

    if (DELAY_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log(`Batch job complete. Success: ${successCount}, Failed: ${failCount}`);
}

processBatch()
  .then(() => {
    console.log("Batch job finished successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Batch job failed:", err);
    process.exit(1);
  });
