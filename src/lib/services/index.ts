// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Shared Service Layer (barrel)
// ═══════════════════════════════════════════════════════════════════════════════
//
// The canonical business-logic layer. Both the REST API routes (in /api/...)
// AND VEYRO AI Action Engine import from here so writes, audit logs, graph
// events, timeline events, and activity logs are identical regardless of
// whether the action originated from a button click or a natural-language
// command to Oracle.
// ═══════════════════════════════════════════════════════════════════════════════

export type { Actor, ServiceResult } from './types';

export {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  findOrCreateCustomer,
  isValidGstin,
  type CreateCustomerInput,
  type CustomerRecord,
} from './customers';

export {
  createInvoice,
  updateInvoice,
  deleteInvoice,
  duplicateInvoice,
  sendInvoice,
  type CreateInvoiceInput,
  type InvoiceLineItemInput,
  type InvoiceRecord,
} from './invoices';

export {
  createExpense,
  updateExpense,
  deleteExpense,
  type CreateExpenseInput,
  type ExpenseRecord,
} from './expenses';

export {
  recordPayment,
  markInvoicePaid,
  refundPayment,
  type RecordPaymentInput,
  type PaymentRecord,
} from './payments';
