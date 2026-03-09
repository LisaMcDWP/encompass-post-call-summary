import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Target, Layers, CheckCircle2, CircleDot, Box, Database, Cpu, Globe, Layout, Wrench, BarChart3 } from "lucide-react";

interface Story {
  id: string;
  title: string;
  description: string;
}

interface Epic {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  stories: Story[];
}

const EPICS: Epic[] = [
  {
    id: "E1",
    title: "Gemini AI Transcript Analysis",
    icon: <Cpu className="h-5 w-5 text-primary" />,
    description: "Core pipeline that accepts call transcripts and returns structured clinical observations via Google Vertex AI Gemini.",
    stories: [
      {
        id: "E1-S1",
        title: "POST /api/analyze endpoint",
        description: "Accepts source_text, care_flow_id, processed_datetime, source_type, source_id, and a context object. Validates required fields and invokes Gemini for analysis.",
      },
      {
        id: "E1-S2",
        title: "Vertex AI Gemini integration",
        description: "Connects to gemini-2.0-flash-001 via @google-cloud/vertexai using GCP service account credentials. Sends structured prompt and parses JSON response.",
      },
      {
        id: "E1-S3",
        title: "Structured JSON output",
        description: "Gemini returns a well-defined schema: summary, observations array (name, display_name, domain, value_type, value, detail, evidence, confidence), transition_status (HTML), and follow_up_areas (HTML).",
      },
      {
        id: "E1-S4",
        title: "Evidence and confidence scoring",
        description: "Each observation includes an evidence field (direct transcript quote) and confidence level (high/medium/low) so reviewers can trace findings back to the source.",
      },
      {
        id: "E1-S5",
        title: "Token usage and cost tracking",
        description: "Every Gemini call tracks promptTokens, completionTokens, totalTokens, and estimatedCost ($0.10/1M input, $0.40/1M output). Displayed in the UI and persisted to BigQuery.",
      },
      {
        id: "E1-S6",
        title: "Color-coded HTML transition status",
        description: "Transition status and follow-up areas are rendered as HTML with inline-styled badges using the brand color palette (GREEN, YELLOW, RED, BLUE, GRAY).",
      },
    ],
  },
  {
    id: "E2",
    title: "Dynamic Observation Definitions",
    icon: <Layers className="h-5 w-5 text-primary" />,
    description: "Configurable clinical observation topics stored in BigQuery that drive the Gemini prompt at analysis time.",
    stories: [
      {
        id: "E2-S1",
        title: "Observations CRUD API",
        description: "Full REST API (GET, POST, PUT, DELETE) for managing observation definitions. Supports name, display_name, domain, value_type, enum values with color mappings, and active/inactive toggling.",
      },
      {
        id: "E2-S2",
        title: "Observations management UI",
        description: "Dedicated page at /observations with inline editing, drag-and-drop reordering, enum value management, and per-observation prompt guidance.",
      },
      {
        id: "E2-S3",
        title: "Default seed observations",
        description: "11 post-discharge clinical topics auto-seeded on first run: Overall Feeling, Disposition Change, Prescription Pickup, Medication Adherence, Follow-up Appointment, DME/Supplies, Home Health Visit, Discharge Instructions, Encompass Feedback, Experience Comments, and Other.",
      },
      {
        id: "E2-S4",
        title: "Per-observation prompt guidance",
        description: "Each observation supports an optional promptGuidance field — custom instructions to Gemini for how to evaluate that specific topic.",
      },
      {
        id: "E2-S5",
        title: "Dynamic prompt assembly",
        description: "The Gemini prompt is built at runtime from all active observations, including their enum values, domains, and guidance. Changes take effect on the next API call without redeployment.",
      },
    ],
  },
  {
    id: "E3",
    title: "Context Parameters",
    icon: <Wrench className="h-5 w-5 text-primary" />,
    description: "Configurable input parameters that API callers pass alongside the transcript to give Gemini known context about the patient's care.",
    stories: [
      {
        id: "E3-S1",
        title: "Context parameters CRUD API",
        description: "REST API for defining context parameters with name (snake_case), display_name, data_type (string, number, date, boolean, enum), and enum value options.",
      },
      {
        id: "E3-S2",
        title: "Context parameters management UI",
        description: "Dedicated page at /context-parameters for creating, editing, reordering, and deleting context parameter definitions.",
      },
      {
        id: "E3-S3",
        title: "Prompt injection of known context",
        description: "Active context parameter values passed in the API request are injected into the Gemini prompt as a KNOWN CONTEXT section, helping resolve ambiguity (e.g., 'Not Applicable' vs 'Not Discussed').",
      },
      {
        id: "E3-S4",
        title: "Default context parameters",
        description: "Two default parameters seeded: home_health_ordered (enum: true/false) and dme_or_supplies_ordered (enum: true/false).",
      },
    ],
  },
  {
    id: "E4",
    title: "Prompt Management & Versioning",
    icon: <Target className="h-5 w-5 text-primary" />,
    description: "Tools for customizing the system prompt and tracking which version was used for each analysis.",
    stories: [
      {
        id: "E4-S1",
        title: "Summary prompt customization",
        description: "Editable summary instruction at /summary-prompt with a {{SUMMARY_TOPICS}} placeholder that is replaced with the active observation names at runtime.",
      },
      {
        id: "E4-S2",
        title: "General observations guidance",
        description: "A global guidance instruction that applies to all observations, configurable via the settings API.",
      },
      {
        id: "E4-S3",
        title: "Generated prompt viewer",
        description: "Read-only page at /generated-prompt showing the fully assembled prompt being sent to Gemini, including all observations, context parameters, and instructions.",
      },
      {
        id: "E4-S4",
        title: "Prompt versioning via SHA-256",
        description: "Each prompt is hashed to produce a version number. Every analysis result records the prompt_version and prompt_version_date, enabling traceability and A/B comparisons.",
      },
      {
        id: "E4-S5",
        title: "GET /api/prompt endpoint",
        description: "Returns the current prompt template, version hash, and version date for external systems to inspect.",
      },
    ],
  },
  {
    id: "E5",
    title: "BigQuery Analytics & Storage",
    icon: <Database className="h-5 w-5 text-primary" />,
    description: "All configuration and analysis results are stored in Google BigQuery for analytics, auditing, and reporting.",
    stories: [
      {
        id: "E5-S1",
        title: "call_info table",
        description: "One row per API call capturing: call_id, care_flow_id, processed_datetime, source_type, source_id, processed_at, processing_time_ms, prompt_version, context_values (JSON), transcript_length, summary, follow_up_areas, transition_status, token counts, estimated_cost, status, and error_message.",
      },
      {
        id: "E5-S2",
        title: "call_observations table",
        description: "One row per extracted observation per call: call_id (FK), observation_name, display_name, domain, value_type, value, detail, evidence, and confidence. No duplication of call-level data.",
      },
      {
        id: "E5-S3",
        title: "observations configuration table",
        description: "Stores observation definitions (id, name, display_name, domain, display_order, value_type, value JSON, is_active, prompt_guidance) used by the prompt builder.",
      },
      {
        id: "E5-S4",
        title: "context_parameters table",
        description: "Stores context parameter definitions (id, name, display_name, description, data_type, enum_values, is_active, display_order).",
      },
      {
        id: "E5-S5",
        title: "settings table",
        description: "Key-value store for prompt-related settings: summary_instruction, observations_guidance, and their version tracking.",
      },
      {
        id: "E5-S6",
        title: "Auto-provisioning",
        description: "All BigQuery tables and the dataset are automatically created on first use if they don't exist, with no manual migration needed.",
      },
    ],
  },
  {
    id: "E6",
    title: "API Playground & Testing UI",
    icon: <Layout className="h-5 w-5 text-primary" />,
    description: "Interactive test interface for running transcripts through the full analysis pipeline and viewing structured results.",
    stories: [
      {
        id: "E6-S1",
        title: "Sample transcript library",
        description: "Seven pre-loaded transcripts covering diverse scenarios: Struggling Patient, Positive Experience, No DME/HH, Medication Issues, Caregiver Call, Still in Hospital, and Readmitted (Back Home).",
      },
      {
        id: "E6-S2",
        title: "Context parameter inputs",
        description: "Dynamic form fields generated from active context parameters, auto-populated when selecting sample transcripts that include context values.",
      },
      {
        id: "E6-S3",
        title: "Structured result display",
        description: "Results shown in cards: response metadata, token usage metrics bar, summary, observations with value badges/evidence/confidence, follow-up areas, and transition status.",
      },
      {
        id: "E6-S4",
        title: "Raw JSON toggle",
        description: "Toggle to view the full JSON API response alongside the formatted display for debugging and integration development.",
      },
    ],
  },
  {
    id: "E7",
    title: "Processed Calls History",
    icon: <BarChart3 className="h-5 w-5 text-primary" />,
    description: "Analytics view of all processed calls with drill-down detail panels, queried directly from BigQuery.",
    stories: [
      {
        id: "E7-S1",
        title: "Call list view",
        description: "Paginated list at /calls showing all processed calls with call_id, processed_at timestamp, status (success/error), total tokens, and estimated cost.",
      },
      {
        id: "E7-S2",
        title: "Call detail modal",
        description: "Click any call to open a detail panel showing: metadata, context values, token breakdown, summary, all extracted observations with evidence and confidence, follow-up areas, and transition status.",
      },
      {
        id: "E7-S3",
        title: "Error call visibility",
        description: "Failed calls are displayed with destructive styling and the error message, providing full visibility into both successful and failed processing attempts.",
      },
      {
        id: "E7-S4",
        title: "GET /api/calls and GET /api/calls/:callId",
        description: "Backend endpoints that query BigQuery call_info and call_observations tables with parameterized queries and limit clamping (1-500).",
      },
    ],
  },
  {
    id: "E8",
    title: "CI/CD & Cloud Run Deployment",
    icon: <Globe className="h-5 w-5 text-primary" />,
    description: "Containerized deployment to Google Cloud Run with automated CI/CD via Cloud Build.",
    stories: [
      {
        id: "E8-S1",
        title: "Multi-stage Dockerfile",
        description: "Node 20 builder stage compiles TypeScript and bundles frontend; runner stage produces a minimal production image.",
      },
      {
        id: "E8-S2",
        title: "Cloud Build pipeline",
        description: "cloudbuild.yaml triggers on GitHub push to main — builds Docker image, pushes to GCR, and deploys to Cloud Run with secret injection.",
      },
      {
        id: "E8-S3",
        title: "Manual deploy script",
        description: "deploy.sh for ad-hoc deployments via gcloud CLI with configurable region (us-central1) and port (8080).",
      },
      {
        id: "E8-S4",
        title: "Secret management",
        description: "GCP_SERVICE_ACCOUNT_KEY stored in GCP Secret Manager and injected as environment variable at runtime. Single credential powers both Vertex AI and BigQuery.",
      },
    ],
  },
];

function EpicCard({ epic }: { epic: Epic }) {
  return (
    <Card className="border-border/60 shadow-sm" data-testid={`card-epic-${epic.id}`}>
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-lg flex items-center gap-2 text-secondary">
          {epic.icon}
          <span>{epic.id}: {epic.title}</span>
          <Badge variant="outline" className="text-xs ml-auto">
            {epic.stories.length} stories
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">{epic.description}</p>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {epic.stories.map((story) => (
            <div
              key={story.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/10"
              data-testid={`story-${story.id}`}
            >
              <CheckCircle2 className="h-4 w-4 text-[#96d410] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono text-muted-foreground shrink-0">
                    {story.id}
                  </Badge>
                  <span className="font-medium text-sm text-foreground">{story.title}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{story.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectOverview() {
  const totalStories = EPICS.reduce((sum, e) => sum + e.stories.length, 0);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-secondary tracking-tight flex items-center gap-2" data-testid="heading-project-overview">
            <Box className="h-6 w-6 text-primary" />
            Project Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Guideway Care Call Observation Extraction — Epics & Stories
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5 shadow-sm mb-8" data-testid="card-project-summary">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6 mb-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary" data-testid="stat-epics">{EPICS.length}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Epics</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary" data-testid="stat-stories">{totalStories}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Stories</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-[#96d410]" data-testid="stat-completed">{totalStories}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
              </div>
            </div>
            <Separator className="my-4" />
            <p className="text-sm text-foreground leading-relaxed">
              A full-stack API on GCP Cloud Run that accepts post-discharge call transcripts, processes them through Vertex AI Gemini, and returns structured clinical analysis. Features include dynamic BigQuery-driven observation definitions, configurable context parameters, per-observation prompt guidance, prompt versioning, a management UI, analytics logging, and CI/CD via GitHub and Cloud Build.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge variant="secondary" className="text-xs">React + Vite</Badge>
              <Badge variant="secondary" className="text-xs">Express.js</Badge>
              <Badge variant="secondary" className="text-xs">TypeScript</Badge>
              <Badge variant="secondary" className="text-xs">Vertex AI Gemini</Badge>
              <Badge variant="secondary" className="text-xs">BigQuery</Badge>
              <Badge variant="secondary" className="text-xs">Cloud Run</Badge>
              <Badge variant="secondary" className="text-xs">Cloud Build</Badge>
              <Badge variant="secondary" className="text-xs">Tailwind CSS</Badge>
              <Badge variant="secondary" className="text-xs">shadcn/ui</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {EPICS.map((epic) => (
            <EpicCard key={epic.id} epic={epic} />
          ))}
        </div>
      </div>
    </div>
  );
}
