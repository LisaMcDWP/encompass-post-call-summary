import type {
  ActivationObjective,
  ActivationObjectiveInteractionConfig,
  ActivationObjectiveThreshold,
  ActivationObjectiveStage,
  ActivationInteraction,
  CallActivationObjectiveResult,
} from "@shared/schema";
import type { ActivationObjectiveExtraction } from "./gemini";

function diffDaysISO(fromDate: string, toDate: string): number | null {
  const a = new Date(fromDate);
  const b = new Date(toDate);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  const aDay = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bDay = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((bDay - aDay) / (24 * 60 * 60 * 1000));
}

function addDaysISO(baseISO: string, days: number): string | null {
  const d = new Date(baseISO);
  if (isNaN(d.getTime())) return null;
  const utcMidnight = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() + days);
  return utcMidnight.toISOString().slice(0, 10);
}

function pickBand(
  thresholds: ActivationObjectiveThreshold[],
  daysRemaining: number,
): ActivationObjectiveThreshold | null {
  // Day-bound bands first; the "default" band is a fallback used only when
  // no day-bound band matches.
  let defaultBand: ActivationObjectiveThreshold | null = null;
  for (const t of thresholds) {
    if (t.bandLabel === "default") {
      defaultBand = t;
      continue;
    }
    const minOk = t.daysRemainingMin === null || t.daysRemainingMin === undefined || daysRemaining >= t.daysRemainingMin;
    const maxOk = t.daysRemainingMax === null || t.daysRemainingMax === undefined || daysRemaining <= t.daysRemainingMax;
    if (minOk && maxOk) return t;
  }
  return defaultBand;
}

function findDefaultBand(thresholds: ActivationObjectiveThreshold[]): ActivationObjectiveThreshold | null {
  return (thresholds || []).find((t) => t.bandLabel === "default") || null;
}

/**
 * Resolves which interaction this call represents for a given objective by reading
 * `obj.interactionContextKey` from contextValues. The value should match an interaction
 * `key` in the active interactions list. Returns the matching interaction along with
 * the per-objective config row (if any) and the interaction lookup data.
 */
/**
 * Reason codes describing how interaction selection resolved (or failed).
 *
 *   ok                  — exact key match or default fallback succeeded.
 *   missing_key         — no interaction key in request context and no default.
 *   unknown_key         — key present but no active interaction has that key, and no default.
 *   not_configured      — key matched an active interaction, but it's not in obj.interactions, and no default.
 *   default_broken      — a default config is set but its interactionId no longer resolves to an active interaction.
 */
export type InteractionPickReason =
  | "ok"
  | "missing_key"
  | "unknown_key"
  | "not_configured"
  | "default_broken";

export function pickInteractionForObjective(
  obj: ActivationObjective,
  contextValues: Record<string, string>,
  activeInteractions: ActivationInteraction[],
): {
  interaction: ActivationInteraction | null;
  config: ActivationObjectiveInteractionConfig | null;
  interactionKeyValue: string | null;
  reason: InteractionPickReason;
} {
  const keyName = obj.interactionContextKey || "interaction_key";
  const interactionKeyValue = contextValues[keyName] ?? null;

  // 1. Try exact match by key from request context.
  let exactReason: Exclude<InteractionPickReason, "ok" | "default_broken"> = "missing_key";
  if (interactionKeyValue) {
    const interaction = activeInteractions.find((i) => i.key === interactionKeyValue) || null;
    if (!interaction) {
      exactReason = "unknown_key";
    } else {
      const config = (obj.interactions || []).find((c) => c.interactionId === interaction.id) || null;
      if (config) return { interaction, config, interactionKeyValue, reason: "ok" };
      exactReason = "not_configured";
    }
  }

  // 2. Fall back to the objective's default interaction (if marked).
  const defaultConfig = (obj.interactions || []).find((c) => c.isDefault) || null;
  if (defaultConfig) {
    const defaultInteraction = activeInteractions.find((i) => i.id === defaultConfig.interactionId) || null;
    if (defaultInteraction) {
      return { interaction: defaultInteraction, config: defaultConfig, interactionKeyValue, reason: "ok" };
    }
    // Default exists but its interaction is deleted/inactive.
    return { interaction: null, config: null, interactionKeyValue, reason: "default_broken" };
  }

  return { interaction: null, config: null, interactionKeyValue, reason: exactReason };
}

export function computeActivationObjectiveResults(args: {
  callId: string;
  callDate: string;
  contextValues: Record<string, string>;
  objectives: ActivationObjective[];
  activeInteractions: ActivationInteraction[];
  extractions: ActivationObjectiveExtraction[];
  processedAt: string;
}): CallActivationObjectiveResult[] {
  const { callId, callDate, contextValues, objectives, activeInteractions, extractions, processedAt } = args;
  const results: CallActivationObjectiveResult[] = [];

  const extByKey = new Map<string, ActivationObjectiveExtraction>();
  for (const ex of extractions || []) {
    if (!ex || !ex.objective_name) continue;
    extByKey.set(`${ex.objective_name}::${ex.interaction_key || ""}`, ex);
  }

  for (const obj of objectives) {
    if (!obj.isActive) continue;

    // Anchor date is OPTIONAL: if missing, we still extract & stage-map but skip
    // window/threshold math. Only the time-based on-track band becomes unknown.
    const anchorDate = contextValues[obj.anchorContextKey] ?? null;

    const { interaction, config, interactionKeyValue, reason: pickReason } = pickInteractionForObjective(obj, contextValues, activeInteractions);

    if (!interaction || !config) {
      const keyName = obj.interactionContextKey || "interaction_key";
      let reason: string;
      switch (pickReason) {
        case "missing_key":
          reason = `No interaction key in context (missing key "${keyName}") and no default interaction configured for this objective`;
          break;
        case "unknown_key":
          reason = `Unknown interaction key "${interactionKeyValue}" (no active interaction with this key) and no default interaction configured for this objective`;
          break;
        case "not_configured":
          reason = `Interaction key "${interactionKeyValue}" is not configured for this objective and no default interaction is set`;
          break;
        case "default_broken":
          reason = `Default interaction for this objective references an interaction that no longer exists or is inactive`;
          break;
        default:
          reason = `Could not resolve an interaction for this objective`;
      }
      results.push(makeIneligibleResult(callId, callDate, obj, anchorDate, processedAt, reason, interaction));
      continue;
    }

    const targetDate = anchorDate ? addDaysISO(anchorDate, obj.windowDays) : null;
    const daysRemaining = anchorDate && targetDate ? diffDaysISO(callDate, targetDate) : null;
    // When daysRemaining is unknown (no anchor), still use the default band if configured.
    const band = daysRemaining !== null
      ? pickBand(obj.thresholds || [], daysRemaining)
      : findDefaultBand(obj.thresholds || []);
    const ext = extByKey.get(`${obj.name}::${interaction.key}`) || extByKey.get(`${obj.name}::`) || null;
    const extractedValue = ext?.extracted_value && ext.extracted_value.trim() ? ext.extracted_value.trim() : null;

    let currentStage: ActivationObjectiveStage | null = null;
    if (extractedValue) {
      const mapping = (obj.stageMappings || []).find((m) => m.extractedValue === extractedValue);
      if (mapping) {
        currentStage = (obj.stages || []).find((s) => s.id === mapping.stageId) || null;
      }
    }

    let onTrack: boolean | null = null;
    let onTrackStatus = "unknown";

    if (extractedValue === null) {
      onTrack = null;
      onTrackStatus = "not_assessed";
    } else if (config.canResolveObjective && currentStage && obj.achievedStageId && currentStage.id === obj.achievedStageId) {
      onTrack = true;
      onTrackStatus = "achieved";
    } else if (band && currentStage) {
      const inOnTrackSet = (band.onTrackStageIds || []).includes(currentStage.id);
      onTrack = inOnTrackSet;
      onTrackStatus = inOnTrackSet ? (band.satisfiedLabel || "On track") : (band.unsatisfiedLabel || "At risk");
    } else if (currentStage) {
      onTrack = null;
      onTrackStatus = "no_band_match";
    } else {
      onTrack = null;
      onTrackStatus = "unmapped_value";
    }

    results.push({
      callId,
      objectiveId: obj.id,
      objectiveName: obj.name,
      interactionId: interaction.id,
      interactionKey: interaction.key,
      interactionName: interaction.name,
      callDate,
      anchorEventDate: anchorDate,
      targetDate,
      daysRemaining,
      bandLabel: band?.bandLabel ?? null,
      extractedValue,
      currentStageId: currentStage?.id ?? null,
      currentStageName: currentStage?.displayName ?? null,
      onTrack,
      onTrackStatus,
      isEligible: true,
      exclusionReason: "",
      rationale: ext?.rationale || "",
      processedAt,
    });
  }

  return results;
}

function makeIneligibleResult(
  callId: string,
  callDate: string,
  obj: ActivationObjective,
  anchorDate: string | null,
  processedAt: string,
  reason: string,
  interaction?: ActivationInteraction | null,
): CallActivationObjectiveResult {
  return {
    callId,
    objectiveId: obj.id,
    objectiveName: obj.name,
    interactionId: interaction?.id ?? null,
    interactionKey: interaction?.key ?? "",
    interactionName: interaction?.name ?? "",
    callDate,
    anchorEventDate: anchorDate,
    targetDate: null,
    daysRemaining: null,
    bandLabel: null,
    extractedValue: null,
    currentStageId: null,
    currentStageName: null,
    onTrack: null,
    onTrackStatus: "ineligible",
    isEligible: false,
    exclusionReason: reason,
    rationale: "",
    processedAt,
  };
}
