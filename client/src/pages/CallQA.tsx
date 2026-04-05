import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Save, Trash2, ClipboardCheck, Info, X, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CallQAPrompt {
  id: number;
  name: string;
  displayName: string;
  promptText: string;
  responseType: string;
  responseOptions: string[];
  isActive: boolean;
  displayOrder: number;
}

export default function CallQA() {
  const [prompts, setPrompts] = useState<CallQAPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "",
    displayName: "",
    promptText: "",
    responseType: "enum" as "enum" | "text" | "boolean",
    responseOptions: [] as string[],
    isActive: true,
    displayOrder: 0,
  });
  const [newOption, setNewOption] = useState("");

  useEffect(() => { fetchPrompts(); }, []);

  async function fetchPrompts() {
    try {
      setLoading(true);
      const res = await fetch("/api/call-qa-prompts");
      if (!res.ok) throw new Error("Failed to load");
      setPrompts(await res.json());
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ name: "", displayName: "", promptText: "", responseType: "enum", responseOptions: [], isActive: true, displayOrder: prompts.length });
    setNewOption("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(p: CallQAPrompt) {
    setForm({
      name: p.name,
      displayName: p.displayName,
      promptText: p.promptText,
      responseType: p.responseType as any,
      responseOptions: [...p.responseOptions],
      isActive: p.isActive,
      displayOrder: p.displayOrder,
    });
    setEditingId(p.id);
    setShowForm(true);
  }

  function addOption() {
    if (newOption.trim() && !form.responseOptions.includes(newOption.trim())) {
      setForm({ ...form, responseOptions: [...form.responseOptions, newOption.trim()] });
      setNewOption("");
    }
  }

  function removeOption(opt: string) {
    setForm({ ...form, responseOptions: form.responseOptions.filter(o => o !== opt) });
  }

  async function handleSave() {
    if (!form.name.trim() || !form.displayName.trim() || !form.promptText.trim()) {
      toast({ title: "Missing fields", description: "Name, display name, and prompt text are required.", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const url = editingId ? `/api/call-qa-prompts/${editingId}` : "/api/call-qa-prompts";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save");
      }
      toast({ title: editingId ? "Updated" : "Created", description: `Call QA prompt "${form.displayName}" saved.` });
      resetForm();
      await fetchPrompts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/call-qa-prompts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Deleted", description: "Call QA prompt removed." });
      await fetchPrompts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function toggleActive(p: CallQAPrompt) {
    try {
      const res = await fetch(`/api/call-qa-prompts/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await fetchPrompts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="heading-call-qa">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Call QA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure quality assessment prompts that evaluate overall call experience. Gemini will answer each active prompt for every analyzed call.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {prompts.filter(p => p.isActive).length} active
        </Badge>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">How Call QA works</p>
          <p>
            Each active Call QA prompt is injected into the Gemini analysis request. For every call transcript processed,
            Gemini evaluates and answers each prompt, returning a value, explanation, and supporting evidence. Results
            are stored in the <code className="bg-blue-100 px-1 rounded text-xs">call_qa_results</code> BigQuery table and displayed in the call detail view.
          </p>
        </div>
      </div>

      {prompts.length > 0 && (
        <div className="space-y-3">
          {prompts.map((p) => (
            <Card key={p.id} className={`border-border/60 shadow-sm ${!p.isActive ? 'opacity-60' : ''}`} data-testid={`call-qa-prompt-${p.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-semibold text-foreground">{p.displayName}</h3>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">{p.name}</Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{p.responseType}</Badge>
                      {!p.isActive && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-200 text-red-500">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{p.promptText}</p>
                    {p.responseType === "enum" && p.responseOptions.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {p.responseOptions.map((opt) => (
                          <Badge key={opt} variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/30">{opt}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={p.isActive}
                      onCheckedChange={() => toggleActive(p)}
                      data-testid={`toggle-call-qa-${p.id}`}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(p)} data-testid={`edit-call-qa-${p.id}`}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDelete(p.id)} data-testid={`delete-call-qa-${p.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!showForm && (
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-call-qa">
          <Plus className="h-4 w-4 mr-2" />
          Add Call QA Prompt
        </Button>
      )}

      {showForm && (
        <Card className="border-primary/30 bg-card shadow-md">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
            <CardTitle className="text-base">
              {editingId ? "Edit Call QA Prompt" : "New Call QA Prompt"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Name (key)</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  placeholder="e.g. overall_experience"
                  className="font-mono text-sm"
                  data-testid="input-call-qa-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Display Name</Label>
                <Input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="e.g. Overall Experience of the Call"
                  data-testid="input-call-qa-display-name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Prompt Text</Label>
              <Textarea
                value={form.promptText}
                onChange={(e) => setForm({ ...form, promptText: e.target.value })}
                rows={3}
                placeholder="Describe what Gemini should evaluate about the call..."
                className="text-sm"
                data-testid="input-call-qa-prompt-text"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Response Type</Label>
                <Select value={form.responseType} onValueChange={(v: any) => setForm({ ...form, responseType: v })}>
                  <SelectTrigger data-testid="select-call-qa-response-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enum">Enum (predefined options)</SelectItem>
                    <SelectItem value="text">Free Text</SelectItem>
                    <SelectItem value="boolean">Yes / No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                    data-testid="switch-call-qa-active"
                  />
                  <Label className="text-xs">Active</Label>
                </div>
              </div>
            </div>

            {form.responseType === "enum" && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Response Options</Label>
                <div className="flex gap-2">
                  <Input
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="Add an option..."
                    className="text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                    data-testid="input-call-qa-option"
                  />
                  <Button variant="outline" size="sm" onClick={addOption} data-testid="button-add-option">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {form.responseOptions.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {form.responseOptions.map((opt) => (
                      <Badge key={opt} variant="secondary" className="text-xs gap-1 pl-2 pr-1 py-0.5">
                        {opt}
                        <button onClick={() => removeOption(opt)} className="hover:text-red-500 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} data-testid="button-save-call-qa">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {editingId ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={resetForm} data-testid="button-cancel-call-qa">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 bg-card shadow-md">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-base text-muted-foreground">Output Fields (per call)</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="font-semibold text-primary font-mono">name</p>
              <p className="text-muted-foreground mt-0.5">The prompt key identifier</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="font-semibold text-primary font-mono">display_name</p>
              <p className="text-muted-foreground mt-0.5">Human-readable label for the prompt</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="font-semibold text-primary font-mono">value</p>
              <p className="text-muted-foreground mt-0.5">Gemini's assessed value (from options or free text)</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="font-semibold text-primary font-mono">detail</p>
              <p className="text-muted-foreground mt-0.5">Brief explanation of the assessment</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="font-semibold text-primary font-mono">evidence</p>
              <p className="text-muted-foreground mt-0.5">Supporting quote from the transcript, or null</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
