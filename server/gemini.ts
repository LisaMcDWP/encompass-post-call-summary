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
  areasForFollowUp: string[];
  questionsAndResponses: { question: string; response: string }[];
  dispositionChange: {
    changed: boolean;
    details: string;
  };
  prescriptionPickupStatus: {
    status: string;
    details: string;
  };
  medicationNotes: {
    questions: string[];
    barriers: string[];
    notes: string;
  };
  followUpScheduledStatus: {
    scheduled: boolean;
    details: string;
  };
  homeHealthVisit: {
    status: string;
    details: string;
  };
}

export const DEFAULT_PROMPT_TEMPLATE = `You are an expert healthcare call analyst for Guideway Care. Analyze the following patient interaction transcript and produce a structured JSON output.

Your response MUST be valid JSON with exactly this structure:
{
  "summary": "A concise 2-4 sentence summary of the interaction including key outcomes",
  "areasForFollowUp": ["actionable follow-up item 1", "actionable follow-up item 2", ...],
  "questionsAndResponses": [
    {"question": "exact question asked by patient", "response": "exact or paraphrased response given by care guide"},
    ...
  ],
  "dispositionChange": {
    "changed": true/false,
    "details": "Describe if the patient's disposition changed — did they visit a hospital, ER, or SNF (Skilled Nursing Facility)? If yes, provide details. If no evidence of a disposition change, say 'No disposition change identified in transcript.'"
  },
  "prescriptionPickupStatus": {
    "status": "picked_up | not_picked_up | not_discussed | in_progress | unknown",
    "details": "Describe the prescription pickup status based on what was discussed in the call. Include medication names if mentioned."
  },
  "medicationNotes": {
    "questions": ["Any medication-related questions the patient asked"],
    "barriers": ["Any barriers to medication adherence mentioned (cost, side effects, confusion, transportation, etc.)"],
    "notes": "General commentary on medication-related discussion in the call. If no medication discussion, say 'No medication discussion in transcript.'"
  },
  "followUpScheduledStatus": {
    "scheduled": true/false,
    "details": "Was a follow-up appointment or call scheduled? Provide date/time if mentioned. If not discussed, say 'No follow-up scheduling discussed in transcript.'"
  },
  "homeHealthVisit": {
    "status": "completed | scheduled | pending | not_discussed | cancelled | unknown",
    "details": "Has a home health visit occurred, or what is the current status? Include dates, provider names, and any relevant details mentioned. If not discussed, say 'No home health visit discussed in transcript.'"
  }
}

Guidelines:
- summary: Focus on the patient's concern, actions taken by the care guide, and the outcome.
- areasForFollowUp: List specific, actionable items that need follow-up after this call. Be concrete with dates, names, and details from the transcript.
- questionsAndResponses: Extract every distinct question the patient asked and the corresponding response. Include only actual questions, not rhetorical ones.
- dispositionChange: Look for any mention of hospital visits, ER visits, SNF stays, or changes in the patient's care setting. Report what you find or indicate nothing was mentioned.
- prescriptionPickupStatus: Identify if prescriptions were picked up, pending, or not discussed. Include any pharmacy or medication pickup details.
- medicationNotes: Capture all medication-related questions, barriers to adherence, and general notes. This includes cost concerns, side effects, confusion about dosing, or difficulty obtaining medications.
- followUpScheduledStatus: Determine if any future appointment or follow-up call was scheduled during this interaction.
- homeHealthVisit: Determine if a home health visit has already occurred, is scheduled, is pending, or was not discussed. Include provider details and dates if available.

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
    !Array.isArray(parsed.areasForFollowUp) ||
    !Array.isArray(parsed.questionsAndResponses)
  ) {
    console.error("Gemini returned unexpected structure:", JSON.stringify(parsed).substring(0, 500));
    throw new Error("Gemini response missing required fields. Please try again.");
  }

  return { analysis: parsed as TranscriptAnalysis, promptUsed: prompt };
}
