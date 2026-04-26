import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, Clock, Coins, ChevronRight, ChevronLeft, X, FileText, Activity, ListChecks, ClipboardList, AlertCircle, MessageSquare, ShieldAlert, ClipboardCheck, RefreshCw, Download, History, Tag, CheckCircle2, Flag, MinusCircle, Circle, Save, RotateCcw, Plus, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { exportCallDetailPdf } from "@/lib/exportPdf";
import { useClientPathway } from "@/contexts/ClientPathwayContext";

interface CallInfo {
  call_id: string;
  processing_id: string | null;
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
  response_json: any | null;
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

interface CallActivationObjective {
  objective_id: number;
  objective_name: string;
  interaction_id: number | null;
  interaction_key: string | null;
  interaction_name: string | null;
  call_date: string | null;
  anchor_event_date: string | null;
  target_date: string | null;
  days_remaining: number | null;
  band_label: string | null;
  extracted_value: string | null;
  current_stage_id: string | null;
  current_stage_name: string | null;
  on_track: boolean | null;
  on_track_status: string | null;
  is_eligible: boolean;
  exclusion_reason: string | null;
  rationale: string | null;
  observations: Array<{
    topicId: number;
    name: string;
    displayName: string;
    value: string | null;
    evidence: string | null;
  }>;
  processed_at: any;
}

interface CallDetail {
  callInfo: CallInfo;
  observations: CallObservation[];
  qaPairs: QAPair[];
  barriers: CallBarrier[];
  callQA: CallQAResultItem[];
  activationObjectives?: CallActivationObjective[];
  transcript: string | null;
  totalRuns: number;
  currentRun: number;
  reviewStatus: string | null;
  reviewTags: string[];
  reviewNotes: string;
}

type CallReviewStatus = "not_reviewed" | "in_progress" | "reviewed" | "flagged";

const REVIEW_STATUS_OPTIONS: { value: CallReviewStatus; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { value: "not_reviewed", label: "Not Reviewed", color: "text-gray-500", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
  { value: "in_progress", label: "In Progress", color: "text-amber-600", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
  { value: "reviewed", label: "Reviewed", color: "text-green-600", bgColor: "bg-green-50", borderColor: "border-green-200" },
  { value: "flagged", label: "Flagged", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

interface ReviewItemConfig {
  id: number;
  name: string;
  displayName: string;
  description: string;
  category: string;
  isActive: boolean;
}

interface ReviewState {
  reviewItemId: number;
  reviewItemName: string;
  reviewItemDisplayName: string;
  status: "checked" | "flagged" | "na" | "unchecked";
  notes: string;
  reviewedBy: string;
}

const STATUS_CYCLE: ReviewState["status"][] = ["unchecked", "checked", "flagged", "na"];

function StatusIcon({ status }: { status: ReviewState["status"] }) {
  switch (status) {
    case "checked": return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "flagged": return <Flag className="h-5 w-5 text-red-500" />;
    case "na": return <MinusCircle className="h-5 w-5 text-gray-400" />;
    default: return <Circle className="h-5 w-5 text-gray-300" />;
  }
}

function statusLabel(status: ReviewState["status"]): string {
  switch (status) {
    case "checked": return "Checked";
    case "flagged": return "Flagged";
    case "na": return "N/A";
    default: return "Unchecked";
  }
}

function CallDetailPanel({ callId, onClose }: { callId: string; onClose: () => void }) {
  const [selectedRun, setSelectedRun] = useState<number | undefined>(undefined);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCPId } = useClientPathway();
  const [reviewStates, setReviewStates] = useState<ReviewState[]>([]);
  const [reviewDirty, setReviewDirty] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [callReviewStatus, setCallReviewStatus] = useState<CallReviewStatus>("not_reviewed");
  const [reviewStatusSaving, setReviewStatusSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reviewTags, setReviewTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [reviewNotesText, setReviewNotesText] = useState("");
  const [metaDirty, setMetaDirty] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);

  const { data: reviewItems } = useQuery<ReviewItemConfig[]>({
    queryKey: ["/api/call-review-items-for-call", selectedCPId],
    queryFn: async () => {
      if (!selectedCPId) return [];
      const res = await fetch(`/api/call-review-items?clientPathwayId=${selectedCPId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedCPId,
  });

  const { data: savedReviews } = useQuery<any[]>({
    queryKey: ["/api/calls/reviews", callId, selectedCPId],
    queryFn: async () => {
      const cpParam = selectedCPId ? `?clientPathwayId=${selectedCPId}` : "";
      const res = await fetch(`/api/calls/${callId}/reviews${cpParam}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (!reviewItems) return;
    const activeItems = reviewItems.filter((i) => i.isActive);
    const states: ReviewState[] = activeItems.map((item) => {
      const saved = savedReviews?.find((r: any) => r.review_item_id === item.id);
      return {
        reviewItemId: item.id,
        reviewItemName: item.name,
        reviewItemDisplayName: item.displayName,
        status: (saved?.status as ReviewState["status"]) || "unchecked",
        notes: saved?.notes || "",
        reviewedBy: saved?.reviewed_by || "",
      };
    });
    setReviewStates(states);
    setReviewDirty(false);
  }, [reviewItems, savedReviews]);

  const cycleStatus = useCallback((itemId: number) => {
    setReviewStates((prev) =>
      prev.map((r) => {
        if (r.reviewItemId !== itemId) return r;
        const idx = STATUS_CYCLE.indexOf(r.status);
        return { ...r, status: STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] };
      })
    );
    setReviewDirty(true);
  }, []);

  const updateNotes = useCallback((itemId: number, notes: string) => {
    setReviewStates((prev) =>
      prev.map((r) => (r.reviewItemId === itemId ? { ...r, notes } : r))
    );
    setReviewDirty(true);
  }, []);

  const saveReviews = async () => {
    setReviewSaving(true);
    try {
      const res = await fetch(`/api/calls/${callId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews: reviewStates, clientPathwayId: selectedCPId }),
      });
      if (!res.ok) throw new Error("Failed");
      setReviewDirty(false);
      toast({ title: "Reviews saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save reviews", variant: "destructive" });
    } finally {
      setReviewSaving(false);
    }
  };

  const updateReviewStatus = async (newStatus: CallReviewStatus) => {
    setReviewStatusSaving(true);
    try {
      const res = await fetch(`/api/calls/${callId}/review-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: newStatus, clientPathwayId: selectedCPId }),
      });
      if (!res.ok) throw new Error("Failed");
      setCallReviewStatus(newStatus);
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calls/review-statuses"] });
      toast({ title: "Review status updated" });
    } catch {
      toast({ title: "Error", description: "Failed to update review status", variant: "destructive" });
    } finally {
      setReviewStatusSaving(false);
    }
  };

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || reviewTags.includes(trimmed)) return;
    setReviewTags((prev) => [...prev, trimmed]);
    setTagInput("");
    setMetaDirty(true);
  }, [reviewTags]);

  const removeTag = useCallback((tag: string) => {
    setReviewTags((prev) => prev.filter((t) => t !== tag));
    setMetaDirty(true);
  }, []);

  const saveReviewMeta = async () => {
    setMetaSaving(true);
    try {
      const res = await fetch(`/api/calls/${callId}/review-meta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: reviewTags, notes: reviewNotesText, clientPathwayId: selectedCPId }),
      });
      if (!res.ok) throw new Error("Failed");
      setMetaDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/calls", callId] });
      toast({ title: "Review tags & notes saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save review data", variant: "destructive" });
    } finally {
      setMetaSaving(false);
    }
  };

  const reprocessCall = async () => {
    setReprocessing(true);
    try {
      const res = await fetch(`/api/calls/${callId}/reprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientPathwayId: selectedCPId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Reprocess failed");
      }
      toast({ title: "Call reprocessed", description: "The call has been re-analyzed. Refresh to see the new run." });
      queryClient.invalidateQueries({ queryKey: ["/api/calls", callId] });
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
    } catch (err: any) {
      toast({ title: "Reprocess failed", description: err.message, variant: "destructive" });
    } finally {
      setReprocessing(false);
    }
  };

  const { data, isLoading, isError } = useQuery<CallDetail>({
    queryKey: ["/api/calls", callId, selectedRun, selectedCPId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedRun !== undefined) params.set("run", String(selectedRun));
      if (selectedCPId) params.set("clientPathwayId", String(selectedCPId));
      const qs = params.toString();
      const url = qs ? `/api/calls/${callId}?${qs}` : `/api/calls/${callId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load call detail");
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.reviewStatus) {
      setCallReviewStatus(data.reviewStatus as CallReviewStatus);
    } else {
      setCallReviewStatus("not_reviewed");
    }
    if (!metaDirty) {
      setReviewTags(data?.reviewTags || []);
      setReviewNotesText(data?.reviewNotes || "");
    }
  }, [data?.reviewStatus, data?.reviewTags, data?.reviewNotes]);

  const { data: obsConfig } = useQuery<{ id: number; name: string; displayName: string; display_order: number; valueColors: Record<string, string> }[]>({
    queryKey: ["/api/observations-order", selectedCPId],
    queryFn: async () => {
      if (!selectedCPId) return [];
      const res = await fetch(`/api/observations?clientPathwayId=${selectedCPId}`);
      if (!res.ok) return [];
      const items = await res.json();
      return items.map((o: any) => {
        const valueColors: Record<string, string> = {};
        for (const v of (o.value || [])) {
          if (v && typeof v.label === "string") {
            const key = v.label.trim().toLowerCase();
            valueColors[key] = (v.color || "GRAY").toUpperCase();
          }
        }
        return {
          id: o.id,
          name: o.name,
          displayName: o.displayName || o.name,
          display_order: o.displayOrder ?? 999,
          valueColors,
        };
      });
    },
  });

  const { data: aoConfig } = useQuery<Array<{ id: number; displayName: string; description: string }>>({
    queryKey: ["/api/activation-objectives-meta", selectedCPId],
    queryFn: async () => {
      if (!selectedCPId) return [];
      const res = await fetch(`/api/activation-objectives?clientPathwayId=${selectedCPId}`);
      if (!res.ok) return [];
      const items = await res.json();
      return items.map((o: any) => ({
        id: o.id,
        displayName: o.displayName || o.name,
        description: o.description || "",
      }));
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

  const ENUM_COLOR_STYLES: Record<string, { bg: string; fg: string; border: string }> = {
    GREEN:  { bg: "#dcfce7", fg: "#166534", border: "#bbf7d0" },
    YELLOW: { bg: "#fef9c3", fg: "#854d0e", border: "#fde68a" },
    RED:    { bg: "#fee2e2", fg: "#991b1b", border: "#fecaca" },
    BLUE:   { bg: "#dbeafe", fg: "#1e40af", border: "#bfdbfe" },
    GRAY:   { bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1" },
  };
  const colorForObsValue = (topicId: number, value: string | null): { bg: string; fg: string; border: string } => {
    if (!value) return ENUM_COLOR_STYLES.GRAY;
    const topic = (obsConfig || []).find(o => o.id === topicId);
    const key = value.trim().toLowerCase();
    const colorKey = (topic?.valueColors?.[key] || "GRAY").toUpperCase();
    return ENUM_COLOR_STYLES[colorKey] || ENUM_COLOR_STYLES.GRAY;
  };
  const qaPairs = data.qaPairs || [];
  const barriers = data.barriers || [];
  const callQA = data.callQA || [];
  const activationObjectives: CallActivationObjective[] = data.activationObjectives || [];
  const disposition = data.disposition || null;
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
            <p className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-2" data-testid="text-call-id">
              {info.call_id}
              <a
                href={`https://app.bland.ai/dashboard/call-logs/${info.call_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#0098db] hover:text-[#0098db]/80 text-[11px] font-sans font-medium"
                data-testid="link-bland-call"
              >
                <ExternalLink className="h-3 w-3" />
                View in Bland
              </a>
            </p>
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
              disabled={reprocessing || !transcript}
              onClick={reprocessCall}
              data-testid="button-reprocess-call"
              title={!transcript ? "No transcript available" : "Re-run Gemini analysis on this call"}
            >
              {reprocessing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
              {reprocessing ? "Reprocessing..." : "Reprocess"}
            </Button>
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
                <span className="text-muted-foreground px-3 py-2 font-medium">Job ID</span>
                <span className="font-mono px-3 py-2" data-testid="detail-call-id-field">{info.call_id}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr] text-xs">
                <span className="text-muted-foreground px-3 py-2 font-medium">Processing ID</span>
                <span className="font-mono px-3 py-2" data-testid="detail-processing-id">{info.processing_id || <span className="text-muted-foreground/50 italic">not set</span>}</span>
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

          {info.response_json && (
            <details className="group">
              <summary className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 cursor-pointer hover:text-muted-foreground mb-1.5 list-none flex items-center gap-1">
                <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                Response JSON
              </summary>
              <pre
                className="bg-[#172938] text-gray-300 p-4 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto mt-1"
                data-testid="detail-response-json"
              >{typeof info.response_json === "string" ? info.response_json : JSON.stringify(info.response_json, null, 2)}</pre>
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

          {(reviewStates.length > 0 || true) && (
            <Card className="border-border/60 bg-card shadow-sm" data-testid="card-call-review">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2 text-secondary">
                    <ClipboardCheck className="h-4 w-4 text-[#0098db]" />
                    Call Review
                    {reviewStates.length > 0 && (
                      <Badge variant="outline" className="text-xs ml-2">
                        {reviewStates.filter((r) => r.status !== "unchecked").length}/{reviewStates.length} reviewed
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {reviewStates.length > 0 && (
                      <Button
                        size="sm"
                        disabled={!reviewDirty || reviewSaving}
                        onClick={saveReviews}
                        className="bg-[#0098db] hover:bg-[#0086c3] h-7 text-xs"
                        data-testid="button-save-reviews"
                      >
                        {reviewSaving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                        {reviewSaving ? "Saving..." : "Save"}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3" data-testid="review-status-selector">
                  <span className="text-xs text-muted-foreground mr-1">Status:</span>
                  {REVIEW_STATUS_OPTIONS.map((opt) => {
                    const isActive = callReviewStatus === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateReviewStatus(opt.value)}
                        disabled={reviewStatusSaving}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                          isActive
                            ? `${opt.bgColor} ${opt.color} ${opt.borderColor} ring-1 ring-offset-1 ring-current/20`
                            : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                        }`}
                        data-testid={`button-review-status-${opt.value}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-3" data-testid="review-tags-notes">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Tags</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {reviewTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[11px] px-2 py-0.5 bg-[#0098db]/10 text-[#0098db] border border-[#0098db]/20 gap-1"
                        >
                          {tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="hover:text-red-500 transition-colors ml-0.5"
                            data-testid={`button-remove-tag-${tag}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {reviewTags.length === 0 && (
                        <span className="text-[11px] text-muted-foreground/50 italic">No tags</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag(tagInput);
                          }
                        }}
                        placeholder="Add a tag..."
                        className="h-7 text-xs flex-1"
                        data-testid="input-add-tag"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={() => addTag(tagInput)}
                        disabled={!tagInput.trim()}
                        data-testid="button-add-tag"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Review Notes</span>
                    </div>
                    <Textarea
                      value={reviewNotesText}
                      onChange={(e) => { setReviewNotesText(e.target.value); setMetaDirty(true); }}
                      placeholder="Add review notes for this call..."
                      className="text-xs min-h-[60px] resize-none"
                      data-testid="textarea-review-notes"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!metaDirty || metaSaving}
                      onClick={saveReviewMeta}
                      className="bg-[#0098db] hover:bg-[#0086c3] h-7 text-xs"
                      data-testid="button-save-review-meta"
                    >
                      {metaSaving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                      {metaSaving ? "Saving..." : "Save Tags & Notes"}
                    </Button>
                  </div>
                </div>

                {reviewStates.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No review checklist items configured. Add them in the Review Items setup page.</p>
                ) : (<div className="space-y-2">
                  {(() => {
                    const grouped = reviewStates.reduce<Record<string, ReviewState[]>>((acc, r) => {
                      const item = reviewItems?.find((i) => i.id === r.reviewItemId);
                      const cat = item?.category || "General";
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(r);
                      return acc;
                    }, {});
                    return Object.entries(grouped).map(([cat, items]) => (
                      <div key={cat}>
                        {Object.keys(grouped).length > 1 && (
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-2 mb-1">{cat}</p>
                        )}
                        {items.map((r) => {
                          const config = reviewItems?.find((i) => i.id === r.reviewItemId);
                          const notesOpen = expandedNotes.has(r.reviewItemId);
                          return (
                            <div
                              key={r.reviewItemId}
                              className={`p-2.5 rounded-lg border transition-colors ${
                                r.status === "flagged" ? "border-red-200 bg-red-50/50" :
                                r.status === "checked" ? "border-green-200 bg-green-50/30" :
                                "border-border/50 bg-muted/10"
                              }`}
                              data-testid={`review-item-row-${r.reviewItemId}`}
                            >
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => cycleStatus(r.reviewItemId)}
                                  className="shrink-0 hover:scale-110 transition-transform"
                                  title={`Status: ${statusLabel(r.status)} (click to cycle)`}
                                  data-testid={`button-review-status-${r.reviewItemId}`}
                                >
                                  <StatusIcon status={r.status} />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-foreground">{r.reviewItemDisplayName}</span>
                                  {config?.description && (
                                    <p className="text-[11px] text-muted-foreground truncate">{config.description}</p>
                                  )}
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 shrink-0 ${
                                    r.status === "checked" ? "bg-green-50 text-green-700 border-green-200" :
                                    r.status === "flagged" ? "bg-red-50 text-red-700 border-red-200" :
                                    r.status === "na" ? "bg-gray-50 text-gray-500 border-gray-200" :
                                    "text-gray-400"
                                  }`}
                                >
                                  {statusLabel(r.status)}
                                </Badge>
                                <button
                                  onClick={() => {
                                    const next = new Set(expandedNotes);
                                    notesOpen ? next.delete(r.reviewItemId) : next.add(r.reviewItemId);
                                    setExpandedNotes(next);
                                  }}
                                  className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                                  data-testid={`button-toggle-notes-${r.reviewItemId}`}
                                >
                                  {r.notes ? <FileText className="h-3.5 w-3.5 text-[#0098db]" /> : <FileText className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                              {notesOpen && (
                                <Textarea
                                  value={r.notes}
                                  onChange={(e) => updateNotes(r.reviewItemId, e.target.value)}
                                  placeholder="Add notes..."
                                  className="mt-2 text-xs min-h-[50px] resize-none"
                                  data-testid={`textarea-notes-${r.reviewItemId}`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>)}
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

          {disposition && (
            <Card className="border-border/60 bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2 text-secondary">
                  <Tag className="h-4 w-4 text-primary" />
                  Call Disposition
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-2" data-testid="detail-disposition">
                  <Badge className="text-sm" style={{ backgroundColor: "#0098db", color: "white" }}>
                    {disposition.disposition_category_display || disposition.disposition_category}
                  </Badge>
                  <span className="text-gray-400">&rarr;</span>
                  <Badge variant="outline" className="text-sm">
                    {disposition.disposition_detail_display || disposition.disposition_detail}
                  </Badge>
                  {disposition.confidence && (
                    <span className="text-xs text-gray-400 ml-auto">Confidence: {disposition.confidence}</span>
                  )}
                </div>
                {disposition.detail && <p className="text-sm text-gray-600 mt-2">{disposition.detail}</p>}
                {disposition.evidence && <p className="text-xs text-gray-400 mt-1 italic">"{disposition.evidence}"</p>}
              </CardContent>
            </Card>
          )}

          {activationObjectives.length > 0 && (
            <Card className="border-border/60 bg-card shadow-sm" data-testid="detail-activation-objectives">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2 text-secondary">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Activation Objectives
                  <Badge variant="outline" className="text-xs ml-2">{activationObjectives.length} {activationObjectives.length === 1 ? "objective" : "objectives"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {activationObjectives.map((ao) => {
                  const eligibilityVariant = ao.is_eligible ? "default" : "secondary";
                  const onTrackBg = ao.on_track === true ? "#dcfce7" :
                                     ao.on_track === false ? "#fee2e2" : "#f1f5f9";
                  const onTrackFg = ao.on_track === true ? "#166534" :
                                     ao.on_track === false ? "#991b1b" : "#475569";
                  const onTrackBorder = ao.on_track === true ? "#bbf7d0" :
                                        ao.on_track === false ? "#fecaca" : "#cbd5e1";
                  const aoMeta = (aoConfig || []).find(o => o.id === ao.objective_id);
                  const aoTitle = aoMeta?.displayName || ao.objective_name;
                  const aoDescription = aoMeta?.description || "";
                  return (
                    <div
                      key={ao.objective_id}
                      className="border border-border/50 rounded-lg p-4 bg-muted/10 space-y-2"
                      data-testid={`detail-activation-objective-${ao.objective_id}`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm" data-testid={`text-ao-title-${ao.objective_id}`}>{aoTitle}</div>
                          {aoDescription && (
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed" data-testid={`text-ao-description-${ao.objective_id}`}>{aoDescription}</p>
                          )}
                          {(ao.interaction_name || ao.interaction_key) && (
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                              <span>Interaction:</span>
                              {ao.interaction_name && <span className="font-medium text-foreground">{ao.interaction_name}</span>}
                              {ao.interaction_key && (
                                <code className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{ao.interaction_key}</code>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={eligibilityVariant} className="text-[11px]">
                            {ao.is_eligible ? "Eligible" : "Not eligible"}
                          </Badge>
                          {ao.on_track_status && (
                            <span
                              className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                              style={{ backgroundColor: onTrackBg, color: onTrackFg, borderColor: onTrackBorder }}
                            >
                              {ao.on_track_status}
                            </span>
                          )}
                        </div>
                      </div>

                      {!ao.is_eligible && ao.exclusion_reason && (
                        <p className="text-xs text-muted-foreground italic">Reason: {ao.exclusion_reason}</p>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Anchor date</div>
                          <div className="font-medium">{ao.anchor_event_date || "—"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Target date</div>
                          <div className="font-medium">{ao.target_date || "—"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Days remaining</div>
                          <div className="font-medium">{ao.days_remaining ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Band</div>
                          <div className="font-medium">{ao.band_label || "—"}</div>
                        </div>
                      </div>

                      {(ao.current_stage_name || ao.extracted_value) && (
                        <div className="flex items-center gap-2 text-sm pt-1 flex-wrap">
                          {ao.extracted_value && (
                            <Badge variant="outline" className="font-mono text-[10px]">{ao.extracted_value}</Badge>
                          )}
                          {ao.current_stage_name && (
                            <>
                              <span className="text-muted-foreground">→</span>
                              <Badge className="text-[11px]" style={{ backgroundColor: "#0098db", color: "white" }}>
                                {ao.current_stage_name}
                              </Badge>
                            </>
                          )}
                        </div>
                      )}

                      {ao.rationale && (
                        <p className="text-xs text-muted-foreground italic leading-relaxed">{ao.rationale}</p>
                      )}

                      {ao.observations && ao.observations.length > 0 && (
                        <div className="mt-1 pt-2 border-t border-border/40 space-y-1.5">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Observations</p>
                          <div className="space-y-1.5">
                            {ao.observations.map((obs) => {
                              const c = colorForObsValue(obs.topicId, obs.value);
                              return (
                                <div key={`${ao.objective_id}-${obs.topicId}`} className="flex items-center gap-2 text-xs flex-wrap" data-testid={`obs-${ao.objective_id}-${obs.topicId}`}>
                                  <span className="text-muted-foreground shrink-0">{obs.displayName}:</span>
                                  {obs.value ? (
                                    <span
                                      className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                                      style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}
                                      data-testid={`obs-value-${ao.objective_id}-${obs.topicId}`}
                                    >
                                      {obs.value}
                                    </span>
                                  ) : (
                                    <span className="italic text-muted-foreground">not detected</span>
                                  )}
                                  {obs.evidence && (
                                    <span className="text-muted-foreground italic truncate">— "{obs.evidence}"</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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

interface ObsConfigItem {
  name: string;
  displayName: string;
  valueType: string;
  value: { label: string }[] | string[];
}

export default function CallHistory() {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [obsNameFilter, setObsNameFilter] = useState("");
  const [obsValueFilter, setObsValueFilter] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCPId } = useClientPathway();

  const { data: obsOptions } = useQuery<ObsConfigItem[]>({
    queryKey: ["/api/observations-filter-options", selectedCPId],
    queryFn: async () => {
      if (!selectedCPId) return [];
      const res = await fetch(`/api/observations?clientPathwayId=${selectedCPId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const selectedObs = obsOptions?.find(o => o.name === obsNameFilter);
  const obsValueOptions: string[] = selectedObs
    ? (Array.isArray(selectedObs.value)
        ? selectedObs.value.map((v: any) => typeof v === "object" ? v.label : v)
        : [])
    : [];

  const { data: calls, isLoading, isFetching, refetch } = useQuery<CallInfo[]>({
    queryKey: ["/api/calls", obsNameFilter, obsValueFilter, selectedCPId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (obsNameFilter) params.set("obsName", obsNameFilter);
      if (obsValueFilter) params.set("obsValue", obsValueFilter);
      if (selectedCPId) params.set("clientPathwayId", String(selectedCPId));
      const res = await fetch(`/api/calls?${params}`);
      if (!res.ok) throw new Error("Failed to load calls");
      return res.json();
    },
  });

  const callIds = calls?.map(c => c.call_id) || [];
  const { data: reviewStatuses } = useQuery<Record<string, string>>({
    queryKey: ["/api/calls/review-statuses", callIds.join(","), selectedCPId],
    queryFn: async () => {
      if (callIds.length === 0) return {};
      const cpParam = selectedCPId ? `&clientPathwayId=${selectedCPId}` : "";
      const res = await fetch(`/api/calls/review-statuses?callIds=${callIds.join(",")}${cpParam}`);
      if (!res.ok) return {};
      return res.json();
    },
    enabled: callIds.length > 0,
  });

  const cycleCallReviewStatus = async (callId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = reviewStatuses?.[callId] || "not_reviewed";
    const cycle: CallReviewStatus[] = ["not_reviewed", "in_progress", "reviewed", "flagged"];
    const idx = cycle.indexOf(current as CallReviewStatus);
    const next = cycle[(idx + 1) % cycle.length];
    try {
      const res = await fetch(`/api/calls/${callId}/review-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: next }),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/calls/review-statuses"] });
    } catch {
      toast({ title: "Error", description: "Failed to update review status", variant: "destructive" });
    }
  };

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

      <div className="mb-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Observation</label>
          <select
            value={obsNameFilter}
            onChange={(e) => { setObsNameFilter(e.target.value); setObsValueFilter(""); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm w-52"
            data-testid="select-obs-name-filter"
          >
            <option value="">All Observations</option>
            {obsOptions?.map(o => (
              <option key={o.name} value={o.name}>{o.displayName}</option>
            ))}
          </select>
        </div>
        {obsNameFilter && obsValueOptions.length > 0 && (
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Value</label>
            <select
              value={obsValueFilter}
              onChange={(e) => setObsValueFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm w-44"
              data-testid="select-obs-value-filter"
            >
              <option value="">Any Value</option>
              {obsValueOptions.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        )}
        {(obsNameFilter || obsValueFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setObsNameFilter(""); setObsValueFilter(""); }}
            className="text-muted-foreground"
            data-testid="button-clear-obs-filter"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear Filter
          </Button>
        )}
        {obsNameFilter && (
          <span className="text-xs text-muted-foreground ml-auto">
            {isFetching ? "Filtering..." : `${calls?.length ?? 0} calls`}
          </span>
        )}
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
            Process a transcript through the API to see calls appear here.
          </p>
        </Card>
      )}

      {calls && calls.length > 0 && (
        <div className="space-y-2" data-testid="list-calls">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_120px_120px_100px_90px_80px_90px_32px] gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            <span>Call ID</span>
            <span>Source ID</span>
            <span>Client / Pathway</span>
            <span>Care Flow</span>
            <span>Call Date</span>
            <span>Processed</span>
            <span>Status</span>
            <span>Tokens</span>
            <span>Cost</span>
            <span>Review</span>
            <span></span>
          </div>
          {calls.map((call) => {
            const rs = reviewStatuses?.[call.call_id];
            const rsOpt = REVIEW_STATUS_OPTIONS.find(o => o.value === rs);
            return (
            <div
              key={call.call_id}
              className="grid grid-cols-[1fr_1fr_1fr_1fr_120px_120px_100px_90px_80px_90px_32px] gap-3 items-center px-4 py-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 cursor-pointer transition-colors shadow-sm"
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
              <div data-testid={`badge-review-${call.call_id}`}>
                <button
                  onClick={(e) => cycleCallReviewStatus(call.call_id, e)}
                  className="hover:scale-105 transition-transform"
                  title={`Review: ${rsOpt?.label || "Not Reviewed"} (click to change)`}
                  data-testid={`button-cycle-review-${call.call_id}`}
                >
                  {rsOpt ? (
                    <Badge variant="outline" className={`text-[10px] cursor-pointer ${rsOpt.bgColor} ${rsOpt.color} ${rsOpt.borderColor}`}>
                      {rsOpt.label}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] cursor-pointer bg-gray-50 text-gray-400 border-gray-200">
                      Not Reviewed
                    </Badge>
                  )}
                </button>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </div>
          );
          })}
        </div>
      )}

      {selectedCallId && (
        <CallDetailPanel callId={selectedCallId} onClose={() => setSelectedCallId(null)} />
      )}
    </div>
  );
}
