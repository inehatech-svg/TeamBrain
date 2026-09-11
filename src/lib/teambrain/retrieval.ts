/**
 * TeamBrain retrieval pipeline.
 *
 * ORDER OF OPERATIONS (deliberate, per spec):
 *   1. Load every indexed chunk.
 *   2. PERMISSION FILTER FIRST — chunks from files the requesting user
 *      cannot open in Drive are removed before any scoring, and before
 *      anything can reach the LLM context. We also count how many
 *      topically-relevant chunks were excluded (the transparency signal).
 *   3. Hybrid scoring: TF-IDF cosine (stored "embedding") + BM25 + title boost.
 *   4. Confidence gate: below threshold → "no confident answer" without
 *      calling the LLM (never guess, never hallucinate a citation).
 */

import { db } from "@/lib/db";
import { buildEmbedding, cosine, overlapCount, tokenizeQuery } from "./text";

export interface RetrievedChunk {
  chunkId: string;
  fileId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  ownerEmail: string;
  visibility: string;
  sharedWith: string;
  section: string;
  content: string;
  score: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[]; // permission-filtered, scored, ranked
  excludedRelevantChunks: number; // topically relevant but permission-excluded
  totalChunks: number;
  topScore: number;
  confident: boolean;
}

const CONFIDENCE_THRESHOLD = 0.16;
const MAX_CONTEXT_CHUNKS = 5;

interface ChunkRow {
  id: string;
  idx: number;
  section: string;
  content: string;
  embedding: string;
  file: {
    id: string;
    name: string;
    path: string;
    mimeType: string;
    ownerEmail: string;
    visibility: string;
    sharedWith: string;
  };
}

export async function retrieveForUser(
  userEmail: string,
  query: string
): Promise<RetrievalResult> {
  const rows: ChunkRow[] = await db.chunk.findMany({
    include: {
      file: {
        select: {
          id: true,
          name: true,
          path: true,
          mimeType: true,
          ownerEmail: true,
          visibility: true,
          sharedWith: true,
        },
      },
    },
  });

  const queryTerms = tokenizeQuery(query);
  const queryVec = buildEmbedding(query);

  // ---- Step 2: permission filter FIRST (before scoring) ----
  const accessible: ChunkRow[] = [];
  const excluded: ChunkRow[] = [];
  for (const row of rows) {
    const f = row.file;
    const canAccess =
      f.ownerEmail === userEmail ||
      f.visibility === "EVERYONE" ||
      f.sharedWith
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
        .includes(userEmail.toLowerCase());
    if (canAccess) accessible.push(row);
    else excluded.push(row);
  }

  // Transparency: how many excluded chunks were topically relevant?
  const excludedRelevantChunks = excluded.filter((r) => overlapCount(queryTerms, r.content) > 0).length;

  if (accessible.length === 0) {
    return {
      chunks: [],
      excludedRelevantChunks,
      totalChunks: rows.length,
      topScore: 0,
      confident: false,
    };
  }

  // ---- Step 3: hybrid scoring over accessible chunks only ----
  const avgdl = accessible.reduce((s, r) => s + r.content.length, 0) / accessible.length;
  const df = new Map<string, number>();
  for (const row of accessible) {
    const seen = new Set(Object.keys(JSON.parse(row.embedding) as Record<string, number>));
    for (const term of seen) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const N = accessible.length;
  const bm25 = (row: ChunkRow): number => {
    const emb = JSON.parse(row.embedding) as Record<string, number>;
    const rawTf: Record<string, number> = {};
    for (const [term, w] of Object.entries(emb)) rawTf[term] = Math.max(1, Math.round(Math.exp(w - 1))); // invert sublinear tf
    let score = 0;
    const k1 = 1.5;
    const b = 0.75;
    for (const term of new Set(queryTerms)) {
      const tf = rawTf[term];
      if (!tf) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score +=
        (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * row.content.length) / avgdl));
    }
    return score;
  };

  // title boost: query terms present in the file name
  const titleBoost = (row: ChunkRow): number => overlapCount(queryTerms, row.file.name) / Math.max(1, new Set(queryTerms).size);

  const scored = accessible.map((row) => {
    const emb = JSON.parse(row.embedding) as Record<string, number>;
    const cos = cosine(queryVec, emb);
    const bm = bm25(row);
    return { row, cos, bm, tb: titleBoost(row) };
  });

  const maxBm = Math.max(...scored.map((s) => s.bm), 1e-9);
  const ranked: RetrievedChunk[] = scored
    .map(({ row, cos, bm, tb }) => ({
      chunkId: row.id,
      fileId: row.file.id,
      fileName: row.file.name,
      filePath: row.file.path,
      mimeType: row.file.mimeType,
      ownerEmail: row.file.ownerEmail,
      visibility: row.file.visibility,
      sharedWith: row.file.sharedWith,
      section: row.section,
      content: row.content,
      score: Math.min(1, 0.4 * cos + 0.5 * (bm / maxBm) + 0.25 * tb),
    }))
    .sort((a, b) => b.score - a.score);

  const topScore = ranked[0]?.score ?? 0;

  return {
    chunks: ranked.slice(0, MAX_CONTEXT_CHUNKS),
    excludedRelevantChunks,
    totalChunks: rows.length,
    topScore,
    confident: topScore >= CONFIDENCE_THRESHOLD,
  };
}

export function retrievalConfidence(topScore: number): number {
  return Math.max(0, Math.min(0.99, topScore * 1.4));
}
