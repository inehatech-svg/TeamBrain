/**
 * Background re-indexing scheduler (in-process, singleton).
 * Every minute it checks connected sources and triggers a SCHEDULED
 * re-sync when `lastSyncedAt` is older than the source's autoSyncMinutes.
 * In production this is a queue worker; here it keeps the demo honest
 * with zero extra infrastructure.
 */

import { db } from "@/lib/db";
import { isSourceSyncing, startSyncJob } from "./sync";

const TICK_MS = 60_000;

interface SchedulerGlobal {
  __tbScheduler?: NodeJS.Timeout;
}

const g = globalThis as unknown as SchedulerGlobal;

export function ensureScheduler(): void {
  if (g.__tbScheduler) return;
  g.__tbScheduler = setInterval(async () => {
    try {
      const sources = await db.source.findMany({
        where: { status: "CONNECTED", provider: "GDRIVE" },
      });
      for (const source of sources) {
        if (isSourceSyncing(source.id)) continue;
        const last = source.lastSyncedAt?.getTime() ?? 0;
        const staleFor = Date.now() - last;
        if (staleFor > source.autoSyncMinutes * 60_000) {
          console.log(`[scheduler] scheduled re-index for source ${source.name} (stale ${Math.round(staleFor / 60000)}min)`);
          startSyncJob(source.id, "SCHEDULED", 0);
        }
      }
    } catch (err) {
      console.error("[scheduler] tick failed:", err);
    }
  }, TICK_MS);
  console.log("[scheduler] TeamBrain background re-index scheduler started (tick 60s)");
}
