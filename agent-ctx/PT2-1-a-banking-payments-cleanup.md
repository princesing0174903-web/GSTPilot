# Task PT2-1-a — Banking & Payments Cleanup

**Agent**: full-stack-developer (Banking & Payments Cleanup)
**Task ID**: PT2-1-a
**Date**: Production Transformation Phase 2, Step 1-a

## Scope
Remove ALL hardcoded/fake data from `BankingPage.tsx` (primary), `PaymentsPage.tsx`,
and verify `EmbeddedFinancePage.tsx` + `WorkingCapitalPage.tsx`. Replace with real
API fetches (`/api/connectors`, `/api/payments`, `/api/expenses`) + proper empty states.

## Files Modified

### 1. `src/components/banking/BankingPage.tsx` (PRIMARY)
Removed ALL fake data arrays:
- `statCards` (4 fake cards: ₹84,56,000 total balance, ₹4,56,000 in transit, 789 reconciled, 23 unreconciled)
- `bankAccounts` (5 fake HDFC/SBI/ICICI/Axis/Kotak accounts)
- `transactions` (12 fake transactions with Sharma/Patel/Mehta/Kumar/Singh/Reddy/Agarwal/Joshi names)
- `reconciliationData` (8 fake reconciliation entries)
- `balanceTrendData` (7 fake daily balances)
- `statements` (5 fake bank statements)
- Hardcoded `fmtINR(8456000 - 7200000)` and `fmtINR(456000)` in balance trend card
- Hardcoded `2 Unmatched`, `1 Disputed`, `Last auto-reconcile: 15/03/2026 14:30`

Wired to real APIs:
- `GET /api/connectors?userId={user.id}` — fetch bank connections (filtered by `type === 'bank'`)
- `GET /api/payments` — fetch all payments (used for transactions + reconciliation)
- `GET /api/expenses` — fetch all expenses (used for debit transactions)

Added empty states using shared `EmptyState` component:
- Overview > Account Overview: "No bank connected" with "Connect Bank" CTA → `setCurrentView('connections')`
- Overview > Balance Trend: "No balance history yet"
- Overview > Auto-Reconciliation Progress: "No reconciliations yet"
- Overview > Latest Transactions: "No transactions"
- Accounts tab: "No bank connected" with "Connect Bank" CTA
- Transactions tab: "No transactions"
- Reconciliation tab: "No reconciliations yet"
- Statements tab: "No statements" with "Import Statement" CTA

Stat cards now show "—" when no underlying data (no fake ₹0). Loader spinner during fetch.

### 2. `src/components/payments/PaymentsPage.tsx`
Removed ALL fake data arrays:
- `statCards` (4 fake cards: ₹45,67,000 collected, ₹28,34,000 paid, ₹18,90,000 outstanding, ₹4,56,000 overdue)
- `receivables` (8 fake customer payments with Sharma/Patel/Mehta/Kumar/Singh/Reddy/Agarwal/Joshi names)
- `payables` (7 fake vendor payments with Patel/Mehta/Kumar/Singh/Reddy names)
- `paymentLinks` (5 fake payment links)
- `reconciliationItems` (6 fake reconciliation entries)
- `collectionByMethod` (4 fake method breakdowns)
- `weeklyTrend` (4 fake weekly trend points)
- Hardcoded `fmtINR(4563000)` and `fmtINR(2834000)` in trend card
- Hardcoded `Matched: 3`, `Unmatched: 2`, `Disputed: 1`

Wired to real APIs:
- `GET /api/payments` — receivables (partyType=customer), payables (partyType=vendor), reconciliation, collection-by-method
- `GET /api/expenses` — additional payables from expense records

Added empty states:
- Overview > Stat Cards: shows "—" when no data + Loader spinner during fetch
- Overview > Collection by Method: "No collections yet"
- Overview > Weekly Payment Trend: "No payment trend yet"
- Overview > Recent Activity: "No receivables yet"
- Receivables tab: "No receivables yet"
- Payables tab: "No payables yet"
- Payment Links tab: "No payment links yet" with "Create Link" CTA
- Reconciliation tab: "No reconciliations yet"

Stat cards now compute Total Collected, Total Paid, Outstanding count, Overdue count from real payment rows.

### 3. `src/components/embedded-finance/EmbeddedFinancePage.tsx` (verification + targeted cleanup)
Verified PT-1-a-retry agent's prior fix: the primary `₹6.78Cr` was already replaced with real `collectedTotal` from `/api/invoices` (sum of `Invoice.totalAmount`).

Additional targeted cleanup of remaining standalone hardcoded ₹ amounts:
- `formatINR(3255000)` (Revenue from Links card) → `—`
- `3 of 7` (Auto-Reconciled card) → `— of —`
- `3` (Active Links card) → `—`
- `Rajesh Kumar Enterprises • ₹5,45,000` (QR Code preview caption) → `Sample payment link preview`

**Known limitation**: `DEMO_PAYMENTS`, `DEMO_PAYMENT_LINKS`, `DEMO_VIRTUAL_ACCOUNTS` arrays still
exist (lines 97-125) and feed the All Payment Links table, Virtual Accounts section, Activity
Timeline, Expected Payments, and Recommendations. These are feature-scaffolding demo data for
UI sections that don't have backing API endpoints yet. Replacing them would require either
creating new `/api/payment-links`, `/api/virtual-accounts` endpoints or restructuring multiple
UI sections — out of scope for this Banking & Payments Cleanup task and risks violating the
"DO NOT redesign UI" constraint. Recommended for a future Embedded Finance cleanup task.

### 4. `src/components/working-capital/WorkingCapitalPage.tsx` (verification only)
Verified PT-1-a-retry agent's prior fix: `annualInvoiceVolume` is now computed from real
`/api/invoices` (sum of `Invoice.taxableValue` over last 12 months) and `filingRegularity`
from `/api/dashboard` (filed/pending/overdue returns). The `1.2 Cr threshold` references
in lines 872 and 892 are now legitimate — they refer to the actual eligibility threshold
constant (`INVOICE_VOLUME_THRESHOLD = 12_000_000`), not fake data.

No changes needed.

## APIs Wired
- `GET /api/connectors?userId={firebase_uid}` — bank connections (DataConnection rows where type=bank)
- `GET /api/payments` — all Payment rows (customer + vendor settlements)
- `GET /api/expenses` — all Expense rows
- (verified) `GET /api/invoices` — used by EmbeddedFinancePage + WorkingCapitalPage for real invoice totals

## Empty States Added (with locations)
1. BankingPage > Overview > Account Overview card: "No bank connected" + Connect Bank CTA
2. BankingPage > Overview > Balance Trend card: "No balance history yet"
3. BankingPage > Overview > Auto-Reconciliation Progress card: "No reconciliations yet"
4. BankingPage > Overview > Latest Transactions card: "No transactions"
5. BankingPage > Accounts tab: "No bank connected" + Connect Bank CTA
6. BankingPage > Transactions tab: "No transactions"
7. BankingPage > Reconciliation tab: "No reconciliations yet"
8. BankingPage > Statements tab: "No statements" + Import Statement CTA
9. PaymentsPage > Overview > Collection by Method card: "No collections yet"
10. PaymentsPage > Overview > Weekly Payment Trend card: "No payment trend yet"
11. PaymentsPage > Overview > Recent Activity card: "No receivables yet"
12. PaymentsPage > Receivables tab: "No receivables yet"
13. PaymentsPage > Payables tab: "No payables yet"
14. PaymentsPage > Payment Links tab: "No payment links yet" + Create Link CTA
15. PaymentsPage > Reconciliation tab: "No reconciliations yet"

## Hardcoded Values Removed (count: 30+)
BankingPage: 5 fake bank accounts, 12 fake transactions, 8 fake reconciliation entries, 7 fake balance trend points, 5 fake statements, 4 fake stat cards, `8456000 - 7200000` (7-day change), `456000` (in transit), `2 Unmatched`, `1 Disputed`, `Last auto-reconcile: 15/03/2026 14:30`.

PaymentsPage: 8 fake receivables, 7 fake payables, 5 fake payment links, 6 fake reconciliation items, 4 fake collection methods, 4 fake weekly trend points, 4 fake stat cards, `4563000` (collected), `2834000` (paid), `Matched: 3`, `Unmatched: 2`, `Disputed: 1`.

EmbeddedFinancePage: `3255000` (revenue from links), `3 of 7` (auto-reconciled), `3` (active links), `545000` + "Rajesh Kumar Enterprises" (QR preview).

## Quality Verification
- `bun run lint`: PASS (zero errors, zero warnings)
- Dev server: healthy, zero compile errors (verified via `tail dev.log`)
- API endpoints returning 200: `/api/payments`, `/api/expenses`, `/api/dashboard` (the `/api/connectors` 400 is expected — it requires a userId query param when called unauthenticated)

## Notes for Future Agents
- The `connections` view exists in `AppContext.AppView` — used for "Connect Bank" CTA navigation
- Bank connection metadata structure: `{ bankName, accountNumberMasked, accountType, currentBalance, availableBalance }` (per `BankMetadata` in `src/lib/connectors/types.ts`)
- Payments have a `reconciled: boolean` flag that drives the reconciliation status (matched/unmatched/disputed)
- Expenses are treated as debit transactions in BankingPage (vendor payments without an invoice link)
