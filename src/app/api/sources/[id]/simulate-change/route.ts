import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/teambrain/session";
import { simulateIncomingDriveFile } from "@/lib/teambrain/sync";

/**
 * POST /api/sources/:id/simulate-change — demo tool: a colleague "adds"
 * the Paid Parental Leave Policy to the shared Drive so admins can show
 * TeamBrain picking up new content and closing a documentation gap.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const source = await db.source.findUnique({ where: { id } });
  if (!source || source.provider !== "GDRIVE") {
    return NextResponse.json({ error: "Connect Google Drive first" }, { status: 404 });
  }

  const result = await simulateIncomingDriveFile(id);
  if (!result.added) {
    return NextResponse.json(
      { error: `"${result.name}" is already in the simulated Drive` },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, name: result.name });
}
