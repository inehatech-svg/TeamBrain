/**
 * TeamBrain session — lightweight cookie sessions for the demo workspace.
 * In production this is NextAuth + Google OAuth; the permission model
 * itself is independent of how the session is stored.
 */

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";

export const SESSION_COOKIE = "tb_session";

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}
