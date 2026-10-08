// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ Phase 1 — COLLECTION ENGINE
//
// Real collection / receivables analytics:
//   • Late payments (sorted by days overdue)
//   • Outstanding invoices
//   • Expected collections (30 days)
//   • Collection probability per invoice (0-100%)
//   • Bad debt risk (Low/Medium/High/Critical)
//   • Bad debt reserve estimate
//   • Recovery strategy per invoice + overall
//
// Probability model factors: client payment history, days overdue, invoice
// amount, client health score.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CollectionAnalytics, CollectionRow, SeverityLevel } from '../types';
import type { RawCFOData, InvoiceRow, ClientRow, PaymentRow } from './data';
import { now, addDays, roundTo, trendFromPct, pctChange, startOfMonth, endOfLastMonth, startOfLastMonth } from './data';

function daysOverdue(inv: InvoiceRow, today: Date): number {
  if (inv.paymentStatus === 'paid') return 0;
  if (!inv.dueDate) {
    // Fallback to period-based due date (30 days after period end)
    if (!inv.period) return 0;
    const [y, m] = inv.period.split('-').map(Number);
    if (!y || !m) return 0;
    const due = new Date(y, m, 30);
    if (due >= today) return 0;
    return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  }
  const due = new Date(inv.dueDate);
  if (due >= today) return 0;
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

// Build client payment history: avg days to pay, count of past due payments
interface ClientHistory {
  avgDaysToPay: number;
  totalPaid: number;
  overdueCount: number;
  totalInvoices: number;
  lastPaymentDate: string | null;
}

function buildClientHistory(invoices: InvoiceRow[], payments: PaymentRow[], clients: ClientRow[]): Map<string, ClientHistory> {
  const map = new Map<string, ClientHistory>();
  // Initialize for all clients
  for (const c of clients) {
    map.set(c.id, { avgDaysToPay: 0, totalPaid: 0, overdueCount: 0, totalInvoices: 0, lastPaymentDate: null });
  }
  // For each paid invoice, compute days between invoiceDate and paymentDate (or first matching payment)
  for (const inv of invoices) {
    if (inv.paymentStatus !== 'paid' || !inv.paymentDate) continue;
    const invDate = new Date(inv.invoiceDate);
    const payDate = new Date(inv.paymentDate);
    const days = Math.floor((payDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
    const h = map.get(inv.clientId) || { avgDaysToPay: 0, totalPaid: 0, overdueCount: 0, totalInvoices: 0, lastPaymentDate: null };
    h.avgDaysToPay = h.avgDaysToPay === 0 ? days : (h.avgDaysToPay + days) / 2;
    h.totalPaid += inv.paidAmount || inv.totalAmount || 0;
    h.totalInvoices += 1;
    if (inv.dueDate && new Date(inv.dueDate) < payDate) h.overdueCount += 1;
    if (!h.lastPaymentDate || payDate > new Date(h.lastPaymentDate)) h.lastPaymentDate = inv.paymentDate;
    map.set(inv.clientId, h);
  }
  // Also factor in payments linked by invoiceId
  for (const p of payments) {
    if (p.partyType !== 'customer' || p.status !== 'completed') continue;
    if (!p.invoiceId) continue;
    const inv = invoices.find((i) => i.id === p.invoiceId);
    if (!inv) continue;
    const invDate = new Date(inv.invoiceDate);
    const payDate = new Date(p.paymentDate);
    const days = Math.floor((payDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
    const h = map.get(inv.clientId) || { avgDaysToPay: 0, totalPaid: 0, overdueCount: 0, totalInvoices: 0, lastPaymentDate: null };
    h.avgDaysToPay = h.avgDaysToPay === 0 ? days : (h.avgDaysToPay + days) / 2;
    h.totalPaid += p.amount || 0;
    if (!h.lastPaymentDate || payDate > new Date(h.lastPaymentDate)) h.lastPaymentDate = p.paymentDate;
    map.set(inv.clientId, h);
  }
  return map;
}

// Compute collection probability 0-100% based on:
//  - days overdue (more overdue = lower probability)
//  - client payment history (avg days to pay, overdue count)
//  - client health score
//  - invoice amount (large amounts slightly harder to collect)
function collectionProbability(
  inv: InvoiceRow,
  daysLate: number,
  history: ClientHistory | undefined,
  client: ClientRow | undefined,
): number {
  let prob = 95; // start optimistic for current invoices
  // If not overdue, probability based on client history
  if (daysLate <= 0) {
    if (history && history.avgDaysToPay > 0) {
      // Clients who typically pay in X days — if X is high, slightly lower prob
      if (history.avgDaysToPay > 45) prob = 80;
      else if (history.avgDaysToPay > 30) prob = 88;
    }
    return prob;
  }
  // Overdue — reduce probability based on days late
  // After 30d: ~70%, 60d: ~50%, 90d: ~30%, 180d: ~10%
  prob = 90 - (daysLate / 2);
  if (daysLate > 180) prob = Math.min(prob, 10);
  else if (daysLate > 90) prob = Math.min(prob, 30);
  else if (daysLate > 60) prob = Math.min(prob, 50);
  else if (daysLate > 30) prob = Math.min(prob, 70);

  // Client history adjustment
  if (history) {
    if (history.overdueCount >= 3) prob -= 15;
    else if (history.overdueCount >= 1) prob -= 8;
    if (history.avgDaysToPay > 0 && history.avgDaysToPay < 15) prob += 5; // reliable payer
  }
  // Client health score adjustment
  if (client && client.healthScore > 0) {
    if (client.healthScore < 30) prob -= 15;
    else if (client.healthScore < 60) prob -= 8;
    else if (client.healthScore > 80) prob += 5;
  }
  // Large invoice penalty (slightly harder to collect)
  const amt = inv.balanceAmount || inv.totalAmount || 0;
  if (amt > 500000) prob -= 5;

  return Math.max(5, Math.min(98, Math.round(prob)));
}

function badDebtRisk(prob: number): SeverityLevel {
  if (prob < 25) return 'critical';
  if (prob < 45) return 'high';
  if (prob < 70) return 'medium';
  return 'low';
}

function recoveryStrategyFor(inv: InvoiceRow, daysLate: number, prob: number): string {
  const amt = inv.balanceAmount || inv.totalAmount || 0;
  if (daysLate <= 0) {
    return `Send invoice reminder before due date. Track payment confirmation for ${inv.invoiceNumber}.`;
  }
  if (daysLate <= 7) {
    return `Send polite WhatsApp reminder to client. Invoice ${inv.invoiceNumber} (₹${Math.round(amt).toLocaleString('en-IN')}) is ${daysLate} days overdue.`;
  }
  if (daysLate <= 30) {
    return `Call client directly + email statement. Offer 1% early-payment discount if settled within 7 days. (${inv.invoiceNumber})`;
  }
  if (daysLate <= 60) {
    return `Escalate to senior partner. Send formal demand letter. Halt new deliverables until cleared. (${inv.invoiceNumber})`;
  }
  if (daysLate <= 90) {
    return `Engage collection agency. Consider legal notice under IBC / Negotiable Instruments Act. (${inv.invoiceNumber})`;
  }
  return `Write off as bad debt. Pursue legal recovery. Reverse any ITC claimed on this invoice. (${inv.invoiceNumber})`;
}

export function computeCollections(data: RawCFOData): CollectionAnalytics {
  const { invoices, clients, payments } = data;
  const today = now();

  const clientMap = new Map<string, ClientRow>();
  for (const c of clients) clientMap.set(c.id, c);
  const historyMap = buildClientHistory(invoices, payments, clients);

  // ─── Build collection rows for unpaid invoices ────────────────────────────
  const unpaidInvoices = invoices.filter((i) => i.paymentStatus !== 'paid' && i.paymentStatus !== 'cancelled');
  const collectionRows: CollectionRow[] = unpaidInvoices.map((inv) => {
    const daysLate = daysOverdue(inv, today);
    const history = historyMap.get(inv.clientId);
    const client = clientMap.get(inv.clientId);
    const prob = collectionProbability(inv, daysLate, history, client);
    const risk = badDebtRisk(prob);
    const outstanding = inv.balanceAmount || inv.totalAmount || 0;
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: client?.tradeName || inv.buyerName || 'Unknown',
      clientGstin: client?.gstin || inv.buyerGstin || '',
      invoiceAmount: Math.round(inv.totalAmount || 0),
      outstandingAmount: Math.round(outstanding),
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      daysOverdue: daysLate,
      collectionProbabilityPct: prob,
      badDebtRisk: risk,
      recoveryStrategy: recoveryStrategyFor(inv, daysLate, prob),
    };
  });

  const latePayments = collectionRows
    .filter((r) => r.daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const totalOutstanding = collectionRows.reduce((s, r) => s + r.outstandingAmount, 0);
  const overdueAmount = latePayments.reduce((s, r) => s + r.outstandingAmount, 0);

  // ─── Expected collections next 30 days ────────────────────────────────────
  // Sum of: invoices due in next 30d weighted by probability + a fraction of
  // overdue invoices (recovery expectation)
  const next30 = addDays(today, 30);
  const dueIn30 = collectionRows.filter((r) => {
    if (!r.dueDate) return false;
    const due = new Date(r.dueDate);
    return due >= today && due <= next30;
  });
  const expectedFromCurrent = dueIn30.reduce((s, r) => s + r.outstandingAmount * (r.collectionProbabilityPct / 100), 0);
  const expectedFromOverdue = latePayments
    .filter((r) => r.daysOverdue <= 90) // realistic recovery window
    .reduce((s, r) => s + r.outstandingAmount * (r.collectionProbabilityPct / 100) * 0.5, 0);
  const expectedCollections30d = Math.round(expectedFromCurrent + expectedFromOverdue);

  // ─── Average days to pay ──────────────────────────────────────────────────
  const paidHistory = Array.from(historyMap.values()).filter((h) => h.avgDaysToPay > 0);
  const averageDaysToPay = paidHistory.length
    ? Math.round(paidHistory.reduce((s, h) => s + h.avgDaysToPay, 0) / paidHistory.length)
    : 30; // default assumption

  // ─── Collection efficiency ────────────────────────────────────────────────
  const totalBilled = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalCollected = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
  const collectionEfficiencyPct = totalBilled > 0 ? roundTo((totalCollected / totalBilled) * 100, 1) : 100;

  // ─── Bad debt reserve ─────────────────────────────────────────────────────
  // Reserve = sum of outstanding * (1 - probability) for high/critical risk
  const badDebtReserve = collectionRows
    .filter((r) => r.badDebtRisk === 'high' || r.badDebtRisk === 'critical')
    .reduce((s, r) => s + r.outstandingAmount * (1 - r.collectionProbabilityPct / 100), 0);

  // ─── Risky clients ────────────────────────────────────────────────────────
  const clientRiskAgg = new Map<string, { name: string; gstin: string; outstanding: number; overdue: number; riskSum: number; count: number }>();
  for (const r of collectionRows) {
    const key = r.clientGstin || r.clientName;
    const existing = clientRiskAgg.get(key) || { name: r.clientName, gstin: r.clientGstin, outstanding: 0, overdue: 0, riskSum: 0, count: 0 };
    existing.outstanding += r.outstandingAmount;
    if (r.daysOverdue > 0) existing.overdue += r.outstandingAmount;
    existing.riskSum += 100 - r.collectionProbabilityPct;
    existing.count += 1;
    clientRiskAgg.set(key, existing);
  }
  const riskyClients = Array.from(clientRiskAgg.values())
    .map((v) => ({
      name: v.name,
      gstin: v.gstin,
      outstanding: Math.round(v.outstanding),
      overdue: Math.round(v.overdue),
      riskScore: v.count > 0 ? Math.round(v.riskSum / v.count) : 0,
    }))
    .filter((r) => r.riskScore > 20 || r.overdue > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8);

  // ─── Recovery strategy (top-level) ────────────────────────────────────────
  const recoveryStrategy: string[] = [];
  if (overdueAmount > 0) {
    recoveryStrategy.push(`Recover ₹${Math.round(overdueAmount).toLocaleString('en-IN')} in overdue receivables — ${latePayments.length} invoice(s) need immediate follow-up.`);
  }
  if (latePayments.filter((r) => r.daysOverdue > 30).length > 0) {
    const severeCount = latePayments.filter((r) => r.daysOverdue > 30).length;
    recoveryStrategy.push(`${severeCount} invoice(s) >30 days overdue — escalate to phone calls + formal demand letters.`);
  }
  if (latePayments.filter((r) => r.badDebtRisk === 'critical').length > 0) {
    recoveryStrategy.push(`${latePayments.filter((r) => r.badDebtRisk === 'critical').length} invoice(s) at critical bad-debt risk — engage collection agency or legal recovery.`);
  }
  if (badDebtReserve > 0) {
    recoveryStrategy.push(`Provision ₹${Math.round(badDebtReserve).toLocaleString('en-IN')} as bad debt reserve for high-risk receivables.`);
  }
  if (collectionEfficiencyPct < 80) {
    recoveryStrategy.push(`Collection efficiency at ${collectionEfficiencyPct}% — tighten credit terms to 15 days for repeat late payers.`);
  }
  if (expectedCollections30d > 0) {
    recoveryStrategy.push(`₹${Math.round(expectedCollections30d).toLocaleString('en-IN')} expected to be collected in next 30 days — follow up proactively to realize.`);
  }
  if (recoveryStrategy.length === 0) {
    recoveryStrategy.push('Receivables position is healthy. Maintain current reminder cadence.');
  }

  // ─── Trend ────────────────────────────────────────────────────────────────
  const mStart = startOfMonth();
  const lmStart = startOfLastMonth();
  const lmEnd = endOfLastMonth();
  const thisMonthCollected = payments
    .filter((p) => p.partyType === 'customer' && new Date(p.paymentDate) >= mStart)
    .reduce((s, p) => s + (p.amount || 0), 0);
  const lastMonthCollected = payments
    .filter((p) => p.partyType === 'customer' && new Date(p.paymentDate) >= lmStart && new Date(p.paymentDate) <= lmEnd)
    .reduce((s, p) => s + (p.amount || 0), 0);
  const trend = trendFromPct(pctChange(thisMonthCollected, lastMonthCollected));

  return {
    totalOutstanding: Math.round(totalOutstanding),
    overdueAmount: Math.round(overdueAmount),
    overdueCount: latePayments.length,
    expectedCollections30d,
    averageDaysToPay,
    collectionEfficiencyPct,
    badDebtReserve: Math.round(badDebtReserve),
    latePayments,
    riskyClients,
    recoveryStrategy,
    trend,
  };
}
