import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/teambrain/session";

/** GET /api/insights — usage analytics for admins (top queries, doc gaps). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const logs = await db.queryLog.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, initials: true } } },
    take: 500,
  });

  const answered = logs.filter((l) => l.status === "ANSWERED");
  const notFound = logs.filter((l) => l.status === "NOT_FOUND");

  const groupQueries = (rows: typeof logs) => {
    const map = new Map<string, { query: string; count: number; answered: number; excluded: number; last: Date }>();
    for (const l of rows) {
      const key = l.query.toLowerCase().trim().replace(/\s+/g, " ");
      const entry = map.get(key) ?? {
        query: key,
        count: 0,
        answered: 0,
        excluded: 0,
        last: l.createdAt,
      };
      entry.count += 1;
      if (l.status === "ANSWERED") entry.answered += 1;
      if (l.excludedChunks > 0) entry.excluded = Math.max(entry.excluded, l.excludedChunks);
      if (l.createdAt > entry.last) entry.last = l.createdAt;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count || b.last.getTime() - a.last.getTime());
  };

  const allGrouped = groupQueries(logs);
  const gaps = groupQueries(notFound).slice(0, 8);

  const perUserMap = new Map<string, { name: string; initials: string; queries: number; answered: number; last: Date }>();
  for (const l of logs) {
    const entry = perUserMap.get(l.userId) ?? {
      name: l.user.name,
      initials: l.user.initials,
      queries: 0,
      answered: 0,
      last: l.createdAt,
    };
    entry.queries += 1;
    if (l.status === "ANSWERED") entry.answered += 1;
    if (l.createdAt > entry.last) entry.last = l.createdAt;
    perUserMap.set(l.userId, entry);
  }

  const syncHistory = await db.syncJob.findMany({
    orderBy: { startedAt: "desc" },
    take: 8,
    include: { source: { select: { name: true, provider: true } } },
  });

  return NextResponse.json({
    kpis: {
      totalQueries: logs.length,
      answeredCount: answered.length,
      answeredRate: logs.length ? answered.length / logs.length : 0,
      avgLatencyMs: logs.length ? Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / logs.length) : 0,
      gapsCount: notFound.length,
      permissionFilteredCount: logs.filter((l) => l.excludedChunks > 0).length,
    },
    topQueries: allGrouped.slice(0, 7).map((q) => ({
      query: q.query,
      count: q.count,
      answered: q.answered,
    })),
    gaps: gaps.map((g) => ({
      query: g.query,
      count: g.count,
      excluded: g.excluded,
      lastAskedAt: g.last,
    })),
    perUser: [...perUserMap.values()]
      .sort((a, b) => b.queries - a.queries)
      .map((u) => ({
        name: u.name,
        initials: u.initials,
        queries: u.queries,
        answeredRate: u.queries ? u.answered / u.queries : 0,
        lastActiveAt: u.last,
      })),
    recent: logs.slice(0, 10).map((l) => ({
      id: l.id,
      query: l.query,
      userName: l.user.name,
      status: l.status,
      excludedChunks: l.excludedChunks,
      confidence: l.confidence,
      latencyMs: l.latencyMs,
      createdAt: l.createdAt,
    })),
    syncHistory: syncHistory.map((j) => ({
      id: j.id,
      sourceName: j.source.name,
      trigger: j.trigger,
      status: j.status,
      filesProcessed: j.filesProcessed,
      chunksIndexed: j.chunksIndexed,
      message: j.message,
      startedAt: j.startedAt,
      finishedAt: j.finishedAt,
    })),
  });
}
