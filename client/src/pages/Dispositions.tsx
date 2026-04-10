import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useClientPathway } from "@/contexts/ClientPathwayContext";

interface DispositionCategory {
  id: number;
  name: string;
  displayName: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
}

interface DispositionDetail {
  id: number;
  categoryId: number;
  name: string;
  displayName: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
}

const emptyCategoryForm = { name: "", displayName: "", description: "", displayOrder: 0, isActive: true };
const emptyDetailForm = { categoryId: 0, name: "", displayName: "", description: "", displayOrder: 0, isActive: true };

export default function Dispositions() {
  const { selectedCPId } = useClientPathway();
  const [categories, setCategories] = useState<DispositionCategory[]>([]);
  const [details, setDetails] = useState<DispositionDetail[]>([]);
  const [expandedCat, setExpandedCat] = useState<number | null>(null);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [detDialogOpen, setDetDialogOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingDetId, setEditingDetId] = useState<number | null>(null);
  const [catForm, setCatForm] = useState({ ...emptyCategoryForm });
  const [detForm, setDetForm] = useState({ ...emptyDetailForm });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const cpParam = selectedCPId ? `clientPathwayId=${selectedCPId}` : "";

  const fetchData = async () => {
    if (!selectedCPId) return;
    setLoading(true);
    try {
      const [catRes, detRes] = await Promise.all([
        fetch(`/api/disposition-categories?${cpParam}`),
        fetch(`/api/disposition-details?${cpParam}`),
      ]);
      if (!catRes.ok || !detRes.ok) throw new Error("Failed to fetch");
      setCategories(await catRes.json());
      setDetails(await detRes.json());
    } catch (e) {
      toast({ title: "Error", description: "Failed to load dispositions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedCPId]);

  const openNewCategory = () => {
    setEditingCatId(null);
    setCatForm({ ...emptyCategoryForm, displayOrder: categories.length });
    setCatDialogOpen(true);
  };

  const openEditCategory = (cat: DispositionCategory) => {
    setEditingCatId(cat.id);
    setCatForm({ name: cat.name, displayName: cat.displayName, description: cat.description, displayOrder: cat.displayOrder, isActive: cat.isActive });
    setCatDialogOpen(true);
  };

  const saveCategory = async () => {
    try {
      const url = editingCatId ? `/api/disposition-categories/${editingCatId}` : "/api/disposition-categories";
      const method = editingCatId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...catForm, clientPathwayId: selectedCPId }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: editingCatId ? "Category updated" : "Category created" });
      setCatDialogOpen(false);
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to save category", variant: "destructive" });
    }
  };

  const deleteCategory = async (id: number) => {
    if (!confirm("Delete this category and all its details?")) return;
    try {
      const res = await fetch(`/api/disposition-categories/${id}?${cpParam}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Category deleted" });
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const openNewDetail = (categoryId: number) => {
    setEditingDetId(null);
    const catDetails = details.filter(d => d.categoryId === categoryId);
    setDetForm({ ...emptyDetailForm, categoryId, displayOrder: catDetails.length });
    setDetDialogOpen(true);
  };

  const openEditDetail = (det: DispositionDetail) => {
    setEditingDetId(det.id);
    setDetForm({ categoryId: det.categoryId, name: det.name, displayName: det.displayName, description: det.description, displayOrder: det.displayOrder, isActive: det.isActive });
    setDetDialogOpen(true);
  };

  const saveDetail = async () => {
    try {
      const url = editingDetId ? `/api/disposition-details/${editingDetId}` : "/api/disposition-details";
      const method = editingDetId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...detForm, clientPathwayId: selectedCPId }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: editingDetId ? "Detail updated" : "Detail created" });
      setDetDialogOpen(false);
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to save detail", variant: "destructive" });
    }
  };

  const deleteDetail = async (id: number) => {
    if (!confirm("Delete this detail?")) return;
    try {
      const res = await fetch(`/api/disposition-details/${id}?${cpParam}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Detail deleted" });
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  if (!selectedCPId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4" style={{ fontFamily: "Montserrat, sans-serif" }}>Call Dispositions</h1>
        <p className="text-gray-500">Select a Client / Pathway to manage dispositions.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }} data-testid="text-dispositions-title">Call Dispositions</h1>
          <p className="text-sm text-gray-500 mt-1">Configure the two-level disposition taxonomy (Category &rarr; Detail) used to classify call outcomes.</p>
        </div>
        <Button onClick={openNewCategory} data-testid="button-add-category" style={{ backgroundColor: "#0098db" }}>
          <Plus className="h-4 w-4 mr-2" /> Add Category
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No disposition categories configured yet. Click "Add Category" to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.sort((a, b) => a.displayOrder - b.displayOrder).map((cat) => {
            const catDetails = details.filter(d => d.categoryId === cat.id).sort((a, b) => a.displayOrder - b.displayOrder);
            const isExpanded = expandedCat === cat.id;
            return (
              <Card key={cat.id} data-testid={`card-category-${cat.id}`}>
                <CardContent className="p-0">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                    data-testid={`button-expand-category-${cat.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                      <div>
                        <span className="font-semibold" data-testid={`text-category-name-${cat.id}`}>{cat.displayName}</span>
                        <span className="text-xs text-gray-400 ml-2">({cat.name})</span>
                        {!cat.isActive && <Badge variant="outline" className="ml-2 text-xs">Inactive</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Badge variant="secondary" className="text-xs">{catDetails.length} details</Badge>
                      <Button variant="ghost" size="sm" onClick={() => openEditCategory(cat)} data-testid={`button-edit-category-${cat.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteCategory(cat.id)} data-testid={`button-delete-category-${cat.id}`}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                    </div>
                  </div>
                  {cat.description && <p className="px-4 pb-2 text-sm text-gray-500 -mt-2 pl-11">{cat.description}</p>}
                  {isExpanded && (
                    <div className="border-t bg-gray-50/50">
                      <div className="p-3 pl-11 space-y-2">
                        {catDetails.map((det) => (
                          <div key={det.id} className="flex items-center justify-between bg-white rounded-md border px-3 py-2" data-testid={`row-detail-${det.id}`}>
                            <div>
                              <span className="text-sm font-medium" data-testid={`text-detail-name-${det.id}`}>{det.displayName}</span>
                              <span className="text-xs text-gray-400 ml-2">({det.name})</span>
                              {!det.isActive && <Badge variant="outline" className="ml-2 text-xs">Inactive</Badge>}
                              {det.description && <p className="text-xs text-gray-500 mt-0.5">{det.description}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditDetail(det)} data-testid={`button-edit-detail-${det.id}`}><Pencil className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteDetail(det.id)} data-testid={`button-delete-detail-${det.id}`}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => openNewDetail(cat.id)} data-testid={`button-add-detail-${cat.id}`}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Detail
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCatId ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Display Name</Label>
              <Input value={catForm.displayName} onChange={(e) => {
                const displayName = e.target.value;
                const name = editingCatId ? catForm.name : displayName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
                setCatForm({ ...catForm, displayName, name });
              }} data-testid="input-category-displayName" />
            </div>
            <div>
              <Label>Name (snake_case)</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} data-testid="input-category-name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} rows={2} data-testid="input-category-description" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={catForm.isActive} onCheckedChange={(v) => setCatForm({ ...catForm, isActive: v })} data-testid="switch-category-active" />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveCategory} disabled={!catForm.name || !catForm.displayName} style={{ backgroundColor: "#0098db" }} data-testid="button-save-category">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detDialogOpen} onOpenChange={setDetDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingDetId ? "Edit Detail" : "New Detail"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Display Name</Label>
              <Input value={detForm.displayName} onChange={(e) => {
                const displayName = e.target.value;
                const name = editingDetId ? detForm.name : displayName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
                setDetForm({ ...detForm, displayName, name });
              }} data-testid="input-detail-displayName" />
            </div>
            <div>
              <Label>Name (snake_case)</Label>
              <Input value={detForm.name} onChange={(e) => setDetForm({ ...detForm, name: e.target.value })} data-testid="input-detail-name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={detForm.description} onChange={(e) => setDetForm({ ...detForm, description: e.target.value })} rows={2} data-testid="input-detail-description" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={detForm.isActive} onCheckedChange={(v) => setDetForm({ ...detForm, isActive: v })} data-testid="switch-detail-active" />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveDetail} disabled={!detForm.name || !detForm.displayName} style={{ backgroundColor: "#0098db" }} data-testid="button-save-detail">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
