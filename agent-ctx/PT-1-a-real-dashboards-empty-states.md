# PT-1-a — Real Dashboards & Empty States

## Mission Summary
Replace every fake value, mock response, placeholder, hardcoded number, dummy array, and demo workflow in DASHBOARD WIDGETS with REAL database-backed values. Add proper empty states with CTA buttons wherever lists render empty.

## Constraints
- DO NOT redesign the UI.
- DO NOT create new pages.
- DO NOT remove any existing feature.
- Keep every screen, animation, card, chart, and layout exactly as-is.
- Every value displayed must come from a real API/DB query.
- If no data exists → show a proper empty state ("No data yet") with a CTA button.

## API Inventory (existing endpoints verified 200)
- /api/dashboard — top-level metrics
- /api/clients — clients list
- /api/invoices — invoices list
- /api/returns — BROKEN (db.return.findMany error) — fall back to /api/dashboard.filedReturns / pendingReturns
- /api/reconciliation — reconciliation results
- /api/notices — legal/gst notices
- /api/payments — payments list
- /api/expenses — expenses list
- /api/payroll — payroll employees
- /api/documents — documents list
- /api/ai-cfo — CFO dashboard (revenue, profit, cash, receivables, etc.)
- /api/ai-insights — client insights
- /api/ai-risk — risk scores per client
- /api/ai-benchmark — benchmarks vs industry
- /api/ai-tasks — AI-generated tasks
- /api/analytics — monthly filing volume, etc.
- /api/ai-reports — AI-generated reports
- /api/audit-logs — audit log entries (filter by action=AUTONOMOUS_RUN_COMPANY for run history)
- /api/activities — recent activities
- /api/approvals — approvals queue
- /api/team-performance — leaderboard (may be empty)
- /api/workload — workload assignments (may be empty)
- /api/firm-metrics — firm metrics (returns null in this env)
- /api/firm-operations — totalRevenue, mrr, arr, etc.
- /api/executive-analytics — monthly revenue, client growth, profitability
- /api/autonomous/dashboard — autonomous enterprise state (revenue, expenses, gst, cash, banking, payroll, compliance, sales, receivables)
- /api/autonomous/simulations — simulation history
- /api/network/* — Global Enterprise Network dashboard
- /api/tds — TDS records

## Hooks Inventory (from /hooks/api.ts)
- useDashboardMetrics, useClients, useClient, useInvoices, useFilings, useReconResults, useReconRuns, useReconStats, useUploadedFiles, useNotifications, useAuditLogs, useIssues, useActivities, useNotices
- No hook for: ai-cfo, ai-risk, ai-benchmark, ai-insights, ai-tasks, analytics, firm-operations, executive-analytics, team-performance, workload, approvals, autonomous/*
- For those, I'll use direct `useQuery({ queryKey, queryFn: () => apiGet('/api/...') })`.

## EmptyState Shared Component
Located at /src/components/shared/EmptyState.tsx (already exists). Props:
- icon: LucideIcon
- title: string
- description: string
- action?: { label, onClick, variant?, icon? }
- secondaryAction?: { ... }
- compact?: boolean

## Navigation Hook
`useApp().setCurrentView(view)` from `/src/contexts/AppContext`. Used for CTA navigation.

## Strategy per file
See worklog for actual changes. I will:
1. Read each file
2. Find hardcoded data
3. Replace with useQuery hook
4. Add empty state where appropriate
5. Keep all animation/UX intact
6. Mark static marketing copy with comment

## Files (33 in scope)
See mission scope list above.
