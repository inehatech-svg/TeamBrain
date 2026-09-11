/**
 * TeamBrain permission engine — THE critical correctness component.
 *
 * Rule: a user may only retrieve content from a file they can already open
 * in the source system (Google Drive). We resolve access from the file's
 * native sharing metadata (owner, visibility, sharedWith) — the app-level
 * ADMIN role never grants content access. Ambiguity under-surfaces: files
 * with RESTRICTED visibility and no explicit grant are treated as no-access.
 */

import type { User } from "@prisma/client";

export interface FileAccessInfo {
  canAccess: boolean;
  reason: string; // human-readable, shown in UI
}

interface FileLike {
  ownerEmail: string;
  visibility: string; // EVERYONE | RESTRICTED
  sharedWith: string; // comma-separated emails
}

export function userCanAccessFile(user: Pick<User, "email">, file: FileLike): FileAccessInfo {
  if (file.ownerEmail === user.email) {
    return { canAccess: true, reason: "You own this file" };
  }
  if (file.visibility === "EVERYONE") {
    return { canAccess: true, reason: "Shared with everyone at the firm" };
  }
  const shared = file.sharedWith
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (shared.includes(user.email.toLowerCase())) {
    return { canAccess: true, reason: "Shared directly with you in Drive" };
  }
  return {
    canAccess: false,
    reason: "Restricted in Drive — you don't have access",
  };
}

/** Guard used by file-content endpoints: denies early, never leaks existence details. */
export function assertAccessOrThrow(user: Pick<User, "email">, file: FileLike): void {
  if (!userCanAccessFile(user, file).canAccess) {
    throw new PermissionDeniedError();
  }
}

export class PermissionDeniedError extends Error {
  constructor() {
    super("Permission denied: you do not have access to this file");
    this.name = "PermissionDeniedError";
  }
}
