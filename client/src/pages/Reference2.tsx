import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Layers, Database, Server, Settings, Globe, Eye, ListTree, ClipboardCheck, ClipboardList, Variable, FileText, ShieldAlert, BarChart3 } from "lucide-react";

export default function Reference2() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight" data-testid="text-reference2-title" style={{ fontFamily: "Montserrat, sans-serif" }}>
          Reference 2 — Config & Deployment
        </h1>
        <p className="text-muted-foreground mt-2">
          System configuration overview, per-client setup, deployment architecture, and data model.
        </p>
      </div>

      <Card className="border-border/60 shadow-sm mb-6">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            System Architecture Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Guideway Care's Call Observation Extraction system is a multi-tenant API that processes patient call transcripts through Vertex AI Gemini and returns structured clinical analysis. Each client/pathway tenant has its own independent configuration.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg">
              <p className="text-primary font-semibold text-sm mb-1">Frontend</p>
              <p className="text-muted-foreground text-sm">React + Vite + Tailwind CSS + shadcn/ui</p>
              <p className="text-muted-foreground text-xs mt-1">Admin dashboard for config management, analytics, and API playground</p>
            </div>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg">
              <p className="text-primary font-semibold text-sm mb-1">Backend</p>
              <p className="text-muted-foreground text-sm">Express.js (Node/TypeScript)</p>
              <p className="text-muted-foreground text-xs mt-1">REST API, Gemini integration, BigQuery logging</p>
            </div>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg">
              <p className="text-primary font-semibold text-sm mb-1">AI + Storage</p>
              <p className="text-muted-foreground text-sm">Vertex AI Gemini 2.5 Flash + BigQuery</p>
              <p className="text-muted-foreground text-xs mt-1">Prompt-driven extraction, all data persisted to BigQuery</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm mb-6">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Multi-Tenant Model — Client & Pathway
            <Badge className="bg-primary/10 text-primary border-primary/20 ml-2">Core Concept</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground"><strong className="text-foreground">Client & Pathway is the top-level organizational unit.</strong> Each client/pathway combination represents a distinct tenant with fully independent configuration. A "client" is the healthcare organization, and a "pathway" is the specific care program (e.g., "Post discharge follow-up day 4").</p>

          <div className="bg-muted/30 border border-border/50 p-4 rounded-lg">
            <p className="text-foreground font-semibold text-sm mb-3">Each Client/Pathway gets its own:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Settings className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                Observations (clinical topics to extract)
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Variable className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                Context Parameters (known patient data)
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                Summary Prompt instruction
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                Barriers Prompt guidance
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Eye className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                Observations Prompt guidance
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ClipboardCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                Call QA Prompts
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ListTree className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                Disposition Taxonomy (categories + details)
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ClipboardList className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                Review Items (reviewer checklist)
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2">Client/Pathway Fields</h3>
            <div className="space-y-2">
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <p className="text-primary font-mono text-sm">id</p>
                <p className="text-muted-foreground text-sm mt-1">Auto-incremented integer ID. Used as <code className="text-primary">clientPathwayId</code> on all scoped endpoints.</p>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <p className="text-primary font-mono text-sm">client</p>
                <p className="text-muted-foreground text-sm mt-1">Client organization name (e.g., "Encompass Health").</p>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <p className="text-primary font-mono text-sm">pathway</p>
                <p className="text-muted-foreground text-sm mt-1">Care pathway label (e.g., "Post discharge follow-up day 4").</p>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <p className="text-primary font-mono text-sm">description</p>
                <p className="text-muted-foreground text-sm mt-1">Optional free-text description of this client/pathway configuration.</p>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <p className="text-primary font-mono text-sm">gcp_project_id</p>
                  <Badge variant="outline" className="text-[10px]">optional</Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1">The Google Cloud project ID for this client's data. Used for per-client GCP project isolation.</p>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <p className="text-primary font-mono text-sm">secret_key</p>
                  <Badge variant="outline" className="text-[10px]">optional</Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1">The GCP Secret Manager secret name for this client's API key. Stores the reference to the secret, not the key itself.</p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2">How Tenant Resolution Works</h3>
            <p className="text-muted-foreground text-sm mb-3">When a call comes in via the API, the system resolves which client/pathway config to use:</p>
            <ol className="text-muted-foreground text-sm space-y-2 list-decimal list-inside">
              <li>If <code className="text-primary">client_pathway_id</code> is provided in the request body, use that directly.</li>
              <li>If <code className="text-primary">client</code> and <code className="text-primary">pathway</code> strings are provided, find the matching client/pathway record.</li>
              <li>If neither match, fall back to the first available client/pathway configuration.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm mb-6">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configuration Entities
            <Badge className="bg-[#96d410]/10 text-[#4d6d08] border-[#96d410]/30 ml-2">Per Client/Pathway</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">All configuration entities are scoped by <code className="text-primary">clientPathwayId</code>. Switching the client/pathway in the sidebar loads a completely independent set of configuration.</p>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2 flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Observations
            </h3>
            <p className="text-muted-foreground text-sm mb-3">Clinical topics that Gemini extracts from each call transcript. Each observation defines what to look for and how to classify the finding.</p>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-1">
              <p className="text-foreground"><span className="text-primary font-semibold">name</span> — Unique key (e.g., "overall_feeling")</p>
              <p className="text-foreground"><span className="text-primary font-semibold">displayName</span> — Human-readable label (e.g., "Overall Feeling")</p>
              <p className="text-foreground"><span className="text-primary font-semibold">description</span> — What this observation measures</p>
              <p className="text-foreground"><span className="text-primary font-semibold">domain</span> — Category grouping (e.g., "clinical", "medication", "general")</p>
              <p className="text-foreground"><span className="text-primary font-semibold">valueType</span> — "enum" (predefined choices) or "text" (free-form)</p>
              <p className="text-foreground"><span className="text-primary font-semibold">value</span> — For enum types: array of {"{"} label, color {"}"} objects. Colors: GREEN, YELLOW, RED, BLUE, GRAY</p>
              <p className="text-foreground"><span className="text-primary font-semibold">isActive</span> — Whether included in the Gemini prompt</p>
              <p className="text-foreground"><span className="text-primary font-semibold">promptGuidance</span> — Instructions to Gemini on how to evaluate this topic</p>
              <p className="text-foreground"><span className="text-primary font-semibold">displayOrder</span> — Sort position in the UI and prompt</p>
            </div>
            <p className="text-muted-foreground text-xs mt-2">BigQuery table: <code className="text-primary">observations</code> | UI: /observations | Default seed: 11 post-discharge topics</p>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2 flex items-center gap-2">
              <Variable className="h-4 w-4 text-primary" />
              Context Parameters
            </h3>
            <p className="text-muted-foreground text-sm mb-3">Known information about the patient/call that API callers pass alongside the transcript. Injected into the Gemini prompt as a "KNOWN CONTEXT" section to help Gemini make better extraction decisions.</p>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-1">
              <p className="text-foreground"><span className="text-primary font-semibold">name</span> — Key used in the API request context object (e.g., "patient_first_name")</p>
              <p className="text-foreground"><span className="text-primary font-semibold">displayName</span> — Human-readable label</p>
              <p className="text-foreground"><span className="text-primary font-semibold">dataType</span> — string | number | date | boolean | enum</p>
              <p className="text-foreground"><span className="text-primary font-semibold">enumValues</span> — For enum type: array of allowed values</p>
              <p className="text-foreground"><span className="text-primary font-semibold">isActive</span> — Whether included in the prompt</p>
              <p className="text-foreground"><span className="text-primary font-semibold">awellMappingType</span> — "none" | "data_point" | "patient_profile" (for batch processing auto-population from Awell)</p>
              <p className="text-foreground"><span className="text-primary font-semibold">awellDataPointKey</span> — Awell data point key for data_point mapping</p>
              <p className="text-foreground"><span className="text-primary font-semibold">awellPatientProfileField</span> — Patient profile field name for patient_profile mapping</p>
            </div>
            <p className="text-muted-foreground text-xs mt-2">BigQuery table: <code className="text-primary">context_parameters</code> | UI: /context-parameters</p>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Call QA Prompts
            </h3>
            <p className="text-muted-foreground text-sm mb-3">Quality assessment prompts that Gemini evaluates for each call. Used to measure care guide performance, empathy, completeness, etc.</p>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-1">
              <p className="text-foreground"><span className="text-primary font-semibold">name</span> — Unique key (e.g., "empathy_score")</p>
              <p className="text-foreground"><span className="text-primary font-semibold">displayName</span> — Human-readable label</p>
              <p className="text-foreground"><span className="text-primary font-semibold">promptText</span> — The evaluation instruction sent to Gemini</p>
              <p className="text-foreground"><span className="text-primary font-semibold">responseType</span> — "enum" | "text" | "boolean"</p>
              <p className="text-foreground"><span className="text-primary font-semibold">responseOptions</span> — For enum type: array of allowed response values</p>
              <p className="text-foreground"><span className="text-primary font-semibold">isActive</span> — Whether included in analysis</p>
            </div>
            <p className="text-muted-foreground text-xs mt-2">BigQuery table: <code className="text-primary">call_qa_prompts</code> | UI: /call-qa</p>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2 flex items-center gap-2">
              <ListTree className="h-4 w-4 text-primary" />
              Disposition Taxonomy
            </h3>
            <p className="text-muted-foreground text-sm mb-3">Two-level call outcome classification. Categories are the top level (e.g., "Connected", "No Contact"), and Details are nested within a category (e.g., "Completed Interaction", "Voicemail Left"). Gemini selects exactly one category + detail per call.</p>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-1 mb-2">
              <p className="text-foreground font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">Disposition Categories</p>
              <p className="text-foreground"><span className="text-primary font-semibold">name</span> — Key (e.g., "connected")</p>
              <p className="text-foreground"><span className="text-primary font-semibold">displayName</span> — Label (e.g., "Connected")</p>
              <p className="text-foreground"><span className="text-primary font-semibold">description</span> — What this category represents</p>
              <p className="text-foreground"><span className="text-primary font-semibold">isGlobal</span> — If true, visible to all client/pathways</p>
              <p className="text-foreground"><span className="text-primary font-semibold">isActive</span> — Whether available for classification</p>
            </div>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-1">
              <p className="text-foreground font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">Disposition Details</p>
              <p className="text-foreground"><span className="text-primary font-semibold">categoryId</span> — Parent category reference</p>
              <p className="text-foreground"><span className="text-primary font-semibold">name / displayName / description</span> — Same pattern as categories</p>
              <p className="text-foreground"><span className="text-primary font-semibold">isGlobal</span> — If true, visible across all tenants</p>
            </div>
            <p className="text-muted-foreground text-xs mt-2">BigQuery tables: <code className="text-primary">disposition_categories</code>, <code className="text-primary">disposition_details</code> | UI: /dispositions | Default seed: 2 categories + details</p>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Review Items
            </h3>
            <p className="text-muted-foreground text-sm mb-3">Configurable checklist items for human reviewers to evaluate processed calls. Reviewers cycle through statuses (unchecked, checked, flagged, N/A) and can add notes per item.</p>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-1">
              <p className="text-foreground"><span className="text-primary font-semibold">name</span> — Unique key (e.g., "summary_accuracy")</p>
              <p className="text-foreground"><span className="text-primary font-semibold">displayName</span> — Human-readable label</p>
              <p className="text-foreground"><span className="text-primary font-semibold">description</span> — What the reviewer should evaluate</p>
              <p className="text-foreground"><span className="text-primary font-semibold">category</span> — Grouping label (e.g., "Quality", "Completeness")</p>
              <p className="text-foreground"><span className="text-primary font-semibold">isActive</span> — Whether shown in the review checklist</p>
              <p className="text-foreground"><span className="text-primary font-semibold">displayOrder</span> — Sort position</p>
            </div>
            <p className="text-muted-foreground text-xs mt-2">BigQuery table: <code className="text-primary">call_review_items</code> | UI: /review-items</p>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Settings (Key-Value)
            </h3>
            <p className="text-muted-foreground text-sm mb-3">Free-text prompt instructions stored as key-value pairs per client/pathway.</p>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-1">
              <p className="text-foreground"><span className="text-primary font-semibold">summary_instruction</span> — Custom instruction for how Gemini should write the call summary</p>
              <p className="text-foreground"><span className="text-primary font-semibold">observations_prompt_guidance</span> — General guidance added to the observations section of the prompt</p>
              <p className="text-foreground"><span className="text-primary font-semibold">barriers_prompt_guidance</span> — Custom guidance for barrier extraction</p>
            </div>
            <p className="text-muted-foreground text-xs mt-2">BigQuery table: <code className="text-primary">settings</code> | UI: /summary-prompt, /barriers-prompt</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm mb-6">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Deployment Architecture
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-foreground font-semibold mb-2">Production Environment</h3>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-1">
              <p className="text-foreground"><span className="text-primary font-semibold">Production URL:</span> https://guideway-care-api-855188300685.us-central1.run.app</p>
              <p className="text-foreground"><span className="text-primary font-semibold">Platform:</span> Google Cloud Run</p>
              <p className="text-foreground"><span className="text-primary font-semibold">Region:</span> us-central1</p>
              <p className="text-foreground"><span className="text-primary font-semibold">Service Name:</span> guideway-care-api</p>
              <p className="text-foreground"><span className="text-primary font-semibold">GCP Project:</span> encompass-476415</p>
              <p className="text-foreground"><span className="text-primary font-semibold">Port:</span> 8080 (Cloud Run default)</p>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2">Deploy Steps</h3>
            <p className="text-muted-foreground text-sm mb-2">From GCP Cloud Shell:</p>
            <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`cd ~/encompass-post-call-summary
git pull
gcloud builds submit --config cloudbuild.yaml`}
            </pre>
            <p className="text-muted-foreground text-sm mt-2">Cloud Build builds the Docker image, pushes to Container Registry, and deploys to Cloud Run automatically.</p>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2">Build Pipeline</h3>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-1">
              <p className="text-foreground"><span className="text-primary font-semibold">Dockerfile</span> — Multi-stage build (builder + runner) with Node 20</p>
              <p className="text-foreground"><span className="text-primary font-semibold">cloudbuild.yaml</span> — Cloud Build config: build image, push to GCR, deploy to Cloud Run</p>
              <p className="text-foreground"><span className="text-primary font-semibold">deploy.sh</span> — Alternative manual deploy via <code className="text-primary">gcloud run deploy</code></p>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2">Deploying to Client Domains</h3>
            <p className="text-muted-foreground text-sm mb-3">To deploy a client-specific instance or map a custom domain to the Cloud Run service:</p>
            <ol className="text-muted-foreground text-sm space-y-3 list-decimal list-inside">
              <li>
                <strong className="text-foreground">Custom Domain Mapping (same service):</strong>
                <pre className="bg-[#172938] text-gray-300 p-3 rounded-lg text-sm overflow-x-auto mt-1 ml-5">
{`gcloud run domain-mappings create \\
  --service guideway-care-api \\
  --domain api.clientname.com \\
  --region us-central1`}
                </pre>
                <p className="text-muted-foreground text-xs ml-5 mt-1">Then add the DNS records (CNAME or A) that Cloud Run provides to the client's domain registrar.</p>
              </li>
              <li>
                <strong className="text-foreground">Per-Client GCP Project (isolated):</strong>
                <p className="text-muted-foreground text-sm ml-5">Set the <code className="text-primary">gcp_project_id</code> field on the client/pathway record to point to the client's own GCP project. The system can then use client-specific BigQuery datasets and Secret Manager keys.</p>
              </li>
              <li>
                <strong className="text-foreground">Per-Client API Key:</strong>
                <p className="text-muted-foreground text-sm ml-5">Set the <code className="text-primary">secret_key</code> field on the client/pathway record to the name of the GCP Secret Manager secret that holds the client's API key.</p>
              </li>
            </ol>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2">Environment Variables & Secrets</h3>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2">
              <div>
                <p className="text-foreground"><span className="text-primary font-semibold">GCP_PROJECT_ID</span></p>
                <p className="text-muted-foreground text-xs">Google Cloud project ID (e.g., "encompass-476415")</p>
              </div>
              <div>
                <p className="text-foreground"><span className="text-primary font-semibold">GCP_SERVICE_ACCOUNT_KEY</span></p>
                <p className="text-muted-foreground text-xs">Full JSON service account key. Stored in GCP Secret Manager, injected via Cloud Run secret mount. Needs: Vertex AI User, BigQuery Data Editor, BigQuery Job User roles.</p>
              </div>
              <div>
                <p className="text-foreground"><span className="text-primary font-semibold">GWC_OBSERVATION_SUMMARIZATION_API_KEY</span></p>
                <p className="text-muted-foreground text-xs">API key for authenticating the /gwc_observation_summarization endpoint. Passed as X-API-Key header. Stored in Secret Manager.</p>
              </div>
              <div>
                <p className="text-foreground"><span className="text-primary font-semibold">PORT</span></p>
                <p className="text-muted-foreground text-xs">Set automatically by Cloud Run (default 8080). Do not set manually.</p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2">Required GCP APIs & Roles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg text-sm">
                <p className="text-foreground font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">APIs to Enable</p>
                <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Cloud Run</li>
                  <li>Cloud Build</li>
                  <li>Container Registry</li>
                  <li>Secret Manager</li>
                  <li>Vertex AI</li>
                  <li>BigQuery</li>
                </ul>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg text-sm">
                <p className="text-foreground font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Service Account Roles</p>
                <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Vertex AI User</li>
                  <li>BigQuery Data Editor</li>
                  <li>BigQuery Job User</li>
                  <li>Secret Manager Secret Accessor</li>
                </ul>
                <p className="text-foreground font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2 mt-3">Cloud Build Roles</p>
                <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Cloud Run Admin</li>
                  <li>Service Account User</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm mb-6">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Data Model
            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 ml-2">BigQuery</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">All data is stored in Google BigQuery under the <code className="text-primary">call_information</code> dataset in the <code className="text-primary">encompass-476415</code> project. Tables are auto-created on first use with idempotent schema migrations.</p>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Output Tables (per-call data)
            </h3>
            <div className="space-y-4">
              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">call_info</p>
                  <p className="text-muted-foreground text-xs">One row per processed call — metadata, summary, token usage, cost</p>
                </div>
                <div className="px-4 py-3 text-sm space-y-1">
                  <p className="text-muted-foreground"><code className="text-primary">call_id</code> (PK), <code className="text-primary">processing_id</code>, <code className="text-primary">care_flow_id</code>, <code className="text-primary">processed_datetime</code>, <code className="text-primary">call_date</code></p>
                  <p className="text-muted-foreground"><code className="text-primary">source_type</code>, <code className="text-primary">source_id</code>, <code className="text-primary">processed_at</code>, <code className="text-primary">processing_time_ms</code></p>
                  <p className="text-muted-foreground"><code className="text-primary">prompt_version</code>, <code className="text-primary">prompt_version_date</code>, <code className="text-primary">context_values</code> (JSON)</p>
                  <p className="text-muted-foreground"><code className="text-primary">transcript_length</code>, <code className="text-primary">summary</code>, <code className="text-primary">follow_up_areas</code>, <code className="text-primary">transition_status</code></p>
                  <p className="text-muted-foreground"><code className="text-primary">prompt_tokens</code>, <code className="text-primary">completion_tokens</code>, <code className="text-primary">total_tokens</code>, <code className="text-primary">estimated_cost</code></p>
                  <p className="text-muted-foreground"><code className="text-primary">status</code>, <code className="text-primary">error_message</code>, <code className="text-primary">request_body</code>, <code className="text-primary">request_headers</code>, <code className="text-primary">response_json</code></p>
                  <p className="text-muted-foreground"><code className="text-primary">client</code>, <code className="text-primary">pathway</code></p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">call_observations</p>
                  <p className="text-muted-foreground text-xs">One row per observation per call</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">call_id</code>, <code className="text-primary">observation_name</code>, <code className="text-primary">observation_display_name</code>, <code className="text-primary">domain</code>, <code className="text-primary">value_type</code>, <code className="text-primary">value</code>, <code className="text-primary">detail</code>, <code className="text-primary">evidence</code>, <code className="text-primary">confidence</code></p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">call_qa_pairs</p>
                  <p className="text-muted-foreground text-xs">One row per Q&A exchange per call</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">call_id</code>, <code className="text-primary">sequence_number</code>, <code className="text-primary">question</code>, <code className="text-primary">answer</code>, <code className="text-primary">asked_by</code>, <code className="text-primary">answered_by</code>, <code className="text-primary">observation_name</code>, <code className="text-primary">observation_display_name</code>, <code className="text-primary">category</code></p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">barriers</p>
                  <p className="text-muted-foreground text-xs">One row per identified barrier per call</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">call_id</code>, <code className="text-primary">barrier</code>, <code className="text-primary">context</code>, <code className="text-primary">category</code>, <code className="text-primary">severity</code>, <code className="text-primary">observation_name</code>, <code className="text-primary">observation_display_name</code>, <code className="text-primary">evidence</code></p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">call_qa_results</p>
                  <p className="text-muted-foreground text-xs">One row per Call QA assessment per call</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">call_id</code>, <code className="text-primary">name</code>, <code className="text-primary">display_name</code>, <code className="text-primary">value</code>, <code className="text-primary">detail</code>, <code className="text-primary">evidence</code></p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">call_dispositions</p>
                  <p className="text-muted-foreground text-xs">One row per call — disposition classification</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">call_id</code>, <code className="text-primary">disposition_category</code>, <code className="text-primary">disposition_category_display</code>, <code className="text-primary">disposition_detail</code>, <code className="text-primary">disposition_detail_display</code>, <code className="text-primary">confidence</code>, <code className="text-primary">evidence</code>, <code className="text-primary">detail</code></p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Review Tables
            </h3>
            <div className="space-y-4">
              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">call_reviews</p>
                  <p className="text-muted-foreground text-xs">Human review submissions per call per review item</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">id</code>, <code className="text-primary">source_id</code>, <code className="text-primary">review_item_id</code>, <code className="text-primary">review_item_name</code>, <code className="text-primary">review_item_display_name</code>, <code className="text-primary">status</code> (checked | flagged | na | unchecked), <code className="text-primary">notes</code>, <code className="text-primary">reviewed_by</code>, <code className="text-primary">reviewed_at</code></p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">call_review_statuses</p>
                  <p className="text-muted-foreground text-xs">Per-call review status tracking</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">call_id</code>, <code className="text-primary">review_status</code> (not_reviewed | in_progress | reviewed | flagged), <code className="text-primary">tags</code> (JSON string array), <code className="text-primary">notes</code>, <code className="text-primary">updated_at</code></p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Configuration Tables
            </h3>
            <div className="space-y-4">
              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">client_pathway</p>
                  <p className="text-muted-foreground text-xs">Client/pathway tenant definitions</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">id</code>, <code className="text-primary">client</code>, <code className="text-primary">pathway</code>, <code className="text-primary">description</code>, <code className="text-primary">gcp_project_id</code>, <code className="text-primary">secret_key</code></p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">observations</p>
                  <p className="text-muted-foreground text-xs">Observation topic configuration (scoped by client_pathway_id)</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">id</code>, <code className="text-primary">name</code>, <code className="text-primary">display_name</code>, <code className="text-primary">description</code>, <code className="text-primary">domain</code>, <code className="text-primary">display_order</code>, <code className="text-primary">value_type</code>, <code className="text-primary">value</code> (JSON), <code className="text-primary">is_active</code>, <code className="text-primary">prompt_guidance</code>, <code className="text-primary">client_pathway_id</code></p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">context_parameters</p>
                  <p className="text-muted-foreground text-xs">Context parameter definitions (scoped by client_pathway_id)</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">id</code>, <code className="text-primary">name</code>, <code className="text-primary">display_name</code>, <code className="text-primary">description</code>, <code className="text-primary">data_type</code>, <code className="text-primary">enum_values</code> (JSON), <code className="text-primary">is_active</code>, <code className="text-primary">display_order</code>, <code className="text-primary">awell_data_point_key</code>, <code className="text-primary">awell_mapping_type</code>, <code className="text-primary">awell_patient_profile_field</code>, <code className="text-primary">client_pathway_id</code></p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">call_qa_prompts</p>
                  <p className="text-muted-foreground text-xs">Call QA prompt configuration (scoped by client_pathway_id)</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">id</code>, <code className="text-primary">name</code>, <code className="text-primary">display_name</code>, <code className="text-primary">prompt_text</code>, <code className="text-primary">response_type</code>, <code className="text-primary">response_options</code> (JSON), <code className="text-primary">is_active</code>, <code className="text-primary">display_order</code>, <code className="text-primary">client_pathway_id</code></p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">disposition_categories / disposition_details</p>
                  <p className="text-muted-foreground text-xs">Disposition taxonomy (scoped by client_pathway_id, supports is_global)</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground">Categories: <code className="text-primary">id</code>, <code className="text-primary">name</code>, <code className="text-primary">display_name</code>, <code className="text-primary">description</code>, <code className="text-primary">display_order</code>, <code className="text-primary">is_active</code>, <code className="text-primary">is_global</code>, <code className="text-primary">client_pathway_id</code></p>
                  <p className="text-muted-foreground mt-1">Details: <code className="text-primary">id</code>, <code className="text-primary">category_id</code>, <code className="text-primary">name</code>, <code className="text-primary">display_name</code>, <code className="text-primary">description</code>, <code className="text-primary">display_order</code>, <code className="text-primary">is_active</code>, <code className="text-primary">is_global</code>, <code className="text-primary">client_pathway_id</code></p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">call_review_items</p>
                  <p className="text-muted-foreground text-xs">Review checklist item configuration (scoped by client_pathway_id)</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">id</code>, <code className="text-primary">name</code>, <code className="text-primary">display_name</code>, <code className="text-primary">description</code>, <code className="text-primary">category</code>, <code className="text-primary">display_order</code>, <code className="text-primary">is_active</code>, <code className="text-primary">client_pathway_id</code></p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">settings</p>
                  <p className="text-muted-foreground text-xs">Key-value settings store (scoped by client_pathway_id)</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">key</code>, <code className="text-primary">value</code>, <code className="text-primary">client_pathway_id</code></p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              Other Tables
            </h3>
            <div className="space-y-4">
              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">batch_processing</p>
                  <p className="text-muted-foreground text-xs">Batch processing tracker</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">batch_id</code>, <code className="text-primary">bland_call_id</code>, <code className="text-primary">transcript</code>, <code className="text-primary">source_type</code>, <code className="text-primary">care_flow_id</code>, <code className="text-primary">created_at</code>, <code className="text-primary">status</code> (pending | processing | completed | failed), <code className="text-primary">error_message</code>, <code className="text-primary">result_call_id</code>, <code className="text-primary">processed_at</code>, <code className="text-primary">batch_label</code>, <code className="text-primary">context_values</code> (JSON)</p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">known_context_details</p>
                  <p className="text-muted-foreground text-xs">Cached Awell context data per care flow</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">care_flow_id</code>, <code className="text-primary">parameter_name</code>, <code className="text-primary">display_name</code>, <code className="text-primary">value</code>, <code className="text-primary">value_type</code>, <code className="text-primary">active_ind</code>, <code className="text-primary">created_at</code>, <code className="text-primary">updated_at</code></p>
                </div>
              </div>

              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 border-b border-border/50">
                  <p className="text-primary font-mono text-sm font-semibold">Bland.calls</p>
                  <p className="text-muted-foreground text-xs">Source call data from Bland AI (external, read-only)</p>
                </div>
                <div className="px-4 py-3 text-sm">
                  <p className="text-muted-foreground"><code className="text-primary">call_id</code>, <code className="text-primary">created_at</code>, <code className="text-primary">call_length</code>, <code className="text-primary">answered_by</code>, <code className="text-primary">concatenated_transcript</code>, <code className="text-primary">metadata</code>, <code className="text-primary">variables</code></p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-foreground font-semibold mb-2">Entity Relationships</h3>
            <div className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`client_pathway (1) ──── (*) observations
                  ──── (*) context_parameters
                  ──── (*) call_qa_prompts
                  ──── (*) disposition_categories ──── (*) disposition_details
                  ──── (*) call_review_items
                  ──── (*) settings

call_info (1) ──── (*) call_observations
             ──── (*) call_qa_pairs
             ──── (*) barriers
             ──── (*) call_qa_results
             ──── (1) call_dispositions
             ──── (*) call_reviews
             ──── (1) call_review_statuses

batch_processing (*) ──── (1) call_info  (via result_call_id)
Bland.calls      (*) ──── (*) batch_processing  (via bland_call_id)`}</pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
