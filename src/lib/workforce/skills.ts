// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — AI SKILLS™ (continuous learning)
//
// Employees continuously learn. Finance AI learns tax changes. Sales AI learns
// customer objections. Marketing AI learns campaign performance. Support AI
// learns FAQs. Compliance AI learns new GST rules. Every skill level derives
// from REAL data volume + recency + forecast confidence.
//
// Tagline: "VEYRO AI Workforce™ — Don't just use AI. Build an AI Company."
// ═══════════════════════════════════════════════════════════════════════════════

import type { EmployeeRole, EmployeeSkill, SkillCategory } from './types';
import type { WorkforceDataView } from './data';
import { getRoleDefinition } from './organization';

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function deriveTrend(level: number, data: WorkforceDataView): 'improving' | 'stable' | 'declining' {
  if (data.data.forecastConfidence > 60 && level > 50) return 'improving';
  if (data.data.forecastConfidence < 30) return 'declining';
  return 'stable';
}

// ─── Per-role skill definitions ──────────────────────────────────────────────

interface SkillTemplate {
  name: string;
  category: SkillCategory;
  levelFromData: (data: WorkforceDataView) => number;
  learningsFromData: (data: WorkforceDataView) => number;
  insightFromData: (data: WorkforceDataView) => string;
}

const SKILL_TEMPLATES: Record<EmployeeRole, SkillTemplate[]> = {
  ceo: [
    {
      name: 'Strategic Planning',
      category: 'operations',
      levelFromData: (d) => clamp(d.executive.healthScore),
      learningsFromData: (d) => d.twin.timeline.totalCount,
      insightFromData: (d) => `Health ${d.executive.healthScore}/100, runway ${d.executive.runwayDays}d`,
    },
    {
      name: 'Risk Assessment',
      category: 'finance',
      levelFromData: (d) => clamp(100 - d.risk.overallRiskScore),
      learningsFromData: (d) => d.twin.anomalies.totalCount,
      insightFromData: (d) => `${d.risk.criticalRisks} critical, ${d.risk.highRisks} high risks`,
    },
    {
      name: 'Financial Acumen',
      category: 'finance',
      levelFromData: (d) => clamp(d.finance.marginPct > 0 ? 50 + d.finance.marginPct * 2 : 30),
      learningsFromData: (d) => d.raw.invoices.length,
      insightFromData: (d) => `Margin ${d.finance.marginPct.toFixed(1)}%, revenue ₹${Math.round(d.finance.revenue).toLocaleString('en-IN')}`,
    },
    {
      name: 'Leadership',
      category: 'hr',
      levelFromData: (d) => clamp(d.operations.employeeCount > 0 ? 80 : 40),
      learningsFromData: (d) => d.operations.employeeCount,
      insightFromData: (d) => `Managing ${d.operations.employeeCount} employees across departments`,
    },
  ],
  cfo: [
    {
      name: 'Cash Flow Management',
      category: 'finance',
      levelFromData: (d) => clamp(d.finance.runwayDays > 90 ? 90 : d.finance.runwayDays / 2),
      learningsFromData: (d) => d.raw.payments.length,
      insightFromData: (d) => `Runway ${d.finance.runwayDays}d, cash ₹${Math.round(d.finance.cash).toLocaleString('en-IN')}`,
    },
    {
      name: 'GST & Taxation',
      category: 'tax',
      levelFromData: (d) => clamp(d.compliance.overdueFilings === 0 ? 90 : 40),
      learningsFromData: (d) => d.raw.filings.length,
      insightFromData: (d) => `${d.compliance.pendingFilings} pending, ${d.compliance.overdueFilings} overdue`,
    },
    {
      name: 'Profitability Analysis',
      category: 'finance',
      levelFromData: (d) => clamp(d.finance.marginPct > 15 ? 90 : d.finance.marginPct > 0 ? 60 : 30),
      learningsFromData: (d) => d.raw.expenses.length,
      insightFromData: (d) => `Net margin ${d.finance.marginPct.toFixed(1)}%`,
    },
    {
      name: 'Collections Strategy',
      category: 'finance',
      levelFromData: (d) => clamp(d.finance.overdueAmount === 0 ? 90 : 100 - (d.finance.overdueAmount / Math.max(d.finance.receivables, 1)) * 50),
      learningsFromData: (d) => d.raw.invoices.length,
      insightFromData: (d) => `₹${Math.round(d.finance.overdueAmount).toLocaleString('en-IN')} overdue`,
    },
  ],
  coo: [
    {
      name: 'Operations Optimization',
      category: 'operations',
      levelFromData: (d) => clamp(d.operations.efficiencyPct),
      learningsFromData: (d) => d.twin.timeline.totalCount,
      insightFromData: (d) => `Efficiency ${d.operations.efficiencyPct}%, ${d.operations.openTasks} open tasks`,
    },
    {
      name: 'Workflow Automation',
      category: 'operations',
      levelFromData: (d) => clamp(d.operations.automationCount * 12),
      learningsFromData: (d) => d.operations.automationCount,
      insightFromData: (d) => `${d.operations.automationCount} automation rules active`,
    },
    {
      name: 'Team Coordination',
      category: 'hr',
      levelFromData: (d) => clamp(d.operations.employeeCount > 5 ? 85 : 50),
      learningsFromData: (d) => d.operations.employeeCount,
      insightFromData: (d) => `Coordinating ${d.operations.employeeCount} team members`,
    },
    {
      name: 'Delivery Management',
      category: 'operations',
      levelFromData: (d) => clamp(d.operations.deliveryPending === 0 ? 90 : 60),
      learningsFromData: (d) => d.raw.invoices.length,
      insightFromData: (d) => `${d.operations.deliveryPending} deliveries pending`,
    },
  ],
  cto: [
    {
      name: 'System Integration',
      category: 'technology',
      levelFromData: (d) => clamp(d.technology.dataQualityScore),
      learningsFromData: (d) => d.raw.dataConnections.length,
      insightFromData: (d) => `${d.technology.activeIntegrations}/${d.technology.dataConnections} integrations active`,
    },
    {
      name: 'Data Architecture',
      category: 'technology',
      levelFromData: (d) => clamp(d.data.totalRecords > 100 ? 85 : 40),
      learningsFromData: (d) => d.data.totalRecords,
      insightFromData: (d) => `${d.data.totalRecords} records across ${d.data.dataSources} sources`,
    },
    {
      name: 'Security & Compliance',
      category: 'compliance',
      levelFromData: (d) => clamp(d.technology.syncErrors === 0 ? 90 : 50),
      learningsFromData: (d) => d.technology.syncErrors,
      insightFromData: (d) => `${d.technology.syncErrors} sync errors`,
    },
  ],
  cmo: [
    {
      name: 'Growth Strategy',
      category: 'marketing',
      levelFromData: (d) => clamp(d.marketing.revenueGrowthPct > 5 ? 90 : d.marketing.revenueGrowthPct > 0 ? 60 : 30),
      learningsFromData: (d) => d.raw.invoices.length,
      insightFromData: (d) => `Growth ${d.marketing.revenueGrowthPct.toFixed(1)}% MoM`,
    },
    {
      name: 'Campaign Analytics',
      category: 'marketing',
      levelFromData: (d) => clamp(d.marketing.campaignROI > 100 ? 90 : 50),
      learningsFromData: (d) => d.marketing.leadCount,
      insightFromData: (d) => `Campaign ROI ${d.marketing.campaignROI.toFixed(0)}%`,
    },
    {
      name: 'Brand Management',
      category: 'marketing',
      levelFromData: (d) => clamp(d.marketing.brandEngagement),
      learningsFromData: (d) => d.raw.clients.length,
      insightFromData: (d) => `Engagement ${d.marketing.brandEngagement.toFixed(0)}%`,
    },
  ],
  chro: [
    {
      name: 'Workforce Planning',
      category: 'hr',
      levelFromData: (d) => clamp(d.hr.headcount > 0 ? 80 : 30),
      learningsFromData: (d) => d.hr.headcount,
      insightFromData: (d) => `${d.hr.headcount} employees, payroll ₹${Math.round(d.hr.payrollAmount).toLocaleString('en-IN')}`,
    },
    {
      name: 'Payroll Management',
      category: 'hr',
      levelFromData: (d) => clamp(d.hr.payrollAmount > 0 ? 85 : 40),
      learningsFromData: (d) => d.raw.employees.length,
      insightFromData: (d) => `Monthly payroll ₹${Math.round(d.hr.payrollAmount).toLocaleString('en-IN')}`,
    },
    {
      name: 'Compliance & Policy',
      category: 'compliance',
      levelFromData: (d) => clamp(d.compliance.complianceScore),
      learningsFromData: (d) => d.raw.filings.length,
      insightFromData: (d) => `Compliance score ${d.compliance.complianceScore}%`,
    },
  ],
  sales_manager: [
    {
      name: 'Pipeline Management',
      category: 'sales',
      levelFromData: (d) => clamp(d.sales.pipelineValue > 100000 ? 90 : 50),
      learningsFromData: (d) => d.raw.invoices.length,
      insightFromData: (d) => `Pipeline ₹${Math.round(d.sales.pipelineValue).toLocaleString('en-IN')}`,
    },
    {
      name: 'Client Acquisition',
      category: 'sales',
      levelFromData: (d) => clamp(d.sales.clientCount > 5 ? 85 : 40),
      learningsFromData: (d) => d.raw.clients.length,
      insightFromData: (d) => `${d.sales.clientCount} clients, ${d.sales.newClientsThisMonth} new this month`,
    },
    {
      name: 'Negotiation',
      category: 'sales',
      levelFromData: (d) => clamp(d.sales.avgDealSize > 50000 ? 85 : 50),
      learningsFromData: (d) => d.raw.invoices.length,
      insightFromData: (d) => `Avg deal ₹${Math.round(d.sales.avgDealSize).toLocaleString('en-IN')}`,
    },
  ],
  marketing_manager: [
    {
      name: 'Lead Generation',
      category: 'marketing',
      levelFromData: (d) => clamp(d.marketing.leadCount > 0 ? 80 : 30),
      learningsFromData: (d) => d.marketing.leadCount,
      insightFromData: (d) => `${d.marketing.leadCount} leads in pipeline`,
    },
    {
      name: 'Content Strategy',
      category: 'marketing',
      levelFromData: (d) => clamp(d.marketing.brandEngagement),
      learningsFromData: (d) => d.raw.clients.length,
      insightFromData: (d) => `Engagement at ${d.marketing.brandEngagement.toFixed(0)}%`,
    },
    {
      name: 'Campaign Optimization',
      category: 'marketing',
      levelFromData: (d) => clamp(d.marketing.campaignROI > 100 ? 90 : 50),
      learningsFromData: (d) => d.marketing.leadCount,
      insightFromData: (d) => `ROI ${d.marketing.campaignROI.toFixed(0)}%`,
    },
  ],
  finance_manager: [
    {
      name: 'Invoice Processing',
      category: 'finance',
      levelFromData: (d) => clamp(d.raw.invoices.length > 10 ? 90 : 50),
      learningsFromData: (d) => d.raw.invoices.length,
      insightFromData: (d) => `${d.raw.invoices.length} invoices processed`,
    },
    {
      name: 'Reconciliation',
      category: 'finance',
      levelFromData: (d) => clamp(d.raw.payments.filter((p) => p.reconciled).length > 0 ? 85 : 40),
      learningsFromData: (d) => d.raw.payments.length,
      insightFromData: (d) => `${d.raw.payments.filter((p) => p.reconciled).length}/${d.raw.payments.length} payments reconciled`,
    },
    {
      name: 'Expense Tracking',
      category: 'finance',
      levelFromData: (d) => clamp(d.raw.expenses.length > 5 ? 85 : 40),
      learningsFromData: (d) => d.raw.expenses.length,
      insightFromData: (d) => `${d.raw.expenses.length} expenses tracked`,
    },
  ],
  compliance_manager: [
    {
      name: 'GST Filing',
      category: 'tax',
      levelFromData: (d) => clamp(d.compliance.overdueFilings === 0 ? 90 : 30),
      learningsFromData: (d) => d.raw.filings.length,
      insightFromData: (d) => `${d.compliance.pendingFilings} pending, ${d.compliance.overdueFilings} overdue`,
    },
    {
      name: 'Notice Management',
      category: 'compliance',
      levelFromData: (d) => clamp(d.raw.notices.length === 0 ? 90 : 60),
      learningsFromData: (d) => d.raw.notices.length,
      insightFromData: (d) => `${d.raw.notices.length} notices, ${d.compliance.upcomingDeadlines} deadlines`,
    },
    {
      name: 'ITC Reconciliation',
      category: 'tax',
      levelFromData: (d) => clamp(d.compliance.itcAtRisk === 0 ? 90 : 40),
      learningsFromData: (d) => d.raw.purchaseBills.length,
      insightFromData: (d) => `₹${Math.round(d.compliance.itcAtRisk).toLocaleString('en-IN')} ITC at risk`,
    },
  ],
  support_manager: [
    {
      name: 'Ticket Resolution',
      category: 'support',
      levelFromData: (d) => clamp(d.support.openTickets === 0 ? 90 : 60),
      learningsFromData: (d) => d.raw.notices.length,
      insightFromData: (d) => `${d.support.openTickets} open, ${d.support.escalationCount} escalated`,
    },
    {
      name: 'Customer Success',
      category: 'support',
      levelFromData: (d) => clamp(d.support.satisfactionPct),
      learningsFromData: (d) => d.raw.clients.length,
      insightFromData: (d) => `Satisfaction ${d.support.satisfactionPct}%`,
    },
  ],
  operations_manager: [
    {
      name: 'Task Management',
      category: 'operations',
      levelFromData: (d) => clamp(d.operations.openTasks < 5 ? 90 : 50),
      learningsFromData: (d) => d.operations.taskCount,
      insightFromData: (d) => `${d.operations.openTasks} open tasks`,
    },
    {
      name: 'Process Automation',
      category: 'operations',
      levelFromData: (d) => clamp(d.operations.automationCount * 12),
      learningsFromData: (d) => d.operations.automationCount,
      insightFromData: (d) => `${d.operations.automationCount} automations running`,
    },
  ],
  data_analyst: [
    {
      name: 'Data Analysis',
      category: 'technology',
      levelFromData: (d) => clamp(d.data.totalRecords > 50 ? 90 : 40),
      learningsFromData: (d) => d.data.totalRecords,
      insightFromData: (d) => `${d.data.totalRecords} records analyzed`,
    },
    {
      name: 'Forecasting',
      category: 'technology',
      levelFromData: (d) => clamp(d.data.forecastConfidence),
      learningsFromData: (d) => d.twin.timeline.totalCount,
      insightFromData: (d) => `Forecast confidence ${d.data.forecastConfidence}%`,
    },
    {
      name: 'Anomaly Detection',
      category: 'technology',
      levelFromData: (d) => clamp(d.risk.anomalies === 0 ? 85 : 60),
      learningsFromData: (d) => d.risk.anomalies,
      insightFromData: (d) => `${d.risk.anomalies} anomalies detected`,
    },
  ],
  risk_manager: [
    {
      name: 'Fraud Detection',
      category: 'compliance',
      levelFromData: (d) => clamp(d.risk.anomalies === 0 ? 90 : 60),
      learningsFromData: (d) => d.risk.anomalies,
      insightFromData: (d) => `${d.risk.anomalies} anomalies monitored`,
    },
    {
      name: 'Credit Risk',
      category: 'finance',
      levelFromData: (d) => clamp(d.risk.concentrationRisk < 30 ? 90 : 50),
      learningsFromData: (d) => d.raw.clients.length,
      insightFromData: (d) => `Concentration ${d.risk.concentrationRisk.toFixed(0)}%`,
    },
    {
      name: 'Compliance Risk',
      category: 'compliance',
      levelFromData: (d) => clamp(d.compliance.overdueFilings === 0 ? 90 : 40),
      learningsFromData: (d) => d.raw.filings.length,
      insightFromData: (d) => `${d.compliance.overdueFilings} overdue filings`,
    },
  ],
  procurement_manager: [
    {
      name: 'Vendor Management',
      category: 'operations',
      levelFromData: (d) => clamp(d.procurement.vendorCount > 3 ? 85 : 40),
      learningsFromData: (d) => d.raw.purchaseBills.length,
      insightFromData: (d) => `${d.procurement.vendorCount} vendors, ${d.procurement.pendingBills} pending bills`,
    },
    {
      name: 'Cost Optimization',
      category: 'finance',
      levelFromData: (d) => clamp(d.procurement.totalPayables > 0 ? 75 : 40),
      learningsFromData: (d) => d.raw.purchaseBills.length,
      insightFromData: (d) => `₹${Math.round(d.procurement.totalPayables).toLocaleString('en-IN')} payables managed`,
    },
  ],
  legal_advisor: [
    {
      name: 'Contract Review',
      category: 'legal',
      levelFromData: (d) => clamp(d.legal.activeNotices === 0 ? 90 : 50),
      learningsFromData: (d) => d.raw.notices.length,
      insightFromData: (d) => `${d.legal.activeNotices} active notices`,
    },
    {
      name: 'Regulatory Compliance',
      category: 'compliance',
      levelFromData: (d) => clamp(d.compliance.complianceScore),
      learningsFromData: (d) => d.raw.filings.length,
      insightFromData: (d) => `Compliance ${d.compliance.complianceScore}%`,
    },
  ],
  customer_success: [
    {
      name: 'Client Onboarding',
      category: 'support',
      levelFromData: (d) => clamp(d.support.onboardingCount > 0 ? 80 : 50),
      learningsFromData: (d) => d.support.onboardingCount,
      insightFromData: (d) => `${d.support.onboardingCount} clients onboarding`,
    },
    {
      name: 'Account Management',
      category: 'sales',
      levelFromData: (d) => clamp(d.sales.clientCount > 0 ? 85 : 40),
      learningsFromData: (d) => d.raw.clients.length,
      insightFromData: (d) => `Managing ${d.sales.activeClients} active accounts`,
    },
    {
      name: 'Retention Strategy',
      category: 'support',
      levelFromData: (d) => clamp(d.support.satisfactionPct),
      learningsFromData: (d) => d.raw.clients.length,
      insightFromData: (d) => `Satisfaction ${d.support.satisfactionPct}%`,
    },
  ],
};

// ─── Main: compute skills for one employee ───────────────────────────────────

export function computeEmployeeSkills(
  role: EmployeeRole,
  data: WorkforceDataView,
): EmployeeSkill[] {
  const templates = SKILL_TEMPLATES[role] ?? [];
  const now = new Date().toISOString();

  return templates.map((t) => {
    const level = t.levelFromData(data);
    const learningsCount = t.learningsFromData(data);
    const recentInsight = t.insightFromData(data);
    const trend = deriveTrend(level, data);

    return {
      role,
      name: t.name,
      category: t.category,
      level,
      lastUpdated: now,
      learningsCount,
      recentInsight,
      trend,
    };
  });
}
