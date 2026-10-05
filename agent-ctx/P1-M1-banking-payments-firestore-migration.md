# Task P1-M1 — Banking + Payments Firestore Migration

**Agent**: full-stack-developer
**Phase**: 1 (Real Backend Foundation) — Migration M1
**Date**: 2025

## Scope
Migrate two pages from REST APIs to Firestore hooks + service functions:
1. `src/components/banking/BankingPage.tsx` (was 822 lines → now 1011 lines)
2. `src/components/payments/PaymentsPage.tsx` (was 718 lines → now 893 lines)

## fetch() calls removed (5 total)
### BankingPage.tsx
- `fetch('/api/connectors?userId=…')` → replaced by `useFireBankAccounts()`
- `fetch('/api/payments')` → replaced by `useFirePayments()`
- `fetch('/api/expenses')` → replaced by `useFireExpenses()`
- ADDED: `useFireBankTransactions()` for the new bank_transactions collection (was not previously fetched)

### PaymentsPage.tsx
- `fetch('/api/payments')` → replaced by `useFirePayments()`
- `fetch('/api/expenses')` → replaced by `useFireExpenses()`

## Firestore service functions wired
### BankingPage.tsx
- `createBankAccount(data)` — wired to "Add Account" header button (uses `window.prompt` for bank name + balance + last-4 digits; creates `accountType:'current'`, `currency:'INR'`, `status:'connected'`, `lastSyncAt: new Date().toISOString()`)
- `updateBankAccount(id, { status, lastSyncAt })` — wired to per-account "Sync" button AND "Sync All" header button (Promise.all over all bankAccounts)
- `updatePayment(id, { reconciled: true })` — wired to "Auto-Reconcile" / "Run Now" (Promise.all over unmatched reconciliation entries) AND per-row "Match" / "Resolve" buttons

### PaymentsPage.tsx
- `createPayment(data)` — wired to "Record Payment" (header), "Record Receipt" (receivables tab), "Schedule Payment" (payables tab). Uses `window.prompt` for party name + amount + payment mode. `partyType` switches between 'customer' (Record Payment / Record Receipt) and 'vendor' (Schedule Payment).
- `updatePayment(id, { reconciled: true })` — wired to "Auto-Reconcile" (Promise.all over unmatched) AND per-row "Match" / "Resolve"

## Field-mapping decisions
### BankingPage
- `FirestoreBankAccount.bankName` → `BankAccount.bank`
- `FirestoreBankAccount.accountNumberMasked` → `BankAccount.account` (UI does `.slice(-4)` → works with "XXXX1234")
- `FirestoreBankAccount.accountType` → `BankAccount.type` (first letter capitalized; preserves "Current"/"Savings" display)
- `FirestoreBankAccount.currentBalance ?? availableBalance` → `BankAccount.balance`
- `FirestoreBankAccount.lastSyncAt` (serverTimestamp → ISO string) → `formatSyncDate()` → `BankAccount.lastSync`
- `FirestoreBankAccount.status` → `BankAccount.status`
- `FirestoreBankTransaction.amount` → `BankTransaction.amount` with `Math.abs()` applied (sign conveyed via `type` field)
- `FirestoreBankTransaction.type` ('credit'|'debit') → `BankTransaction.type`
- `FirestoreBankTransaction.balanceAfter` (number|null) → `BankTransaction.balance`
- `FirestoreBankTransaction.referenceNo?.toUpperCase() ?? 'BANK'` → `BankTransaction.account`
- `FirestoreBankTransaction.category ?? (type==='credit'?'Revenue':'Purchase')` → `BankTransaction.category`
- `FirestorePayment` → `BankTransaction` via existing `mapPaymentToTxn` (preserved unchanged)
- `FirestorePayment` → `ReconciliationEntry` via existing `mapPaymentToRecon` (preserved unchanged)
- `FirestoreExpense` → `BankTransaction` via new `mapExpenseToTxn` (extracted from existing inline mapping)
- `balanceTrendData`: NEW — derived from `bank_transactions.balanceAfter` grouped by YYYY-MM-DD (latest per day, last 7 days). Was `[]` before; now populates from real bank_transactions if available, else stays `[]` (existing EmptyState shows).

### PaymentsPage
All existing mappings preserved unchanged — only the source changed from raw REST JSON to typed `FirestorePayment` / `FirestoreExpense`. Key fields used:
- `FirestorePayment.partyType ?? 'customer'` — splits receivables vs vendor-payables
- `FirestorePayment.status` — drives `Receivable.status` (received/overdue/pending) and `Payable.status` (paid/scheduled/pending)
- `FirestorePayment.reconciled` — drives `ReconciliationItem.status` (matched/disputed/unmatched)
- `FirestorePayment.paymentMode` → `titleCaseMode()` → `Receivable.method` + `CollectionMethod.method`
- `FirestoreExpense.vendor ?? description` → `Payable.vendor`; `FirestoreExpense.category` → `Payable.category`

## Empty-state copy (all preserved from existing UI — no new copy invented)
- BankingPage Account Overview / Accounts tab empty: "No bank connected" / "Connect your bank account to view balances and transactions." / action "Connect Bank"
- BankingPage Balance Trend empty: "No balance history yet" / "Bank balance trends will appear here once your bank connection syncs historical data."
- BankingPage Reconciliation empty: "No reconciliations yet" / "Bank-to-book matches will appear here once payments are reconciled."
- BankingPage Transactions empty: "No transactions" / "Bank transactions will appear here once you connect and sync a bank account."
- BankingPage Statements empty: "No statements" / "Imported bank statements will appear here for download and review." / action "Import Statement"
- PaymentsPage Receivables empty: "No receivables yet" / "Customer payments will appear here once you record a receipt or sync an invoice."
- PaymentsPage Payables empty: "No payables yet" / "Vendor payments and recorded expenses will appear here."
- PaymentsPage Payment Links empty: "No payment links yet" / "Create a payment link to share with clients and start collecting online."
- PaymentsPage Reconciliation empty: "No reconciliations yet" / "Bank-to-book matches will appear here once payments are reconciled."
- PaymentsPage Collection by Method empty: "No collections yet" / "Collection breakdown by payment method will appear here once payments are recorded."
- PaymentsPage Weekly Payment Trend empty: "No payment trend yet" / "Weekly collected vs paid trend will appear here once you have payment history."

## Error handling
- Each page now reads `error` from the hooks (`paymentsHook.error || expensesHook.error || …`).
- When `error` is non-null AND `loading` is false, a small banner Card renders above the Tabs content with an AlertCircle icon, the error message, and a "Retry" button.
- Retry button increments a `retryKey` state used as the `key` on the root div — this forces a full component re-mount which re-subscribes to all Firestore `onSnapshot` listeners.

## Loading states
- Reuses the existing `<Loader2 className="h-5 w-5 animate-spin text-emerald-600" />` spinner centered in a `py-12` container for the stat-cards section (shown when `loading` is true).
- Per-button loading via `busyId` state — when an async write is in flight for a specific row/button, that button swaps its icon for `<Loader2 className="h-3 w-3 animate-spin" />` and becomes `disabled`.

## Verification
- `bun run lint` → only 2 pre-existing errors remain (in `src/app/page.tsx:249` and `src/components/oracle/OracleDockSidebar.tsx:69`, both about `setState-in-effect` — NOT introduced by this task). Zero new lint errors in BankingPage.tsx or PaymentsPage.tsx.
- `npx tsc --noEmit` → zero TypeScript errors in either edited file.
- `dev.log` tail → multiple `✓ Compiled in XXXms` entries after edits; no "Failed to compile", no "Module not found", no "TypeError", no "ReferenceError" related to my new code. Dev server healthy on port 3000.

## UI preservation
All visual elements preserved 1:1 — layout, cards, charts (BalanceTrendChart, ReconcileDonut, CollectionMethodChart, PaymentTrendChart), tabs, colors, spacing, motion animations. Charts now derive from real Firestore data; when data is empty they show the existing EmptyState (preserved behavior). The only additions are: (a) `onClick` handlers on the previously-noop action buttons, (b) per-button Loader2 spinner swap when busy, (c) the error banner Card above the Tabs content (only renders when `error` is non-null).

## Notes for downstream agents
- `window.prompt()` is used for create flows to capture minimal user input without adding new UI components. This is a browser-native dialog and does NOT change the visual layout. If a future agent wants to replace these with proper Dialog forms (using shadcn Dialog + form components), the handler functions (`handleAddAccount`, `handleRecordPayment`) are the only places that need to change — the Firestore service calls themselves are stable.
- The `busyId` state pattern (`string | null`) is reusable — set to a unique key (e.g. row id, or 'new-account' / 'sync-all' / 'auto-reconcile' for bulk actions) before the await, reset to null in the finally block.
- `lastSyncAt` is passed as `new Date().toISOString()` (a string) rather than `serverTimestamp()`. The Firestore hook's `convertDoc` helper handles both Timestamp and string transparently, and `formatSyncDate` expects an ISO string. This is consistent and avoids needing to import `serverTimestamp` in the component.
