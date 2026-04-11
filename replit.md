# Guideway Care — Transcript Analysis API

## Overview
A full-stack application that provides a Gemini-powered transcript analysis API. It accepts source text with contextual metadata, processes it through Google's Vertex AI Gemini model, and returns structured output: a summary, disposition change status, transition status with color-coded status badges, and follow-up areas. All API calls are logged to BigQuery.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui components
- **Backend**: Express.js (Node/TypeScript)
- **Database**: Google BigQuery (observations model + API logging)
- **AI**: Google Vertex AI Gemini (`gemini-2.5-flash`) via `@google-cloud/vertexai`
- **Logging**: Google BigQuery via `@google-cloud/bigquery`
- **Auth**: GCP Service Account (shared between Gemini and BigQuery)

## Multi-Tenant Architecture (Client & Pathway)
**Client & Pathway is the parent entity.** Each client/pathway configuration has its own independent set of:
- Observations
- Context Parameters
- Settings (summary instruction, observations guidance, barriers guidance, prompt versioning)
- Call QA Prompts
- Call Dispositions (two-level: Category → Detail)

### How it works:
- `client_pathway` table stores multiple entries (id, client, pathway, description)
- Config tables (`observations`, `context_parameters`, `settings`, `call_qa_prompts`, `disposition_categories`, `disposition_details`) all have a `client_pathway_id` column
- All config API endpoints require `clientPathwayId` as a query param (GET/DELETE) or body param (POST/PUT)
- Frontend uses React Context (`ClientPathwayContext`) with a sidebar dropdown selector
- Setup pages automatically load/save config for the selected client/pathway
- API processing (`/api/analyze`) resolves `client_pathway_id` from request body, then tries client/pathway string match, then falls back to first available CP
- Batch processing uses the first configured client/pathway (or `clientPathwayId` query param)

## Awell Webhook — Async Pattern
The `/gwc_observation_summarization` endpoint supports both sync and async modes:
- **Sync (default)**: Returns analysis inline (fast Gemini call). Background Gemini call for qa_pairs/barriers runs after response.
- **Async**: Triggered by `"async": true` or providing a `webhook_url` in the request body. Returns `202 Accepted` with a `job_id` immediately. Runs a single complete Gemini call in background.
- **Retrieve results**: `GET /gwc_observation_summarization/:job_id` returns `{ status: "processing" }`, `{ status: "completed", data: {...} }`, or `{ status: "failed", error: "..." }`.
- **Webhook callback**: If `webhook_url` is provided, full results are POSTed to that URL when processing completes (with 3 retries).

## Deduplication Safety Nets
Gemini 2.5 Flash can produce duplicate items. Post-processing dedup applied to:
- `observations` array → `deduplicateByName()` (by observation name)
- `transition_status` HTML → `deduplicateTransitionStatus()` (by topic name in `<b>` tags)
- `barriers` array → `deduplicateBarriers()` (by barrier text)
- `call_qa` array → `deduplicateByName()` (by prompt name)

## Key Files
- `server/routes.ts` — API endpoints (`POST /api/analyze`, `GET /api/prompt`, `GET /api/health`, observations CRUD, client-pathways CRUD, async webhook)
- `server/gemini.ts` — Vertex AI Gemini integration with dynamic prompt builder from observations
- `server/bigquery.ts` — BigQuery logging: `call_info` (one row per call) + `call_observations` (one row per observation)
- `server/storage.ts` — BigQueryStorage class with all CRUD operations scoped by `clientPathwayId`
- `server/seed.ts` — Seeds default 11 observation topics to BigQuery on first run (for a given clientPathwayId)
- `server/batch-job.ts` — Standalone batch processing job for Cloud Run
- `shared/schema.ts` — Type definitions (Observation, InsertObservation, EnumValue, ClientPathway types)
- `client/src/contexts/ClientPathwayContext.tsx` — React Context for client/pathway selection state
- `client/src/pages/ClientPathway.tsx` — Multi-entry client/pathway management UI (list, create, edit, delete)
- `client/src/pages/Home.tsx` — Test interface for the API
- `client/src/pages/Observations.tsx` — Observation definitions management UI (scoped by selected CP)
- `client/src/pages/ContextParameters.tsx` — Context parameter management UI (scoped by selected CP)
- `client/src/pages/SummaryPrompt.tsx` — Summary prompt instruction UI (scoped by selected CP)
- `client/src/pages/BarriersPrompt.tsx` — Barriers prompt guidance UI (scoped by selected CP)
- `client/src/pages/CallQA.tsx` — Call QA prompt management UI (scoped by selected CP)
- `client/src/pages/Dispositions.tsx` — Call Dispositions management UI (scoped by selected CP)
- `client/src/pages/ReviewItems.tsx` — Call Review Items management UI (scoped by selected CP)
- `client/src/pages/GeneratedPrompt.tsx` — Read-only generated prompt viewer (scoped by selected CP)
- `client/src/components/AppLayout.tsx` — Layout with sidebar navigation and CP selector dropdown
- `client/src/pages/Reference.tsx` — API reference documentation
- `Dockerfile` — Multi-stage Docker build for GCP Cloud Run
- `cloudbuild.yaml` — GCP Cloud Build CI/CD pipeline
- `deploy.sh` — Manual deployment script for Cloud Run

## Context Parameters
Configurable input parameters stored in BigQuery (`call_information.context_parameters`) that API callers can pass alongside the transcript to give Gemini known context (e.g. patient name, diagnosis, facility).
- `id` (INT64), `name` (key), `display_name`, `description`, `data_type` (string/number/date/boolean/enum), `enum_values`, `is_active`, `display_order`, `awell_data_point_key`, `awell_mapping_type`, `awell_patient_profile_field`, `client_pathway_id`
- Active parameters are injected into the Gemini prompt as a "KNOWN CONTEXT" section
- Values passed via `context` object in POST /api/analyze request body
- **Awell Mapping Types**: Each parameter can be mapped to an Awell source for batch processing auto-population:
  - `none` — No auto-mapping; value must be passed manually via API
  - `data_point` — Resolves from Awell data points via `data_points_realtime` / `data_point_definitions_realtime` tables using the `awell_data_point_key`
  - `patient_profile` — Resolves from Awell patient profile via care flow → patient → `patient_profiles_realtime` join using the `awell_patient_profile_field` (e.g. `first_name`, `last_name`, `phone`, `birth_date`, etc.)
- Management UI at `/context-parameters` in the Setup sidebar section

## Call Review Items
Configurable checklist items for human reviewers to evaluate processed calls. Scoped by `client_pathway_id`.
- **Config table**: `call_review_items` (id, name, displayName, description, category, displayOrder, isActive, clientPathwayId)
- **Results table**: `call_reviews` (id, source_id, review_item_id, review_item_name, review_item_display_name, status, notes, reviewed_by, reviewed_at)
- **Statuses**: `unchecked` → `checked` → `flagged` → `na` (cycled by clicking)
- **API endpoints**: CRUD at `/api/call-review-items`; per-call reviews at `GET/POST /api/calls/:callId/reviews`
- **Admin UI**: `/review-items` page with category-grouped list, add/edit/delete dialogs
- **Call detail integration**: Review checklist card in `CallDetailPanel` (CallHistory.tsx) with status cycling, notes, and save to BigQuery

## Call Dispositions
Two-level configurable taxonomy (Category → Detail) for classifying call outcomes. Stored in BigQuery config tables scoped by `client_pathway_id`.
- **Config tables**: `disposition_categories` (id, name, displayName, description, displayOrder, isActive, clientPathwayId) and `disposition_details` (id, categoryId, name, displayName, description, displayOrder, isActive, clientPathwayId)
- **Results table**: `call_dispositions` (source_id, category_name, category_display_name, detail_name, detail_display_name, confidence, evidence, inserted_at)
- **Prompt integration**: `DispositionConfig` (categories + details) is injected into all Gemini analysis paths (webhook sync/async, /api/analyze, batch API, batch job). Gemini returns a `disposition` object with category, detail, confidence, and evidence.
- **API endpoints**: Full CRUD at `/api/disposition-categories` and `/api/disposition-details`, plus seed endpoint at `/api/disposition-categories/seed`
- **Admin UI**: `/dispositions` page with accordion-style category/detail management
- **Call detail display**: Disposition card shown in call detail panel (CallHistory.tsx)
- Seeded with 6 default categories and 25+ details on first run per client/pathway

## Observations Model
Observations are dynamic topics stored in BigQuery (`call_information.observations`) used in the Gemini analysis prompt. Each observation has:
- `id` (INT64), `name` (key), `display_name`, `domain`, `display_order`, `value_type`, `value` (JSON string), `is_active`, `prompt_guidance`, `client_pathway_id`
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

Input: `{ care_flow_id?, processed_datetime?, source_type?, source_id?, source_text, client_pathway_id?, client?, pathway?, context? }`
Output: `{ status, data: { ... analysis, tokenUsage } }`

### Client/Pathway CRUD
- `GET /api/client-pathways` — List all client/pathway configurations
- `POST /api/client-pathways` — Create client/pathway
- `GET /api/client-pathways/:id` — Get single client/pathway
- `PUT /api/client-pathways/:id` — Update client/pathway
- `DELETE /api/client-pathways/:id` — Delete client/pathway

### Config Endpoints (all require `clientPathwayId`)
- `GET /api/observations?clientPathwayId=N` — List observations for CP
- `POST /api/observations` — Create observation (body includes clientPathwayId)
- `GET /api/context-parameters?clientPathwayId=N` — List context parameters for CP
- `POST /api/context-parameters` — Create context parameter (body includes clientPathwayId)
- `GET /api/call-qa-prompts?clientPathwayId=N` — List call QA prompts for CP
- `POST /api/call-qa-prompts` — Create call QA prompt (body includes clientPathwayId)
- `GET /api/settings/summary-instruction?clientPathwayId=N` — Get summary instruction
- `PUT /api/settings/summary-instruction` — Set summary instruction
- `GET /api/settings/barriers-guidance?clientPathwayId=N` — Get barriers guidance
- `PUT /api/settings/barriers-guidance` — Set barriers guidance
- `GET /api/settings/observations-guidance?clientPathwayId=N` — Get observations guidance
- `PUT /api/settings/observations-guidance` — Set observations guidance
- `GET /api/prompt?clientPathwayId=N` — Get generated prompt

### GET /api/health
Returns service connectivity status.

## BigQuery Schema
- Dataset: `call_information`
- Table: `client_pathway` — Client and pathway configurations (id, client, pathway, description)
- Table: `call_info` — One row per API call (call_id, care_flow_id, processed_datetime, source_type, source_id, processed_at, processing_time_ms, prompt_version, prompt_version_date, context_values JSON, transcript_length, summary, follow_up_areas, transition_status, prompt_tokens, completion_tokens, total_tokens, estimated_cost, status, error_message, request_body, client, pathway)
- Table: `call_observations` — One row per observation per call
- Table: `call_qa_pairs` — One row per Q&A exchange per call
- Table: `barriers` — One row per identified barrier per call
- Table: `call_qa_results` — One row per Call QA assessment per call
- Table: `call_qa_prompts` — Call QA prompt configuration (id, name, display_name, prompt_text, response_type, response_options, is_active, display_order, client_pathway_id)
- Table: `known_context_details` — Known context per care flow
- Table: `observations` — Observation configuration (id, name, display_name, domain, display_order, value_type, value, is_active, prompt_guidance, description, client_pathway_id)
- Table: `context_parameters` — Context parameter definitions (id, name, display_name, description, data_type, is_required, is_active, display_order, client_pathway_id)
- Table: `settings` — Key/value settings per CP (key, value, client_pathway_id)
- **IMPORTANT**: `call_info` and `call_observations` tables are LIVE PRODUCTION tables. NEVER drop, delete, or recreate them unless explicitly instructed by the user. Code only creates them if they don't exist.

## Batch Processing
- **Table**: `call_information.batch_processing` — stores calls queued for reprocessing
  - Fields: batch_id, bland_call_id, transcript, source_type, created_at, status (pending/processing/completed/failed), error_message, result_call_id, processed_at, batch_label
- **Source data**: `Bland.calls` table (historical call transcripts)
- **Flow**: Search Bland calls → select → load to batch table (optionally fetching Awell known context per care flow) → process (runs each through extraction API with current prompt/observations/context)
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
