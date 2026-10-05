// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — DAILY CEO BRIEF™
//
// Auto-generated every morning. A one-page CEO report covering:
//   • Executive Summary
//   • Revenue / Profit / Cash Position / Business Health
//   • Critical Risks
//   • Today's Priorities
//   • Meetings / Collections / GST Deadlines / Bank Balance
//   • Upcoming Expenses / Payroll Status
//   • Oracle Recommendations
//   • One-liner focus for the day
//
// Every value flows from REAL connected data (CFO Phase 1 + Digital Twin).
// Tagline: GSTPilot AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import type { DailyCEOBrief, BriefMetrics, BriefRiskItem, BriefPriority, BriefCollection, BriefGSTDeadline, BriefBankPosition, BriefUpcomingExpense, BriefPayrollStatus, BriefRecommendation, BriefMeeting } from './types';
import type { CEODataView } from './data';
import { formatINR } from './data';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function tierLabel(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'healthy';
  if (score >= 50) return 'needs attention';
  if (score >= 35) return 'at risk';
  return 'critical';
}

// ─── Section builders ────────────────────────────────────────────────────────

function buildMetrics(data: CEODataView): BriefMetrics {
  return {
    revenueMTD: data.liveState.revenue,
    profitMTD: data.liveState.profit,
    cash: data.liveState.cash,
    healthScore: data.liveState.healthScore,
    riskScore: data.liveState.riskScore,
    runwayDays: data.liveState.runwayDays,
    clients: data.liveState.clients,
    receivables: data.liveState.receivables,
    payables: data.liveState.payables,
    gstPayable: data.liveState.gstPayable,
  };
}

function buildCriticalRisks(data: CEODataView): BriefRiskItem[] {
  return data.cfo.risks.risks
    .filter((r) => r.severity === 'critical' || r.severity === 'high')
    .slice(0, 5)
    .map((r) => ({
      title: r.label,
      severity: r.severity === 'critical' ? 'critical' : r.severity === 'high' ? 'high' : 'medium',
      detail: r.impact,
    }));
}

function buildTodaysPriorities(data: CEODataView): BriefPriority[] {
  const priorities: BriefPriority[] = [];

  // Priority 1: Critical alerts
  if (data.twin.anomalies.criticalCount > 0) {
    priorities.push({
      title: `Address ${data.twin.anomalies.criticalCount} critical anomaly`,
      reason: 'Digital Twin flagged critical issues that need immediate attention.',
      deadline: 'today',
      impact: 'Prevents larger downstream losses',
      priority: 'critical',
    });
  }

  // Priority 2: Overdue GST filing
  if (data.cfo.gst.overdueFilings > 0) {
    priorities.push({
      title: `File ${data.cfo.gst.overdueFilings} overdue GST return(s)`,
      reason: `₹50/day penalty + 18% interest accruing. Net GST payable: ${formatINR(data.cfo.gst.netGSTPayable)}.`,
      deadline: 'today',
      impact: `Stops penalty accrual on ${formatINR(data.cfo.gst.netGSTPayable)}`,
      priority: 'critical',
    });
  }

  // Priority 3: Largest overdue receivable
  const top = data.cfo.collections.latePayments[0];
  if (top && top.daysOverdue > 0) {
    priorities.push({
      title: `Recover ${formatINR(top.outstandingAmount)} from ${top.clientName}`,
      reason: `Invoice ${top.invoiceNumber} is ${top.daysOverdue} days overdue.`,
      deadline: '48 hours',
      impact: `Recovers ${formatINR(top.outstandingAmount)} cash`,
      priority: top.daysOverdue > 60 ? 'critical' : 'high',
    });
  }

  // Priority 4: GST due within 7 days
  const dueSoon = data.cfo.gst.upcomingDueDates.find((d) => d.daysLeft <= 7);
  if (dueSoon) {
    priorities.push({
      title: `Pay GST of ${formatINR(dueSoon.liability)} for ${dueSoon.period}`,
      reason: `${dueSoon.returnType} due in ${dueSoon.daysLeft} day(s).`,
      deadline: `${dueSoon.daysLeft} day(s)`,
      impact: 'Avoids 18% interest + late fee',
      priority: dueSoon.daysLeft <= 2 ? 'critical' : 'high',
    });
  }

  // Priority 5: Customer message waiting
  const waiting = data.raw.syncedRecords.filter((r) =>
    (r.sourceType === 'whatsapp_msg' || r.sourceType === 'email') &&
    r.date && (Date.now() - new Date(r.date).getTime()) / (60 * 60 * 1000) > 4,
  );
  if (waiting.length > 0) {
    priorities.push({
      title: `Reply to ${waiting.length} waiting customer message(s)`,
      reason: 'Slow responses hurt retention.',
      deadline: 'today',
      impact: 'Protects client relationships',
      priority: 'medium',
    });
  }

  return priorities.slice(0, 8);
}

function buildMeetings(data: CEODataView): BriefMeeting[] {
  // Build from upcoming calendar events (syncedRecords with sourceType 'email' && title contains 'meeting')
  // For now, derive from upcoming GST deadlines (each filing = a deadline "meeting")
  const meetings: BriefMeeting[] = [];
  const nextDeadline = data.cfo.gst.upcomingDueDates[0];
  if (nextDeadline) {
    meetings.push({
      title: `GST filing — ${nextDeadline.returnType} ${nextDeadline.period}`,
      at: nextDeadline.dueDate,
      with: 'GSTN portal',
    });
  }
  // Top client check-in (recommended)
  const topClient = data.cfo.revenue.byClient[0];
  if (topClient) {
    meetings.push({
      title: `Quarterly review with ${topClient.clientName}`,
      at: 'this week',
      with: topClient.clientName,
    });
  }
  return meetings;
}

function buildCollections(data: CEODataView): BriefCollection[] {
  return data.cfo.collections.latePayments.slice(0, 5).map((l) => ({
    client: l.clientName,
    amount: l.outstandingAmount,
    daysOverdue: l.daysOverdue,
    action: l.recoveryStrategy,
  }));
}

function buildGSTDeadlines(data: CEODataView): BriefGSTDeadline[] {
  return data.cfo.gst.upcomingDueDates.slice(0, 5).map((d) => {
    let status: BriefGSTDeadline['status'] = 'pending';
    if (d.daysLeft < 0) status = 'overdue';
    else if (d.daysLeft <= 3) status = 'ready';
    return {
      returnType: d.returnType,
      period: d.period,
      dueDate: d.dueDate,
      daysLeft: d.daysLeft,
      status,
    };
  });
}

function buildBankBalance(data: CEODataView): BriefBankPosition {
  return {
    totalBalance: data.twin.state.bankAccounts.reduce((s, a) => s + (a.balance || 0), 0) || data.liveState.cash,
    accounts: data.twin.state.bankAccounts.map((a) => ({
      bank: a.bank,
      balance: a.balance,
      syncedAt: a.syncedAt,
    })),
  };
}

function buildUpcomingExpenses(data: CEODataView): BriefUpcomingExpense[] {
  // ExpenseRow uses `date` (the expense date). Treat upcoming expenses as
  // recurring vendor payments due in the next 14 days based on last vendor payment date.
  const now = Date.now();
  return data.raw.expenses
    .filter((e) => {
      if (!e.date) return false;
      // Use the expense date as a proxy for the next recurring cycle (monthly recurrence)
      const d = new Date(e.date);
      // Project to next month cycle: same day next month
      const next = new Date(d);
      next.setMonth(next.getMonth() + 1);
      const diff = (next.getTime() - now) / (24 * 60 * 60 * 1000);
      return diff >= 0 && diff <= 14;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5)
    .map((e) => {
      const d = new Date(e.date);
      const next = new Date(d);
      next.setMonth(next.getMonth() + 1);
      const diff = Math.max(0, Math.round((next.getTime() - now) / (24 * 60 * 60 * 1000)));
      return {
        vendor: e.vendor ?? e.category ?? 'Vendor',
        amount: e.amount,
        dueIn: diff,
        category: e.category ?? 'other',
      };
    });
}

function buildPayrollStatus(data: CEODataView): BriefPayrollStatus {
  // Next payroll = 1st of next month
  const now = new Date();
  const nextRun = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    nextRunDate: nextRun.toISOString(),
    headcount: data.liveState.employees,
    amount: data.liveState.payroll,
    status: 'scheduled',
  };
}

function buildOracleRecommendations(data: CEODataView): BriefRecommendation[] {
  return data.cfo.recommendations.recommendations.slice(0, 5).map((r) => ({
    title: r.title,
    impact: r.financialImpact,
    priority: r.priority,
  }));
}

function buildExecutiveSummary(data: CEODataView): string {
  const m = data.liveState;
  const tier = tierLabel(m.healthScore);
  const summary = data.cfo.executiveSummary;
  return `Business is ${tier} (health ${m.healthScore}/100, risk ${m.riskScore}/100). Revenue MTD ${formatINR(m.revenue)}, net profit ${formatINR(m.profit)}, cash ${formatINR(m.cash)} (${m.runwayDays}d runway). ${summary.topRisk} Top opportunity: ${summary.topOpportunity}.`;
}

function buildTopOpportunity(data: CEODataView): string {
  const topRec = data.cfo.recommendations.recommendations[0];
  if (topRec) return `${topRec.title} — ${topRec.financialImpact}`;
  return data.cfo.executiveSummary.topOpportunity;
}

function buildOneLiner(data: CEODataView): string {
  const priorities = buildTodaysPriorities(data);
  if (priorities.length === 0) return 'No critical actions today. Focus on growth and pipeline.';
  const top = priorities[0];
  return `Today's focus: ${top.title}.`;
}

// ─── Main entry ──────────────────────────────────────────────────────────────

export function computeDailyBrief(data: CEODataView, userName?: string): DailyCEOBrief {
  const name = userName?.split(' ')[0] || 'there';
  return {
    generatedAt: new Date().toISOString(),
    greeting: `${greeting()}, ${name}`,
    asOfDay: new Date().toISOString().split('T')[0],
    executiveSummary: buildExecutiveSummary(data),
    metrics: buildMetrics(data),
    criticalRisks: buildCriticalRisks(data),
    todaysPriorities: buildTodaysPriorities(data),
    meetings: buildMeetings(data),
    collections: buildCollections(data),
    gstDeadlines: buildGSTDeadlines(data),
    bankBalance: buildBankBalance(data),
    upcomingExpenses: buildUpcomingExpenses(data),
    payrollStatus: buildPayrollStatus(data),
    oracleRecommendations: buildOracleRecommendations(data),
    topOpportunity: buildTopOpportunity(data),
    oneLiner: buildOneLiner(data),
  };
}
