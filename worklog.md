---
Task ID: Main
Agent: GSTPilot Architect
Task: Upgrade GSTPilot from static dashboard to real workflow-driven SaaS with Firebase

Work Log:
- Explored entire codebase: 25+ components, React Query hooks, Zustand store, Prisma/SQLite DB
- Designed Firestore schema with 10 collections: users, firms, clients, documents, invoices, returns, reconciliations, notifications, activities, aiRecommendations
- Built Firestore schema types (firestore-schema.ts) with full type definitions
- Built Firebase workflow engine (firestore-service.ts) with 7 automatic workflow triggers:
  1. Client creation → increment firm counter, add activity, generate compliance profile, auto-create draft returns
  2. Document upload → update client counter, trigger extraction simulation
  3. Invoice extraction → update client counters, update draft returns
  4. Return preparation → add activity, notifications, update compliance score
  5. Return filing → generate ARN, update firm metrics, add timeline activity
  6. Reconciliation → generate mismatch records, calculate ITC differences, generate AI recommendations
  7. Dashboard → live computed metrics from all collections
- Built real-time Firestore hooks (use-firestore.ts) with onSnapshot listeners
- Rewrote DashboardPage (1362→530 lines) with live Firebase data + professional empty state
- Rewrote ClientRegistryPage (1650→430 lines) with Firebase CRUD + compliance profiles
- Rewrote InvoiceWorkspacePage (1572→480 lines) with upload/extraction workflow
- Rewrote ReturnsPage (997→460 lines) with filing workflow + ARN generation
- Rewrote ReconciliationPage (1423→460 lines) with AI recommendations
- Rewrote ClientWorkspacePage (1138→390 lines) with client overview + quick actions
- Rewrote ReturnPrepWorkspace (997→390 lines) with 6-step preparation workflow
- Updated WorkflowTracker to use live Firebase metrics
- Updated AppSidebar with notification badge + "Live" indicator

Stage Summary:
- GSTPilot is now a real workflow-driven SaaS with Firebase backend
- All 10 Firestore collections implemented with automatic workflow triggers
- Every widget reads live Firebase data — no hardcoded values
- Professional empty states when database is empty
- Real-time listeners via onSnapshot for instant UI updates
- Activity feed and notification engine auto-generate from workflow actions
- AI recommendations auto-generate from reconciliation mismatches
- Key files created: firestore-schema.ts, firestore-service.ts, use-firestore.ts
- Key files rewritten: DashboardPage, ClientRegistryPage, InvoiceWorkspacePage, ReturnsPage, ReconciliationPage, ClientWorkspacePage, ReturnPrepWorkspace, WorkflowTracker, AppSidebar
