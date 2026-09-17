# Task 2: Schema Redesign Agent

## Task
Redesign the Prisma schema for production use — remove unused AI models, add missing production fields, align with frontend TypeScript types.

## What Changed

### Removed (9 models)
- AIPrediction, RiskScore, ComplianceForecast, ClientInsight, AITask, KnowledgeEntry, DocumentChatSession, ExecutiveReport, ClientBenchmark

### Also removed (legacy, not in MVP spec)
- HealthScore, Issue, TeamMember, TeamPerformance, WorkloadAssignment, Notice, AutomationRule, AutomationLog, FirmMetrics, ReconciliationResult

### Added (3 new models)
- **Firm** — multi-tenancy support (id, name, gstin, address, state, stateCode, phone, email, logoUrl, settings JSON)
- **FirmMember** — firm-user membership with role and permissions (id, firmId, userId, role, permissions JSON, invitedBy, joinedAt)
- **ClientGSTIN** — multiple GSTINs per client (id, clientId, gstin, isPrimary, registrationDate, cancellationDate)
- **Notification** — user notifications (id, firmId, userId, type, title, message, read, actionUrl)
- **InvoiceItem** — line items for invoices (id, invoiceId, lineNumber, hsnCode, description, quantities, tax breakdown)

### Renamed
- GSTRFiling → **Return** (matches TypeScript type name)

### Key Field Changes
- **Client**: added `businessName`, `legalName`, `filingFrequency`, `contactPerson`, `firmId`, `notes`; removed `healthScore`, `lastFilingDate`, `returnPeriod`, `tradeName`
- **Document**: added `fileName` (was `name`), `originalName`, `mimeType`, `storagePath`, `extractedData`, `errorMessage`, `processedAt`, `uploadedBy`, `firmId`; changed `fileType` values, `status` values (pending|processing|validated|failed)
- **Return** (was GSTRFiling): added `firmId`, `financialYear`, `jsonPayload`, `filedBy`; changed `filedDate` from String to DateTime
- **ReconciliationRun**: added `firmId`, `sourceA`, `sourceB`, `missingInBooks`, `missingInPortal`, `taxDifference`, `startedAt`; removed `sources`, `unmatched`, `partialMatches`, `highRisk`, `gstDifference`
- **Activity**: added `firmId`, `userId`, `metadata`; renamed `timestamp` → `createdAt`
- **AuditLog**: added `firmId`, `details` JSON, `ipAddress`
- **FirmSettings**: added `firmId` FK, `whatsappEnabled`, `autoBackup`, `retentionDays`; removed `firmName`

### Result: 25 → 16 models
All 16 models verified queryable. Database reset and pushed successfully. Lint passes. Dev server running.
