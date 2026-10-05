// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE INTELLIGENCE — Phase 2: Business Graph
// ═══════════════════════════════════════════════════════════════════════════════
// Builds a relationship graph connecting every entity in the company:
//   Client —owns→ Invoice —settled_by→ Payment —held_in→ BankAccount
//   Vendor —supplied→ PurchaseBill —paid_to→ Payment
//   Client —incurred→ Expense
//   Client —filed→ GSTRFiling
//   Client —emailed→ EmailMessage
//   Client —deducted_for→ TDSRecord
//
// Every node and edge is derived from REAL foreign keys in the database. No
// synthetic relationships. When the DB is empty, the graph is empty.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { BusinessGraph, GraphNode, GraphEdge, EdgeKind } from './types';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export async function buildBusinessGraph(): Promise<BusinessGraph> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeSet = new Map<string, GraphNode>();

  const addNode = (n: GraphNode) => {
    if (!nodeSet.has(n.id)) {
      nodeSet.set(n.id, n);
      nodes.push(n);
    }
  };
  const addEdge = (from: string, to: string, kind: EdgeKind, weight?: number, label?: string) => {
    edges.push({ from, to, kind, weight, label });
  };

  // ── Load all entities in parallel ──────────────────────────────────────────
  const [
    clients, invoices, vendors, purchaseBills, payments, expenses,
    gstFilings, emails, tds, bankAccounts, bankTransactions,
  ] = await Promise.all([
    db.client.findMany({ select: { id: true, tradeName: true, gstin: true, status: true }, take: 500 }),
    db.invoice.findMany({ select: { id: true, invoiceNumber: true, clientId: true, totalAmount: true, paymentStatus: true }, take: 500 }),
    db.vendor.findMany({ select: { id: true, name: true, status: true }, take: 500 }),
    db.purchaseBill.findMany({ select: { id: true, vendorName: true, invoiceNo: true, clientId: true, totalAmount: true, paymentStatus: true }, take: 500 }),
    db.payment.findMany({ select: { id: true, partyName: true, partyType: true, amount: true, invoiceId: true, purchaseBillId: true, status: true }, take: 500 }),
    db.expense.findMany({ select: { id: true, description: true, category: true, clientId: true, amount: true, status: true }, take: 500 }),
    db.gSTRFiling.findMany({ select: { id: true, returnType: true, period: true, clientId: true, status: true, totalTax: true }, take: 200 }),
    db.emailMessage.findMany({ select: { id: true, subject: true, clientId: true, status: true, category: true }, take: 500 }),
    db.tDSRecord.findMany({ select: { id: true, section: true, deducteeName: true, clientId: true, tdsAmount: true, status: true }, take: 500 }),
    db.bankAccount.findMany({ select: { id: true, bankName: true, accountMasked: true, balance: true, status: true }, take: 50 }),
    db.bankTransaction.findMany({ select: { id: true, description: true, accountId: true, amount: true, type: true, matched: true }, take: 500 }),
  ]);

  // ── Clients → nodes ─────────────────────────────────────────────────────────
  for (const c of clients) {
    addNode({ id: `client:${c.id}`, kind: 'client', label: c.tradeName || c.gstin, status: c.status });
  }
  // ── Vendors → nodes ─────────────────────────────────────────────────────────
  for (const v of vendors) {
    addNode({ id: `vendor:${v.id}`, kind: 'vendor', label: v.name, status: v.status });
  }
  // ── Bank accounts → nodes ───────────────────────────────────────────────────
  for (const b of bankAccounts) {
    addNode({ id: `bankAccount:${b.id}`, kind: 'bankAccount', label: `${b.bankName} ••${b.accountMasked}`, amount: round2(b.balance), status: b.status });
  }

  // ── Client → Invoice (owns) ─────────────────────────────────────────────────
  for (const inv of invoices) {
    const invId = `invoice:${inv.id}`;
    addNode({ id: invId, kind: 'invoice', label: inv.invoiceNumber || inv.id, amount: round2(inv.totalAmount), status: inv.paymentStatus });
    if (inv.clientId) {
      addEdge(`client:${inv.clientId}`, invId, 'owns', round2(inv.totalAmount));
    }
  }

  // ── Vendor → PurchaseBill (supplied) ────────────────────────────────────────
  // Vendors are linked by name (PurchaseBill has vendorName, not vendorId).
  const vendorByName = new Map(vendors.map((v) => [v.name.toLowerCase(), v.id]));
  for (const pb of purchaseBills) {
    const pbId = `purchaseBill:${pb.id}`;
    addNode({ id: pbId, kind: 'purchaseBill', label: `${pb.vendorName} • ${pb.invoiceNo}`, amount: round2(pb.totalAmount), status: pb.paymentStatus });
    const vid = vendorByName.get((pb.vendorName || '').toLowerCase());
    if (vid) {
      addEdge(`vendor:${vid}`, pbId, 'supplied', round2(pb.totalAmount));
    }
    if (pb.clientId) {
      addEdge(`client:${pb.clientId}`, pbId, 'owns', round2(pb.totalAmount));
    }
  }

  // ── Payment nodes + edges ───────────────────────────────────────────────────
  for (const p of payments) {
    const pId = `payment:${p.id}`;
    addNode({ id: pId, kind: 'payment', label: `${p.partyName} • ${p.partyType}`, amount: round2(p.amount), status: p.status });
    // Invoice → Payment (settled_by)
    if (p.invoiceId) {
      addEdge(`invoice:${p.invoiceId}`, pId, 'settled_by', round2(p.amount));
    }
    // PurchaseBill → Payment (paid_to)
    if (p.purchaseBillId) {
      addEdge(`purchaseBill:${p.purchaseBillId}`, pId, 'paid_to', round2(p.amount));
    }
  }

  // ── Client → Expense (incurred) ─────────────────────────────────────────────
  for (const e of expenses) {
    const eId = `expense:${e.id}`;
    addNode({ id: eId, kind: 'expense', label: e.description || e.category, amount: round2(e.amount), status: e.status });
    if (e.clientId) {
      addEdge(`client:${e.clientId}`, eId, 'incurred', round2(e.amount));
    }
  }

  // ── Client → GSTRFiling (filed) ─────────────────────────────────────────────
  for (const f of gstFilings) {
    const fId = `gstFiling:${f.id}`;
    addNode({ id: fId, kind: 'gstFiling', label: `${f.returnType} • ${f.period}`, amount: round2(f.totalTax), status: f.status });
    if (f.clientId) {
      addEdge(`client:${f.clientId}`, fId, 'filed', round2(f.totalTax));
    }
  }

  // ── Client → Email (emailed) ────────────────────────────────────────────────
  for (const em of emails) {
    const emId = `email:${em.id}`;
    addNode({ id: emId, kind: 'email', label: em.subject, status: em.status });
    if (em.clientId) {
      addEdge(`client:${em.clientId}`, emId, 'emailed');
    }
  }

  // ── Client → TDS (deducted_for) ─────────────────────────────────────────────
  for (const t of tds) {
    const tId = `tds:${t.id}`;
    addNode({ id: tId, kind: 'tds', label: `${t.section} • ${t.deducteeName}`, amount: round2(t.tdsAmount), status: t.status });
    if (t.clientId) {
      addEdge(`client:${t.clientId}`, tId, 'deducted_for', round2(t.tdsAmount));
    }
  }

  // ── BankTransaction → BankAccount (transacted_on) ───────────────────────────
  for (const bt of bankTransactions) {
    const btId = `bankTransaction:${bt.id}`;
    addNode({ id: btId, kind: 'bankTransaction', label: bt.description, amount: round2(bt.amount), status: bt.matched ? 'reconciled' : 'unreconciled' });
    if (bt.accountId) {
      addEdge(btId, `bankAccount:${bt.accountId}`, 'transacted_on', round2(bt.amount));
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const byKind: Record<string, number> = {};
  for (const e of edges) {
    byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  }
  for (const n of nodes) {
    byKind[n.kind] = (byKind[n.kind] || 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      byKind,
    },
  };
}
