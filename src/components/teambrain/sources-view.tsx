"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  HardDrive,
  RefreshCw,
  Unplug,
  Upload,
  Lock,
  FileText,
  Loader2,
  CloudUpload,
  FileStack,
  Scissors,
  Braces,
  ShieldCheck,
  MessageSquareQuote,
  Sparkles,
  Globe,
  CircleCheck,
} from "lucide-react";
import type { FileMeta, SourceInfo, SyncJobInfo, SyncStatusResponse } from "@/types/teambrain";
import { OAuthDialog } from "./oauth-dialog";

const OAUTH_ACCOUNT = "alice@whitfield.legal";
const OAUTH_SCOPES = [
  "drive.readonly — See and download files you already have access to",
  "drive.metadata.readonly — See file & sharing metadata (never content you can't open)",
];

interface SourcesViewProps {
  onOpenFile: (fileId: string, fileName?: string) => void;
}

export function SourcesView({ onOpenFile }: SourcesViewProps) {
  const { toast } = useToast();
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [oauthOpen, setOauthOpen] = useState(false);
  const [syncingJob, setSyncingJob] = useState<SyncJobInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadVisibility, setUploadVisibility] = useState<"RESTRICTED" | "EVERYONE">("RESTRICTED");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const gdrive = sources.find((s) => s.provider === "GDRIVE");
  const uploadSource = sources.find((s) => s.provider === "UPLOAD");

  const refresh = useCallback(async () => {
    try {
      const [sourcesRes, filesRes] = await Promise.all([fetch("/api/sources"), fetch("/api/files")]);
      if (sourcesRes.ok) {
        const data = await sourcesRes.json();
        setSources(data.sources as SourceInfo[]);
        setTotalChunks(data.totalChunks as number);
      }
      if (filesRes.ok) {
        const data = await filesRes.json();
        setFiles(data.files as FileMeta[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // poll the active sync job
  const watchJob = useCallback(
    (sourceId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const res = await fetch(`/api/sources/${sourceId}/sync`);
        if (!res.ok) return;
        const data = (await res.json()) as SyncStatusResponse;
        if (data.job) setSyncingJob(data.job);
        if (data.job && data.job.status !== "RUNNING") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setSyncingJob(null);
          refresh();
          if (data.job.status === "COMPLETED") {
            toast({
              title: "Re-sync complete",
              description: data.job.message ?? `${data.job.filesProcessed} files re-indexed`,
            });
          }
        }
      }, 800);
    },
    [refresh, toast]
  );

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const reconnect = () => {
    setOauthOpen(true);
  };

  const onConnected = () => {
    setOauthOpen(false);
    refresh();
  };

  const syncNow = async () => {
    if (!gdrive) return;
    try {
      const res = await fetch(`/api/sources/${gdrive.id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start sync");
      watchJob(gdrive.id);
    } catch (err) {
      toast({
        title: "Sync failed to start",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const disconnect = async () => {
    if (!gdrive) return;
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect" }),
    });
    if (res.ok) {
      toast({ title: "Google Drive disconnected", description: "Indexed content removed." });
      refresh();
    }
  };

  const simulateChange = async () => {
    if (!gdrive) return;
    try {
      const res = await fetch(`/api/sources/${gdrive.id}/simulate-change`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Simulation failed");
      toast({
        title: "Incoming Drive change indexed",
        description: `"${data.name}" is now searchable — try asking about parental leave.`,
      });
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't simulate change",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const uploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("visibility", uploadVisibility);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast({
        title: "Document indexed",
        description: `"${data.name}" ingested (${data.chunks} chunks) — ask away.`,
      });
      refresh();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="h-64 animate-pulse" />
        ))}
      </div>
    );
  }

  const totalFiles = sources.reduce((s, x) => s + x.fileCount, 0);
  const syncJob = syncingJob;

  return (
    <div className="space-y-6">
      {/* ingestion pipeline strip */}
      <Card className="border-dashed bg-muted/20">
        <CardContent className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4">
          {[
            { icon: HardDrive, label: "Google Drive", sub: "OAuth pull" },
            { icon: Scissors, label: "Chunk", sub: "sections ~700 chars" },
            { icon: Braces, label: "Embed", sub: `${totalChunks} vectors` },
            { icon: ShieldCheck, label: "Permission filter", sub: "before LLM context" },
            { icon: MessageSquareQuote, label: "Cited answer", sub: "or “no confident answer”" },
          ].map((s, i) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card">
                  <s.icon className="h-4.5 w-4.5 text-primary" />
                </span>
                <div>
                  <p className="text-xs font-semibold leading-none">{s.label}</p>
                  <p className="mt-1 text-[11px] leading-none text-muted-foreground">{s.sub}</p>
                </div>
              </div>
              {i < 4 && <span className="hidden text-muted-foreground/50 sm:inline">→</span>}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Google Drive connector */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border bg-card">
                  <HardDrive className="h-5.5 w-5.5 text-primary" />
                </span>
                <div>
                  <CardTitle className="text-base">Google Drive</CardTitle>
                  <CardDescription>
                    {gdrive ? "Connected · permission-aware indexing" : "Not connected"}
                  </CardDescription>
                </div>
              </div>
              {gdrive && (
                <Badge
                  variant={gdrive.status === "SYNCING" ? "secondary" : "outline"}
                  className="gap-1.5 capitalize"
                >
                  {gdrive.status === "SYNCING" ? (
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  ) : (
                    <CircleCheck className="h-3 w-3 text-primary" />
                  )}
                  {gdrive.status.toLowerCase()}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            {!gdrive ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-10 text-center">
                <CloudUpload className="h-8 w-8 text-muted-foreground/60" />
                <div>
                  <p className="text-sm font-medium">Connect your firm&apos;s shared Drive</p>
                  <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                    Read-only OAuth. TeamBrain indexes only files each user could already open.
                  </p>
                </div>
                <Button onClick={reconnect} className="gap-2">
                  <HardDrive className="h-4 w-4" />
                  Connect Google Drive
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Account</p>
                    <p className="mt-0.5 truncate text-xs font-medium">{gdrive.accountEmail}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last sync</p>
                    <p className="mt-0.5 text-xs font-medium">
                      {gdrive.lastSyncedAt
                        ? `${formatDistanceToNow(new Date(gdrive.lastSyncedAt))} ago`
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Files indexed</p>
                    <p className="mt-0.5 text-xs font-medium">{gdrive.fileCount}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Auto re-index</p>
                    <p className="mt-0.5 text-xs font-medium">every {gdrive.autoSyncMinutes} min</p>
                  </div>
                </div>

                {syncJob && syncJob.status === "RUNNING" && (
                  <div className="space-y-2 rounded-lg border bg-primary/[0.04] p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        Syncing — {syncJob.filesProcessed} files · {syncJob.chunksIndexed} chunks
                      </span>
                    </div>
                    <Progress
                      value={Math.min(95, syncJob.filesProcessed * 6 + 8)}
                      className="h-1.5"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={syncNow} disabled={syncJob?.status === "RUNNING"} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Re-sync now
                  </Button>
                  <Button size="sm" variant="outline" onClick={simulateChange} className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Simulate incoming Drive file
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
                        <Unplug className="h-3.5 w-3.5" />
                        Disconnect
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
                        <AlertDialogDescription>
                          All indexed files, chunks, and citations from this source will be removed.
                          Chat history stays, but sources stop resolving.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep connected</AlertDialogCancel>
                        <AlertDialogAction onClick={disconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {/* recent sync jobs */}
                {gdrive.recentJobs.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Sync history
                    </p>
                    <div className="max-h-36 space-y-1.5 overflow-y-auto tb-scroll pr-1">
                      {gdrive.recentJobs.slice(0, 5).map((j) => (
                        <div
                          key={j.id}
                          className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Badge variant="outline" className="h-4 px-1.5 text-[9px] uppercase">
                              {j.trigger.toLowerCase()}
                            </Badge>
                            <span className="truncate text-muted-foreground">
                              {j.message ?? j.status.toLowerCase()}
                            </span>
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {formatDistanceToNow(new Date(j.startedAt), { addSuffix: false })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* manual upload */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border bg-card">
                <Upload className="h-5.5 w-5.5 text-primary" />
              </span>
              <div>
                <CardTitle className="text-base">Manual document upload</CardTitle>
                <CardDescription>
                  {uploadSource
                    ? `${uploadSource.fileCount} file${uploadSource.fileCount === 1 ? "" : "s"} uploaded`
                    : "Drop a text document straight into the index"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload a document"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                uploadFiles(e.dataTransfer.files);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                dragOver ? "border-primary bg-accent" : "hover:border-primary/50 hover:bg-accent/40"
              }`}
            >
              {uploading ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : (
                <CloudUpload className="h-7 w-7 text-muted-foreground/70" />
              )}
              <p className="text-sm font-medium">
                {uploading ? "Ingesting…" : "Drop a file here or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground">
                .txt, .md, .csv, .json — text-extractable, up to 2 MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.csv,.json,.text,text/*"
                className="sr-only"
                onChange={(e) => uploadFiles(e.target.files)}
              />
            </div>

            <RadioGroup
              value={uploadVisibility}
              onValueChange={(v) => setUploadVisibility(v as "RESTRICTED" | "EVERYONE")}
              className="grid grid-cols-2 gap-2"
            >
              <Label
                htmlFor="vis-restricted"
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 font-normal"
              >
                <RadioGroupItem value="RESTRICTED" id="vis-restricted" className="mt-0.5" />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Lock className="h-3.5 w-3.5" /> Just me
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Only you can search this document
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="vis-everyone"
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 font-normal"
              >
                <RadioGroupItem value="EVERYONE" id="vis-everyone" className="mt-0.5" />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Globe className="h-3.5 w-3.5" /> Everyone at the firm
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Searchable by the whole team
                  </span>
                </span>
              </Label>
            </RadioGroup>

            {uploadSource && uploadSource.fileCount > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Uploaded documents
                </p>
                <div className="max-h-32 space-y-1.5 overflow-y-auto tb-scroll pr-1">
                  {files
                    .filter((f) => f.sourceId === uploadSource.id)
                    .map((f) => (
                      <button
                        key={f.id}
                        onClick={() => f.canAccess && onOpenFile(f.id, f.name)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-left text-xs hover:border-primary/40"
                      >
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="truncate font-medium">{f.name}</span>
                        </span>
                        <span className="shrink-0 text-muted-foreground">{f.chunkCount} chunks</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* indexed files browser */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border bg-card">
                <FileStack className="h-5.5 w-5.5 text-primary" />
              </span>
              <div>
                <CardTitle className="text-base">Indexed files</CardTitle>
                <CardDescription>
                  {totalFiles} files · {totalChunks} chunks · access resolved per teammate
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-0">
          <div className="max-h-96 overflow-y-auto tb-scroll">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[220px]">File</TableHead>
                  <TableHead className="hidden md:table-cell">Owner</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Chunks</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Modified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f, i) => (
                  <motion.tr
                    key={f.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.015, 0.3) }}
                    onClick={() => f.canAccess && onOpenFile(f.id, f.name)}
                    className={`cursor-pointer border-b border-border/60 ${
                      f.canAccess ? "hover:bg-accent/50" : "opacity-60"
                    }`}
                  >
                    <TableCell className="max-w-[260px] py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-primary/70" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{f.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{f.path}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="truncate text-xs text-muted-foreground">{f.ownerEmail.split("@")[0]}</p>
                    </TableCell>
                    <TableCell>
                      {f.canAccess ? (
                        <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                          <CircleCheck className="h-3 w-3 text-primary" />
                          {f.accessReason}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-[10px] font-normal text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          {f.visibility === "RESTRICTED" ? "No access" : f.accessReason}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right text-xs text-muted-foreground">
                      {f.chunkCount}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(f.modifiedAt), { addSuffix: false })}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <OAuthDialog
        open={oauthOpen}
        onOpenChange={setOauthOpen}
        accountEmail={OAUTH_ACCOUNT}
        scopes={OAUTH_SCOPES}
        onConnected={onConnected}
      />
    </div>
  );
}
