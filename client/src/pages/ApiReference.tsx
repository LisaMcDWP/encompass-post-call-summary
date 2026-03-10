import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { BookOpen, Code2, Server, Key, Activity, Shield, Download, Webhook } from "lucide-react";
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
<title>GWC Observation Summarization — API Reference</title>
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
  a.download = "gwc-observation-summarization-api-reference.html";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ApiReference() {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8" ref={contentRef}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              GWC Observation Summarization
            </h1>
            <p className="text-sm text-muted-foreground mt-1">API Reference — POST /gwc_observation_summarization</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            data-testid="button-export-api-html"
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
              Endpoint
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-green-600 text-white border-green-700">POST</Badge>
              <code className="text-primary text-lg font-semibold">/gwc_observation_summarization</code>
            </div>
            <p className="text-muted-foreground text-sm">Full URL (replace with your Cloud Run deployment):</p>
            <pre className="bg-[#172938] text-[#96d410] p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-api-url">
{`https://guideway-care-api-XXXXXXXX-uc.a.run.app/gwc_observation_summarization`}
            </pre>
            <p className="text-muted-foreground text-xs">Find your URL: GCP Console → Cloud Run → guideway-care-api → URL at the top of the page.</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Authentication
              <Badge className="bg-red-500/10 text-red-600 border-red-500/20 ml-2">Required</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">All requests must include a valid API key in the request header when the <code className="text-primary">GWC_OBSERVATION_SUMMARIZATION_API_KEY</code> environment variable is configured on the server. If the env var is not set, the endpoint falls back to open access.</p>
            <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-3">
              <div>
                <p className="text-primary font-semibold mb-1">Header</p>
                <pre className="bg-[#172938] text-gray-300 p-3 rounded-md text-sm">X-API-Key: your-api-key</pre>
              </div>
              <div>
                <p className="text-primary font-semibold mb-1">Key Source</p>
                <p className="text-foreground text-sm">GCP Console → APIs & Services → Credentials → API key</p>
              </div>
              <div>
                <p className="text-primary font-semibold mb-1">Server Configuration</p>
                <p className="text-foreground text-sm">Stored in GCP Secret Manager and passed to Cloud Run as the <code className="text-primary">GWC_OBSERVATION_SUMMARIZATION_API_KEY</code> environment variable.</p>
              </div>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-lg text-sm">
              <p className="text-foreground font-semibold mb-1">Missing or Invalid Key → 401</p>
              <pre className="text-gray-400 mt-1">{`{ "status": "error", "message": "Invalid or missing API key" }`}</pre>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-muted-foreground text-sm mb-3">Content-Type: <code className="text-primary">application/json</code></p>
              <h3 className="text-foreground font-semibold mb-2">Fields</h3>
              <div className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm space-y-2">
                <p className="text-foreground"><span className="text-primary font-semibold">source_text</span> <Badge variant="outline" className="text-[10px] ml-1 py-0">required</Badge> — The full patient call transcript or interaction text.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">care_flow_id</span> <span className="text-muted-foreground text-xs">(string, optional)</span> — Identifier for the care flow or pathway.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">processed_datetime</span> <span className="text-muted-foreground text-xs">(string, optional)</span> — ISO 8601 datetime. Defaults to current time.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">source_type</span> <span className="text-muted-foreground text-xs">(string, optional)</span> — Type of source (e.g. phone_call, chat, note).</p>
                <p className="text-foreground"><span className="text-primary font-semibold">source_id</span> <span className="text-muted-foreground text-xs">(string, optional)</span> — Unique identifier for the source. Auto-generated if omitted.</p>
                <p className="text-foreground"><span className="text-primary font-semibold">context</span> <span className="text-muted-foreground text-xs">(object, optional)</span> — Key-value pairs matching active context parameters. Injected into the prompt as known context.</p>
              </div>
            </div>

            <div>
              <h3 className="text-foreground font-semibold mb-2">Example Request</h3>
              <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-api-request">
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
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              Response
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20 ml-2">200 OK</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-api-response">
{`{
  "status": "success",
  "data": {
    "care_flow_id": "cf_abc123",
    "processed_datetime": "2026-03-06T10:30:00Z",
    "source_type": "phone_call",
    "source_id": "call_987654321",
    "context": { "home_health_ordered": "true" },
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
      "transition_status": "<b>Overall Feeling:</b> <span>Good</span>...",
      "follow_up_areas": "<ul><li><b>Topic:</b> Detail...</li></ul>"
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

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Response Fields</h3>
              <div className="space-y-3">
                <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                  <p className="text-primary font-mono text-sm">analysis.summary</p>
                  <p className="text-muted-foreground text-sm mt-1">Brief overview of the call based on the topics discussed. Only covers what the patient actually responded to.</p>
                </div>
                <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                  <p className="text-primary font-mono text-sm">analysis.observations[]</p>
                  <p className="text-muted-foreground text-sm mt-1">Array of observation objects, one per active topic. Each contains: <code className="text-primary">name</code>, <code className="text-primary">display_name</code>, <code className="text-primary">domain</code>, <code className="text-primary">value_type</code>, <code className="text-primary">value</code> (extracted value or null), <code className="text-primary">detail</code> (explanation), <code className="text-primary">evidence</code> (direct transcript quote), and <code className="text-primary">confidence</code> (high/medium/low).</p>
                </div>
                <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                  <p className="text-primary font-mono text-sm">analysis.transition_status</p>
                  <p className="text-muted-foreground text-sm mt-1">HTML-formatted rich text covering all observation topics with inline color-coded status badges.</p>
                </div>
                <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                  <p className="text-primary font-mono text-sm">analysis.follow_up_areas</p>
                  <p className="text-muted-foreground text-sm mt-1">HTML-formatted list of items needing follow-up. Only includes topics with problems or gaps.</p>
                </div>
                <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                  <p className="text-primary font-mono text-sm">tokenUsage</p>
                  <p className="text-muted-foreground text-sm mt-1">Token counts and cost estimate. Model: gemini-2.0-flash-001 ($0.10/1M input, $0.40/1M output).</p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-foreground font-semibold mb-2">Status Badge Colors</h3>
              <p className="text-muted-foreground text-sm mb-3">The <code className="text-primary">transition_status</code> field uses inline styles for color-coded badges:</p>
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
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              Error Responses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-red-500 border-red-500/30">401</Badge>
                  <span className="text-foreground text-sm font-semibold">Unauthorized</span>
                </div>
                <pre className="text-gray-400 text-sm">{`{ "status": "error", "message": "Invalid or missing API key" }`}</pre>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">400</Badge>
                  <span className="text-foreground text-sm font-semibold">Bad Request</span>
                </div>
                <pre className="text-gray-400 text-sm">{`{ "status": "error", "message": "A non-empty source_text string is required." }`}</pre>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-red-500 border-red-500/30">500</Badge>
                  <span className="text-foreground text-sm font-semibold">Server Error</span>
                </div>
                <pre className="text-gray-400 text-sm">{`{ "status": "error", "message": "Failed to analyze transcript. ..." }`}</pre>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              Example cURL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-api-curl">
{`curl -X POST https://YOUR-CLOUD-RUN-URL/gwc_observation_summarization \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
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
            <p className="text-muted-foreground">Configure a webhook or custom action in Awell with the following settings:</p>
            <div className="space-y-3">
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <p className="text-primary font-mono text-sm mb-1">URL</p>
                <p className="text-foreground text-sm">https://YOUR-CLOUD-RUN-URL/gwc_observation_summarization</p>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <p className="text-primary font-mono text-sm mb-1">Method</p>
                <p className="text-foreground text-sm">POST</p>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <p className="text-primary font-mono text-sm mb-1">Headers</p>
                <div className="text-foreground text-sm space-y-1">
                  <p><code className="text-primary">Content-Type: application/json</code></p>
                  <p><code className="text-primary">X-API-Key: your-api-key</code></p>
                </div>
              </div>
              <div className="bg-muted/30 border border-border/50 p-3 rounded-lg">
                <p className="text-primary font-mono text-sm mb-1">Body Mapping</p>
                <div className="text-foreground text-sm space-y-1">
                  <p><code className="text-primary">care_flow_id</code> → Awell care flow ID</p>
                  <p><code className="text-primary">source_type</code> → "phone_call"</p>
                  <p><code className="text-primary">source_id</code> → Awell activity ID or call reference</p>
                  <p><code className="text-primary">source_text</code> → Call transcript from telephony provider</p>
                  <p><code className="text-primary">context.home_health_ordered</code> → Data point value</p>
                  <p><code className="text-primary">context.dme_or_supplies_ordered</code> → Data point value</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Health Check
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-3">Verify the API is running:</p>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-blue-600 text-white border-blue-700">GET</Badge>
              <code className="text-primary">/api/health</code>
            </div>
            <pre className="bg-[#172938] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-api-health">
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

      </div>
    </div>
  );
}
