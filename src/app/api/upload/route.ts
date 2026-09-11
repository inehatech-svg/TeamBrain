import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/teambrain/session";
import { chunkDocument } from "@/lib/teambrain/chunker";
import { buildEmbedding } from "@/lib/teambrain/text";

export const maxDuration = 60;

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function looksLikeText(text: string): boolean {
  if (text.length === 0) return false;
  let printable = 0;
  const sample = text.slice(0, 4000);
  for (const ch of sample) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code < 127)) printable++;
    // allow common UTF-8 letters
    else if (code > 160) printable++;
  }
  return printable / sample.length > 0.85;
}

/**
 * POST /api/upload — manual document upload (admin).
 * The file is ingested through the same chunk → embed → index pipeline,
 * owned by the uploader and visible to them by default (or firm-wide if
 * the admin chooses), mirroring Drive's sharing model.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File is larger than 2 MB (demo limit)" }, { status: 400 });
    }
    const visibility = form.get("visibility") === "EVERYONE" ? "EVERYONE" : "RESTRICTED";

    const text = await file.text();
    if (!looksLikeText(text) || text.trim().length < 60) {
      return NextResponse.json(
        {
          error:
            "Couldn't extract text from this file. The demo ingests text-based documents (txt, md, csv, json…) — production uses Drive's native export.",
        },
        { status: 422 }
      );
    }

    // ensure the manual-upload source exists
    let source = await db.source.findFirst({ where: { provider: "UPLOAD" } });
    if (!source) {
      source = await db.source.create({
        data: {
          provider: "UPLOAD",
          name: "Manual uploads",
          status: "CONNECTED",
          autoSyncMinutes: 60,
        },
      });
    }

    const safeName = file.name.replace(/[^\w\s.\-()]/g, "_").slice(0, 120) || "upload.txt";
    const driveId = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mimeType = file.type || "text/plain";

    const record = await db.driveFile.create({
      data: {
        sourceId: source.id,
        driveId,
        name: safeName,
        path: `/Manual Uploads/${safeName}`,
        mimeType,
        ownerEmail: user.email,
        visibility,
        sharedWith: "",
        sizeKb: Math.round((text.length / 1024) * 10) / 10,
        modifiedAt: new Date(),
        content: text,
      },
    });

    const chunks = chunkDocument(text);
    await db.chunk.createMany({
      data: chunks.map((c) => ({
        fileId: record.id,
        idx: c.idx,
        section: c.section,
        content: c.content,
        embedding: JSON.stringify(buildEmbedding(`${safeName}\n${c.section}\n${c.content}`)),
      })),
    });

    await db.source.update({ where: { id: source.id }, data: { lastSyncedAt: new Date() } });
    await db.syncJob.create({
      data: {
        sourceId: source.id,
        status: "COMPLETED",
        trigger: "UPLOAD",
        filesProcessed: 1,
        chunksIndexed: chunks.length,
        message: `Uploaded & indexed: ${safeName}`,
        startedAt: new Date(Date.now() - 2000),
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({ fileId: record.id, name: safeName, chunks: chunks.length });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
