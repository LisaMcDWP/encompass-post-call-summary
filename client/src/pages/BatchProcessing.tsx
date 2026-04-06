import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useClientPathway } from "@/contexts/ClientPathwayContext";
import {
  Loader2, Package, Play, RotateCcw, CheckCircle2, XCircle, Clock, Search,
  ChevronDown, ChevronRight, AlertCircle, Zap, RefreshCw, Cloud
} from "lucide-react";

interface BlandCall {
  call_id: string;
  created_at: { value: string } | string;
  call_length: number | null;
  status: string;
  summary: string | null;
  transcript_length: number | null;
  to_number: string | null;
  from_number: string | null;
  answered_by: string | null;
  pathway_id: string | null;
  care_flow_id: string | null;
  tags: string[] | null;
}

interface BatchItem {
  batch_id: string;
  bland_call_id: string;
  source_type: string;
  created_at: string;
  status: string;
  error_message: string | null;
  result_call_id: string | null;
  processed_at: string | null;
  batch_label: string | null;
  transcript_length: number;
  care_flow_id: string | null;
}

interface BatchSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  batches: {
    batch_id: string;
    batch_label: string | null;
    count: number;
    status_counts: Record<string, number>;
  }[];
}

function formatDate(val: { value: string } | string | null): string {
  if (!val) return "—";
  const str = typeof val === "object" && "value" in val ? val.value : val;
  try {
    return new Date(str).toLocaleString();
  } catch {
    return String(str);
  }
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { color: string; icon: React.ReactNode }> = {
    pending: { color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-3 w-3" /> },
    processing: { color: "bg-blue-100 text-blue-800", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    completed: { color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { color: "bg-red-100 text-red-800", icon: <XCircle className="h-3 w-3" /> },
  };
  const v = variants[status] || { color: "bg-gray-100 text-gray-800", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${v.color}`} data-testid={`status-badge-${status}`}>
      {v.icon} {status}
    </span>
  );
}

export default function BatchProcessing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCPId } = useClientPathway();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchLimit, setSearchLimit] = useState("50");
  const [batchLabel, setBatchLabel] = useState("");
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [processLimit, setProcessLimit] = useState("5");
  const [answeredBy, setAnsweredBy] = useState("human");
  const [minDuration, setMinDuration] = useState("0.01");
  const [maxDuration, setMaxDuration] = useState("");
  const [requiredTags, setRequiredTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [processedFilter, setProcessedFilter] = useState<"unprocessed" | "processed" | "all">("unprocessed");
  const [useKnownContext, setUseKnownContext] = useState(true);

  const tagsQuery = useQuery<string[]>({
    queryKey: ["/api/batch/tags"],
  });

  const summaryQuery = useQuery<BatchSummary>({
    queryKey: ["/api/batch/summary"],
    refetchInterval: 10000,
  });

  const [searchResults, setSearchResults] = useState<BlandCall[]>([]);
  const [searching, setSearching] = useState(false);

  const batchItemsQuery = useQuery<BatchItem[]>({
    queryKey: ["/api/batch/items", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "200");
      const res = await fetch(`/api/batch/items?${params}`);
      if (!res.ok) throw new Error("Failed to fetch batch items");
      return res.json();
    },
    refetchInterval: 10000,
  });

  async function handleSearch() {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", new Date(startDate).toISOString());
      if (endDate) params.set("endDate", new Date(endDate).toISOString());
      if (answeredBy) params.set("answeredBy", answeredBy);
      if (minDuration) params.set("minDuration", minDuration);
      if (maxDuration) params.set("maxDuration", maxDuration);
      if (requiredTags.length > 0) params.set("requiredTags", requiredTags.join(","));
      if (excludeTags.length > 0) params.set("excludeTags", excludeTags.join(","));
      if (processedFilter !== "all") params.set("processedFilter", processedFilter);
      params.set("limit", searchLimit || "50");

      const res = await fetch(`/api/batch/bland-calls?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data);
      setSelectedCalls(new Set());
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }

  const loadMutation = useMutation({
    mutationFn: async () => {
      const selectedIds = Array.from(selectedCalls);
      const careFlowIds = searchResults
        .filter((c: any) => selectedIds.includes(c.call_id) && c.care_flow_id)
        .map((c: any) => c.care_flow_id)
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
      const res = await fetch("/api/batch/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callIds: selectedIds,
          batchLabel: batchLabel || null,
          useKnownContext,
          careFlowIds,
          clientPathwayId: selectedCPId || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to load calls");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Calls loaded",
        description: `${data.loaded} loaded, ${data.skipped} skipped (already in batch)`,
      });
      setSelectedCalls(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/batch/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batch/items"] });
    },
    onError: (err: any) => {
      toast({ title: "Load failed", description: err.message, variant: "destructive" });
    },
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ limit: processLimit });
      const batches = summaryQuery.data?.batches;
      const newest = batches?.sort((a: any, b: any) => b.batch_id.localeCompare(a.batch_id))?.[0]?.batch_id;
      if (newest) params.set("batchId", newest);
      if (selectedCPId) params.set("clientPathwayId", String(selectedCPId));
      const res = await fetch(`/api/batch/process?${params}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to process batch");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Batch processed",
        description: `${data.processed} items processed`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/batch/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batch/items"] });
    },
    onError: (err: any) => {
      toast({ title: "Process failed", description: err.message, variant: "destructive" });
    },
  });

  const triggerJobMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = { batchSize: parseInt(processLimit, 10) || 50 };
      if (selectedCPId) body.clientPathwayId = selectedCPId;
      const res = await fetch("/api/batch/trigger-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to trigger batch job");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Batch job triggered on GCP",
        description: data.message,
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to trigger job", description: err.message, variant: "destructive" });
    },
  });

  const recreateMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const res = await fetch("/api/batch/recreate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to recreate batch");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Batch recreated",
        description: `${data.count} items moved to new batch ${data.newBatchId}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/batch/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batch/items"] });
    },
    onError: (err: any) => {
      toast({ title: "Recreate failed", description: err.message, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/batch/reset-failed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to reset");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Reset complete", description: `${data.reset} items reset to pending` });
      queryClient.invalidateQueries({ queryKey: ["/api/batch/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batch/items"] });
    },
    onError: (err: any) => {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    },
  });

  function toggleCall(callId: string) {
    setSelectedCalls(prev => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId); else next.add(callId);
      return next;
    });
  }

  function toggleAll() {
    if (selectedCalls.size === searchResults.length) {
      setSelectedCalls(new Set());
    } else {
      setSelectedCalls(new Set(searchResults.map(c => c.call_id)));
    }
  }

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#172938]" data-testid="text-page-title">Batch Processing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Re-run the extraction API against historical Bland calls
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <div className="text-2xl font-bold" data-testid="text-total-count">{summary?.total ?? "—"}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-count">{summary?.pending ?? "—"}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <div className="text-2xl font-bold text-blue-600" data-testid="text-processing-count">{summary?.processing ?? "—"}</div>
            <div className="text-xs text-muted-foreground">Processing</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <div className="text-2xl font-bold text-green-600" data-testid="text-completed-count">{summary?.completed ?? "—"}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <div className="text-2xl font-bold text-red-600" data-testid="text-failed-count">{summary?.failed ?? "—"}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Process next:</Label>
          <Input
            type="number"
            value={processLimit}
            onChange={(e) => setProcessLimit(e.target.value)}
            className="w-20"
            min="1"
            max="50"
            data-testid="input-process-limit"
          />
        </div>
        <Button
          onClick={() => processMutation.mutate()}
          disabled={processMutation.isPending || (summary?.pending ?? 0) === 0}
          variant="outline"
          data-testid="button-process-batch"
        >
          {processMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
          Process Here
        </Button>
        <Button
          onClick={() => triggerJobMutation.mutate()}
          disabled={triggerJobMutation.isPending || (summary?.pending ?? 0) === 0}
          className="bg-[#0098db] hover:bg-[#0098db]/90"
          data-testid="button-trigger-gcp-job"
        >
          {triggerJobMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Cloud className="h-4 w-4 mr-1" />}
          Run on GCP
        </Button>
        <Button
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending || (summary?.failed ?? 0) === 0}
          variant="outline"
          data-testid="button-reset-failed"
        >
          {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
          Reset Failed
        </Button>
        {summary?.batches && summary.batches.length > 0 && (
          <Button
            onClick={() => {
              const batchId = summary.batches[0].batch_id;
              if (confirm(`Recreate batch ${batchId}? This copies all items to a new batch using a compatible insert method.`)) {
                recreateMutation.mutate(batchId);
              }
            }}
            disabled={recreateMutation.isPending}
            variant="outline"
            data-testid="button-recreate-batch"
          >
            {recreateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
            Recreate Batch
          </Button>
        )}
      </div>

      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowSearch(!showSearch)}
        >
          <CardTitle className="text-lg flex items-center gap-2">
            {showSearch ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Search className="h-4 w-4" />
            Search Bland Calls
          </CardTitle>
        </CardHeader>
        {showSearch && (
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                  data-testid="input-end-date"
                />
              </div>
              <div>
                <Label className="text-xs">Processing Status</Label>
                <select
                  value={processedFilter}
                  onChange={(e) => setProcessedFilter(e.target.value as "unprocessed" | "processed" | "all")}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm w-40"
                  data-testid="select-processed-filter"
                >
                  <option value="unprocessed">Not Yet Processed</option>
                  <option value="processed">Already Processed</option>
                  <option value="all">All Calls</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Answered By</Label>
                <select
                  value={answeredBy}
                  onChange={(e) => setAnsweredBy(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm w-32"
                  data-testid="select-answered-by"
                >
                  <option value="">Any</option>
                  <option value="human">Human</option>
                  <option value="voicemail">Voicemail</option>
                  <option value="no-answer">No Answer</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Min Duration (s)</Label>
                <Input
                  type="number"
                  value={minDuration}
                  onChange={(e) => setMinDuration(e.target.value)}
                  className="w-24"
                  min="0"
                  placeholder="0"
                  data-testid="input-min-duration"
                />
              </div>
              <div>
                <Label className="text-xs">Max Duration (s)</Label>
                <Input
                  type="number"
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(e.target.value)}
                  className="w-24"
                  min="0"
                  placeholder="No max"
                  data-testid="input-max-duration"
                />
              </div>
              <div>
                <Label className="text-xs">Limit</Label>
                <Input
                  type="number"
                  value={searchLimit}
                  onChange={(e) => setSearchLimit(e.target.value)}
                  className="w-20"
                  min="1"
                  max="500"
                  data-testid="input-search-limit"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={searching}
                className="bg-[#172938] hover:bg-[#172938]/90"
                data-testid="button-search-calls"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                Search
              </Button>
            </div>

            {tagsQuery.data && tagsQuery.data.length > 0 && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs font-medium">Must Have Tags</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {tagsQuery.data.map((tag) => (
                      <button
                        key={`req-${tag}`}
                        onClick={() => setRequiredTags(prev =>
                          prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                        )}
                        className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                          requiredTags.includes(tag)
                            ? "bg-green-100 text-green-800 border-green-300"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                        }`}
                        data-testid={`tag-require-${tag}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium">Exclude Tags</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {tagsQuery.data.map((tag) => (
                      <button
                        key={`exc-${tag}`}
                        onClick={() => setExcludeTags(prev =>
                          prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                        )}
                        className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                          excludeTags.includes(tag)
                            ? "bg-red-100 text-red-800 border-red-300"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                        }`}
                        data-testid={`tag-exclude-${tag}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {searchResults.length} calls found · {selectedCalls.size} selected
                  </span>
                  <div className="flex gap-2 items-center">
                    <Button variant="ghost" size="sm" onClick={toggleAll} data-testid="button-toggle-all">
                      {selectedCalls.size === searchResults.length ? "Deselect All" : "Select All"}
                    </Button>
                    <div>
                      <Input
                        placeholder="Batch label (optional)"
                        value={batchLabel}
                        onChange={(e) => setBatchLabel(e.target.value)}
                        className="w-48 h-8 text-sm"
                        data-testid="input-batch-label"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 border rounded px-2 py-1">
                      <Switch
                        checked={useKnownContext}
                        onCheckedChange={setUseKnownContext}
                        id="use-known-context"
                        data-testid="switch-use-known-context"
                      />
                      <Label htmlFor="use-known-context" className="text-xs cursor-pointer whitespace-nowrap">Awell Context</Label>
                    </div>
                    <Button
                      onClick={() => loadMutation.mutate()}
                      disabled={loadMutation.isPending || selectedCalls.size === 0}
                      size="sm"
                      className="bg-[#0098db] hover:bg-[#0098db]/90"
                      data-testid="button-load-selected"
                    >
                      {loadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Package className="h-4 w-4 mr-1" />}
                      Load {selectedCalls.size} to Batch
                    </Button>
                  </div>
                </div>

                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-2 text-left w-8">
                          <input
                            type="checkbox"
                            checked={selectedCalls.size === searchResults.length && searchResults.length > 0}
                            onChange={toggleAll}
                            data-testid="checkbox-select-all"
                          />
                        </th>
                        <th className="p-2 text-left">Call ID</th>
                        <th className="p-2 text-left">Care Flow ID</th>
                        <th className="p-2 text-left">Date</th>
                        <th className="p-2 text-left">Duration</th>
                        <th className="p-2 text-left">Answered By</th>
                        <th className="p-2 text-left">Transcript</th>
                        <th className="p-2 text-left">Tags</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map((call) => (
                        <tr
                          key={call.call_id}
                          className={`border-b hover:bg-muted/30 cursor-pointer ${selectedCalls.has(call.call_id) ? "bg-blue-50" : ""}`}
                          onClick={() => toggleCall(call.call_id)}
                          data-testid={`row-call-${call.call_id}`}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedCalls.has(call.call_id)}
                              onChange={() => toggleCall(call.call_id)}
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`checkbox-call-${call.call_id}`}
                            />
                          </td>
                          <td className="p-2 font-mono text-xs">{call.call_id.substring(0, 12)}...</td>
                          <td className="p-2 font-mono text-xs">{call.care_flow_id || "—"}</td>
                          <td className="p-2 text-xs">{formatDate(call.created_at)}</td>
                          <td className="p-2 text-xs">{call.call_length ? `${Math.round(call.call_length)}s` : "—"}</td>
                          <td className="p-2 text-xs">{call.answered_by || "—"}</td>
                          <td className="p-2 text-xs">{call.transcript_length ? `${(call.transcript_length / 1000).toFixed(1)}k chars` : "—"}</td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-0.5">
                              {call.tags && call.tags.length > 0
                                ? call.tags.map(tag => (
                                    <span key={tag} className="px-1.5 py-0 rounded text-[10px] bg-gray-100 text-gray-600 border border-gray-200">{tag}</span>
                                  ))
                                : <span className="text-xs text-muted-foreground">—</span>
                              }
                            </div>
                          </td>
                          <td className="p-2"><Badge variant="outline" className="text-xs">{call.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Batch Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4 items-center">
            {["", "pending", "processing", "completed", "failed"].map((s) => (
              <Button
                key={s || "all"}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className={statusFilter === s ? "bg-[#172938]" : ""}
                data-testid={`button-filter-${s || "all"}`}
              >
                {s || "All"}
                {s === "" && summary ? ` (${summary.total})` : ""}
                {s === "pending" && summary ? ` (${summary.pending})` : ""}
                {s === "completed" && summary ? ` (${summary.completed})` : ""}
                {s === "failed" && summary ? ` (${summary.failed})` : ""}
              </Button>
            ))}
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/batch/summary"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/batch/items"] });
                }}
                data-testid="button-refresh-batch"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Refresh
              </Button>
            </div>
          </div>

          {batchItemsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : batchItemsQuery.data && batchItemsQuery.data.length > 0 ? (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="p-2 text-left">Bland Call ID</th>
                    <th className="p-2 text-left">Care Flow ID</th>
                    <th className="p-2 text-left">Batch</th>
                    <th className="p-2 text-left">Label</th>
                    <th className="p-2 text-left">Transcript</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Processed</th>
                    <th className="p-2 text-left">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {batchItemsQuery.data.map((item, idx) => (
                    <tr key={`${item.bland_call_id}-${idx}`} className="border-b hover:bg-muted/30" data-testid={`row-batch-${item.bland_call_id}`}>
                      <td className="p-2 font-mono text-xs">{item.bland_call_id.substring(0, 12)}...</td>
                      <td className="p-2 font-mono text-xs">{item.care_flow_id || "—"}</td>
                      <td className="p-2 font-mono text-xs">{item.batch_id.substring(0, 16)}...</td>
                      <td className="p-2 text-xs">{item.batch_label || "—"}</td>
                      <td className="p-2 text-xs">{(item.transcript_length / 1000).toFixed(1)}k</td>
                      <td className="p-2"><StatusBadge status={item.status} /></td>
                      <td className="p-2 text-xs">{item.processed_at ? formatDate(item.processed_at) : "—"}</td>
                      <td className="p-2 text-xs">
                        {item.result_call_id ? (
                          <a href={`/calls`} className="text-[#0098db] hover:underline">{item.result_call_id.substring(0, 16)}...</a>
                        ) : item.error_message ? (
                          <span className="text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {item.error_message.substring(0, 40)}...
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No batch items yet. Search for Bland calls above and load them into the queue.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {summary && summary.batches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Batch Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.batches.map((batch) => (
                <div key={batch.batch_id} className="flex items-center justify-between p-3 border rounded-md" data-testid={`card-batch-${batch.batch_id}`}>
                  <div>
                    <div className="font-mono text-xs">{batch.batch_id}</div>
                    {batch.batch_label && <div className="text-sm text-muted-foreground">{batch.batch_label}</div>}
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-sm">{batch.count} calls</span>
                    {Object.entries(batch.status_counts).map(([status, count]) => (
                      <span key={status} className="text-xs">
                        <StatusBadge status={status} /> {count}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
