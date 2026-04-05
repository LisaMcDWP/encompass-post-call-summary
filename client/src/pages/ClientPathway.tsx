import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, Route, Save, Trash2, Plus, Pencil, X, Check } from "lucide-react";
import { useClientPathway, type ClientPathway } from "@/contexts/ClientPathwayContext";

export default function ClientPathwayPage() {
  const { clientPathways, selectedCPId, setSelectedCPId, refresh, loading } = useClientPathway();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formClient, setFormClient] = useState("");
  const [formPathway, setFormPathway] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setFormClient("");
    setFormPathway("");
    setFormDescription("");
    setShowAdd(false);
    setEditingId(null);
  };

  const startEdit = (cp: ClientPathway) => {
    setEditingId(cp.id);
    setFormClient(cp.client);
    setFormPathway(cp.pathway);
    setFormDescription(cp.description || "");
    setShowAdd(false);
  };

  const handleSave = async () => {
    if (!formClient.trim() || !formPathway.trim()) {
      toast({ title: "Missing Fields", description: "Client and Pathway are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/client-pathways/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client: formClient.trim(), pathway: formPathway.trim(), description: formDescription.trim() }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
        toast({ title: "Updated", description: "Client & Pathway updated." });
      } else {
        const res = await fetch("/api/client-pathways", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client: formClient.trim(), pathway: formPathway.trim(), description: formDescription.trim() }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
        const created = await res.json();
        setSelectedCPId(created.id);
        toast({ title: "Created", description: "New Client & Pathway created." });
      }
      resetForm();
      await refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this client & pathway configuration? All associated settings will remain but become orphaned.")) return;
    try {
      const res = await fetch(`/api/client-pathways/${id}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      toast({ title: "Deleted", description: "Client & Pathway removed." });
      if (selectedCPId === id) setSelectedCPId(null);
      await refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="text-page-title">
              <Building2 className="h-6 w-6 text-primary" />
              Client & Pathway
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage client and pathway configurations. Each configuration has its own observations, context parameters, prompts, and call QA settings.
            </p>
          </div>
          {!showAdd && editingId === null && (
            <Button onClick={() => setShowAdd(true)} className="bg-primary hover:bg-primary/90 text-white" data-testid="button-add-cp">
              <Plus className="h-4 w-4 mr-1.5" />
              Add New
            </Button>
          )}
        </div>

        {(showAdd || editingId !== null) && (
          <Card className="border-primary/30 shadow-sm mb-6">
            <CardContent className="py-5 px-5 space-y-4">
              <p className="text-sm font-semibold text-foreground">{editingId ? "Edit" : "New"} Client & Pathway</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Client
                  </Label>
                  <Input placeholder="e.g. Encompass Health" value={formClient} onChange={e => setFormClient(e.target.value)} className="text-sm" data-testid="input-form-client" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Route className="h-3.5 w-3.5 text-muted-foreground" /> Pathway
                  </Label>
                  <Input placeholder="e.g. Post-Discharge Follow-Up" value={formPathway} onChange={e => setFormPathway(e.target.value)} className="text-sm" data-testid="input-form-pathway" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Description (optional)</Label>
                <Textarea placeholder="Brief description of this configuration..." value={formDescription} onChange={e => setFormDescription(e.target.value)} className="text-sm resize-none" rows={2} data-testid="input-form-description" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button onClick={handleSave} disabled={saving || !formClient.trim() || !formPathway.trim()} className="bg-primary hover:bg-primary/90 text-white" data-testid="button-save-cp">
                  {editingId ? <Check className="h-4 w-4 mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                  {saving ? "Saving..." : editingId ? "Update" : "Create"}
                </Button>
                <Button variant="outline" onClick={resetForm} data-testid="button-cancel-cp">
                  <X className="h-4 w-4 mr-1.5" /> Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Card className="border-border/60">
            <CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent>
          </Card>
        ) : clientPathways.length === 0 && !showAdd ? (
          <Card className="border-border/60">
            <CardContent className="py-12 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No client & pathway configurations yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Create one to start configuring observations, prompts, and settings.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {clientPathways.map(cp => (
              <Card key={cp.id} className={`border-border/60 shadow-sm transition-colors ${selectedCPId === cp.id ? "ring-2 ring-primary/30 border-primary/40" : ""}`} data-testid={`card-cp-${cp.id}`}>
                <CardContent className="py-4 px-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-foreground" data-testid={`text-cp-client-${cp.id}`}>{cp.client}</span>
                      <span className="text-muted-foreground/50 text-xs">/</span>
                      <span className="text-sm text-muted-foreground" data-testid={`text-cp-pathway-${cp.id}`}>{cp.pathway}</span>
                    </div>
                    {cp.description && (
                      <p className="text-xs text-muted-foreground/70 truncate">{cp.description}</p>
                    )}
                  </div>
                  {selectedCPId === cp.id && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                      Active
                    </span>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    {selectedCPId !== cp.id && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedCPId(cp.id)} className="text-xs h-7 px-2" data-testid={`button-select-cp-${cp.id}`}>
                        Select
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => startEdit(cp)} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" data-testid={`button-edit-cp-${cp.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(cp.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" data-testid={`button-delete-cp-${cp.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <p className="text-foreground text-sm">
            Each client & pathway configuration maintains its own set of <strong>observations</strong>, <strong>context parameters</strong>, <strong>prompts</strong>, and <strong>call QA settings</strong>. Select an active configuration using the sidebar dropdown, then configure its settings via the Setup pages.
          </p>
        </div>
      </div>
    </div>
  );
}
