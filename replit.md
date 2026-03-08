# Guideway Care — Transcript Analysis API

## Overview
A full-stack application that provides a Gemini-powered transcript analysis API. It accepts source text with contextual metadata, processes it through Google's Vertex AI Gemini model, and returns structured output: a summary, disposition change status, transition status with color-coded status badges, and follow-up areas. All API calls are logged to BigQuery.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui components
- **Backend**: Express.js (Node/TypeScript)
- **Database**: Google BigQuery (observations model + API logging)
- **AI**: Google Vertex AI Gemini (`gemini-2.0-flash-001`) via `@google-cloud/vertexai`
- **Logging**: Google BigQuery via `@google-cloud/bigquery`
- **Auth**: GCP Service Account (shared between Gemini and BigQuery)

## Key Files
- `server/routes.ts` — API endpoints (`POST /api/analyze`, `GET /api/prompt`, `GET /api/health`, observations CRUD)
- `server/gemini.ts` — Vertex AI Gemini integration with dynamic prompt builder from observations
- `server/bigquery.ts` — BigQuery API call logging (dataset: `call_information`, table: `api_logs`)
- `server/storage.ts` — BigQueryStorage class with observation CRUD operations (dataset: `call_information`, table: `observations`)
- `server/seed.ts` — Seeds default 11 observation topics to BigQuery on first run
- `shared/schema.ts` — Type definitions (Observation, InsertObservation, EnumValue) + users table
- `client/src/pages/Home.tsx` — Test interface for the API
- `client/src/pages/Observations.tsx` — Observation definitions management UI
- `client/src/pages/ContextParameters.tsx` — Context parameter management UI
- `client/src/pages/Reference.tsx` — API reference documentation
- `Dockerfile` — Multi-stage Docker build for GCP Cloud Run
- `cloudbuild.yaml` — GCP Cloud Build CI/CD pipeline
- `deploy.sh` — Manual deployment script for Cloud Run

## Context Parameters
Configurable input parameters stored in BigQuery (`call_information.context_parameters`) that API callers can pass alongside the transcript to give Gemini known context (e.g. patient name, diagnosis, facility).
- `id` (INT64), `name` (key), `display_name`, `description`, `data_type` (string/number/date/boolean), `is_required`, `is_active`, `display_order`
- Active parameters are injected into the Gemini prompt as a "KNOWN CONTEXT" section
- Values passed via `context` object in POST /api/analyze request body
- Required parameters are validated server-side; missing ones return 400
- Management UI at `/context-parameters` in the Setup sidebar section

## Observations Model
Observations are dynamic topics stored in BigQuery (`call_information.observations`) used in the Gemini analysis prompt. Each observation has:
- `id` (INT64), `name` (key), `display_name`, `domain`, `display_order`, `value_type`, `value` (JSON string), `is_active`, `prompt_guidance` (optional per-observation Gemini instruction)
- For enum types, `value` contains a JSON-serialized array of `{label, color}` objects
- Colors: GREEN, YELLOW, RED, BLUE, GRAY — mapped to inline HTML styles
- The prompt is dynamically built from active observations at analysis time
- Default seed: 11 post-discharge topics (Overall Feeling, Disposition Change, Prescription Pickup, etc.)
- Service account: `encompass-dashboard-app@encompass-476415.iam.gserviceaccount.com`

## Environment Variables (Secrets)
- `GCP_PROJECT_ID` — Google Cloud project ID (`encompass-476415`)
- `GCP_SERVICE_ACCOUNT_KEY` — Full JSON service account key (needs Vertex AI User, BigQuery Data Editor, BigQuery Job User roles)

## API Endpoints
### POST /api/analyze
Input: `{ care_flow_id?, interaction_datetime?, source_type?, source_id?, source_text }`
Output: `{ status, data: { care_flow_id, interaction_datetime, source_type, source_id, processedAt, processingTimeMs, analysis: { summary, disposition_change, disposition_change_note, observations: [{ name, display_name, domain, value_type, value, detail }], transition_status, follow_up_areas } } }`

### GET /api/prompt
Returns the dynamically generated prompt template: `{ prompt: string }`

### GET /api/health
Returns service connectivity status.

### Observations CRUD
- `GET /api/observations` — List all observations
- `POST /api/observations` — Create observation
- `PUT /api/observations/:id` — Update observation
- `DELETE /api/observations/:id` — Delete observation
- `PUT /api/observations/reorder` — Reorder observations

## BigQuery Schema
- Dataset: `call_information`
- Table: `api_logs` — API call logging (call_id, timestamp, transcript_length, summary, areas_for_followup, questions_count, processing_time_ms, status, error_message)
- Table: `observations` — Observation configuration (id, name, display_name, domain, display_order, value_type, value, is_active, prompt_guidance)
- Table: `context_parameters` — Context parameter definitions (id, name, display_name, description, data_type, is_required, is_active, display_order)

## GCP Cloud Run Deployment
- **Dockerfile**: Multi-stage build (builder + runner) with Node 20
- **cloudbuild.yaml**: Builds Docker image, pushes to GCR, deploys to Cloud Run
- **deploy.sh**: Manual deployment via `gcloud` CLI
- **Region**: us-central1
- **Port**: 8080 (Cloud Run default, read from PORT env var)
- **Secrets**: GCP_SERVICE_ACCOUNT_KEY stored in GCP Secret Manager

## Branding
- Guideway Care branding (colors from guidewaycare.com)
- Primary: `#0098db`, Navy: `#172938`, Dark BG: `#101a22`, Green: `#96d410`
