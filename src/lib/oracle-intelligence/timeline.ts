// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE INTELLIGENCE — Phase 4: Timeline
// ═══════════════════════════════════════════════════════════════════════════════
// Every business activity becomes one timeline. This module merges dated events
// from every source — invoice created, payment received, expense recorded, GST
// filed, email sent, TDS deducted, bank transaction — into a single
// chronologically-sorted stream. Every event cites its real source record.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { TimelineEvent, TimelineResult, EntityRef } from './types';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Parse a date-ish value into a timestamp number (NaN if unparseable). */
function ts(v: string | Date | null | undefined): number {
  if (!v) return NaN;
  const d = v instanceof Date ? v : new Date(v);
  return d.getTime();
}

export async function buildTimeline(limit = 200): Promise<TimelineResult> {
  const events: TimelineEvent[] = [];

  // ── Load all dated rows in parallel ─────────────────────────────────────────
  const [
    invoices, payments, expenses, purchaseBills, gstFilings, gstReturns,
    emails, tds, bankTxns, bankAccounts,
  ] = await Promise.all([
    db.invoice.findMany({ select: { id: true, invoiceNumber: true, invoiceDate: true, totalAmount: true, paymentStatus: true, buyerName: true, createdAt: true }, take: 500 }),
    db.payment.findMany({ select: { id: true, partyName: true, partyType: true, amount: true, paymentDate: true, paymentMode: true, status: true }, take: 500 }),
    db.expense.findMany({ select: { id: true, description: true, category: true, amount: true, date: true, vendor: true, status: true }, take: 500 }),
    db.purchaseBill.findMany({ select: { id: true, vendorName: true, invoiceNo: true, totalAmount: true, invoiceDate: true, paymentStatus: true }, take: 500 }),
    db.gSTRFiling.findMany({ select: { id: true, returnType: true, period: true, status: true, totalTax: true, filedDate: true, createdAt: true }, take: 200 }),
    db.gSTReturn.findMany({ select: { id: true, type: true, period: true, status: true, totalTax: true, filedAt: true, createdAt: true }, take: 200 }),
    db.emailMessage.findMany({ select: { id: true, subject: true, recipientEmail: true, category: true, status: true, sentAt: true, createdAt: true }, take: 500 }),
    db.tDSRecord.findMany({ select: { id: true, section: true, deducteeName: true, tdsAmount: true, date: true, status: true }, take: 500 }),
    db.bankTransaction.findMany({ select: { id: true, description: true, amount: true, type: true, date: true, category: true, matched: true }, take: 500 }),
    db.bankAccount.findMany({ select: { id: true, bankName: true, accountMasked: true, lastSyncAt: true, balance: true }, take: 50 }),
  ]);

  // ── Invoice created ─────────────────────────────────────────────────────────
  for (const inv of invoices) {
    const t = ts(inv.invoiceDate) || ts(inv.createdAt);
    if (Number.isNaN(t)) continue;
    const ref: EntityRef = { kind: 'invoice', id: inv.id, label: inv.invoiceNumber || inv.id };
    events.push({
      id: `inv-created-${inv.id}`,
      kind: 'invoice_created',
      timestamp: new Date(t).toISOString(),
      title: `Invoice ${inv.invoiceNumber} issued`,
      description: `${inv.buyerName || 'Customer'} • ₹${round2(inv.totalAmount)} • ${inv.paymentStatus}`,
      amount: round2(inv.totalAmount),
      ref,
      party: inv.buyerName || undefined,
    });
    if (inv.paymentStatus === 'paid') {
      events.push({
        id: `inv-paid-${inv.id}`,
        kind: 'invoice_paid',
        timestamp: new Date(t).toISOString(),
        title: `Invoice ${inv.invoiceNumber} paid`,
        description: `₹${round2(inv.totalAmount)} collected from ${inv.buyerName || 'customer'}`,
        amount: round2(inv.totalAmount),
        ref,
        party: inv.buyerName || undefined,
      });
    }
  }

  // ── Payment received / sent ─────────────────────────────────────────────────
  for (const p of payments) {
    const t = ts(p.paymentDate);
    if (Number.isNaN(t)) continue;
    const ref: EntityRef = { kind: 'payment', id: p.id, label: `${p.partyName} • ${p.paymentMode}` };
    events.push({
      id: `pay-${p.id}`,
      kind: p.partyType === 'vendor' ? 'payment_sent' : 'payment_received',
      timestamp: new Date(t).toISOString(),
      title: p.partyType === 'vendor' ? `Paid ${p.partyName}` : `Received from ${p.partyName}`,
      description: `₹${round2(p.amount)} via ${p.paymentMode} • ${p.status}`,
      amount: round2(p.amount),
      ref,
      party: p.partyName,
    });
  }

  // ── Expense recorded ────────────────────────────────────────────────────────
  for (const e of expenses) {
    const t = ts(e.date);
    if (Number.isNaN(t)) continue;
    const ref: EntityRef = { kind: 'expense', id: e.id, label: e.description || e.category };
    events.push({
      id: `exp-${e.id}`,
      kind: 'expense_recorded',
      timestamp: new Date(t).toISOString(),
      title: `${e.category} expense recorded`,
      description: `${e.vendor || '—'} • ₹${round2(e.amount)} • ${e.status}`,
      amount: round2(e.amount),
      ref,
      party: e.vendor || undefined,
    });
  }

  // ── Purchase recorded ───────────────────────────────────────────────────────
  for (const pb of purchaseBills) {
    const t = ts(pb.invoiceDate);
    if (Number.isNaN(t)) continue;
    const ref: EntityRef = { kind: 'purchaseBill', id: pb.id, label: `${pb.vendorName} • ${pb.invoiceNo}` };
    events.push({
      id: `pb-${pb.id}`,
      kind: 'purchase_recorded',
      timestamp: new Date(t).toISOString(),
      title: `Purchase from ${pb.vendorName}`,
      description: `Bill ${pb.invoiceNo} • ₹${round2(pb.totalAmount)} • ${pb.paymentStatus}`,
      amount: round2(pb.totalAmount),
      ref,
      party: pb.vendorName,
    });
  }

  // ── GST filed / prepared ────────────────────────────────────────────────────
  for (const f of gstFilings) {
    const t = ts(f.filedDate) || ts(f.createdAt);
    if (Number.isNaN(t)) continue;
    const ref: EntityRef = { kind: 'gstFiling', id: f.id, label: `${f.returnType} • ${f.period}` };
    events.push({
      id: `gst-f-${f.id}`,
      kind: f.status === 'filed' ? 'gst_filed' : 'gst_prepared',
      timestamp: new Date(t).toISOString(),
      title: `${f.returnType} ${f.status === 'filed' ? 'filed' : 'prepared'} — ${f.period}`,
      description: `Tax ₹${round2(f.totalTax)} • ${f.status}`,
      amount: round2(f.totalTax),
      ref,
    });
  }
  for (const r of gstReturns) {
    const t = ts(r.filedAt) || ts(r.createdAt);
    if (Number.isNaN(t)) continue;
    const ref: EntityRef = { kind: 'gstReturn', id: r.id, label: `${r.type} • ${r.period}` };
    events.push({
      id: `gstr-${r.id}`,
      kind: r.status === 'filed' ? 'gst_filed' : 'gst_prepared',
      timestamp: new Date(t).toISOString(),
      title: `${r.type} ${r.status === 'filed' ? 'filed' : 'prepared'} — ${r.period}`,
      description: `Tax ₹${round2(r.totalTax)} • ITC ₹${round2(r.totalITC || 0)}`,
      amount: round2(r.totalTax),
      ref,
    });
  }

  // ── Email sent ──────────────────────────────────────────────────────────────
  for (const em of emails) {
    const t = ts(em.sentAt) || ts(em.createdAt);
    if (Number.isNaN(t)) continue;
    const ref: EntityRef = { kind: 'email', id: em.id, label: em.subject };
    events.push({
      id: `em-${em.id}`,
      kind: 'email_sent',
      timestamp: new Date(t).toISOString(),
      title: `Email: ${em.subject}`,
      description: `To ${em.recipientEmail} • ${em.category} • ${em.status}`,
      ref,
    });
  }

  // ── TDS deducted ────────────────────────────────────────────────────────────
  for (const tdsRow of tds) {
    const t = ts(tdsRow.date);
    if (Number.isNaN(t)) continue;
    const ref: EntityRef = { kind: 'tds', id: tdsRow.id, label: `${tdsRow.section} • ${tdsRow.deducteeName}` };
    events.push({
      id: `tds-${tdsRow.id}`,
      kind: 'tds_deducted',
      timestamp: new Date(t).toISOString(),
      title: `TDS ${tdsRow.section} deducted — ${tdsRow.deducteeName}`,
      description: `₹${round2(tdsRow.tdsAmount)} • ${tdsRow.status}`,
      amount: round2(tdsRow.tdsAmount),
      ref,
      party: tdsRow.deducteeName,
    });
  }

  // ── Bank transaction ────────────────────────────────────────────────────────
  for (const bt of bankTxns) {
    const t = ts(bt.date);
    if (Number.isNaN(t)) continue;
    const ref: EntityRef = { kind: 'bankTransaction', id: bt.id, label: bt.description };
    events.push({
      id: `bt-${bt.id}`,
      kind: 'bank_transaction',
      timestamp: new Date(t).toISOString(),
      title: `${bt.type === 'credit' ? 'Credit' : 'Debit'} • ${bt.description}`,
      description: `₹${round2(bt.amount)} • ${bt.category || 'Uncategorised'} • ${bt.matched ? 'Reconciled' : 'Unreconciled'}`,
      amount: round2(bt.amount),
      ref,
    });
  }

  // ── Bank synced ─────────────────────────────────────────────────────────────
  for (const ba of bankAccounts) {
    const t = ts(ba.lastSyncAt);
    if (Number.isNaN(t)) continue;
    const ref: EntityRef = { kind: 'bankAccount', id: ba.id, label: `${ba.bankName} ••${ba.accountMasked}` };
    events.push({
      id: `bs-${ba.id}`,
      kind: 'bank_synced',
      timestamp: new Date(t).toISOString(),
      title: `${ba.bankName} synced`,
      description: `Balance ₹${round2(ba.balance)}`,
      amount: round2(ba.balance),
      ref,
    });
  }

  // ── Sort descending by time, apply limit ────────────────────────────────────
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const sliced = events.slice(0, limit);

  return {
    generatedAt: new Date().toISOString(),
    events: sliced,
    total: events.length,
    empty: events.length === 0,
  };
}
