import { VertexAI } from "@google-cloud/vertexai";
import type { Observation, EnumValue, ContextParameter } from "@shared/schema";

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

export interface ObservationResult {
  name: string;
  display_name: string;
  domain: string;
  value_type: string;
  value: string | null;
  detail: string;
  evidence: string | null;
  confidence: string | null;
}

export interface TranscriptAnalysis {
  summary: string;
  transition_status: string;
  follow_up_areas: string;
  observations: ObservationResult[];
}

const COLOR_STYLES: Record<string, string> = {
  GREEN: "display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;",
  YELLOW: "display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#fef9c3;color:#854d0e;border:1px solid #fde68a;",
  RED: "display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#fee2e2;color:#991b1b;border:1px solid #fecaca;",
  BLUE: "display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe;",
  GRAY: "display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb;",
};

function buildColorStylesBlock(): string {
  return Object.entries(COLOR_STYLES)
    .map(([name, style]) => `${name} = style='${style}'`)
    .join(" — ");
}

function buildStatusMappings(obs: Observation[]): string {
  const enumObs = obs.filter(o => o.valueType === "enum" && Array.isArray(o.value) && o.value.length > 0);
  return enumObs
    .map(o => {
      const mappings = (o.value as EnumValue[])
        .map(v => `${v.label}=${v.color}`)
        .join(", ");
      return `${o.displayName} (${mappings})`;
    })
    .join(", ");
}

function buildSummaryTopics(obs: Observation[]): string {
  return obs
    .map(o => o.displayName.toLowerCase())
    .join("; ");
}

function buildObservationsSchema(obs: Observation[]): string {
  const entries = obs.map(o => {
    const valuesNote = o.valueType === "enum" && Array.isArray(o.value) && o.value.length > 0
      ? `One of: ${(o.value as EnumValue[]).map(v => `"${v.label}"`).join(", ")}, or null if not discussed`
      : o.valueType === "boolean"
        ? `true, false, or null if not discussed`
        : o.valueType === "number"
          ? `Numeric value, or null if not discussed`
          : `Free text string, or null if not discussed`;
    const detailNote = o.promptGuidance
      ? o.promptGuidance
      : "Brief explanation of what was observed";
    return `    { "name": "${o.name}", "display_name": "${o.displayName}", "domain": "${o.domain}", "value_type": "${o.valueType}", "value": "${valuesNote}", "detail": "${detailNote}", "evidence": "Direct quote or specific reference from the transcript that supports this observation value. Use null if the topic was not discussed.", "confidence": "One of: high, medium, low — how confident the analysis is based on the clarity and directness of the transcript evidence" }`;
  });
  return entries.join(",\n");
}

export const DEFAULT_SUMMARY_INSTRUCTION = "A brief overall summary of the call based on the questions asked of the patient and their responses. If the patient answered the call, include the following topics at a minimum (only comment on what the patient actually responded to): {{SUMMARY_TOPICS}}.";

function buildContextBlock(contextParams: ContextParameter[]): string {
  if (contextParams.length === 0) return "";

  const lines = contextParams.map(p => {
    const req = "(optional)";
    const enumHint = p.dataType === "enum" && p.enumValues && p.enumValues.length > 0
      ? ` [Allowed values: ${p.enumValues.join(", ")}]`
      : "";
    return `- ${p.displayName} (${p.name}): {{CONTEXT_${p.name.toUpperCase()}}} ${req}${enumHint}`;
  });

  return `\n###KNOWN CONTEXT\nThe following context information has been provided about this interaction. Use it to enrich your analysis where relevant. If a value is empty or "N/A", treat it as not provided.\n${lines.join("\n")}

IMPORTANT CONTEXT RULES:
- Context values provide factual background about what was ordered for this patient. Use them to determine the correct observation value when a topic was not discussed in the call.
- If a context value indicates something was NOT ordered (e.g. home_health_ordered = "false" or dme_or_supplies_ordered = "false") and the topic was not discussed in the transcript, use "Not Ordered" or "Not applicable" as the observation value — because we know from context it was never ordered, so it is correct that it was not asked about.
- If a context value indicates something WAS ordered (e.g. home_health_ordered = "true" or dme_or_supplies_ordered = "true") but the topic was NOT discussed in the transcript, use "Not Discussed" — this represents a gap because the care guide should have asked about it. Flag this in follow_up_areas.
- If no context value is provided for a topic and it was not discussed, use "Not Discussed".
`;
}

export function buildPromptTemplate(activeObservations: Observation[], summaryInstruction?: string, contextParams?: ContextParameter[], observationsGuidance?: string): string {
  const instruction = summaryInstruction || DEFAULT_SUMMARY_INSTRUCTION;
  const contextBlock = buildContextBlock(contextParams || []);

  if (activeObservations.length === 0) {
    const resolvedInstruction = instruction.replace("{{SUMMARY_TOPICS}}", "general topics discussed");
    return `You are an expert healthcare call analyst for Guideway Care. Analyze the following patient interaction transcript and produce a structured JSON output.
${contextBlock}
Your response MUST be valid JSON with exactly this structure:
{
  "summary": "${resolvedInstruction}",
  "observations": [],
  "transition_status": "<p>No observation topics configured.</p>",
  "follow_up_areas": "<p>No follow-up areas identified.</p>"
}
Source ID: {{SOURCE_ID}}

SOURCE TEXT:
{{SOURCE_TEXT}}`;
  }

  const topicCount = activeObservations.length;
  const enumObs = activeObservations.filter(o => o.valueType === "enum");
  const statusMappings = buildStatusMappings(activeObservations);
  const summaryTopics = buildSummaryTopics(activeObservations);
  const colorStyles = buildColorStylesBlock();
  const observationsSchema = buildObservationsSchema(activeObservations);
  const resolvedSummaryInstruction = instruction.replace("{{SUMMARY_TOPICS}}", summaryTopics);

  return `You are an expert healthcare call analyst for Guideway Care. Analyze the following patient interaction transcript and produce a structured JSON output.
${contextBlock}
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
  "summary": "${resolvedSummaryInstruction}",
  "observations": [
${observationsSchema}
  ],
  "transition_status": "A single HTML string covering ALL ${topicCount} observation topics. This value MUST be a valid JSON string. Do NOT start with a quote character. Use inline styles for color-coded status badges. For enum topics, format as: <b>Topic:</b> <span style='INLINE_STYLE'>ENUM_VALUE</span><br>Detail sentence.<br><br> — where ENUM_VALUE is the actual observation value (e.g. 'Fair', 'No Readmission', 'Picked Up', 'Not Discussed') and INLINE_STYLE is the corresponding color style from the mappings below. NEVER use the color name (GREEN, YELLOW, etc.) as the badge text — always use the enum value. For non-enum topics (text, boolean, number), format as: <b>Topic:</b><br>Detail sentence.<br><br> (no status badge needed). Use these exact inline styles for each status type: ${colorStyles} — Status-to-color mappings (use the inline style that corresponds to the enum value): ${statusMappings}. ALWAYS include all ${topicCount} topics. IMPORTANT: Order the topics so that all discussed topics appear first, and any topics with a 'Not Discussed' status are grouped together at the bottom.",
  "follow_up_areas": "A single HTML string listing follow-up areas. This value MUST be a valid JSON string. Use <ul> and <li> tags with <b> for topic names. Only include items for topics with problems or gaps. If none, use '<p>No follow-up areas identified.</p>'. Example: <ul><li><b>${activeObservations[0]?.displayName || "Topic"}:</b> Detail about the issue.</li></ul>"
}

Guidelines:
- All output must use third person perspective. Use "Patient reports..." when the patient answered directly, or "Patient's [relationship] reports..." when a family member or caregiver answered. Never use first person or second person.
- Present information objectively. Report exactly what was stated without interpretation. Maintain a factual tone without emotional language.
- summary: Provide a brief overall summary based on questions asked and the patient's responses. Only comment on what the patient actually responded to. Do not include information the patient did not discuss.
- observations: Return an array with exactly ${topicCount} objects, one for each observation topic. Each object must have: name (the key), display_name, domain, value_type, value (the extracted value from the transcript — use the exact label for enum types, or null if not discussed), detail (a brief sentence explaining what was observed), evidence (a direct quote or specific reference from the transcript that supports the value — use null if the topic was not discussed), and confidence (one of "high", "medium", or "low" based on how clear and direct the transcript evidence is — use "high" when the patient explicitly stated something, "medium" when it was implied, "low" when inferred from limited information, or null if not discussed). Preserve the name, display_name, domain, and value_type exactly as specified above.${observationsGuidance ? `\n- GENERAL OBSERVATIONS GUIDANCE: ${observationsGuidance}` : ""}
- transition_status: Return a single HTML string as a valid JSON string value. Do NOT start the string with a quote or any character before the first <b> tag. Use inline style attributes with single quotes for color-coded status badges (e.g. style='display:inline-block;padding:1px 8px;...'). Use <b> for topic labels, <span style='...'> for colored status badges, and <br> for line breaks. The text inside each <span> badge MUST be the actual enum value chosen for that observation (e.g. "Fair", "Picked Up", "Not Discussed") — NEVER use the color name (GREEN, YELLOW, RED, etc.) as badge text. Include all ${topicCount} topics. The entire value must be a properly quoted JSON string. The first character of the string content must be the opening < of the first <b> tag. IMPORTANT: List all discussed topics first, then group any "Not Discussed" topics together at the bottom of the output.
- follow_up_areas: Return a single HTML string as a valid JSON string value. Use <ul>/<li> with <b> for topic names. Use single quotes for any HTML attributes. Only include items with issues. If none, return "<p>No follow-up areas identified.</p>".
Source ID: {{SOURCE_ID}}

SOURCE TEXT:
{{SOURCE_TEXT}}`;
}

export async function analyzeTranscript(
  sourceId: string,
  sourceText: string,
  activeObservations: Observation[],
  customPrompt?: string,
  summaryInstruction?: string,
  contextParams?: ContextParameter[],
  contextValues?: Record<string, string>,
  observationsGuidance?: string
): Promise<{ analysis: TranscriptAnalysis; promptUsed: string; tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number; estimatedCost: number } }> {
  const vertex = getVertexAI();

  const model = vertex.getGenerativeModel({
    model: "gemini-2.0-flash-001",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const template = customPrompt || buildPromptTemplate(activeObservations, summaryInstruction, contextParams, observationsGuidance);
  let prompt = template
    .replace("{{SOURCE_ID}}", sourceId)
    .replace("{{SOURCE_TEXT}}", sourceText);

  if (contextParams && contextValues) {
    for (const param of contextParams) {
      const placeholder = `{{CONTEXT_${param.name.toUpperCase()}}}`;
      const val = contextValues[param.name] || "N/A";
      prompt = prompt.replace(placeholder, val);
    }
  }

  const result = await model.generateContent(prompt);
  const response = result.response;

  const usageMetadata = response.usageMetadata;
  const promptTokens = usageMetadata?.promptTokenCount || 0;
  const completionTokens = usageMetadata?.candidatesTokenCount || 0;
  const totalTokens = usageMetadata?.totalTokenCount || 0;
  const estimatedCost = (promptTokens * 0.10 / 1_000_000) + (completionTokens * 0.40 / 1_000_000);

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

  if (!Array.isArray(parsed.observations)) {
    parsed.observations = [];
  }

  return {
    analysis: parsed as TranscriptAnalysis,
    promptUsed: prompt,
    tokenUsage: { promptTokens, completionTokens, totalTokens, estimatedCost },
  };
}
