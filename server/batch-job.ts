import { getPendingBatchItems, updateBatchItemStatus, initializeBatchTable } from "./bigquery";
import { insertCallInfo, insertCallObservations } from "./bigquery";
import { analyzeTranscript, buildPromptTemplate, DEFAULT_SUMMARY_INSTRUCTION } from "./gemini";
import { storage } from "./storage";
import { createHash } from "crypto";

async function getPromptWithVersion() {
  const activeObs = await storage.getActiveObservations();
  const summaryInstruction = await storage.getSetting("summary_instruction");
  const observationsGuidance = await storage.getSetting("observations_prompt_guidance");
  const contextParams = await storage.getActiveContextParameters();
  const prompt = buildPromptTemplate(activeObs, summaryInstruction || undefined, contextParams, observationsGuidance || undefined);

  const hash = createHash("sha256").update(prompt).digest("hex");
  const storedHash = await storage.getSetting("prompt_hash");

  let version = parseInt(await storage.getSetting("prompt_version") || "0", 10);
  let versionDate = await storage.getSetting("prompt_version_date") || new Date().toISOString();

  if (hash !== storedHash) {
    version = version + 1;
    versionDate = new Date().toISOString();
    await storage.setSetting("prompt_hash", hash);
    await storage.setSetting("prompt_version", String(version));
    await storage.setSetting("prompt_version_date", versionDate);
  }

  return { prompt, promptVersion: version, promptVersionDate: versionDate };
}

async function processBatch() {
  const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10", 10);
  const DELAY_MS = parseInt(process.env.BATCH_DELAY_MS || "1000", 10);

  console.log(`Batch job starting. Batch size: ${BATCH_SIZE}, Delay: ${DELAY_MS}ms`);

  await initializeBatchTable();

  const pendingItems = await getPendingBatchItems(BATCH_SIZE);
  console.log(`Found ${pendingItems.length} pending items to process.`);

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
      const activeObs = await storage.getActiveObservations();
      const summaryInstruction = await storage.getSetting("summary_instruction");
      const observationsGuidance = await storage.getSetting("observations_prompt_guidance");
      const contextParams = await storage.getActiveContextParameters();
      const { promptVersion, promptVersionDate } = await getPromptWithVersion();

      const sourceId = `batch_${item.bland_call_id}`;
      const startTime = Date.now();

      const { analysis, tokenUsage } = await analyzeTranscript(
        sourceId,
        item.transcript.trim(),
        activeObs,
        undefined,
        summaryInstruction || undefined,
        contextParams,
        {},
        observationsGuidance || undefined
      );

      const processingTimeMs = Date.now() - startTime;
      const processedAt = new Date().toISOString();

      await insertCallInfo({
        callId: sourceId,
        sourceType: "batch_reprocess",
        sourceId: item.bland_call_id,
        processedAt,
        processingTimeMs,
        promptVersion,
        promptVersionDate,
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
      });

      await insertCallObservations(sourceId, analysis.observations);
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
