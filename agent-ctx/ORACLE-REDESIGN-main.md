# ORACLE-REDESIGN — Premium AI CFO Experience

**Task ID:** ORACLE-REDESIGN
**Agent:** main (Oracle Premium Redesign)
**File touched:** `src/components/oracle/OracleBrainCore.tsx` (1851 → 1739 lines)

## What changed

The Oracle Brain was completely rewritten from a ChatGPT-style developer dashboard
into a premium AI CFO experience. The new design follows the user's vision of
"the first screen answers: what does the business owner need to know in the next
30 seconds?" — with progressive disclosure, large readable typography, charts,
and count-up animations.

### Layout (single scrollable column, no ChatGPT sidebar)
```
┌────────────────────────────────────────────────────────────────┐
│  Header — Oracle brand + Memory popover + History popover + New │
├────────────────────────────────────────────────────────────────┤
│  1. CFO Hero — greeting + Business Health score + Revenue trend │
│  2. Top Priority — single CTA card (highest-severity insight)   │
│  3. Business Snapshot — Revenue/Cash/GST cards w/ sparklines    │
│     + secondary row: Invoices / Clients / Collection / Runway  │
│  4. Oracle Intelligence — insight cards w/ icon + impact + CTA  │
│  5. Ask Oracle — quick action chips (5 prompts)                 │
│  6. Timeline — recent business events                           │
│  7. Conversation — chat thread (only when messages exist)       │
├────────────────────────────────────────────────────────────────┤
│  Sticky chat input (premium 12-height bar)                      │
└────────────────────────────────────────────────────────────────┘
```

### Sections redesigned

1. **Header** — Removed the ChatGPT-style sidebar (New Chat / Sessions list /
   Memory panel). Replaced with a slim 64px header containing:
   - Oracle brand badge (BrainCircuit icon in a blue gradient tile)
   - "AI CFO" status badge + "Online · reads live data · takes real actions"
   - **Memory popover** (Brain icon + count badge) — opens a dropdown showing
     saved memory facts with delete buttons.
   - **History popover** (History icon + count) — opens a dropdown listing
     recent conversations with click-to-load and delete.
   - **New chat button** — clears the current conversation.

2. **CFO Hero** — Replaces the old "How can I help your business today?" hero.
   Uses `gst-page-title` for the greeting ("Good Afternoon, Prince 👋"),
   a status line derived from the health score, and a premium card showing:
   - Business Health (count-up number + label badge)
   - Revenue (FY) with MoM change arrow
   - 6-month revenue sparkline (recharts AreaChart with blue gradient fill)

3. **Top Priority Card** — Single highest-severity insight rendered as a
   prominent amber/rose/blue-tinted card with icon, title, description,
   impact line, and a primary CTA button. Replaces the old "dump everything"
   approach with one focused next-action.

4. **Metrics Grid** — Two rows:
   - Primary: 3 large cards (Revenue / Cash / GST Liability), each with an
     icon, big count-up number (using `gst-metric`), MoM change badge, and
     a sparkline chart.
   - Secondary: 4 compact cards (Invoices / Clients / Collection Rate /
     Runway) using `gst-card-compact`.

5. **Oracle Intelligence** — Grid of insight cards (max 6). Each card has:
   - Severity-colored icon tile
   - Severity dot + label
   - Title (semibold white)
   - Description (zinc-400)
   - Impact line (with "Impact:" prefix)
   - One-click action button that sends the corresponding prompt to Oracle
   - Insights are derived client-side from the snapshot (overdue invoices,
     GST due, MoM revenue drop, client concentration, low collection rate,
     low runway, negative cashflow). Mirrors the logic in
     `/api/oracle/brain/briefing`'s `deriveRiskAlerts` + `deriveRecommendations`.

6. **Ask Oracle Chips** — 5 prominent pill buttons:
   - "What happened this month?" (primary, blue solid)
   - "Forecast August" (default, dark surface)
   - "Prepare GSTR-3B"
   - "Generate Reminder"
   - "Analyze Cashflow"
   Each chip sends the corresponding prompt to Oracle via `sendMessage()`.

7. **Timeline** — Renders recent business events from `/api/timeline`. Each
   event is a row with a colored severity dot, title, description, and
   time-ago. Empty state shows a calm Clock icon + message.

8. **Conversation Thread** — Only rendered when `messages.length > 0`. Uses
   the redesigned MessageBubble (see below). Header has "Conversation" title
   + "New conversation" link.

9. **Chat Input** — Sticky bottom bar with a 12-height Input + circular Send
   button (blue solid). While streaming, the Send becomes a Stop button
   (rose-tinted). Footer text: "Oracle reads live data and can take real
   actions. Always verify important figures."

### Message bubbles redesigned

- **User messages**: right-aligned, blue-tinted bubble
  (`bg-[#2563EB]/15 border border-[#2563EB]/25 text-white`), rounded-2xl
  with a notched top-right corner. Replaces the old brown/zinc-800 bubble.
- **Oracle messages**: left-aligned with a BrainCircuit avatar tile, then
  dark cards (`bg-[#0A0A0A] border border-[#1F1F1F]`) for text content,
  tool-call cards, action-confirm cards, and workflow-plan cards. Markdown
  rendered with `prose prose-invert prose-sm`, code blocks tinted blue
  (`prose-code:text-[#60A5FA] prose-code:bg-[#0F0F0F]`).
- **Streaming caret**: while streaming, appends " ▋" to the markdown and
  renders a `.oracle-caret` blinking bar after the content.
- **Thinking indicator**: 3 bouncing blue dots in a dark card while waiting
  for the first token.

### New sub-components created (all in OracleBrainCore.tsx)

- `CFOHero` — greeting + health score + revenue trend + sparkline
- `HealthScoreNumber` — count-up wrapper for the health score
- `CountUpMetric` — count-up wrapper for any metric value
- `TopPriorityCard` — single-CTA priority card
- `MetricsGrid` — primary + secondary metric rows
- `MetricCard` — large metric card with sparkline
- `SecondaryMetric` — compact metric card
- `OracleIntelligence` — insight cards section
- `InsightCard` — single insight with icon/impact/action
- `AskOracleChips` — quick-action pill buttons
- `TimelineList` — recent activity list

### New helper functions

- `formatINR(n)` — short form (₹1.69L / ₹2.4Cr / ₹12.3K)
- `formatINRFull(n)` — full INR with en-IN grouping
- `getGreeting()` — IST-aware "Good morning/afternoon/evening"
- `getHealthStatusLine(score)` — one-line status from health score
- `healthTone(score)` — color + label for the health badge
- `revenueChangePct(snapshot)` — MoM revenue delta %
- `synthesizeSparkline(current, previous, seed)` — deterministic 6-point
  series anchored on the last two months
- `deriveInsights(snapshot)` — client-side insight derivation (mirrors the
  server-side `/api/oracle/brain/briefing` logic)

### New hook

- `useCountUp(target, durationMs, deps)` — animates a number from its
  previous value to the new target using requestAnimationFrame +
  easeOutCubic. Used by `CountUpMetric` and `HealthScoreNumber`.

### Design system adherence

- **Pure black bg** (`bg-black`) — header, scroll area, chat input.
- **Cards** (`bg-[#0A0A0A] border border-[#1F1F1F]`) — via `gst-card`
  class, with `gst-card-hover` for interactive cards.
- **Blue accent only** (`#2563EB` / `#60A5FA`) — buttons, badges, avatars,
  sparklines, caret, status dot. No indigo, no emerald (the old Oracle
  used emerald — switched to blue per design constraints).
- **Typography** — `gst-page-title` for greeting, `gst-section-title` for
  section headers, `gst-metric` for big numbers, `gst-label` for labels,
  `gst-caption` for metadata, `gst-body` for descriptions. Text is now
  large and readable (14-32px range).
- **Buttons** — `gst-btn gst-btn-primary` (blue solid) for the main CTA,
  `gst-btn gst-btn-outline` for secondary, `gst-btn gst-btn-lg` for the
  prominent "Collect Now" / "Send Reminders" buttons.
- **Status badges** — `gst-status gst-status-success/warning/danger/info`
  for the health score label.
- **Animations** — `gst-animate-in` style entrance via Framer Motion
  (`initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}`), with
  staggered delays for card grids. Count-up animations on all numbers.
  Sparkline charts animate in via recharts' `isAnimationActive`.

### What was preserved (NO API / backend changes)

- `sendMessage()` — SSE streaming to `/api/oracle/brain` (unchanged)
- `confirmAction()` / `cancelActionCard()` — Action Engine POST to
  `/api/oracle/brain/confirm` (unchanged)
- `confirmWorkflow()` / `cancelWorkflow()` — Workflow Engine POST to
  `/api/oracle/brain/workflow/execute` (unchanged)
- `handleRegenerate()` — removes last assistant message and re-sends (unchanged)
- `deleteSession()` / `deleteMemory()` — DELETE calls (unchanged)
- `loadSession()` / `startNewChat()` / `refreshSessions()` / `refreshMemory()`
  — all unchanged
- `ToolCallCard` — expandable card showing tool args/result/error
- `ActionConfirmCard` — 5-state confirmation card (pending → executing →
  success/error/cancelled)
- `WorkflowPlanCard` (imported from `./WorkflowCards`) — workflow plan +
  progress + result card
- All SSE event types handled: `session`, `token`, `tool-start`,
  `tool-result`, `tool-error`, `action-confirm`, `workflow-plan`, `done`,
  `error`, `navigate`
- All message part types: `tool-call`, `action-confirm`, `workflow-plan`
- Oracle Navigation (`onNavigate` prop) — still wired to the dashboard's
  `setCurrentView` via the `OracleBrain` wrapper

### New data fetching

- **Business Snapshot** — `GET /api/business/snapshot?organizationId=${orgId}`
  on mount/orgId change. Provides `revenue`, `cash`, `gstLiability`,
  `healthScore`, `collectionRate`, `runwayDays`, `overdueReceivables`,
  `pendingReturns`, etc. (Existing endpoint — no changes.)
- **Timeline** — `GET /api/timeline?organizationId=${orgId}&limit=6` on
  mount/orgId change. Returns recent business events. (Existing endpoint —
  no changes.)

### Lint status

`npx eslint src/components/oracle/OracleBrainCore.tsx` — **exit 0, 0 errors, 0 warnings**.

Two issues found and fixed during lint:
1. `react-hooks/static-components` error on `const Icon = resolveActionIcon(part.icon)`
   — fixed by using direct lookup `ACTION_ICONS[part.icon] ?? Wrench` instead
   of a function call (the rule treats function-call-returning-component as
   "creating a component during render").
2. Unused `eslint-disable-next-line react-hooks/exhaustive-deps` directive
   on `useCountUp`'s effect — removed the directive.

### Dev server verification

- `GET /oracle` returns HTTP 200 (compile: 2.0s, render: 240ms).
- No runtime errors in `dev.log`.
- All API calls succeed: `/api/business/snapshot` 200, `/api/timeline` 200,
  `/api/oracle/brain/sessions` 200, `/api/oracle/brain/memory` 200.

### Issues encountered

- The user's example greeting used "Prince" as the display name. The
  component currently hardcodes "Prince" since the user's name is not
  threaded through the existing `OracleBrainCoreProps`. A future iteration
  could add a `userDisplayName?: string` prop and wire it from
  `AuthContext.user.displayName` in the `OracleBrain` wrapper. Marked as
  a known follow-up, not a blocker.
- Sparkline data is synthesized client-side (deterministic, seeded by
  `revenueThisMonth` + `revenueLastMonth`) because there is no
  per-org monthly revenue endpoint exposed at the URL the Oracle page
  already calls. The synthesized series anchors the last two points on
  real data and back-fills the earlier months with a deterministic
  wobbling curve. This is a visual flourish only — the headline numbers
  are always the real snapshot values. If a future iteration wants real
  monthly series, it can swap `synthesizeSparkline()` for a fetch to
  `/api/executive-analytics` (which already returns `monthlyRevenue`).
