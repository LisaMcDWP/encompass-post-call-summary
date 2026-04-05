import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RotateCcw, ShieldAlert, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_BARRIERS_GUIDANCE = `Extract ANY barriers to care, recovery, or well-being that the patient or caregiver mentions or that can be identified from the conversation. A barrier is anything that may prevent or hinder the patient from following their care plan, recovering properly, or accessing needed services. Include barriers that are explicitly stated AND those clearly implied. Common barrier categories include: Transportation, Financial, Medication Access, Social Support, Health Literacy, Language, Housing, Caregiver Burden, Emotional/Mental Health, Physical Limitation, Insurance/Coverage. Assign a severity based on potential impact on patient outcomes.`;

export default function BarriersPrompt() {
  const [guidance, setGuidance] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchGuidance();
  }, []);

  async function fetchGuidance() {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/barriers-guidance");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setGuidance(data.guidance || DEFAULT_BARRIERS_GUIDANCE);
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
      const res = await fetch("/api/settings/barriers-guidance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidance }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save");
      }
      setIsCustom(true);
      toast({ title: "Saved", description: "Barriers prompt guidance updated." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    try {
      setResetting(true);
      const res = await fetch("/api/settings/barriers-guidance", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to reset");
      setGuidance(DEFAULT_BARRIERS_GUIDANCE);
      setIsCustom(false);
      toast({ title: "Reset", description: "Barriers prompt restored to default." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="heading-barriers-prompt">
            <ShieldAlert className="h-6 w-6 text-red-500" />
            Barriers Prompt
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure the guidance that tells Gemini how to identify and extract barriers to care from call transcripts.
          </p>
        </div>
        {isCustom && (
          <Badge variant="outline" className="border-orange-400 text-orange-500" data-testid="badge-custom">
            Custom
          </Badge>
        )}
      </div>

      <Card className="border-border/60 bg-card shadow-md">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-base flex items-center gap-2">
            Barriers Guidance
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How this works</p>
              <p>
                This guidance is appended to the Gemini prompt as a "BARRIERS GUIDANCE" directive. Use it to customize
                what Gemini considers a barrier, which categories to prioritize, how to assign severity, or any
                domain-specific instructions for your patient population. The default covers common healthcare barriers.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Default barrier categories</p>
              <p>
                Transportation, Financial, Medication Access, Social Support, Health Literacy, Language, Housing,
                Caregiver Burden, Emotional/Mental Health, Physical Limitation, Insurance/Coverage, Other
              </p>
            </div>
          </div>

          <Textarea
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            rows={10}
            className="font-mono text-sm"
            placeholder="Enter the barriers guidance..."
            data-testid="textarea-barriers-guidance"
          />

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || !guidance.trim()}
                data-testid="button-save-barriers"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={resetting || !isCustom}
                data-testid="button-reset-barriers"
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
          <CardTitle className="text-base text-muted-foreground">Default Guidance</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 p-4 rounded-lg border border-border/50" data-testid="text-default-guidance">
            {DEFAULT_BARRIERS_GUIDANCE}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card shadow-md">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-base text-muted-foreground">Extracted Barrier Fields</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="font-semibold text-primary font-mono">barrier</p>
              <p className="text-muted-foreground mt-0.5">Short description of the barrier</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="font-semibold text-primary font-mono">context</p>
              <p className="text-muted-foreground mt-0.5">Full details — circumstances, background, and impact on care</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="font-semibold text-primary font-mono">category</p>
              <p className="text-muted-foreground mt-0.5">Barrier category (Transportation, Financial, etc.)</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="font-semibold text-primary font-mono">severity</p>
              <p className="text-muted-foreground mt-0.5">Impact level: high, medium, or low</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="font-semibold text-primary font-mono">observation_name</p>
              <p className="text-muted-foreground mt-0.5">Linked observation topic key, or null</p>
            </div>
            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
              <p className="font-semibold text-primary font-mono">evidence</p>
              <p className="text-muted-foreground mt-0.5">Direct quote from the transcript</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
