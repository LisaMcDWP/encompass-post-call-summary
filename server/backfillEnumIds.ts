import { BigQuery } from "@google-cloud/bigquery";
import { storage } from "./storage";
import { genEnumValueId, type Observation } from "@shared/schema";

const DATASET_ID = "call_information";
const OBSERVATIONS_TABLE = "observations";
const CONTEXT_PARAMS_TABLE = "context_parameters";
const ACTIVATION_OBJECTIVES_TABLE = "activation_objectives";

function getClient(): BigQuery {
  const projectId = process.env.GCP_PROJECT_ID;
  const raw = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GCP_SERVICE_ACCOUNT_KEY is not set");
  const credentials = JSON.parse(raw);
  return new BigQuery({ projectId, credentials });
}

function rawArray(json: any): any[] {
  if (typeof json !== "string" || !json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function itemsLackIds(items: any[]): boolean {
  if (items.length === 0) return false;
  return items.some((it) => {
    if (typeof it === "string") return true;
    if (it && typeof it === "object") return !it.id || typeof it.id !== "string";
    return true;
  });
}

function mappingsLackValueIds(mappings: any[], allowedLabels: Set<string>): boolean {
  return mappings.some((m) => {
    if (!m || typeof m !== "object") return false;
    if (m.valueId && typeof m.valueId === "string") return false;
    const label = typeof m.extractedValue === "string" ? m.extractedValue.toLowerCase() : "";
    return allowedLabels.has(label);
  });
}

export async function backfillEnumValueIds(): Promise<void> {
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) return;
  const client = getClient();

  let cps: { id: number }[] = [];
  try {
    cps = await storage.getClientPathways();
  } catch (err) {
    console.warn("[backfill] Could not list client pathways, skipping:", err);
    return;
  }
  if (cps.length === 0) return;

  let obsFixed = 0;
  let ctxFixed = 0;
  let objFixed = 0;

  for (const cp of cps) {
    // ---- Observations ----
    try {
      const [obsRows] = await client.query({
        query: `SELECT id, value FROM \`${projectId}.${DATASET_ID}.${OBSERVATIONS_TABLE}\` WHERE client_pathway_id = @cpId`,
        params: { cpId: cp.id },
      });
      for (const row of obsRows as any[]) {
        const items = rawArray(row.value);
        if (!itemsLackIds(items)) continue;
        const observation = await storage.getObservation(row.id, cp.id);
        if (!observation) continue;
        await storage.updateObservation(row.id, { value: observation.value as any }, cp.id);
        obsFixed++;
      }
    } catch (err) {
      console.warn(`[backfill] observations CP ${cp.id}:`, (err as Error).message);
    }

    // ---- Context parameters ----
    try {
      const [cpRows] = await client.query({
        query: `SELECT id, enum_values FROM \`${projectId}.${DATASET_ID}.${CONTEXT_PARAMS_TABLE}\` WHERE client_pathway_id = @cpId`,
        params: { cpId: cp.id },
      });
      for (const row of cpRows as any[]) {
        const items = rawArray(row.enum_values);
        if (!itemsLackIds(items)) continue;
        const param = await storage.getContextParameter(row.id, cp.id);
        if (!param) continue;
        await storage.updateContextParameter(row.id, { enumValues: param.enumValues as any }, cp.id);
        ctxFixed++;
      }
    } catch (err) {
      console.warn(`[backfill] context_parameters CP ${cp.id}:`, (err as Error).message);
    }

    // ---- Activation objective stage_mappings ----
    try {
      const observations = await storage.getObservations(cp.id);
      const obsByName = new Map<string, Observation>();
      for (const o of observations) obsByName.set(o.name, o);

      const [aoRows] = await client.query({
        query: `SELECT id, observation_name, stage_mappings FROM \`${projectId}.${DATASET_ID}.${ACTIVATION_OBJECTIVES_TABLE}\` WHERE client_pathway_id = @cpId`,
        params: { cpId: cp.id },
      });

      for (const row of aoRows as any[]) {
        const obs = obsByName.get(row.observation_name);
        if (!obs || !Array.isArray(obs.value)) continue;
        const enumValues = obs.value as Array<{ id: string; label: string }>;
        const labelToId = new Map<string, string>();
        for (const ev of enumValues) {
          if (ev && ev.label) labelToId.set(ev.label.toLowerCase(), ev.id);
        }
        const allowed = new Set(labelToId.keys());

        const rawMappings = rawArray(row.stage_mappings);
        if (!mappingsLackValueIds(rawMappings, allowed)) continue;

        const updated = rawMappings.map((m: any) => {
          if (!m || typeof m !== "object") return m;
          if (m.valueId && typeof m.valueId === "string") return m;
          const label = typeof m.extractedValue === "string" ? m.extractedValue.toLowerCase() : "";
          const valueId = labelToId.get(label);
          return valueId ? { ...m, valueId } : m;
        });

        await storage.updateActivationObjective(
          row.id,
          { stageMappings: updated as any },
          cp.id,
        );
        objFixed++;
      }
    } catch (err) {
      console.warn(`[backfill] activation_objectives CP ${cp.id}:`, (err as Error).message);
    }
  }

  if (obsFixed || ctxFixed || objFixed) {
    console.log(
      `[backfill] enum-value ids persisted: observations=${obsFixed}, context_parameters=${ctxFixed}, activation_objectives=${objFixed}`,
    );
  } else {
    console.log("[backfill] enum-value ids: nothing to backfill.");
  }
}
