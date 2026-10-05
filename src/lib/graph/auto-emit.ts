// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT BUSINESS GRAPH™ — Auto-Create Emitter (PT-2-b)
//
// Every Client, Invoice, GSTRFiling, Payment (Collection), Notice, Employee,
// AITask (Task) and DataConnection (Bank/GSTN) MUST become a node in the
// Business Graph the moment it is created. This module is the canonical
// entry point called by every entity POST create route — it verifies the
// entity exists in the DB, then pushes a LiveGraphEvent + invalidates the
// graph cache so the next /api/graph read reflects the new node + edges.
//
// Architecture: the Business Graph is computed live from real DB rows by
// /lib/graph/engine.ts (buildKnowledgeGraph). There is no separate GraphNode
// Prisma model — nodes are derived. So "emitting a graph node" means:
//   1. Verify the entity exists in Prisma (defensive — caller just created it)
//   2. Push a LiveGraphEvent into the in-memory log (which also invalidates
//      the 60s cache so the next read re-derives the graph with the new row)
//   3. The relatedNodeIds list encodes the edges the engine will draw
//      (Client↔Invoice, Client↔GSTRFiling, Client↔Collection, Client↔Notice,
//       Firm↔Employee, Employee↔Task, Bank↔Collection, etc.)
//
// Safety: every function is wrapped in try/catch — a graph-emit failure
// MUST NEVER break the parent entity create. Logs to console.error only.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { notifyGraphEvent } from '@/lib/graph/live-update';

const inrShort = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const swallow = (label: string, e: unknown) =>
  console.error(`[graph] ${label} failed`, e);

// ─── Client ───────────────────────────────────────────────────────────────────

export async function emitClientNode(clientId: string): Promise<void> {
  try {
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: {
        id: true, tradeName: true, gstin: true, status: true,
        healthScore: true, entityType: true,
      },
    });
    if (!client) return;
    notifyGraphEvent({
      source: 'clients',
      type: 'client_created',
      title: `Client added: ${client.tradeName}`,
      description: `GSTIN ${client.gstin} · ${client.entityType} · status ${client.status}`,
      nodeId: `client:${client.id}`,
      relatedNodeIds: ['business:firm'],
    });
  } catch (e) { swallow('emitClientNode', e); }
}

// ─── Invoice ──────────────────────────────────────────────────────────────────
// Edges encoded: business → invoice (GENERATES), client → invoice (RECEIVES)

export async function emitInvoiceNode(invoiceId: string): Promise<void> {
  try {
    const inv = await db.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true, invoiceNumber: true, totalAmount: true,
        clientId: true, buyerGstin: true, status: true, period: true,
      },
    });
    if (!inv) return;
    const related: string[] = ['business:firm'];
    if (inv.clientId) related.push(`client:${inv.clientId}`);
    notifyGraphEvent({
      source: 'invoices',
      type: 'invoice_created',
      title: `Invoice ${inv.invoiceNumber} created`,
      description: `${inrShort(inv.totalAmount)} · ${inv.status}${inv.period ? ` · ${inv.period}` : ''}`,
      nodeId: `invoice:${inv.id}`,
      relatedNodeIds: related,
      amount: inv.totalAmount,
    });
  } catch (e) { swallow('emitInvoiceNode', e); }
}

// ─── GSTRFiling (GST Return) ─────────────────────────────────────────────────
// Edges encoded: client → gst-return (FILES), gst-return → business (GENERATES_LIABILITY)

export async function emitGstReturnNode(filingId: string): Promise<void> {
  try {
    const f = await db.gSTRFiling.findUnique({
      where: { id: filingId },
      select: {
        id: true, returnType: true, period: true, status: true,
        totalTax: true, clientId: true, financialYear: true,
      },
    });
    if (!f) return;
    notifyGraphEvent({
      source: 'returns',
      type: 'gst_return_created',
      title: `${f.returnType} return created for ${f.period}`,
      description: `Output tax ${inrShort(f.totalTax)} · ${f.status}${f.financialYear ? ` · FY ${f.financialYear}` : ''}`,
      nodeId: `gst-return:${f.id}`,
      relatedNodeIds: ['business:firm', `client:${f.clientId}`],
      amount: f.totalTax,
    });
  } catch (e) { swallow('emitGstReturnNode', e); }
}

// ─── Collection (Payment with partyType=customer) or vendor Payment ──────────
// Edges encoded: collection → invoice (CLEARS), collection → bank (RECORDED_IN),
//                client → collection (PAYS — direct, PT-2-b addition)

export async function emitCollectionNode(paymentId: string): Promise<void> {
  try {
    const p = await db.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true, partyName: true, partyType: true, amount: true,
        paymentMode: true, clientId: true, invoiceId: true,
        purchaseBillId: true, status: true,
      },
    });
    if (!p) return;
    const isCollection = p.partyType !== 'vendor';
    const nodeId = isCollection ? `collection:${p.id}` : `payment:${p.id}`;
    const related: string[] = ['business:firm', 'bank-account:primary'];
    if (p.clientId) related.push(`client:${p.clientId}`);
    if (p.invoiceId) related.push(`invoice:${p.invoiceId}`);
    if (p.purchaseBillId) related.push(`invoice:${p.purchaseBillId}`);
    notifyGraphEvent({
      source: 'payments',
      type: isCollection ? 'payment_received' : 'payment_made',
      title: isCollection
        ? `Payment received from ${p.partyName}`
        : `Payment made to ${p.partyName}`,
      description: `${inrShort(p.amount)} · ${p.paymentMode} · ${p.status}`,
      nodeId,
      relatedNodeIds: related,
      amount: p.amount,
    });
  } catch (e) { swallow('emitCollectionNode', e); }
}

// ─── Notice ───────────────────────────────────────────────────────────────────
// Edges encoded: client → notice (RESPONDS_TO), notice → business (AFFECTS)

export async function emitNoticeNode(noticeId: string): Promise<void> {
  try {
    const n = await db.notice.findUnique({
      where: { id: noticeId },
      select: {
        id: true, noticeType: true, status: true, subject: true,
        clientId: true, dueDate: true, priority: true,
      },
    });
    if (!n) return;
    notifyGraphEvent({
      source: 'gstn',
      type: 'gst_notice_received',
      title: `GST notice received: ${n.noticeType}`,
      description: `${n.subject} · ${n.priority} · due ${n.dueDate ?? 'n/a'}`,
      nodeId: `notice:${n.id}`,
      relatedNodeIds: ['business:firm', `client:${n.clientId}`],
    });
  } catch (e) { swallow('emitNoticeNode', e); }
}

// ─── Employee ─────────────────────────────────────────────────────────────────
// Edges encoded: business → employee (OWNS), employee → client (MANAGES when clientId set)

export async function emitEmployeeNode(employeeId: string): Promise<void> {
  try {
    const emp = await db.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true, name: true, designation: true, department: true,
        status: true, clientId: true,
      },
    });
    if (!emp) return;
    const related: string[] = ['business:firm'];
    if (emp.clientId) related.push(`client:${emp.clientId}`);
    notifyGraphEvent({
      source: 'employees',
      type: 'employee_added',
      title: `Employee added: ${emp.name}`,
      description: `${emp.designation ?? 'Employee'}${emp.department ? ` · ${emp.department}` : ''} · ${emp.status}`,
      nodeId: `employee:${emp.id}`,
      relatedNodeIds: related,
    });
  } catch (e) { swallow('emitEmployeeNode', e); }
}

// ─── AITask (Task) ────────────────────────────────────────────────────────────
// Edges encoded: business → task (CREATED_BY), employee → task (ASSIGNED_TO),
//                client → task (AFFECTS)

export async function emitTaskNode(taskId: string): Promise<void> {
  try {
    const t = await db.aITask.findUnique({
      where: { id: taskId },
      select: {
        id: true, title: true, sourceType: true, priority: true,
        status: true, assignedTo: true, clientId: true, dueDate: true,
      },
    });
    if (!t) return;
    const related: string[] = ['business:firm'];
    if (t.assignedTo) related.push(`employee:${t.assignedTo}`);
    if (t.clientId) related.push(`client:${t.clientId}`);
    notifyGraphEvent({
      source: 'system',
      type: 'task_completed',
      title: `Task created: ${t.title}`,
      description: `${t.sourceType} · ${t.priority} · ${t.status}${t.dueDate ? ` · due ${t.dueDate}` : ''}`,
      nodeId: `task:${t.id}`,
      relatedNodeIds: related,
    });
  } catch (e) { swallow('emitTaskNode', e); }
}

// ─── Bank Account (DataConnection type=bank) ─────────────────────────────────
// Edges encoded: business → bank-account (OWNS), bank-account ← collection (RECORDED_IN)

export async function emitBankNode(connectionId: string): Promise<void> {
  try {
    const c = await db.dataConnection.findUnique({
      where: { id: connectionId },
      select: { id: true, type: true, status: true, label: true, identifier: true, lastSyncAt: true },
    });
    if (!c || c.type !== 'bank') return;
    notifyGraphEvent({
      source: 'bank',
      type: 'bank_synced',
      title: `Bank connected: ${c.label}`,
      description: `Status ${c.status}${c.identifier ? ` · ${c.identifier}` : ''}`,
      nodeId: `bank-account:${c.id}`,
      relatedNodeIds: ['business:firm'],
    });
  } catch (e) { swallow('emitBankNode', e); }
}

// ─── GSTN Connection (DataConnection type=gstn) ──────────────────────────────
// Edges encoded: business → gstn (CONNECTED_TO)

export async function emitGstnNode(connectionId: string): Promise<void> {
  try {
    const c = await db.dataConnection.findUnique({
      where: { id: connectionId },
      select: { id: true, type: true, status: true, label: true, identifier: true, lastSyncAt: true },
    });
    if (!c || c.type !== 'gstn') return;
    notifyGraphEvent({
      source: 'gstn',
      type: 'connector_synced',
      title: `GSTN connected: ${c.label}`,
      description: `Status ${c.status}${c.identifier ? ` · ${c.identifier}` : ''}`,
      nodeId: `gstn:${c.id}`,
      relatedNodeIds: ['business:firm'],
    });
  } catch (e) { swallow('emitGstnNode', e); }
}

// ─── Backfill: emit nodes for every existing entity ──────────────────────────
// Called by POST /api/graph/backfill. Scans the full DB and pushes one live
// event per entity type (batched) + invalidates the cache. Useful for existing
// seeded data that predates the auto-emit wiring.

export interface BackfillResult {
  clients: number;
  invoices: number;
  filings: number;
  payments: number;
  notices: number;
  employees: number;
  tasks: number;
  banks: number;
  gstns: number;
  totalEmitted: number;
}

export async function backfillAllGraphNodes(): Promise<BackfillResult> {
  const result: BackfillResult = {
    clients: 0, invoices: 0, filings: 0, payments: 0, notices: 0,
    employees: 0, tasks: 0, banks: 0, gstns: 0, totalEmitted: 0,
  };

  try {
    const [clients, invoices, filings, payments, notices, employees, tasks, dcs] = await Promise.all([
      db.client.findMany({ select: { id: true }, take: 5000 }),
      db.invoice.findMany({ select: { id: true }, take: 10000 }),
      db.gSTRFiling.findMany({ select: { id: true }, take: 5000 }),
      db.payment.findMany({ select: { id: true }, take: 10000 }),
      db.notice.findMany({ select: { id: true }, take: 2000 }),
      db.employee.findMany({ select: { id: true }, take: 500 }),
      db.aITask.findMany({ select: { id: true }, take: 500 }),
      db.dataConnection.findMany({ select: { id: true, type: true }, take: 100 }),
    ]);

    // Emit per-entity (best-effort, parallel batches of 25 to avoid DB hammer)
    const batch = async <T,>(items: T[], fn: (item: T) => Promise<void>): Promise<number> => {
      let count = 0;
      for (let i = 0; i < items.length; i += 25) {
        const slice = items.slice(i, i + 25);
        await Promise.all(slice.map(async (it) => {
          await fn(it);
          count += 1;
        }));
      }
      return count;
    };

    result.clients = await batch(clients, (c) => emitClientNode(c.id));
    result.invoices = await batch(invoices, (inv) => emitInvoiceNode(inv.id));
    result.filings = await batch(filings, (f) => emitGstReturnNode(f.id));
    result.payments = await batch(payments, (p) => emitCollectionNode(p.id));
    result.notices = await batch(notices, (n) => emitNoticeNode(n.id));
    result.employees = await batch(employees, (e) => emitEmployeeNode(e.id));
    result.tasks = await batch(tasks, (t) => emitTaskNode(t.id));
    result.banks = await batch(
      dcs.filter((d) => d.type === 'bank'),
      (d) => emitBankNode(d.id),
    );
    result.gstns = await batch(
      dcs.filter((d) => d.type === 'gstn'),
      (d) => emitGstnNode(d.id),
    );

    result.totalEmitted =
      result.clients + result.invoices + result.filings + result.payments +
      result.notices + result.employees + result.tasks + result.banks + result.gstns;
  } catch (e) {
    swallow('backfillAllGraphNodes', e);
  }

  return result;
}
