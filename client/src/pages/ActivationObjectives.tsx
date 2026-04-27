import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, X, Save, Loader2, Target, Calendar,
  ArrowRight, GripVertical, ChevronDown, ChevronUp, Clock, AlertCircle, MessageSquare, ClipboardCheck,
  ArrowUp, ArrowDown, Sparkles, Send, FileDown,
} from "lucide-react";
import { Link } from "wouter";
import { useClientPathway } from "@/contexts/ClientPathwayContext";
import { exportObjectivesPdf } from "@/lib/exportObjectivesPdf";

type AnchorEventType = "discharge" | "enrollment" | "procedure" | "custom";
type BandLabel = "early" | "near_window" | "at_window" | "post_window" | "default";
type EnumColor = "GREEN" | "YELLOW" | "RED" | "BLUE" | "GRAY";

interface EnumValue {
  label: string;
  color: EnumColor;
  promptHint?: string;
}

const COLOR_MAP: Record<EnumColor, { bg: string; text: string; border: string; chipActive: string; label: string }> = {
  GREEN:  { bg: "bg-green-100",  text: "text-green-800",  border: "border-green-300",  chipActive: "bg-green-600 text-white border-green-600",   label: "Green (Positive)" },
  YELLOW: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300", chipActive: "bg-yellow-500 text-white border-yellow-500", label: "Yellow (Caution)" },
  RED:    { bg: "bg-red-100",    text: "text-red-800",    border: "border-red-300",    chipActive: "bg-red-600 text-white border-red-600",       label: "Red (Negative)" },
  BLUE:   { bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-300",   chipActive: "bg-blue-600 text-white border-blue-600",     label: "Blue (Info)" },
  GRAY:   { bg: "bg-gray-100",   text: "text-gray-700",   border: "border-gray-300",   chipActive: "bg-gray-700 text-white border-gray-700",     label: "Gray (Neutral)" },
};

interface Stage {
  id: string;
  name: string;
  displayName: string;
  description: string;
  order: number;
}

interface Threshold {
  bandLabel: BandLabel;
  bandDisplayName: string;
  daysRemainingMin: number | null;
  daysRemainingMax: number | null;
  onTrackStageIds: string[];
  satisfiedLabel: string;
  unsatisfiedLabel: string;
  expectedInteractionId?: number | null;
}

interface StageMapping {
  extractedValue: string;
  stageId: string;
}

interface InclusionRules {
  requirePcpAssigned: boolean;
  requireCompletedWithPatientOrCaregiver: boolean;
  customRules: string[];
}

interface ObjectiveInteractionConfig {
  interactionId: number;
  isDefault: boolean;
  canResolveObjective: boolean;
  inclusionRules: InclusionRules;
  promptGuidance: string;
  observationTopicIds: number[];
}

interface ObservationTopic {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  domain?: string;
  valueType?: string;
  value?: EnumValue[];
  promptGuidance?: string;
  isActive: boolean;
}

interface ActivationInteraction {
  id: number;
  clientPathwayId: number;
  key: string;
  name: string;
  description: string;
  interactionType: "scheduled" | "ad_hoc" | "continuous";
  expectedDayOffset: number | null;
  parentInteractionId: number | null;
  intervalDays: number | null;
  startAfterObjectiveId: number | null;
  isActive: boolean;
  displayOrder: number;
}

interface ActivationObjective {
  id: number;
  name: string;
  displayName: string;
  description: string;
  anchorEventType: string;
  anchorContextKey: string;
  windowDays: number;
  stages: Stage[];
  achievedStageId: string;
  thresholds: Threshold[];
  observationName: string;
  stageMappings: StageMapping[];
  interactions: ObjectiveInteractionConfig[];
  interactionContextKey: string;
  isActive: boolean;
  displayOrder: number;
  observationTopicIds: number[];
}

interface ContextParameter {
  id: number;
  name: string;
  displayName: string;
  dataType: string;
}

const ANCHOR_TYPES: { value: AnchorEventType; label: string }[] = [
  { value: "discharge", label: "Discharge date" },
  { value: "enrollment", label: "Enrollment date" },
  { value: "procedure", label: "Procedure date" },
  { value: "custom", label: "Custom anchor" },
];

// Stage 0 (order === 0) is the special "Unresolved" bin — patient remains in
// the denominator but no progress can be assigned. Progress stages have order > 0.
const isUnresolvedStage = (s: Stage) => s.order === 0;
const progressStages = (stages: Stage[]) => stages.filter(s => s.order > 0).sort((a, b) => a.order - b.order);
const unresolvedStage = (stages: Stage[]) => stages.find(isUnresolvedStage) || null;

const DEFAULT_THRESHOLDS = (stages: Stage[]): Threshold[] => {
  const progress = progressStages(stages);
  const last = progress[progress.length - 1]?.id || "";
  const middleAndLast = progress.slice(1).map(s => s.id);
  return [
    { bandLabel: "early", bandDisplayName: "Early", daysRemainingMin: 3, daysRemainingMax: null, onTrackStageIds: middleAndLast, satisfiedLabel: "On track", unsatisfiedLabel: "At risk", expectedInteractionId: null },
    { bandLabel: "near_window", bandDisplayName: "Near window", daysRemainingMin: 1, daysRemainingMax: 2, onTrackStageIds: last ? [last] : [], satisfiedLabel: "On track", unsatisfiedLabel: "At risk", expectedInteractionId: null },
    { bandLabel: "at_window", bandDisplayName: "At window", daysRemainingMin: 0, daysRemainingMax: 0, onTrackStageIds: last ? [last] : [], satisfiedLabel: "On track", unsatisfiedLabel: "At risk", expectedInteractionId: null },
    { bandLabel: "post_window", bandDisplayName: "Post window", daysRemainingMin: null, daysRemainingMax: -1, onTrackStageIds: last ? [last] : [], satisfiedLabel: "Achieved", unsatisfiedLabel: "Not achieved", expectedInteractionId: null },
  ];
};

function emptyForm(): Omit<ActivationObjective, "id"> {
  const stages: Stage[] = [
    { id: "stage_unresolved", name: "unresolved", displayName: "Unresolved", description: "patient in denominator, no progress assigned", order: 0 },
    { id: "stage_no_appointment", name: "no_appointment", displayName: "No appointment", description: "patient confirmed nothing is booked", order: 1 },
    { id: "stage_intent", name: "intent_to_schedule", displayName: "Intent to schedule", description: "patient expressed intent but no confirmed booking", order: 2 },
    { id: "stage_scheduled", name: "scheduled", displayName: "Scheduled", description: "confirmed appointment with date and time", order: 3 },
    { id: "stage_completed", name: "visit_completed", displayName: "Visit completed", description: "patient attended the visit", order: 4 },
  ];
  return {
    name: "",
    displayName: "",
    description: "",
    anchorEventType: "discharge",
    anchorContextKey: "",
    windowDays: 7,
    stages,
    achievedStageId: "stage_completed",
    thresholds: DEFAULT_THRESHOLDS(stages),
    observationName: "",
    stageMappings: [],
    interactions: [],
    interactionContextKey: "interaction_key",
    isActive: true,
    displayOrder: 0,
    observationTopicIds: [],
  };
}

function bandRangeLabel(t: Threshold): string {
  if (t.daysRemainingMin === null && t.daysRemainingMax === null) return "All days";
  if (t.daysRemainingMin === null) return `≤ ${t.daysRemainingMax} days`;
  if (t.daysRemainingMax === null) return `${t.daysRemainingMin}+ days remaining`;
  if (t.daysRemainingMin === t.daysRemainingMax) return `${t.daysRemainingMin} days remaining`;
  return `${t.daysRemainingMin}–${t.daysRemainingMax} days remaining`;
}

function bandTimingLabel(b: BandLabel): { label: string; example: string } {
  switch (b) {
    case "early": return { label: "Early", example: "e.g. day 4" };
    case "near_window": return { label: "Near window", example: "e.g. day 6" };
    case "at_window": return { label: "At window", example: "e.g. day 7" };
    case "post_window": return { label: "Post window", example: "e.g. day 8+" };
    case "default": return { label: "Default", example: "fallback when no other band matches" };
  }
}

export default function ActivationObjectives() {
  const { selectedCPId, selectedCP } = useClientPathway();
  const { toast } = useToast();
  const [items, setItems] = useState<ActivationObjective[]>([]);
  const [contextParams, setContextParams] = useState<ContextParameter[]>([]);
  const [interactions, setInteractions] = useState<ActivationInteraction[]>([]);
  const [observationTopics, setObservationTopics] = useState<ObservationTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<Omit<ActivationObjective, "id">>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiHistory, setAiHistory] = useState<{ role: string; text: string }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [editorAiOpen, setEditorAiOpen] = useState(false);
  const [editorAiMessage, setEditorAiMessage] = useState("");
  const [editorAiHistory, setEditorAiHistory] = useState<{ role: string; text: string }[]>([]);
  const [editorAiLoading, setEditorAiLoading] = useState(false);

  useEffect(() => {
    if (!selectedCPId) return;
    setEditingId(null);
    setForm(emptyForm());
    setExpandedId(null);
    void loadAll();
  }, [selectedCPId]);

  async function loadAll() {
    if (!selectedCPId) return;
    setLoading(true);
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        fetch(`/api/activation-objectives?clientPathwayId=${selectedCPId}`),
        fetch(`/api/context-parameters?clientPathwayId=${selectedCPId}`),
        fetch(`/api/activation-interactions?clientPathwayId=${selectedCPId}`),
        fetch(`/api/observations?clientPathwayId=${selectedCPId}`),
      ]);
      if (r1.ok) setItems(await r1.json());
      if (r2.ok) setContextParams(await r2.json());
      if (r3.ok) setInteractions(await r3.json());
      if (r4.ok) setObservationTopics(await r4.json());
    } catch (err: any) {
      toast({ title: "Failed to load", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function resetEditorAi() {
    setEditorAiOpen(false);
    setEditorAiMessage("");
    setEditorAiHistory([]);
    setEditorAiLoading(false);
  }

  function startNew() {
    setForm(emptyForm());
    setEditingId("new");
    setExpandedId(null);
    resetEditorAi();
  }

  function startEdit(obj: ActivationObjective) {
    const { id, ...rest } = obj;
    const stages = rest.stages || [];
    // Seed default threshold bands when none are saved so the editor always
    // shows the four bands ready to tweak.
    const thresholds = (rest.thresholds && rest.thresholds.length > 0)
      ? rest.thresholds
      : DEFAULT_THRESHOLDS(stages);
    setForm({
      ...rest,
      stages,
      thresholds,
      interactions: rest.interactions || [],
      interactionContextKey: rest.interactionContextKey || "interaction_key",
      observationTopicIds: rest.observationTopicIds || [],
    });
    setEditingId(id);
    setExpandedId(null);
    resetEditorAi();
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    resetEditorAi();
  }

  async function saveForm() {
    if (!selectedCPId) return;
    if (!form.name.trim() || !form.displayName.trim() || !form.anchorContextKey.trim() || !form.windowDays) {
      toast({ title: "Missing required fields", description: "Name, display name, anchor context key, and window days are required.", variant: "destructive" });
      return;
    }
    if (!form.interactionContextKey.trim()) {
      toast({ title: "Missing interaction context key", description: "Specify the request context field that carries the interaction key (e.g. interaction_key).", variant: "destructive" });
      return;
    }
    // Validate the linked Observation. The link is OPTIONAL — an objective
    // can stand on its own (no observation-driven staging). But if a link IS
    // set, it must resolve to a valid active enum observation with every
    // value mapped to a stage; otherwise runtime extraction would silently
    // skip the objective.
    if (form.observationName.trim()) {
      const linked = observationTopics.find(o => o.name === form.observationName);
      if (!linked) {
        toast({
          title: "Linked observation missing",
          description: `"${form.observationName}" isn't an observation in this pathway. Pick an existing one, create it on the Observations page, or clear the link.`,
          variant: "destructive",
        });
        return;
      }
      if (!linked.isActive) {
        toast({
          title: "Linked observation is inactive",
          description: `"${linked.displayName}" is marked inactive and won't run at extraction time. Activate it on the Observations page, pick a different one, or clear the link.`,
          variant: "destructive",
        });
        return;
      }
      if (linked.valueType !== "enum" || !Array.isArray(linked.value) || linked.value.length === 0) {
        toast({
          title: "Linked observation has no enum values",
          description: `"${linked.displayName}" must be an enum with at least one value before it can drive stages. Add values on the Observations page or clear the link.`,
          variant: "destructive",
        });
        return;
      }
      const linkedValues = linked.value.map(v => v.label);
      const unmapped = linkedValues.filter(label =>
        !form.stageMappings.find(m => m.extractedValue === label && m.stageId)
      );
      if (unmapped.length > 0) {
        toast({
          title: "Linked observation has unassigned values",
          description: `Assign each to a stage: ${unmapped.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }
    // Validate no duplicate interaction references
    const seenIds = new Set<number>();
    for (const cfg of form.interactions) {
      if (seenIds.has(cfg.interactionId)) {
        toast({ title: "Duplicate interaction", description: "Each interaction can only be configured once per objective.", variant: "destructive" });
        return;
      }
      seenIds.add(cfg.interactionId);
    }
    // Auto-heal: post_window only counts the achieved stage as on-track
    const healedThresholds = form.thresholds.map(t =>
      t.bandLabel === "post_window"
        ? { ...t, onTrackStageIds: [form.achievedStageId] }
        : t
    );
    setSaving(true);
    try {
      const isNew = editingId === "new";
      const url = isNew ? "/api/activation-objectives" : `/api/activation-objectives/${editingId}`;
      const method = isNew ? "POST" : "PUT";
      const body = JSON.stringify({ ...form, thresholds: healedThresholds, clientPathwayId: selectedCPId });
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Save failed (${res.status})`);
      }
      toast({ title: isNew ? "Objective created" : "Objective updated" });
      setEditingId(null);
      await loadAll();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteObjective(id: number) {
    if (!selectedCPId) return;
    if (!confirm("Delete this activation objective? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/activation-objectives/${id}?clientPathwayId=${selectedCPId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Objective deleted" });
      await loadAll();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  }

  // Form helpers ----------------------------------
  function updateForm(patch: Partial<typeof form>) {
    setForm(prev => ({ ...prev, ...patch }));
  }

  function addStage() {
    // Append a new progress stage after the highest existing progress order.
    const progress = progressStages(form.stages);
    const nextOrder = (progress[progress.length - 1]?.order || 0) + 1;
    const newId = `stage_${Date.now()}`;
    const newStage: Stage = { id: newId, name: `stage_${nextOrder}`, displayName: `Stage ${nextOrder}`, description: "", order: nextOrder };
    updateForm({ stages: [...form.stages, newStage] });
  }

  function addUnresolvedStage() {
    if (unresolvedStage(form.stages)) return;
    const newStage: Stage = {
      id: "stage_unresolved",
      name: "unresolved",
      displayName: "Unresolved",
      description: "patient in denominator, no progress assigned",
      order: 0,
    };
    updateForm({ stages: [newStage, ...form.stages] });
  }

  function updateStage(idx: number, patch: Partial<Stage>) {
    // Don't let edits change the order field of stages — order is managed
    // structurally (Stage 0 stays at 0; progress stages keep their slot).
    const { order: _ignored, ...safePatch } = patch;
    const next = form.stages.map((s, i) => i === idx ? { ...s, ...safePatch } : s);
    updateForm({ stages: next });
  }

  function removeStage(idx: number) {
    const removed = form.stages[idx];
    if (!removed) return;
    const remainingProgress = progressStages(form.stages).filter(s => s.id !== removed.id);
    if (!isUnresolvedStage(removed) && remainingProgress.length === 0) {
      toast({ title: "Cannot remove", description: "At least one progress stage is required.", variant: "destructive" });
      return;
    }
    // Renumber only progress stages; Stage 0 keeps order 0.
    let pOrder = 1;
    const next = form.stages
      .filter((_, i) => i !== idx)
      .map(s => isUnresolvedStage(s) ? s : { ...s, order: pOrder++ });
    const newAchieved = form.achievedStageId === removed.id
      ? (progressStages(next)[progressStages(next).length - 1]?.id || "")
      : form.achievedStageId;
    const newThresholds = form.thresholds.map(t => ({
      ...t,
      onTrackStageIds: t.onTrackStageIds.filter(id => id !== removed.id),
    }));
    const newStageMappings = form.stageMappings.filter(m => m.stageId !== removed.id);
    updateForm({ stages: next, achievedStageId: newAchieved, thresholds: newThresholds, stageMappings: newStageMappings });
  }

  function moveStage(idx: number, dir: -1 | 1) {
    // Move only operates on progress stages — Stage 0 is fixed.
    const stage = form.stages[idx];
    if (!stage || isUnresolvedStage(stage)) return;
    const progress = progressStages(form.stages);
    const pIdx = progress.findIndex(s => s.id === stage.id);
    const newPIdx = pIdx + dir;
    if (newPIdx < 0 || newPIdx >= progress.length) return;
    const reordered = [...progress];
    [reordered[pIdx], reordered[newPIdx]] = [reordered[newPIdx], reordered[pIdx]];
    reordered.forEach((s, i) => s.order = i + 1);
    // Rebuild stages array preserving Stage 0 first, then the new progress order.
    const u = unresolvedStage(form.stages);
    const next: Stage[] = u ? [u, ...reordered] : reordered;
    updateForm({ stages: next });
  }

  function toggleThresholdStage(thresholdIdx: number, stageId: string) {
    const t = form.thresholds[thresholdIdx];
    const has = t.onTrackStageIds.includes(stageId);
    const newIds = has ? t.onTrackStageIds.filter(id => id !== stageId) : [...t.onTrackStageIds, stageId];
    const newThresholds = form.thresholds.map((th, i) => i === thresholdIdx ? { ...th, onTrackStageIds: newIds } : th);
    updateForm({ thresholds: newThresholds });
  }

  function updateThreshold(idx: number, patch: Partial<Threshold>) {
    const next = form.thresholds.map((t, i) => i === idx ? { ...t, ...patch } : t);
    updateForm({ thresholds: next });
  }

  function addDefaultBand() {
    if (form.thresholds.some(t => t.bandLabel === "default")) return;
    const defaultBand: Threshold = {
      bandLabel: "default",
      bandDisplayName: "Default",
      daysRemainingMin: null,
      daysRemainingMax: null,
      onTrackStageIds: [],
      satisfiedLabel: "On track",
      unsatisfiedLabel: "At risk",
      expectedInteractionId: null,
    };
    updateForm({ thresholds: [...form.thresholds, defaultBand] });
  }

  function removeBand(idx: number) {
    updateForm({ thresholds: form.thresholds.filter((_, i) => i !== idx) });
  }

  function addInteractionConfig(interactionId: number) {
    if (form.interactions.some(c => c.interactionId === interactionId)) return;
    const cfg: ObjectiveInteractionConfig = {
      interactionId,
      isDefault: false,
      canResolveObjective: false,
      inclusionRules: { requirePcpAssigned: false, requireCompletedWithPatientOrCaregiver: true, customRules: [] },
      promptGuidance: "",
      observationTopicIds: [],
    };
    updateForm({ interactions: [...form.interactions, cfg] });
  }

  function updateInteractionConfig(idx: number, patch: Partial<ObjectiveInteractionConfig>) {
    // Enforce at most one default — turning one on clears the flag on all others.
    const turningOnDefault = patch.isDefault === true;
    const next = form.interactions.map((c, i) => {
      if (i === idx) return { ...c, ...patch };
      if (turningOnDefault) return { ...c, isDefault: false };
      return c;
    });
    updateForm({ interactions: next });
  }

  function removeInteractionConfig(idx: number) {
    if (!confirm("Remove this interaction configuration from the objective?")) return;
    updateForm({ interactions: form.interactions.filter((_, i) => i !== idx) });
  }

  function setMapping(extractedValue: string, stageId: string) {
    const exists = form.stageMappings.some(m => m.extractedValue === extractedValue);
    const newMappings = exists
      ? form.stageMappings.map(m => m.extractedValue === extractedValue ? { ...m, stageId } : m)
      : [...form.stageMappings, { extractedValue, stageId }];
    updateForm({ stageMappings: newMappings });
  }

  // ----------------------------------------

  async function sendAiMessage() {
    if (!aiMessage.trim() || aiLoading || !selectedCPId) return;
    const userMsg = aiMessage.trim();
    setAiMessage("");
    const newHistory = [...aiHistory, { role: "user", text: userMsg }];
    setAiHistory(newHistory);
    setAiLoading(true);
    try {
      const res = await fetch("/api/activation-objectives/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history: aiHistory, clientPathwayId: selectedCPId }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiHistory([...newHistory, { role: "assistant", text: data.response }]);
      } else {
        setAiHistory([...newHistory, { role: "assistant", text: "Error: " + (data.error || "Failed to get response") }]);
      }
    } catch {
      setAiHistory([...newHistory, { role: "assistant", text: "Error: Failed to connect to AI assistant." }]);
    } finally {
      setAiLoading(false);
    }
  }

  // Shared helper: parse "Extracted Values" line.
  // New format (preferred): semicolon-separated, optional " | hint" suffix per value.
  //   "Unknown (GRAY) | when patient is vague; Patient deferred (GRAY) | when patient redirects"
  // Legacy format (fallback): comma-separated, no hints.
  //   "Value A (GREEN), Value B (YELLOW)"
  function parseExtractedValuesLine(valuesRaw: string): EnumValue[] {
    if (!valuesRaw) return [];
    const validColors: EnumColor[] = ["GREEN", "YELLOW", "RED", "BLUE", "GRAY"];
    const useSemicolon = valuesRaw.includes(";");
    const parts = useSemicolon ? valuesRaw.split(";") : valuesRaw.split(",");
    const out: EnumValue[] = [];
    for (const part of parts) {
      const raw = part.trim();
      if (!raw) continue;
      // Split off optional hint: " | hint text"
      const pipeIdx = raw.indexOf("|");
      const head = pipeIdx >= 0 ? raw.slice(0, pipeIdx).trim() : raw;
      const hint = pipeIdx >= 0 ? raw.slice(pipeIdx + 1).trim() : "";
      const m = head.match(/^(.+?)\s*\(([A-Z]+)\)\s*$/);
      if (!m) {
        if (head) out.push({ label: head, color: "GRAY", promptHint: hint });
        continue;
      }
      const color = (validColors.includes(m[2] as EnumColor) ? m[2] : "GRAY") as EnumColor;
      const label = m[1].trim();
      if (label) out.push({ label, color, promptHint: hint });
    }
    return out;
  }

  function parseObjectiveProposal(text: string): Omit<ActivationObjective, "id"> | null {
    const get = (label: string) => {
      const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+?)(?=\\n\\*\\*|$)`, "is");
      const m = text.match(re);
      return m ? m[1].trim() : "";
    };
    const name = get("Name");
    const displayName = get("Display Name");
    if (!name || !displayName) return null;

    const description = get("Description");
    const anchorEvent = (get("Anchor Event") || "discharge").toLowerCase().split(/\s|,|\|/)[0];
    const validAnchors: AnchorEventType[] = ["discharge", "enrollment", "procedure", "custom"];
    const anchorEventType = (validAnchors.includes(anchorEvent as AnchorEventType) ? anchorEvent : "discharge") as AnchorEventType;
    const anchorContextKey = get("Anchor Context Key");
    const windowDaysRaw = get("Window Days");
    const windowDays = parseInt(windowDaysRaw, 10) || 7;
    const observationName = get("Observation Name");

    const stagesRaw = get("Stages");
    let parsedStages: Stage[] = [];
    if (stagesRaw) {
      parsedStages = stagesRaw.split(";").map((s, i) => {
        const [n, d] = s.split("|").map(x => x.trim());
        if (!n) return null;
        return {
          id: `stage_${Date.now()}_${i}`,
          name: n.toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
          displayName: d || n,
          description: "",
          order: i + 1,
        };
      }).filter(Boolean) as Stage[];
    }
    if (parsedStages.length === 0) {
      parsedStages = emptyForm().stages;
    }

    const achievedRaw = get("Achieved Stage");
    const achievedStageId =
      parsedStages.find(s => s.name === achievedRaw.toLowerCase().replace(/[^a-z0-9_]+/g, "_"))?.id
      || parsedStages[parsedStages.length - 1]?.id
      || "";

    const mappingsRaw = get("Stage Mappings");
    let stageMappings: StageMapping[] = [];
    if (mappingsRaw) {
      stageMappings = mappingsRaw.split(";").map(part => {
        const [val, st] = part.split("->").map(x => x.trim());
        if (!val || !st) return null;
        const stage = parsedStages.find(s => s.name === st.toLowerCase().replace(/[^a-z0-9_]+/g, "_"))
          || parsedStages.find(s => s.displayName.toLowerCase() === st.toLowerCase());
        if (!stage) return null;
        return { extractedValue: val, stageId: stage.id };
      }).filter(Boolean) as StageMapping[];
    }

    return {
      name,
      displayName,
      description,
      anchorEventType,
      anchorContextKey,
      windowDays,
      stages: parsedStages,
      achievedStageId,
      thresholds: DEFAULT_THRESHOLDS(parsedStages),
      observationName,
      stageMappings,
      interactions: [],
      interactionContextKey: "interaction_key",
      isActive: true,
      displayOrder: 0,
      observationTopicIds: [],
    };
  }

  function applyProposal(proposal: Omit<ActivationObjective, "id">) {
    setForm(proposal);
    setEditingId("new");
    setAiOpen(false);
  }

  /**
   * Enhancement-mode parser: returns ONLY fields the assistant explicitly
   * emitted (no defaults), so that applyEnhancement can safely merge into the
   * current draft without destroying user-entered values.
   */
  function parseObjectiveEnhancement(text: string): Partial<Omit<ActivationObjective, "id">> {
    const get = (label: string): string | null => {
      const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+?)(?=\\n\\*\\*|$)`, "is");
      const m = text.match(re);
      return m ? m[1].trim() : null;
    };
    const out: Partial<Omit<ActivationObjective, "id">> = {};

    const name = get("Name");
    if (name && /^[a-z][a-z0-9_]*$/.test(name)) out.name = name;

    const displayName = get("Display Name");
    if (displayName) out.displayName = displayName;

    const description = get("Description");
    if (description !== null) out.description = description;

    const anchor = get("Anchor Event");
    if (anchor) {
      const v = anchor.toLowerCase().split(/\s|,|\|/)[0];
      const validAnchors: AnchorEventType[] = ["discharge", "enrollment", "procedure", "custom"];
      if (validAnchors.includes(v as AnchorEventType)) out.anchorEventType = v as AnchorEventType;
    }

    const anchorKey = get("Anchor Context Key");
    if (anchorKey) out.anchorContextKey = anchorKey;

    const windowDaysRaw = get("Window Days");
    if (windowDaysRaw) {
      const wd = parseInt(windowDaysRaw, 10);
      if (!isNaN(wd) && wd > 0) out.windowDays = wd;
    }

    const observationName = get("Observation Name");
    if (observationName) out.observationName = observationName;

    const stagesRaw = get("Stages");
    let parsedStages: Stage[] | null = null;
    if (stagesRaw) {
      parsedStages = stagesRaw.split(";").map((s, i) => {
        const [n, d] = s.split("|").map(x => x.trim());
        if (!n) return null;
        return {
          id: `stage_${Date.now()}_${i}`,
          name: n.toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
          displayName: d || n,
          description: "",
          order: i + 1,
        };
      }).filter(Boolean) as Stage[];
      if (parsedStages.length > 0) {
        out.stages = parsedStages;
      }
    }
    // Only set achievedStageId if AI explicitly emitted **Achieved Stage:**
    const achievedRaw = get("Achieved Stage");
    if (achievedRaw && (parsedStages || form.stages).length > 0) {
      const stageList = parsedStages || form.stages;
      const target = achievedRaw.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
      const match = stageList.find(s => s.name === target);
      if (match) out.achievedStageId = match.id;
    }

    const mappingsRaw = get("Stage Mappings");
    if (mappingsRaw) {
      // Use parsed stages if AI provided them, else current form stages — match case-insensitively
      const stageList = parsedStages || form.stages;
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
      const mappings: StageMapping[] = mappingsRaw.split(";").map(part => {
        const [val, st] = part.split("->").map(x => x.trim());
        if (!val || !st) return null;
        const target = norm(st);
        const stage = stageList.find(s => norm(s.name) === target)
          || stageList.find(s => s.displayName.toLowerCase() === st.toLowerCase());
        if (!stage) return null;
        return { extractedValue: val, stageId: stage.id };
      }).filter(Boolean) as StageMapping[];
      if (mappings.length > 0) out.stageMappings = mappings;
    }

    return out;
  }

  async function sendEditorAiMessage() {
    if (!editorAiMessage.trim() || editorAiLoading || !selectedCPId) return;
    const userMsg = editorAiMessage.trim();
    setEditorAiMessage("");
    const newHistory = [...editorAiHistory, { role: "user", text: userMsg }];
    setEditorAiHistory(newHistory);
    setEditorAiLoading(true);
    try {
      const res = await fetch("/api/activation-objectives/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: editorAiHistory,
          clientPathwayId: selectedCPId,
          currentDraft: form,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditorAiHistory([...newHistory, { role: "assistant", text: data.response }]);
      } else {
        setEditorAiHistory([...newHistory, { role: "assistant", text: "Error: " + (data.error || "Failed to get response") }]);
      }
    } catch {
      setEditorAiHistory([...newHistory, { role: "assistant", text: "Error: Failed to connect to AI assistant." }]);
    } finally {
      setEditorAiLoading(false);
    }
  }

  function applyEnhancement(patch: Partial<Omit<ActivationObjective, "id">>) {
    if (Object.keys(patch).length === 0) {
      toast({ title: "No changes detected", description: "The AI response did not contain any fields to apply.", variant: "destructive" });
      return;
    }
    // When stages are replaced, ids change — reconcile any field that
    // references stage ids (mappings, thresholds, achievedStageId) by matching
    // the user's existing values to the new stages by name/displayName, so the
    // user's customizations are preserved instead of being silently reset.
    const finalPatch: Partial<Omit<ActivationObjective, "id">> = { ...patch };
    if (patch.stages) {
      const newStages = patch.stages;
      const findNew = (oldStageId: string) => {
        const oldStage = form.stages.find(s => s.id === oldStageId);
        if (!oldStage) return null;
        return newStages.find(s => s.name === oldStage.name)
          || newStages.find(s => s.displayName.toLowerCase() === oldStage.displayName.toLowerCase())
          || null;
      };
      // Rebuild mappings (only if AI didn't supply its own)
      if (!patch.stageMappings && form.stageMappings.length > 0) {
        finalPatch.stageMappings = form.stageMappings
          .map(sm => {
            const match = findNew(sm.stageId);
            return match ? { extractedValue: sm.extractedValue, stageId: match.id } : null;
          })
          .filter(Boolean) as StageMapping[];
      }
      // Rebuild thresholds — remap onTrackStageIds to new stage ids by name
      if (!patch.thresholds) {
        if (form.thresholds && form.thresholds.length > 0) {
          finalPatch.thresholds = form.thresholds.map(t => ({
            ...t,
            onTrackStageIds: (t.onTrackStageIds || []).map(sid => findNew(sid)?.id).filter(Boolean) as string[],
          }));
        } else {
          finalPatch.thresholds = DEFAULT_THRESHOLDS(newStages);
        }
      }
      // Rebuild achievedStageId (only if AI didn't supply one)
      if (!patch.achievedStageId) {
        const reMapped = findNew(form.achievedStageId);
        finalPatch.achievedStageId = reMapped?.id || newStages[newStages.length - 1].id;
      }
    }
    setForm({ ...form, ...finalPatch });
    const fieldList = Object.keys(finalPatch).join(", ");
    toast({ title: "Enhancements applied", description: `Updated: ${fieldList}. Review and Save when ready.` });
  }

  const isEditing = editingId !== null;
  const anchorContextOptions = useMemo(() =>
    contextParams.filter(p => p.dataType === "date" || p.name.toLowerCase().includes("date")), [contextParams]);

  if (!selectedCPId) {
    return (
      <div className="p-8">
        <Card><CardContent className="p-6">
          <p className="text-muted-foreground">Select a client/pathway to manage activation objectives.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-page-title">
            <Target className="h-6 w-6 text-primary" />
            Activation Objectives
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Program-level goals tied to a patient anchor event. Each objective has a target date, ordered progress stages, and window-aware on-track rules.
          </p>
        </div>
        {!isEditing && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (items.length === 0) {
                  toast({ title: "Nothing to export", description: "Create at least one activation objective first.", variant: "destructive" });
                  return;
                }
                const pathwayLabel = selectedCP
                  ? `${selectedCP.client} — ${selectedCP.pathway}`
                  : "Pathway";
                exportObjectivesPdf(
                  pathwayLabel,
                  items,
                  interactions,
                  observationTopics,
                );
              }}
              data-testid="button-export-pdf"
              title="Download a PDF of every objective in this pathway"
            >
              <FileDown className="h-4 w-4 mr-2" /> Export PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => setAiOpen(!aiOpen)}
              className={aiOpen ? "border-primary text-primary" : ""}
              data-testid="button-ai-assistant"
            >
              <Sparkles className="h-4 w-4 mr-2" /> AI Assistant
            </Button>
            <Button onClick={startNew} data-testid="button-new-objective">
              <Plus className="h-4 w-4 mr-2" /> New Objective
            </Button>
          </div>
        )}
      </div>

      {!isEditing && aiOpen && (
        <Card className="border-primary/30 shadow-md bg-gradient-to-br from-primary/5 to-background" data-testid="panel-ai-assistant">
          <CardContent className="py-4 px-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">AI Activation Objective Assistant</span>
                <span className="text-[10px] text-muted-foreground">(powered by Gemini)</span>
              </div>
              <div className="flex gap-1.5">
                {aiHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAiHistory([])}
                    className="h-7 text-xs text-muted-foreground"
                    data-testid="button-ai-clear"
                  >
                    Clear
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setAiOpen(false)} className="h-7 w-7 p-0" data-testid="button-ai-close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {aiHistory.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Ask me to suggest new activation objectives, improve stages or prompt guidance, review your setup, or propose stage mappings. I can see your current objectives, observations, interactions, and context parameters.</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Review my current activation objectives and suggest improvements",
                    "Suggest a new activation objective for medication adherence",
                    "Recommend stage mappings for my existing objectives",
                    "What activation objectives am I missing?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-primary/20 text-primary hover:bg-primary/10 transition-colors"
                      onClick={() => setAiMessage(suggestion)}
                      data-testid="button-ai-suggestion"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {aiHistory.length > 0 && (
              <div
                className="space-y-3 max-h-80 overflow-y-auto pr-1"
                ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                data-testid="ai-chat-history"
              >
                {aiHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-white"
                          : "bg-muted/50 border border-border/50 text-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <>
                          <div
                            className="whitespace-pre-wrap text-[13px] leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: msg.text
                                .replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!))
                                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                                .replace(/\n/g, "<br/>"),
                            }}
                          />
                          {(() => {
                            const proposal = parseObjectiveProposal(msg.text);
                            if (!proposal) return null;
                            const exists = items.some(o => o.name === proposal.name);
                            return (
                              <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 bg-primary hover:bg-primary/90 text-white text-xs"
                                  onClick={() => applyProposal(proposal)}
                                  data-testid={`button-apply-suggestion-${i}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  {exists ? "Open as new (name conflicts)" : "Use as new objective"}
                                </Button>
                                {exists && (
                                  <span className="text-[11px] text-yellow-700">
                                    "{proposal.name}" already exists
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <span>{msg.text}</span>
                      )}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={aiMessage}
                onChange={e => setAiMessage(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendAiMessage(); } }}
                placeholder="Ask about activation objectives..."
                disabled={aiLoading}
                className="text-sm"
                data-testid="input-ai-message"
              />
              <Button
                onClick={() => void sendAiMessage()}
                disabled={aiLoading || !aiMessage.trim()}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-ai-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
        </div>
      )}

      {isEditing && editorAiOpen && (
        <Card className="border-primary/30 shadow-md bg-gradient-to-br from-primary/5 to-background" data-testid="panel-editor-ai-assistant">
          <CardContent className="py-4 px-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Enhance this objective</span>
                <span className="text-[10px] text-muted-foreground">(uses your current draft as context)</span>
              </div>
              <div className="flex gap-1.5">
                {editorAiHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditorAiHistory([])}
                    className="h-7 text-xs text-muted-foreground"
                    data-testid="button-editor-ai-clear"
                  >
                    Clear
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setEditorAiOpen(false)} className="h-7 w-7 p-0" data-testid="button-editor-ai-close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {editorAiHistory.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Ask the AI to refine the objective you're editing — improve the description, suggest stages, propose stage mappings, tighten prompt guidance, or recommend the right anchor.</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Improve the description and prompt guidance",
                    "Suggest better stage names and order",
                    "Propose extracted values and stage mappings",
                    "Recommend the right anchor event and window days",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-primary/20 text-primary hover:bg-primary/10 transition-colors"
                      onClick={() => setEditorAiMessage(suggestion)}
                      data-testid="button-editor-ai-suggestion"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editorAiHistory.length > 0 && (
              <div
                className="space-y-3 max-h-80 overflow-y-auto pr-1"
                ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                data-testid="editor-ai-chat-history"
              >
                {editorAiHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-white"
                          : "bg-muted/50 border border-border/50 text-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <>
                          <div
                            className="whitespace-pre-wrap text-[13px] leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: msg.text
                                .replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!))
                                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                                .replace(/\n/g, "<br/>"),
                            }}
                          />
                          {(() => {
                            const patch = parseObjectiveEnhancement(msg.text);
                            const fieldCount = Object.keys(patch).length;
                            if (fieldCount === 0) return null;
                            return (
                              <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 bg-primary hover:bg-primary/90 text-white text-xs"
                                  onClick={() => applyEnhancement(patch)}
                                  data-testid={`button-apply-enhancement-${i}`}
                                >
                                  <Save className="h-3 w-3 mr-1" />
                                  Apply {fieldCount} field{fieldCount === 1 ? "" : "s"} to draft
                                </Button>
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <span>{msg.text}</span>
                      )}
                    </div>
                  </div>
                ))}
                {editorAiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={editorAiMessage}
                onChange={e => setEditorAiMessage(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendEditorAiMessage(); } }}
                placeholder="Ask how to improve this objective..."
                disabled={editorAiLoading}
                className="text-sm"
                data-testid="input-editor-ai-message"
              />
              <Button
                onClick={() => void sendEditorAiMessage()}
                disabled={editorAiLoading || !editorAiMessage.trim()}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-editor-ai-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isEditing && (
        <ObjectiveEditor
          form={form}
          updateForm={updateForm}
          contextParams={contextParams}
          anchorContextOptions={anchorContextOptions}
          interactions={interactions}
          observationTopics={observationTopics}
          addStage={addStage}
          addUnresolvedStage={addUnresolvedStage}
          updateStage={updateStage}
          removeStage={removeStage}
          moveStage={moveStage}
          toggleThresholdStage={toggleThresholdStage}
          updateThreshold={updateThreshold}
          addDefaultBand={addDefaultBand}
          removeBand={removeBand}
          addInteractionConfig={addInteractionConfig}
          updateInteractionConfig={updateInteractionConfig}
          removeInteractionConfig={removeInteractionConfig}
          setMapping={setMapping}
          onCancel={cancelEdit}
          onSave={saveForm}
          saving={saving}
          isNew={editingId === "new"}
          editorAiOpen={editorAiOpen}
          setEditorAiOpen={setEditorAiOpen}
        />
      )}

      {!isEditing && !loading && items.length === 0 && (
        <Card><CardContent className="p-10 text-center">
          <Target className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground mb-4">No activation objectives yet for this pathway.</p>
          <Button onClick={startNew} data-testid="button-create-first">
            <Plus className="h-4 w-4 mr-2" /> Create your first objective
          </Button>
        </CardContent></Card>
      )}

      {!isEditing && items.length > 0 && (
        <div className="space-y-3">
          {items.map(obj => (
            <ObjectiveCard
              key={obj.id}
              obj={obj}
              interactions={interactions}
              expanded={expandedId === obj.id}
              onToggleExpand={() => setExpandedId(expandedId === obj.id ? null : obj.id)}
              onEdit={() => startEdit(obj)}
              onDelete={() => deleteObjective(obj.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Card (collapsed list item)
// ============================================================

function ObjectiveCard({
  obj, interactions, expanded, onToggleExpand, onEdit, onDelete,
}: {
  obj: ActivationObjective;
  interactions: ActivationInteraction[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const anchorLabel = ANCHOR_TYPES.find(a => a.value === obj.anchorEventType)?.label || obj.anchorEventType;
  return (
    <Card data-testid={`card-objective-${obj.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base truncate" data-testid={`text-objective-name-${obj.id}`}>{obj.displayName}</h3>
              {!obj.isActive && <Badge variant="secondary">Inactive</Badge>}
              <Badge variant="outline" className="text-[10px]">activation objective</Badge>
            </div>
            {obj.description && <p className="text-sm text-muted-foreground mb-3">{obj.description}</p>}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Anchor:</span> <span className="font-medium">{anchorLabel}</span>
                <span className="text-muted-foreground">({obj.anchorContextKey || "—"})</span>
              </span>
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Window:</span> <span className="font-medium">{obj.windowDays} days</span>
              </span>
              <span><span className="text-muted-foreground">Stages:</span> <span className="font-medium">{(obj.stages || []).length}</span></span>
              <span><span className="text-muted-foreground">Interactions:</span> <span className="font-medium">{(obj.interactions || []).length}</span></span>
              <span><span className="text-muted-foreground">Context key:</span> <span className="font-mono text-xs">{obj.interactionContextKey || "interaction_key"}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={onToggleExpand} data-testid={`button-toggle-${obj.id}`}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" onClick={onEdit} data-testid={`button-edit-${obj.id}`}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} data-testid={`button-delete-${obj.id}`}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <StagesPreview stages={obj.stages || []} achievedStageId={obj.achievedStageId} />
            <ThresholdsPreview thresholds={obj.thresholds || []} stages={obj.stages || []} interactions={interactions} />
            {obj.observationName && (
              <div className="text-sm">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Linked observation: {obj.observationName}
                </Label>
                <div className="mt-2 text-xs text-muted-foreground">
                  {(obj.stageMappings || []).filter(m => m.stageId).length} value{(obj.stageMappings || []).filter(m => m.stageId).length !== 1 ? "s" : ""} mapped to stages
                </div>
              </div>
            )}
            {(obj.interactions || []).length > 0 && (
              <div className="text-sm">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Configured interactions</Label>
                <div className="mt-2 space-y-1">
                  {obj.interactions.map(cfg => (
                    <div key={cfg.interactionId} className="flex items-center gap-3 text-sm">
                      <Badge variant="outline" className="font-mono text-[11px]">interaction #{cfg.interactionId}</Badge>
                      {cfg.isDefault && <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30 hover:bg-primary/15">default</Badge>}
                      {cfg.canResolveObjective && <Badge variant="secondary" className="text-[10px]">can resolve</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StagesPreview({ stages, achievedStageId }: { stages: Stage[]; achievedStageId: string }) {
  if (stages.length === 0) return null;
  return (
    <div>
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Progress stages — in order</Label>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {stages.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold ${s.id === achievedStageId ? "border-green-500 bg-green-50 text-green-700" : i === 0 ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>{i + 1}</div>
              <div className="text-center mt-1">
                <div className="text-xs font-medium">{s.displayName}</div>
                <div className="text-[10px] text-muted-foreground">{s.description}</div>
              </div>
            </div>
            {i < stages.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ThresholdsPreview({ thresholds, stages, interactions }: { thresholds: Threshold[]; stages: Stage[]; interactions: ActivationInteraction[] }) {
  const stageById = new Map(stages.map(s => [s.id, s.displayName]));
  const interactionById = new Map(interactions.map(x => [x.id, x.name]));
  if (thresholds.length === 0) {
    return (
      <div>
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">On-track threshold rules</Label>
        <div className="mt-2 text-xs text-muted-foreground italic border border-dashed rounded-md px-3 py-2">
          No threshold bands configured. Edit this objective to set up on-track / at-risk rules by days remaining.
        </div>
      </div>
    );
  }
  return (
    <div>
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">On-track threshold rules</Label>
      <div className="mt-2 border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
              <th className="px-3 py-2 font-medium">Call timing</th>
              <th className="px-3 py-2 font-medium">Days to target</th>
              <th className="px-3 py-2 font-medium">On-track stages</th>
              <th className="px-3 py-2 font-medium">Status labels</th>
            </tr>
          </thead>
          <tbody>
            {thresholds.map((t, i) => {
              const timing = bandTimingLabel(t.bandLabel);
              const expectedName = t.bandLabel !== "post_window" && t.expectedInteractionId != null
                ? interactionById.get(t.expectedInteractionId)
                : null;
              return (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{t.bandDisplayName || timing.label}</div>
                    <div className="text-xs text-muted-foreground">{timing.example}</div>
                    {expectedName && (
                      <div className="text-[10px] text-muted-foreground italic mt-0.5" data-testid={`text-band-expected-interaction-${t.bandLabel}`}>
                        typically: {expectedName}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="font-mono text-xs">{bandRangeLabel(t)}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {t.onTrackStageIds.length === 0
                        ? <span className="text-xs text-muted-foreground italic">none</span>
                        : t.onTrackStageIds.map(sid => (
                            <Badge key={sid} variant="secondary" className="text-xs">{stageById.get(sid) || sid}</Badge>
                          ))
                      }
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <Badge className="bg-green-100 text-green-800 border-green-300 mr-1">{t.satisfiedLabel}</Badge>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300">{t.unsatisfiedLabel}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Editor
// ============================================================

interface EditorProps {
  form: Omit<ActivationObjective, "id">;
  updateForm: (patch: Partial<Omit<ActivationObjective, "id">>) => void;
  contextParams: ContextParameter[];
  anchorContextOptions: ContextParameter[];
  interactions: ActivationInteraction[];
  observationTopics: ObservationTopic[];
  addStage: () => void;
  addUnresolvedStage: () => void;
  updateStage: (idx: number, patch: Partial<Stage>) => void;
  removeStage: (idx: number) => void;
  moveStage: (idx: number, dir: -1 | 1) => void;
  toggleThresholdStage: (idx: number, stageId: string) => void;
  updateThreshold: (idx: number, patch: Partial<Threshold>) => void;
  addDefaultBand: () => void;
  removeBand: (idx: number) => void;
  addInteractionConfig: (interactionId: number) => void;
  updateInteractionConfig: (idx: number, patch: Partial<ObjectiveInteractionConfig>) => void;
  removeInteractionConfig: (idx: number) => void;
  setMapping: (extractedValue: string, stageId: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  isNew: boolean;
  editorAiOpen: boolean;
  setEditorAiOpen: (open: boolean) => void;
}

// ============================================================
// Collapsible section wrapper (per-objective editor)
// ============================================================

const SECTION_IDS = [
  "basics",
  "target-date",
  "observation",
  "stages",
  "thresholds",
  "interaction-routing",
  "configured-interactions",
  "guidance",
] as const;
type SectionId = typeof SECTION_IDS[number];
const SECTION_STORAGE_KEY = "ao-editor-sections-open-v1";

function loadSectionsState(): Record<SectionId, boolean> {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(SECTION_STORAGE_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : {};
    return Object.fromEntries(SECTION_IDS.map(id => [id, parsed[id] !== false])) as Record<SectionId, boolean>;
  } catch {
    return Object.fromEntries(SECTION_IDS.map(id => [id, true])) as Record<SectionId, boolean>;
  }
}

function Section({
  id, title, subtitle, icon, right, open, onToggle, cardClassName, contentClassName, children,
}: {
  id: SectionId;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  cardClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cardClassName} data-testid={`section-${id}`}>
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex-1 min-w-0 text-left flex items-start gap-3 hover-elevate rounded-md -mx-1 px-1 py-0.5"
          data-testid={`section-toggle-${id}`}
        >
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base flex items-center gap-2">
              {icon}
              {title}
            </h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 mt-1 transition-transform text-muted-foreground ${open ? "rotate-180" : ""}`}
            data-testid={`section-chevron-${id}`}
          />
        </button>
        {right && (
          <div className="flex items-center gap-2 shrink-0">
            {right}
          </div>
        )}
      </div>
      {open && (
        <CardContent className={`pt-0 px-5 pb-5 ${contentClassName ?? "space-y-4"}`}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}

function ObjectiveEditor(p: EditorProps) {
  const [sectionsOpen, setSectionsOpen] = useState<Record<SectionId, boolean>>(loadSectionsState);

  // Derive the linked Observation's enum values once. These drive the
  // stage-mapping chips and the read-only previews. Empty array when no
  // observation is linked or the picked observation isn't enum-typed.
  const linkedObservation = useMemo(
    () => p.observationTopics.find(o => o.name === p.form.observationName) || null,
    [p.observationTopics, p.form.observationName]
  );
  const linkedObservationValues = useMemo<EnumValue[]>(() => {
    if (!linkedObservation || linkedObservation.valueType !== "enum") return [];
    if (!Array.isArray(linkedObservation.value)) return [];
    return (linkedObservation.value as EnumValue[]).map(v => ({
      label: v.label,
      color: v.color,
      promptHint: v.promptHint || "",
    }));
  }, [linkedObservation]);

  useEffect(() => {
    try { window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(sectionsOpen)); } catch {}
  }, [sectionsOpen]);
  const toggleSection = (id: SectionId) =>
    setSectionsOpen(prev => ({ ...prev, [id]: !prev[id] }));
  const setAllSections = (open: boolean) =>
    setSectionsOpen(Object.fromEntries(SECTION_IDS.map(id => [id, open])) as Record<SectionId, boolean>);
  const allOpen = SECTION_IDS.every(id => sectionsOpen[id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between sticky top-0 bg-background z-10 py-2 border-b">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-editor-title">
            {p.isNew ? "New activation objective" : `Edit: ${p.form.displayName || p.form.name}`}
          </h2>
          <p className="text-xs text-muted-foreground">Configure anchor, stages, on-track rules, and touchpoints.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAllSections(!allOpen)}
            data-testid="button-toggle-all-sections"
            title={allOpen ? "Collapse all sections" : "Expand all sections"}
          >
            {allOpen ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
          <Button
            variant="outline"
            onClick={() => p.setEditorAiOpen(!p.editorAiOpen)}
            disabled={p.saving}
            className={p.editorAiOpen ? "border-primary text-primary" : ""}
            data-testid="button-editor-ai-assistant"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {p.editorAiOpen ? "Hide AI Assistant" : "Enhance with AI"}
          </Button>
          <Button variant="outline" onClick={p.onCancel} disabled={p.saving} data-testid="button-cancel">
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button onClick={p.onSave} disabled={p.saving} data-testid="button-save">
            {p.saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      {/* Basics */}
      <Section
        id="basics"
        title="Basics"
        subtitle="Display name, internal name, description, and active status."
        open={sectionsOpen.basics}
        onToggle={() => toggleSection("basics")}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ao-display">Display name *</Label>
            <Input id="ao-display" value={p.form.displayName} onChange={e => p.updateForm({ displayName: e.target.value })}
              placeholder="PCP follow-up — activation objective" data-testid="input-display-name" />
          </div>
          <div>
            <Label htmlFor="ao-name">Internal name *</Label>
            <Input id="ao-name" value={p.form.name} onChange={e => p.updateForm({ name: e.target.value })}
              placeholder="pcp_followup_7day" data-testid="input-name" />
            <p className="text-[11px] text-muted-foreground mt-1">Snake_case identifier used in BigQuery and code.</p>
          </div>
        </div>
        <div>
          <Label htmlFor="ao-desc">Description</Label>
          <Input id="ao-desc" value={p.form.description} onChange={e => p.updateForm({ description: e.target.value })}
            placeholder="PCP follow-up attended within 7 days of discharge" data-testid="input-description" />
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={p.form.isActive} onCheckedChange={c => p.updateForm({ isActive: c })} data-testid="switch-active" />
          <Label>Active</Label>
        </div>
      </Section>

      {/* Target date */}
      <Section
        id="target-date"
        title="Target date — how it is calculated per patient"
        subtitle="Anchor event + window days = target date. Drives all on-track and progress metrics."
        open={sectionsOpen["target-date"]}
        onToggle={() => toggleSection("target-date")}
        cardClassName="border-2 border-blue-500/40 bg-blue-50/30 dark:bg-blue-950/10"
        right={<Badge variant="outline" className="bg-white dark:bg-background">activation objective</Badge>}
      >
        <div className="flex items-end gap-3 flex-wrap">
            <div className="min-w-[180px]">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Anchor event</Label>
              <Select value={p.form.anchorEventType} onValueChange={v => p.updateForm({ anchorEventType: v as AnchorEventType })}>
                <SelectTrigger data-testid="select-anchor-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANCHOR_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[220px]">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Anchor date source (context key) *</Label>
              <Select value={p.form.anchorContextKey} onValueChange={v => p.updateForm({ anchorContextKey: v })}>
                <SelectTrigger data-testid="select-anchor-key">
                  <SelectValue placeholder="Pick a context parameter..." />
                </SelectTrigger>
                <SelectContent>
                  {p.anchorContextOptions.length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      No date-type context parameters defined. <br />Add one in Context Parameters first.
                    </div>
                  )}
                  {p.anchorContextOptions.map(cp => (
                    <SelectItem key={cp.id} value={cp.name}>{cp.displayName} <span className="text-muted-foreground ml-2">({cp.name})</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {p.form.anchorContextKey && !p.anchorContextOptions.find(o => o.name === p.form.anchorContextKey) && (
                <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Currently set to "{p.form.anchorContextKey}" which is not a defined context parameter.
                </p>
              )}
            </div>
            <div className="text-2xl text-muted-foreground pb-2">+</div>
            <div className="w-24">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Window (days)</Label>
              <Input type="number" min={1} value={p.form.windowDays}
                onChange={e => p.updateForm({ windowDays: parseInt(e.target.value) || 1 })}
                data-testid="input-window-days" />
            </div>
            <div className="text-2xl text-muted-foreground pb-2">=</div>
            <div className="bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-sm font-medium">
              Target date<br /><span className="text-[10px] opacity-80 font-normal">PER PATIENT · DRIVES ALL METRICS</span>
            </div>
          </div>
      </Section>

      {/* Observation */}
      <Section
        id="observation"
        title={<><ClipboardCheck className="h-4 w-4 text-primary" /> Observation</>}
        subtitle="Link this objective to a standalone Observation. The Observation owns the value set, sentiment colors, and prompt hints — edit those on the Observations page. Stages below are assigned to each linked value."
        open={sectionsOpen.observation}
        onToggle={() => toggleSection("observation")}
      >
        <ObservationPicker
          observationName={p.form.observationName}
          observationTopics={p.observationTopics}
          onNameChange={(v) => {
            // When the linked observation changes, clear stage mappings that no
            // longer correspond to a value in the newly-picked observation.
            const next = p.observationTopics.find(o => o.name === v);
            const valid = next && next.valueType === "enum" && Array.isArray(next.value)
              ? new Set((next.value as { label: string }[]).map(x => x.label))
              : null;
            const cleaned = valid
              ? p.form.stageMappings.filter(m => valid.has(m.extractedValue))
              : p.form.stageMappings;
            p.updateForm({ observationName: v, stageMappings: cleaned });
          }}
        />
      </Section>

      {/* Stages */}
      <Section
        id="stages"
        title="Progress stages — in order"
        subtitle={`Stages represent advancement toward the objective. Pick which stage means "objective achieved", and assign observation values to the stages they signal.`}
        open={sectionsOpen.stages}
        onToggle={() => toggleSection("stages")}
        contentClassName="space-y-3"
        right={
          <Button size="sm" variant="outline" onClick={p.addStage} data-testid="button-add-stage">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add stage
          </Button>
        }
      >
          {/* Stage 0 — Unresolved (visually distinct, not a progress stage) */}
          {(() => {
            const u = p.form.stages.find(s => s.order === 0);
            const absIdx = u ? p.form.stages.findIndex(s => s.id === u.id) : -1;
            if (!u) {
              return (
                <div className="rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-2 flex items-center justify-between" data-testid="row-stage-unresolved-empty">
                  <p className="text-xs text-muted-foreground italic">No "Unresolved" bin — values like "Not discussed", "Unknown", or "Patient deferred" have nowhere to go.</p>
                  <Button size="sm" variant="outline" onClick={p.addUnresolvedStage} data-testid="button-add-unresolved">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Unresolved bin
                  </Button>
                </div>
              );
            }
            return (
              <div className="rounded-md border-2 border-dashed border-muted-foreground/40 bg-muted/30 p-2 flex flex-col gap-2" data-testid="row-stage-unresolved">
                <div className="flex items-center gap-2">
                  <div className="w-12 shrink-0" />
                  <div className="w-7 h-7 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center text-xs font-semibold text-muted-foreground bg-background">0</div>
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <Input value={u.name} onChange={e => p.updateStage(absIdx, { name: e.target.value })}
                      placeholder="snake_case_name" className="h-8 text-sm" data-testid="input-stage-name-unresolved" />
                    <Input value={u.displayName} onChange={e => p.updateStage(absIdx, { displayName: e.target.value })}
                      placeholder="Display name" className="h-8 text-sm" data-testid="input-stage-display-unresolved" />
                    <Input value={u.description} onChange={e => p.updateStage(absIdx, { description: e.target.value })}
                      placeholder="Sublabel (optional)" className="h-8 text-sm" data-testid="input-stage-desc-unresolved" />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => p.removeStage(absIdx)} data-testid="button-remove-stage-unresolved" title="Remove the Unresolved bin">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="ml-12 text-[11px] text-muted-foreground italic">
                  Patient remains in the denominator but no progress can be assigned. Triggers re-contact or call quality review.
                </div>
                {linkedObservationValues.length > 0 && (
                  <div className="ml-12 flex items-center gap-2 flex-wrap">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Observation values</Label>
                    {linkedObservationValues.map(v => {
                      const mapping = p.form.stageMappings.find(m => m.extractedValue === v.label);
                      const onThisStage = mapping?.stageId === u.id;
                      const onOtherStage = !!mapping?.stageId && mapping.stageId !== u.id;
                      const otherStageName = onOtherStage
                        ? p.form.stages.find(st => st.id === mapping?.stageId)?.displayName
                        : null;
                      const c = COLOR_MAP[v.color] || COLOR_MAP.GRAY;
                      return (
                        <button key={v.label} type="button"
                          onClick={() => p.setMapping(v.label, onThisStage ? "" : u.id)}
                          title={onOtherStage ? `Currently mapped to "${otherStageName}". Click to move here.` : undefined}
                          className={
                            "text-[11px] font-mono px-2 py-0.5 rounded-md border transition-colors " +
                            (onThisStage
                              ? c.chipActive
                              : onOtherStage
                                ? `${c.bg} ${c.text} border-dashed ${c.border} opacity-60 hover:opacity-100`
                                : `${c.bg} ${c.text} ${c.border} hover:opacity-80`)
                          }
                          data-testid={`chip-stage-value-unresolved-${v.label}`}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* System stages: "Not discussed" + "Excluded". Both auto-injected
              by the server on every objective. The stage definitions can't be
              renamed or removed, but observation values from the linked
              Observation CAN be mapped to either (e.g. "Patient declined" →
              Not discussed, or "Hospice / palliative" → Excluded). Rendered
              with a small loop so they share the same chip-mapping pattern. */}
          {([
            { id: "stage_not_discussed", testId: "not-discussed", description: 'Built-in baseline stage on every objective. Captures calls where the topic was never raised — distinct from "Unresolved" (raised but unclear). The model returns "Not discussed" automatically when the topic isn\'t mentioned; you can also map other observation values here (e.g. "Patient declined").' },
            { id: "stage_excluded", testId: "excluded", description: 'Built-in baseline stage. The model never returns "Excluded" automatically — only observation values you map here will route to it. Use this for values that should drop the patient out of the objective\'s denominator entirely (e.g. "Hospice / palliative", "Patient deceased", "Plan does not cover").' },
          ] as const).map(({ id, testId, description }) => {
            const sys = p.form.stages.find(s => s.id === id);
            if (!sys) return null;
            return (
              <div key={id} className="rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-2 flex flex-col gap-2" data-testid={`row-stage-${testId}`}>
                <div className="flex items-center gap-2">
                  <div className="w-12 shrink-0" />
                  <div className="w-7 h-7 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-xs font-semibold text-muted-foreground bg-background">0</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{sys.displayName}</span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">System</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground italic mt-0.5">
                      {description}
                    </div>
                  </div>
                </div>
                {linkedObservationValues.length > 0 && (
                  <div className="ml-12 flex items-center gap-2 flex-wrap">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Observation values</Label>
                    {linkedObservationValues.map(v => {
                      const mapping = p.form.stageMappings.find(m => m.extractedValue === v.label);
                      const onThisStage = mapping?.stageId === sys.id;
                      const onOtherStage = !!mapping?.stageId && mapping.stageId !== sys.id;
                      const otherStageName = onOtherStage
                        ? p.form.stages.find(st => st.id === mapping?.stageId)?.displayName
                        : null;
                      const c = COLOR_MAP[v.color] || COLOR_MAP.GRAY;
                      return (
                        <button key={v.label} type="button"
                          onClick={() => p.setMapping(v.label, onThisStage ? "" : sys.id)}
                          title={onOtherStage ? `Currently mapped to "${otherStageName}". Click to move here.` : undefined}
                          className={
                            "text-[11px] font-mono px-2 py-0.5 rounded-md border transition-colors " +
                            (onThisStage
                              ? c.chipActive
                              : onOtherStage
                                ? `${c.bg} ${c.text} border-dashed ${c.border} opacity-60 hover:opacity-100`
                                : `${c.bg} ${c.text} ${c.border} hover:opacity-80`)
                          }
                          data-testid={`chip-stage-value-${testId}-${v.label}`}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Progress stages (order > 0) */}
          <div className="space-y-2">
            {p.form.stages.map((s, absIdx) => {
              if (s.order === 0) return null;
              const progress = p.form.stages.filter(x => x.order > 0).sort((a, b) => a.order - b.order);
              const pIdx = progress.findIndex(x => x.id === s.id);
              const isFirstProgress = pIdx === 0;
              const isLastProgress = pIdx === progress.length - 1;
              return (
                <div key={s.id} className="flex flex-col gap-2 p-2 rounded-md border bg-card" data-testid={`row-stage-${absIdx}`}>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => p.moveStage(absIdx, -1)} disabled={isFirstProgress}>
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => p.moveStage(absIdx, 1)} disabled={isLastProgress}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="w-7 h-7 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center text-xs font-semibold">{s.order}</div>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <Input value={s.name} onChange={e => p.updateStage(absIdx, { name: e.target.value })}
                        placeholder="snake_case_name" className="h-8 text-sm" data-testid={`input-stage-name-${absIdx}`} />
                      <Input value={s.displayName} onChange={e => p.updateStage(absIdx, { displayName: e.target.value })}
                        placeholder="Display name" className="h-8 text-sm" data-testid={`input-stage-display-${absIdx}`} />
                      <Input value={s.description} onChange={e => p.updateStage(absIdx, { description: e.target.value })}
                        placeholder="Sublabel (optional)" className="h-8 text-sm" data-testid={`input-stage-desc-${absIdx}`} />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => p.removeStage(absIdx)} data-testid={`button-remove-stage-${absIdx}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  {linkedObservationValues.length > 0 && (
                    <div className="ml-12 flex items-center gap-2 flex-wrap">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Observation values</Label>
                      {linkedObservationValues.map(v => {
                        const mapping = p.form.stageMappings.find(m => m.extractedValue === v.label);
                        const onThisStage = mapping?.stageId === s.id;
                        const onOtherStage = !!mapping?.stageId && mapping.stageId !== s.id;
                        const otherStageName = onOtherStage
                          ? p.form.stages.find(st => st.id === mapping?.stageId)?.displayName
                          : null;
                        const c = COLOR_MAP[v.color] || COLOR_MAP.GRAY;
                        return (
                          <button
                            key={v.label}
                            type="button"
                            onClick={() => p.setMapping(v.label, onThisStage ? "" : s.id)}
                            title={onOtherStage ? `Currently mapped to "${otherStageName}". Click to move here.` : undefined}
                            className={
                              "text-[11px] font-mono px-2 py-0.5 rounded-md border transition-colors " +
                              (onThisStage
                                ? c.chipActive
                                : onOtherStage
                                  ? `${c.bg} ${c.text} border-dashed ${c.border} opacity-60 hover:opacity-100`
                                  : `${c.bg} ${c.text} ${c.border} hover:opacity-80`)
                            }
                            data-testid={`chip-stage-value-${absIdx}-${v.label}`}
                          >
                            {v.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t flex items-center gap-2">
            <Label className="text-sm">Objective achieved when stage =</Label>
            <Select value={p.form.achievedStageId} onValueChange={v => p.updateForm({ achievedStageId: v })}>
              <SelectTrigger className="w-64 h-8" data-testid="select-achieved-stage"><SelectValue /></SelectTrigger>
              <SelectContent>
                {p.form.stages.filter(s => s.order > 0).sort((a, b) => a.order - b.order).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
      </Section>

      {/* Thresholds */}
      <Section
        id="thresholds"
        title="On-track threshold rules — by days remaining to target date"
        subtitle="Days remaining = target date − call date. Rules apply to every touchpoint for this objective."
        open={sectionsOpen.thresholds}
        onToggle={() => toggleSection("thresholds")}
        contentClassName="space-y-3"
      >
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-3 py-2 font-medium">Band</th>
                  <th className="px-3 py-2 font-medium">Days remaining (min / max)</th>
                  <th className="px-3 py-2 font-medium">Stages that count as on track</th>
                  <th className="px-3 py-2 font-medium">Satisfied label</th>
                  <th className="px-3 py-2 font-medium">Unsatisfied label</th>
                </tr>
              </thead>
              <tbody>
                {p.form.thresholds.map((t, i) => {
                  const timing = bandTimingLabel(t.bandLabel);
                  const isDefault = t.bandLabel === "default";
                  const isPostWindow = t.bandLabel === "post_window";
                  const expectedId = t.expectedInteractionId ?? null;
                  return (
                    <tr key={t.bandLabel} className={`border-t ${isDefault ? "bg-primary/5" : ""}`} data-testid={`row-threshold-${t.bandLabel}`}>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{t.bandDisplayName || timing.label}</div>
                          {isDefault && (
                            <Button size="icon" variant="ghost" className="h-5 w-5"
                              onClick={() => p.removeBand(i)}
                              data-testid={`button-remove-band-${t.bandLabel}`}>
                              <X className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{timing.example}</div>
                        {!isPostWindow && (
                          <div className="mt-2">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Typically</Label>
                            <Select
                              value={expectedId === null ? "__none__" : String(expectedId)}
                              onValueChange={(v) => p.updateThreshold(i, { expectedInteractionId: v === "__none__" ? null : parseInt(v) })}
                            >
                              <SelectTrigger className="h-7 text-xs mt-0.5" data-testid={`select-band-expected-interaction-${t.bandLabel}`}>
                                <SelectValue placeholder="No hint" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__"><span className="text-muted-foreground italic">No hint</span></SelectItem>
                                {p.interactions.filter(x => x.isActive && x.interactionType !== "continuous").map(x => (
                                  <SelectItem key={x.id} value={String(x.id)}>{x.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground mt-0.5 italic">Display only — does not affect routing.</p>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {isDefault ? (
                          <Badge variant="outline" className="text-[11px]">Any days · fallback</Badge>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              <Input type="number" placeholder="min" value={t.daysRemainingMin ?? ""}
                                onChange={e => p.updateThreshold(i, { daysRemainingMin: e.target.value === "" ? null : parseInt(e.target.value) })}
                                className="w-16 h-7 text-xs" data-testid={`input-threshold-min-${t.bandLabel}`} />
                              <span className="text-muted-foreground">/</span>
                              <Input type="number" placeholder="max" value={t.daysRemainingMax ?? ""}
                                onChange={e => p.updateThreshold(i, { daysRemainingMax: e.target.value === "" ? null : parseInt(e.target.value) })}
                                className="w-16 h-7 text-xs" data-testid={`input-threshold-max-${t.bandLabel}`} />
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1">{bandRangeLabel(t)}</div>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {t.bandLabel === "post_window" ? (
                          <div className="space-y-1">
                            <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                              {p.form.stages.find(s => s.id === p.form.achievedStageId)?.displayName || "achieved stage"}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground italic">Auto-locked to the achieved stage. Past target date, only the objective being achieved counts as on-track.</p>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {p.form.stages.filter(s => s.order > 0).sort((a, b) => a.order - b.order).map(s => {
                              const active = t.onTrackStageIds.includes(s.id);
                              return (
                                <button key={s.id} type="button"
                                  onClick={() => p.toggleThresholdStage(i, s.id)}
                                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
                                  data-testid={`button-threshold-stage-${t.bandLabel}-${s.id}`}>
                                  {s.displayName}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Input value={t.satisfiedLabel} onChange={e => p.updateThreshold(i, { satisfiedLabel: e.target.value })}
                          className="h-7 text-xs w-28" data-testid={`input-threshold-satisfied-${t.bandLabel}`} />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Input value={t.unsatisfiedLabel} onChange={e => p.updateThreshold(i, { unsatisfiedLabel: e.target.value })}
                          className="h-7 text-xs w-28" data-testid={`input-threshold-unsatisfied-${t.bandLabel}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!p.form.thresholds.some(t => t.bandLabel === "default") && (
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={p.addDefaultBand} data-testid="button-add-default-band">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add default band
              </Button>
              <p className="text-[11px] text-muted-foreground">A fallback band with no day range — applied when no day-bound band matches (e.g. anchor date not provided in the request).</p>
            </div>
          )}
      </Section>

      {/* Interaction routing */}
      <Section
        id="interaction-routing"
        title={<><MessageSquare className="h-4 w-4 text-primary" /> Interaction routing</>}
        subtitle="Each call carries an interaction key in the API request context. The matching configured interaction below decides how this objective is extracted."
        open={sectionsOpen["interaction-routing"]}
        onToggle={() => toggleSection("interaction-routing")}
        cardClassName="border-2 border-[#96d410]/40 bg-[#96d410]/5"
        contentClassName="space-y-3"
      >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Interaction context key *</Label>
              <Input value={p.form.interactionContextKey}
                onChange={e => p.updateForm({ interactionContextKey: e.target.value })}
                placeholder="interaction_key" data-testid="input-interaction-context-key" />
              <p className="text-[11px] text-muted-foreground mt-1">Name of the request context field that carries the interaction key (default <code className="font-mono">interaction_key</code>).</p>
            </div>
            <div className="text-xs text-muted-foreground">
              <Link href="/activation-interactions">
                <span className="text-primary hover:underline cursor-pointer">Manage activation interactions →</span>
              </Link>
            </div>
          </div>
      </Section>

      {/* Configured interactions */}
      <Section
        id="configured-interactions"
        title="Configured interactions"
        subtitle="Pick which interactions this objective should be extracted from, and how each one maps to the progress stages."
        open={sectionsOpen["configured-interactions"]}
        onToggle={() => toggleSection("configured-interactions")}
        contentClassName="space-y-3"
        right={
          <AddInteractionPicker
            interactions={p.interactions}
            configured={p.form.interactions}
            onAdd={p.addInteractionConfig}
          />
        }
      >
          {p.interactions.length === 0 && (
            <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
              No activation interactions defined for this pathway yet.{" "}
              <Link href="/activation-interactions">
                <span className="text-primary hover:underline cursor-pointer">Create some first →</span>
              </Link>
            </div>
          )}

          {p.interactions.length > 0 && p.form.interactions.length === 0 && (
            <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
              No interactions configured yet. Use the picker above to add one.
            </div>
          )}

          {p.form.interactions.map((cfg, idx) => {
            const interaction = p.interactions.find(i => i.id === cfg.interactionId);
            return (
              <InteractionConfigEditor
                key={cfg.interactionId}
                cfg={cfg}
                idx={idx}
                interaction={interaction}
                observationTopics={p.observationTopics}
                update={(patch) => p.updateInteractionConfig(idx, patch)}
                onRemove={() => p.removeInteractionConfig(idx)}
              />
            );
          })}
      </Section>

      {/* Always-extract observation topics */}
      <Section
        id="guidance"
        title="Always-extract observation topics (objective fallback)"
        subtitle="Topics extracted on every call for this objective, even when no interaction matches."
        open={sectionsOpen.guidance}
        onToggle={() => toggleSection("guidance")}
      >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Always-extract observation topics (objective fallback)</Label>
              {(p.form.observationTopicIds || []).length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{(p.form.observationTopicIds || []).length} selected</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">These observation topics are extracted on every call where this objective is configured — even when no interaction is matched (e.g. an ad-hoc follow-up call). Topics selected here are merged with any per-interaction topics below.</p>
            {p.observationTopics.filter(t => t.isActive).length === 0 ? (
              <p className="text-xs italic text-muted-foreground">No observation topics defined for this client pathway yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {p.observationTopics.filter(t => t.isActive).map(topic => {
                  const active = (p.form.observationTopicIds || []).includes(topic.id);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => {
                        const current = p.form.observationTopicIds || [];
                        const next = current.includes(topic.id)
                          ? current.filter(id => id !== topic.id)
                          : [...current, topic.id];
                        p.updateForm({ observationTopicIds: next });
                      }}
                      data-testid={`chip-objective-topic-${topic.id}`}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {topic.displayName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
      </Section>
    </div>
  );
}

// ============================================================
// Add interaction picker
// ============================================================

function AddInteractionPicker({
  interactions, configured, onAdd,
}: {
  interactions: ActivationInteraction[];
  configured: ObjectiveInteractionConfig[];
  onAdd: (id: number) => void;
}) {
  const configuredIds = new Set(configured.map(c => c.interactionId));
  // Continuous interactions are not evaluated against this objective's window, so they're not configurable per-objective.
  const available = interactions.filter(i => !configuredIds.has(i.id) && i.isActive && i.interactionType !== "continuous");
  const [pendingId, setPendingId] = useState<string>("");

  if (interactions.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Select value={pendingId} onValueChange={setPendingId}>
        <SelectTrigger className="w-64 h-9" data-testid="select-add-interaction">
          <SelectValue placeholder={available.length === 0 ? "All interactions configured" : "Pick an interaction..."} />
        </SelectTrigger>
        <SelectContent>
          {available.map(i => (
            <SelectItem key={i.id} value={String(i.id)}>
              {i.name} <span className="text-muted-foreground ml-1 text-xs">({i.key})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        disabled={!pendingId}
        onClick={() => {
          const id = parseInt(pendingId);
          if (!isNaN(id)) {
            onAdd(id);
            setPendingId("");
          }
        }}
        data-testid="button-add-interaction"
      >
        <Plus className="h-3.5 w-3.5 mr-1" /> Add
      </Button>
    </div>
  );
}

// ============================================================
// Interaction editor (per-objective inclusion/resolve config)
// ============================================================

function InteractionConfigEditor({
  cfg, idx, interaction, observationTopics, update, onRemove,
}: {
  cfg: ObjectiveInteractionConfig;
  idx: number;
  interaction: ActivationInteraction | undefined;
  observationTopics: ObservationTopic[];
  update: (patch: Partial<ObjectiveInteractionConfig>) => void;
  onRemove: () => void;
}) {
  function toggleTopic(topicId: number) {
    const current = cfg.observationTopicIds || [];
    const next = current.includes(topicId)
      ? current.filter(id => id !== topicId)
      : [...current, topicId];
    update({ observationTopicIds: next });
  }
  const activeTopics = observationTopics.filter(t => t.isActive);
  return (
    <div className="border rounded-md p-4 space-y-3 bg-muted/20" data-testid={`card-interaction-config-${idx}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Interaction</Label>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {interaction ? (
                <>
                  <span className="font-semibold text-sm">{interaction.name}</span>
                  <Badge variant="outline" className="font-mono text-[11px]">{interaction.key}</Badge>
                  {interaction.expectedDayOffset != null && (
                    <Badge variant="secondary" className="text-[11px]">Day {interaction.expectedDayOffset}</Badge>
                  )}
                  {!interaction.isActive && <Badge variant="secondary">Inactive</Badge>}
                </>
              ) : (
                <span className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Interaction #{cfg.interactionId} not found (was it deleted?)
                </span>
              )}
            </div>
            {interaction?.description && (
              <p className="text-[11px] text-muted-foreground mt-1">{interaction.description}</p>
            )}
          </div>
          <div className="pt-5 space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <Switch checked={cfg.isDefault}
                  onCheckedChange={c => update({ isDefault: c })} data-testid={`switch-cfg-default-${idx}`} />
                <Label className="text-sm">Use as default interaction</Label>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">When the request's interaction key is missing or doesn't match a configured interaction, fall back to this one. Only one default per objective.</p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Switch checked={cfg.canResolveObjective}
                  onCheckedChange={c => update({ canResolveObjective: c })} data-testid={`switch-cfg-resolves-${idx}`} />
                <Label className="text-sm">Can resolve objective</Label>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Enable for terminal interactions (e.g. on or after the target date) where the call's extracted stage is the final answer for the objective.</p>
            </div>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onRemove} data-testid={`button-remove-cfg-${idx}`}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Inclusion rules</Label>
          <div className="space-y-1.5 mt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={cfg.inclusionRules.requirePcpAssigned}
                onChange={e => update({ inclusionRules: { ...cfg.inclusionRules, requirePcpAssigned: e.target.checked } })}
                data-testid={`check-cfg-require-pcp-${idx}`} />
              Require PCP assigned
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={cfg.inclusionRules.requireCompletedWithPatientOrCaregiver}
                onChange={e => update({ inclusionRules: { ...cfg.inclusionRules, requireCompletedWithPatientOrCaregiver: e.target.checked } })}
                data-testid={`check-cfg-require-completed-${idx}`} />
              Require call completed with patient or caregiver
            </label>
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Interaction prompt guidance (optional)</Label>
          <Textarea value={cfg.promptGuidance}
            onChange={e => update({ promptGuidance: e.target.value })} rows={3}
            className="text-sm mt-1" placeholder="Specific cues for this interaction..."
            data-testid={`textarea-cfg-guidance-${idx}`} />
        </div>
      </div>

      <div className="pt-2 border-t">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Observation topics to extract on this interaction</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">For each call routed to this interaction, the model will also extract values for the selected observation topics — shown alongside the objective on the call details page.</p>
          </div>
          {(cfg.observationTopicIds || []).length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{(cfg.observationTopicIds || []).length} selected</Badge>
          )}
        </div>
        {activeTopics.length === 0 ? (
          <div className="text-[11px] text-muted-foreground border border-dashed rounded-md p-3 text-center">
            No active observation topics for this pathway. <Link href="/observations"><span className="text-primary hover:underline cursor-pointer">Create some first →</span></Link>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {activeTopics.map(topic => {
              const active = (cfg.observationTopicIds || []).includes(topic.id);
              return (
                <button key={topic.id} type="button"
                  onClick={() => toggleTopic(topic.id)}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
                  data-testid={`button-cfg-topic-${idx}-${topic.id}`}>
                  {topic.displayName}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Observation picker — link the objective to a standalone Observation.
// The picked Observation owns the enum value set + per-value prompt hints +
// observation-level prompt guidance. This editor is a read-only preview.
// To edit the values themselves, the user goes to the Observations page.
// ============================================================

function ObservationPicker({
  observationName, observationTopics, onNameChange,
}: {
  observationName: string;
  observationTopics: ObservationTopic[];
  onNameChange: (v: string) => void;
}) {
  const NONE_VALUE = "__none__";
  const linked = observationTopics.find(o => o.name === observationName) || null;
  const enumValues: EnumValue[] = (linked && linked.valueType === "enum" && Array.isArray(linked.value))
    ? linked.value.map(v => ({ label: v.label, color: v.color, promptHint: v.promptHint || "" }))
    : [];
  const guidance = (linked?.promptGuidance || "").trim();

  return (
    <div className="space-y-4" data-testid="card-observation">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Linked observation</Label>
        <Select
          value={observationName || NONE_VALUE}
          onValueChange={(v) => onNameChange(v === NONE_VALUE ? "" : v)}
        >
          <SelectTrigger className="h-9 text-sm mt-1 max-w-md" data-testid="select-observation-name">
            <SelectValue placeholder="Pick an observation..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>— None (no linked observation) —</SelectItem>
            {observationTopics.filter(o => o.isActive).map(o => (
              <SelectItem key={o.id} value={o.name}>
                {o.displayName} <span className="text-muted-foreground ml-2">({o.name})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {observationName && !linked && (
          <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Linked to "{observationName}" which is not in this pathway's observations.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">
          Observations are defined on the <Link href="/observations" className="text-primary underline">Observations page</Link>.
          The values, sentiment colors, and prompt hints below are owned by the observation — to change them, edit the observation itself.
        </p>
      </div>

      {linked && (
        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="outline" className="text-[10px]">{linked.valueType || "enum"}</Badge>
            {linked.domain && <Badge variant="outline" className="text-[10px]">{linked.domain}</Badge>}
            {linked.description && (
              <span className="text-muted-foreground">{linked.description}</span>
            )}
          </div>

          {enumValues.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              This observation has no enum values defined yet. Add some on the Observations page so they can be mapped to stages.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Values & prompt hints (read-only)</Label>
              {enumValues.map(v => {
                const c = COLOR_MAP[v.color] || COLOR_MAP.GRAY;
                return (
                  <div key={v.label} className="flex items-start gap-2" data-testid={`row-linked-value-${v.label}`}>
                    <span className={`w-3 h-3 rounded-full shrink-0 border mt-1 ${c.bg} ${c.border}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono">{v.label}</div>
                      {v.promptHint && (
                        <div className="text-[11px] text-muted-foreground italic">{v.promptHint}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {guidance && (
            <div className="pt-2 border-t space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Observation prompt guidance (read-only)</Label>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{guidance}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
