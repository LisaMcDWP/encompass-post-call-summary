import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RotateCcw, FileText, Info, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useClientPathway } from "@/contexts/ClientPathwayContext";
import { exportPathwayPdf } from "@/lib/exportPathwayPdf";

export default function SummaryPrompt() {
  const { selectedCPId, selectedCP } = useClientPathway();
  const [instruction, setInstruction] = useState("");
  const [defaultInstruction, setDefaultInstruction] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const cpParam = selectedCPId ? `clientPathwayId=${selectedCPId}` : "";

  useEffect(() => {
    if (selectedCPId) {
      fetchInstruction();
    }
  }, [selectedCPId]);

  async function fetchInstruction() {
    if (!selectedCPId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/settings/summary-instruction?${cpParam}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setInstruction(data.instruction);
      setDefaultInstruction(data.defaultInstruction);
      setIsCustom(data.isCustom);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const res = await fetch(`/api/settings/summary-instruction?${cpParam}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, clientPathwayId: selectedCPId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save");
      }
      setIsCustom(true);
      toast({ title: "Saved", description: "Summary prompt instruction updated." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    try {
      setResetting(true);
      const res = await fetch(`/api/settings/summary-instruction?${cpParam}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to reset");
      const data = await res.json();
      setInstruction(data.instruction);
      setIsCustom(false);
      toast({ title: "Reset", description: "Summary prompt restored to default." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  }

  const hasChanges = instruction !== defaultInstruction || isCustom;

  async function handleExportPdf() {
    if (!selectedCPId || !selectedCP) return;
    try {
      setExporting(true);
      const label = `${selectedCP.client} — ${selectedCP.pathway}`;
      await exportPathwayPdf(selectedCPId, label);
      toast({ title: "PDF generated", description: "Pathway configuration downloaded." });
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message || "Unable to generate PDF.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  if (!selectedCPId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No client & pathway selected.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Create or select one from the sidebar to configure the summary prompt.</p>
        </div>
      </div>
    );
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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="heading-summary-prompt">
            <FileText className="h-6 w-6 text-primary" />
            Summary Prompt
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure the instruction that tells Gemini how to generate the call summary.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCustom && (
            <Badge variant="outline" className="border-orange-400 text-orange-500" data-testid="badge-custom">
              Custom
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={handleExportPdf}
            disabled={exporting || !selectedCPId}
            data-testid="button-export-pathway-pdf"
          >
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            Export PDF
          </Button>
        </div>
      </div>

      <Card className="border-border/60 bg-card shadow-md">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-base flex items-center gap-2">
            Summary Instruction
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Available placeholder</p>
              <p>
                Use <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">{"{{SUMMARY_TOPICS}}"}</code> to
                automatically insert the list of active observation topic names (e.g., "overall feeling; disposition change; prescription pickup...").
                This placeholder is replaced dynamically based on your active observations.
              </p>
            </div>
          </div>

          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={8}
            className="font-mono text-sm"
            placeholder="Enter the summary instruction..."
            data-testid="textarea-summary-instruction"
          />

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || !instruction.trim()}
                data-testid="button-save-instruction"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={resetting || !isCustom}
                data-testid="button-reset-instruction"
              >
                {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Reset to Default
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card shadow-md">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-base text-muted-foreground">Default Instruction</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 p-4 rounded-lg border border-border/50" data-testid="text-default-instruction">
            {defaultInstruction}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
