# Task P3-A — CFO Analysis + Insights Builder

## Summary
Built two new server-side CFO modules for Phase 3 of **GSTPilot AI CFO™**:
1. `src/lib/cfo/analysis.ts` — Automatic Financial Analysis engine detecting 11 financial conditions from live Prisma data.
2. `src/lib/cfo/insights.ts` — Smart CFO Insights engine producing Top Risks, Top Opportunities, Urgent Actions, and 4 period summaries (weekly / monthly / quarterly / yearly).

Both are pure server-side TypeScript modules (no `'use server'`) that import `db` from `@/lib/db`, share the existing CFO type definitions in `src/lib/cfo/types.ts`, and follow the deterministic + transparent code style of `src/lib/cfo/engine.ts`.

No existing files were overwritten. No UI redesigned. Only new files were created.

## Files Created

### `src/lib/cfo/analysis.ts` (~620 lines)

**Exports**: `buildFinancialAnalysis(): Promise<FinancialAnalysis>`

**Detection logic** (11 conditions, all with transparent evidence strings):

| # | Condition | Detection rule | Severity |
|---|-----------|----------------|----------|
| 1 | `revenue_decline` | MoM invoice total drop > 10% | warning / critical (>25%) |
| 2 | `expense_increase` | MoM expense rise > 15% | warning / critical (>40%) |
| 3 | `profit_reduction` | Net margin drop > 5 pts MoM | warning / critical (>15 pts) |
| 4 | `negative_cash_flow` | Monthly expenses > monthly revenue | critical |
| 5 | `collection_delays` | Overdue invoices > 0 OR efficiency < 80% | warning / critical (>5 overdue or eff < 60%) |
| 6 | `gst_penalties` | Notice type contains penalty/fine/interest OR overdue returns > 0 | critical (notices) / warning (overdue) |
| 7 | `itc_opportunities` | ITC from purchase bills > 0 AND not fully utilised | opportunity |
| 8 | `duplicate_expenses` | Same vendor + amount within 7-day window | warning |
| 9 | `vendor_risks` | Any vendor with > 3 overdue payables | warning |
| 10 | `customer_risks` | Any client with healthScore < 50 OR > 2 overdue invoices | warning / critical (health < 25) |
| 11 | `late_payments` | Overdue payables + overdue receivables + stuck payments > 0 | warning / critical (>5 payables or >10 total) |

**Design highlights**:
- Time helpers (`startOfMonth`, `startOfLastMonth`, `endOfLastMonth`, `addDays`) mirror the engine's private helpers — kept local to avoid coupling.
- `filingDueDate()` helper reimplements GSTR-1 (11th), GSTR-3B (20th), GSTR-9 (Dec 31) statutory deadlines.
- `isInvoiceOverdue()` / `isPurchaseBillOverdue()` / `isFilingOverdue()` primitives shared across detectors.
- Each condition carries `evidence?: string[]` with the exact numeric breakdown so the UI / Oracle can show WHY it triggered.
- Orchestrator uses `Promise.all` to fetch 7 Prisma models (invoices, expenses, payments, purchaseBills, clients, GSTRFilings, notices) in parallel.
- Wrapped in `try/catch` — returns a valid empty-conditions structure on any failure (never throws).

### `src/lib/cfo/insights.ts` (~470 lines)

**Exports**: `buildSmartInsights(): Promise<SmartCFOInsights>`

**Implementation**:
1. Runs `generateCFOInsights()` (from `./engine`) and `buildFinancialAnalysis()` (from `./analysis`) in parallel.
2. Fetches lightweight invoice + expense rows for period aggregation (engine's dashboard only exposes thisMonth/lastMonth — weekly / quarterly / yearly need direct range queries).
3. **topRisks**: Maps engine `RiskAssessment[]` (level != 'low', sorted by score desc, top 4) + detected analysis conditions with severity 'critical' or 'warning' (top 4) → SmartInsight (category 'risk'). Sorted by priority, capped at 6.
4. **topOpportunities**: Derives ITC opportunity, growth signal (revenue.growthPct > 5% OR 30-day forecast > this month), collection improvement potential, GST refund prediction → SmartInsight (category 'opportunity'). Sorted by priority, capped at 5.
5. **urgentActions**: Maps `brief.priorityActions[]` → SmartInsight (category 'action') with `actionLabel` and `actionView` derived from `actionType`:
   - `recover` → 'Recover Collections' → 'reconcile'
   - `file` → 'Open Returns' → 'returns'
   - `respond` → 'Open Notices' → 'notices'
   - `claim` → 'Claim ITC' → 'reconcile'
   - `pay` → 'Schedule Payments' → 'payments'
   - `review` → 'Review in CFO' → 'ai-cfo'
6. **summaries**: 4 `PeriodSummary` objects:
   - **weekly**: last 7 days revenue/expenses/profit
   - **monthly**: this month so far (uses dashboard metrics)
   - **quarterly**: last 90 days
   - **yearly**: last 365 days / YTD
   - Each has `headline`, 2-3 `highlights`, 2-3 `concerns`, and a forward-looking `outlook` sentence.
- INR formatting via `Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })` (matches engine pattern).
- Wrapped in `try/catch` — returns `{ topRisks: [], topOpportunities: [], urgentActions: [], summaries: [] }` on any failure (never throws).

## Type imports

Both files import types ONLY from `./types` (no type redefinitions). Used types:
- From `analysis.ts`: `AnalysisConditionType`, `FinancialAnalysis`, `FinancialCondition`
- From `insights.ts`: `CFOResponse`, `FinancialCondition`, `PeriodSummary`, `PriorityAction`, `RiskAssessment`, `SmartCFOInsights`, `SmartInsight`, `SummaryPeriod`

## Verification

### Lint
- `bun run lint` → **exit 0** (clean, 0 errors, 0 warnings across the whole project)

### TypeScript
- `npx tsc --noEmit --skipLibCheck` filtered to `src/lib/cfo/(analysis|insights)\.ts` → **0 errors** in the new files
- One issue found & fixed during dev: `PurchaseBillRow.paidAmount` was missing from the local interface — added to interface and Prisma select clause.

### Smoke test (live Prisma)
Ran `bun run /tmp/cfo-smoke.ts` against the existing dev database. Result:
```
=== buildFinancialAnalysis ===
detectedCount: 3 criticalCount: 1
  [ ] info        revenue_decline        — Revenue Decline
  [ ] info        expense_increase       — Expense Increase
  [ ] info        profit_reduction       — Profit Reduction
  [ ] info        negative_cash_flow     — Negative Cash Flow
  [X] critical    collection_delays      — Collection Delays
  [ ] info        gst_penalties          — GST Penalties
  [ ] info        itc_opportunities      — ITC Opportunity
  [ ] info        duplicate_expenses     — Duplicate Expenses
  [ ] info        vendor_risks           — Vendor Risks
  [X] warning     customer_risks         — Customer Risks
  [X] warning     late_payments          — Late Payments

=== buildSmartInsights ===
topRisks: 6         (Collection Risk, Revenue Risk, Collection Delays, Profitability Risk, Customer Risks, Late Payments)
topOpportunities: 1 (Improve Collection Efficiency)
urgentActions: 2    (Recover overdue receivables [critical], Review revenue pipeline [medium])
summaries: 4        (weekly / monthly / quarterly / yearly — yearly shows ₹1,18,000 revenue, ₹8,500 expenses, ₹1,09,500 profit)

Total time: 65ms (both engines + Prisma queries)
```

All 11 conditions computed. Insights correctly link risks to engine output. Period summaries correctly aggregate across the right time windows (yearly shows real trailing-12-month data; weekly/monthly/quarterly show 0 because no invoices dated in those windows — expected for the seed dataset).

## Issues / Notes
- None outstanding. Both files compile, lint, typecheck, and execute cleanly.
- The new modules do NOT modify the existing `/api/ai-cfo` route or any UI component. They are pure library additions ready for a downstream UI/API agent to consume.
- The fail-safe `catch` blocks ensure the API will always get a valid response shape even if Prisma errors mid-query.
- All `actionView` strings emitted by `insights.ts` ('reconcile', 'returns', 'notices', 'payments', 'ai-cfo') exist in the `AppView` union in `src/contexts/AppContext.tsx`.
