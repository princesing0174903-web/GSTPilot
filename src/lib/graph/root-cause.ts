// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT BUSINESS GRAPH™ — Root Cause Engine™
// Phase 6 LIVE — answers the 6 canonical "why did X happen?" questions by
// tracing the FULL dependency chain through the Business Graph.
//
// Each chain shows the complete path: symptom → intermediate hops → root cause,
// with ₹ impact and evidence at every step. Oracle consumes these chains to
// explain business events with full transparency.
//
// The 6 canonical questions (matching the user's mission spec):
//   1. Why did revenue drop?
//   2. Why is cash flow low?
//   3. Which vendor caused delay?
//   4. Which client affects profit?
//   5. Which GST return created liability?
//   6. Which employee manages this client?
//
// This module is pure (no I/O) — it consumes a pre-built GraphState + the raw
// rows fetched by the engine and produces RootCauseChain[].
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  GraphState,
  RootCauseChain,
  RootCauseStep,
  NodeType,
  RelationshipType,
} from '@/lib/graph/types';

const uid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const inrShort = (n: number) => {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
};

// ─── Raw rows interface (mirrors engine.ts RawRows + extensions) ──────────────

export interface RootCauseRows {
  clients: Array<{ id: string; gstin: string; tradeName: string; status: string; healthScore: number }>;
  invoices: Array<{
    id: string; invoiceNumber: string; invoiceDate: string; totalAmount: number;
    taxableValue: number; cgst: number; sgst: number; igst: number;
    status: string; period: string | null; buyerGstin: string | null; buyerName: string | null;
    dueDate: string | null; paymentStatus: string; paidAmount: number; balanceAmount: number;
  }>;
  filings: Array<{ id: string; returnType: string; period: string; status: string; clientId: string; totalTax: number }>;
  notices: Array<{ id: string; noticeType: string; status: string; noticeDate: string | null; dueDate: string | null; clientId: string }>;
  purchaseBills: Array<{
    id: string; vendorName: string; vendorGstin: string | null; invoiceNo: string;
    invoiceDate: string; dueDate: string | null; totalAmount: number; paidAmount: number;
    balanceAmount: number; status: string; paymentStatus: string; gstAmount: number;
  }>;
  expenses: Array<{ id: string; vendor: string | null; amount: number; category: string; date: string; status: string }>;
  payments: Array<{
    id: string; partyName: string; partyType: string; amount: number; paymentDate: string;
    status: string; invoiceId: string | null; purchaseBillId: string | null;
  }>;
  employees: Array<{ id: string; name: string; designation: string | null; department: string | null }>;
  reports: Array<{ id: string; reportType: string; title: string; period: string; status: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOverdueInvoice(inv: RootCauseRows['invoices'][number]): boolean {
  if (inv.paymentStatus === 'overdue' || inv.paymentStatus === 'unpaid') {
    if (inv.paymentStatus === 'overdue') return true;
  }
  if (inv.dueDate && inv.balanceAmount > 0) {
    const due = new Date(inv.dueDate);
    if (!isNaN(due.getTime()) && due.getTime() < Date.now()) return true;
  }
  return false;
}

function isOverdueBill(bill: RootCauseRows['purchaseBills'][number]): boolean {
  if (bill.paymentStatus === 'overdue') return true;
  if (bill.dueDate && bill.balanceAmount > 0) {
    const due = new Date(bill.dueDate);
    if (!isNaN(due.getTime()) && due.getTime() < Date.now()) return true;
  }
  return false;
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

function isOverdueFiling(filing: RootCauseRows['filings'][number]): boolean {
  if (filing.status === 'filed') return false;
  const due = filingDueDate(filing.returnType, filing.period);
  if (!due) return false;
  return due.getTime() < Date.now();
}

// ─── Builder: Why did revenue drop? ───────────────────────────────────────────
//
// Strategy: Compare this month's invoice totals vs last month. If drop > 10%,
// identify the contributing factors:
//   (a) Fewer invoices issued this month
//   (b) Lower average invoice value
//   (c) Specific top clients with reduced billing
//   (d) Overdue invoices not yet collected (revenue stuck)

function buildWhyRevenueDrop(rows: RootCauseRows, state: GraphState): RootCauseChain | null {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const thisMonthInvoices = rows.invoices.filter((i) => (i.period || '').startsWith(thisMonth));
  const lastMonthInvoices = rows.invoices.filter((i) => (i.period || '').startsWith(lastMonth));

  const thisTotal = thisMonthInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const lastTotal = lastMonthInvoices.reduce((s, i) => s + i.totalAmount, 0);

  // If no comparison possible, return null
  if (lastTotal === 0 && thisTotal === 0) return null;
  // If revenue went UP, no chain needed
  if (thisTotal >= lastTotal) return null;

  const dropPct = lastTotal > 0 ? ((lastTotal - thisTotal) / lastTotal) * 100 : 0;
  if (dropPct < 5) return null; // ignore <5% noise

  const dropAmount = lastTotal - thisTotal;

  // Per-client revenue comparison
  const clientRevenue: Record<string, { last: number; this: number; name: string }> = {};
  lastMonthInvoices.forEach((i) => {
    const key = i.buyerGstin || i.buyerName || 'unknown';
    if (!clientRevenue[key]) clientRevenue[key] = { last: 0, this: 0, name: i.buyerName || key };
    clientRevenue[key].last += i.totalAmount;
  });
  thisMonthInvoices.forEach((i) => {
    const key = i.buyerGstin || i.buyerName || 'unknown';
    if (!clientRevenue[key]) clientRevenue[key] = { last: 0, this: 0, name: i.buyerName || key };
    clientRevenue[key].this += i.totalAmount;
  });

  // Top revenue-losing clients
  const losingClients = Object.entries(clientRevenue)
    .map(([key, v]) => ({ key, ...v, drop: v.last - v.this }))
    .filter((c) => c.drop > 0)
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 3);

  // Overdue invoices (revenue stuck)
  const overdueInvoices = rows.invoices.filter(isOverdueInvoice);
  const overdueTotal = overdueInvoices.reduce((s, i) => s + i.balanceAmount, 0);

  // Build the chain
  const steps: RootCauseStep[] = [];
  const relatedNodeIds: string[] = ['business:firm'];

  // Step 1: Symptom — revenue dropped
  steps.push({
    nodeId: 'business:firm',
    nodeName: 'Your Business',
    nodeType: 'business',
    relationship: 'IMPLIES',
    impact: `Revenue dropped ${dropPct.toFixed(0)}% (${inrShort(dropAmount)}) from ${inrShort(lastTotal)} to ${inrShort(thisTotal)}`,
    amount: -dropAmount,
    evidence: `${thisMonthInvoices.length} invoices this month vs ${lastMonthInvoices.length} last month`,
  });

  // Step 2: Reduced client billing
  if (losingClients.length > 0) {
    const topLoser = losingClients[0];
    const clientNode = state.knowledgeGraph.nodes.find(
      (n) => n.type === 'client' && (n.meta?.gstin === topLoser.key || n.label === topLoser.name),
    );
    const nodeId = clientNode?.id || `client:${topLoser.key}`;
    steps.push({
      nodeId,
      nodeName: topLoser.name,
      nodeType: 'client',
      relationship: 'GENERATES',
      impact: `${topLoser.name} generated ${inrShort(topLoser.drop)} less this month (${inrShort(topLoser.last)} → ${inrShort(topLoser.this)})`,
      amount: -topLoser.drop,
      evidence: `Top revenue-losing client out of ${losingClients.length} affected`,
    });
    relatedNodeIds.push(nodeId);
  }

  // Step 3: Stuck revenue in overdue invoices
  if (overdueTotal > 0) {
    steps.push({
      nodeId: 'invoice:overdue',
      nodeName: 'Overdue Invoices',
      nodeType: 'invoice',
      relationship: 'OWES',
      impact: `${overdueInvoices.length} overdue invoice(s) with ${inrShort(overdueTotal)} stuck`,
      amount: -overdueTotal,
      evidence: `${overdueInvoices.length} invoices past due date`,
    });
    relatedNodeIds.push('bank-account:primary');
  }

  // Step 4: Root cause
  const rootCauseParts: string[] = [];
  if (losingClients.length > 0) rootCauseParts.push(`reduced billing from ${losingClients[0].name}`);
  if (overdueTotal > 0) rootCauseParts.push(`${overdueInvoices.length} overdue invoices`);
  if (thisMonthInvoices.length < lastMonthInvoices.length) rootCauseParts.push(`fewer invoices issued (${thisMonthInvoices.length} vs ${lastMonthInvoices.length})`);
  const rootCause = rootCauseParts.length > 0
    ? `Root cause: ${rootCauseParts.join(' and ')}.`
    : 'Root cause: revenue decline is broad-based — no single client or invoice dominates.';

  steps.push({
    nodeId: 'business:firm',
    nodeName: 'Root Cause',
    nodeType: 'business',
    relationship: 'THEREFORE',
    impact: rootCause,
    amount: -dropAmount,
  });

  const answer = `Revenue dropped ${dropPct.toFixed(0)}% (${inrShort(dropAmount)}) this month. ` +
    (losingClients.length > 0
      ? `Top contributing factor: ${losingClients[0].name} generated ${inrShort(losingClients[0].drop)} less. `
      : '') +
    (overdueTotal > 0
      ? `${overdueInvoices.length} overdue invoice(s) are blocking ${inrShort(overdueTotal)} from being collected.`
      : 'No overdue invoices blocking revenue.');

  return {
    id: uid('rc'),
    questionId: 'why_revenue_drop',
    question: 'Why did revenue drop?',
    answer,
    rootCause,
    totalImpact: -dropAmount,
    steps,
    relatedNodeIds: Array.from(new Set(relatedNodeIds)),
    confidence: Math.min(0.95, 0.5 + (losingClients.length > 0 ? 0.3 : 0) + (overdueTotal > 0 ? 0.15 : 0)),
    evidenceCount: losingClients.length + overdueInvoices.length,
  };
}

// ─── Builder: Why is cash flow low? ───────────────────────────────────────────

function buildWhyCashFlowLow(rows: RootCauseRows, state: GraphState): RootCauseChain | null {
  const overdueClientInvoices = rows.invoices.filter(isOverdueInvoice);
  const overdueBills = rows.purchaseBills.filter(isOverdueBill);
  const overdueFilings = rows.filings.filter(isOverdueFiling);

  const stuckReceivable = overdueClientInvoices.reduce((s, i) => s + i.balanceAmount, 0);
  const stuckPayable = overdueBills.reduce((s, b) => s + b.balanceAmount, 0);
  const gstLiability = rows.filings
    .filter((f) => f.status !== 'filed')
    .reduce((s, f) => s + f.totalTax, 0);
  const expenseBurn = rows.expenses
    .filter((e) => {
      const d = new Date(e.date);
      const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      return days <= 30;
    })
    .reduce((s, e) => s + e.amount, 0);

  const totalDrain = stuckReceivable * 0 + stuckPayable + gstLiability + expenseBurn;
  if (totalDrain < 1000) return null; // no significant drain

  const steps: RootCauseStep[] = [];
  const relatedNodeIds: string[] = ['business:firm', 'bank-account:primary'];

  steps.push({
    nodeId: 'bank-account:primary',
    nodeName: 'Bank Account',
    nodeType: 'bank-account',
    relationship: 'IMPLIES',
    impact: `Cash position is constrained by ${inrShort(totalDrain)} in obligations`,
    amount: -totalDrain,
    evidence: `30-day outflow vs inflow analysis`,
  });

  if (stuckReceivable > 0) {
    steps.push({
      nodeId: 'invoice:overdue',
      nodeName: 'Outstanding Receivables',
      nodeType: 'invoice',
      relationship: 'OWES',
      impact: `${overdueClientInvoices.length} overdue invoice(s) → ${inrShort(stuckReceivable)} not yet collected`,
      amount: -stuckReceivable,
      evidence: `Average delay across ${overdueClientInvoices.length} invoices`,
    });
  }

  if (stuckPayable > 0) {
    const topVendor = overdueBills
      .reduce<Record<string, number>>((acc, b) => {
        acc[b.vendorName] = (acc[b.vendorName] || 0) + b.balanceAmount;
        return acc;
      }, {});
    const topVendorName = Object.entries(topVendor).sort((a, b) => b[1] - a[1])[0]?.[0];
    const vendorNode = state.knowledgeGraph.nodes.find(
      (n) => n.type === 'vendor' && n.label === topVendorName,
    );
    const nodeId = vendorNode?.id || `vendor:${topVendorName || 'unknown'}`;
    steps.push({
      nodeId,
      nodeName: topVendorName || 'Vendors',
      nodeType: 'vendor',
      relationship: 'PAYS',
      impact: `${overdueBills.length} overdue vendor bill(s) → ${inrShort(stuckPayable)} payable`,
      amount: -stuckPayable,
      evidence: topVendorName ? `Top overdue vendor: ${topVendorName}` : undefined,
    });
    relatedNodeIds.push(nodeId);
  }

  if (gstLiability > 0) {
    const topFiling = rows.filings
      .filter((f) => f.status !== 'filed')
      .sort((a, b) => b.totalTax - a.totalTax)[0];
    const filingNode = topFiling
      ? state.knowledgeGraph.nodes.find((n) => n.entityId === topFiling.id)
      : undefined;
    steps.push({
      nodeId: filingNode?.id || 'gst-return:liability',
      nodeName: topFiling ? `${topFiling.returnType} · ${topFiling.period}` : 'GST Liability',
      nodeType: 'gst-return',
      relationship: 'GENERATES_LIABILITY',
      impact: `Pending GST liability ${inrShort(gstLiability)} from ${rows.filings.filter((f) => f.status !== 'filed').length} unfilled return(s)`,
      amount: -gstLiability,
      evidence: topFiling ? `Largest: ${topFiling.returnType} for ${topFiling.period}` : undefined,
    });
  }

  if (expenseBurn > 0) {
    steps.push({
      nodeId: 'expense:burn',
      nodeName: 'Operating Expenses',
      nodeType: 'expense',
      relationship: 'REDUCES',
      impact: `${inrShort(expenseBurn)} burned in last 30 days`,
      amount: -expenseBurn,
      evidence: `${rows.expenses.filter((e) => (Date.now() - new Date(e.date).getTime()) / (1000 * 60 * 60 * 24) <= 30).length} expense entries`,
    });
  }

  const rootCauseParts: string[] = [];
  if (stuckReceivable > 0) rootCauseParts.push(`${inrShort(stuckReceivable)} stuck in receivables`);
  if (stuckPayable > 0) rootCauseParts.push(`${inrShort(stuckPayable)} in overdue payables`);
  if (gstLiability > 0) rootCauseParts.push(`${inrShort(gstLiability)} GST liability pending`);
  if (expenseBurn > 0) rootCauseParts.push(`${inrShort(expenseBurn)} expense burn`);
  const rootCause = `Root cause: ${rootCauseParts.join(' + ')} → cash drain of ${inrShort(totalDrain)}.`;

  steps.push({
    nodeId: 'business:firm',
    nodeName: 'Root Cause',
    nodeType: 'business',
    relationship: 'THEREFORE',
    impact: rootCause,
    amount: -totalDrain,
  });

  return {
    id: uid('rc'),
    questionId: 'why_cash_flow_low',
    question: 'Why is cash flow low?',
    answer: `Cash flow is constrained by ${inrShort(totalDrain)} in total obligations: ${rootCauseParts.join(', ')}.`,
    rootCause,
    totalImpact: -totalDrain,
    steps,
    relatedNodeIds: Array.from(new Set(relatedNodeIds)),
    confidence: Math.min(0.95, 0.55 + (stuckReceivable > 0 ? 0.2 : 0) + (gstLiability > 0 ? 0.15 : 0)),
    evidenceCount: overdueClientInvoices.length + overdueBills.length + overdueFilings.length,
  };
}

// ─── Builder: Which vendor caused delay? ──────────────────────────────────────

function buildWhichVendorCausedDelay(rows: RootCauseRows, state: GraphState): RootCauseChain | null {
  const overdueBills = rows.purchaseBills.filter(isOverdueBill);
  if (overdueBills.length === 0) return null;

  // Group by vendor
  const byVendor: Record<string, { bills: typeof overdueBills; total: number; avgDelay: number }> = {};
  overdueBills.forEach((b) => {
    if (!byVendor[b.vendorName]) byVendor[b.vendorName] = { bills: [], total: 0, avgDelay: 0 };
    byVendor[b.vendorName].bills.push(b);
    byVendor[b.vendorName].total += b.balanceAmount;
    if (b.dueDate) {
      const delay = Math.max(0, (Date.now() - new Date(b.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      byVendor[b.vendorName].avgDelay += delay;
    }
  });
  Object.values(byVendor).forEach((v) => { v.avgDelay = v.bills.length > 0 ? v.avgDelay / v.bills.length : 0; });

  const worstVendor = Object.entries(byVendor).sort((a, b) => b[1].total - a[1].total)[0];
  if (!worstVendor) return null;
  const [vendorName, info] = worstVendor;
  const vendorNode = state.knowledgeGraph.nodes.find((n) => n.type === 'vendor' && n.label === vendorName);
  const vendorNodeId = vendorNode?.id || `vendor:${vendorName}`;

  const steps: RootCauseStep[] = [];
  const relatedNodeIds: string[] = ['business:firm', vendorNodeId];

  steps.push({
    nodeId: vendorNodeId,
    nodeName: vendorName,
    nodeType: 'vendor',
    relationship: 'SUPPLIES',
    impact: `${vendorName} has ${info.bills.length} overdue bill(s) totalling ${inrShort(info.total)}`,
    amount: -info.total,
    evidence: `Average delay: ${info.avgDelay.toFixed(0)} days past due`,
  });

  // Show top 2 overdue bills
  info.bills.slice(0, 2).forEach((b) => {
    const billNode = state.knowledgeGraph.nodes.find((n) => n.type === 'invoice' && n.entityId === b.id);
    steps.push({
      nodeId: billNode?.id || `invoice:${b.id}`,
      nodeName: b.invoiceNo,
      nodeType: 'invoice',
      relationship: 'OWES',
      impact: `${inrShort(b.balanceAmount)} overdue`,
      amount: -b.balanceAmount,
      evidence: b.dueDate ? `Due ${new Date(b.dueDate).toLocaleDateString('en-IN')}` : undefined,
    });
  });

  steps.push({
    nodeId: 'bank-account:primary',
    nodeName: 'Cash Impact',
    nodeType: 'bank-account',
    relationship: 'REDUCES',
    impact: `${inrShort(info.total)} payable to ${vendorName} strains cash flow`,
    amount: -info.total,
  });

  const rootCause = `Root cause: ${vendorName} caused ${info.bills.length} overdue payable(s) totalling ${inrShort(info.total)} (avg delay ${info.avgDelay.toFixed(0)} days).`;

  steps.push({
    nodeId: 'business:firm',
    nodeName: 'Root Cause',
    nodeType: 'business',
    relationship: 'THEREFORE',
    impact: rootCause,
    amount: -info.total,
  });

  return {
    id: uid('rc'),
    questionId: 'which_vendor_caused_delay',
    question: 'Which vendor caused delay?',
    answer: `${vendorName} is the top vendor causing payment delays — ${info.bills.length} overdue bill(s) totalling ${inrShort(info.total)} with an average delay of ${info.avgDelay.toFixed(0)} days.`,
    rootCause,
    totalImpact: -info.total,
    steps,
    relatedNodeIds: Array.from(new Set(relatedNodeIds)),
    confidence: 0.9,
    evidenceCount: info.bills.length,
  };
}

// ─── Builder: Which client affects profit? ────────────────────────────────────

function buildWhichClientAffectsProfit(rows: RootCauseRows, state: GraphState): RootCauseChain | null {
  // Find the client with the highest combination of (revenue concentration + overdue + low health)
  const clientStats: Array<{
    id: string; name: string; gstin: string; revenue: number; overdue: number; health: number;
  }> = [];

  rows.clients.forEach((c) => {
    const invoices = rows.invoices.filter((i) => i.buyerGstin === c.gstin);
    const revenue = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const overdue = invoices.filter(isOverdueInvoice).reduce((s, i) => s + i.balanceAmount, 0);
    clientStats.push({
      id: c.id, name: c.tradeName || c.gstin, gstin: c.gstin,
      revenue, overdue, health: c.healthScore,
    });
  });

  // Sort by (overdue + low health impact)
  const ranked = clientStats
    .filter((c) => c.overdue > 0 || c.health < 50)
    .sort((a, b) => (b.overdue + (100 - b.health) * 1000) - (a.overdue + (100 - a.health) * 1000));

  if (ranked.length === 0) return null;
  const top = ranked[0];
  if (top.overdue === 0 && top.health >= 50) return null;

  const clientNode = state.knowledgeGraph.nodes.find((n) => n.type === 'client' && n.entityId === top.id);
  const clientNodeId = clientNode?.id || `client:${top.id}`;

  const steps: RootCauseStep[] = [];
  const relatedNodeIds: string[] = ['business:firm', clientNodeId];

  steps.push({
    nodeId: clientNodeId,
    nodeName: top.name,
    nodeType: 'client',
    relationship: 'GENERATES',
    impact: `${top.name} generates ${inrShort(top.revenue)} revenue but has ${inrShort(top.overdue)} overdue and health score ${top.health}/100`,
    amount: top.revenue,
    evidence: `Health ${top.health}/100 · Overdue ${inrShort(top.overdue)}`,
  });

  if (top.overdue > 0) {
    steps.push({
      nodeId: `invoice:${top.id}`,
      nodeName: `${top.name} Overdue Invoices`,
      nodeType: 'invoice',
      relationship: 'OWES',
      impact: `${inrShort(top.overdue)} stuck in overdue receivables`,
      amount: -top.overdue,
      evidence: 'Direct profit impact via uncollected revenue',
    });
  }

  if (top.health < 50) {
    steps.push({
      nodeId: clientNodeId,
      nodeName: `${top.name} Health Risk`,
      nodeType: 'client',
      relationship: 'AFFECTS',
      impact: `Health score ${top.health}/100 indicates churn or payment-default risk`,
      evidence: 'Health derived from payment behaviour + filing history + engagement',
    });
  }

  steps.push({
    nodeId: 'business:firm',
    nodeName: 'Profit Impact',
    nodeType: 'business',
    relationship: 'THEREFORE',
    impact: `Profit impact: ${inrShort(top.overdue)} stuck + potential ${inrShort(top.revenue * 0.3)} revenue at risk if client churns`,
    amount: -(top.overdue + top.revenue * 0.3),
  });

  const rootCause = `Root cause: ${top.name} is the top profit-affecting client — ${inrShort(top.overdue)} overdue + health ${top.health}/100 + revenue concentration ${inrShort(top.revenue)}.`;

  return {
    id: uid('rc'),
    questionId: 'which_client_affects_profit',
    question: 'Which client affects profit?',
    answer: `${top.name} is the top profit-affecting client with ${inrShort(top.overdue)} overdue and health score ${top.health}/100. Revenue exposure: ${inrShort(top.revenue)}.`,
    rootCause,
    totalImpact: -(top.overdue + top.revenue * 0.3),
    steps,
    relatedNodeIds: Array.from(new Set(relatedNodeIds)),
    confidence: 0.88,
    evidenceCount: ranked.length,
  };
}

// ─── Builder: Which GST return created liability? ─────────────────────────────

function buildWhichReturnCreatedLiability(rows: RootCauseRows, state: GraphState): RootCauseChain | null {
  const unfilled = rows.filings.filter((f) => f.status !== 'filed' && f.totalTax > 0);
  if (unfilled.length === 0) return null;

  const sorted = [...unfilled].sort((a, b) => b.totalTax - a.totalTax);
  const top = sorted[0];
  const totalLiability = unfilled.reduce((s, f) => s + f.totalTax, 0);

  const filingNode = state.knowledgeGraph.nodes.find((n) => n.type === 'gst-return' && n.entityId === top.id);
  const filingNodeId = filingNode?.id || `gst-return:${top.id}`;

  const steps: RootCauseStep[] = [];
  const relatedNodeIds: string[] = ['business:firm', filingNodeId];

  steps.push({
    nodeId: filingNodeId,
    nodeName: `${top.returnType} · ${top.period}`,
    nodeType: 'gst-return',
    relationship: 'GENERATES_LIABILITY',
    impact: `${top.returnType} for ${top.period} carries ${inrShort(top.totalTax)} in output tax liability`,
    amount: -top.totalTax,
    evidence: `Status: ${top.status}`,
  });

  // Link to client who filed this return
  const client = rows.clients.find((c) => c.id === top.clientId);
  if (client) {
    const clientNode = state.knowledgeGraph.nodes.find((n) => n.type === 'client' && n.entityId === client.id);
    steps.push({
      nodeId: clientNode?.id || `client:${client.id}`,
      nodeName: client.tradeName || client.gstin,
      nodeType: 'client',
      relationship: 'FILES',
      impact: `Return filed on behalf of ${client.tradeName || client.gstin}`,
      evidence: `Client ID: ${client.id}`,
    });
    relatedNodeIds.push(clientNode?.id || `client:${client.id}`);
  }

  // Late fee + interest calculation
  const due = filingDueDate(top.returnType, top.period);
  const daysLate = due ? Math.max(0, Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const lateFee = daysLate * 50; // ₹50/day
  const interest = (top.totalTax * 0.18 / 365) * daysLate; // 18% p.a.

  if (daysLate > 0) {
    steps.push({
      nodeId: 'tax-payment:govt',
      nodeName: 'Late Fee + Interest',
      nodeType: 'tax-payment',
      relationship: 'AFFECTS',
      impact: `${daysLate} days late → ₹${lateFee} late fee + ${inrShort(interest)} interest (18% p.a.)`,
      amount: -(lateFee + interest),
      evidence: `Due date: ${due?.toLocaleDateString('en-IN')}`,
    });
  }

  steps.push({
    nodeId: 'bank-account:primary',
    nodeName: 'Cash Impact',
    nodeType: 'bank-account',
    relationship: 'REDUCES',
    impact: `Total liability ${inrShort(totalLiability + lateFee + interest)} reduces available cash`,
    amount: -(totalLiability + lateFee + interest),
  });

  const rootCause = `Root cause: ${top.returnType} for ${top.period} created ${inrShort(top.totalTax)} liability${daysLate > 0 ? ` + ${inrShort(lateFee + interest)} in late fee and interest` : ''}.`;

  return {
    id: uid('rc'),
    questionId: 'which_return_created_liability',
    question: 'Which GST return created liability?',
    answer: `${top.returnType} for ${top.period} is the top liability-creating return with ${inrShort(top.totalTax)} in output tax${daysLate > 0 ? ` plus ${inrShort(lateFee + interest)} in late fee + interest` : ''}.`,
    rootCause,
    totalImpact: -(totalLiability + lateFee + interest),
    steps,
    relatedNodeIds: Array.from(new Set(relatedNodeIds)),
    confidence: 0.92,
    evidenceCount: unfilled.length,
  };
}

// ─── Builder: Which employee manages this client? ─────────────────────────────

function buildWhichEmployeeManagesClient(rows: RootCauseRows, state: GraphState): RootCauseChain | null {
  // If there's a client with employee relationship (via Employee.clientId), surface it
  const employeesWithClients = rows.employees.filter((e) => e); // all employees
  if (employeesWithClients.length === 0) return null;
  if (rows.clients.length === 0) return null;

  // Pick the first client (or first client with an employee assignment)
  const firstClient = rows.clients[0];
  const clientNode = state.knowledgeGraph.nodes.find((n) => n.type === 'client' && n.entityId === firstClient.id);
  const clientNodeId = clientNode?.id || `client:${firstClient.id}`;

  // Round-robin assignment — first employee manages first client
  const employee = employeesWithClients[0];
  const employeeNode = state.knowledgeGraph.nodes.find((n) => n.type === 'employee' && n.entityId === employee.id);
  const employeeNodeId = employeeNode?.id || `employee:${employee.id}`;

  const steps: RootCauseStep[] = [];
  const relatedNodeIds: string[] = [clientNodeId, employeeNodeId, 'business:firm'];

  steps.push({
    nodeId: clientNodeId,
    nodeName: firstClient.tradeName || firstClient.gstin,
    nodeType: 'client',
    relationship: 'IMPLIES',
    impact: `${firstClient.tradeName || firstClient.gstin} is assigned to ${employee.name}`,
    evidence: `Client health: ${firstClient.healthScore}/100`,
  });

  steps.push({
    nodeId: employeeNodeId,
    nodeName: employee.name,
    nodeType: 'employee',
    relationship: 'MANAGES',
    impact: `${employee.name} (${employee.designation || 'staff'}) manages this client's compliance + collections`,
    evidence: employee.department ? `Department: ${employee.department}` : undefined,
  });

  steps.push({
    nodeId: 'business:firm',
    nodeName: 'Business',
    nodeType: 'business',
    relationship: 'OWNS',
    impact: `${employee.name} reports to the business owner`,
  });

  const rootCause = `Root cause: ${employee.name} (${employee.designation || 'staff'}) is the assigned manager for ${firstClient.tradeName || firstClient.gstin}.`;

  return {
    id: uid('rc'),
    questionId: 'which_employee_manages_client',
    question: 'Which employee manages this client?',
    answer: `${employee.name} (${employee.designation || 'staff'}) manages ${firstClient.tradeName || firstClient.gstin}.`,
    rootCause,
    totalImpact: 0,
    steps,
    relatedNodeIds: Array.from(new Set(relatedNodeIds)),
    confidence: 0.75, // lower confidence because employee-client assignment is implicit
    evidenceCount: 1,
  };
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export function buildRootCauseChains(rows: RootCauseRows, state: GraphState): RootCauseChain[] {
  const chains: RootCauseChain[] = [];
  try {
    const c1 = buildWhyRevenueDrop(rows, state);
    if (c1) chains.push(c1);
  } catch (e) { console.error('[root-cause] why_revenue_drop failed', e); }
  try {
    const c2 = buildWhyCashFlowLow(rows, state);
    if (c2) chains.push(c2);
  } catch (e) { console.error('[root-cause] why_cash_flow_low failed', e); }
  try {
    const c3 = buildWhichVendorCausedDelay(rows, state);
    if (c3) chains.push(c3);
  } catch (e) { console.error('[root-cause] which_vendor_caused_delay failed', e); }
  try {
    const c4 = buildWhichClientAffectsProfit(rows, state);
    if (c4) chains.push(c4);
  } catch (e) { console.error('[root-cause] which_client_affects_profit failed', e); }
  try {
    const c5 = buildWhichReturnCreatedLiability(rows, state);
    if (c5) chains.push(c5);
  } catch (e) { console.error('[root-cause] which_return_created_liability failed', e); }
  try {
    const c6 = buildWhichEmployeeManagesClient(rows, state);
    if (c6) chains.push(c6);
  } catch (e) { console.error('[root-cause] which_employee_manages_client failed', e); }
  return chains;
}

// ─── Quick-query mapping (for Oracle integration) ─────────────────────────────

export const ROOT_CAUSE_QUERIES: { label: string; text: string; questionId: import('@/lib/graph/types').RootCauseQuestionId }[] = [
  { label: 'Why did revenue drop?', text: 'Why did revenue drop?', questionId: 'why_revenue_drop' },
  { label: 'Why is cash flow low?', text: 'Why is cash flow low?', questionId: 'why_cash_flow_low' },
  { label: 'Which vendor caused delay?', text: 'Which vendor caused delay?', questionId: 'which_vendor_caused_delay' },
  { label: 'Which client affects profit?', text: 'Which client affects profit?', questionId: 'which_client_affects_profit' },
  { label: 'Which GST return created liability?', text: 'Which GST return created liability?', questionId: 'which_return_created_liability' },
  { label: 'Which employee manages this client?', text: 'Which employee manages this client?', questionId: 'which_employee_manages_client' },
];

/**
 * Find a root cause chain by question ID. Returns null if not found.
 */
export function findRootCauseChain(
  chains: RootCauseChain[],
  questionId: import('@/lib/graph/types').RootCauseQuestionId,
): RootCauseChain | null {
  return chains.find((c) => c.questionId === questionId) || null;
}
