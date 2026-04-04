import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { BookOpen, Code2, Webhook, Server, Key, Activity, Database, Settings, Phone, Download, Layers, MessageSquare } from "lucide-react";
import { useRef } from "react";

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
          <Button
            variant="outline"
            size="sm"
            data-testid="button-export-html"
            className="export-hide"
            onClick={() => {
              if (contentRef.current) {
                const btn = contentRef.current.querySelector('.export-hide') as HTMLElement;
                if (btn) btn.style.display = 'none';
                exportToHtml(contentRef.current);
                if (btn) btn.style.display = '';
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export HTML
          </Button>
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
  ]
}`}
              </pre>
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
            <p className="text-muted-foreground">Manage observation topics that drive the Gemini analysis prompt. Observations are stored in BigQuery (<code className="text-primary">call_information.observations</code>).</p>

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
            <p className="text-muted-foreground">Manage context parameters that API callers can pass alongside transcripts to give Gemini known context. Stored in BigQuery (<code className="text-primary">call_information.context_parameters</code>).</p>

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
            <p className="text-muted-foreground">Configure prompt instructions stored in BigQuery (<code className="text-primary">call_information.settings</code>).</p>

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
            <p className="text-muted-foreground">Search historical Bland AI calls, load them into a batch, and process them through the same Gemini extraction pipeline used by the live API. Results are written to <code className="text-primary">call_info</code>, <code className="text-primary">call_observations</code>, and <code className="text-primary">call_qa_pairs</code>.</p>

            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
              <p className="text-primary font-semibold text-sm mb-2">How Batch Processing Works</p>
              <ol className="text-muted-foreground text-sm space-y-2 list-decimal list-inside">
                <li><strong>Search</strong> — Query Bland.calls in BigQuery using filters (date range, answered_by, duration, tags, processing status). The "Not Yet Processed" filter cross-references <code className="text-primary">call_info.source_id</code> to exclude calls already processed.</li>
                <li><strong>Select</strong> — Choose individual calls or select all from the results. Each call shows its ID, date, duration, answered_by, transcript preview, and tags.</li>
                <li><strong>Load to Batch</strong> — Selected calls are inserted into <code className="text-primary">call_information.batch_processing</code> via DML INSERT (not streaming API). Each row includes bland_call_id, transcript, care_flow_id, and status=pending.</li>
                <li><strong>Process</strong> — Click "Process Batch" to run N pending items through Gemini. Each item: builds the prompt from current observation config → calls Gemini → writes call_info + call_observations + call_qa_pairs → updates batch status to completed or failed.</li>
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
              <p className="text-muted-foreground text-sm">For each pending item: builds prompt from current observation config → calls Gemini → writes to call_info, call_observations, and call_qa_pairs → updates batch item status to completed or failed.</p>
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
                  <li><code className="text-primary">batch_processing</code> — Batch processing tracker (bland_call_id, transcript, care_flow_id, status, batch_id, error_message, processed_call_id)</li>
                  <li><code className="text-primary">observations</code> — Observation configuration (id, name, display_name, domain, value_type, value, is_active, prompt_guidance)</li>
                  <li><code className="text-primary">context_parameters</code> — Context parameter definitions (id, name, display_name, data_type, enum_values, is_active)</li>
                  <li><code className="text-primary">settings</code> — Key-value settings store (summary_instruction, observations_guidance)</li>
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
