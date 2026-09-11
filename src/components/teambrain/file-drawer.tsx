"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileText, Lock, ShieldAlert, HardDrive, User } from "lucide-react";
import type { Citation, FileDetail } from "@/types/teambrain";

interface FileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string | null;
  fileName?: string;
}

export function FileDrawer({ open, onOpenChange, fileId, fileName }: FileDrawerProps) {
  const [file, setFile] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !fileId) return;
    let cancelled = false;
    // reset via microtask so nothing setState's synchronously inside the effect body
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
        setFile(null);
      }
    });
    fetch(`/api/files/${fileId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't open this file");
        return data.file as FileDetail;
      })
      .then((f) => {
        if (!cancelled) {
          setFile(f);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't open this file");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, fileId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col" side="right">
        <SheetHeader className="p-5 pb-3 border-b">
          <SheetTitle className="flex items-start gap-2.5 pr-6 text-base leading-snug">
            <FileText className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" />
            <span>{file?.name ?? fileName ?? "Source document"}</span>
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {file && (
              <>
                <span className="inline-flex items-center gap-1">
                  <HardDrive className="h-3 w-3" /> Google Drive
                </span>
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" /> {file.ownerEmail}
                </span>
                <span>{new Date(file.modifiedAt).toLocaleDateString()} · {file.sizeKb.toFixed(1)} KB</span>
              </>
            )}
          </SheetDescription>
          {file && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant={file.visibility === "EVERYONE" ? "secondary" : "outline"} className="text-[11px] gap-1">
                {file.visibility === "EVERYONE" ? (
                  <>
                    <Lock className="h-3 w-3 text-primary" /> Shared firm-wide
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3" /> Restricted
                  </>
                )}
              </Badge>
              {file.sharedWith
                .split(",")
                .filter(Boolean)
                .map((email) => (
                  <Badge key={email} variant="outline" className="text-[11px] font-normal">
                    shared with {email}
                  </Badge>
                ))}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="space-y-4 p-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-[85%]" />
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="p-5">
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access denied</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}
          {file && !loading && (
            <ScrollArea className="h-full tb-scroll">
              <div className="space-y-4 p-5">
                <p className="font-mono text-[11px] text-muted-foreground">{file.path}</p>
                <Separator />
                {file.chunks.map((c) => (
                  <section
                    key={c.idx}
                    className="rounded-lg border bg-muted/30 p-4"
                    aria-label={`Section ${c.section}`}
                  >
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px]">chunk {c.idx + 1}</span>
                      {c.section}
                    </h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {c.content}
                    </p>
                  </section>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Convenience: open a drawer from a citation object. */
export function citationToFileId(c: Citation): string {
  return c.fileId;
}
