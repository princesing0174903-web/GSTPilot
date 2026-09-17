# Task 4: Dashboard Rebuild Agent

## Task
Rewrite DashboardPage.tsx to use Firebase Firestore hooks instead of old React Query API hooks.

## What Changed
- **File**: `src/components/dashboard/DashboardPage.tsx`
- **Before**: 1362 lines using `useDashboardMetrics`, `useClients`, `useFilings`, `useIssues`, `useUploadedFiles`, `useActivities`, `useUpdateFilingStatus` from `@/hooks/api`
- **After**: ~530 lines using `useLiveDashboardMetrics`, `useFireClients`, `useFireReturns`, `useFireRecentActivities` from `@/hooks/use-firestore` and `fileReturn` from `@/lib/firestore-service`

## Key Decisions
1. Used `useLiveDashboardMetrics()` as the primary data source for all 6 metric cards
2. Added `useFireClients()` for client name lookups in return items
3. Added `useFireReturns()` for the ready-to-file and upcoming deadlines sections
4. Added `useFireRecentActivities(10)` for the activity feed
5. Created `WelcomeEmptyState` component with Rocket icon for when `totalClients === 0`
6. Created `DashboardSkeleton` loading state
7. Added error state with retry button
8. `handleQuickFile` uses async `fileReturn()` from firestore-service instead of React Query mutation
9. Removed all old types (MetricCard, PriorityItem, ReadyToFileItem, BlockingIssue, RecentUpload) and replaced with inline computation from Firestore types
10. Removed `useFireInvoices`, `useFireDocuments`, `useFireUnreadNotifications` imports since the data they provide is already aggregated in `LiveDashboardMetrics`

## Lint Status
Zero errors on DashboardPage.tsx. The pre-existing lint error in `use-firestore.ts` is unrelated.

## Dependencies
- `@/hooks/use-firestore` — live Firestore hooks
- `@/lib/firestore-schema` — type definitions
- `@/lib/firestore-service` — write operations (fileReturn)
- `@/lib/gst-utils` — formatCurrency, periodToLabel, isOverdue, getFilingDueDate
- `@/contexts/AppContext` — navigation
- `sonner` — toast notifications
