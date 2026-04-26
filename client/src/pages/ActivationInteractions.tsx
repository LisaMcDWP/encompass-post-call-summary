import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Save, X, Loader2, MessageSquare, Calendar, GitBranch, Repeat } from "lucide-react";
import { useClientPathway } from "@/contexts/ClientPathwayContext";

type InteractionType = "scheduled" | "ad_hoc" | "continuous";

interface ActivationInteraction {
  id: number;
  clientPathwayId: number;
  key: string;
  name: string;
  description: string;
  interactionType: InteractionType;
  expectedDayOffset: number | null;
  parentInteractionId: number | null;
  intervalDays: number | null;
  startAfterObjectiveId: number | null;
  isActive: boolean;
  displayOrder: number;
}

interface ObjectiveLite {
  id: number;
  displayName: string;
  windowDays: number;
}

type FormState = Omit<ActivationInteraction, "id" | "clientPathwayId">;

const NONE_VALUE = "__none__";

function emptyForm(): FormState {
  return {
    key: "",
    name: "",
    description: "",
    interactionType: "scheduled",
    expectedDayOffset: null,
    parentInteractionId: null,
    intervalDays: null,
    startAfterObjectiveId: null,
    isActive: true,
    displayOrder: 0,
  };
}

const TYPE_META: Record<InteractionType, { label: string; icon: typeof Calendar; description: string; badgeClass: string }> = {
  scheduled: {
    label: "Scheduled",
    icon: Calendar,
    description: "Defined touchpoint at a specific day offset (e.g. Day 4 call). On-track band evaluation applies.",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
  },
  ad_hoc: {
    label: "Ad hoc",
    icon: GitBranch,
    description: "Triggered by something surfaced in a prior call. Inherits band from the actual call date; extraction is typically narrower.",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-200",
  },
  continuous: {
    label: "Continuous",
    icon: Repeat,
    description: "Recurring engagement (e.g. weekly check-in) that begins after an objective resolves. Not evaluated against the originating objective window.",
    badgeClass: "bg-purple-100 text-purple-900 border-purple-200",
  },
};

export default function ActivationInteractions() {
  const { selectedCPId } = useClientPathway();
  const { toast } = useToast();
  const [items, setItems] = useState<ActivationInteraction[]>([]);
  const [objectives, setObjectives] = useState<ObjectiveLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedCPId) return;
    setEditingId(null);
    setForm(emptyForm());
    void load();
  }, [selectedCPId]);

  async function load() {
    if (!selectedCPId) return;
    setLoading(true);
    try {
      const [resInteractions, resObjectives] = await Promise.all([
        fetch(`/api/activation-interactions?clientPathwayId=${selectedCPId}`),
        fetch(`/api/activation-objectives?clientPathwayId=${selectedCPId}`),
      ]);
      if (resInteractions.ok) setItems(await resInteractions.json());
      if (resObjectives.ok) {
        const objs = await resObjectives.json();
        setObjectives((Array.isArray(objs) ? objs : []).map((o: any) => ({
          id: o.id,
          displayName: o.displayName,
          windowDays: o.windowDays,
        })));
      }
    } catch (err: any) {
      toast({ title: "Failed to load", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setForm({ ...emptyForm(), displayOrder: items.length });
    setEditingId("new");
  }

  function startEdit(it: ActivationInteraction) {
    const { id, clientPathwayId, ...rest } = it;
    setForm(rest);
    setEditingId(id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function saveForm() {
    if (!selectedCPId) return;
    if (!form.key.trim() || !form.name.trim()) {
      toast({ title: "Missing required fields", description: "Key and name are required.", variant: "destructive" });
      return;
    }
    if (!/^[a-z0-9_]+$/.test(form.key)) {
      toast({ title: "Invalid key", description: "Key must use lowercase letters, numbers, and underscores only.", variant: "destructive" });
      return;
    }
    if (form.interactionType === "continuous" && (form.intervalDays == null || form.intervalDays <= 0)) {
      toast({ title: "Cadence required", description: "Continuous interactions need an interval (in days).", variant: "destructive" });
      return;
    }

    // Normalize: clear fields that don't apply to the chosen type so we don't carry stale data.
    const normalized: FormState = {
      ...form,
      expectedDayOffset: form.interactionType === "scheduled" ? form.expectedDayOffset : null,
      parentInteractionId: form.interactionType === "ad_hoc" ? form.parentInteractionId : null,
      intervalDays: form.interactionType === "continuous" ? form.intervalDays : null,
      startAfterObjectiveId: form.interactionType === "continuous" ? form.startAfterObjectiveId : null,
    };

    setSaving(true);
    try {
      const isNew = editingId === "new";
      const url = isNew ? "/api/activation-interactions" : `/api/activation-interactions/${editingId}`;
      const method = isNew ? "POST" : "PUT";
      const body = JSON.stringify({ ...normalized, clientPathwayId: selectedCPId });
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Save failed (${res.status})`);
      }
      toast({ title: isNew ? "Interaction created" : "Interaction updated" });
      setEditingId(null);
      await load();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteInteraction(id: number) {
    if (!selectedCPId) return;
    if (!confirm("Delete this interaction? Objectives that reference it will need to be updated.")) return;
    try {
      const res = await fetch(`/api/activation-interactions/${id}?clientPathwayId=${selectedCPId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Interaction deleted" });
      await load();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  }

  function updateForm(patch: Partial<FormState>) {
    setForm(prev => ({ ...prev, ...patch }));
  }

  if (!selectedCPId) {
    return (
      <div className="p-8">
        <Card><CardContent className="p-6">
          <p className="text-muted-foreground">Select a client/pathway to manage activation interactions.</p>
        </CardContent></Card>
      </div>
    );
  }

  const isEditing = editingId !== null;
  const itemsById = new Map(items.map(i => [i.id, i]));
  const objectivesById = new Map(objectives.map(o => [o.id, o]));

  // Ad hoc: parent picker shows scheduled + ad_hoc interactions (not other continuous, not self).
  const parentCandidates = items.filter(
    i => i.id !== editingId && i.interactionType !== "continuous" && i.isActive,
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-page-title">
            <MessageSquare className="h-6 w-6 text-primary" />
            Activation Interactions
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Reusable touchpoints across your pathway. Each interaction has a type — scheduled (fixed day),
            ad hoc (follow-up triggered by another call), or continuous (recurring engagement after an objective resolves).
            The interaction key is supplied by the API caller in the request context for each call.
          </p>
        </div>
        {!isEditing && (
          <Button onClick={startNew} data-testid="button-new-interaction">
            <Plus className="h-4 w-4 mr-2" /> New Interaction
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
        </div>
      )}

      {isEditing && (
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId === "new" ? "New interaction" : "Edit interaction"}</h2>
              <Switch
                checked={form.isActive}
                onCheckedChange={v => updateForm({ isActive: v })}
                data-testid="switch-is-active"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="key">Key <span className="text-destructive">*</span></Label>
                <Input
                  id="key"
                  value={form.key}
                  onChange={e => updateForm({ key: e.target.value.toLowerCase() })}
                  placeholder="day_4_call"
                  data-testid="input-key"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Stable identifier sent by the API in the request context. Lowercase + underscores only.
                </p>
              </div>
              <div>
                <Label htmlFor="name">Display name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => updateForm({ name: e.target.value })}
                  placeholder="Day 4 Call"
                  data-testid="input-name"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => updateForm({ description: e.target.value })}
                placeholder="Optional context about when this interaction occurs and what it accomplishes."
                rows={3}
                data-testid="input-description"
              />
            </div>

            <div>
              <Label htmlFor="interactionType">Interaction type <span className="text-destructive">*</span></Label>
              <Select
                value={form.interactionType}
                onValueChange={(v) => updateForm({ interactionType: v as InteractionType })}
              >
                <SelectTrigger id="interactionType" data-testid="select-interaction-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_META) as InteractionType[]).map(t => {
                    const meta = TYPE_META[t];
                    const Icon = meta.icon;
                    return (
                      <SelectItem key={t} value={t} data-testid={`option-type-${t}`}>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">{TYPE_META[form.interactionType].description}</p>
            </div>

            {form.interactionType === "scheduled" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="section-scheduled-fields">
                <div>
                  <Label htmlFor="expectedDayOffset">Expected day offset</Label>
                  <Input
                    id="expectedDayOffset"
                    type="number"
                    value={form.expectedDayOffset ?? ""}
                    onChange={e => updateForm({ expectedDayOffset: e.target.value === "" ? null : parseInt(e.target.value) })}
                    placeholder="e.g. 4"
                    data-testid="input-day-offset"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Days from the anchor event when this touchpoint is expected.
                  </p>
                </div>
                <div>
                  <Label htmlFor="displayOrder">Display order</Label>
                  <Input
                    id="displayOrder"
                    type="number"
                    value={form.displayOrder}
                    onChange={e => updateForm({ displayOrder: parseInt(e.target.value) || 0 })}
                    data-testid="input-display-order"
                  />
                </div>
              </div>
            )}

            {form.interactionType === "ad_hoc" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="section-adhoc-fields">
                <div>
                  <Label htmlFor="parentInteractionId">Triggered by</Label>
                  <Select
                    value={form.parentInteractionId == null ? NONE_VALUE : String(form.parentInteractionId)}
                    onValueChange={(v) => updateForm({ parentInteractionId: v === NONE_VALUE ? null : parseInt(v) })}
                  >
                    <SelectTrigger id="parentInteractionId" data-testid="select-parent-interaction">
                      <SelectValue placeholder="Select a parent interaction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>(unspecified)</SelectItem>
                      {parentCandidates.map(p => (
                        <SelectItem key={p.id} value={String(p.id)} data-testid={`option-parent-${p.id}`}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Which interaction's call typically surfaces the trigger for this follow-up.
                  </p>
                </div>
                <div>
                  <Label htmlFor="displayOrder">Display order</Label>
                  <Input
                    id="displayOrder"
                    type="number"
                    value={form.displayOrder}
                    onChange={e => updateForm({ displayOrder: parseInt(e.target.value) || 0 })}
                    data-testid="input-display-order"
                  />
                </div>
              </div>
            )}

            {form.interactionType === "continuous" && (
              <div className="space-y-4" data-testid="section-continuous-fields">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="intervalDays">Cadence (days) <span className="text-destructive">*</span></Label>
                    <Input
                      id="intervalDays"
                      type="number"
                      min={1}
                      value={form.intervalDays ?? ""}
                      onChange={e => updateForm({ intervalDays: e.target.value === "" ? null : parseInt(e.target.value) })}
                      placeholder="7"
                      data-testid="input-interval-days"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Days between recurrences. e.g. 7 for weekly check-ins.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="displayOrder">Display order</Label>
                    <Input
                      id="displayOrder"
                      type="number"
                      value={form.displayOrder}
                      onChange={e => updateForm({ displayOrder: parseInt(e.target.value) || 0 })}
                      data-testid="input-display-order"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="startAfterObjectiveId">Start after objective resolves</Label>
                  <Select
                    value={form.startAfterObjectiveId == null ? NONE_VALUE : String(form.startAfterObjectiveId)}
                    onValueChange={(v) => updateForm({ startAfterObjectiveId: v === NONE_VALUE ? null : parseInt(v) })}
                  >
                    <SelectTrigger id="startAfterObjectiveId" data-testid="select-start-after-objective">
                      <SelectValue placeholder="Select an objective" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>(unspecified)</SelectItem>
                      {objectives.map(o => (
                        <SelectItem key={o.id} value={String(o.id)} data-testid={`option-start-objective-${o.id}`}>
                          {o.displayName} <span className="text-muted-foreground">({o.windowDays}d window)</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Continuous engagement begins once this objective is resolved (achieved or not). The continuous
                    interaction's own assessment frame will be configured separately — see future work.
                  </p>
                </div>
                <div className="rounded-md border border-dashed bg-muted/30 p-3 text-[12px] text-muted-foreground">
                  <strong className="text-foreground">Note:</strong> continuous interactions are not configured per
                  objective and do not contribute to band-based on-track scoring. They will get their own assessment
                  configuration in a follow-up release.
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={saveForm} disabled={saving} data-testid="button-save">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
              <Button variant="outline" onClick={cancelEdit} disabled={saving} data-testid="button-cancel">
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isEditing && !loading && items.length === 0 && (
        <Card><CardContent className="p-10 text-center">
          <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground mb-4">No activation interactions yet for this pathway.</p>
          <Button onClick={startNew} data-testid="button-create-first">
            <Plus className="h-4 w-4 mr-2" /> Create your first interaction
          </Button>
        </CardContent></Card>
      )}

      {!isEditing && items.length > 0 && (
        <div className="space-y-2">
          {items.map(it => {
            const meta = TYPE_META[it.interactionType];
            const TypeIcon = meta.icon;
            const parent = it.parentInteractionId != null ? itemsById.get(it.parentInteractionId) : null;
            const startObj = it.startAfterObjectiveId != null ? objectivesById.get(it.startAfterObjectiveId) : null;
            return (
              <Card key={it.id} data-testid={`card-interaction-${it.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-base" data-testid={`text-interaction-name-${it.id}`}>{it.name}</h3>
                        <Badge variant="outline" className={`text-[11px] ${meta.badgeClass}`} data-testid={`badge-type-${it.id}`}>
                          <TypeIcon className="h-3 w-3 mr-1" /> {meta.label}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-[11px]">{it.key}</Badge>
                        {it.interactionType === "scheduled" && it.expectedDayOffset != null && (
                          <Badge variant="secondary" className="text-[11px]">Day {it.expectedDayOffset}</Badge>
                        )}
                        {it.interactionType === "continuous" && it.intervalDays != null && (
                          <Badge variant="secondary" className="text-[11px]">every {it.intervalDays}d</Badge>
                        )}
                        {!it.isActive && <Badge variant="secondary">Inactive</Badge>}
                      </div>
                      {it.description && (
                        <p className="text-sm text-muted-foreground mt-1">{it.description}</p>
                      )}
                      {it.interactionType === "scheduled" && (
                        <p className="text-[11px] text-muted-foreground mt-1" data-testid={`text-scheduled-${it.id}`}>
                          {it.expectedDayOffset != null
                            ? <>Expected on Day {it.expectedDayOffset} from the anchor event.</>
                            : <em>No expected day set.</em>}
                        </p>
                      )}
                      {it.interactionType === "ad_hoc" && (
                        <p className="text-[11px] text-muted-foreground mt-1" data-testid={`text-parent-${it.id}`}>
                          Triggered by: {parent ? parent.name : <em>unspecified</em>}
                        </p>
                      )}
                      {it.interactionType === "continuous" && (
                        <p className="text-[11px] text-muted-foreground mt-1" data-testid={`text-start-after-${it.id}`}>
                          {it.intervalDays != null ? <>Every {it.intervalDays} day{it.intervalDays === 1 ? "" : "s"}, starting after </> : <>Starts after </>}
                          {startObj ? `${startObj.displayName} resolves` : <em>unspecified objective</em>}.
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => startEdit(it)} data-testid={`button-edit-${it.id}`}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteInteraction(it.id)} data-testid={`button-delete-${it.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
