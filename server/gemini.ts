import { VertexAI } from "@google-cloud/vertexai";

function getCredentials() {
  const raw = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GCP_SERVICE_ACCOUNT_KEY is not set");
  return JSON.parse(raw);
}

function getProjectId(): string {
  const id = process.env.GCP_PROJECT_ID;
  if (!id) throw new Error("GCP_PROJECT_ID is not set");
  return id;
}

let vertexAI: VertexAI | null = null;

function getVertexAI(): VertexAI {
  if (!vertexAI) {
    const credentials = getCredentials();
    const projectId = getProjectId();

    vertexAI = new VertexAI({
      project: projectId,
      location: "us-central1",
      googleAuthOptions: {
        credentials,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      },
    });
  }
  return vertexAI;
}

export interface TranscriptAnalysis {
  summary: string;
  transition_status: string;
  disposition_change: boolean;
  disposition_change_note: string | null;
  follow_up_areas: string;
}

export const DEFAULT_PROMPT_TEMPLATE = `You are an expert healthcare call analyst for Guideway Care. Analyze the following patient interaction transcript and produce a structured JSON output.

###CORE FORMATTING RULES
1. Use Third Person Perspective
   - "Patient reports..." (when patient answered directly)
   - "Patient's [relationship] reports..." (when family/caregiver answered)
   - Never use first person ("I", "we") or second person ("you")
2. Present Information Objectively
   - Report exactly what was stated without interpretation
   - Maintain factual tone without emotional language

Your response MUST be valid JSON with exactly this structure:
{
  "summary": "A brief overall summary of the call based on the questions asked of the patient and their responses. If the patient answered the call, include the following topics at a minimum (only comment on what the patient actually responded to): how the patient is feeling overall since being discharged; whether the patient visited an ER, hospital, or Skilled Nursing Facility since discharge (include specific details on why, where, date if known, and if they are currently at home or still in a care facility); prescription pickup status and any barriers to picking them up or any issues/concerns/questions with taking them; status of follow-up appointment scheduled with their doctor; home health visit status (whether it occurred or was scheduled and any details); any questions specific to discharge instructions or other questions for the care team; any feedback on how their stay was at Encompass; any experience comments related to the call; and any other important information the patient provided.",
  "disposition_change": true/false,
  "disposition_change_note": "If the patient was readmitted (ER, hospital, SNF, or any care facility since discharge), where are they currently? Examples: home, care facility, hospital, skilled nursing facility, rehab center, etc. Write null (JSON null) if the patient was not readmitted, if the question was not asked, or if no response was provided.",
  "transition_status": "A single HTML string covering ALL 11 post-discharge topics. This value MUST be a valid JSON string. Do NOT start with a quote character. Use inline styles for color-coded status badges. Format each topic exactly as: <b>Topic:</b> <span style='INLINE_STYLE'>STATUS</span><br>Detail sentence.<br><br> — Use these exact inline styles for each status type: GREEN (positive) = style='display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;' — YELLOW (caution) = style='display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#fef9c3;color:#854d0e;border:1px solid #fde68a;' — RED (negative) = style='display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#fee2e2;color:#991b1b;border:1px solid #fecaca;' — BLUE (informational) = style='display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe;' — GRAY (neutral) = style='display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb;' — Status-to-color mappings: Overall Feeling (Good=GREEN, Fair=YELLOW, Poor=RED, Not Discussed=GRAY), Disposition Change (No Readmission=GREEN, Readmitted=RED, Not Discussed=GRAY), Prescription Pickup (Picked Up=GREEN, Partially Picked Up=YELLOW, Not Picked Up=RED, Not Asked=GRAY, Unknown=GRAY), Medication Adherence (No Issues=GREEN, Has Barriers=RED, Not Discussed=GRAY), Follow-up Appointment (Scheduled=GREEN, Completed=GREEN, Not Scheduled=RED, Cancelled=RED, Not Discussed=GRAY), DME or Supplies Delivered (Delivered=GREEN, Partially Delivered=YELLOW, Not Delivered=RED, Ordered Not Received=YELLOW, Not Ordered=GRAY, Not Discussed=GRAY, Unknown=GRAY), Home Health Visit (Completed=GREEN, Scheduled=GREEN, Missed=RED, Pending=YELLOW, Not Discussed=GRAY), Discharge Instructions (No Questions=GREEN, Has Questions=BLUE, Not Discussed=GRAY), Encompass Feedback (Positive=GREEN, Mixed=YELLOW, Negative=RED, Not Discussed=GRAY), Experience Comments (Positive=GREEN, Mixed=YELLOW, Negative=RED, Not Discussed=GRAY), Other (any info, no badge needed). ALWAYS include all 11 topics.",
  "follow_up_areas": "A single HTML string listing follow-up areas. This value MUST be a valid JSON string. Use <ul> and <li> tags with <b> for topic names. Only include items for topics with problems or gaps. If none, use '<p>No follow-up areas identified.</p>'. Example: <ul><li><b>Prescription Pickup:</b> Blood thinner pending prior authorization.</li></ul>"
}

Guidelines:
- All output must use third person perspective. Use "Patient reports..." when the patient answered directly, or "Patient's [relationship] reports..." when a family member or caregiver answered. Never use first person or second person.
- Present information objectively. Report exactly what was stated without interpretation. Maintain a factual tone without emotional language.
- summary: Provide a brief overall summary based on questions asked and the patient's responses. Only comment on what the patient actually responded to. If the patient answered the call, cover at a minimum: (1) how the patient is feeling since discharge, (2) any ER/hospital/SNF visits since discharge with specifics (why, where, date, current location), (3) prescription pickup status and barriers/issues/concerns, (4) follow-up appointment status with their doctor, (5) home health visit status and details, (6) any discharge instruction questions or questions for the care team, (7) feedback on their stay at Encompass, (8) experience comments about the call, (9) any other important information shared. Do not include information the patient did not discuss.
- disposition_change: Set to true ONLY if the patient was readmitted to an ER, hospital, SNF, or any care facility since discharge. Set to false if no readmission occurred or the topic was not discussed.
- disposition_change_note: If disposition_change is true, describe where the patient currently is (home, hospital, care facility, SNF, rehab, etc.). Return JSON null if the patient was not readmitted, the question was not asked, or no response was provided.
- transition_status: Return a single HTML string as a valid JSON string value. Do NOT start the string with a quote or any character before the first <b> tag. Use inline style attributes with single quotes for color-coded status badges (e.g. style='display:inline-block;padding:1px 8px;...'). Use <b> for topic labels, <span style='...'> for colored status badges, and <br> for line breaks. Include all 11 topics. The entire value must be a properly quoted JSON string. The first character of the string content must be the opening < of the first <b> tag.
- follow_up_areas: Return a single HTML string as a valid JSON string value. Use <ul>/<li> with <b> for topic names. Use single quotes for any HTML attributes. Only include items with issues. If none, return "<p>No follow-up areas identified.</p>".
Call ID: {{CALL_ID}}

TRANSCRIPT:
{{TRANSCRIPT}}`;

export async function analyzeTranscript(
  callId: string,
  transcript: string,
  customPrompt?: string
): Promise<{ analysis: TranscriptAnalysis; promptUsed: string }> {
  const vertex = getVertexAI();

  const model = vertex.getGenerativeModel({
    model: "gemini-2.0-flash-001",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const template = customPrompt || DEFAULT_PROMPT_TEMPLATE;
  const prompt = template
    .replace("{{CALL_ID}}", callId)
    .replace("{{TRANSCRIPT}}", transcript);

  const result = await model.generateContent(prompt);
  const response = result.response;

  const text =
    response.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No response from Gemini model");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (parseError) {
    console.error("Gemini returned invalid JSON:", text.substring(0, 500));
    throw new Error("Gemini model returned invalid JSON. Please try again.");
  }

  if (
    !parsed.summary ||
    !parsed.transition_status ||
    !parsed.follow_up_areas
  ) {
    console.error("Gemini returned unexpected structure:", JSON.stringify(parsed).substring(0, 500));
    throw new Error("Gemini response missing required fields. Please try again.");
  }

  return { analysis: parsed as TranscriptAnalysis, promptUsed: prompt };
}
