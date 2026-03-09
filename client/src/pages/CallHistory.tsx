import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, Clock, Coins, ChevronRight, X, FileText, Activity, ListChecks, ClipboardList, AlertCircle } from "lucide-react";

interface CallInfo {
  call_id: string;
  care_flow_id: string | null;
  interaction_datetime: string | null;
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

interface CallDetail {
  callInfo: CallInfo;
  observations: CallObservation[];
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
  const { data, isLoading, isError } = useQuery<CallDetail>({
    queryKey: ["/api/calls", callId],
    queryFn: async () => {
      const res = await fetch(`/api/calls/${callId}`);
      if (!res.ok) throw new Error("Failed to load call detail");
      return res.json();
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
  const obs = data.observations;

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
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-detail">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs" data-testid="detail-metadata">
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

          {info.care_flow_id && (
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/40 border border-border/40">
                <span className="text-muted-foreground">Care Flow:</span>
                <span className="font-medium" data-testid="detail-care-flow">{info.care_flow_id}</span>
              </div>
              {info.source_type && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/40 border border-border/40">
                  <span className="text-muted-foreground">Source:</span>
                  <span className="font-medium">{info.source_type}</span>
                </div>
              )}
              {info.prompt_version && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/40 border border-border/40">
                  <span className="text-muted-foreground">Prompt v{info.prompt_version}</span>
                </div>
              )}
            </div>
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

          {info.context_values && Object.keys(info.context_values).length > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground font-medium block mb-1.5">Context Values</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(info.context_values).map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-xs font-mono">
                    {k}: {v}
                  </Badge>
                ))}
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
        </div>
      </div>
    </div>
  );
}

export default function CallHistory() {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  const { data: calls, isLoading } = useQuery<CallInfo[]>({
    queryKey: ["/api/calls"],
    queryFn: async () => {
      const res = await fetch("/api/calls");
      if (!res.ok) throw new Error("Failed to load calls");
      return res.json();
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-secondary tracking-tight" data-testid="heading-call-history">
          Processed Calls
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          All calls processed through the API, with full extraction details.
        </p>
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
          <div className="grid grid-cols-[1fr_120px_100px_90px_80px_32px] gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            <span>Call ID</span>
            <span>Processed</span>
            <span>Status</span>
            <span>Tokens</span>
            <span>Cost</span>
            <span></span>
          </div>
          {calls.map((call) => (
            <div
              key={call.call_id}
              className="grid grid-cols-[1fr_120px_100px_90px_80px_32px] gap-3 items-center px-4 py-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 cursor-pointer transition-colors shadow-sm"
              onClick={() => setSelectedCallId(call.call_id)}
              data-testid={`row-call-${call.call_id}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-mono truncate text-foreground" data-testid={`text-call-id-${call.call_id}`}>
                  {call.call_id}
                </p>
                {call.care_flow_id && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {call.care_flow_id}
                  </p>
                )}
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
