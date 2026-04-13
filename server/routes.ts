import type { Express } from "express";
import { createServer, type Server } from "http";
import { analyzeTranscript, analyzeTranscriptFast, analyzeTranscriptBackground, buildPromptTemplate, DEFAULT_SUMMARY_INSTRUCTION, aiObservationAssistant, type DispositionConfig } from "./gemini";
import { insertCallInfo, insertCallObservations, insertCallQAPairs, insertCallBarriers, insertCallQAResults, insertCallDisposition, ensureCallBarriersTable, ensureCallQATable, getCallBarriers, getCallInfoList, getCallDetail, getCallStatsByDay, queryBlandCalls, loadBlandCallsToBatch, fetchAwellContextForCareFlows, getBatchItems, getBatchSummary, initializeBatchTable, getPendingBatchItems, updateBatchItemStatus, bulkUpdateBatchItemStatus, bulkUpdateBatchResults, resetFailedBatchItems, deletePendingBatchItems, recreateBatch, getDistinctTags, upsertCallReviews, getCallReviews, upsertCallReviewStatus, upsertCallReviewMeta, getCallReviewStatusesBulk, ensureCallReviewStatusesTable, getCallReviewList } from "./bigquery";
import { randomUUID, createHash } from "crypto";
import { storage } from "./storage";
import { insertObservationSchema, enumValueSchema, insertContextParameterSchema, insertCallQAPromptSchema, insertDispositionCategorySchema, insertDispositionDetailSchema, insertCallReviewItemSchema } from "@shared/schema";
import { z } from "zod";

async function getPromptWithVersion(clientPathwayId: number) {
  const activeObs = await storage.getActiveObservations(clientPathwayId);
  const summaryInstruction = await storage.getSetting(clientPathwayId, "summary_instruction");
  const observationsGuidance = await storage.getSetting(clientPathwayId, "observations_prompt_guidance");
  const barriersGuidance = await storage.getSetting(clientPathwayId, "barriers_prompt_guidance");
  const contextParams = await storage.getActiveContextParameters(clientPathwayId);
  const callQAPrompts = await storage.getActiveCallQAPrompts(clientPathwayId);
  const dispCategories = await storage.getDispositionCategories(clientPathwayId);
  const dispDetails = await storage.getDispositionDetails(clientPathwayId);
  const dispConfig: DispositionConfig = { categories: dispCategories, details: dispDetails };
  const prompt = buildPromptTemplate(activeObs, summaryInstruction || undefined, contextParams, observationsGuidance || undefined, barriersGuidance || undefined, callQAPrompts, undefined, dispConfig);

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/prompt", async (req, res) => {
    const cpId = Number(req.query.clientPathwayId);
    if (!cpId) {
      const allCPs = await storage.getClientPathways();
      if (allCPs.length === 0) return res.status(400).json({ message: "No client/pathway configuration found." });
      const { prompt, promptVersion, promptVersionDate } = await getPromptWithVersion(allCPs[0].id);
      return res.json({ prompt, promptVersion, promptVersionDate });
    }
    const { prompt, promptVersion, promptVersionDate } = await getPromptWithVersion(cpId);
    res.json({ prompt, promptVersion, promptVersionDate });
  });

  async function handleAnalyze(req: any, res: any) {
    const startTime = Date.now();
    const { care_flow_id, processed_datetime, source_type, source_id, source_text, context, client: reqClient, pathway: reqPathway, ...rest } = req.body;
    const { source_text: _omit, ...requestMeta } = req.body;
    const requestBodyJson = JSON.stringify(requestMeta);

    const relevantHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lk = key.toLowerCase();
      if (lk.startsWith("x-awell-") || lk.startsWith("x-gwc-") || lk === "x-api-key" || lk === "x-forwarded-for" || lk === "user-agent") {
        relevantHeaders[key] = String(value);
      }
    }
    const requestHeadersJson = Object.keys(relevantHeaders).length > 0 ? JSON.stringify(relevantHeaders) : undefined;

    if (!source_text || typeof source_text !== "string" || source_text.trim().length === 0) {
      const processingTime = Date.now() - startTime;
      const logId = source_id || care_flow_id || `call_${randomUUID().slice(0, 12)}`;
      await insertCallInfo({
        callId: logId,
        processedAt: new Date().toISOString(),
        transcriptLength: 0,
        processingTimeMs: processingTime,
        status: "error",
        errorMessage: "Missing or empty source_text",
      });

      return res.status(400).json({
        status: "error",
        message: "A non-empty source_text string is required.",
      });
    }

    const resolvedSourceId = source_id || `call_${randomUUID().slice(0, 12)}`;
    const analyzeProcessingId = randomUUID();
    const clientPathwayId = req.body.client_pathway_id ? Number(req.body.client_pathway_id) : null;

    try {
      let cpId = clientPathwayId;
      if (!cpId) {
        const allCPs = await storage.getClientPathways();
        if (reqClient && reqPathway) {
          const match = allCPs.find((cp: any) => cp.client === reqClient && cp.pathway === reqPathway);
          if (match) cpId = match.id;
        }
        if (!cpId && allCPs.length > 0) {
          cpId = allCPs[0].id;
        }
      }

      if (!cpId) {
        return res.status(400).json({ status: "error", message: "No client/pathway configuration found. Please create one first." });
      }

      const cpRecord = await storage.getClientPathway(cpId);
      const resolvedClient = reqClient || cpRecord?.client || null;
      const resolvedPathway = reqPathway || cpRecord?.pathway || null;

      const { prompt: _promptText, promptVersion, promptVersionDate } = await getPromptWithVersion(cpId);
      const activeObs = await storage.getActiveObservations(cpId);
      const summaryInstruction = await storage.getSetting(cpId, "summary_instruction");
      const observationsGuidance = await storage.getSetting(cpId, "observations_prompt_guidance");
      const barriersGuidance = await storage.getSetting(cpId, "barriers_prompt_guidance");
      const contextParams = await storage.getActiveContextParameters(cpId);

      const contextValues: Record<string, string> = {};
      const contextSource = (context && typeof context === "object") ? context : rest;
      for (const param of contextParams) {
        if (contextSource[param.name] !== undefined && contextSource[param.name] !== null) {
          contextValues[param.name] = String(contextSource[param.name]);
        }
      }

      const callQAPrompts = await storage.getActiveCallQAPrompts(cpId);
      const dispCategories = await storage.getDispositionCategories(cpId);
      const dispDetails = await storage.getDispositionDetails(cpId);
      const dispConfig: DispositionConfig = { categories: dispCategories, details: dispDetails };

      const { analysis, tokenUsage } = await analyzeTranscript(
        resolvedSourceId,
        source_text.trim(),
        activeObs,
        undefined,
        summaryInstruction || undefined,
        contextParams,
        contextValues,
        observationsGuidance || undefined,
        barriersGuidance || undefined,
        callQAPrompts,
        dispConfig,
      );
      const processingTime = Date.now() - startTime;

      const processedAt = new Date().toISOString();

      await insertCallInfo({
        callId: resolvedSourceId,
        processingId: analyzeProcessingId,
        careFlowId: care_flow_id || null,
        processedDatetime: processed_datetime || processedAt,
        sourceType: source_type || null,
        sourceId: resolvedSourceId,
        processedAt,
        processingTimeMs: processingTime,
        promptVersion: promptVersion,
        promptVersionDate: promptVersionDate,
        contextValues,
        transcriptLength: source_text.length,
        summary: analysis.summary,
        followUpAreas: analysis.follow_up_areas,
        transitionStatus: analysis.transition_status,
        promptTokens: tokenUsage.promptTokens,
        completionTokens: tokenUsage.completionTokens,
        totalTokens: tokenUsage.totalTokens,
        estimatedCost: tokenUsage.estimatedCost,
        status: "success",
        requestBody: requestBodyJson,
        requestHeaders: requestHeadersJson,
        responseJson: JSON.stringify(analysis),
        client: resolvedClient,
        pathway: resolvedPathway,
      });

      await insertCallObservations(resolvedSourceId, analysis.observations);
      await insertCallQAPairs(resolvedSourceId, analysis.qa_pairs);
      await insertCallBarriers(resolvedSourceId, analysis.barriers);
      await insertCallQAResults(resolvedSourceId, analysis.call_qa || []);
      if (analysis.disposition) {
        await insertCallDisposition(resolvedSourceId, analysis.disposition);
      }

      return res.json({
        status: "success",
        data: {
          care_flow_id: care_flow_id || null,
          processed_datetime: processed_datetime || new Date().toISOString(),
          source_type: source_type || null,
          source_id: resolvedSourceId,
          context: contextValues,
          processedAt: new Date().toISOString(),
          processingTimeMs: processingTime,
          prompt_version: promptVersion,
          prompt_version_date: promptVersionDate,
          analysis,
          tokenUsage,
        },
      });
    } catch (error: any) {
      const processingTime = Date.now() - startTime;

      await insertCallInfo({
        callId: resolvedSourceId,
        processingId: analyzeProcessingId,
        processedAt: new Date().toISOString(),
        processingTimeMs: processingTime,
        transcriptLength: source_text.length,
        status: "error",
        errorMessage: error.message,
        requestBody: requestBodyJson,
        requestHeaders: requestHeadersJson,
      });

      console.error("Transcript analysis failed:", error);

      return res.status(500).json({
        status: "error",
        message: "Failed to analyze transcript. " + error.message,
      });
    }
  }

  app.post("/api/analyze", handleAnalyze);

  app.post("/gwc_observation_summarization", async (req, res) => {
    const apiKey = process.env.GWC_OBSERVATION_SUMMARIZATION_API_KEY;
    if (apiKey) {
      const provided = req.headers["x-api-key"];
      if (!provided || provided !== apiKey) {
        return res.status(401).json({ status: "error", message: "Invalid or missing API key" });
      }
    }

    const startTime = Date.now();
    const { care_flow_id, processed_datetime, source_type, source_id, source_text, context, client: reqClient, pathway: reqPathway, webhook_url, ...rest } = req.body;
    const isAsync = req.body.async === true || req.body.async === "true" || !!webhook_url;
    const { source_text: _omit, ...requestMeta } = req.body;
    const requestBodyJson = JSON.stringify(requestMeta);

    const relevantHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lk = key.toLowerCase();
      if (lk.startsWith("x-awell-") || lk.startsWith("x-gwc-") || lk === "x-api-key" || lk === "x-forwarded-for" || lk === "user-agent") {
        relevantHeaders[key] = String(value);
      }
    }
    const requestHeadersJson = Object.keys(relevantHeaders).length > 0 ? JSON.stringify(relevantHeaders) : undefined;

    if (!source_text || typeof source_text !== "string" || source_text.trim().length === 0) {
      return res.status(400).json({ status: "error", message: "A non-empty source_text string is required." });
    }

    const resolvedSourceId = source_id || `call_${randomUUID().slice(0, 12)}`;
    const processingId = randomUUID();
    const clientPathwayId = req.body.client_pathway_id ? Number(req.body.client_pathway_id) : null;

    if (isAsync) {
      console.log(`[AWELL-ASYNC] Accepted job ${resolvedSourceId} processing_id=${processingId} (webhook: ${webhook_url || "none"})`);
      res.status(202).json({
        status: "accepted",
        job_id: resolvedSourceId,
        processing_id: processingId,
        message: "Processing started. Retrieve results via GET /gwc_observation_summarization/:job_id" + (webhook_url ? " or wait for webhook callback." : "."),
      });

      (async () => {
        try {
          let cpId = clientPathwayId;
          if (!cpId) {
            const allCPs = await storage.getClientPathways();
            if (reqClient && reqPathway) {
              const match = allCPs.find((cp: any) => cp.client === reqClient && cp.pathway === reqPathway);
              if (match) cpId = match.id;
            }
            if (!cpId && allCPs.length > 0) cpId = allCPs[0].id;
          }
          if (!cpId) {
            console.error(`[AWELL-ASYNC] No client/pathway config for ${resolvedSourceId}`);
            return;
          }

          const cpRecord = await storage.getClientPathway(cpId);
          const resolvedClient = reqClient || cpRecord?.client || null;
          const resolvedPathway = reqPathway || cpRecord?.pathway || null;

          const [
            { prompt: _p, promptVersion, promptVersionDate },
            activeObs,
            summaryInstruction,
            observationsGuidance,
            barriersGuidance,
            contextParams,
            callQAPrompts,
          ] = await Promise.all([
            getPromptWithVersion(cpId),
            storage.getActiveObservations(cpId),
            storage.getSetting(cpId, "summary_instruction"),
            storage.getSetting(cpId, "observations_prompt_guidance"),
            storage.getSetting(cpId, "barriers_prompt_guidance"),
            storage.getActiveContextParameters(cpId),
            storage.getActiveCallQAPrompts(cpId),
          ]);

          const contextValues: Record<string, string> = {};
          const contextSource = (context && typeof context === "object") ? context : rest;
          for (const param of contextParams) {
            if (contextSource[param.name] !== undefined && contextSource[param.name] !== null) {
              contextValues[param.name] = String(contextSource[param.name]);
            }
          }

          const asyncDispCats = await storage.getDispositionCategories(cpId);
          const asyncDispDets = await storage.getDispositionDetails(cpId);
          const asyncDispConfig: DispositionConfig = { categories: asyncDispCats, details: asyncDispDets };

          console.log(`[AWELL-ASYNC] Starting full Gemini analysis for ${resolvedSourceId}`);
          const { analysis, tokenUsage } = await analyzeTranscript(
            resolvedSourceId, source_text.trim(), activeObs,
            undefined,
            summaryInstruction || undefined, contextParams, contextValues,
            observationsGuidance || undefined, barriersGuidance || undefined,
            callQAPrompts, asyncDispConfig,
          );
          const processingTime = Date.now() - startTime;
          const processedAt = new Date().toISOString();

          console.log(`[AWELL-ASYNC] Gemini completed for ${resolvedSourceId} in ${processingTime}ms — writing to BigQuery`);

          await Promise.all([
            insertCallInfo({
              callId: resolvedSourceId, processingId, careFlowId: care_flow_id || null,
              processedDatetime: processed_datetime || processedAt, sourceType: source_type || null,
              sourceId: resolvedSourceId, processedAt, processingTimeMs: processingTime,
              promptVersion, promptVersionDate, contextValues,
              transcriptLength: source_text.length, summary: analysis.summary || "",
              followUpAreas: analysis.follow_up_areas || "", transitionStatus: analysis.transition_status || "",
              promptTokens: tokenUsage.promptTokens, completionTokens: tokenUsage.completionTokens,
              totalTokens: tokenUsage.totalTokens, estimatedCost: tokenUsage.estimatedCost,
              status: "success", requestBody: requestBodyJson, requestHeaders: requestHeadersJson,
              responseJson: JSON.stringify(analysis),
              client: resolvedClient, pathway: resolvedPathway,
            }),
            insertCallObservations(resolvedSourceId, analysis.observations || []),
            insertCallQAPairs(resolvedSourceId, analysis.qa_pairs || []),
            insertCallBarriers(resolvedSourceId, analysis.barriers || []),
            insertCallQAResults(resolvedSourceId, analysis.call_qa || []),
            ...(analysis.disposition ? [insertCallDisposition(resolvedSourceId, analysis.disposition)] : []),
          ]);

          console.log(`[AWELL-ASYNC] BigQuery writes completed for ${resolvedSourceId}`);

          if (webhook_url) {
            const webhookPayload = {
              status: "completed",
              job_id: resolvedSourceId,
              processing_id: processingId,
              data: {
                care_flow_id: care_flow_id || null,
                processed_datetime: processed_datetime || processedAt,
                source_type: source_type || null,
                source_id: resolvedSourceId,
                context: contextValues,
                processedAt,
                processingTimeMs: processingTime,
                prompt_version: promptVersion,
                prompt_version_date: promptVersionDate,
                analysis: {
                  summary: analysis.summary,
                  observations: analysis.observations,
                  observations_summary_formatted: analysis.transition_status,
                  followup_formatted: analysis.follow_up_areas,
                  qa_pairs: analysis.qa_pairs,
                  barriers: analysis.barriers,
                  call_qa: analysis.call_qa,
                },
                tokenUsage,
              },
            };

            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                const webhookRes = await fetch(webhook_url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(webhookPayload),
                });
                console.log(`[AWELL-ASYNC] Webhook callback to ${webhook_url} returned ${webhookRes.status} (attempt ${attempt})`);
                if (webhookRes.ok) break;
                if (attempt < maxRetries) await new Promise(r => setTimeout(r, 2000 * attempt));
              } catch (whErr: any) {
                console.error(`[AWELL-ASYNC] Webhook callback failed (attempt ${attempt}): ${whErr.message}`);
                if (attempt < maxRetries) await new Promise(r => setTimeout(r, 2000 * attempt));
              }
            }
          }
        } catch (err: any) {
          console.error(`[AWELL-ASYNC] Processing FAILED for ${resolvedSourceId}:`, err.message);
          const processingTime = Date.now() - startTime;
          insertCallInfo({
            callId: resolvedSourceId, careFlowId: care_flow_id || null,
            processedAt: new Date().toISOString(), processingTimeMs: processingTime,
            transcriptLength: source_text.length, status: "error",
            errorMessage: err.message, requestBody: requestBodyJson, requestHeaders: requestHeadersJson,
          }).catch(() => {});

          if (webhook_url) {
            try {
              await fetch(webhook_url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "failed", job_id: resolvedSourceId, error: err.message }),
              });
            } catch {}
          }
        }
      })();
      return;
    }

    try {
      let cpId = clientPathwayId;
      if (!cpId) {
        const allCPs = await storage.getClientPathways();
        if (reqClient && reqPathway) {
          const match = allCPs.find((cp: any) => cp.client === reqClient && cp.pathway === reqPathway);
          if (match) cpId = match.id;
        }
        if (!cpId && allCPs.length > 0) cpId = allCPs[0].id;
      }
      if (!cpId) {
        return res.status(400).json({ status: "error", message: "No client/pathway configuration found." });
      }

      const cpRecord = await storage.getClientPathway(cpId);
      const resolvedClient = reqClient || cpRecord?.client || null;
      const resolvedPathway = reqPathway || cpRecord?.pathway || null;

      const { prompt: _promptText, promptVersion, promptVersionDate } = await getPromptWithVersion(cpId);
      const activeObs = await storage.getActiveObservations(cpId);
      const summaryInstruction = await storage.getSetting(cpId, "summary_instruction");
      const observationsGuidance = await storage.getSetting(cpId, "observations_prompt_guidance");
      const barriersGuidance = await storage.getSetting(cpId, "barriers_prompt_guidance");
      const contextParams = await storage.getActiveContextParameters(cpId);
      const contextValues: Record<string, string> = {};
      const contextSource = (context && typeof context === "object") ? context : rest;
      for (const param of contextParams) {
        if (contextSource[param.name] !== undefined && contextSource[param.name] !== null) {
          contextValues[param.name] = String(contextSource[param.name]);
        }
      }
      const callQAPrompts = await storage.getActiveCallQAPrompts(cpId);

      const dispCategories = await storage.getDispositionCategories(cpId);
      const dispDetails = await storage.getDispositionDetails(cpId);
      const dispositionConfig: DispositionConfig = { categories: dispCategories, details: dispDetails };

      const { analysis: fastAnalysis, tokenUsage: fastTokenUsage } = await analyzeTranscriptFast(
        resolvedSourceId, source_text.trim(), activeObs,
        summaryInstruction || undefined, contextParams, contextValues,
        observationsGuidance || undefined, dispositionConfig,
      );
      const processingTime = Date.now() - startTime;
      console.log(`[AWELL] Fast Gemini completed for ${resolvedSourceId} in ${processingTime}ms — responding to Awell now`);

      const responseBody = {
        status: "success",
        call_id: resolvedSourceId,
        processing_id: processingId,
        message: "Sync response includes summary, observations, and transition status. Use GET /gwc_observation_summarization/" + resolvedSourceId + " to retrieve full results (qa_pairs, barriers, call_qa) after background processing completes.",
        data: {
          care_flow_id: care_flow_id || null,
          processed_datetime: processed_datetime || new Date().toISOString(),
          source_type: source_type || null,
          source_id: resolvedSourceId,
          context: contextValues,
          processedAt: new Date().toISOString(),
          processingTimeMs: processingTime,
          prompt_version: promptVersion,
          prompt_version_date: promptVersionDate,
          analysis: {
            summary: fastAnalysis.summary,
            observations: fastAnalysis.observations,
            observations_summary_formatted: fastAnalysis.transition_status,
            followup_formatted: fastAnalysis.follow_up_areas,
          },
          tokenUsage: fastTokenUsage,
        },
      };

      res.json(responseBody);

      const processedAt = new Date().toISOString();
      const bgStart = Date.now();
      (async () => {
        try {
          const bgResult = await analyzeTranscriptBackground(
            resolvedSourceId, source_text.trim(), activeObs, callQAPrompts,
            barriersGuidance || undefined,
          );
          const bgTime = Date.now() - bgStart;
          console.log(`[AWELL-BG] Background Gemini completed for ${resolvedSourceId} in ${bgTime}ms (${bgResult.qa_pairs.length} qa_pairs, ${bgResult.barriers.length} barriers, ${bgResult.call_qa.length} call_qa)`);

          const fullAnalysis = {
            ...fastAnalysis,
            qa_pairs: bgResult.qa_pairs,
            barriers: bgResult.barriers,
            call_qa: bgResult.call_qa,
          };

          const combinedTokenUsage = {
            promptTokens: fastTokenUsage.promptTokens + bgResult.tokenUsage.promptTokens,
            completionTokens: fastTokenUsage.completionTokens + bgResult.tokenUsage.completionTokens,
            totalTokens: fastTokenUsage.totalTokens + bgResult.tokenUsage.totalTokens,
            estimatedCost: fastTokenUsage.estimatedCost + bgResult.tokenUsage.estimatedCost,
          };

          const bqInserts: Promise<void>[] = [
            insertCallInfo({
              callId: resolvedSourceId, processingId, careFlowId: care_flow_id || null,
              processedDatetime: processed_datetime || processedAt, sourceType: source_type || null,
              sourceId: resolvedSourceId, processedAt, processingTimeMs: processingTime,
              promptVersion, promptVersionDate, contextValues,
              transcriptLength: source_text.length, summary: fullAnalysis.summary || "",
              followUpAreas: fullAnalysis.follow_up_areas || "", transitionStatus: fullAnalysis.transition_status || "",
              promptTokens: combinedTokenUsage.promptTokens, completionTokens: combinedTokenUsage.completionTokens,
              totalTokens: combinedTokenUsage.totalTokens, estimatedCost: combinedTokenUsage.estimatedCost,
              status: "success", requestBody: requestBodyJson, requestHeaders: requestHeadersJson,
              responseJson: JSON.stringify(fullAnalysis),
              client: resolvedClient, pathway: resolvedPathway,
            }),
            insertCallObservations(resolvedSourceId, fullAnalysis.observations || []),
            insertCallQAPairs(resolvedSourceId, bgResult.qa_pairs),
            insertCallBarriers(resolvedSourceId, bgResult.barriers),
            insertCallQAResults(resolvedSourceId, bgResult.call_qa),
          ];
          if (fastAnalysis.disposition) {
            bqInserts.push(insertCallDisposition(resolvedSourceId, fastAnalysis.disposition));
          }
          await Promise.all(bqInserts);
          console.log(`[AWELL-BG] All BigQuery writes completed for ${resolvedSourceId}`);
        } catch (bgErr: any) {
          console.error(`[AWELL-BG] Background processing FAILED for ${resolvedSourceId}:`, bgErr.message);
          insertCallInfo({
            callId: resolvedSourceId, processingId, careFlowId: care_flow_id || null,
            processedDatetime: processed_datetime || processedAt, sourceType: source_type || null,
            sourceId: resolvedSourceId, processedAt, processingTimeMs: processingTime,
            promptVersion, promptVersionDate, contextValues,
            transcriptLength: source_text.length, summary: fastAnalysis.summary || "",
            followUpAreas: fastAnalysis.follow_up_areas || "", transitionStatus: fastAnalysis.transition_status || "",
            promptTokens: fastTokenUsage.promptTokens, completionTokens: fastTokenUsage.completionTokens,
            totalTokens: fastTokenUsage.totalTokens, estimatedCost: fastTokenUsage.estimatedCost,
            status: "success_partial", requestBody: requestBodyJson, requestHeaders: requestHeadersJson,
            responseJson: JSON.stringify(fastAnalysis),
            client: resolvedClient, pathway: resolvedPathway,
            errorMessage: `Background processing failed: ${bgErr.message}`,
          }).catch(() => {});
          insertCallObservations(resolvedSourceId, fastAnalysis.observations || []).catch(() => {});
          if (fastAnalysis.disposition) {
            insertCallDisposition(resolvedSourceId, fastAnalysis.disposition).catch(() => {});
          }
          console.error(`[AWELL-BG] Saved partial results (fast-only, no barriers/qa) for ${resolvedSourceId}`);
        }
      })();

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      insertCallInfo({
        callId: resolvedSourceId, processingId, processedAt: new Date().toISOString(),
        processingTimeMs: processingTime, transcriptLength: source_text.length,
        status: "error", errorMessage: error.message,
        requestBody: requestBodyJson, requestHeaders: requestHeadersJson,
      }).catch(() => {});
      console.error("Transcript analysis failed:", error);
      return res.status(500).json({ status: "error", message: "Failed to analyze transcript. " + error.message });
    }
  });

  app.get("/gwc_observation_summarization/:jobId", async (req, res) => {
    const apiKey = process.env.GWC_OBSERVATION_SUMMARIZATION_API_KEY;
    if (apiKey) {
      const provided = req.headers["x-api-key"];
      if (!provided || provided !== apiKey) {
        return res.status(401).json({ status: "error", message: "Invalid or missing API key" });
      }
    }

    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({ status: "error", message: "job_id is required." });
    }

    try {
      const detail = await getCallDetail(jobId);

      if (!detail.callInfo) {
        return res.json({ status: "processing", job_id: jobId, message: "Job is still processing. Try again shortly." });
      }

      if (detail.callInfo.status === "error") {
        return res.json({ status: "failed", job_id: jobId, error: detail.callInfo.error_message || "Processing failed." });
      }

      const responseData: any = {
        status: "completed",
        job_id: jobId,
        processing_id: detail.callInfo.processing_id || null,
        data: {
          care_flow_id: detail.callInfo.care_flow_id || null,
          processed_datetime: detail.callInfo.processed_datetime || null,
          source_type: detail.callInfo.source_type || null,
          source_id: detail.callInfo.source_id || jobId,
          context: detail.callInfo.context_values || null,
          processedAt: detail.callInfo.processed_at,
          processingTimeMs: detail.callInfo.processing_time_ms,
          prompt_version: detail.callInfo.prompt_version,
          prompt_version_date: detail.callInfo.prompt_version_date,
          analysis: {
            summary: detail.callInfo.summary,
            observations: detail.observations.map((o: any) => ({
              name: o.observation_name,
              display_name: o.observation_display_name,
              domain: o.domain,
              value_type: o.value_type,
              value: o.observation_value,
              detail: o.detail,
              evidence: o.evidence,
              confidence: o.confidence,
            })),
            observations_summary_formatted: detail.callInfo.transition_status,
            followup_formatted: detail.callInfo.follow_up_areas,
            qa_pairs: detail.qaPairs,
            barriers: detail.barriers,
            call_qa: detail.callQA,
          },
          tokenUsage: {
            promptTokens: detail.callInfo.prompt_tokens,
            completionTokens: detail.callInfo.completion_tokens,
            totalTokens: detail.callInfo.total_tokens,
            estimatedCost: detail.callInfo.estimated_cost,
          },
        },
      };

      return res.json(responseData);
    } catch (error: any) {
      console.error(`[AWELL-ASYNC] Failed to retrieve job ${jobId}:`, error.message);
      return res.status(500).json({ status: "error", message: "Failed to retrieve job results." });
    }
  });

  app.post("/api/observations/ai-suggest", async (req, res) => {
    try {
      const { message, history, clientPathwayId } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }
      if (!clientPathwayId) return res.status(400).json({ error: "clientPathwayId is required" });
      const observations = await storage.getObservations(Number(clientPathwayId));
      const response = await aiObservationAssistant(observations, message, history || []);
      return res.json({ response });
    } catch (error: any) {
      console.error("AI observation assistant error:", error.message);
      return res.status(500).json({ error: "AI assistant failed: " + error.message });
    }
  });

  app.get("/api/observations", async (req, res) => {
    const cpId = Number(req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId query param required" });
    const obs = await storage.getObservations(cpId);
    res.json(obs);
  });

  const observationCreateSchema = z.object({
    name: z.string().min(1),
    displayName: z.string().min(1),
    description: z.string().default(""),
    domain: z.string().min(1),
    displayOrder: z.number().int().min(0),
    valueType: z.enum(["enum", "boolean", "text", "number"]),
    value: z.array(enumValueSchema).default([]),
    isActive: z.boolean().default(true),
    promptGuidance: z.string().default(""),
  });

  const observationUpdateSchema = observationCreateSchema.partial();

  app.post("/api/observations", async (req, res) => {
    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId is required" });
    const parsed = observationCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
    }
    try {
      const obs = await storage.createObservation(cpId, parsed.data);
      res.status(201).json(obs);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/observations/reorder", async (req, res) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || !orderedIds.every((id: any) => typeof id === "number")) {
      return res.status(400).json({ message: "orderedIds must be an array of numbers" });
    }
    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId) || undefined;
    await storage.reorderObservations(orderedIds, cpId);
    const obs = cpId ? await storage.getObservations(cpId) : [];
    res.json(obs);
  });

  app.put("/api/observations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const parsed = observationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
    }

    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId) || undefined;
    const obs = await storage.updateObservation(id, parsed.data, cpId);
    if (!obs) return res.status(404).json({ message: "Observation not found" });
    res.json(obs);
  });

  app.delete("/api/observations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const cpId = Number(req.query.clientPathwayId) || undefined;
    const deleted = await storage.deleteObservation(id, cpId);
    if (!deleted) return res.status(404).json({ message: "Observation not found" });
    res.json({ success: true });
  });

  app.get("/api/disposition-categories", async (req, res) => {
    const cpId = Number(req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId query param required" });
    const cats = await storage.getDispositionCategories(cpId);
    res.json(cats);
  });

  app.post("/api/disposition-categories", async (req, res) => {
    const parsed = insertDispositionCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId required" });
    const cat = await storage.createDispositionCategory(cpId, parsed.data);
    res.status(201).json(cat);
  });

  app.put("/api/disposition-categories/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId) || undefined;
    const cat = await storage.updateDispositionCategory(id, req.body, cpId);
    if (!cat) return res.status(404).json({ message: "Category not found" });
    res.json(cat);
  });

  app.delete("/api/disposition-categories/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const cpId = Number(req.query.clientPathwayId) || undefined;
    const deleted = await storage.deleteDispositionCategory(id, cpId);
    if (!deleted) return res.status(404).json({ message: "Category not found" });
    res.json({ success: true });
  });

  app.get("/api/disposition-details", async (req, res) => {
    const cpId = Number(req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId query param required" });
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const details = await storage.getDispositionDetails(cpId, categoryId);
    res.json(details);
  });

  app.post("/api/disposition-details", async (req, res) => {
    const parsed = insertDispositionDetailSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId required" });
    const det = await storage.createDispositionDetail(cpId, parsed.data);
    res.status(201).json(det);
  });

  app.put("/api/disposition-details/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId) || undefined;
    const det = await storage.updateDispositionDetail(id, req.body, cpId);
    if (!det) return res.status(404).json({ message: "Detail not found" });
    res.json(det);
  });

  app.delete("/api/disposition-details/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const cpId = Number(req.query.clientPathwayId) || undefined;
    const deleted = await storage.deleteDispositionDetail(id, cpId);
    if (!deleted) return res.status(404).json({ message: "Detail not found" });
    res.json({ success: true });
  });

  app.get("/api/call-review-items", async (req, res) => {
    try {
      const cpId = Number(req.query.clientPathwayId);
      if (!cpId) return res.status(400).json({ message: "clientPathwayId required" });
      const items = await storage.getCallReviewItems(cpId);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/call-review-items", async (req, res) => {
    try {
      const cpId = Number(req.body.clientPathwayId);
      if (!cpId) return res.status(400).json({ message: "clientPathwayId required" });
      const parsed = insertCallReviewItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      const item = await storage.createCallReviewItem(cpId, parsed.data);
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/call-review-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const cpId = Number(req.body.clientPathwayId) || undefined;
      const parsed = insertCallReviewItemSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      const item = await storage.updateCallReviewItem(id, parsed.data, cpId);
      if (!item) return res.status(404).json({ message: "Review item not found" });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/call-review-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const cpId = Number(req.query.clientPathwayId) || undefined;
      const deleted = await storage.deleteCallReviewItem(id, cpId);
      if (!deleted) return res.status(404).json({ message: "Review item not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/calls/:callId/reviews", async (req, res) => {
    try {
      const reviews = await getCallReviews(req.params.callId);
      res.json(reviews);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/calls/:callId/reviews", async (req, res) => {
    try {
      const { reviews } = req.body;
      if (!Array.isArray(reviews)) return res.status(400).json({ message: "reviews array required" });
      await upsertCallReviews(req.params.callId, reviews);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/calls/:callId/review-status", async (req, res) => {
    try {
      const { reviewStatus } = req.body;
      if (!reviewStatus || typeof reviewStatus !== "string") {
        return res.status(400).json({ message: "reviewStatus string required" });
      }
      const validStatuses = ["not_reviewed", "in_progress", "reviewed", "flagged"];
      if (!validStatuses.includes(reviewStatus)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      }
      await upsertCallReviewStatus(req.params.callId, reviewStatus);
      res.json({ success: true, reviewStatus });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/calls/:callId/review-meta", async (req, res) => {
    try {
      const { reviewStatus, tags, notes } = req.body;
      if (reviewStatus) {
        const validStatuses = ["not_reviewed", "in_progress", "reviewed", "flagged"];
        if (!validStatuses.includes(reviewStatus)) {
          return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
        }
      }
      if (tags !== undefined && (!Array.isArray(tags) || !tags.every((t: unknown) => typeof t === "string"))) {
        return res.status(400).json({ message: "tags must be an array of strings" });
      }
      if (notes !== undefined && typeof notes !== "string") {
        return res.status(400).json({ message: "notes must be a string" });
      }
      await upsertCallReviewMeta(req.params.callId, { reviewStatus, tags, notes });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/calls/review-statuses", async (req, res) => {
    try {
      const callIds = req.query.callIds ? (req.query.callIds as string).split(",") : [];
      const statuses = await getCallReviewStatusesBulk(callIds);
      res.json(statuses);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/calls/review-list", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
      const list = await getCallReviewList(limit);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/calls/:callId/reprocess", async (req, res) => {
    try {
      const callId = req.params.callId;
      const detail = await getCallDetail(callId);
      if (!detail.callInfo) {
        return res.status(404).json({ message: "Call not found" });
      }
      if (!detail.transcript) {
        return res.status(400).json({ message: "No transcript available for this call. Cannot reprocess." });
      }

      const originalBody = detail.callInfo.request_body || {};
      const reprocessBody = {
        ...originalBody,
        source_text: detail.transcript,
        source_id: callId,
        care_flow_id: detail.callInfo.care_flow_id || originalBody.care_flow_id || undefined,
        source_type: detail.callInfo.source_type || originalBody.source_type || undefined,
        client: detail.callInfo.client || originalBody.client || undefined,
        pathway: detail.callInfo.pathway || originalBody.pathway || undefined,
      };

      const fakeReq = {
        body: reprocessBody,
        headers: { "x-gwc-reprocess": "true" },
      };
      const fakeRes = {
        statusCode: 200,
        _body: null as any,
        status(code: number) { this.statusCode = code; return this; },
        json(body: any) { this._body = body; return this; },
      };

      await handleAnalyze(fakeReq, fakeRes);
      res.status(fakeRes.statusCode).json(fakeRes._body);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/context-parameters", async (req, res) => {
    const cpId = Number(req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId query param required" });
    const params = await storage.getContextParameters(cpId);
    res.json(params);
  });

  const contextParamCreateSchema = z.object({
    name: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, "Name must be lowercase snake_case (letters, numbers, underscores, starting with a letter)"),
    displayName: z.string().min(1),
    description: z.string().default(""),
    dataType: z.enum(["string", "number", "date", "boolean", "enum"]).default("string"),
    enumValues: z.array(z.string()).optional().default([]),
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).default(0),
    awellDataPointKey: z.string().optional().default(""),
    awellMappingType: z.enum(["none", "data_point", "patient_profile"]).optional().default("none"),
    awellPatientProfileField: z.string().optional().default(""),
  });

  const contextParamUpdateSchema = contextParamCreateSchema.partial();

  app.post("/api/context-parameters", async (req, res) => {
    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId is required" });
    const parsed = contextParamCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
    }
    try {
      const existing = await storage.getContextParameters(cpId);
      if (existing.some(p => p.name === parsed.data.name)) {
        return res.status(400).json({ message: `A context parameter with name "${parsed.data.name}" already exists.` });
      }
      const param = await storage.createContextParameter(cpId, parsed.data);
      res.status(201).json(param);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/context-parameters/reorder", async (req, res) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || !orderedIds.every((id: any) => typeof id === "number")) {
      return res.status(400).json({ message: "orderedIds must be an array of numbers" });
    }
    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId) || undefined;
    await storage.reorderContextParameters(orderedIds, cpId);
    const params = cpId ? await storage.getContextParameters(cpId) : [];
    res.json(params);
  });

  app.put("/api/context-parameters/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const parsed = contextParamUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
    }

    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId) || undefined;
    const param = await storage.updateContextParameter(id, parsed.data, cpId);
    if (!param) return res.status(404).json({ message: "Context parameter not found" });
    res.json(param);
  });

  app.delete("/api/context-parameters/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const cpId = Number(req.query.clientPathwayId) || undefined;
    const deleted = await storage.deleteContextParameter(id, cpId);
    if (!deleted) return res.status(404).json({ message: "Context parameter not found" });
    res.json({ success: true });
  });

  app.get("/api/client-pathways", async (_req, res) => {
    try {
      const cps = await storage.getClientPathways();
      res.json(cps);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/client-pathways/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const cp = await storage.getClientPathway(id);
      if (!cp) return res.status(404).json({ message: "Not found" });
      res.json(cp);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/client-pathways", async (req, res) => {
    const parsed = z.object({
      client: z.string().min(1, "Client is required"),
      pathway: z.string().min(1, "Pathway is required"),
      description: z.string().optional().default(""),
      gcp_project_id: z.string().optional().default(""),
      secret_key: z.string().optional().default(""),
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
    }
    try {
      const cp = await storage.createClientPathway(parsed.data);
      res.status(201).json(cp);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/client-pathways/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const parsed = z.object({
      client: z.string().min(1).optional(),
      pathway: z.string().min(1).optional(),
      description: z.string().optional(),
      gcp_project_id: z.string().optional(),
      secret_key: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
    }
    try {
      const cp = await storage.updateClientPathway(id, parsed.data);
      if (!cp) return res.status(404).json({ message: "Not found" });
      res.json(cp);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/client-pathways/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      await storage.deleteClientPathway(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/settings/summary-instruction", async (req, res) => {
    const cpId = Number(req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId query param required" });
    try {
      const stored = await storage.getSetting(cpId, "summary_instruction");
      res.json({
        instruction: stored || DEFAULT_SUMMARY_INSTRUCTION,
        isCustom: stored !== null,
        defaultInstruction: DEFAULT_SUMMARY_INSTRUCTION,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/settings/summary-instruction", async (req, res) => {
    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId is required" });
    try {
      const { instruction } = req.body;
      if (!instruction || typeof instruction !== "string" || instruction.trim().length === 0) {
        return res.status(400).json({ message: "A non-empty instruction string is required." });
      }
      await storage.setSetting(cpId, "summary_instruction", instruction.trim());
      res.json({ success: true, instruction: instruction.trim() });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/settings/summary-instruction", async (req, res) => {
    const cpId = Number(req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId query param required" });
    try {
      await storage.deleteSetting(cpId, "summary_instruction");
      res.json({ success: true, instruction: DEFAULT_SUMMARY_INSTRUCTION });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/settings/observations-guidance", async (req, res) => {
    const cpId = Number(req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId query param required" });
    try {
      const stored = await storage.getSetting(cpId, "observations_prompt_guidance");
      res.json({
        guidance: stored || "",
        isCustom: stored !== null,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/settings/observations-guidance", async (req, res) => {
    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId is required" });
    try {
      const { guidance } = req.body;
      if (typeof guidance !== "string") {
        return res.status(400).json({ message: "A guidance string is required." });
      }
      if (guidance.trim().length === 0) {
        await storage.deleteSetting(cpId, "observations_prompt_guidance");
        return res.json({ success: true, guidance: "" });
      }
      await storage.setSetting(cpId, "observations_prompt_guidance", guidance.trim());
      res.json({ success: true, guidance: guidance.trim() });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/settings/observations-guidance", async (req, res) => {
    const cpId = Number(req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId query param required" });
    try {
      await storage.deleteSetting(cpId, "observations_prompt_guidance");
      res.json({ success: true, guidance: "" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/call-qa-prompts", async (req, res) => {
    const cpId = Number(req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId query param required" });
    const prompts = await storage.getCallQAPrompts(cpId);
    res.json(prompts);
  });

  const callQACreateSchema = z.object({
    name: z.string().min(1),
    displayName: z.string().min(1),
    promptText: z.string().min(1),
    responseType: z.enum(["enum", "text", "boolean"]).default("enum"),
    responseOptions: z.array(z.string()).optional().default([]),
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).default(0),
  });

  const callQAUpdateSchema = callQACreateSchema.partial();

  app.post("/api/call-qa-prompts", async (req, res) => {
    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId is required" });
    const parsed = callQACreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
    }
    try {
      const prompt = await storage.createCallQAPrompt(cpId, parsed.data);
      res.status(201).json(prompt);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/call-qa-prompts/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const parsed = callQAUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
    }

    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId) || undefined;
    const prompt = await storage.updateCallQAPrompt(id, parsed.data, cpId);
    if (!prompt) return res.status(404).json({ message: "Call QA prompt not found" });
    res.json(prompt);
  });

  app.delete("/api/call-qa-prompts/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const cpId = Number(req.query.clientPathwayId) || undefined;
    const deleted = await storage.deleteCallQAPrompt(id, cpId);
    if (!deleted) return res.status(404).json({ message: "Call QA prompt not found" });
    res.json({ success: true });
  });

  app.get("/api/settings/barriers-guidance", async (req, res) => {
    const cpId = Number(req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId query param required" });
    try {
      const stored = await storage.getSetting(cpId, "barriers_prompt_guidance");
      res.json({
        guidance: stored || "",
        isCustom: stored !== null,
        defaultGuidance: "Extract ANY barriers to care, recovery, or well-being that the patient or caregiver mentions or that can be identified from the conversation. A barrier is anything that may prevent or hinder the patient from following their care plan, recovering properly, or accessing needed services. Include barriers that are explicitly stated AND those clearly implied. Common barrier categories include: Transportation, Financial, Medication Access, Social Support, Health Literacy, Language, Housing, Caregiver Burden, Emotional/Mental Health, Physical Limitation, Insurance/Coverage.",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/settings/barriers-guidance", async (req, res) => {
    const cpId = Number(req.body.clientPathwayId || req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId is required" });
    try {
      const { guidance } = req.body;
      if (typeof guidance !== "string") {
        return res.status(400).json({ message: "A guidance string is required." });
      }
      if (guidance.trim().length === 0) {
        await storage.deleteSetting(cpId, "barriers_prompt_guidance");
        return res.json({ success: true, guidance: "" });
      }
      await storage.setSetting(cpId, "barriers_prompt_guidance", guidance.trim());
      res.json({ success: true, guidance: guidance.trim() });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/settings/barriers-guidance", async (req, res) => {
    const cpId = Number(req.query.clientPathwayId);
    if (!cpId) return res.status(400).json({ message: "clientPathwayId query param required" });
    try {
      await storage.deleteSetting(cpId, "barriers_prompt_guidance");
      res.json({ success: true, guidance: "" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/calls", async (req, res) => {
    try {
      const rawLimit = parseInt(req.query.limit as string) || 100;
      const limit = Math.max(1, Math.min(rawLimit, 500));
      const calls = await getCallInfoList(limit);
      res.json(calls);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/calls/stats/daily", async (req, res) => {
    try {
      const rawDays = parseInt(req.query.days as string);
      const days = isNaN(rawDays) ? 30 : rawDays;
      const stats = await getCallStatsByDay(days);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/calls/:callId", async (req, res) => {
    try {
      const runIndex = req.query.run !== undefined ? Number(req.query.run) - 1 : undefined;
      const result = await getCallDetail(req.params.callId, runIndex);
      if (!result.callInfo) {
        return res.status(404).json({ message: "Call not found" });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  await initializeBatchTable();
  await ensureCallBarriersTable();
  await ensureCallQATable();

  app.get("/api/batch/tags", async (_req, res) => {
    try {
      const tags = await getDistinctTags();
      res.json(tags);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/batch/bland-calls", async (req, res) => {
    try {
      const { startDate, endDate, limit, callIds, answeredBy, minDuration, maxDuration, requiredTags, excludeTags, processedFilter } = req.query;
      const filters: any = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (limit) filters.limit = parseInt(limit as string);
      if (callIds) filters.callIds = (callIds as string).split(",").map(s => s.trim());
      if (answeredBy) filters.answeredBy = answeredBy;
      if (minDuration) filters.minDuration = parseFloat(minDuration as string);
      if (maxDuration) filters.maxDuration = parseFloat(maxDuration as string);
      if (requiredTags) filters.requiredTags = (requiredTags as string).split(",").map(s => s.trim());
      if (excludeTags) filters.excludeTags = (excludeTags as string).split(",").map(s => s.trim());
      if (processedFilter && ["unprocessed", "processed", "all"].includes(processedFilter as string)) {
        filters.processedFilter = processedFilter;
      }

      const calls = await queryBlandCalls(filters);
      res.json(calls);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/batch/load", async (req, res) => {
    try {
      const { callIds, batchLabel, useKnownContext, careFlowIds } = req.body;
      if (!callIds || !Array.isArray(callIds) || callIds.length === 0) {
        return res.status(400).json({ message: "callIds array is required" });
      }

      let contextByCareFlow: Record<string, Record<string, string>> | undefined;
      if (useKnownContext && careFlowIds && careFlowIds.length > 0) {
        const loadCpId = Number(req.body.clientPathwayId) || null;
        let resolvedLoadCpId = loadCpId;
        if (!resolvedLoadCpId) {
          const allCPs = await storage.getClientPathways();
          if (allCPs.length > 0) resolvedLoadCpId = allCPs[0].id;
        }
        if (!resolvedLoadCpId) {
          return res.status(400).json({ message: "No client/pathway configuration found." });
        }
        const contextParams = await storage.getActiveContextParameters(resolvedLoadCpId);
        const paramsWithMapping = contextParams
          .filter(p =>
            (p.awellMappingType === "data_point" && p.awellDataPointKey && p.awellDataPointKey.trim().length > 0) ||
            (p.awellMappingType === "patient_profile" && p.awellPatientProfileField && p.awellPatientProfileField.trim().length > 0) ||
            (!p.awellMappingType && p.awellDataPointKey && p.awellDataPointKey.trim().length > 0)
          )
          .map(p => ({ name: p.name, awellDataPointKey: p.awellDataPointKey, awellMappingType: p.awellMappingType, awellPatientProfileField: p.awellPatientProfileField }));
        if (paramsWithMapping.length > 0) {
          contextByCareFlow = await fetchAwellContextForCareFlows(careFlowIds, paramsWithMapping);
          console.log(`Fetched Awell context for ${Object.keys(contextByCareFlow).length} care flows across ${paramsWithMapping.length} mapped parameters`);
        }
      }

      const result = await loadBlandCallsToBatch(callIds, batchLabel || null, contextByCareFlow);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/batch/items", async (req, res) => {
    try {
      const { status, batchLabel, limit } = req.query;
      const filters: any = {};
      if (status) filters.status = status;
      if (batchLabel) filters.batchLabel = batchLabel;
      if (limit) filters.limit = parseInt(limit as string);

      const items = await getBatchItems(filters);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/batch/summary", async (_req, res) => {
    try {
      const summary = await getBatchSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  interface BatchJobState {
    jobId: string;
    status: "running" | "completed" | "failed";
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    startedAt: string;
    finishedAt?: string;
    errors: { callId: string; error: string }[];
  }
  const activeBatchJobs = new Map<string, BatchJobState>();

  app.get("/api/batch/job-status", (req, res) => {
    const jobId = req.query.jobId as string;
    if (jobId) {
      const job = activeBatchJobs.get(jobId);
      if (!job) return res.status(404).json({ message: "Job not found" });
      return res.json(job);
    }
    const running = Array.from(activeBatchJobs.values()).filter(j => j.status === "running");
    const recent = Array.from(activeBatchJobs.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 5);
    res.json({ running, recent });
  });

  app.post("/api/batch/process", async (req, res) => {
    try {
      const batchSize = parseInt(req.query.limit as string) || 5;
      const batchId = req.query.batchId as string | undefined;
      const pendingItems = await getPendingBatchItems(batchSize, batchId);

      if (pendingItems.length === 0) {
        return res.json({ processed: 0, message: "No pending items", background: false });
      }

      const batchCpId = Number(req.query.clientPathwayId) || null;
      let resolvedBatchCpId = batchCpId;
      if (!resolvedBatchCpId) {
        const allCPs = await storage.getClientPathways();
        if (allCPs.length > 0) resolvedBatchCpId = allCPs[0].id;
      }
      if (!resolvedBatchCpId) {
        return res.status(400).json({ message: "No client/pathway configuration found." });
      }
      const batchCPRecord = await storage.getClientPathway(resolvedBatchCpId);

      const activeObs = await storage.getActiveObservations(resolvedBatchCpId);
      const summaryInstruction = await storage.getSetting(resolvedBatchCpId, "summary_instruction");
      const observationsGuidance = await storage.getSetting(resolvedBatchCpId, "observations_prompt_guidance");
      const barriersGuidance = await storage.getSetting(resolvedBatchCpId, "barriers_prompt_guidance");
      const contextParams = await storage.getActiveContextParameters(resolvedBatchCpId);
      const callQAPromptsForBatch = await storage.getActiveCallQAPrompts(resolvedBatchCpId);
      const batchDispCats = await storage.getDispositionCategories(resolvedBatchCpId);
      const batchDispDets = await storage.getDispositionDetails(resolvedBatchCpId);
      const batchDispConfig: DispositionConfig = { categories: batchDispCats, details: batchDispDets };
      console.log(`Batch job: disposition config loaded — ${batchDispCats.length} categories, ${batchDispDets.length} details for CP ${resolvedBatchCpId}`);
      const { prompt: _p, promptVersion, promptVersionDate } = await getPromptWithVersion(resolvedBatchCpId);

      const jobId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const jobState: BatchJobState = {
        jobId,
        status: "running",
        total: pendingItems.length,
        completed: 0,
        failed: 0,
        skipped: 0,
        startedAt: new Date().toISOString(),
        errors: [],
      };
      activeBatchJobs.set(jobId, jobState);

      res.json({
        background: true,
        jobId,
        total: pendingItems.length,
        message: `Processing ${pendingItems.length} calls in the background`,
      });

      (async () => {
        try {
          for (let idx = 0; idx < pendingItems.length; idx++) {
            const item = pendingItems[idx];
            const callId = item.bland_call_id;

            try {
              await updateBatchItemStatus(callId, "processing");
            } catch (claimErr: any) {
              console.error(`Batch job ${jobId}: failed to claim ${callId}: ${claimErr.message}`);
              jobState.skipped++;
              continue;
            }

            try {
              const startTime = Date.now();
              let batchContext: Record<string, string> = {};
              if (item.context_values) {
                try { batchContext = JSON.parse(item.context_values); } catch {}
              }
              const { analysis, tokenUsage } = await analyzeTranscript(
                callId,
                item.transcript.trim(),
                activeObs,
                undefined,
                summaryInstruction || undefined,
                contextParams,
                batchContext,
                observationsGuidance || undefined,
                barriersGuidance || undefined,
                callQAPromptsForBatch,
                batchDispConfig,
              );
              const processingTimeMs = Date.now() - startTime;

              const processedAt = new Date().toISOString();
              const blandTs = item.bland_created_at?.value || item.bland_created_at || null;
              const callDate = blandTs ? new Date(blandTs).toISOString() : null;
              await insertCallInfo({
                callId,
                careFlowId: item.care_flow_id || null,
                callDate,
                sourceType: item.source_type || "bland_call",
                sourceId: callId,
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
                requestBody: JSON.stringify({ batch_id: item.batch_id, bland_call_id: callId }),
                responseJson: JSON.stringify(analysis),
                client: batchCPRecord?.client || null,
                pathway: batchCPRecord?.pathway || null,
              });

              await insertCallObservations(callId, analysis.observations);
              await insertCallQAPairs(callId, analysis.qa_pairs);
              await insertCallBarriers(callId, analysis.barriers);
              await insertCallQAResults(callId, analysis.call_qa || []);
              if (analysis.disposition) {
                console.log(`Batch job ${jobId}: ${callId} has disposition: ${analysis.disposition.disposition_category} / ${analysis.disposition.disposition_detail}`);
                await insertCallDisposition(callId, analysis.disposition);
              } else {
                console.log(`Batch job ${jobId}: ${callId} — NO disposition returned by Gemini`);
              }
              await updateBatchItemStatus(callId, "completed", callId);
              jobState.completed++;
              console.log(`Batch job ${jobId}: [${idx + 1}/${pendingItems.length}] ${callId} completed (${processingTimeMs}ms)`);
            } catch (err: any) {
              try { await updateBatchItemStatus(callId, "failed", undefined, err.message); } catch {}
              jobState.failed++;
              jobState.errors.push({ callId, error: err.message });
              console.error(`Batch job ${jobId}: [${idx + 1}/${pendingItems.length}] ${callId} failed: ${err.message}`);
            }
          }
          jobState.status = "completed";
        } catch (err: any) {
          jobState.status = "failed";
          console.error("Batch job failed:", err.message || err);
          console.error("Batch job stack:", err.stack);
        }
        jobState.finishedAt = new Date().toISOString();
        console.log(`Batch job ${jobId} finished: ${jobState.completed} completed, ${jobState.failed} failed, ${jobState.skipped} skipped out of ${jobState.total}`);
        setTimeout(() => activeBatchJobs.delete(jobId), 30 * 60 * 1000);
      })();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/batch/reset-failed", async (req, res) => {
    try {
      const { batchId } = req.body;
      const count = await resetFailedBatchItems(batchId);
      res.json({ reset: count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/batch/delete-pending", async (req, res) => {
    try {
      const count = await deletePendingBatchItems();
      res.json({ deleted: count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/batch/recreate", async (req, res) => {
    try {
      const { batchId } = req.body;
      if (!batchId) return res.status(400).json({ message: "batchId required" });
      const result = await recreateBatch(batchId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/batch/trigger-job", async (req, res) => {
    try {
      const projectId = process.env.GCP_PROJECT_ID;
      if (!projectId) {
        return res.status(500).json({ message: "GCP_PROJECT_ID not configured" });
      }

      const region = "us-central1";
      const jobName = "guideway-batch-job";
      const batchSize = req.body.batchSize || 50;
      const clientPathwayId = req.body.clientPathwayId || null;

      const saKeyRaw = process.env.GCP_SERVICE_ACCOUNT_KEY;
      if (!saKeyRaw) {
        return res.status(500).json({ message: "GCP service account key not configured" });
      }
      const saKey = JSON.parse(saKeyRaw);

      const { GoogleAuth } = await import("google-auth-library");
      const auth = new GoogleAuth({
        credentials: saKey,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
      const authClient = await auth.getClient();
      const tokenResponse = await authClient.getAccessToken();
      const accessToken = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;

      const envOverrides = [
        { name: "BATCH_SIZE", value: String(batchSize) },
      ];
      if (clientPathwayId) {
        envOverrides.push({ name: "CLIENT_PATHWAY_ID", value: String(clientPathwayId) });
      }

      const overrides: Record<string, any> = {
        containerOverrides: [{ env: envOverrides }],
      };

      const url = `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/jobs/${jobName}:run`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ overrides }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error("Cloud Run Jobs API error:", response.status, errBody);
        return res.status(response.status).json({
          message: `Failed to trigger batch job: ${response.statusText}`,
          detail: errBody,
        });
      }

      const result = await response.json();
      const executionName = result.metadata?.name || result.name || "unknown";

      res.json({
        triggered: true,
        executionName,
        batchSize,
        message: `Batch job triggered on GCP. It will process up to ${batchSize} pending items independently.`,
      });
    } catch (error: any) {
      console.error("Failed to trigger batch job:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/batch/job-status", async (req, res) => {
    try {
      const projectId = process.env.GCP_PROJECT_ID;
      if (!projectId) {
        return res.status(500).json({ message: "GCP_PROJECT_ID not configured" });
      }

      const region = "us-central1";
      const jobName = "guideway-batch-job";
      const executionName = req.query.executionName as string | undefined;

      const saKeyRaw = process.env.GCP_SERVICE_ACCOUNT_KEY;
      if (!saKeyRaw) {
        return res.status(500).json({ message: "GCP service account key not configured" });
      }
      const saKey = JSON.parse(saKeyRaw);

      const { GoogleAuth } = await import("google-auth-library");
      const auth = new GoogleAuth({
        credentials: saKey,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
      const authClient = await auth.getClient();
      const tokenResponse = await authClient.getAccessToken();
      const accessToken = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;

      let url: string;
      if (executionName) {
        url = `https://run.googleapis.com/v2/${executionName}`;
      } else {
        url = `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/jobs/${jobName}/executions?pageSize=5`;
      }

      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errBody = await response.text();
        return res.status(response.status).json({ message: errBody });
      }

      const data = await response.json();

      function parseExecutionState(exec: any): string {
        const conditions = exec.conditions || [];
        for (const c of conditions) {
          if (c.type === "Completed" && c.state === "CONDITION_SUCCEEDED") return "SUCCEEDED";
          if (c.type === "Completed" && c.state === "CONDITION_FAILED") return "FAILED";
          if (c.state === "CONDITION_RECONCILING") return "RUNNING";
        }
        if (exec.completionTime) return "SUCCEEDED";
        if (exec.startTime && !exec.completionTime) return "RUNNING";
        return "PENDING";
      }

      if (executionName) {
        res.json({
          name: data.name,
          state: parseExecutionState(data),
          createTime: data.createTime,
          completionTime: data.completionTime || null,
          failedCount: data.failedCount || 0,
          succeededCount: data.succeededCount || 0,
        });
      } else {
        const executions = (data.executions || []).map((e: any) => ({
          name: e.name,
          state: parseExecutionState(e),
          createTime: e.createTime,
          completionTime: e.completionTime || null,
          failedCount: e.failedCount || 0,
          succeededCount: e.succeededCount || 0,
        }));
        res.json({ executions });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        gemini: !!process.env.GCP_SERVICE_ACCOUNT_KEY,
        bigquery: !!process.env.GCP_SERVICE_ACCOUNT_KEY,
        projectId: !!process.env.GCP_PROJECT_ID,
      },
    });
  });

  return httpServer;
}
