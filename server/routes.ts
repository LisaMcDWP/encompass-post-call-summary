import type { Express } from "express";
import { createServer, type Server } from "http";
import { analyzeTranscript, analyzeTranscriptFast, analyzeTranscriptBackground, buildPromptTemplate, DEFAULT_SUMMARY_INSTRUCTION, aiObservationAssistant } from "./gemini";
import { insertCallInfo, insertCallObservations, insertCallQAPairs, insertCallBarriers, insertCallQAResults, ensureCallBarriersTable, ensureCallQATable, getCallBarriers, getCallInfoList, getCallDetail, getCallStatsByDay, queryBlandCalls, loadBlandCallsToBatch, fetchAwellContextForCareFlows, getBatchItems, getBatchSummary, initializeBatchTable, getPendingBatchItems, updateBatchItemStatus, resetFailedBatchItems, deletePendingBatchItems, recreateBatch, getDistinctTags } from "./bigquery";
import { randomUUID, createHash } from "crypto";
import { storage } from "./storage";
import { insertObservationSchema, enumValueSchema, insertContextParameterSchema, insertCallQAPromptSchema } from "@shared/schema";
import { z } from "zod";

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
        callQAPrompts
      );
      const processingTime = Date.now() - startTime;

      const processedAt = new Date().toISOString();

      await insertCallInfo({
        callId: resolvedSourceId,
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
      return res.status(400).json({ status: "error", message: "A non-empty source_text string is required." });
    }

    const resolvedSourceId = source_id || `call_${randomUUID().slice(0, 12)}`;
    const clientPathwayId = req.body.client_pathway_id ? Number(req.body.client_pathway_id) : null;

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

      const { analysis: fastAnalysis, tokenUsage: fastTokenUsage } = await analyzeTranscriptFast(
        resolvedSourceId, source_text.trim(), activeObs,
        summaryInstruction || undefined, contextParams, contextValues,
        observationsGuidance || undefined, barriersGuidance || undefined,
      );
      const processingTime = Date.now() - startTime;
      console.log(`[AWELL] Fast Gemini completed for ${resolvedSourceId} in ${processingTime}ms — responding to Awell now`);

      const responseBody = {
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
          analysis: {
            summary: fastAnalysis.summary,
            observations: fastAnalysis.observations,
            barriers: fastAnalysis.barriers,
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
            resolvedSourceId, source_text.trim(), activeObs, callQAPrompts
          );
          const bgTime = Date.now() - bgStart;
          console.log(`[AWELL-BG] Background Gemini completed for ${resolvedSourceId} in ${bgTime}ms (${bgResult.qa_pairs.length} qa_pairs, ${bgResult.call_qa.length} call_qa)`);

          const fullAnalysis = {
            ...fastAnalysis,
            qa_pairs: bgResult.qa_pairs,
            call_qa: bgResult.call_qa,
          };

          const combinedTokenUsage = {
            promptTokens: fastTokenUsage.promptTokens + bgResult.tokenUsage.promptTokens,
            completionTokens: fastTokenUsage.completionTokens + bgResult.tokenUsage.completionTokens,
            totalTokens: fastTokenUsage.totalTokens + bgResult.tokenUsage.totalTokens,
            estimatedCost: fastTokenUsage.estimatedCost + bgResult.tokenUsage.estimatedCost,
          };

          await Promise.all([
            insertCallInfo({
              callId: resolvedSourceId, careFlowId: care_flow_id || null,
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
            insertCallBarriers(resolvedSourceId, fullAnalysis.barriers || []),
            insertCallQAResults(resolvedSourceId, bgResult.call_qa),
          ]);
          console.log(`[AWELL-BG] All BigQuery writes completed for ${resolvedSourceId}`);
        } catch (bgErr: any) {
          console.error(`[AWELL-BG] Background processing FAILED for ${resolvedSourceId}:`, bgErr.message);
          insertCallInfo({
            callId: resolvedSourceId, careFlowId: care_flow_id || null,
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
          }),
          insertCallObservations(resolvedSourceId, fastAnalysis.observations || []).catch(() => {}),
          insertCallBarriers(resolvedSourceId, fastAnalysis.barriers || []).catch(() => {}),
          console.error(`[AWELL-BG] Saved partial results (fast-only) for ${resolvedSourceId}`);
        }
      })();

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      insertCallInfo({
        callId: resolvedSourceId, processedAt: new Date().toISOString(),
        processingTimeMs: processingTime, transcriptLength: source_text.length,
        status: "error", errorMessage: error.message,
        requestBody: requestBodyJson, requestHeaders: requestHeadersJson,
      }).catch(() => {});
      console.error("Transcript analysis failed:", error);
      return res.status(500).json({ status: "error", message: "Failed to analyze transcript. " + error.message });
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
      const result = await getCallDetail(req.params.callId);
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

  app.post("/api/batch/process", async (req, res) => {
    try {
      const batchSize = parseInt(req.query.limit as string) || 5;
      const batchId = req.query.batchId as string | undefined;
      const pendingItems = await getPendingBatchItems(batchSize, batchId);

      if (pendingItems.length === 0) {
        return res.json({ processed: 0, message: "No pending items" });
      }

      const results: { callId: string; status: string; error?: string }[] = [];
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
      const { prompt: _p, promptVersion, promptVersionDate } = await getPromptWithVersion(resolvedBatchCpId);

      const CONCURRENCY = 5;

      async function processOneItem(item: any) {
        const claimed = await updateBatchItemStatus(item.bland_call_id, "processing");
        if (claimed === 0) {
          results.push({ callId: item.bland_call_id, status: "skipped" });
          return;
        }

        try {
          const callId = item.bland_call_id;
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
            callQAPromptsForBatch
          );
          const processingTimeMs = Date.now() - startTime;

          const processedAt = new Date().toISOString();
          const blandTs = item.bland_created_at?.value || item.bland_created_at || null;
          const callDate = blandTs ? new Date(blandTs).toISOString() : null;
          await insertCallInfo({
            callId: callId,
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
            requestBody: JSON.stringify({ batch_id: item.batch_id, bland_call_id: item.bland_call_id }),
            responseJson: JSON.stringify(analysis),
            client: batchCPRecord?.client || null,
            pathway: batchCPRecord?.pathway || null,
          });

          await insertCallObservations(callId, analysis.observations);
          await insertCallQAPairs(callId, analysis.qa_pairs);
          await insertCallBarriers(callId, analysis.barriers);
          await insertCallQAResults(callId, analysis.call_qa || []);
          await updateBatchItemStatus(item.bland_call_id, "completed", callId);
          results.push({ callId: item.bland_call_id, status: "completed" });
        } catch (err: any) {
          await updateBatchItemStatus(item.bland_call_id, "failed", undefined, err.message);
          results.push({ callId: item.bland_call_id, status: "failed", error: err.message });
        }
      }

      for (let i = 0; i < pendingItems.length; i += CONCURRENCY) {
        const chunk = pendingItems.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(processOneItem));
      }

      res.json({ processed: results.length, results });
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
