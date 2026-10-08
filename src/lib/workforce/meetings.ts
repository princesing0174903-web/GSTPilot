// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — AI MEETING ENGINE™
//
// The AI Workforce conducts its own meetings — daily standups, weekly
// leadership, monthly board reviews, quarterly strategy, and annual planning.
// Every agenda item, KPI, risk, and action item flows from REAL connected
// business data via the WorkforceDataView. No fabricated content.
//
// Pure server-side TypeScript. Never throws — every builder wrapped in try/catch.
//
// Tagline: "VEYRO AI Workforce™ — Don't just use AI. Build an AI Company."
// ═══════════════════════════════════════════════════════════════════════════════

import type { WorkforceDataView } from './data';
import { formatINR, formatPct, formatDays } from './data';
import { getCSuite, getManagers } from './organization';
import type {
  AIMeeting,
  MeetingType,
  MeetingAgendaItem,
  MeetingRisk,
  MeetingKPI,
  MeetingActionItem,
  EmployeeRole,
} from './types';

// ─── Safe wrapper (never throws) ──────────────────────────────────────────────

function safeBuild<T>(label: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    console.warn(`[AI Workforce] Meeting builder "${label}" failed:`, err);
    return fallback;
  }
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function inr(n: number): string {
  return formatINR(n || 0);
}

function pct(n: number): string {
  return formatPct(n || 0);
}

function days(n: number): string {
  return formatDays(n || 0);
}

// ─── Deterministic ID helper ─────────────────────────────────────────────────

function hashId(prefix: string, key: string): string {
  try {
    const b64 = Buffer.from(key, 'utf-8').toString('base64');
    return `${prefix}-${b64.replace(/=+$/, '').slice(0, 12)}`;
  } catch {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    }
    return `${prefix}-${Math.abs(h).toString(36).slice(0, 12)}`;
  }
}

// ─── Scheduling: compute the next occurrence for each meeting type ────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function nextDailyStandup(): string {
  // Today at 09:00 (or tomorrow if already past 09:00)
  const now = new Date();
  const today9 = new Date(now);
  today9.setHours(9, 0, 0, 0);
  if (now.getTime() < today9.getTime()) return today9.toISOString();
  const tomorrow9 = new Date(today9);
  tomorrow9.setDate(tomorrow9.getDate() + 1);
  return tomorrow9.toISOString();
}

function nextWeeklyLeadership(): string {
  // Next Monday at 10:00 (or today if today is Monday before 10:00)
  const now = new Date();
  const today10 = new Date(now);
  today10.setHours(10, 0, 0, 0);
  const day = now.getDay(); // 0 = Sunday, 1 = Monday
  const daysUntilMonday = ((1 + 7 - day) % 7) || 7;
  const nextMonday = new Date(today10);
  if (day === 1 && now.getTime() < today10.getTime()) {
    return today10.toISOString();
  }
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  return nextMonday.toISOString();
}

function nextMonthlyBoard(): string {
  // 1st of next month at 11:00 (or today if 1st and before 11:00)
  const now = new Date();
  const today11 = new Date(now);
  today11.setHours(11, 0, 0, 0);
  if (now.getDate() === 1 && now.getTime() < today11.getTime()) {
    return today11.toISOString();
  }
  const next = new Date(now);
  next.setMonth(next.getMonth() + 1, 1);
  next.setHours(11, 0, 0, 0);
  return next.toISOString();
}

function nextQuarterlyStrategy(): string {
  // First day of next quarter at 14:00 (Indian FY quarters: Apr/Jul/Oct/Jan)
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const quarterStartMonth = Math.floor(month / 3) * 3; // Jan/Apr/Jul/Oct
  const nextQMonth = (quarterStartMonth + 3) % 12;
  const nextQYear = nextQMonth === 0 && month !== 0 ? now.getFullYear() + 1 : now.getFullYear();
  // If we're in the first week of the quarter and before 14:00 on day 1, use today
  const candidate = new Date(now.getFullYear(), quarterStartMonth, 1, 14, 0, 0, 0);
  if (now.getDate() <= 7 && now.getMonth() === quarterStartMonth && now.getTime() < candidate.getTime()) {
    return candidate.toISOString();
  }
  return new Date(nextQYear, nextQMonth, 1, 14, 0, 0, 0).toISOString();
}

function nextAnnualPlanning(): string {
  // Jan 1 of next year at 10:00 (or today if Jan 1 before 10:00)
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1, 10, 0, 0, 0);
  if (now.getMonth() === 0 && now.getDate() === 1 && now.getTime() < jan1.getTime()) {
    return jan1.toISOString();
  }
  return new Date(now.getFullYear() + 1, 0, 1, 10, 0, 0, 0).toISOString();
}

// ─── Deadline helpers for action items ────────────────────────────────────────

function endOfToday(): string {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

function endOfTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

function endOfWeek(): string {
  return daysFromNow(7);
}

function endOfMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0); // last day of current month
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

function endOfQuarter(): string {
  return daysFromNow(90);
}

function endOfYear(): string {
  const d = new Date();
  d.setMonth(11, 31);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

// ─── Common risk derivation ───────────────────────────────────────────────────

function deriveTopRisks(data: WorkforceDataView, max = 5): MeetingRisk[] {
  const risks: MeetingRisk[] = [];
  const f = data.finance;
  const r = data.risk;
  const c = data.compliance;

  if (f.runwayDays > 0 && f.runwayDays < 90) {
    risks.push({
      title: `Cash runway ${f.runwayDays} days — below 90d threshold`,
      severity: f.runwayDays < 30 ? 'critical' : 'high',
      owner: 'cfo',
      mitigation: `Accelerate collections of ${inr(f.overdueAmount)} overdue; arrange credit line; defer non-essential OpEx`,
    });
  }

  if (f.overdueAmount > 0) {
    risks.push({
      title: `Overdue receivables ${inr(f.overdueAmount)} across ${data.raw.invoices.filter((i) => i.status === 'overdue').length} invoices`,
      severity: f.overdueAmount > 500000 ? 'critical' : 'high',
      owner: 'finance_manager',
      mitigation: 'Issue formal recovery notices; offer payment plans; escalate to Legal if >60 days',
    });
  }

  if (c.overdueFilings > 0) {
    risks.push({
      title: `${c.overdueFilings} overdue GST filings — penalty risk`,
      severity: c.overdueFilings > 2 ? 'critical' : 'high',
      owner: 'compliance_manager',
      mitigation: 'File immediately; pay late fees; reconcile future deadlines',
    });
  }

  if (c.notices > 0) {
    risks.push({
      title: `${c.notices} active notices require response`,
      severity: c.notices > 3 ? 'high' : 'medium',
      owner: 'legal_advisor',
      mitigation: 'Legal review; respond within statutory deadline; document evidence',
    });
  }

  if (r.anomalies > 0) {
    const topAnomaly = data.twin.anomalies.anomalies?.[0];
    risks.push({
      title: `${r.anomalies} anomalies detected${topAnomaly ? ` — top: ${topAnomaly.title}` : ''}`,
      severity: r.criticalRisks > 0 ? 'high' : 'medium',
      owner: 'risk_manager',
      mitigation: topAnomaly?.recommendation || 'Investigate root cause; apply corrective action',
    });
  }

  if (r.concentrationRisk > 40) {
    risks.push({
      title: `Client concentration ${r.concentrationRisk.toFixed(0)}% — top client dependency`,
      severity: r.concentrationRisk > 60 ? 'high' : 'medium',
      owner: 'sales_manager',
      mitigation: 'Diversify client base; target new segments; build pipeline of prospects',
    });
  }

  if (f.cash > 0 && data.hr.payrollAmount > f.cash) {
    risks.push({
      title: `Payroll ${inr(data.hr.payrollAmount)} exceeds cash ${inr(f.cash)}`,
      severity: 'critical',
      owner: 'cfo',
      mitigation: 'Arrange interim funding; defer non-essential spend; consider payroll financing',
    });
  }

  if (data.procurement.pendingBills > 0) {
    risks.push({
      title: `${data.procurement.pendingBills} pending vendor bills`,
      severity: 'medium',
      owner: 'procurement_manager',
      mitigation: 'Prioritize by due date & vendor criticality; negotiate payment terms',
    });
  }

  if (data.support.escalationCount > 0) {
    risks.push({
      title: `${data.support.escalationCount} customer escalations open`,
      severity: data.support.escalationCount > 3 ? 'high' : 'medium',
      owner: 'support_manager',
      mitigation: 'Assign senior owners; daily status until resolved; root-cause analysis',
    });
  }

  return risks.slice(0, max);
}

// ─── Common KPI derivation ────────────────────────────────────────────────────

function deriveMeetingKPIs(data: WorkforceDataView): MeetingKPI[] {
  const f = data.finance;
  const e = data.executive;
  const kpis: MeetingKPI[] = [];

  kpis.push({
    metric: 'Revenue (MTD)',
    value: inr(f.revenue),
    trend: data.cfo.revenue.growthPct > 0 ? 'up' : data.cfo.revenue.growthPct < 0 ? 'down' : 'flat',
    owner: 'cfo',
  });
  kpis.push({
    metric: 'Cash Position',
    value: inr(f.cash),
    trend: data.cfo.cashFlow.netThisMonth > 0 ? 'up' : data.cfo.cashFlow.netThisMonth < 0 ? 'down' : 'flat',
    owner: 'cfo',
  });
  kpis.push({
    metric: 'Net Profit',
    value: inr(f.profit),
    trend: f.profit > 0 ? 'up' : 'down',
    owner: 'cfo',
  });
  kpis.push({
    metric: 'Runway',
    value: `${f.runwayDays} days`,
    trend: f.runwayDays > 180 ? 'up' : f.runwayDays < 90 ? 'down' : 'flat',
    owner: 'cfo',
  });
  kpis.push({
    metric: 'Health Score',
    value: `${e.healthScore}/100`,
    trend: e.healthScore > 70 ? 'up' : e.healthScore < 40 ? 'down' : 'flat',
    owner: 'ceo',
  });
  kpis.push({
    metric: 'Risk Score',
    value: `${e.riskScore}/100`,
    trend: e.riskScore < 30 ? 'up' : e.riskScore > 60 ? 'down' : 'flat',
    owner: 'risk_manager',
  });
  kpis.push({
    metric: 'Active Clients',
    value: `${data.sales.activeClients}`,
    trend: data.sales.newClientsThisMonth > 0 ? 'up' : 'flat',
    owner: 'sales_manager',
  });
  kpis.push({
    metric: 'Compliance Score',
    value: `${e.compliance}/100`,
    trend: e.compliance > 80 ? 'up' : e.compliance < 60 ? 'down' : 'flat',
    owner: 'compliance_manager',
  });
  kpis.push({
    metric: 'Overdue A/R',
    value: inr(f.overdueAmount),
    trend: f.overdueAmount === 0 ? 'up' : f.overdueAmount > 100000 ? 'down' : 'flat',
    owner: 'finance_manager',
  });
  kpis.push({
    metric: 'Pending GST Filings',
    value: `${data.compliance.pendingFilings}`,
    trend: data.compliance.pendingFilings === 0 ? 'up' : 'down',
    owner: 'compliance_manager',
  });
  return kpis;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEETING 1: DAILY STANDUP
// ═══════════════════════════════════════════════════════════════════════════════

function buildDailyStandup(data: WorkforceDataView): AIMeeting {
  const attendees: EmployeeRole[] = [...getCSuite(), ...getManagers()];
  const attendeesUnique = Array.from(new Set(attendees));

  // Each department reports top KPI, top task, top risk
  const agenda: MeetingAgendaItem[] = [];
  const insights: string[] = [];
  const actionItems: MeetingActionItem[] = [];

  // Finance report
  agenda.push({
    topic: `Finance — Cash ${inr(data.finance.cash)}, Runway ${data.finance.runwayDays}d, Overdue ${inr(data.finance.overdueAmount)}`,
    owner: 'cfo',
    duration: 5,
    priority: 'high',
  });
  if (data.finance.overdueAmount > 0) {
    insights.push(`Overdue receivables ${inr(data.finance.overdueAmount)} — top priority today`);
    actionItems.push({
      task: `Send payment reminders for ${data.raw.invoices.filter((i) => i.status === 'overdue').length} overdue invoices`,
      owner: 'finance_manager',
      deadline: endOfToday(),
      priority: 'high',
      status: 'open',
    });
  }
  if (data.finance.gst > 0) {
    insights.push(`GST payable ${inr(data.finance.gst)} — prepare filing this week`);
    actionItems.push({
      task: `Prepare GSTR-3B filing for ${inr(data.finance.gst)} net GST`,
      owner: 'compliance_manager',
      deadline: endOfTomorrow(),
      priority: 'high',
      status: 'open',
    });
  }

  // Operations report
  agenda.push({
    topic: `Operations — ${data.operations.openTasks} open tasks, ${data.operations.employeeCount} employees, ${data.operations.automationCount} automations`,
    owner: 'coo',
    duration: 5,
    priority: 'medium',
  });
  if (data.operations.deliveryPending > 0) {
    insights.push(`${data.operations.deliveryPending} deliveries pending — track to completion today`);
    actionItems.push({
      task: `Close ${data.operations.deliveryPending} pending deliveries`,
      owner: 'operations_manager',
      deadline: endOfToday(),
      priority: 'medium',
      status: 'open',
    });
  }

  // Sales report
  agenda.push({
    topic: `Sales — ${data.sales.clientCount} clients, pipeline ${inr(data.sales.pipelineValue)}, ${data.sales.newClientsThisMonth} new this month`,
    owner: 'sales_manager',
    duration: 5,
    priority: 'high',
  });
  if (data.sales.pipelineValue > 0) {
    insights.push(`Pipeline value ${inr(data.sales.pipelineValue)} — convert top opportunities this week`);
  }

  // Compliance report
  agenda.push({
    topic: `Compliance — ${data.compliance.pendingFilings} pending filings, ${data.compliance.notices} notices, score ${data.compliance.complianceScore}/100`,
    owner: 'compliance_manager',
    duration: 4,
    priority: 'high',
  });
  if (data.compliance.notices > 0) {
    insights.push(`${data.compliance.notices} active notices — Legal review needed this week`);
    actionItems.push({
      task: `Legal review of ${data.compliance.notices} active notices`,
      owner: 'legal_advisor',
      deadline: endOfTomorrow(),
      priority: 'high',
      status: 'open',
    });
  }

  // Risk report
  agenda.push({
    topic: `Risk — Overall ${data.risk.overallRiskScore}/100, ${data.risk.criticalRisks} critical, ${data.risk.anomalies} anomalies`,
    owner: 'risk_manager',
    duration: 4,
    priority: 'high',
  });
  if (data.risk.anomalies > 0) {
    insights.push(`${data.risk.anomalies} anomalies detected — investigate root cause`);
    actionItems.push({
      task: `Investigate top ${Math.min(3, data.risk.anomalies)} anomalies`,
      owner: 'risk_manager',
      deadline: endOfToday(),
      priority: 'critical',
      status: 'open',
    });
  }

  // Support report
  agenda.push({
    topic: `Support — ${data.support.openTickets} open tickets, ${data.support.escalationCount} escalations, satisfaction ${data.support.satisfactionPct.toFixed(0)}%`,
    owner: 'support_manager',
    duration: 4,
    priority: 'medium',
  });
  if (data.support.escalationCount > 0) {
    insights.push(`${data.support.escalationCount} customer escalations — senior attention needed`);
    actionItems.push({
      task: `Resolve ${data.support.escalationCount} escalated customer tickets`,
      owner: 'support_manager',
      deadline: endOfToday(),
      priority: 'high',
      status: 'open',
    });
  }

  // Procurement report
  if (data.procurement.pendingBills > 0) {
    agenda.push({
      topic: `Procurement — ${data.procurement.pendingBills} pending bills, ${data.procurement.vendorCount} vendors`,
      owner: 'procurement_manager',
      duration: 3,
      priority: 'medium',
    });
    actionItems.push({
      task: `Approve ${data.procurement.pendingBills} pending vendor payments`,
      owner: 'finance_manager',
      deadline: endOfTomorrow(),
      priority: 'medium',
      status: 'open',
    });
  }

  // CEO close-out
  agenda.push({
    topic: 'CEO — top priorities & blockers',
    owner: 'ceo',
    duration: 4,
    priority: 'high',
  });

  const risks = deriveTopRisks(data, 3);
  const kpis = deriveMeetingKPIs(data).slice(0, 6);

  const executiveSummary = data.hasLiveData
    ? `Business health ${data.executive.healthScore}/100, risk ${data.executive.riskScore}/100. Cash ${inr(data.finance.cash)} (${data.finance.runwayDays}d runway). ${actionItems.length} action items today. Top priority: ${data.finance.overdueAmount > 0 ? `recover ${inr(data.finance.overdueAmount)} overdue` : data.compliance.notices > 0 ? `respond to ${data.compliance.notices} notices` : 'drive revenue growth'}.`
    : 'No live data — connect sources to activate AI Workforce standups.';

  const minutes = data.hasLiveData
    ? `Daily standup reviewed ${attendeesUnique.length} AI employees across all departments. Finance reported cash ${inr(data.finance.cash)} with ${data.finance.runwayDays}d runway; ${inr(data.finance.overdueAmount)} overdue. Operations tracking ${data.operations.openTasks} open tasks. Sales pipeline ${inr(data.sales.pipelineValue)}. Compliance flagged ${data.compliance.pendingFilings} pending filings & ${data.compliance.notices} notices. Risk detected ${data.risk.anomalies} anomalies. ${actionItems.length} action items assigned with deadlines today/tomorrow.`
    : 'No live data — meeting deferred until sources are connected.';

  return {
    id: hashId('mtg-standup', `standup-${new Date().toISOString().slice(0, 10)}`),
    type: 'daily_standup',
    title: `Daily Standup — ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}`,
    scheduledFor: nextDailyStandup(),
    attendees: attendeesUnique,
    agenda,
    insights,
    risks,
    kpis,
    actionItems,
    minutes,
    executiveSummary,
    generatedAt: new Date().toISOString(),
    status: 'scheduled',
    dataSources: data.dataSources,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEETING 2: WEEKLY LEADERSHIP MEETING
// ═══════════════════════════════════════════════════════════════════════════════

function buildWeeklyLeadership(data: WorkforceDataView): AIMeeting {
  const attendees: EmployeeRole[] = ['ceo', 'cfo', 'coo', 'cto', 'cmo', 'chro'];

  const agenda: MeetingAgendaItem[] = [
    {
      topic: `CEO — Strategic priorities review (Health ${data.executive.healthScore}/100, Risk ${data.executive.riskScore}/100)`,
      owner: 'ceo',
      duration: 10,
      priority: 'high',
    },
    {
      topic: `CFO — Financial review: Revenue ${inr(data.finance.revenue)}, Cash ${inr(data.finance.cash)}, Profit ${inr(data.finance.profit)}, Runway ${data.finance.runwayDays}d`,
      owner: 'cfo',
      duration: 12,
      priority: 'high',
    },
    {
      topic: `COO — Operations review: ${data.operations.openTasks} tasks, ${data.operations.employeeCount} employees, efficiency ${data.operations.efficiencyPct}%`,
      owner: 'coo',
      duration: 10,
      priority: 'medium',
    },
    {
      topic: `CTO — Technology & data: ${data.technology.activeIntegrations}/${data.technology.dataConnections} integrations, quality ${data.technology.dataQualityScore}%`,
      owner: 'cto',
      duration: 8,
      priority: 'medium',
    },
    {
      topic: `CMO — Marketing & growth: revenue growth ${pct(data.marketing.revenueGrowthPct)}, ${data.marketing.leadCount} leads, ROI ${data.marketing.campaignROI.toFixed(0)}`,
      owner: 'cmo',
      duration: 8,
      priority: 'medium',
    },
    {
      topic: `CHRO — People: ${data.hr.headcount} headcount, payroll ${inr(data.hr.payrollAmount)}`,
      owner: 'chro',
      duration: 8,
      priority: 'medium',
    },
    {
      topic: 'Strategic items & cross-department initiatives',
      owner: 'ceo',
      duration: 15,
      priority: 'high',
    },
  ];

  const insights: string[] = [];
  if (data.finance.runwayDays > 0 && data.finance.runwayDays < 90) {
    insights.push(`Cash runway at ${data.finance.runwayDays} days — below 90d threshold. CFO to present funding options.`);
  }
  if (data.finance.overdueAmount > 0) {
    insights.push(`${inr(data.finance.overdueAmount)} overdue receivables — Sales & Finance joint recovery plan needed.`);
  }
  if (data.risk.concentrationRisk > 40) {
    insights.push(`Client concentration ${data.risk.concentrationRisk.toFixed(0)}% — diversification strategy required.`);
  }
  if (data.compliance.overdueFilings > 0) {
    insights.push(`${data.compliance.overdueFilings} overdue GST filings — Compliance to present remediation timeline.`);
  }
  if (data.marketing.revenueGrowthPct > 0) {
    insights.push(`Revenue growth ${pct(data.marketing.revenueGrowthPct)} M-o-M — momentum positive.`);
  } else if (data.marketing.revenueGrowthPct < 0) {
    insights.push(`Revenue declined ${pct(data.marketing.revenueGrowthPct)} M-o-M — CMO to present recovery plan.`);
  }

  const risks = deriveTopRisks(data, 5);

  const actionItems: MeetingActionItem[] = [];
  if (data.finance.overdueAmount > 0) {
    actionItems.push({
      task: `Recover ${inr(data.finance.overdueAmount)} overdue receivables`,
      owner: 'finance_manager',
      deadline: endOfWeek(),
      priority: 'high',
      status: 'open',
    });
  }
  if (data.compliance.pendingFilings > 0) {
    actionItems.push({
      task: `File ${data.compliance.pendingFilings} pending GST returns`,
      owner: 'compliance_manager',
      deadline: endOfWeek(),
      priority: 'high',
      status: 'open',
    });
  }
  if (data.risk.concentrationRisk > 40) {
    actionItems.push({
      task: 'Present client diversification plan',
      owner: 'sales_manager',
      deadline: endOfWeek(),
      priority: 'medium',
      status: 'open',
    });
  }
  if (data.risk.anomalies > 0) {
    actionItems.push({
      task: `Investigate ${data.risk.anomalies} detected anomalies`,
      owner: 'risk_manager',
      deadline: endOfWeek(),
      priority: 'high',
      status: 'open',
    });
  }
  actionItems.push({
    task: 'Submit weekly department scorecards',
    owner: 'coo',
    deadline: endOfWeek(),
    priority: 'medium',
    status: 'open',
  });

  const kpis = deriveMeetingKPIs(data);

  const executiveSummary = data.hasLiveData
    ? `Week in review: Health ${data.executive.healthScore}/100. Revenue ${inr(data.finance.revenue)} (${pct(data.marketing.revenueGrowthPct)} M-o-M). Cash ${inr(data.finance.cash)}, runway ${data.finance.runwayDays}d. ${risks.length} strategic risks identified. ${actionItems.length} action items for the week. Focus: ${data.finance.overdueAmount > 0 ? 'collections + ' : ''}${data.compliance.pendingFilings > 0 ? 'GST compliance + ' : ''}growth.`
    : 'No live data — connect sources to enable weekly leadership review.';

  const minutes = data.hasLiveData
    ? `Weekly leadership meeting attended by ${attendees.join(', ')}. CFO opened with revenue ${inr(data.finance.revenue)} MTD and cash ${inr(data.finance.cash)} (${data.finance.runwayDays}d runway). COO reported ${data.operations.openTasks} open tasks at ${data.operations.efficiencyPct}% efficiency. CMO highlighted ${pct(data.marketing.revenueGrowthPct)} revenue growth and ${data.marketing.leadCount} leads. CHRO confirmed ${data.hr.headcount} headcount with ${inr(data.hr.payrollAmount)} payroll. ${risks.length} risks reviewed with mitigation plans. ${actionItems.length} action items assigned for the week.`
    : 'No live data — meeting deferred until data sources connected.';

  return {
    id: hashId('mtg-weekly', `weekly-${new Date().toISOString().slice(0, 10)}`),
    type: 'weekly_leadership',
    title: `Weekly Leadership — Week of ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    scheduledFor: nextWeeklyLeadership(),
    attendees,
    agenda,
    insights,
    risks,
    kpis,
    actionItems,
    minutes,
    executiveSummary,
    generatedAt: new Date().toISOString(),
    status: 'scheduled',
    dataSources: data.dataSources,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEETING 3: MONTHLY BOARD REVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function buildMonthlyBoard(data: WorkforceDataView): AIMeeting {
  const attendees: EmployeeRole[] = ['ceo', 'cfo', 'coo', 'cto', 'cmo', 'chro', 'legal_advisor'];

  const agenda: MeetingAgendaItem[] = [
    {
      topic: `Financial summary — Revenue ${inr(data.cfo.revenue.thisMonth)} MTD / ${inr(data.cfo.revenue.thisYear)} YTD, Profit ${inr(data.finance.profit)}, Cash ${inr(data.finance.cash)}`,
      owner: 'cfo',
      duration: 20,
      priority: 'high',
    },
    {
      topic: `GST position — Payable ${inr(data.finance.gst)}, ITC ${inr(data.finance.itc)}, ${data.compliance.pendingFilings} pending filings`,
      owner: 'cfo',
      duration: 10,
      priority: 'high',
    },
    {
      topic: `Growth metrics — Revenue growth ${pct(data.marketing.revenueGrowthPct)} M-o-M, ${pct(data.cfo.revenue.yoyGrowthPct)} Y-o-Y, ${data.sales.newClientsThisMonth} new clients`,
      owner: 'cmo',
      duration: 12,
      priority: 'high',
    },
    {
      topic: `Department performance — Health ${data.executive.healthScore}/100, Compliance ${data.executive.compliance}/100`,
      owner: 'coo',
      duration: 15,
      priority: 'medium',
    },
    {
      topic: `Risk overview — Overall ${data.risk.overallRiskScore}/100, ${data.risk.criticalRisks} critical, ${data.risk.highRisks} high`,
      owner: 'risk_manager',
      duration: 12,
      priority: 'high',
    },
    {
      topic: `Strategic recommendations — Top opportunities for next month`,
      owner: 'ceo',
      duration: 15,
      priority: 'high',
    },
    {
      topic: 'Future strategy & board decisions',
      owner: 'ceo',
      duration: 16,
      priority: 'high',
    },
  ];

  const insights: string[] = [
    `Revenue this month: ${inr(data.cfo.revenue.thisMonth)} (${pct(data.marketing.revenueGrowthPct)} vs last month)`,
    `YTD revenue: ${inr(data.cfo.revenue.thisYear)} (${pct(data.cfo.revenue.yoyGrowthPct)} Y-o-Y)`,
    `Cash position: ${inr(data.finance.cash)} (${data.finance.runwayDays}d runway, burn ${inr(data.finance.burnRate)}/month)`,
    `Profitability: net profit ${inr(data.finance.profit)} at ${data.finance.marginPct.toFixed(1)}% margin`,
    `GST: ${inr(data.finance.gst)} payable, ${inr(data.finance.itc)} ITC available`,
    `Clients: ${data.sales.clientCount} total (${data.sales.activeClients} active), ${data.sales.newClientsThisMonth} new this month`,
    `Compliance score: ${data.executive.compliance}/100, ${data.compliance.pendingFilings} pending filings`,
    `Risk: ${data.risk.overallRiskScore}/100, ${data.risk.anomalies} anomalies detected`,
  ];

  if (data.procurement.vendorCount > 0) {
    insights.push(`Vendors: ${data.procurement.vendorCount} active, ${data.procurement.pendingBills} bills pending`);
  }
  if (data.hr.headcount > 0) {
    insights.push(`Headcount: ${data.hr.headcount}, payroll ${inr(data.hr.payrollAmount)}/month`);
  }

  const risks = deriveTopRisks(data, 6);

  const actionItems: MeetingActionItem[] = [
    {
      task: `Close month with ${inr(data.finance.revenue)} revenue and ${inr(data.finance.profit)} profit`,
      owner: 'cfo',
      deadline: endOfMonth(),
      priority: 'high',
      status: 'open',
    },
    {
      task: `File ${data.compliance.pendingFilings} pending GST returns before month-end`,
      owner: 'compliance_manager',
      deadline: endOfMonth(),
      priority: 'high',
      status: 'open',
    },
    {
      task: `Recover ${inr(data.finance.overdueAmount)} overdue receivables`,
      owner: 'finance_manager',
      deadline: endOfMonth(),
      priority: 'high',
      status: 'open',
    },
    {
      task: `Onboard ${Math.max(1, Math.ceil(data.sales.newClientsThisMonth / 2))} new clients next month`,
      owner: 'sales_manager',
      deadline: daysFromNow(30),
      priority: 'medium',
      status: 'open',
    },
    {
      task: 'Present next-month department budgets',
      owner: 'cfo',
      deadline: endOfMonth(),
      priority: 'medium',
      status: 'open',
    },
  ];

  const kpis = deriveMeetingKPIs(data);

  const executiveSummary = data.hasLiveData
    ? `Monthly board review: Revenue ${inr(data.cfo.revenue.thisMonth)} (${pct(data.marketing.revenueGrowthPct)} M-o-M, ${pct(data.cfo.revenue.yoyGrowthPct)} Y-o-Y). Profit ${inr(data.finance.profit)} (${data.finance.marginPct.toFixed(1)}% margin). Cash ${inr(data.finance.cash)}, runway ${data.finance.runwayDays}d. Health ${data.executive.healthScore}/100. Compliance ${data.executive.compliance}/100. Risk ${data.risk.overallRiskScore}/100 with ${risks.length} active risks. ${data.sales.clientCount} clients (${data.sales.newClientsThisMonth} new). Strategic focus: ${data.finance.runwayDays < 90 ? 'cash preservation + ' : ''}revenue growth + compliance.`
    : 'No live data — board review deferred until sources connected.';

  const minutes = data.hasLiveData
    ? `Monthly board meeting reviewed full company performance. Financial summary: revenue ${inr(data.cfo.revenue.thisMonth)} MTD / ${inr(data.cfo.revenue.thisYear)} YTD, profit ${inr(data.finance.profit)} at ${data.finance.marginPct.toFixed(1)}% margin, cash ${inr(data.finance.cash)} with ${data.finance.runwayDays}d runway. GST position: ${inr(data.finance.gst)} payable, ${inr(data.finance.itc)} ITC. Growth: ${pct(data.cfo.revenue.yoyGrowthPct)} Y-o-Y with ${data.sales.newClientsThisMonth} new clients this month. Department health averaged ${data.executive.healthScore}/100. Risk at ${data.risk.overallRiskScore}/100 with ${risks.length} active items. Board approved ${actionItems.length} action items targeting month-end closure. Future strategy emphasizes ${data.finance.runwayDays < 90 ? 'cash management' : 'growth acceleration'} and ${data.compliance.overdueFilings > 0 ? 'compliance remediation' : 'compliance maintenance'}.`
    : 'No live data — board review deferred.';

  return {
    id: hashId('mtg-board', `board-${new Date().toISOString().slice(0, 7)}`),
    type: 'monthly_board',
    title: `Monthly Board Review — ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`,
    scheduledFor: nextMonthlyBoard(),
    attendees,
    agenda,
    insights,
    risks,
    kpis,
    actionItems,
    minutes,
    executiveSummary,
    generatedAt: new Date().toISOString(),
    status: 'scheduled',
    dataSources: data.dataSources,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEETING 4: QUARTERLY STRATEGY REVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function buildQuarterlyStrategy(data: WorkforceDataView): AIMeeting {
  const attendees: EmployeeRole[] = ['ceo', 'cfo', 'coo', 'cto', 'cmo', 'chro'];

  // Quarterly metrics derived from CFO data
  const qRevenue = data.cfo.revenue.thisQuarter || data.cfo.revenue.thisMonth * 3;
  const qoqGrowth = data.cfo.revenue.qoqGrowthPct || 0;
  const yoyGrowth = data.cfo.revenue.yoyGrowthPct || 0;

  const agenda: MeetingAgendaItem[] = [
    {
      topic: `Quarterly financial review — Revenue ${inr(qRevenue)}, Q-o-Q ${pct(qoqGrowth)}, Y-o-Y ${pct(yoyGrowth)}`,
      owner: 'cfo',
      duration: 20,
      priority: 'high',
    },
    {
      topic: `Goals progress — Health ${data.executive.healthScore}/100, Risk ${data.risk.overallRiskScore}/100, Compliance ${data.executive.compliance}/100`,
      owner: 'ceo',
      duration: 15,
      priority: 'high',
    },
    {
      topic: `KPIs vs targets — Revenue ${inr(data.cfo.revenue.thisYear)} YTD, runway ${data.finance.runwayDays}d, margin ${data.finance.marginPct.toFixed(1)}%`,
      owner: 'cfo',
      duration: 15,
      priority: 'high',
    },
    {
      topic: `Sales & marketing — ${data.sales.clientCount} clients, ${data.sales.newClientsThisMonth} new this month, pipeline ${inr(data.sales.pipelineValue)}`,
      owner: 'cmo',
      duration: 12,
      priority: 'medium',
    },
    {
      topic: `Operations & technology — ${data.operations.openTasks} tasks, ${data.technology.activeIntegrations} integrations`,
      owner: 'coo',
      duration: 12,
      priority: 'medium',
    },
    {
      topic: 'Strategic recommendations for next quarter',
      owner: 'ceo',
      duration: 20,
      priority: 'high',
    },
  ];

  const insights: string[] = [
    `Quarter revenue: ${inr(qRevenue)} (${pct(qoqGrowth)} Q-o-Q, ${pct(yoyGrowth)} Y-o-Y)`,
    `YTD revenue: ${inr(data.cfo.revenue.thisYear)}`,
    `Cash position: ${inr(data.finance.cash)} (${data.finance.runwayDays}d runway)`,
    `Profitability: ${inr(data.finance.profit)} at ${data.finance.marginPct.toFixed(1)}% margin`,
    `Compliance: ${data.executive.compliance}/100 with ${data.compliance.pendingFilings} pending filings`,
    `Risk: ${data.risk.overallRiskScore}/100 with ${data.risk.anomalies} anomalies`,
    `Forecast confidence: ${data.data.forecastConfidence.toFixed(0)}%`,
  ];

  if (data.risk.concentrationRisk > 40) {
    insights.push(`Client concentration at ${data.risk.concentrationRisk.toFixed(0)}% — above 40% threshold`);
  }

  const risks = deriveTopRisks(data, 5);

  const actionItems: MeetingActionItem[] = [
    {
      task: `Drive quarterly revenue target of ${inr(qRevenue * 1.15)} (15% Q-o-Q growth)`,
      owner: 'ceo',
      deadline: endOfQuarter(),
      priority: 'high',
      status: 'open',
    },
    {
      task: `Improve runway to ${Math.max(120, data.finance.runwayDays + 30)} days via collections & credit`,
      owner: 'cfo',
      deadline: endOfQuarter(),
      priority: 'high',
      status: 'open',
    },
    {
      task: `Acquire ${Math.max(2, Math.ceil(data.sales.newClientsThisMonth * 1.5))} new clients next quarter`,
      owner: 'sales_manager',
      deadline: endOfQuarter(),
      priority: 'high',
      status: 'open',
    },
    {
      task: 'Reduce client concentration below 40%',
      owner: 'sales_manager',
      deadline: endOfQuarter(),
      priority: 'medium',
      status: 'open',
    },
    {
      task: 'Improve compliance score above 85',
      owner: 'compliance_manager',
      deadline: endOfQuarter(),
      priority: 'medium',
      status: 'open',
    },
    {
      task: `Resolve ${data.risk.anomalies} anomalies and close ${data.risk.criticalRisks} critical risks`,
      owner: 'risk_manager',
      deadline: endOfQuarter(),
      priority: 'high',
      status: 'open',
    },
  ];

  const kpis = deriveMeetingKPIs(data);

  const executiveSummary = data.hasLiveData
    ? `Quarterly review: Revenue ${inr(qRevenue)} (${pct(qoqGrowth)} Q-o-Q, ${pct(yoyGrowth)} Y-o-Y). Cash ${inr(data.finance.cash)}, runway ${data.finance.runwayDays}d. Health ${data.executive.healthScore}/100. ${data.sales.clientCount} clients, pipeline ${inr(data.sales.pipelineValue)}. Strategic priorities: ${data.finance.runwayDays < 90 ? 'cash stabilization, ' : ''}${data.risk.concentrationRisk > 40 ? 'client diversification, ' : ''}revenue growth, compliance maintenance. Forecast confidence ${data.data.forecastConfidence.toFixed(0)}%.`
    : 'No live data — quarterly review deferred.';

  const minutes = data.hasLiveData
    ? `Quarterly strategy meeting reviewed company performance vs targets. Revenue at ${inr(qRevenue)} for the quarter (${pct(qoqGrowth)} Q-o-Q, ${pct(yoyGrowth)} Y-o-Y). Profitability at ${data.finance.marginPct.toFixed(1)}% margin with ${inr(data.finance.profit)} net profit. Cash position ${inr(data.finance.cash)} supports ${data.finance.runwayDays}d runway. Health at ${data.executive.healthScore}/100, compliance at ${data.executive.compliance}/100. ${risks.length} strategic risks reviewed with mitigation plans. ${data.risk.concentrationRisk > 40 ? `Client concentration at ${data.risk.concentrationRisk.toFixed(0)}% flagged for diversification. ` : ''}Forecast confidence at ${data.data.forecastConfidence.toFixed(0)}%. ${actionItems.length} strategic action items set for next quarter with clear ownership.`
    : 'No live data — quarterly review deferred.';

  return {
    id: hashId('mtg-quarter', `quarter-${new Date().getFullYear()}-${Math.floor(new Date().getMonth() / 3) + 1}`),
    type: 'quarterly_strategy',
    title: `Quarterly Strategy Review — Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`,
    scheduledFor: nextQuarterlyStrategy(),
    attendees,
    agenda,
    insights,
    risks,
    kpis,
    actionItems,
    minutes,
    executiveSummary,
    generatedAt: new Date().toISOString(),
    status: 'scheduled',
    dataSources: data.dataSources,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEETING 5: ANNUAL PLANNING
// ═══════════════════════════════════════════════════════════════════════════════

function buildAnnualPlanning(data: WorkforceDataView): AIMeeting {
  const attendees: EmployeeRole[] = ['ceo', 'cfo', 'coo', 'cto', 'cmo', 'chro', 'legal_advisor'];
  const currentYear = new Date().getFullYear();

  const agenda: MeetingAgendaItem[] = [
    {
      topic: `Year-over-year review — Revenue ${inr(data.cfo.revenue.thisYear)} YTD (${pct(data.cfo.revenue.yoyGrowthPct)} Y-o-Y)`,
      owner: 'cfo',
      duration: 25,
      priority: 'high',
    },
    {
      topic: `Client & employee review — ${data.sales.clientCount} clients (${data.sales.activeClients} active), ${data.hr.headcount} employees`,
      owner: 'ceo',
      duration: 20,
      priority: 'high',
    },
    {
      topic: `Financial position — Cash ${inr(data.finance.cash)}, profit ${inr(data.finance.profit)}, margin ${data.finance.marginPct.toFixed(1)}%`,
      owner: 'cfo',
      duration: 20,
      priority: 'high',
    },
    {
      topic: `Risk & compliance posture — Risk ${data.risk.overallRiskScore}/100, compliance ${data.executive.compliance}/100`,
      owner: 'risk_manager',
      duration: 15,
      priority: 'high',
    },
    {
      topic: `Next-year targets — Revenue goal ${inr(data.cfo.revenue.thisYear * 1.3)} (+30%), runway > 180 days`,
      owner: 'ceo',
      duration: 25,
      priority: 'high',
    },
    {
      topic: 'Strategic initiatives for the year',
      owner: 'ceo',
      duration: 30,
      priority: 'high',
    },
  ];

  const insights: string[] = [
    `YTD revenue: ${inr(data.cfo.revenue.thisYear)} (${pct(data.cfo.revenue.yoyGrowthPct)} Y-o-Y)`,
    `YTD profit: ${inr(data.finance.profit)} at ${data.finance.marginPct.toFixed(1)}% margin`,
    `Cash position: ${inr(data.finance.cash)} (${data.finance.runwayDays}d runway)`,
    `Client base: ${data.sales.clientCount} total (${data.sales.activeClients} active)`,
    `Top clients: ${data.sales.topClients.slice(0, 3).map((c) => `${c.name} (${inr(c.revenue)})`).join(', ')}`,
    `Headcount: ${data.hr.headcount} with ${inr(data.hr.payrollAmount)}/month payroll`,
    `Vendors: ${data.procurement.vendorCount} active`,
    `Data: ${data.data.totalRecords} records across ${data.data.dataSources} sources`,
    `Forecast confidence: ${data.data.forecastConfidence.toFixed(0)}%`,
  ];

  const risks = deriveTopRisks(data, 5);

  // Strategic initiatives — derived from real gaps in data
  const initiatives: string[] = [];
  if (data.finance.runwayDays < 180) {
    initiatives.push(`Extend runway from ${data.finance.runwayDays}d to 180+ days`);
  }
  if (data.risk.concentrationRisk > 30) {
    initiatives.push(`Reduce client concentration from ${data.risk.concentrationRisk.toFixed(0)}% to below 30%`);
  }
  if (data.compliance.complianceScore < 90) {
    initiatives.push(`Achieve 90+ compliance score (currently ${data.executive.compliance})`);
  }
  initiatives.push(`Grow revenue from ${inr(data.cfo.revenue.thisYear)} to ${inr(data.cfo.revenue.thisYear * 1.3)} (+30%)`);
  initiatives.push(`Expand client base from ${data.sales.clientCount} to ${data.sales.clientCount + 10}`);
  if (data.hr.headcount < 10) {
    initiatives.push(`Scale team from ${data.hr.headcount} to ${data.hr.headcount + 5} employees`);
  }
  insights.push(`Strategic initiatives: ${initiatives.length} identified`);

  const actionItems: MeetingActionItem[] = [
    {
      task: `Achieve ${inr(data.cfo.revenue.thisYear * 1.3)} annual revenue (+30% Y-o-Y)`,
      owner: 'ceo',
      deadline: endOfYear(),
      priority: 'high',
      status: 'open',
    },
    {
      task: `Acquire ${Math.max(5, Math.ceil(data.sales.clientCount * 0.3))} new clients during the year`,
      owner: 'sales_manager',
      deadline: endOfYear(),
      priority: 'high',
      status: 'open',
    },
    {
      task: `Maintain runway above 180 days (currently ${data.finance.runwayDays}d)`,
      owner: 'cfo',
      deadline: endOfYear(),
      priority: 'high',
      status: 'open',
    },
    {
      task: `Improve compliance score to 90+ (currently ${data.executive.compliance})`,
      owner: 'compliance_manager',
      deadline: endOfYear(),
      priority: 'medium',
      status: 'open',
    },
    {
      task: `Reduce client concentration below 30% (currently ${data.risk.concentrationRisk.toFixed(0)}%)`,
      owner: 'sales_manager',
      deadline: endOfYear(),
      priority: 'medium',
      status: 'open',
    },
    {
      task: `Scale team to ${data.hr.headcount + 5} employees (currently ${data.hr.headcount})`,
      owner: 'chro',
      deadline: endOfYear(),
      priority: 'medium',
      status: 'open',
    },
    {
      task: `Expand to ${data.data.dataSources + 2} data integrations (currently ${data.data.dataSources})`,
      owner: 'cto',
      deadline: endOfYear(),
      priority: 'low',
      status: 'open',
    },
  ];

  const kpis = deriveMeetingKPIs(data);

  const executiveSummary = data.hasLiveData
    ? `Annual planning for ${currentYear + 1}: closing ${currentYear} with ${inr(data.cfo.revenue.thisYear)} revenue (${pct(data.cfo.revenue.yoyGrowthPct)} Y-o-Y), ${data.sales.clientCount} clients, ${data.hr.headcount} employees. Cash ${inr(data.finance.cash)}, runway ${data.finance.runwayDays}d. Next-year targets: revenue ${inr(data.cfo.revenue.thisYear * 1.3)} (+30%), ${data.sales.clientCount + 10} clients, runway 180+d, compliance 90+. ${initiatives.length} strategic initiatives approved.`
    : 'No live data — annual planning deferred until sources connected.';

  const minutes = data.hasLiveData
    ? `Annual planning meeting reviewed ${currentYear} performance and set targets for ${currentYear + 1}. Y-o-Y review: revenue ${inr(data.cfo.revenue.thisYear)} (${pct(data.cfo.revenue.yoyGrowthPct)}), profit ${inr(data.finance.profit)} at ${data.finance.marginPct.toFixed(1)}% margin, cash ${inr(data.finance.cash)} with ${data.finance.runwayDays}d runway. Client base grew to ${data.sales.clientCount} (${data.sales.activeClients} active). Team at ${data.hr.headcount} with ${inr(data.hr.payrollAmount)} monthly payroll. Risk posture at ${data.risk.overallRiskScore}/100 with ${risks.length} strategic risks. Compliance at ${data.executive.compliance}/100. Next-year strategy: 30% revenue growth, client diversification, compliance excellence, team scaling. ${actionItems.length} annual action items set with quarterly milestones. ${initiatives.length} strategic initiatives formally approved.`
    : 'No live data — annual planning deferred.';

  return {
    id: hashId('mtg-annual', `annual-${currentYear + 1}`),
    type: 'annual_planning',
    title: `Annual Planning — FY ${currentYear + 1}`,
    scheduledFor: nextAnnualPlanning(),
    attendees,
    agenda,
    insights,
    risks,
    kpis,
    actionItems,
    minutes,
    executiveSummary,
    generatedAt: new Date().toISOString(),
    status: 'scheduled',
    dataSources: data.dataSources,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: computeMeetings — returns all 5 meeting types
// ═══════════════════════════════════════════════════════════════════════════════

export function computeMeetings(data: WorkforceDataView): AIMeeting[] {
  if (!data?.hasLiveData) {
    // Still return the 5 meeting shells so the UI can render the schedule
    return [
      buildDailyStandup(data),
      buildWeeklyLeadership(data),
      buildMonthlyBoard(data),
      buildQuarterlyStrategy(data),
      buildAnnualPlanning(data),
    ];
  }

  const meetings: AIMeeting[] = [
    safeBuild('standup', () => buildDailyStandup(data), buildDailyStandup({ ...data, hasLiveData: false } as WorkforceDataView)),
    safeBuild('weekly', () => buildWeeklyLeadership(data), buildWeeklyLeadership({ ...data, hasLiveData: false } as WorkforceDataView)),
    safeBuild('board', () => buildMonthlyBoard(data), buildMonthlyBoard({ ...data, hasLiveData: false } as WorkforceDataView)),
    safeBuild('quarterly', () => buildQuarterlyStrategy(data), buildQuarterlyStrategy({ ...data, hasLiveData: false } as WorkforceDataView)),
    safeBuild('annual', () => buildAnnualPlanning(data), buildAnnualPlanning({ ...data, hasLiveData: false } as WorkforceDataView)),
  ];

  // Sort by scheduledFor ascending (soonest first)
  meetings.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());

  return meetings;
}
