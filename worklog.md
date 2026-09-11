# TeamBrain — Build Worklog

Project: TeamBrain MVP — permission-aware AI knowledge copilot for small professional-services firms (5–50 people).
Brand: INEHA TECH (logo: white bg, silver/dark-grey metallic dragon, cyan accents).
Stack: Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui + Prisma (SQLite) + z-ai-web-dev-sdk (LLM, backend only).

Scope decisions (from build prompt):
- Single source integration: Google Drive — implemented as a **simulated** OAuth connector + simulated Drive workspace (sandbox has no real Google credentials). Manual document upload is real.
- Permission enforcement is the #1 correctness requirement: retrieved chunks are filtered by the requesting user's Drive access BEFORE scoring and BEFORE reaching the LLM context. Ambiguous cases under-surface.
- Vector index: SQLite in this sandbox (pgvector not available) — embeddings stored as JSON term-vectors, hybrid TF-IDF cosine + BM25 retrieval computed server-side. Labeled as demo pipeline in UI.
- Answer synthesis: z-ai-web-dev-sdk chat completions with citation markers [n] mapped back to source files; "I couldn't find a confident answer" fallback (retrieval-threshold pre-check + LLM post-check).
- Background re-index: in-process scheduler (interval) + manual "Re-sync now" with live progress polling.
- NOT in scope (per prompt): Slack/Teams bots, write-back/drafting, additional connectors.

Task/agent plan:
- Task 0..7 executed directly by the main agent (integration coherence for a single-route app; subagent handoff overhead > benefit). Identified as subagent-eligible but not delegated: Task 4 (frontend-styling-expert), Task 6 (general-purpose browser verification) — main agent handles both to keep API/UI contract tight.

---
Task ID: 0
Agent: main (Z.ai Code)
Task: Initialize worklog, analyze environment, inspect logo, load LLM/VLM skills.

Work Log:
- Explored project scaffold: Next.js 16 + Turbopack dev server running on :3000, full shadcn/ui set present, Prisma+SQLite configured (db/custom.db), z-ai-web-dev-sdk installed.
- Loaded LLM skill (SDK usage: ZAI.create() → chat.completions.create, thinking disabled, assistant role for system prompt, backend only).
- Loaded VLM skill; analyzed uploaded logo (upload/INEHA TECH NEW LOGO.png → public/ineha-logo.png): white background, silver/dark-grey dragon, cyan accents, "INEHA TECH" text. Theme chosen: slate neutrals + teal/cyan accents.
- Planned data model, retrieval pipeline, permission engine, API surface, and single-page frontend.

Stage Summary:
- Environment understood; logo integrated at public/ineha-logo.png; build plan fixed (Tasks 1–6 below); no code written yet beyond scaffold.

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Prisma schema + seed for the simulated permission-aware Google Drive workspace.

Work Log:
- Defined schema (prisma/schema.prisma): User, Source (GDRIVE/UPLOAD), DriveFile (ownerEmail, visibility EVERYONE/RESTRICTED, sharedWith CSV), Chunk (embedding JSON), QueryLog, ChatMessage, SyncJob. Pushed with `bun run db:push`.
- src/lib/teambrain/workspace.ts: 3 demo users (Alice=admin/partner, Bob=associate, Carol=new-hire paralegal) + 16 rich law-firm Drive files (policies, playbooks, templates, client matters incl. partner-privileged Acme files, Bob-restricted Johnson/Meridian files) + SIMULATED_INCOMING_FILE (Paid Parental Leave Policy — closes the demo doc-gap).
- scripts/seed.ts reuses the real chunker/embedding pipeline; seeds 15 usage-log entries incl. permission-filtered misses and true doc gaps.

Stage Summary:
- DB live at db/custom.db; 16 files / 75 chunks / 3 users / 15 usage logs. Fixed a seed timestamp-sign bug that created future-dated SyncJob/lastSyncedAt rows (shadowed live sync polling).

---
Task ID: 2
Agent: main (Z.ai Code)
Task: Core backend libraries (retrieval, permissions, LLM, sync, scheduler, session).

Work Log:
- text.ts: tokenizer + stemmer + stopwords + query-time synonym expansion; buildEmbedding stores sublinear TF sparse vectors (cosine normalizes defensively; BM25 inverts tf=exp(w-1) exactly).
- chunker.ts: "## Section" heading-aware chunks ~700 chars.
- permissions.ts: userCanAccessFile (owner / EVERYONE / sharedWith) — app ADMIN role never grants content access; under-surface on ambiguity.
- retrieval.ts: loads chunks → PERMISSION FILTER FIRST (counts topically-relevant excluded chunks) → hybrid score (0.4 TF cosine + 0.5 BM25 + 0.25 title boost) → confidence gate 0.16, top-5.
- llm.ts: z-ai-web-dev-sdk (backend only, thinking disabled); strict system prompt: answer only from numbered excerpts, inline [n] citations, verbatim "I couldn't find a confident answer to that" fallback.
- sync.ts: startSyncJob fire-and-forget with DB-persisted progress (OAUTH_CONNECT/MANUAL/SCHEDULED/UPLOAD triggers), stale-file removal, overlap guard; simulateIncomingDriveFile demo tool.
- scheduler.ts: global-singleton 60s tick; auto re-index when lastSyncedAt older than source.autoSyncMinutes.
- session.ts: httpOnly cookie sessions.

Stage Summary:
- Full RAG pipeline where permission enforcement happens before scoring and before any LLM context — the #1 correctness requirement.

---
Task ID: 3
Agent: main (Z.ai Code)
Task: API routes.

Work Log:
- /api/auth/login|logout|me (me also boots the scheduler), /api/users (login directory).
- /api/chat: POST = retrieve → gate → synthesize → persist ChatMessage + QueryLog; GET history; DELETE thread. Returns citations in excerpt order with `cited` flags so [n] markers map 1:1.
- /api/sources GET/POST (connect/disconnect, admin-only), /api/sources/[id]/sync POST+GET (trigger + progress polling), /api/sources/[id]/simulate-change (demo tool).
- /api/files (admin, access-annotated), /api/files/[id] (permission-checked, 403 on denial).
- /api/upload: text extraction guard, UPLOAD source, uploader-owned visibility choice (JUST ME / EVERYONE).
- /api/insights: KPIs, top queries, doc gaps (perm-filtered vs true gap), per-user, recent feed, sync history.

Stage Summary:
- 11 route files; all verified via curl (auth, cited answer, NOT_FOUND with excluded-chunk signal, 403 file guard, upload, insights, sync, gap-closing arc).

---
Task ID: 4
Agent: main (Z.ai Code)
Task: Frontend (single route /).

Work Log:
- globals.css: teal/slate shadcn theme (matches INEHA TECH logo cyan accents; no indigo/blue), custom scrollbars, .tb-cite citation chips, thinking-dot animation.
- layout.tsx: metadata, next-themes ThemeProvider (light/dark), Toaster; public/ineha-logo.png copied from upload.
- Login screen: workspace picker with per-user Drive-access hints.
- Chat view: permission banner, empty-state suggestions per role, thinking steps animation, AnswerRenderer ([n] chips clickable → FileDrawer, bold, lists), source chips, confidence/latency meta, distinct NOT_FOUND card with "N restricted chunks exist" notice.
- FileDrawer (Sheet): chunk-by-chunk source view with sharing metadata.
- Sources view: pipeline strip, Drive connector card (OAuth dialog sim: account → consent → live indexing progress → done), re-sync progress, sync history, manual upload dropzone with visibility radio, indexed-file table with per-file access badges.
- Insights view: 5 KPI cards, top-queries bars, documentation gaps (perms vs gap badges), team usage table, recent queries, sync history.
- App shell: sticky header + tabs (admin-only gating), theme toggle, teammate switcher, sticky footer (min-h-screen flex + mt-auto + safe-area), mobile nav row, Framer Motion transitions.
- Fixed: chat history now reloads on user switch (user.id effect dep).

Stage Summary:
- Single-page app on / with all MVP features; responsive; light/dark.

---
Task ID: 5
Agent: main (Z.ai Code)
Task: Lint + dev.log verification.

Work Log:
- Fixed lint errors: setState-in-effect in FileDrawer (microtask reset), unused imports/props, border class risk.
- bun run lint → clean. dev.log → no runtime errors (only prisma query logs).

Stage Summary:
- Zero lint errors, zero dev.log errors.

---
Task ID: 6
Agent: main (Z.ai Code)
Task: Agent-browser E2E verification + fixes.

Work Log:
- Login as Alice → suggestion chip "Acme purchase price & escrow" → confident ANSWER with [1][2] inline citation chips, source chips, 99% confidence; citation click opens source drawer with all 6 chunks.
- Switched to Carol (nav correctly hides admin tabs): same Acme question → "I couldn't find a confident answer" + "5 potentially relevant chunks restricted to other teammates" notice, 0.5s, LLM skipped; allowed question (mileage) → cited answer.
- Sources (Alice): pipeline strip, connector card stats, Re-sync now → progress + completion toast; Simulate incoming Drive file → new file in browser; manual upload (travel.txt) → indexed, 2 chunks, searchable by others when EVERYONE; OAuth lifecycle: disconnect → connect → account → consent (scopes) → live indexing progress → connected.
- Insights: KPIs, top queries, gaps with perms/gap badges all render.
- Gap-closing arc re-verified in browser: NOT_FOUND → simulate → cited ANSWER from Paid Parental Leave Policy.
- Dark mode toggle + screenshots; VLM visual QA on chat/insights/dark screenshots: clean, no glitches.
- Mobile 375×812: mobile nav renders; footer verified both ways (short content → pinned to viewport bottom via JS probe atViewportBottom=true; long content → pushed down naturally).
- Fixed bug found during verification: chat history now reloads when switching teammates.
- Zero browser console/page errors. Re-seeded to pristine demo state after testing.

Stage Summary:
- Every core flow browser-verified end-to-end: login, cited answers, permission enforcement (the money feature), OAuth connect, sync, upload, insights, theme, responsiveness, sticky footer.

---
Task ID: 7
Agent: main (Z.ai Code)
Task: Final worklog + user report.

Work Log:
- Appended this section; final smoke test GET / → 200; demo re-seeded (16 files / 75 chunks / 3 users / 15 usage logs).

Stage Summary:
- TeamBrain MVP complete and browser-verified. Demo login: alice@whitfield.legal (admin, sees everything), bob@whitfield.legal (associate), carol@whitfield.legal (new hire — watch permission filtering).
