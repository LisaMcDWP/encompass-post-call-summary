import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { BookOpen, Code2, Webhook, Server, Key, Activity, Database, Settings, Phone, Download, Layers, MessageSquare, ClipboardCheck, FileText, Users, BarChart3 } from "lucide-react";
import { useRef } from "react";
import { jsPDF } from "jspdf";

function exportToHtml(contentEl: HTMLElement) {
  const clone = contentEl.cloneNode(true) as HTMLElement;
  const styles = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Guideway Care — API Reference</title>
<style>
${styles}
body { background: #0f1729; color: #e2e8f0; font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 2rem; }
</style>
</head>
<body>
${clone.innerHTML}
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "guideway-care-api-reference.html";
  a.click();
  URL.revokeObjectURL(url);
}

function exportReferencePdf() {
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
  const CODE_BG: [number, number, number] = [23, 41, 56];
  const CODE_FG: [number, number, number] = [150, 212, 16];

  function pageBreak(needed: number) {
    if (y + needed > pageH - 15) {
      doc.addPage();
      y = 15;
    }
  }

  function heading(title: string, icon?: string) {
    pageBreak(16);
    y += 5;
    doc.setFillColor(...PRIMARY);
    doc.rect(mL, y, cW, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text((icon ? icon + "  " : "") + title, mL + 3, y + 6.5);
    y += 14;
    doc.setTextColor(0, 0, 0);
  }

  function subheading(title: string) {
    pageBreak(10);
    y += 2;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(title, mL, y);
    y += 6;
  }

  function para(text: string, fontSize = 8, indent = 0) {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...NAVY);
    const lines = doc.splitTextToSize(text, cW - indent);
    for (const l of lines) {
      pageBreak(5);
      doc.text(l, mL + indent, y);
      y += 4;
    }
    y += 1;
  }

  function codeBlock(code: string) {
    const lines = code.split("\n");
    const blockH = lines.length * 3.5 + 6;
    pageBreak(Math.min(blockH, 40));
    doc.setFillColor(...CODE_BG);
    const startY = y;
    for (const line of lines) {
      pageBreak(4);
      if (y === 15) {
        doc.setFillColor(...CODE_BG);
      }
      doc.setFontSize(6.5);
      doc.setFont("courier", "normal");
      doc.setTextColor(...CODE_FG);
      doc.text(line, mL + 3, y + 2);
      y += 3.5;
    }
    y += 3;
  }

  function fieldDesc(name: string, desc: string, indent = 0) {
    pageBreak(7);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text(name, mL + indent, y);
    const nameW = doc.getTextWidth(name);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...NAVY);
    const descLines = doc.splitTextToSize(" — " + desc, cW - indent - nameW - 2);
    doc.text(descLines, mL + indent + nameW, y);
    y += descLines.length * 4 + 1;
  }

  function bulletPoint(text: string, indent = 3) {
    pageBreak(6);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...NAVY);
    const lines = doc.splitTextToSize(text, cW - indent - 4);
    doc.text("•", mL + indent, y);
    doc.text(lines, mL + indent + 4, y);
    y += lines.length * 4 + 1;
  }

  function divider() {
    pageBreak(4);
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
  doc.text("Post-Call Analysis API Reference", mL, 21);
  doc.setFontSize(7);
  doc.setTextColor(200, 200, 200);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - mR, 21, { align: "right" });
  y = 38;

  heading("Base URL");
  para("Cloud Run deployment: guideway-care-api (us-central1)");
  codeBlock("https://guideway-care-api-855188300685.us-central1.run.app");

  heading("Authentication");
  para("POST /api/analyze and management routes do not require authentication.");
  para("POST /gwc_observation_summarization requires an X-API-Key header (GWC_OBSERVATION_SUMMARIZATION_API_KEY).");

  heading("Multi-Tenant Architecture");
  para("This API uses a Client & Pathway multi-tenant architecture. Each client/pathway has its own observations, context parameters, prompt settings, Call QA prompts, and barriers guidance.");
  fieldDesc("clientPathwayId", "Required on all config endpoints (GET as query param, POST/PUT as body param).");
  fieldDesc("client + pathway", "On analyze endpoints, pass client and pathway to route to the correct tenant config.");
  divider();
  subheading("Client & Pathway CRUD");
  para("GET /api/client-pathways — Returns all client/pathway definitions.");
  para("POST /api/client-pathways — Create a new client/pathway (name, client, pathway, description).");
  para("PUT /api/client-pathways/:id — Update an existing client/pathway.");
  para("DELETE /api/client-pathways/:id — Delete a client/pathway.");

  heading("POST /api/analyze");
  para("Accepts source text with contextual metadata, processes it through Gemini AI, and returns structured clinical analysis with HTML-formatted output.");
  divider();
  subheading("Request Body Fields");
  fieldDesc("client", "(string, optional) Client name for multi-tenant routing (e.g. 'Encompass').");
  fieldDesc("pathway", "(string, optional) Pathway label (e.g. 'Post-Discharge'). With client, resolves tenant config.");
  fieldDesc("care_flow_id", "(string, optional) Identifier for the care flow.");
  fieldDesc("processed_datetime", "(string, optional) ISO 8601 datetime.");
  fieldDesc("source_type", "(string, optional) Type of source (phone_call, chat, note).");
  fieldDesc("source_id", "(string, optional) Unique identifier for the source.");
  fieldDesc("source_text", "(string, required) The full patient call transcript.");
  fieldDesc("context", "(object, optional) Key-value pairs for known context injection.");
  divider();
  subheading("Example Request");
  codeBlock(`{
  "care_flow_id": "cf_abc123",
  "processed_datetime": "2026-03-06T10:30:00Z",
  "source_type": "phone_call",
  "source_id": "call_987654321",
  "source_text": "Care Guide: Hello, this is Maria...",
  "context": {
    "home_health_ordered": "true",
    "dme_or_supplies_ordered": "false"
  }
}`);
  divider();
  subheading("Analysis Response Fields");
  fieldDesc("summary", "Brief overview of the call based on topics discussed.");
  fieldDesc("observations", "Array of observation objects (name, display_name, domain, value_type, value, detail, evidence, confidence).");
  fieldDesc("transition_status", "HTML-formatted rich text with color-coded status badges.");
  fieldDesc("follow_up_areas", "HTML-formatted list of items needing follow-up.");
  fieldDesc("qa_pairs", "Array of Q&A exchanges (question, answer, asked_by, answered_by, observation_name, category).");
  fieldDesc("barriers", "Array of barriers to care (barrier, context, category, severity, evidence, observation linkage).");
  fieldDesc("call_qa", "Array of call quality assessments (name, display_name, value, detail, evidence).");
  divider();
  subheading("Token Usage");
  fieldDesc("promptTokens", "Input tokens sent to Gemini.");
  fieldDesc("completionTokens", "Output tokens returned by Gemini.");
  fieldDesc("totalTokens", "Sum of prompt + completion tokens.");
  fieldDesc("estimatedCost", "USD cost estimate (gemini-2.0-flash-001 pricing).");

  heading("Status Badge Colors");
  bulletPoint("GREEN — positive outcomes (Good)");
  bulletPoint("YELLOW — caution / partial (Fair)");
  bulletPoint("RED — negative / missed (Poor)");
  bulletPoint("BLUE — informational (Has Questions)");
  bulletPoint("GRAY — not discussed / unknown (Not Discussed)");

  heading("Call History Endpoints");
  subheading("GET /api/calls");
  para("Returns recent processed calls ordered by processed_at descending. Optional limit query param (default 100, max 500).");
  divider();
  subheading("GET /api/calls/:callId");
  para("Returns full detail for a single call including observations, qaPairs, barriers, and callQA.");

  heading("GET /api/health");
  para("Returns service status: gemini, bigquery, and projectId availability.");

  heading("GET /api/prompt");
  para("Returns the dynamically generated prompt template, version hash, and version date.");

  heading("Call Volume Analytics");
  subheading("GET /api/calls/stats/daily");
  para("Returns daily call counts grouped by client, pathway, and source_type. Query param: days (0=today, 6=7D, 29=30D, default 30). Dates grouped by America/New_York timezone. Returns flat array of rows.");

  heading("Observations CRUD (scoped by clientPathwayId)");
  subheading("GET /api/observations");
  para("Returns all observations ordered by display_order.");
  divider();
  subheading("POST /api/observations");
  para("Create a new observation topic.");
  divider();
  subheading("PUT /api/observations/:id");
  para("Update an existing observation. Partial updates supported.");
  divider();
  subheading("DELETE /api/observations/:id");
  para("Permanently deletes an observation by ID.");
  divider();
  subheading("POST /api/observations/ai-suggest");
  para("Chat with the AI assistant for observation topic suggestions.");
  divider();
  subheading("PUT /api/observations/reorder");
  para("Reorder observations by providing an array of IDs.");
  divider();
  subheading("Observation Fields");
  fieldDesc("id", "(INT64) Auto-generated unique identifier.");
  fieldDesc("name", "(string) Machine-readable key.");
  fieldDesc("displayName", "(string) Human-readable label.");
  fieldDesc("domain", "(string) Category: clinical, medication, appointment, equipment, discharge, experience, general.");
  fieldDesc("displayOrder", "(integer) Sort order.");
  fieldDesc("valueType", "(string) One of: enum, boolean, text, number.");
  fieldDesc("value", "(array) For enum types: array of { label, color } objects.");
  fieldDesc("isActive", "(boolean) Whether included in analysis.");
  fieldDesc("promptGuidance", "(string, optional) Custom instruction for Gemini.");

  heading("Context Parameters CRUD (scoped by clientPathwayId)");
  subheading("GET /api/context-parameters");
  para("Returns all context parameters ordered by display_order.");
  divider();
  subheading("POST /api/context-parameters");
  para("Create a new context parameter.");
  divider();
  subheading("PUT /api/context-parameters/:id");
  para("Update an existing context parameter. Partial updates supported.");
  divider();
  subheading("PUT /api/context-parameters/reorder");
  para("Reorder context parameters by providing an array of IDs.");
  divider();
  subheading("DELETE /api/context-parameters/:id");
  para("Permanently deletes a context parameter by ID.");

  heading("Prompt Settings (scoped by clientPathwayId)");
  subheading("Summary Instruction");
  para("GET/PUT/DELETE /api/settings/summary-instruction — Manage the summary instruction. Supports {{SUMMARY_TOPICS}} placeholder.");
  divider();
  subheading("Observations Guidance");
  para("GET/PUT/DELETE /api/settings/observations-guidance — Manage global observations guidance.");
  divider();
  subheading("Barriers Guidance");
  para("GET/PUT/DELETE /api/settings/barriers-guidance — Manage barriers-to-care identification guidance.");

  heading("Call QA Prompts CRUD (scoped by clientPathwayId)");
  subheading("GET /api/call-qa-prompts");
  para("Returns all Call QA prompts ordered by display_order.");
  divider();
  subheading("POST /api/call-qa-prompts");
  para("Create a new Call QA prompt.");
  divider();
  subheading("PUT /api/call-qa-prompts/:id");
  para("Update an existing Call QA prompt. Partial updates supported.");
  divider();
  subheading("DELETE /api/call-qa-prompts/:id");
  para("Permanently deletes a Call QA prompt by ID.");
  divider();
  subheading("Call QA Prompt Fields");
  fieldDesc("id", "(INT64) Auto-generated unique identifier.");
  fieldDesc("name", "(string) Machine-readable key.");
  fieldDesc("displayName", "(string) Human-readable label.");
  fieldDesc("promptText", "(string) Instruction sent to Gemini for evaluation.");
  fieldDesc("responseType", "(string) One of: enum, boolean, text.");
  fieldDesc("responseOptions", "(array) For enum types, allowed response values.");
  fieldDesc("isActive", "(boolean) Whether included in analysis.");
  fieldDesc("displayOrder", "(integer) Sort order.");

  heading("PDF Export");
  para("Individual call details can be exported as PDF reports from the Call History page. Open any call detail panel and click the Export PDF button.");
  para("Includes: branded header, call metadata, summary, observations, transition status, follow-up areas, barriers, call QA, Q&A pairs, and page numbers.");

  heading("Batch Processing");
  subheading("How Batch Processing Works");
  bulletPoint("Search — Query Bland.calls in BigQuery with filters (date range, answered_by, duration, tags, processing status).");
  bulletPoint("Select — Choose individual calls or select all from results.");
  bulletPoint("Load to Batch — Selected calls inserted into batch_processing table via DML INSERT.");
  bulletPoint("Process — Click Process Batch to run pending items through Gemini. Writes call_info, call_observations, call_qa_pairs, barriers, call_qa_results.");
  bulletPoint("Review — Processed calls appear in Call History.");
  divider();
  subheading("GET /api/batch/bland-calls");
  para("Search historical Bland calls with filters: startDate, endDate, answeredBy, minDuration, maxDuration, callIds, requiredTags, excludeTags, processedFilter, limit.");
  divider();
  subheading("GET /api/batch/tags");
  para("Returns distinct tag values from Bland.tags.");
  divider();
  subheading("POST /api/batch/load");
  para("Load selected calls into a new batch for processing.");
  divider();
  subheading("POST /api/batch/process");
  para("Process pending batch items. Optional limit (default 5) and batchId params.");
  divider();
  subheading("GET /api/batch/items");
  para("Returns batch items with status. Optional limit and status filters.");
  divider();
  subheading("GET /api/batch/summary");
  para("Returns batch status counts: total, pending, processing, completed, failed.");
  divider();
  subheading("POST /api/batch/recreate");
  para("Creates new batch from non-completed items (failed + pending).");
  divider();
  subheading("POST /api/batch/reset-failed");
  para("Resets failed items back to pending for reprocessing.");

  heading("Awell Integration");
  subheading("Webhook Configuration");
  para("URL: https://guideway-care-api-855188300685.us-central1.run.app/api/analyze");
  para("Method: POST | Content-Type: application/json");
  divider();
  subheading("Response Mapping");
  fieldDesc("data.analysis.summary", "Call Summary");
  fieldDesc("data.analysis.observations", "Array of Extracted Observations");
  fieldDesc("data.analysis.transition_status", "Transition Status Details (HTML)");
  fieldDesc("data.analysis.follow_up_areas", "Follow-Up Items (HTML)");
  fieldDesc("data.analysis.qa_pairs", "Array of Q&A exchanges");
  fieldDesc("data.analysis.barriers", "Array of barriers to care");
  fieldDesc("data.analysis.call_qa", "Array of Call QA assessments");
  fieldDesc("data.tokenUsage", "Token usage and cost metrics");

  heading("GCP Deployment Setup");
  subheading("Prerequisites");
  bulletPoint("Enable APIs: Cloud Run, Cloud Build, Container Registry, Secret Manager, Vertex AI, BigQuery");
  bulletPoint("Store GCP_SERVICE_ACCOUNT_KEY in Secret Manager");
  bulletPoint("Grant Cloud Build roles: Cloud Run Admin, Service Account User, Secret Manager Secret Accessor");
  bulletPoint("Connect GitHub repo to Cloud Build trigger on main branch");
  divider();
  subheading("Service Account Roles");
  bulletPoint("Vertex AI User (for Gemini API)");
  bulletPoint("BigQuery Data Editor (for observations, settings, analytics logging)");
  bulletPoint("BigQuery Job User (for running queries)");
  divider();
  subheading("Environment Variables");
  fieldDesc("GCP_PROJECT_ID", "Google Cloud project ID");
  fieldDesc("GCP_SERVICE_ACCOUNT_KEY", "Full JSON service account key (via Secret Manager)");
  fieldDesc("GWC_OBSERVATION_SUMMARIZATION_API_KEY", "API key for secured endpoint (via Secret Manager)");
  fieldDesc("PORT", "Set automatically by Cloud Run (default 8080)");
  divider();
  subheading("BigQuery Tables");
  bulletPoint("call_info — One row per API call (metadata, summary, tokens, cost, status)");
  bulletPoint("call_observations — One row per observation per call");
  bulletPoint("call_qa_pairs — One row per Q&A exchange per call");
  bulletPoint("barriers — One row per identified barrier per call");
  bulletPoint("call_qa_results — One row per Call QA assessment per call");
  bulletPoint("batch_processing — Batch processing tracker");
  bulletPoint("observations — Observation configuration");
  bulletPoint("context_parameters — Context parameter definitions");
  bulletPoint("call_qa_prompts — Call QA prompt configuration");
  bulletPoint("known_context_details — Known context per care flow");
  bulletPoint("settings — Key-value settings store");

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(
      `Guideway Care — API Reference — Page ${i} of ${totalPages}`,
      pageW / 2,
      pageH - 7,
      { align: "center" }
    );
  }

  doc.save("guideway-care-api-reference.pdf");
}

export default function Reference() {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8" ref={contentRef}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              API Reference
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Guideway Care Post-Call Analysis API</p>
          </div>
          <div className="flex gap-2 export-hide">
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-pdf"
              onClick={() => exportReferencePdf()}
            >
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-html"
              onClick={() => {
                if (contentRef.current) {
                  const btns = contentRef.current.querySelector('.export-hide') as HTMLElement;
                  if (btns) btns.style.display = 'none';
                  exportToHtml(contentRef.current);
                  if (btns) btns.style.display = '';
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export HTML
            </Button>
          </div>
        </div>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Base URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground mb-3">Replace with your Cloud Run URL after deployment:</p>
            <pre className="bg-[#172938] text-[#96d410] p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-base-url">
{`https://guideway-care-api-855188300685.us-central1.run.app`}
            </pre>
            <p className="text-muted-foreground text-sm mt-3">Cloud Run deployment: guideway-care-api (us-central1)</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Multi-Tenant Architecture
              <Badge className="bg-primary/10 text-primary border-primary/20 ml-2">Core</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">This API uses a <strong>Client & Pathway</strong> multi-tenant architecture. Each client/pathway has its own observations, context parameters, prompt settings, Call QA prompts, and barriers guidance. All configuration endpoints require a <code className="text-primary">clientPathwayId</code> parameter.</p>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2">
              <p className="text-foreground"><span className="text-primary font-semibold">clientPathwayId</span> — Required on all config endpoints (GET as query param, POST/PUT as body param). Identifies which tenant's config to read/write.</p>
              <p className="text-foreground"><span className="text-primary font-semibold">client + pathway</span> — On the analyze endpoints, pass <code className="text-primary">client</code> (e.g. "Encompass") and <code className="text-primary">pathway</code> (e.g. "Post-Discharge") to route to the correct tenant config.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Client & Pathway CRUD
              <Badge className="bg-primary/10 text-primary border-primary/20 ml-2">Management</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">Manage client/pathway definitions. These are the top-level organizational entities that scope all configuration data.</p>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">GET /api/client-pathways</h3>
              <p className="text-muted-foreground text-sm mb-2">Returns all client/pathway definitions.</p>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`[
  {
    "id": 1,
    "client": "Encompass",
    "pathway": "Post-Discharge",
    "description": "Post-discharge follow-up calls"
  }
]`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">POST /api/client-pathways</h3>
              <p className="text-muted-foreground text-sm mb-2">Create a new client/pathway.</p>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "client": "Encompass",
  "pathway": "Post-Discharge",
  "description": "Post-discharge follow-up calls"
}`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">PUT /api/client-pathways/:id</h3>
              <p className="text-muted-foreground text-sm">Update an existing client/pathway. Partial updates supported.</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">DELETE /api/client-pathways/:id</h3>
              <p className="text-muted-foreground text-sm">Permanently deletes a client/pathway by ID.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">The endpoints documented on this page (<code className="text-primary">POST /api/analyze</code> and management routes) do not require authentication.</p>
            <p className="text-muted-foreground mt-2">For the secured endpoint with API key authentication, see the <a href="/api-reference" className="text-primary underline">API Reference</a> page for <code className="text-primary">POST /gwc_observation_summarization</code>.</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              POST /api/analyze
              <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 ml-2">Legacy</Badge>
              <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20 ml-1">No Auth</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-foreground font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground">Accepts source text with contextual metadata (care flow, source type), processes it through Gemini AI, and returns structured clinical analysis with HTML-formatted output. No authentication required. The analysis prompt is dynamically built from the active observations configured in the Observations setup page.</p>
              <p className="text-muted-foreground text-sm mt-2">The secured endpoint <code className="text-primary">POST /gwc_observation_summarization</code> provides identical functionality with API key authentication. See the <a href="/api-reference" className="text-primary underline">API Reference</a> page.</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Request Body</h3>
              <p className="text-muted-foreground text-sm mb-2">Content-Type: application/json</p>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2 mb-4">
                <p className="text-foreground"><span className="text-primary font-semibold">client</span> <span className="text-muted-foreground">(string, optional)</span> — Client name for multi-tenant routing (e.g. "Encompass"). Used with <code className="text-primary">pathway</code> to resolve tenant config.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">pathway</span> <span className="text-muted-foreground">(string, optional)</span> — Pathway label within the client (e.g. "Post-Discharge"). Together with <code className="text-primary">client</code>, determines which observations, context params, and prompt settings to use.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">care_flow_id</span> <span className="text-muted-foreground">(string, optional)</span> — Identifier for the care flow or pathway.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">processed_datetime</span> <span className="text-muted-foreground">(string, optional)</span> — ISO 8601 datetime. Defaults to current time if omitted.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">source_type</span> <span className="text-muted-foreground">(string, optional)</span> — Type of source (e.g. phone_call, chat, note).</p>
                <p className="text-foreground"><span className="text-primary font-semibold">source_id</span> <span className="text-muted-foreground">(string, optional)</span> — Unique identifier for the source. Auto-generated if omitted.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">source_text</span> <span className="text-muted-foreground">(string, required)</span> — The full patient call transcript or interaction text.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">context</span> <span className="text-muted-foreground">(object, optional)</span> — Key-value pairs matching active context parameters (e.g. <code className="text-primary">{`{ "home_health_ordered": "true" }`}</code>). Injected into the prompt as known context.</p>
              </div>
              <h4 className="text-foreground font-semibold mb-2 text-sm">Example Request Body</h4>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-request-body">
{`{
  "client": "Encompass",
  "pathway": "Post-Discharge",
  "care_flow_id": "cf_abc123",
  "processed_datetime": "2026-03-06T10:30:00Z",
  "source_type": "phone_call",
  "source_id": "call_987654321",
  "source_text": "Care Guide: Hello, this is Maria from Guideway Care...",
  "context": {
    "home_health_ordered": "true",
    "dme_or_supplies_ordered": "false"
  }
}`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Response</h3>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-response-body">
{`{
  "status": "success",
  "data": {
    "care_flow_id": "cf_abc123",
    "processed_datetime": "2026-03-06T10:30:00Z",
    "source_type": "phone_call",
    "source_id": "call_987654321",
    "processedAt": "2026-03-06T12:00:00.000Z",
    "processingTimeMs": 1234,
    "prompt_version": 42,
    "prompt_version_date": "2026-03-06T10:00:00.000Z",
    "analysis": {
      "summary": "Brief overall summary of the call...",
      "observations": [
        {
          "name": "overall_feeling",
          "display_name": "Overall Feeling",
          "domain": "clinical",
          "value_type": "enum",
          "value": "Good",
          "detail": "Patient reports feeling well overall.",
          "evidence": "I'm doing much better, thank you.",
          "confidence": "high"
        }
      ],
      "transition_status": "<b>Overall Feeling:</b> <span style='...'>Good</span>...",
      "follow_up_areas": "<ul><li><b>Topic:</b> Detail...</li></ul>",
      "qa_pairs": [
        {
          "question": "How are you feeling today?",
          "answer": "I'm doing much better, thank you.",
          "asked_by": "care_guide",
          "answered_by": "patient",
          "observation_name": "overall_feeling",
          "observation_display_name": "Overall Feeling",
          "category": "General Health"
        },
        {
          "question": "Have you been taking your medications?",
          "answer": "Yes, I take them every morning.",
          "asked_by": "care_guide",
          "answered_by": "patient",
          "observation_name": "medication_adherence",
          "observation_display_name": "Medication Adherence",
          "category": "Medication"
        }
      ],
      "barriers": [
        {
          "barrier": "Transportation to follow-up appointment",
          "context": "Patient mentioned they do not have a ride to their follow-up appointment next week.",
          "category": "Transportation",
          "severity": "high",
          "observation_name": "follow_up_appointment",
          "observation_display_name": "Follow-Up Appointment",
          "evidence": "I don't have a way to get to my appointment next Tuesday."
        }
      ],
      "call_qa": [
        {
          "name": "empathy_score",
          "display_name": "Empathy Score",
          "value": "Good",
          "detail": "The care guide showed empathy throughout the call.",
          "evidence": "I'm sorry to hear you're having trouble with that."
        }
      ]
    },
    "tokenUsage": {
      "promptTokens": 2450,
      "completionTokens": 850,
      "totalTokens": 3300,
      "estimatedCost": 0.000585
    }
  }
}`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Analysis Fields</h3>
              <div className="space-y-3">
                <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                  <p className="text-primary font-mono text-sm">summary</p>
                  <p className="text-muted-foreground text-sm mt-1">Brief overview of the call based on the topics discussed. Content is driven by the configurable summary instruction (see Summary Prompt settings). Only covers what the patient actually responded to.</p>
                </div>
                <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                  <p className="text-primary font-mono text-sm">observations</p>
                  <p className="text-muted-foreground text-sm mt-1">Array of observation objects, one per active topic. Each contains: <code className="text-primary">name</code> (key), <code className="text-primary">display_name</code>, <code className="text-primary">domain</code>, <code className="text-primary">value_type</code>, <code className="text-primary">value</code> (extracted value or null), <code className="text-primary">detail</code> (explanation), <code className="text-primary">evidence</code> (direct transcript quote supporting the finding), and <code className="text-primary">confidence</code> (high/medium/low).</p>
                </div>
                <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                  <p className="text-primary font-mono text-sm">transition_status</p>
                  <p className="text-muted-foreground text-sm mt-1">HTML-formatted rich text covering all active observation topics. Uses inline styles for color-coded status badges. Discussed topics appear first; "Not Discussed" topics are grouped at the bottom.</p>
                </div>
                <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                  <p className="text-primary font-mono text-sm">follow_up_areas</p>
                  <p className="text-muted-foreground text-sm mt-1">HTML-formatted list of items needing follow-up. Only includes topics that had problems or gaps.</p>
                </div>
                <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                  <p className="text-primary font-mono text-sm">qa_pairs</p>
                  <p className="text-muted-foreground text-sm mt-1">Array of every question and answer exchange from the transcript, in chronological order. Each entry contains: <code className="text-primary">question</code> (the question asked), <code className="text-primary">answer</code> (the response given), <code className="text-primary">asked_by</code> (care_guide, patient, or caregiver), <code className="text-primary">answered_by</code> (patient, caregiver, or care_guide), <code className="text-primary">observation_name</code> (matched observation key or null), <code className="text-primary">observation_display_name</code> (matched observation label or null), and <code className="text-primary">category</code> (descriptive label like Medication, Pain, Greeting, etc.). Includes all exchanges — not just those matching configured observations.</p>
                </div>
                <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                  <p className="text-primary font-mono text-sm">barriers</p>
                  <p className="text-muted-foreground text-sm mt-1">Array of barriers to care identified from the conversation. Each entry contains: <code className="text-primary">barrier</code> (short description), <code className="text-primary">context</code> (full details about the barrier — circumstances, background, and impact on care), <code className="text-primary">category</code> (e.g. Transportation, Financial, Medication Access, Social Support, Health Literacy, Language, Housing, Caregiver Burden, Emotional/Mental Health, Physical Limitation, Insurance/Coverage), <code className="text-primary">severity</code> (high/medium/low based on impact on patient care), <code className="text-primary">observation_name</code> and <code className="text-primary">observation_display_name</code> (linked observation or null), and <code className="text-primary">evidence</code> (direct transcript quote). Returns empty array if no barriers identified.</p>
                </div>
                <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                  <p className="text-primary font-mono text-sm">call_qa</p>
                  <p className="text-muted-foreground text-sm mt-1">Array of call quality assessment results based on configurable Call QA prompts. Each entry contains: <code className="text-primary">name</code> (prompt key), <code className="text-primary">display_name</code> (human-readable label), <code className="text-primary">value</code> (assessment result — enum choice, boolean, or text), <code className="text-primary">detail</code> (brief explanation of the assessment), and <code className="text-primary">evidence</code> (supporting transcript quote or null). Prompts are configured in the Call QA management page. Returns empty array if no Call QA prompts are active.</p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Token Usage & Cost</h3>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2">
                <p className="text-foreground"><span className="text-primary font-semibold">promptTokens</span> — Input tokens sent to Gemini.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">completionTokens</span> — Output tokens returned by Gemini.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">totalTokens</span> — Sum of prompt + completion tokens.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">estimatedCost</span> — USD cost estimate (gemini-2.0-flash-001: $0.10/1M input, $0.40/1M output).</p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Inline Status Badge Colors</h3>
              <p className="text-muted-foreground text-sm mb-3">The <code className="text-primary">transition_status</code> field uses inline styles for color-coded status badges:</p>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-3">
                <div className="flex items-center gap-3">
                  <span style={{display:'inline-block',padding:'1px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:600,background:'#dcfce7',color:'#166534',border:'1px solid #bbf7d0'}}>Good</span>
                  <span className="text-muted-foreground text-xs">GREEN — positive outcomes</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{display:'inline-block',padding:'1px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:600,background:'#fef9c3',color:'#854d0e',border:'1px solid #fde68a'}}>Fair</span>
                  <span className="text-muted-foreground text-xs">YELLOW — caution / partial</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{display:'inline-block',padding:'1px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:600,background:'#fee2e2',color:'#991b1b',border:'1px solid #fecaca'}}>Poor</span>
                  <span className="text-muted-foreground text-xs">RED — negative / missed</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{display:'inline-block',padding:'1px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:600,background:'#dbeafe',color:'#1e40af',border:'1px solid #bfdbfe'}}>Has Questions</span>
                  <span className="text-muted-foreground text-xs">BLUE — informational</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{display:'inline-block',padding:'1px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:600,background:'#f3f4f6',color:'#6b7280',border:'1px solid #e5e7eb'}}>Not Discussed</span>
                  <span className="text-muted-foreground text-xs">GRAY — not discussed / unknown</span>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Example cURL</h3>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-curl-example">
{`curl -X POST https://guideway-care-api-855188300685.us-central1.run.app/api/analyze \\
  -H "Content-Type: application/json" \\
  -d '{
    "care_flow_id": "cf_abc123",
    "source_type": "phone_call",
    "source_id": "call_987654321",
    "source_text": "Care Guide: Hello, this is Maria from Guideway Care...",
    "context": {
      "home_health_ordered": "true",
      "dme_or_supplies_ordered": "false"
    }
  }'`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Error Response</h3>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "status": "error",
  "message": "Description of what went wrong"
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Call History
              <Badge className="bg-primary/10 text-primary border-primary/20 ml-2">Analytics</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">Query processed calls and their extracted observations from BigQuery.</p>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">GET /api/calls</h3>
              <p className="text-muted-foreground text-sm mb-2">Returns recent processed calls ordered by processed_at descending.</p>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2 mb-3">
                <p className="text-foreground"><span className="text-primary font-semibold">limit</span> <span className="text-muted-foreground">(query param, optional)</span> — Max rows to return (default 100, max 500).</p>
              </div>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`[
  {
    "call_id": "call_987654321",
    "care_flow_id": "cf_abc123",
    "processed_datetime": "2026-03-06T10:30:00Z",
    "source_type": "phone_call",
    "processed_at": "2026-03-06T12:00:00.000Z",
    "processing_time_ms": 1234,
    "prompt_version": 42,
    "total_tokens": 3300,
    "estimated_cost": 0.000585,
    "status": "success",
    "summary": "Brief summary..."
  }
]`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">GET /api/calls/:callId</h3>
              <p className="text-muted-foreground text-sm mb-2">Returns full detail for a single call including all extracted observations.</p>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "callInfo": {
    "call_id": "call_987654321",
    "care_flow_id": "cf_abc123",
    "summary": "...",
    "follow_up_areas": "<ul>...</ul>",
    "transition_status": "<b>...</b>",
    "context_values": { "home_health_ordered": "true" },
    "prompt_tokens": 2450,
    "completion_tokens": 850,
    "total_tokens": 3300,
    "estimated_cost": 0.000585,
    "status": "success"
  },
  "observations": [
    {
      "call_id": "call_987654321",
      "observation_name": "overall_feeling",
      "observation_display_name": "Overall Feeling",
      "observation_domain": "clinical",
      "observation_value_type": "enum",
      "observation_value": "Good",
      "observation_detail": "Patient reports feeling well.",
      "observation_evidence": "I'm doing much better.",
      "observation_confidence": "high"
    }
  ],
  "qaPairs": [
    {
      "call_id": "call_987654321",
      "sequence_number": 1,
      "question": "How are you feeling today?",
      "answer": "I'm doing much better, thank you.",
      "asked_by": "care_guide",
      "answered_by": "patient",
      "observation_name": "overall_feeling",
      "observation_display_name": "Overall Feeling",
      "category": "General Health"
    }
  ],
  "barriers": [
    {
      "call_id": "call_987654321",
      "barrier": "Transportation to follow-up",
      "context": "Patient has no ride to appointment.",
      "category": "Transportation",
      "severity": "high",
      "observation_name": "follow_up_appointment",
      "observation_display_name": "Follow-Up Appointment",
      "evidence": "I don't have a way to get there."
    }
  ],
  "callQA": [
    {
      "call_id": "call_987654321",
      "name": "empathy_score",
      "display_name": "Empathy Score",
      "value": "Good",
      "detail": "Care guide showed empathy.",
      "evidence": "I'm sorry to hear that."
    }
  ]
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Call Volume Analytics
              <Badge className="bg-primary/10 text-primary border-primary/20 ml-2">Analytics</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">Aggregate call volume statistics for the Call Volume dashboard. Data is grouped by Eastern timezone (<code className="text-primary">America/New_York</code>).</p>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">GET /api/calls/stats/daily</h3>
              <p className="text-muted-foreground text-sm mb-2">Returns daily call counts grouped by client, pathway, and source_type. The frontend aggregates this flat data into KPI cards, charts, and breakdowns.</p>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2 mb-3">
                <p className="text-foreground"><span className="text-primary font-semibold">days</span> <span className="text-muted-foreground">(query param, optional)</span> — Number of days to look back. 0 = today only, 6 = last 7 days (default 30).</p>
              </div>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`[
  {
    "date": "2026-04-01",
    "client": "Encompass",
    "pathway": "Post-Discharge",
    "source_type": "phone_call",
    "call_count": 12,
    "success_count": 11,
    "error_count": 1,
    "avg_processing_ms": 1250,
    "total_tokens": 39600,
    "total_cost": 0.0070
  }
]`}
              </pre>
              <p className="text-muted-foreground text-sm mt-2">Each row represents one (date, client, pathway, source_type) group. The frontend rolls up these rows into KPI totals, stacked bar charts by client/pathway, source type donuts, and pathway breakdown cards.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              GET /api/health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-3">Returns service status. Use this to verify the API is running.</p>
            <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-health-response">
{`{
  "status": "ok",
  "timestamp": "2026-03-06T12:00:00.000Z",
  "services": {
    "gemini": true,
    "bigquery": true,
    "projectId": true
  }
}`}
            </pre>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              GET /api/prompt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-3">Returns the dynamically generated prompt template, version hash, and version date.</p>
            <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "prompt": "You are an expert healthcare call analyst...",
  "promptVersion": 42,
  "promptVersionDate": "2026-03-06T10:00:00.000Z"
}`}
            </pre>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Observations CRUD
              <Badge className="bg-[#96d410]/10 text-[#4d6d08] border-[#96d410]/30 ml-2">Setup</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">Manage observation topics that drive the Gemini analysis prompt. Observations are stored in BigQuery (<code className="text-primary">call_information.observations</code>). All endpoints require <code className="text-primary">clientPathwayId</code> (query param for GET/DELETE, body param for POST/PUT).</p>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">GET /api/observations</h3>
              <p className="text-muted-foreground text-sm mb-2">Returns all observations ordered by display_order.</p>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`[
  {
    "id": 1,
    "name": "overall_feeling",
    "displayName": "Overall Feeling",
    "domain": "clinical",
    "displayOrder": 0,
    "valueType": "enum",
    "value": [
      { "label": "Good", "color": "GREEN" },
      { "label": "Fair", "color": "YELLOW" },
      { "label": "Poor", "color": "RED" },
      { "label": "Not Discussed", "color": "GRAY" }
    ],
    "isActive": true,
    "promptGuidance": ""
  }
]`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">POST /api/observations</h3>
              <p className="text-muted-foreground text-sm mb-2">Create a new observation topic.</p>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "name": "pain_level",
  "displayName": "Pain Level",
  "domain": "clinical",
  "valueType": "enum",
  "value": [
    { "label": "None", "color": "GREEN" },
    { "label": "Mild", "color": "YELLOW" },
    { "label": "Severe", "color": "RED" }
  ],
  "isActive": true,
  "promptGuidance": "Note the location and severity of pain."
}`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">PUT /api/observations/:id</h3>
              <p className="text-muted-foreground text-sm mb-2">Update an existing observation. Only include fields you want to change.</p>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "displayName": "Updated Display Name",
  "promptGuidance": "Updated guidance for Gemini."
}`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">DELETE /api/observations/:id</h3>
              <p className="text-muted-foreground text-sm">Permanently deletes an observation by ID.</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">POST /api/observations/ai-suggest</h3>
              <p className="text-muted-foreground text-sm mb-2">Chat with the AI assistant to get suggestions for improving or adding observation topics. Maintains conversation history for multi-turn interactions.</p>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "message": "Can you suggest an observation for tracking medication side effects?",
  "history": [
    { "role": "user", "text": "Previous message..." },
    { "role": "assistant", "text": "Previous response..." }
  ]
}`}
              </pre>
              <p className="text-muted-foreground text-sm mt-2">Returns <code className="text-primary">{`{ "response": "AI suggestion text..." }`}</code>. The assistant is aware of currently configured observations and can suggest new ones, modifications, or prompt guidance improvements.</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">PUT /api/observations/reorder</h3>
              <p className="text-muted-foreground text-sm mb-2">Reorder observations by providing an array of IDs in the desired order.</p>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "orderedIds": [3, 1, 5, 2, 4]
}`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Observation Fields</h3>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2">
                <p className="text-foreground"><span className="text-primary font-semibold">id</span> <span className="text-muted-foreground">(INT64)</span> — Auto-generated unique identifier.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">name</span> <span className="text-muted-foreground">(string)</span> — Machine-readable key (e.g. "overall_feeling").</p>
                <p className="text-foreground"><span className="text-primary font-semibold">displayName</span> <span className="text-muted-foreground">(string)</span> — Human-readable label shown in output.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">domain</span> <span className="text-muted-foreground">(string)</span> — Category grouping: clinical, medication, appointment, equipment, discharge, experience, general.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">displayOrder</span> <span className="text-muted-foreground">(integer)</span> — Sort order in output.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">valueType</span> <span className="text-muted-foreground">(string)</span> — One of: enum, boolean, text, number.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">value</span> <span className="text-muted-foreground">(array)</span> — For enum types, array of <code className="text-primary">{`{ label, color }`}</code> objects. Colors: GREEN, YELLOW, RED, BLUE, GRAY.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">isActive</span> <span className="text-muted-foreground">(boolean)</span> — Whether this observation is included in the analysis prompt.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">promptGuidance</span> <span className="text-muted-foreground">(string, optional)</span> — Custom instruction for Gemini on how to evaluate this observation.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Context Parameters CRUD
              <Badge className="bg-[#96d410]/10 text-[#4d6d08] border-[#96d410]/30 ml-2">Setup</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">Manage context parameters that API callers can pass alongside transcripts to give Gemini known context. Stored in BigQuery (<code className="text-primary">call_information.context_parameters</code>). All endpoints require <code className="text-primary">clientPathwayId</code> (query param for GET/DELETE, body param for POST/PUT).</p>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">GET /api/context-parameters</h3>
              <p className="text-muted-foreground text-sm mb-2">Returns all context parameters ordered by display_order.</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">POST /api/context-parameters</h3>
              <p className="text-muted-foreground text-sm mb-2">Create a new context parameter.</p>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "name": "home_health_ordered",
  "displayName": "Home health ordered",
  "description": "",
  "dataType": "enum",
  "enumValues": ["true", "false"],
  "isActive": true,
  "displayOrder": 0
}`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">PUT /api/context-parameters/:id</h3>
              <p className="text-muted-foreground text-sm">Update an existing context parameter. Partial updates supported.</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">PUT /api/context-parameters/reorder</h3>
              <p className="text-muted-foreground text-sm mb-2">Reorder context parameters by providing an array of IDs in the desired order.</p>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "orderedIds": [2, 1, 3]
}`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">DELETE /api/context-parameters/:id</h3>
              <p className="text-muted-foreground text-sm">Permanently deletes a context parameter by ID.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Prompt Settings
              <Badge className="bg-[#96d410]/10 text-[#4d6d08] border-[#96d410]/30 ml-2">Setup</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">Configure prompt instructions stored in BigQuery (<code className="text-primary">call_information.settings</code>). All endpoints are scoped by <code className="text-primary">clientPathwayId</code> (query param).</p>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Summary Instruction</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-foreground text-sm font-medium">GET /api/settings/summary-instruction</p>
                  <p className="text-muted-foreground text-sm">Returns the current summary instruction. Falls back to default if none is configured.</p>
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">PUT /api/settings/summary-instruction</p>
                  <p className="text-muted-foreground text-sm">Set or update the summary instruction. Use <code className="text-primary">{`{{SUMMARY_TOPICS}}`}</code> placeholder for dynamic topic injection.</p>
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">DELETE /api/settings/summary-instruction</p>
                  <p className="text-muted-foreground text-sm">Revert to the default summary instruction.</p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Observations Guidance</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-foreground text-sm font-medium">GET /api/settings/observations-guidance</p>
                  <p className="text-muted-foreground text-sm">Returns the global guidance instruction applied to all observations.</p>
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">PUT /api/settings/observations-guidance</p>
                  <p className="text-muted-foreground text-sm">Set or update the global observations guidance.</p>
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">DELETE /api/settings/observations-guidance</p>
                  <p className="text-muted-foreground text-sm">Remove custom observations guidance.</p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Barriers Guidance</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-foreground text-sm font-medium">GET /api/settings/barriers-guidance</p>
                  <p className="text-muted-foreground text-sm">Returns the barriers-to-care identification guidance for the current client/pathway.</p>
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">PUT /api/settings/barriers-guidance</p>
                  <p className="text-muted-foreground text-sm">Set or update custom barriers guidance for this client/pathway.</p>
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">DELETE /api/settings/barriers-guidance</p>
                  <p className="text-muted-foreground text-sm">Remove custom barriers guidance (reverts to default).</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Call QA Prompts CRUD
              <Badge className="bg-[#96d410]/10 text-[#4d6d08] border-[#96d410]/30 ml-2">Setup</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">Manage Call QA evaluation prompts that assess overall call quality. Each prompt defines a question that Gemini answers about the call as a whole. Stored in BigQuery (<code className="text-primary">call_information.call_qa_prompts</code>). Results are stored in <code className="text-primary">call_information.call_qa_results</code>. All endpoints require <code className="text-primary">clientPathwayId</code> (query param for GET/DELETE, body param for POST/PUT).</p>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">GET /api/call-qa-prompts</h3>
              <p className="text-muted-foreground text-sm mb-2">Returns all Call QA prompts ordered by display_order.</p>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`[
  {
    "id": 1,
    "name": "empathy_score",
    "displayName": "Empathy Score",
    "promptText": "Rate the care guide's empathy during the call.",
    "responseType": "enum",
    "responseOptions": ["Excellent", "Good", "Fair", "Poor"],
    "isActive": true,
    "displayOrder": 0
  }
]`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">POST /api/call-qa-prompts</h3>
              <p className="text-muted-foreground text-sm mb-2">Create a new Call QA prompt.</p>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "name": "empathy_score",
  "displayName": "Empathy Score",
  "promptText": "Rate the care guide's empathy during the call.",
  "responseType": "enum",
  "responseOptions": ["Excellent", "Good", "Fair", "Poor"],
  "isActive": true
}`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">PUT /api/call-qa-prompts/:id</h3>
              <p className="text-muted-foreground text-sm">Update an existing Call QA prompt. Partial updates supported.</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">DELETE /api/call-qa-prompts/:id</h3>
              <p className="text-muted-foreground text-sm">Permanently deletes a Call QA prompt by ID.</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Call QA Prompt Fields</h3>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2">
                <p className="text-foreground"><span className="text-primary font-semibold">id</span> <span className="text-muted-foreground">(INT64)</span> — Auto-generated unique identifier.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">name</span> <span className="text-muted-foreground">(string)</span> — Machine-readable key (e.g. "empathy_score").</p>
                <p className="text-foreground"><span className="text-primary font-semibold">displayName</span> <span className="text-muted-foreground">(string)</span> — Human-readable label.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">promptText</span> <span className="text-muted-foreground">(string)</span> — The instruction sent to Gemini for evaluation.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">responseType</span> <span className="text-muted-foreground">(string)</span> — One of: enum, boolean, text.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">responseOptions</span> <span className="text-muted-foreground">(array)</span> — For enum types, array of allowed response values.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">isActive</span> <span className="text-muted-foreground">(boolean)</span> — Whether this prompt is included in the analysis.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">displayOrder</span> <span className="text-muted-foreground">(integer)</span> — Sort order in output.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              PDF Export
              <Badge className="bg-primary/10 text-primary border-primary/20 ml-2">Feature</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Individual call details can be exported as PDF reports from the Call History page. Open any call detail panel and click the <strong>"Export PDF"</strong> button.</p>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2">
              <p className="text-foreground font-semibold">PDF Report Contents:</p>
              <ul className="text-muted-foreground list-disc list-inside space-y-1">
                <li>Guideway Care branded header with generation timestamp</li>
                <li>Call metadata (ID, status, processing time, context values, prompt version, token usage)</li>
                <li>Summary</li>
                <li>Observations with values, details, evidence, and confidence levels</li>
                <li>Transition Status</li>
                <li>Follow-up Areas</li>
                <li>Barriers to Care with severity and category</li>
                <li>Call QA assessments</li>
                <li>Q&A pair exchanges</li>
                <li>Page numbers and footer</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Batch Processing
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 ml-2">Bulk</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">Search historical Bland AI calls, load them into a batch, and process them through the same Gemini extraction pipeline used by the live API. Results are written to <code className="text-primary">call_info</code>, <code className="text-primary">call_observations</code>, <code className="text-primary">call_qa_pairs</code>, and <code className="text-primary">barriers</code>.</p>

            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
              <p className="text-primary font-semibold text-sm mb-2">How Batch Processing Works</p>
              <ol className="text-muted-foreground text-sm space-y-2 list-decimal list-inside">
                <li><strong>Search</strong> — Query Bland.calls in BigQuery using filters (date range, answered_by, duration, tags, processing status). The "Not Yet Processed" filter cross-references <code className="text-primary">call_info.source_id</code> to exclude calls already processed.</li>
                <li><strong>Select</strong> — Choose individual calls or select all from the results. Each call shows its ID, date, duration, answered_by, transcript preview, and tags.</li>
                <li><strong>Load to Batch</strong> — Selected calls are inserted into <code className="text-primary">call_information.batch_processing</code> via DML INSERT (not streaming API). Each row includes bland_call_id, transcript, care_flow_id, and status=pending.</li>
                <li><strong>Process</strong> — Click "Process Batch" to run N pending items through Gemini. Each item: builds the prompt from current observation config → calls Gemini → writes call_info + call_observations + call_qa_pairs + barriers → updates batch status to completed or failed.</li>
                <li><strong>Review</strong> — Processed calls appear in Call History. Click any call to see the full detail panel including summary, observations, Q&A pairs, follow-up areas, and transition status.</li>
              </ol>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">GET /api/batch/bland-calls</h3>
              <p className="text-muted-foreground text-sm mb-2">Search historical Bland calls with flexible filters.</p>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2 mb-3">
                <p className="text-foreground"><span className="text-primary font-semibold">startDate</span> <span className="text-muted-foreground">(query, optional)</span> — ISO 8601 date. Filter calls after this date.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">endDate</span> <span className="text-muted-foreground">(query, optional)</span> — ISO 8601 date. Filter calls before this date.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">answeredBy</span> <span className="text-muted-foreground">(query, optional)</span> — "human", "voicemail", or "no-answer".</p>
                <p className="text-foreground"><span className="text-primary font-semibold">minDuration</span> <span className="text-muted-foreground">(query, optional)</span> — Minimum call duration in seconds.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">maxDuration</span> <span className="text-muted-foreground">(query, optional)</span> — Maximum call duration in seconds.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">callIds</span> <span className="text-muted-foreground">(query, optional)</span> — Comma-separated list of specific call IDs.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">requiredTags</span> <span className="text-muted-foreground">(query, optional)</span> — Comma-separated tags that must be present on the call.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">excludeTags</span> <span className="text-muted-foreground">(query, optional)</span> — Comma-separated tags that must NOT be present on the call.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">processedFilter</span> <span className="text-muted-foreground">(query, optional)</span> — "unprocessed" (default), "processed", or "all". Cross-references call_info.source_id.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">limit</span> <span className="text-muted-foreground">(query, optional)</span> — Max results to return (default 50).</p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">GET /api/batch/tags</h3>
              <p className="text-muted-foreground text-sm mb-2">Returns distinct tag values from <code className="text-primary">Bland.tags</code> for use in the tag filter UI.</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">POST /api/batch/load</h3>
              <p className="text-muted-foreground text-sm mb-2">Load selected calls into a new batch for processing.</p>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "calls": [
    {
      "call_id": "5ff863af-c06a-...",
      "transcript": "Care Guide: Hello...",
      "care_flow_id": "cf_abc123"
    }
  ]
}`}
              </pre>
              <p className="text-muted-foreground text-sm mt-2">Creates rows in <code className="text-primary">call_information.batch_processing</code> with status "pending" and a shared batch_id (timestamp-based).</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">POST /api/batch/process</h3>
              <p className="text-muted-foreground text-sm mb-2">Process pending batch items through the Gemini extraction pipeline.</p>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2 mb-3">
                <p className="text-foreground"><span className="text-primary font-semibold">limit</span> <span className="text-muted-foreground">(body, optional)</span> — Max items to process in this run (default 5).</p>
                <p className="text-foreground"><span className="text-primary font-semibold">batchId</span> <span className="text-muted-foreground">(body, optional)</span> — Target a specific batch. Defaults to newest batch.</p>
              </div>
              <p className="text-muted-foreground text-sm">For each pending item: builds prompt from current observation config → calls Gemini → writes to call_info, call_observations, call_qa_pairs, and barriers → updates batch item status to completed or failed.</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">GET /api/batch/items</h3>
              <p className="text-muted-foreground text-sm mb-2">Returns all items in the batch processing table with their current status.</p>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2 mb-3">
                <p className="text-foreground"><span className="text-primary font-semibold">limit</span> <span className="text-muted-foreground">(query, optional)</span> — Max rows to return (default 100).</p>
                <p className="text-foreground"><span className="text-primary font-semibold">status</span> <span className="text-muted-foreground">(query, optional)</span> — Filter by status: "pending", "processing", "completed", or "failed".</p>
              </div>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`[
  {
    "bland_call_id": "5ff863af-c06a-...",
    "care_flow_id": "cf_abc123",
    "status": "completed",
    "batch_id": "2026-04-01T10:00:00.000Z",
    "processed_call_id": "5ff863af-c06a-...",
    "error_message": null,
    "created_at": "2026-04-01T10:00:00.000Z"
  }
]`}
              </pre>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">GET /api/batch/summary</h3>
              <p className="text-muted-foreground text-sm mb-2">Returns batch status counts: total, pending, processing, completed, failed.</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">POST /api/batch/recreate</h3>
              <p className="text-muted-foreground text-sm">Creates a new batch from all non-completed items in the current batch (failed + pending). Useful when you want a clean batch after fixing issues.</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">POST /api/batch/reset-failed</h3>
              <p className="text-muted-foreground text-sm">Resets all failed batch items back to "pending" status so they can be reprocessed.</p>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">BigQuery Tables Used</h3>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2">
                <p className="text-foreground"><span className="text-primary font-semibold">Bland.calls</span> — Source call data (call_id, created_at, call_length, answered_by, concatenated_transcript)</p>
                <p className="text-foreground"><span className="text-primary font-semibold">Bland.variables</span> — Call variables including awell_care_flow_id (joined via call_id)</p>
                <p className="text-foreground"><span className="text-primary font-semibold">Bland.tags</span> — Call tags (assessment_completed, patient_deceased, etc.)</p>
                <p className="text-foreground"><span className="text-primary font-semibold">call_information.batch_processing</span> — Batch tracking table (bland_call_id, transcript, care_flow_id, status, batch_id, error_message)</p>
                <p className="text-foreground"><span className="text-primary font-semibold">call_information.call_info</span> — Output: one row per processed call (cross-referenced by source_id for processed filter)</p>
                <p className="text-foreground"><span className="text-primary font-semibold">call_information.call_observations</span> — Output: one row per observation per call</p>
                <p className="text-foreground"><span className="text-primary font-semibold">call_information.call_qa_pairs</span> — Output: one row per Q&A exchange per call</p>
                <p className="text-foreground"><span className="text-primary font-semibold">call_information.barriers</span> — Output: one row per identified barrier per call (barrier, context, category, severity, evidence, observation linkage)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              Awell Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">To connect this API from Awell, configure a webhook or custom action with the following:</p>
            <div className="space-y-3">
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <p className="text-primary font-mono text-sm mb-1">URL</p>
                <p className="text-foreground text-sm">https://guideway-care-api-855188300685.us-central1.run.app/api/analyze</p>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <p className="text-primary font-mono text-sm mb-1">Method</p>
                <p className="text-foreground text-sm">POST</p>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <p className="text-primary font-mono text-sm mb-1">Headers</p>
                <p className="text-foreground text-sm">Content-Type: application/json</p>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <p className="text-primary font-mono text-sm mb-1">Body</p>
                <pre className="text-foreground text-sm mt-1">
{`{
  "care_flow_id": "{{awell.care_flow_id}}",
  "processed_datetime": "{{awell.processed_datetime}}",
  "source_type": "{{awell.source_type}}",
  "source_id": "{{awell.source_id}}",
  "source_text": "{{awell.source_text}}",
  "context": {
    "home_health_ordered": "{{awell.home_health_ordered}}",
    "dme_or_supplies_ordered": "{{awell.dme_or_supplies_ordered}}"
  }
}`}
                </pre>
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg mt-4">
              <p className="text-primary font-semibold text-sm mb-2">Mapping Response Fields in Awell</p>
              <div className="text-muted-foreground text-sm space-y-1">
                <p><code className="text-primary">data.analysis.summary</code> → Call Summary</p>
                <p><code className="text-primary">data.analysis.observations</code> → Array of Extracted Observations</p>
                <p><code className="text-primary">data.analysis.transition_status</code> → Transition Status Details (HTML)</p>
                <p><code className="text-primary">data.analysis.follow_up_areas</code> → Follow-Up Items (HTML)</p>
                <p><code className="text-primary">data.analysis.qa_pairs</code> → Array of Q&A exchanges (question, answer, category, observation linkage)</p>
                <p><code className="text-primary">data.analysis.barriers</code> → Array of barriers to care (barrier, context, category, severity, evidence, observation linkage)</p>
                <p><code className="text-primary">data.analysis.call_qa</code> → Array of Call QA assessments (name, display_name, value, detail, evidence)</p>
                <p><code className="text-primary">data.tokenUsage</code> → Token usage and cost metrics</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              GCP Deployment Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-foreground font-semibold mb-2">Prerequisites</h3>
              <ol className="text-muted-foreground text-sm space-y-2 list-decimal list-inside">
                <li>Enable APIs: Cloud Run, Cloud Build, Container Registry, Secret Manager, Vertex AI, BigQuery</li>
                <li>Store <code className="text-primary">GCP_SERVICE_ACCOUNT_KEY</code> in Secret Manager (full JSON of service account key)</li>
                <li>Grant Cloud Build service account roles: Cloud Run Admin, Service Account User, Secret Manager Secret Accessor</li>
                <li>Connect GitHub repo to Cloud Build trigger on <code className="text-primary">main</code> branch</li>
              </ol>
            </div>
            <Separator />
            <div>
              <h3 className="text-foreground font-semibold mb-2">Service Account Roles Required</h3>
              <ul className="text-muted-foreground text-sm space-y-1 list-disc list-inside">
                <li>Vertex AI User (for Gemini API)</li>
                <li>BigQuery Data Editor (for observations, settings, and analytics logging)</li>
                <li>BigQuery Job User (for running queries)</li>
              </ul>
            </div>
            <Separator />
            <div>
              <h3 className="text-foreground font-semibold mb-2">Environment Variables</h3>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg text-sm">
                <p className="text-foreground"><span className="text-primary font-semibold">GCP_PROJECT_ID</span> — Your Google Cloud project ID</p>
                <p className="text-foreground mt-1"><span className="text-primary font-semibold">GCP_SERVICE_ACCOUNT_KEY</span> — Full JSON service account key (via Secret Manager)</p>
                <p className="text-foreground mt-1"><span className="text-primary font-semibold">GWC_OBSERVATION_SUMMARIZATION_API_KEY</span> — GCP API key for authenticating POST /api/analyze (via Secret Manager)</p>
                <p className="text-foreground mt-1"><span className="text-primary font-semibold">PORT</span> — Set automatically by Cloud Run (default 8080)</p>
              </div>
            </div>
            <Separator />
            <div>
              <h3 className="text-foreground font-semibold mb-2">BigQuery Resources</h3>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg text-sm">
                <p className="text-foreground"><span className="text-primary font-semibold">Dataset:</span> call_information</p>
                <p className="text-foreground mt-1"><span className="text-primary font-semibold">Tables:</span></p>
                <ul className="text-muted-foreground text-sm list-disc list-inside ml-2 mt-1 space-y-1">
                  <li><code className="text-primary">call_info</code> — One row per API call (metadata, summary, tokens, cost, status)</li>
                  <li><code className="text-primary">call_observations</code> — One row per observation per call (name, value, detail, evidence, confidence)</li>
                  <li><code className="text-primary">call_qa_pairs</code> — One row per Q&A exchange per call (sequence_number, question, answer, asked_by, answered_by, observation_name, category)</li>
                  <li><code className="text-primary">barriers</code> — One row per identified barrier per call (barrier, context, category, severity, observation_name, observation_display_name, evidence)</li>
                  <li><code className="text-primary">call_qa_results</code> — One row per Call QA assessment per call (call_id, name, display_name, value, detail, evidence)</li>
                  <li><code className="text-primary">batch_processing</code> — Batch processing tracker (bland_call_id, transcript, care_flow_id, status, batch_id, error_message, result_call_id, context_values)</li>
                  <li><code className="text-primary">observations</code> — Observation configuration (id, name, display_name, domain, value_type, value, is_active, prompt_guidance)</li>
                  <li><code className="text-primary">context_parameters</code> — Context parameter definitions (id, name, display_name, data_type, enum_values, is_active)</li>
                  <li><code className="text-primary">call_qa_prompts</code> — Call QA prompt configuration (id, name, display_name, prompt_text, response_type, response_options, is_active, display_order)</li>
                  <li><code className="text-primary">known_context_details</code> — Known context per care flow (care_flow_id, parameter_name, display_name, value, value_type, active_ind, created_at, updated_at)</li>
                  <li><code className="text-primary">settings</code> — Key-value settings store (summary_instruction, observations_prompt_guidance, barriers_prompt_guidance)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center py-6">
          <p className="text-muted-foreground text-sm">Guideway Care Post-Call Analysis API</p>
        </div>
      </div>
    </div>
  );
}
