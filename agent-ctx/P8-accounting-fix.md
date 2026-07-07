# P8-accounting-fix — Accounting Rebuilder

## What I did
Rebuilt `src/components/accounting/AccountingPage.tsx` from 100% static demo (504 lines of hardcoded COA/JE/stat arrays) into a real computed-from-Firestore implementation (~1100 lines).

## Files modified
- `src/components/accounting/AccountingPage.tsx` (full rewrite — only file touched)

## Approach
- Subscribed to existing hooks: `useFireInvoices`, `useFireExpenses`, `useFirePayments`, `useFireBankAccounts`, `useFireBankTransactions`.
- Wrote pure compute functions for: stat cards, Chart of Accounts, Journal Entries (invoice/expense/payment → Dr/Cr math), 12-month trend, aging buckets, CSV export.
- Built a `ReportDialog` component handling 6 reports (P&L, Balance Sheet, Trial Balance, Cash Flow, General Ledger w/ account filter, Aging) — all from real loaded data.
- "New Entry" / "New Account" buttons honestly open a "coming soon" dialog instead of being dead.
- Loading skeletons, EmptyState, sonner error toasts wired throughout.

## Lint status
`bun run lint` → EXIT 0, zero warnings.

## Notes for downstream agents
- `Retained Earnings` = current-period Net Profit (no prior-year carryforward yet — flagged in UI hint).
- "Change %" column in COA shows "—" (no historical comparison yet).
- Invoice `status === 'filed'` is treated as fully realised (not counted in AR).
- GST Payable = output tax (sum of cgst+sgst+igst+cess on non-draft invoices) minus input tax (sum of expense.gst).
- Aging uses pragmatic 30-day payment terms (due = invoiceDate + 30d) since invoices have no explicit dueDate field.
- Investing & financing cash-flow activities are NOT yet implemented (full engine needed) — UI says so.
