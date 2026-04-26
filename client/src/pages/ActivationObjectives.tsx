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
  ArrowRight, GripVertical, ChevronDown, ChevronUp, Clock, AlertCircle,
} from "lucide-react";
import { useClientPathway } from "@/contexts/ClientPathwayContext";

type AnchorEventType = "discharge" | "enrollment" | "procedure" | "custom";
type BandLabel = "early" | "near_window" | "at_window" | "post_window";

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

interface Touchpoint {
  id: string;
  name: string;
  expectedDayOffset: number;
  canResolveObjective: boolean;
  inclusionRules: InclusionRules;
  extractedEnumValues: string[];
  stageMappings: StageMapping[];
  promptGuidance: string;
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
  touchpoints: Touchpoint[];
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
    touchpoints: [],
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
      const [r1, r2] = await Promise.all([
        fetch(`/api/activation-objectives?clientPathwayId=${selectedCPId}`),
        fetch(`/api/context-parameters?clientPathwayId=${selectedCPId}`),
      ]);
      if (r1.ok) setItems(await r1.json());
      if (r2.ok) setContextParams(await r2.json());
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
      touchpoints: rest.touchpoints || [],
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
    // Validate every extracted enum value has a stage mapping
    for (const tp of form.touchpoints) {
      const unmapped = tp.extractedEnumValues.filter(v => !tp.stageMappings.find(m => m.extractedValue === v && m.stageId));
      if (unmapped.length > 0) {
        toast({
          title: `Touchpoint "${tp.name}" has unmapped values`,
          description: `Pick a stage for: ${unmapped.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
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
    const newTouchpoints = form.touchpoints.map(tp => ({
      ...tp,
      stageMappings: tp.stageMappings.filter(m => m.stageId !== removed.id),
    }));
    updateForm({ stages: next, achievedStageId: newAchieved, thresholds: newThresholds, touchpoints: newTouchpoints });
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

  function addTouchpoint() {
    const idx = form.touchpoints.length + 1;
    const tp: Touchpoint = {
      id: `tp_${Date.now()}`,
      name: `Day ${idx} call`,
      expectedDayOffset: idx,
      canResolveObjective: false,
      inclusionRules: { requirePcpAssigned: false, requireCompletedWithPatientOrCaregiver: true, customRules: [] },
      extractedEnumValues: [],
      stageMappings: [],
      promptGuidance: "",
    };
    updateForm({ touchpoints: [...form.touchpoints, tp] });
  }

  function updateTouchpoint(idx: number, patch: Partial<Touchpoint>) {
    const next = form.touchpoints.map((t, i) => i === idx ? { ...t, ...patch } : t);
    updateForm({ touchpoints: next });
  }

  function removeTouchpoint(idx: number) {
    if (!confirm("Remove this touchpoint?")) return;
    updateForm({ touchpoints: form.touchpoints.filter((_, i) => i !== idx) });
  }

  function addExtractedValue(tpIdx: number, value: string) {
    if (!value.trim()) return;
    const tp = form.touchpoints[tpIdx];
    if (tp.extractedEnumValues.includes(value.trim())) return;
    updateTouchpoint(tpIdx, { extractedEnumValues: [...tp.extractedEnumValues, value.trim()] });
  }

  function removeExtractedValue(tpIdx: number, value: string) {
    const tp = form.touchpoints[tpIdx];
    updateTouchpoint(tpIdx, {
      extractedEnumValues: tp.extractedEnumValues.filter(v => v !== value),
      stageMappings: tp.stageMappings.filter(m => m.extractedValue !== value),
    });
  }

  function setMapping(tpIdx: number, extractedValue: string, stageId: string) {
    const tp = form.touchpoints[tpIdx];
    const exists = tp.stageMappings.some(m => m.extractedValue === extractedValue);
    const newMappings = exists
      ? tp.stageMappings.map(m => m.extractedValue === extractedValue ? { ...m, stageId } : m)
      : [...tp.stageMappings, { extractedValue, stageId }];
    updateTouchpoint(tpIdx, { stageMappings: newMappings });
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
          addStage={addStage}
          updateStage={updateStage}
          removeStage={removeStage}
          moveStage={moveStage}
          toggleThresholdStage={toggleThresholdStage}
          updateThreshold={updateThreshold}
          addTouchpoint={addTouchpoint}
          updateTouchpoint={updateTouchpoint}
          removeTouchpoint={removeTouchpoint}
          addExtractedValue={addExtractedValue}
          removeExtractedValue={removeExtractedValue}
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
              <span><span className="text-muted-foreground">Touchpoints:</span> <span className="font-medium">{(obj.touchpoints || []).length}</span></span>
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
            {(obj.touchpoints || []).length > 0 && (
              <div className="text-sm">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Touchpoints</Label>
                <div className="mt-2 space-y-1">
                  {obj.touchpoints.map(tp => (
                    <div key={tp.id} className="flex items-center gap-3 text-sm">
                      <Badge variant="outline">{tp.name}</Badge>
                      <span className="text-muted-foreground">Day {tp.expectedDayOffset}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{tp.stageMappings.length} mapping{tp.stageMappings.length !== 1 ? "s" : ""}</span>
                      {tp.canResolveObjective && <Badge variant="secondary" className="text-[10px]">can resolve</Badge>}
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
  addStage: () => void;
  updateStage: (idx: number, patch: Partial<Stage>) => void;
  removeStage: (idx: number) => void;
  moveStage: (idx: number, dir: -1 | 1) => void;
  toggleThresholdStage: (idx: number, stageId: string) => void;
  updateThreshold: (idx: number, patch: Partial<Threshold>) => void;
  addTouchpoint: () => void;
  updateTouchpoint: (idx: number, patch: Partial<Touchpoint>) => void;
  removeTouchpoint: (idx: number) => void;
  addExtractedValue: (tpIdx: number, value: string) => void;
  removeExtractedValue: (tpIdx: number, value: string) => void;
  setMapping: (tpIdx: number, extractedValue: string, stageId: string) => void;
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

      {/* Stages card */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">Progress stages — in order</h3>
              <p className="text-xs text-muted-foreground">Stages represent advancement toward the objective. Pick which stage means "objective achieved".</p>
            </div>
            <Button size="sm" variant="outline" onClick={p.addStage} data-testid="button-add-stage">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add stage
            </Button>
          </div>

          <div className="space-y-2">
            {p.form.stages.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded-md border bg-card" data-testid={`row-stage-${i}`}>
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
            ))}
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

      {/* Touchpoints card */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">Touchpoints</h3>
              <p className="text-xs text-muted-foreground">Calls or interactions where this objective is extracted from a transcript. Each touchpoint has its own extraction mapping and inclusion rules.</p>
            </div>
            <Button size="sm" variant="outline" onClick={p.addTouchpoint} data-testid="button-add-touchpoint">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add touchpoint
            </Button>
          </div>

          {p.form.touchpoints.length === 0 && (
            <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
              No touchpoints yet. Add one for each call type where this objective should be extracted (e.g. "Day 4 call", "Day 10 call").
            </div>
          )}

          {p.form.touchpoints.map((tp, idx) => (
            <TouchpointEditor key={tp.id} tp={tp} idx={idx} stages={p.form.stages}
              update={(patch) => p.updateTouchpoint(idx, patch)}
              onRemove={() => p.removeTouchpoint(idx)}
              addExtracted={(v) => p.addExtractedValue(idx, v)}
              removeExtracted={(v) => p.removeExtractedValue(idx, v)}
              setMapping={(v, sid) => p.setMapping(idx, v, sid)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Optional general prompt guidance */}
      <Card>
        <CardContent className="p-5 space-y-2">
          <Label className="text-sm font-semibold">Objective-level prompt guidance (optional)</Label>
          <p className="text-xs text-muted-foreground">Extra context that applies across all touchpoints — e.g. how to interpret ambiguous patient statements about appointment status.</p>
          <Textarea value={p.form.promptGuidance} onChange={e => p.updateForm({ promptGuidance: e.target.value })}
            rows={3} placeholder="If the patient mentions 'I have an appointment' without a date, infer 'scheduled' unless they say it already occurred."
            data-testid="textarea-objective-guidance" />
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Touchpoint editor
// ============================================================

function TouchpointEditor({
  tp, idx, stages, update, onRemove, addExtracted, removeExtracted, setMapping,
}: {
  tp: Touchpoint;
  idx: number;
  stages: Stage[];
  update: (patch: Partial<Touchpoint>) => void;
  onRemove: () => void;
  addExtracted: (v: string) => void;
  removeExtracted: (v: string) => void;
  setMapping: (extracted: string, stageId: string) => void;
}) {
  const [newValue, setNewValue] = useState("");
  const stageById = new Map(stages.map(s => [s.id, s.displayName]));
  return (
    <div className="border rounded-md p-4 space-y-3 bg-muted/20" data-testid={`card-touchpoint-${idx}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Touchpoint name</Label>
            <Input value={tp.name} onChange={e => update({ name: e.target.value })} className="h-8 text-sm" data-testid={`input-tp-name-${idx}`} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Expected day offset</Label>
            <Input type="number" value={tp.expectedDayOffset}
              onChange={e => update({ expectedDayOffset: parseInt(e.target.value) || 0 })}
              className="h-8 text-sm" data-testid={`input-tp-offset-${idx}`} />
            <p className="text-[10px] text-muted-foreground mt-0.5">Days after anchor event (e.g. 4 = day 4 call)</p>
          </div>
          <div className="pt-5">
            <div className="flex items-center gap-2">
              <Switch checked={tp.canResolveObjective}
                onCheckedChange={c => update({ canResolveObjective: c })} data-testid={`switch-tp-resolves-${idx}`} />
              <Label className="text-sm">Can resolve objective</Label>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Enable for terminal touchpoints (e.g. on or after the target date) where the call's extracted stage is the final answer for the objective.</p>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onRemove} data-testid={`button-remove-tp-${idx}`}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Inclusion rules</Label>
          <div className="space-y-1.5 mt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={tp.inclusionRules.requirePcpAssigned}
                onChange={e => update({ inclusionRules: { ...tp.inclusionRules, requirePcpAssigned: e.target.checked } })}
                data-testid={`check-tp-require-pcp-${idx}`} />
              Require PCP assigned
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={tp.inclusionRules.requireCompletedWithPatientOrCaregiver}
                onChange={e => update({ inclusionRules: { ...tp.inclusionRules, requireCompletedWithPatientOrCaregiver: e.target.checked } })}
                data-testid={`check-tp-require-completed-${idx}`} />
              Require call completed with patient or caregiver
            </label>
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Touchpoint prompt guidance (optional)</Label>
          <Textarea value={tp.promptGuidance}
            onChange={e => update({ promptGuidance: e.target.value })} rows={3}
            className="text-sm mt-1" placeholder="Specific cues for this call type..."
            data-testid={`textarea-tp-guidance-${idx}`} />
        </div>
      </div>

      <div className="pt-2 border-t">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Extracted enum values → progress stage mapping</Label>
        <p className="text-[11px] text-muted-foreground mb-2">Define what values the model can output for this touchpoint, and which stage each one maps to.</p>
        <div className="flex gap-2 mb-2">
          <Input value={newValue} onChange={e => setNewValue(e.target.value)}
            placeholder="e.g. patient_confirmed_appointment" className="h-8 text-sm"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addExtracted(newValue); setNewValue(""); } }}
            data-testid={`input-tp-newvalue-${idx}`} />
          <Button size="sm" type="button" onClick={() => { addExtracted(newValue); setNewValue(""); }} data-testid={`button-tp-addvalue-${idx}`}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add value
          </Button>
        </div>
        {tp.extractedEnumValues.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">No extracted values yet.</div>
        ) : (
          <div className="space-y-1.5">
            {tp.extractedEnumValues.map(v => {
              const mapping = tp.stageMappings.find(m => m.extractedValue === v);
              return (
                <div key={v} className="flex items-center gap-2 text-sm" data-testid={`row-tp-mapping-${idx}-${v}`}>
                  <Badge variant="outline" className="font-mono text-xs">{v}</Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={mapping?.stageId || ""} onValueChange={(sid) => setMapping(v, sid)}>
                    <SelectTrigger className="h-7 text-xs w-48" data-testid={`select-tp-mapping-${idx}-${v}`}>
                      <SelectValue placeholder="Pick a stage..." />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.displayName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeExtracted(v)} data-testid={`button-tp-removevalue-${idx}-${v}`}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
