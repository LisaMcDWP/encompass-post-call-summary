import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ClipboardCheck, Search, Filter, Tag, FileText, ChevronRight, AlertCircle, CheckCircle2, Clock, Flag, Circle, Eye, X } from "lucide-react";
import { useLocation } from "wouter";
import { useClientPathway } from "@/contexts/ClientPathwayContext";

interface CallReviewItem {
  call_id: string;
  source_id: string;
  source_type: string;
  call_date: string | null;
  processed_at: string | null;
  summary: string | null;
  status: string;
  client: string | null;
  pathway: string | null;
  context_values: Record<string, string> | null;
  transcript_length: number | null;
  error_message: string | null;
  review_status: string;
  tags: string[];
  notes: string;
  review_updated_at: string | null;
}

type ReviewStatusFilter = "all" | "not_reviewed" | "in_progress" | "reviewed" | "flagged";

const REVIEW_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ReactNode }> = {
  not_reviewed: { label: "Not Reviewed", color: "text-gray-500", bgColor: "bg-gray-50", borderColor: "border-gray-200", icon: <Circle className="h-3.5 w-3.5 text-gray-400" /> },
  in_progress: { label: "In Progress", color: "text-amber-600", bgColor: "bg-amber-50", borderColor: "border-amber-200", icon: <Clock className="h-3.5 w-3.5 text-amber-500" /> },
  reviewed: { label: "Reviewed", color: "text-green-600", bgColor: "bg-green-50", borderColor: "border-green-200", icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> },
  flagged: { label: "Flagged", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200", icon: <Flag className="h-3.5 w-3.5 text-red-500" /> },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

function truncate(str: string | null, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "..." : str;
}

interface ObsConfigItem {
  name: string;
  displayName: string;
  valueType: string;
  value: { label: string }[] | string[];
}

export default function CallReviews() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [obsNameFilter, setObsNameFilter] = useState("");
  const [obsValueFilter, setObsValueFilter] = useState("");

  const { data: obsOptions } = useQuery<ObsConfigItem[]>({
    queryKey: ["/api/observations-review-filter"],
    queryFn: async () => {
      const res = await fetch("/api/observations?clientPathwayId=1");
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

  const { selectedCPId } = useClientPathway();

  const { data: items, isLoading } = useQuery<CallReviewItem[]>({
    queryKey: ["/api/calls/review-list", obsNameFilter, obsValueFilter, selectedCPId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (obsNameFilter) params.set("obsName", obsNameFilter);
      if (obsValueFilter) params.set("obsValue", obsValueFilter);
      if (selectedCPId) params.set("clientPathwayId", String(selectedCPId));
      const res = await fetch(`/api/calls/review-list?${params}`);
      if (!res.ok) throw new Error("Failed to load review list");
      return res.json();
    },
  });

  const allTags = useMemo(() => {
    if (!items) return [];
    const tagSet = new Set<string>();
    items.forEach(item => item.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [items]);

  const statusCounts = useMemo(() => {
    if (!items) return { all: 0, not_reviewed: 0, in_progress: 0, reviewed: 0, flagged: 0 };
    const counts = { all: items.length, not_reviewed: 0, in_progress: 0, reviewed: 0, flagged: 0 };
    items.forEach(item => {
      const s = item.review_status as keyof typeof counts;
      if (s in counts) counts[s]++;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter(item => {
      if (statusFilter !== "all" && item.review_status !== statusFilter) return false;
      if (tagFilter && !item.tags.includes(tagFilter)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesId = item.call_id.toLowerCase().includes(q) || item.source_id?.toLowerCase().includes(q);
        const matchesSummary = item.summary?.toLowerCase().includes(q);
        const matchesNotes = item.notes?.toLowerCase().includes(q);
        const matchesTags = item.tags.some(t => t.toLowerCase().includes(q));
        const matchesContext = item.context_values && Object.values(item.context_values).some(v => v.toLowerCase().includes(q));
        if (!matchesId && !matchesSummary && !matchesNotes && !matchesTags && !matchesContext) return false;
      }
      return true;
    });
  }, [items, statusFilter, searchQuery, tagFilter]);

  const getPatientName = (item: CallReviewItem): string | null => {
    if (!item.context_values) return null;
    const first = item.context_values["patient_first_name"] || item.context_values["first_name"] || "";
    const last = item.context_values["patient_last_name"] || item.context_values["last_name"] || "";
    const full = `${first} ${last}`.trim();
    return full || null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#0098db]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-call-reviews">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#172938] font-[Montserrat]" data-testid="text-page-title">Call Reviews</h1>
          <p className="text-sm text-muted-foreground mt-1">Review and manage call review statuses, tags, and notes</p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1" data-testid="text-total-count">
          {filtered.length} of {items?.length || 0} calls
        </Badge>
      </div>

      <div className="grid grid-cols-4 gap-3" data-testid="review-status-summary">
        {(["not_reviewed", "in_progress", "reviewed", "flagged"] as const).map(status => {
          const config = REVIEW_STATUS_CONFIG[status];
          const count = statusCounts[status];
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(isActive ? "all" : status)}
              className={`p-3 rounded-lg border transition-all text-left ${
                isActive
                  ? `${config.bgColor} ${config.borderColor} ring-2 ring-offset-1 ring-current/20`
                  : "bg-white border-gray-200 hover:bg-gray-50"
              }`}
              data-testid={`button-filter-${status}`}
            >
              <div className="flex items-center gap-2 mb-1">
                {config.icon}
                <span className={`text-xs font-medium ${isActive ? config.color : "text-muted-foreground"}`}>{config.label}</span>
              </div>
              <p className={`text-2xl font-bold ${isActive ? config.color : "text-foreground"}`}>{count}</p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, patient name, summary, notes, or tags..."
            className="pl-9 h-9"
            data-testid="input-search"
          />
        </div>
        <div>
          <select
            value={obsNameFilter}
            onChange={(e) => { setObsNameFilter(e.target.value); setObsValueFilter(""); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm w-48"
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
            <select
              value={obsValueFilter}
              onChange={(e) => setObsValueFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm w-40"
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
            className="text-muted-foreground h-9"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ReviewStatusFilter)}>
          <SelectTrigger className="w-[180px] h-9" data-testid="select-status-filter">
            <div className="flex items-center gap-2">
              {statusFilter !== "all" && REVIEW_STATUS_CONFIG[statusFilter]?.icon}
              <SelectValue placeholder="All Statuses" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(["not_reviewed", "in_progress", "reviewed", "flagged"] as const).map(s => {
              const cfg = REVIEW_STATUS_CONFIG[s];
              return (
                <SelectItem key={s} value={s}>
                  <div className="flex items-center gap-2">
                    {cfg.icon}
                    <span>{cfg.label}</span>
                    <span className="text-muted-foreground ml-auto">({statusCounts[s]})</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {(tagFilter || statusFilter !== "all" || obsNameFilter) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {statusFilter !== "all" && (
            <Badge
              variant="outline"
              className={`text-xs cursor-pointer ${REVIEW_STATUS_CONFIG[statusFilter]?.bgColor} ${REVIEW_STATUS_CONFIG[statusFilter]?.color} ${REVIEW_STATUS_CONFIG[statusFilter]?.borderColor}`}
              onClick={() => setStatusFilter("all")}
              data-testid="badge-active-status-filter"
            >
              {REVIEW_STATUS_CONFIG[statusFilter]?.icon}
              <span className="ml-1">{REVIEW_STATUS_CONFIG[statusFilter]?.label}</span>
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {tagFilter && (
            <Badge
              variant="outline"
              className="text-xs cursor-pointer bg-[#0098db]/10 text-[#0098db] border-[#0098db]/20"
              onClick={() => setTagFilter(null)}
              data-testid="badge-active-tag-filter"
            >
              <Tag className="h-3 w-3 mr-1" />
              {tagFilter}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {obsNameFilter && (
            <Badge
              variant="outline"
              className="text-xs cursor-pointer bg-purple-50 text-purple-700 border-purple-200"
              onClick={() => { setObsNameFilter(""); setObsValueFilter(""); }}
              data-testid="badge-active-obs-filter"
            >
              <Filter className="h-3 w-3 mr-1" />
              {obsOptions?.find(o => o.name === obsNameFilter)?.displayName || obsNameFilter}
              {obsValueFilter && `: ${obsValueFilter}`}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          <button
            onClick={() => { setStatusFilter("all"); setTagFilter(null); setObsNameFilter(""); setObsValueFilter(""); }}
            className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1"
            data-testid="button-clear-all-filters"
          >
            Clear all
          </button>
        </div>
      )}

      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground mr-1">Tags:</span>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
                tagFilter === tag
                  ? "bg-[#0098db]/10 text-[#0098db] border-[#0098db]/30"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
              data-testid={`button-tag-filter-${tag}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2" data-testid="review-list">
        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No calls match the current filters</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(item => {
            const config = REVIEW_STATUS_CONFIG[item.review_status] || REVIEW_STATUS_CONFIG.not_reviewed;
            const patientName = getPatientName(item);
            return (
              <Card
                key={item.call_id}
                className="border-border/60 hover:border-[#0098db]/30 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => navigate("/calls")}
                data-testid={`card-review-${item.call_id}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#172938] font-[Montserrat]" data-testid={`text-call-id-${item.call_id}`}>
                          {patientName || item.source_id || item.call_id.slice(0, 12)}
                        </span>
                        <Badge
                          className={`text-[10px] px-1.5 py-0 ${config.bgColor} ${config.color} ${config.borderColor}`}
                          variant="outline"
                          data-testid={`badge-status-${item.call_id}`}
                        >
                          {config.label}
                        </Badge>
                        {item.status === "error" && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            <AlertCircle className="h-3 w-3 mr-0.5" />
                            Error
                          </Badge>
                        )}
                        {item.client && (
                          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{item.client}</span>
                        )}
                      </div>

                      {item.summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-summary-${item.call_id}`}>
                          {truncate(item.summary, 200)}
                        </p>
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        {item.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3 text-muted-foreground/50" />
                            {item.tags.map(tag => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 bg-[#0098db]/10 text-[#0098db] border border-[#0098db]/20"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3 text-[#0098db]/50" />
                            <span className="text-[10px] text-muted-foreground italic">{truncate(item.notes, 80)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-[11px] text-muted-foreground">{formatDate(item.call_date)}</p>
                      {item.review_updated_at && (
                        <p className="text-[10px] text-muted-foreground/60">
                          Reviewed {formatDateTime(item.review_updated_at)}
                        </p>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-[#0098db] transition-colors ml-auto" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
