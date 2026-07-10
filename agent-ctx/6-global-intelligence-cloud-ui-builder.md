# Task 6 — Global Data Intelligence Cloud™ UI

## Scope
Built the full UI page for the **GSTPilot™ Global Data Intelligence Cloud™**
at `src/components/global-intelligence-cloud/GlobalIntelligenceCloudPage.tsx`
and wired it into the app router, command palette, and AppView union.

The cloud is the federated, anonymized intelligence layer that aggregates
REAL business signals across industries & regions, then reflects them back
to every org as benchmarks, predictions, recommendations, knowledge
patterns, industry advisory, insight feeds, trends, and security audit.

## Key Decisions
- **'use client'** single-file component — mirrors the Oracle Intelligence
  Core™ page architecture (Header → KPI Row → Tabs → Modals).
- **Polling**: dashboard (`/api/intelligence/dashboard`) is fetched on mount
  and every 60s (silent poll, errors surface as toast).
- **Lazy tab fetching**: each TabsContent mounts its own data via useEffect
  when the tab is selected. This keeps the initial bundle light and avoids
  hitting every endpoint on page load.
- **No indigo/blue** anywhere. Palette is emerald/amber/rose/slate/teal/cyan
  + Tailwind `primary` CSS variable for the main accent.
- **shadcn/ui** components used: Card, Button, Badge, Input, Textarea,
  Select, Tabs, Progress, Label, Dialog, Table.
- **Lucide icons** throughout, including per-industry icons
  (Factory, Store, HeartPulse, etc.) and per-feed-type icons.
- **Sparkline** is a tiny inline SVG (no chart lib dependency) that draws a
  colored path + 10% fill area, colored by trend direction.
- **Toast (sonner)** for every action: seed, analyze, predict, simulate,
  recompute, acknowledge/act/dismiss rec, mark-read.
- **Loader2 spinners** for all loading states; **ErrorCard** with retry for
  all failure states; **EmptyState** for all zero-data states.
- **max-h-96 / max-h-[600px] / max-h-[700px] overflow-y-auto custom-scrollbar**
  on every long list (snapshots table, predictions, recs, nodes, feed, audit).

## Wiring
1. `src/contexts/AppContext.tsx` — added `| 'global-intelligence-cloud'`
   to the `AppView` union right after `'oracle-intelligence-core'`.
2. `src/app/page.tsx` — added the import, the VIEW_TITLES entry
   `'global-intelligence-cloud': 'Global Data Intelligence Cloud™'`, and
   the `case 'global-intelligence-cloud':` in `renderView`.
3. `src/components/command-palette/CommandPalette.tsx` — added `Globe2`
   to the lucide import block and a new command entry
   `cmd-open-global-intelligence-cloud` after the Oracle command.

## Verification
- `bunx tsc --noEmit 2>&1 | grep -E "global-intelligence-cloud|AppContext|page\.ts|CommandPalette"`
  → **0 errors** ✓
- `bun run lint` → **exit 0**, 0 errors, 0 warnings ✓
- Pre-existing unrelated dev.log warning about `@/lib/twin/engine` dynamic
  import is gracefully caught via `.catch(() => null)` in
  `src/lib/intelligence/predictive.ts` (not in scope, not a real error).

## Files Created / Modified
- `src/components/global-intelligence-cloud/GlobalIntelligenceCloudPage.tsx`
  — **3,141 lines** (new)
- `src/contexts/AppContext.tsx` — +2 lines (AppView union)
- `src/app/page.tsx` — +3 lines (import, VIEW_TITLES, renderView case)
- `src/components/command-palette/CommandPalette.tsx` — +11 lines
  (Globe2 import + new command entry)

## Page Structure (10 tabs + 3 modals)
1. **World Brain Overview** — global metrics, economic outlook, opportunity
   index, risk heatmap, recent feed (uses dashboard data).
2. **Industry Benchmarks** — industry/region selectors, percentile hero
   with gradient bar, percentile breakdown table, snapshots table.
3. **Market Intelligence** — outlook hero with directional arrow, 8
   indicator cards (label, value, sentiment dot, region, source, impact).
4. **Predictive Intelligence** — generate form (type+horizon), 4 stat
   tiles, prediction history cards with expandable factors.
5. **Global Recommendations** — 5 stat tiles, status filter, recommendation
   cards with Acknowledge/Act/Dismiss buttons (PATCH endpoint).
6. **Knowledge Graph** — 4 summary tiles, 3 pattern columns
   (risk/growth/compliance), nodes table.
7. **Industry Advisor** — industry selector, profile hero (5 metrics),
   risks, opportunities, AI insights, recommended actions, peer comparison.
8. **Insight Feed** — 4 summary tiles, AI daily summary hero, feed items
   list with mark-read on click (PATCH endpoint), unread-only toggle.
9. **Trends & Analytics** — growth/revenue/regional/GST/hiring/compliance
   sections with inline SVG sparklines.
10. **Security & Audit** — 6 stat cards, audit log table.

### Modals
- **AnalyzeModal** — topic + scope Select → POST /analyze → summary card,
  key findings list (tone badges), benchmarks, confidence.
- **PredictModal** — type + horizon Selects → POST /predict → result card
  with value, confidence, factors.
- **SimulateModal** — scenario Textarea + horizon + 3 variable inputs
  (price/headcount/expense) → POST /simulate → 3 scenario cards
  (worst/base/best) with revenue/profit/cashflow/probability.
