# Task 4-b: Refactor ClientWorkspacePage and ReturnsPage to React Query

## Agent: api-refactor

## Task Summary
Refactored ClientWorkspacePage and ReturnsPage to use React Query (TanStack Query) API hooks instead of the Zustand store for all data operations.

## Key Changes

### ClientWorkspacePage.tsx
- **Removed**: `useGSTStore`, `SampleClient`, `SampleFiling`, `SampleValidationIssue`, `SampleAIInsight`, `SampleReconCategory`, `SampleUpload`, `SampleActivity` imports
- **Added**: React Query hooks from `@/hooks/api`: `useClient`, `useFilings`, `useInvoices`, `useIssues`, `useUploadedFiles`, `useAuditLogs`, `useReconRuns`, `useUploadFile`, `useCreateReconRun`
- **Data source change**: All data now comes from API routes via React Query instead of Zustand store
- **Client-side filtering**: Since some API routes return all records, filtering by `selectedClientId` is done in `useMemo`
- **New mapping functions**: `mapApiDocument()`, `mapApiReconRun()`, `mapAuditLogToEvent()`, `mapIssueToInsight()` to transform API responses to UI types
- **Empty states**: Added for Returns, Documents, Reconciliation, Activity, Pending Actions, AI Insights sections
- **Mutation handlers**: `handleUploadDocument()` and `handleRunReconciliation()` with proper mutation hooks

### ReturnsPage.tsx
- **Removed**: `useGSTStore` import
- **Added**: `useFilings`, `useClients`, `useInvoices`, `useUpdateFilingStatus`, `useFileReturn`, `useCreateFiling` from `@/hooks/api`
- **Filing mutation**: `handleFileReturn()` now uses `useFileReturn()` mutation with `onSuccess`/`onError` callbacks
- **Detail sheet**: Uses `useInvoices(selectedFiling?.clientId)` for section breakdown instead of `store.getInvoicesForClient()`
- **Filing progress tracking**: Uses `fileReturnMutation.isPending` instead of `store.filingInProgressIds`
- **Empty state**: Added for zero filings with "Create First Return" CTA

## Verification
- Lint passes cleanly
- Dev server compiles without errors
- No references to `useGSTStore`, `@/stores/gst-store`, or `@/data/sample-data` in either file
- Same emerald theme and visual design preserved
