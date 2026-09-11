import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/teambrain/session";
import { assertAccessOrThrow, PermissionDeniedError } from "@/lib/teambrain/permissions";

/** GET /api/files/:id — full document + indexed chunks (permission-checked). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const file = await db.driveFile.findUnique({
    where: { id },
    include: { chunks: { orderBy: { idx: "asc" } } },
  });
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  try {
    assertAccessOrThrow(user, file);
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return NextResponse.json(
        { error: "You don't have access to this file in Drive, so TeamBrain can't open it." },
        { status: 403 }
      );
    }
    throw err;
  }

  return NextResponse.json({
    file: {
      id: file.id,
      name: file.name,
      path: file.path,
      mimeType: file.mimeType,
      ownerEmail: file.ownerEmail,
      visibility: file.visibility,
      sharedWith: file.sharedWith,
      modifiedAt: file.modifiedAt,
      sizeKb: file.sizeKb,
      chunks: file.chunks.map((c) => ({ idx: c.idx, section: c.section, content: c.content })),
    },
  });
}
