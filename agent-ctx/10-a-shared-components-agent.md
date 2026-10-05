# Task 10-a: Shared EmptyState & Constants Migration

## Summary

Updated 5 page components to use the shared `EmptyState` component from `@/components/shared` and the shared `INDIAN_STATES` / `ENTITY_TYPES` constants from `@/lib/constants`. Removed all fake/demo/mock data paths.

## Changes Per File

### 1. `src/components/returns/ReturnsPage.tsx`
- **Import**: Added `import type { LucideIcon } from 'lucide-react'` and `import { EmptyState } from '@/components/shared'`
- **Kanban Column Config**: Changed `icon` field from `React.ReactNode` (JSX elements) to `LucideIcon` references, added `iconClass: string` field for per-column icon styling
- **Column Header Rendering**: Updated to render icon via `<Icon className={colConfig.iconClass} />` instead of inline JSX
- **Kanban Empty State**: Replaced inline empty state (icon + text with `React.cloneElement`) with `<EmptyState icon={colConfig.icon} title={colConfig.emptyText} description="" compact />`
- No mock data present — all data comes from Zustand store

### 2. `src/components/reconciliation/ReconciliationPage.tsx`
- **Import**: Added `import { EmptyState } from '@/components/shared'`
- **Main Page Empty State**: Replaced inline empty state (GitCompareArrows icon, heading, description, button) with `<EmptyState icon={GitCompareArrows} title="No reconciliation data yet" description="..." action={{ label: 'Go to Invoices', onClick, icon: FileSpreadsheet, variant: 'outline' }} />`
- **Detail Panel Empty State**: Replaced inline "Select a mismatch to investigate" empty state with `<EmptyState icon={Eye} title="Select a mismatch to investigate" description="..." compact />`
- No mock data present — all data comes from Zustand store

### 3. `src/components/invoices/InvoiceWorkspacePage.tsx`
- **Import**: Added `import { EmptyState } from '@/components/shared'`
- **Removed `handleDemoUpload`** function (was: `simulateUpload(['GSTR1_Jun2025_SharmaEnt.json', 'SalesRegister_Jun2025.csv'])`) — no more sample/demo data injection
- **Removed "Try with sample data" button** from the upload drop zone area
- **Removed unused `Sparkles` import** from lucide-react
- **Empty State**: Replaced inline empty state (CloudUpload icon, heading, description, `handleDemoUpload` button) with `<EmptyState icon={CloudUpload} title="No documents uploaded yet" description="..." action={{ label: 'Upload Documents', onClick: handleBrowseClick, icon: Upload }} />`

### 4. `src/components/clients/ClientRegistryPage.tsx`
- **Import**: Added `import { EmptyState } from '@/components/shared'` and `import { INDIAN_STATES } from '@/lib/constants'`
- **Removed local `INDIAN_STATES`** array (was a partial 26-entry list; replaced with the complete 38-entry shared constant)
- **Empty State**: Replaced inline empty state (Building2 icon, heading, description, UserPlus button) with `<EmptyState icon={Building2} title="No clients yet" description="..." action={{ label: 'Add Your First Client', onClick: openAdd, icon: UserPlus }} />`

### 5. `src/components/settings/SettingsPage.tsx`
- **Import**: Added `import { EmptyState } from '@/components/shared'` and `import { INDIAN_STATES, ENTITY_TYPES } from '@/lib/constants'`
- **Removed local `INDIAN_STATES`** (was a plain string array; shared constant is `{ name, code }[]` — updated `SelectItem` mapping to use `state.code` as key and `state.name` as value/label)
- **Removed local `ENTITY_TYPES`** (shared constant includes additional 'Other' type)
- **Renamed** `MOCK_SESSIONS` → `SESSIONS`, `MOCK_API_CONNECTIONS` → `API_CONNECTIONS`, `MOCK_AUDIT_LOGS` → `AUDIT_LOGS` (all were empty arrays; "MOCK_" prefix was misleading)
- **Empty States** replaced with `EmptyState` (all `compact` mode):
  - Team members: `<EmptyState icon={Users} title="No team members yet" description="..." compact />`
  - Active sessions: `<EmptyState icon={Monitor} title="No active sessions" description="..." compact />`
  - Billing history: `<EmptyState icon={CreditCard} title="No billing history yet" description="..." compact />`
  - API connections: `<EmptyState icon={Globe} title="No API connections configured" description="..." compact />`
  - Audit logs: `<EmptyState icon={ClipboardList} title="No audit logs match this filter" description="..." compact />`

## Lint Result
All changes pass `bun run lint` with zero errors.
