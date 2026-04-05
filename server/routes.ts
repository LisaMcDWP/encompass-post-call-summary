import type { Express } from "express";
import { createServer, type Server } from "http";
import { analyzeTranscript, buildPromptTemplate, DEFAULT_SUMMARY_INSTRUCTION, aiObservationAssistant } from "./gemini";
import { insertCallInfo, insertCallObservations, insertCallQAPairs, insertCallBarriers, insertCallQAResults, ensureCallBarriersTable, ensureCallQATable, getCallBarriers, getCallInfoList, getCallDetail, queryBlandCalls, loadBlandCallsToBatch, fetchAwellContextForCareFlows, getBatchItems, getBatchSummary, initializeBatchTable, getPendingBatchItems, updateBatchItemStatus, resetFailedBatchItems, recreateBatch, getDistinctTags } from "./bigquery";
import { randomUUID, createHash } from "crypto";
import { storage } from "./storage";
import { insertObservationSchema, enumValueSchema, insertContextParameterSchema, insertCallQAPromptSchema } from "@shared/schema";
import { z } from "zod";

async function getPromptWithVersion() {
  const activeObs = await storage.getActiveObservations();
  const summaryInstruction = await storage.getSetting("summary_instruction");
  const observationsGuidance = await storage.getSetting("observations_prompt_guidance");
  const barriersGuidance = await storage.getSetting("barriers_prompt_guidance");
  const contextParams = await storage.getActiveContextParameters();
  const callQAPrompts = await storage.getActiveCallQAPrompts();
  const prompt = buildPromptTemplate(activeObs, summaryInstruction || undefined, contextParams, observationsGuidance || undefined, barriersGuidance || undefined, callQAPrompts);

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/prompt", async (_req, res) => {
    const { prompt, promptVersion, promptVersionDate } = await getPromptWithVersion();
    res.json({ prompt, promptVersion, promptVersionDate });
  });

  async function handleAnalyze(req: any, res: any) {
    const startTime = Date.now();
    const { care_flow_id, processed_datetime, source_type, source_id, source_text, context, ...rest } = req.body;
    const { source_text: _omit, ...requestMeta } = req.body;
    const requestBodyJson = JSON.stringify(requestMeta);

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

    try {
      const { prompt: _promptText, promptVersion, promptVersionDate } = await getPromptWithVersion();
      const activeObs = await storage.getActiveObservations();
      const summaryInstruction = await storage.getSetting("summary_instruction");
      const observationsGuidance = await storage.getSetting("observations_prompt_guidance");
      const barriersGuidance = await storage.getSetting("barriers_prompt_guidance");
      const contextParams = await storage.getActiveContextParameters();

      const contextValues: Record<string, string> = {};
      const contextSource = (context && typeof context === "object") ? context : rest;
      for (const param of contextParams) {
        if (contextSource[param.name] !== undefined && contextSource[param.name] !== null) {
          contextValues[param.name] = String(contextSource[param.name]);
        }
      }

      const callQAPrompts = await storage.getActiveCallQAPrompts();

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
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (body?.data?.analysis) {
        const { transition_status, follow_up_areas, ...restAnalysis } = body.data.analysis;
        body = {
          ...body,
          data: {
            ...body.data,
            analysis: {
              ...restAnalysis,
              observations_summary_formatted: transition_status,
              followup_formatted: follow_up_areas,
            },
          },
        };
      }
      return originalJson(body);
    };
    return handleAnalyze(req, res);
  });

  app.post("/api/observations/ai-suggest", async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }
      const observations = await storage.getObservations();
      const response = await aiObservationAssistant(observations, message, history || []);
      return res.json({ response });
    } catch (error: any) {
      console.error("AI observation assistant error:", error.message);
      return res.status(500).json({ error: "AI assistant failed: " + error.message });
    }
  });

  app.get("/api/observations", async (_req, res) => {
    const obs = await storage.getObservations();
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
    const parsed = observationCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
    }
    try {
      const obs = await storage.createObservation(parsed.data);
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
    await storage.reorderObservations(orderedIds);
    const obs = await storage.getObservations();
    res.json(obs);
  });

  app.put("/api/observations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const parsed = observationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
    }

    const obs = await storage.updateObservation(id, parsed.data);
    if (!obs) return res.status(404).json({ message: "Observation not found" });
    res.json(obs);
  });

  app.delete("/api/observations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const deleted = await storage.deleteObservation(id);
    if (!deleted) return res.status(404).json({ message: "Observation not found" });
    res.json({ success: true });
  });

  app.get("/api/context-parameters", async (_req, res) => {
    const params = await storage.getContextParameters();
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
  });

  const contextParamUpdateSchema = contextParamCreateSchema.partial();

  app.post("/api/context-parameters", async (req, res) => {
    const parsed = contextParamCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
    }
    try {
      const existing = await storage.getContextParameters();
      if (existing.some(p => p.name === parsed.data.name)) {
        return res.status(400).json({ message: `A context parameter with name "${parsed.data.name}" already exists.` });
      }
      const param = await storage.createContextParameter(parsed.data);
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
    await storage.reorderContextParameters(orderedIds);
    const params = await storage.getContextParameters();
    res.json(params);
  });

  app.put("/api/context-parameters/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const parsed = contextParamUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
    }

    const param = await storage.updateContextParameter(id, parsed.data);
    if (!param) return res.status(404).json({ message: "Context parameter not found" });
    res.json(param);
  });

  app.delete("/api/context-parameters/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const deleted = await storage.deleteContextParameter(id);
    if (!deleted) return res.status(404).json({ message: "Context parameter not found" });
    res.json({ success: true });
  });

  app.get("/api/settings/summary-instruction", async (_req, res) => {
    try {
      const stored = await storage.getSetting("summary_instruction");
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
    try {
      const { instruction } = req.body;
      if (!instruction || typeof instruction !== "string" || instruction.trim().length === 0) {
        return res.status(400).json({ message: "A non-empty instruction string is required." });
      }
      await storage.setSetting("summary_instruction", instruction.trim());
      res.json({ success: true, instruction: instruction.trim() });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/settings/summary-instruction", async (_req, res) => {
    try {
      const client = (await import("@google-cloud/bigquery")).BigQuery;
      const raw = process.env.GCP_SERVICE_ACCOUNT_KEY;
      const projectId = process.env.GCP_PROJECT_ID;
      if (!raw || !projectId) throw new Error("GCP credentials not set");
      const bq = new client({ projectId, credentials: JSON.parse(raw) });
      await bq.query({
        query: `DELETE FROM \`${projectId}.call_information.settings\` WHERE key = @key`,
        params: { key: "summary_instruction" },
      });
      res.json({ success: true, instruction: DEFAULT_SUMMARY_INSTRUCTION });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/settings/observations-guidance", async (_req, res) => {
    try {
      const stored = await storage.getSetting("observations_prompt_guidance");
      res.json({
        guidance: stored || "",
        isCustom: stored !== null,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/settings/observations-guidance", async (req, res) => {
    try {
      const { guidance } = req.body;
      if (typeof guidance !== "string") {
        return res.status(400).json({ message: "A guidance string is required." });
      }
      if (guidance.trim().length === 0) {
        const client = (await import("@google-cloud/bigquery")).BigQuery;
        const raw = process.env.GCP_SERVICE_ACCOUNT_KEY;
        const projectId = process.env.GCP_PROJECT_ID;
        if (!raw || !projectId) throw new Error("GCP credentials not set");
        const bq = new client({ projectId, credentials: JSON.parse(raw) });
        await bq.query({
          query: `DELETE FROM \`${projectId}.call_information.settings\` WHERE key = @key`,
          params: { key: "observations_prompt_guidance" },
        });
        return res.json({ success: true, guidance: "" });
      }
      await storage.setSetting("observations_prompt_guidance", guidance.trim());
      res.json({ success: true, guidance: guidance.trim() });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/settings/observations-guidance", async (_req, res) => {
    try {
      const client = (await import("@google-cloud/bigquery")).BigQuery;
      const raw = process.env.GCP_SERVICE_ACCOUNT_KEY;
      const projectId = process.env.GCP_PROJECT_ID;
      if (!raw || !projectId) throw new Error("GCP credentials not set");
      const bq = new client({ projectId, credentials: JSON.parse(raw) });
      await bq.query({
        query: `DELETE FROM \`${projectId}.call_information.settings\` WHERE key = @key`,
        params: { key: "observations_prompt_guidance" },
      });
      res.json({ success: true, guidance: "" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/call-qa-prompts", async (_req, res) => {
    const prompts = await storage.getCallQAPrompts();
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
    const parsed = callQACreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
    }
    try {
      const prompt = await storage.createCallQAPrompt(parsed.data);
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

    const prompt = await storage.updateCallQAPrompt(id, parsed.data);
    if (!prompt) return res.status(404).json({ message: "Call QA prompt not found" });
    res.json(prompt);
  });

  app.delete("/api/call-qa-prompts/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const deleted = await storage.deleteCallQAPrompt(id);
    if (!deleted) return res.status(404).json({ message: "Call QA prompt not found" });
    res.json({ success: true });
  });

  app.get("/api/settings/barriers-guidance", async (_req, res) => {
    try {
      const stored = await storage.getSetting("barriers_prompt_guidance");
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
    try {
      const { guidance } = req.body;
      if (typeof guidance !== "string") {
        return res.status(400).json({ message: "A guidance string is required." });
      }
      if (guidance.trim().length === 0) {
        const client = (await import("@google-cloud/bigquery")).BigQuery;
        const raw = process.env.GCP_SERVICE_ACCOUNT_KEY;
        const projectId = process.env.GCP_PROJECT_ID;
        if (!raw || !projectId) throw new Error("GCP credentials not set");
        const bq = new client({ projectId, credentials: JSON.parse(raw) });
        await bq.query({
          query: `DELETE FROM \`${projectId}.call_information.settings\` WHERE key = @key`,
          params: { key: "barriers_prompt_guidance" },
        });
        return res.json({ success: true, guidance: "" });
      }
      await storage.setSetting("barriers_prompt_guidance", guidance.trim());
      res.json({ success: true, guidance: guidance.trim() });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/settings/barriers-guidance", async (_req, res) => {
    try {
      const client = (await import("@google-cloud/bigquery")).BigQuery;
      const raw = process.env.GCP_SERVICE_ACCOUNT_KEY;
      const projectId = process.env.GCP_PROJECT_ID;
      if (!raw || !projectId) throw new Error("GCP credentials not set");
      const bq = new client({ projectId, credentials: JSON.parse(raw) });
      await bq.query({
        query: `DELETE FROM \`${projectId}.call_information.settings\` WHERE key = @key`,
        params: { key: "barriers_prompt_guidance" },
      });
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
        const contextParams = await storage.getActiveContextParameters();
        const paramsWithKeys = contextParams
          .filter(p => p.awellDataPointKey && p.awellDataPointKey.trim().length > 0)
          .map(p => ({ name: p.name, awellDataPointKey: p.awellDataPointKey }));
        if (paramsWithKeys.length > 0) {
          contextByCareFlow = await fetchAwellContextForCareFlows(careFlowIds, paramsWithKeys);
          console.log(`Fetched Awell context for ${Object.keys(contextByCareFlow).length} care flows across ${paramsWithKeys.length} data points`);
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

      for (const item of pendingItems) {
        const claimed = await updateBatchItemStatus(item.bland_call_id, "processing");
        if (claimed === 0) {
          results.push({ callId: item.bland_call_id, status: "skipped" });
          continue;
        }

        try {
          const activeObs = await storage.getActiveObservations();
          const summaryInstruction = await storage.getSetting("summary_instruction");
          const observationsGuidance = await storage.getSetting("observations_prompt_guidance");
          const barriersGuidance = await storage.getSetting("barriers_prompt_guidance");
          const contextParams = await storage.getActiveContextParameters();
          const callQAPromptsForBatch = await storage.getActiveCallQAPrompts();
          const { prompt: _p, promptVersion, promptVersionDate } = await getPromptWithVersion();

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
          await insertCallInfo({
            callId: callId,
            careFlowId: item.care_flow_id || null,
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
