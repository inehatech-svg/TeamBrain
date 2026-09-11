/**
 * TeamBrain answer synthesis — z-ai-web-dev-sdk (backend only).
 *
 * Contract: answer ONLY from the permission-filtered context excerpts,
 * cite them inline as [n], and if the excerpts don't confidently answer,
 * say so verbatim instead of guessing.
 */

import ZAI from "z-ai-web-dev-sdk";
import type { RetrievedChunk } from "./retrieval";

const FALLBACK_PHRASE = "I couldn't find a confident answer to that";

const SYSTEM_PROMPT = `You are TeamBrain, the internal knowledge assistant for Whitfield & Associates LLP, a 12-person business-law firm.

STRICT RULES:
1. Answer using ONLY the numbered context excerpts provided. Never use outside knowledge for facts, numbers, policies, or client details.
2. Cite excerpts inline using bracket markers like [1] or [2][4] immediately after the claim they support. Every factual sentence must carry at least one citation.
3. Keep answers concise (under 160 words), professional, and specific. Plain text with short paragraphs or a compact list — no markdown headers.
4. If the excerpts do not confidently answer the question, respond with exactly: "I couldn't find a confident answer to that." and nothing else. Do not partially guess, do not pad with general advice, do not cite weakly related excerpts.
5. You are permission-aware: only the excerpts provided were retrieved, and only they may be referenced. Never mention the existence of documents you were not given.`;

export interface SynthesisResult {
  answer: string;
  citationIds: number[]; // excerpt numbers the answer actually cites
  usedFallback: boolean;
}

export async function synthesizeAnswer(
  question: string,
  chunks: RetrievedChunk[]
): Promise<SynthesisResult> {
  const zai = await ZAI.create();

  const context = chunks
    .map((c, i) => {
      const sharedNote =
        c.visibility === "EVERYONE"
          ? "shared firm-wide"
          : `restricted; owner ${c.ownerEmail}`;
      return [
        `Excerpt [${i + 1}] — "${c.fileName}" (Drive path: ${c.filePath}, ${sharedNote})`,
        `Section: ${c.section}`,
        `Content: ${c.content}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const completion = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Question: ${question}\n\nContext excerpts (already filtered to documents the requesting user may access):\n\n${context}`,
      },
    ],
    thinking: { type: "disabled" },
  });

  const answer = (completion.choices[0]?.message?.content ?? "").trim();
  const usedFallback = /couldn'?t find a confident answer/i.test(answer) || answer.length < 5;

  const citationIds = new Set<number>();
  if (!usedFallback) {
    for (const m of answer.matchAll(/\[(\d+)\]/g)) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= chunks.length) citationIds.add(n);
    }
  }

  return { answer: usedFallback ? FALLBACK_PHRASE : answer, citationIds: [...citationIds], usedFallback };
}

export { FALLBACK_PHRASE };
