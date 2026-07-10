# Task 3-a: React Query Provider & API Hooks

## Agent: api-hooks

## Summary
Created the React Query (TanStack Query) provider and comprehensive data-fetching hooks to replace Zustand store as the data source for all components.

## Files Modified
1. **`src/components/providers.tsx`** — Updated to include:
   - Changed `staleTime` from 60s → 30s
   - Added `ReactQueryDevtools` (from `@tanstack/react-query-devtools`)
   - Preserved all existing providers (ThemeProvider, AuthProvider, AppProvider, Toaster)

2. **`src/hooks/api.ts`** — New file with 25+ hooks:
   - `apiFetch<T>` generic fetch helper
   - `queryKeys` structured cache key factory
   - Dashboard: `useDashboardMetrics()`
   - Clients: `useClients()`, `useClient(id)`, `useCreateClient()`, `useUpdateClient()`, `useDeleteClient()`
   - Invoices: `useInvoices(clientId?)`, `useCreateInvoice()`, `useUpdateInvoice()`
   - GSTR Filings: `useFilings(clientId?, status?)`, `useCreateFiling()`, `useUpdateFilingStatus()`, `useFileReturn()`, `useFilingEvents(filingId)`
   - Reconciliation: `useReconResults(filters?)`, `useReconRuns(clientId?)`, `useReconStats(clientId?)`, `useCreateReconRun()`, `useUpdateReconWorkflow()`
   - Documents: `useUploadedFiles(clientId?)`, `useUploadFile()`, `useUpdateDocument()`, `useDeleteDocument()`
   - Notifications: `useNotifications()`, `useMarkNotificationRead()` (API route pending)
   - Audit Logs: `useAuditLogs(clientId?)`
   - Issues: `useIssues(clientId?)`, `useCreateIssue()`, `useUpdateIssue()`
   - Activities: `useActivities(clientId?)`
   - Notices: `useNotices(filters?)`, `useCreateNotice()`, `useUpdateNotice()`
   - Utility: `useInvalidateAll()`

## Package Added
- `@tanstack/react-query-devtools@5.101.0`

## Cache Invalidation Strategy
All mutation hooks invalidate:
1. The specific entity query (e.g., `queryKeys.clients.all`)
2. Related entity queries (e.g., dashboard after client changes)
3. Detail queries when a specific ID is known

## Lint & Build
- Lint passes cleanly
- Dev server compiles without errors
