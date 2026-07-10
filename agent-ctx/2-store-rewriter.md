# Task 2 — Store Rewriter

## Task: Rewrite Zustand store to start completely empty and delete sample-data.ts

## What was done:

### 1. Deleted `/src/data/sample-data.ts`
- 776-line file containing fake demo data (Sharma Enterprises, Patel & Sons, Krishna Traders, etc.)
- Included 10 type interfaces + sample data arrays + helper functions
- No longer needed since most components use React Query hooks from `@/hooks/api.ts`

### 2. Rewritten `/src/stores/gst-store.ts`
- **Removed** all imports from `@/data/sample-data`
- **Moved** 10 type interfaces inline into the store file (preserved exact same shapes):
  - SampleClient, SampleFiling, SampleInvoice, SampleValidationIssue
  - SampleReconDrilldown, SampleReconCategory, SampleAIInsight
  - SampleActivity, SampleBlockingIssue, SampleUpload
- **Added** `FilingStatus` import from `@/types/gst` (was previously transitively imported via sample-data)
- **Replaced** `getInitialState()` function (which loaded all sample data) with `EMPTY_STATE` constant
- **Changed** persist key from `'gstpilot-store'` to `'gstpilot-store-v3'` (forces clean start; old keys have demo data in localStorage)
- **Preserved** all action method signatures — fully API-compatible
- **Kept** `nextId()` helper and `getClientStateCode()` helper
- `resetStore()` now uses `EMPTY_STATE` instead of `getInitialState()`

### 3. Verification
- Zero remaining imports from `@/data/sample-data` in entire `src/` directory
- ESLint passes with zero errors
- Dev server compiles successfully
- The 2 remaining components that use the store (ClientDetailPage, GlobalSearch) are unaffected — they only import `useGSTStore` and use store methods, not the sample types directly

## Files changed:
- **Deleted**: `src/data/sample-data.ts`
- **Rewritten**: `src/stores/gst-store.ts`
