import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, Code2, Webhook, Server, Key, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Reference() {
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #101a22 0%, #172938 100%)" }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="outline" size="sm" className="border-[#0098db]/30 text-[#0098db] hover:bg-[#0098db]/10" data-testid="link-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Test UI
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-[#0098db]" />
              API Reference
            </h1>
            <p className="text-sm text-gray-400">Guideway Care Post-Call Analysis API</p>
          </div>
        </div>

        <Card className="bg-[#1a2f40]/80 border-[#0098db]/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Server className="h-5 w-5 text-[#0098db]" />
              Base URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300 mb-3">Replace with your Cloud Run URL after deployment:</p>
            <pre className="bg-[#0d1520] text-[#96d410] p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-base-url">
{`https://guideway-care-api-XXXXXXXX-uc.a.run.app`}
            </pre>
            <p className="text-gray-400 text-sm mt-3">Find your URL in GCP Console → Cloud Run → guideway-care-api → URL at the top of the page.</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a2f40]/80 border-[#0098db]/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Code2 className="h-5 w-5 text-[#0098db]" />
              POST /api/analyze
              <Badge className="bg-[#0098db]/20 text-[#0098db] border-[#0098db]/30 ml-2">Primary Endpoint</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-white font-semibold mb-2">Description</h3>
              <p className="text-gray-300">Accepts source text with contextual metadata (record context, care flow, source type), processes it through Gemini AI, and returns structured clinical analysis with HTML-formatted output.</p>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">Request Body</h3>
              <p className="text-gray-400 text-sm mb-2">Content-Type: application/json</p>
              <div className="bg-[#0d1520] p-4 rounded-lg text-sm space-y-2 mb-4">
                <p className="text-gray-300"><span className="text-[#96d410]">record_context</span> <span className="text-gray-500">(string, optional)</span> — Context for the record (e.g. post_discharge_call, follow_up).</p>
                <p className="text-gray-300"><span className="text-[#96d410]">care_flow_id</span> <span className="text-gray-500">(string, optional)</span> — Identifier for the care flow or pathway.</p>
                <p className="text-gray-300"><span className="text-[#96d410]">interaction_datetime</span> <span className="text-gray-500">(string, optional)</span> — ISO 8601 datetime of the interaction. Defaults to current time.</p>
                <p className="text-gray-300"><span className="text-[#96d410]">source_type</span> <span className="text-gray-500">(string, optional)</span> — Type of source (e.g. phone_call, chat, note).</p>
                <p className="text-gray-300"><span className="text-[#96d410]">source_id</span> <span className="text-gray-500">(string, optional)</span> — Unique identifier for the source. Auto-generated if omitted.</p>
                <p className="text-gray-300"><span className="text-[#96d410]">source_text</span> <span className="text-gray-500">(string, required)</span> — The full patient call transcript or interaction text.</p>
              </div>
              <h4 className="text-white font-semibold mb-2 text-sm">Example Request Body</h4>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-request-body">
{`{
  "record_context": "post_discharge_call",
  "care_flow_id": "cf_abc123",
  "interaction_datetime": "2026-03-06T10:30:00Z",
  "source_type": "phone_call",
  "source_id": "call_987654321",
  "source_text": "Care Guide: Hello, this is Maria from Guideway Care. Am I speaking with Mrs. Thompson?\\nPatient: Yes, this is she.\\nCare Guide: I'm calling to check in on you since you were discharged. How have you been feeling?\\nPatient: I'm doing much better, thank you. Still a little sore but getting around okay."
}`}
              </pre>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">Response</h3>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-response-body">
{`{
  "status": "success",
  "data": {
    "record_context": "post_discharge_call",
    "care_flow_id": "cf_abc123",
    "interaction_datetime": "2026-03-06T10:30:00Z",
    "source_type": "phone_call",
    "source_id": "call_987654321",
    "processedAt": "2026-03-06T12:00:00.000Z",
    "processingTimeMs": 1234,
    "analysis": {
      "summary": "Brief overall summary of the call...",
      "disposition_change": true | false,
      "disposition_change_note": "Current location if readmitted, or null",
      "transition_status": "<b>Overall Feeling:</b> <span style='...'>Good</span><br>...",
      "follow_up_areas": "<ul><li><b>Topic:</b> Detail...</li></ul>"
    }
  }
}`}
              </pre>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">Analysis Fields</h3>
              <div className="space-y-3">
                <div className="bg-[#0d1520] p-3 rounded-lg">
                  <p className="text-[#96d410] font-mono text-sm">summary</p>
                  <p className="text-gray-400 text-sm mt-1">Brief overview of the call covering: patient feeling, ER/hospital visits, prescription status, follow-up appointments, home health, discharge instructions, Encompass feedback, experience comments, and other info.</p>
                </div>
                <div className="bg-[#0d1520] p-3 rounded-lg">
                  <p className="text-[#96d410] font-mono text-sm">disposition_change</p>
                  <p className="text-gray-400 text-sm mt-1">Boolean. True only if the patient was readmitted to an ER, hospital, SNF, or care facility since discharge.</p>
                </div>
                <div className="bg-[#0d1520] p-3 rounded-lg">
                  <p className="text-[#96d410] font-mono text-sm">disposition_change_note</p>
                  <p className="text-gray-400 text-sm mt-1">String or null. If readmitted, describes where the patient currently is (home, hospital, SNF, rehab, etc.). Null if no readmission.</p>
                </div>
                <div className="bg-[#0d1520] p-3 rounded-lg">
                  <p className="text-[#96d410] font-mono text-sm">transition_status</p>
                  <p className="text-gray-400 text-sm mt-1">HTML-formatted rich text covering all 11 post-discharge topics. Uses <code className="text-[#0098db]">&lt;b&gt;</code> for labels, <code className="text-[#0098db]">&lt;span class='status-[type]'&gt;</code> for colored status badges, and <code className="text-[#0098db]">&lt;br&gt;</code> for line breaks. Status classes: <code className="text-[#0098db]">status-good</code> (green), <code className="text-[#0098db]">status-warning</code> (yellow), <code className="text-[#0098db]">status-poor</code> (red), <code className="text-[#0098db]">status-info</code> (blue), <code className="text-[#0098db]">status-neutral</code> (gray).</p>
                </div>
                <div className="bg-[#0d1520] p-3 rounded-lg">
                  <p className="text-[#96d410] font-mono text-sm">follow_up_areas</p>
                  <p className="text-gray-400 text-sm mt-1">HTML-formatted rich text using <code className="text-[#0098db]">&lt;ul&gt;</code> and <code className="text-[#0098db]">&lt;li&gt;</code> tags with <code className="text-[#0098db]">&lt;b&gt;</code> for topic names. Only includes items for topics that had problems or gaps.</p>
                </div>
              </div>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">HTML Status Classes</h3>
              <p className="text-gray-400 text-sm mb-3">The transition_status field returns HTML with these CSS classes for status indicators:</p>
              <div className="bg-[#0d1520] p-4 rounded-lg text-sm space-y-3">
                <div className="flex items-center gap-3">
                  <span className="status-good">Good</span>
                  <code className="text-gray-400 text-xs">status-good</code>
                  <span className="text-gray-500 text-xs">— Green: positive outcomes</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="status-warning">Fair</span>
                  <code className="text-gray-400 text-xs">status-warning</code>
                  <span className="text-gray-500 text-xs">— Yellow: caution / partial</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="status-poor">Poor</span>
                  <code className="text-gray-400 text-xs">status-poor</code>
                  <span className="text-gray-500 text-xs">— Red: negative / missed</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="status-info">Has Questions</span>
                  <code className="text-gray-400 text-xs">status-info</code>
                  <span className="text-gray-500 text-xs">— Blue: informational</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="status-neutral">Not Discussed</span>
                  <code className="text-gray-400 text-xs">status-neutral</code>
                  <span className="text-gray-500 text-xs">— Gray: not discussed / unknown</span>
                </div>
              </div>
              <h4 className="text-white font-semibold mb-2 mt-4 text-sm">Example HTML Output</h4>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-xs overflow-x-auto">
{`<b>Overall Feeling:</b> <span class='status-poor'>Poor</span><br>
Patient reports weakness and dizziness since discharge.<br><br>

<b>Prescription Pickup:</b> <span class='status-warning'>Partially Picked Up</span><br>
Patient's daughter reports most prescriptions picked up but blood thinner
pending prior authorization.<br><br>

<b>Follow-up Appointment:</b> <span class='status-poor'>Cancelled</span><br>
Patient cancelled appointment due to lack of transportation.<br><br>`}
              </pre>
              <h4 className="text-white font-semibold mb-2 mt-4 text-sm">Status Values Per Topic</h4>
              <div className="bg-[#0d1520] p-4 rounded-lg text-sm space-y-2">
                <p className="text-gray-300"><span className="text-[#0098db]">Overall Feeling:</span> Good, Fair, Poor, Not Discussed</p>
                <p className="text-gray-300"><span className="text-[#0098db]">Disposition Change:</span> No Readmission, Readmitted, Not Discussed</p>
                <p className="text-gray-300"><span className="text-[#0098db]">Prescription Pickup:</span> Picked Up, Not Picked Up, Partially Picked Up, Not Asked, Unknown</p>
                <p className="text-gray-300"><span className="text-[#0098db]">Medication Adherence:</span> No Issues, Has Barriers, Not Discussed</p>
                <p className="text-gray-300"><span className="text-[#0098db]">Follow-up Appointment:</span> Scheduled, Not Scheduled, Completed, Cancelled, Not Discussed</p>
                <p className="text-gray-300"><span className="text-[#0098db]">DME or Supplies:</span> Delivered, Partially Delivered, Not Delivered, Ordered Not Received, Not Ordered, Not Discussed, Unknown</p>
                <p className="text-gray-300"><span className="text-[#0098db]">Home Health Visit:</span> Completed, Scheduled, Missed, Pending, Not Discussed</p>
                <p className="text-gray-300"><span className="text-[#0098db]">Discharge Instructions:</span> No Questions, Has Questions, Not Discussed</p>
                <p className="text-gray-300"><span className="text-[#0098db]">Encompass Feedback:</span> Positive, Mixed, Negative, Not Discussed</p>
                <p className="text-gray-300"><span className="text-[#0098db]">Experience Comments:</span> Positive, Mixed, Negative, Not Discussed</p>
              </div>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">Example cURL</h3>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-curl-example">
{`curl -X POST https://YOUR-CLOUD-RUN-URL/api/analyze \\
  -H "Content-Type: application/json" \\
  -d '{
    "record_context": "post_discharge_call",
    "care_flow_id": "cf_abc123",
    "source_type": "phone_call",
    "source_id": "call_987654321",
    "source_text": "Care Guide: Hello, this is Maria from Guideway Care..."
  }'`}
              </pre>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">Error Response</h3>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "status": "error",
  "error": "Description of what went wrong"
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a2f40]/80 border-[#0098db]/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#0098db]" />
              GET /api/health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300 mb-3">Returns service status. Use this to verify the API is running.</p>
            <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-health-response">
{`{
  "status": "ok",
  "service": "guideway-care-api",
  "timestamp": "2026-03-06T12:00:00.000Z"
}`}
            </pre>
          </CardContent>
        </Card>

        <Card className="bg-[#1a2f40]/80 border-[#0098db]/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Code2 className="h-5 w-5 text-[#0098db]" />
              GET /api/prompt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300 mb-3">Returns the default prompt template used for transcript analysis.</p>
            <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "prompt": "You are an expert healthcare call analyst..."
}`}
            </pre>
          </CardContent>
        </Card>

        <Card className="bg-[#1a2f40]/80 border-[#0098db]/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Webhook className="h-5 w-5 text-[#0098db]" />
              Awell Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-300">To connect this API from Awell, configure a webhook or custom action with the following:</p>
            <div className="space-y-3">
              <div className="bg-[#0d1520] p-3 rounded-lg">
                <p className="text-[#96d410] font-mono text-sm mb-1">URL</p>
                <p className="text-gray-300 text-sm">https://YOUR-CLOUD-RUN-URL/api/analyze</p>
              </div>
              <div className="bg-[#0d1520] p-3 rounded-lg">
                <p className="text-[#96d410] font-mono text-sm mb-1">Method</p>
                <p className="text-gray-300 text-sm">POST</p>
              </div>
              <div className="bg-[#0d1520] p-3 rounded-lg">
                <p className="text-[#96d410] font-mono text-sm mb-1">Headers</p>
                <p className="text-gray-300 text-sm">Content-Type: application/json</p>
              </div>
              <div className="bg-[#0d1520] p-3 rounded-lg">
                <p className="text-[#96d410] font-mono text-sm mb-1">Body</p>
                <pre className="text-gray-300 text-sm mt-1">
{`{
  "record_context": "{{awell.record_context}}",
  "care_flow_id": "{{awell.care_flow_id}}",
  "interaction_datetime": "{{awell.interaction_datetime}}",
  "source_type": "{{awell.source_type}}",
  "source_id": "{{awell.source_id}}",
  "source_text": "{{awell.source_text}}"
}`}
                </pre>
              </div>
            </div>
            <div className="bg-[#172938] border border-[#0098db]/20 p-4 rounded-lg mt-4">
              <p className="text-[#0098db] font-semibold text-sm mb-2">Mapping Response Fields in Awell</p>
              <div className="text-gray-400 text-sm space-y-1">
                <p><code className="text-[#96d410]">data.analysis.summary</code> → Call Summary</p>
                <p><code className="text-[#96d410]">data.analysis.disposition_change</code> → Readmission Flag (true/false)</p>
                <p><code className="text-[#96d410]">data.analysis.disposition_change_note</code> → Current Location</p>
                <p><code className="text-[#96d410]">data.analysis.transition_status</code> → Transition Status Details</p>
                <p><code className="text-[#96d410]">data.analysis.follow_up_areas</code> → Follow-Up Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a2f40]/80 border-[#0098db]/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Key className="h-5 w-5 text-[#0098db]" />
              GCP Deployment Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-white font-semibold mb-2">Prerequisites</h3>
              <ol className="text-gray-300 text-sm space-y-2 list-decimal list-inside">
                <li>Enable APIs: Cloud Run, Cloud Build, Container Registry, Secret Manager</li>
                <li>Store <code className="text-[#96d410]">GCP_SERVICE_ACCOUNT_KEY</code> in Secret Manager (full JSON of service account key)</li>
                <li>Grant Cloud Build service account roles: Cloud Run Admin, Service Account User, Secret Manager Secret Accessor</li>
                <li>Connect GitHub repo to Cloud Build trigger on <code className="text-[#96d410]">main</code> branch</li>
              </ol>
            </div>
            <Separator className="bg-[#0098db]/10" />
            <div>
              <h3 className="text-white font-semibold mb-2">Service Account Roles Required</h3>
              <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
                <li>Vertex AI User (for Gemini API)</li>
                <li>BigQuery Data Editor (for logging)</li>
                <li>BigQuery Job User (for logging)</li>
              </ul>
            </div>
            <Separator className="bg-[#0098db]/10" />
            <div>
              <h3 className="text-white font-semibold mb-2">Environment Variables</h3>
              <div className="bg-[#0d1520] p-3 rounded-lg text-sm">
                <p className="text-gray-300"><span className="text-[#96d410]">GCP_PROJECT_ID</span> — Your Google Cloud project ID</p>
                <p className="text-gray-300 mt-1"><span className="text-[#96d410]">GCP_SERVICE_ACCOUNT_KEY</span> — Full JSON service account key (via Secret Manager)</p>
                <p className="text-gray-300 mt-1"><span className="text-[#96d410]">PORT</span> — Set automatically by Cloud Run (default 8080)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center py-6">
          <p className="text-gray-500 text-sm">Guideway Care Post-Call Analysis API</p>
        </div>
      </div>
    </div>
  );
}
