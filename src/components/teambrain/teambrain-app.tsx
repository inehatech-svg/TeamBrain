"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrainCircuit, MessageSquare, Database, BarChart3, Sun, Moon, LogOut, ArrowRightLeft, ShieldCheck } from "lucide-react";
import type { SessionUser } from "@/types/teambrain";
import { LoginScreen } from "./login-screen";
import { ChatView } from "./chat-view";
import { SourcesView } from "./sources-view";
import { InsightsView } from "./insights-view";
import { FileDrawer } from "./file-drawer";
import { useToast } from "@/hooks/use-toast";

type View = "chat" | "sources" | "insights";

export function TeamBrainApp() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [workspace, setWorkspace] = useState("Whitfield & Associates LLP");
  const [directory, setDirectory] = useState<SessionUser[]>([]);
  const [view, setView] = useState<View>("chat");
  const [drawerFile, setDrawerFile] = useState<{ id: string; name?: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ])
      .then(([me, dir]) => {
        if (me.user) setUser(me.user as SessionUser);
        if (dir.workspace) setWorkspace(dir.workspace as string);
        if (Array.isArray(dir.users)) setDirectory(dir.users as SessionUser[]);
      })
      .finally(() => setBooting(false));
  }, []);

  const switchUser = useCallback(
    async (target: SessionUser) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target.email }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user as SessionUser);
        setView("chat");
        toast({ title: `Now signed in as ${data.user.name}`, description: data.user.title });
      }
    },
    [toast]
  );

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setView("chat");
  };

  const openFile = useCallback((fileId: string, fileName?: string) => {
    setDrawerFile({ id: fileId, name: fileName });
  }, []);

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border bg-white p-1.5">
            <img src="/ineha-logo.png" alt="INEHA TECH" className="h-full w-full object-contain" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex gap-1" aria-hidden>
              <span className="tb-dot h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="tb-dot h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="tb-dot h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Waking up TeamBrain…
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen workspace={workspace} users={directory} onLogin={(u) => setUser(u)} />;
  }

  const isAdmin = user.role === "ADMIN";
  const tabs: { id: View; label: string; icon: typeof MessageSquare; adminOnly?: boolean }[] = [
    { id: "chat", label: "Ask TeamBrain", icon: MessageSquare },
    { id: "sources", label: "Sources", icon: Database, adminOnly: true },
    { id: "insights", label: "Insights", icon: BarChart3, adminOnly: true },
  ];
  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);
  const others = directory.filter((d) => d.email !== user.email);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          {/* brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border bg-white p-0.5 shadow-sm">
              <img src="/ineha-logo.png" alt="INEHA TECH logo" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold tracking-tight">TeamBrain</p>
              <p className="text-[10px] text-muted-foreground">by INEHA TECH · {workspace}</p>
            </div>
          </div>

          {/* desktop nav */}
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Primary">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                aria-current={view === t.id ? "page" : undefined}
                className={`inline-flex h-11 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors ${
                  view === t.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-11 gap-2.5 px-2.5 sm:px-3">
                  <Avatar className="h-8 w-8 border">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">
                    {user.name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <p>{user.name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user.title}</p>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs font-normal text-muted-foreground">
                    <ShieldCheck className="h-3 w-3 text-primary" />
                    Results limited to your Drive permissions
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Switch teammate (demo)
                </DropdownMenuLabel>
                {others.map((o) => (
                  <DropdownMenuItem key={o.id} onClick={() => switchUser(o)} className="gap-2.5 py-2">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-primary/70" />
                    <span className="font-medium">{o.name}</span>
                    <span className="ml-auto truncate text-[10px] text-muted-foreground">{o.title.split(" (")[0]}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="gap-2 py-2">
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* mobile nav */}
        <nav className="flex items-center gap-1 border-t px-3 py-1.5 md:hidden" aria-label="Primary mobile">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              aria-current={view === t.id ? "page" : undefined}
              className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                view === t.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label.replace("Ask TeamBrain", "Ask")}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {view === "chat" && <ChatView user={user} onOpenFile={openFile} />}
            {view === "sources" && isAdmin && <SourcesView onOpenFile={openFile} />}
            {view === "insights" && isAdmin && <InsightsView />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mt-auto border-t bg-muted/30 px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-center text-[11px] text-muted-foreground sm:flex-row sm:text-left">
          <p className="inline-flex items-center gap-1.5">
            <BrainCircuit className="h-3.5 w-3.5 text-primary/70" />
            <span>
              TeamBrain · an <span className="font-medium text-foreground/70">INEHA TECH</span> product ·
              permission-aware knowledge copilot
            </span>
          </p>
          <p>
            Demo workspace: simulated Google Drive · TF-IDF hybrid retrieval (production: pgvector RAG)
          </p>
        </div>
      </footer>

      <FileDrawer
        open={drawerFile !== null}
        onOpenChange={(o) => !o && setDrawerFile(null)}
        fileId={drawerFile?.id ?? null}
        fileName={drawerFile?.name}
      />
    </div>
  );
}
