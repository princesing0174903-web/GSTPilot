# Task: GSTPilot Reconcile Page - Complete Rewrite

## What Was Done
- Complete rewrite of `/home/z/my-project/src/components/reconciliation/ReconciliationPage.tsx`
- Focused on simplicity: "Find mismatches → Fix them → File with confidence"
- Emerald/teal color theme (NO blue/indigo)

## Key Design Decisions

### Layout
1. **Header** - Title "Reconcile", subtitle, "Run Reconciliation" button (emerald)
2. **4 Summary Cards** - Match Rate (circular progress), Matched (green), Mismatches (amber), Unmatched (red)
3. **3 Tabs** - Overview, Mismatches, Unmatched
4. **2 Dialogs** - Resolve Dialog, Run Reconciliation Dialog

### Technical Stack
- `'use client'` component
- shadcn/ui components (Card, Badge, Button, Tabs, Table, Dialog, Select, Progress, RadioGroup, etc.)
- framer-motion for staggered card entrance and table row animations
- recharts for donut/pie chart in Overview tab
- `useApp()` from `@/contexts/AppContext` for client selection
- `formatCurrency` from `@/lib/gst-utils` for INR formatting
- lucide-react icons throughout

### Data Flow
- `GET /api/reconciliation` - fetches reconciliation results
- `GET /api/reconciliation?action=stats` - fetches aggregate stats
- `GET /api/reconciliation?action=runs` - fetches recent runs
- `GET /api/clients` - fetches client list
- `POST /api/reconciliation` - runs reconciliation, updates workflow

### Features
- Circular progress indicator for match rate with color coding (green >90%, amber >70%, red <70%)
- Animated donut chart showing Match/Mismatch/Unmatched distribution
- Client-wise reconciliation summary table with "View" action
- Recent reconciliation runs table
- Filterable mismatches table with mismatch type badges
- Unmatched invoices table with "Link Manually" and "Ignore" actions
- Resolve dialog showing GSTR-1 vs GSTR-2A/2B side-by-side comparison
- Radio buttons: Accept GSTR-1, Accept GSTR-2A, Custom Amount
- Run Reconciliation dialog with client/period/source selectors and progress bar
- Search functionality across both Mismatches and Unmatched tabs
- Skeleton loader during initial data fetch

### No Changes Made To
- API routes (already existed and working)
- AppContext (already had `selectedClientId`, `setSelectedClientId`)
- gst-utils (already had `formatCurrency`)
- page.tsx (already wired up to render ReconciliationPage)
