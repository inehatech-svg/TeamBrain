import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/teambrain/session";
import { userCanAccessFile } from "@/lib/teambrain/permissions";

/** GET /api/files?sourceId= — file browser for the admin sources panel,
 * annotated with the current user's actual Drive access. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const url = new URL(request.url);
  const sourceId = url.searchParams.get("sourceId");

  const files = await db.driveFile.findMany({
    where: sourceId ? { sourceId } : undefined,
    orderBy: [{ path: "asc" }],
    include: { _count: { select: { chunks: true } } },
  });

  return NextResponse.json({
    files: files.map((f) => {
      const access = userCanAccessFile(user, f);
      return {
        id: f.id,
        sourceId: f.sourceId,
        name: f.name,
        path: f.path,
        mimeType: f.mimeType,
        ownerEmail: f.ownerEmail,
        visibility: f.visibility,
        sharedWith: f.sharedWith,
        sizeKb: f.sizeKb,
        modifiedAt: f.modifiedAt,
        chunkCount: f._count.chunks,
        canAccess: access.canAccess,
        accessReason: access.reason,
      };
    }),
  });
}
