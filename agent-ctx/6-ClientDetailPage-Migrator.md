# Task 6 — ClientDetailPage Migrator

## Task
Migrate ClientDetailPage from Zustand store to React Query hooks

## Summary
Successfully migrated `/home/z/my-project/src/components/clients/ClientDetailPage.tsx` from Zustand (`useGSTStore`) to React Query hooks from `@/hooks/api.ts`.

## Changes Made
- Replaced `useGSTStore()` with 12 React Query hooks and mutations
- Adapted field names from store types to API Client type (tradeName, contactEmail, contactPhone, returnPeriod)
- Added Skeleton loading states for all 5 tabs
- Added EmptyState components for all empty data scenarios
- All mutations use proper error handling with try/catch and toast notifications
- Mutation buttons are disabled while pending
- Fixed react-hooks/rules-of-hooks by moving useCallback before early returns
- Zero Zustand references remain in any component file

## Hooks Used
- `useClient(id)` — client data
- `useUploadedFiles(clientId)` — documents
- `useFilings(clientId)` — returns
- `useReconRuns(clientId)` — reconciliation runs
- `useReconResults({ clientId })` — reconciliation mismatches
- `useActivities(clientId)` — activity timeline
- `useNotifications()` — notifications
- `useUpdateClient()` — edit client mutation
- `useCreateFiling()` — prepare return mutation
- `useUpdateFilingStatus()` — mark ready mutation
- `useFileReturn()` — file return mutation
- `useCreateReconRun()` — run reconciliation mutation
- `useUpdateReconWorkflow()` — resolve mismatch mutation
- `useUploadFile()` — upload document mutation
- `useDeleteDocument()` — delete document mutation

## Verification
- ESLint passes with zero errors
- Dev server compiles successfully
- No useGSTStore imports in any component file
