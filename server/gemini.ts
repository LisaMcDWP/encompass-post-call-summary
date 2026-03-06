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
  "transition_status": "HTML-formatted rich text covering ALL post-discharge transition topics. Return the response as valid JSON with HTML inside the string value. Do not escape the HTML tags. Use the exact HTML format shown below for EVERY topic. Use <span class='status-good'> for positive statuses, <span class='status-warning'> for caution statuses, <span class='status-poor'> for negative statuses, <span class='status-info'> for informational, and <span class='status-neutral'> for not discussed/unknown. ALWAYS include ALL 11 topics. If a topic was not discussed, use status-neutral class with text 'Not Discussed'. Format each topic exactly like this example:\\n<b>Overall Feeling:</b> <span class='status-good'>Good</span><br>Patient reports feeling well since discharge.<br><br>\\n\\nTopics and their status-to-class mappings:\\n• <b>Overall Feeling:</b> Good=status-good, Fair=status-warning, Poor=status-poor, Not Discussed=status-neutral\\n• <b>Disposition Change:</b> No Readmission=status-good, Readmitted=status-poor, Not Discussed=status-neutral\\n• <b>Prescription Pickup:</b> Picked Up=status-good, Partially Picked Up=status-warning, Not Picked Up=status-poor, Not Asked=status-neutral, Unknown=status-neutral\\n• <b>Medication Adherence:</b> No Issues=status-good, Has Barriers=status-poor, Not Discussed=status-neutral\\n• <b>Follow-up Appointment:</b> Scheduled=status-good, Completed=status-good, Not Scheduled=status-poor, Cancelled=status-poor, Not Discussed=status-neutral\\n• <b>DME or Supplies Delivered:</b> Delivered=status-good, Partially Delivered=status-warning, Not Delivered=status-poor, Ordered Not Received=status-warning, Not Ordered=status-neutral, Not Discussed=status-neutral, Unknown=status-neutral\\n• <b>Home Health Visit:</b> Completed=status-good, Scheduled=status-good, Missed=status-poor, Pending=status-warning, Not Discussed=status-neutral\\n• <b>Discharge Instructions:</b> No Questions=status-good, Has Questions=status-info, Not Discussed=status-neutral\\n• <b>Encompass Feedback:</b> Positive=status-good, Mixed=status-warning, Negative=status-poor, Not Discussed=status-neutral\\n• <b>Experience Comments:</b> Positive=status-good, Mixed=status-warning, Negative=status-poor, Not Discussed=status-neutral\\n• <b>Other:</b> Any other important information. If none, write 'None.'\\n\\nAfter each status span, add a <br> then write the detail sentence(s), then <br><br> before the next topic.",
  "follow_up_areas": "HTML-formatted rich text listing follow-up areas based ONLY on issues found in transition_status. Use <ul> and <li> tags. Each <li> should contain a <b> tag for the topic name and a brief description of the follow-up needed. Only include items for topics that had problems or gaps. If no follow-up areas, return '<p>No follow-up areas identified.</p>'. Example: <ul><li><b>Prescription Pickup:</b> Blood thinner pending prior authorization for 4 days. Contact pharmacy or insurance.</li><li><b>Follow-up Appointment:</b> Cancelled due to lack of transportation. Arrange transport assistance.</li></ul>"
}

Guidelines:
- All output must use third person perspective. Use "Patient reports..." when the patient answered directly, or "Patient's [relationship] reports..." when a family member or caregiver answered. Never use first person or second person.
- Present information objectively. Report exactly what was stated without interpretation. Maintain a factual tone without emotional language.
- summary: Provide a brief overall summary based on questions asked and the patient's responses. Only comment on what the patient actually responded to. If the patient answered the call, cover at a minimum: (1) how the patient is feeling since discharge, (2) any ER/hospital/SNF visits since discharge with specifics (why, where, date, current location), (3) prescription pickup status and barriers/issues/concerns, (4) follow-up appointment status with their doctor, (5) home health visit status and details, (6) any discharge instruction questions or questions for the care team, (7) feedback on their stay at Encompass, (8) experience comments about the call, (9) any other important information shared. Do not include information the patient did not discuss.
- disposition_change: Set to true ONLY if the patient was readmitted to an ER, hospital, SNF, or any care facility since discharge. Set to false if no readmission occurred or the topic was not discussed.
- disposition_change_note: If disposition_change is true, describe where the patient currently is (home, hospital, care facility, SNF, rehab, etc.). Return JSON null if the patient was not readmitted, the question was not asked, or no response was provided.
- transition_status: Return HTML-formatted rich text. Use <b> for topic labels, <span class='status-{type}'> for status indicators (status-good, status-warning, status-poor, status-info, status-neutral), and <br> to separate sections. ALWAYS include ALL 11 topics (Overall Feeling, Disposition Change, Prescription Pickup, Medication Adherence, Follow-up Appointment, DME or Supplies Delivered, Home Health Visit, Discharge Instructions, Encompass Feedback, Experience Comments, Other). If a topic was not discussed, use status-neutral with "Not Discussed". Do not escape HTML tags. They must appear directly in the JSON string value.
- follow_up_areas: Return HTML-formatted rich text using <ul> and <li> tags. Each <li> should use <b> for the topic name. Only include items for topics with problems or gaps. If no follow-up, return "<p>No follow-up areas identified.</p>". Do not escape HTML tags.
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
