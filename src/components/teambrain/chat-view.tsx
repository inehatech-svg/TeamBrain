"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Send,
  ShieldCheck,
  Sparkles,
  FileText,
  SearchX,
  RotateCcw,
  Loader2,
  Lock,
  BrainCircuit,
  Gauge,
  BookOpen,
} from "lucide-react";
import type { Citation, ChatResponse, SessionUser, StoredChatMessage } from "@/types/teambrain";
import { AnswerRenderer } from "./answer-renderer";
import { useToast } from "@/hooks/use-toast";

interface ChatViewProps {
  user: SessionUser;
  onOpenFile: (fileId: string, fileName?: string) => void;
}

interface ParsedMessage extends Omit<StoredChatMessage, "citations"> {
  citations: Citation[];
}

const SUGGESTIONS: Record<string, string[]> = {
  "alice@whitfield.legal": [
    "What was the purchase price and escrow in the Acme Corp acquisition?",
    "What are the distribution terms for the Johnson Family Trust?",
    "What is the approval threshold for expenses?",
  ],
  "bob@whitfield.legal": [
    "What's our response deadline for a federal motion?",
    "What are the distribution terms for the Johnson Family Trust?",
    "What is the Meridian Health response SLA?",
  ],
  default: [
    "How do we usually handle client meal expenses?",
    "What's our parental leave policy?",
    "What are the distribution terms for the Johnson Family Trust?",
  ],
};

const THINKING_STEPS = [
  { icon: ShieldCheck, label: "Checking your Drive permissions…" },
  { icon: SearchX, label: "Retrieving relevant chunks…" },
  { icon: BrainCircuit, label: "Synthesizing a cited answer…" },
];

function parseMessage(m: StoredChatMessage): ParsedMessage {
  let citations: Citation[] = [];
  try {
    citations = JSON.parse(m.citations || "[]") as Citation[];
  } catch {
    citations = [];
  }
  const { citations: _c, ...rest } = m;
  return { ...rest, citations };
}

export function ChatView({ user, onOpenFile }: ChatViewProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      if (res.ok) {
        setMessages((data.messages as StoredChatMessage[]).map(parseMessage));
      }
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, user.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    if (!sending) return;
    const interval = setInterval(() => {
      setThinkingStep((s) => (s + 1) % THINKING_STEPS.length);
    }, 1300);
    return () => clearInterval(interval);
  }, [sending]);

  const send = async (raw?: string) => {
    const query = (raw ?? input).trim();
    if (!query || sending) return;
    setSending(true);
    setThinkingStep(0);
    setInput("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "TeamBrain couldn't answer that");
      const response = data as ChatResponse;
      setMessages((prev) => [...prev, ...response.messages.map(parseMessage)]);
    } catch (err) {
      toast({
        title: "Question failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
      setInput(query);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const newThread = async () => {
    await fetch("/api/chat", { method: "DELETE" });
    setMessages([]);
  };

  const suggestions = SUGGESTIONS[user.email] ?? SUGGESTIONS.default;
  const empty = messages.length === 0 && !loadingHistory;

  return (
    <div className="flex flex-col gap-4">
      {/* permission-awareness banner */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-2.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
        <span>
          Answers respect your Google Drive permissions — you only ever see sources{" "}
          <span className="font-medium text-foreground">you can already open</span>.
        </span>
      </div>

      <Card className="flex min-h-[60vh] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            {loadingHistory ? "Loading thread…" : `Thread · ${messages.length} message${messages.length === 1 ? "" : "s"}`}
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={newThread} className="h-8 gap-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" />
              New thread
            </Button>
          )}
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4 tb-scroll max-h-[58vh] sm:max-h-[62vh]">
          {loadingHistory && (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {empty && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-8 text-center"
            >
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <BrainCircuit className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Ask about your firm&apos;s knowledge, {user.name.split(" ")[0]}</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Templates, policies, past client answers, playbooks — sourced from the connected
                Google Drive with citations back to the document.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {suggestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full border border-border/70 bg-card px-3.5 py-2 text-xs text-foreground/90 transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-end gap-3"
              >
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
                  {m.content}
                </div>
                <Avatar className="h-8 w-8 border shrink-0">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
            ) : (
              <AssistantMessage key={m.id} message={m} onOpenFile={onOpenFile} />
            )
          )}

          {sending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="rounded-2xl rounded-tl-md border bg-card px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex gap-1" aria-hidden>
                    <span className="tb-dot h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="tb-dot h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="tb-dot h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={thinkingStep}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center gap-1.5"
                    >
                      {(() => {
                        const Step = THINKING_STEPS[thinkingStep].icon;
                        return <Step className="h-3.5 w-3.5 text-primary/70" />;
                      })()}
                      {THINKING_STEPS[thinkingStep].label}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* composer */}
        <div className="border-t bg-muted/30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Ask anything — “How do we usually handle X?”"
              aria-label="Ask TeamBrain a question"
              className="max-h-36 flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              disabled={sending}
              style={{ minHeight: "48px" }}
            />
            <Button
              onClick={() => send()}
              disabled={sending || input.trim().length === 0}
              size="icon"
              className="h-12 w-12 shrink-0 rounded-xl"
              aria-label="Send question"
            >
              {sending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
            </Button>
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            Enter to send · Shift+Enter for a new line · TeamBrain cites sources or admits when it
            can&apos;t find a confident answer.
          </p>
        </div>
      </Card>
    </div>
  );
}

function AssistantMessage({
  message,
  onOpenFile,
}: {
  message: ParsedMessage;
  onOpenFile: (fileId: string, fileName?: string) => void;
}) {
  const notFound = message.status !== "ANSWERED";
  const cited = message.citations.filter((c) => c.cited);
  const confidencePct = Math.round((message.confidence ?? 0) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-primary/10">
        <BrainCircuit className="h-4 w-4 text-primary" />
      </div>

      <div className="min-w-0 max-w-[88%] flex-1 space-y-3">
        {notFound ? (
          <div className="rounded-2xl rounded-tl-md border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3.5">
            <div className="flex items-start gap-2.5">
              <SearchX className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{message.content}</p>
                <p className="text-xs text-muted-foreground">
                  Rather than guess, TeamBrain only answers from indexed documents you can access.
                  This question was logged for admins as a potential documentation gap.
                </p>
                {message.excludedChunks > 0 && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-2.5 py-2 text-xs">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="text-foreground/80">
                      <span className="font-semibold">
                        {message.excludedChunks} potentially relevant chunk
                        {message.excludedChunks === 1 ? "" : "s"} exist
                      </span>{" "}
                      in Drive but are restricted to other teammates. If you need access, ask the file
                      owner to share it — TeamBrain will surface it on the next sync.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-md border bg-card px-4 py-3.5">
            <AnswerRenderer
              text={message.content}
              citations={message.citations}
              onCitationClick={(c) => onOpenFile(c.fileId, c.name)}
            />
          </div>
        )}

        {/* source chips */}
        {cited.length > 0 && (
          <div className="space-y-1.5">
            <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Sources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cited.map((c) => (
                <button
                  key={c.fileId + c.section}
                  onClick={() => onOpenFile(c.fileId, c.name)}
                  className="group inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-left text-xs transition-colors hover:border-primary/50 hover:bg-accent"
                  title={`${c.path} — ${c.section}`}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="hidden truncate text-muted-foreground sm:inline">· {c.section}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-muted-foreground">
          {notFound ? (
            <Badge variant="outline" className="gap-1 border-amber-500/40 text-[10px] text-amber-700 dark:text-amber-400">
              <SearchX className="h-3 w-3" /> no confident answer
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-primary/30 text-[10px] text-primary">
              <Sparkles className="h-3 w-3" /> cited answer
            </Badge>
          )}
          <span className="inline-flex items-center gap-1">
            <Gauge className="h-3 w-3" />
            {message.latencyMs ? `${(message.latencyMs / 1000).toFixed(1)}s` : "—"}
          </span>
          {message.status === "ANSWERED" && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help items-center gap-1">
                    confidence {confidencePct}%
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Retrieval confidence: similarity of the top matched chunks
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </motion.div>
  );
}
