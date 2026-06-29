// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — AUTONOMOUS ALERTS
//
// Oracle detects automatically: fraud, cash shortage, compliance risk, GST
// notices, customer churn, vendor dependency, employee overload, security
// threats, growth opportunities, tax savings and collection risks.
//
// Merges persisted CEOAlert records with live-detected alerts from the
// company observation — all grounded in REAL data.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  AlertCategory,
  AutonomousAlert,
  CompanyObservation,
} from './types';

// ─── Load persisted alerts + detect live ones ────────────────────────────────

export async function loadAlerts(obs: CompanyObservation): Promise<AutonomousAlert[]> {
  const alerts: AutonomousAlert[] = [];

  // Persisted CEO alerts (real)
  try {
    const rows = await db.cEOAlert.findMany({
      orderBy: { detectedAt: 'desc' },
      take: 20,
    });
    for (const r of rows) {
      alerts.push({
        id: r.id,
        category: mapAlertType(r.type),
        title: r.title,
        message: r.message,
        severity: r.severity as AutonomousAlert['severity'],
        detectedAt: r.detectedAt.toISOString(),
        relatedEntityType: r.relatedEntityType ?? undefined,
        relatedEntityId: r.relatedEntityId ?? undefined,
        suggestedAction: r.suggestedDecisionType
          ? `Trigger ${r.suggestedDecisionType} decision`
          : 'Review in Executive Command Center',
        acknowledged: r.acknowledged,
      });
    }
  } catch (err) {
    console.warn('[Autonomous] loadAlerts persisted failed:', err);
  }

  // Live-detected alerts from the observation
  if (obs.runwayDays > 0 && obs.runwayDays < 30) {
    alerts.push({
      id: 'live_cash_shortage',
      category: 'cash_shortage',
      title: `Cash runway at ${obs.runwayDays} days`,
      message: `Burn rate ₹${Math.round(obs.burnRate).toLocaleString('en-IN')}/mo with only ${obs.runwayDays} days of cash. Trigger Cash Crisis workflow.`,
      severity: obs.runwayDays < 14 ? 'critical' : 'high',
      detectedAt: obs.evaluatedAt,
      suggestedAction: 'Launch Cash Crisis Response workflow + freeze non-essential spend',
      acknowledged: false,
    });
  }
  if (obs.gst > 0) {
    alerts.push({
      id: 'live_gst_notice',
      category: 'gst_notice',
      title: `GST liability of ₹${Math.round(obs.gst).toLocaleString('en-IN')} due`,
      message: 'Net GST payable is outstanding. Late filing triggers penalty + ITC reversal.',
      severity: 'high',
      detectedAt: obs.evaluatedAt,
      suggestedAction: 'Run autonomous GST Filing workflow',
      acknowledged: false,
    });
  }
  if (obs.compliance > 0 && obs.compliance < 80) {
    alerts.push({
      id: 'live_compliance_risk',
      category: 'compliance_risk',
      title: `Compliance score ${obs.compliance}% — below threshold`,
      message: 'ROC/GST compliance below 80%. Regulatory exposure active.',
      severity: 'high',
      detectedAt: obs.evaluatedAt,
      suggestedAction: 'File overdue returns + clear notices',
      acknowledged: false,
    });
  }
  if (obs.receivables > obs.revenue * 0.5 && obs.revenue > 0) {
    alerts.push({
      id: 'live_collection_risk',
      category: 'collection_risk',
      title: `Receivables ₹${Math.round(obs.receivables).toLocaleString('en-IN')} — collection risk`,
      message: 'Outstanding book exceeds 50% of monthly revenue. Bad-debt exposure rising.',
      severity: 'medium',
      detectedAt: obs.evaluatedAt,
      suggestedAction: 'Launch Collection Recovery workflow',
      acknowledged: false,
    });
  }
  if (obs.expenses > 0 && obs.revenue > 0 && obs.expenses / obs.revenue > 0.8) {
    alerts.push({
      id: 'live_tax_savings',
      category: 'tax_savings',
      title: 'Expense ratio above 80% — tax savings opportunity',
      message: 'Trimming 12% of operating expenses improves margin + reduces GST/ITC reversal risk.',
      severity: 'medium',
      detectedAt: obs.evaluatedAt,
      suggestedAction: 'Run reduce_expenses decision',
      acknowledged: false,
    });
  }
  if (obs.revenue > 0 && obs.healthScore >= 80) {
    alerts.push({
      id: 'live_growth_opportunity',
      category: 'growth_opportunity',
      title: 'Strong health score — growth opportunity',
      message: `Health score ${obs.healthScore}. Capital available to fund expansion or new product.`,
      severity: 'info',
      detectedAt: obs.evaluatedAt,
      suggestedAction: 'Simulate expand_city / launch_product scenarios',
      acknowledged: false,
    });
  }
  if (obs.vendors > 0 && obs.vendors < 3) {
    alerts.push({
      id: 'live_vendor_dependency',
      category: 'vendor_dependency',
      title: `Only ${obs.vendors} active vendors — concentration risk`,
      message: 'Single-vendor dependency creates supply continuity risk.',
      severity: 'medium',
      detectedAt: obs.evaluatedAt,
      suggestedAction: 'Onboard backup vendors via Business Graph',
      acknowledged: false,
    });
  }
  if (obs.employees > 15) {
    alerts.push({
      id: 'live_employee_overload',
      category: 'employee_overload',
      title: `${obs.employees} employees — monitor workload distribution`,
      message: 'Headcount above 15; AI HR should review workload balance weekly.',
      severity: 'low',
      detectedAt: obs.evaluatedAt,
      suggestedAction: 'Run HR workload review',
      acknowledged: false,
    });
  }

  // De-duplicate by id (live alerts may overlap persisted)
  const seen = new Set<string>();
  return alerts
    .filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    })
    .sort((a, b) => {
      const sev = { critical: 4, high: 3, medium: 2, low: 1, info: 0 } as const;
      return sev[b.severity] - sev[a.severity];
    })
    .slice(0, 25);
}

function mapAlertType(t: string): AlertCategory {
  const map: Record<string, AlertCategory> = {
    cash_shortage: 'cash_shortage',
    compliance_risk: 'compliance_risk',
    fraud_suspected: 'fraud',
    revenue_drop: 'growth_opportunity',
    profit_decline: 'tax_savings',
    customer_churn: 'customer_churn',
    vendor_risk: 'vendor_dependency',
    payroll_issue: 'employee_overload',
    gst_issue: 'gst_notice',
    bank_anomaly: 'fraud',
    collections_problem: 'collection_risk',
    inventory_issue: 'vendor_dependency',
    anomaly_detected: 'security_threat',
  };
  return map[t] ?? 'growth_opportunity';
}
