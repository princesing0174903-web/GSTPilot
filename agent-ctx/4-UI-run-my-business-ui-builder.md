# Task 4-UI — GSTPilot Run My Business UI Engineer

## Task
REPLACE `src/components/run-my-business/RunMyBusinessPage.tsx` with the full 10-module Run My Business™ Operating System UI, matching the dark-theme visual language of `AICFODashboardPage.tsx`.

## Work Log
- Read `worklog.md` (Phase-3-AI-CFO section) and `src/components/ai-cfo/AICFODashboardPage.tsx` (1087 lines) to inherit the visual language: `accent-gradient`, `accent-gradient-soft`, `accent-text`, `hover-lift`, `custom-scrollbar` utility classes; `FadeIn` motion wrapper; `SectionHeader` with accent-gradient-soft icon tile; staggered animation delays; emerald/teal/amber/red status palette (NO indigo/blue); card chrome `border-white/[0.06] bg-card/60 backdrop-blur-sm`.
- Read `src/lib/rmb/types.ts` (338 lines) — imported ALL shared types and constants (`RmbState`, `RmbTask`, `BusinessAgent`, `AutopilotState`, `CommandCenter`, `CommandIntent`, `OrchestrationPlan`, `DailyCEOBrief`, `DelegationPlan`, `RmbMemory`, `RmbPersonality`, `TASK_STATUS_GLYPH`, `TASK_STATUS_LABEL`). NO type redefinitions.
- Read `src/lib/rmb/engine.ts` (1480 lines) — confirmed exported engine APIs and verified the four API routes (`/api/rmb`, `/api/rmb/command`, `/api/rmb/orchestrate`, `/api/rmb/delegate`) already exist with the correct shapes.
- Wrote the complete rewrite (1823 lines, `'use client'`) with all 10 modules rendered in a single scrollable page:
  1. **Header** — title + tagline + last-updated subtitle + Refresh / Run My Business Today / Ask Oracle buttons.
  2. **Module 7 — Daily CEO Brief** (hero): greeting + date + 4-metric grid (Revenue/Collections/Cash/GST) + risk-level row + numbered Priority Actions with agent assignment + amount.
  3. **Module 1 — Business Command Center**: 5 status metric cards + 6 section cards (Today's Tasks / Pending Returns / Collections / Notices / Reports / Team Tasks) — each with emoji + count badge + ScrollArea list + CTA button calling `setCurrentView(ctaView)`.
  4. **Module 2 — Natural Language Commands**: Textarea + Send + 8 quick-command chips → POST `/api/rmb/command` → intent badge + confidence badge + Oracle spokenAck tile + generated task plan (reuses TaskCard).
  5. **Module 3 — Autopilot Engine**: master Switch + 2×2 grid of 4 autopilot cards with expandable routine lists.
  6. **Module 4 — Task Execution Engine**: 5-column board grouped by status (Running/Pending/Scheduled/Completed/Failed) with ScrollArea of TaskCards (progress bar, agent badge, priority color, output).
  7. **Module 5 — Business Agents**: 5 agent cards (responsive 1→5 col grid) with emoji avatar, status dot (pulse when working), active/done/failed stats, Handles list, current-task badge.
  8. **Module 6 — Orchestrator**: trigger badge + analysis paragraph + 6-step horizontal pipeline + ranked priorities + tasks-by-agent summary + completion report. Live result from `POST /api/rmb/orchestrate` overrides the state plan.
  9. **Module 8 — Delegation Engine**: Textarea + Delegate + 4 quick-delegation chips → POST `/api/rmb/delegate` → Understood tile + execution-mode badge + ack + scheduledFor + tasks list (reuses TaskCard).
  10. **Module 9 — Memory**: 2×2 grid (Insights / Collection History / Reports Generated / Routines) + Team Performance table (5 agent rows).
  11. **Module 10 — Personality**: footer card with roles line + tagline + 2 columns (Spoken Behaviours / Never Says) + separator + founder credit "Founded & developed by Prince Singh".
- Interactions wired:
  - "Run My Business Today" → POST `/api/rmb/orchestrate` → `setLiveOrchestration(plan)`, toast, smooth-scroll to `#rmb-orchestrator`.
  - Module 2 / Module 8 inputs → their respective POST endpoints with full result rendering.
  - "Ask Oracle" buttons → `window.dispatchEvent(new CustomEvent('oracle-ask', { detail: { prompt } }))` (matches the routing convention from Task Oracle-Audit-Recovery).
  - Module 1 CTA buttons → `setCurrentView(ctaView)` from `useApp()`.
  - Auto-refresh: `setInterval(fetchData, 60_000)` with cleanup.
- Cleaned up unused imports (`ShieldAlert`, `Bell`, `BarChart3`) and an unused `onCta` prop on `CommandCenterModule` after the first lint pass.

## Validation
- `bunx tsc --noEmit 2>&1 | rg "run-my-business" | head -20` → **ZERO** errors in this file.
- `bun run lint 2>&1 | tail -10` → `$ eslint .` exit code **0** — zero errors, zero warnings.
- File size: **1823 lines** (was 1443 — replaced the pipeline-simulation demo with the full 10-module OS).

## Stage Summary
- All 10 modules of the Run My Business™ Operating System rendered in a single scrollable dashboard.
- Visual language is identical to `AICFODashboardPage.tsx` (dark theme, emerald/teal accents, accent-gradient tiles, FadeIn motion, status glyph system, ScrollArea long lists, staggered animation delays).
- All four API endpoints exercised: `GET /api/rmb` (auto-refresh 60s + manual Refresh), `POST /api/rmb/command`, `POST /api/rmb/orchestrate`, `POST /api/rmb/delegate`.
- Uses existing shared types from `@/lib/rmb/types` — no type redefinitions. Uses existing `useApp()` + `useToast()` context hooks.
- Founder credit preserved in Module 10 footer: "GSTPilot Run My Business™ — Think · Delegate · Execute · Operate. Founded & developed by Prince Singh".
- tsc clean (0 errors in file), lint clean (0 errors, 0 warnings).
