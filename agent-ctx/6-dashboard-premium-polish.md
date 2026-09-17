# Task 6 — Dashboard Premium Polish (12 points)

**Agent**: full-stack-developer
**Task**: Elevate the GSTPilot Infinity dashboard to "trillion-dollar SaaS" polish level (Stripe / Linear / Bloomberg tier) via 12 premium-polish points.

## Files Touched
- **Edited**: `src/components/dashboard/DashboardPage.tsx` (2150 → 2562 lines, +412)
- **Edited**: `src/components/dashboard/home/BusinessSetupProgress.tsx` (201 → 242 lines, +41)
- **Created**: `src/components/dashboard/home/Sparkline.tsx` (137 lines, pure SVG, no external deps)

## Key New Component Locations (line numbers in DashboardPage.tsx)
- `KpiCard` function (with accent/sparkline/trend support) — line **387**
- `OracleBanner` component definition — line **745**; rendered at line **1418** (right after greeting/quick actions, BEFORE KPI stats)
- `InlineCriticalIssueBanner` component definition — line **834**; rendered at line **1426**
- New KPI grid section (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5`) — line **1437**
- 4 KpiCard usages — lines **1438** (Revenue/emerald), **1459** (Customers/blue), **1509** (Invoices/violet), **1536** (Compliance/emerald-when-0/amber-when->0)
- Demoted BusinessSetupProgress (now at the bottom) — line **2189**

## Sparkline Component
- File: `src/components/dashboard/home/Sparkline.tsx`
- `export function Sparkline` — line **50**
- Pure SVG, NO external chart deps (no recharts/victory/d3)
- Props: `data: number[]`, `trend: 'up' | 'down' | 'flat'` (emerald/rose/gray), `width` (default 80), `height` (default 30), `strokeWidth` (default 1.5), `idSuffix`, `className`
- Smooth Catmull-Rom → cubic Bézier line + `<defs><linearGradient>` fill (top ~28% opacity → 0 at baseline)

## 12-Point Summary
1. **Demote setup / Elevate Oracle** — BusinessSetupProgress is now collapsible (collapsed by default) + moved to the BOTTOM of the page (after Timeline + Services + Team). New full-width `OracleBanner` ("Unlock your AI CFO") at the TOP (after greeting/quick actions, before KPI stats) with animated gradient border (CSS @keyframes), gold Sparkles chip, pulsing glow CTA, "PREMIUM" badge. Only renders when `!oracleActivated`.
2. **1 Issue badge** — No literal "1 Issue" badge exists in the codebase. FloatingDock's `notificationCount` badge defaults to 0 (DashboardShell doesn't pass a count). Interpreted as: surface `metrics.criticalIssues` via new `InlineCriticalIssueBanner` (slim amber alert above KPI stats with "Review now" button).
3. **Premium stat cards** — Each KpiCard has: vertical 3px accent bar on LEFT edge (emerald/blue/violet/amber), subtle tinted bg bleed (`from-{color}-500/[0.04] to-transparent`), sparkline in bottom-right, "↑ X% vs last month" trend label under value, padding `p-5 md:p-6`, gap `gap-4 lg:gap-5`.
4. **Typography hierarchy** — Greeting: `text-2xl sm:text-3xl font-bold tracking-tight` with text-gradient on name only. Pending-collection insight rendered as `text-base font-bold` hero metric inline. Card titles: `text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground`.
5. **Action button hierarchy** — Create Invoice is PRIMARY (`accent-gradient px-5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.25)]`). Create Return + Add Client are GHOST (`border border-border bg-transparent px-4 py-2`). All three: `transition-all hover:scale-[1.02] hover:shadow-md active:scale-95`. Order: Create Invoice | Create Return | Add Client. `gap-3` between, `mb-6` below row on mobile.
6. **Oracle Activate button upgrade** — Label "Activate Oracle AI CFO →", `bg-gradient-to-r from-amber-400 to-amber-500`, `shadow-[0_0_24px_rgba(245,158,11,0.4)] animate-pulse`, `animate-ping` glow ring behind button, "Premium" pill above, subcopy "Unlock AI-driven ITC optimization, vendor fraud detection, and predictive cash flow." below.
7. **Pending Compliance** — When count=0: emerald accent + "All clear" green badge + "GSTN synced ✓" line. When count>0: amber accent + "Needs attention" badge + top-issue inline tooltip.
8. **Weather widget** — NOT FOUND anywhere in `src/components/dashboard/` or `src/components/layout/`. Nothing to remove. N/A.
9. **Entrance animations** — KpiCard stagger: `initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay: index*0.08, duration:0.4}}`. Progress bar swipe: `initial={{width:0}} animate={{width: pct%}} transition={{duration:0.8, ease:'easeOut'}}`. AnimatedNumber count-up confirmed still routing through KpiCard.
10. **Color + contrast** — Gold/amber (amber-400/500/600) for Oracle (banner border glow, CTA glow, Sparkles chip, PREMIUM badges). Emerald for compliance when 0 (healthy). Amber when >0 (needs attention). All text uses text-foreground / text-muted-foreground / text-amber-400 / text-emerald-400 (WCAG AA on dark bg).
11. **Layout grid** — Main wrapper: `px-6 md:px-8 lg:px-10` (was `px-4 md:px-6`). Action buttons: `gap-3` + `mb-6` below row on mobile. KPI grid: `gap-4 lg:gap-5`. Inner page-rhythm: `space-y-10 md:space-y-12`.
12. **Premium Feature visual language** — Sparkles star icon next to Oracle card titles (OracleBanner, Ask Oracle card, Oracle is live panel, AI Recs empty state). "PREMIUM" amber badges in top-right of all Oracle-related cards.

## Lint Result
- `npx eslint src/components/dashboard/DashboardPage.tsx src/components/dashboard/home/BusinessSetupProgress.tsx src/components/dashboard/home/Sparkline.tsx --max-warnings=0` → **EXIT 0** (no warnings, no errors)
- `curl http://localhost:3000/` → **HTTP 200** (clean compile, no runtime errors)

## Deviations from Spec
- **Point 2**: No literal "1 Issue" badge in codebase. Interpreted as: surface `metrics.criticalIssues` via InlineCriticalIssueBanner. Did NOT edit DashboardShell.tsx (spec said to avoid).
- **Point 3 (compliance trend)**: Set to `'flat'` (gray) instead of `'down'` (rose) because "issues going down" is GOOD but rose color would mis-read as "bad". Accent bar carries the actual status.
- **Point 8 (weather widget)**: N/A — no weather widget exists in dashboard components. Nothing to remove.
- **Point 9 (progress bar swipe)**: Two bars (compact inline in header + full-width in expanded body); both animate width:0→pct% over 800ms ease-out.
- **Point 11 (mb-6)**: Applied as `mb-6 sm:mb-0` so it only kicks in on mobile (where actions wrap below greeting).
- **Point 12 (BETA vs PREMIUM)**: Used "PREMIUM" consistently across all Oracle surfaces for a single coherent signal.

## What I Did NOT Touch
- No API calls, data fetching, or business logic changed.
- No existing TypeScript types changed.
- No removal of any existing functionality.
- Did NOT edit DashboardShell.tsx (per spec).
- Did NOT remove FloatingDock.tsx (the bell + notification badge system is the proper notification center; no dangling badge to remove).
