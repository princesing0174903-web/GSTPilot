# Task 4-a: React Query Migration — DashboardPage & ClientRegistryPage

## Agent: react-query-migration

## Task
Refactor DashboardPage and ClientRegistryPage to use React Query (API routes) instead of the Zustand store.

## What was done

### DashboardPage.tsx
- Replaced `useGSTStore()` with 6 React Query hooks: `useDashboardMetrics()`, `useClients()`, `useFilings()`, `useIssues()`, `useUploadedFiles()`, `useActivities()`
- Replaced `store.fileReturn()` with `useUpdateFilingStatus()` mutation
- Replaced fake loading timer with React Query `isLoading`
- Added toast notifications for filing success/error via sonner
- Added empty states for all 6 sections
- Added Total Tax Volume and Avg Compliance summary strip
- Added Recent Activity section from audit logs
- Removed ALL Zustand and sample-data imports

### ClientRegistryPage.tsx
- Replaced `useGSTStore()` with `useClients()`, `useFilings()`, `useCreateClient()`, `useUpdateClient()`, `useDeleteClient()`
- Replaced `SampleClient` type with `Client` type from `@/types/gst`
- Updated `derivePortfolio()` to work with API `_aggregations` data
- Added loading skeleton via `PageSkeleton` component
- Added toast notifications for all CRUD operations
- Removed ALL Zustand and sample-data imports

## Key decisions
- Used `useUpdateFilingStatus()` for quick file action (sets status to 'filed')
- Used local state (`filingInProgressIds`, `filedReturnIds`) for tracking filing UI state
- Derived AI recommendations from issues + pending filings (no dedicated AI insights API)
- Used `useActivities()` which reads from audit-logs for the activity section
- Portfolio derivation uses `_aggregations` from clients API + filings from `useFilings()`

## Verification
- Lint passes cleanly
- Dev server compiles without errors
- No Zustand store references remain in either file
