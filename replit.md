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
- `server/bigquery.ts` — BigQuery logging: `call_info` (one row per call) + `call_observations` (one row per observation)
- `server/storage.ts` — BigQueryStorage class with observation CRUD operations (dataset: `call_information`, table: `observations`)
- `server/seed.ts` — Seeds default 11 observation topics to BigQuery on first run
- `shared/schema.ts` — Type definitions (Observation, InsertObservation, EnumValue) + users table
- `client/src/pages/Home.tsx` — Test interface for the API
- `client/src/pages/Observations.tsx` — Observation definitions management UI
- `client/src/pages/ContextParameters.tsx` — Context parameter management UI
- `client/src/pages/CallQA.tsx` — Call QA prompt management UI
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
- `GWC_OBSERVATION_SUMMARIZATION_API_KEY` — GCP API key for authenticating POST /api/analyze requests (managed via GCP Console → APIs & Services → Credentials). Passed as `X-API-Key` header. If not set, the endpoint is open.

## API Endpoints
### POST /gwc_observation_summarization (Primary — Secured)
Requires `X-API-Key` header matching `GWC_OBSERVATION_SUMMARIZATION_API_KEY` env var.

### POST /api/analyze (Legacy — Open)
Identical functionality, no authentication. Kept for backward compatibility with existing Awell integration.

Input: `{ care_flow_id?, processed_datetime?, source_type?, source_id?, source_text }`
Output: `{ status, data: { care_flow_id, processed_datetime, source_type, source_id, processedAt, processingTimeMs, analysis: { summary, observations: [{ name, display_name, domain, value_type, value, detail, evidence, confidence }], transition_status, follow_up_areas }, tokenUsage: { promptTokens, completionTokens, totalTokens, estimatedCost } } }`

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
- Table: `call_info` — One row per API call (call_id, care_flow_id, processed_datetime, source_type, source_id, processed_at, processing_time_ms, prompt_version, prompt_version_date, context_values JSON, transcript_length, summary, follow_up_areas, transition_status, prompt_tokens, completion_tokens, total_tokens, estimated_cost, status, error_message)
- Table: `call_observations` — One row per observation per call (call_id, observation_name, observation_display_name, observation_domain, observation_value_type, observation_value, observation_detail, observation_evidence, observation_confidence)
- Table: `call_qa_pairs` — One row per Q&A exchange per call (call_id, sequence_number, question, answer, asked_by, answered_by, observation_name, observation_display_name, category)
- Table: `barriers` — One row per identified barrier per call (call_id, barrier, context, category, severity, observation_name, observation_display_name, evidence)
- Table: `call_qa_results` — One row per Call QA assessment per call (call_id, name, display_name, value, detail, evidence)
- Table: `call_qa_prompts` — Call QA prompt configuration (id, name, display_name, prompt_text, response_type, response_options, is_active, display_order)
- Table: `observations` — Observation configuration (id, name, display_name, domain, display_order, value_type, value, is_active, prompt_guidance)
- Table: `context_parameters` — Context parameter definitions (id, name, display_name, description, data_type, is_required, is_active, display_order)
- **IMPORTANT**: `call_info` and `call_observations` tables are LIVE PRODUCTION tables. NEVER drop, delete, or recreate them unless explicitly instructed by the user. Code only creates them if they don't exist.

## Batch Processing
- **Table**: `call_information.batch_processing` — stores calls queued for reprocessing
  - Fields: batch_id, bland_call_id, transcript, source_type, created_at, status (pending/processing/completed/failed), error_message, result_call_id, processed_at, batch_label
- **Source data**: `Bland.calls` table (historical call transcripts)
- **Flow**: Search Bland calls → select → load to batch table → process (runs each through extraction API with current prompt/observations)
- **API endpoints**: `GET /api/batch/bland-calls`, `POST /api/batch/load`, `GET /api/batch/items`, `GET /api/batch/summary`, `POST /api/batch/process`, `POST /api/batch/reset-failed`
- **Cloud Run Job**: `server/batch-job.ts` + `Dockerfile.batch` — standalone job that processes pending batch items
- **UI**: `/batch` page in Analytics section
- **Safety**: Parameterized SQL, atomic claim semantics (pending→processing prevents duplicate work), status validation

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
