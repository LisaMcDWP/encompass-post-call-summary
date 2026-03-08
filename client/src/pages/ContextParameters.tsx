import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical, Variable } from "lucide-react";

interface ContextParameter {
  id: number;
  name: string;
  displayName: string;
  description: string;
  dataType: string;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
}

const DATA_TYPE_OPTIONS = ["string", "number", "date", "boolean"];

const DATA_TYPE_LABELS: Record<string, string> = {
  string: "Text",
  number: "Number",
  date: "Date",
  boolean: "Yes/No",
};

const emptyForm = {
  name: "",
  displayName: "",
  description: "",
  dataType: "string",
  isRequired: false,
  isActive: true,
};

export default function ContextParameters() {
  const [params, setParams] = useState<ContextParameter[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchParams = async () => {
    try {
      const res = await fetch("/api/context-parameters");
      const data = await res.json();
      setParams(data);
    } catch {
      toast({ title: "Error", description: "Failed to load context parameters.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchParams(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEdit = (p: ContextParameter) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      dataType: p.dataType,
      isRequired: p.isRequired,
      isActive: p.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.displayName.trim()) {
      toast({ title: "Missing Fields", description: "Name and Display Name are required.", variant: "destructive" });
      return;
    }

    const payload = {
      name: form.name.trim(),
      displayName: form.displayName.trim(),
      description: form.description.trim(),
      dataType: form.dataType,
      isRequired: form.isRequired,
      isActive: form.isActive,
    };

    let res;
    if (editingId) {
      res = await fetch(`/api/context-parameters/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch("/api/context-parameters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, displayOrder: params.length }),
      });
    }

    if (res.ok) {
      toast({ title: editingId ? "Updated" : "Created", description: `Context parameter "${form.displayName}" saved.` });
      setIsDialogOpen(false);
      fetchParams();
    } else {
      const err = await res.json();
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/context-parameters/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Deleted", description: "Context parameter removed." });
      fetchParams();
    }
  };

  const handleToggleActive = async (p: ContextParameter) => {
    await fetch(`/api/context-parameters/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    fetchParams();
  };

  const handleToggleRequired = async (p: ContextParameter) => {
    await fetch(`/api/context-parameters/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRequired: !p.isRequired }),
    });
    fetchParams();
  };

  const autoGenerateName = (displayName: string) => {
    let name = displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (name && !/^[a-z]/.test(name)) {
      name = "p_" + name;
    }
    return name;
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="text-page-title">
              <Variable className="h-6 w-6 text-primary" />
              Context Parameters
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Define known context fields that API callers can pass in alongside the transcript to enrich the analysis.
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-primary hover:bg-primary/90 text-white"
            data-testid="button-add-context-param"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Parameter
          </Button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-foreground text-sm">
            Context parameters appear in the API request body under a <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">context</code> object.
            Active parameters are injected into the Gemini prompt as known information. Example:
          </p>
          <pre className="bg-white border border-border p-3 rounded-lg text-xs mt-2 overflow-x-auto text-foreground">
{`{
  "source_text": "...",
  "context": {
${params.filter(p => p.isActive).slice(0, 3).map(p => `    "${p.name}": "${p.dataType === 'number' ? '42' : p.dataType === 'boolean' ? 'true' : p.dataType === 'date' ? '2026-03-01' : 'example value'}"`).join(",\n") || '    "patient_name": "Jane Doe"'}
  }
}`}
          </pre>
        </div>

        {loading ? (
          <Card className="border-border/60">
            <CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent>
          </Card>
        ) : params.length === 0 ? (
          <Card className="border-dashed border-2 border-border/60">
            <CardContent className="py-12 text-center">
              <Variable className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No context parameters defined yet.</p>
              <p className="text-muted-foreground/70 text-sm mt-1">Add parameters like patient name, diagnosis, facility, etc.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {params.map((p) => (
              <Card
                key={p.id}
                className={`border-border/60 shadow-sm transition-opacity ${!p.isActive ? "opacity-50" : ""}`}
                data-testid={`card-context-param-${p.id}`}
              >
                <CardContent className="py-3 px-4 flex items-center gap-4">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground" data-testid={`text-param-name-${p.id}`}>{p.displayName}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5">{DATA_TYPE_LABELS[p.dataType] || p.dataType}</Badge>
                      {p.isRequired && (
                        <Badge className="text-[10px] px-1.5 bg-red-100 text-red-700 border-red-200">Required</Badge>
                      )}
                      <span className="text-xs text-muted-foreground font-mono">{p.name}</span>
                    </div>
                    {p.description && (
                      <p className="text-[11px] text-muted-foreground mt-1">{p.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-center gap-0.5">
                      <Switch
                        checked={p.isActive}
                        onCheckedChange={() => handleToggleActive(p)}
                        data-testid={`switch-active-${p.id}`}
                      />
                      <span className="text-[9px] text-muted-foreground">Active</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)} data-testid={`button-edit-${p.id}`}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} data-testid={`button-delete-${p.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Context Parameter" : "Add Context Parameter"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Display Name</Label>
                <Input
                  placeholder="e.g. Patient Name"
                  value={form.displayName}
                  onChange={(e) => {
                    const displayName = e.target.value;
                    setForm({
                      ...form,
                      displayName,
                      name: editingId ? form.name : autoGenerateName(displayName),
                    });
                  }}
                  data-testid="input-param-display-name"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">API Key Name</Label>
                <Input
                  placeholder="e.g. patient_name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="font-mono text-sm"
                  data-testid="input-param-name"
                />
                <p className="text-[11px] text-muted-foreground">The key used in the API request body under <code className="text-primary">context.{form.name || "key"}</code></p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Data Type</Label>
                  <Select value={form.dataType} onValueChange={(v) => setForm({ ...form, dataType: v })}>
                    <SelectTrigger data-testid="select-param-data-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_TYPE_OPTIONS.map((dt) => (
                        <SelectItem key={dt} value={dt}>{DATA_TYPE_LABELS[dt]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Required</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={form.isRequired}
                      onCheckedChange={(v) => setForm({ ...form, isRequired: v })}
                      data-testid="switch-param-required"
                    />
                    <span className="text-sm text-muted-foreground">{form.isRequired ? "Required" : "Optional"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">
                  Description
                  <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                </Label>
                <Textarea
                  placeholder="e.g. The full name of the patient being called."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="text-sm"
                  data-testid="textarea-param-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white" data-testid="button-save-param">{editingId ? "Update" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
