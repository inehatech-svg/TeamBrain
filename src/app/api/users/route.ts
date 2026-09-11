import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { WORKSPACE_NAME } from "@/lib/teambrain/workspace";

/** Demo-workspace directory used by the login screen. */
export async function GET() {
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, title: true, initials: true },
  });
  return NextResponse.json({ workspace: WORKSPACE_NAME, users });
}
