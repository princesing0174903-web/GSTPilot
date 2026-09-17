# Task 5: Update ReturnsPage.tsx to use Zustand store

## Agent: Main

## Changes Made

### Data Source Migration
- **Removed**: `MOCK_CLIENTS` array (8 hardcoded clients with IDs like `cl-sharma`, `cl-patel`)
- **Removed**: `MOCK_FILINGS` array (8 hardcoded filings with IDs like `fil-sharma-gstr1`, `fil-patel-gstr3b`)
- **Removed**: `SECTION_MAP` constant (replaced with dynamic computation from store invoices)
- **Removed**: `fetchFilings` async function and local `filings` state + `loading` state
- **Added**: `useGSTStore` import — component reads `store.filings`, `store.clients`, `store.filingInProgressIds`

### Deterministic ARN
- **Removed**: `Math.random()` from `handleFileReturn` ARN generation
- **Replaced with**: `store.fileReturn(filing.id)` which uses deterministic `idCounter`-based ARN

### Dynamic Health Metrics
- **Removed**: Hardcoded health score (72), filing timeliness (68%), data accuracy (85%), compliance (65%)
- **Replaced with**: Computed from `storeFilings` and `storeClients` using same logic as `store.getDashboardMetrics()`

### Section Breakdown
- **Removed**: Static `SECTION_MAP` with hardcoded values
- **Added**: `computeSectionsForFiling()` that derives section breakdown from actual store invoices

### Filing State Tracking
- **Added**: `store.filingInProgressIds.includes(filing.id)` checks alongside local `filingAction`
- Ready card and detail sheet both show loading state from store

### Cleanup
- Removed hardcoded ID checks in `getAttentionSummary` (`fil-patel-gstr3b`, `fil-apex-gstr1`)
- Removed unused imports: `useCallback`, `useEffect`
- Added imports: `useGSTStore`, `getFinancialYear`

## Lint: PASS (0 errors, 0 warnings)
