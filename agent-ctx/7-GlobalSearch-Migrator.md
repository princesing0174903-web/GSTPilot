# Task 7 — GlobalSearch Migrator

## Summary
Migrated `/home/z/my-project/src/components/search/GlobalSearch.tsx` from Zustand store (`useGSTStore`) to React Query hooks.

## Changes Made

### Data Source Migration
- **Removed**: `import { useGSTStore } from '@/stores/gst-store'`
- **Added**: `import { useClients, useInvoices, useFilings, useIssues } from '@/hooks/api'`
- **Replaced**: `const store = useGSTStore(); store.search(query)` → React Query hooks + local `useMemo` search

### Search Implementation
Local search logic via `useMemo` that filters across four data sources:
1. **Clients** — match on `tradeName`, `gstin`, `legalName`, `state`
2. **Invoices** (documents) — match on `invoiceNumber`, `buyerName`, `sellerGstin`, `buyerGstin`, `hsnCode`
3. **Filings** (returns) — match on `returnType`, `period`, `acknowledgmentNumber`, `status`
4. **Issues** (reconciliation) — match on `title`, `category`, `description`, `severity`

Results capped at 20 items.

### Bug Fixes
- `store.search(query)` was calling a method that didn't exist on the Zustand store — replaced with working implementation
- `searchOpen`/`setSearchOpen`/`navigateToClient` from `useApp()` didn't actually exist in AppContext — replaced:
  - `searchOpen`/`setSearchOpen` → local `useState`
  - `navigateToClient(id)` → `setSelectedClientId(id)` + `setCurrentView('client-workspace')`

### Loading State
Added `Loader2` spinner that shows while React Query data is fetching.

### UI Preserved
- Same Dialog layout, keyboard shortcuts (⌘K, ESC), AnimatePresence transitions
- Same TYPE_CONFIG with icons and colors
- Same footer with navigation hints

## Verification
- ESLint: zero errors
- Dev server: compiles successfully
