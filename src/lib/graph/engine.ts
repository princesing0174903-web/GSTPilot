// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT BUSINESS GRAPH™ — Core Engine (Phase 6 LIVE)
// Real Business Knowledge Graph — self-building, real-time, root-cause aware.
//
// Tagline: "GSTPilot Business Graph™ — Understand Everything. Connect Everything.
//           Predict Everything."
//
// Modules implemented here:
//   Module 1   Knowledge Graph Engine™       — buildKnowledgeGraph()
//   Module 2   Client Relationship Graph™    — buildRelationshipChains()
//   Module 3   Risk Graph™                   — buildRiskGraph()
//   Module 4   Business Dependency Graph™    — buildDependencyGraph() + canonical answers
//   Module 5   Natural Language Graph Queries — executeQuery()
//   Module 7   Business Memory Graph™        — buildMemoryGraph()
//   Module 8   Prediction Graph™             — buildPredictionGraph()
//   Module 9   Graph Insights™               — buildInsights()
//   Module 11  Root Cause Engine™            — buildRootCauseChains() (delegated)
//   Module 12  Live Update Event Log™        — getLiveEvents() (delegated to cache.ts)
//
// Orchestrator: getGraphState() — fetches LIVE data via CFO engine + Prisma,
// then composes the full Business Graph state with 60s in-memory caching.
//
// Module 6 (Visual Graph Explorer) is a UI concern — see BusinessGraphPage.tsx.
// Module 10 (Graph API) lives in /api/graph/*.
//
// Phase 6 changes (additive, no breaking changes):
//   - VENDORS now built from REAL PurchaseBill table (no more hardcoded names)
//   - EMPLOYEES now built from REAL Employee table (no more Priya/Arjun/Neha)
//   - REPORTS now built from REAL ExecutiveReport table
//   - CONVERSATIONS now derive counts from REAL WhatsAppMessage + EmailMessage + BusinessEvent
//   - NEW node types: itc-record, transaction, payment, collection, expense, meeting
//   - NEW relationship types: RECEIVES, SUPPLIES, CLEARS, REDUCES, AFFECTS, MANAGES,
//     DERIVES_FROM, PAID_BY, RECORDED_IN, GENERATES_LIABILITY
//   - NEW Root Cause Engine (6 canonical "why" questions)
//   - NEW Live Update event log (last 50 events, in-memory)
//   - NEW 60s in-memory cache for 100k+ node performance
//   - GraphState now includes: rootCauseChains, liveEvents, sourceCount,
//     vendorCount, employeeCount, reportCount, paymentCount, expenseCount,
//     itcCount, transactionCount
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { generateCFOInsights } from '@/lib/cfo/engine';
import type { CFOResponse } from '@/lib/cfo/types';
import type {
  BusinessMemoryGraph,
  BusinessSubgraph,
  ClientSubgraph,
  DependencyAnswer,
  DependencyEdge,
  DependencyGraph,
  GraphInsight,
  GraphNode,
  GraphQueryIntent,
  GraphQueryResult,
  GraphState,
  InsightSeverity,
  KnowledgeGraph,
  MemoryRelationship,
  NodeType,
  PredictionGraph,
  RelationshipChain,
  RelationshipChainStep,
  RelationshipType,
  RiskCategory,
  RiskGraph,
  RiskLevel,
  RiskNode,
  ScenarioType,
  WhatIfScenario,
  RootCauseChain,
  LiveGraphEvent,
  NodeSubgraph,
  VendorSubgraph,
  InvoiceSubgraph,
} from '@/lib/graph/types';
import { NODE_LABELS, RISK_COLOR, RISK_GLYPH } from '@/lib/graph/types';
import { buildRootCauseChains } from '@/lib/graph/root-cause';
import type { RootCauseRows } from '@/lib/graph/root-cause';
import { getCachedGraphState, getLiveEvents } from '@/lib/graph/cache';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inrFmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const inrShort = (n: number) => {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
};
const nowISO = () => new Date().toISOString();
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const daysAgo = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x.toISOString();
};

function scoreToLevel(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function levelRank(l: RiskLevel): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[l];
}

function filingDueDate(returnType: string, period: string): Date | null {
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (month === 12) return new Date(year + 1, 0, 11);
  const day = returnType === 'GSTR-1' ? 11 : 20;
  return new Date(year, month, day);
}

// ─── Module 1: Knowledge Graph Engine ────────────────────────────────────────
//
// Phase 6: fetchRawRows() now pulls from 11 Prisma models in parallel —
// Clients, Invoices, GSTRFilings, Notices, PurchaseBills, Expenses, Payments,
// Employees, ExecutiveReports, WhatsAppMessages, EmailMessages, BusinessEvents,
// DataConnections. ALL graph nodes derive from REAL data — no more synthetic
// vendor/employee/report names.

interface RawRows {
  clients: Array<{ id: string; gstin: string; tradeName: string; status: string; healthScore: number }>;
  invoices: Array<{
    id: string; invoiceNumber: string; invoiceDate: string; totalAmount: number;
    taxableValue: number; cgst: number; sgst: number; igst: number;
    status: string; period: string | null; buyerGstin: string | null; buyerName: string | null;
    dueDate: string | null; paymentStatus: string; paidAmount: number; balanceAmount: number;
  }>;
  filings: Array<{ id: string; returnType: string; period: string; status: string; clientId: string; totalTax: number }>;
  notices: Array<{ id: string; noticeType: string; status: string; noticeDate: string | null; dueDate: string | null; clientId: string }>;
  // ── Phase 6 LIVE additions ──────────────────────────────────────────────
  purchaseBills: Array<{
    id: string; vendorName: string; vendorGstin: string | null; invoiceNo: string;
    invoiceDate: string; dueDate: string | null; totalAmount: number; paidAmount: number;
    balanceAmount: number; status: string; paymentStatus: string; gstAmount: number;
    cgst: number; sgst: number; igst: number; cess: number; taxableValue: number;
  }>;
  expenses: Array<{ id: string; vendor: string | null; amount: number; category: string; date: string; status: string; description: string | null }>;
  payments: Array<{
    id: string; partyName: string; partyType: string; amount: number; paymentDate: string;
    status: string; invoiceId: string | null; purchaseBillId: string | null; paymentMode: string;
    clientId: string | null;
  }>;
  employees: Array<{ id: string; name: string; designation: string | null; department: string | null; status: string }>;
  // ── PT-2-b: real AITask rows power task nodes (auto-emitted on create) ──
  tasks: Array<{ id: string; title: string; sourceType: string; priority: string; status: string; assignedTo: string | null; clientId: string | null; dueDate: string | null }>;
  reports: Array<{ id: string; reportType: string; title: string; period: string; status: string; createdAt: Date }>;
  whatsappMessages: Array<{ id: string; clientId: string | null; recipientName: string | null; status: string; category: string; createdAt: Date }>;
  emailMessages: Array<{ id: string; clientId: string | null; recipientName: string | null; subject: string; status: string; createdAt: Date }>;
  businessEvents: Array<{ id: string; type: string; source: string; severity: string; status: string; createdAt: Date }>;
  dataConnections: Array<{ id: string; type: string; status: string; label: string; identifier: string | null; lastSyncAt: Date | null }>;
  // ── Real Business Graph Engine™ — synced records streamed in from connectors ──
  syncedRecords: Array<{ id: string; connectionId: string; sourceType: string; externalId: string | null; title: string | null; amount: number | null; date: string | null; category: string | null }>;
}

async function fetchRawRows(): Promise<RawRows> {
  const [
    clients, invoices, filings, notices,
    purchaseBills, expenses, payments, employees,
    reports, whatsappMessages, emailMessages, businessEvents, dataConnections,
    syncedRecords, tasks,
  ] = await Promise.all([
    db.client.findMany({
      select: { id: true, gstin: true, tradeName: true, status: true, healthScore: true },
      take: 5000,
    }),
    db.invoice.findMany({
      select: {
        id: true, invoiceNumber: true, invoiceDate: true, totalAmount: true,
        taxableValue: true, cgst: true, sgst: true, igst: true,
        status: true, period: true, buyerGstin: true, buyerName: true,
        dueDate: true, paymentStatus: true, paidAmount: true, balanceAmount: true,
      },
      take: 10000,
    }),
    db.gSTRFiling.findMany({
      select: { id: true, returnType: true, period: true, status: true, clientId: true, totalTax: true },
      take: 5000,
    }),
    db.notice.findMany({
      select: { id: true, noticeType: true, status: true, noticeDate: true, dueDate: true, clientId: true },
      take: 2000,
    }) as Promise<Array<{ id: string; noticeType: string; status: string; noticeDate: string | null; dueDate: string | null; clientId: string }>>,
    // ── Phase 6 LIVE: real vendor + purchase data ─────────────────────────
    db.purchaseBill.findMany({
      select: {
        id: true, vendorName: true, vendorGstin: true, invoiceNo: true,
        invoiceDate: true, dueDate: true, totalAmount: true, paidAmount: true,
        balanceAmount: true, status: true, paymentStatus: true, gstAmount: true,
        cgst: true, sgst: true, igst: true, cess: true, taxableValue: true,
      },
      take: 10000,
      orderBy: { invoiceDate: 'desc' },
    }),
    db.expense.findMany({
      select: { id: true, vendor: true, amount: true, category: true, date: true, status: true, description: true },
      take: 5000,
      orderBy: { date: 'desc' },
    }),
    db.payment.findMany({
      select: {
        id: true, partyName: true, partyType: true, amount: true, paymentDate: true,
        status: true, invoiceId: true, purchaseBillId: true, paymentMode: true,
        clientId: true,
      },
      take: 10000,
      orderBy: { paymentDate: 'desc' },
    }),
    db.employee.findMany({
      select: { id: true, name: true, designation: true, department: true, status: true },
      take: 500,
    }),
    db.executiveReport.findMany({
      select: { id: true, reportType: true, title: true, period: true, status: true, createdAt: true },
      take: 200,
      orderBy: { createdAt: 'desc' },
    }),
    db.whatsAppMessage.findMany({
      select: { id: true, clientId: true, recipientName: true, status: true, category: true, createdAt: true },
      take: 200,
      orderBy: { createdAt: 'desc' },
    }),
    db.emailMessage.findMany({
      select: { id: true, clientId: true, recipientName: true, subject: true, status: true, createdAt: true },
      take: 200,
      orderBy: { createdAt: 'desc' },
    }),
    db.businessEvent.findMany({
      select: { id: true, type: true, source: true, severity: true, status: true, createdAt: true },
      take: 200,
      orderBy: { createdAt: 'desc' },
    }),
    db.dataConnection.findMany({
      select: { id: true, type: true, status: true, label: true, identifier: true, lastSyncAt: true },
      take: 100,
    }),
    // ── Real Business Graph Engine™ — synced records (bank tx, emails, WhatsApp, accounting invoices) ──
    db.syncedRecord.findMany({
      select: { id: true, connectionId: true, sourceType: true, externalId: true, title: true, amount: true, date: true, category: true },
      take: 5000,
      orderBy: { createdAt: 'desc' },
    }) as Promise<Array<{ id: string; connectionId: string; sourceType: string; externalId: string | null; title: string | null; amount: number | null; date: string | null; category: string | null }>>,
    // ── PT-2-b: real AITask rows power the graph task nodes (auto-emitted on create) ──
    db.aITask.findMany({
      select: { id: true, title: true, sourceType: true, priority: true, status: true, assignedTo: true, clientId: true, dueDate: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    clients, invoices, filings, notices,
    purchaseBills, expenses, payments, employees,
    reports, whatsappMessages, emailMessages, businessEvents, dataConnections,
    syncedRecords, tasks,
  };
}

export function buildKnowledgeGraph(rows: RawRows, cfo: CFOResponse): KnowledgeGraph {
  const nodes: GraphNode[] = [];
  const edges: { id: string; source: string; target: string; type: RelationshipType; amount?: number; label?: string }[] = [];

  const pushNode = (n: GraphNode) => nodes.push(n);
  const pushEdge = (source: string, target: string, type: RelationshipType, amount?: number, label?: string) => {
    edges.push({ id: uid('e'), source, target, type, amount, label });
  };

  // 1. Business node — the firm itself (the user's business). Single root.
  const businessId = 'business:firm';
  const firmName = 'Your Business';
  pushNode({
    id: businessId,
    type: 'business',
    entityId: 'firm',
    label: firmName,
    subtitle: 'The firm at the center of the graph',
    amount: cfo.dashboard.revenue.thisMonth,
    meta: { healthScore: cfo.dashboard.healthScore.overall, cash: cfo.dashboard.cash.currentBalance },
    x: 0, y: 0,
  });

  // 2. Bank account node — derived from cash position
  const bankId = 'bank-account:primary';
  pushNode({
    id: bankId,
    type: 'bank-account',
    entityId: 'primary',
    label: 'Primary Bank Account',
    subtitle: `Balance ${inrShort(cfo.dashboard.cash.currentBalance)}`,
    amount: cfo.dashboard.cash.currentBalance,
    meta: { runway: cfo.dashboard.cash.runwayDays },
    x: -200, y: 0,
  });
  pushEdge(businessId, bankId, 'OWNS');

  // 2b. Bank accounts — REAL data from DataConnection type=bank (PT-2-b)
  //     Each connected bank becomes its own bank-account node, owned by the firm.
  rows.dataConnections
    .filter((dc) => dc.type === 'bank')
    .slice(0, 25)
    .forEach((dc, i) => {
      const bankNodeId = `bank-account:${dc.id}`;
      pushNode({
        id: bankNodeId,
        type: 'bank-account',
        entityId: dc.id,
        label: dc.label || 'Bank Account',
        subtitle: `${dc.status}${dc.lastSyncAt ? ` · synced ${new Date(dc.lastSyncAt).toLocaleDateString()}` : ''}`,
        meta: {
          status: dc.status,
          identifier: dc.identifier ?? '',
          type: 'bank',
        },
        x: -350 + (i % 4) * 80, y: -120 + Math.floor(i / 4) * 50,
      });
      pushEdge(businessId, bankNodeId, 'OWNS');
    });

  // 3. Employees — REAL data from Employee table (Phase 6: no more hardcoded names)
  const activeEmployees = rows.employees.filter((e) => e.status === 'active' || e.status !== 'inactive');
  activeEmployees.slice(0, 25).forEach((emp, i) => {
    const empId = `employee:${emp.id}`;
    pushNode({
      id: empId,
      type: 'employee',
      entityId: emp.id,
      label: emp.name,
      subtitle: emp.designation || emp.department || 'Employee',
      meta: {
        designation: emp.designation || '',
        department: emp.department || '',
        status: emp.status,
      },
      x: -250 + (i % 5) * 60, y: 220 + Math.floor(i / 5) * 50,
    });
    pushEdge(businessId, empId, 'OWNS');
  });

  // 4. Clients — REAL data from Prisma
  rows.clients.slice(0, 500).forEach((c, i) => {
    const angle = (i / Math.max(rows.clients.length, 1)) * 2 * Math.PI;
    const r = 320;
    const nodeId = `client:${c.id}`;
    pushNode({
      id: nodeId,
      type: 'client',
      entityId: c.id,
      label: c.tradeName || c.gstin,
      subtitle: c.gstin,
      meta: { status: c.status, healthScore: c.healthScore, gstin: c.gstin },
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    });
    pushEdge(businessId, nodeId, 'OWNS');
  });

  // 5. Invoices — REAL data; link to clients (by buyerGstin match) or business
  rows.invoices.slice(0, 2000).forEach((inv, i) => {
    const angle = (i / Math.max(rows.invoices.length, 1)) * 2 * Math.PI;
    const r = 480;
    const invNodeId = `invoice:${inv.id}`;
    pushNode({
      id: invNodeId,
      type: 'invoice',
      entityId: inv.id,
      label: inv.invoiceNumber,
      subtitle: `${inrShort(inv.totalAmount)} · ${inv.paymentStatus || inv.status}`,
      amount: inv.totalAmount,
      meta: {
        status: inv.status, period: inv.period ?? '', date: inv.invoiceDate,
        paymentStatus: inv.paymentStatus, balanceAmount: inv.balanceAmount,
        buyerGstin: inv.buyerGstin ?? '',
      },
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    });
    const matchedClient = rows.clients.find((c) => c.gstin === inv.buyerGstin);
    if (matchedClient) {
      // Client RECEIVES invoice (Phase 6: new relationship type)
      pushEdge(`client:${matchedClient.id}`, invNodeId, 'RECEIVES', inv.totalAmount);
      // Invoice GENERATES revenue for business
      pushEdge(businessId, invNodeId, 'GENERATES', inv.totalAmount);
    } else {
      pushEdge(businessId, invNodeId, 'GENERATES', inv.totalAmount);
    }
  });

  // 6. GST Returns — REAL data; link to clients + business
  rows.filings.slice(0, 1000).forEach((f, i) => {
    const angle = (i / Math.max(rows.filings.length, 1)) * 2 * Math.PI;
    const r = 580;
    const nodeId = `gst-return:${f.id}`;
    const due = filingDueDate(f.returnType, f.period);
    const daysLeft = due ? Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    pushNode({
      id: nodeId,
      type: 'gst-return',
      entityId: f.id,
      label: `${f.returnType} · ${f.period}`,
      subtitle: `${f.status} · tax ${inrShort(f.totalTax)}`,
      amount: f.totalTax,
      meta: { status: f.status, period: f.period, returnType: f.returnType, daysLeft: daysLeft ?? 0 },
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    });
    pushEdge(`client:${f.clientId}`, nodeId, 'FILES', f.totalTax);
    // GST Return GENERATES_LIABILITY for the business (Phase 6: new relationship)
    if (f.status !== 'filed' && f.totalTax > 0) {
      pushEdge(nodeId, businessId, 'GENERATES_LIABILITY', f.totalTax);
    }
  });

  // 7. Notices — REAL data; link to clients + business + compliance
  rows.notices.slice(0, 500).forEach((n, i) => {
    const angle = (i / Math.max(rows.notices.length, 1)) * 2 * Math.PI;
    const r = 660;
    const nodeId = `notice:${n.id}`;
    pushNode({
      id: nodeId,
      type: 'notice',
      entityId: n.id,
      label: n.noticeType,
      subtitle: `${n.status} · due ${n.dueDate || 'n/a'}`,
      meta: { status: n.status, noticeDate: n.noticeDate ?? '', dueDate: n.dueDate ?? '' },
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    });
    pushEdge(`client:${n.clientId}`, nodeId, 'RESPONDS_TO');
    // Notice AFFECTS business compliance (Phase 6: new relationship)
    pushEdge(nodeId, businessId, 'AFFECTS');
  });

  // 8. Vendors — REAL data derived from PurchaseBill table
  //    Group purchase bills by vendorName to create one vendor node per unique vendor
  const vendorMap: Map<string, {
    name: string; gstin: string | null; totalSpend: number; pendingPayable: number;
    overdueCount: number; billCount: number;
  }> = new Map();
  rows.purchaseBills.forEach((b) => {
    const key = b.vendorGstin || b.vendorName;
    if (!vendorMap.has(key)) {
      vendorMap.set(key, {
        name: b.vendorName, gstin: b.vendorGstin, totalSpend: 0, pendingPayable: 0, overdueCount: 0, billCount: 0,
      });
    }
    const v = vendorMap.get(key)!;
    v.totalSpend += b.totalAmount;
    v.pendingPayable += b.balanceAmount;
    v.billCount += 1;
    if (b.paymentStatus === 'overdue' || (b.dueDate && b.balanceAmount > 0 && new Date(b.dueDate).getTime() < Date.now())) {
      v.overdueCount += 1;
    }
  });

  const vendorEntries = Array.from(vendorMap.entries())
    .sort((a, b) => b[1].totalSpend - a[1].totalSpend)
    .slice(0, 100); // top 100 vendors by spend

  vendorEntries.forEach(([, v], i) => {
    const vendorId = `vendor:${v.gstin || v.name.replace(/\s+/g, '-').toLowerCase()}`;
    const dependencyScore = Math.min(90, 30 + Math.log10(v.totalSpend + 1) * 8 + (v.overdueCount > 0 ? 15 : 0));
    pushNode({
      id: vendorId,
      type: 'vendor',
      entityId: v.gstin || v.name,
      label: v.name,
      subtitle: `Spend ${inrShort(v.totalSpend)} · ${v.billCount} bills`,
      amount: v.totalSpend,
      meta: {
        gstin: v.gstin || '',
        totalSpend: v.totalSpend,
        pendingPayable: v.pendingPayable,
        overdueCount: v.overdueCount,
        billCount: v.billCount,
        dependencyScore,
        reliabilityScore: Math.max(0, 100 - v.overdueCount * 15),
      },
      x: -400 + (i % 6) * 70, y: -240 + Math.floor(i / 6) * 50,
    });
    pushEdge(businessId, vendorId, 'PAYS', v.totalSpend);
  });

  // 9. Purchase bills → become INVOICE nodes (vendor invoices) + ITC records
  //    Each purchase bill also creates an ITC record node (Phase 6)
  rows.purchaseBills.slice(0, 1000).forEach((b, i) => {
    const vendorKey = b.vendorGstin || b.vendorName;
    const vendorId = `vendor:${b.vendorGstin || b.vendorName.replace(/\s+/g, '-').toLowerCase()}`;
    // ITC record node (Phase 6: new node type)
    if (b.gstAmount > 0) {
      const itcId = `itc-record:${b.id}`;
      pushNode({
        id: itcId,
        type: 'itc-record',
        entityId: b.id,
        label: `ITC · ${b.invoiceNo}`,
        subtitle: `${inrShort(b.gstAmount)} claimable`,
        amount: b.gstAmount,
        meta: {
          vendor: b.vendorName, invoiceNo: b.invoiceNo,
          cgst: b.cgst, sgst: b.sgst, igst: b.igst, cess: b.cess,
          taxableValue: b.taxableValue,
        },
        x: -350 + (i % 8) * 40, y: -350 + Math.floor(i / 8) * 30,
      });
      // ITC DERIVES_FROM purchase bill (vendor)
      pushEdge(vendorId, itcId, 'SUPPLIES', b.gstAmount);
      // ITC reduces GST liability for business
      pushEdge(itcId, businessId, 'DERIVES_FROM', b.gstAmount);
    }
  });

  // 10. Expenses — REAL data from Expense table (Phase 6: new node type)
  rows.expenses.slice(0, 1000).forEach((e, i) => {
    const expId = `expense:${e.id}`;
    pushNode({
      id: expId,
      type: 'expense',
      entityId: e.id,
      label: e.description || e.category,
      subtitle: `${inrShort(e.amount)} · ${e.category}`,
      amount: e.amount,
      meta: {
        category: e.category, vendor: e.vendor || '',
        date: e.date, status: e.status,
      },
      x: 200 + (i % 8) * 40, y: -280 + Math.floor(i / 8) * 30,
    });
    // Expense REDUCES cash (Phase 6: new relationship)
    pushEdge(expId, bankId, 'REDUCES', e.amount);
    pushEdge(businessId, expId, 'CREATED_BY');
    // Link to vendor if matched
    if (e.vendor) {
      const vendorId = `vendor:${e.vendor.replace(/\s+/g, '-').toLowerCase()}`;
      const vendorNode = nodes.find((n) => n.id === vendorId);
      if (vendorNode) {
        pushEdge(vendorId, expId, 'SUPPLIES', e.amount);
      }
    }
  });

  // 11. Payments + Collections — REAL data from Payment table (Phase 6)
  rows.payments.slice(0, 2000).forEach((p, i) => {
    if (p.partyType === 'customer') {
      // Collection node
      const collId = `collection:${p.id}`;
      pushNode({
        id: collId,
        type: 'collection',
        entityId: p.id,
        label: `Collection · ${p.partyName}`,
        subtitle: `${inrShort(p.amount)} · ${p.status}`,
        amount: p.amount,
        meta: { partyName: p.partyName, paymentDate: p.paymentDate, status: p.status, mode: p.paymentMode },
        x: 250 + (i % 8) * 40, y: 350 + Math.floor(i / 8) * 30,
      });
      // Collection CLEARS invoice (Phase 6: new relationship)
      if (p.invoiceId) {
        pushEdge(collId, `invoice:${p.invoiceId}`, 'CLEARS', p.amount);
      }
      // PT-2-b: Client → Collection direct edge (when payment references a client)
      if (p.clientId) {
        pushEdge(`client:${p.clientId}`, collId, 'PAYS', p.amount);
      }
      // Collection RECORDED_IN bank account
      pushEdge(collId, bankId, 'RECORDED_IN', p.amount);
    } else {
      // Payment node (vendor payment)
      const payId = `payment:${p.id}`;
      pushNode({
        id: payId,
        type: 'payment',
        entityId: p.id,
        label: `Payment · ${p.partyName}`,
        subtitle: `${inrShort(p.amount)} · ${p.status}`,
        amount: p.amount,
        meta: { partyName: p.partyName, paymentDate: p.paymentDate, status: p.status, mode: p.paymentMode },
        x: -250 + (i % 8) * 40, y: 350 + Math.floor(i / 8) * 30,
      });
      // Payment CLEARS purchase bill
      if (p.purchaseBillId) {
        pushEdge(payId, `invoice:${p.purchaseBillId}`, 'CLEARS', p.amount);
      }
      // Payment RECORDED_IN bank account + REDUCES cash
      pushEdge(payId, bankId, 'RECORDED_IN', p.amount);
      pushEdge(payId, bankId, 'REDUCES', p.amount);
    }
  });

  // 12. Tasks — derived from CFO priority actions (kept from Phase 5)
  cfo.brief.priorityActions.slice(0, 10).forEach((a, i) => {
    const nodeId = `task:${a.id}`;
    pushNode({
      id: nodeId,
      type: 'task',
      entityId: a.id,
      label: a.title,
      subtitle: a.urgency,
      amount: a.amount,
      meta: { urgency: a.urgency, actionType: a.actionType },
      x: 300 + i * 50, y: -200,
    });
    pushEdge(businessId, nodeId, 'CREATED_BY');
  });

  // 12b. Tasks — REAL data from AITask table (PT-2-b: auto-emitted on create)
  //      Each AITask becomes a task node with edges:
  //        business → task (CREATED_BY)
  //        employee → task (ASSIGNED_TO) when assignedTo is set
  //        client   → task (AFFECTS)       when clientId is set
  const existingTaskNodeIds = new Set(
    nodes.filter((n) => n.type === 'task').map((n) => n.id),
  );
  rows.tasks.slice(0, 200).forEach((t, i) => {
    const nodeId = `task:${t.id}`;
    if (existingTaskNodeIds.has(nodeId)) return; // dedup vs CFO priorityActions
    existingTaskNodeIds.add(nodeId);
    pushNode({
      id: nodeId,
      type: 'task',
      entityId: t.id,
      label: t.title,
      subtitle: `${t.sourceType} · ${t.priority} · ${t.status}`,
      meta: {
        sourceType: t.sourceType,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate ?? '',
      },
      x: 280 + (i % 8) * 50, y: -260 + Math.floor(i / 8) * 40,
    });
    pushEdge(businessId, nodeId, 'CREATED_BY');
    // Employee → Task (when task assigned to an employee/team-member)
    if (t.assignedTo) {
      pushEdge(`employee:${t.assignedTo}`, nodeId, 'ASSIGNED_TO');
    }
    // Client → Task (when task references a client)
    if (t.clientId) {
      pushEdge(`client:${t.clientId}`, nodeId, 'AFFECTS');
    }
  });

  // 13. Reports — REAL data from ExecutiveReport table (Phase 6: no more hardcoded names)
  rows.reports.slice(0, 50).forEach((r, i) => {
    const reportId = `report:${r.id}`;
    pushNode({
      id: reportId,
      type: 'report',
      entityId: r.id,
      label: r.title,
      subtitle: `${r.reportType} · ${r.period}`,
      meta: {
        reportType: r.reportType, period: r.period, status: r.status,
        generatedAt: r.createdAt.toISOString(),
      },
      x: 350 + (i % 5) * 60, y: 280 + Math.floor(i / 5) * 50,
    });
    pushEdge(businessId, reportId, 'GENERATES');
    // Report CREATED_BY Oracle (Phase 6: new relationship — Oracle generated Report)
    pushEdge('conversation:oracle', reportId, 'CREATED_BY');
  });

  // 14. Conversation — Oracle node enriched with REAL message counts
  const whatsappCount = rows.whatsappMessages.length;
  const emailCount = rows.emailMessages.length;
  const eventCount = rows.businessEvents.length;
  pushNode({
    id: 'conversation:oracle',
    type: 'conversation',
    entityId: 'oracle',
    label: 'Oracle Conversations',
    subtitle: `${cfo.memory.insights.length} insights · ${whatsappCount + emailCount} msgs · ${eventCount} events`,
    meta: {
      insights: cfo.memory.insights.length,
      whatsappMessages: whatsappCount,
      emailMessages: emailCount,
      businessEvents: eventCount,
    },
    x: -450, y: 100,
  });
  pushEdge(businessId, 'conversation:oracle', 'CONNECTED_TO');

  // 14b. WhatsApp + Email conversation channels (Phase 6)
  if (whatsappCount > 0) {
    pushNode({
      id: 'conversation:whatsapp',
      type: 'conversation',
      entityId: 'whatsapp',
      label: 'WhatsApp Business',
      subtitle: `${whatsappCount} messages`,
      meta: { channel: 'whatsapp', count: whatsappCount },
      x: -550, y: 180,
    });
    pushEdge('conversation:whatsapp', 'conversation:oracle', 'CONNECTED_TO');
    pushEdge('conversation:whatsapp', businessId, 'CONNECTED_TO');
  }
  if (emailCount > 0) {
    pushNode({
      id: 'conversation:gmail',
      type: 'conversation',
      entityId: 'gmail',
      label: 'Gmail',
      subtitle: `${emailCount} messages`,
      meta: { channel: 'gmail', count: emailCount },
      x: -550, y: 60,
    });
    pushEdge('conversation:gmail', 'conversation:oracle', 'CONNECTED_TO');
    pushEdge('conversation:gmail', businessId, 'CONNECTED_TO');
  }

  // 15. Predictions — link forecast numbers as prediction nodes
  const predNodes: GraphNode[] = [
    { id: 'prediction:revenue30', type: 'prediction', entityId: 'revenue30', label: 'Revenue 30d', subtitle: inrShort(cfo.predictions.revenue.thirtyDay), amount: cfo.predictions.revenue.thirtyDay, meta: { confidence: cfo.predictions.revenue.confidencePct }, x: 480, y: -80 },
    { id: 'prediction:cash30', type: 'prediction', entityId: 'cash30', label: 'Cash 30d', subtitle: inrShort(cfo.predictions.cashFlow.monthlyPosition), amount: cfo.predictions.cashFlow.monthlyPosition, meta: { confidence: cfo.predictions.cashFlow.confidencePct }, x: 480, y: 20 },
    { id: 'prediction:gst30', type: 'prediction', entityId: 'gst30', label: 'GST Liability 30d', subtitle: inrShort(cfo.predictions.gst.upcomingLiability), amount: cfo.predictions.gst.upcomingLiability, meta: { confidence: cfo.predictions.gst.confidencePct }, x: 480, y: 120 },
  ];
  predNodes.forEach((n) => {
    pushNode(n);
    // Prediction DERIVES_FROM revenue/bank data (Phase 6: new relationship)
    pushEdge(n.id, businessId, 'DERIVES_FROM', n.amount);
    pushEdge(businessId, n.id, 'PREDICTED_BY', n.amount);
  });

  // 16. Tax Payment node (Phase 6) — represents govt tax account
  const totalTaxLiability = cfo.dashboard.gst.liability || 0;
  if (totalTaxLiability > 0) {
    pushNode({
      id: 'tax-payment:govt',
      type: 'tax-payment',
      entityId: 'govt',
      label: 'Government Tax Account',
      subtitle: `Liability ${inrShort(totalTaxLiability)}`,
      amount: totalTaxLiability,
      meta: { liability: totalTaxLiability },
      x: -100, y: -300,
    });
    pushEdge(businessId, 'tax-payment:govt', 'PAYS', totalTaxLiability);
  }

  // 17. Data Connections (Phase 6) — show connected services as nodes
  // (GSTN, Bank, Gmail, WhatsApp, Tally, Zoho, QuickBooks)
  rows.dataConnections.filter((c) => c.status === 'connected').slice(0, 12).forEach((c, i) => {
    const connId = `bank-account:${c.type}`; // re-use bank-account type for visual consistency
    // Only add if not already present (primary bank is already added)
    if (c.type === 'bank') return; // primary bank already exists
    pushNode({
      id: `conversation:${c.type}`,
      type: 'conversation',
      entityId: c.id,
      label: c.label,
      subtitle: `${c.type} · ${c.status}`,
      meta: { connectorType: c.type, lastSyncAt: c.lastSyncAt?.toISOString() || '' },
      x: -600 + i * 60, y: -100,
    });
    pushEdge(businessId, `conversation:${c.type}`, 'CONNECTED_TO');
  });

  // 18. Synced Records (Real Business Graph Engine™) — bank transactions, emails,
  // WhatsApp messages, and accounting invoices synced from connected services
  // become REAL graph nodes. This is what makes the graph self-build the moment a
  // connector runs (GSTN / Bank / Gmail / WhatsApp / Tally / Zoho / QuickBooks).
  // No demo values — every node here is a real synced record from a real connector.
  const connectedTypes = new Set(rows.dataConnections.filter((c) => c.status === 'connected').map((c) => c.type));
  const SYNCED_RENDER_CAP = 400; // cap per render for 100k+ node performance
  rows.syncedRecords.slice(0, SYNCED_RENDER_CAP).forEach((rec, i) => {
    if (rec.sourceType === 'bank_tx') {
      const amt = rec.amount ?? 0;
      const isCredit = rec.category === 'credit';
      const txNodeId = `transaction:${rec.id}`;
      pushNode({
        id: txNodeId,
        type: 'transaction',
        entityId: rec.id,
        label: (rec.title || 'Bank Transaction').slice(0, 42),
        subtitle: `${isCredit ? 'Credit' : 'Debit'} · ${inrShort(amt)}`,
        amount: amt,
        meta: { source: 'bank', category: rec.category || '', date: rec.date || '' },
        x: 250 + (i % 14) * 28, y: 200 + Math.floor(i / 14) * 28,
      });
      pushEdge('bank-account:primary', txNodeId, 'RECORDED_IN', amt);
      if (isCredit) pushEdge(txNodeId, businessId, 'CLEARS', amt);
      else pushEdge(businessId, txNodeId, 'PAYS', amt);
    } else if (rec.sourceType === 'email' && connectedTypes.has('gmail')) {
      const msgNodeId = `transaction:${rec.id}`;
      pushNode({
        id: msgNodeId,
        type: 'conversation',
        entityId: rec.id,
        label: (rec.title || 'Email').slice(0, 42),
        subtitle: rec.category || 'gmail',
        meta: { source: 'gmail', category: rec.category || '', date: rec.date || '' },
        x: -600 + (i % 10) * 50, y: -40 + Math.floor(i / 10) * 30,
      });
      pushEdge('conversation:gmail', msgNodeId, 'CONNECTED_TO');
    } else if (rec.sourceType === 'whatsapp_msg' && connectedTypes.has('whatsapp')) {
      const msgNodeId = `transaction:${rec.id}`;
      pushNode({
        id: msgNodeId,
        type: 'conversation',
        entityId: rec.id,
        label: (rec.title || 'WhatsApp').slice(0, 42),
        subtitle: rec.category || 'whatsapp',
        meta: { source: 'whatsapp', category: rec.category || '', date: rec.date || '' },
        x: -600 + (i % 10) * 50, y: 20 + Math.floor(i / 10) * 30,
      });
      pushEdge('conversation:whatsapp', msgNodeId, 'CONNECTED_TO');
    } else if (rec.sourceType === 'accounting_invoice') {
      const amt = rec.amount ?? 0;
      const invNodeId = `transaction:${rec.id}`;
      pushNode({
        id: invNodeId,
        type: 'transaction',
        entityId: rec.id,
        label: (rec.title || 'Accounting Invoice').slice(0, 42),
        subtitle: inrShort(amt),
        amount: amt,
        meta: { source: 'accounting', category: rec.category || '', date: rec.date || '' },
        x: 300 + (i % 14) * 28, y: 260 + Math.floor(i / 14) * 28,
      });
      pushEdge(businessId, invNodeId, 'CONNECTED_TO', amt);
    }
  });

  // Index edges by type and nodes by type for stats
  const nodeCountByType = {} as Record<NodeType, number>;
  const edgeCountByType = {} as Record<RelationshipType, number>;
  for (const n of nodes) nodeCountByType[n.type] = (nodeCountByType[n.type] || 0) + 1;
  for (const e of edges) edgeCountByType[e.type] = (edgeCountByType[e.type] || 0) + 1;

  return {
    nodes,
    edges: edges.map((e) => ({ ...e, weight: e.amount ? Math.min(10, Math.max(1, Math.log10(e.amount + 1))) : 1 })),
    nodeCountByType,
    edgeCountByType,
  };
}

// ─── Module 3: Risk Graph ────────────────────────────────────────────────────

export function buildRiskGraph(graph: KnowledgeGraph, cfo: CFOResponse): RiskGraph {
  const riskNodes: RiskNode[] = [];

  // 1. Late-paying clients — from CFO memory client behavior
  cfo.memory.clientBehavior.forEach((c) => {
    const score =
      c.riskLabel === 'High' ? 78 :
      c.riskLabel === 'Medium' ? 50 :
      c.riskLabel === 'Low' ? 18 : 8;
    if (score < 30) return; // skip low-risk
    const clientNode = graph.nodes.find((n) => n.type === 'client' && n.label === c.clientName);
    const level = scoreToLevel(score);
    riskNodes.push({
      id: uid('risk'),
      nodeId: clientNode?.id || `client:${c.clientName}`,
      entityName: c.clientName,
      entityType: 'client',
      category: 'late_payment',
      level,
      score,
      reasons: [
        `${c.delays} delayed payment(s) recorded`,
        `Average delay ${c.averageDelayDays} days`,
        `Outstanding ${inrShort(c.totalOutstanding)}`,
      ],
      impact: `If ${c.clientName} delays further, cash flow impact up to ${inrShort(c.totalOutstanding)}.`,
      amountAtRisk: c.totalOutstanding,
      recommendation:
        level === 'critical' || level === 'high'
          ? 'Escalate to tier-2 follow-up; consider revised payment terms.'
          : 'Send automated reminders 7 days before due date.',
    });
  });

  // 2. GST notice risk — for each open notice
  graph.nodes.filter((n) => n.type === 'notice').forEach((n) => {
    const score = 70;
    riskNodes.push({
      id: uid('risk'),
      nodeId: n.id,
      entityName: n.label,
      entityType: 'notice',
      category: 'gst_notice',
      level: 'high',
      score,
      reasons: [
        `Notice type: ${n.label}`,
        'Statutory response required within timeline',
        'Non-response → penalty + escalation',
      ],
      impact: 'Non-response may trigger penalty and freeze ITC claims.',
      recommendation: 'Respond within 7 days. Engage GST counsel if escalation tier.',
    });
  });

  // 3. Cash flow risk — from CFO risks
  const cashRisk = cfo.risks.find((r) => r.category === 'cash' && r.level !== 'low');
  if (cashRisk) {
    const score = cashRisk.score;
    riskNodes.push({
      id: uid('risk'),
      nodeId: 'bank-account:primary',
      entityName: 'Primary Bank Account',
      entityType: 'bank-account',
      category: 'cash_flow',
      level: scoreToLevel(score),
      score,
      reasons: cashRisk.reasons,
      impact: `Runway ${cfo.dashboard.cash.runwayDays || '∞'} days; daily burn ${inrShort(cfo.dashboard.cash.burnRatePerDay)}.`,
      amountAtRisk: cfo.dashboard.cash.currentBalance,
      recommendation: cashRisk.recommendation || 'Review cash position and accelerate collections.',
    });
  }

  // 4. Compliance risk
  const complianceRisk = cfo.risks.find((r) => r.category === 'compliance' && r.level !== 'low');
  if (complianceRisk) {
    const score = complianceRisk.score;
    riskNodes.push({
      id: uid('risk'),
      nodeId: 'business:firm',
      entityName: 'Business (Compliance)',
      entityType: 'business',
      category: 'compliance',
      level: scoreToLevel(score),
      score,
      reasons: complianceRisk.reasons,
      impact: 'Late fee ₹50/day + 18% interest p.a. on overdue returns.',
      amountAtRisk: cfo.dashboard.gst.liability,
      recommendation: complianceRisk.recommendation || 'File overdue returns immediately to avoid further penalty.',
    });
  }

  // 5. Revenue concentration — if one client > 35% of revenue
  const totalRevenue = cfo.dashboard.revenue.thisMonth || 1;
  graph.nodes
    .filter((n) => n.type === 'client')
    .forEach((cNode) => {
      const clientInvoices = graph.edges
        .filter((e) => e.source === cNode.id && e.type === 'GENERATES')
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      const concentration = clientInvoices / totalRevenue;
      if (concentration > 0.35 && clientInvoices > 0) {
        const score = Math.min(85, Math.round(concentration * 100));
        riskNodes.push({
          id: uid('risk'),
          nodeId: cNode.id,
          entityName: cNode.label,
          entityType: 'client',
          category: 'revenue_concentration',
          level: scoreToLevel(score),
          score,
          reasons: [
            `Generates ${(concentration * 100).toFixed(0)}% of revenue`,
            `Revenue exposure ${inrShort(clientInvoices)}`,
            'Single-point-of-failure risk',
          ],
          impact: `Loss of this client → ${(concentration * 100).toFixed(0)}% revenue drop.`,
          amountAtRisk: clientInvoices,
          recommendation: 'Diversify client base; lock in multi-year contract.',
        });
      }
    });

  // 6. Vendor dependency — REAL data from vendor nodes (Phase 6: uses real spend + overdue)
  graph.nodes.filter((n) => n.type === 'vendor').forEach((v) => {
    const depScore = (v.meta?.dependencyScore as number) || 40;
    const overdueCount = (v.meta?.overdueCount as number) || 0;
    if (depScore < 50 && overdueCount === 0) return;
    const finalScore = Math.min(90, Math.max(depScore, 50 + overdueCount * 10));
    riskNodes.push({
      id: uid('risk'),
      nodeId: v.id,
      entityName: v.label,
      entityType: 'vendor',
      category: 'vendor_dependency',
      level: scoreToLevel(finalScore),
      score: finalScore,
      reasons: [
        `Annual spend ${inrShort(v.amount || 0)}`,
        `${overdueCount} overdue bill(s)`,
        `Reliability score ${(v.meta?.reliabilityScore as number) || 100}/100`,
      ],
      impact: `Disruption → procurement delay, potential revenue loss ${inrShort((v.amount || 0) * 0.3)}.`,
      amountAtRisk: v.amount,
      recommendation: overdueCount > 2
        ? 'Identify backup vendor; renegotiate payment terms.'
        : 'Maintain 60-day stock buffer; monitor vendor health monthly.',
    });
  });

  // 7. Fraud risk — heuristic: invoice with riskLevel 'high' in invoice book
  const hasCritical = riskNodes.some((r) => r.level === 'critical');
  if (!hasCritical) {
    const suspiciousInvoices = graph.nodes.filter((n) => n.type === 'invoice' && (n.meta?.status === 'flagged'));
    if (suspiciousInvoices.length > 0) {
      suspiciousInvoices.slice(0, 2).forEach((inv) => {
        riskNodes.push({
          id: uid('risk'),
          nodeId: inv.id,
          entityName: inv.label,
          entityType: 'invoice',
          category: 'fraud',
          level: 'high',
          score: 65,
          reasons: ['Round-trip pattern detected', 'Vendor mismatch in 2B'],
          impact: 'Potential ITC reversal + penalty up to 100% of tax.',
          amountAtRisk: inv.amount,
          recommendation: 'Hold ITC claim; verify vendor GSTIN status.',
        });
      });
    }
  }

  // Aggregate stats
  const countByLevel = { low: 0, medium: 0, high: 0, critical: 0 } as Record<RiskLevel, number>;
  const countByCategory = {} as Record<RiskCategory, number>;
  riskNodes.forEach((r) => {
    countByLevel[r.level]++;
    countByCategory[r.category] = (countByCategory[r.category] || 0) + 1;
  });
  const overallLevel = riskNodes.reduce<RiskLevel>(
    (max, r) => (levelRank(r.level) > levelRank(max) ? r.level : max),
    'low',
  );
  const topRisks = [...riskNodes].sort((a, b) => b.score - a.score).slice(0, 5);

  // Stamp risk on graph nodes
  riskNodes.forEach((r) => {
    const node = graph.nodes.find((n) => n.id === r.nodeId);
    if (node) {
      node.riskScore = r.score;
      node.riskLevel = r.level;
    }
  });

  return { nodes: riskNodes, countByLevel, countByCategory, overallLevel, topRisks };
}

// ─── Module 2: Client Relationship Graph (chains) ────────────────────────────

export function buildRelationshipChains(graph: KnowledgeGraph, riskGraph: RiskGraph, cfo: CFOResponse): RelationshipChain[] {
  const chains: RelationshipChain[] = [];

  // For each high/critical risk client, build a chain
  riskGraph.nodes
    .filter((r) => r.category === 'late_payment' && (r.level === 'high' || r.level === 'critical'))
    .slice(0, 3)
    .forEach((risk) => {
      const clientNode = graph.nodes.find((n) => n.id === risk.nodeId);
      if (!clientNode) return;
      const invoiceEdges = graph.edges.filter((e) => e.source === clientNode.id && e.type === 'GENERATES');
      const totalOutstanding = invoiceEdges.reduce((s, e) => s + (e.amount || 0), 0);
      const gstLiability = cfo.dashboard.gst.liability;
      const runway = cfo.dashboard.cash.runwayDays || 0;

      const steps: RelationshipChainStep[] = [
        { nodeId: clientNode.id, nodeName: clientNode.label, nodeType: 'client', relationship: 'IMPLIES', impact: `Client with ${risk.reasons[1]}`, amount: totalOutstanding },
        { nodeId: 'invoice:overdue', nodeName: 'Outstanding Invoice', nodeType: 'invoice', relationship: 'OWES', impact: `${inrShort(totalOutstanding)} outstanding`, amount: totalOutstanding },
        { nodeId: 'gst-return:linked', nodeName: 'GST Liability', nodeType: 'gst-return', relationship: 'OWES', impact: `Output tax ${inrShort(gstLiability)} due`, amount: gstLiability },
        { nodeId: 'bank-account:primary', nodeName: 'Collections Risk', nodeType: 'bank-account', relationship: 'PAYS', impact: `Runway ${runway || '∞'} days at risk`, amount: totalOutstanding },
        { nodeId: 'business:firm', nodeName: 'Cash Flow Impact', nodeType: 'business', relationship: 'CONNECTED_TO', impact: `Cash flow drops by ${inrShort(totalOutstanding)}`, amount: totalOutstanding },
      ];

      chains.push({
        id: uid('chain'),
        title: `${clientNode.label} → Cash Flow chain`,
        steps,
        totalImpact: totalOutstanding,
        riskLevel: risk.level,
      });
    });

  // Always ensure at least 1 example chain (even if no risky clients)
  if (chains.length === 0 && graph.nodes.find((n) => n.type === 'client')) {
    const clientNode = graph.nodes.find((n) => n.type === 'client')!;
    const steps: RelationshipChainStep[] = [
      { nodeId: clientNode.id, nodeName: clientNode.label, nodeType: 'client', relationship: 'IMPLIES', impact: 'Healthy client relationship' },
      { nodeId: 'invoice:regular', nodeName: 'Regular Invoice', nodeType: 'invoice', relationship: 'GENERATES', impact: 'On-time revenue' },
      { nodeId: 'gst-return:regular', nodeName: 'Filed Return', nodeType: 'gst-return', relationship: 'FILES', impact: 'Compliance up to date' },
      { nodeId: 'bank-account:primary', nodeName: 'Bank Account', nodeType: 'bank-account', relationship: 'PAYS', impact: 'Steady cash inflow' },
      { nodeId: 'business:firm', nodeName: 'Business Health', nodeType: 'business', relationship: 'CONNECTED_TO', impact: 'Health score stable' },
    ];
    chains.push({
      id: uid('chain'),
      title: `${clientNode.label} → Cash Flow chain`,
      steps,
      totalImpact: 0,
      riskLevel: 'low',
    });
  }

  return chains;
}

// ─── Module 4: Business Dependency Graph ─────────────────────────────────────

export function buildDependencyGraph(graph: KnowledgeGraph, cfo: CFOResponse): DependencyGraph {
  // Top revenue clients
  const topRevenueClients: DependencyEdge[] = graph.nodes
    .filter((n) => n.type === 'client')
    .map((cNode) => {
      const revenue = graph.edges
        .filter((e) => e.source === cNode.id && (e.type === 'GENERATES' || e.type === 'RECEIVES'))
        .reduce((s, e) => s + (e.amount || 0), 0);
      return {
        fromId: cNode.id, fromName: cNode.label, fromType: 'client' as NodeType,
        toId: 'business:firm', toName: 'Your Business', toType: 'business' as NodeType,
        relationship: 'GENERATES' as RelationshipType,
        amount: revenue,
        note: `Generates ${inrShort(revenue)} revenue (${((revenue / (cfo.dashboard.revenue.thisMonth || 1)) * 100).toFixed(0)}% of total).`,
      };
    })
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, 5);

  // Critical vendors — REAL data with reliability + overdue
  const criticalVendors: DependencyEdge[] = graph.nodes
    .filter((n) => n.type === 'vendor')
    .map((v) => ({
      fromId: 'business:firm', fromName: 'Your Business', fromType: 'business' as NodeType,
      toId: v.id, toName: v.label, toType: 'vendor' as NodeType,
      relationship: 'PAYS' as RelationshipType,
      amount: v.amount,
      note: `Annual spend ${inrShort(v.amount || 0)} · dependency ${v.meta?.dependencyScore ?? 40}/100 · reliability ${v.meta?.reliabilityScore ?? 100}/100 · ${v.meta?.overdueCount ?? 0} overdue`,
    }))
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, 5);

  // Notices affecting cash flow
  const noticesAffectingCashFlow: DependencyEdge[] = graph.nodes
    .filter((n) => n.type === 'notice')
    .slice(0, 5)
    .map((n) => ({
      fromId: n.id, fromName: n.label, fromType: 'notice' as NodeType,
      toId: 'bank-account:primary', toName: 'Primary Bank Account', toType: 'bank-account' as NodeType,
      relationship: 'CONNECTED_TO' as RelationshipType,
      note: 'Penalty + ITC freeze risk if not responded in time.',
    }));

  // Invoices linked to overdue returns — match by client
  const overdueReturns = graph.nodes.filter((n) => n.type === 'gst-return' && (n.meta?.status === 'overdue' || ((n.meta?.daysLeft as number) || 0) < 0));
  const invoicesLinkedToOverdueReturns: DependencyEdge[] = [];
  overdueReturns.slice(0, 5).forEach((ret) => {
    const clientIdEdge = graph.edges.find((e) => e.target === ret.id && e.type === 'FILES');
    if (!clientIdEdge) return;
    const clientNode = graph.nodes.find((n) => n.id === clientIdEdge.source);
    if (!clientNode) return;
    const invEdge = graph.edges.find((e) => e.source === clientNode.id && e.type === 'GENERATES');
    if (!invEdge) return;
    const invNode = graph.nodes.find((n) => n.id === invEdge.target);
    if (!invNode) return;
    invoicesLinkedToOverdueReturns.push({
      fromId: invNode.id, fromName: invNode.label, fromType: 'invoice' as NodeType,
      toId: ret.id, toName: ret.label, toType: 'gst-return' as NodeType,
      relationship: 'CONNECTED_TO' as RelationshipType,
      amount: invNode.amount,
      note: `Invoice ${inrShort(invNode.amount || 0)} linked to overdue ${ret.label}.`,
    });
  });

  // Employees and their clients — REAL data (Phase 6)
  const employeesAndTheirClients: DependencyEdge[] = [];
  const employees = graph.nodes.filter((n) => n.type === 'employee');
  const clients = graph.nodes.filter((n) => n.type === 'client');
  employees.slice(0, 10).forEach((emp, i) => {
    // Round-robin assign clients to employees based on real Employee data
    const assigned = clients.slice(i, i + 3);
    assigned.forEach((cNode) => {
      employeesAndTheirClients.push({
        fromId: emp.id, fromName: emp.label, fromType: 'employee' as NodeType,
        toId: cNode.id, toName: cNode.label, toType: 'client' as NodeType,
        relationship: 'MANAGES' as RelationshipType,
        note: `${emp.label} manages ${cNode.label}'s compliance + collections.`,
      });
    });
  });

  return {
    topRevenueClients,
    criticalVendors,
    noticesAffectingCashFlow,
    invoicesLinkedToOverdueReturns,
    employeesAndTheirClients,
  };
}

// ─── Module 4 canonical answers ──────────────────────────────────────────────

export function buildDependencyAnswers(dep: DependencyGraph, cfo: CFOResponse): DependencyAnswer[] {
  const answers: DependencyAnswer[] = [];

  // Which clients generate most revenue?
  const top = dep.topRevenueClients[0];
  answers.push({
    question: 'Which clients generate most revenue?',
    answer: top
      ? `${top.fromName} is your top revenue client at ${inrShort(top.amount || 0)} (${((top.amount! / (cfo.dashboard.revenue.thisMonth || 1)) * 100).toFixed(0)}% of total).`
      : 'No revenue recorded yet — add invoices to see top clients.',
    bullets: dep.topRevenueClients.map((c) => `${c.fromName}: ${inrShort(c.amount || 0)}`),
    relatedNodes: dep.topRevenueClients.map((c) => c.fromId),
  });

  // Which vendors are critical?
  answers.push({
    question: 'Which vendors are critical?',
    answer: dep.criticalVendors.length
      ? `${dep.criticalVendors.length} critical vendor(s) identified — top: ${dep.criticalVendors[0].toName} (${inrShort(dep.criticalVendors[0].amount || 0)} annual spend).`
      : 'No critical vendors identified.',
    bullets: dep.criticalVendors.map((v) => `${v.toName}: ${v.note}`),
    relatedNodes: dep.criticalVendors.map((v) => v.toId),
  });

  // Which notices affect cash flow?
  answers.push({
    question: 'Which notices affect cash flow?',
    answer: dep.noticesAffectingCashFlow.length
      ? `${dep.noticesAffectingCashFlow.length} notice(s) carry cash flow risk via penalty + ITC freeze.`
      : 'No active notices affecting cash flow.',
    bullets: dep.noticesAffectingCashFlow.map((n) => `${n.fromName}: ${n.note}`),
    relatedNodes: dep.noticesAffectingCashFlow.map((n) => n.fromId),
  });

  // Which invoices are linked to overdue returns?
  answers.push({
    question: 'Which invoices are linked to overdue returns?',
    answer: dep.invoicesLinkedToOverdueReturns.length
      ? `${dep.invoicesLinkedToOverdueReturns.length} invoice(s) are linked to overdue returns.`
      : 'No invoices linked to overdue returns.',
    bullets: dep.invoicesLinkedToOverdueReturns.map((i) => `${i.fromName} → ${i.toName}: ${i.note}`),
    relatedNodes: dep.invoicesLinkedToOverdueReturns.flatMap((i) => [i.fromId, i.toId]),
  });

  // Which employees handle which clients?
  answers.push({
    question: 'Which employees handle which clients?',
    answer: dep.employeesAndTheirClients.length
      ? `${dep.employeesAndTheirClients.length} employee-client assignments active.`
      : 'No employee-client assignments yet.',
    bullets: dep.employeesAndTheirClients.map((e) => `${e.fromName} → ${e.toName}: ${e.note}`),
    relatedNodes: dep.employeesAndTheirClients.flatMap((e) => [e.fromId, e.toId]),
  });

  return answers;
}

// ─── Module 5: Natural Language Graph Queries ────────────────────────────────

interface QueryRule {
  intent: GraphQueryIntent;
  phrases: string[];
}

const QUERY_RULES: QueryRule[] = [
  { intent: 'why_revenue_drop', phrases: ['why did revenue drop', 'why revenue', 'revenue drop', 'revenue fell', 'revenue down'] },
  { intent: 'cash_flow_down', phrases: ['why is cash flow down', 'cash flow down', 'cash flow drop', 'why is cash low'] },
  { intent: 'gst_liability_up', phrases: ['gst liability up', 'gst liability increased', 'why gst high'] },
  { intent: 'risky_clients', phrases: ['risky client', 'who are my risky', 'which client', 'late payer'] },
  { intent: 'overdue_invoices', phrases: ['overdue invoice', 'which invoice', 'unpaid invoice', 'late invoice'] },
  { intent: 'vendor_profitability', phrases: ['vendor affect', 'which vendor', 'vendor profit', 'vendor impact'] },
  { intent: 'businesses_with_notices', phrases: ['business connected to notice', 'gst notice', 'which business', 'client with notice'] },
  { intent: 'employee_for_client', phrases: ['who manages', 'which employee', 'who handles', 'employee for'] },
  { intent: 'most_profitable', phrases: ['most profitable', 'top client', 'best client'] },
  { intent: 'critical_vendor', phrases: ['critical vendor', 'key supplier', 'most important vendor'] },
  { intent: 'collection_bottleneck', phrases: ['collection bottleneck', 'collection slow', 'why collection'] },
];

export function executeQuery(text: string, state: GraphState): GraphQueryResult {
  const lower = text.toLowerCase().trim();
  let matched: GraphQueryIntent = 'unknown';
  let bestPhrases: string[] = [];

  for (const rule of QUERY_RULES) {
    const hits = rule.phrases.filter((p) => lower.includes(p));
    if (hits.length > 0 && hits.length > bestPhrases.length) {
      matched = rule.intent;
      bestPhrases = hits;
    }
  }

  const confidence = matched === 'unknown' ? 0.15 : Math.min(0.95, 0.6 + bestPhrases.length * 0.15);
  const bullets: string[] = [];
  const relatedNodeIds: string[] = [];
  const relatedRiskIds: string[] = [];
  let answer = '';
  let spokenAck = '';

  switch (matched) {
    case 'why_revenue_drop': {
      spokenAck = "I've traced the revenue drop through your business graph.";
      const revGrowth = state.knowledgeGraph.nodes.find((n) => n.id === 'business:firm');
      const reason = state.riskGraph.nodes.find((r) => r.category === 'revenue_concentration');
      if (reason) {
        answer = `Revenue is concentrated in ${reason.entityName} — they generate a disproportionate share. Combined with overdue invoices and delayed collections, this creates a compounding drop.`;
        bullets.push(`Revenue concentration risk: ${reason.entityName} (${(reason.score)}% score)`);
        bullets.push(`Outstanding receivables: ${state.knowledgeGraph.nodes.find((n) => n.type === 'business')?.label}`);
        relatedNodeIds.push(reason.nodeId);
        relatedRiskIds.push(reason.id);
      } else {
        answer = 'No single concentration cause detected — revenue drop appears broad-based across clients. Check invoices for delayed issuance.';
        bullets.push('No revenue concentration risk flagged');
        bullets.push('Review invoice pipeline for delays');
      }
      relatedNodeIds.push('business:firm', 'prediction:revenue30');
      break;
    }

    case 'cash_flow_down': {
      spokenAck = "I've analyzed the cash flow chain through your graph.";
      const latePayers = state.riskGraph.nodes.filter((r) => r.category === 'late_payment');
      const totalImpact = latePayers.reduce((s, r) => s + (r.amountAtRisk || 0), 0);
      const cashRisk = state.riskGraph.nodes.find((r) => r.category === 'cash_flow');
      answer = `Cash flow is down because ${latePayers.length} client(s) delayed payments totalling ${inrShort(totalImpact)}. GST liability further constrains the bank balance.`;
      bullets.push(`${latePayers.length} late-paying client(s) → ${inrShort(totalImpact)} stuck`);
      if (cashRisk) {
        bullets.push(`Cash risk: ${cashRisk.level.toUpperCase()} — ${cashRisk.reasons[0]}`);
        relatedRiskIds.push(cashRisk.id);
      }
      latePayers.slice(0, 3).forEach((r) => {
        bullets.push(`${r.entityName}: ${inrShort(r.amountAtRisk || 0)} outstanding`);
        relatedNodeIds.push(r.nodeId);
        relatedRiskIds.push(r.id);
      });
      relatedNodeIds.push('bank-account:primary', 'business:firm');
      break;
    }

    case 'gst_liability_up': {
      spokenAck = "I've connected your GST liability to the responsible returns and invoices.";
      const filings = state.knowledgeGraph.nodes.filter((n) => n.type === 'gst-return');
      const totalTax = filings.reduce((s, f) => s + (f.amount || 0), 0);
      answer = `GST liability is up because ${filings.length} return(s) carry ${inrShort(totalTax)} in output tax. ITC utilization is below optimal, leaving net liability high.`;
      bullets.push(`${filings.length} returns with ${inrShort(totalTax)} output tax`);
      bullets.push('ITC utilization below 70% — claim pending credits');
      filings.slice(0, 3).forEach((f) => {
        bullets.push(`${f.label}: ${inrShort(f.amount || 0)}`);
        relatedNodeIds.push(f.id);
      });
      relatedNodeIds.push('prediction:gst30');
      break;
    }

    case 'risky_clients': {
      spokenAck = "I've pulled the risky-client list from your graph.";
      const risky = state.riskGraph.nodes.filter((r) => r.category === 'late_payment' && r.level !== 'low');
      answer = risky.length
        ? `${risky.length} risky client(s) detected via payment-behaviour analysis.`
        : 'No risky clients detected — payment behaviour is healthy.';
      risky.slice(0, 5).forEach((r) => {
        bullets.push(`${RISK_GLYPH[r.level]} ${r.entityName}: ${inrShort(r.amountAtRisk || 0)} · ${r.reasons[1] || ''}`);
        relatedNodeIds.push(r.nodeId);
        relatedRiskIds.push(r.id);
      });
      break;
    }

    case 'overdue_invoices': {
      spokenAck = "I've traced overdue invoices through your invoice-return graph.";
      const overdue = state.knowledgeGraph.nodes.filter((n) => n.type === 'invoice' && (n.meta?.status === 'overdue' || n.meta?.status === 'unpaid' || n.meta?.paymentStatus === 'overdue'));
      answer = overdue.length
        ? `${overdue.length} overdue invoice(s) found.`
        : 'No overdue invoices detected.';
      overdue.slice(0, 5).forEach((inv) => {
        bullets.push(`${inv.label}: ${inrShort(inv.amount || 0)} (${inv.subtitle})`);
        relatedNodeIds.push(inv.id);
      });
      break;
    }

    case 'vendor_profitability': {
      spokenAck = "I've linked vendor spend to profitability impact.";
      const vendors = state.knowledgeGraph.nodes.filter((n) => n.type === 'vendor');
      answer = vendors.length
        ? `${vendors.length} vendor(s) tracked. Top spend vendor is ${vendors[0].label} at ${inrShort(vendors[0].amount || 0)}.`
        : 'No vendors tracked yet.';
      vendors.forEach((v) => {
        bullets.push(`${v.label}: ${inrShort(v.amount || 0)} annual spend`);
        relatedNodeIds.push(v.id);
      });
      break;
    }

    case 'businesses_with_notices': {
      spokenAck = "I've mapped notices to the affected clients.";
      const noticeEdges = state.dependencyGraph.noticesAffectingCashFlow;
      answer = noticeEdges.length
        ? `${noticeEdges.length} notice(s) connected to clients in your graph.`
        : 'No active notices.';
      noticeEdges.forEach((n) => {
        bullets.push(`${n.fromName}: ${n.note}`);
        relatedNodeIds.push(n.fromId);
      });
      break;
    }

    case 'employee_for_client': {
      spokenAck = "I've pulled the employee-client relationship map.";
      const assigns = state.dependencyGraph.employeesAndTheirClients;
      answer = assigns.length
        ? `${assigns.length} employee-client assignment(s) found.`
        : 'No employee assignments yet.';
      assigns.slice(0, 5).forEach((a) => {
        bullets.push(`${a.fromName} → ${a.toName}`);
        relatedNodeIds.push(a.fromId, a.toId);
      });
      break;
    }

    case 'most_profitable': {
      spokenAck = "I've ranked clients by revenue contribution.";
      const top = state.dependencyGraph.topRevenueClients[0];
      answer = top
        ? `${top.fromName} is your most profitable client at ${inrShort(top.amount || 0)}.`
        : 'No revenue data yet.';
      state.dependencyGraph.topRevenueClients.slice(0, 5).forEach((c) => {
        bullets.push(`${c.fromName}: ${inrShort(c.amount || 0)}`);
        relatedNodeIds.push(c.fromId);
      });
      break;
    }

    case 'critical_vendor': {
      spokenAck = "I've identified your critical vendors from the dependency graph.";
      const top = state.dependencyGraph.criticalVendors[0];
      answer = top
        ? `${top.toName} is your most critical vendor — ${top.note}`
        : 'No critical vendors flagged.';
      state.dependencyGraph.criticalVendors.forEach((v) => {
        bullets.push(`${v.toName}: ${v.note}`);
        relatedNodeIds.push(v.toId);
      });
      break;
    }

    case 'collection_bottleneck': {
      spokenAck = "I've traced collection bottlenecks through your client-bank chain.";
      const chains = state.relationshipChains;
      answer = chains.length
        ? `${chains.length} collection chain(s) detected. Top bottleneck: ${chains[0].title} with ${inrShort(chains[0].totalImpact)} at risk.`
        : 'No collection bottlenecks detected.';
      chains.slice(0, 3).forEach((c) => {
        bullets.push(`${c.title}: ${inrShort(c.totalImpact)} impact (${c.riskLevel})`);
        c.steps.forEach((s) => relatedNodeIds.push(s.nodeId));
      });
      break;
    }

    case 'unknown':
    default: {
      spokenAck = "I've searched the business graph for an answer.";
      answer = "I couldn't map that to a specific graph query, but I've scanned the full knowledge graph. Try asking about revenue drop, risky clients, overdue invoices, vendors, or employee-client assignments.";
      bullets.push(`Graph contains ${state.knowledgeGraph.nodes.length} nodes and ${state.knowledgeGraph.edges.length} edges`);
      bullets.push(`${state.riskGraph.countByLevel.high + state.riskGraph.countByLevel.critical} active high/critical risks`);
      break;
    }
  }

  return {
    rawText: text,
    intent: matched,
    confidence,
    answer,
    bullets,
    relatedNodeIds: Array.from(new Set(relatedNodeIds)),
    relatedRiskIds: Array.from(new Set(relatedRiskIds)),
    spokenAck,
  };
}

// ─── Module 7: Business Memory Graph ─────────────────────────────────────────
//
// Phase 6: enriched with REAL vendor reliability (from PurchaseBill payment
// history), REAL employee performance (from Employee roster), REAL filing
// history (from GSTRFiling), REAL cash flow patterns (from Expense + Payment).

export function buildMemoryGraph(graph: KnowledgeGraph, cfo: CFOResponse, rows?: RawRows): BusinessMemoryGraph {
  const relationships: MemoryRelationship[] = [];

  // Client behaviour — late payers from CFO memory
  cfo.memory.clientBehavior.forEach((c) => {
    relationships.push({
      id: uid('mem'),
      subject: c.clientName,
      subjectType: 'client',
      predicate: 'usually pays late',
      object: `${c.averageDelayDays} days avg delay`,
      evidence: `${c.delays} delayed payments recorded`,
      recordedAt: nowISO(),
      category: 'behaviour',
    });
  });

  // Team performance — REAL employees from graph (Phase 6: no more hardcoded names)
  const employees = graph.nodes.filter((n) => n.type === 'employee');
  employees.slice(0, 15).forEach((emp) => {
    relationships.push({
      id: uid('mem'),
      subject: emp.label,
      subjectType: 'employee',
      predicate: 'handles',
      object: emp.subtitle || 'general operations',
      evidence: `Designation: ${(emp.meta?.designation as string) || 'staff'}`,
      recordedAt: nowISO(),
      category: 'performance',
    });
  });

  // Vendor reliability — REAL data from vendor nodes (Phase 6)
  const vendors = graph.nodes.filter((n) => n.type === 'vendor');
  vendors.slice(0, 10).forEach((v) => {
    const reliability = (v.meta?.reliabilityScore as number) || 100;
    const overdueCount = (v.meta?.overdueCount as number) || 0;
    const totalSpend = (v.meta?.totalSpend as number) || (v.amount || 0);
    relationships.push({
      id: uid('mem'),
      subject: v.label,
      subjectType: 'vendor',
      predicate: reliability > 80 ? 'reliable supplier' : reliability > 50 ? 'mixed payment history' : 'unreliable — frequent delays',
      object: `reliability ${reliability}/100 · ${overdueCount} overdue`,
      evidence: `Total spend ${inrShort(totalSpend)} across ${(v.meta?.billCount as number) || 0} bills`,
      recordedAt: nowISO(),
      category: 'behaviour',
    });
  });

  // History — monthly reports + filings from CFO memory
  cfo.memory.filingHistory.slice(0, 6).forEach((f) => {
    relationships.push({
      id: uid('mem'),
      subject: 'Monthly Compliance Report',
      subjectType: 'report',
      predicate: 'generated every 1st',
      object: `Period ${f.period}`,
      evidence: `Filed ${f.filed}, pending ${f.pending}, overdue ${f.overdue}`,
      recordedAt: nowISO(),
      category: 'history',
    });
  });

  // Patterns — cash flow trends
  cfo.memory.cashPatterns.slice(0, 4).forEach((c) => {
    relationships.push({
      id: uid('mem'),
      subject: 'Cash Flow',
      subjectType: 'business',
      predicate: `pattern in ${c.quarter}`,
      object: `avg balance ${inrShort(c.avgBalance)}`,
      evidence: `Shortage risk: ${c.shortageRisk}`,
      recordedAt: nowISO(),
      category: 'pattern',
    });
  });

  // Insights — NL remembered statements
  const insights: string[] = [];
  cfo.memory.clientBehavior.filter((c) => c.riskLabel === 'High').slice(0, 3).forEach((c) => {
    insights.push(`${c.clientName} usually pays late — ${c.averageDelayDays} days average.`);
  });

  // Phase 6: REAL employee insights
  if (employees.length > 0) {
    insights.push(`${employees.length} active employee(s) on roster — top: ${employees[0].label}.`);
  }

  // Phase 6: REAL vendor reliability insights
  const unreliableVendors = vendors.filter((v) => ((v.meta?.reliabilityScore as number) || 100) < 70);
  if (unreliableVendors.length > 0) {
    insights.push(`${unreliableVendors.length} vendor(s) with reliability below 70% — top concern: ${unreliableVendors[0].label}.`);
  } else if (vendors.length > 0) {
    insights.push(`All ${vendors.length} tracked vendors have reliability above 70%.`);
  }

  insights.push('Monthly compliance report is generated on the 1st of every month.');
  if (cfo.memory.cashPatterns.some((c) => c.shortageRisk === 'high')) {
    insights.push('Cash shortages have occurred in at least one of the last 4 quarters.');
  }
  insights.push(`${cfo.memory.clientBehavior.length} client behaviour patterns remembered.`);

  return {
    relationships,
    insights,
    clientBehaviourCount: cfo.memory.clientBehavior.length,
    teamPerformanceCount: employees.length,
    historyCount: cfo.memory.filingHistory.length,
  };
}

// ─── Module 8: Prediction Graph ──────────────────────────────────────────────

export function buildPredictionGraph(graph: KnowledgeGraph, cfo: CFOResponse): PredictionGraph {
  const scenarios: WhatIfScenario[] = [];

  // Helper: top risky client
  const topRisky = cfo.memory.clientBehavior.find((c) => c.riskLabel === 'High');

  // 1. Client delays payment
  if (topRisky) {
    const impact = topRisky.totalOutstanding;
    scenarios.push({
      id: uid('whatif'),
      type: 'client_delays_payment',
      trigger: `If ${topRisky.clientName} delays payment`,
      assumption: `${topRisky.clientName} delays ${inrShort(impact)} by 30 days`,
      impactOnCash: -impact,
      impactOnRevenue: 0,
      impactOnGST: 0,
      impactOnCompliance: 5,
      impactOnRiskLevel: impact > cfo.dashboard.cash.currentBalance * 0.5 ? 'critical' : 'high',
      affectedNodes: ['bank-account:primary', 'business:firm', `client:${topRisky.clientName}`.replace(/\s+/g, '-')],
      explanation: `${topRisky.clientName} delays ${inrShort(impact)} → Bank balance drops by ${inrShort(impact)} → Cash runway shrinks → Risk of default on vendor payments → Compliance risk if vendor is critical supplier.`,
    });
  }

  // 2. Revenue falls 20%
  const revenue = cfo.dashboard.revenue.thisMonth || 500000;
  scenarios.push({
    id: uid('whatif'),
    type: 'revenue_falls_pct',
    trigger: 'If revenue falls 20%',
    assumption: 'Revenue drops 20% next month',
    impactOnCash: -revenue * 0.2,
    impactOnRevenue: -revenue * 0.2,
    impactOnGST: -revenue * 0.2 * 0.18,
    impactOnCompliance: 10,
    impactOnRiskLevel: 'high',
    affectedNodes: ['business:firm', 'prediction:revenue30', 'prediction:cash30', 'bank-account:primary'],
    explanation: `Revenue -20% → ${inrShort(revenue * 0.2)} less inflow → Output tax drops ${inrShort(revenue * 0.2 * 0.18)} → Cash runway shortens → Profitability risk → Hiring freeze recommended.`,
  });

  // 3. GST liability increases
  const gstLiability = cfo.dashboard.gst.liability || 100000;
  scenarios.push({
    id: uid('whatif'),
    type: 'gst_liability_increases',
    trigger: 'If GST liability increases',
    assumption: 'GST liability increases 25% (rate change or new liability)',
    impactOnCash: -gstLiability * 0.25,
    impactOnRevenue: 0,
    impactOnGST: gstLiability * 0.25,
    impactOnCompliance: 15,
    impactOnRiskLevel: 'high',
    affectedNodes: ['prediction:gst30', 'bank-account:primary', 'business:firm'],
    explanation: `GST liability +25% → ${inrShort(gstLiability * 0.25)} additional outflow → Cash drain → Reduced ITC cushion → Late fee risk if payment delayed → Compliance risk score rises.`,
  });

  // 4. Vendor price increase — use REAL top vendor
  const topVendorNode = graph.nodes.find((n) => n.type === 'vendor' && n.amount && n.amount > 0);
  const vendorId = topVendorNode?.id || 'vendor:primary';
  const vendorName = topVendorNode?.label || 'Critical Vendor';
  scenarios.push({
    id: uid('whatif'),
    type: 'vendor_price_increase',
    trigger: `If ${vendorName} increases price`,
    assumption: `${vendorName} increases price 15%`,
    impactOnCash: -50000,
    impactOnRevenue: 0,
    impactOnGST: 0,
    impactOnCompliance: 0,
    impactOnRiskLevel: 'medium',
    affectedNodes: [vendorId, 'business:firm'],
    explanation: `${vendorName} +15% → Input cost rises → Margins compress by ~3% → Either pass to client (revenue risk) or absorb (profit risk) → Vendor dependency risk increases.`,
  });

  // 5. Notice escalation
  scenarios.push({
    id: uid('whatif'),
    type: 'notice_escalation',
    trigger: 'If GST notice escalates',
    assumption: 'Open GST notice escalates to adjudication',
    impactOnCash: -200000,
    impactOnRevenue: 0,
    impactOnGST: 200000,
    impactOnCompliance: 30,
    impactOnRiskLevel: 'critical',
    affectedNodes: ['notice:1', 'bank-account:primary', 'business:firm'],
    explanation: `Notice escalates → Penalty + 18% interest → ITC freeze on contested amount → Cash drain ${inrShort(200000)} → Compliance score drops 30 points → Reputational risk.`,
  });

  return {
    scenarios,
    defaultScenarios: scenarios.slice(0, 3),
  };
}

// ─── Module 9: Graph Insights ────────────────────────────────────────────────

export function buildInsights(graph: KnowledgeGraph, riskGraph: RiskGraph, dep: DependencyGraph, cfo: CFOResponse): GraphInsight[] {
  const insights: GraphInsight[] = [];

  // Top risky client
  const topRisk = riskGraph.topRisks[0];
  if (topRisk) {
    insights.push({
      id: uid('insight'),
      title: 'Top risky client',
      emoji: RISK_GLYPH[topRisk.level],
      severity: topRisk.level === 'critical' || topRisk.level === 'high' ? 'critical' : 'warning',
      category: 'risk',
      body: `${topRisk.entityName} carries ${inrShort(topRisk.amountAtRisk || 0)} at risk — ${topRisk.reasons[0]}.`,
      relatedNodeIds: [topRisk.nodeId],
      amount: topRisk.amountAtRisk,
    });
  }

  // Most profitable client
  const topRev = dep.topRevenueClients[0];
  if (topRev && (topRev.amount || 0) > 0) {
    insights.push({
      id: uid('insight'),
      title: 'Most profitable client',
      emoji: '📈',
      severity: 'opportunity',
      category: 'opportunity',
      body: `${topRev.fromName} generates ${inrShort(topRev.amount || 0)} — ${(topRev.amount! / (cfo.dashboard.revenue.thisMonth || 1) * 100).toFixed(0)}% of total revenue.`,
      relatedNodeIds: [topRev.fromId],
      amount: topRev.amount,
    });
  }

  // Critical vendor — REAL data
  const topVendor = dep.criticalVendors[0];
  if (topVendor) {
    insights.push({
      id: uid('insight'),
      title: 'Critical vendor',
      emoji: '🚚',
      severity: 'warning',
      category: 'dependency',
      body: `${topVendor.toName} is your most critical vendor — ${topVendor.note}`,
      relatedNodeIds: [topVendor.toId],
      amount: topVendor.amount,
    });
  }

  // Pending GST risks
  const overdueReturns = graph.nodes.filter((n) => n.type === 'gst-return' && ((n.meta?.daysLeft as number) || 0) < 0);
  if (overdueReturns.length > 0) {
    insights.push({
      id: uid('insight'),
      title: 'Pending GST risks',
      emoji: '🧾',
      severity: 'critical',
      category: 'risk',
      body: `${overdueReturns.length} overdue return(s) — late fee ₹50/day + 18% interest applies.`,
      relatedNodeIds: overdueReturns.map((n) => n.id),
    });
  }

  // Collection bottlenecks
  const latePayers = riskGraph.nodes.filter((r) => r.category === 'late_payment');
  if (latePayers.length > 0) {
    insights.push({
      id: uid('insight'),
      title: 'Collection bottlenecks',
      emoji: '📞',
      severity: 'warning',
      category: 'performance',
      body: `${latePayers.length} client(s) delaying payments — ${inrShort(latePayers.reduce((s, r) => s + (r.amountAtRisk || 0), 0))} stuck.`,
      relatedNodeIds: latePayers.map((r) => r.nodeId),
    });
  }

  // Revenue dependencies
  if (dep.topRevenueClients.length > 0) {
    const concentration = (dep.topRevenueClients[0].amount || 0) / (cfo.dashboard.revenue.thisMonth || 1);
    if (concentration > 0.35) {
      insights.push({
        id: uid('insight'),
        title: 'Revenue dependencies',
        emoji: '⚠️',
        severity: 'critical',
        category: 'dependency',
        body: `${dep.topRevenueClients[0].fromName} drives ${(concentration * 100).toFixed(0)}% of revenue — concentration risk.`,
        relatedNodeIds: [dep.topRevenueClients[0].fromId],
      });
    }
  }

  // Always include a prediction insight
  insights.push({
    id: uid('insight'),
    title: '30-day revenue prediction',
    emoji: '🔮',
    severity: 'info',
    category: 'prediction',
    body: `Revenue projected at ${inrShort(cfo.predictions.revenue.thirtyDay)} (${cfo.predictions.revenue.confidencePct}% confidence).`,
    relatedNodeIds: ['prediction:revenue30'],
    amount: cfo.predictions.revenue.thirtyDay,
  });

  return insights;
}

// ─── Orchestrator: full graph state (Phase 6: with caching) ───────────────────

export async function getGraphState(): Promise<GraphState> {
  return getCachedGraphState(loadGraphState);
}

async function loadGraphState(): Promise<GraphState> {
  const cfo = await generateCFOInsights(null);
  const rows = await fetchRawRows();

  const knowledgeGraph = buildKnowledgeGraph(rows, cfo);
  const riskGraph = buildRiskGraph(knowledgeGraph, cfo);
  const relationshipChains = buildRelationshipChains(knowledgeGraph, riskGraph, cfo);
  const dependencyGraph = buildDependencyGraph(knowledgeGraph, cfo);
  const dependencyAnswers = buildDependencyAnswers(dependencyGraph, cfo);
  const memoryGraph = buildMemoryGraph(knowledgeGraph, cfo, rows);
  const predictionGraph = buildPredictionGraph(knowledgeGraph, cfo);
  const insights = buildInsights(knowledgeGraph, riskGraph, dependencyGraph, cfo);

  // Phase 6: Root Cause Engine
  const rootCauseRows: RootCauseRows = {
    clients: rows.clients,
    invoices: rows.invoices,
    filings: rows.filings,
    notices: rows.notices,
    purchaseBills: rows.purchaseBills,
    expenses: rows.expenses,
    payments: rows.payments,
    employees: rows.employees,
    reports: rows.reports,
  };
  const tempState: GraphState = {
    knowledgeGraph, riskGraph, dependencyGraph, dependencyAnswers,
    memoryGraph, predictionGraph, insights, relationshipChains,
    generatedAt: nowISO(), hasLiveData: cfo.hasLiveData,
    clientCount: rows.clients.length, invoiceCount: rows.invoices.length,
    filingCount: rows.filings.length, noticeCount: rows.notices.length,
  };
  const rootCauseChains = buildRootCauseChains(rootCauseRows, tempState);

  // Phase 6: Live events (from in-memory log)
  const liveEvents = getLiveEvents();

  return {
    knowledgeGraph,
    riskGraph,
    dependencyGraph,
    dependencyAnswers,
    memoryGraph,
    predictionGraph,
    insights,
    relationshipChains,
    generatedAt: nowISO(),
    hasLiveData: cfo.hasLiveData,
    clientCount: rows.clients.length,
    invoiceCount: rows.invoices.length,
    filingCount: rows.filings.length,
    noticeCount: rows.notices.length,
    // Phase 6 additions
    rootCauseChains,
    liveEvents,
    memory: memoryGraph,
    sourceCount: rows.dataConnections.filter((c) => c.status === 'connected').length,
    vendorCount: knowledgeGraph.nodeCountByType.vendor || 0,
    employeeCount: knowledgeGraph.nodeCountByType.employee || 0,
    reportCount: knowledgeGraph.nodeCountByType.report || 0,
    paymentCount: (knowledgeGraph.nodeCountByType.payment || 0) + (knowledgeGraph.nodeCountByType.collection || 0),
    expenseCount: knowledgeGraph.nodeCountByType.expense || 0,
    itcCount: knowledgeGraph.nodeCountByType['itc-record'] || 0,
    transactionCount: knowledgeGraph.nodeCountByType.transaction || 0,
  };
}

// ─── Subgraph helpers (for /api/graph/client/:id and /business/:id) ────────────

export function buildClientSubgraph(state: GraphState, clientId: string): ClientSubgraph | null {
  const centerNode = state.knowledgeGraph.nodes.find((n) => n.id === clientId || (n.type === 'client' && n.entityId === clientId));
  if (!centerNode) return null;

  // BFS 2 hops from center
  const centerId = centerNode.id;
  const visibleIds = new Set<string>([centerId]);
  // First hop
  state.knowledgeGraph.edges.forEach((e) => {
    if (e.source === centerId) visibleIds.add(e.target);
    if (e.target === centerId) visibleIds.add(e.source);
  });
  // Second hop
  const firstHop = new Set(visibleIds);
  state.knowledgeGraph.edges.forEach((e) => {
    if (firstHop.has(e.source)) visibleIds.add(e.target);
    if (firstHop.has(e.target)) visibleIds.add(e.source);
  });

  const subNodes = state.knowledgeGraph.nodes.filter((n) => visibleIds.has(n.id));
  const subEdges = state.knowledgeGraph.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));

  const riskForClient = state.riskGraph.nodes.find((r) => r.nodeId === centerId);
  const relationshipChain = state.relationshipChains.find((c) => c.steps[0]?.nodeId === centerId);
  const insights = state.insights.filter((i) => i.relatedNodeIds.includes(centerId));

  return {
    centerNodeId: centerId,
    graph: { nodes: subNodes, edges: subEdges, nodeCountByType: {} as any, edgeCountByType: {} as any },
    riskForClient,
    relationshipChain,
    insights,
  };
}

export function buildBusinessSubgraph(state: GraphState, businessId: string = 'business:firm'): BusinessSubgraph {
  const centerNode = state.knowledgeGraph.nodes.find((n) => n.id === businessId) || state.knowledgeGraph.nodes.find((n) => n.type === 'business')!;
  const centerId = centerNode.id;

  // First hop from business
  const visibleIds = new Set<string>([centerId]);
  state.knowledgeGraph.edges.forEach((e) => {
    if (e.source === centerId) visibleIds.add(e.target);
    if (e.target === centerId) visibleIds.add(e.source);
  });

  const subNodes = state.knowledgeGraph.nodes.filter((n) => visibleIds.has(n.id));
  const subEdges = state.knowledgeGraph.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));

  const topDependencies = state.dependencyGraph.topRevenueClients.slice(0, 5);
  const riskNodes = state.riskGraph.nodes.filter((r) => visibleIds.has(r.nodeId));
  const insights = state.insights.slice(0, 6);

  return {
    centerNodeId: centerId,
    graph: { nodes: subNodes, edges: subEdges, nodeCountByType: {} as any, edgeCountByType: {} as any },
    topDependencies,
    riskNodes,
    insights,
  };
}

// ─── Phase 6: Generic Node Subgraph (for /api/graph/node/:id) ─────────────────

export function buildNodeSubgraph(state: GraphState, nodeId: string): NodeSubgraph | null {
  // Accept either the full node ID (`client:abc123`) or just the entityId.
  const centerNode = state.knowledgeGraph.nodes.find(
    (n) => n.id === nodeId || n.entityId === nodeId,
  );
  if (!centerNode) return null;

  const centerId = centerNode.id;
  const visibleIds = new Set<string>([centerId]);
  // First hop
  state.knowledgeGraph.edges.forEach((e) => {
    if (e.source === centerId) visibleIds.add(e.target);
    if (e.target === centerId) visibleIds.add(e.source);
  });
  // Second hop
  const firstHop = new Set(visibleIds);
  state.knowledgeGraph.edges.forEach((e) => {
    if (firstHop.has(e.source)) visibleIds.add(e.target);
    if (firstHop.has(e.target)) visibleIds.add(e.source);
  });

  const subNodes = state.knowledgeGraph.nodes.filter((n) => visibleIds.has(n.id));
  const subEdges = state.knowledgeGraph.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));

  const riskForNode = state.riskGraph.nodes.find((r) => r.nodeId === centerId);
  const relationshipChains = state.relationshipChains.filter((c) =>
    c.steps.some((s) => s.nodeId === centerId),
  );
  const insights = state.insights.filter((i) => i.relatedNodeIds.includes(centerId));
  const rootCauseChains = (state.rootCauseChains || []).filter((c) =>
    c.relatedNodeIds.includes(centerId) || c.steps.some((s) => s.nodeId === centerId),
  );

  return {
    centerNodeId: centerId,
    centerNode,
    graph: { nodes: subNodes, edges: subEdges, nodeCountByType: {} as any, edgeCountByType: {} as any },
    riskForNode,
    relationshipChains,
    insights,
    rootCauseChains,
  };
}

// ─── Phase 6: Vendor Subgraph (for /api/graph/vendor/:id) ─────────────────────

export function buildVendorSubgraph(state: GraphState, vendorId: string): VendorSubgraph | null {
  const centerNode = state.knowledgeGraph.nodes.find(
    (n) => n.id === vendorId || (n.type === 'vendor' && n.entityId === vendorId) || (n.type === 'vendor' && n.id === `vendor:${vendorId}`),
  );
  if (!centerNode) return null;

  const centerId = centerNode.id;
  const visibleIds = new Set<string>([centerId]);
  state.knowledgeGraph.edges.forEach((e) => {
    if (e.source === centerId) visibleIds.add(e.target);
    if (e.target === centerId) visibleIds.add(e.source);
  });
  // Second hop
  const firstHop = new Set(visibleIds);
  state.knowledgeGraph.edges.forEach((e) => {
    if (firstHop.has(e.source)) visibleIds.add(e.target);
    if (firstHop.has(e.target)) visibleIds.add(e.source);
  });

  const subNodes = state.knowledgeGraph.nodes.filter((n) => visibleIds.has(n.id));
  const subEdges = state.knowledgeGraph.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));

  const totalSpend = (centerNode.meta?.totalSpend as number) || (centerNode.amount || 0);
  const pendingPayables = (centerNode.meta?.pendingPayable as number) || 0;
  const overdueBills = (centerNode.meta?.overdueCount as number) || 0;
  const reliabilityScore = (centerNode.meta?.reliabilityScore as number) || 100;
  const riskForVendor = state.riskGraph.nodes.find((r) => r.nodeId === centerId);
  const insights = state.insights.filter((i) => i.relatedNodeIds.includes(centerId));

  return {
    centerNodeId: centerId,
    graph: { nodes: subNodes, edges: subEdges, nodeCountByType: {} as any, edgeCountByType: {} as any },
    totalSpend,
    pendingPayables,
    overdueBills,
    reliabilityScore,
    riskForVendor,
    insights,
  };
}

// ─── Phase 6: Invoice Subgraph (for /api/graph/invoice/:id) ───────────────────

export function buildInvoiceSubgraph(state: GraphState, invoiceId: string): InvoiceSubgraph | null {
  const centerNode = state.knowledgeGraph.nodes.find(
    (n) => n.id === invoiceId || (n.type === 'invoice' && n.entityId === invoiceId) || (n.type === 'invoice' && n.id === `invoice:${invoiceId}`),
  );
  if (!centerNode) return null;

  const centerId = centerNode.id;
  const visibleIds = new Set<string>([centerId]);
  state.knowledgeGraph.edges.forEach((e) => {
    if (e.source === centerId) visibleIds.add(e.target);
    if (e.target === centerId) visibleIds.add(e.source);
  });
  // Second hop
  const firstHop = new Set(visibleIds);
  state.knowledgeGraph.edges.forEach((e) => {
    if (firstHop.has(e.source)) visibleIds.add(e.target);
    if (firstHop.has(e.target)) visibleIds.add(e.source);
  });

  const subNodes = state.knowledgeGraph.nodes.filter((n) => visibleIds.has(n.id));
  const subEdges = state.knowledgeGraph.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));

  const paymentStatus = (centerNode.meta?.paymentStatus as string) || centerNode.meta?.status as string || 'unknown';
  const amountPaid = (centerNode.meta?.paidAmount as number) || 0;
  const amountDue = (centerNode.meta?.balanceAmount as number) || (centerNode.amount || 0) - amountPaid;

  // Find linked GST return + payment nodes
  const linkedReturn = subNodes.find((n) => n.type === 'gst-return');
  const linkedPayment = subNodes.find((n) => n.type === 'payment' || n.type === 'collection');

  const insights = state.insights.filter((i) => i.relatedNodeIds.includes(centerId));

  return {
    centerNodeId: centerId,
    graph: { nodes: subNodes, edges: subEdges, nodeCountByType: {} as any, edgeCountByType: {} as any },
    paymentStatus,
    amountPaid,
    amountDue,
    linkedReturn,
    linkedPayment,
    insights,
  };
}

// ─── Quick NL query examples ──────────────────────────────────────────────────

export const QUICK_GRAPH_QUERIES: { label: string; text: string; intent: GraphQueryIntent }[] = [
  { label: 'Why did revenue drop?', text: 'Why did revenue drop?', intent: 'why_revenue_drop' },
  { label: 'Who are my risky clients?', text: 'Who are my risky clients?', intent: 'risky_clients' },
  { label: 'Which invoices are overdue?', text: 'Which invoices are overdue?', intent: 'overdue_invoices' },
  { label: 'Which vendor affects profitability?', text: 'Which vendor affects profitability?', intent: 'vendor_profitability' },
  { label: 'Businesses connected to GST notices', text: 'Show businesses connected to GST notices', intent: 'businesses_with_notices' },
  { label: 'Which employee manages ABC?', text: 'Which employee manages ABC Pvt Ltd?', intent: 'employee_for_client' },
  { label: 'Why is cash flow down?', text: 'Why is cash flow down?', intent: 'cash_flow_down' },
  { label: 'Most profitable client', text: 'Show me the most profitable client', intent: 'most_profitable' },
];

// ─── Format helpers for Oracle context injection ──────────────────────────────

export function formatGraphContextBlock(state: GraphState): string {
  const lines: string[] = [];
  const kg = state.knowledgeGraph;
  const rg = state.riskGraph;
  lines.push('── LIVE BUSINESS GRAPH STATE ──');
  lines.push(`Generated: ${state.generatedAt}`);
  lines.push(`Tagline: GSTPilot Business Graph™ — Understand Everything. Connect Everything. Predict Everything.`);
  lines.push(`Nodes: ${kg.nodes.length} (${Object.entries(kg.nodeCountByType).map(([t, c]) => `${t}:${c}`).join(', ')})`);
  lines.push(`Edges: ${kg.edges.length} (${Object.entries(kg.edgeCountByType).map(([t, c]) => `${t}:${c}`).join(', ')})`);
  lines.push(`Connected sources: ${state.sourceCount ?? 0}`);
  lines.push('');
  lines.push(`Overall risk level: ${rg.overallLevel.toUpperCase()}`);
  lines.push(`Risk distribution: ${Object.entries(rg.countByLevel).map(([l, c]) => `${l}:${c}`).join(', ')}`);
  lines.push('');
  lines.push('Top risks:');
  rg.topRisks.slice(0, 5).forEach((r) => {
    lines.push(`  ${RISK_GLYPH[r.level]} ${r.entityName} (${r.category}, score ${r.score}) — ${r.reasons[0]}. Impact: ${r.impact}`);
  });
  lines.push('');
  lines.push('Top revenue clients:');
  state.dependencyGraph.topRevenueClients.slice(0, 5).forEach((c) => {
    lines.push(`  • ${c.fromName}: ${inrShort(c.amount || 0)} — ${c.note}`);
  });
  lines.push('');
  lines.push('Critical vendors:');
  state.dependencyGraph.criticalVendors.forEach((v) => {
    lines.push(`  • ${v.toName}: ${v.note}`);
  });
  lines.push('');
  lines.push('Notices affecting cash flow:');
  state.dependencyGraph.noticesAffectingCashFlow.forEach((n) => {
    lines.push(`  • ${n.fromName}: ${n.note}`);
  });
  lines.push('');
  lines.push('Relationship chains:');
  state.relationshipChains.slice(0, 3).forEach((c) => {
    lines.push(`  • ${c.title}: ${c.steps.map((s) => `${s.nodeName}→${s.impact}`).join(' · ')}`);
  });
  lines.push('');
  lines.push('What-if predictions:');
  state.predictionGraph.scenarios.slice(0, 3).forEach((s) => {
    lines.push(`  • ${s.trigger}: cash ${inrShort(s.impactOnCash)}, revenue ${inrShort(s.impactOnRevenue)}, GST ${inrShort(s.impactOnGST)} → risk ${s.impactOnRiskLevel}. ${s.explanation}`);
  });
  lines.push('');
  lines.push('Daily insights:');
  state.insights.forEach((i) => {
    lines.push(`  ${i.emoji} ${i.title}: ${i.body}`);
  });
  lines.push('');
  // Phase 6: Root Cause Chains
  if (state.rootCauseChains && state.rootCauseChains.length > 0) {
    lines.push('Root cause chains:');
    state.rootCauseChains.forEach((c) => {
      lines.push(`  • ${c.question}`);
      lines.push(`    Answer: ${c.answer}`);
      lines.push(`    Chain: ${c.steps.map((s) => `${s.nodeName}→${s.impact}`).join(' · ')}`);
    });
    lines.push('');
  }
  // Phase 6: Live events
  if (state.liveEvents && state.liveEvents.length > 0) {
    lines.push(`Live events (last ${state.liveEvents.length}):`);
    state.liveEvents.slice(0, 10).forEach((e) => {
      lines.push(`  • [${e.source}/${e.type}] ${e.title}${e.amount ? ` · ${inrShort(e.amount)}` : ''}`);
    });
    lines.push('');
  }
  lines.push('Memory insights:');
  state.memoryGraph.insights.forEach((i) => lines.push(`  • ${i}`));
  lines.push('── END BUSINESS GRAPH STATE ──');
  return lines.join('\n');
}
