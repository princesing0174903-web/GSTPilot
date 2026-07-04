# Task ID: 7 — Reports Integration (Subagent C)

## Agent
subagent-C (PHASE 4 — Real Invoice Engine integration)

## Task
Wire `src/components/reports/ReportsPage.tsx` to use REAL invoice engine data from the `useInvoices()` hook for the Revenue, Sales, Outstanding, GST Summary, and Cash Flow sections. **No visual UI changes** — same layout, same tables, same cards. Only the data sources were replaced.

## Files Modified
- `/home/z/my-project/src/components/reports/ReportsPage.tsx`

## Foundation reviewed before starting
- `/home/z/my-project/worklog.md` → `Task ID: invoice-engine-foundation` (built by main: types.ts, calculations.ts, service.ts, pdf.ts, index.ts + useInvoices.ts hook)
- `/home/z/my-project/src/lib/invoice-engine/index.ts` → barrel exports
- `/home/z/my-project/src/hooks/useInvoices.ts` → `{ invoices, stats, loading, error, saving, create, update, ... }`
- `/home/z/my-project/src/lib/invoice-engine/types.ts` → `Invoice` (grandTotal, taxableValue, cgst, sgst, igst, cess, paidAmount, balanceDue, status, paymentStatus, customerId, customerName, customerGstin, isInterState, invoiceDate) + `InvoiceStats` (count, totalRevenue, totalCollected, totalOutstanding, totalOverdue, totalTaxCollected, byStatus, byPaymentStatus)

## What changed

### 1. Imports (lines 39-53)
- Removed `useFireInvoices` from the `@/hooks/use-firestore` import
- Removed `FirestoreInvoice` from the `@/lib/firestore-schema` type import (no longer referenced)
- Added `import { useInvoices } from '@/hooks/useInvoices';`
- Kept `useFireReturns`, `useFireReconciliations`, `useLiveDashboardMetrics`, `useFireReports` per the directive

### 2. Hook wiring (lines 348-361)
- Replaced `const fireInvoicesQ = useFireInvoices();` + `fireInvoices` derivation with:
  ```ts
  const { invoices: engineInvoices, stats: invoiceStats, loading: engineLoading } = useInvoices();
  ```
- Kept `fireReturns`, `fireRecons`, `liveMetrics` as-is

### 3. Clients dropdown useEffect (lines 395-428)
- Now also includes engine invoices (`customerId`, `customerName`, `customerGstin`) so the client filter works against real engine data — without this the dropdown would only show legacy-API clients
- Added `engineInvoices` to the dependency array

### 4. Export Preview filter (lines 433-460)
- Replaced `filteredInvoices` derivation from the legacy `invoices` state (which uses old `clientId` / `period` / `gstr1Section` fields) to filter against `engineInvoices`:
  - `customerId` ↔ `selectedClientId`
  - `invoiceDate.slice(0, 7)` (YYYY-MM) ↔ `selectedPeriod` (YYYY-MM)
  - All real engine invoices map to GSTR-1 section `'b2b'` (inter-state → IGST, intra-state → CGST+SGST per the directive)
- `sectionPreviews` now aggregates the engine `taxableValue` / `cgst` / `sgst` / `igst` fields (same names on both schemas — only `totalAmount` → `grandTotal` differs, and that field isn't used here)
- `totalTaxableValue`, `totalTax`, `totalInvoices` now derived from `filteredInvoices` (engine-typed)

### 5. `gstSummary` useMemo (lines 476-502)
- Output tax liability (`outputTax`, `outputTaxable`) now computed from `engineInvoices` (filtering out `draft` and `cancelled` statuses — they don't represent real output tax)
- Returns-based fields (`gstr1Total`, `gstr1Filed`, `gstr1Pending`, `gstr3b*`) unchanged — still from `fireReturns`
- Dependency array: `[fireReturns, engineInvoices]`

### 6. `financialSummary` useMemo (lines 534-566)
- Filters `engineInvoices` to active (non-draft, non-cancelled)
- `totalRevenue` now sums `i.grandTotal` (was `i.totalAmount`)
- `totalTaxVolume`, `totalTaxable`, `igstTotal`, `cgstTotal`, `sgstTotal`, `cessTotal` now use engine fields directly (same names, no `|| 0` fallbacks needed — engine guarantees numbers)
- `bySection` now routes ALL active engine invoices into the `'b2b'` section; other GSTR-1 sections (`b2cl`, `b2cs`, `cdnr`, `cdnur`, `exp`) render empty (count 0, taxable 0, tax 0) — preserves the existing table shape
- `invoiceCount` now reflects active engine invoice count
- Dependency array: `[engineInvoices]`

### 7. `cashFlowSummary` useMemo (lines 568-608)
- Preserved ALL reconciliation-derived fields (`totalRecords`, `matched`, `unmatched`, `partial`, `highRisk`, `itcDifference`, `matchRate`, `byRecon`) — the on-page cards stay exactly the same
- ADDED invoice-engine-derived metrics:
  - `inflow` = `invoiceStats.totalCollected` (paid amounts)
  - `outstanding` = `invoiceStats.totalOutstanding`
  - `overdue` = `invoiceStats.totalOverdue`
  - `invoiceCount` = `invoiceStats.count`
- Dependency array: `[fireRecons, invoiceStats]`

### 8. `handlePrintCashFlow` PDF (lines 1173-1182)
- The "Cash Flow Impact" section now lists 5 rows instead of 1:
  - Cash Inflow (Collected), Outstanding, Overdue, Invoice Count, ITC Difference
- The on-page UI (cards + reconciliation runs table) is unchanged

### 9. Loading skeleton guard (line 1295)
- `if (loading)` → `if (loading || engineLoading)`
- Prevents the page from rendering with stale engine data while the real-time Firestore subscription is still warming up
- The skeleton itself is unchanged (same elements, same classes)

## Field-mapping summary (old → new)

| Old `FirestoreInvoice` field | New engine `Invoice` field | Notes |
| --- | --- | --- |
| `totalAmount` | `grandTotal` | Revenue base |
| `taxableValue` | `taxableValue` | Same |
| `cgst` / `sgst` / `igst` / `cess` | `cgst` / `sgst` / `igst` / `cess` | Same |
| `buyerGstin` | `customerGstin` | May be null |
| `buyerName` | `customerName` | Always present |
| `clientId` | `customerId` | May be null for ad-hoc invoices |
| `period` (YYYY-MM) | `invoiceDate.slice(0, 7)` | Engine stores ISO `YYYY-MM-DD` |
| `gstr1Section` | derived → `'b2b'` | All real engine invoices are B2B (inter-state IGST or intra-state CGST+SGST) |
| `invoiceType` | derived from `isInterState` | Inter-state = B2B-IGST; intra-state = B2B-CSST |
| `status` | `status` (`'draft' \| 'sent' \| 'partially_paid' \| 'paid' \| 'overdue' \| 'cancelled'`) | Drafts + cancelled excluded from financial/GST totals |

## What was NOT changed (per constraints)
- No visual UI changes — same cards, same tables, same layout, same colors, same shadcn components
- No new pages or routes
- `useFireReturns()`, `useFireReconciliations()`, `useLiveDashboardMetrics()` retained for non-invoice data
- Compliance tab and History tab data sources untouched
- The legacy `/api/invoices` fetch in `useEffect` is retained (it populates the client dropdown + drives the `loading` state alongside `engineLoading`)

## Validation
- `npx eslint src/components/reports/ReportsPage.tsx` → **0 errors, 0 warnings** (exit 0)
- Dev server log shows clean compilation with no errors after the edits
- File grew from 2348 → 2394 lines (net +46 lines from added comments + new cash-flow fields + expanded client useEffect)
