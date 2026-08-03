# GSTPilot — Stage 1 Execution Plan
*The Magic Workflow. Supersedes the Stage 1 section of PRODUCT_AUDIT.md.*

---

## THE OPERATING CONSTITUTION

Adopted verbatim from your directive. Every future action must pass these gates, in order:

> 1. Identify the workflow.
> 2. Remove duplicate pages.
> 3. Remove fake implementations.
> 4. Connect real database.
> 5. Connect real integrations.
> 6. Make Oracle proactive instead of reactive.
> 7. The workflow must be executable from start to finish.
>
> **Never add a page unless it completes an existing workflow.**

If a piece of work cannot trace to a workflow step, it does not get done. If a workflow step cannot pass all 7 gates, the workflow is not done.

---

## STAGE 1 — THE MAGIC WORKFLOW

### The flow (your spec, made concrete)

```
[1] Invoice created
      └─ Real: db.invoice (Prisma, 304 query sites) ✅
      └─ Sources: manual entry, OCR upload, Zoho sync

         ↓

[2] Payment received (bank transaction)
      └─ Real: db.bankTransaction (Prisma, 83 query sites) ✅
      └─ Sources: CSV/Excel import, MockProvider (honestly labeled "Demo Bank"),
         Setu adapter later

         ↓

[3] Bank automatically matches payment to invoice
      └─ Engine exists: src/lib/banking-prisma/reconciliation.ts (768 lines, 7 match types)
      └─ GAP: engine produces match records but does NOT write back to invoice.status
      └─ FIX: new service linkPaymentToInvoice() — creates Payment, links BankTxn, updates Invoice

         ↓

[4] GST updates automatically
      └─ GAP: no markInvoicePaid() service exists. Invoice status is manual today.
      └─ FIX: new service — sets status='paid', paidAt, paidAmount,
         recomputes GSTR-1 liability for the invoice's period, writes ledger entry,
         writes AuditLog

         ↓

[5] Oracle notices mismatch
      └─ GAP: Oracle is reactive (chat only). No proactive watcher.
      └─ FIX: new src/lib/oracle/proactive/watchers.ts
         - onBankTransactionImported(txn) → runs matching → if mismatch, generates card
         - detectMismatch(invoice, txn) → classifies: short payment / excess / bank charges / wrong party / duplicate

         ↓

[6] Oracle fixes draft
      └─ GAP: Oracle can suggest but cannot act.
      └─ FIX: new src/lib/oracle/actions/executor.ts
         - Oracle tool: link_and_mark_paid (requiresApproval: true)
         - Oracle suggests the exact action: "Mark INV-001 as paid, ₹500 = bank charges"
         - User sees a one-click Approve button

         ↓

[7] User clicks Approve
      └─ Executes the full chain in one transaction:
         linkPaymentToInvoice → markInvoicePaid → recompute GST liability → write AuditLog
      └─ Card disappears from dashboard
      └─ Toast: "Done. Invoice INV-001 paid. GSTR-1 July liability updated to ₹4,82,000."
      └─ Invoice status updates in real-time across all open views

         ↓

DONE — one workflow, end to end, real data, Oracle proactive, one click.
```

### What "done" looks like (acceptance criteria)

- [ ] Creating an invoice + importing a matching bank transaction produces an Oracle proactive card **within 5 seconds**
- [ ] The card explains any mismatch in plain English ("₹500 short — likely bank charges")
- [ ] Clicking **Approve** executes link + mark-paid + ledger + audit in **<2 seconds**
- [ ] Invoice status updates in real-time in the UI (no refresh)
- [ ] Every action is in AuditLog with actor, timestamp, before/after values
- [ ] Oracle **never** says "how can I help?" — it always leads with what it already knows
- [ ] The workflow completes with **zero navigation** — no page hops, everything on the dashboard
- [ ] The same invoice+payment can't be linked twice (idempotency)
- [ ] A mismatch that Oracle can't auto-resolve surfaces as "needs your decision" with options

### What Stage 1 explicitly does NOT do

- GSTR-1 filing (Stage 2 — depends on this being solid first)
- GSTR-2B reconciliation (Stage 2)
- Real Setu bank API (Demo Bank is honest, Stage 3 promotes it)
- E-invoicing / IRN (later)
- Any new page (the dashboard surface already exists — we add a section, not a page)

---

## EXECUTION SEQUENCE

### Step 0 — Disable & Dedupe (gates 1, 2, 3)

**No redesign. No new pages. Just cleanup.**

**0a. Hide ~48 fake nav items** (from `navigation-registry.ts`)
The Global Expansion (12), Global Cloud (16), Enterprise Command (7), Autonomous Finance (7), Vision modules (~25), and AI duplicates (9) all get removed from the sidebar. Component files stay as dead code (cheaper than deleting, and we may mine them later). The user sees ~8 items: Dashboard, Clients, Invoices, GST, Banking, Oracle, Reports, Settings.

**0b. Consolidate duplicates** (redirect, don't delete)
- 6 Oracle variants → all import from `oracle/OracleBrain.tsx`
- 3 Banking modules → `banking/BankingPage.tsx` is the only one in nav
- 3 Client modules → `clients/ClientRegistryPage.tsx` is the only one in nav
- 3 Invoice modules → `invoices/InvoiceWorkspacePage.tsx` is the only one in nav

**0c. Tag the honest mocks**
- Banking dashboard shows a clear "Demo Bank" badge (not "Live")
- Any mock data has a visible "demo" chip

**Commit.** The app now feels 10x more focused. Zero new code, zero risk.

### Step 1 — The Connective Service Layer (gates 4, 5, 7)

**File:** `src/lib/workflows/invoice-payment-flow.ts` (new, pure functions, no Next.js)

```
linkPaymentToInvoice(bankTxnId, invoiceId, actorId)
  → creates db.payment
  → updates db.bankTransaction.reconciledWith = invoiceId
  → writes db.auditLog
  → returns { payment, auditEntry }

markInvoicePaid(invoiceId, paymentId, options, actorId)
  → updates db.invoice: status='paid', paidAt, paidAmount
  → recomputes GSTR-1 liability for invoice.period (in-memory, not filing)
  → writes db.auditLog with before/after
  → returns { invoice, liabilityDelta }

detectMismatch(invoice, bankTxn)
  → compares expected vs received amount, date, counterparty
  → returns { type: 'exact'|'short'|'excess'|'bank_charges'|'wrong_party'|'duplicate',
              amountDelta, explanation, suggestedAction }
```

Gate check: unit tests with real Prisma, real Invoice, real BankTransaction. No mocks.

### Step 2 — Oracle Proactive Watcher (gate 6)

**File:** `src/lib/oracle/proactive/watchers.ts` (new)

```
onBankTransactionImported(txn, orgId)
  → runs matching engine against open invoices
  → if match found: create proactive card in db (new model: ProactiveCard)
  → if mismatch: classify via detectMismatch(), card includes suggested action
  → uses z-ai-web-dev-sdk to phrase the explanation in plain English

onInvoiceCreated(invoice, orgId)
  → checks if a matching bank txn already exists (unmatched)
  → if yes: create card "Payment already received for this invoice. Link?"

getProactiveCards(orgId)
  → returns today's open cards, sorted by urgency
  → each card: { id, type, title, description, action, actionPayload, status }
```

**Critical:** Oracle leads with knowledge, never with a question.
- ❌ "Would you like me to reconcile this?"
- ✅ "Acme Corp paid ₹49,500 for INV-001. ₹500 short — likely bank charges. Approve to mark paid."

### Step 3 — Oracle Action Executor (gate 7)

**File:** `src/lib/oracle/actions/executor.ts` (new)

```
Oracle tool: link_and_mark_paid
  input: { bankTxnId, invoiceId, mismatchHandling }
  requiresApproval: true
  execute: () => linkPaymentToInvoice() then markInvoicePaid() in one transaction

Oracle tool: dismiss_card
  input: { cardId, reason }
  execute: marks card dismissed, logs reason (learning signal)
```

Oracle **suggests**, human **approves**, system **executes**, audit **logs**. That's the loop.

### Step 4 — Thin API Routes (gate 7)

```
POST /api/workflows/link-payment        → calls linkPaymentToInvoice
POST /api/workflows/mark-paid           → calls markInvoicePaid
GET  /api/oracle/proactive/cards        → returns today's cards
POST /api/oracle/actions/execute        → executes an approved action
POST /api/oracle/actions/dismiss        → dismisses a card
```

Each route is <30 lines: parse input → call service → log audit → respond. No business logic in routes.

### Step 5 — Dashboard Surface (NOT a new page)

The existing `DashboardPage.tsx` gets one new section: **"Oracle's Actions for Today"**.

- Shows proactive cards (max 5, sorted by urgency)
- Each card: icon, title, description, **Approve** button, **Dismiss** button
- Approve → POST /api/oracle/actions/execute → card animates out → toast
- After bank import → cards appear automatically (TanStack Query invalidation)
- After invoice creation → if matching payment exists, card appears

No new route. No new page. The dashboard becomes the command surface.

### Step 6 — E2E Verification (gate 7, the final gate)

Browser-verified golden path:
1. Seed one invoice (INV-001, Acme Corp, ₹50,000, due today)
2. Import one bank statement with one transaction (₹49,500 from "ACME CORP PVT LTD")
3. Within 5 seconds: Oracle card appears on dashboard
4. Card text: "Acme Corp paid ₹49,500 for INV-001. ₹500 short — likely bank charges. Approve to mark paid."
5. Click Approve
6. Verify in DB:
   - `db.invoice.status = 'paid'`, `paidAmount = 49500`
   - `db.payment` record exists, linked to invoice + bank txn
   - `db.bankTransaction.reconciledWith = INV-001`
   - `db.auditLog` has entry: actor, "mark_paid", before/after
7. Toast: "Done. INV-001 paid. ₹500 logged as bank charges."
8. Card gone from dashboard. Invoice list shows INV-001 as paid (real-time).

**If all 8 checks pass, Stage 1 is done. Nothing else ships until they do.**

---

## THE HONEST SCORECARD — where we are, where Stage 1 moves us

Your scores, with my annotation on what Stage 1 moves:

| Dimension | Now | After Stage 1 | Why |
|---|---|---|---|
| Engineering foundation | 8.5 | 8.5 | Unchanged (already strong) |
| UI | 8 | 8 | Unchanged (we're not redesigning) |
| Architecture | 8 | 8.5 | +0.5 (dedupe + workflow layer) |
| Real integrations | 4 | 5 | +1 (Invoice↔Bank link is real, even if bank is mocked-honestly) |
| AI experience | 5 | 7 | +2 (Oracle goes from reactive chat to proactive actions) |
| Actual business value | 5 | 7 | +2 (one workflow end-to-end = a demo that sells) |
| **Overall** | **~6.5–7** | **~7.5** | The 7→10 journey is 5 workflows, not 600k lines |

Stage 1 alone doesn't get us to 10. But it's the first workflow that **feels magical**, and every subsequent stage compounds on this connective tissue.

---

## WHAT I NEED FROM YOU TO BEGIN

Nothing more than the word "go." Specifically:

1. **Approve Step 0** (disable ~48 nav items, consolidate duplicates, tag honest mocks). Zero risk, zero new code, immediate focus gain.
2. **Approve the Stage 1 workflow** as defined above (Invoice → Bank → GST → Oracle, one-click approve).
3. **Approve the 7-gate constitution** as the permanent operating discipline.

On your word, I execute Step 0 first (commit), then Stage 1 in the order: service layer → Oracle watcher → action executor → API routes → dashboard surface → E2E verify. Each step committed separately. No skipping gates.

**One workflow at a time. Until Invoice → Bank → GST → Oracle is magical, nothing else gets built.**
