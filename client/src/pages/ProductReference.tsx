import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Target, Layers, Flag, CheckCircle2, Clock, AlertTriangle, Lightbulb, Users, Zap, Shield, BarChart3, GitBranch, FileText } from "lucide-react";
import { jsPDF } from "jspdf";

const STATUS_COLORS: Record<string, string> = {
  done: "bg-green-100 text-green-800 border-green-200",
  "in-progress": "bg-blue-100 text-blue-800 border-blue-200",
  planned: "bg-amber-100 text-amber-800 border-amber-200",
  backlog: "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  done: <CheckCircle2 className="h-3.5 w-3.5" />,
  "in-progress": <Clock className="h-3.5 w-3.5" />,
  planned: <Flag className="h-3.5 w-3.5" />,
  backlog: <Lightbulb className="h-3.5 w-3.5" />,
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${STATUS_COLORS[status] || STATUS_COLORS.backlog}`}>
      {STATUS_ICONS[status] || STATUS_ICONS.backlog}
      {status.replace("-", " ")}
    </Badge>
  );
}

interface Story {
  title: string;
  status: "done" | "in-progress" | "planned" | "backlog";
  acceptanceCriteria?: string[];
}

interface Epic {
  name: string;
  description: string;
  stories: Story[];
}

interface Theme {
  name: string;
  icon: React.ReactNode;
  description: string;
  epics: Epic[];
}

const NORTH_STAR = {
  metric: "100% of post-discharge call observations and care gaps are identified — across every client and pathway",
  target: "Every observation extracted, every gap flagged — zero missed follow-ups, regardless of program",
  description: "Every post-discharge patient call is fully analyzed so that all clinical observations are captured and all care gaps are surfaced. The multi-tenant architecture ensures each client and pathway has its own tailored observation definitions, context parameters, prompt guidance, and Call QA criteria — while all data flows into a unified analytics layer. Care teams have complete visibility into what was discussed, what was missed, and where follow-up is needed — ensuring no patient falls through the cracks.",
};

const VISION = "A unified, multi-tenant AI-powered platform that transforms unstructured patient call transcripts into structured, evidence-based clinical observations — driving faster follow-up, better outcomes, and complete visibility into post-discharge care transitions across all clients and pathways.";

const PERSONAS: { name: string; role: string; needs: string }[] = [
  { name: "Care Guide", role: "Frontline caller", needs: "Automated call summaries so they can focus on the next patient instead of writing notes" },
  { name: "Clinical Supervisor", role: "Quality oversight", needs: "Structured observations with confidence levels to quickly identify patients who need escalation" },
  { name: "Operations Lead", role: "Program management", needs: "Analytics on call volumes, common issues, and observation trends across the patient population" },
  { name: "Integration Engineer", role: "Awell / EHR developer", needs: "Reliable, well-documented API with consistent response structure and error handling" },
];

const THEMES: Theme[] = [
  {
    name: "Multi-Tenant Architecture",
    icon: <Users className="h-5 w-5 text-primary" />,
    description: "Client & Pathway scoping — each tenant has its own observations, context parameters, prompt settings, Call QA prompts, and analytics",
    epics: [
      {
        name: "Client & Pathway Management",
        description: "CRUD management of clients and pathways as the top-level organizational unit",
        stories: [
          { title: "Client & Pathway entity with client name, pathway label, and description", status: "done" },
          { title: "CRUD API for client-pathways (GET, POST, PUT, DELETE)", status: "done" },
          { title: "Sidebar ClientPathwayPicker with collapsible card showing current selection", status: "done" },
          { title: "Persistent selection via localStorage — remembered across sessions", status: "done" },
          { title: "All config data scoped to clientPathwayId (observations, context params, settings, Call QA prompts)", status: "done" },
          { title: "API analyze endpoint accepts client and pathway fields for routing", status: "done" },
          { title: "call_info table stores client and pathway strings for filtering", status: "done" },
          { title: "Setup nav section labeled with selected client name (e.g. 'Encompass Setup')", status: "done" },
        ],
      },
      {
        name: "Tenant-Scoped Configuration",
        description: "All setup endpoints cascade from the selected client/pathway",
        stories: [
          { title: "Observations CRUD scoped by clientPathwayId query/body param", status: "done" },
          { title: "Context parameters CRUD scoped by clientPathwayId", status: "done" },
          { title: "Settings (summary instruction, observations guidance, barriers guidance) scoped by clientPathwayId", status: "done" },
          { title: "Call QA prompts scoped by clientPathwayId", status: "done" },
          { title: "Prompt generation uses tenant-specific config at analysis time", status: "done" },
          { title: "Default seed data created per new client/pathway", status: "backlog" },
        ],
      },
    ],
  },
  {
    name: "Core AI Extraction",
    icon: <Zap className="h-5 w-5 text-primary" />,
    description: "The Gemini-powered engine that transforms transcripts into structured clinical observations",
    epics: [
      {
        name: "Transcript Analysis Pipeline",
        description: "End-to-end processing from raw transcript to structured JSON output",
        stories: [
          { title: "Accept source_text and return structured analysis via POST endpoint", status: "done" },
          { title: "Extract 11 observation topics with value, detail, evidence, confidence", status: "done" },
          { title: "Generate HTML transition_status with color-coded badges", status: "done" },
          { title: "Generate follow_up_areas HTML for actionable gaps", status: "done" },
          { title: "Third-person perspective enforcement in all output", status: "done" },
          { title: "Anti-hallucination rules — only extract explicitly discussed topics", status: "done" },
        ],
      },
      {
        name: "Dynamic Observation Configuration",
        description: "Admin-configurable observation topics that drive the prompt dynamically",
        stories: [
          { title: "CRUD management UI for observation topics", status: "done" },
          { title: "Per-observation prompt guidance (evaluation instructions for Gemini)", status: "done" },
          { title: "Enum values with color mappings (GREEN/YELLOW/RED/BLUE/GRAY)", status: "done" },
          { title: "Drag-to-reorder observations", status: "done" },
          { title: "Active/inactive toggle per observation", status: "done" },
          { title: "AI assistant for observation improvement suggestions", status: "done" },
          { title: "Observation templates library (pre-built sets for common programs)", status: "backlog" },
        ],
      },
      {
        name: "Context Parameters",
        description: "Caller-provided context that enriches the analysis (e.g., what was ordered at discharge)",
        stories: [
          { title: "Configurable context parameters with data types", status: "done" },
          { title: "Context rules in prompt (e.g., if not ordered → Not applicable)", status: "done" },
          { title: "Context values passed through API and logged to BigQuery", status: "done" },
          { title: "Auto-derive context from EHR data (ADT feed integration)", status: "backlog" },
        ],
      },
    ],
  },
  {
    name: "API & Integration",
    icon: <GitBranch className="h-5 w-5 text-primary" />,
    description: "Secure, documented API endpoints for external systems like Awell",
    epics: [
      {
        name: "Secured Production Endpoint",
        description: "The /gwc_observation_summarization endpoint with API key auth",
        stories: [
          { title: "POST /gwc_observation_summarization with X-API-Key header", status: "done" },
          { title: "Response field renaming (transition_status → observations_summary_formatted)", status: "done" },
          { title: "Legacy /api/analyze endpoint maintained for backward compatibility", status: "done" },
          { title: "API key stored in GCP Secret Manager", status: "done" },
          { title: "Rate limiting per API key", status: "backlog" },
          { title: "Webhook callbacks for async processing of long transcripts", status: "backlog" },
        ],
      },
      {
        name: "Awell Integration",
        description: "Direct integration with Awell care orchestration platform",
        stories: [
          { title: "Awell configured to call secured endpoint with API key", status: "done" },
          { title: "care_flow_id, source_type, source_id passed from Awell", status: "done" },
          { title: "Awell integration guide in API Reference page", status: "done" },
          { title: "Awell error handling and retry logic documentation", status: "planned" },
          { title: "Bi-directional Awell integration (push observations back to care flow)", status: "backlog" },
        ],
      },
      {
        name: "API Documentation",
        description: "Developer-facing documentation and reference materials",
        stories: [
          { title: "API Reference page with cURL examples", status: "done" },
          { title: "Request/response schema documentation", status: "done" },
          { title: "Export API docs to HTML", status: "done" },
          { title: "OpenAPI/Swagger spec generation", status: "backlog" },
          { title: "Postman collection", status: "backlog" },
        ],
      },
    ],
  },
  {
    name: "Prompt Engineering & Quality",
    icon: <Target className="h-5 w-5 text-primary" />,
    description: "Prompt management, versioning, and output quality controls",
    epics: [
      {
        name: "Prompt Management",
        description: "Tools to view, edit, and version the Gemini prompt",
        stories: [
          { title: "Dynamic prompt generation from observations + context + guidance", status: "done" },
          { title: "Prompt versioning with SHA-256 hash change detection", status: "done" },
          { title: "Summary instruction customization", status: "done" },
          { title: "General observations guidance (cross-observation rules)", status: "done" },
          { title: "Generated prompt preview page", status: "done" },
          { title: "Prompt A/B testing (compare versions side-by-side)", status: "backlog" },
          { title: "Prompt regression testing with golden transcripts", status: "backlog" },
        ],
      },
      {
        name: "Output Quality",
        description: "Ensuring Gemini produces accurate, consistent, well-formatted output",
        stories: [
          { title: "Evaluation guidance separated from output instructions", status: "done" },
          { title: "Anti-hallucination enforcement (require explicit evidence)", status: "done" },
          { title: "Not Discussed default for unmentioned topics", status: "done" },
          { title: "Confidence scoring (high/medium/low) per observation", status: "done" },
          { title: "Output validation — verify all observations returned", status: "planned" },
          { title: "Automated quality scoring per call (accuracy metric)", status: "backlog" },
          { title: "Human-in-the-loop review workflow for low-confidence calls", status: "backlog" },
        ],
      },
    ],
  },
  {
    name: "Analytics & Observability",
    icon: <BarChart3 className="h-5 w-5 text-primary" />,
    description: "BigQuery-powered logging, dashboards, and operational visibility",
    epics: [
      {
        name: "Call Logging",
        description: "Every API call logged to BigQuery with full metadata",
        stories: [
          { title: "call_info table with processing metrics, tokens, cost", status: "done" },
          { title: "call_observations table with per-observation detail", status: "done" },
          { title: "call_qa_pairs table with full Q&A extraction per call", status: "done" },
          { title: "barriers table with barrier extraction per call (barrier, context, category, severity, evidence)", status: "done" },
          { title: "request_body stored (minus transcript) for debugging", status: "done" },
          { title: "Error logging with error_message for failed calls", status: "done" },
          { title: "Processed Calls UI with detail drill-down", status: "done" },
          { title: "Q&A pairs display in call detail with category and observation linkage", status: "done" },
          { title: "API Request Fields display (care_flow_id, source_type, etc.)", status: "done" },
        ],
      },
      {
        name: "Analytics Dashboards",
        description: "Visual analytics for call trends, observation patterns, and costs",
        stories: [
          { title: "Token usage and cost tracking per call", status: "done" },
          { title: "Call Volume dashboard with KPI cards (total calls, success rate, avg time, cost w/ token footnote)", status: "done" },
          { title: "Stacked bar chart of daily call volume colored by client/pathway", status: "done" },
          { title: "Source type donut chart and pathway breakdown donut chart", status: "done" },
          { title: "Client/pathway performance cards with individual sparklines", status: "done" },
          { title: "Quick-filter date range pills (Today / 7D / 30D / YTD / All) with 7D default", status: "done" },
          { title: "Independent client and pathway dropdown filters with cascading pathway options", status: "done" },
          { title: "Daily breakdown table with volume counts above bars", status: "done" },
          { title: "Eastern timezone (America/New_York) for all date grouping", status: "done" },
          { title: "GET /api/calls/stats/daily endpoint with days param, returns flat grouped rows", status: "done" },
          { title: "Observation distribution charts (% Good vs Fair vs Poor)", status: "backlog" },
          { title: "Follow-up area frequency analysis", status: "backlog" },
          { title: "Cost forecasting based on volume trends", status: "backlog" },
          { title: "Looker Studio / Data Studio integration", status: "backlog" },
        ],
      },
    ],
  },
  {
    name: "Batch Processing",
    icon: <Layers className="h-5 w-5 text-primary" />,
    description: "Search, select, and reprocess historical Bland AI calls through the extraction pipeline in bulk",
    epics: [
      {
        name: "Search & Filtering",
        description: "Query historical Bland calls with flexible criteria to find calls for batch processing",
        stories: [
          { title: "Search by date range (start/end date pickers)", status: "done" },
          { title: "Filter by answered_by (Human, Voicemail, No Answer)", status: "done" },
          { title: "Filter by call duration (min/max seconds)", status: "done" },
          { title: "Filter by specific call IDs (comma-separated)", status: "done" },
          { title: "Tag-based filtering — Must Have / Exclude toggles (green/red pill buttons)", status: "done" },
          { title: "Processing status filter — Not Yet Processed / Already Processed / All", status: "done" },
          { title: "Configurable result limit", status: "done" },
        ],
      },
      {
        name: "Batch Creation & Management",
        description: "Turn search results into a batch for processing — select individual calls or all results",
        stories: [
          { title: "Select/deselect individual calls from search results", status: "done" },
          { title: "Select All / Deselect All toggle", status: "done" },
          { title: "Load selected calls into a new batch (DML INSERT to BigQuery batch_processing table)", status: "done" },
          { title: "Batch summary dashboard — total, pending, completed, failed counts", status: "done" },
          { title: "Batch items table with status, call ID, care flow ID, error details", status: "done" },
          { title: "Recreate batch from failed/incomplete items", status: "done" },
          { title: "Reset failed items to pending for retry", status: "done" },
        ],
      },
      {
        name: "Batch Processing Pipeline",
        description: "Process pending batch items through the Gemini extraction pipeline with the same prompt as the live API",
        stories: [
          { title: "Process N items at a time (configurable batch size)", status: "done" },
          { title: "Each item: fetch transcript → call Gemini → write call_info + call_observations + call_qa_pairs + barriers", status: "done" },
          { title: "call_id = Bland call_id (matches source for processed filter cross-reference)", status: "done" },
          { title: "Status tracking per item: pending → processing → completed / failed", status: "done" },
          { title: "Error capture — failed items store error message for debugging", status: "done" },
          { title: "Skips items with no transcript", status: "done" },
          { title: "Batch job Docker container for Cloud Run Jobs (Dockerfile.batch)", status: "done" },
        ],
      },
      {
        name: "Data Flow Summary",
        description: "How data moves through the batch system end-to-end",
        stories: [
          {
            title: "1. User sets search filters (dates, tags, duration, processing status) and clicks Search",
            status: "done",
            acceptanceCriteria: [
              "Queries Bland.calls + Bland.variables + Bland.tags in BigQuery",
              "Cross-references call_info.source_id to determine processed vs unprocessed",
              "Returns matching calls with call_id, transcript, care_flow_id, duration, answered_by, tags",
            ],
          },
          {
            title: "2. User selects calls from results and clicks Load to Batch",
            status: "done",
            acceptanceCriteria: [
              "Creates rows in call_information.batch_processing table via DML INSERT (not streaming API)",
              "Each row: bland_call_id, transcript, care_flow_id, status='pending', batch_id=timestamp",
            ],
          },
          {
            title: "3. User clicks Process Batch to run extraction on pending items",
            status: "done",
            acceptanceCriteria: [
              "Fetches pending items from batch_processing table (newest batch first)",
              "For each item: builds prompt from current observation config → calls Gemini → parses response",
              "Writes to call_info (summary, observations_summary, follow_up, tokens, cost)",
              "Writes to call_observations (one row per observation topic with value, detail, evidence, confidence)",
              "Writes to call_qa_pairs (one row per Q&A exchange with category and observation linkage)",
              "Writes to barriers (one row per barrier with context, category, severity, evidence, and observation linkage)",
              "Updates batch_processing row status to completed or failed",
            ],
          },
          {
            title: "4. Results visible in Call History — click any call to see full detail including Q&A pairs",
            status: "done",
            acceptanceCriteria: [
              "Call detail panel shows summary, observations, Q&A pairs, follow-up areas, transition status",
              "Q&A pairs displayed in chronological order with category badges and observation links",
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Infrastructure & DevOps",
    icon: <Shield className="h-5 w-5 text-primary" />,
    description: "Cloud Run deployment, CI/CD, and operational reliability",
    epics: [
      {
        name: "Cloud Run Deployment",
        description: "Production hosting on GCP Cloud Run",
        stories: [
          { title: "Dockerized deployment to Cloud Run", status: "done" },
          { title: "GCP Secret Manager for API keys", status: "done" },
          { title: "IAM roles for service account (BigQuery, Secret Manager, Vertex AI)", status: "done" },
          { title: "Custom domain mapping", status: "backlog" },
          { title: "Auto-scaling configuration", status: "backlog" },
        ],
      },
      {
        name: "CI/CD Pipeline",
        description: "Automated build and deploy via GitHub + Cloud Build",
        stories: [
          { title: "GitHub → Cloud Build → Cloud Run pipeline", status: "done" },
          { title: "Auto-deploy on push to main", status: "done" },
          { title: "Staging environment for pre-production testing", status: "backlog" },
          { title: "Automated integration tests in CI", status: "backlog" },
        ],
      },
    ],
  },
];

const RISKS = [
  { risk: "Gemini hallucination on short/ambiguous transcripts", mitigation: "Anti-hallucination rules + evidence requirement + confidence scoring", severity: "medium" },
  { risk: "Prompt guidance copied into output instead of followed", mitigation: "Separated guidance into comments with explicit 'do not copy' instructions", severity: "low" },
  { risk: "BigQuery costs scaling with call volume", mitigation: "Monitor token usage/cost per call; consider batch processing for high volume", severity: "low" },
  { risk: "API key compromise", mitigation: "API key in Secret Manager; rotate on suspected compromise; consider short-lived tokens", severity: "medium" },
  { risk: "Gemini model deprecation or behavior change", mitigation: "Model version pinned (gemini-2.0-flash-001); prompt versioning tracks changes", severity: "medium" },
];

function exportProductReferencePdf() {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 15;
  const mR = 15;
  const cW = pageW - mL - mR;
  let y = 15;

  const PRIMARY: [number, number, number] = [0, 152, 219];
  const NAVY: [number, number, number] = [23, 41, 56];
  const GRAY: [number, number, number] = [107, 114, 128];
  const STATUS_CLR: Record<string, [number, number, number]> = {
    done: [22, 163, 74],
    "in-progress": [37, 99, 235],
    planned: [217, 119, 6],
    backlog: [107, 114, 128],
  };

  function pb(needed: number) {
    if (y + needed > pageH - 15) { doc.addPage(); y = 15; }
  }

  function heading(title: string) {
    pb(16);
    y += 5;
    doc.setFillColor(...PRIMARY);
    doc.rect(mL, y, cW, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(title, mL + 3, y + 6.5);
    y += 14;
    doc.setTextColor(0, 0, 0);
  }

  function subheading(title: string, right?: string) {
    pb(10);
    y += 2;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(title, mL, y);
    if (right) {
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.setFont("helvetica", "normal");
      doc.text(right, pageW - mR, y, { align: "right" });
    }
    y += 6;
  }

  function para(text: string, fontSize = 8, indent = 0) {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...NAVY);
    const lines = doc.splitTextToSize(text, cW - indent);
    for (const l of lines) {
      pb(5);
      doc.text(l, mL + indent, y);
      y += 4;
    }
    y += 1;
  }

  function bullet(text: string, indent = 3) {
    pb(6);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...NAVY);
    const lines = doc.splitTextToSize(text, cW - indent - 4);
    doc.text("\u2022", mL + indent, y);
    doc.text(lines, mL + indent + 4, y);
    y += lines.length * 4 + 1;
  }

  function storyLine(title: string, status: string, indent = 5) {
    pb(6);
    const clr = STATUS_CLR[status] || STATUS_CLR.backlog;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...clr);
    const tag = status.replace("-", " ").toUpperCase();
    const tagW = doc.getTextWidth(tag) + 4;
    doc.setFillColor(...clr);
    doc.roundedRect(mL + indent, y - 3, tagW + 2, 4.5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(tag, mL + indent + 1.5, y);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...NAVY);
    const lines = doc.splitTextToSize(title, cW - indent - tagW - 8);
    doc.text(lines, mL + indent + tagW + 4, y);
    y += lines.length * 4 + 1;
  }

  function divider() {
    pb(4);
    doc.setDrawColor(200, 200, 210);
    doc.line(mL, y, pageW - mR, y);
    y += 4;
  }

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Guideway Care", mL, 13);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Product Reference — Call Observation Extraction", mL, 21);
  doc.setFontSize(7);
  doc.setTextColor(200, 200, 200);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - mR, 21, { align: "right" });
  y = 38;

  const totalS = THEMES.flatMap(t => t.epics.flatMap(e => e.stories)).length;
  const doneS = THEMES.flatMap(t => t.epics.flatMap(e => e.stories.filter(s => s.status === "done"))).length;
  const ipS = THEMES.flatMap(t => t.epics.flatMap(e => e.stories.filter(s => s.status === "in-progress"))).length;
  const planS = THEMES.flatMap(t => t.epics.flatMap(e => e.stories.filter(s => s.status === "planned"))).length;
  const blS = totalS - doneS - ipS - planS;
  const pct = Math.round((doneS / totalS) * 100);

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(mL, y, cW, 14, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  const statsText = `Done: ${doneS}   |   In Progress: ${ipS}   |   Planned: ${planS}   |   Backlog: ${blS}   |   ${pct}% Complete`;
  doc.text(statsText, pageW / 2, y + 9, { align: "center" });
  y += 20;

  heading("North Star Metric");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  const nsLines = doc.splitTextToSize(NORTH_STAR.metric, cW);
  for (const l of nsLines) { pb(5); doc.text(l, mL, y); y += 5; }
  y += 1;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PRIMARY);
  doc.text(`Target: ${NORTH_STAR.target}`, mL, y);
  y += 6;
  para(NORTH_STAR.description);

  heading("Product Vision");
  para(`"${VISION}"`, 9);

  heading("User Personas");
  for (const p of PERSONAS) {
    pb(12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(p.name, mL, y);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PRIMARY);
    doc.text(`  (${p.role})`, mL + doc.getTextWidth(p.name), y);
    y += 5;
    para(p.needs, 8, 3);
  }

  for (const theme of THEMES) {
    const td = theme.epics.flatMap(e => e.stories.filter(s => s.status === "done")).length;
    const tt = theme.epics.flatMap(e => e.stories).length;
    const tp = Math.round((td / tt) * 100);
    heading(`${theme.name}  (${td}/${tt} — ${tp}%)`);
    para(theme.description);
    divider();

    for (const epic of theme.epics) {
      subheading(epic.name);
      para(epic.description, 7, 2);
      for (const story of epic.stories) {
        storyLine(story.title, story.status);
        if (story.acceptanceCriteria) {
          for (const ac of story.acceptanceCriteria) {
            bullet(ac, 10);
          }
        }
      }
      y += 2;
    }
  }

  heading("Risks & Mitigations");
  for (const r of RISKS) {
    pb(12);
    const sevClr = r.severity === "high" ? [220, 38, 38] as [number, number, number] :
                   r.severity === "medium" ? [217, 119, 6] as [number, number, number] :
                   [22, 163, 74] as [number, number, number];
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(...sevClr);
    const sevTag = r.severity.toUpperCase();
    const sevW = doc.getTextWidth(sevTag) + 4;
    doc.roundedRect(mL, y - 3, sevW + 2, 4.5, 1, 1, "F");
    doc.text(sevTag, mL + 1.5, y);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(r.risk, mL + sevW + 4, y);
    y += 5;
    para(`Mitigation: ${r.mitigation}`, 7, 3);
  }

  heading("Recommended Additions");
  const recs = [
    { t: "Multi-Program Support", d: "Different observation sets per program (e.g., cardiac vs orthopedic)." },
    { t: "Patient Longitudinal View", d: "Track a patient across multiple calls to see observation changes over time." },
    { t: "Quality Scoring & Benchmarking", d: "Automated quality score per call. Compare care guides against benchmarks." },
    { t: "Alert Rules Engine", d: "Configurable rules that trigger alerts based on observation values." },
    { t: "RBAC & Audit Trail", d: "Role-based access control and audit log for configuration changes." },
    { t: "Model Evaluation Framework", d: "Golden dataset with known-good outputs for prompt regression testing." },
  ];
  for (const r of recs) {
    pb(10);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(r.t, mL, y);
    y += 5;
    para(r.d, 7, 3);
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(
      `Guideway Care — Product Reference — Page ${i} of ${totalPages}`,
      pageW / 2,
      pageH - 7,
      { align: "center" }
    );
  }

  doc.save("guideway-care-product-reference.pdf");
}

export default function ProductReference() {
  const totalStories = THEMES.flatMap(t => t.epics.flatMap(e => e.stories)).length;
  const doneStories = THEMES.flatMap(t => t.epics.flatMap(e => e.stories.filter(s => s.status === "done"))).length;
  const inProgressStories = THEMES.flatMap(t => t.epics.flatMap(e => e.stories.filter(s => s.status === "in-progress"))).length;
  const plannedStories = THEMES.flatMap(t => t.epics.flatMap(e => e.stories.filter(s => s.status === "planned"))).length;
  const backlogStories = THEMES.flatMap(t => t.epics.flatMap(e => e.stories.filter(s => s.status === "backlog"))).length;
  const progress = Math.round((doneStories / totalStories) * 100);

  return (
    <div className="h-full bg-background text-foreground font-sans">
      <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
              Product Reference
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Agile breakdown of GWC Call Observation Extraction — North Star, themes, epics, and user stories.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            data-testid="button-export-pdf"
            onClick={() => exportProductReferencePdf()}
          >
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{doneStories}</p>
            <p className="text-[10px] text-green-600 uppercase font-semibold">Done</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{inProgressStories}</p>
            <p className="text-[10px] text-blue-600 uppercase font-semibold">In Progress</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{plannedStories}</p>
            <p className="text-[10px] text-amber-600 uppercase font-semibold">Planned</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-600">{backlogStories}</p>
            <p className="text-[10px] text-gray-500 uppercase font-semibold">Backlog</p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{progress}%</p>
            <p className="text-[10px] text-primary uppercase font-semibold">Complete</p>
          </div>
        </div>

        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              North Star Metric
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-white/80 rounded-lg p-4 border border-primary/10">
              <p className="text-lg font-semibold text-foreground">{NORTH_STAR.metric}</p>
              <p className="text-sm text-primary font-medium mt-1">Target: {NORTH_STAR.target}</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{NORTH_STAR.description}</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Product Vision
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground italic">"{VISION}"</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              User Personas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PERSONAS.map((p) => (
                <div key={p.name} className="border border-border/50 rounded-lg p-3 bg-muted/10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{p.name}</span>
                    <Badge variant="outline" className="text-[10px]">{p.role}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.needs}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Themes, Epics & User Stories
          </h2>

          {THEMES.map((theme) => {
            const themeDone = theme.epics.flatMap(e => e.stories.filter(s => s.status === "done")).length;
            const themeTotal = theme.epics.flatMap(e => e.stories).length;
            const themeProgress = Math.round((themeDone / themeTotal) * 100);

            return (
              <Card key={theme.name} className="border-border/60 shadow-sm" data-testid={`theme-${theme.name.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {theme.icon}
                      {theme.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{themeDone}/{themeTotal}</span>
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${themeProgress}%` }} />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{theme.description}</p>
                </CardHeader>
                <CardContent className="pt-4 space-y-5">
                  {theme.epics.map((epic) => (
                    <div key={epic.name}>
                      <div className="mb-2">
                        <h4 className="text-sm font-semibold text-foreground">{epic.name}</h4>
                        <p className="text-xs text-muted-foreground">{epic.description}</p>
                      </div>
                      <div className="space-y-1.5 ml-2">
                        {epic.stories.map((story, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors"
                          >
                            <StatusBadge status={story.status} />
                            <span className="text-sm text-foreground flex-1">{story.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-amber-200 bg-amber-50/30 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Risks & Mitigations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {RISKS.map((r, i) => (
                <div key={i} className="border border-border/50 rounded-lg p-3 bg-white/60">
                  <div className="flex items-start gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        r.severity === "high" ? "border-red-300 text-red-700" :
                        r.severity === "medium" ? "border-amber-300 text-amber-700" :
                        "border-green-300 text-green-700"
                      }`}
                    >
                      {r.severity}
                    </Badge>
                    <span className="text-sm font-medium">{r.risk}</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-14">{r.mitigation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              What's Missing? — Recommended Additions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-1">Multi-Program Support <Badge variant="outline" className="text-[10px] ml-1 border-green-300 text-green-700">Partially Done</Badge></h4>
                <p className="text-xs text-muted-foreground">Multi-tenant Client & Pathway architecture is live — each tenant has its own observations, context params, settings, and Call QA prompts. Future: program-level grouping across pathways (e.g., cardiac vs orthopedic program templates).</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">Patient Longitudinal View</h4>
                <p className="text-xs text-muted-foreground">Track a patient across multiple calls to see how their observations change over time. Link calls by patient ID (from care_flow_id or a dedicated patient identifier).</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">Quality Scoring & Benchmarking</h4>
                <p className="text-xs text-muted-foreground">Automated quality score per call (completeness, accuracy). Compare care guides against benchmarks. Identify training opportunities.</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">Alert Rules Engine</h4>
                <p className="text-xs text-muted-foreground">Configurable rules that trigger alerts based on observation values (e.g., disposition change → immediate notification to clinical team). Could integrate with PagerDuty, Slack, or email.</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">RBAC & Audit Trail</h4>
                <p className="text-xs text-muted-foreground">Role-based access control for the management UI. Audit log of who changed observation configurations, prompt guidance, and when.</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">Model Evaluation Framework</h4>
                <p className="text-xs text-muted-foreground">Golden dataset of transcripts with known-good outputs. Run prompt changes against this set to measure accuracy before deploying to production.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
