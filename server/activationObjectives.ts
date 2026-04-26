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
  for (const t of thresholds) {
    const minOk = t.daysRemainingMin === null || t.daysRemainingMin === undefined || daysRemaining >= t.daysRemainingMin;
    const maxOk = t.daysRemainingMax === null || t.daysRemainingMax === undefined || daysRemaining <= t.daysRemainingMax;
    if (minOk && maxOk) return t;
  }
  return null;
}

/**
 * Resolves which interaction this call represents for a given objective by reading
 * `obj.interactionContextKey` from contextValues. The value should match an interaction
 * `key` in the active interactions list. Returns the matching interaction along with
 * the per-objective config row (if any) and the interaction lookup data.
 */
export function pickInteractionForObjective(
  obj: ActivationObjective,
  contextValues: Record<string, string>,
  activeInteractions: ActivationInteraction[],
): {
  interaction: ActivationInteraction | null;
  config: ActivationObjectiveInteractionConfig | null;
  interactionKeyValue: string | null;
} {
  const keyName = obj.interactionContextKey || "interaction_key";
  const interactionKeyValue = contextValues[keyName] ?? null;
  if (!interactionKeyValue) return { interaction: null, config: null, interactionKeyValue: null };

  const interaction = activeInteractions.find((i) => i.key === interactionKeyValue) || null;
  if (!interaction) return { interaction: null, config: null, interactionKeyValue };

  const config = (obj.interactions || []).find((c) => c.interactionId === interaction.id) || null;
  return { interaction, config, interactionKeyValue };
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

    const anchorDate = contextValues[obj.anchorContextKey] ?? null;
    if (!anchorDate) {
      results.push(makeIneligibleResult(callId, callDate, obj, null, processedAt, `No anchor date provided (missing context key "${obj.anchorContextKey}")`));
      continue;
    }

    const { interaction, config, interactionKeyValue } = pickInteractionForObjective(obj, contextValues, activeInteractions);

    if (!interactionKeyValue) {
      results.push(makeIneligibleResult(callId, callDate, obj, anchorDate, processedAt, `No interaction key in context (missing key "${obj.interactionContextKey || "interaction_key"}")`));
      continue;
    }
    if (!interaction) {
      results.push(makeIneligibleResult(callId, callDate, obj, anchorDate, processedAt, `Unknown interaction key "${interactionKeyValue}" (no active interaction with this key)`));
      continue;
    }
    if (!config) {
      results.push(makeIneligibleResult(callId, callDate, obj, anchorDate, processedAt, `Interaction "${interaction.key}" is not configured for this objective`, interaction));
      continue;
    }

    const targetDate = addDaysISO(anchorDate, obj.windowDays);
    const daysRemaining = targetDate ? diffDaysISO(callDate, targetDate) : null;
    const band = daysRemaining !== null ? pickBand(obj.thresholds || [], daysRemaining) : null;
    const ext = extByKey.get(`${obj.name}::${interaction.key}`) || extByKey.get(`${obj.name}::`) || null;
    const extractedValue = ext?.extracted_value && ext.extracted_value.trim() ? ext.extracted_value.trim() : null;

    let currentStage: ActivationObjectiveStage | null = null;
    if (extractedValue) {
      const mapping = (config.stageMappings || []).find((m) => m.extractedValue === extractedValue);
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
