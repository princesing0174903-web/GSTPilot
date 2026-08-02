# GSTPilot — Complete Product Audit & Roadmap
*Generated in Product Mode. No code modified. This is a strategic document.*

---

## EXECUTIVE SUMMARY — THE BRUTAL TRUTH

You built a **feature factory**, not a product. The numbers tell the story:

| Metric | Count | Reality |
|---|---|---|
| Total TypeScript code | **660,481 lines** (309k TSX + 351k TS) | Massive surface area, impossible to maintain |
| Prisma models in schema | **285** | Only ~15 are heavily used; ~100 are orphaned |
| API route files | **751** | Only **132 (17.5%)** touch Prisma. **619 (82.5%)** are stubs/delegators |
| AppView types declared | **~200** | Only **24** are in `REAL_VIEWS`. The rest route to `FeaturePlaceholder` |
| Component directories | **~80** | Most contain beautiful shells with no real data |
| Hooks using `gstpilot-data` (demo) | **27** | Demo data leaks into "production" views |
| Hooks fetching real API | **15** | The actual production surface |
| API routes using `z-ai-web-dev-sdk` (real AI) | **17** | Most "AI" features are rule-based heuristics |
| "Coming Soon" / placeholder strings | **35+ files** | Honest placeholders, but they litter the nav |

**The single most damaging fact:** `generateGstr1Data(gstin, period)` in `src/lib/gstn/client.ts` **fabricates** 12–30 fake B2B invoices using a string hash, then "files" them as a GST return. The entire GST filing pipeline — the supposed core of an Indian finance OS — runs on seeded random numbers, not real invoice data sitting in the same database.

**The product is a museum of beautiful screens.** A CA cannot file a real GST return. A business owner cannot reconcile a real bank statement against real invoices. Oracle can chat, but cannot act on real books. We are going to fix this by picking **one workflow** and making it perfect.

---

# PHASE 1 — COMPLETE MODULE AUDIT

## 1A. The Module Status Table

Legend:
- **UI** = UI Complete (✅ polished / ⚠️ partial / ❌ placeholder)
- **BE** = Backend Complete (✅ Prisma + real API / ⚠️ stub service / ❌ none)
- **Prod** = Production Ready (✅ yes / ⚠️ demo only / ❌ no)
- **Missing** = what it lacks

### CORE FINANCIAL MODULES

| Module | UI | BE | Prod | Missing |
|---|---|---|---|---|
| **Dashboard / Home** | ✅ | ✅ Prisma (Business Snapshot) | ⚠️ demo org data | Real per-tenant KPIs; sticky-footer layout is fine |
| **Clients (CRM)** | ✅ | ✅ Prisma `/api/clients` | ✅ | Bulk import; GSTIN auto-verify from GSTN (currently manual) |
| **Client Workspace** | ✅ | ✅ Prisma | ✅ | Real activity feed (currently snapshot-derived) |
| **Invoices** | ✅ | ✅ Prisma `/api/invoices` | ✅ | IRN/e-invoice (placeholder); real PDF generation exists |
| **Invoice Cloud** | ✅ | ⚠️ alias | ⚠️ | Duplicate of invoices; should be removed or merged |
| **Returns (list)** | ✅ | ✅ Prisma | ✅ | — |
| **Return Prep** | ✅ | ⚠️ Firestore + fabricated | ❌ | **Uses `generateGstr1Data()` — FAKE. Must read real invoices** |
| **GSTR-1 Filing** | ✅ | ❌ fabricates data | ❌ | Real invoice aggregation; real GSTN API; real JSON payload |
| **GSTR-3B Filing** | ✅ | ❌ fabricates data | ❌ | Same as GSTR-1 |
| **Reconciliation (2A/2B)** | ✅ | ⚠️ partial | ⚠️ | GSTR-2B sync is stubbed; matching logic is real but on fake 2B data |
| **Banking (new)** | ✅ | ✅ Prisma + MockProvider | ⚠️ mock bank | Setu adapter is a stub; data is real in DB but bank is fake |
| **Banking Intelligence** | ✅ | ⚠️ service-layer | ⚠️ | Duplicate of Banking; older mock-only architecture |
| **Expenses** | ✅ | ⚠️ Firestore demo | ⚠️ | Should migrate to Prisma like Clients/Invoices did |
| **Payments** | ✅ | ⚠️ Firestore demo | ⚠️ | Same — migrate to Prisma |
| **Vendors** | ✅ | ⚠️ Firestore demo | ⚠️ | Same |
| **Products / Inventory** | ✅ | ⚠️ Firestore demo | ⚠️ | Same |
| **CRM (old gstpilot-data)** | ✅ | ⚠️ Firestore demo | ⚠️ | Superseded by real Clients view; should be removed |

### AI / ORACLE LAYER

| Module | UI | BE | Prod | Missing |
|---|---|---|---|---|
| **Oracle Brain (chat)** | ✅ | ✅ z-ai-web-dev-sdk streaming | ✅ | Tool execution loop; persistence of actions taken |
| **AI CFO** | ✅ | ⚠️ reads snapshot | ⚠️ | Real ledger data; currently derived from Business Snapshot |
| **AI Business Copilot** | ✅ | ⚠️ reads snapshot | ⚠️ | Duplicate of Oracle Brain; should merge |
| **Oracle Intelligence Core** | ✅ | ⚠️ orchestrator aggregates stubs | ❌ | 17 "AI modules" registered but most delegate to fake engines |
| **Oracle Chat (legacy)** | ✅ | ⚠️ | ❌ | Superseded by Oracle Brain; remove |
| **Oracle AI Workspace** | ✅ | ⚠️ | ❌ | Another Oracle variant; consolidate |
| **Oracle CFO (separate)** | ✅ | ⚠️ | ❌ | Yet another Oracle variant; consolidate |
| **AI Insights / Predictions / Risk / Compliance / Reports / Tasks / Benchmark / Knowledge / Doc-Chat** | ✅ each | ⚠️ each | ❌ each | **9 separate "AI" pages, all rule-based or stub. Massive duplication.** |
| **OCR / Invoice Extraction** | ✅ | ✅ z-ai-web-dev-sdk VLM | ✅ | Wired into invoice import; real |
| **TTS / ASR / Transcribe / Speak** | ✅ | ✅ z-ai-web-dev-sdk | ✅ | Real; used by Oracle voice |
| **AI Software Factory** | ✅ | ⚠️ | ❌ | "Self-building software" — pure marketing, no real output |
| **Autonomous Enterprise** | ✅ | ⚠️ | ❌ | "Self-running business OS" — fake autonomy |
| **Digital Twin** | ✅ | ⚠️ | ❌ | Simulations are canned |
| **Agent OS** | ✅ | ⚠️ | ❌ | No real agent execution |
| **AGI Dashboard** | ✅ | ⚠️ | ❌ | Aspirational; no real AGI |

### INTEGRATIONS

| Module | UI | BE | Prod | Missing |
|---|---|---|---|---|
| **Google Workspace** | ✅ | ✅ real OAuth | ✅ | Gmail/Calendar/Drive/Sheets — real |
| **Zoho Books** | ✅ | ✅ real OAuth + sync | ✅ | Customers sync real |
| **GSTN Connect** | ✅ | ⚠️ OTP flow stubbed | ❌ | Real GSTN OTP API; real session persistence |
| **Banking Connect (Setu)** | ✅ | ❌ MockProvider | ❌ | Setu adapter is a placeholder class |
| **Account Aggregator** | ✅ | ❌ | ❌ | Pure stub |
| **UPI Connect** | ✅ | ❌ | ❌ | Pure stub |
| **Tally / QuickBooks / Perfios / Finvu** | ❌ | ❌ | ❌ | Only UI references; no adapters |
| **WhatsApp / Gmail Communication** | ✅ | ⚠️ | ❌ | Templates exist; no real sending |
| **ERP Sync** | ✅ | ❌ | ❌ | Stub |

### PLATFORM / INFRA (mostly placeholders)

| Module | UI | BE | Prod | Missing |
|---|---|---|---|---|
| **Settings** | ✅ | ✅ Prisma | ✅ | Real |
| **Auth (Firebase + fallback)** | ✅ | ✅ | ✅ | Real, with demo mode |
| **Org Context (multi-tenant)** | ✅ | ✅ | ✅ | Real |
| **Permissions / RBAC** | ✅ | ⚠️ | ⚠️ | Basic; no advanced RBAC despite a page for it |
| **Audit Logs** | ✅ | ✅ Prisma | ✅ | Real |
| **Team Management** | ✅ | ⚠️ | ⚠️ | Partial |
| **Billing / Subscriptions** | ✅ | ⚠️ stub | ❌ | No real payment provider |
| **App Marketplace** | ✅ | ❌ | ❌ | Pure UI |
| **White Label** | ✅ | ❌ | ❌ | Pure UI |
| **Developer Platform / API Gateway / Ecosystem** | ✅ | ❌ | ❌ | Pure UI |
| **Global Expansion (12 views)** | ✅ each | ❌ each | ❌ each | Multi-country accounting, multi-currency, etc. — all placeholders |
| **Global Financial Cloud (16 views)** | ✅ each | ❌ each | ❌ each | All placeholders |
| **Enterprise Command Center (7 views)** | ✅ each | ❌ each | ❌ each | All placeholders |
| **Autonomous Finance OS (7 views)** | ✅ each | ⚠️ each | ❌ each | Smart Reconciliation, Predictive Compliance, etc. — shells over the same mock data |

### TOTALS

- **Genuinely production-ready modules: 9** (Auth, Org, Settings, Clients, Invoices, Returns-list, Audit Logs, Google Workspace, Zoho Books, Oracle Brain chat, OCR, Banking-DB-layer)
- **Demo-only modules: 8** (Expenses, Payments, Vendors, Products, CRM-old, AI-CFO, AI-Copilot, Banking-intelligence)
- **Fake / fabricated modules: 4** (GSTR-1 filing, GSTR-3B filing, Return Prep data, Banking "live")
- **Pure placeholder modules: ~80+** (everything in Global Expansion, Global Cloud, Enterprise Command, Autonomous Finance, App Marketplace, Developer Platform, etc.)

---

## 1B. What is Duplicated (the "many Oracles" problem)

The same domain concept is implemented **3–5 times** across different folders:

| Concept | Implementations | Action |
|---|---|---|
| Oracle AI chat | `oracle/OracleBrain.tsx`, `oracle-chat/`, `oracle-ai/`, `oracle-cfo/`, `ai-business-copilot/`, `finos/` | Keep `OracleBrain`; delete rest |
| Banking | `banking/` (new Prisma), `banking-intelligence/` (old mock), `banking-intel/` API | Keep `banking/`; delete others |
| Clients/CRM | `clients/ClientRegistryPage` (Prisma), `gstpilot-data/CustomersView` (Firestore), `crm/CRMPage` | Keep `ClientRegistryPage`; delete others |
| Invoices | `invoices/InvoiceWorkspacePage` (Prisma), `gstpilot-data/InvoicesView` (Firestore), `invoice-cloud/` | Keep `InvoiceWorkspacePage`; delete others |
| GSTR filing | `gstr/GSTRFilingPage`, `returns/ReturnPrepWorkspace`, `gstr-filing/` API | Consolidate into one |
| AI insights | `ai-insights/`, `ai-reports/`, `ai-compliance/`, `ai-risk/`, `ai-tasks/`, `ai-benchmark/`, `ai-knowledge/`, `ai-predictions/`, `ai-doc-chat/` | 9 pages → fold into Oracle Brain as tools |

## 1C. What is Disconnected

- **GSTR-1 filing does not read the Invoice table.** This is the #1 disconnect. `db.invoice` has 304 query sites across the app, but the filing pipeline ignores it entirely and fabricates data.
- **Banking reconciliation does not write back to Invoice status.** A reconciled bank transaction should mark the corresponding invoice as paid — this link is missing.
- **Oracle Brain cannot execute actions.** It can chat and suggest, but a user saying "create an invoice for Acme Corp for ₹50,000" does not actually create one. The tool-execution loop is incomplete.
- **OCR extraction does not feed the Invoice table.** Real OCR exists (`ocr.service.ts` uses VLM), but extracted invoices are not persisted as `db.invoice` records — they sit in a separate upload flow.
- **Audit Log is written on mutations but never read in the UI.** The timeline page reads from Firestore, not the Prisma `AuditLog` table.

## 1D. What is Unnecessary

Everything in these navigation groups should be **disabled** (not redesigned — just hidden from nav, routing to placeholder):

- **Phase 14 — Global Expansion** (12 views): multi-country, multi-currency, international banking, global compliance, etc. Zero Indian business pays for this on day one.
- **Phase 16 — Global Financial Cloud** (16 views): developer platform, API gateway, app marketplace cloud, data warehouse, event streaming, etc. This is platform-engineering cosplay.
- **Phase 13 — Enterprise Command** (7 views): multi-company workspace, advanced RBAC, cross-company analytics. Premature.
- **Phase Delta — Autonomous Finance OS** (7 views): smart reconciliation, predictive compliance, intelligent collections. These are marketing names for features that should just be parts of Banking + Oracle.
- **AI Software Factory, Autonomous Enterprise, AGI, Digital Twin, Agent OS, Business Graph, Economic Graph, Economic War Room, Run My Company, Run My Business, Run India Business, Mission Control, Business DNA, Universal Business ID, Credit Scoring Engine, Invoice Exchange, Financing Marketplace, Network Effects, Data Moat, Embedded Finance, Working Capital, Industry Benchmark, Executive War Room** — all ~25 "vision" modules. None have real backends.

---

# PHASE 2 — DEFINE THE CORE PRODUCT

## The Product Statement

**GSTPilot is the AI Financial Operating System for Indian Businesses.**

Not a dashboard. Not a CRM. Not an analytics tool. An **operating system** — meaning it *executes* the financial work, end to end, with an AI brain (Oracle) that can read the books, reason about them, and take action.

Everything else (dashboard, CRM, returns, invoices, analytics) is a **supporting module** that exists to feed the operating system.

## The 5 Highest-Value Workflows

These are the workflows a CA or business owner would **pay ₹2,000–₹10,000/month** for. Ranked by willingness-to-pay × frequency × pain-removed.

### Workflow 1 — Invoice → GST Return (Auto-Filing) ⭐ HIGHEST VALUE
**Why:** Every Indian business files GSTR-1 and GSTR-3B every month. It is mandatory, error-prone, and time-consuming. CAs charge ₹2,000–5,000 per client per month for this.
**Flow:** Upload/create invoices → Oracle validates GSTIN + HSN + rates → aggregate by B2B/B2C/Exports → generate GSTR-1 JSON → file via GSTN API → download ARN → mark filed.
**Pain removed:** 4–8 hours/month → 5 minutes/month.

### Workflow 2 — Purchase Bill → Input Tax Credit (ITC) Reconciliation
**Why:** GSTR-2B reconciliation determines how much ITC a business can claim. Mismatches cost real money (lost credit or penalty). CAs spend 2–3 days/month on this.
**Flow:** Upload vendor bills (OCR) → fetch GSTR-2B from GSTN → match bill-to-2B line items → flag mismatches (missing in 2B, missing in books, rate mismatch, amount mismatch) → Oracle explains each mismatch → action (follow up with vendor / claim / defer).
**Pain removed:** 2–3 days/month → 30 minutes/month.

### Workflow 3 — Bank Statement → Reconciliation → Ledger
**Why:** Every business reconciles bank statements against invoices/expenses monthly. Currently manual in Tally/Excel.
**Flow:** Import bank statement (CSV/Excel or Setu API) → auto-match to invoices (fuzzy on amount + date + counterparty) → Oracle resolves unmatched (suggests category, detects duplicates, flags fraud) → approve → ledger entry written → GST payment status updated.
**Pain removed:** 1–2 days/month → 15 minutes/month.

### Workflow 4 — Notice / Compliance Alert → Response
**Why:** GST notices (ASMT-10, DRC-01, intimation for mismatch) are terrifying to business owners. They pay CAs ₹5,000–25,000 per notice to respond.
**Flow:** Notice arrives (upload PDF or sync from GSTN) → Oracle reads + classifies + summarizes → identifies root cause (which invoice/return triggered it) → drafts response with legal basis → CA reviews → file response → track deadline.
**Pain removed:** Panic + ₹15,000 → calm + ₹0 (subscription covers it).

### Workflow 5 — Month-End Close → Financial Snapshot → Oracle Briefing
**Why:** Business owners want to know "how did we do this month?" without reading a P&L. CAs want to give clients a monthly review.
**Flow:** Trigger month-end close → Oracle aggregates all invoices, expenses, payments, bank transactions → computes real P&L, cash flow, GST liability, ITC position → generates a 1-page briefing with 3 insights + 2 recommendations → optionally sends to owner via WhatsApp/email.
**Pain removed:** 1 day of CA work → 2 minutes of Oracle work.

---

# PHASE 3 — PICK ONE WORKFLOW

## Recommendation: Workflow 1 — Invoice → GST Return (Auto-Filing)

### Why this one

1. **It is the highest-frequency, highest-pain, highest-willingness-to-pay workflow** for the exact buyer (CA + business owner).
2. **It exercises the entire stack**: Invoice DB → Oracle reasoning → GSTN API → PDF/JSON generation → Audit Log. Making it perfect forces every layer to become production-grade.
3. **It exposes the biggest fake feature** (`generateGstr1Data`), so fixing it delivers immediate honesty value.
4. **It has a clear "done" definition**: a real GSTIN files a real GSTR-1 with real invoice data and gets a real ARN.
5. **It is the gateway to Workflow 2 and 5** (2B reconciliation needs filed GSTR-1; month-end close needs filed returns).

### The Perfect Workflow (Stage 1 target)

```
[1] Invoice exists in Prisma (created via UI, OCR upload, or Zoho sync)
        ↓
[2] Oracle validates each invoice:
      • GSTIN format + active status (GSTN search API)
      • HSN code valid for category
      • Tax rate matches HSN × state (CGST/SGST vs IGST)
      • Place of supply correct
      • Invoice number format compliant
        ↓
[3] Aggregate into GSTR-1 sections:
      • B2B (GSTIN-wise)
      • B2CL (>₹50k inter-state B2C)
      • B2CS (small B2C)
      • Exports (with/without payment)
      • Credit/Debit notes
      • Advances received
      • Nil-rated / exempt
        ↓
[4] Generate the official GSTR-1 JSON payload (per GSTN spec)
        ↓
[5] Oracle pre-flight check:
      • Total tax liability vs cash ledger
      • Any invoice missing mandatory fields
      • Any duplicated invoice numbers
      • Any GSTIN marked as cancelled/suspended
        ↓
[6] File via GSTN API (sandbox first, then production):
      • POST /returns/gstr1 (save)
      • POST /returns/gstr1 (submit)
      • POST /returns/gstr1 (file with OTP/EVC)
        ↓
[7] Receive ARN + acknowledgement
        ↓
[8] Persist filing record in Prisma (GSTRFiling table — already exists, 111 query sites)
        ↓
[9] Mark all source invoices as "filed in GSTR-1 YYYY-MM"
        ↓
[10] Write AuditLog entry (actor, timestamp, GSTIN, period, ARN, invoice count, tax amount)
        ↓
[11] Oracle confirmation + next-action suggestion:
       "GSTR-1 for July 2025 filed. ARN: AB123456789012.
        47 invoices, ₹4,82,000 tax liability.
        Next: GSTR-3B due Aug 20. Want me to prepare it?"
        ↓
DONE
```

### What "perfect" means (acceptance criteria)

- [ ] Every number in the filed return traces back to a real `db.invoice` row.
- [ ] Filing fails loudly if any invoice is invalid (no silent skip).
- [ ] The same invoice can never be filed twice (idempotency via `filedPeriod` field).
- [ ] A real GSTN sandbox ARN is returned (not fabricated).
- [ ] The entire flow is reversible up to the final "File" button.
- [ ] Every step is logged to AuditLog with a human-readable description.
- [ ] Oracle can answer "why is my GSTR-1 tax ₹4,82,000?" by showing the invoice-level breakdown.
- [ ] A CA can review the draft before filing (human-in-the-loop).
- [ ] The filing record is queryable: "show me all GSTR-1 filings for Q1 FY26".

### What we ignore (for now)

- GSTR-2B reconciliation (Workflow 2 — next stage)
- GSTR-3B (depends on GSTR-1 being real first)
- E-invoicing (IRN) — separate workflow, later stage
- TDS, ROC, Payroll, Accounting — all out of scope until core filing is perfect
- Every placeholder module — leave disabled

---

# PHASE 4 — REMOVE FAKE FEATURES

**Rule: Do NOT redesign. Disable cleanly.** Each fake feature gets one of two treatments:

### Treatment A — Hide from navigation (nav item removed)
For features that have a UI but no real backend and no path to becoming real in 90 days.

### Treatment B — Replace with honest empty state (nav stays, page shows "Not available")
For features that are core to the product promise but not yet built. The page explains *what* it will do and *when*.

## The Disable List

### Tier 1 — Delete the data fabrication (CRITICAL — do first)

| File | Offense | Action |
|---|---|---|
| `src/lib/gstn/client.ts` → `generateGstr1Data()` | Fabricates 12-30 fake invoices for GSTR-1 | **Replace** with real aggregation from `db.invoice` |
| `src/lib/gstn/client.ts` → `generateGstr3bData()` | Fabricates GSTR-3B data | Same — derive from real invoices + ITC |
| `src/lib/gstn/gstr2b.ts` | Fabricates 2B data | Replace with real GSTN 2B fetch (sandbox) |
| `src/lib/banking-service/mock-provider.ts` | Mock bank returns fake transactions | **Keep** (it's an honest mock) but label clearly as "Demo Bank" in UI |
| Any `Math.random()` or `hashStr()` based "data generation" in lib/ | Fake data | Audit and replace with real DB reads |

### Tier 2 — Hide nav items (remove from `navigation-registry.ts`)

These ~60 nav items route to placeholders or fake-feature pages. **Remove them from the sidebar.** The component files can stay (dead code is cheaper than confusion), but the user must not see them.

**Global Expansion (12):** multi-country-accounting, multi-tax-engine, multi-currency-system, international-banking, global-compliance-engine, international-erp, multi-language-platform, ai-global-advisor, global-dashboard, cross-border-payments, international-reports, global-performance

**Global Financial Cloud (16):** global-financial-cloud, developer-platform, enterprise-api-gateway, app-marketplace-cloud, global-integration-hub, financial-data-cloud, event-streaming, automation-studio, data-warehouse, global-identity, developer-analytics, enterprise-billing, multi-tenant-infra, enterprise-security-cloud, global-financial-network, platform-intelligence

**Enterprise Command (7):** enterprise-command-center, multi-company-workspace, team-collaboration, workflow-engine, enterprise-documents, executive-calendar, enterprise-search, enterprise-notifications, advanced-rbac, cross-company-analytics, enterprise-audit

**Autonomous Finance OS (7):** autonomous-finance, workflow-studio, oracle-actions, financial-intelligence, smart-reconciliation, predictive-compliance, intelligent-collections

**Vision modules (~25):** ai-software-factory, autonomous-enterprise, enterprise-cloud-platform, enterprise-ai-platform, global-enterprise-network, business-dna, digital-twin, agent-os, event-engine, decision-engine, app-store, gstpilot-network, data-cloud, run-india-business, universal-business-id, credit-scoring-engine, invoice-exchange, financing-marketplace, economic-graph, economic-war-room, run-my-company, run-my-business, executive-war-room, business-graph, data-moat, embedded-finance, working-capital, industry-benchmark, network-effects, mission-control, multi-firm, autopilot

**AI duplication (9 → fold into Oracle Brain):** ai-reports, ai-compliance, ai-risk, ai-insights, ai-tasks, ai-benchmark, ai-knowledge, ai-doc-chat, ai-predictions, ai-operating-room, ai-priority-engine, ai-ca-manager, ai-account-manager, ai-deadline-engine, ai-document-employee, ai-voice-assistant, ai-firm-memory

**Platform / marketplace:** marketplace, white-label, client-portal, billing (keep billing nav but mark "coming soon"), version-history, esignatures, agents, generate, api-platform-v2, automation-center, audit-resolution

### Tier 3 — Keep nav, show honest empty state

These are core to the product promise. Keep them visible but honest:

- **Banking** → "Connect your bank via Setu (coming Q1). Demo data shown."
- **E-Invoicing** → "Generate IRN for invoices above ₹5 lakh (coming after GSTR-1 filing is live)."
- **TDS** → "Track and file TDS returns (Stage 3)."
- **Accounting** → "Double-entry books (Stage 4)."
- **Payroll / HRMS** → "Coming Stage 4."
- **Reconciliation (2A/2B)** → "Auto-sync GSTR-2B from GSTN (Stage 2). Manual upload available now."

### Tier 4 — Remove duplicate implementations (consolidate)

| Keep | Delete (or redirect import to the keeper) |
|---|---|
| `oracle/OracleBrain.tsx` | `oracle-chat/`, `oracle-ai/`, `oracle-cfo/`, `ai-business-copilot/`, `finos/` |
| `banking/` (Prisma) | `banking-intelligence/`, `banking-intel/` API routes |
| `clients/ClientRegistryPage` | `gstpilot-data/CustomersView`, `crm/CRMPage` |
| `invoices/InvoiceWorkspacePage` | `gstpilot-data/InvoicesView`, `invoice-cloud/` |
| `returns/ReturnPrepWorkspace` | `gstr/GSTRFilingPage` (merge into one) |

### Net result

- Nav goes from **~60 visible items to ~12** (Dashboard, Oracle, Clients, Invoices, Returns, Reconcile, Banking, Notices, Timeline, Settings, + 1–2 integrations).
- The app **looks smaller but does more** — every visible item works.

---

# PHASE 5 — BUILD LIKE STRIKE (Architecture Standard)

## The Rule

**No more page-first development.** Every future feature follows this order, top to bottom, with a gate between each:

```
[1] SCHEMA      → Prisma model + migration + indexes
        ↓ (gate: schema reviewed, indexed, orgId present)
[2] SERVICE     → Pure functions in src/lib/<module>/service.ts
                  No Next.js, no req/res. Pure, testable.
        ↓ (gate: unit tests pass, edge cases covered)
[3] API ROUTE   → src/app/api/<module>/route.ts
                  Thin: parse → call service → log audit → respond.
                  Never contains business logic.
        ↓ (gate: curl returns 200 with real data; error cases return correct status)
[4] BUSINESS LOGIC → Validation, rules, side-effects, Oracle hooks
                  Lives in the service layer, NOT the route.
        ↓ (gate: integration test: create → read → update → delete → audit logged)
[5] TESTING     → One e2e test per workflow step.
                  "Given real invoices, when I file GSTR-1, then ARN is returned."
        ↓ (gate: test green on real DB, not mock)
[6] FRONTEND    → Hook (useTanStackQuery) → Component → Page.
                  The UI is the LAST thing built, never the first.
        ↓ (gate: browser-verified, loading/error/empty states, responsive)
DONE
```

## What this prevents

- **No more "beautiful screen with no backend."** The backend must exist and be tested before a single JSX tag is written.
- **No more fabrication.** If the service layer can't return real data, the feature doesn't ship.
- **No more duplication.** A domain concept has exactly one service file and one API route prefix.
- **No more untested AI.** Oracle tools are tested with real inputs and asserted outputs.

## The Folder Convention (enforced)

```
src/lib/<module>/              ← service layer (pure logic)
  ├── schema.ts                ← Zod schemas (input validation)
  ├── service.ts               ← CRUD + business rules
  ├── oracle-tools.ts          ← Oracle tool definitions (if AI-actable)
  └── types.ts                 ← shared types

src/app/api/<module>/          ← thin HTTP wrappers
  ├── route.ts                 ← GET (list), POST (create)
  └── [id]/route.ts            ← GET, PUT, DELETE

src/hooks/use<Module>.ts       ← TanStack Query hook (read)
src/hooks/use<Module>Mutations.ts ← mutations (create/update/delete)

src/components/<module>/       ← UI (built LAST)
  ├── <Module>Page.tsx         ← the page
  └── <Module>*.tsx            ← sub-components
```

## Oracle Integration Standard

Oracle is not a chatbot. It is the **action layer**. Every service module exposes Oracle tools:

```typescript
// src/lib/returns/oracle-tools.ts
export const returnsOracleTools = [
  {
    name: 'prepare_gstr1',
    description: 'Aggregate all approved invoices for a GSTIN+period into a GSTR-1 draft',
    input: z.object({ gstin: z.string(), period: z.string() }),
    execute: async ({ gstin, period }) => prepareGstr1(gstin, period), // calls service
  },
  {
    name: 'file_gstr1',
    description: 'File a prepared GSTR-1 draft with GSTN. Requires human approval.',
    input: z.object({ draftId: z.string() }),
    execute: async ({ draftId }) => fileGstr1(draftId),
    requiresApproval: true, // Oracle suggests, human clicks
  },
];
```

Oracle can **read** freely but **writes** require human approval (one click). This is the "magical, not chatbot" experience: Oracle does the work, the user just approves.

---

# PHASE 6 — PRODUCT ROADMAP

## Stage 1 — One Workflow Perfect (GSTR-1 Auto-Filing)
**Goal:** A real CA files a real GSTR-1 for a real client end-to-end.
**Scope:**
- Fix `generateGstr1Data` → real invoice aggregation
- Build `src/lib/returns/service.ts` (prepareGstr1, fileGstr1, getFilingStatus)
- Build `src/app/api/returns/gstr1/*` routes (thin wrappers)
- GSTN sandbox API integration (real OTP flow, real ARN)
- Oracle tools: `prepare_gstr1`, `validate_gstr1`, `file_gstr1`
- UI: Return Prep workspace shows real invoice breakdown, real JSON, real ARN
- E2E test: 10 real invoices → file → ARN returned → audit log written
**Exit criteria:** 1 real GSTN sandbox filing succeeds. CA says "this is faster than Tally."
**Timeline focus:** 100% of dev effort here. Nothing else.

## Stage 2 — Second Workflow (GSTR-2B ITC Reconciliation)
**Goal:** Auto-match vendor bills to GSTR-2B, flag mismatches, Oracle explains.
**Scope:**
- Real GSTR-2B fetch from GSTN (depends on Stage 1 filing working)
- OCR upload of purchase bills → `db.purchaseBill` (model exists, lightly used)
- Matching engine: bill ↔ 2B line item (GSTIN + invoice no + amount + tax)
- 5 mismatch types: missing-in-2B, missing-in-books, rate-mismatch, amount-mismatch, duplicated
- Oracle tool: `explain_mismatch` (reads both records, gives root cause)
- UI: Reconciliation page shows real matches + mismatches with action buttons
**Exit criteria:** A CA reconciles a full month's 2B in under 30 minutes. ITC claim is defensible.

## Stage 3 — Third Workflow (Bank Statement Reconciliation)
**Goal:** Import bank statement → auto-match to invoices/expenses → ledger entry.
**Scope:**
- Promote Banking from MockProvider to real Setu adapter (or robust CSV/Excel import if Setu delayed)
- Match engine: bank txn ↔ invoice (fuzzy amount + date + counterparty)
- Unmatched → Oracle suggests category (vendor name → expense category)
- On approval → write `db.payment` + update `db.invoice.status = 'paid'`
- Oracle tool: `reconcile_transaction`
**Exit criteria:** A business owner imports their HDFC statement and sees every transaction matched or explained in 15 minutes.

## Stage 4 — Beta Launch
**Goal:** 5–10 CAs / businesses using it weekly. Free.
**Scope:**
- Onboarding flow polished (connect GSTN, invite team, import first invoices)
- Month-end close workflow (Workflow 5 lite — briefing email)
- Notices module wired to real GSTN notice fetch
- Billing disabled (everyone is free tier)
- Performance: full app loads in <3s on 4G
- Error monitoring (Sentry or equivalent)
- Terms of service + privacy policy (real, lawyer-reviewed for financial data)
**Exit criteria:** 5 users return weekly for 4 consecutive weeks. NPS > 8.

## Stage 5 — First Paying Customer
**Goal:** 1 customer pays ₹2,000–5,000/month.
**Scope:**
- Billing: Razorpay integration, 2 tiers (CA Pro ₹2,000, Business ₹5,000)
- GSTR-3B filing (depends on Stage 1+2 being solid)
- WhatsApp / email reminders for filing deadlines
- Multi-client support for CAs (1 CA, 20 clients)
- Data export (full JSON + PDF backup)
- SOC2 / ISO 27001 readiness checklist started
**Exit criteria:** 1 signed invoice. Money in bank.

## Stage 6 — 100 Customers
**Goal:** 100 paying customers, ₹2–5 lakh MRR.
**Scope:**
- E-invoicing (IRN generation) — now that GSTR-1 is solid
- TDS filing (Form 26Q/24Q)
- Zoho Books 2-way sync (currently 1-way)
- Tally import (huge market — Tally users want to migrate)
- Oracle proactive insights ("your ITC is ₹40k lower than last month — 3 vendors didn't file their GSTR-1")
- Team collaboration (multiple users per org, role-based)
- Audit log UI (finally read the AuditLog table)
**Exit criteria:** 100 active subscriptions. <2% monthly churn.

## Stage 7 — 1,000 Customers
**Goal:** 1,000 paying customers, ₹30–50 lakh MRR. Series A ready.
**Scope:**
- Accounting (double-entry, P&L, Balance Sheet) — now that all transactional data is real
- Payroll + HRMS (Indian compliance: PF, ESI, PT, TDS)
- ROC compliance (MGT-7, AOC-4)
- Multi-firm (1 CA firm, 200 clients)
- Marketplace opens (3rd-party accountants offer services)
- Setu / Account Aggregator live for real bank data
- Mobile app (read-only: approvals, alerts, briefing)
- White-label for large CA firms
**Exit criteria:** ₹50 lakh MRR. <3% monthly churn. 1 enterprise deal (>₹1L/month).

---

# ARCHITECTURE REVIEW — What to Keep vs Rebuild

## KEEP (the foundation you've already paid for)

| Asset | Status | Why keep |
|---|---|---|
| **Prisma schema** (285 models) | Trim to ~30 used | The 15 heavily-used models (Invoice, Client, GSTRFiling, Payment, BankTransaction, BankAccount, AuditLog, Expense, Employee, Notice, Document, TeamMember, FilingEvent, Issue, Firm, FirmSettings, User) are solid. Drop the 250 unused Platform*/Dev*/CEO*/Autonomous* models. |
| **Auth (Firebase + fallback)** | ✅ production | Real, with demo mode. Keep. |
| **OrgContext (multi-tenant)** | ✅ production | Real orgId scoping. Keep. |
| **Settings module** | ✅ production | Real Prisma CRUD. Keep. |
| **Clients + Invoices (Prisma REST)** | ✅ production | `useClients` / `useInvoicesApi` hit real `/api/clients` `/api/invoices`. The model for all future modules. |
| **OCR service** (`ocr.service.ts`) | ✅ real VLM | Uses z-ai-web-dev-sdk. Keep, wire into invoice import. |
| **Oracle Brain** (`oracle/OracleBrain.tsx`) | ✅ real streaming | Real z-ai-web-dev-sdk. Make it the single Oracle surface. |
| **Banking Prisma layer** (`banking-prisma/`) | ✅ real DB | Real BankAccount/BankTransaction models. Keep, swap mock provider for Setu later. |
| **Google Workspace OAuth** | ✅ real | Keep. |
| **Zoho Books OAuth + sync** | ✅ real | Keep, extend to 2-way. |
| **shadcn/ui design system** | ✅ polished | Keep. Emerald/black GSTPilot theme. |
| **AuditLog** | ✅ real | Keep, finally build a UI to read it. |

## REBUILD (the experience layer)

| Asset | Why rebuild |
|---|---|
| **Dashboard / Home** | Currently a snapshot of demo data. Rebuild around real KPIs: "GSTR-1 due in 3 days", "₹4.2L unreconciled ITC", "2 notices pending". |
| **Navigation** | ~60 items → ~12. Group by workflow, not by marketing phase. |
| **Oracle UX** | Currently a chat panel. Make it a **command surface**: proactive cards on the dashboard ("3 invoices need GSTIN validation before filing"), inline actions on every page ("Ask Oracle about this invoice"), voice input that actually executes. Not a chatbot — a copilot that has already done the work and asks you to approve. |
| **AI workflows** | Every "AI" page is a static dashboard. Replace with Oracle tools that act: "prepare my GSTR-1", "reconcile this statement", "respond to this notice". |
| **User journey** | Currently: sign in → see 60 nav items → get confused. Rebuild: sign in → Oracle says "Good morning. 3 things need you today: file GSTR-1, reconcile 2 transactions, respond to 1 notice." → click → done. |
| **Performance** | 4GB OOM on full compile. Lazy loading is band-aid. Real fix: delete 600 unused API routes and 250 unused component files → bundle shrinks 80%. |
| **Loading states** | Inconsistent. Standardize: skeleton → content → error → empty → retry. One component, used everywhere. |
| **Overall UX** | Make it feel like Linear / Stripe: fast, calm, opinionated. Every screen answers "what should I do next?" |

---

# IMMEDIATE NEXT ACTIONS (awaiting your approval)

1. **Approve this audit.** (or push back on any module classification)
2. **Approve Workflow 1 (GSTR-1 Auto-Filing) as Stage 1.**
3. **Approve the disable list** (Tier 2: hide ~48 nav items; Tier 4: consolidate duplicates).
4. **Approve the "Build Like Stripe" gate order.**
5. Once approved, I will execute in this order:
   - **Step 0:** Disable the fake nav items (no redesign — just hide). Commit.
   - **Step 1:** Delete `generateGstr1Data` and replace with real invoice aggregation. Commit.
   - **Step 2:** Build `src/lib/returns/service.ts` (pure functions, tested). Commit.
   - **Step 3:** Build thin API routes. Commit.
   - **Step 4:** Wire Oracle tools. Commit.
   - **Step 5:** Rebuild Return Prep UI on real data. Browser-verify. Commit.
   - **Step 6:** GSTN sandbox integration test with a real GSTIN. Commit.

**One workflow at a time. Until GSTR-1 is perfect, nothing else gets built.**

---

*End of audit. Awaiting your decision.*
