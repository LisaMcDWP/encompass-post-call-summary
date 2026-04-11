import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useClientPathway } from "@/contexts/ClientPathwayContext";
import { Plus, Pencil, Trash2, ClipboardCheck, Loader2 } from "lucide-react";

interface ReviewItem {
  id: number;
  name: string;
  displayName: string;
  description: string;
  category: string;
  displayOrder: number;
  isActive: boolean;
}

const emptyForm = { name: "", displayName: "", description: "", category: "General", displayOrder: 0, isActive: true };

export default function ReviewItems() {
  const { selectedCPId } = useClientPathway();
  const { toast } = useToast();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const cpParam = `clientPathwayId=${selectedCPId}`;

  const fetchData = async () => {
    if (!selectedCPId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/call-review-items?${cpParam}`);
      if (!res.ok) throw new Error("Failed to fetch");
      setItems(await res.json());
    } catch {
      toast({ title: "Error", description: "Failed to load review items", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedCPId]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, displayOrder: items.length });
    setDialogOpen(true);
  };

  const openEdit = (item: ReviewItem) => {
    setEditingId(item.id);
    setForm({ name: item.name, displayName: item.displayName, description: item.description, category: item.category, displayOrder: item.displayOrder, isActive: item.isActive });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      const url = editingId ? `/api/call-review-items/${editingId}` : "/api/call-review-items";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, clientPathwayId: selectedCPId }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: editingId ? "Review item updated" : "Review item created" });
      setDialogOpen(false);
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to save review item", variant: "destructive" });
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Delete this review item?")) return;
    try {
      const res = await fetch(`/api/call-review-items/${id}?${cpParam}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Review item deleted" });
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  if (!selectedCPId) {
    return (
      <div className="p-8 text-center text-gray-500">
        <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>Select a Client & Pathway to manage review items.</p>
      </div>
    );
  }

  const grouped = items.reduce<Record<string, ReviewItem[]>>((acc, item) => {
    const cat = item.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryKeys = Object.keys(grouped).sort();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#172938]" style={{ fontFamily: "Montserrat, sans-serif" }} data-testid="text-review-items-title">Call Review Items</h1>
          <p className="text-sm text-gray-500 mt-1">Configure the checklist items reviewers use when evaluating processed calls.</p>
        </div>
        <Button onClick={openNew} className="bg-[#0098db] hover:bg-[#0086c3]" data-testid="button-add-review-item">
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#0098db]" /></div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>No review items configured yet.</p>
            <Button variant="outline" className="mt-4" onClick={openNew} data-testid="button-add-first-review-item">Add your first review item</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {categoryKeys.map((cat) => (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{cat}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {grouped[cat].map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors" data-testid={`review-item-${item.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-[#172938]">{item.displayName}</span>
                        <Badge variant={item.isActive ? "default" : "secondary"} className={`text-[10px] ${item.isActive ? "bg-[#96d410] text-white" : ""}`}>
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {item.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{item.description}</p>}
                      <p className="text-[10px] text-gray-400 mt-0.5">Key: {item.name}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} data-testid={`button-edit-review-item-${item.id}`}><Pencil className="h-3.5 w-3.5 text-gray-500" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteItem(item.id)} data-testid={`button-delete-review-item-${item.id}`}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Review Item" : "New Review Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name (key)</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. greeting_quality" data-testid="input-review-item-name" />
            </div>
            <div>
              <Label>Display Name</Label>
              <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="e.g. Greeting Quality" data-testid="input-review-item-display-name" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What should the reviewer check?" data-testid="input-review-item-description" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Communication, Compliance" data-testid="input-review-item-category" />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label>Display Order</Label>
                <Input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })} data-testid="input-review-item-order" />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} data-testid="switch-review-item-active" />
                <Label className="text-sm">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-[#0098db] hover:bg-[#0086c3]" disabled={!form.name || !form.displayName} data-testid="button-save-review-item">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
