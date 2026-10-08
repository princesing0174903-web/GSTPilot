// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Predictive Compliance Engine (Phase Delta · 5)
// Forecasts late filing, GST mismatch, penalty, cash shortage, filing overload,
// missing docs, and high-risk vendors — weeks before deadlines.
// ═══════════════════════════════════════════════════════════════════════════════

export type ComplianceAlertType =
  | 'late_filing' | 'gst_mismatch' | 'penalty_prediction' | 'cash_shortage'
  | 'filing_overload' | 'missing_documents' | 'high_risk_vendor';

export interface ComplianceAlert {
  id: string;
  type: ComplianceAlertType;
  severity: 'info' | 'warning' | 'critical';
  probability: number; // 0-1
  impactAmount: number; // INR
  deadline?: string; // ISO
  weeksAhead?: number;
  title: string;
  description: string;
  recommendation: string;
  confidence: number;
}

export interface PredictiveComplianceReport {
  generatedAt: Date;
  alerts: ComplianceAlert[];
  riskScore: number; // 0-100
  upcomingDeadlines: { date: string; label: string; type: string; daysAway: number }[];
  summary: {
    lateFilingProb: number;
    gstMismatchProb: number;
    predictedPenalty: number;
    cashShortageRisk: number;
    filingOverloadRisk: number;
    missingDocsRisk: number;
  };
}

interface PredictiveInput {
  returns: Array<Record<string, unknown>>;
  notices?: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  bankTransactions: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
}

function daysBetween(a: string, b: Date): number {
  const ta = new Date(a).getTime();
  const tb = b.getTime();
  if (isNaN(ta) || isNaN(tb)) return 0;
  return Math.round((ta - tb) / (24 * 60 * 60 * 1000));
}

export function computePredictiveCompliance(input: PredictiveInput): PredictiveComplianceReport {
  const { returns, notices = [], invoices, bankTransactions, tasks } = input;
  const now = new Date();
  const alerts: ComplianceAlert[] = [];
  const upcomingDeadlines: { date: string; label: string; type: string; daysAway: number }[] = [];

  // ── Late filing probability ──
  for (const ret of returns) {
    const status = String(ret.status ?? '');
    if (status === 'filed') continue;
    const period = String(ret.period ?? '');
    const dueDateStr = ret.dueDate ? String(ret.dueDate) : null;
    // Approximate due date: 20th of next month after period (MM-YYYY)
    let dueDate: Date | null = null;
    if (period && /^\d{2}-\d{4}$/.test(period)) {
      const [mm, yyyy] = period.split('-').map(Number);
      dueDate = new Date(yyyy, mm, 20); // 20th of next month
    } else if (dueDateStr) {
      dueDate = new Date(dueDateStr);
    }
    const daysPastDue = dueDate ? daysBetween(dueDate.toISOString(), now) : 0;
    const prob = Math.min(0.95, 0.3 + 0.1 * Math.max(0, daysPastDue));
    const severity: ComplianceAlert['severity'] = daysPastDue > 7 ? 'critical' : daysPastDue > 0 ? 'warning' : 'info';
    const penalty = Math.max(200, 200 * Math.max(0, daysPastDue)) + (daysPastDue > 30 ? Number(ret.totalTax ?? 0) * 0.1 : 0);
    alerts.push({
      id: `alert_late_${ret.returnId ?? period}`,
      type: 'late_filing',
      severity,
      probability: prob,
      impactAmount: Math.round(penalty),
      deadline: dueDate ? dueDate.toISOString() : undefined,
      weeksAhead: dueDate ? Math.round(daysBetween(dueDate.toISOString(), now) / 7) : undefined,
      title: `${ret.returnType ?? 'GSTR'} ${period} — Late Filing Risk`,
      description: `${daysPastDue > 0 ? `${daysPastDue} days past due. ` : ''}Probability of late filing: ${(prob * 100).toFixed(0)}%.`,
      recommendation: daysPastDue > 0
        ? 'File immediately — late fee ₹200/day accrues. Interest 18% p.a. on unpaid tax.'
        : 'Prepare the return now to avoid last-minute rush and late fee.',
      confidence: 0.8,
    });
    if (dueDate) {
      upcomingDeadlines.push({
        date: dueDate.toISOString(),
        label: `${ret.returnType ?? 'GSTR'} ${period}`,
        type: 'gst_filing',
        daysAway: Math.round(daysBetween(dueDate.toISOString(), now)),
      });
    }
  }

  // ── GST mismatch probability ──
  const unfiledReturns = returns.filter((r) => String(r.status ?? '') !== 'filed');
  const mismatches = unfiledReturns.filter((r) => Number(r.issuesFound ?? 0) > 0);
  const mismatchPct = unfiledReturns.length > 0 ? mismatches.length / unfiledReturns.length : 0;
  if (mismatchPct > 0) {
    alerts.push({
      id: 'alert_gst_mismatch',
      type: 'gst_mismatch',
      severity: mismatchPct > 0.3 ? 'critical' : 'warning',
      probability: Math.min(0.95, mismatchPct + 0.2),
      impactAmount: 0,
      title: 'GST Mismatch Risk',
      description: `${(mismatchPct * 100).toFixed(0)}% of unfiled returns have reconciliation issues.`,
      recommendation: 'Run GSTR-2B vs Purchase Register reconciliation before filing to avoid notices.',
      confidence: 0.7,
    });
  }

  // ── Penalty prediction (aggregate) ──
  const totalPenalty = alerts
    .filter((a) => a.type === 'late_filing')
    .reduce((sum, a) => sum + a.impactAmount, 0);
  if (totalPenalty > 0) {
    alerts.push({
      id: 'alert_penalty_total',
      type: 'penalty_prediction',
      severity: totalPenalty > 50000 ? 'critical' : 'warning',
      probability: 0.85,
      impactAmount: totalPenalty,
      title: 'Predicted Total Penalty Exposure',
      description: `Estimated ₹${totalPenalty.toLocaleString('en-IN')} in late fees + interest across all overdue returns.`,
      recommendation: 'Filing now stops the ₹200/day accrual immediately.',
      confidence: 0.85,
    });
  }

  // ── Cash shortage before GST due date ──
  const currentBalance = bankTransactions.length > 0
    ? Number(bankTransactions[0]?.balanceAfter ?? 0)
    : 0;
  const gstLiability = unfiledReturns.reduce((s, r) => s + Number(r.totalTax ?? 0), 0);
  const expectedInflows = invoices
    .filter((i) => ['unpaid', 'overdue'].includes(String(i.status ?? '')))
    .reduce((s, i) => s + Number(i.totalAmount ?? 0), 0);
  const forecast = currentBalance + expectedInflows * 0.7 - gstLiability; // 70% collection confidence
  const nearestDue = upcomingDeadlines.filter((d) => d.daysAway >= 0 && d.daysAway <= 14).sort((a, b) => a.daysAway - b.daysAway)[0];
  if (gstLiability > 0 && forecast < gstLiability && nearestDue) {
    alerts.push({
      id: 'alert_cash_shortage',
      type: 'cash_shortage',
      severity: 'critical',
      probability: 0.7,
      impactAmount: Math.round(gstLiability - forecast),
      deadline: nearestDue.date,
      weeksAhead: Math.round(nearestDue.daysAway / 7),
      title: 'Cash Shortage Before GST Due Date',
      description: `Projected cash ${Math.round(forecast).toLocaleString('en-IN')} < GST liability ${gstLiability.toLocaleString('en-IN')} due in ${nearestDue.daysAway} days.`,
      recommendation: 'Expedite collections or arrange short-term funding before the GST due date.',
      confidence: 0.65,
    });
  }

  // ── Filing overload (multiple returns due same week) ──
  const dueThisWeek = upcomingDeadlines.filter((d) => d.daysAway >= 0 && d.daysAway <= 7);
  if (dueThisWeek.length > 2) {
    alerts.push({
      id: 'alert_filing_overload',
      type: 'filing_overload',
      severity: 'warning',
      probability: 0.6,
      impactAmount: 0,
      title: 'Filing Overload Risk',
      description: `${dueThisWeek.length} returns due within 7 days — high workload risk.`,
      recommendation: 'Stagger preparation across the team; consider filing early where data is ready.',
      confidence: 0.7,
    });
  }

  // ── Missing documents ──
  const overdueDocTasks = tasks.filter((t) =>
    String(t.status ?? '') !== 'completed' &&
    (String(t.tags ?? '').includes('document_collection') || String(t.title ?? '').toLowerCase().includes('document'))
  );
  if (overdueDocTasks.length > 0) {
    alerts.push({
      id: 'alert_missing_docs',
      type: 'missing_documents',
      severity: overdueDocTasks.length > 3 ? 'warning' : 'info',
      probability: Math.min(0.9, 0.3 + overdueDocTasks.length * 0.1),
      impactAmount: 0,
      title: 'Missing Documents Risk',
      description: `${overdueDocTasks.length} document collection task(s) pending — may delay filing.`,
      recommendation: 'Follow up with clients for pending documents immediately.',
      confidence: 0.6,
    });
  }

  // ── High-risk vendors (from notices) ──
  const vendorNotices = notices.filter((n) => String(n.type ?? '').toLowerCase().includes('vendor') || String(n.type ?? '').toLowerCase().includes('supplier'));
  if (vendorNotices.length > 0) {
    alerts.push({
      id: 'alert_high_risk_vendor',
      type: 'high_risk_vendor',
      severity: 'warning',
      probability: 0.7,
      impactAmount: 0,
      title: 'High-Risk Vendor Detected',
      description: `${vendorNotices.length} vendor-related notice(s) — ITC may be at risk.`,
      recommendation: 'Verify vendor GSTIN status on GST portal before claiming ITC.',
      confidence: 0.65,
    });
  }

  // ── Risk score (0-100) ──
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;
  const avgProb = alerts.length > 0 ? alerts.reduce((s, a) => s + a.probability, 0) / alerts.length : 0;
  const riskScore = Math.min(100, Math.round(criticalCount * 30 + warningCount * 12 + avgProb * 40));

  return {
    generatedAt: now,
    alerts: alerts.sort((a, b) => {
      const sevWeight = { critical: 3, warning: 2, info: 1 };
      const sw = sevWeight[b.severity] - sevWeight[a.severity];
      if (sw !== 0) return sw;
      return b.probability - a.probability;
    }),
    riskScore,
    upcomingDeadlines: upcomingDeadlines.sort((a, b) => a.daysAway - b.daysAway).slice(0, 6),
    summary: {
      lateFilingProb: alerts.filter((a) => a.type === 'late_filing').reduce((s, a) => Math.max(s, a.probability), 0),
      gstMismatchProb: alerts.find((a) => a.type === 'gst_mismatch')?.probability ?? 0,
      predictedPenalty: totalPenalty,
      cashShortageRisk: alerts.find((a) => a.type === 'cash_shortage')?.probability ?? 0,
      filingOverloadRisk: alerts.find((a) => a.type === 'filing_overload')?.probability ?? 0,
      missingDocsRisk: alerts.find((a) => a.type === 'missing_documents')?.probability ?? 0,
    },
  };
}
