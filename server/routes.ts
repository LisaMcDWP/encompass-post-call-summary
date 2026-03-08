import type { Express } from "express";
import { createServer, type Server } from "http";
import { analyzeTranscript, DEFAULT_PROMPT_TEMPLATE } from "./gemini";
import { logTooBigQuery } from "./bigquery";
import { randomUUID } from "crypto";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/prompt", (_req, res) => {
    res.json({ prompt: DEFAULT_PROMPT_TEMPLATE });
  });

  app.post("/api/analyze", async (req, res) => {
    const startTime = Date.now();
    const { record_context, care_flow_id, interaction_datetime, source_type, source_id, source_text } = req.body;

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
      const { analysis } = await analyzeTranscript(
        resolvedSourceId,
        source_text.trim()
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
          record_context: record_context || null,
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
