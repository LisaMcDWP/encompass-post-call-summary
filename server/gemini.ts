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
  // Stable id of the matched enum value on the observation definition. Resolved
  // server-side after parsing by matching `value` (label) against the linked
  // observation's enum values. Null for non-enum types or when no match found.
  value_id: string | null;
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

export interface ActivationObjectiveObservationExtraction {
  topic_name: string;
  value: string | null;
  detail: string | null;
  evidence: string | null;
}

export interface ActivationObjectiveExtraction {
  objective_name: string;
  interaction_key: string;
  extracted_value: string | null;
  // Stable id of the matched enum value on the linked observation. Resolved
  // server-side after parsing. Null when no match (e.g. legacy or new label).
  extracted_value_id?: string | null;
  rationale: string;
  evidence: string | null;
  observations?: ActivationObjectiveObservationExtraction[];
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
  observations?: Observation[];
  callDate: string;
  contextValues?: Record<string, string>;
}

interface ResolvedObjectiveTask {
  objective: ActivationObjective;
  linkedObservation: Observation | null;
  interaction: ActivationInteraction | null;
  config: ActivationObjectiveInteractionConfig | null;
  anchorDate: string | null;
  callDayOffset: number | null;
  observationTopics: Observation[];
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

  // 1. Try exact match by key from request context.
  if (value) {
    const interaction = activeInteractions.find((i) => i.key === value) || null;
    if (interaction) {
      const config = (obj.interactions || []).find((c) => c.interactionId === interaction.id) || null;
      if (config) return { interaction, config };
      // Known key but not configured for this objective — fall through to default.
    }
  }

  // 2. Fall back to the objective's default interaction (if marked).
  const defaultConfig = (obj.interactions || []).find((c) => c.isDefault) || null;
  if (defaultConfig) {
    const defaultInteraction = activeInteractions.find((i) => i.id === defaultConfig.interactionId) || null;
    if (defaultInteraction) return { interaction: defaultInteraction, config: defaultConfig };
  }

  return { interaction: null, config: null };
}

export function resolveObjectiveTasks(ctx: ActivationObjectivesContext | undefined): ResolvedObjectiveTask[] {
  if (!ctx || !ctx.objectives || ctx.objectives.length === 0) return [];
  const tasks: ResolvedObjectiveTask[] = [];
  const obsById = new Map<number, Observation>();
  const obsByName = new Map<string, Observation>();
  for (const o of ctx.observations || []) {
    if (!o || !o.isActive) continue;
    obsById.set(o.id, o);
    if (o.name) obsByName.set(o.name, o);
  }
  for (const obj of ctx.objectives) {
    if (!obj.isActive) continue;

    // Rule: every active objective is extracted on every call. Anchor date and
    // interaction routing are both OPTIONAL — they only refine context.
    const anchorDate = ctx.contextValues?.[obj.anchorContextKey] ?? null;
    const callDayOffset = anchorDate ? diffDaysISO(anchorDate, ctx.callDate) : null;
    const { interaction, config } = pickApplicableInteraction(obj, ctx.contextValues, ctx.activeInteractions);

    // Topics extracted = union of objective-level topics + every interaction
    // config's topics (so we get the full observation set regardless of
    // whether a specific interaction was matched).
    const allTopicIds = new Set<number>();
    for (const id of obj.observationTopicIds || []) allTopicIds.add(id);
    for (const cfg of obj.interactions || []) {
      for (const id of cfg.observationTopicIds || []) allTopicIds.add(id);
    }
    const observationTopics = Array.from(allTopicIds)
      .map((id) => obsById.get(id))
      .filter((o): o is Observation => !!o);

    // Linked observation drives the extracted_value choice. Look it up by name.
    const linkedObservation = (obj.observationName && obsByName.get(obj.observationName)) || null;
    const linkedAllowed = linkedObservation && linkedObservation.valueType === "enum" && Array.isArray(linkedObservation.value)
      ? (linkedObservation.value as EnumValue[]).map((v) => v?.label || "").filter((v) => v && v.trim())
      : [];

    // Skip the objective only when there's literally nothing to extract:
    // no linked-observation values AND no observation topics.
    if (linkedAllowed.length === 0 && observationTopics.length === 0) continue;

    tasks.push({ objective: obj, linkedObservation, interaction, config, anchorDate, callDayOffset, observationTopics });
  }
  return tasks;
}

function buildActivationObjectivesPromptBlock(tasks: ResolvedObjectiveTask[]): string {
  if (tasks.length === 0) return "";
  const lines = tasks.map((t) => {
    // Pull enum values + per-value hints + top-level guidance from the LINKED
    // observation (single source of truth). Per-interaction promptGuidance
    // (override) still wins if set on the matched interaction config.
    const linkedValues = (t.linkedObservation && t.linkedObservation.valueType === "enum" && Array.isArray(t.linkedObservation.value))
      ? (t.linkedObservation.value as EnumValue[]).filter(v => v?.label && v.label.trim())
      : [];
    const allowed = linkedValues.map(v => `"${v.label}"`).join(", ");
    const hintLines = linkedValues
      .filter(v => (v.promptHint || "").trim())
      .map(v => `      - "${v.label}": ${v.promptHint!.trim()}`);
    const hintsBlock = hintLines.length > 0
      ? `\n    Value hints:\n${hintLines.join("\n")}`
      : "";
    const guidance = ((t.config?.promptGuidance) || (t.linkedObservation?.promptGuidance) || "").trim();
    const guidanceLine = guidance ? ` | Guidance: ${guidance}` : "";
    const dayPart = t.anchorDate && t.callDayOffset !== null
      ? `Patient is on day ${t.callDayOffset} of a ${t.objective.windowDays}-day window from ${t.objective.anchorContextKey}=${t.anchorDate}.`
      : t.anchorDate
        ? `Window: ${t.objective.windowDays} days from ${t.objective.anchorContextKey}=${t.anchorDate}.`
        : `Anchor date (${t.objective.anchorContextKey}) not provided in request context — assess based on call content alone.`;
    const interactionPart = t.interaction
      ? `interaction_key="${t.interaction.key}" (${t.interaction.name})`
      : `interaction_key="" (no specific interaction routed — assess from call content)`;
    const obsBlock = t.observationTopics.length > 0
      ? `\n    Observation topics for this objective (output one entry per topic in the observations array):\n` +
        t.observationTopics.map((o) => {
          const allowedVals = o.valueType === "enum" && Array.isArray(o.value) && o.value.length > 0
            ? `Allowed values: ${(o.value as EnumValue[]).map(v => `"${v.label}"`).join(", ")}, or null if not discussed`
            : o.valueType === "boolean"
              ? `Allowed values: true, false, or null if not discussed`
              : `Free-text value, or null if not discussed`;
          const hint = (o.promptGuidance || "").trim() ? ` | Hint: ${o.promptGuidance.trim()}` : "";
          return `      - topic_name="${o.name}" (${o.displayName}) — ${allowedVals}.${hint}`;
        }).join("\n")
      : "";
    const allowedPart = allowed
      ? `Allowed values: ${allowed}, or null if not discussed.`
      : `extracted_value MUST be null (no enum values configured for this objective).`;
    return `  • objective_name="${t.objective.name}" (${t.objective.displayName}) | ${interactionPart} | ${dayPart} | ${allowedPart}${guidanceLine}${hintsBlock}${obsBlock}`;
  });
  return `\n###ACTIVATION OBJECTIVES (${tasks.length} task${tasks.length === 1 ? "" : "s"})
For each task below, decide the patient's current status for that activation objective based ONLY on what was discussed in this call. Choose the single best match from the allowed values for that task. Use "Not discussed" when the topic was never raised in the conversation. Use null only when the topic was raised but you cannot determine status from what was said. Do NOT invent values that are not in the allowed list. For tasks that list observation topics, also extract a value for each listed topic into the per-objective observations array — copy the topic_name exactly.
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
      "extracted_value": "One of the allowed values for this task. Use \"Not discussed\" if the topic was never raised; use null only if it was raised but the answer is indeterminate.",
      "rationale": "Brief 1-2 sentence explanation grounded in the transcript",
      "evidence": "Direct quote from the transcript supporting the extracted_value, or null if no quote applies",
      "observations": [ <-- one entry per observation topic listed for this task, OR an empty array if none were listed
        {
          "topic_name": "COPY exactly from the topic_name in the task line",
          "value": "One of the allowed values for that topic, or null if not discussed",
          "detail": "Brief 1-2 sentence summary of what was observed for this topic. Do NOT copy the topic hint. Use null if not discussed.",
          "evidence": "Direct quote from the transcript supporting the value, or null"
        }
      ]
    }
  ]`;
}

function buildActivationObjectivesGuideline(tasks: ResolvedObjectiveTask[]): string {
  if (tasks.length === 0) return "";
  const obsCount = tasks.reduce((sum, t) => sum + t.observationTopics.length, 0);
  const obsLine = obsCount > 0
    ? ` For each task that lists observation topics, also output one entry per topic in that task's observations array — copy topic_name exactly and pick value from that topic's allowed values, or null if not discussed. For each topic also write a 1-2 sentence detail summarizing what was observed (do NOT copy the topic hint), or null if the topic was not discussed.`
    : "";
  return `\n- activation_objectives: Output EXACTLY ${tasks.length} object(s), one per task in the ACTIVATION OBJECTIVES section. Use the exact objective_name and interaction_key from the task line. extracted_value MUST be one of the allowed values listed for that task. Use "Not discussed" when the topic was never raised in the call. Use null only when the topic was raised but the answer is indeterminate. Copy the value verbatim from the allowed list — match the casing, spelling, and spacing exactly. Never substitute or invent values.${obsLine}`;
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
      ? ` [Allowed values: ${p.enumValues.map(v => v.label).join(", ")}]`
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

function stripHiddenFromTransitionStatus(html: string, activeObservations: Observation[]): string {
  if (!html || typeof html !== "string") return html;
  const hiddenNames = new Set(
    activeObservations
      .filter(o => o.hideFromFormattedView === true)
      .map(o => o.displayName.trim().toLowerCase()),
  );
  if (hiddenNames.size === 0) return html;

  const topicBlocks = html.split(/<br\s*\/?>\s*<br\s*\/?>/i);
  const kept: string[] = [];

  for (const block of topicBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const topicMatch = trimmed.match(/<b>([^<]+?):?\s*<\/b>/i);
    let topicName = topicMatch ? topicMatch[1].trim().toLowerCase() : null;

    // Fallback: if no <b>Topic</b> header, scan the leading plain text of the
    // block for any hidden display name. This protects against malformed HTML
    // from the model that would otherwise leak a hidden topic.
    if (!topicName) {
      const head = trimmed.replace(/<[^>]+>/g, " ").slice(0, 120).toLowerCase();
      for (const hidden of hiddenNames) {
        if (head.includes(hidden)) {
          topicName = hidden;
          break;
        }
      }
    }

    if (topicName && hiddenNames.has(topicName)) {
      const label = topicMatch ? topicMatch[1].trim() : topicName;
      console.log(`[HIDE_FORMATTED] Removed hidden topic from transition_status: "${label}"`);
      continue;
    }
    kept.push(trimmed);
  }

  return kept.join("<br><br>") + (kept.length > 0 ? "<br><br>" : "");
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

// Resolve `value_id` on each observation row by matching its label against the
// linked observation definition's enum values. Idempotent — only fills nulls.
// Display labels can change over time; the id is the stable concept identity.
function resolveObservationValueIds(
  observations: any[],
  defs: Observation[],
): void {
  if (!Array.isArray(observations) || observations.length === 0) return;
  const defByName = new Map(defs.map(d => [d.name, d]));
  for (const obs of observations) {
    if (!obs || typeof obs !== "object") continue;
    if (obs.value_id) continue;
    obs.value_id = null;
    const def = defByName.get(obs.name);
    if (!def || def.valueType !== "enum" || !Array.isArray(def.value)) continue;
    if (typeof obs.value !== "string" || !obs.value) continue;
    const target = obs.value.trim().toLowerCase();
    const match = def.value.find((v: any) => typeof v?.label === "string" && v.label.trim().toLowerCase() === target);
    if (match && match.id) obs.value_id = match.id;
  }
}

// Resolve `extracted_value_id` on each activation objective extraction by
// matching its `extracted_value` label against the linked observation's enum
// values (looked up via objective.observationName).
function resolveActivationExtractedValueIds(
  extractions: any[],
  objectives: ActivationObjective[],
  observationDefs: Observation[],
): void {
  if (!Array.isArray(extractions) || extractions.length === 0) return;
  const objByName = new Map(objectives.map(o => [o.name, o]));
  const obsByName = new Map(observationDefs.map(d => [d.name, d]));
  for (const ext of extractions) {
    if (!ext || typeof ext !== "object") continue;
    if (ext.extracted_value_id) continue;
    ext.extracted_value_id = null;
    if (typeof ext.extracted_value !== "string" || !ext.extracted_value) continue;
    const obj = objByName.get(ext.objective_name);
    if (!obj || !obj.observationName) continue;
    const def = obsByName.get(obj.observationName);
    if (!def || def.valueType !== "enum" || !Array.isArray(def.value)) continue;
    const target = ext.extracted_value.trim().toLowerCase();
    const match = def.value.find((v: any) => typeof v?.label === "string" && v.label.trim().toLowerCase() === target);
    if (match && match.id) ext.extracted_value_id = match.id;
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
  resolveObservationValueIds(parsed.observations, activeObservations);
  if (activationContext?.objectives) {
    resolveActivationExtractedValueIds(parsed.activation_objectives, activationContext.objectives, activeObservations);
  }
  if (parsed.transition_status) {
    parsed.transition_status = deduplicateTransitionStatus(parsed.transition_status);
    parsed.transition_status = stripHiddenFromTransitionStatus(parsed.transition_status, activeObservations);
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
  resolveObservationValueIds(parsed.observations, activeObservations);
  if (activationContext?.objectives) {
    resolveActivationExtractedValueIds(parsed.activation_objectives, activationContext.objectives, activeObservations);
  }
  if (parsed.transition_status) {
    parsed.transition_status = deduplicateTransitionStatus(parsed.transition_status);
    parsed.transition_status = stripHiddenFromTransitionStatus(parsed.transition_status, activeObservations);
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

export async function aiActivationObjectiveAssistant(
  context: {
    objectives: ActivationObjective[];
    observations: Observation[];
    interactions: ActivationInteraction[];
    contextParameters: ContextParameter[];
    currentDraft?: any;
  },
  userMessage: string,
  conversationHistory: { role: string; text: string }[] = []
): Promise<string> {
  const ai = getVertexAI();
  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

  const objectivesSnapshot = context.objectives.map(o => ({
    name: o.name,
    displayName: o.displayName,
    description: o.description,
    anchorEventType: o.anchorEventType,
    anchorContextKey: o.anchorContextKey,
    windowDays: o.windowDays,
    stages: (o.stages || []).map(s => ({ name: s.name, displayName: s.displayName, description: s.description, order: s.order })),
    observationName: o.observationName,
    stageMappings: o.stageMappings,
    observationTopicIds: o.observationTopicIds,
    isActive: o.isActive,
  }));

  const observationsSnapshot = context.observations.map(o => ({
    id: o.id,
    name: o.name,
    displayName: o.displayName,
    valueType: o.valueType,
    value: o.value,
    promptGuidance: o.promptGuidance,
    isActive: o.isActive,
  }));

  const interactionsSnapshot = context.interactions.map(i => ({
    id: i.id,
    key: i.key,
    name: i.name,
    description: i.description,
    expectedDayOffset: i.expectedDayOffset,
    isActive: i.isActive,
  }));

  const contextParamsSnapshot = context.contextParameters.map(p => ({
    name: p.name,
    displayName: p.displayName,
    dataType: p.dataType,
  }));

  const systemPrompt = `You are an AI assistant helping a healthcare operations team configure activation objectives for a post-call analytics system.

Activation objectives are program-level goals tied to a patient anchor event (e.g. discharge). Each objective has:
- name (snake_case key) and displayName (human-readable)
- description
- anchorEventType (discharge | enrollment | procedure | custom) and anchorContextKey (the date field used to anchor the timeline)
- windowDays (target completion window from the anchor)
- stages (ordered progress stages: name, displayName, description, order). Outcomes are assigned per (band × stage) cell elsewhere — there is no single "achieved" stage
- observationName: the LINKED observation in the catalogue. Its enum values, per-value promptHints, and promptGuidance ARE the objective's value set — the objective does NOT have its own copy.
- stageMappings: array of {extractedValue, stageId} that maps a linked-observation enum label to a stage
- observationTopicIds: ids of OTHER observations from the catalogue this objective also extracts on every call
- isActive

Current activation objectives configured:
${JSON.stringify(objectivesSnapshot, null, 2)}

Available observations in the catalogue (each has its own enum values + per-value promptHints + promptGuidance — point objectives at one of these by name):
${JSON.stringify(observationsSnapshot, null, 2)}

Available activation interactions (touchpoints):
${JSON.stringify(interactionsSnapshot, null, 2)}

Available context parameters (anchorContextKey usually points at a date field):
${JSON.stringify(contextParamsSnapshot, null, 2)}
${context.currentDraft ? `

The user is currently editing this objective draft. Treat questions as requests to ENHANCE or refine THIS draft unless they explicitly ask for something new.

CRITICAL FOR ENHANCEMENT MODE: When responding with the structured block, INCLUDE ONLY the fields you are actually changing. OMIT any field that should stay the same. Do not echo unchanged fields — the parser merges only what you include, so emitting unchanged fields can overwrite related state (like stage ids). For example, if the user asks "improve the description", emit only **Description:** in the block.

Current draft being edited:
${JSON.stringify(context.currentDraft, null, 2)}` : ""}

Your role:
1. Suggest new activation objectives relevant to post-discharge/care-transition programs
2. Improve descriptions, stage names, and stage mappings on existing objectives
3. Recommend better anchor events / window days based on clinical best practice
4. Recommend WHICH observation in the catalogue should drive the objective (set Observation Name to one of the available observations)
5. Flag missing or weak mappings between the linked observation's enum values and stages

When proposing a new objective OR an enhancement to the current draft, ALWAYS format it as the structured block below — never as JSON, YAML, or a code block. The user has an automated parser that only understands this exact format. Output one block per proposal, English values only:
**Name:** snake_case_name
**Display Name:** Human Readable Name
**Description:** What this objective measures
**Anchor Event:** discharge | enrollment | procedure | custom
**Anchor Context Key:** name_of_date_field
**Window Days:** 7
**Observation Name:** name_of_observation_from_catalogue
**Stages:** stage_one | Display One; stage_two | Display Two; stage_three | Display Three
**Stage Mappings:** Value A -> stage_three; Value B -> stage_two; Value C -> stage_one

Notes on **Observation Name**:
- Pick a name from the "Available observations in the catalogue" list above. The objective inherits that observation's enum values, per-value promptHints, and promptGuidance.
- If no existing observation fits, tell the user to create one first in the Observations page — do NOT invent a new name here.

Notes on **Stage Mappings**:
- The values on the LEFT must match enum value labels from the linked observation exactly (case + spacing)
- The values on the RIGHT must be one of the stage names defined in **Stages**
- Separate mappings with semicolons ";"
- Do NOT propose **Extracted Values** or **Prompt Guidance** for the objective — those live on the linked observation now.

Be concise, practical, and grounded in the user's existing setup. Keep responses short and actionable.`;

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
