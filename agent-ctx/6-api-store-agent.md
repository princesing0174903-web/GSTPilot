# Task 6: Create Real API Routes & Update Zustand Store

## Task ID
6

## Agent
API & Store Integration Agent

## Summary
Rewrote all core API routes to match the new 16-model Prisma schema, created API sync utilities, and updated the Zustand store to sync with the backend.

## Changes Made

### New Files Created
1. **`/src/lib/api.ts`** — Frontend API utility with typed helpers (`apiGet`, `apiPost`, `apiPatch`, `apiDelete`)
2. **`/src/app/api/clients/[id]/route.ts`** — Single client CRUD (GET, PATCH, DELETE)
3. **`/src/app/api/returns/route.ts`** — New Returns API (replaces old GSTRFiling model)
4. **`/src/app/api/activities/route.ts`** — Activities CRUD (GET, POST)
5. **`/src/app/api/notifications/route.ts`** — Notifications CRUD (GET, POST, PATCH with mark-all-read)

### Rewritten Core API Routes
6. **`/src/app/api/clients/route.ts`** — Complete rewrite:
   - GET: List clients with firmId/status/search filters, includes firm relation and _count aggregations
   - POST: Create client with firmId (required), GSTIN uniqueness check within firm, auto-creates activity log
7. **`/src/app/api/documents/route.ts`** — Complete rewrite:
   - GET: List with firmId/clientId/status/fileType/search filters, includes client & uploader relations
   - POST: Create with firmId (required), auto-versioning, creates activity log
   - PATCH: Update status with auto-set processedAt, creates activity for validated/failed transitions
   - DELETE: Delete by query param id
8. **`/src/app/api/reconciliation/route.ts`** — Complete rewrite:
   - GET: List with optional includeMismatches param
   - POST: Create run with firmId/clientId/period/returnType/sourceA/sourceB
   - PATCH: Complete run with stats and mismatches array
9. **`/src/app/api/seed/route.ts`** — Complete rewrite:
   - POST: Clear all data (respecting FK order for 16 models), optionally seed demo data
   - Demo data creates: 1 firm, 1 user, firm settings, 5 clients with GSTINs, documents, returns with events, reconciliation with mismatches, invoices, activities, notifications
10. **`/src/app/api/dashboard/route.ts`** — Complete rewrite:
    - Uses Return model instead of GSTRFiling, no HealthScore/Issue references
    - Calculates compliance %, document validation rate, match percentage
    - Provides filing calendar, monthly filing status, reconciliation summary
11. **`/src/app/api/invoices/route.ts`** — Updated:
    - Added firmId support, removed non-existent fields (riskLevel, riskScore, notes)
    - Uses new schema AuditLog with firmId
12. **`/src/app/api/filing-events/route.ts`** — Updated:
    - Uses `returnId` instead of `filingId`, `return` relation instead of `returnData`
    - Uses `createdAt` instead of `timestamp`
13. **`/src/app/api/audit-logs/route.ts`** — Updated:
    - Added firmId support, uses `createdAt` instead of `timestamp`
    - Includes user relation, businessName instead of tradeName
14. **`/src/app/api/firm-settings/route.ts`** — Updated:
    - Uses firmId-based upsert, removed firmName (now on Firm model)
    - Added whatsappEnabled, autoBackup, retentionDays fields
15. **`/src/app/api/gstr-filing/route.ts`** — Updated for backward compat:
    - Maps Return model to old "filing" response format
    - Uses Return unique constraint (firmId_clientId_returnType_period)
16. **`/src/app/api/gstr-filing/[id]/events/route.ts`** — Updated:
    - Uses returnId instead of filingId, createdAt instead of timestamp
17. **`/src/app/api/export/route.ts`** — Updated:
    - Uses Return instead of GSTRFiling, businessName instead of tradeName
    - Removed Issue/riskLevel references
18. **`/src/app/api/firm-operations/route.ts`** — Simplified to use current schema

### Stubbed Routes (return 501 or empty data)
These routes referenced deleted models and are now stubs:
- `/api/notices` — Notice model removed
- `/api/errors` — Issue model removed
- `/api/health-score` — HealthScore model removed
- `/api/firm-metrics` — FirmMetrics model removed
- `/api/team-members` — TeamMember model removed
- `/api/team-performance` — TeamMember/TeamPerformance models removed
- `/api/workload` — WorkloadAssignment model removed
- `/api/automation` — AutomationRule/AutomationLog models removed
- `/api/ai-benchmark` — ClientBenchmark model removed
- `/api/ai-doc-chat` — DocumentChatSession model removed
- `/api/ai-compliance` — ComplianceForecast model removed
- `/api/ai-cfo` — Referenced old models
- `/api/ai-insights` — Referenced old models
- `/api/ai-knowledge` — KnowledgeEntry model removed
- `/api/ai-reports` — ExecutiveReport model removed
- `/api/ai-risk` — RiskScore model removed
- `/api/ai-tasks` — AITask model removed

### Zustand Store Updated
**`/src/stores/gst-store.ts`** — Major update:
- Added `isLoading`, `isSyncing`, `syncError` state fields
- Added `syncAll()` — fetches all data from API in parallel
- Added individual sync methods: `syncClients`, `syncDocuments`, `syncReturns`, `syncReconciliation`, `syncActivities`, `syncNotifications`
- `loadDemoData()` now calls `/api/seed` with `{demo: true}` then syncs
- `clearDemoData()` now calls `/api/seed` with `{demo: false}`
- Mutation actions (addClient, updateClient, deleteClient, addReturn, updateReturnStatus) now call API and then sync
- Document and reconciliation mutations fire API calls (fire-and-forget pattern)
- Activity and notification logging syncs to API
- All async actions now return Promises

### Key Model Name Changes Applied
| Old Model | New Model | Notes |
|-----------|-----------|-------|
| GSTRFiling | Return | Unique constraint: firmId+clientId+returnType+period |
| FilingEvent.filingId | FilingEvent.returnId | FK to Return |
| FilingEvent.timestamp | FilingEvent.createdAt | Renamed field |
| Client.tradeName | Client.businessName | Renamed field |
| Client.healthScore | (removed) | No longer on Client |
| Client.address | (removed) | Use Firm.address |
| Document.name | Document.fileName | Renamed field |
| Document.isLatest | (removed) | No longer in schema |
| Document.folder | (removed) | No longer in schema |
| AuditLog.timestamp | AuditLog.createdAt | Standard field |
| Invoice.riskLevel | (removed) | Not in new schema |
| Invoice.riskScore | (removed) | Not in new schema |

## Verification
- ESLint passes with no errors
- TypeScript compilation passes for all API routes, store, and lib files
- Database synced with `db:push`
