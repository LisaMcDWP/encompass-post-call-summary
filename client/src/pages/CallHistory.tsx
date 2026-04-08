import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, Clock, Coins, ChevronRight, ChevronLeft, X, FileText, Activity, ListChecks, ClipboardList, AlertCircle, MessageSquare, ShieldAlert, ClipboardCheck, RefreshCw, Download, History } from "lucide-react";
import { exportCallDetailPdf } from "@/lib/exportPdf";

interface CallInfo {
  call_id: string;
  care_flow_id: string | null;
  processed_datetime: string | null;
  call_date: string | null;
  source_type: string | null;
  source_id: string | null;
  processed_at: string;
  processing_time_ms: number;
  prompt_version: number | null;
  transcript_length: number | null;
  summary: string | null;
  follow_up_areas: string | null;
  transition_status: string | null;
  context_values: Record<string, string> | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  status: string;
  error_message: string | null;
  request_body: Record<string, any> | null;
  request_headers: Record<string, string> | null;
  client: string | null;
  pathway: string | null;
}

interface CallObservation {
  call_id: string;
  observation_name: string;
  observation_display_name: string | null;
  observation_domain: string | null;
  observation_value_type: string | null;
  observation_value: string | null;
  observation_detail: string | null;
  observation_evidence: string | null;
  observation_confidence: string | null;
}

interface QAPair {
  call_id: string;
  sequence_number: number;
  question: string;
  answer: string;
  asked_by: string | null;
  answered_by: string | null;
  observation_name: string | null;
  observation_display_name: string | null;
  category: string | null;
}

interface CallBarrier {
  call_id: string;
  barrier: string;
  context: string | null;
  category: string | null;
  severity: string | null;
  observation_name: string | null;
  observation_display_name: string | null;
  evidence: string | null;
}

interface CallQAResultItem {
  call_id: string;
  name: string;
  display_name: string | null;
  value: string | null;
  detail: string | null;
  evidence: string | null;
}

interface CallDetail {
  callInfo: CallInfo;
  observations: CallObservation[];
  qaPairs: QAPair[];
  barriers: CallBarrier[];
  callQA: CallQAResultItem[];
  transcript: string | null;
  totalRuns: number;
  currentRun: number;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

function CallDetailPanel({ callId, onClose }: { callId: string; onClose: () => void }) {
  const [selectedRun, setSelectedRun] = useState<number | undefined>(undefined);

  const { data, isLoading, isError } = useQuery<CallDetail>({
    queryKey: ["/api/calls", callId, selectedRun],
    queryFn: async () => {
      const url = selectedRun !== undefined ? `/api/calls/${callId}?run=${selectedRun}` : `/api/calls/${callId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load call detail");
      return res.json();
    },
  });

  const { data: obsConfig } = useQuery<{ name: string; display_order: number }[]>({
    queryKey: ["/api/observations-order"],
    queryFn: async () => {
      const res = await fetch("/api/observations?clientPathwayId=1");
      if (!res.ok) return [];
      const items = await res.json();
      return items.map((o: any) => ({ name: o.name, display_order: o.displayOrder ?? 999 }));
    },
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white rounded-xl p-8" onClick={e => e.stopPropagation()}>
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Loading call detail...</p>
        </div>
      </div>
    );
  }

  if (isError || !data?.callInfo) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white rounded-xl p-8 text-center max-w-sm" onClick={e => e.stopPropagation()}>
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">Failed to load call detail</p>
          <p className="text-xs text-muted-foreground mb-4">The call may no longer exist or there was a server error.</p>
          <Button variant="outline" size="sm" onClick={onClose} data-testid="button-close-error">Close</Button>
        </div>
      </div>
    );
  }

  const info = data.callInfo;
  const obsRaw = data.observations;
  const obs = obsConfig
    ? [...obsRaw].sort((a, b) => {
        const orderA = obsConfig.find(c => c.name === a.observation_name)?.display_order ?? 999;
        const orderB = obsConfig.find(c => c.name === b.observation_name)?.display_order ?? 999;
        return orderA - orderB;
      })
    : obsRaw;
  const qaPairs = data.qaPairs || [];
  const barriers = data.barriers || [];
  const callQA = data.callQA || [];
  const transcript = data.transcript || null;
  const totalRuns = data.totalRuns || 1;
  const currentRun = data.currentRun || 1;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-xl sm:rounded-xl w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
        data-testid="panel-call-detail"
      >
        <div className="sticky top-0 bg-white border-b border-border z-10 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-secondary flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Call Detail
            </h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5" data-testid="text-call-id">{info.call_id}</p>
          </div>
          <div className="flex items-center gap-2">
            {totalRuns > 1 && (
              <div className="flex items-center gap-1 bg-muted/40 rounded-lg px-2 py-1 border border-border/50" data-testid="run-selector">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={currentRun <= 1}
                  onClick={() => setSelectedRun(currentRun - 1)}
                  data-testid="button-prev-run"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs font-medium min-w-[60px] text-center" data-testid="text-run-indicator">
                  Run {currentRun} of {totalRuns}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={currentRun >= totalRuns}
                  onClick={() => setSelectedRun(currentRun + 1)}
                  data-testid="button-next-run"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                {currentRun !== totalRuns && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setSelectedRun(undefined)}
                    data-testid="button-latest-run"
                  >
                    Latest
                  </Button>
                )}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCallDetailPdf(info, obs, qaPairs, barriers, callQA, transcript)}
              data-testid="button-export-pdf"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-detail">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs" data-testid="detail-metadata">
            <div className="bg-muted/30 rounded-lg p-3 border border-border/40">
              <span className="text-muted-foreground block mb-1">Call Date</span>
              <span className="font-medium text-foreground" data-testid="detail-call-date">{formatDate(info.call_date)}</span>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 border border-border/40">
              <span className="text-muted-foreground block mb-1">Status</span>
              <Badge variant={info.status === "success" ? "default" : "destructive"} className="text-xs" data-testid="detail-status">
                {info.status}
              </Badge>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 border border-border/40">
              <span className="text-muted-foreground block mb-1">Processed</span>
              <span className="font-medium text-foreground" data-testid="detail-processed-at">{formatDate(info.processed_at)}</span>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 border border-border/40">
              <span className="text-muted-foreground block mb-1">Processing Time</span>
              <span className="font-medium text-foreground" data-testid="detail-processing-time">{(info.processing_time_ms / 1000).toFixed(1)}s</span>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 border border-border/40">
              <span className="text-muted-foreground block mb-1">Transcript</span>
              <span className="font-medium text-foreground" data-testid="detail-transcript-length">{info.transcript_length?.toLocaleString() ?? "—"} chars</span>
            </div>
          </div>

          {info.context_values && Object.keys(info.context_values).length > 0 && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-1.5">Known Context</span>
              <div className="bg-blue-50/50 rounded-lg border border-blue-200/40 p-3 flex flex-wrap gap-2" data-testid="detail-known-context">
                {Object.entries(info.context_values).map(([k, v]) => (
                  <div key={k} className="bg-white rounded-md border border-border/50 px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground">{k.replace(/_/g, " ")}</span>
                    <span className="font-semibold text-foreground ml-1.5">{v || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-1.5">API Request Fields</span>
            <div className="bg-muted/20 rounded-lg border border-border/40 divide-y divide-border/30">
              <div className="grid grid-cols-[140px_1fr] text-xs">
                <span className="text-muted-foreground px-3 py-2 font-medium">Call ID</span>
                <span className="font-mono px-3 py-2" data-testid="detail-call-id-field">{info.call_id}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr] text-xs">
                <span className="text-muted-foreground px-3 py-2 font-medium">Care Flow ID</span>
                <span className="font-mono px-3 py-2" data-testid="detail-care-flow">{info.care_flow_id || <span className="text-muted-foreground/50 italic">not provided</span>}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr] text-xs">
                <span className="text-muted-foreground px-3 py-2 font-medium">Source Type</span>
                <span className="font-mono px-3 py-2" data-testid="detail-source-type">{info.source_type || <span className="text-muted-foreground/50 italic">not provided</span>}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr] text-xs">
                <span className="text-muted-foreground px-3 py-2 font-medium">Source ID</span>
                <span className="font-mono px-3 py-2" data-testid="detail-source-id">{info.source_id || <span className="text-muted-foreground/50 italic">not provided</span>}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr] text-xs">
                <span className="text-muted-foreground px-3 py-2 font-medium">Client</span>
                <span className="px-3 py-2" data-testid="detail-client">{info.client || <span className="text-muted-foreground/50 italic">not set</span>}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr] text-xs">
                <span className="text-muted-foreground px-3 py-2 font-medium">Pathway</span>
                <span className="px-3 py-2" data-testid="detail-pathway">{info.pathway || <span className="text-muted-foreground/50 italic">not set</span>}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr] text-xs">
                <span className="text-muted-foreground px-3 py-2 font-medium">Call Date</span>
                <span className="px-3 py-2" data-testid="detail-call-date-field">{formatDate(info.call_date)}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr] text-xs">
                <span className="text-muted-foreground px-3 py-2 font-medium">Processed Datetime</span>
                <span className="px-3 py-2" data-testid="detail-processed-datetime">{formatDate(info.processed_datetime)}</span>
              </div>
              {info.context_values && Object.keys(info.context_values).length > 0 && (
                <div className="grid grid-cols-[140px_1fr] text-xs">
                  <span className="text-muted-foreground px-3 py-2 font-medium">Context</span>
                  <div className="px-3 py-2 flex flex-wrap gap-1.5">
                    {Object.entries(info.context_values).map(([k, v]) => (
                      <Badge key={k} variant="outline" className="text-[11px] font-mono">
                        {k}: {v || <span className="text-muted-foreground/50">empty</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {info.prompt_version && (
                <div className="grid grid-cols-[140px_1fr] text-xs">
                  <span className="text-muted-foreground px-3 py-2 font-medium">Prompt Version</span>
                  <span className="px-3 py-2">v{info.prompt_version}</span>
                </div>
              )}
            </div>
          </div>

          {info.request_headers && Object.keys(info.request_headers).length > 0 && (
            <details className="group">
              <summary className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 cursor-pointer hover:text-muted-foreground mb-1.5 list-none flex items-center gap-1">
                <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                Request Headers
              </summary>
              <pre
                className="bg-[#172938] text-gray-300 p-4 rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto mt-1"
                data-testid="detail-request-headers"
              >{JSON.stringify(info.request_headers, null, 2)}</pre>
            </details>
          )}

          {info.request_body && (
            <details className="group">
              <summary className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 cursor-pointer hover:text-muted-foreground mb-1.5 list-none flex items-center gap-1">
                <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                Raw Request JSON
              </summary>
              <pre
                className="bg-[#172938] text-gray-300 p-4 rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto mt-1"
                data-testid="detail-request-body"
              >{JSON.stringify(info.request_body, null, 2)}</pre>
            </details>
          )}

          {transcript && (
            <details className="group">
              <summary className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 cursor-pointer hover:text-muted-foreground mb-1.5 list-none flex items-center gap-1">
                <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                Transcript
                <span className="text-[9px] font-normal ml-1">({transcript.length.toLocaleString()} chars)</span>
              </summary>
              <div className="bg-[#f8f9fb] rounded-lg border border-border/40 p-4 mt-1 max-h-[500px] overflow-y-auto" data-testid="detail-transcript">
                <div className="space-y-3">
                  {transcript.split("\n").filter(line => line.trim()).map((line, idx) => {
                    const match = line.match(/^(user|assistant|agent|care guide|patient|AI):\s*/i);
                    if (match) {
                      const speaker = match[1];
                      const text = line.slice(match[0].length);
                      const isAgent = /^(assistant|agent|care guide|ai)$/i.test(speaker);
                      const roleLabel = isAgent ? "Care Guide" : "Patient";
                      const roleColor = isAgent ? "text-[#0098db]" : "text-[#5a8a00]";
                      const dotColor = isAgent ? "bg-[#0098db]" : "bg-[#96d410]";
                      return (
                        <div key={idx} className="text-left">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
                            <span className={`text-xs font-bold uppercase tracking-wide ${roleColor}`}>{roleLabel}</span>
                          </div>
                          <p className="text-[13px] leading-relaxed text-[#172938] pl-3.5 border-l-2 border-border/40 ml-[3px]">{text}</p>
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className="text-[11px] text-muted-foreground py-1 italic pl-3.5 ml-[3px]">{line}</div>
                    );
                  })}
                </div>
              </div>
            </details>
          )}

          {info.total_tokens && (
            <div className="flex flex-wrap gap-3 text-xs" data-testid="detail-tokens">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/40 border border-border/40">
                <span className="text-muted-foreground">Input:</span>
                <span className="font-semibold">{info.prompt_tokens?.toLocaleString()}</span>
                <span className="text-muted-foreground">tokens</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/40 border border-border/40">
                <span className="text-muted-foreground">Output:</span>
                <span className="font-semibold">{info.completion_tokens?.toLocaleString()}</span>
                <span className="text-muted-foreground">tokens</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/40 border border-border/40">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-semibold">{info.total_tokens?.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                <span className="text-muted-foreground">Cost:</span>
                <span className="font-semibold text-primary">${info.estimated_cost?.toFixed(6)}</span>
              </div>
            </div>
          )}


          {info.error_message && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-destructive/80 font-mono" data-testid="detail-error">{info.error_message}</p>
              </CardContent>
            </Card>
          )}

          {info.summary && (
            <Card className="border-border/60 bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2 text-secondary">
                  <FileText className="h-4 w-4 text-primary" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm leading-relaxed" data-testid="detail-summary">{info.summary}</p>
              </CardContent>
            </Card>
          )}

          {info.transition_status && (
            <Card className="border-border/60 bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2 text-secondary">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Transition Status
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div
                  className="bg-muted/30 p-4 rounded-lg border border-border/50 text-sm leading-relaxed"
                  data-testid="detail-transition"
                  dangerouslySetInnerHTML={{ __html: info.transition_status }}
                />
              </CardContent>
            </Card>
          )}

          {obs.length > 0 && (
            <Card className="border-border/60 bg-card shadow-sm" data-testid="detail-observations">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2 text-secondary">
                  <Activity className="h-4 w-4 text-primary" />
                  Observations
                  <Badge variant="outline" className="text-xs ml-2">{obs.length} topics</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {obs.map((o, i) => (
                    <div
                      key={`${o.observation_name}-${i}`}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20"
                      data-testid={`detail-obs-${o.observation_name}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-sm">{o.observation_display_name || o.observation_name}</span>
                          {o.observation_domain && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                              {o.observation_domain}
                            </Badge>
                          )}
                          {o.observation_value !== null && o.observation_value !== undefined ? (
                            <Badge
                              className="text-xs"
                              variant={
                                ["good", "green", "yes", "true", "no concerns", "no issues"].includes(o.observation_value.toLowerCase())
                                  ? "default"
                                  : ["concerning", "red", "issues", "problems"].includes(o.observation_value.toLowerCase())
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {o.observation_value}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">Not discussed</Badge>
                          )}
                        </div>
                        {o.observation_detail && (
                          <p className="text-sm text-muted-foreground leading-relaxed">{o.observation_detail}</p>
                        )}
                        {o.observation_evidence && (
                          <p className="text-xs text-muted-foreground/70 mt-1 italic">Evidence: "{o.observation_evidence}"</p>
                        )}
                        {o.observation_confidence && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] mt-1 ${
                              o.observation_confidence === "high" ? "border-green-300 text-green-700" :
                              o.observation_confidence === "medium" ? "border-amber-300 text-amber-700" :
                              "border-red-300 text-red-700"
                            }`}
                          >
                            {o.observation_confidence} confidence
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {callQA.length > 0 && (
            <Card className="border-border/60 bg-card shadow-sm" data-testid="detail-call-qa">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2 text-secondary">
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                  Call QA
                  <Badge variant="outline" className="text-xs ml-2">{callQA.length} assessments</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {callQA.map((cq, i) => (
                    <div
                      key={`call-qa-${i}`}
                      className="p-3 rounded-lg border border-border/50 bg-muted/20"
                      data-testid={`detail-call-qa-${i}`}
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{cq.display_name || cq.name}</span>
                        {cq.value && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border border-primary/20">
                            {cq.value}
                          </Badge>
                        )}
                      </div>
                      {cq.detail && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{cq.detail}</p>
                      )}
                      {cq.evidence && (
                        <div className="mt-2 pl-3 border-l-2 border-primary/30">
                          <p className="text-xs italic text-muted-foreground/80">"{cq.evidence}"</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {barriers.length > 0 && (
            <Card className="border-border/60 bg-card shadow-sm" data-testid="detail-barriers">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2 text-secondary">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  Barriers to Care
                  <Badge variant="outline" className="text-xs ml-2">{barriers.length} identified</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {barriers.map((b, i) => (
                    <div
                      key={`barrier-${i}`}
                      className="p-3 rounded-lg border border-border/50 bg-muted/20"
                      data-testid={`detail-barrier-${i}`}
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {b.severity && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 font-semibold ${
                              b.severity === "high"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : b.severity === "medium"
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {b.severity}
                          </Badge>
                        )}
                        {b.category && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {b.category}
                          </Badge>
                        )}
                        {b.observation_display_name && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border border-primary/20">
                            {b.observation_display_name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">{b.barrier}</p>
                      {b.context && (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-2">{b.context}</p>
                      )}
                      {b.evidence && (
                        <div className="mt-2 pl-3 border-l-2 border-primary/30">
                          <p className="text-xs italic text-muted-foreground/80">"{b.evidence}"</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {qaPairs.length > 0 && (
            <Card className="border-border/60 bg-card shadow-sm" data-testid="detail-qa-pairs">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2 text-secondary">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Questions & Answers
                  <Badge variant="outline" className="text-xs ml-2">{qaPairs.length} exchanges</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {qaPairs.map((qa, i) => (
                    <div
                      key={`qa-${i}`}
                      className="p-3 rounded-lg border border-border/50 bg-muted/20"
                      data-testid={`detail-qa-${i}`}
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                          #{qa.sequence_number}
                        </Badge>
                        {qa.category && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {qa.category}
                          </Badge>
                        )}
                        {qa.observation_display_name && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border border-primary/20">
                            {qa.observation_display_name}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground/70 w-8 shrink-0 pt-0.5">Q</span>
                          <p className="text-sm leading-relaxed">
                            <span className="text-muted-foreground/60 text-xs mr-1">({qa.asked_by || "unknown"})</span>
                            {qa.question}
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-semibold uppercase text-primary/70 w-8 shrink-0 pt-0.5">A</span>
                          <p className="text-sm leading-relaxed">
                            <span className="text-muted-foreground/60 text-xs mr-1">({qa.answered_by || "unknown"})</span>
                            {qa.answer}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {info.follow_up_areas && (
            <Card className="border-border/60 bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2 text-secondary">
                  <ListChecks className="h-4 w-4 text-[#96d410]" />
                  Follow-up Areas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div
                  className="bg-muted/30 p-4 rounded-lg border border-border/50 text-sm leading-relaxed"
                  data-testid="detail-follow-up"
                  dangerouslySetInnerHTML={{ __html: info.follow_up_areas }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CallHistory() {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: calls, isLoading, isFetching, refetch } = useQuery<CallInfo[]>({
    queryKey: ["/api/calls"],
    queryFn: async () => {
      const res = await fetch("/api/calls");
      if (!res.ok) throw new Error("Failed to load calls");
      return res.json();
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary tracking-tight" data-testid="heading-call-history">
            Processed Calls
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All calls processed through the API, with full extraction details.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={() => refetch()}
          data-testid="button-refresh-calls"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading calls from BigQuery...</span>
        </div>
      )}

      {!isLoading && (!calls || calls.length === 0) && (
        <Card className="border-dashed border-2 border-border/60 bg-muted/10 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 mx-auto">
            <Phone className="h-8 w-8 text-primary/50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No Calls Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Process a transcript through the API Playground to see calls appear here.
          </p>
        </Card>
      )}

      {calls && calls.length > 0 && (
        <div className="space-y-2" data-testid="list-calls">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_120px_120px_100px_90px_80px_32px] gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            <span>Call ID</span>
            <span>Source ID</span>
            <span>Client / Pathway</span>
            <span>Care Flow</span>
            <span>Call Date</span>
            <span>Processed</span>
            <span>Status</span>
            <span>Tokens</span>
            <span>Cost</span>
            <span></span>
          </div>
          {calls.map((call) => (
            <div
              key={call.call_id}
              className="grid grid-cols-[1fr_1fr_1fr_1fr_120px_120px_100px_90px_80px_32px] gap-3 items-center px-4 py-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 cursor-pointer transition-colors shadow-sm"
              onClick={() => setSelectedCallId(call.call_id)}
              data-testid={`row-call-${call.call_id}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-mono truncate text-foreground" data-testid={`text-call-id-${call.call_id}`}>
                  {call.call_id}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-mono truncate text-muted-foreground" data-testid={`text-source-id-${call.call_id}`}>
                  {call.source_id || "—"}
                </p>
                {call.source_type && (
                  <p className="text-[10px] text-muted-foreground/60 truncate">{call.source_type}</p>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs truncate text-foreground" data-testid={`text-client-pathway-${call.call_id}`}>
                  {call.client || "—"}
                </p>
                {call.pathway && (
                  <p className="text-[10px] text-muted-foreground/60 truncate">{call.pathway}</p>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-mono truncate text-muted-foreground" data-testid={`text-care-flow-${call.call_id}`}>
                  {call.care_flow_id || "—"}
                </p>
              </div>
              <div className="text-xs text-muted-foreground" data-testid={`text-call-date-${call.call_id}`}>
                {formatDate(call.call_date)}
              </div>
              <div className="text-xs text-muted-foreground" data-testid={`text-processed-${call.call_id}`}>
                {formatDate(call.processed_at)}
              </div>
              <div>
                <Badge
                  variant={call.status === "success" ? "default" : "destructive"}
                  className="text-[10px]"
                  data-testid={`badge-status-${call.call_id}`}
                >
                  {call.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground ml-1.5">
                  {(call.processing_time_ms / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="text-xs font-mono text-muted-foreground" data-testid={`text-tokens-${call.call_id}`}>
                {call.total_tokens?.toLocaleString() ?? "—"}
              </div>
              <div className="text-xs font-mono text-primary" data-testid={`text-cost-${call.call_id}`}>
                {call.estimated_cost != null ? `$${call.estimated_cost.toFixed(4)}` : "—"}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </div>
          ))}
        </div>
      )}

      {selectedCallId && (
        <CallDetailPanel callId={selectedCallId} onClose={() => setSelectedCallId(null)} />
      )}
    </div>
  );
}
