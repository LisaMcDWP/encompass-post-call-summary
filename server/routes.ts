import type { Express } from "express";
import { createServer, type Server } from "http";
import { analyzeTranscript } from "./gemini";
import { logTooBigQuery } from "./bigquery";
import { randomUUID } from "crypto";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/analyze", async (req, res) => {
    const startTime = Date.now();
    const { callId, transcript } = req.body;

    const resolvedCallId = callId || `call_${randomUUID().slice(0, 12)}`;

    if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
      const processingTime = Date.now() - startTime;
      await logTooBigQuery({
        callId: resolvedCallId,
        transcriptLength: 0,
        processingTimeMs: processingTime,
        status: "error",
        errorMessage: "Missing or empty transcript",
      });

      return res.status(400).json({
        status: "error",
        message: "A non-empty transcript string is required.",
      });
    }

    try {
      const analysis = await analyzeTranscript(resolvedCallId, transcript.trim());
      const processingTime = Date.now() - startTime;

      await logTooBigQuery({
        callId: resolvedCallId,
        transcriptLength: transcript.length,
        summary: analysis.summary,
        areasForFollowUp: analysis.areasForFollowUp,
        questionsCount: analysis.questionsAndResponses.length,
        processingTimeMs: processingTime,
        status: "success",
      });

      return res.json({
        status: "success",
        data: {
          callId: resolvedCallId,
          processedAt: new Date().toISOString(),
          processingTimeMs: processingTime,
          analysis,
        },
      });
    } catch (error: any) {
      const processingTime = Date.now() - startTime;

      await logTooBigQuery({
        callId: resolvedCallId,
        transcriptLength: transcript.length,
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
