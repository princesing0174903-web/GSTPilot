// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing™ — Invoice Engine (SERVER-ONLY, pure functions)
//
// Pure functions for invoice generation:
//   • Invoice number generation (GSTP/{YYYY}/{MM}/{seq:05d})
//   • Receipt number generation (RCT/{YYYY}/{MM}/{seq:05d})
//   • Tax invoice line items from a plan + cycle
//   • GST calculation (same-state CGST+SGST 9% each, inter-state IGST 18%)
//   • Full invoice document construction
//   • Receipts, credit notes, debit notes, refund receipts
//   • Invoice state transitions (markAsPaid, markAsVoid)
//
// All functions are PURE (no Firebase). Inputs/outputs are plain values.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  BillingInvoice,
  BillingInvoiceLineItem,
  BillingCycle,
  Coupon,
  CreateInvoiceInput,
  InvoiceStatus,
  InvoiceType,
  Payment,
  Receipt,
  SubscriptionPlan,
  SubscriptionPlanId,
} from '../types';
import { getPlan, getPlanPrice } from './plans';
import { applyCouponToAmount } from './billing-engine';
import { InvoiceNotFoundError, ValidationError } from '../errors';

// ─── Number Generators ────────────────────────────────────────────────────────

const GST_RATE = 0.18; // 18% GST on SaaS subscriptions
const CGST_RATE = 0.09; // 9% CGST (same-state)
const SGST_RATE = 0.09; // 9% SGST (same-state)
const IGST_RATE = 0.18; // 18% IGST (inter-state)
const CESS_RATE = 0;    // 0% cess

/**
 * Generate an invoice number: GSTP/{YYYY}/{MM}/{sequence:05d}
 * Example: GSTP/2024/01/00001
 */
export function generateInvoiceNumber(prefix: string, sequence: number, date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const seq = String(sequence).padStart(5, '0');
  return `${prefix}/${year}/${month}/${seq}`;
}

/**
 * Generate a receipt number: RCT/{YYYY}/{MM}/{sequence:05d}
 * Example: RCT/2024/01/00001
 */
export function generateReceiptNumber(sequence: number, date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const seq = String(sequence).padStart(5, '0');
  return `RCT/${year}/${month}/${seq}`;
}

// ─── Line Items ───────────────────────────────────────────────────────────────

/**
 * Build the line items for a tax invoice from a plan + cycle.
 * Example line: "Professional Plan — Monthly Subscription" × 1 @ ₹4,999
 */
export function buildTaxInvoiceLines(
  plan: SubscriptionPlan,
  cycle: BillingCycle,
  _coupon?: Coupon | null,
  _periodStart?: string,
  _periodEnd?: string,
): BillingInvoiceLineItem[] {
  const unitPrice = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const description = `${plan.name} Plan — ${cycle === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`;

  return [
    {
      description,
      quantity: 1,
      unitPrice,
      amount: unitPrice,
      taxable: true,
      hsnCode: '998314', // IT software services (SaaS)
    },
  ];
}

// ─── Tax Calculation ──────────────────────────────────────────────────────────

/**
 * Calculate the invoice totals (subtotal, discount, tax breakdown, total).
 *
 * GST rules:
 *   • Same state (organizationState === billingState) → CGST 9% + SGST 9% = 18%
 *   • Different state → IGST 18%
 *   • Cess is always 0% for SaaS
 *   • Tax-exempt orgs pay 0% GST
 *
 * @param lineItems - The line items (taxable items get GST applied)
 * @param coupon - Optional coupon (discount applied before tax)
 * @param organizationState - The org's state (e.g. 'Maharashtra')
 * @param billingState - The billing address state (e.g. 'Karnataka')
 */
export function calculateInvoiceTotals(
  lineItems: BillingInvoiceLineItem[],
  coupon?: Coupon | null,
  organizationState?: string,
  billingState?: string,
): {
  subtotal: number;
  discount: number;
  taxBreakdown: { cgst: number; sgst: number; igst: number; cess: number };
  tax: number;
  total: number;
} {
  // Subtotal = sum of taxable + non-taxable line items.
  const subtotal = round2(
    lineItems.reduce((sum, li) => sum + li.amount, 0),
  );

  // Apply coupon discount to the subtotal.
  let discount = 0;
  if (coupon) {
    const { discountAmount } = applyCouponToAmount(subtotal, coupon);
    discount = discountAmount;
  }

  // Taxable amount = subtotal - discount.
  const taxableAmount = round2(subtotal - discount);

  // Determine same-state vs inter-state GST.
  const sameState =
    !!organizationState &&
    !!billingState &&
    organizationState.toLowerCase() === billingState.toLowerCase();

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  const cess = 0;

  if (sameState) {
    cgst = round2(taxableAmount * CGST_RATE);
    sgst = round2(taxableAmount * SGST_RATE);
  } else {
    igst = round2(taxableAmount * IGST_RATE);
  }

  const tax = round2(cgst + sgst + igst + cess);
  const total = round2(taxableAmount + tax);

  return {
    subtotal,
    discount,
    taxBreakdown: { cgst, sgst, igst, cess },
    tax,
    total,
  };
}

// ─── Invoice Builders ─────────────────────────────────────────────────────────

/**
 * Build a full tax invoice document from the input.
 * Used by the orchestrator when a subscription is created or renewed.
 */
export function buildTaxInvoice(input: CreateInvoiceInput): BillingInvoice {
  if (!input.planId) {
    throw new ValidationError('planId is required for tax invoices.');
  }
  const plan = getPlan(input.planId);
  if (!plan) {
    throw new ValidationError(`Plan ${input.planId} not found.`);
  }
  if (!input.billingCycle) {
    throw new ValidationError('billingCycle is required for tax invoices.');
  }

  const cycle = input.billingCycle;
  const coupon = null; // Coupon lookup happens in the orchestrator
  const lineItems = buildTaxInvoiceLines(plan, cycle, coupon, input.periodStart, input.periodEnd);
  const totals = calculateInvoiceTotals(
    lineItems,
    coupon,
    input.organizationState,
    input.billingState,
  );

  const now = new Date();
  const issueDate = now.toISOString();
  const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
  // Deterministic-ish invoice number (in production this would be a sequence).
  const seq = Math.floor(Math.random() * 90000) + 10000;
  const invoiceNumber = generateInvoiceNumber('GSTP', seq, now);

  return {
    id: '', // Set by Firestore on save
    organizationId: input.organizationId,
    subscriptionId: input.subscriptionId,
    invoiceNumber,
    type: 'tax_invoice',
    status: 'sent',
    issueDate,
    dueDate,
    paidDate: null,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    lineItems,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    taxBreakdown: totals.taxBreakdown,
    total: totals.total,
    amountPaid: 0,
    amountDue: totals.total,
    currency: 'INR',
    notes: `Subscription: ${plan.name} Plan (${cycle})`,
    couponCode: input.couponCode ?? null,
    linkedInvoiceId: null,
    pdfReady: false,
    pdfPath: null,
    createdAt: issueDate,
    updatedAt: issueDate,
  };
}

/**
 * Build a credit note for a refund or downgrade.
 * Negative amounts; linkedInvoiceId points to the original invoice.
 */
export function buildCreditNote(
  originalInvoice: BillingInvoice,
  amount: number,
  reason: string,
): BillingInvoice {
  const now = new Date();
  const issueDate = now.toISOString();
  const seq = Math.floor(Math.random() * 90000) + 10000;
  const invoiceNumber = generateInvoiceNumber('GSTP-CN', seq, now);

  const lineItems: BillingInvoiceLineItem[] = [
    {
      description: `Credit note — ${reason}`,
      quantity: 1,
      unitPrice: -round2(amount),
      amount: -round2(amount),
      taxable: false,
      hsnCode: null,
    },
  ];

  return {
    id: '',
    organizationId: originalInvoice.organizationId,
    subscriptionId: originalInvoice.subscriptionId,
    invoiceNumber,
    type: 'credit_note',
    status: 'sent',
    issueDate,
    dueDate: issueDate,
    paidDate: null,
    periodStart: originalInvoice.periodStart,
    periodEnd: originalInvoice.periodEnd,
    lineItems,
    subtotal: -round2(amount),
    discount: 0,
    tax: 0,
    taxBreakdown: { cgst: 0, sgst: 0, igst: 0, cess: 0 },
    total: -round2(amount),
    amountPaid: 0,
    amountDue: -round2(amount),
    currency: 'INR',
    notes: `Credit note for invoice ${originalInvoice.invoiceNumber}: ${reason}`,
    couponCode: null,
    linkedInvoiceId: originalInvoice.id,
    pdfReady: false,
    pdfPath: null,
    createdAt: issueDate,
    updatedAt: issueDate,
  };
}

/**
 * Build a debit note for an additional charge (e.g. upgrade proration).
 * Positive amounts; linkedInvoiceId points to the original invoice.
 */
export function buildDebitNote(
  originalInvoice: BillingInvoice,
  amount: number,
  reason: string,
): BillingInvoice {
  const now = new Date();
  const issueDate = now.toISOString();
  const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const seq = Math.floor(Math.random() * 90000) + 10000;
  const invoiceNumber = generateInvoiceNumber('GSTP-DN', seq, now);

  // Compute tax on the additional charge (assume inter-state IGST for debit notes
  // since the original invoice's state info isn't always available here).
  const tax = round2(amount * IGST_RATE);

  const lineItems: BillingInvoiceLineItem[] = [
    {
      description: `Debit note — ${reason}`,
      quantity: 1,
      unitPrice: round2(amount),
      amount: round2(amount),
      taxable: true,
      hsnCode: '998314',
    },
  ];

  return {
    id: '',
    organizationId: originalInvoice.organizationId,
    subscriptionId: originalInvoice.subscriptionId,
    invoiceNumber,
    type: 'debit_note',
    status: 'sent',
    issueDate,
    dueDate,
    paidDate: null,
    periodStart: originalInvoice.periodStart,
    periodEnd: originalInvoice.periodEnd,
    lineItems,
    subtotal: round2(amount),
    discount: 0,
    tax,
    taxBreakdown: { cgst: 0, sgst: 0, igst: tax, cess: 0 },
    total: round2(amount + tax),
    amountPaid: 0,
    amountDue: round2(amount + tax),
    currency: 'INR',
    notes: `Debit note for invoice ${originalInvoice.invoiceNumber}: ${reason}`,
    couponCode: null,
    linkedInvoiceId: originalInvoice.id,
    pdfReady: false,
    pdfPath: null,
    createdAt: issueDate,
    updatedAt: issueDate,
  };
}

// ─── Receipts ─────────────────────────────────────────────────────────────────

/**
 * Build a receipt for a successful payment.
 */
export function buildReceipt(payment: Payment, invoice?: BillingInvoice | null): Receipt {
  const now = new Date();
  const seq = Math.floor(Math.random() * 90000) + 10000;
  const receiptNumber = generateReceiptNumber(seq, now);

  return {
    id: '',
    organizationId: payment.organizationId,
    paymentId: payment.id,
    invoiceId: invoice?.id ?? payment.invoiceId,
    receiptNumber,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    provider: payment.provider,
    issuedTo: {
      name: '', // Filled by orchestrator from billing account
      email: '', // Filled by orchestrator from billing account
      phone: null,
    },
    notes: payment.description ?? null,
    createdAt: now.toISOString(),
  };
}

/**
 * Build a refund receipt for a refunded payment.
 */
export function buildRefundReceipt(payment: Payment, refundAmount: number): Receipt {
  const now = new Date();
  const seq = Math.floor(Math.random() * 90000) + 10000;
  const receiptNumber = generateReceiptNumber(seq, now);

  return {
    id: '',
    organizationId: payment.organizationId,
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    receiptNumber,
    amount: refundAmount,
    currency: payment.currency,
    method: payment.method,
    provider: payment.provider,
    issuedTo: {
      name: '',
      email: '',
      phone: null,
    },
    notes: `Refund for payment ${payment.id}`,
    createdAt: now.toISOString(),
  };
}

// ─── Invoice State Transitions ────────────────────────────────────────────────

/**
 * Mark an invoice as paid (sets status='paid', amountPaid, amountDue=0, paidDate).
 */
export function markInvoiceAsPaid(
  invoice: BillingInvoice,
  payment: Payment,
  paidDate: string,
): BillingInvoice {
  if (invoice.status === 'paid') {
    return invoice;
  }
  return {
    ...invoice,
    status: 'paid' as InvoiceStatus,
    amountPaid: round2(invoice.amountPaid + payment.amount),
    amountDue: round2(Math.max(0, invoice.amountDue - payment.amount)),
    paidDate,
    updatedAt: paidDate,
  };
}

/**
 * Mark an invoice as void.
 */
export function markInvoiceAsVoid(invoice: BillingInvoice): BillingInvoice {
  return {
    ...invoice,
    status: 'void',
    updatedAt: new Date().toISOString(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Get the InvoiceType for an invoice. Convenience for type narrowing.
 */
export function getInvoiceType(invoice: BillingInvoice): InvoiceType {
  return invoice.type;
}

/**
 * Look up an invoice by id in a list. Throws InvoiceNotFoundError if not found.
 */
export function findInvoice(invoices: BillingInvoice[], invoiceId: string): BillingInvoice {
  const invoice = invoices.find((i) => i.id === invoiceId);
  if (!invoice) {
    throw new InvoiceNotFoundError(`Invoice ${invoiceId} not found.`);
  }
  return invoice;
}
