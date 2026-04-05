import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, Route, Save, Trash2 } from "lucide-react";

interface ClientPathway {
  id: number;
  client: string;
  pathway: string;
}

export default function ClientPathwayPage() {
  const [data, setData] = useState<ClientPathway | null>(null);
  const [client, setClient] = useState("");
  const [pathway, setPathway] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const res = await fetch("/api/client-pathway");
      const json = await res.json();
      setData(json);
      if (json) {
        setClient(json.client);
        setPathway(json.pathway);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load client & pathway.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!client.trim() || !pathway.trim()) {
      toast({ title: "Missing Fields", description: "Both Client and Pathway are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/client-pathway", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: client.trim(), pathway: pathway.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        toast({ title: "Saved", description: "Client & Pathway configuration saved." });
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch("/api/client-pathway", { method: "DELETE" });
      if (res.ok) {
        setData(null);
        setClient("");
        setPathway("");
        toast({ title: "Cleared", description: "Client & Pathway configuration removed." });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <Building2 className="h-6 w-6 text-primary" />
            Client & Pathway
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure the client and pathway for this deployment. These values are logged with each processed call.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-foreground text-sm">
            For <strong>batch processing</strong>, the configured values below are automatically used.
            For <strong>real-time API calls</strong>, callers can optionally pass <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">client</code> and <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">pathway</code> in the request body. If not provided, these configured defaults are used.
          </p>
        </div>

        {loading ? (
          <Card className="border-border/60">
            <CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent>
          </Card>
        ) : (
          <Card className="border-border/60 shadow-sm">
            <CardContent className="py-6 px-6 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Client
                </Label>
                <Input
                  placeholder="e.g. Encompass Health"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  className="text-sm"
                  data-testid="input-client"
                />
                <p className="text-[11px] text-muted-foreground">The client organization name.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Route className="h-3.5 w-3.5 text-muted-foreground" />
                  Pathway
                </Label>
                <Input
                  placeholder="e.g. Post-Discharge Follow-Up"
                  value={pathway}
                  onChange={(e) => setPathway(e.target.value)}
                  className="text-sm"
                  data-testid="input-pathway"
                />
                <p className="text-[11px] text-muted-foreground">The care pathway or program name.</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !client.trim() || !pathway.trim()}
                  className="bg-primary hover:bg-primary/90 text-white"
                  data-testid="button-save"
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                {data && (
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    data-testid="button-clear"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Clear
                  </Button>
                )}
              </div>

              {data && (
                <div className="mt-4 pt-4 border-t border-border/60">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Current Configuration</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-md px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Client</p>
                      <p className="text-sm font-medium text-foreground" data-testid="text-current-client">{data.client}</p>
                    </div>
                    <div className="bg-muted/50 rounded-md px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pathway</p>
                      <p className="text-sm font-medium text-foreground" data-testid="text-current-pathway">{data.pathway}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
