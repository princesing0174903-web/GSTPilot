// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — AI EMPLOYEE ENGINE™
//
// Each AI Employee continuously monitors ONLY its department. The engine reads
// the WorkforceDataView (merged CFO + Twin + raw) and computes department-
// specific KPIs, status, health score, recommendations, and task/alert counts
// for every one of the 17 roles. No mock values — every number traces back to
// REAL connected business data.
//
// Tagline: "VEYRO AI Workforce™ — Don't just use AI. Build an AI Company."
// ═══════════════════════════════════════════════════════════════════════════════

import { ORGANIZATION, getRoleDefinition } from './organization';
import type { RoleDefinition } from './organization';
import type {
  AIEmployee,
  EmployeeRole,
  EmployeeStatus,
  EmployeeKPI,
  EmployeeRecommendation,
  EmployeePerformance,
  EmployeeMemoryEntry,
  EmployeeSkill,
} from './types';
import type { WorkforceDataView } from './data';
import { computeEmployeePerformance } from './performance';
import { computeEmployeeMemory } from './memory';
import { computeEmployeeSkills } from './skills';

// ─── Status detector — derives an employee's live status from data ───────────

function detectStatus(
  role: EmployeeRole,
  data: WorkforceDataView,
  alertCount: number,
  pendingDecisions: number,
  hasLiveData: boolean,
): EmployeeStatus {
  if (!hasLiveData) return 'idle';
  if (pendingDecisions > 0) return 'deciding';
  if (alertCount > 0) return 'reviewing';
  // Check if this employee is involved in an active collaboration chain
  const collaborationActive = data.twin.timeline.todayCount > 0;
  if (collaborationActive && (role === 'coo' || role === 'operations_manager' || role === 'ceo')) {
    return 'collaborating';
  }
  return 'active';
}

// ─── Health score calculator — department-specific ───────────────────────────

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function financeHealth(data: WorkforceDataView): number {
  const f = data.finance;
  const cashScore = f.runwayDays > 180 ? 100 : f.runwayDays > 90 ? 70 : f.runwayDays > 30 ? 40 : 10;
  const marginScore = f.marginPct > 20 ? 100 : f.marginPct > 10 ? 70 : f.marginPct > 0 ? 40 : 10;
  const collectionScore = f.overdueAmount === 0 ? 100
    : f.receivables > 0 ? clamp(100 - (f.overdueAmount / f.receivables) * 100) : 50;
  const gstScore = f.gst === 0 ? 100 : 70;
  return Math.round((cashScore + marginScore + collectionScore + gstScore) / 4);
}

function operationsHealth(data: WorkforceDataView): number {
  const o = data.operations;
  const taskScore = o.openTasks === 0 ? 100 : clamp(100 - o.openTasks * 5);
  const efficiencyScore = o.efficiencyPct;
  const deliveryScore = o.deliveryPending === 0 ? 100 : clamp(100 - o.deliveryPending * 10);
  return Math.round((taskScore + efficiencyScore + deliveryScore) / 3);
}

function salesHealth(data: WorkforceDataView): number {
  const s = data.sales;
  const clientScore = s.clientCount > 10 ? 100 : s.clientCount > 5 ? 70 : s.clientCount > 0 ? 40 : 10;
  const pipelineScore = s.pipelineValue > 500000 ? 100 : s.pipelineValue > 100000 ? 70 : s.pipelineValue > 0 ? 40 : 10;
  const conversionScore = s.conversionRate > 50 ? 100 : s.conversionRate > 20 ? 70 : 40;
  return Math.round((clientScore + pipelineScore + conversionScore) / 3);
}

function marketingHealth(data: WorkforceDataView): number {
  const m = data.marketing;
  const growthScore = m.revenueGrowthPct > 10 ? 100 : m.revenueGrowthPct > 0 ? 70 : m.revenueGrowthPct > -10 ? 40 : 10;
  const roiScore = m.campaignROI > 100 ? 100 : m.campaignROI > 0 ? 70 : 40;
  const engagementScore = m.brandEngagement;
  return Math.round((growthScore + roiScore + engagementScore) / 3);
}

function complianceHealth(data: WorkforceDataView): number {
  const c = data.compliance;
  const filingScore = c.overdueFilings === 0 ? 100 : c.overdueFilings > 2 ? 10 : 40;
  const noticeScore = c.notices === 0 ? 100 : c.notices > 3 ? 20 : 50;
  const score = c.complianceScore;
  return Math.round((filingScore + noticeScore + score) / 3);
}

function riskHealth(data: WorkforceDataView): number {
  const r = data.risk;
  // Invert risk score → health (high risk = low health)
  return clamp(100 - r.overallRiskScore);
}

function legalHealth(data: WorkforceDataView): number {
  const l = data.legal;
  const noticeScore = l.activeNotices === 0 ? 100 : l.activeNotices > 3 ? 20 : 50;
  const disputeScore = l.disputeCount === 0 ? 100 : l.disputeCount > 2 ? 30 : 60;
  return Math.round((noticeScore + disputeScore) / 2);
}

function hrHealth(data: WorkforceDataView): number {
  const h = data.hr;
  const headcountScore = h.headcount > 0 ? 100 : 20;
  const payrollScore = h.payrollAmount > 0 ? 80 : 50;
  return Math.round((headcountScore + payrollScore) / 2);
}

function supportHealth(data: WorkforceDataView): number {
  const s = data.support;
  const ticketScore = s.openTickets === 0 ? 100 : clamp(100 - s.openTickets * 10);
  const satisfactionScore = s.satisfactionPct;
  const escalationScore = s.escalationCount === 0 ? 100 : clamp(100 - s.escalationCount * 15);
  return Math.round((ticketScore + satisfactionScore + escalationScore) / 3);
}

function procurementHealth(data: WorkforceDataView): number {
  const p = data.procurement;
  const vendorScore = p.vendorCount > 5 ? 100 : p.vendorCount > 0 ? 70 : 20;
  const billScore = p.pendingBills === 0 ? 100 : clamp(100 - p.pendingBills * 10);
  return Math.round((vendorScore + billScore) / 2);
}

function technologyHealth(data: WorkforceDataView): number {
  const t = data.technology;
  const connectionScore = t.activeIntegrations > 0 ? 100 : 20;
  const errorScore = t.syncErrors === 0 ? 100 : clamp(100 - t.syncErrors * 20);
  const qualityScore = t.dataQualityScore;
  return Math.round((connectionScore + errorScore + qualityScore) / 3);
}

function dataHealth(data: WorkforceDataView): number {
  const d = data.data;
  const recordScore = d.totalRecords > 100 ? 100 : d.totalRecords > 10 ? 70 : d.totalRecords > 0 ? 40 : 10;
  const sourceScore = d.dataSources > 3 ? 100 : d.dataSources > 0 ? 60 : 10;
  const confidenceScore = d.forecastConfidence;
  return Math.round((recordScore + sourceScore + confidenceScore) / 3);
}

function executiveHealth(data: WorkforceDataView): number {
  return data.executive.healthScore || Math.round(
    (financeHealth(data) + operationsHealth(data) + salesHealth(data) +
     complianceHealth(data) + riskHealth(data)) / 5,
  );
}

function departmentHealth(role: EmployeeRole, data: WorkforceDataView): number {
  const dept = getRoleDefinition(role).department;
  switch (dept) {
    case 'executive': return executiveHealth(data);
    case 'finance': return financeHealth(data);
    case 'operations': return operationsHealth(data);
    case 'sales': return salesHealth(data);
    case 'marketing': return marketingHealth(data);
    case 'compliance': return complianceHealth(data);
    case 'risk': return riskHealth(data);
    case 'legal': return legalHealth(data);
    case 'hr': return hrHealth(data);
    case 'support': return supportHealth(data);
    case 'procurement': return procurementHealth(data);
    case 'technology': return technologyHealth(data);
    case 'data': return dataHealth(data);
    default: return 0;
  }
}

// ─── KPI builders — one per department ───────────────────────────────────────

function financeKPIs(data: WorkforceDataView): EmployeeKPI[] {
  const f = data.finance;
  return [
    { name: 'Revenue (MTD)', value: f.revenue, unit: 'inr', status: f.revenue > 0 ? 'green' : 'red', source: 'AI CFO™' },
    { name: 'Cash Position', value: f.cash, unit: 'inr', status: f.cash > 100000 ? 'green' : f.cash > 0 ? 'amber' : 'red', source: 'Banking' },
    { name: 'Net Profit', value: f.profit, unit: 'inr', status: f.profit > 0 ? 'green' : 'red', source: 'AI CFO™' },
    { name: 'GST Payable', value: f.gst, unit: 'inr', status: f.gst === 0 ? 'green' : 'amber', source: 'GST' },
    { name: 'Runway', value: f.runwayDays, unit: 'days', target: 180, status: f.runwayDays > 90 ? 'green' : f.runwayDays > 30 ? 'amber' : 'red', source: 'AI CFO™' },
    { name: 'Overdue A/R', value: f.overdueAmount, unit: 'inr', status: f.overdueAmount === 0 ? 'green' : 'red', source: 'Invoices' },
    { name: 'Margin', value: f.marginPct, unit: 'pct', target: 20, status: f.marginPct > 15 ? 'green' : f.marginPct > 0 ? 'amber' : 'red', source: 'AI CFO™' },
  ];
}

function operationsKPIs(data: WorkforceDataView): EmployeeKPI[] {
  const o = data.operations;
  return [
    { name: 'Open Tasks', value: o.openTasks, unit: 'count', status: o.openTasks < 5 ? 'green' : 'amber', source: 'Tasks' },
    { name: 'Employees', value: o.employeeCount, unit: 'count', source: 'Payroll' },
    { name: 'Delivery Pending', value: o.deliveryPending, unit: 'count', status: o.deliveryPending === 0 ? 'green' : 'amber', source: 'Invoices' },
    { name: 'Automation Rules', value: o.automationCount, unit: 'count', source: 'Automation Engine™' },
    { name: 'Efficiency', value: o.efficiencyPct, unit: 'pct', target: 80, status: o.efficiencyPct > 70 ? 'green' : 'amber', source: 'Digital Twin™' },
  ];
}

function salesKPIs(data: WorkforceDataView): EmployeeKPI[] {
  const s = data.sales;
  return [
    { name: 'Total Clients', value: s.clientCount, unit: 'count', status: s.clientCount > 5 ? 'green' : 'amber', source: 'CRM' },
    { name: 'Active Clients', value: s.activeClients, unit: 'count', source: 'CRM' },
    { name: 'Pipeline Value', value: s.pipelineValue, unit: 'inr', status: s.pipelineValue > 100000 ? 'green' : 'amber', source: 'Invoices' },
    { name: 'Conversion Rate', value: s.conversionRate, unit: 'pct', target: 50, status: s.conversionRate > 30 ? 'green' : 'amber', source: 'CRM' },
    { name: 'New This Month', value: s.newClientsThisMonth, unit: 'count', source: 'Invoices' },
    { name: 'Avg Deal Size', value: s.avgDealSize, unit: 'inr', source: 'Revenue Data' },
  ];
}

function marketingKPIs(data: WorkforceDataView): EmployeeKPI[] {
  const m = data.marketing;
  return [
    { name: 'Revenue Growth', value: m.revenueGrowthPct, unit: 'pct', target: 10, status: m.revenueGrowthPct > 5 ? 'green' : m.revenueGrowthPct > 0 ? 'amber' : 'red', source: 'AI CFO™' },
    { name: 'Campaign ROI', value: m.campaignROI, unit: 'ratio', status: m.campaignROI > 100 ? 'green' : 'amber', source: 'Revenue Data' },
    { name: 'Leads', value: m.leadCount, unit: 'count', source: 'CRM' },
    { name: 'Brand Engagement', value: m.brandEngagement, unit: 'pct', target: 70, source: 'Growth Metrics' },
  ];
}

function complianceKPIs(data: WorkforceDataView): EmployeeKPI[] {
  const c = data.compliance;
  return [
    { name: 'Pending Filings', value: c.pendingFilings, unit: 'count', status: c.pendingFilings === 0 ? 'green' : 'amber', source: 'GST' },
    { name: 'Overdue Filings', value: c.overdueFilings, unit: 'count', status: c.overdueFilings === 0 ? 'green' : 'red', source: 'GST' },
    { name: 'Upcoming Deadlines', value: c.upcomingDeadlines, unit: 'count', source: 'GST' },
    { name: 'Active Notices', value: c.notices, unit: 'count', status: c.notices === 0 ? 'green' : 'red', source: 'Notices' },
    { name: 'Compliance Score', value: c.complianceScore, unit: 'pct', target: 90, status: c.complianceScore > 80 ? 'green' : 'amber', source: 'Digital Twin™' },
    { name: 'ITC At Risk', value: c.itcAtRisk, unit: 'inr', status: c.itcAtRisk === 0 ? 'green' : 'red', source: 'GST' },
  ];
}

function riskKPIs(data: WorkforceDataView): EmployeeKPI[] {
  const r = data.risk;
  return [
    { name: 'Overall Risk', value: r.overallRiskScore, unit: 'pct', status: r.overallRiskScore < 30 ? 'green' : r.overallRiskScore < 60 ? 'amber' : 'red', source: 'AI CFO™ Risk Engine' },
    { name: 'Critical Risks', value: r.criticalRisks, unit: 'count', status: r.criticalRisks === 0 ? 'green' : 'red', source: 'AI CFO™' },
    { name: 'High Risks', value: r.highRisks, unit: 'count', status: r.highRisks === 0 ? 'green' : 'amber', source: 'AI CFO™' },
    { name: 'Cash Risk', value: r.cashRisk === 'low' ? 0 : r.cashRisk === 'medium' ? 1 : r.cashRisk === 'high' ? 2 : 3, unit: 'count', status: r.cashRisk === 'low' ? 'green' : r.cashRisk === 'critical' ? 'red' : 'amber', source: 'AI CFO™' },
    { name: 'Concentration', value: r.concentrationRisk, unit: 'pct', target: 30, status: r.concentrationRisk < 30 ? 'green' : 'red', source: 'Revenue Data' },
    { name: 'Anomalies', value: r.anomalies, unit: 'count', status: r.anomalies === 0 ? 'green' : 'amber', source: 'Digital Twin™' },
  ];
}

function legalKPIs(data: WorkforceDataView): EmployeeKPI[] {
  const l = data.legal;
  return [
    { name: 'Active Notices', value: l.activeNotices, unit: 'count', status: l.activeNotices === 0 ? 'green' : 'red', source: 'Notices' },
    { name: 'Disputes', value: l.disputeCount, unit: 'count', status: l.disputeCount === 0 ? 'green' : 'amber', source: 'Notices' },
    { name: 'Legal Risks', value: l.legalRisks, unit: 'count', status: l.legalRisks === 0 ? 'green' : 'amber', source: 'Notices' },
  ];
}

function hrKPIs(data: WorkforceDataView): EmployeeKPI[] {
  const h = data.hr;
  return [
    { name: 'Headcount', value: h.headcount, unit: 'count', source: 'Payroll' },
    { name: 'Monthly Payroll', value: h.payrollAmount, unit: 'inr', source: 'Payroll' },
  ];
}

function supportKPIs(data: WorkforceDataView): EmployeeKPI[] {
  const s = data.support;
  return [
    { name: 'Open Tickets', value: s.openTickets, unit: 'count', status: s.openTickets === 0 ? 'green' : 'amber', source: 'Communications' },
    { name: 'Satisfaction', value: s.satisfactionPct, unit: 'pct', target: 90, status: s.satisfactionPct > 80 ? 'green' : 'amber', source: 'Communications' },
    { name: 'Escalations', value: s.escalationCount, unit: 'count', status: s.escalationCount === 0 ? 'green' : 'red', source: 'Notices' },
    { name: 'Onboarding', value: s.onboardingCount, unit: 'count', source: 'Invoices' },
  ];
}

function procurementKPIs(data: WorkforceDataView): EmployeeKPI[] {
  const p = data.procurement;
  return [
    { name: 'Vendors', value: p.vendorCount, unit: 'count', source: 'Purchase Bills' },
    { name: 'Pending Bills', value: p.pendingBills, unit: 'count', status: p.pendingBills === 0 ? 'green' : 'amber', source: 'Purchase Bills' },
    { name: 'Total Payables', value: p.totalPayables, unit: 'inr', status: p.totalPayables === 0 ? 'green' : 'amber', source: 'Digital Twin™' },
  ];
}

function technologyKPIs(data: WorkforceDataView): EmployeeKPI[] {
  const t = data.technology;
  return [
    { name: 'Data Connections', value: t.dataConnections, unit: 'count', source: 'Data Connections' },
    { name: 'Active Integrations', value: t.activeIntegrations, unit: 'count', status: t.activeIntegrations > 0 ? 'green' : 'red', source: 'Data Connections' },
    { name: 'Sync Errors', value: t.syncErrors, unit: 'count', status: t.syncErrors === 0 ? 'green' : 'red', source: 'Data Connections' },
    { name: 'Data Quality', value: t.dataQualityScore, unit: 'pct', target: 90, status: t.dataQualityScore > 80 ? 'green' : 'amber', source: 'Data Connections' },
  ];
}

function dataKPIs(data: WorkforceDataView): EmployeeKPI[] {
  const d = data.data;
  return [
    { name: 'Total Records', value: d.totalRecords, unit: 'count', source: 'All Sources' },
    { name: 'Data Sources', value: d.dataSources, unit: 'count', source: 'All Sources' },
    { name: 'Forecast Confidence', value: d.forecastConfidence, unit: 'pct', target: 70, status: d.forecastConfidence > 60 ? 'green' : 'amber', source: 'AI CFO™' },
  ];
}

function executiveKPIs(data: WorkforceDataView): EmployeeKPI[] {
  const e = data.executive;
  return [
    { name: 'Health Score', value: e.healthScore, unit: 'pct', target: 75, status: e.healthScore > 70 ? 'green' : e.healthScore > 40 ? 'amber' : 'red', source: 'AI CFO™' },
    { name: 'Risk Score', value: e.riskScore, unit: 'pct', status: e.riskScore < 30 ? 'green' : e.riskScore < 60 ? 'amber' : 'red', source: 'AI CFO™' },
    { name: 'Cash', value: e.cash, unit: 'inr', source: 'Banking' },
    { name: 'Revenue (MTD)', value: e.revenue, unit: 'inr', source: 'AI CFO™' },
    { name: 'Runway', value: e.runwayDays, unit: 'days', target: 180, source: 'AI CFO™' },
    { name: 'Clients', value: e.clients, unit: 'count', source: 'CRM' },
  ];
}

function departmentKPIs(role: EmployeeRole, data: WorkforceDataView): EmployeeKPI[] {
  const dept = getRoleDefinition(role).department;
  switch (dept) {
    case 'executive': return executiveKPIs(data);
    case 'finance': return financeKPIs(data);
    case 'operations': return operationsKPIs(data);
    case 'sales': return salesKPIs(data);
    case 'marketing': return marketingKPIs(data);
    case 'compliance': return complianceKPIs(data);
    case 'risk': return riskKPIs(data);
    case 'legal': return legalKPIs(data);
    case 'hr': return hrKPIs(data);
    case 'support': return supportKPIs(data);
    case 'procurement': return procurementKPIs(data);
    case 'technology': return technologyKPIs(data);
    case 'data': return dataKPIs(data);
    default: return [];
  }
}

// ─── Recommendation builders — real, data-driven ─────────────────────────────

function financeRecs(data: WorkforceDataView): EmployeeRecommendation[] {
  const f = data.finance;
  const recs: EmployeeRecommendation[] = [];
  if (f.overdueAmount > 0) {
    recs.push({
      title: `Recover ${formatINRShort(f.overdueAmount)} in overdue receivables`,
      rationale: `${f.outstandingInvoices} invoices are overdue, tying up working capital.`,
      impact: 'Improves cash position and reduces bad debt risk',
      priority: f.overdueAmount > 100000 ? 'critical' : 'high',
      estimatedValue: f.overdueAmount,
      suggestedAction: 'Send automated payment reminders via Sales AI',
    });
  }
  if (f.runwayDays < 90 && f.runwayDays > 0) {
    recs.push({
      title: `Cash runway is ${f.runwayDays} days — accelerate collections or arrange credit`,
      rationale: 'At current burn rate, cash will be exhausted within 3 months.',
      impact: 'Prevents liquidity crisis',
      priority: f.runwayDays < 30 ? 'critical' : 'high',
      estimatedValue: f.burnRate * 3,
      suggestedAction: 'Coordinate with CFO AI on credit line or expense reduction',
    });
  }
  if (f.gst > 0) {
    recs.push({
      title: `File GST return — ${formatINRShort(f.gst)} payable`,
      rationale: 'GST liability is pending. Late filing attracts penalties.',
      impact: 'Avoids penalties and compliance risk',
      priority: 'high',
      estimatedValue: f.gst * 0.18, // penalty estimate
      suggestedAction: 'Hand off to Compliance Manager AI',
    });
  }
  if (f.marginPct < 10 && f.revenue > 0) {
    recs.push({
      title: 'Margin below 10% — review pricing and expenses',
      rationale: `Current net margin is ${f.marginPct.toFixed(1)}%.`,
      impact: 'Improves profitability',
      priority: 'medium',
      suggestedAction: 'Coordinate with COO AI on cost optimization',
    });
  }
  return recs;
}

function operationsRecs(data: WorkforceDataView): EmployeeRecommendation[] {
  const o = data.operations;
  const recs: EmployeeRecommendation[] = [];
  if (o.openTasks > 5) {
    recs.push({
      title: `${o.openTasks} open tasks — prioritize or delegate`,
      rationale: 'Task backlog is building up, risking delivery delays.',
      impact: 'Improves delivery speed and client satisfaction',
      priority: 'medium',
      suggestedAction: 'Delegate to Operations Manager AI for triage',
    });
  }
  if (o.deliveryPending > 0) {
    recs.push({
      title: `${o.deliveryPending} deliveries pending`,
      rationale: 'Outstanding deliveries need tracking.',
      impact: 'Prevents SLA breaches',
      priority: 'medium',
    });
  }
  if (o.efficiencyPct < 60) {
    recs.push({
      title: 'Operational efficiency below 60% — automate repetitive tasks',
      rationale: `Current efficiency: ${o.efficiencyPct}%.`,
      impact: 'Reduces manual effort by up to 40%',
      priority: 'medium',
      suggestedAction: 'Work with CTO AI to identify automation opportunities',
    });
  }
  return recs;
}

function salesRecs(data: WorkforceDataView): EmployeeRecommendation[] {
  const s = data.sales;
  const recs: EmployeeRecommendation[] = [];
  if (s.pipelineValue > 0) {
    recs.push({
      title: `Follow up on ${formatINRShort(s.pipelineValue)} pipeline`,
      rationale: `${s.clientCount} clients with outstanding invoices represent active pipeline.`,
      impact: 'Accelerates revenue recognition',
      priority: 'high',
      estimatedValue: s.pipelineValue,
      suggestedAction: 'Hand off to Finance AI for invoicing',
    });
  }
  if (s.newClientsThisMonth === 0 && s.clientCount > 0) {
    recs.push({
      title: 'No new clients this month — coordinate with Marketing AI',
      rationale: 'Lead pipeline may be thin. Marketing AI can generate new leads.',
      impact: 'Drives revenue growth',
      priority: 'medium',
      suggestedAction: 'Request lead generation from Marketing Manager AI',
    });
  }
  if (s.topClients[0] && s.topClients[0].revenue > 0) {
    const topShare = s.topClients[0].revenue;
    recs.push({
      title: `Top client: ${s.topClients[0].name} (${formatINRShort(topShare)})`,
      rationale: 'Monitor concentration risk — coordinate with Risk Manager AI.',
      impact: 'Reduces revenue concentration',
      priority: 'low',
    });
  }
  return recs;
}

function marketingRecs(data: WorkforceDataView): EmployeeRecommendation[] {
  const m = data.marketing;
  const recs: EmployeeRecommendation[] = [];
  if (m.revenueGrowthPct < 0) {
    recs.push({
      title: 'Revenue declining — launch growth campaign',
      rationale: `Revenue is down ${Math.abs(m.revenueGrowthPct).toFixed(1)}% vs last month.`,
      impact: 'Reverses revenue decline',
      priority: 'high',
      suggestedAction: 'Propose campaign budget to CEO AI',
    });
  }
  if (m.leadCount === 0) {
    recs.push({
      title: 'No leads in pipeline — coordinate with Sales AI',
      rationale: 'Lead generation needs attention.',
      impact: 'Fills sales pipeline',
      priority: 'medium',
    });
  }
  if (m.campaignROI > 0) {
    recs.push({
      title: `Campaign ROI at ${m.campaignROI.toFixed(0)}% — scale winners`,
      rationale: 'Current campaigns are generating positive returns.',
      impact: 'Multiplies revenue growth',
      priority: 'medium',
    });
  }
  return recs;
}

function complianceRecs(data: WorkforceDataView): EmployeeRecommendation[] {
  const c = data.compliance;
  const recs: EmployeeRecommendation[] = [];
  if (c.overdueFilings > 0) {
    recs.push({
      title: `${c.overdueFilings} overdue GST filing(s) — file immediately`,
      rationale: 'Overdue filings attract daily penalties.',
      impact: 'Avoids penalties and legal action',
      priority: 'critical',
      estimatedValue: c.overdueFilings * 5000,
      suggestedAction: 'Escalate to CFO AI and Legal Advisor AI',
    });
  }
  if (c.notices > 0) {
    recs.push({
      title: `${c.notices} active notice(s) — respond within deadline`,
      rationale: 'Government notices require timely response.',
      impact: 'Prevents escalation and penalties',
      priority: 'high',
      suggestedAction: 'Coordinate with Legal Advisor AI for response drafting',
    });
  }
  if (c.itcAtRisk > 0) {
    recs.push({
      title: `${formatINRShort(c.itcAtRisk)} ITC at risk — reconcile vendor bills`,
      rationale: 'Input Tax Credit may be reversed if not reconciled.',
      impact: 'Preserves tax credit',
      priority: 'high',
      estimatedValue: c.itcAtRisk,
    });
  }
  return recs;
}

function riskRecs(data: WorkforceDataView): EmployeeRecommendation[] {
  const r = data.risk;
  const recs: EmployeeRecommendation[] = [];
  if (r.cashRisk === 'critical' || r.cashRisk === 'high') {
    recs.push({
      title: `Cash risk is ${r.cashRisk} — immediate action needed`,
      rationale: 'Runway is critically short.',
      impact: 'Prevents business insolvency',
      priority: 'critical',
      suggestedAction: 'Escalate to CEO AI and CFO AI immediately',
    });
  }
  if (r.concentrationRisk > 30) {
    recs.push({
      title: `Client concentration at ${r.concentrationRisk.toFixed(0)}% — diversify`,
      rationale: 'Top client represents too much revenue share.',
      impact: 'Reduces single-point-of-failure risk',
      priority: 'high',
      suggestedAction: 'Coordinate with Sales AI and Marketing AI on diversification',
    });
  }
  if (r.anomalies > 0) {
    recs.push({
      title: `${r.anomalies} anomaly/anomalies detected — investigate`,
      rationale: 'Digital Twin™ detected unusual patterns.',
      impact: 'Prevents fraud and operational issues',
      priority: 'high',
      suggestedAction: 'Coordinate with Data Analyst AI',
    });
  }
  return recs;
}

function legalRecs(data: WorkforceDataView): EmployeeRecommendation[] {
  const l = data.legal;
  const recs: EmployeeRecommendation[] = [];
  if (l.activeNotices > 0) {
    recs.push({
      title: `${l.activeNotices} active legal notice(s) — draft response`,
      rationale: 'Notices require formal legal response within deadlines.',
      impact: 'Prevents legal escalation',
      priority: 'high',
      suggestedAction: 'Coordinate with Compliance Manager AI',
    });
  }
  if (l.disputeCount > 0) {
    recs.push({
      title: `${l.disputeCount} dispute(s) — assess resolution options`,
      rationale: 'Disputes may require negotiation or legal action.',
      impact: 'Reduces legal exposure',
      priority: 'medium',
    });
  }
  return recs;
}

function hrRecs(data: WorkforceDataView): EmployeeRecommendation[] {
  const h = data.hr;
  const recs: EmployeeRecommendation[] = [];
  if (h.headcount === 0) {
    recs.push({
      title: 'No employees connected — sync HR/payroll system',
      rationale: 'HR data is not connected. Headcount and payroll unavailable.',
      impact: 'Enables workforce planning',
      priority: 'medium',
      suggestedAction: 'Request integration from CTO AI',
    });
  }
  if (h.payrollAmount > 0 && data.finance.cash < h.payrollAmount) {
    recs.push({
      title: 'Cash below monthly payroll — arrange funding',
      rationale: 'Next payroll may not be fully covered by current cash.',
      impact: 'Prevents payroll default',
      priority: 'critical',
      suggestedAction: 'Escalate to CFO AI',
    });
  }
  return recs;
}

function supportRecs(data: WorkforceDataView): EmployeeRecommendation[] {
  const s = data.support;
  const recs: EmployeeRecommendation[] = [];
  if (s.openTickets > 0) {
    recs.push({
      title: `${s.openTickets} open ticket(s) — prioritize resolution`,
      rationale: 'Open tickets impact customer satisfaction.',
      impact: 'Improves retention',
      priority: s.escalationCount > 0 ? 'high' : 'medium',
    });
  }
  if (s.escalationCount > 0) {
    recs.push({
      title: `${s.escalationCount} escalation(s) — CEO review needed`,
      rationale: 'Escalated tickets need executive attention.',
      impact: 'Prevents churn',
      priority: 'high',
      suggestedAction: 'Escalate to CEO AI',
    });
  }
  return recs;
}

function procurementRecs(data: WorkforceDataView): EmployeeRecommendation[] {
  const p = data.procurement;
  const recs: EmployeeRecommendation[] = [];
  if (p.pendingBills > 0) {
    recs.push({
      title: `${p.pendingBills} unpaid vendor bill(s) — schedule payment`,
      rationale: 'Vendor relationships depend on timely payment.',
      impact: 'Maintains supplier reliability',
      priority: 'medium',
      suggestedAction: 'Coordinate with Finance Manager AI',
    });
  }
  if (p.vendorCount === 1) {
    recs.push({
      title: 'Single vendor dependency — diversify suppliers',
      rationale: 'Over-reliance on one vendor creates supply chain risk.',
      impact: 'Reduces procurement risk',
      priority: 'medium',
      suggestedAction: 'Coordinate with Risk Manager AI',
    });
  }
  return recs;
}

function technologyRecs(data: WorkforceDataView): EmployeeRecommendation[] {
  const t = data.technology;
  const recs: EmployeeRecommendation[] = [];
  if (t.syncErrors > 0) {
    recs.push({
      title: `${t.syncErrors} integration error(s) — fix connections`,
      rationale: 'Data sync failures cause stale insights.',
      impact: 'Restores data freshness',
      priority: 'high',
    });
  }
  if (t.activeIntegrations === 0) {
    recs.push({
      title: 'No active data integrations — connect business sources',
      rationale: 'AI Workforce needs connected data to function.',
      impact: 'Activates all AI employees',
      priority: 'critical',
      suggestedAction: 'Guide user to Connections page',
    });
  }
  return recs;
}

function dataRecs(data: WorkforceDataView): EmployeeRecommendation[] {
  const d = data.data;
  const recs: EmployeeRecommendation[] = [];
  if (d.forecastConfidence < 50) {
    recs.push({
      title: 'Forecast confidence low — increase data history',
      rationale: `Current confidence: ${d.forecastConfidence}%. More historical data improves accuracy.`,
      impact: 'Better predictions across all departments',
      priority: 'medium',
    });
  }
  if (d.totalRecords < 50) {
    recs.push({
      title: 'Limited data records — connect more sources',
      rationale: `Only ${d.totalRecords} records available.`,
      impact: 'Enables deeper AI analysis',
      priority: 'medium',
    });
  }
  return recs;
}

function executiveRecs(data: WorkforceDataView): EmployeeRecommendation[] {
  const e = data.executive;
  const recs: EmployeeRecommendation[] = [];
  if (e.healthScore < 50) {
    recs.push({
      title: 'Business health below 50 — review department scorecards',
      rationale: `Overall health: ${e.healthScore}/100.`,
      impact: 'Reverses declining trajectory',
      priority: 'high',
      suggestedAction: 'Convene emergency leadership meeting',
    });
  }
  if (e.riskScore > 60) {
    recs.push({
      title: 'Risk score elevated — activate risk mitigation',
      rationale: `Risk: ${e.riskScore}/100.`,
      impact: 'Reduces business exposure',
      priority: 'high',
      suggestedAction: 'Direct Risk Manager AI to prepare mitigation plan',
    });
  }
  if (e.runwayDays < 90 && e.runwayDays > 0) {
    recs.push({
      title: `Runway ${e.runwayDays} days — prioritize cash generation`,
      rationale: 'Cash runway is short.',
      impact: 'Extends business survival',
      priority: 'critical',
      suggestedAction: 'Direct CFO AI to arrange credit line',
    });
  }
  return recs;
}

function departmentRecs(role: EmployeeRole, data: WorkforceDataView): EmployeeRecommendation[] {
  const dept = getRoleDefinition(role).department;
  switch (dept) {
    case 'executive': return executiveRecs(data);
    case 'finance': return financeRecs(data);
    case 'operations': return operationsRecs(data);
    case 'sales': return salesRecs(data);
    case 'marketing': return marketingRecs(data);
    case 'compliance': return complianceRecs(data);
    case 'risk': return riskRecs(data);
    case 'legal': return legalRecs(data);
    case 'hr': return hrRecs(data);
    case 'support': return supportRecs(data);
    case 'procurement': return procurementRecs(data) as EmployeeRecommendation[];
    case 'technology': return technologyRecs(data);
    case 'data': return dataRecs(data);
    default: return [];
  }
}

// ─── Alert / task / decision counts per department (from real data) ──────────

function departmentAlertCount(role: EmployeeRole, data: WorkforceDataView): number {
  return departmentRecs(role, data).filter((r) => r.priority === 'critical' || r.priority === 'high').length;
}

function departmentTaskCount(role: EmployeeRole, data: WorkforceDataView): number {
  const recs = departmentRecs(role, data);
  const ops = data.operations;
  // Each recommendation generates a task; plus department-specific baseline
  const dept = getRoleDefinition(role).department;
  let baseline = 0;
  if (dept === 'operations') baseline = ops.openTasks;
  if (dept === 'compliance') baseline = data.compliance.pendingFilings + data.compliance.notices;
  if (dept === 'support') baseline = data.support.openTickets;
  if (dept === 'finance') baseline = data.finance.outstandingInvoices;
  if (dept === 'procurement') baseline = data.procurement.pendingBills;
  return recs.length + baseline;
}

function departmentDecisionCount(role: EmployeeRole, data: WorkforceDataView): number {
  return departmentRecs(role, data).filter((r) => r.suggestedAction).length;
}

// ─── Formatter helper (avoid circular import — inline minimal version) ───────

function formatINRShort(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

// ─── Build a single AI employee ───────────────────────────────────────────────

function buildEmployee(
  def: RoleDefinition,
  data: WorkforceDataView,
): AIEmployee {
  const kpis = departmentKPIs(def.role, data);
  const recommendations = departmentRecs(def.role, data).slice(0, 5);
  const alertCount = departmentAlertCount(def.role, data);
  const taskCount = departmentTaskCount(def.role, data);
  const decisionCount = departmentDecisionCount(def.role, data);
  const healthScore = departmentHealth(def.role, data);
  const hasLiveData = data.hasLiveData;

  // Performance, memory, skills computed by their respective engines
  const performance = computeEmployeePerformance(def.role, data, healthScore, taskCount);
  const recentMemory = computeEmployeeMemory(def.role, data).slice(0, 5);
  const skills = computeEmployeeSkills(def.role, data).slice(0, 4);

  const status = detectStatus(def.role, data, alertCount, decisionCount, hasLiveData);

  return {
    role: def.role,
    name: def.name,
    title: def.title,
    department: def.department,
    tier: def.tier,
    reportsTo: def.reportsTo,
    directReports: def.directReports,
    status,
    healthScore,
    avatarColor: def.avatarColor,
    icon: def.icon,
    responsibilities: def.responsibilities,
    monitors: def.monitors,
    kpis,
    openTaskCount: taskCount,
    activeAlertCount: alertCount,
    pendingDecisionCount: decisionCount,
    recommendations,
    performance,
    recentMemory,
    skills,
    lastActiveAt: new Date().toISOString(),
    dataSources: def.dataSources,
    hasLiveData,
  };
}

// ─── Main: build the entire AI organization ──────────────────────────────────

export function computeOrganization(data: WorkforceDataView): AIEmployee[] {
  return ORGANIZATION.map((def) => buildEmployee(def, data));
}

// ─── Build a single employee by role (for detail views) ──────────────────────

export function computeEmployee(role: EmployeeRole, data: WorkforceDataView): AIEmployee {
  const def = getRoleDefinition(role);
  return buildEmployee(def, data);
}
