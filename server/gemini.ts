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
}

export async function analyzeTranscript(
  callId: string,
  transcript: string
): Promise<TranscriptAnalysis> {
  const vertex = getVertexAI();

  const model = vertex.getGenerativeModel({
    model: "gemini-2.0-flash-001",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const prompt = `You are an expert healthcare call analyst for Guideway Care. Analyze the following patient interaction transcript and produce a structured JSON output.

Your response MUST be valid JSON with exactly this structure:
{
  "summary": "A concise 2-4 sentence summary of the interaction including key outcomes",
  "areasForFollowUp": ["actionable follow-up item 1", "actionable follow-up item 2", ...],
  "questionsAndResponses": [
    {"question": "exact question asked by patient", "response": "exact or paraphrased response given by care guide"},
    ...
  ]
}

Guidelines:
- summary: Focus on the patient's concern, actions taken by the care guide, and the outcome.
- areasForFollowUp: List specific, actionable items that need follow-up after this call. Be concrete with dates, names, and details from the transcript.
- questionsAndResponses: Extract every distinct question the patient asked and the corresponding response. Include only actual questions, not rhetorical ones.

Call ID: ${callId}

TRANSCRIPT:
${transcript}`;

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

  return parsed as TranscriptAnalysis;
}
