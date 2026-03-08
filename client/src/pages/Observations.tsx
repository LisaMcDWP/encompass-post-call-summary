import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical, X, BookOpen, ArrowLeft } from "lucide-react";

interface EnumValue {
  label: string;
  color: "GREEN" | "YELLOW" | "RED" | "BLUE" | "GRAY";
}

interface Observation {
  id: number;
  name: string;
  displayName: string;
  domain: string;
  displayOrder: number;
  valueType: string;
  value: EnumValue[];
  isActive: boolean;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; label: string }> = {
  GREEN: { bg: "bg-green-100", text: "text-green-800", border: "border-green-300", label: "Green (Positive)" },
  YELLOW: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300", label: "Yellow (Caution)" },
  RED: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300", label: "Red (Negative)" },
  BLUE: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300", label: "Blue (Info)" },
  GRAY: { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-300", label: "Gray (Neutral)" },
};

const DOMAIN_OPTIONS = ["clinical", "medication", "appointment", "equipment", "discharge", "experience", "general"];
const VALUE_TYPE_OPTIONS = ["enum", "boolean", "text", "number"];

const emptyForm = {
  name: "",
  displayName: "",
  domain: "general",
  valueType: "enum",
  value: [] as EnumValue[],
  isActive: true,
};

export default function Observations() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [newEnumLabel, setNewEnumLabel] = useState("");
  const [newEnumColor, setNewEnumColor] = useState<string>("GREEN");
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchObservations = async () => {
    const res = await fetch("/api/observations");
    const data = await res.json();
    setObservations(data);
  };

  useEffect(() => {
    fetchObservations();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setNewEnumLabel("");
    setIsDialogOpen(true);
  };

  const openEdit = (obs: Observation) => {
    setEditingId(obs.id);
    setForm({
      name: obs.name,
      displayName: obs.displayName,
      domain: obs.domain,
      valueType: obs.valueType,
      value: [...(obs.value || [])],
      isActive: obs.isActive,
    });
    setNewEnumLabel("");
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
      domain: form.domain,
      valueType: form.valueType,
      value: form.valueType === "enum" ? form.value : [],
      isActive: form.isActive,
    };

    let res;
    if (editingId) {
      res = await fetch(`/api/observations/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      const maxOrder = observations.length > 0 ? Math.max(...observations.map(o => o.displayOrder)) : -1;
      res = await fetch("/api/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, displayOrder: maxOrder + 1 }),
      });
    }

    if (res.ok) {
      toast({ title: editingId ? "Updated" : "Created", description: `Observation "${form.displayName}" saved.` });
      setIsDialogOpen(false);
      fetchObservations();
    } else {
      const err = await res.json();
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (obs: Observation) => {
    if (!confirm(`Delete "${obs.displayName}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/observations/${obs.id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Deleted", description: `"${obs.displayName}" removed.` });
      fetchObservations();
    }
  };

  const handleToggleActive = async (obs: Observation) => {
    await fetch(`/api/observations/${obs.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !obs.isActive }),
    });
    fetchObservations();
  };

  const addEnumValue = () => {
    if (!newEnumLabel.trim()) return;
    if (form.value.some(v => v.label === newEnumLabel.trim())) {
      toast({ title: "Duplicate", description: "This value already exists.", variant: "destructive" });
      return;
    }
    setForm({
      ...form,
      value: [...form.value, { label: newEnumLabel.trim(), color: newEnumColor as EnumValue["color"] }],
    });
    setNewEnumLabel("");
  };

  const removeEnumValue = (index: number) => {
    setForm({
      ...form,
      value: form.value.filter((_, i) => i !== index),
    });
  };

  const handleDragStart = (id: number) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedId === null || draggedId === targetId) return;

    const newObs = [...observations];
    const dragIdx = newObs.findIndex(o => o.id === draggedId);
    const targetIdx = newObs.findIndex(o => o.id === targetId);
    const [moved] = newObs.splice(dragIdx, 1);
    newObs.splice(targetIdx, 0, moved);
    setObservations(newObs);
  };

  const handleDragEnd = async () => {
    setDraggedId(null);
    const orderedIds = observations.map(o => o.id);
    await fetch("/api/observations/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    fetchObservations();
  };

  const groupedByDomain = observations.reduce((acc, obs) => {
    if (!acc[obs.domain]) acc[obs.domain] = [];
    acc[obs.domain].push(obs);
    return acc;
  }, {} as Record<string, Observation[]>);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="bg-white border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/images/guideway-logo.svg" alt="Guideway Care Logo" className="h-8" />
            <span className="text-xl font-bold text-[#172938]">Guideway Care</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors" data-testid="link-home">
              Test API
            </Link>
            <Link href="/observations" className="text-sm font-medium text-primary border-b-2 border-primary pb-0.5" data-testid="link-observations">
              Observations
            </Link>
            <Link href="/reference" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1" data-testid="link-reference">
              <BookOpen className="h-3.5 w-3.5" /> Reference
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
              Observation Definitions
            </h1>
            <p className="text-muted-foreground mt-1">
              Define the observation topics used in the Gemini analysis prompt. Drag to reorder.
            </p>
          </div>
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90" data-testid="button-add-observation">
            <Plus className="h-4 w-4 mr-2" /> Add Observation
          </Button>
        </div>

        <div className="space-y-3">
          {observations.map((obs) => (
            <Card
              key={obs.id}
              className={`border-border/60 shadow-sm transition-all ${!obs.isActive ? "opacity-50" : ""} ${draggedId === obs.id ? "ring-2 ring-primary" : ""}`}
              draggable
              onDragStart={() => handleDragStart(obs.id)}
              onDragOver={(e) => handleDragOver(e, obs.id)}
              onDragEnd={handleDragEnd}
              data-testid={`card-observation-${obs.id}`}
            >
              <CardContent className="py-4 px-5">
                <div className="flex items-center gap-4">
                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab shrink-0" />
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground" data-testid={`text-observation-name-${obs.id}`}>{obs.displayName}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5">{obs.domain}</Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5">{obs.valueType}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{obs.name}</span>
                    </div>
                    {obs.valueType === "enum" && obs.value && obs.value.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(obs.value as EnumValue[]).map((v, i) => {
                          const c = COLOR_MAP[v.color] || COLOR_MAP.GRAY;
                          return (
                            <span
                              key={i}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${c.bg} ${c.text} ${c.border}`}
                              data-testid={`badge-enum-value-${obs.id}-${i}`}
                            >
                              {v.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch
                      checked={obs.isActive}
                      onCheckedChange={() => handleToggleActive(obs)}
                      data-testid={`switch-active-${obs.id}`}
                    />
                    <Button variant="ghost" size="sm" onClick={() => openEdit(obs)} data-testid={`button-edit-${obs.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(obs)} className="text-destructive hover:text-destructive" data-testid={`button-delete-${obs.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {observations.length === 0 && (
          <Card className="border-dashed border-2 border-border/60">
            <CardContent className="py-12 text-center text-muted-foreground">
              No observations defined yet. Click "Add Observation" to get started.
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Observation" : "New Observation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="obs-name" className="text-sm font-semibold">Name (key)</Label>
                <Input
                  id="obs-name"
                  placeholder="e.g. prescription_pickup"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="font-mono text-sm"
                  data-testid="input-obs-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obs-display-name" className="text-sm font-semibold">Display Name</Label>
                <Input
                  id="obs-display-name"
                  placeholder="e.g. Prescription Pickup"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  className="text-sm"
                  data-testid="input-obs-display-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Domain</Label>
                <Select value={form.domain} onValueChange={(v) => setForm({ ...form, domain: v })}>
                  <SelectTrigger data-testid="select-domain">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOMAIN_OPTIONS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Value Type</Label>
                <Select value={form.valueType} onValueChange={(v) => setForm({ ...form, valueType: v, value: v === "enum" ? form.value : [] })}>
                  <SelectTrigger data-testid="select-value-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALUE_TYPE_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.valueType === "enum" && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Enum Values</Label>
                <div className="space-y-2">
                  {form.value.map((v, i) => {
                    const c = COLOR_MAP[v.color] || COLOR_MAP.GRAY;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${c.bg} ${c.text} ${c.border} flex-grow`}>
                          {v.label}
                        </span>
                        <span className="text-xs text-muted-foreground w-16">{v.color}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeEnumValue(i)} className="h-7 w-7 p-0" data-testid={`button-remove-enum-${i}`}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-grow space-y-1">
                    <Label className="text-xs text-muted-foreground">Label</Label>
                    <Input
                      placeholder="e.g. Picked Up"
                      value={newEnumLabel}
                      onChange={(e) => setNewEnumLabel(e.target.value)}
                      className="text-sm h-9"
                      onKeyDown={(e) => e.key === "Enter" && addEnumValue()}
                      data-testid="input-enum-label"
                    />
                  </div>
                  <div className="w-36 space-y-1">
                    <Label className="text-xs text-muted-foreground">Color</Label>
                    <Select value={newEnumColor} onValueChange={setNewEnumColor}>
                      <SelectTrigger className="h-9" data-testid="select-enum-color">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(COLOR_MAP).map(([key, val]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${val.bg} border ${val.border}`} />
                              {val.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={addEnumValue} className="h-9" data-testid="button-add-enum-value">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">Cancel</Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90" data-testid="button-save-observation">
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
