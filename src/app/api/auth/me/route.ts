import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/teambrain/session";
import { ensureScheduler } from "@/lib/teambrain/scheduler";

export async function GET() {
  try {
    ensureScheduler();
  } catch (err) {
    console.error("[auth/me] scheduler boot failed", err);
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, title: user.title, initials: user.initials },
  });
}
