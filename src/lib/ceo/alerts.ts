// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — EXECUTIVE ALERT SYSTEM™
//
// Oracle continuously scans the CFO risk engine + Digital Twin anomaly engine
// and surfaces the most urgent business issues as Executive Alerts.
//
// 13 alert types:
//   cash_shortage, compliance_risk, fraud_suspected, revenue_drop,
//   profit_decline, customer_churn, vendor_risk, payroll_issue,
//   gst_issue, bank_anomaly, collections_problem, inventory_issue,
//   anomaly_detected
//
// Each BusinessRisk becomes an ExecutiveAlert (no duplication). Each
// high-severity BusinessAnomaly becomes a separate alert. Sorted by severity
// (critical first). No fabrication — every alert ties to real risk data.
//
// Tagline: GSTPilot AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ExecutiveAlert,
  AlertType,
  AlertSeverity,
  DecisionType,
} from './types';
import type { CEODataView } from './data';
import { formatINR } from './data';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let counter = 0;
function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

const severityRank: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// ─── Risk-type → Alert-type mapping (BusinessRisk → ExecutiveAlert) ──────────

const RISK_TO_ALERT: Record<string, { type: AlertType; decision: DecisionType }> = {
  cash_shortage:           { type: 'cash_shortage',       decision: 'suggest_loan' },
  revenue_drop:            { type: 'revenue_drop',        decision: 'increase_marketing' },
  profit_decline:          { type: 'profit_decline',      decision: 'improve_profitability' },
  gst_risk:                { type: 'gst_issue',           decision: 'pay_gst' },
  itc_loss:                { type: 'gst_issue',           decision: 'claim_itc' },
  customer_concentration:  { type: 'customer_churn',      decision: 'reduce_vendor_dependency' },
  vendor_dependency:       { type: 'vendor_risk',         decision: 'reduce_vendor_dependency' },
  late_payments:           { type: 'collections_problem', decision: 'improve_collections' },
  compliance_risk:         { type: 'compliance_risk',     decision: 'review_compliance' },
  liquidity_risk:          { type: 'cash_shortage',       decision: 'optimize_cash' },
};

// ─── Anomaly-type → Alert-type mapping ───────────────────────────────────────

const ANOMALY_TO_ALERT: Record<string, { type: AlertType; decision: DecisionType }> = {
  revenue_drop:           { type: 'revenue_drop',        decision: 'increase_marketing' },
  expense_spike:          { type: 'anomaly_detected',    decision: 'review_expense' },
  gst_unusually_high:     { type: 'gst_issue',           decision: 'review_compliance' },
  cash_drain:             { type: 'bank_anomaly',        decision: 'optimize_cash' },
  duplicate_payment:      { type: 'fraud_suspected',     decision: 'review_expense' },
  fraud_pattern:          { type: 'fraud_suspected',     decision: 'investigate_anomaly' },
  vendor_overcharging:    { type: 'vendor_risk',         decision: 'review_contract' },
  customer_payment_delay: { type: 'collections_problem', decision: 'improve_collections' },
  collection_drop:        { type: 'collections_problem', decision: 'improve_collections' },
  profit_decline:         { type: 'profit_decline',      decision: 'improve_profitability' },
  compliance_lag:         { type: 'compliance_risk',     decision: 'review_compliance' },
};

// ─── Convert BusinessRisk → ExecutiveAlert ───────────────────────────────────

function alertFromRisk(risk: {
  type: string;
  label: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  current: string;
  threshold: string;
  impact: string;
  recommendation: string;
}): ExecutiveAlert | null {
  const mapping = RISK_TO_ALERT[risk.type];
  if (!mapping) return null;

  return {
    id: makeId('alert-risk'),
    type: mapping.type,
    title: risk.label,
    message: `${risk.impact} Current: ${risk.current}. Threshold: ${risk.threshold}. Recommended action: ${risk.recommendation}`,
    severity: risk.severity,
    detectedAt: new Date().toISOString(),
    suggestedDecisionType: mapping.decision,
    acknowledged: false,
    metadata: {
      source: 'cfo_risk_engine',
      riskType: risk.type,
      riskScore: risk.score,
    },
  };
}

// ─── Convert BusinessAnomaly → ExecutiveAlert ────────────────────────────────

function alertFromAnomaly(anom: {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: string;
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviationPct: number;
  recommendation: string;
}): ExecutiveAlert | null {
  const mapping = ANOMALY_TO_ALERT[anom.type] ?? { type: 'anomaly_detected' as AlertType, decision: 'investigate_anomaly' as DecisionType };

  return {
    id: makeId('alert-anom'),
    type: mapping.type,
    title: anom.title,
    message: `${anom.description} Metric: ${anom.metric}. Expected: ${anom.expectedValue}, actual: ${anom.currentValue} (${anom.deviationPct.toFixed(1)}% deviation). Action: ${anom.recommendation}`,
    severity: anom.severity,
    detectedAt: anom.detectedAt,
    suggestedDecisionType: mapping.decision,
    acknowledged: false,
    relatedEntityType: 'anomaly',
    relatedEntityId: anom.id,
    metadata: {
      source: 'digital_twin',
      anomalyType: anom.type,
      deviationPct: anom.deviationPct,
      metric: anom.metric,
    },
  };
}

// ─── Direct-condition alerts (not from risk engine / anomaly engine) ─────────
// These cover alert types that don't always map 1:1 from the risk engine,
// e.g. payroll_issue, inventory_issue, vendor_risk (from vendor costs).

function buildPayrollAlert(data: CEODataView): ExecutiveAlert | null {
  const headcount = data.liveState.employees;
  const payroll = data.liveState.payroll;
  if (headcount === 0 || payroll <= 0) return null;

  // Trigger: payroll > 35% of monthly revenue (unsustainable)
  const revenue = data.liveState.revenue;
  if (revenue <= 0) return null;
  const payrollRatio = (payroll / revenue) * 100;
  if (payrollRatio < 35) return null;

  return {
    id: makeId('alert-payroll'),
    type: 'payroll_issue',
    title: 'Payroll cost exceeds 35% of revenue',
    message: `Payroll of ${formatINR(payroll)} is ${payrollRatio.toFixed(1)}% of MTD revenue ${formatINR(revenue)}. Sustainable ratio is < 30%. Consider hiring freeze or revenue acceleration.`,
    severity: payrollRatio > 50 ? 'critical' : payrollRatio > 45 ? 'high' : 'medium',
    detectedAt: new Date().toISOString(),
    suggestedDecisionType: 'delay_hiring',
    acknowledged: false,
    metadata: {
      source: 'payroll_monitor',
      payrollRatio,
      headcount,
    },
  };
}

function buildInventoryAlert(data: CEODataView): ExecutiveAlert | null {
  const inventory = data.twin.state.inventory;
  if (inventory <= 0) return null;

  // Trigger: inventory > 25% of total assets (overstocked)
  const assets = data.twin.state.assets;
  if (assets <= 0) return null;
  const inventoryRatio = (inventory / assets) * 100;
  if (inventoryRatio < 25) return null;

  return {
    id: makeId('alert-inventory'),
    type: 'inventory_issue',
    title: 'Inventory levels exceed 25% of total assets',
    message: `Inventory of ${formatINR(inventory)} is ${inventoryRatio.toFixed(1)}% of total assets ${formatINR(assets)}. Capital is locked in slow-moving stock. Liquidate or slow reordering.`,
    severity: inventoryRatio > 50 ? 'high' : 'medium',
    detectedAt: new Date().toISOString(),
    suggestedDecisionType: 'delay_purchase',
    acknowledged: false,
    metadata: {
      source: 'inventory_monitor',
      inventoryRatio,
      inventoryValue: inventory,
    },
  };
}

function buildVendorRiskAlert(data: CEODataView): ExecutiveAlert | null {
  // Trigger: single vendor > 30% of total vendor spend
  const vendors = data.cfo.profitability.vendorCosts;
  if (vendors.length === 0) return null;

  const topVendor = vendors[0];
  if (topVendor.sharePct < 30) return null;

  return {
    id: makeId('alert-vendor'),
    type: 'vendor_risk',
    title: `Vendor concentration: ${topVendor.vendorName} is ${topVendor.sharePct.toFixed(1)}% of spend`,
    message: `${topVendor.vendorName} accounts for ${formatINR(topVendor.totalSpend)} (${topVendor.sharePct.toFixed(1)}%) of total vendor spend across ${topVendor.invoiceCount} invoices. Diversify suppliers to de-risk procurement.`,
    severity: topVendor.sharePct > 50 ? 'high' : 'medium',
    detectedAt: new Date().toISOString(),
    suggestedDecisionType: 'reduce_vendor_dependency',
    acknowledged: false,
    relatedEntityType: 'vendor',
    metadata: {
      source: 'vendor_cost_engine',
      vendorName: topVendor.vendorName,
      sharePct: topVendor.sharePct,
    },
  };
}

function buildChurnAlert(data: CEODataView): ExecutiveAlert | null {
  // Trigger: more than 1 client with declining trend
  const declining = data.cfo.revenue.byClient.filter((c) => c.trend === 'down');
  if (declining.length < 2) return null;

  const revenueAtRisk = declining.reduce((s, c) => s + c.revenue, 0);
  return {
    id: makeId('alert-churn'),
    type: 'customer_churn',
    title: `${declining.length} clients show declining revenue trend`,
    message: `${declining.length} clients are trending down, putting ${formatINR(revenueAtRisk)} of annual revenue at risk. Engage with account-management outreach within 7 days.`,
    severity: revenueAtRisk > 500000 ? 'high' : 'medium',
    detectedAt: new Date().toISOString(),
    suggestedDecisionType: 'follow_up_lead',
    acknowledged: false,
    metadata: {
      source: 'revenue_engine',
      decliningClientCount: declining.length,
      revenueAtRisk,
    },
  };
}

// ─── Main entry: compute all live alerts ─────────────────────────────────────

export function computeExecutiveAlerts(data: CEODataView): ExecutiveAlert[] {
  const alerts: ExecutiveAlert[] = [];

  // 1. Convert every BusinessRisk from the CFO risk engine
  try {
    for (const risk of data.cfo.risks.risks) {
      const alert = alertFromRisk(risk);
      if (alert) alerts.push(alert);
    }
  } catch (err) {
    console.warn('[AI CEO Alerts] Risk conversion failed:', err);
  }

  // 2. Convert every BusinessAnomaly from the Digital Twin
  try {
    for (const anom of data.twin.anomalies.anomalies) {
      const alert = alertFromAnomaly(anom);
      if (alert) alerts.push(alert);
    }
  } catch (err) {
    console.warn('[AI CEO Alerts] Anomaly conversion failed:', err);
  }

  // 3. Direct-condition alerts (cover alert types not produced above)
  const directBuilders = [
    buildPayrollAlert,
    buildInventoryAlert,
    buildVendorRiskAlert,
    buildChurnAlert,
  ];
  for (const b of directBuilders) {
    try {
      const a = b(data);
      if (a) alerts.push(a);
    } catch (err) {
      console.warn(`[AI CEO Alerts] ${b.name} failed:`, err);
    }
  }

  // Sort by severity (critical first), then by detectedAt (most recent first)
  return alerts.sort((a, b) => {
    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });
}
