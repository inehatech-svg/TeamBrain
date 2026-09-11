/**
 * TeamBrain seed — creates the demo workspace:
 * users, the simulated connected Google Drive source, indexed files,
 * sync history, and ~2 weeks of realistic usage logs (including
 * permission-filtered misses and true documentation gaps).
 *
 * Run: bun run scripts/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import { chunkDocument } from "../src/lib/teambrain/chunker";
import { buildEmbedding } from "../src/lib/teambrain/text";
import {
  MOCK_DRIVE_FILES,
  WORKSPACE_USERS,
  GOOGLE_ACCOUNT,
  DRIVE_SCOPES,
} from "../src/lib/teambrain/workspace";

const db = new PrismaClient();

function daysAgo(n: number, hourOffset = 0): Date {
  return new Date(Date.now() - n * 86400000 - hourOffset * 3600000);
}

async function main() {
  console.log("Seeding TeamBrain workspace…");

  // wipe (order matters for FKs; cascades handle children)
  await db.syncJob.deleteMany();
  await db.chatMessage.deleteMany();
  await db.queryLog.deleteMany();
  await db.driveFile.deleteMany();
  await db.source.deleteMany();
  await db.user.deleteMany();

  // users
  const users = new Map<string, { id: string }>();
  for (const u of WORKSPACE_USERS) {
    const created = await db.user.create({
      data: { email: u.email, name: u.name, role: u.role, title: u.title, initials: u.initials },
    });
    users.set(u.email, created);
  }
  console.log(`  users: ${users.size}`);

  // the connected Google Drive source (simulated OAuth)
  const source = await db.source.create({
    data: {
      provider: "GDRIVE",
      name: "Google Drive — Whitfield & Associates",
      status: "CONNECTED",
      accountEmail: GOOGLE_ACCOUNT,
      scopeNote: DRIVE_SCOPES.join(" | "),
      autoSyncMinutes: 10,
      lastSyncedAt: daysAgo(0, 0.08), // ~5 minutes ago
    },
  });

  // index the mock Drive with the real pipeline
  let chunkTotal = 0;
  for (const f of MOCK_DRIVE_FILES) {
    const record = await db.driveFile.create({
      data: {
        sourceId: source.id,
        driveId: f.driveId,
        name: f.name,
        path: f.path,
        mimeType: f.mimeType,
        ownerEmail: f.ownerEmail,
        visibility: f.visibility,
        sharedWith: f.sharedWith.join(","),
        sizeKb: Math.round((f.content.length / 1024) * 10) / 10,
        modifiedAt: daysAgo(f.modifiedDaysAgo),
        content: f.content,
      },
    });
    const chunks = chunkDocument(f.content);
    await db.chunk.createMany({
      data: chunks.map((c) => ({
        fileId: record.id,
        idx: c.idx,
        section: c.section,
        content: c.content,
        embedding: JSON.stringify(buildEmbedding(`${f.name}\n${c.section}\n${c.content}`)),
      })),
    });
    chunkTotal += chunks.length;
  }
  console.log(`  files: ${MOCK_DRIVE_FILES.length}, chunks: ${chunkTotal}`);

  // initial connect sync history
  await db.syncJob.create({
    data: {
      sourceId: source.id,
      status: "COMPLETED",
      trigger: "OAUTH_CONNECT",
      filesProcessed: MOCK_DRIVE_FILES.length,
      chunksIndexed: chunkTotal,
      message: `${MOCK_DRIVE_FILES.length} files indexed · ${chunkTotal} chunks embedded`,
      startedAt: daysAgo(0, 0.2),
      finishedAt: daysAgo(0, 0.18),
    },
  });

  // usage history (2 weeks) — mix of answered, permission-filtered misses, doc gaps
  const alice = users.get("alice@whitfield.legal")!;
  const bob = users.get("bob@whitfield.legal")!;
  const carol = users.get("carol@whitfield.legal")!;

  const logs: Array<{
    userId: string; query: string; status: string; confidence: number;
    citations: string[]; excluded: number; latency: number; days: number; hours: number;
  }> = [
    { userId: carol.id, query: "what's the mileage reimbursement rate", status: "ANSWERED", confidence: 0.62, citations: ["drv_policy_expense"], excluded: 0, latency: 2100, days: 9, hours: 9.2 },
    { userId: bob.id, query: "how do i book a desk for tuesday", status: "ANSWERED", confidence: 0.58, citations: ["drv_policy_remote"], excluded: 0, latency: 2400, days: 8, hours: 10.4 },
    { userId: carol.id, query: "conflicts check turnaround time", status: "ANSWERED", confidence: 0.66, citations: ["drv_play_onboard"], excluded: 0, latency: 1900, days: 8, hours: 14.1 },
    { userId: bob.id, query: "notice of appeal deadline federal", status: "ANSWERED", confidence: 0.71, citations: ["drv_res_deadlines"], excluded: 0, latency: 1700, days: 7, hours: 11.5 },
    { userId: alice.id, query: "acme acquisition purchase price and escrow terms", status: "ANSWERED", confidence: 0.74, citations: ["drv_client_acme_ma"], excluded: 0, latency: 2600, days: 7, hours: 16.8 },
    { userId: carol.id, query: "johnson family trust distribution schedule", status: "NOT_FOUND", confidence: 0.06, citations: [], excluded: 3, latency: 400, days: 6, hours: 10.9 },
    { userId: bob.id, query: "johnson trust distribution schedule", status: "ANSWERED", confidence: 0.68, citations: ["drv_client_johnson"], excluded: 0, latency: 2300, days: 6, hours: 15.2 },
    { userId: carol.id, query: "maternity leave policy", status: "NOT_FOUND", confidence: 0.04, citations: [], excluded: 0, latency: 320, days: 5, hours: 9.6 },
    { userId: bob.id, query: "acme corp acquisition purchase price", status: "NOT_FOUND", confidence: 0.05, citations: [], excluded: 5, latency: 380, days: 4, hours: 13.3 },
    { userId: alice.id, query: "expense approval threshold", status: "ANSWERED", confidence: 0.6, citations: ["drv_policy_expense"], excluded: 0, latency: 2000, days: 4, hours: 17.0 },
    { userId: carol.id, query: "who do i contact for laptop setup and mfa", status: "ANSWERED", confidence: 0.63, citations: ["drv_play_newhire", "drv_policy_cyber"], excluded: 0, latency: 2200, days: 3, hours: 9.4 },
    { userId: bob.id, query: "nda standard term length", status: "ANSWERED", confidence: 0.64, citations: ["drv_tmpl_nda"], excluded: 0, latency: 1800, days: 2, hours: 11.1 },
    { userId: alice.id, query: "write-off approval limit", status: "ANSWERED", confidence: 0.61, citations: ["drv_tmpl_billing"], excluded: 0, latency: 1900, days: 2, hours: 14.9 },
    { userId: carol.id, query: "parental leave policy", status: "NOT_FOUND", confidence: 0.04, citations: [], excluded: 0, latency: 300, days: 1, hours: 10.2 },
    { userId: bob.id, query: "meridian health response sla", status: "ANSWERED", confidence: 0.67, citations: ["drv_client_meridian"], excluded: 0, latency: 2100, days: 1, hours: 12.7 },
  ];

  for (const log of logs) {
    // resolve citation driveIds to seeded file ids
    const fileIds: string[] = [];
    for (const driveId of log.citations) {
      const file = await db.driveFile.findUnique({ where: { driveId }, select: { id: true } });
      if (file) fileIds.push(file.id);
    }
    await db.queryLog.create({
      data: {
        userId: log.userId,
        query: log.query,
        status: log.status,
        confidence: log.confidence,
        citationFileIds: JSON.stringify(fileIds),
        excludedChunks: log.excluded,
        latencyMs: log.latency,
        createdAt: daysAgo(log.days, log.hours),
      },
    });
  }
  console.log(`  usage logs: ${logs.length}`);

  console.log("Seed complete ✔");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
