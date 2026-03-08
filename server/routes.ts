import type { Express } from "express";
import { createServer, type Server } from "http";
import { analyzeTranscript, buildPromptTemplate, DEFAULT_SUMMARY_INSTRUCTION } from "./gemini";
import { logTooBigQuery } from "./bigquery";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { insertObservationSchema, enumValueSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/prompt", async (_req, res) => {
    const activeObs = await storage.getActiveObservations();
    const summaryInstruction = await storage.getSetting("summary_instruction");
    const prompt = buildPromptTemplate(activeObs, summaryInstruction || undefined);
    res.json({ prompt });
  });

  app.post("/api/analyze", async (req, res) => {
    const startTime = Date.now();
    const { care_flow_id, interaction_datetime, source_type, source_id, source_text } = req.body;

    if (!source_text || typeof source_text !== "string" || source_text.trim().length === 0) {
      const processingTime = Date.now() - startTime;
      const logId = source_id || care_flow_id || `call_${randomUUID().slice(0, 12)}`;
      await logTooBigQuery({
        callId: logId,
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
      const activeObs = await storage.getActiveObservations();
      const summaryInstruction = await storage.getSetting("summary_instruction");
      const { analysis } = await analyzeTranscript(
        resolvedSourceId,
        source_text.trim(),
        activeObs,
        undefined,
        summaryInstruction || undefined
      );
      const processingTime = Date.now() - startTime;

      await logTooBigQuery({
        callId: resolvedSourceId,
        transcriptLength: source_text.length,
        summary: analysis.summary,
        areasForFollowUp: [analysis.follow_up_areas],
        questionsCount: 0,
        processingTimeMs: processingTime,
        status: "success",
      });

      return res.json({
        status: "success",
        data: {
          care_flow_id: care_flow_id || null,
          interaction_datetime: interaction_datetime || new Date().toISOString(),
          source_type: source_type || null,
          source_id: resolvedSourceId,
          processedAt: new Date().toISOString(),
          processingTimeMs: processingTime,
          analysis,
        },
      });
    } catch (error: any) {
      const processingTime = Date.now() - startTime;

      await logTooBigQuery({
        callId: resolvedSourceId,
        transcriptLength: source_text.length,
        processingTimeMs: processingTime,
        status: "error",
        errorMessage: error.message,
      });

      console.error("Transcript analysis failed:", error);

      return res.status(500).json({
        status: "error",
        message: "Failed to analyze transcript. " + error.message,
      });
    }
  });

  app.get("/api/observations", async (_req, res) => {
    const obs = await storage.getObservations();
    res.json(obs);
  });

  const observationCreateSchema = z.object({
    name: z.string().min(1),
    displayName: z.string().min(1),
    domain: z.string().min(1),
    displayOrder: z.number().int().min(0),
    valueType: z.enum(["enum", "boolean", "text", "number"]),
    value: z.array(enumValueSchema).default([]),
    isActive: z.boolean().default(true),
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
