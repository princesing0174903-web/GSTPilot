// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — AI MEMORY™ (per-employee)
//
// Every AI employee remembers: previous decisions, conversations, mistakes,
// successes, business outcomes, strategies, meetings. Never loses context.
// All memories derive from REAL connected business data (timeline events,
// CEO decisions, CFO recommendations, Twin anomalies, etc.).
//
// Tagline: "VEYRO AI Workforce™ — Don't just use AI. Build an AI Company."
// ═══════════════════════════════════════════════════════════════════════════════

import type { EmployeeRole, EmployeeMemoryEntry, EmployeeMemoryType } from './types';
import type { WorkforceDataView } from './data';
import { getRoleDefinition } from './organization';

// ─── Per-role memory derivation ──────────────────────────────────────────────
//
// Memories are derived from the employee's domain data: recent invoices, filings,
// notices, anomalies, decisions, etc. Each memory is tagged with its source.

function financeMemories(data: WorkforceDataView): EmployeeMemoryEntry[] {
  const mems: EmployeeMemoryEntry[] = [];
  const now = new Date().toISOString();

  // Recent paid invoices = success memories
  const paidInvoices = data.raw.invoices.filter((i) => i.paymentStatus === 'paid').slice(0, 3);
  for (const inv of paidInvoices) {
    mems.push({
      id: `fin-paid-${inv.id}`,
      role: 'cfo',
      memoryType: 'success',
      title: `Invoice ${inv.invoiceNumber} paid`,
      description: `Payment of ₹${Math.round(inv.paidAmount).toLocaleString('en-IN')} received from ${inv.buyerName || 'client'}.`,
      importance: 60,
      occurredAt: inv.paymentDate || inv.invoiceDate || now,
      tags: ['invoice', 'payment', 'cash-in'],
      relatedEntityType: 'invoice',
      relatedEntityId: inv.id,
    });
  }

  // Overdue invoices = risk memories
  const overdue = data.raw.invoices.filter((i) => i.status === 'overdue').slice(0, 2);
  for (const inv of overdue) {
    mems.push({
      id: `fin-overdue-${inv.id}`,
      role: 'cfo',
      memoryType: 'risk_event',
      title: `Invoice ${inv.invoiceNumber} overdue`,
      description: `₹${Math.round(inv.balanceAmount).toLocaleString('en-IN')} overdue from ${inv.buyerName || 'client'}.`,
      importance: 80,
      occurredAt: inv.dueDate || inv.invoiceDate || now,
      tags: ['overdue', 'receivable', 'risk'],
      relatedEntityType: 'invoice',
      relatedEntityId: inv.id,
    });
  }

  // GST filing memory
  const filedReturns = data.raw.filings.filter((f) => f.status === 'filed').slice(0, 2);
  for (const f of filedReturns) {
    mems.push({
      id: `fin-gst-${f.id}`,
      role: 'cfo',
      memoryType: 'milestone',
      title: `${f.returnType} filed for ${f.period}`,
      description: `GST return filed. Taxable value: ₹${Math.round(f.totalTaxableValue).toLocaleString('en-IN')}.`,
      importance: 70,
      occurredAt: f.filedDate || now,
      tags: ['gst', 'filing', 'compliance'],
      relatedEntityType: 'filing',
      relatedEntityId: f.id,
    });
  }

  return mems.sort((a, b) => b.importance - a.importance);
}

function salesMemories(data: WorkforceDataView): EmployeeMemoryEntry[] {
  const mems: EmployeeMemoryEntry[] = [];
  const now = new Date().toISOString();

  // New client acquisitions = success memories
  const recentInvoices = data.raw.invoices
    .filter((i) => i.invoiceDate)
    .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
    .slice(0, 3);
  for (const inv of recentInvoices) {
    mems.push({
      id: `sales-deal-${inv.id}`,
      role: 'sales_manager',
      memoryType: 'success',
      title: `Deal closed with ${inv.buyerName || 'client'}`,
      description: `Invoice ${inv.invoiceNumber} issued for ₹${Math.round(inv.totalAmount).toLocaleString('en-IN')}.`,
      importance: 75,
      occurredAt: inv.invoiceDate || now,
      tags: ['deal', 'invoice', 'revenue'],
      relatedEntityType: 'invoice',
      relatedEntityId: inv.id,
    });
  }

  // Top client concentration = risk memory
  if (data.sales.topClients[0]) {
    const tc = data.sales.topClients[0];
    mems.push({
      id: 'sales-concentration',
      role: 'sales_manager',
      memoryType: 'risk_event',
      title: `Top client: ${tc.name}`,
      description: `${tc.name} represents significant revenue share. Monitor for concentration risk.`,
      importance: 65,
      occurredAt: now,
      tags: ['client', 'concentration', 'risk'],
    });
  }

  return mems.sort((a, b) => b.importance - a.importance);
}

function complianceMemories(data: WorkforceDataView): EmployeeMemoryEntry[] {
  const mems: EmployeeMemoryEntry[] = [];
  const now = new Date().toISOString();

  // Filed returns = milestone memories
  const filed = data.raw.filings.filter((f) => f.status === 'filed').slice(0, 3);
  for (const f of filed) {
    mems.push({
      id: `comp-filed-${f.id}`,
      role: 'compliance_manager',
      memoryType: 'milestone',
      title: `${f.returnType} filed for ${f.period}`,
      description: `Return filed successfully. Tax: ₹${Math.round(f.totalTax).toLocaleString('en-IN')}.`,
      importance: 70,
      occurredAt: f.filedDate || now,
      tags: ['gst', 'filing', 'filed'],
    });
  }

  // Notices = risk memories
  const notices = data.raw.notices.slice(0, 3);
  for (const n of notices) {
    mems.push({
      id: `comp-notice-${n.id}`,
      role: 'compliance_manager',
      memoryType: 'risk_event',
      title: `Notice received: ${n.noticeType}`,
      description: n.subject || 'Government notice received. Response required.',
      importance: 85,
      occurredAt: n.noticeDate || now,
      tags: ['notice', 'compliance', 'risk'],
      relatedEntityType: 'notice',
      relatedEntityId: n.id,
    });
  }

  // Overdue filings = mistake/risk memories
  if (data.compliance.overdueFilings > 0) {
    mems.push({
      id: 'comp-overdue',
      role: 'compliance_manager',
      memoryType: 'mistake',
      title: `${data.compliance.overdueFilings} overdue filing(s)`,
      description: 'Filings are overdue. Penalties may apply.',
      importance: 90,
      occurredAt: now,
      tags: ['overdue', 'penalty', 'risk'],
    });
  }

  return mems.sort((a, b) => b.importance - a.importance);
}

function riskMemories(data: WorkforceDataView): EmployeeMemoryEntry[] {
  const mems: EmployeeMemoryEntry[] = [];
  const now = new Date().toISOString();

  // Twin anomalies = risk_event memories
  const anomalies = data.twin.anomalies.anomalies.slice(0, 3);
  for (const a of anomalies) {
    mems.push({
      id: `risk-anom-${a.metric || a.id || Math.random()}`,
      role: 'risk_manager',
      memoryType: 'risk_event',
      title: `Anomaly: ${a.metric || 'Unknown metric'}`,
      description: a.description || 'Anomaly detected by Digital Twin™.',
      importance: 85,
      occurredAt: a.detectedAt || now,
      tags: ['anomaly', 'risk', 'twin'],
    });
  }

  // Cash risk
  if (data.risk.cashRisk === 'high' || data.risk.cashRisk === 'critical') {
    mems.push({
      id: 'risk-cash',
      role: 'risk_manager',
      memoryType: 'risk_event',
      title: `Cash risk: ${data.risk.cashRisk}`,
      description: `Runway is ${data.finance.runwayDays} days. Immediate action needed.`,
      importance: 95,
      occurredAt: now,
      tags: ['cash', 'runway', 'critical'],
    });
  }

  // Concentration risk
  if (data.risk.concentrationRisk > 30) {
    mems.push({
      id: 'risk-conc',
      role: 'risk_manager',
      memoryType: 'risk_event',
      title: `Client concentration: ${data.risk.concentrationRisk.toFixed(0)}%`,
      description: 'Top client represents excessive revenue share.',
      importance: 80,
      occurredAt: now,
      tags: ['concentration', 'risk'],
    });
  }

  return mems.sort((a, b) => b.importance - a.importance);
}

function operationsMemories(data: WorkforceDataView): EmployeeMemoryEntry[] {
  const mems: EmployeeMemoryEntry[] = [];
  const now = new Date().toISOString();

  // Recent timeline events = outcome memories
  const events = data.twin.timeline.events.slice(0, 5);
  for (const e of events) {
    mems.push({
      id: `ops-event-${e.id}`,
      role: 'operations_manager',
      memoryType: 'outcome',
      title: e.title || e.type || 'Business event',
      description: e.description || 'Operational event recorded.',
      importance: 55,
      occurredAt: e.timestamp || now,
      tags: ['operations', e.type || 'event'],
    });
  }

  return mems.sort((a, b) => b.importance - a.importance);
}

function executiveMemories(data: WorkforceDataView): EmployeeMemoryEntry[] {
  const mems: EmployeeMemoryEntry[] = [];
  const now = new Date().toISOString();

  // CEO memories = strategic milestones from the data
  if (data.executive.healthScore > 0) {
    mems.push({
      id: 'ceo-health',
      role: 'ceo',
      memoryType: 'outcome',
      title: `Business health: ${data.executive.healthScore}/100`,
      description: `Current health score is ${data.executive.healthScore}. Risk: ${data.executive.riskScore}.`,
      importance: 90,
      occurredAt: now,
      tags: ['health', 'executive', 'strategy'],
    });
  }

  if (data.executive.revenue > 0) {
    mems.push({
      id: 'ceo-revenue',
      role: 'ceo',
      memoryType: 'milestone',
      title: `Revenue: ₹${Math.round(data.executive.revenue).toLocaleString('en-IN')} (MTD)`,
      description: `Monthly revenue tracking. Profit: ₹${Math.round(data.executive.profit).toLocaleString('en-IN')}.`,
      importance: 85,
      occurredAt: now,
      tags: ['revenue', 'milestone'],
    });
  }

  // Aggregate the top memories from other departments as CEO awareness
  const topRisk = riskMemories(data)[0];
  if (topRisk) {
    mems.push({
      ...topRisk,
      id: 'ceo-' + topRisk.id,
      role: 'ceo',
      importance: Math.min(100, topRisk.importance + 5),
      tags: [...topRisk.tags, 'ceo-aware'],
    });
  }

  return mems.sort((a, b) => b.importance - a.importance);
}

function supportMemories(data: WorkforceDataView): EmployeeMemoryEntry[] {
  const mems: EmployeeMemoryEntry[] = [];
  const now = new Date().toISOString();

  // Resolved notices = success memories
  const resolved = data.raw.notices.filter((n) => n.status === 'resolved' || n.status === 'closed').slice(0, 3);
  for (const n of resolved) {
    mems.push({
      id: `sup-resolved-${n.id}`,
      role: 'support_manager',
      memoryType: 'success',
      title: `Resolved: ${n.noticeType}`,
      description: n.subject || 'Issue resolved successfully.',
      importance: 60,
      occurredAt: now,
      tags: ['support', 'resolved'],
    });
  }

  // Open notices = conversation memories
  const open = data.raw.notices.filter((n) => n.status === 'open').slice(0, 2);
  for (const n of open) {
    mems.push({
      id: `sup-open-${n.id}`,
      role: 'support_manager',
      memoryType: 'conversation',
      title: `Open ticket: ${n.noticeType}`,
      description: n.subject || 'Customer issue pending resolution.',
      importance: 70,
      occurredAt: n.noticeDate || now,
      tags: ['support', 'open'],
    });
  }

  return mems.sort((a, b) => b.importance - a.importance);
}

function procurementMemories(data: WorkforceDataView): EmployeeMemoryEntry[] {
  const mems: EmployeeMemoryEntry[] = [];
  const now = new Date().toISOString();

  // Paid bills = success
  const paidBills = data.raw.purchaseBills.filter((b) => b.paymentStatus === 'paid').slice(0, 3);
  for (const b of paidBills) {
    mems.push({
      id: `proc-paid-${b.id}`,
      role: 'procurement_manager',
      memoryType: 'success',
      title: `Paid: ${b.vendorName}`,
      description: `Bill ${b.invoiceNo} paid. Amount: ₹${Math.round(b.paidAmount).toLocaleString('en-IN')}.`,
      importance: 55,
      occurredAt: b.invoiceDate || now,
      tags: ['procurement', 'paid', 'vendor'],
    });
  }

  // Top vendor
  if (data.procurement.topVendors[0]) {
    const v = data.procurement.topVendors[0];
    mems.push({
      id: 'proc-top-vendor',
      role: 'procurement_manager',
      memoryType: 'outcome',
      title: `Top vendor: ${v.name}`,
      description: `Total spend: ₹${Math.round(v.amount).toLocaleString('en-IN')}.`,
      importance: 60,
      occurredAt: now,
      tags: ['vendor', 'spend'],
    });
  }

  return mems.sort((a, b) => b.importance - a.importance);
}

function genericMemories(role: EmployeeRole, data: WorkforceDataView): EmployeeMemoryEntry[] {
  const mems: EmployeeMemoryEntry[] = [];
  const now = new Date().toISOString();
  const def = getRoleDefinition(role);

  // Generic: the employee is aware of the overall business state
  if (data.hasLiveData) {
    mems.push({
      id: `${role}-state`,
      role,
      memoryType: 'outcome',
      title: `Monitoring ${def.department} department`,
      description: `Department health: ${data.executive.healthScore}/100. ${def.monitors.join(', ')} under watch.`,
      importance: 50,
      occurredAt: now,
      tags: [def.department, 'monitoring'],
    });
  }

  // Pick up relevant timeline events
  const events = data.twin.timeline.events.slice(0, 2);
  for (const e of events) {
    mems.push({
      id: `${role}-event-${e.id}`,
      role,
      memoryType: 'outcome',
      title: e.title || 'Business event',
      description: e.description || 'Event recorded in timeline.',
      importance: 45,
      occurredAt: e.timestamp || now,
      tags: ['timeline', def.department],
    });
  }

  return mems.sort((a, b) => b.importance - a.importance);
}

// ─── Main: compute memory for one employee ───────────────────────────────────

export function computeEmployeeMemory(
  role: EmployeeRole,
  data: WorkforceDataView,
): EmployeeMemoryEntry[] {
  const dept = getRoleDefinition(role).department;

  // Route to department-specific memory builders; fall back to generic.
  switch (dept) {
    case 'finance':
      return role === 'finance_manager' ? financeMemories(data).map((m) => ({ ...m, role })) : financeMemories(data);
    case 'sales':
      return role === 'customer_success' ? salesMemories(data).map((m) => ({ ...m, role: 'customer_success' })) : salesMemories(data);
    case 'compliance':
      return complianceMemories(data);
    case 'risk':
      return riskMemories(data);
    case 'operations':
      return role === 'coo' ? operationsMemories(data).map((m) => ({ ...m, role: 'coo' })) : operationsMemories(data);
    case 'executive':
      return executiveMemories(data);
    case 'support':
      return supportMemories(data);
    case 'procurement':
      return procurementMemories(data);
    default:
      return genericMemories(role, data);
  }
}
