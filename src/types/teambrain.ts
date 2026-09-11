/** Shared TeamBrain API types (frontend mirror). */

export type Role = "ADMIN" | "MEMBER";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  title: string;
  initials: string;
}

export interface Citation {
  fileId: string;
  name: string;
  path: string;
  mimeType: string;
  ownerEmail: string;
  visibility: string;
  sharedWith: string;
  section: string;
  snippet: string;
  cited: boolean;
}

export interface StoredChatMessage {
  id: string;
  userId: string;
  role: string;
  content: string;
  citations: string; // JSON string of Citation[]
  status: string | null;
  excludedChunks: number;
  confidence: number;
  latencyMs: number;
  createdAt: string;
}

export interface ChatResponse {
  messages: StoredChatMessage[];
  answer: string;
  status: "ANSWERED" | "NOT_FOUND";
  citations: Citation[];
  excludedRelevantChunks: number;
  searchedChunks: number;
  confidence: number;
  latencyMs: number;
  llmUsed: boolean;
}

export interface SyncJobInfo {
  id: string;
  sourceId?: string;
  status: string;
  trigger: string;
  filesProcessed: number;
  chunksIndexed: number;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface SourceInfo {
  id: string;
  provider: string;
  name: string;
  status: string;
  accountEmail: string | null;
  scopeNote: string | null;
  autoSyncMinutes: number;
  lastSyncedAt: string | null;
  fileCount: number;
  createdAt: string;
  recentJobs: SyncJobInfo[];
}

export interface FileMeta {
  id: string;
  sourceId: string;
  name: string;
  path: string;
  mimeType: string;
  ownerEmail: string;
  visibility: string;
  sharedWith: string;
  sizeKb: number;
  modifiedAt: string;
  chunkCount: number;
  canAccess: boolean;
  accessReason: string;
}

export interface FileDetail {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  ownerEmail: string;
  visibility: string;
  sharedWith: string;
  modifiedAt: string;
  sizeKb: number;
  chunks: { idx: number; section: string; content: string }[];
}

export interface Insights {
  kpis: {
    totalQueries: number;
    answeredCount: number;
    answeredRate: number;
    avgLatencyMs: number;
    gapsCount: number;
    permissionFilteredCount: number;
  };
  topQueries: { query: string; count: number; answered: number }[];
  gaps: { query: string; count: number; excluded: number; lastAskedAt: string }[];
  perUser: {
    name: string;
    initials: string;
    queries: number;
    answeredRate: number;
    lastActiveAt: string;
  }[];
  recent: {
    id: string;
    query: string;
    userName: string;
    status: string;
    excludedChunks: number;
    confidence: number;
    latencyMs: number;
    createdAt: string;
  }[];
  syncHistory: {
    id: string;
    sourceName: string;
    trigger: string;
    status: string;
    filesProcessed: number;
    chunksIndexed: number;
    message: string | null;
    startedAt: string;
    finishedAt: string | null;
  }[];
}

export interface SyncStatusResponse {
  job: SyncJobInfo | null;
  source: { id: string; status: string; lastSyncedAt: string | null; autoSyncMinutes: number };
  fileCount: number;
}
