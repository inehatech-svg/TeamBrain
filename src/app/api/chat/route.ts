import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/teambrain/session";
import { retrieveForUser, retrievalConfidence } from "@/lib/teambrain/retrieval";
import { synthesizeAnswer, FALLBACK_PHRASE } from "@/lib/teambrain/llm";

export const maxDuration = 60;

/** GET: chat history for the signed-in user (ascending, last 40). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const messages = await db.chatMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return NextResponse.json({ messages: messages.reverse() });
}

/** DELETE: clear this user's chat thread (usage analytics are retained). */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await db.chatMessage.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const started = Date.now();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const query = String(body.query ?? "").trim();
    if (query.length < 3 || query.length > 500) {
      return NextResponse.json({ error: "Question must be 3–500 characters" }, { status: 400 });
    }

    // ---- 1) Retrieve with permission enforcement (filter BEFORE the LLM) ----
    const retrieval = await retrieveForUser(user.email, query);

    let answer = FALLBACK_PHRASE;
    let status: "ANSWERED" | "NOT_FOUND" = "NOT_FOUND";
    let confidence = Math.min(0.12, retrievalConfidence(retrieval.topScore));
    let citedIds = new Set<number>();

    // ---- 2) Confidence gate → only call the LLM with real support ----
    if (retrieval.confident && retrieval.chunks.length > 0) {
      try {
        const synthesis = await synthesizeAnswer(query, retrieval.chunks);
        answer = synthesis.answer;
        if (!synthesis.usedFallback && synthesis.citationIds.length > 0) {
          status = "ANSWERED";
          confidence = retrievalConfidence(retrieval.topScore);
          citedIds = new Set(synthesis.citationIds);
        }
      } catch (err) {
        console.error("[chat] synthesis failed", err);
        answer = FALLBACK_PHRASE;
        status = "NOT_FOUND";
      }
    }

    const latencyMs = Date.now() - started;
    // Citation list keeps excerpt order so [n] markers in the answer map 1:1
    const citations = retrieval.chunks.map((c, i) => ({
      fileId: c.fileId,
      name: c.fileName,
      path: c.filePath,
      mimeType: c.mimeType,
      ownerEmail: c.ownerEmail,
      visibility: c.visibility,
      sharedWith: c.sharedWith,
      section: c.section,
      snippet: c.content.length > 240 ? c.content.slice(0, 240) + "…" : c.content,
      cited: citedIds.has(i + 1),
    }));

    // ---- 3) Persist thread + usage log ----
    const userMsg = await db.chatMessage.create({
      data: { userId: user.id, role: "user", content: query },
    });
    const assistantMsg = await db.chatMessage.create({
      data: {
        userId: user.id,
        role: "assistant",
        content: answer,
        citations: JSON.stringify(citations),
        status,
        excludedChunks: retrieval.excludedRelevantChunks,
        confidence: Math.round(confidence * 100) / 100,
        latencyMs,
      },
    });
    await db.queryLog.create({
      data: {
        userId: user.id,
        query,
        status,
        confidence: Math.round(confidence * 100) / 100,
        citationFileIds: JSON.stringify([...new Set(citations.map((c) => c.fileId))]),
        excludedChunks: retrieval.excludedRelevantChunks,
        latencyMs,
      },
    });

    return NextResponse.json({
      messages: [userMsg, assistantMsg],
      answer,
      status,
      citations,
      excludedRelevantChunks: retrieval.excludedRelevantChunks,
      searchedChunks: retrieval.totalChunks,
      confidence: Math.round(confidence * 100) / 100,
      latencyMs,
      llmUsed: status === "ANSWERED",
    });
  } catch (err) {
    console.error("[chat]", err);
    return NextResponse.json({ error: "Something went wrong answering that question" }, { status: 500 });
  }
}
