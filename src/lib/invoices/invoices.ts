// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Sales Invoice Cloud™
// Create, Number, Total, Track, Collect. Pure TypeScript, no Prisma, no Next.
// ═══════════════════════════════════════════════════════════════════════════════

import type { InvoiceCloudInvoice, InvoiceStatus, PaymentStatus } from './types';

// ─── Numbering ─────────────────────────────────────────────────────────────────

/**
 * Generates the next invoice number in the "INV-YYYY-NNN" sequence by parsing
 * the highest existing numeric suffix and incrementing it. Year is current FY.
 */
export function generateInvoiceNumber(existing: string[], prefix = 'INV'): string {
  const year = new Date().getFullYear();
  const fyPrefix = `${prefix}-${year}-`;
  let maxSeq = 0;
  for (const num of existing) {
    if (!num || !num.startsWith(fyPrefix)) continue;
    const tail = num.slice(fyPrefix.length);
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
  }
  const next = maxSeq + 1;
  return `${fyPrefix}${String(next).padStart(3, '0')}`;
}

// ─── Totals & GST ──────────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  taxableValue: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
}

export interface InvoiceTotals {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  gstAmount: number;
  totalAmount: number;
}

/**
 * Aggregates a list of line items into GST-split totals. Either CGST+SGST
 * (intra-state) or IGST (inter-state) is populated depending on the rates set
 * per line. cess is not modelled at line level here — caller can extend.
 */
export function calculateInvoiceTotals(items: InvoiceLineItem[]): InvoiceTotals {
  let taxableValue = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  for (const it of items) {
    taxableValue += it.taxableValue;
    cgst += (it.taxableValue * it.cgstRate) / 100;
    sgst += (it.taxableValue * it.sgstRate) / 100;
    igst += (it.taxableValue * it.igstRate) / 100;
  }
  const gstAmount = round2(cgst + sgst + igst);
  return {
    taxableValue: round2(taxableValue),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    gstAmount,
    totalAmount: round2(taxableValue + gstAmount),
  };
}

export function computeBalance(paidAmount: number, totalAmount: number): number {
  return round2(Math.max(0, totalAmount - paidAmount));
}

// ─── Status derivation ─────────────────────────────────────────────────────────

export function derivePaymentStatus(
  paidAmount: number,
  totalAmount: number,
  dueDate?: string,
): PaymentStatus {
  if (paidAmount >= totalAmount && totalAmount > 0) return 'paid';
  if (dueDate && isOverdue(dueDate, paidAmount, totalAmount)) return 'overdue';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

export function isOverdue(dueDate: string, paidAmount: number, totalAmount: number): boolean {
  if (paidAmount >= totalAmount) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

export function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;
  const diff = Date.now() - due.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
}

export function daysToDue(dueDate: string): number {
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;
  const diff = due.getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days;
}

// ─── Indian currency formatting ────────────────────────────────────────────────

/**
 * Formats an amount in Indian numbering with the ₹ symbol — e.g. 123456 → "₹1,23,456".
 */
export function formatInvoiceCurrency(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(abs);
  return `${sign}₹${formatted}`;
}

// ─── Stats & filters ───────────────────────────────────────────────────────────

export interface InvoiceStatsResult {
  total: number;
  paid: number;
  outstanding: number;
  overdue: number;
  draftCount: number;
}

export function getInvoiceStats(invoices: InvoiceCloudInvoice[]): InvoiceStatsResult {
  let total = 0;
  let paid = 0;
  let outstanding = 0;
  let overdue = 0;
  let draftCount = 0;
  for (const inv of invoices) {
    total += inv.totalAmount;
    if (inv.status === 'draft') draftCount += 1;
    if (inv.paymentStatus === 'paid') paid += inv.paidAmount;
    if (inv.paymentStatus !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft') {
      outstanding += inv.balanceAmount;
    }
    if (inv.paymentStatus === 'overdue' || isOverdue(inv.dueDate ?? '', inv.paidAmount, inv.totalAmount)) {
      overdue += inv.balanceAmount;
    }
  }
  return {
    total: round2(total),
    paid: round2(paid),
    outstanding: round2(outstanding),
    overdue: round2(overdue),
    draftCount,
  };
}

export function filterInvoicesByStatus(
  invoices: InvoiceCloudInvoice[],
  status: InvoiceStatus,
): InvoiceCloudInvoice[] {
  return invoices.filter((i) => i.status === status);
}

export function sortInvoicesByDate(
  invoices: InvoiceCloudInvoice[],
  dir: 'asc' | 'desc' = 'desc',
): InvoiceCloudInvoice[] {
  const sorted = [...invoices].sort((a, b) => {
    const da = new Date(a.invoiceDate).getTime();
    const db = new Date(b.invoiceDate).getTime();
    return dir === 'asc' ? da - db : db - da;
  });
  return sorted;
}

// ─── Seed data: 12 realistic Indian sales invoices ────────────────────────────

const INVOICE_SEED: Array<Omit<InvoiceCloudInvoice, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    clientId: 'seed-client-1',
    invoiceNumber: 'INV-2025-001',
    invoiceDate: '2025-04-03',
    sellerGstin: '27ABCDE1234F1Z5',
    buyerGstin: '29AAACR5055K1Z5',
    buyerName: 'Infosys Limited',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 450000,
    cgst: 0,
    sgst: 0,
    igst: 81000,
    cess: 0,
    totalAmount: 531000,
    hsnCode: '998314',
    reverseCharge: false,
    status: 'paid',
    matchStatus: 'matched',
    riskLevel: 'low',
    riskScore: 0,
    aiExplanation: 'On-time B2B settlement, fully reconciled.',
    notes: 'Annual consulting retainer',
    period: '2025-04',
    assignedTo: 'arjun@gstpilot.in',
    dueDate: '2025-05-03',
    gstAmount: 81000,
    paidAmount: 531000,
    balanceAmount: 0,
    paymentStatus: 'paid',
    paymentMode: 'bank',
    paymentDate: '2025-04-28',
    recurring: true,
    recurringCycle: 'yearly',
    notesFinance: 'Retainer renewed for FY26.',
    sentToCustomer: true,
    sentAt: '2025-04-03T09:30:00.000Z',
  },
  {
    clientId: 'seed-client-1',
    invoiceNumber: 'INV-2025-002',
    invoiceDate: '2025-05-12',
    sellerGstin: '27ABCDE1234F1Z5',
    buyerGstin: '27AABCT1332L1Z1',
    buyerName: 'Tata Consultancy Services',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 280000,
    cgst: 25200,
    sgst: 25200,
    igst: 0,
    cess: 0,
    totalAmount: 330400,
    hsnCode: '998314',
    reverseCharge: false,
    status: 'partial',
    matchStatus: 'matched',
    riskLevel: 'low',
    riskScore: 5,
    aiExplanation: 'Partial payment received; balance tracked.',
    notes: 'GST software implementation',
    period: '2025-05',
    assignedTo: 'arjun@gstpilot.in',
    dueDate: '2025-06-11',
    gstAmount: 50400,
    paidAmount: 200000,
    balanceAmount: 130400,
    paymentStatus: 'partial',
    paymentMode: 'upi',
    paymentDate: '2025-05-30',
    recurring: false,
    recurringCycle: null,
    notesFinance: 'Two-installment plan agreed verbally.',
    sentToCustomer: true,
    sentAt: '2025-05-12T04:15:00.000Z',
  },
  {
    clientId: 'seed-client-2',
    invoiceNumber: 'INV-2025-003',
    invoiceDate: '2025-06-08',
    sellerGstin: '27ABCDE1234F1Z5',
    buyerGstin: '33AABCT1332L1Z3',
    buyerName: 'Cognizant Technology Solutions',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 615000,
    cgst: 0,
    sgst: 0,
    igst: 110700,
    cess: 0,
    totalAmount: 725700,
    hsnCode: '998314',
    reverseCharge: false,
    status: 'overdue',
    matchStatus: 'matched',
    riskLevel: 'medium',
    riskScore: 35,
    aiExplanation: 'Past due 22 days; reminder schedule active.',
    notes: 'Quarterly compliance retainer',
    period: '2025-06',
    assignedTo: 'meera@gstpilot.in',
    dueDate: '2025-07-08',
    gstAmount: 110700,
    paidAmount: 0,
    balanceAmount: 725700,
    paymentStatus: 'overdue',
    paymentMode: null,
    paymentDate: null,
    recurring: true,
    recurringCycle: 'quarterly',
    notesFinance: 'Auto-escalate after day 30.',
    sentToCustomer: true,
    sentAt: '2025-06-08T05:00:00.000Z',
  },
  {
    clientId: 'seed-client-1',
    invoiceNumber: 'INV-2025-004',
    invoiceDate: '2025-07-15',
    sellerGstin: '27ABCDE1234F1Z5',
    buyerGstin: '24AABCC4069H1Z9',
    buyerName: 'Zoho Corporation Pvt Ltd',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 95000,
    cgst: 8550,
    sgst: 8550,
    igst: 0,
    cess: 0,
    totalAmount: 112100,
    hsnCode: '998314',
    reverseCharge: false,
    status: 'paid',
    matchStatus: 'matched',
    riskLevel: 'low',
    riskScore: 0,
    notes: 'One-time SaaS integration',
    period: '2025-07',
    assignedTo: 'arjun@gstpilot.in',
    dueDate: '2025-08-14',
    gstAmount: 17100,
    paidAmount: 112100,
    balanceAmount: 0,
    paymentStatus: 'paid',
    paymentMode: 'bank',
    paymentDate: '2025-08-01',
    recurring: false,
    recurringCycle: null,
    notesFinance: null,
    sentToCustomer: true,
    sentAt: '2025-07-15T06:20:00.000Z',
  },
  {
    clientId: 'seed-client-3',
    invoiceNumber: 'INV-2025-005',
    invoiceDate: '2025-08-22',
    sellerGstin: '27ABCDE1234F1Z5',
    buyerGstin: null,
    buyerName: 'Ramesh Electronics',
    invoiceType: 'B2C',
    gstr1Section: 'b2cl',
    taxableValue: 35000,
    cgst: 6300,
    sgst: 6300,
    igst: 0,
    cess: 0,
    totalAmount: 47600,
    hsnCode: '998314',
    reverseCharge: false,
    status: 'sent',
    matchStatus: 'unmatched',
    riskLevel: 'low',
    riskScore: 10,
    notes: 'Walk-in B2C service',
    period: '2025-08',
    assignedTo: 'meera@gstpilot.in',
    dueDate: '2025-09-21',
    gstAmount: 12600,
    paidAmount: 0,
    balanceAmount: 47600,
    paymentStatus: 'unpaid',
    paymentMode: null,
    paymentDate: null,
    recurring: false,
    recurringCycle: null,
    notesFinance: 'Awaiting customer payment.',
    sentToCustomer: true,
    sentAt: '2025-08-22T03:00:00.000Z',
  },
  {
    clientId: 'seed-client-2',
    invoiceNumber: 'INV-2025-006',
    invoiceDate: '2025-09-05',
    sellerGstin: '27ABCDE1234F1Z5',
    buyerGstin: '07AAACI1681G1Z9',
    buyerName: 'Bharti Airtel Limited',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 1250000,
    cgst: 0,
    sgst: 0,
    igst: 225000,
    cess: 0,
    totalAmount: 1475000,
    hsnCode: '998314',
    reverseCharge: false,
    status: 'partial',
    matchStatus: 'matched',
    riskLevel: 'medium',
    riskScore: 25,
    aiExplanation: '50% advance received; balance due in 30 days.',
    notes: 'Annual managed services contract',
    period: '2025-09',
    assignedTo: 'arjun@gstpilot.in',
    dueDate: '2025-10-05',
    gstAmount: 225000,
    paidAmount: 750000,
    balanceAmount: 725000,
    paymentStatus: 'partial',
    paymentMode: 'bank',
    paymentDate: '2025-09-20',
    recurring: true,
    recurringCycle: 'yearly',
    notesFinance: 'Milestone-based billing.',
    sentToCustomer: true,
    sentAt: '2025-09-05T02:45:00.000Z',
  },
  {
    clientId: 'seed-client-1',
    invoiceNumber: 'INV-2025-007',
    invoiceDate: '2025-10-11',
    sellerGstin: '27ABCDE1234F1Z5',
    buyerGstin: '29AABCR1718E1Z2',
    buyerName: 'Wipro Enterprises',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 185000,
    cgst: 0,
    sgst: 0,
    igst: 33300,
    cess: 0,
    totalAmount: 218300,
    hsnCode: '998314',
    reverseCharge: false,
    status: 'draft',
    matchStatus: 'unmatched',
    riskLevel: 'low',
    riskScore: 0,
    notes: 'Pending client PO confirmation',
    period: '2025-10',
    assignedTo: 'meera@gstpilot.in',
    dueDate: '2025-11-10',
    gstAmount: 33300,
    paidAmount: 0,
    balanceAmount: 218300,
    paymentStatus: 'unpaid',
    paymentMode: null,
    paymentDate: null,
    recurring: false,
    recurringCycle: null,
    notesFinance: 'Hold send until PO received.',
    sentToCustomer: false,
    sentAt: null,
  },
  {
    clientId: 'seed-client-3',
    invoiceNumber: 'INV-2025-008',
    invoiceDate: '2025-11-19',
    sellerGstin: '27ABCDE1234F1Z5',
    buyerGstin: '27AAACR5055K1Z5',
    buyerName: 'Infosys Limited',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 540000,
    cgst: 48600,
    sgst: 48600,
    igst: 0,
    cess: 0,
    totalAmount: 637200,
    hsnCode: '998314',
    reverseCharge: false,
    status: 'sent',
    matchStatus: 'matched',
    riskLevel: 'low',
    riskScore: 8,
    notes: 'Phase 2 implementation',
    period: '2025-11',
    assignedTo: 'arjun@gstpilot.in',
    dueDate: '2025-12-19',
    gstAmount: 97200,
    paidAmount: 0,
    balanceAmount: 637200,
    paymentStatus: 'unpaid',
    paymentMode: null,
    paymentDate: null,
    recurring: false,
    recurringCycle: null,
    notesFinance: 'Net-30 standard.',
    sentToCustomer: true,
    sentAt: '2025-11-19T04:30:00.000Z',
  },
  {
    clientId: 'seed-client-2',
    invoiceNumber: 'INV-2025-009',
    invoiceDate: '2025-12-02',
    sellerGstin: '27ABCDE1234F1Z5',
    buyerGstin: '33AABCT1332L1Z3',
    buyerName: 'Cognizant Technology Solutions',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 615000,
    cgst: 0,
    sgst: 0,
    igst: 110700,
    cess: 0,
    totalAmount: 725700,
    hsnCode: '998314',
    reverseCharge: false,
    status: 'overdue',
    matchStatus: 'matched',
    riskLevel: 'high',
    riskScore: 55,
    aiExplanation: 'Recurring invoice past due; previous quarter also delayed.',
    notes: 'Quarterly compliance retainer — Q3',
    period: '2025-12',
    assignedTo: 'meera@gstpilot.in',
    dueDate: '2026-01-01',
    gstAmount: 110700,
    paidAmount: 0,
    balanceAmount: 725700,
    paymentStatus: 'overdue',
    paymentMode: null,
    paymentDate: null,
    recurring: true,
    recurringCycle: 'quarterly',
    notesFinance: 'Final reminder issued.',
    sentToCustomer: true,
    sentAt: '2025-12-02T03:00:00.000Z',
  },
  {
    clientId: 'seed-client-1',
    invoiceNumber: 'INV-2026-001',
    invoiceDate: '2026-01-08',
    sellerGstin: '27ABCDE1234F1Z5',
    buyerGstin: '27AABCT1332L1Z1',
    buyerName: 'Tata Consultancy Services',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 320000,
    cgst: 28800,
    sgst: 28800,
    igst: 0,
    cess: 0,
    totalAmount: 377600,
    hsnCode: '998314',
    reverseCharge: false,
    status: 'sent',
    matchStatus: 'matched',
    riskLevel: 'low',
    riskScore: 5,
    notes: 'GST audit support — Q4',
    period: '2026-01',
    assignedTo: 'arjun@gstpilot.in',
    dueDate: '2026-02-07',
    gstAmount: 57600,
    paidAmount: 0,
    balanceAmount: 377600,
    paymentStatus: 'unpaid',
    paymentMode: null,
    paymentDate: null,
    recurring: false,
    recurringCycle: null,
    notesFinance: 'Standard Net-30.',
    sentToCustomer: true,
    sentAt: '2026-01-08T05:15:00.000Z',
  },
  {
    clientId: 'seed-client-3',
    invoiceNumber: 'INV-2026-002',
    invoiceDate: '2026-02-14',
    sellerGstin: '27ABCDE1234F1Z5',
    buyerGstin: '24AABCC4069H1Z9',
    buyerName: 'Zoho Corporation Pvt Ltd',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 78000,
    cgst: 0,
    sgst: 0,
    igst: 14040,
    cess: 0,
    totalAmount: 92040,
    hsnCode: '998314',
    reverseCharge: false,
    status: 'paid',
    matchStatus: 'matched',
    riskLevel: 'low',
    riskScore: 0,
    notes: 'Feature add-on module',
    period: '2026-02',
    assignedTo: 'meera@gstpilot.in',
    dueDate: '2026-03-16',
    gstAmount: 14040,
    paidAmount: 92040,
    balanceAmount: 0,
    paymentStatus: 'paid',
    paymentMode: 'upi',
    paymentDate: '2026-02-25',
    recurring: false,
    recurringCycle: null,
    notesFinance: 'Settled early — 11 days.',
    sentToCustomer: true,
    sentAt: '2026-02-14T06:00:00.000Z',
  },
  {
    clientId: 'seed-client-2',
    invoiceNumber: 'INV-2026-003',
    invoiceDate: '2026-03-04',
    sellerGstin: '27ABCDE1234F1Z5',
    buyerGstin: null,
    buyerName: 'Sundaram Retail Outlet',
    invoiceType: 'B2C',
    gstr1Section: 'b2cl',
    taxableValue: 22500,
    cgst: 4050,
    sgst: 4050,
    igst: 0,
    cess: 0,
    totalAmount: 30600,
    hsnCode: '998314',
    reverseCharge: false,
    status: 'cancelled',
    matchStatus: 'unmatched',
    riskLevel: 'low',
    riskScore: 0,
    notes: 'Cancelled — service not rendered',
    period: '2026-03',
    assignedTo: 'meera@gstpilot.in',
    dueDate: '2026-04-03',
    gstAmount: 8100,
    paidAmount: 0,
    balanceAmount: 0,
    paymentStatus: 'unpaid',
    paymentMode: null,
    paymentDate: null,
    recurring: false,
    recurringCycle: null,
    notesFinance: 'Credit note issued.',
    sentToCustomer: false,
    sentAt: null,
  },
];

export function seedInvoices(): InvoiceCloudInvoice[] {
  const nowIso = new Date().toISOString();
  return INVOICE_SEED.map((row, idx) => ({
    ...row,
    id: `seed-inv-${idx + 1}`,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
