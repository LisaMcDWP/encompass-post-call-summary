import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BarChart3, Calendar, Building2, ArrowUpDown } from "lucide-react";

interface DailyStat {
  date: string;
  client: string;
  pathway: string;
  source_type: string;
  call_count: number;
  success_count: number;
  error_count: number;
  avg_processing_ms: number;
  total_tokens: number;
  total_cost: number;
}

type SortField = "date" | "client" | "call_count" | "total_cost";
type SortDir = "asc" | "desc";

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

export default function CallStats() {
  const [days, setDays] = useState("30");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterClient, setFilterClient] = useState<string>("all");

  const { data: stats, isLoading } = useQuery<DailyStat[]>({
    queryKey: ["/api/calls/stats/daily", days],
    queryFn: async () => {
      const res = await fetch(`/api/calls/stats/daily?days=${days}`);
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const clients = stats
    ? Array.from(new Set(stats.map(s => s.client))).sort()
    : [];

  const filtered = stats
    ? stats.filter(s => filterClient === "all" || s.client === filterClient)
    : [];

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === "date") cmp = (a.date || "").localeCompare(b.date || "");
    else if (sortField === "client") cmp = `${a.client}/${a.pathway}`.localeCompare(`${b.client}/${b.pathway}`);
    else if (sortField === "call_count") cmp = a.call_count - b.call_count;
    else if (sortField === "total_cost") cmp = a.total_cost - b.total_cost;
    return sortDir === "desc" ? -cmp : cmp;
  });

  const dateGroups: Record<string, DailyStat[]> = {};
  for (const row of sorted) {
    const key = row.date || "unknown";
    if (!dateGroups[key]) dateGroups[key] = [];
    dateGroups[key].push(row);
  }

  const totals = filtered.reduce(
    (acc, s) => ({
      calls: acc.calls + s.call_count,
      success: acc.success + s.success_count,
      errors: acc.errors + s.error_count,
      tokens: acc.tokens + (s.total_tokens || 0),
      cost: acc.cost + (s.total_cost || 0),
    }),
    { calls: 0, success: 0, errors: 0, tokens: 0, cost: 0 }
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => (d === "desc" ? "asc" : "desc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="heading-call-stats">
              <BarChart3 className="h-6 w-6 text-primary" />
              Call Volume
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Calls processed by source type, by day, for each client and pathway.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[140px] h-9" data-testid="select-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {clients.length > 1 && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-[180px] h-9" data-testid="select-client-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Total Calls</p>
              <p className="text-2xl font-bold text-foreground mt-1" data-testid="stat-total-calls">{totals.calls.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Success</p>
              <p className="text-2xl font-bold text-green-600 mt-1" data-testid="stat-success">{totals.success.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Errors</p>
              <p className="text-2xl font-bold text-red-500 mt-1" data-testid="stat-errors">{totals.errors.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Total Tokens</p>
              <p className="text-2xl font-bold text-foreground mt-1" data-testid="stat-tokens">{totals.tokens.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Total Cost</p>
              <p className="text-2xl font-bold text-primary mt-1" data-testid="stat-cost">${totals.cost.toFixed(4)}</p>
            </CardContent>
          </Card>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && sorted.length === 0 && (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-muted-foreground">No call data found for this period.</p>
          </div>
        )}

        {!isLoading && sorted.length > 0 && (
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-call-stats">
                  <thead>
                    <tr className="border-b border-border/50 text-left">
                      <th className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 hover:text-foreground" onClick={() => toggleSort("date")} data-testid="sort-date">
                          Date <ArrowUpDown className="h-3 w-3 ml-1 inline" />
                        </Button>
                      </th>
                      <th className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 hover:text-foreground" onClick={() => toggleSort("client")} data-testid="sort-client">
                          Client / Pathway <ArrowUpDown className="h-3 w-3 ml-1 inline" />
                        </Button>
                      </th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Source Type</th>
                      <th className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 hover:text-foreground" onClick={() => toggleSort("call_count")} data-testid="sort-calls">
                          Calls <ArrowUpDown className="h-3 w-3 ml-1 inline" />
                        </Button>
                      </th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Success</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Errors</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Avg Time</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Tokens</th>
                      <th className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 hover:text-foreground" onClick={() => toggleSort("total_cost")} data-testid="sort-cost">
                          Cost <ArrowUpDown className="h-3 w-3 ml-1 inline" />
                        </Button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, idx) => (
                      <tr
                        key={`${row.date}-${row.client}-${row.pathway}-${row.source_type}`}
                        className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "bg-card" : "bg-muted/10"}`}
                        data-testid={`row-stat-${idx}`}
                      >
                        <td className="px-4 py-2.5 text-xs text-foreground whitespace-nowrap">
                          {formatDate(row.date)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-medium text-foreground">{row.client}</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5">/ {row.pathway}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="text-[10px] font-mono" data-testid={`badge-source-${idx}`}>
                            {row.source_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-foreground" data-testid={`text-count-${idx}`}>
                          {row.call_count}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-green-600">
                          {row.success_count}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-red-500">
                          {row.error_count > 0 ? row.error_count : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                          {row.avg_processing_ms ? `${(row.avg_processing_ms / 1000).toFixed(1)}s` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                          {row.total_tokens?.toLocaleString() ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono text-primary">
                          {row.total_cost != null ? `$${row.total_cost.toFixed(4)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="px-4 py-2.5 text-xs text-foreground" colSpan={3}>Total</td>
                      <td className="px-4 py-2.5 text-xs text-foreground">{totals.calls.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-xs text-green-600">{totals.success.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-xs text-red-500">{totals.errors > 0 ? totals.errors.toLocaleString() : "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">—</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{totals.tokens.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-primary">${totals.cost.toFixed(4)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
