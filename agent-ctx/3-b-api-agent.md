# Task 3-b: API Routes — Work Record

## Agent: API Agent
## Task ID: 3-b

## Summary
Created 5 API routes for the GSTPilot project, all using Prisma ORM (`import { db } from '@/lib/db'`) and proper AuditLog entries on mutations.

## Routes Created/Updated

### 1. `/api/notifications/route.ts`
- **GET**: Fetch notifications with filters (userId, isRead, category, limit=20, offset). Returns `{ notifications, unreadCount }`
- **POST**: Create notification with AuditLog entry. Returns `{ notification }`
- **PATCH**: Mark read/dismissed with AuditLog entry. Returns `{ notification }` (the updated object)
- Migrated from raw SQL to Prisma ORM

### 2. `/api/upload/route.ts`
- **POST**: Upload file with processing pipeline using exact spec timings:
  - Initial: status="uploaded", processingStep="upload", progress=0
  - After 1s: status="processing", processingStep="parsing", progress=20
  - After 3s: processingStep="extracting", progress=50
  - After 5s: processingStep="validating", progress=80
  - After 7s: status="completed", processingStep="completed", progress=100, invoicesCreated=0
  - On failure: status="failed", errorMessage="..."
  - Creates AuditLog on upload
- **GET**: Fetch files with clientId, status filters. Returns `{ files }`
- Migrated from raw SQL to Prisma ORM

### 3. `/api/analytics/route.ts`
- **GET**: Fetch analytics data from real database:
  - `monthlyFilingVolume`: Last 6 months from GSTRFiling with filed/pending/overdue counts
  - `taxCollected`: From Invoice sums including `cess` field and `total`
  - `complianceTrend`: From HealthScore averages or Client.healthScore fallback
  - `clientHealthDistribution`: Bucket clients by healthScore ranges (0-20, 21-40, 41-60, 61-80, 81-100)
  - `invoiceProcessingVolume`: From Invoice counts with total/validated/errors
  - `lateFeeExposure`: Estimated from overdue filings using getFilingDueDate()
- Added `cess` field to taxCollected
- Added `getLastNMonths` helper for consistent 6-month chart data
- Uses `getFilingDueDate` from gst-utils for late fee calculations

### 4. `/api/health-score/route.ts`
- **GET**: Calculate health score for a client (clientId required)
  - Counts missingGstin, invalidGstin, duplicateInvoices, filingDelays, validationErrors from DB
  - Uses `calculateHealthScore` from `@/lib/gst-utils`
  - Updates `client.healthScore` in DB
  - Creates or updates `HealthScore` record for current period
  - Returns `{ score, breakdown: { missingGstin, invalidGstin, duplicateInvoices, filingDelays, validationErrors } }`
- Removed the no-clientId GET and POST endpoints per spec (only GET with required clientId)

### 5. `/api/gstr-filing/[id]/file/route.ts`
- **POST**: File a return (simulated)
  - ARN format: "AA" + date digits + random 6 digits (per spec)
  - Updates filing: status="filed", filedDate=today, acknowledgmentNumber=ARN
  - Creates FilingHistory with previousStatus, newStatus="filed"
  - Creates FilingEvent with eventType="filed"
  - Creates Notification for the client
  - Creates AuditLog
  - Returns `{ filing, acknowledgmentNumber }`
- Migrated from raw SQL to Prisma ORM

## Verification
- All routes pass ESLint with 0 errors, 0 warnings
- Dev server confirms routes compile and respond correctly
- No test files created
- No frontend components modified
