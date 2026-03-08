import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function GeneratedPrompt() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [location] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    fetchPrompt();
  }, [location]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchPrompt();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", () => fetchPrompt());
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", () => fetchPrompt());
    };
  }, []);

  async function fetchPrompt() {
    try {
      setLoading(true);
      const res = await fetch("/api/prompt");
      if (!res.ok) throw new Error("Failed to load prompt");
      const data = await res.json();
      setPrompt(data.prompt);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast({ title: "Copied", description: "Prompt copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to copy.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="text-page-title">
              <Eye className="h-6 w-6 text-primary" />
              Generated Prompt
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Read-only view of the fully assembled prompt sent to Gemini, built from your observations, summary instruction, context parameters, and guidance settings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPrompt}
              data-testid="button-refresh-prompt"
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              data-testid="button-copy-prompt"
            >
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-foreground">
            This prompt is generated automatically from your current configuration. To change it, update your{" "}
            <a href="/observations" className="text-primary underline">observations</a>,{" "}
            <a href="/summary-prompt" className="text-primary underline">summary instruction</a>, or{" "}
            <a href="/context-parameters" className="text-primary underline">context parameters</a>.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className="text-[10px]">Placeholders like {"{{SOURCE_TEXT}}"} are replaced at runtime</Badge>
          </div>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
            <CardTitle className="text-base flex items-center gap-2">
              Full Prompt
              <Badge variant="outline" className="text-[10px] font-normal">
                {prompt.length.toLocaleString()} characters
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre
              className="text-sm whitespace-pre-wrap font-mono p-5 overflow-x-auto text-foreground leading-relaxed"
              style={{ tabSize: 2 }}
              data-testid="text-generated-prompt"
            >
              {prompt}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
