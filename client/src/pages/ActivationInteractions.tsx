import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Save, X, Loader2, MessageSquare } from "lucide-react";
import { useClientPathway } from "@/contexts/ClientPathwayContext";

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

type FormState = Omit<ActivationInteraction, "id" | "clientPathwayId">;

function emptyForm(): FormState {
  return {
    key: "",
    name: "",
    description: "",
    expectedDayOffset: null,
    isActive: true,
    displayOrder: 0,
  };
}

export default function ActivationInteractions() {
  const { selectedCPId } = useClientPathway();
  const { toast } = useToast();
  const [items, setItems] = useState<ActivationInteraction[]>([]);
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
      const res = await fetch(`/api/activation-interactions?clientPathwayId=${selectedCPId}`);
      if (res.ok) setItems(await res.json());
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
    setSaving(true);
    try {
      const isNew = editingId === "new";
      const url = isNew ? "/api/activation-interactions" : `/api/activation-interactions/${editingId}`;
      const method = isNew ? "POST" : "PUT";
      const body = JSON.stringify({ ...form, clientPathwayId: selectedCPId });
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-page-title">
            <MessageSquare className="h-6 w-6 text-primary" />
            Activation Interactions
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Reusable touchpoints across your pathway (e.g. Day 4 call, Day 7 call, follow-up SMS). Activation
            objectives reference these via dropdown — the interaction key is supplied by the API caller in the
            request context for each call.
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  Optional reference only. Used for display and operational reporting.
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
          {items.map(it => (
            <Card key={it.id} data-testid={`card-interaction-${it.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-base" data-testid={`text-interaction-name-${it.id}`}>{it.name}</h3>
                      <Badge variant="outline" className="font-mono text-[11px]">{it.key}</Badge>
                      {it.expectedDayOffset != null && (
                        <Badge variant="secondary" className="text-[11px]">Day {it.expectedDayOffset}</Badge>
                      )}
                      {!it.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    {it.description && (
                      <p className="text-sm text-muted-foreground mt-1">{it.description}</p>
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
          ))}
        </div>
      )}
    </div>
  );
}
