# Guideway Care — Transcript Analysis API

## Overview
A full-stack application that provides a Gemini-powered transcript analysis API. It takes a call ID and transcript, processes them through Google's Vertex AI Gemini model, and returns structured output: a summary, areas for follow-up, and extracted questions & responses. All API calls are logged to BigQuery.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui components
- **Backend**: Express.js (Node/TypeScript)
- **AI**: Google Vertex AI Gemini (`gemini-2.0-flash-001`) via `@google-cloud/vertexai`
- **Logging**: Google BigQuery via `@google-cloud/bigquery`
- **Auth**: GCP Service Account (shared between Gemini and BigQuery)

## Key Files
- `server/routes.ts` — API endpoints (`POST /api/analyze`, `GET /api/health`)
- `server/gemini.ts` — Vertex AI Gemini integration for transcript analysis
- `server/bigquery.ts` — BigQuery logging (auto-creates dataset/table)
- `client/src/pages/Home.tsx` — Test interface for the API
- `shared/schema.ts` — Data model definitions

## Environment Variables (Secrets)
- `GCP_PROJECT_ID` — Google Cloud project ID
- `GCP_SERVICE_ACCOUNT_KEY` — Full JSON service account key (needs Vertex AI User, BigQuery Data Editor, BigQuery Job User roles)

## API Endpoints
### POST /api/analyze
Input: `{ callId?: string, transcript: string }`
Output: `{ status, data: { callId, processedAt, processingTimeMs, analysis: { summary, areasForFollowUp[], questionsAndResponses[] } } }`

### GET /api/health
Returns service connectivity status.

## BigQuery Schema
- Dataset: `transcript_analysis`
- Table: `api_logs`
- Fields: call_id, timestamp, transcript_length, summary, areas_for_followup, questions_count, processing_time_ms, status, error_message

## Deployment Target
- GCP (via GitHub CI/CD)
- Guideway Care branding (colors from guidewaycare.com)
