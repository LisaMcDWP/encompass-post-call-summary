# Guideway Care — Transcript Analysis API

## Overview
A full-stack application that provides a Gemini-powered transcript analysis API. It takes a call ID and transcript, processes them through Google's Vertex AI Gemini model, and returns structured output: a summary, disposition change status, transition status with color-coded status badges, and follow-up areas. All API calls are logged to BigQuery.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui components
- **Backend**: Express.js (Node/TypeScript)
- **AI**: Google Vertex AI Gemini (`gemini-2.0-flash-001`) via `@google-cloud/vertexai`
- **Logging**: Google BigQuery via `@google-cloud/bigquery`
- **Auth**: GCP Service Account (shared between Gemini and BigQuery)

## Key Files
- `server/routes.ts` — API endpoints (`POST /api/analyze`, `GET /api/prompt`, `GET /api/health`)
- `server/gemini.ts` — Vertex AI Gemini integration for transcript analysis
- `server/bigquery.ts` — BigQuery logging (auto-creates dataset/table)
- `client/src/pages/Home.tsx` — Test interface for the API
- `shared/schema.ts` — Data model definitions
- `Dockerfile` — Multi-stage Docker build for GCP Cloud Run
- `cloudbuild.yaml` — GCP Cloud Build CI/CD pipeline
- `deploy.sh` — Manual deployment script for Cloud Run

## Environment Variables (Secrets)
- `GCP_PROJECT_ID` — Google Cloud project ID
- `GCP_SERVICE_ACCOUNT_KEY` — Full JSON service account key (needs Vertex AI User, BigQuery Data Editor, BigQuery Job User roles)

## API Endpoints
### POST /api/analyze
Input: `{ callId?: string, transcript: string, customPrompt?: string }`
Output: `{ status, data: { callId, processedAt, processingTimeMs, promptUsed, analysis: { summary, transition_status, disposition_change, disposition_change_note, follow_up_areas } } }`

### GET /api/prompt
Returns the default prompt template: `{ prompt: string }`

### GET /api/health
Returns service connectivity status.

## BigQuery Schema
- Dataset: `transcript_analysis`
- Table: `api_logs`
- Fields: call_id, timestamp, transcript_length, summary, areas_for_followup, questions_count, processing_time_ms, status, error_message

## GCP Cloud Run Deployment
- **Dockerfile**: Multi-stage build (builder + runner) with Node 20
- **cloudbuild.yaml**: Builds Docker image, pushes to GCR, deploys to Cloud Run
- **deploy.sh**: Manual deployment via `gcloud` CLI
- **Region**: us-central1
- **Port**: 8080 (Cloud Run default, read from PORT env var)
- **Secrets**: GCP_SERVICE_ACCOUNT_KEY stored in GCP Secret Manager

### Deployment Prerequisites
1. Enable Cloud Run, Cloud Build, Container Registry, Secret Manager APIs
2. Store `GCP_SERVICE_ACCOUNT_KEY` in GCP Secret Manager
3. Grant Cloud Build service account permissions to deploy to Cloud Run
4. Connect GitHub repo to Cloud Build trigger (or use deploy.sh manually)

## Branding
- Guideway Care branding (colors from guidewaycare.com)
- Primary: `#0098db`, Navy: `#172938`, Dark BG: `#101a22`, Green: `#96d410`
