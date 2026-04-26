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
  ArrowUp, ArrowDown,
} from "lucide-react";
import { Link } from "wouter";
import { useClientPathway } from "@/contexts/ClientPathwayContext";

type AnchorEventType = "discharge" | "enrollment" | "procedure" | "custom";
type BandLabel = "early" | "near_window" | "at_window" | "post_window";
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
}

interface ActivationInteraction {
  id: number;
  clientPathwayId: number;
  key: string;
  name: string;
  description: string;
  expectedDayOffset: number | null;
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
  extractedEnumValues: EnumValue[];
  stageMappings: StageMapping[];
  interactions: ObjectiveInteractionConfig[];
  interactionContextKey: string;
  isActive: boolean;
  displayOrder: number;
  promptGuidance: string;
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

const DEFAULT_THRESHOLDS = (stages: Stage[]): Threshold[] => {
  const last = stages[stages.length - 1]?.id || "";
  const middleAndLast = stages.slice(1).map(s => s.id);
  return [
    { bandLabel: "early", bandDisplayName: "Early", daysRemainingMin: 3, daysRemainingMax: null, onTrackStageIds: middleAndLast, satisfiedLabel: "On track", unsatisfiedLabel: "At risk" },
    { bandLabel: "near_window", bandDisplayName: "Near window", daysRemainingMin: 1, daysRemainingMax: 2, onTrackStageIds: last ? [last] : [], satisfiedLabel: "On track", unsatisfiedLabel: "At risk" },
    { bandLabel: "at_window", bandDisplayName: "At window", daysRemainingMin: 0, daysRemainingMax: 0, onTrackStageIds: last ? [last] : [], satisfiedLabel: "On track", unsatisfiedLabel: "At risk" },
    { bandLabel: "post_window", bandDisplayName: "Post window", daysRemainingMin: null, daysRemainingMax: -1, onTrackStageIds: last ? [last] : [], satisfiedLabel: "Achieved", unsatisfiedLabel: "Not achieved" },
  ];
};

function emptyForm(): Omit<ActivationObjective, "id"> {
  const stages: Stage[] = [
    { id: "stage_1", name: "not_scheduled", displayName: "Not scheduled", description: "no progress", order: 1 },
    { id: "stage_2", name: "scheduled", displayName: "Scheduled", description: "in progress", order: 2 },
    { id: "stage_3", name: "attended", displayName: "Attended", description: "objective achieved", order: 3 },
  ];
  return {
    name: "",
    displayName: "",
    description: "",
    anchorEventType: "discharge",
    anchorContextKey: "",
    windowDays: 7,
    stages,
    achievedStageId: "stage_3",
    thresholds: DEFAULT_THRESHOLDS(stages),
    observationName: "",
    extractedEnumValues: [],
    stageMappings: [],
    interactions: [],
    interactionContextKey: "interaction_key",
    isActive: true,
    displayOrder: 0,
    promptGuidance: "",
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
  }
}

export default function ActivationObjectives() {
  const { selectedCPId } = useClientPathway();
  const { toast } = useToast();
  const [items, setItems] = useState<ActivationObjective[]>([]);
  const [contextParams, setContextParams] = useState<ContextParameter[]>([]);
  const [interactions, setInteractions] = useState<ActivationInteraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<Omit<ActivationObjective, "id">>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
      const [r1, r2, r3] = await Promise.all([
        fetch(`/api/activation-objectives?clientPathwayId=${selectedCPId}`),
        fetch(`/api/context-parameters?clientPathwayId=${selectedCPId}`),
        fetch(`/api/activation-interactions?clientPathwayId=${selectedCPId}`),
      ]);
      if (r1.ok) setItems(await r1.json());
      if (r2.ok) setContextParams(await r2.json());
      if (r3.ok) setInteractions(await r3.json());
    } catch (err: any) {
      toast({ title: "Failed to load", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setForm(emptyForm());
    setEditingId("new");
    setExpandedId(null);
  }

  function startEdit(obj: ActivationObjective) {
    const { id, ...rest } = obj;
    setForm({
      ...rest,
      stages: rest.stages || [],
      thresholds: rest.thresholds || [],
      interactions: rest.interactions || [],
      interactionContextKey: rest.interactionContextKey || "interaction_key",
    });
    setEditingId(id);
    setExpandedId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
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
    // Validate every extracted enum value has a stage mapping (objective-level observation)
    {
      const unmapped = form.extractedEnumValues.filter(v => !form.stageMappings.find(m => m.extractedValue === v.label && m.stageId));
      if (unmapped.length > 0) {
        toast({
          title: "Observation has unmapped values",
          description: `Pick a stage for: ${unmapped.map(v => v.label).join(", ")}`,
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
    const nextOrder = (form.stages[form.stages.length - 1]?.order || 0) + 1;
    const newId = `stage_${Date.now()}`;
    const newStage: Stage = { id: newId, name: `stage_${nextOrder}`, displayName: `Stage ${nextOrder}`, description: "", order: nextOrder };
    updateForm({ stages: [...form.stages, newStage] });
  }

  function updateStage(idx: number, patch: Partial<Stage>) {
    const next = form.stages.map((s, i) => i === idx ? { ...s, ...patch } : s);
    updateForm({ stages: next });
  }

  function removeStage(idx: number) {
    const removed = form.stages[idx];
    if (!removed) return;
    if (form.stages.length <= 1) {
      toast({ title: "Cannot remove", description: "At least one stage is required.", variant: "destructive" });
      return;
    }
    const next = form.stages.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }));
    const newAchieved = form.achievedStageId === removed.id
      ? next[next.length - 1]?.id || ""
      : form.achievedStageId;
    const newThresholds = form.thresholds.map(t => ({
      ...t,
      onTrackStageIds: t.onTrackStageIds.filter(id => id !== removed.id),
    }));
    const newStageMappings = form.stageMappings.filter(m => m.stageId !== removed.id);
    updateForm({ stages: next, achievedStageId: newAchieved, thresholds: newThresholds, stageMappings: newStageMappings });
  }

  function moveStage(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= form.stages.length) return;
    const next = [...form.stages];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    next.forEach((s, i) => s.order = i + 1);
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

  function addInteractionConfig(interactionId: number) {
    if (form.interactions.some(c => c.interactionId === interactionId)) return;
    const cfg: ObjectiveInteractionConfig = {
      interactionId,
      isDefault: false,
      canResolveObjective: false,
      inclusionRules: { requirePcpAssigned: false, requireCompletedWithPatientOrCaregiver: true, customRules: [] },
      promptGuidance: "",
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

  function setExtractedValueLabel(oldLabel: string, newLabel: string) {
    const trimmed = newLabel.trim();
    if (!trimmed || trimmed === oldLabel) return;
    if (form.extractedEnumValues.some(v => v.label === trimmed)) {
      toast({
        title: "Duplicate value",
        description: `"${trimmed}" already exists. Pick a different label.`,
        variant: "destructive",
      });
      return;
    }
    updateForm({
      extractedEnumValues: form.extractedEnumValues.map(v =>
        v.label === oldLabel ? { ...v, label: trimmed } : v
      ),
      stageMappings: form.stageMappings.map(m =>
        m.extractedValue === oldLabel ? { ...m, extractedValue: trimmed } : m
      ),
    });
  }

  function setExtractedValueHint(label: string, hint: string) {
    updateForm({
      extractedEnumValues: form.extractedEnumValues.map(v =>
        v.label === label ? { ...v, promptHint: hint } : v
      ),
    });
  }

  function moveExtractedValue(label: string, dir: "up" | "down") {
    const list = [...form.extractedEnumValues];
    const i = list.findIndex(v => v.label === label);
    if (i < 0) return;
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    updateForm({ extractedEnumValues: list });
  }

  function addExtractedValue(label: string, color: EnumColor = "GRAY") {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (form.extractedEnumValues.find(v => v.label === trimmed)) return;
    updateForm({ extractedEnumValues: [...form.extractedEnumValues, { label: trimmed, color, promptHint: "" }] });
  }

  function removeExtractedValue(label: string) {
    updateForm({
      extractedEnumValues: form.extractedEnumValues.filter(v => v.label !== label),
      stageMappings: form.stageMappings.filter(m => m.extractedValue !== label),
    });
  }

  function setExtractedValueColor(label: string, color: EnumColor) {
    updateForm({
      extractedEnumValues: form.extractedEnumValues.map(v => v.label === label ? { ...v, color } : v),
    });
  }

  function setMapping(extractedValue: string, stageId: string) {
    const exists = form.stageMappings.some(m => m.extractedValue === extractedValue);
    const newMappings = exists
      ? form.stageMappings.map(m => m.extractedValue === extractedValue ? { ...m, stageId } : m)
      : [...form.stageMappings, { extractedValue, stageId }];
    updateForm({ stageMappings: newMappings });
  }

  // ----------------------------------------

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
          <Button onClick={startNew} data-testid="button-new-objective">
            <Plus className="h-4 w-4 mr-2" /> New Objective
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
        </div>
      )}

      {isEditing && (
        <ObjectiveEditor
          form={form}
          updateForm={updateForm}
          contextParams={contextParams}
          anchorContextOptions={anchorContextOptions}
          interactions={interactions}
          addStage={addStage}
          updateStage={updateStage}
          removeStage={removeStage}
          moveStage={moveStage}
          toggleThresholdStage={toggleThresholdStage}
          updateThreshold={updateThreshold}
          addInteractionConfig={addInteractionConfig}
          updateInteractionConfig={updateInteractionConfig}
          removeInteractionConfig={removeInteractionConfig}
          addExtractedValue={addExtractedValue}
          removeExtractedValue={removeExtractedValue}
          setExtractedValueColor={setExtractedValueColor}
          setExtractedValueLabel={setExtractedValueLabel}
          setExtractedValueHint={setExtractedValueHint}
          moveExtractedValue={moveExtractedValue}
          setMapping={setMapping}
          onCancel={cancelEdit}
          onSave={saveForm}
          saving={saving}
          isNew={editingId === "new"}
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
  obj, expanded, onToggleExpand, onEdit, onDelete,
}: {
  obj: ActivationObjective;
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
            <ThresholdsPreview thresholds={obj.thresholds || []} stages={obj.stages || []} />
            {(obj.extractedEnumValues || []).length > 0 && (
              <div className="text-sm">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Observation{obj.observationName ? `: ${obj.observationName}` : ""}
                </Label>
                <div className="mt-2 text-xs text-muted-foreground">
                  {obj.extractedEnumValues.length} value{obj.extractedEnumValues.length !== 1 ? "s" : ""} · {(obj.stageMappings || []).filter(m => m.stageId).length} mapped to stages
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

function ThresholdsPreview({ thresholds, stages }: { thresholds: Threshold[]; stages: Stage[] }) {
  if (thresholds.length === 0) return null;
  const stageById = new Map(stages.map(s => [s.id, s.displayName]));
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
              return (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{t.bandDisplayName || timing.label}</div>
                    <div className="text-xs text-muted-foreground">{timing.example}</div>
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
  addStage: () => void;
  updateStage: (idx: number, patch: Partial<Stage>) => void;
  removeStage: (idx: number) => void;
  moveStage: (idx: number, dir: -1 | 1) => void;
  toggleThresholdStage: (idx: number, stageId: string) => void;
  updateThreshold: (idx: number, patch: Partial<Threshold>) => void;
  addInteractionConfig: (interactionId: number) => void;
  updateInteractionConfig: (idx: number, patch: Partial<ObjectiveInteractionConfig>) => void;
  removeInteractionConfig: (idx: number) => void;
  addExtractedValue: (label: string, color?: EnumColor) => void;
  removeExtractedValue: (label: string) => void;
  setExtractedValueColor: (label: string, color: EnumColor) => void;
  setExtractedValueLabel: (oldLabel: string, newLabel: string) => void;
  setExtractedValueHint: (label: string, hint: string) => void;
  moveExtractedValue: (label: string, dir: "up" | "down") => void;
  setMapping: (extractedValue: string, stageId: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  isNew: boolean;
}

function ObjectiveEditor(p: EditorProps) {
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
          <Button variant="outline" onClick={p.onCancel} disabled={p.saving} data-testid="button-cancel">
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button onClick={p.onSave} disabled={p.saving} data-testid="button-save">
            {p.saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      {/* Basic info card */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ao-name">Internal name *</Label>
              <Input id="ao-name" value={p.form.name} onChange={e => p.updateForm({ name: e.target.value })}
                placeholder="pcp_followup_7day" data-testid="input-name" />
              <p className="text-[11px] text-muted-foreground mt-1">Snake_case identifier used in BigQuery and code.</p>
            </div>
            <div>
              <Label htmlFor="ao-display">Display name *</Label>
              <Input id="ao-display" value={p.form.displayName} onChange={e => p.updateForm({ displayName: e.target.value })}
                placeholder="PCP follow-up — activation objective" data-testid="input-display-name" />
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
        </CardContent>
      </Card>

      {/* Target date card (matches screenshot) */}
      <Card className="border-2 border-blue-500/40 bg-blue-50/30 dark:bg-blue-950/10">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-base">Target date — how it is calculated per patient</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Anchor event + window days = target date. Drives all on-track and progress metrics.</p>
            </div>
            <Badge variant="outline" className="bg-white dark:bg-background">activation objective</Badge>
          </div>

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
        </CardContent>
      </Card>

      {/* Observation card — objective-level extracted value set (mapped to stages below) */}
      <ObservationEditor
        observationName={p.form.observationName}
        extractedEnumValues={p.form.extractedEnumValues}
        onNameChange={(v) => p.updateForm({ observationName: v })}
        addExtracted={p.addExtractedValue}
        removeExtracted={p.removeExtractedValue}
        setColor={p.setExtractedValueColor}
        setLabel={p.setExtractedValueLabel}
        setHint={p.setExtractedValueHint}
        move={p.moveExtractedValue}
      />

      {/* Stages card */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">Progress stages — in order</h3>
              <p className="text-xs text-muted-foreground">Stages represent advancement toward the objective. Pick which stage means "objective achieved", and assign observation values to the stages they signal.</p>
            </div>
            <Button size="sm" variant="outline" onClick={p.addStage} data-testid="button-add-stage">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add stage
            </Button>
          </div>

          <div className="space-y-2">
            {p.form.stages.map((s, i) => {
              return (
                <div key={s.id} className="flex flex-col gap-2 p-2 rounded-md border bg-card" data-testid={`row-stage-${i}`}>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => p.moveStage(i, -1)} disabled={i === 0}>
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => p.moveStage(i, 1)} disabled={i === p.form.stages.length - 1}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="w-7 h-7 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center text-xs font-semibold">{i + 1}</div>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <Input value={s.name} onChange={e => p.updateStage(i, { name: e.target.value })}
                        placeholder="snake_case_name" className="h-8 text-sm" data-testid={`input-stage-name-${i}`} />
                      <Input value={s.displayName} onChange={e => p.updateStage(i, { displayName: e.target.value })}
                        placeholder="Display name" className="h-8 text-sm" data-testid={`input-stage-display-${i}`} />
                      <Input value={s.description} onChange={e => p.updateStage(i, { description: e.target.value })}
                        placeholder="Sublabel (optional)" className="h-8 text-sm" data-testid={`input-stage-desc-${i}`} />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => p.removeStage(i)} data-testid={`button-remove-stage-${i}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  {p.form.extractedEnumValues.length > 0 && (
                    <div className="ml-12 flex items-center gap-2 flex-wrap">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Observation values</Label>
                      {p.form.extractedEnumValues.map(v => {
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
                            data-testid={`chip-stage-value-${i}-${v.label}`}
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
                {p.form.stages.map(s => <SelectItem key={s.id} value={s.id}>{s.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Thresholds card */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div>
            <h3 className="font-semibold text-base">On-track threshold rules — by days remaining to target date</h3>
            <p className="text-xs text-muted-foreground">Days remaining = target date − call date. Rules apply to every touchpoint for this objective.</p>
          </div>
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
                  return (
                    <tr key={t.bandLabel} className="border-t" data-testid={`row-threshold-${t.bandLabel}`}>
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium">{t.bandDisplayName || timing.label}</div>
                        <div className="text-xs text-muted-foreground">{timing.example}</div>
                      </td>
                      <td className="px-3 py-2 align-top">
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
                            {p.form.stages.map(s => {
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
        </CardContent>
      </Card>

      {/* Interaction routing card */}
      <Card className="border-2 border-[#96d410]/40 bg-[#96d410]/5">
        <CardContent className="p-5 space-y-3">
          <div>
            <h3 className="font-semibold text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Interaction routing
            </h3>
            <p className="text-xs text-muted-foreground">Each call carries an interaction key in the API request context. The matching configured interaction below decides how this objective is extracted.</p>
          </div>
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
        </CardContent>
      </Card>

      {/* Per-interaction extraction config */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-base">Configured interactions</h3>
              <p className="text-xs text-muted-foreground">Pick which interactions this objective should be extracted from, and how each one maps to the progress stages.</p>
            </div>
            <AddInteractionPicker
              interactions={p.interactions}
              configured={p.form.interactions}
              onAdd={p.addInteractionConfig}
            />
          </div>

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
                update={(patch) => p.updateInteractionConfig(idx, patch)}
                onRemove={() => p.removeInteractionConfig(idx)}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* Optional general prompt guidance */}
      <Card>
        <CardContent className="p-5 space-y-2">
          <Label className="text-sm font-semibold">Objective-level prompt guidance (optional)</Label>
          <p className="text-xs text-muted-foreground">Extra context that applies across all interactions — e.g. how to interpret ambiguous patient statements about appointment status.</p>
          <Textarea value={p.form.promptGuidance} onChange={e => p.updateForm({ promptGuidance: e.target.value })}
            rows={3} placeholder="If the patient mentions 'I have an appointment' without a date, infer 'scheduled' unless they say it already occurred."
            data-testid="textarea-objective-guidance" />
        </CardContent>
      </Card>
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
  const available = interactions.filter(i => !configuredIds.has(i.id) && i.isActive);
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
  cfg, idx, interaction, update, onRemove,
}: {
  cfg: ObjectiveInteractionConfig;
  idx: number;
  interaction: ActivationInteraction | undefined;
  update: (patch: Partial<ObjectiveInteractionConfig>) => void;
  onRemove: () => void;
}) {
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
    </div>
  );
}

// ============================================================
// Observation editor (objective-level extracted enum + stage mapping)
// ============================================================

function ObservationEditor({
  observationName, extractedEnumValues,
  onNameChange, addExtracted, removeExtracted, setColor, setLabel, setHint, move,
}: {
  observationName: string;
  extractedEnumValues: EnumValue[];
  onNameChange: (v: string) => void;
  addExtracted: (label: string, color?: EnumColor) => void;
  removeExtracted: (label: string) => void;
  setColor: (label: string, color: EnumColor) => void;
  setLabel: (oldLabel: string, newLabel: string) => void;
  setHint: (label: string, hint: string) => void;
  move: (label: string, dir: "up" | "down") => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<EnumColor>("GRAY");

  const submitNew = () => {
    if (!newLabel.trim()) return;
    addExtracted(newLabel, newColor);
    setNewLabel("");
    setNewColor("GRAY");
  };

  return (
    <Card data-testid="card-observation">
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Observation
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            One observation per objective. Define the value set the model is allowed to extract, color-code each value by its sentiment, sequence them, and add an optional prompt hint per value. Then assign each to a progress stage below.
          </p>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Observation name (optional)</Label>
          <Input value={observationName}
            onChange={e => onNameChange(e.target.value)}
            placeholder="e.g. PCP follow-up status"
            className="h-9 text-sm mt-1 max-w-md"
            data-testid="input-observation-name" />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">Enum Values</Label>

          {extractedEnumValues.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No extracted values yet.</div>
          ) : (
            <div className="space-y-2">
              {extractedEnumValues.map((v, i) => {
                const c = COLOR_MAP[v.color] || COLOR_MAP.GRAY;
                return (
                  <div key={`${v.label}-${i}`} className="space-y-1" data-testid={`row-observation-value-${v.label}`}>
                    <div className="flex items-center gap-1.5 group">
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => move(v.label, "up")}
                          disabled={i === 0}
                          className="h-5 w-5 p-0 opacity-40 hover:opacity-100 disabled:opacity-10"
                          data-testid={`button-observation-up-${v.label}`}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => move(v.label, "down")}
                          disabled={i === extractedEnumValues.length - 1}
                          className="h-5 w-5 p-0 opacity-40 hover:opacity-100 disabled:opacity-10"
                          data-testid={`button-observation-down-${v.label}`}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className={`w-3 h-3 rounded-full shrink-0 border ${c.bg} ${c.border}`} />
                      <Input
                        defaultValue={v.label}
                        onBlur={e => {
                          const next = e.target.value.trim();
                          if (next && next !== v.label) setLabel(v.label, next);
                        }}
                        className="text-sm h-8 flex-grow"
                        data-testid={`input-observation-label-${v.label}`}
                      />
                      <Select value={v.color} onValueChange={col => setColor(v.label, col as EnumColor)}>
                        <SelectTrigger className="h-8 w-40 text-xs" data-testid={`select-observation-color-${v.label}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(COLOR_MAP).map(([key, val]) => (
                            <SelectItem key={key} value={key}>
                              <span className="inline-flex items-center gap-2">
                                <span className={`inline-block w-3 h-3 rounded-full border ${val.bg} ${val.border}`} />
                                <span className="text-xs">{val.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => removeExtracted(v.label)}
                        className="h-7 w-7 p-0 opacity-50 hover:opacity-100"
                        data-testid={`button-observation-removevalue-${v.label}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="pl-[60px] pr-10">
                      <Input
                        defaultValue={v.promptHint || ""}
                        onBlur={e => {
                          const next = e.target.value;
                          if (next !== (v.promptHint || "")) setHint(v.label, next);
                        }}
                        placeholder="Optional prompt hint — extra guidance for Gemini when choosing this value"
                        className="text-xs h-7 bg-muted/30 border-dashed"
                        data-testid={`input-observation-hint-${v.label}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-end gap-2 pt-2 border-t">
            <div className="flex-grow space-y-1">
              <Label className="text-xs text-muted-foreground">Add new value</Label>
              <Input
                placeholder="e.g. scheduled, attended, plans_to_schedule"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="text-sm h-9"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitNew(); } }}
                data-testid="input-observation-newvalue"
              />
            </div>
            <div className="w-40 space-y-1">
              <Label className="text-xs text-muted-foreground">Color</Label>
              <Select value={newColor} onValueChange={c => setNewColor(c as EnumColor)}>
                <SelectTrigger className="h-9" data-testid="select-observation-newcolor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COLOR_MAP).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      <span className="inline-flex items-center gap-2">
                        <span className={`inline-block w-3 h-3 rounded-full border ${val.bg} ${val.border}`} />
                        <span className="text-xs">{val.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" type="button" onClick={submitNew} className="h-9" data-testid="button-observation-addvalue">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
