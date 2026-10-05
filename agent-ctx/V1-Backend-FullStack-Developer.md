# Task V1-Backend — Oracle Proactive Insights, Universal Search, Business Graph

**Agent:** Full-Stack Developer
**Task ID:** V1-Backend
**Status:** ✅ Complete
**Lint:** Passes (exit 0, no errors)

## Files Created (5)

### 1. `src/lib/oracle/proactive.ts` — Daily Briefing Engine
- Exports `DailyBriefing` interface + `computeDailyBriefing(): Promise<DailyBriefing>`
- Wraps every DB call (`db.gSTRFiling.findMany`, `db.notice.count`, `db.gSTRFiling.count`) in try/catch
- Sources live numbers from `loadOracleLiveData()`:
  - `overdueReturns.count` ← `liveData.compliance.overdueReturns` + DB list of overdue rows (take 10)
  - `availableItc` ← `liveData.compliance.itcAvailable`
  - `collectionRisks.clients` ← `liveData.riskyClients` (slice 5)
  - `revenueOpportunities.signals` ← `liveData.health.signals` (slice 4)
  - `revenueOpportunities.growthPct` ← `liveData.health.components.revenueGrowthPct` (falls back to `health.growth`, then 0) — **see assumptions below**
  - `healthScore` ← `liveData.health.overall`
  - `cashRunwayDays` ← `cash / max(1, monthlyExpenses) * 30`, clamped 0–365; only set when bank is connected
- Builds `todaysPriorities` array with high/medium/low categories driven by live numbers
- Never throws; returns empty-defaults briefing on catastrophic `loadOracleLiveData` failure

### 2. `src/app/api/oracle/insights/route.ts`
- Exports `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`
- `GET()` → `{ ok: true, briefing, generatedAt }` on success
- On ANY error → `{ ok: true, briefing: <empty defaults>, generatedAt, degraded: true }` (never 500s, never throws)

### 3. `src/lib/oracle/search.ts` — Universal Search Engine
- Exports `SearchResult` interface + `searchAll(query): Promise<SearchResult[]>`
- Runs 7 parallel DB searchers (clients, invoices, returns, reports, documents, tasks, notices); each in its own try/catch, each capped at `take: 5`
- Normalises q to trimmed lowercase; returns `[]` for `q.length < 2`
- Dedupes by `(type, id)`; sorts title-matches first (case-insensitive `includes`); caps total at 30
- Per-task subtitle mapping:
  - client → `gstin`
  - invoice → `buyerName` + meta `₹{totalAmount}`
  - return → `status`
  - report → `reportType`
  - document → `docType`
  - task → `sourceType`
  - notice → `noticeType`

### 4. `src/app/api/oracle/search/route.ts`
- Exports `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`
- `GET(request)` → reads `q` from URL search params
- Returns `{ ok: true, results: [] }` for q.length < 2 (no DB hit)
- Otherwise `{ ok: true, results, query: q }`
- Catches all errors → returns empty results array (never 500s)

### 5. `src/lib/oracle/graph.ts` — Business Graph Engine
- Exports `BusinessGraphNode`, `BusinessGraphEdge`, `BusinessGraph` interfaces
- Exports `buildBusinessGraph(): Promise<BusinessGraph>` and `renderGraphBlock(graph): string`
- `buildBusinessGraph`:
  - Loads `loadOracleLiveData()` (never throws upstream)
  - Adds `firm` node (label=tradeName, meta=`GSTIN {gstin}`)
  - For each risky client (liveData.riskyClients): adds `client` node + edge `client → firm "owes"`
  - If bank connected: adds `bank` node + edge `firm → bank "operates"`; adds `cashflow` node + edge `bank → cashflow "feeds"`
  - DB-backed: overdue returns (db.gSTRFiling where overdue, take 5) → firm "must file"
  - DB-backed: active notices (db.notice where open, take 3) → firm "faces"
  - Builds summary line: "Your business graph: 1 firm, N clients at risk, M overdue returns, K active risks, ₹X cash."
  - All DB calls wrapped in try/catch
- `renderGraphBlock`: returns markdown block for Oracle system prompt; returns `''` if `nodes.length <= 1`

## Files Edited (1, minimal additive)

### `src/app/api/oracle/chat/route.ts`
Three surgical insertions; no existing logic modified:

1. **Import** (after line 30):
   ```ts
   import { buildBusinessGraph, renderGraphBlock } from '@/lib/oracle/graph';
   ```

2. **graphBlock computation** (right after the documentBlock try/catch, before `return {`):
   ```ts
   let graphBlock = '';
   try {
     const graph = await buildBusinessGraph();
     graphBlock = renderGraphBlock(graph);
   } catch { /* ignore */ }
   ```

3. **System prompt template** (right after the `${liveDataBlock ...}` line):
   ```ts
   ${graphBlock ? `\n${graphBlock}` : ''}
   ```

Final prompt block order: memory → liveData → **graph (NEW)** → documents → dashboard.

## Model-Field Assumptions

| Field | Source | Notes |
|---|---|---|
| `growthPct` in `revenueOpportunities` | `liveData.health.components.revenueGrowthPct` (fallback `health.growth`, then 0) | Task said `health.growth` but that's a 0–100 sub-score, not a percentage. Used `components.revenueGrowthPct` because the field is named `growthPct`. Falls back gracefully. |
| `db.gSTRFiling` where `status: 'overdue'` | Prisma string field (default `'draft'`) | Matches the `FilingHistoryEntry.status` union `'filed' \| 'draft' \| 'pending' \| 'overdue'` in `@/lib/connections/types.ts`. |
| `db.notice` where `status: 'open'` | Prisma string field (default `'open'`) | Matches `GstNoticeRecord.status` union. |
| `liveData.compliance.overdueReturns` as the count | Used directly from live data | DB rows currently empty in seeded DB; live-data generator returns 2 overdue. The count is authoritative. |
| `liveData.compliance.pendingReturns` as fallback for pending returns count | Direct from live data; falls back to `db.gSTRFiling.count` if 0 | Avoids unnecessary DB hit when live data is available. |
| `liveData.compliance.activeNotices` as fallback for active notices count | Direct from live data; falls back to `db.notice.count` if 0 | Same pattern. |

## Smoke Tests (all passed)

```
GET /api/oracle/insights          → 200 { ok:true, briefing:{...}, generatedAt }
GET /api/oracle/search?q=gstr     → 200 { ok:true, results:[1 task], query:'gstr' }
GET /api/oracle/search?q=         → 200 { ok:true, results:[] }
GET /api/oracle/search?q=a        → 200 { ok:true, results:[] }
```

Sample briefing output:
```json
{
  "ok": true,
  "briefing": {
    "overdueReturns": { "count": 2, "items": [] },
    "availableItc": { "amount": 394792.34, "note": "Claimable ITC per latest GSTR-2B. Ensure invoices are reflected before the November deadline." },
    "collectionRisks": { "count": 0, "clients": [] },
    "revenueOpportunities": { "growthPct": -2, "signals": [4 signals] },
    "todaysPriorities": [
      { "text": "File 2 overdue GSTR returns immediately...", "priority": "high", "category": "compliance" },
      { "text": "Respond to 2 active GST notices before the due date.", "priority": "high", "category": "notices" },
      { "text": "Reconcile ITC (₹3,94,792.34 available)...", "priority": "medium", "category": "itc" },
      { "text": "Review this month's expense breakdown...", "priority": "low", "category": "cashflow" },
      { "text": "Review the revenue forecast...", "priority": "low", "category": "planning" }
    ],
    "healthScore": 59,
    "cashRunwayDays": null
  },
  "generatedAt": "2025-..."
}
```

## Lint Status

```
$ eslint .
EXIT: 0
```

No errors, no warnings on any new or edited file.
