// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Business Graph Engine
//
// Builds a compact relational graph of the firm's business universe:
//   • The firm itself (trade name / GSTIN)
//   • Risky clients → firm (relation: "owes")
//   • The firm's bank → firm (relation: "operates")
//   • Cash flow ← bank (relation: "feeds")
//   • Overdue returns → firm (relation: "must file")
//   • Active notices / risks → firm (relation: "faces")
//
// Two responsibilities:
//   1. buildBusinessGraph()        — assemble { nodes, edges, summary } from live
//      data + targeted DB reads. Used by visualization UIs.
//   2. renderGraphBlock(graph)     — render a markdown block that gets injected
//      into Oracle's system prompt so the chatbot can answer relational queries
//      ("which client affects cash flow?", "which invoices are unpaid?") with
//      real, current edges instead of guessing.
//
// Every DB call is wrapped in try/catch — graph construction never throws.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { loadOracleLiveData } from '@/lib/connections';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BusinessGraphNodeType =
  | 'firm'
  | 'client'
  | 'invoice'
  | 'return'
  | 'payment'
  | 'bank'
  | 'cashflow'
  | 'risk';

export interface BusinessGraphNode {
  id: string;
  type: BusinessGraphNodeType;
  label: string;
  meta?: string;
}

export interface BusinessGraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface BusinessGraph {
  nodes: BusinessGraphNode[];
  edges: BusinessGraphEdge[];
  summary: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Indian-style number formatting for ₹ amounts. */
function inr(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '0';
  return Math.round(amount).toLocaleString('en-IN');
}

// ─── Main entry: buildBusinessGraph ───────────────────────────────────────────

export async function buildBusinessGraph(): Promise<BusinessGraph> {
  const nodes: BusinessGraphNode[] = [];
  const edges: BusinessGraphEdge[] = [];

  // Load live data (never throws upstream).
  let liveData;
  try {
    liveData = await loadOracleLiveData();
  } catch {
    liveData = null;
  }

  // ── Firm node ──
  const tradeName = liveData?.tradeName ?? 'Your Business';
  const gstin = liveData?.gstin;
  const firmId = 'firm';
  nodes.push({
    id: firmId,
    type: 'firm',
    label: tradeName,
    meta: gstin ? `GSTIN ${gstin}` : undefined,
  });

  // ── Risky clients → firm ("owes") ──
  const riskyClients = liveData?.riskyClients ?? [];
  for (const r of riskyClients) {
    const nodeId = `client:${r.name}`;
    nodes.push({
      id: nodeId,
      type: 'client',
      label: r.name,
      meta: `₹${inr(r.amount)} at risk`,
    });
    edges.push({ from: nodeId, to: firmId, relation: 'owes' });
  }

  // ── Bank node + firm → bank ("operates") ──
  if (liveData?.hasBank && liveData.bank) {
    const provider = liveData.bank.provider ?? 'Bank';
    const bankId = 'bank:primary';
    nodes.push({
      id: bankId,
      type: 'bank',
      label: provider,
      meta: `₹${inr(liveData.bank.cashAvailable)} available`,
    });
    edges.push({ from: firmId, to: bankId, relation: 'operates' });

    // ── Cashflow node + bank → cashflow ("feeds") ──
    const cashflowId = 'cashflow:primary';
    const collections = liveData.bank.monthlyCollections ?? 0;
    const expenses = liveData.bank.monthlyExpenses ?? 0;
    nodes.push({
      id: cashflowId,
      type: 'cashflow',
      label: 'Cash Flow',
      meta: `Collections ₹${inr(collections)} · Expenses ₹${inr(expenses)}`,
    });
    edges.push({ from: bankId, to: cashflowId, relation: 'feeds' });
  }

  // ── Overdue returns → firm ("must file") ──
  try {
    const overdue = await db.gSTRFiling.findMany({
      where: { status: 'overdue' },
      take: 5,
      orderBy: { period: 'desc' },
    });
    for (const r of overdue) {
      const nodeId = `return:${r.id}`;
      nodes.push({
        id: nodeId,
        type: 'return',
        label: `${r.returnType} ${r.period}`,
        meta: 'overdue',
      });
      edges.push({ from: firmId, to: nodeId, relation: 'must file' });
    }
  } catch {
    /* skip returns */
  }

  // ── Active notices → firm ("faces") ──
  let activeNoticeCount = 0;
  try {
    const notices = await db.notice.findMany({
      where: { status: 'open' },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });
    activeNoticeCount = notices.length;
    for (const n of notices) {
      const nodeId = `risk:notice:${n.id}`;
      nodes.push({
        id: nodeId,
        type: 'risk',
        label: n.subject,
        meta: n.noticeType,
      });
      edges.push({ from: firmId, to: nodeId, relation: 'faces' });
    }
  } catch {
    /* skip notices */
  }

  // ── Summary line ──
  const clientCount = riskyClients.length;
  let overdueCount = 0;
  try {
    overdueCount = liveData?.compliance?.overdueReturns ?? 0;
  } catch {
    /* keep 0 */
  }
  const cash = liveData?.bank?.cashAvailable ?? 0;
  const summary =
    `Your business graph: 1 firm${clientCount > 0 ? `, ${clientCount} client${clientCount > 1 ? 's' : ''} at risk` : ''}` +
    `${overdueCount > 0 ? `, ${overdueCount} overdue return${overdueCount > 1 ? 's' : ''}` : ''}` +
    `${activeNoticeCount > 0 ? `, ${activeNoticeCount} active risk${activeNoticeCount > 1 ? 's' : ''}` : ''}` +
    `${cash > 0 ? `, ₹${inr(cash)} cash` : ''}.`;

  return { nodes, edges, summary };
}

// ─── Renderer: graph → Oracle system-prompt block ─────────────────────────────

export function renderGraphBlock(graph: BusinessGraph): string {
  // Empty graph (only the firm node, nothing else) → render nothing.
  if (graph.nodes.length <= 1) return '';

  const firm = graph.nodes.find((n) => n.type === 'firm');
  if (!firm) return '';

  const riskyClientNodes = graph.nodes.filter((n) => n.type === 'client');
  const returnNodes = graph.nodes.filter((n) => n.type === 'return');
  const riskNodes = graph.nodes.filter((n) => n.type === 'risk');
  const bankNode = graph.nodes.find((n) => n.type === 'bank');
  const cashflowNode = graph.nodes.find((n) => n.type === 'cashflow');

  const lines: string[] = [];
  lines.push('## BUSINESS GRAPH (relational context)');

  // Firm
  lines.push(`- Firm: ${firm.label}${firm.meta ? ` (${firm.meta})` : ''}`);

  // Risky clients
  if (riskyClientNodes.length > 0) {
    const names = riskyClientNodes.map((n) => n.label).join(', ');
    lines.push(
      `- Clients at risk: ${names} — these clients affect cash flow via delayed collections.`,
    );
  }

  // Overdue returns
  if (returnNodes.length > 0) {
    const list = returnNodes.map((n) => n.label).join(', ');
    lines.push(`- Overdue returns: ${list} — unpaid/blocking ITC.`);
  }

  // Bank + cash flow
  if (bankNode) {
    const cash = cashflowNode?.meta ?? '';
    lines.push(
      `- Bank: ${bankNode.label}${bankNode.meta ? ` — ${bankNode.meta}` : ''}${cash ? `; feeds cash flow (${cash})` : '.'}`,
    );
  }

  // Active risks (notices)
  if (riskNodes.length > 0) {
    const list = riskNodes.map((n) => `${n.label} [${n.meta ?? 'risk'}]`).join('; ');
    lines.push(`- Active risks: ${list}.`);
  }

  lines.push(
    'When asked "which client affects cash flow" or "which invoices are unpaid", use these relationships.',
  );

  return lines.join('\n');
}
