"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Loader2, ShieldCheck, FileSearch, Quote, BrainCircuit } from "lucide-react";
import type { SessionUser } from "@/types/teambrain";
import { useToast } from "@/hooks/use-toast";

interface LoginScreenProps {
  workspace: string;
  users: SessionUser[];
  onLogin: (user: SessionUser) => void;
}

const ROLE_HINTS: Record<string, string> = {
  ADMIN: "Admin · manages sources & insights",
  MEMBER: "Member · asks questions",
};

const ROLE_ACCESS: Record<string, string> = {
  "alice@whitfield.legal": "Full Drive access — sees everything, incl. privileged matters",
  "bob@whitfield.legal": "Standard access — team docs, no partner-privileged files",
  "carol@whitfield.legal": "New hire — firm-wide docs only, no client matters yet",
};

export function LoginScreen({ workspace, users, onLogin }: LoginScreenProps) {
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const login = async (user: SessionUser) => {
    setPending(user.email);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      onLogin(data.user as SessionUser);
    } catch (err) {
      toast({
        title: "Sign-in failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
      setPending(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-secondary/60 via-background to-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-lg"
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border bg-white p-1 shadow-sm">
              <img src="/ineha-logo.png" alt="INEHA TECH logo" className="h-full w-full object-contain" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">TeamBrain</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              by INEHA TECH · your firm&apos;s knowledge, one question away
            </p>
          </div>

          <Card className="border-border/80 shadow-lg shadow-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">Sign in to {workspace}</CardTitle>
              <CardDescription>
                Demo workspace — pick a teammate to see how answers adapt to each person&apos;s Drive
                permissions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => login(u)}
                  disabled={pending !== null}
                  className="group flex w-full items-center gap-4 rounded-xl border border-border/70 bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
                >
                  <Avatar className="h-11 w-11 border">
                    <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                      {u.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{u.name}</p>
                      {u.role === "ADMIN" && (
                        <Badge variant="secondary" className="shrink-0 text-[11px]">
                          Admin
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{u.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground/80">
                      {ROLE_ACCESS[u.email] ?? ROLE_HINTS[u.role]}
                    </p>
                  </div>
                  <div className="shrink-0 text-primary/60 transition-transform group-hover:translate-x-0.5">
                    {pending === u.email ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <span aria-hidden>→</span>
                    )}
                  </div>
                </button>
              ))}

              <Separator className="my-2" />

              <div className="grid gap-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>Answers only surface documents the asker can already open in Drive.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>Every claim carries a citation back to the source document.</span>
                </div>
                <div className="flex items-start gap-2">
                  <FileSearch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>If the answer isn&apos;t in your docs, TeamBrain says so — no guessing.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <BrainCircuit className="h-3.5 w-3.5" />
            Demo workspace with a simulated Google Drive source — no real Google account is accessed.
          </p>
        </motion.div>
      </main>

      <footer className="border-t bg-background/60 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
        TeamBrain · an INEHA TECH product · internal knowledge copilot for small professional-services firms
      </footer>
    </div>
  );
}
