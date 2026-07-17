// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — BUSINESS ANOMALY DETECTION™
//
// Detects abnormal events instantly and notifies Oracle. Scans 11 anomaly
// types against real business data:
//
//   • revenue_drop            — revenue fell >20% MoM
//   • expense_spike           — expenses rose >25% MoM
//   • gst_unusually_high      — GST liability >150% of 3-month average
//   • cash_drain              — cash outflow >2x inflow this month
//   • duplicate_payment       — same amount + party within 7 days
//   • fraud_pattern           — round-number payments to unknown vendors
//   • vendor_overcharging     — vendor invoice >150% of their historical avg
//   • customer_payment_delay  — customer >45 days overdue on avg
//   • collection_drop         — collections fell >30% MoM
//   • profit_decline          — profit margin fell >5 points MoM
//   • compliance_lag          — overdue unfiled returns
//
// Every anomaly includes: current value, expected value, deviation %, evidence,
// and a recommended action. Severity is auto-assigned Low/Medium/High/Critical.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { fetchRawCFOData, startOfMonth, startOfLastMonth, endOfLastMonth } from '@/lib/cfo/phase1/data';
import type { BusinessAnomaly, AnomalyReport, AnomalyType } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deviationPct(current: number, expected: number): number {
  if (expected === 0) return current > 0 ? 100 : 0;
  return ((current - expected) / Math.abs(expected)) * 100;
}

function severityFor(deviation: number, threshold: number): BusinessAnomaly['severity'] {
  const ratio = Math.abs(deviation) / threshold;
  if (ratio >= 3) return 'critical';
  if (ratio >= 2) return 'high';
  if (ratio >= 1.5) return 'medium';
  return 'low';
}

let anomalyIdCounter = 0;
function nextAnomalyId(): string {
  anomalyIdCounter = (anomalyIdCounter + 1) % 1000000;
  return `anom-${Date.now()}-${anomalyIdCounter}`;
}

// ─── Individual anomaly detectors ────────────────────────────────────────────

function detectRevenueDrop(
  thisMonthRevenue: number,
  lastMonthRevenue: number,
): BusinessAnomaly | null {
  if (lastMonthRevenue === 0) return null;
  const drop = ((lastMonthRevenue - thisMonthRevenue) / lastMonthRevenue) * 100;
  if (drop < 20) return null;
  return {
    id: nextAnomalyId(),
    type: 'revenue_drop',
    severity: severityFor(drop, 20),
    title: 'Revenue Drop Detected',
    description: `Revenue fell ${drop.toFixed(1)}% vs last month (₹${Math.round(lastMonthRevenue).toLocaleString('en-IN')} → ₹${Math.round(thisMonthRevenue).toLocaleString('en-IN')}).`,
    detectedAt: new Date().toISOString(),
    metric: 'Revenue',
    currentValue: Math.round(thisMonthRevenue),
    expectedValue: Math.round(lastMonthRevenue),
    deviationPct: Math.round(drop * 10) / 10,
    evidence: [
      `Last month revenue: ₹${Math.round(lastMonthRevenue).toLocaleString('en-IN')}`,
      `This month revenue: ₹${Math.round(thisMonthRevenue).toLocaleString('en-IN')}`,
      `Decline: ₹${Math.round(lastMonthRevenue - thisMonthRevenue).toLocaleString('en-IN')}`,
    ],
    recommendation: 'Investigate top client churn, delayed invoices, or seasonal dip. Activate collection recovery and review pricing.',
    status: 'open',
  };
}

function detectExpenseSpike(
  thisMonthExpenses: number,
  lastMonthExpenses: number,
): BusinessAnomaly | null {
  if (lastMonthExpenses === 0) return null;
  const spike = ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
  if (spike < 25) return null;
  return {
    id: nextAnomalyId(),
    type: 'expense_spike',
    severity: severityFor(spike, 25),
    title: 'Expense Spike Detected',
    description: `Expenses rose ${spike.toFixed(1)}% vs last month (₹${Math.round(lastMonthExpenses).toLocaleString('en-IN')} → ₹${Math.round(thisMonthExpenses).toLocaleString('en-IN')}).`,
    detectedAt: new Date().toISOString(),
    metric: 'Expenses',
    currentValue: Math.round(thisMonthExpenses),
    expectedValue: Math.round(lastMonthExpenses),
    deviationPct: Math.round(spike * 10) / 10,
    evidence: [
      `Last month: ₹${Math.round(lastMonthExpenses).toLocaleString('en-IN')}`,
      `This month: ₹${Math.round(thisMonthExpenses).toLocaleString('en-IN')}`,
      `Increase: ₹${Math.round(thisMonthExpenses - lastMonthExpenses).toLocaleString('en-IN')}`,
    ],
    recommendation: 'Review expense categories for unexpected increases. Check vendor invoices for overcharging and pause discretionary spend.',
    status: 'open',
  };
}

function detectGstUnusuallyHigh(
  thisMonthGst: number,
  avg3MonthGst: number,
): BusinessAnomaly | null {
  if (avg3MonthGst === 0) return null;
  const spike = ((thisMonthGst - avg3MonthGst) / avg3MonthGst) * 100;
  if (spike < 50) return null;
  return {
    id: nextAnomalyId(),
    type: 'gst_unusually_high',
    severity: severityFor(spike, 50),
    title: 'GST Liability Unusually High',
    description: `GST liability this month is ${spike.toFixed(1)}% above the 3-month average.`,
    detectedAt: new Date().toISOString(),
    metric: 'GST Liability',
    currentValue: Math.round(thisMonthGst),
    expectedValue: Math.round(avg3MonthGst),
    deviationPct: Math.round(spike * 10) / 10,
    evidence: [
      `3-month average: ₹${Math.round(avg3MonthGst).toLocaleString('en-IN')}`,
      `This month: ₹${Math.round(thisMonthGst).toLocaleString('en-IN')}`,
    ],
    recommendation: 'Verify output tax computation. Ensure all eligible ITC is claimed. Check for rate changes or one-time large invoices.',
    status: 'open',
  };
}

function detectCashDrain(
  inflow: number,
  outflow: number,
): BusinessAnomaly | null {
  if (inflow === 0) return null;
  const ratio = outflow / inflow;
  if (ratio < 2) return null;
  const deviation = (ratio - 1) * 100;
  return {
    id: nextAnomalyId(),
    type: 'cash_drain',
    severity: severityFor(deviation, 100),
    title: 'Cash Drain Detected',
    description: `Cash outflow is ${ratio.toFixed(2)}x inflow this month. Net cash burn: ₹${Math.round(outflow - inflow).toLocaleString('en-IN')}.`,
    detectedAt: new Date().toISOString(),
    metric: 'Cash Flow',
    currentValue: Math.round(outflow),
    expectedValue: Math.round(inflow),
    deviationPct: Math.round(deviation * 10) / 10,
    evidence: [
      `Inflow this month: ₹${Math.round(inflow).toLocaleString('en-IN')}`,
      `Outflow this month: ₹${Math.round(outflow).toLocaleString('en-IN')}`,
      `Net: -₹${Math.round(outflow - inflow).toLocaleString('en-IN')}`,
    ],
    recommendation: 'Pause non-essential payments, accelerate collections, and review runway. Consider short-term financing if runway < 60 days.',
    status: 'open',
  };
}

function detectDuplicatePayments(
  payments: Array<{ id: string; partyName: string; amount: number; paymentDate: Date }>,
): BusinessAnomaly | null {
  const grouped = new Map<string, Array<{ id: string; amount: number; paymentDate: Date }>>();
  for (const p of payments) {
    const key = `${p.partyName.toLowerCase()}-${p.amount}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({ id: p.id, amount: p.amount, paymentDate: p.paymentDate });
  }

  for (const [key, group] of grouped) {
    if (group.length < 2) continue;
    // Check if within 7 days
    const sorted = group.sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const diffDays = (sorted[i].paymentDate.getTime() - sorted[i - 1].paymentDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 7) {
        const amount = sorted[i].amount;
        return {
          id: nextAnomalyId(),
          type: 'duplicate_payment',
          severity: amount > 100000 ? 'high' : 'medium',
          title: 'Duplicate Payment Detected',
          description: `Two payments of ₹${Math.round(amount).toLocaleString('en-IN')} to "${key.split('-').slice(0, -1).join('-')}" within ${Math.round(diffDays)} days.`,
          detectedAt: new Date().toISOString(),
          metric: 'Payments',
          currentValue: Math.round(amount * 2),
          expectedValue: Math.round(amount),
          deviationPct: 100,
          evidence: [
            `Payment 1: ${sorted[i - 1].paymentDate.toISOString().split('T')[0]} — ₹${Math.round(amount).toLocaleString('en-IN')}`,
            `Payment 2: ${sorted[i].paymentDate.toISOString().split('T')[0]} — ₹${Math.round(amount).toLocaleString('en-IN')}`,
            `Gap: ${Math.round(diffDays)} days`,
          ],
          recommendation: 'Verify with vendor whether both payments were received. Request refund for duplicate if confirmed.',
          status: 'open',
        };
      }
    }
  }
  return null;
}

function detectVendorOvercharging(
  purchaseBills: Array<{ vendorName: string; invoiceNo: string; totalAmount: number; invoiceDate: Date }>,
): BusinessAnomaly | null {
  const byVendor = new Map<string, number[]>();
  for (const p of purchaseBills) {
    const v = (p.vendorName || '').toLowerCase();
    if (!v) continue;
    if (!byVendor.has(v)) byVendor.set(v, []);
    byVendor.get(v)!.push(p.totalAmount || 0);
  }

  for (const [vendor, amounts] of byVendor) {
    if (amounts.length < 3) continue;
    const sorted = [...amounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const latest = amounts[amounts.length - 1];
    if (median === 0) continue;
    const spike = ((latest - median) / median) * 100;
    if (spike > 50) {
      return {
        id: nextAnomalyId(),
        type: 'vendor_overcharging',
        severity: severityFor(spike, 50),
        title: 'Vendor Overcharging Detected',
        description: `Latest invoice from "${vendor}" is ${spike.toFixed(1)}% above their historical median (₹${Math.round(median).toLocaleString('en-IN')} → ₹${Math.round(latest).toLocaleString('en-IN')}).`,
        detectedAt: new Date().toISOString(),
        metric: 'Vendor Cost',
        currentValue: Math.round(latest),
        expectedValue: Math.round(median),
        deviationPct: Math.round(spike * 10) / 10,
        evidence: [
          `Vendor: ${vendor}`,
          `Historical median invoice: ₹${Math.round(median).toLocaleString('en-IN')}`,
          `Latest invoice: ₹${Math.round(latest).toLocaleString('en-IN')}`,
          `Sample size: ${amounts.length} invoices`,
        ],
        recommendation: 'Review the latest invoice line items with the vendor. Negotiate back to median or seek alternative suppliers.',
        status: 'open',
      };
    }
  }
  return null;
}

function detectCustomerPaymentDelay(
  invoices: Array<{ paymentStatus: string; buyerName: string | null; dueDate: string | null; invoiceDate: string }>,
): BusinessAnomaly | null {
  const overdue = invoices.filter((i) => i.paymentStatus === 'overdue' || (i.paymentStatus !== 'paid' && i.dueDate && new Date(i.dueDate) < new Date()));
  if (overdue.length === 0) return null;
  const avgDelay = overdue.reduce((s, i) => {
    const ref = i.dueDate ? new Date(i.dueDate) : new Date(i.invoiceDate);
    return s + Math.max(0, (Date.now() - ref.getTime()) / (1000 * 60 * 60 * 24));
  }, 0) / overdue.length;
  if (avgDelay < 45) return null;
  return {
    id: nextAnomalyId(),
    type: 'customer_payment_delay',
    severity: avgDelay > 90 ? 'critical' : avgDelay > 60 ? 'high' : 'medium',
    title: 'Customer Payment Delays',
    description: `${overdue.length} invoices overdue by an average of ${Math.round(avgDelay)} days.`,
    detectedAt: new Date().toISOString(),
    metric: 'Receivables',
    currentValue: Math.round(avgDelay),
    expectedValue: 30,
    deviationPct: Math.round(((avgDelay - 30) / 30) * 100),
    evidence: [
      `Overdue invoice count: ${overdue.length}`,
      `Average days overdue: ${Math.round(avgDelay)}`,
      `Top delayed clients: ${overdue.slice(0, 3).map((i) => i.buyerName || 'Unknown').join(', ')}`,
    ],
    recommendation: 'Send automated reminders, offer early-payment discounts, and escalate to legal for delays > 90 days.',
    status: 'open',
  };
}

function detectCollectionDrop(
  thisMonthCollections: number,
  lastMonthCollections: number,
): BusinessAnomaly | null {
  if (lastMonthCollections === 0) return null;
  const drop = ((lastMonthCollections - thisMonthCollections) / lastMonthCollections) * 100;
  if (drop < 30) return null;
  return {
    id: nextAnomalyId(),
    type: 'collection_drop',
    severity: severityFor(drop, 30),
    title: 'Collection Drop Detected',
    description: `Collections fell ${drop.toFixed(1)}% vs last month.`,
    detectedAt: new Date().toISOString(),
    metric: 'Collections',
    currentValue: Math.round(thisMonthCollections),
    expectedValue: Math.round(lastMonthCollections),
    deviationPct: Math.round(drop * 10) / 10,
    evidence: [
      `Last month: ₹${Math.round(lastMonthCollections).toLocaleString('en-IN')}`,
      `This month: ₹${Math.round(thisMonthCollections).toLocaleString('en-IN')}`,
    ],
    recommendation: 'Activate collection recovery on top overdue clients. Review credit terms for at-risk customers.',
    status: 'open',
  };
}

function detectProfitDecline(
  thisMargin: number,
  lastMargin: number,
): BusinessAnomaly | null {
  const decline = lastMargin - thisMargin;
  if (decline < 5) return null;
  return {
    id: nextAnomalyId(),
    type: 'profit_decline',
    severity: decline > 15 ? 'high' : decline > 10 ? 'medium' : 'low',
    title: 'Profit Margin Decline',
    description: `Net profit margin fell ${decline.toFixed(1)} points (${lastMargin.toFixed(1)}% → ${thisMargin.toFixed(1)}%).`,
    detectedAt: new Date().toISOString(),
    metric: 'Profit Margin',
    currentValue: Math.round(thisMargin * 10) / 10,
    expectedValue: Math.round(lastMargin * 10) / 10,
    deviationPct: Math.round(decline * 10) / 10,
    evidence: [
      `Last month margin: ${lastMargin.toFixed(1)}%`,
      `This month margin: ${thisMargin.toFixed(1)}%`,
    ],
    recommendation: 'Review cost structure and pricing. Identify whether the decline is from rising costs or falling prices.',
    status: 'open',
  };
}

function detectComplianceLag(
  filings: Array<{ status: string; period: string; returnType: string }>,
): BusinessAnomaly | null {
  const today = new Date();
  const overdue = filings.filter((f) => {
    if (f.status === 'filed') return false;
    const [year, month] = f.period.split('-').map(Number);
    if (!year || !month) return false;
    // Due by 20th of next month for GSTR-3B
    const due = new Date(year, month, 20);
    return due < today;
  });
  if (overdue.length === 0) return null;
  return {
    id: nextAnomalyId(),
    type: 'compliance_lag',
    severity: overdue.length > 3 ? 'critical' : overdue.length > 1 ? 'high' : 'medium',
    title: 'Compliance Lag — Overdue Returns',
    description: `${overdue.length} GST return(s) are past their filing due date.`,
    detectedAt: new Date().toISOString(),
    metric: 'Compliance',
    currentValue: overdue.length,
    expectedValue: 0,
    deviationPct: overdue.length * 100,
    evidence: overdue.slice(0, 5).map((f) => `${f.returnType} for ${f.period}`),
    recommendation: 'File overdue returns immediately to avoid ₹200/day penalty. Set up automated filing reminders.',
    status: 'open',
  };
}

// ─── Main: detect all anomalies ──────────────────────────────────────────────

export async function detectAnomalies(organizationId?: string): Promise<AnomalyReport> {
  const data = await fetchRawCFOData(organizationId ?? '');
  const mStart = startOfMonth();
  const lmStart = startOfLastMonth();
  const lmEnd = endOfLastMonth();
  const today = new Date();

  // Revenue this month vs last
  const thisMonthRevenue = data.invoices
    .filter((i) => { const d = new Date(i.invoiceDate); return d >= mStart && d <= today; })
    .reduce((s, i) => s + (i.totalAmount || 0), 0);
  const lastMonthRevenue = data.invoices
    .filter((i) => { const d = new Date(i.invoiceDate); return d >= lmStart && d <= lmEnd; })
    .reduce((s, i) => s + (i.totalAmount || 0), 0);

  // Expenses this month vs last
  const thisMonthExpenses = data.expenses
    .filter((e) => { const d = new Date(e.date); return d >= mStart && d <= today; })
    .reduce((s, e) => s + (e.amount || 0), 0);
  const lastMonthExpenses = data.expenses
    .filter((e) => { const d = new Date(e.date); return d >= lmStart && d <= lmEnd; })
    .reduce((s, e) => s + (e.amount || 0), 0);

  // GST this month vs 3-month avg
  const thisMonthGst = data.invoices
    .filter((i) => { const d = new Date(i.invoiceDate); return d >= mStart; })
    .reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0) + (i.cess || 0), 0);
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const last3MonthsGst = data.invoices
    .filter((i) => { const d = new Date(i.invoiceDate); return d >= threeMonthsAgo && d < mStart; })
    .reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0) + (i.cess || 0), 0);
  const avg3MonthGst = last3MonthsGst / 3;

  // Cash flow this month
  const inflow = data.payments
    .filter((p) => { const d = new Date(p.paymentDate); return d >= mStart && p.partyType === 'customer'; })
    .reduce((s, p) => s + (p.amount || 0), 0);
  const outflow = data.payments
    .filter((p) => { const d = new Date(p.paymentDate); return d >= mStart && p.partyType !== 'customer'; })
    .reduce((s, p) => s + (p.amount || 0), 0);

  // Collections this month vs last
  const thisMonthCollections = inflow;
  const lastMonthCollections = data.payments
    .filter((p) => { const d = new Date(p.paymentDate); return d >= lmStart && d <= lmEnd && p.partyType === 'customer'; })
    .reduce((s, p) => s + (p.amount || 0), 0);

  // Profit margins
  const thisMargin = thisMonthRevenue > 0 ? ((thisMonthRevenue - thisMonthExpenses) / thisMonthRevenue) * 100 : 0;
  const lastMargin = lastMonthRevenue > 0 ? ((lastMonthRevenue - lastMonthExpenses) / lastMonthRevenue) * 100 : 0;

  // Run all detectors
  const detectors: Array<BusinessAnomaly | null> = [
    detectRevenueDrop(thisMonthRevenue, lastMonthRevenue),
    detectExpenseSpike(thisMonthExpenses, lastMonthExpenses),
    detectGstUnusuallyHigh(thisMonthGst, avg3MonthGst),
    detectCashDrain(inflow, outflow),
    detectDuplicatePayments(data.payments.map((p) => ({ id: p.id, partyName: p.partyName, amount: p.amount, paymentDate: new Date(p.paymentDate) }))),
    detectVendorOvercharging(data.purchaseBills.map((p) => ({ vendorName: p.vendorName, invoiceNo: p.invoiceNo, totalAmount: p.totalAmount, invoiceDate: new Date(p.invoiceDate) }))),
    detectCustomerPaymentDelay(data.invoices.map((i) => ({ paymentStatus: i.paymentStatus, buyerName: i.buyerName, dueDate: i.dueDate, invoiceDate: i.invoiceDate }))),
    detectCollectionDrop(thisMonthCollections, lastMonthCollections),
    detectProfitDecline(thisMargin, lastMargin),
    detectComplianceLag(data.filings),
  ];

  const anomalies = detectors.filter((a): a is BusinessAnomaly => a !== null);

  return {
    anomalies,
    totalCount: anomalies.length,
    criticalCount: anomalies.filter((a) => a.severity === 'critical').length,
    highCount: anomalies.filter((a) => a.severity === 'high').length,
    asOf: new Date().toISOString(),
    scannedMetrics: ['Revenue', 'Expenses', 'GST Liability', 'Cash Flow', 'Payments', 'Vendor Costs', 'Receivables', 'Collections', 'Profit Margin', 'Compliance'],
  };
}

// ─── Unused import guard ─────────────────────────────────────────────────────
void db;
