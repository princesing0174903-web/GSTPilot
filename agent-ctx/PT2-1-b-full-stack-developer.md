# PT2-1-b — GST Returns & Reconciliation Cleanup

**Agent**: full-stack-developer
**Task ID**: PT2-1-b
**Task**: Remove all fake GST returns, reconciliation data, e-invoices, review data; replace with real API fetch + empty states.

## Previous Context Consulted
- `/home/z/my-project/worklog.md` tail — confirmed PT-1-a-retry + PT2-1-a agents had already cleaned BankingPage / PaymentsPage / EmbeddedFinancePage / WorkingCapitalPage of fake data.
- `/home/z/my-project/dev.log` tail — confirmed dev server healthy, `/api/returns` 200, `/api/reconciliation` 200, `/api/invoices` 200, `/api/clients` 200, all 20+ endpoints returning 200.
- `/home/z/my-project/src/contexts/AppContext.tsx` — confirmed `connections` is a valid `AppView` (line 94).
- `/home/z/my-project/src/components/shared/EmptyState.tsx` — confirmed signature: `<EmptyState icon={...} title="..." description="..." action={{ label, onClick }} compact />`.
- `/home/z/my-project/prisma/schema.prisma` — confirmed `GSTRFiling`, `ReconciliationRun`, `ReconciliationResult`, `Invoice`, `Client`, `Document` model fields.
- `/home/z/my-project/src/app/api/returns/route.ts` — returns `{ returns: GSTRFiling[] }` with `client` relation.
- `/home/z/my-project/src/app/api/reconciliation/route.ts` — returns `{ results: ReconciliationResult[] }` (default) or `{ runs: ReconciliationRun[] }` (with `?action=runs`).
- `/home/z/my-project/src/app/api/invoices/route.ts` — returns `{ invoices: Invoice[] }` with `client` relation.
- `/home/z/my-project/src/app/api/clients/route.ts` + `/api/clients/[id]/route.ts` — returns client list / single client with `_aggregations`.
- `/home/z/my-project/src/app/api/documents/route.ts` — returns `{ documents: Document[] }` (different shape than FirestoreDocument, mapped with sensible defaults).
- `/home/z/my-project/src/hooks/use-firestore.ts` — confirmed the firestore hooks were the source of data in ReturnsPage / ReturnPrepWorkspace / ReconciliationPage (would silently return empty arrays when Firebase had no matching docs).
- `/home/z/my-project/src/lib/firestore-schema.ts` — confirmed `FirestoreReturn`, `FirestoreClient`, `FirestoreInvoice`, `FirestoreReconciliation`, `FirestoreDocument`, `FirestoreAIRecommendation`, `ReconMismatch` shapes.

## Files Modified

### 1. `src/components/e-invoicing/EInvoicingPage.tsx`
- Added `useEffect`, `useMemo`, `Loader2`, `Inbox`, `EmptyState` imports.
- Removed hardcoded arrays: `statCards` (847 IRNs / 124 EWB / 96.4% pass / 12 jobs), `eInvoices` (10 fake rows with Sharma/Patel/Mehta/Kumar/Singh/Reddy/Agarwal/Joshi buyers and ₹45,000–₹12,30,000 amounts), `eWayBills` (7 fake bills with Mumbai/Pune/Delhi/Bangalore routes), `bulkJobs` (6 fake BLK-2026-* IDs), `dailyIRNData` (7 fake day counts).
- Added `EInvoiceRow` + `ApiInvoice` interfaces + `mapInvoiceToEInvoice()` mapper.
- Added `useEffect` that fetches `/api/invoices` and maps to `EInvoiceRow[]`.
- Derived `statCards` from real invoices: `IRNs Generated = eInvoices.length`, `Validation Pass % = validCount / total * 100`, `Bulk Jobs = bulkJobs.length`, `E-Way Bills Active = totalEWBActive`.
- Stat cards now show "—" for the trend chip (no fake percentage deltas) and "—" for the value when `eInvoices.length === 0`.
- `ValidationGauge` percent changed from hardcoded `96.4` to computed `validationPassPct`.
- Hardcoded "816 Passed", "23 Warnings", "8 Failed" replaced with computed `validCount`/`expiredCount`/`cancelledCount` or "—".
- Hardcoded "295 This Week", "847 This Month", "42.1 Avg/Day" replaced with computed values from `dailyIRNData` (or "—" when empty).
- Added 5 `EmptyState` renders:
  - Daily IRN Generation card → "No IRN history yet"
  - Recent E-Invoices card → "No e-invoices generated"
  - E-Invoices tab list → "No e-invoices generated" (or "No matching e-invoices" when search yields nothing)
  - E-Way Bills tab → "No e-way bills generated"
  - Bulk Jobs tab → "No bulk jobs yet"
- Added `isLoading` state + spinner render before the main layout.
- `eWayBills`, `bulkJobs`, `dailyIRNData` kept as empty arrays (no backing API) — UI shows empty states truthfully.

### 2. `src/components/returns/ReturnsPage.tsx`
- Added `useEffect` to React imports.
- Removed `useFireReturns`, `useFireClients`, `useFireReadyReturns`, `useFireFiledReturns` imports from `@/hooks/use-firestore`.
- Added `ApiGSTRFiling` + `ApiClient` interfaces + `mapApiReturnToItem()` + `mapApiClientToItem()` mappers (placed in module scope, before the component).
- Replaced 4 firestore hooks with `useState` + 2 `useEffect`s that fetch `/api/returns` and `/api/clients` (keyed on `refreshKey`).
- Removed the `useFireReadyReturns` + `useFireFiledReturns` calls (they were declared but never used in the JSX).
- Added `setRefreshKey(k => k + 1)` after `handleFileReturn` and `handleCreateReturn` so the kanban re-fetches and reflects the new/updated return.
- Existing loading skeleton, error state, and "No returns prepared" empty state are unchanged (they already use the `returnsLoading`/`clientsLoading`/`returnsError`/`returns.length === 0` checks).
- Layout, Kanban columns, timeline, sheet, dialogs, animations, colors, icons all unchanged.

### 3. `src/components/returns/ReturnPrepWorkspace.tsx`
- Added `useEffect` to React imports.
- Removed `useFireClient`, `useFireReturns`, `useFireInvoices`, `useFireDocuments` imports from `@/hooks/use-firestore`.
- Added `ApiGSTRFiling`, `ApiInvoice`, `ApiClient`, `ApiDocument` interfaces + `mapApiReturn()`, `mapApiInvoice()`, `mapApiClient()`, `mapApiDocument()` mappers.
- Replaced 4 firestore hooks with `useState` + 4 `useEffect`s that fetch (keyed on `clientId` + `refreshKey`):
  - `/api/clients/${clientId}` (single client)
  - `/api/invoices?clientId=${clientId}` (filtered invoices)
  - `/api/returns?clientId=${clientId}` (filtered returns)
  - `/api/documents?clientId=${clientId}` (filtered documents)
- The Document API returns the Prisma `Document` shape (`name`, `fileType`, `size`, `path`) which doesn't include `extractionStatus`/`extractedInvoiceCount`/`extractionAccuracy` — the mapper defaults these to `'pending'`/`0`/`0` so the existing JSX (which guards on these fields) still renders correctly.
- Added `setRefreshKey(k => k + 1)` after `handleRunValidation`, `handleMarkReady`, `handleFileReturn` so the workspace re-fetches after each status change.
- All step content (Upload / Extraction / Validation / Reconciliation / Preparation / Filing), filing readiness panel, dialogs, animations unchanged.

### 4. `src/components/reconciliation/ReconciliationPage.tsx`
- Added `useEffect` to React imports.
- Removed `useFireReconciliations`, `useFireClients`, `useFireAIRecommendations` imports from `@/hooks/use-firestore`.
- Added `ApiReconciliationRun`, `ApiReconciliationResult`, `ApiClient` interfaces + `mapApiRunToRecon()`, `mapApiResultToMismatch()`, `mapApiClient()` mappers.
- `mapApiResultToMismatch()` parses the JSON `mismatches` string on `ReconciliationResult` to extract `booksAmount`/`portalAmount`/`difference` (falls back to invoice total + 0 when not parseable).
- Replaced 3 firestore hooks with `useState` + 3 `useEffect`s:
  - `Promise.all([fetch('/api/reconciliation?action=runs'), fetch('/api/reconciliation')])` to get runs + results, then maps each run + its filtered results to `FirestoreReconciliation` shape (with `mismatches[]` populated from the results).
  - `fetch('/api/clients')` for the client list.
  - AI Recommendations: no backing REST API exists, so the list is left as `[]` and the existing "No active recommendations" empty state renders truthfully.
- Added `setRefreshKey(k => k + 1)` after `handleCreateReconciliation` and `handleResolveMismatch` so the page re-fetches.
- Updated the empty-state title from "No reconciliations run yet" → "No reconciliations yet" to match the task spec.
- Existing loading skeleton, error state, summary cards, mismatch table, AI panel, runs history, animations unchanged.

## Stage Summary
- **Files modified**: 4 (EInvoicingPage.tsx, ReturnsPage.tsx, ReturnPrepWorkspace.tsx, ReconciliationPage.tsx).
- **Hardcoded values removed**: 30+ fake e-invoice rows (with Indian surname buyers), 7 fake e-way bills, 6 fake bulk jobs, 7 fake daily IRN data points, 4 fake stat card values, 3 fake validation counts (816/23/8), 3 fake weekly/monthly/avg counts (295/847/42.1), 1 fake gauge percent (96.4). Plus the 3 firestore hook calls in ReturnsPage, 4 in ReturnPrepWorkspace, 3 in ReconciliationPage replaced with real API fetches.
- **Empty states added**: 6 new — Daily IRN chart, Recent E-Invoices card, E-Invoices tab, E-Way Bills tab, Bulk Jobs tab (EInvoicingPage); plus the existing "No returns prepared" (ReturnsPage) and updated "No reconciliations yet" (ReconciliationPage).
- **APIs wired**:
  - `GET /api/invoices` → EInvoicingPage
  - `GET /api/returns` → ReturnsPage (and `?clientId=X` for ReturnPrepWorkspace)
  - `GET /api/clients` → ReturnsPage + ReconciliationPage
  - `GET /api/clients/{id}` → ReturnPrepWorkspace
  - `GET /api/invoices?clientId=X` → ReturnPrepWorkspace
  - `GET /api/documents?clientId=X` → ReturnPrepWorkspace
  - `GET /api/reconciliation?action=runs` + `GET /api/reconciliation` → ReconciliationPage
- **Lint**: PASS (zero errors, zero warnings)
- **Dev server**: healthy (zero compile errors; all API endpoints returning 200; `/api/reconciliation?action=runs` 200 returns `{ runs: [] }`; `/api/returns` 200 returns 1 real GSTRFiling; `/api/clients` 200 returns real clients; `/api/invoices` 200 returns real invoices).
