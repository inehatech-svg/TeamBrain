import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/teambrain/session";
import { startSyncJob } from "@/lib/teambrain/sync";
import { GOOGLE_ACCOUNT, DRIVE_SCOPES, WORKSPACE_NAME } from "@/lib/teambrain/workspace";

/** GET: all connected sources + latest sync job (admin panel). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const sources = await db.source.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { files: true, syncJobs: true } },
      syncJobs: { orderBy: { startedAt: "desc" }, take: 5 },
    },
  });

  const chunkCount = await db.chunk.count();

  return NextResponse.json({
    sources: sources.map((s) => ({
      id: s.id,
      provider: s.provider,
      name: s.name,
      status: s.status,
      accountEmail: s.accountEmail,
      scopeNote: s.scopeNote,
      autoSyncMinutes: s.autoSyncMinutes,
      lastSyncedAt: s.lastSyncedAt,
      fileCount: s._count.files,
      createdAt: s.createdAt,
      recentJobs: s.syncJobs,
    })),
    totalChunks: chunkCount,
  });
}

/** POST: connect the Google Drive source (simulated OAuth) or disconnect. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "connect") {
    const existing = await db.source.findFirst({ where: { provider: "GDRIVE" } });
    if (existing) {
      return NextResponse.json({ error: "Google Drive is already connected" }, { status: 409 });
    }
    const source = await db.source.create({
      data: {
        provider: "GDRIVE",
        name: `Google Drive — ${WORKSPACE_NAME}`,
        status: "SYNCING",
        accountEmail: GOOGLE_ACCOUNT,
        scopeNote: DRIVE_SCOPES.join(" | "),
        autoSyncMinutes: 10,
      },
    });
    const jobId = startSyncJob(source.id, "OAUTH_CONNECT", 160);
    return NextResponse.json({ sourceId: source.id, jobId });
  }

  if (action === "disconnect") {
    const source = await db.source.findFirst({ where: { provider: "GDRIVE" } });
    if (!source) return NextResponse.json({ error: "No Google Drive source connected" }, { status: 404 });
    await db.source.delete({ where: { id: source.id } }); // cascades files/chunks/jobs
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
