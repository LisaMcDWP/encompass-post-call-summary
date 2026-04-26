import { VertexAI } from "@google-cloud/vertexai";
import type { Observation, EnumValue, ContextParameter, CallQAPrompt, DispositionCategory, DispositionDetail, ActivationObjective, ActivationObjectiveInteractionConfig, ActivationInteraction } from "@shared/schema";

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

export interface QAPair {
  question: string;
  answer: string;
  asked_by: string;
  answered_by: string;
  observation_name: string | null;
  observation_display_name: string | null;
  category: string;
}

export interface Barrier {
  barrier: string;
  context: string;
  category: string;
  severity: string;
  observation_name: string | null;
  observation_display_name: string | null;
  evidence: string | null;
}

export interface CallQAResult {
  name: string;
  display_name: string;
  value: string;
  detail: string;
  evidence: string | null;
}

export interface DispositionResult {
  disposition_category: string;
  disposition_category_display?: string;
  disposition_detail: string;
  disposition_detail_display?: string;
  confidence?: string;
  evidence?: string;
  detail?: string;
}

export interface ActivationObjectiveExtraction {
  objective_name: string;
  interaction_key: string;
  extracted_value: string | null;
  rationale: string;
  evidence: string | null;
}

export interface TranscriptAnalysis {
  summary: string;
  transition_status: string;
  follow_up_areas: string;
  observations: ObservationResult[];
  qa_pairs: QAPair[];
  barriers: Barrier[];
  call_qa: CallQAResult[];
  disposition?: DispositionResult;
  activation_objectives?: ActivationObjectiveExtraction[];
}

export interface ActivationObjectivesContext {
  objectives: ActivationObjective[];
  activeInteractions: ActivationInteraction[];
  callDate: string;
  contextValues?: Record<string, string>;
}

interface ResolvedObjectiveTask {
  objective: ActivationObjective;
  interaction: ActivationInteraction;
  config: ActivationObjectiveInteractionConfig;
  anchorDate: string;
  callDayOffset: number | null;
}

function diffDaysISO(fromDate: string, toDate: string): number | null {
  const a = new Date(fromDate);
  const b = new Date(toDate);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  const aDay = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bDay = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((bDay - aDay) / (24 * 60 * 60 * 1000));
}

export function pickApplicableInteraction(
  obj: ActivationObjective,
  contextValues: Record<string, string> | undefined,
  activeInteractions: ActivationInteraction[],
): { interaction: ActivationInteraction | null; config: ActivationObjectiveInteractionConfig | null } {
  const keyName = obj.interactionContextKey || "interaction_key";
  const value = contextValues?.[keyName];
  if (!value) return { interaction: null, config: null };
  const interaction = activeInteractions.find((i) => i.key === value) || null;
  if (!interaction) return { interaction: null, config: null };
  const config = (obj.interactions || []).find((c) => c.interactionId === interaction.id) || null;
  return { interaction, config };
}

export function resolveObjectiveTasks(ctx: ActivationObjectivesContext | undefined): ResolvedObjectiveTask[] {
  if (!ctx || !ctx.objectives || ctx.objectives.length === 0) return [];
  const tasks: ResolvedObjectiveTask[] = [];
  for (const obj of ctx.objectives) {
    if (!obj.isActive) continue;
    const anchorDate = ctx.contextValues?.[obj.anchorContextKey];
    if (!anchorDate) continue;
    const { interaction, config } = pickApplicableInteraction(obj, ctx.contextValues, ctx.activeInteractions);
    if (!interaction || !config) continue;
    const allowed = (obj.extractedEnumValues || []).filter((v) => v && v.trim());
    if (allowed.length === 0) continue;
    const callDayOffset = diffDaysISO(anchorDate, ctx.callDate);
    tasks.push({ objective: obj, interaction, config, anchorDate, callDayOffset });
  }
  return tasks;
}

function buildActivationObjectivesPromptBlock(tasks: ResolvedObjectiveTask[]): string {
  if (tasks.length === 0) return "";
  const lines = tasks.map((t) => {
    const allowed = (t.objective.extractedEnumValues || [])
      .filter((v) => v && v.trim())
      .map((v) => `"${v}"`)
      .join(", ");
    const guidance = (t.config.promptGuidance || t.objective.promptGuidance || "").trim();
    const guidanceLine = guidance ? ` | Guidance: ${guidance}` : "";
    const dayPart = t.callDayOffset !== null
      ? `Patient is on day ${t.callDayOffset} of a ${t.objective.windowDays}-day window from ${t.objective.anchorContextKey}=${t.anchorDate}.`
      : `Window: ${t.objective.windowDays} days from ${t.objective.anchorContextKey}=${t.anchorDate}.`;
    return `  • objective_name="${t.objective.name}" (${t.objective.displayName}) | interaction_key="${t.interaction.key}" (${t.interaction.name}) | ${dayPart} | Allowed values: ${allowed}, or null if not discussed.${guidanceLine}`;
  });
  return `\n###ACTIVATION OBJECTIVES (${tasks.length} task${tasks.length === 1 ? "" : "s"})
For each task below, decide the patient's current status for that activation objective based ONLY on what was discussed in this call. Choose the single best match from the allowed values for that task, or null if the topic was not discussed in enough detail to assess. Do NOT invent values that are not in the allowed list.
${lines.join("\n")}
`;
}

function buildActivationObjectivesJsonField(tasks: ResolvedObjectiveTask[]): string {
  if (tasks.length === 0) return "";
  return `,
  "activation_objectives": [ <-- EXACTLY ${tasks.length} object(s), one per task in the ACTIVATION OBJECTIVES section above
    {
      "objective_name": "COPY exactly from the task line",
      "interaction_key": "COPY exactly from the task line",
      "extracted_value": "One of the allowed values for this task, or null if not discussed",
      "rationale": "Brief 1-2 sentence explanation grounded in the transcript",
      "evidence": "Direct quote from the transcript supporting the extracted_value, or null if not discussed"
    }
  ]`;
}

function buildActivationObjectivesGuideline(tasks: ResolvedObjectiveTask[]): string {
  if (tasks.length === 0) return "";
  return `\n- activation_objectives: Output EXACTLY ${tasks.length} object(s), one per task in the ACTIVATION OBJECTIVES section. Use the exact objective_name and interaction_key from the task line. extracted_value MUST be one of the allowed values listed for that task, or null. Never substitute or invent values.`;
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

function buildObservationsReferenceTable(obs: Observation[], contextParams?: ContextParameter[], contextValues?: Record<string, string>): string {
  const rows = obs.map((o, idx) => {
    const valuesNote = o.valueType === "enum" && Array.isArray(o.value) && o.value.length > 0
      ? `Allowed values: ${(o.value as EnumValue[]).map(v => `"${v.label}"`).join(", ")}, or null if not discussed`
      : o.valueType === "boolean"
        ? `Allowed values: true, false, or null if not discussed`
        : o.valueType === "number"
          ? `Value: numeric, or null if not discussed`
          : `Value: free text string, or null if not discussed`;
    let guidanceText = o.promptGuidance || "";
    if (guidanceText && contextParams && contextValues) {
      for (const param of contextParams) {
        const placeholder = `{{CONTEXT_${param.name.toUpperCase()}}}`;
        const val = contextValues[param.name] || "N/A";
        guidanceText = guidanceText.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), val);
      }
    }
    let contextHint = "";
    if (contextParams && contextValues) {
      const relevantContext = contextParams
        .filter(p => guidanceText.toLowerCase().includes(p.name.toLowerCase()) || o.name.toLowerCase().includes(p.name.replace(/_ordered$/, '').replace(/_/g, '_')))
        .map(p => `${p.name}="${contextValues[p.name] || "N/A"}"`)
        .filter(s => !s.endsWith('"N/A"'));
      if (relevantContext.length > 0) {
        contextHint = ` | Context: ${relevantContext.join(", ")}`;
      }
    }
    const guidancePart = guidanceText
      ? ` | Evaluation guidance: ${guidanceText}${contextHint}`
      : contextHint || "";
    return `  ${idx + 1}. name="${o.name}" | display_name="${o.displayName}" | domain="${o.domain}" | value_type="${o.valueType}" | ${valuesNote}${guidancePart}`;
  });
  return rows.join("\n");
}

function buildObservationsSchema(obs: Observation[]): string {
  return `    {
      "name": "COPY from reference table",
      "display_name": "COPY from reference table",
      "domain": "COPY from reference table",
      "value_type": "COPY from reference table",
      "value": "The extracted value (use allowed values from reference table, or null if not discussed)",
      "detail": "Brief 1-2 sentence explanation of what was observed. Do NOT copy evaluation guidance.",
      "evidence": "Direct quote from transcript, or null if not discussed",
      "confidence": "high | medium | low | null"
    }`;
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

function buildCallQABlock(callQAPrompts: CallQAPrompt[]): string {
  if (callQAPrompts.length === 0) return "";
  const items = callQAPrompts.map(qa => {
    let responseInstruction = "";
    if (qa.responseType === "enum" && qa.responseOptions.length > 0) {
      responseInstruction = `Choose one of: ${qa.responseOptions.join(", ")}`;
    } else if (qa.responseType === "boolean") {
      responseInstruction = "Answer with 'Yes' or 'No'";
    } else {
      responseInstruction = "Provide a brief text response";
    }
    return `    - name: "${qa.name}", display_name: "${qa.displayName}", prompt: "${qa.promptText}", response_instruction: "${responseInstruction}"`;
  });
  return items.join("\n");
}

export interface DispositionConfig {
  categories: DispositionCategory[];
  details: DispositionDetail[];
}

function buildDispositionBlock(config?: DispositionConfig): string {
  if (!config || config.categories.length === 0) return "";
  const lines: string[] = [];
  for (const cat of config.categories.filter(c => c.isActive).sort((a, b) => a.displayOrder - b.displayOrder)) {
    const catDetails = config.details.filter(d => d.categoryId === cat.id && d.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
    lines.push(`  Category: "${cat.name}" ("${cat.displayName}")${cat.description ? ` — ${cat.description}` : ""}`);
    for (const det of catDetails) {
      lines.push(`    Detail: "${det.name}" ("${det.displayName}")${det.description ? ` — ${det.description}` : ""}`);
    }
  }
  return lines.join("\n");
}

function buildDispositionPromptSection(config?: DispositionConfig): string {
  if (!config || config.categories.length === 0) return "";
  const block = buildDispositionBlock(config);
  return `\n###CALL DISPOSITION TAXONOMY
Classify the overall call outcome using the taxonomy below. Choose exactly ONE category and ONE detail within that category.
${block}
`;
}

function buildDispositionJsonField(config?: DispositionConfig): string {
  if (!config || config.categories.length === 0) return "";
  return `,
  "disposition": {
    "disposition_category": "The category name from the taxonomy (e.g. 'connected', 'no_contact')",
    "disposition_category_display": "The display name of the chosen category",
    "disposition_detail": "The detail name within the category (e.g. 'completed_interaction', 'voicemail_left')",
    "disposition_detail_display": "The display name of the chosen detail",
    "confidence": "high, medium, or low",
    "evidence": "Brief quote or description from the transcript supporting this classification",
    "detail": "One sentence explaining why this disposition was chosen"
  }`;
}

function buildDispositionGuideline(config?: DispositionConfig): string {
  if (!config || config.categories.length === 0) return "";
  return `\n- disposition: Classify the overall call outcome. Choose exactly ONE category and ONE detail from the CALL DISPOSITION TAXONOMY above. Base your choice on observable evidence in the transcript (e.g. was the conversation completed? did the line disconnect? was a voicemail reached?).`;
}

export function buildPromptTemplate(activeObservations: Observation[], summaryInstruction?: string, contextParams?: ContextParameter[], observationsGuidance?: string, barriersGuidance?: string, callQAPrompts?: CallQAPrompt[], contextValues?: Record<string, string>, dispositionConfig?: DispositionConfig, activationContext?: ActivationObjectivesContext): string {
  const instruction = summaryInstruction || DEFAULT_SUMMARY_INSTRUCTION;
  const contextBlock = buildContextBlock(contextParams || []);
  const activationTasks = resolveObjectiveTasks(activationContext);
  const activationBlock = buildActivationObjectivesPromptBlock(activationTasks);
  const activationJsonField = buildActivationObjectivesJsonField(activationTasks);
  const activationGuideline = buildActivationObjectivesGuideline(activationTasks);

  if (activeObservations.length === 0) {
    const resolvedInstruction = instruction.replace("{{SUMMARY_TOPICS}}", "general topics discussed");
    return `You are an expert healthcare call analyst for Guideway Care. Analyze the following patient interaction transcript and produce a structured JSON output.
${contextBlock}${buildDispositionPromptSection(dispositionConfig)}${activationBlock}
Your response MUST be valid JSON with exactly this structure:
{
  "summary": "${resolvedInstruction}",
  "observations": [],
  "transition_status": "<p>No observation topics configured.</p>",
  "follow_up_areas": "<p>No follow-up areas identified.</p>",
  "qa_pairs": [
    {
      "question": "The question that was asked",
      "answer": "The response given",
      "asked_by": "care_guide or patient or caregiver",
      "answered_by": "patient or caregiver or care_guide",
      "observation_name": null,
      "observation_display_name": null,
      "category": "A short category label"
    }
  ],
  "barriers": [
    {
      "barrier": "Short description of the barrier",
      "context": "Full context and details about the barrier — what was said, the circumstances, and any relevant background",
      "category": "Category of barrier (e.g. Transportation, Financial, Medication Access, Social Support, Health Literacy, Language, Housing, Caregiver Burden, Emotional/Mental Health, Physical Limitation, Insurance/Coverage, Other)",
      "severity": "high, medium, or low based on potential impact on patient care",
      "observation_name": null,
      "observation_display_name": null,
      "evidence": "Direct quote from the transcript that reveals this barrier"
    }
  ],
  "call_qa": [${(callQAPrompts || []).length > 0 ? `
    {
      "name": "The prompt name",
      "display_name": "The prompt display name",
      "value": "The evaluated response value",
      "detail": "Brief explanation of why this value was chosen based on the transcript",
      "evidence": "Direct quote from the transcript supporting this evaluation, or null if not applicable"
    }
  ` : ""}]${buildDispositionJsonField(dispositionConfig)}${activationJsonField}
}

Guidelines:
- qa_pairs: Extract EVERY question and answer exchange from the transcript, in chronological order. Include ALL exchanges — greetings, identity verification, clinical questions, scheduling, and any other conversation. Set observation_name and observation_display_name to null (no observations configured). Assign a descriptive category to every Q&A pair.
- barriers: ${barriersGuidance || "Extract ANY barriers to care, recovery, or well-being that the patient or caregiver mentions or that can be identified from the conversation. A barrier is anything that may prevent or hinder the patient from following their care plan, recovering properly, or accessing needed services. Include barriers that are explicitly stated AND those clearly implied. If no barriers are identified, return an empty array. Common barrier categories include: Transportation, Financial, Medication Access, Social Support, Health Literacy, Language, Housing, Caregiver Burden, Emotional/Mental Health, Physical Limitation, Insurance/Coverage. Assign a severity based on potential impact on patient outcomes."} IMPORTANT: Each unique barrier should appear ONLY ONCE. Do NOT list the same barrier multiple times even if it relates to multiple observations. Consolidate related issues into a single barrier entry.${(callQAPrompts || []).length > 0 ? `
- call_qa: For each of the following call experience evaluation prompts, assess the overall call and provide a response:
${buildCallQABlock(callQAPrompts || [])}
  Return one object per prompt with the name, display_name, value (your assessment), detail (brief explanation), and evidence (supporting quote or null).` : `
- call_qa: Return an empty array [].`}${buildDispositionGuideline(dispositionConfig)}
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
  const observationsRefTable = buildObservationsReferenceTable(activeObservations, contextParams, contextValues);
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

###OBSERVATION REFERENCE TABLE (${topicCount} topics — output exactly one JSON object per row, no more, no less)
${observationsRefTable}
${buildDispositionPromptSection(dispositionConfig)}${activationBlock}
Your response MUST be valid JSON with exactly this structure:
{
  "summary": "${resolvedSummaryInstruction}",
  "observations": [ <-- EXACTLY ${topicCount} objects, one per row in the reference table above. Iterate rows 1 through ${topicCount} in order. Each name appears ONCE.
${observationsSchema}
  ],
  "transition_status": "A single HTML string covering ALL ${topicCount} observation topics. This value MUST be a valid JSON string. Do NOT start with a quote character. Use inline styles for color-coded status badges. For enum topics, format as: <b>Topic:</b> <span style='INLINE_STYLE'>ENUM_VALUE</span><br>Detail sentence.<br><br> — where ENUM_VALUE is the actual observation value (e.g. 'Fair', 'No Readmission', 'Picked Up', 'Not Discussed') and INLINE_STYLE is the corresponding color style from the mappings below. NEVER use the color name (GREEN, YELLOW, etc.) as the badge text — always use the enum value. For non-enum topics (text, boolean, number), format as: <b>Topic:</b><br>Detail sentence.<br><br> (no status badge needed). Use these exact inline styles for each status type: ${colorStyles} — Status-to-color mappings (use the inline style that corresponds to the enum value): ${statusMappings}. ALWAYS include all ${topicCount} topics. IMPORTANT: Order the topics so that all discussed topics appear first, and any topics with a 'Not Discussed' status are grouped together at the bottom.",
  "follow_up_areas": "A single HTML string listing follow-up areas. This value MUST be a valid JSON string. Use <ul> and <li> tags with <b> for topic names. Only include items for topics with problems or gaps. If none, use '<p>No follow-up areas identified.</p>'. Example: <ul><li><b>${activeObservations[0]?.displayName || "Topic"}:</b> Detail about the issue.</li></ul>",
  "qa_pairs": [
    {
      "question": "The question that was asked, as stated or closely paraphrased from the transcript",
      "answer": "The response given to the question, as stated or closely paraphrased from the transcript",
      "asked_by": "Who asked the question: 'care_guide' or 'patient' or 'caregiver'",
      "answered_by": "Who answered: 'patient' or 'caregiver' or 'care_guide'",
      "observation_name": "The observation name this Q&A maps to (from the configured observations above), or null if it does not match any configured observation",
      "observation_display_name": "The display name of the matched observation, or null if no match",
      "category": "A short category label for this Q&A (e.g. 'Medication', 'Pain', 'Appointment', 'DME/Supplies', 'Greeting', 'Identity Verification', 'General', etc.)"
    }
  ],
  "barriers": [
    {
      "barrier": "Short description of the barrier",
      "context": "Full context and details about the barrier — what was said, the circumstances, and any relevant background that helps understand the barrier's impact on the patient's care",
      "category": "Category of barrier (e.g. Transportation, Financial, Medication Access, Social Support, Health Literacy, Language, Housing, Caregiver Burden, Emotional/Mental Health, Physical Limitation, Insurance/Coverage, Other)",
      "severity": "high, medium, or low based on potential impact on patient care",
      "observation_name": "The observation name this barrier relates to (from the configured observations above), or null if it does not directly relate to a configured observation",
      "observation_display_name": "The display name of the related observation, or null if no relation",
      "evidence": "Direct quote from the transcript that reveals or supports this barrier"
    }
  ],
  "call_qa": [${(callQAPrompts || []).length > 0 ? `
    {
      "name": "The prompt name",
      "display_name": "The prompt display name",
      "value": "The evaluated response value",
      "detail": "Brief explanation of why this value was chosen based on the transcript",
      "evidence": "Direct quote from the transcript supporting this evaluation, or null if not applicable"
    }
  ` : ""}]${buildDispositionJsonField(dispositionConfig)}${activationJsonField}
}

Guidelines:
- All output must use third person perspective. Use "Patient reports..." when the patient answered directly, or "Patient's [relationship] reports..." when a family member or caregiver answered. Never use first person or second person.
- Present information objectively. Report exactly what was stated without interpretation. Maintain a factual tone without emotional language.
- DO NOT HALLUCINATE OR INFER: Only extract information that was explicitly discussed in the transcript. If a specific topic was not directly asked about or answered in the conversation, you MUST mark it as "Not Discussed" — do NOT infer, assume, or guess a value. A greeting, identity confirmation, or unrelated small talk is NOT evidence for any observation topic. The evidence field must contain a direct quote where the topic was specifically addressed. If you cannot find a direct quote about that specific topic, the topic was "Not Discussed".
- summary: Provide a brief overall summary based on questions asked and the patient's responses. Only comment on what the patient actually responded to. Do not include information the patient did not discuss. Do not summarize topics that were not explicitly asked about.
- observations: EXACTLY ${topicCount} objects — one per row in the OBSERVATION REFERENCE TABLE above. Iterate rows 1 through ${topicCount} in order. Copy name, display_name, domain, value_type exactly from the table. For value: use the extracted value from the transcript (exact enum label for enum types, or null if not discussed). For detail: write your own 1-2 sentence summary of what was observed — do NOT copy evaluation guidance. For evidence: direct quote, or null if not discussed. For confidence: high/medium/low/null. If a topic was not discussed, set value="Not Discussed", detail="Not discussed.", evidence=null, confidence=null. NEVER output the same observation name twice.${observationsGuidance ? `\n- GENERAL OBSERVATIONS GUIDANCE: ${observationsGuidance}` : ""}
- transition_status: A single HTML string with EXACTLY ${topicCount} topics — each appears ONCE, no duplicates. Detail text must be original. Use inline style attributes with single quotes for badges (e.g. style='display:inline-block;padding:1px 8px;...'). Badge text = actual enum value, NEVER the color name. Discussed topics first, "Not Discussed" grouped at bottom.
- follow_up_areas: Return a single HTML string as a valid JSON string value. Use <ul>/<li> with <b> for topic names. Use single quotes for any HTML attributes. Only include items with issues. If none, return "<p>No follow-up areas identified.</p>".
- qa_pairs: Extract EVERY question and answer exchange from the transcript, in chronological order. Include ALL exchanges — greetings, identity verification, clinical questions, scheduling, and any other conversation. Each entry should capture the question asked, the answer given, who asked it, and who answered it. Try to match each Q&A to the closest configured observation topic if applicable, setting observation_name and observation_display_name. If a Q&A does not match any configured observation, set those fields to null and still include it. Assign a descriptive category to every Q&A pair. Do not skip any exchanges.
- barriers: ${barriersGuidance || "Extract ANY barriers to care, recovery, or well-being that the patient or caregiver mentions or that can be identified from the conversation. A barrier is anything that may prevent or hinder the patient from following their care plan, recovering properly, or accessing needed services — such as transportation issues, financial hardship, lack of social support, difficulty understanding instructions, medication access problems, housing instability, caregiver burden, emotional/mental health challenges, physical limitations, or insurance/coverage gaps. Include barriers that are explicitly stated AND those clearly implied from the conversation. Try to link each barrier to the most relevant configured observation if applicable. If no barriers are identified, return an empty array []. Assign a severity (high/medium/low) based on the potential impact on the patient's care outcomes."} IMPORTANT: Each unique barrier should appear ONLY ONCE. Do NOT list the same barrier multiple times even if it relates to multiple observations. Consolidate related issues into a single barrier entry.${(callQAPrompts || []).length > 0 ? `
- call_qa: For each of the following call experience evaluation prompts, assess the overall call and provide a response:
${buildCallQABlock(callQAPrompts || [])}
  Return one object per prompt with the name, display_name, value (your assessment), detail (brief explanation), and evidence (supporting quote or null).` : `
- call_qa: Return an empty array [].`}${buildDispositionGuideline(dispositionConfig)}${activationGuideline}
Source ID: {{SOURCE_ID}}

SOURCE TEXT:
{{SOURCE_TEXT}}`;
}

function deduplicateBarriers(barriers: any[]): any[] {
  const seen = new Set<string>();
  return barriers.filter(item => {
    const key = (item.barrier || "").trim().toLowerCase();
    if (!key) return true;
    if (seen.has(key)) {
      console.warn(`[DEDUP] Removed duplicate barrier: "${item.barrier}"`);
      return false;
    }
    seen.add(key);
    return true;
  });
}

function deduplicateByName(items: any[]): any[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.name;
    if (seen.has(key)) {
      console.warn(`[DEDUP] Removed duplicate item: "${key}"`);
      return false;
    }
    seen.add(key);
    return true;
  });
}

function deduplicateTransitionStatus(html: string): string {
  if (!html || typeof html !== "string") return html;

  const topicBlocks = html.split(/<br\s*\/?>\s*<br\s*\/?>/i);
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const block of topicBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const topicMatch = trimmed.match(/<b>([^<]+):?\s*<\/b>/i);
    const topicName = topicMatch ? topicMatch[1].trim().toLowerCase() : null;

    if (topicName && seen.has(topicName)) {
      console.warn(`[DEDUP] Removed duplicate transition_status topic: "${topicMatch![1].trim()}"`);
      continue;
    }

    if (topicName) seen.add(topicName);
    unique.push(trimmed);
  }

  return unique.join("<br><br>") + (unique.length > 0 ? "<br><br>" : "");
}

function buildGeminiModel() {
  const vertex = getVertexAI();
  return vertex.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });
}

function resolvePrompt(template: string, sourceId: string, sourceText: string, contextParams?: ContextParameter[], contextValues?: Record<string, string>): string {
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
  return prompt;
}

function extractTokenUsage(response: any) {
  const usageMetadata = response.usageMetadata;
  const promptTokens = usageMetadata?.promptTokenCount || 0;
  const completionTokens = usageMetadata?.candidatesTokenCount || 0;
  const totalTokens = usageMetadata?.totalTokenCount || 0;
  const estimatedCost = (promptTokens * 0.15 / 1_000_000) + (completionTokens * 0.60 / 1_000_000);
  return { promptTokens, completionTokens, totalTokens, estimatedCost };
}

function parseGeminiResponse(response: any): any {
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini model");
  try {
    return JSON.parse(text);
  } catch (parseError) {
    console.error("Gemini returned invalid JSON:", text.substring(0, 500));
    throw new Error("Gemini model returned invalid JSON. Please try again.");
  }
}

export async function analyzeTranscript(
  sourceId: string,
  sourceText: string,
  activeObservations: Observation[],
  customPrompt?: string,
  summaryInstruction?: string,
  contextParams?: ContextParameter[],
  contextValues?: Record<string, string>,
  observationsGuidance?: string,
  barriersGuidance?: string,
  callQAPrompts?: CallQAPrompt[],
  dispositionConfig?: DispositionConfig,
  activationContext?: ActivationObjectivesContext,
): Promise<{ analysis: TranscriptAnalysis; promptUsed: string; tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number; estimatedCost: number } }> {
  const model = buildGeminiModel();
  const template = customPrompt || buildPromptTemplate(activeObservations, summaryInstruction, contextParams, observationsGuidance, barriersGuidance, callQAPrompts, contextValues, dispositionConfig, activationContext);
  const prompt = resolvePrompt(template, sourceId, sourceText, contextParams, contextValues);

  const result = await model.generateContent(prompt);
  const response = result.response;
  const tokenUsage = extractTokenUsage(response);
  const parsed = parseGeminiResponse(response);

  if (!parsed.summary || !parsed.transition_status || !parsed.follow_up_areas) {
    console.error("Gemini returned unexpected structure:", JSON.stringify(parsed).substring(0, 500));
    throw new Error("Gemini response missing required fields. Please try again.");
  }
  if (!Array.isArray(parsed.observations)) parsed.observations = [];
  if (!Array.isArray(parsed.qa_pairs)) parsed.qa_pairs = [];
  if (!Array.isArray(parsed.barriers)) parsed.barriers = [];
  if (!Array.isArray(parsed.call_qa)) parsed.call_qa = [];
  if (!Array.isArray(parsed.activation_objectives)) parsed.activation_objectives = [];

  parsed.observations = deduplicateByName(parsed.observations);
  parsed.call_qa = deduplicateByName(parsed.call_qa);
  parsed.barriers = deduplicateBarriers(parsed.barriers);
  if (parsed.transition_status) {
    parsed.transition_status = deduplicateTransitionStatus(parsed.transition_status);
  }

  return { analysis: parsed as TranscriptAnalysis, promptUsed: prompt, tokenUsage };
}

export function buildFastPromptTemplate(activeObservations: Observation[], summaryInstruction?: string, contextParams?: ContextParameter[], observationsGuidance?: string, barriersGuidance?: string, contextValues?: Record<string, string>, dispositionConfig?: DispositionConfig, activationContext?: ActivationObjectivesContext): string {
  const instruction = summaryInstruction || DEFAULT_SUMMARY_INSTRUCTION;
  const contextBlock = buildContextBlock(contextParams || []);
  const topicCount = activeObservations.length;
  const statusMappings = buildStatusMappings(activeObservations);
  const summaryTopics = buildSummaryTopics(activeObservations);
  const colorStyles = buildColorStylesBlock();
  const observationsSchema = buildObservationsSchema(activeObservations);
  const observationsRefTable = buildObservationsReferenceTable(activeObservations, contextParams, contextValues);
  const resolvedSummaryInstruction = instruction.replace("{{SUMMARY_TOPICS}}", summaryTopics || "general topics discussed");
  const activationTasks = resolveObjectiveTasks(activationContext);
  const activationBlock = buildActivationObjectivesPromptBlock(activationTasks);
  const activationJsonField = buildActivationObjectivesJsonField(activationTasks);
  const activationGuideline = buildActivationObjectivesGuideline(activationTasks);

  if (activeObservations.length === 0) {
    return `You are an expert healthcare call analyst for Guideway Care. Analyze the following patient interaction transcript and produce a structured JSON output.
${contextBlock}${buildDispositionPromptSection(dispositionConfig)}${activationBlock}
Your response MUST be valid JSON with exactly this structure:
{
  "summary": "${resolvedSummaryInstruction}",
  "observations": [],
  "transition_status": "<p>No observation topics configured.</p>",
  "follow_up_areas": "<p>No follow-up areas identified.</p>"${buildDispositionJsonField(dispositionConfig)}${activationJsonField}
}

Guidelines:
- summary: Brief overall summary based on questions asked and patient's responses.${buildDispositionGuideline(dispositionConfig)}${activationGuideline}
Source ID: {{SOURCE_ID}}

SOURCE TEXT:
{{SOURCE_TEXT}}`;
  }

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

###OBSERVATION REFERENCE TABLE (${topicCount} topics — output exactly one JSON object per row, no more, no less)
${observationsRefTable}

###CRITICAL RULE — NO DUPLICATES
The observations array MUST contain EXACTLY ${topicCount} objects. Iterate through the reference table rows 1 to ${topicCount} in order. Output ONE object per row. If you have already output an observation name, do NOT output it again. Each name appears exactly once.
${buildDispositionPromptSection(dispositionConfig)}${activationBlock}
Your response MUST be valid JSON with exactly this structure:
{
  "summary": "${resolvedSummaryInstruction}",
  "observations": [ <-- EXACTLY ${topicCount} objects, one per row in the reference table. Each name appears ONCE.
${observationsSchema}
  ],
  "transition_status": "A single HTML string covering ALL ${topicCount} observation topics — each topic appears ONCE, no duplicates. Use inline styles for color-coded status badges. For enum topics: <b>Topic:</b> <span style='INLINE_STYLE'>ENUM_VALUE</span><br>Detail.<br><br>. Use these styles: ${colorStyles} — Mappings: ${statusMappings}. Order discussed topics first, 'Not Discussed' at the bottom.",
  "follow_up_areas": "A single HTML string listing follow-up areas. Use <ul>/<li> with <b> for topic names. Only include items with issues. If none, use '<p>No follow-up areas identified.</p>'."${buildDispositionJsonField(dispositionConfig)}${activationJsonField}
}

Guidelines:
- All output must use third person perspective.
- DO NOT HALLUCINATE OR INFER: Only extract information explicitly discussed. Mark undiscussed topics as "Not Discussed".
- summary: Brief overall summary based on questions asked and patient's responses.
- observations: EXACTLY ${topicCount} objects — one per row in the reference table. Copy name, display_name, domain, value_type from the table. Use evaluation guidance to choose value — do NOT copy guidance text into detail.${observationsGuidance ? `\n- GENERAL OBSERVATIONS GUIDANCE: ${observationsGuidance}` : ""}
- transition_status: EXACTLY ${topicCount} topics in the HTML — one per observation, no duplicates. Detail text MUST be original.
- follow_up_areas: Return a single HTML string.${buildDispositionGuideline(dispositionConfig)}${activationGuideline}
Source ID: {{SOURCE_ID}}

SOURCE TEXT:
{{SOURCE_TEXT}}`;
}

export function buildBackgroundPromptTemplate(activeObservations: Observation[], callQAPrompts?: CallQAPrompt[], barriersGuidance?: string): string {
  const obsNames = activeObservations.map(o => `"${o.name}" ("${o.displayName}")`).join(", ");

  return `You are an expert healthcare call analyst. Analyze the following transcript and extract detailed Q&A pairs, barriers to care, and call quality evaluation.

Your response MUST be valid JSON with exactly this structure:
{
  "qa_pairs": [
    {
      "question": "The question that was asked",
      "answer": "The response given",
      "asked_by": "care_guide or patient or caregiver",
      "answered_by": "patient or caregiver or care_guide",
      "observation_name": "Matching observation name or null",
      "observation_display_name": "Matching observation display name or null",
      "category": "A short category label"
    }
  ],
  "barriers": [
    {
      "barrier": "Short description of the barrier",
      "context": "Full context and details about the barrier — what was said, the circumstances, and any relevant background that helps understand the barrier's impact on the patient's care",
      "category": "Category of barrier (e.g. Transportation, Financial, Medication Access, Social Support, Health Literacy, Language, Housing, Caregiver Burden, Emotional/Mental Health, Physical Limitation, Insurance/Coverage, Other)",
      "severity": "high, medium, or low based on potential impact on patient care",
      "observation_name": "The observation name this barrier relates to (from configured observations), or null",
      "observation_display_name": "The display name of the related observation, or null",
      "evidence": "Direct quote from the transcript that reveals or supports this barrier"
    }
  ],
  "call_qa": [${(callQAPrompts || []).length > 0 ? `
    {
      "name": "The prompt name",
      "display_name": "The prompt display name",
      "value": "The evaluated response value",
      "detail": "Brief explanation",
      "evidence": "Supporting quote or null"
    }
  ` : ""}]
}

Guidelines:
- qa_pairs: Extract EVERY question and answer exchange from the transcript, in chronological order. Include ALL exchanges. Try to match each Q&A to configured observations: ${obsNames || "none configured"}. Set observation_name/display_name to null if no match. Assign a descriptive category.
- barriers: ${barriersGuidance || "Extract ANY barriers to care, recovery, or well-being that the patient or caregiver mentions or that can be identified from the conversation. Include barriers that are explicitly stated AND those clearly implied. If no barriers are identified, return an empty array []. Assign a severity (high/medium/low) based on potential impact on patient outcomes."} IMPORTANT: Each unique barrier should appear ONLY ONCE. Do NOT list the same barrier multiple times. Consolidate related issues into a single barrier entry.${(callQAPrompts || []).length > 0 ? `
- call_qa: For each prompt, assess the overall call:
${buildCallQABlock(callQAPrompts || [])}
  Return one object per prompt.` : `
- call_qa: Return an empty array [].`}
Source ID: {{SOURCE_ID}}

SOURCE TEXT:
{{SOURCE_TEXT}}`;
}

export async function analyzeTranscriptFast(
  sourceId: string,
  sourceText: string,
  activeObservations: Observation[],
  summaryInstruction?: string,
  contextParams?: ContextParameter[],
  contextValues?: Record<string, string>,
  observationsGuidance?: string,
  dispositionConfig?: DispositionConfig,
  activationContext?: ActivationObjectivesContext,
): Promise<{ analysis: Partial<TranscriptAnalysis>; tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number; estimatedCost: number } }> {
  const model = buildGeminiModel();
  const template = buildFastPromptTemplate(activeObservations, summaryInstruction, contextParams, observationsGuidance, undefined, contextValues, dispositionConfig, activationContext);
  const prompt = resolvePrompt(template, sourceId, sourceText, contextParams, contextValues);

  console.log(`[FAST] Starting Gemini call for ${sourceId}`);
  const result = await model.generateContent(prompt);
  const response = result.response;
  const tokenUsage = extractTokenUsage(response);
  const parsed = parseGeminiResponse(response);
  console.log(`[FAST] Gemini completed for ${sourceId} in ${tokenUsage.totalTokens} tokens`);

  if (!parsed.summary || !parsed.transition_status || !parsed.follow_up_areas) {
    throw new Error("Fast Gemini response missing required fields.");
  }
  if (!Array.isArray(parsed.observations)) parsed.observations = [];
  if (!Array.isArray(parsed.activation_objectives)) parsed.activation_objectives = [];

  parsed.observations = deduplicateByName(parsed.observations);
  if (parsed.transition_status) {
    parsed.transition_status = deduplicateTransitionStatus(parsed.transition_status);
  }

  return { analysis: parsed, tokenUsage };
}

export async function analyzeTranscriptBackground(
  sourceId: string,
  sourceText: string,
  activeObservations: Observation[],
  callQAPrompts?: CallQAPrompt[],
  barriersGuidance?: string,
): Promise<{ qa_pairs: QAPair[]; barriers: Barrier[]; call_qa: CallQAResult[]; tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number; estimatedCost: number } }> {
  const model = buildGeminiModel();
  const template = buildBackgroundPromptTemplate(activeObservations, callQAPrompts, barriersGuidance);
  const prompt = resolvePrompt(template, sourceId, sourceText);

  console.log(`[BACKGROUND] Starting Gemini call for ${sourceId}`);
  const result = await model.generateContent(prompt);
  const response = result.response;
  const tokenUsage = extractTokenUsage(response);
  const parsed = parseGeminiResponse(response);
  console.log(`[BACKGROUND] Gemini completed for ${sourceId} in ${tokenUsage.totalTokens} tokens`);

  if (!Array.isArray(parsed.qa_pairs)) parsed.qa_pairs = [];
  if (!Array.isArray(parsed.barriers)) parsed.barriers = [];
  if (!Array.isArray(parsed.call_qa)) parsed.call_qa = [];

  parsed.call_qa = deduplicateByName(parsed.call_qa);
  parsed.barriers = deduplicateBarriers(parsed.barriers);

  return { qa_pairs: parsed.qa_pairs, barriers: parsed.barriers, call_qa: parsed.call_qa, tokenUsage };
}

export async function aiObservationAssistant(
  currentObservations: Observation[],
  userMessage: string,
  conversationHistory: { role: string; text: string }[] = []
): Promise<string> {
  const ai = getVertexAI();
  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

  const obsSnapshot = currentObservations.map(o => ({
    name: o.name,
    displayName: o.displayName,
    description: o.description,
    domain: o.domain,
    valueType: o.valueType,
    value: o.value,
    isActive: o.isActive,
    promptGuidance: o.promptGuidance,
  }));

  const systemPrompt = `You are an AI assistant helping a healthcare operations team configure observation topics for a post-call analysis system.

The system uses these observations to analyze patient call transcripts via Gemini AI. Each observation has:
- name (snake_case key)
- displayName (human-readable)
- description (what it measures)
- domain (clinical, medication, appointment, equipment, discharge, experience, general)
- valueType (enum, boolean, text, number)
- value (for enum type: array of {label, color} where color is GREEN/YELLOW/RED/BLUE/GRAY)
- isActive (whether it's included in analysis)
- promptGuidance (extra instructions for Gemini on how to evaluate this observation)

Current observations configured:
${JSON.stringify(obsSnapshot, null, 2)}

Your role:
1. Help suggest new observation topics relevant to post-discharge care transitions
2. Improve existing observation descriptions and prompt guidance
3. Suggest better enum values and color mappings
4. Provide examples of what good prompt guidance looks like
5. Recommend which observations might be missing based on healthcare best practices

When suggesting a new observation or changes, format them clearly so the user can copy the values. Use this format for new observations:
**Name:** snake_case_name
**Display Name:** Human Readable Name
**Description:** What this observation measures
**Domain:** category
**Value Type:** enum
**Values:** Good (GREEN), Fair (YELLOW), Poor (RED), Not Discussed (GRAY)
**Prompt Guidance:** Specific instructions for the AI...

Be concise, practical, and focused on post-discharge patient care transitions. Keep responses short and actionable.`;

  const contents: any[] = [];

  contents.push({ role: "user", parts: [{ text: systemPrompt + "\n\nUser: " + (conversationHistory.length === 0 ? userMessage : conversationHistory[0]?.text || userMessage) }] });

  if (conversationHistory.length > 0) {
    for (let i = 0; i < conversationHistory.length; i++) {
      const msg = conversationHistory[i];
      if (i === 0) continue;
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.text }],
      });
    }
    contents.push({ role: "user", parts: [{ text: userMessage }] });
  }

  const result = await model.generateContent({ contents });
  const response = result.response;
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
  return text;
}
