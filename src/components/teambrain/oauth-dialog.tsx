"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, ShieldCheck, HardDrive, Loader2, CircleCheck, Database, Zap } from "lucide-react";
import type { SyncJobInfo } from "@/types/teambrain";

interface OAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountEmail: string;
  scopes: string[];
  onConnected: (sourceId: string) => void;
}

type Step = "account" | "consent" | "connecting" | "done";

/** Simulated Google OAuth consent — mirrors the real flow and scopes
 * (drive.readonly + metadata only, so the connector can never see files
 * the authorizing account can't already open). */
export function OAuthDialog({ open, onOpenChange, accountEmail, scopes, onConnected }: OAuthDialogProps) {
  const [step, setStep] = useState<Step>("account");
  const [job, setJob] = useState<SyncJobInfo | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) {
      setStep("account");
      setJob(null);
      setSourceId(null);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open]);

  const allow = async () => {
    setStep("connecting");
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Connection failed");
      setSourceId(data.sourceId);
      pollRef.current = setInterval(async () => {
        const statusRes = await fetch(`/api/sources/${data.sourceId}/sync`);
        if (!statusRes.ok) return;
        const status = await statusRes.json();
        if (status.job) setJob(status.job as SyncJobInfo);
        if (status.job?.status === "COMPLETED" || status.job?.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStep("done");
          onConnected(data.sourceId);
        }
      }, 700);
    } catch {
      setStep("consent");
    }
  };

  const initials = accountEmail.slice(0, 2).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(o) => !["connecting"].includes(step) && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        {step === "account" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary" />
                Sign in with Google
              </DialogTitle>
              <DialogDescription>Choose an account to connect Google Drive.</DialogDescription>
            </DialogHeader>
            <p className="text-[11px] text-muted-foreground">
              Simulated consent screen — no real Google account is accessed.
            </p>
            <button
              onClick={() => setStep("consent")}
              className="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Avatar className="h-10 w-10 border">
                <AvatarFallback className="bg-secondary font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{accountEmail}</p>
                <p className="text-xs text-muted-foreground">Workspace admin account</p>
              </div>
            </button>
          </>
        )}

        {step === "consent" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                TeamBrain wants additional access
              </DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">TeamBrain (INEHA TECH)</span> wants to
                index your firm&apos;s Drive:
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2.5 rounded-xl border bg-muted/30 p-4">
              {scopes.map((s) => {
                const [scope, ...rest] = s.split(" — ");
                return (
                  <li key={scope} className="flex items-start gap-2.5 text-sm">
                    <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-mono text-xs text-foreground">{scope}</p>
                      <p className="text-xs text-muted-foreground">{rest.join(" — ")}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="rounded-lg border border-primary/25 bg-primary/[0.05] p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Read-only, permission-preserving:</span>{" "}
              TeamBrain can only ever surface a file to someone who could already open it in Drive.
              It never writes, shares, or exposes restricted files.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={allow}>Allow</Button>
            </div>
          </>
        )}

        {step === "connecting" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Indexing your Drive…
              </DialogTitle>
              <DialogDescription>
                Pulling files, chunking, embedding, and mapping permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Progress
                value={job ? Math.min(100, (job.filesProcessed / Math.max(1, job.filesProcessed + 3)) * 100) : 8}
                className="h-2"
              />
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border p-2.5">
                  <Database className="mx-auto mb-1 h-4 w-4 text-primary" />
                  <p className="font-semibold">{job?.filesProcessed ?? 0}</p>
                  <p className="text-muted-foreground">files</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <Zap className="mx-auto mb-1 h-4 w-4 text-primary" />
                  <p className="font-semibold">{job?.chunksIndexed ?? 0}</p>
                  <p className="text-muted-foreground">chunks</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <ShieldCheck className="mx-auto mb-1 h-4 w-4 text-primary" />
                  <p className="font-semibold">100%</p>
                  <p className="text-muted-foreground">perm. map</p>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Permission-aware indexing keeps each user&apos;s results inside their existing Drive
                access.
              </p>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-4.5 w-4.5 text-primary" />
                </span>
                Google Drive connected
              </DialogTitle>
              <DialogDescription>
                {job?.filesProcessed ?? 0} files indexed · {job?.chunksIndexed ?? 0} chunks embedded.
                Your team can start asking questions.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => onOpenChange(false)}>Start asking</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
