import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/teambrain/session";
import { isSourceSyncing, startSyncJob } from "@/lib/teambrain/sync";

/** POST /api/sources/:id/sync — trigger a manual "Re-sync now". */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const source = await db.source.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  if (isSourceSyncing(id)) {
    return NextResponse.json({ error: "A sync is already running" }, { status: 409 });
  }

  const jobId = startSyncJob(id, "MANUAL", 140);
  return NextResponse.json({ jobId });
}

/** GET /api/sources/:id/sync — latest job status for progress polling. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const source = await db.source.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  const job = await db.syncJob.findFirst({
    where: { sourceId: id },
    orderBy: { startedAt: "desc" },
  });
  const fileCount = await db.driveFile.count({ where: { sourceId: id } });

  return NextResponse.json({
    job,
    source: {
      id: source.id,
      status: source.status,
      lastSyncedAt: source.lastSyncedAt,
      autoSyncMinutes: source.autoSyncMinutes,
    },
    fileCount,
  });
}
