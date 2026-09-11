/**
 * TeamBrain ingestion pipeline — "Google Drive" (simulated workspace) →
 * chunk → embed → store. Used by: initial OAuth connect, manual
 * "Re-sync now", and the background scheduler.
 *
 * Progress is persisted on a SyncJob row so the admin panel can poll it.
 */

import { db } from "@/lib/db";
import { chunkDocument } from "./chunker";
import { buildEmbedding } from "./text";
import { MOCK_DRIVE_FILES, SIMULATED_INCOMING_FILE, type MockDriveFile } from "./workspace";

export type SyncTrigger = "MANUAL" | "SCHEDULED" | "OAUTH_CONNECT" | "UPLOAD";

const runningJobs = new Set<string>();

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function indexFile(sourceId: string, file: MockDriveFile): Promise<number> {
  const chunks = chunkDocument(file.content);
  const data = {
    sourceId,
    driveId: file.driveId,
    name: file.name,
    path: file.path,
    mimeType: file.mimeType,
    ownerEmail: file.ownerEmail,
    visibility: file.visibility,
    sharedWith: file.sharedWith.join(","),
    sizeKb: Math.round((file.content.length / 1024) * 10) / 10,
    modifiedAt: daysAgo(file.modifiedDaysAgo),
    content: file.content,
  };
  const record = await db.driveFile.upsert({
    where: { driveId: file.driveId },
    update: data,
    create: { ...data, driveId: file.driveId },
  });
  await db.chunk.deleteMany({ where: { fileId: record.id } });
  await db.chunk.createMany({
    data: chunks.map((c) => ({
      fileId: record.id,
      idx: c.idx,
      section: c.section,
      content: c.content,
      embedding: JSON.stringify(buildEmbedding(`${file.name}\n${c.section}\n${c.content}`)),
    })),
  });
  return chunks.length;
}

/** Starts a sync job without blocking the caller. Returns the job id. */
export function startSyncJob(sourceId: string, trigger: SyncTrigger, fileDelayMs = 140): string {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  void processJob(jobId, sourceId, trigger, fileDelayMs).catch(async (err) => {
    console.error("[sync] job failed:", err);
    try {
      await db.syncJob.update({
        where: { id: jobId },
        data: { status: "FAILED", message: String(err), finishedAt: new Date() },
      });
      await db.source.update({ where: { id: sourceId }, data: { status: "CONNECTED" } });
    } catch { /* job row may not exist yet */ }
  });
  return jobId;
}

async function processJob(
  jobId: string,
  sourceId: string,
  trigger: SyncTrigger,
  fileDelayMs: number
): Promise<void> {
  if (runningJobs.has(sourceId)) throw new Error("A sync is already running for this source");
  runningJobs.add(sourceId);
  try {
    await db.syncJob.create({
      data: { id: jobId, sourceId, status: "RUNNING", trigger, startedAt: new Date() },
    });
    await db.source.update({ where: { id: sourceId }, data: { status: "SYNCING" } });

    const source = await db.source.findUnique({ where: { id: sourceId } });
    if (!source) throw new Error("Source not found");

    let listing: MockDriveFile[] = [];
    if (source.provider === "GDRIVE") {
      // The simulated Drive API listing: static workspace + any file an admin
      // "dropped in" via the demo tool (persisted by driveId).
      const simulatedExists = await db.driveFile.findUnique({
        where: { driveId: SIMULATED_INCOMING_FILE.driveId },
        select: { id: true },
      });
      listing = [...MOCK_DRIVE_FILES];
      if (simulatedExists) listing.push(SIMULATED_INCOMING_FILE);
      // Remove files deleted from the listing (stale index entries)
      const keepIds = new Set(listing.map((f) => f.driveId));
      const existing = await db.driveFile.findMany({ where: { sourceId }, select: { driveId: true } });
      for (const f of existing) if (!keepIds.has(f.driveId)) await db.driveFile.delete({ where: { id: f.id } });
    } else {
      // UPLOAD sources re-index whatever is already stored
      const rows = await db.driveFile.findMany({ where: { sourceId } });
      listing = rows.map((r) => ({
        driveId: r.driveId,
        name: r.name,
        path: r.path,
        mimeType: r.mimeType,
        ownerEmail: r.ownerEmail,
        visibility: r.visibility as "EVERYONE" | "RESTRICTED",
        sharedWith: r.sharedWith.split(",").filter(Boolean),
        modifiedDaysAgo: Math.max(0, (Date.now() - r.modifiedAt.getTime()) / 86400000),
        content: r.content,
      }));
    }

    let filesProcessed = 0;
    let chunksIndexed = 0;
    for (const file of listing) {
      chunksIndexed += await indexFile(sourceId, file);
      filesProcessed += 1;
      await db.syncJob.update({
        where: { id: jobId },
        data: { filesProcessed, chunksIndexed },
      });
      if (fileDelayMs > 0) await new Promise((r) => setTimeout(r, fileDelayMs));
    }

    await db.syncJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        filesProcessed,
        chunksIndexed,
        message: `${filesProcessed} file${filesProcessed === 1 ? "" : "s"} indexed · ${chunksIndexed} chunks embedded`,
        finishedAt: new Date(),
      },
    });
    await db.source.update({
      where: { id: sourceId },
      data: { status: "CONNECTED", lastSyncedAt: new Date() },
    });
  } finally {
    runningJobs.delete(sourceId);
  }
}

/** Demo tool: simulate a colleague adding a new policy to the shared Drive. */
export async function simulateIncomingDriveFile(sourceId: string): Promise<{ added: boolean; name: string }> {
  const existing = await db.driveFile.findUnique({
    where: { driveId: SIMULATED_INCOMING_FILE.driveId },
    select: { id: true },
  });
  if (existing) return { added: false, name: SIMULATED_INCOMING_FILE.name };
  const jobId = `job_${Date.now()}_sim`;
  await db.syncJob.create({
    data: {
      id: jobId,
      sourceId,
      status: "RUNNING",
      trigger: "MANUAL",
      message: "Incoming Drive change detected",
      startedAt: new Date(),
    },
  });
  const chunkCount = await indexFile(sourceId, SIMULATED_INCOMING_FILE);
  await db.syncJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      filesProcessed: 1,
      chunksIndexed: chunkCount,
      message: `New file indexed: ${SIMULATED_INCOMING_FILE.name}`,
      finishedAt: new Date(),
    },
  });
  await db.source.update({ where: { id: sourceId }, data: { lastSyncedAt: new Date() } });
  return { added: true, name: SIMULATED_INCOMING_FILE.name };
}

export function isSourceSyncing(sourceId: string): boolean {
  return runningJobs.has(sourceId);
}
