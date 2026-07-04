# Task 4c — Intelligence Lib C (recommendations + industry-advisor + dashboard + feed)

## Scope
Built 4 lib modules under `/home/z/my-project/src/lib/intelligence/` that complete
the Global Data Intelligence Cloud™ backend layer:

1. `recommendations.ts` — Global Recommendation Engine™
2. `industry-advisor.ts` — AI Industry Advisor™
3. `dashboard.ts` — Global Analytics Dashboard™ assembler
4. `feed.ts` — Enterprise Insight Feed™

All exports match the canonical interfaces defined in
`/home/z/my-project/src/lib/intelligence/types.ts` exactly. `types.ts` was NOT
modified.

## Key Decisions
- **(db as any).modelName** pattern used for every Prisma access — required by the
  task spec since the new models were just added to the schema.
- **FIRM_ID** resolved via `process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm'`.
- **Org metrics derived from REAL data**: Clients (filtered by firmId) → Invoices
  (revenue, collection speed via paymentDate), Expenses (cost, expense ratio,
  cash burn), GSTRFiling (compliance %), Payments (cash inflow), Workflow count
  (automation status). No mock values anywhere.
- **Recommendation triggers** are guarded by real conditions (GST compliance <90%,
  expense ratio >industry p75, etc.). If no condition triggers, zero rows created.
- **Industry profile risks/opportunities** are derived from GlobalKnowledgeEdge
  joins (source=industry node → target=risk_pattern / growth_pattern node), with a
  graceful fallback to direct industry-scoped GlobalKnowledgeNode lookup if no
  edges exist.
- **Dashboard** uses `Promise.all` for parallel section assembly; each section is
  individually try/caught so a single failure returns zeros/empty arrays and
  never blocks the rest.
- **Market outlook** loaded via dynamic `import('./market').catch(...)` with a
  sensible fallback `{ sentiment: 'neutral', summary: 'Market data unavailable',
  indicators: [] }` so this module has no hard runtime dependency on market.ts.
- **Feed generation** only creates items whose trigger is TRUE; the `ai_summary`
  item synthesizes a 2–3 sentence overview of all generated items.
- **Privacy**: `firmId` is destructured out (`const { firmId, ...rest } = row`)
  before any value is returned. Org counts in dashboard use `contributionHash`
  (anonymized) NOT `firmId`.

## Verification
- `bunx tsc --noEmit 2>&1 | grep "src/lib/intelligence"` → **0 errors** ✓
- `bun run lint` → **exit 0**, 0 errors, 0 warnings ✓
- Pre-existing unrelated tsc error in `src/lib/oracle-core/context.ts:324`
  (CEODecision.approved field) is from a prior agent and not in scope.

## Files Created
- `/home/z/my-project/src/lib/intelligence/recommendations.ts` — 501 lines
- `/home/z/my-project/src/lib/intelligence/industry-advisor.ts` — 399 lines
- `/home/z/my-project/src/lib/intelligence/dashboard.ts` — 356 lines
- `/home/z/my-project/src/lib/intelligence/feed.ts` — 446 lines
- **Total**: 1,702 lines of clean, documented TypeScript

## Exports Summary
### recommendations.ts
- `generateRecommendations(): Promise<number>`
- `listRecommendations(status?, limit?): Promise<GlobalRecommendation[]>`
- `getRecommendation(id): Promise<GlobalRecommendation | null>`
- `updateRecommendationStatus(id, status): Promise<void>`
- `getRecommendationStats(): Promise<{total, active, actedOn, dismissed, byCategory}>`

### industry-advisor.ts
- `seedIndustryProfiles(): Promise<number>` (upserts all 13 industries)
- `getIndustryProfile(industry): Promise<IndustryProfile | null>`
- `listIndustryProfiles(): Promise<IndustryProfile[]>` (always returns all 13)
- `getIndustryAdvisorReport(industry): Promise<IndustryAdvisorReport | null>`

### dashboard.ts
- `getGlobalAnalyticsDashboard(): Promise<GlobalAnalyticsDashboard>`

### feed.ts
- `generateDailyFeed(): Promise<number>`
- `getFeedSummary(): Promise<InsightFeedSummary>`
- `listFeedItems(limit?, unreadOnly?): Promise<InsightFeedItem[]>`
- `markFeedItemRead(id): Promise<void>`
