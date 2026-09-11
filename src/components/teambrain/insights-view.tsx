"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  ThumbsUp,
  Gauge,
  SearchX,
  ShieldAlert,
  Lock,
  TrendingUp,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { Insights } from "@/types/teambrain";

export function InsightsView() {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/insights")
      .then(async (res) => {
        if (res.ok) setData((await res.json()) as Insights);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground">Couldn&apos;t load insights.</p>;

  const { kpis } = data;
  const kpiCards = [
    { icon: MessageSquare, label: "Queries", value: String(kpis.totalQueries), sub: "last 2 weeks" },
    {
      icon: ThumbsUp,
      label: "Answer rate",
      value: `${Math.round(kpis.answeredRate * 100)}%`,
      sub: `${kpis.answeredCount} confident answers`,
    },
    {
      icon: Gauge,
      label: "Avg response",
      value: `${(kpis.avgLatencyMs / 1000).toFixed(1)}s`,
      sub: "retrieval + synthesis",
    },
    {
      icon: SearchX,
      label: "Doc gaps",
      value: String(kpis.gapsCount),
      sub: "queries with no answer",
    },
    {
      icon: ShieldAlert,
      label: "Perm-filtered",
      value: String(kpis.permissionFilteredCount),
      sub: "answers blocked by Drive perms",
    },
  ];

  const maxQueryCount = Math.max(...data.topQueries.map((q) => q.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Usage & knowledge health</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          What your team searches for, what answers confidently, and where the documentation gaps
          are.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {k.label}
                  </p>
                  <k.icon className="h-4 w-4 text-primary/70" />
                </div>
                <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{k.value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{k.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* top queries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4.5 w-4.5 text-primary" />
              Top queries
            </CardTitle>
            <CardDescription>What the team keeps asking TeamBrain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topQueries.length === 0 && (
              <p className="text-sm text-muted-foreground">No queries yet.</p>
            )}
            {data.topQueries.map((q) => (
              <div key={q.query} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="truncate">{q.query}</p>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    ×{q.count}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(q.count / maxQueryCount) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      q.answered === q.count ? "bg-primary/70" : "bg-amber-500/60"
                    }`}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* doc gaps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SearchX className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
              Documentation gaps
            </CardTitle>
            <CardDescription>
              No confident answer found — candidates for a new policy or playbook page
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.gaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No gaps recorded — every query found a confident answer.
              </p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto tb-scroll pr-1">
                {data.gaps.map((g) => (
                  <div
                    key={g.query}
                    className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{g.query}</p>
                      <p className="text-[11px] text-muted-foreground">
                        asked {g.count}× · last {formatDistanceToNow(new Date(g.lastAskedAt), { addSuffix: true })}
                      </p>
                    </div>
                    {g.excluded > 0 ? (
                      <Badge
                        variant="outline"
                        className="shrink-0 gap-1 border-primary/30 text-[10px] text-primary"
                        title={`${g.excluded} relevant chunks exist but are permission-restricted`}
                      >
                        <Lock className="h-3 w-3" />
                        perms
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="shrink-0 gap-1 border-amber-500/40 text-[10px] text-amber-700 dark:text-amber-400"
                        title="Nothing in the indexed corpus answers this — a true documentation gap"
                      >
                        <Sparkles className="h-3 w-3" />
                        gap
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              <span className="font-medium text-primary">perms</span> = the answer exists but is
              restricted for that teammate · <span className="font-medium text-amber-700 dark:text-amber-400">gap</span> = nothing
              answers it yet — write the doc, re-sync, done.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* per user */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team usage</CardTitle>
            <CardDescription>Queries per teammate and their answer rate</CardDescription>
          </CardHeader>
          <CardContent className="pb-0">
            <div className="max-h-72 overflow-y-auto tb-scroll">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Teammate</TableHead>
                    <TableHead className="text-right">Queries</TableHead>
                    <TableHead className="text-right">Answer rate</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Last active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.perUser.map((u) => (
                    <TableRow key={u.name} className="border-b/50">
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                            {u.initials}
                          </span>
                          <span className="text-sm">{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{u.queries}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {Math.round(u.answeredRate * 100)}%
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(u.lastActiveAt), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* recent activity + sync history */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent queries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4">
              <div className="max-h-44 space-y-1.5 overflow-y-auto tb-scroll pr-1">
                {data.recent.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.query}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.userName} · {(r.latencyMs / 1000).toFixed(1)}s ·{" "}
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] ${
                        r.status === "ANSWERED"
                          ? "border-primary/30 text-primary"
                          : "border-amber-500/40 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {r.status === "ANSWERED" ? "answered" : "no answer"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RefreshCw className="h-4 w-4 text-primary" />
                Index sync history
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4">
              <div className="max-h-44 space-y-1.5 overflow-y-auto tb-scroll pr-1">
                {data.syncHistory.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs"
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[9px] uppercase">
                        {j.trigger.toLowerCase()}
                      </Badge>
                      <span className="truncate text-muted-foreground">
                        {j.message ?? j.status.toLowerCase()}
                      </span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatDistanceToNow(new Date(j.startedAt), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
