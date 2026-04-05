import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, BarChart3, Calendar, Building2,
  CheckCircle2, XCircle, Coins, Zap, Phone, Activity, Layers
} from "lucide-react";

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

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

function formatFullDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

const CHART_COLORS = ["#0098db", "#96d410", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6", "#6366f1", "#d97706"];

function StackedBarChart({ dates, series, maxVal }: {
  dates: string[];
  series: { key: string; color: string; values: Record<string, number> }[];
  maxVal: number;
}) {
  if (dates.length === 0) return <p className="text-sm text-muted-foreground text-center py-10">No data</p>;
  const barWidth = Math.max(14, Math.min(36, Math.floor(600 / dates.length)));

  return (
    <div className="flex items-end gap-[2px] h-[160px] overflow-x-auto pb-6 relative">
      {dates.map((date, i) => {
        const dayTotal = series.reduce((sum, s) => sum + (s.values[date] || 0), 0);
        return (
          <div key={i} className="flex flex-col items-center group relative h-full" style={{ minWidth: barWidth }}>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10 pointer-events-none">
              {dayTotal} calls
            </div>
            <div className="flex-1 w-full flex flex-col items-stretch justify-end">
              {series.map((s) => {
                const val = s.values[date] || 0;
                if (val === 0) return null;
                const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                return (
                  <div
                    key={s.key}
                    className="w-full transition-all duration-300 first:rounded-t-sm"
                    style={{ height: `${Math.max(pct, 1)}%`, backgroundColor: s.color, minHeight: 2 }}
                  />
                );
              })}
              {dayTotal === 0 && (
                <div className="w-full rounded-t-sm" style={{ height: "2%", backgroundColor: "#e5e7eb", minHeight: 1, opacity: 0.3 }} />
              )}
            </div>
            <span className="text-[8px] text-muted-foreground/60 mt-1 absolute -bottom-5 whitespace-nowrap">
              {formatDate(date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ segments, size = 130, centerLabel }: { segments: { label: string; value: number; color: string }[]; size?: number; centerLabel?: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) return <p className="text-xs text-muted-foreground text-center py-6">No data</p>;
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dashLen = pct * circumference;
          const dashOffset = -offset;
          offset += dashLen;
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={14}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              className="transition-all duration-500"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-foreground">{total}</span>
        <span className="text-[9px] text-muted-foreground">{centerLabel || "calls"}</span>
      </div>
    </div>
  );
}

function SparkLine({ values, color = "#0098db", height = 32 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const width = 80;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CallStats() {
  const [days, setDays] = useState("30");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterPathway, setFilterPathway] = useState<string>("all");

  const { data: stats, isLoading } = useQuery<DailyStat[]>({
    queryKey: ["/api/calls/stats/daily", days],
    queryFn: async () => {
      const res = await fetch(`/api/calls/stats/daily?days=${days}`);
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const clients = useMemo(() =>
    stats ? Array.from(new Set(stats.map(s => s.client))).sort() : [],
    [stats]
  );

  const pathwaysForClient = useMemo(() => {
    if (!stats) return [];
    const subset = filterClient === "all" ? stats : stats.filter(s => s.client === filterClient);
    return Array.from(new Set(subset.map(s => s.pathway))).sort();
  }, [stats, filterClient]);

  const handleClientChange = (val: string) => {
    setFilterClient(val);
    setFilterPathway("all");
  };

  const filtered = useMemo(() => {
    if (!stats) return [];
    return stats.filter(s => {
      if (filterClient !== "all" && s.client !== filterClient) return false;
      if (filterPathway !== "all" && s.pathway !== filterPathway) return false;
      return true;
    });
  }, [stats, filterClient, filterPathway]);

  const totals = useMemo(() => filtered.reduce(
    (acc, s) => ({
      calls: acc.calls + s.call_count,
      success: acc.success + s.success_count,
      errors: acc.errors + s.error_count,
      tokens: acc.tokens + (s.total_tokens || 0),
      cost: acc.cost + (s.total_cost || 0),
      totalMs: acc.totalMs + (s.avg_processing_ms || 0) * s.call_count,
    }),
    { calls: 0, success: 0, errors: 0, tokens: 0, cost: 0, totalMs: 0 }
  ), [filtered]);

  const avgProcessingTime = totals.calls > 0 ? totals.totalMs / totals.calls / 1000 : 0;
  const successRate = totals.calls > 0 ? ((totals.success / totals.calls) * 100).toFixed(1) : "0";

  const sparkValues = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of filtered) map[s.date] = (map[s.date] || 0) + s.call_count;
    const dates = Object.keys(map).sort();
    return dates.map(d => map[d]);
  }, [filtered]);

  const cpKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of filtered) set.add(`${s.client} / ${s.pathway}`);
    return Array.from(set).sort();
  }, [filtered]);

  const allDates = useMemo(() => {
    const set = new Set<string>();
    for (const s of filtered) set.add(s.date);
    return Array.from(set).sort();
  }, [filtered]);

  const volumeChartSeries = useMemo(() => {
    return cpKeys.map((cpKey, i) => {
      const values: Record<string, number> = {};
      for (const s of filtered) {
        const key = `${s.client} / ${s.pathway}`;
        if (key === cpKey) values[s.date] = (values[s.date] || 0) + s.call_count;
      }
      return { key: cpKey, color: CHART_COLORS[i % CHART_COLORS.length], values };
    });
  }, [filtered, cpKeys]);

  const volumeChartMax = useMemo(() => {
    const dayTotals: Record<string, number> = {};
    for (const s of filtered) dayTotals[s.date] = (dayTotals[s.date] || 0) + s.call_count;
    return Math.max(...Object.values(dayTotals), 1);
  }, [filtered]);

  const bySourceType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of filtered) map[s.source_type] = (map[s.source_type] || 0) + s.call_count;
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [filtered]);

  const byPathway = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of filtered) {
      const key = s.pathway;
      map[key] = (map[key] || 0) + s.call_count;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: CHART_COLORS[(i + 2) % CHART_COLORS.length] }));
  }, [filtered]);

  const byClientPathway = useMemo(() => {
    const map: Record<string, { calls: number; success: number; errors: number; tokens: number; cost: number; client: string; pathway: string; dailyValues: Record<string, number> }> = {};
    for (const s of filtered) {
      const key = `${s.client}__${s.pathway}`;
      if (!map[key]) map[key] = { calls: 0, success: 0, errors: 0, tokens: 0, cost: 0, client: s.client, pathway: s.pathway, dailyValues: {} };
      map[key].calls += s.call_count;
      map[key].success += s.success_count;
      map[key].errors += s.error_count;
      map[key].tokens += s.total_tokens || 0;
      map[key].cost += s.total_cost || 0;
      map[key].dailyValues[s.date] = (map[key].dailyValues[s.date] || 0) + s.call_count;
    }
    return Object.values(map).sort((a, b) => b.calls - a.calls);
  }, [filtered]);

  const dailyByDate = useMemo(() => {
    const map: Record<string, { date: string; calls: number; success: number; errors: number; cost: number; byCP: Record<string, number> }> = {};
    for (const s of filtered) {
      if (!map[s.date]) map[s.date] = { date: s.date, calls: 0, success: 0, errors: 0, cost: 0, byCP: {} };
      map[s.date].calls += s.call_count;
      map[s.date].success += s.success_count;
      map[s.date].errors += s.error_count;
      map[s.date].cost += s.total_cost || 0;
      const cpKey = `${s.client} / ${s.pathway}`;
      map[s.date].byCP[cpKey] = (map[s.date].byCP[cpKey] || 0) + s.call_count;
    }
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [filtered]);

  const showPathwayBreakdown = filterPathway === "all" && byPathway.length > 1;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="heading-call-stats">
              <BarChart3 className="h-6 w-6 text-primary" />
              Call Volume Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Processing volume and performance by client, pathway, and source type.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[140px] h-9" data-testid="select-days">
                <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
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
            <Select value={filterClient} onValueChange={handleClientChange}>
              <SelectTrigger className="w-[170px] h-9" data-testid="select-client-filter">
                <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPathway} onValueChange={setFilterPathway}>
              <SelectTrigger className="w-[190px] h-9" data-testid="select-pathway-filter">
                <Layers className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Pathways" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pathways</SelectItem>
                {pathwaysForClient.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-60">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <Card className="border-border/50 bg-gradient-to-br from-blue-50/50 to-transparent">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold flex items-center gap-1">
                        <Phone className="h-3 w-3" /> Total Calls
                      </p>
                      <p className="text-2xl font-bold text-foreground mt-1" data-testid="stat-total-calls">{totals.calls.toLocaleString()}</p>
                    </div>
                    <SparkLine values={sparkValues} color="#0098db" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-gradient-to-br from-green-50/50 to-transparent">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" /> Success Rate
                  </p>
                  <p className="text-2xl font-bold text-green-600 mt-1" data-testid="stat-success">{successRate}%</p>
                  <p className="text-[10px] text-muted-foreground">{totals.success.toLocaleString()} of {totals.calls.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-gradient-to-br from-red-50/30 to-transparent">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-400" /> Errors
                  </p>
                  <p className="text-2xl font-bold text-red-500 mt-1" data-testid="stat-errors">{totals.errors.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Avg Time
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1" data-testid="stat-avg-time">{avgProcessingTime.toFixed(1)}s</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Tokens
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1" data-testid="stat-tokens">{totals.tokens.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-gradient-to-br from-blue-50/30 to-transparent">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold flex items-center gap-1">
                    <Coins className="h-3 w-3 text-primary" /> Total Cost
                  </p>
                  <p className="text-2xl font-bold text-primary mt-1" data-testid="stat-cost">${totals.cost.toFixed(4)}</p>
                </CardContent>
              </Card>
            </div>

            <div className={`grid grid-cols-1 ${showPathwayBreakdown ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`}>
              <Card className={`border-border/50 ${showPathwayBreakdown ? "lg:col-span-2" : "lg:col-span-2"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Daily Volume by {cpKeys.length > 1 ? "Client / Pathway" : "Day"}
                    </CardTitle>
                  </div>
                  {cpKeys.length > 1 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {cpKeys.map((cpKey, i) => (
                        <div key={cpKey} className="flex items-center gap-1 text-[10px]">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-muted-foreground">{cpKey}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  <StackedBarChart dates={allDates} series={volumeChartSeries} maxVal={volumeChartMax} />
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground">Source Type</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex flex-col items-center gap-3">
                  <DonutChart segments={bySourceType} size={120} centerLabel="by source" />
                  <div className="flex flex-wrap gap-2 justify-center">
                    {bySourceType.map(s => (
                      <div key={s.label} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="font-semibold text-foreground">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {showPathwayBreakdown && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-foreground">By Pathway</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 flex flex-col items-center gap-3">
                    <DonutChart segments={byPathway} size={120} centerLabel="by pathway" />
                    <div className="flex flex-wrap gap-2 justify-center">
                      {byPathway.map(s => (
                        <div key={s.label} className="flex items-center gap-1.5 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="text-muted-foreground">{s.label}</span>
                          <span className="font-semibold text-foreground">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {byClientPathway.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Client & Pathway Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {byClientPathway.map((cp, i) => {
                      const trendValues = allDates.map(d => cp.dailyValues[d] || 0);
                      const successPct = cp.calls > 0 ? ((cp.success / cp.calls) * 100).toFixed(0) : "0";
                      return (
                        <div key={`${cp.client}-${cp.pathway}`} className="rounded-lg border border-border/40 p-4 space-y-2" data-testid={`card-cp-${i}`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{cp.client}</p>
                              <p className="text-[11px] text-muted-foreground">{cp.pathway}</p>
                            </div>
                            <span className="text-xl font-bold text-foreground">{cp.calls}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <SparkLine values={trendValues} color={CHART_COLORS[i % CHART_COLORS.length]} height={28} />
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className={Number(successPct) >= 95 ? "text-green-600" : Number(successPct) >= 80 ? "text-yellow-600" : "text-red-500"}>
                                {successPct}% ok
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-t border-border/30 pt-2">
                            <span className="text-green-600">{cp.success} success</span>
                            {cp.errors > 0 && <span className="text-red-500">{cp.errors} errors</span>}
                            <span className="ml-auto text-primary font-medium">${cp.cost.toFixed(4)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {dailyByDate.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Daily Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-daily-breakdown">
                      <thead>
                        <tr className="border-b border-border/50 text-left">
                          <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Date</th>
                          <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Calls</th>
                          {cpKeys.length > 1 && cpKeys.map(cpKey => (
                            <th key={cpKey} className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 whitespace-nowrap">{cpKey}</th>
                          ))}
                          <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Success</th>
                          <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Errors</th>
                          <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Cost</th>
                          <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 w-[160px]">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => { const maxDay = Math.max(...dailyByDate.map(d => d.calls), 1); return dailyByDate.map((row, idx) => {
                          const pct = (row.calls / maxDay) * 100;
                          return (
                            <tr key={row.date} className={`border-b border-border/20 ${idx % 2 === 0 ? "" : "bg-muted/5"}`} data-testid={`row-daily-${idx}`}>
                              <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{formatFullDate(row.date)}</td>
                              <td className="px-4 py-2 text-xs font-semibold text-foreground">{row.calls}</td>
                              {cpKeys.length > 1 && cpKeys.map(cpKey => (
                                <td key={cpKey} className="px-3 py-2 text-xs text-muted-foreground font-mono">{row.byCP[cpKey] || 0}</td>
                              ))}
                              <td className="px-4 py-2 text-xs text-green-600">{row.success}</td>
                              <td className="px-4 py-2 text-xs text-red-500">{row.errors > 0 ? row.errors : "—"}</td>
                              <td className="px-4 py-2 text-xs font-mono text-primary">${row.cost.toFixed(4)}</td>
                              <td className="px-4 py-2">
                                <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                                  <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </td>
                            </tr>
                          );
                        }); })()}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                          <td className="px-4 py-2.5 text-xs text-foreground">Total</td>
                          <td className="px-4 py-2.5 text-xs text-foreground">{totals.calls.toLocaleString()}</td>
                          {cpKeys.length > 1 && cpKeys.map(cpKey => {
                            const cpTotal = dailyByDate.reduce((sum, r) => sum + (r.byCP[cpKey] || 0), 0);
                            return <td key={cpKey} className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{cpTotal}</td>;
                          })}
                          <td className="px-4 py-2.5 text-xs text-green-600">{totals.success.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-xs text-red-500">{totals.errors > 0 ? totals.errors.toLocaleString() : "—"}</td>
                          <td className="px-4 py-2.5 text-xs font-mono text-primary">${totals.cost.toFixed(4)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
