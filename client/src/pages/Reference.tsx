import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Code2, Webhook, Server, Key, Activity, Database, Settings } from "lucide-react";

export default function Reference() {
  return (
    <div className="h-full overflow-y-auto" style={{ background: "linear-gradient(180deg, #101a22 0%, #172938 100%)" }}>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-[#0098db]" />
            API Reference
          </h1>
          <p className="text-sm text-gray-400 mt-1">Guideway Care Post-Call Analysis API</p>
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
              <p className="text-gray-300">Accepts source text with contextual metadata (care flow, source type), processes it through Gemini AI, and returns structured clinical analysis with HTML-formatted output. The analysis prompt is dynamically built from the active observations configured in the Observations setup page.</p>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">Request Body</h3>
              <p className="text-gray-400 text-sm mb-2">Content-Type: application/json</p>
              <div className="bg-[#0d1520] p-4 rounded-lg text-sm space-y-2 mb-4">
                <p className="text-gray-300"><span className="text-[#96d410]">care_flow_id</span> <span className="text-gray-500">(string, optional)</span> — Identifier for the care flow or pathway.</p>
                <p className="text-gray-300"><span className="text-[#96d410]">interaction_datetime</span> <span className="text-gray-500">(string, optional)</span> — ISO 8601 datetime of the interaction. Defaults to current time.</p>
                <p className="text-gray-300"><span className="text-[#96d410]">source_type</span> <span className="text-gray-500">(string, optional)</span> — Type of source (e.g. phone_call, chat, note).</p>
                <p className="text-gray-300"><span className="text-[#96d410]">source_id</span> <span className="text-gray-500">(string, optional)</span> — Unique identifier for the source. Auto-generated if omitted.</p>
                <p className="text-gray-300"><span className="text-[#96d410]">source_text</span> <span className="text-gray-500">(string, required)</span> — The full patient call transcript or interaction text.</p>
              </div>
              <h4 className="text-white font-semibold mb-2 text-sm">Example Request Body</h4>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-request-body">
{`{
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
      "observations": [
        {
          "name": "overall_feeling",
          "display_name": "Overall Feeling",
          "domain": "clinical",
          "value_type": "enum",
          "value": "Good",
          "detail": "Patient reports feeling well overall."
        }
      ],
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
                  <p className="text-gray-400 text-sm mt-1">Brief overview of the call based on the topics discussed. Content is driven by the configurable summary instruction (see Summary Prompt settings). Only covers what the patient actually responded to.</p>
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
                  <p className="text-[#96d410] font-mono text-sm">observations</p>
                  <p className="text-gray-400 text-sm mt-1">Array of observation objects, one per active topic configured in the Observations setup. Each object contains: <code className="text-[#0098db]">name</code> (key), <code className="text-[#0098db]">display_name</code>, <code className="text-[#0098db]">domain</code>, <code className="text-[#0098db]">value_type</code> (enum/boolean/text/number), <code className="text-[#0098db]">value</code> (extracted value or null if not discussed), and <code className="text-[#0098db]">detail</code> (explanation guided by the observation's prompt guidance, or a generic description if none is set). Enum values match the labels defined in each observation's configuration.</p>
                </div>
                <div className="bg-[#0d1520] p-3 rounded-lg">
                  <p className="text-[#96d410] font-mono text-sm">transition_status</p>
                  <p className="text-gray-400 text-sm mt-1">HTML-formatted rich text covering all active observation topics. Uses inline styles for color-coded status badges. Format: <code className="text-[#0098db]">&lt;b&gt;</code> for topic labels, <code className="text-[#0098db]">&lt;span style='...'&gt;</code> for colored badges, <code className="text-[#0098db]">&lt;br&gt;</code> for line breaks. Discussed topics appear first; "Not Discussed" topics are grouped at the bottom.</p>
                </div>
                <div className="bg-[#0d1520] p-3 rounded-lg">
                  <p className="text-[#96d410] font-mono text-sm">follow_up_areas</p>
                  <p className="text-gray-400 text-sm mt-1">HTML-formatted rich text using <code className="text-[#0098db]">&lt;ul&gt;</code> and <code className="text-[#0098db]">&lt;li&gt;</code> tags with <code className="text-[#0098db]">&lt;b&gt;</code> for topic names. Only includes items for topics that had problems or gaps.</p>
                </div>
              </div>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">Inline Status Badge Colors</h3>
              <p className="text-gray-400 text-sm mb-3">The <code className="text-[#0098db]">transition_status</code> field uses inline styles for color-coded status badges. Colors are assigned based on each observation's enum value configuration:</p>
              <div className="bg-[#0d1520] p-4 rounded-lg text-sm space-y-3">
                <div className="flex items-center gap-3">
                  <span style={{display:'inline-block',padding:'1px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:600,background:'#dcfce7',color:'#166534',border:'1px solid #bbf7d0'}}>Good</span>
                  <span className="text-gray-500 text-xs">GREEN — positive outcomes</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{display:'inline-block',padding:'1px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:600,background:'#fef9c3',color:'#854d0e',border:'1px solid #fde68a'}}>Fair</span>
                  <span className="text-gray-500 text-xs">YELLOW — caution / partial</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{display:'inline-block',padding:'1px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:600,background:'#fee2e2',color:'#991b1b',border:'1px solid #fecaca'}}>Poor</span>
                  <span className="text-gray-500 text-xs">RED — negative / missed</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{display:'inline-block',padding:'1px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:600,background:'#dbeafe',color:'#1e40af',border:'1px solid #bfdbfe'}}>Has Questions</span>
                  <span className="text-gray-500 text-xs">BLUE — informational</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{display:'inline-block',padding:'1px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:600,background:'#f3f4f6',color:'#6b7280',border:'1px solid #e5e7eb'}}>Not Discussed</span>
                  <span className="text-gray-500 text-xs">GRAY — not discussed / unknown</span>
                </div>
              </div>
              <h4 className="text-white font-semibold mb-2 mt-4 text-sm">Example HTML Output</h4>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-xs overflow-x-auto">
{`<b>Overall Feeling:</b> <span style='display:inline-block;padding:1px 8px;
  border-radius:9999px;font-size:11px;font-weight:600;
  background:#fee2e2;color:#991b1b;border:1px solid #fecaca;'>Poor</span><br>
Patient reports weakness and dizziness since discharge.<br><br>

<b>Prescription Pickup:</b> <span style='display:inline-block;padding:1px 8px;
  border-radius:9999px;font-size:11px;font-weight:600;
  background:#fef9c3;color:#854d0e;border:1px solid #fde68a;'>Partially Picked Up</span><br>
Patient's daughter reports most prescriptions picked up but blood thinner
pending prior authorization.<br><br>`}
              </pre>
              <div className="bg-[#172938] border border-[#0098db]/20 p-4 rounded-lg mt-4">
                <p className="text-[#0098db] font-semibold text-sm mb-2">Dynamic Configuration</p>
                <p className="text-gray-400 text-sm">Status values and color mappings are defined per observation in the Observations setup page. Each enum value has an assigned color (GREEN, YELLOW, RED, BLUE, GRAY) that determines its inline style in the output.</p>
              </div>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">Example cURL</h3>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto" data-testid="text-curl-example">
{`curl -X POST https://YOUR-CLOUD-RUN-URL/api/analyze \\
  -H "Content-Type: application/json" \\
  -d '{
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
            <p className="text-gray-300 mb-3">Returns the dynamically generated prompt template built from the active observations and the configured summary instruction.</p>
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
              <Database className="h-5 w-5 text-[#0098db]" />
              Observations CRUD
              <Badge className="bg-[#96d410]/20 text-[#96d410] border-[#96d410]/30 ml-2">Setup</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-gray-300">Manage observation topics that drive the Gemini analysis prompt. Observations are stored in BigQuery (<code className="text-[#0098db]">call_information.observations</code>).</p>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">GET /api/observations</h3>
              <p className="text-gray-400 text-sm mb-2">Returns all observations ordered by display_order.</p>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
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

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">POST /api/observations</h3>
              <p className="text-gray-400 text-sm mb-2">Create a new observation topic.</p>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
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
  "promptGuidance": "Note the location and severity of pain, and whether it has improved or worsened since discharge."
}`}
              </pre>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">PUT /api/observations/:id</h3>
              <p className="text-gray-400 text-sm mb-2">Update an existing observation. Only include fields you want to change.</p>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "displayName": "Updated Display Name",
  "promptGuidance": "Updated guidance for Gemini."
}`}
              </pre>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">DELETE /api/observations/:id</h3>
              <p className="text-gray-400 text-sm">Permanently deletes an observation by ID. Returns 204 on success.</p>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">PUT /api/observations/reorder</h3>
              <p className="text-gray-400 text-sm mb-2">Reorder observations by providing an array of IDs in the desired order.</p>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "ids": [3, 1, 5, 2, 4]
}`}
              </pre>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">Observation Fields</h3>
              <div className="bg-[#0d1520] p-4 rounded-lg text-sm space-y-2">
                <p className="text-gray-300"><span className="text-[#96d410]">id</span> <span className="text-gray-500">(INT64)</span> — Auto-generated unique identifier.</p>
                <p className="text-gray-300"><span className="text-[#96d410]">name</span> <span className="text-gray-500">(string)</span> — Machine-readable key (e.g. "overall_feeling").</p>
                <p className="text-gray-300"><span className="text-[#96d410]">displayName</span> <span className="text-gray-500">(string)</span> — Human-readable label shown in output.</p>
                <p className="text-gray-300"><span className="text-[#96d410]">domain</span> <span className="text-gray-500">(string)</span> — Category grouping: clinical, medication, appointment, equipment, discharge, experience, general.</p>
                <p className="text-gray-300"><span className="text-[#96d410]">displayOrder</span> <span className="text-gray-500">(integer)</span> — Sort order in output.</p>
                <p className="text-gray-300"><span className="text-[#96d410]">valueType</span> <span className="text-gray-500">(string)</span> — One of: enum, boolean, text, number.</p>
                <p className="text-gray-300"><span className="text-[#96d410]">value</span> <span className="text-gray-500">(array)</span> — For enum types, array of <code className="text-[#0098db]">{`{ label, color }`}</code> objects. Colors: GREEN, YELLOW, RED, BLUE, GRAY.</p>
                <p className="text-gray-300"><span className="text-[#96d410]">isActive</span> <span className="text-gray-500">(boolean)</span> — Whether this observation is included in the analysis prompt.</p>
                <p className="text-gray-300"><span className="text-[#96d410]">promptGuidance</span> <span className="text-gray-500">(string, optional)</span> — Custom instruction for Gemini on how to evaluate the detail field for this observation. If empty, a generic instruction ("Brief explanation of what was observed") is used.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a2f40]/80 border-[#0098db]/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-[#0098db]" />
              Summary Instruction Settings
              <Badge className="bg-[#96d410]/20 text-[#96d410] border-[#96d410]/30 ml-2">Setup</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-gray-300">Configure the instruction Gemini uses to generate the <code className="text-[#0098db]">summary</code> field. Stored in BigQuery (<code className="text-[#0098db]">call_information.settings</code>).</p>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">GET /api/settings/summary-instruction</h3>
              <p className="text-gray-400 text-sm mb-2">Returns the current summary instruction. Falls back to the default if none is configured.</p>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "value": "A brief overall summary of the call based on the questions asked of the patient and their responses. If the patient answered the call, include the following topics at a minimum (only comment on what the patient actually responded to): {{SUMMARY_TOPICS}}.",
  "isDefault": true
}`}
              </pre>
              <div className="bg-[#172938] border border-[#0098db]/20 p-3 rounded-lg mt-3">
                <p className="text-gray-400 text-sm"><code className="text-[#0098db]">{`{{SUMMARY_TOPICS}}`}</code> is a placeholder that gets replaced at prompt-build time with the display names of all active observations (e.g. "overall feeling; disposition change; prescription pickup").</p>
              </div>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">PUT /api/settings/summary-instruction</h3>
              <p className="text-gray-400 text-sm mb-2">Set or update the summary instruction.</p>
              <pre className="bg-[#0d1520] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "value": "Summarize the call focusing on clinical outcomes and patient concerns. Topics: {{SUMMARY_TOPICS}}."
}`}
              </pre>
            </div>

            <Separator className="bg-[#0098db]/10" />

            <div>
              <h3 className="text-white font-semibold mb-2">DELETE /api/settings/summary-instruction</h3>
              <p className="text-gray-400 text-sm">Removes the custom summary instruction and reverts to the default. Returns 204 on success.</p>
            </div>
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
                <p><code className="text-[#96d410]">data.analysis.observations</code> → Array of Extracted Observations</p>
                <p><code className="text-[#96d410]">data.analysis.transition_status</code> → Transition Status Details (HTML)</p>
                <p><code className="text-[#96d410]">data.analysis.follow_up_areas</code> → Follow-Up Items (HTML)</p>
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
                <li>Enable APIs: Cloud Run, Cloud Build, Container Registry, Secret Manager, Vertex AI, BigQuery</li>
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
                <li>BigQuery Data Editor (for observations, settings, and API logging)</li>
                <li>BigQuery Job User (for running queries)</li>
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
            <Separator className="bg-[#0098db]/10" />
            <div>
              <h3 className="text-white font-semibold mb-2">BigQuery Resources</h3>
              <div className="bg-[#0d1520] p-3 rounded-lg text-sm">
                <p className="text-gray-300"><span className="text-[#96d410]">Dataset:</span> call_information</p>
                <p className="text-gray-300 mt-1"><span className="text-[#96d410]">Tables:</span></p>
                <ul className="text-gray-400 text-sm list-disc list-inside ml-2 mt-1 space-y-1">
                  <li><code className="text-[#0098db]">api_logs</code> — API call logging (call_id, timestamp, transcript, summary, processing_time, status)</li>
                  <li><code className="text-[#0098db]">observations</code> — Observation configuration (id, name, display_name, domain, display_order, value_type, value, is_active, prompt_guidance)</li>
                  <li><code className="text-[#0098db]">settings</code> — Key-value settings store (key, value)</li>
                </ul>
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
