import type {
  ActivationObjective,
  ActivationObjectiveTouchpoint,
  ActivationObjectiveThreshold,
  ActivationObjectiveStage,
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

function pickTouchpointForObjective(
  obj: ActivationObjective,
  callDate: string,
  contextValues: Record<string, string>,
): { touchpoint: ActivationObjectiveTouchpoint | null; anchorDate: string | null } {
  const anchorRaw = contextValues[obj.anchorContextKey];
  if (!anchorRaw) return { touchpoint: null, anchorDate: null };
  const callDay = diffDaysISO(anchorRaw, callDate);
  if (callDay === null) return { touchpoint: null, anchorDate: anchorRaw };
  const tps = (obj.touchpoints || []).filter(tp => (tp.extractedEnumValues || []).some(v => v && v.trim()));
  if (tps.length === 0) return { touchpoint: null, anchorDate: anchorRaw };
  let best: ActivationObjectiveTouchpoint | null = null;
  let bestDist = Infinity;
  for (const tp of tps) {
    const d = Math.abs(tp.expectedDayOffset - callDay);
    if (d < bestDist) {
      bestDist = d;
      best = tp;
    }
  }
  return { touchpoint: best, anchorDate: anchorRaw };
}

export function computeActivationObjectiveResults(args: {
  callId: string;
  callDate: string;
  contextValues: Record<string, string>;
  objectives: ActivationObjective[];
  extractions: ActivationObjectiveExtraction[];
  processedAt: string;
}): CallActivationObjectiveResult[] {
  const { callId, callDate, contextValues, objectives, extractions, processedAt } = args;
  const results: CallActivationObjectiveResult[] = [];

  const extByKey = new Map<string, ActivationObjectiveExtraction>();
  for (const ex of extractions || []) {
    if (!ex || !ex.objective_name) continue;
    extByKey.set(`${ex.objective_name}::${ex.touchpoint_id || ""}`, ex);
  }

  for (const obj of objectives) {
    if (!obj.isActive) continue;
    const { touchpoint, anchorDate } = pickTouchpointForObjective(obj, callDate, contextValues);

    if (!anchorDate) {
      results.push(makeIneligibleResult(callId, callDate, obj, null, processedAt, `No anchor date provided (missing context key "${obj.anchorContextKey}")`));
      continue;
    }
    if (!touchpoint) {
      results.push(makeIneligibleResult(callId, callDate, obj, anchorDate, processedAt, "No applicable touchpoint with allowed extracted values"));
      continue;
    }

    const targetDate = addDaysISO(anchorDate, obj.windowDays);
    const daysRemaining = targetDate ? diffDaysISO(callDate, targetDate) : null;
    const band = daysRemaining !== null ? pickBand(obj.thresholds || [], daysRemaining) : null;
    const ext = extByKey.get(`${obj.name}::${touchpoint.id}`) || extByKey.get(`${obj.name}::`) || null;
    const extractedValue = ext?.extracted_value && ext.extracted_value.trim() ? ext.extracted_value.trim() : null;

    let currentStage: ActivationObjectiveStage | null = null;
    if (extractedValue) {
      const mapping = (touchpoint.stageMappings || []).find(m => m.extractedValue === extractedValue);
      if (mapping) {
        currentStage = (obj.stages || []).find(s => s.id === mapping.stageId) || null;
      }
    }

    let onTrack: boolean | null = null;
    let onTrackStatus = "unknown";

    if (extractedValue === null) {
      onTrack = null;
      onTrackStatus = "not_assessed";
    } else if (touchpoint.canResolveObjective && currentStage && obj.achievedStageId && currentStage.id === obj.achievedStageId) {
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
      touchpointId: touchpoint.id,
      touchpointName: touchpoint.name,
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
): CallActivationObjectiveResult {
  return {
    callId,
    objectiveId: obj.id,
    objectiveName: obj.name,
    touchpointId: "",
    touchpointName: "",
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
