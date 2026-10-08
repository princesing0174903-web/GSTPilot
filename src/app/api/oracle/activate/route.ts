// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Activation API
// POST /api/oracle/activate
//
// Production backend workflow that runs when the user completes the 4-step
// activation wizard and clicks "Activate Oracle". This is NOT a flag flip —
// it executes a real end-to-end pipeline:
//
//   1. Authenticate the caller (Firebase ID token → uid)
//   2. Verify org membership (organization_members/{orgId}_{uid} exists)
//   3. Generate the centralized Business Snapshot from real data sources:
//        • Prisma DB (invoices, customers, expenses, payments, GST returns)
//        • Zoho Books synced entities (ZohoCustomer, ZohoInvoice, …)
//        • Google Workspace connection state
//   4. Calculate every score from real numbers (never hardcoded):
//        revenue, customers, invoices, GST, cash position, health score,
//        collection rate, risk score, compliance, runway, forecast
//   5. Persist to Firestore:
//        a. organizations/{orgId} doc → integrations.oracle = { connected,
//           activatedAt, activatedBy, snapshot summary }
//        b. organizations/{orgId}/oracle/activation doc → full snapshot +
//           scores + activation metadata (audit record)
//        c. activities/{activityId} → "Oracle Activated" timeline event
//        d. aiRecommendations/{recId} → real recommendations generated FROM
//           the snapshot (replaces placeholder recs)
//   6. Return the activation result so the client can update immediately
//      (no polling, no temp state — the org reload confirms persistence).
//
// Auth: Bearer token in the Authorization header (Firebase ID token).
// Body: { organizationId: string }
//
// Response (200): { ok: true, activation: {...}, snapshot: {...} }
// Response (4xx/5xx): { ok: false, error: string }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getBusinessSnapshot, type BusinessSnapshot } from '@/lib/business/snapshot';
import { emitTimelineEvent } from '@/lib/timeline/emit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Oracle Insights type (persisted to organizations/{orgId}/oracle/insights) ─
//
// This is the "Oracle is alive" payload: every page that reads Oracle state
// (Dashboard, Oracle Workspace, AI CFO, etc.) renders from this single doc.
// All numbers derive from the real BusinessSnapshot — nothing is fabricated.

export interface OracleInsights {
  organizationId: string;
  generatedAt: string;
  generatedFromSnapshotAt: string;

  // 1. Business Summary — 2-3 sentence narrative
  businessSummary: string;

  // 2. Today's Priorities — 3-5 priority items
  todaysPriorities: Array<{
    id: string;
    title: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
    actionView: string;
  }>;

  // 3. Financial Health
  financialHealth: {
    score: number;
    status: 'healthy' | 'moderate' | 'at-risk';
    drivers: Array<{
      label: string;
      value: string;
      impact: 'positive' | 'negative';
    }>;
  };

  // 4. Revenue Trend
  revenueTrend: {
    direction: 'up' | 'down' | 'flat';
    currentRevenue: number;
    projectedRevenue: number;
    changePercent: number;
    narrative: string;
  };

  // 5. Cash Forecast
  cashForecast: {
    currentCash: number;
    monthlyBurnRate: number;
    runwayDays: number | null; // null when Infinity
    projectedCashIn30Days: number;
    status: 'comfortable' | 'tight' | 'critical';
    narrative: string;
  };

  // 6. AI Alerts
  aiAlerts: Array<{
    type: string;
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    actionView: string;
  }>;

  // 7. Risks
  risks: Array<{
    type: string;
    level: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    mitigation: string;
  }>;
}

// ─── Oracle Insights generator (from real BusinessSnapshot) ────────────────────
//
// Every section derives from real snapshot numbers. No fabricated data.
// If a section has no relevant data (e.g. no alerts triggered), return an
// empty array / honest narrative — never invented content.

export function generateOracleInsights(snapshot: BusinessSnapshot): OracleInsights {
  const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  // ─── 1. Business Summary ───────────────────────────────────────────────────
  // 2-3 sentence narrative. Honest observation derived from health score,
  // revenue, customer count, and overdue receivables.
  let observation: string;
  if (snapshot.healthScore >= 70) {
    observation = `Health score is strong at ${snapshot.healthScore}/100 — your business is in solid shape.`;
  } else if (snapshot.healthScore >= 40) {
    observation = `Health score is moderate at ${snapshot.healthScore}/100 — a few areas need attention.`;
  } else if (snapshot.healthScore > 0) {
    observation = `Health score is concerning at ${snapshot.healthScore}/100 — immediate action is recommended.`;
  } else {
    observation = `Health score is unavailable — connect integrations to compute it.`;
  }
  const businessSummary =
    snapshot.invoiceCount > 0 || snapshot.customerCount > 0
      ? `Your business has ${snapshot.customerCount} customer${snapshot.customerCount === 1 ? '' : 's'}, ` +
        `${snapshot.invoiceCount} invoice${snapshot.invoiceCount === 1 ? '' : 's'}, and ` +
        `${inr(snapshot.revenue)} in revenue this financial year. ${observation}`
      : `Your business workspace is ready but has no invoices or customers yet. ` +
        `Connect Zoho Books or create your first customer to start generating insights. ${observation}`;

  // ─── 2. Today's Priorities (3-5 items) ─────────────────────────────────────
  const priorities: OracleInsights['todaysPriorities'] = [];

  if (snapshot.pendingReturns > 0) {
    priorities.push({
      id: 'file-pending-gst',
      title: `File ${snapshot.pendingReturns} pending GST return${snapshot.pendingReturns === 1 ? '' : 's'}`,
      reason: snapshot.overdueReturns > 0
        ? `${snapshot.overdueReturns} of these are overdue — late filing attracts penalties and interest.`
        : `Net GST liability of ${inr(snapshot.gstLiability)} is outstanding.`,
      priority: snapshot.overdueReturns > 0 ? 'high' : 'medium',
      actionView: 'returns',
    });
  }

  if (snapshot.overdueReceivables > 0) {
    priorities.push({
      id: 'collect-overdue',
      title: `Collect ${inr(snapshot.overdueReceivables)} in overdue receivables`,
      reason: `${inr(snapshot.receivables)} is outstanding across ${snapshot.invoiceCount} invoices. Overdue balances strain your cash position.`,
      priority: 'high',
      actionView: 'receivables',
    });
  } else if (snapshot.receivables > 0) {
    priorities.push({
      id: 'collect-receivables',
      title: `Follow up on ${inr(snapshot.receivables)} in outstanding receivables`,
      reason: `Collection rate is currently ${pct(snapshot.collectionRate)}. Tightening payment terms can improve cash flow.`,
      priority: 'medium',
      actionView: 'receivables',
    });
  }

  if (snapshot.runwayDays !== Infinity && snapshot.runwayDays > 0 && snapshot.runwayDays < 90) {
    priorities.push({
      id: 'manage-runway',
      title: `Plan funding — cash runway is ${Math.round(snapshot.runwayDays)} days`,
      reason: `At current burn rate, cash runs out in ~${Math.round(snapshot.runwayDays)} days. Secure a credit line or accelerate collections.`,
      priority: snapshot.runwayDays < 60 ? 'high' : 'medium',
      actionView: 'banking',
    });
  }

  const zohoConnected =
    snapshot.perEntity.zohoInvoices > 0 || snapshot.perEntity.zohoCustomers > 0;
  if (!zohoConnected && snapshot.invoiceCount === 0) {
    priorities.push({
      id: 'connect-zoho',
      title: 'Connect Zoho Books for richer insights',
      reason: 'No invoices or customers yet. Zoho Books sync brings in your live ERP data automatically.',
      priority: 'medium',
      actionView: 'zoho-books',
    });
  }

  if (snapshot.healthScore > 0 && snapshot.healthScore < 50) {
    priorities.push({
      id: 'review-health',
      title: `Review business health (score ${snapshot.healthScore}/100)`,
      reason: `Low health driven by ${snapshot.riskScore > 50 ? 'high risk' : 'thin margins'}. Review profitability, liquidity, and compliance drivers.`,
      priority: 'medium',
      actionView: 'ai-business-copilot',
    });
  }

  // If everything is fine, add a positive "monitor" priority
  if (priorities.length === 0) {
    priorities.push({
      id: 'maintain-momentum',
      title: 'Maintain momentum — business is in good shape',
      reason: `Health score ${snapshot.healthScore}/100, collection rate ${pct(snapshot.collectionRate)}, no overdue returns. Keep monitoring cash flow.`,
      priority: 'low',
      actionView: 'ai-business-copilot',
    });
  }

  const todaysPriorities = priorities.slice(0, 5);

  // ─── 3. Financial Health ───────────────────────────────────────────────────
  // Drivers derived from profit margin, collection rate, cash position, compliance.
  const healthDrivers: OracleInsights['financialHealth']['drivers'] = [];

  if (snapshot.revenue > 0) {
    const marginPct = snapshot.profitMargin * 100;
    healthDrivers.push({
      label: 'Profit margin',
      value: `${marginPct.toFixed(1)}%`,
      impact: marginPct >= 10 ? 'positive' : 'negative',
    });
  }

  if (snapshot.revenue > 0 || snapshot.totalCollected > 0) {
    const ratePct = snapshot.collectionRate * 100;
    healthDrivers.push({
      label: 'Collection rate',
      value: `${ratePct.toFixed(0)}%`,
      impact: ratePct >= 70 ? 'positive' : 'negative',
    });
  }

  healthDrivers.push({
    label: 'Cash position',
    value: inr(snapshot.cash),
    impact: snapshot.cash > snapshot.payables ? 'positive' : 'negative',
  });

  const totalReturns = snapshot.filedReturns + snapshot.pendingReturns;
  if (totalReturns > 0) {
    const compliancePct = (snapshot.filedReturns / totalReturns) * 100;
    healthDrivers.push({
      label: 'GST compliance',
      value: `${compliancePct.toFixed(0)}% filed`,
      impact: compliancePct >= 80 ? 'positive' : 'negative',
    });
  } else {
    healthDrivers.push({
      label: 'GST compliance',
      value: 'No returns yet',
      impact: 'negative',
    });
  }

  const healthStatus: OracleInsights['financialHealth']['status'] =
    snapshot.healthScore >= 70 ? 'healthy' : snapshot.healthScore >= 40 ? 'moderate' : 'at-risk';

  const financialHealth: OracleInsights['financialHealth'] = {
    score: snapshot.healthScore,
    status: healthStatus,
    drivers: healthDrivers,
  };

  // ─── 4. Revenue Trend ──────────────────────────────────────────────────────
  // Based on forecast.trend + nextMonthRevenue vs current revenue.
  const currentRevenue = snapshot.revenue;
  const projectedRevenue = snapshot.forecast.nextMonthRevenue;
  const changePercent =
    currentRevenue > 0
      ? ((projectedRevenue - currentRevenue) / currentRevenue) * 100
      : projectedRevenue > 0
        ? 100
        : 0;

  const direction = snapshot.forecast.trend; // 'up' | 'down' | 'flat'

  const revenueTrendNarrative =
    currentRevenue === 0 && projectedRevenue === 0
      ? 'No revenue data yet. Connect Zoho Books or create invoices to enable forecasting.'
      : direction === 'up'
        ? `Revenue is trending up — projected ${inr(projectedRevenue)} next month (vs ${inr(currentRevenue)} current), a ${Math.abs(changePercent).toFixed(1)}% increase. Confidence: ${pct(snapshot.forecast.confidence)}.`
        : direction === 'down'
          ? `Revenue is trending down — projected ${inr(projectedRevenue)} next month (vs ${inr(currentRevenue)} current), a ${Math.abs(changePercent).toFixed(1)}% decrease. Confidence: ${pct(snapshot.forecast.confidence)}.`
          : `Revenue is stable — projected ${inr(projectedRevenue)} next month, roughly flat vs current ${inr(currentRevenue)}. Confidence: ${pct(snapshot.forecast.confidence)}.`;

  const revenueTrend: OracleInsights['revenueTrend'] = {
    direction,
    currentRevenue,
    projectedRevenue,
    changePercent: Math.round(changePercent * 10) / 10,
    narrative: revenueTrendNarrative,
  };

  // ─── 5. Cash Forecast ──────────────────────────────────────────────────────
  // If runwayDays is Infinity, status='comfortable'.
  const monthlyBurnRate = snapshot.expenses / 12; // annual expenses / 12 (rough)
  const projectedCashIn30Days = snapshot.cash - monthlyBurnRate;

  let cashStatus: OracleInsights['cashForecast']['status'];
  let cashNarrative: string;

  if (snapshot.runwayDays === Infinity) {
    cashStatus = 'comfortable';
    cashNarrative = `Cash position is ${inr(snapshot.cash)} with no significant burn — runway is effectively unlimited. Continue monitoring inflows.`;
  } else if (snapshot.runwayDays >= 180) {
    cashStatus = 'comfortable';
    cashNarrative = `Cash position is ${inr(snapshot.cash)} with ~${Math.round(snapshot.runwayDays)} days of runway. Healthy buffer.`;
  } else if (snapshot.runwayDays >= 60) {
    cashStatus = 'tight';
    cashNarrative = `Cash position is ${inr(snapshot.cash)} with ~${Math.round(snapshot.runwayDays)} days of runway. Plan funding in the next quarter.`;
  } else if (snapshot.runwayDays > 0) {
    cashStatus = 'critical';
    cashNarrative = `Cash position is ${inr(snapshot.cash)} with only ~${Math.round(snapshot.runwayDays)} days of runway. Secure funding immediately.`;
  } else {
    cashStatus = 'critical';
    cashNarrative = `Cash position is ${inr(snapshot.cash)} — burn exceeds available cash. Urgent action required.`;
  }

  const cashForecast: OracleInsights['cashForecast'] = {
    currentCash: snapshot.cash,
    monthlyBurnRate: Math.round(monthlyBurnRate),
    runwayDays: snapshot.runwayDays === Infinity ? null : Math.round(snapshot.runwayDays),
    projectedCashIn30Days: Math.round(projectedCashIn30Days),
    status: cashStatus,
    narrative: cashNarrative,
  };

  // ─── 6. AI Alerts (0-4) ────────────────────────────────────────────────────
  // Rules from the task spec:
  //   - overdueReceivables > 0       → alert
  //   - pendingReturns > 0           → alert
  //   - collectionRate < 0.5         → alert
  //   - healthScore < 40             → alert
  //   - runwayDays < 60              → alert
  const aiAlerts: OracleInsights['aiAlerts'] = [];

  if (snapshot.overdueReceivables > 0) {
    aiAlerts.push({
      type: 'overdue_receivables',
      severity: snapshot.overdueReceivables > snapshot.revenue * 0.3 ? 'high' : 'medium',
      title: `${inr(snapshot.overdueReceivables)} in overdue receivables`,
      description: `${snapshot.invoiceCount} invoices tracked. Customers with past-due balances need immediate follow-up.`,
      actionView: 'receivables',
    });
  }

  if (snapshot.pendingReturns > 0) {
    aiAlerts.push({
      type: 'pending_gst_returns',
      severity: snapshot.overdueReturns > 0 ? 'high' : 'medium',
      title: `${snapshot.pendingReturns} GST return${snapshot.pendingReturns === 1 ? '' : 's'} pending`,
      description: snapshot.overdueReturns > 0
        ? `${snapshot.overdueReturns} are overdue — late filing attracts penalties and interest.`
        : `Net GST liability of ${inr(snapshot.gstLiability)} outstanding.`,
      actionView: 'returns',
    });
  }

  if (snapshot.revenue > 0 && snapshot.collectionRate < 0.5) {
    aiAlerts.push({
      type: 'low_collection_rate',
      severity: 'medium',
      title: `Collection rate is low (${pct(snapshot.collectionRate)})`,
      description: `Collected ${inr(snapshot.totalCollected)} of ${inr(snapshot.revenue)} invoiced. Tighten payment terms and automate reminders.`,
      actionView: 'receivables',
    });
  }

  if (snapshot.healthScore > 0 && snapshot.healthScore < 40) {
    aiAlerts.push({
      type: 'low_health_score',
      severity: 'high',
      title: `Health score is critically low (${snapshot.healthScore}/100)`,
      description: `Composite health is below 40 — driven by weak margins, liquidity, or compliance. Review the financial health drivers.`,
      actionView: 'ai-business-copilot',
    });
  }

  if (snapshot.runwayDays !== Infinity && snapshot.runwayDays > 0 && snapshot.runwayDays < 60) {
    aiAlerts.push({
      type: 'short_runway',
      severity: 'high',
      title: `Cash runway is only ${Math.round(snapshot.runwayDays)} days`,
      description: `At current burn, cash runs out in ~${Math.round(snapshot.runwayDays)} days. Secure a credit line or accelerate collections.`,
      actionView: 'banking',
    });
  }

  // Cap at 4 alerts (per spec)
  const aiAlertsCapped = aiAlerts.slice(0, 4);

  // ─── 7. Risks (0-3) ────────────────────────────────────────────────────────
  // Rules from the task spec:
  //   - riskScore > 60                                  → high risk
  //   - receivables > revenue * 0.5                     → liquidity risk
  //   - pendingReturns > 3                              → compliance risk
  const risks: OracleInsights['risks'] = [];

  if (snapshot.riskScore > 60) {
    risks.push({
      type: 'overall_risk',
      level: snapshot.riskScore > 75 ? 'high' : 'medium',
      title: `Elevated business risk score (${snapshot.riskScore}/100)`,
      description: `Composite risk is high. Drivers may include thin margins, low liquidity, or compliance gaps.`,
      mitigation: 'Review profitability, accelerate collections, and file pending GST returns to reduce the risk score.',
    });
  }

  if (snapshot.revenue > 0 && snapshot.receivables > snapshot.revenue * 0.5) {
    risks.push({
      type: 'liquidity_risk',
      level: snapshot.receivables > snapshot.revenue * 0.75 ? 'high' : 'medium',
      title: `Receivables are ${pct(snapshot.receivables / snapshot.revenue)} of revenue`,
      description: `${inr(snapshot.receivables)} is tied up in outstanding invoices. High receivables-to-revenue ratio strains working capital.`,
      mitigation: 'Tighten payment terms, send automated reminders, and offer early-payment discounts to accelerate collections.',
    });
  }

  if (snapshot.pendingReturns > 3) {
    risks.push({
      type: 'compliance_risk',
      level: snapshot.overdueReturns > 0 ? 'high' : 'medium',
      title: `${snapshot.pendingReturns} GST returns pending`,
      description: `Multiple pending returns increase compliance risk — late filing attracts penalties, interest, and potential notice from authorities.`,
      mitigation: 'Prioritize filing the oldest pending returns first. Set up auto-reminders for upcoming due dates.',
    });
  }

  const risksCapped = risks.slice(0, 3);

  return {
    organizationId: snapshot.organizationId,
    generatedAt: new Date().toISOString(),
    generatedFromSnapshotAt: snapshot.generatedAt,
    businessSummary,
    todaysPriorities,
    financialHealth,
    revenueTrend,
    cashForecast,
    aiAlerts: aiAlertsCapped,
    risks: risksCapped,
  };
}

// ─── AI Recommendation generator (from real snapshot) ─────────────────────────
//
// Takes the computed Business Snapshot and produces concrete, actionable
// recommendations. Every recommendation cites a real number from the snapshot.
// No placeholder recs, no fabricated urgency.

interface GeneratedRecommendation {
  type: string;
  title: string;
  description: string;
  actionLabel: string;
  priority: 'high' | 'medium' | 'low';
  actionView: string;
}

function generateRecommendationsFromSnapshot(s: BusinessSnapshot): GeneratedRecommendation[] {
  const recs: GeneratedRecommendation[] = [];

  // 1. Overdue receivables → collection action
  if (s.overdueReceivables > 0) {
    recs.push({
      type: 'collect_overdue',
      title: `Collect ₹${Math.round(s.overdueReceivables).toLocaleString('en-IN')} in overdue receivables`,
      description: `${s.invoiceCount} invoices tracked. Overdue receivables are dragging your cash position. Follow up with customers who have past-due invoices.`,
      actionLabel: 'View receivables',
      priority: 'high',
      actionView: 'receivables',
    });
  }

  // 2. GST liability pending → file returns
  if (s.gstLiability > 0 && s.pendingReturns > 0) {
    recs.push({
      type: 'file_gst',
      title: `File ${s.pendingReturns} pending GST return${s.pendingReturns === 1 ? '' : 's'}`,
      description: `Net GST liability of ₹${Math.round(s.gstLiability).toLocaleString('en-IN')} is outstanding. File your pending returns to avoid late fees and interest.`,
      actionLabel: 'View GST returns',
      priority: s.overdueReturns > 0 ? 'high' : 'medium',
      actionView: 'gst-returns',
    });
  }

  // 3. Low collection rate → improve collections
  if (s.revenue > 0 && s.collectionRate < 0.7) {
    recs.push({
      type: 'improve_collections',
      title: `Improve collection rate (currently ${(s.collectionRate * 100).toFixed(0)}%)`,
      description: `You've collected ₹${Math.round(s.totalCollected).toLocaleString('en-IN')} of ₹${Math.round(s.revenue).toLocaleString('en-IN')} invoiced. Tighten payment terms and send automated reminders.`,
      actionLabel: 'View collections',
      priority: 'medium',
      actionView: 'receivables',
    });
  }

  // 4. Health score low → strategic review
  if (s.healthScore > 0 && s.healthScore < 50) {
    recs.push({
      type: 'health_review',
      title: `Business health score is ${s.healthScore}/100 — review key drivers`,
      description: `Low health driven by ${s.riskScore > 50 ? 'high risk' : 'thin margins'}. Review profitability, liquidity, and compliance to improve your score.`,
      actionLabel: 'View health breakdown',
      priority: 'medium',
      actionView: 'ai-business-copilot',
    });
  }

  // 5. Runway warning → cash management
  if (s.runwayDays !== Infinity && s.runwayDays < 60 && s.runwayDays > 0) {
    recs.push({
      type: 'runway_warning',
      title: `Cash runway is ${Math.round(s.runwayDays)} days — plan funding`,
      description: `At current burn rate, cash runs out in ~${Math.round(s.runwayDays)} days. Secure a line of credit or accelerate collections.`,
      actionLabel: 'View cash position',
      priority: 'high',
      actionView: 'banking',
    });
  }

  // 6. Connect more integrations → richer insights
  const zohoConnected = s.perEntity.zohoInvoices > 0 || s.perEntity.zohoCustomers > 0;
  if (!zohoConnected && s.invoiceCount === 0) {
    recs.push({
      type: 'connect_zoho',
      title: 'Connect Zoho Books for automatic invoice sync',
      description: 'You have no invoices yet. Connect Zoho Books to automatically import your customers, invoices, and payments — Oracle will then generate richer insights.',
      actionLabel: 'Connect Zoho Books',
      priority: 'medium',
      actionView: 'zoho-books',
    });
  }

  // 7. Positive: all caught up
  if (recs.length === 0) {
    recs.push({
      type: 'all_good',
      title: 'Your business is in good shape',
      description: `Health score ${s.healthScore}/100, collection rate ${(s.collectionRate * 100).toFixed(0)}%, no overdue returns. Keep monitoring your cash flow and margins.`,
      actionLabel: 'Ask VEYRO AI for insights',
      priority: 'low',
      actionView: 'ai-business-copilot',
    });
  }

  return recs.slice(0, 6);
}

// ─── Main POST handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── 1. Authenticate ──
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required. Please sign in to activate Oracle.' },
        { status: 401 },
      );
    }

    const { adminAuth, adminDb } = await import('@/lib/firebase-admin');
    let decodedUid: string;
    try {
      const decoded = await adminAuth().verifyIdToken(token);
      decodedUid = decoded.uid;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Your session has expired. Please sign in again.' },
        { status: 401 },
      );
    }

    // ── 2. Parse body + resolve org ──
    const body = (await req.json().catch(() => ({}))) as { organizationId?: string };
    const organizationId = body.organizationId?.trim();
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'No organization selected. Please reload the page and try again.' },
        { status: 400 },
      );
    }

    // ── 3. Verify org membership (server-side security check) ──
    const memberRef = adminDb().doc(`organization_members/${organizationId}_${decodedUid}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      return NextResponse.json(
        { ok: false, error: 'You are not a member of this organization. Ask an owner or admin to invite you.' },
        { status: 403 },
      );
    }
    const memberData = memberSnap.data()!;
    if (memberData.status !== 'active') {
      return NextResponse.json(
        { ok: false, error: `Your membership is ${memberData.status}. Contact an administrator.` },
        { status: 403 },
      );
    }

    // ── 4. Generate the centralized Business Snapshot ──
    // This reads from Prisma (real DB rows) + Zoho synced entities. Never fabricates.
    const snapshot = await getBusinessSnapshot(organizationId, { forceRefresh: true });

    // ── 5. Calculate scores (already computed in snapshot, extract for clarity) ──
    const scores = {
      revenue: snapshot.revenue,
      expenses: snapshot.expenses,
      profit: snapshot.profit,
      cash: snapshot.cash,
      customerCount: snapshot.customerCount,
      invoiceCount: snapshot.invoiceCount,
      receivables: snapshot.receivables,
      payables: snapshot.payables,
      gstLiability: snapshot.gstLiability,
      outputTax: snapshot.outputTax,
      inputTax: snapshot.inputTax,
      healthScore: snapshot.healthScore,
      riskScore: snapshot.riskScore,
      collectionRate: snapshot.collectionRate,
      workingCapital: snapshot.workingCapital,
      runwayDays: snapshot.runwayDays === Infinity ? null : snapshot.runwayDays,
      filedReturns: snapshot.filedReturns,
      pendingReturns: snapshot.pendingReturns,
      overdueReturns: snapshot.overdueReturns,
      forecast: snapshot.forecast,
      lastSyncAt: snapshot.lastSyncAt,
      lastSyncStatus: snapshot.lastSyncStatus,
    };

    const now = new Date();
    const nowIso = now.toISOString();

    // ── 6a. Update the organization doc: integrations.oracle = { connected, … } ──
    const orgRef = adminDb().doc(`organizations/${organizationId}`);
    const orgSnap = await orgRef.get();
    const orgData = orgSnap.exists ? orgSnap.data() ?? {} : {};
    const existingIntegrations = (orgData as Record<string, unknown>).integrations as
      | Record<string, unknown>
      | undefined;
    const updatedIntegrations = {
      ...(existingIntegrations ?? {}),
      oracle: {
        connected: true,
        activatedAt: nowIso,
        activatedBy: decodedUid,
        // Snapshot summary persisted on the org doc for quick gating (the full
        // snapshot lives in VEYRO AI/activation subcollection doc below).
        summary: {
          healthScore: scores.healthScore,
          riskScore: scores.riskScore,
          revenue: scores.revenue,
          customerCount: scores.customerCount,
          invoiceCount: scores.invoiceCount,
        },
      },
    };
    await orgRef.set(
      {
        integrations: updatedIntegrations,
        updatedAt: nowIso,
      },
      { merge: true },
    );

    // ── 6b. Create/update VEYRO AI activation document (audit record) ──
    // Path: organizations/{orgId}/oracle/activation
    // This is the persistent "Oracle state" document. Every page reads from
    // the Business Snapshot API for live numbers, but this doc is the
    // activation event record + last-computed snapshot.
    const oracleActivationRef = adminDb().doc(
      `organizations/${organizationId}/oracle/activation`,
    );
    await oracleActivationRef.set({
      status: 'active',
      activatedAt: nowIso,
      activatedBy: decodedUid,
      activatedByEmail: memberData.userEmail ?? null,
      activatedByName: memberData.userDisplayName ?? null,
      snapshot: scores,
      snapshotGeneratedAt: snapshot.generatedAt,
      version: 1,
    });

    // ── 6c. Log activity: "Oracle Activated" (Business Timeline event) ──
    // Activities are org-scoped. The home page's Business Timeline reads from
    // the activities collection via useEnterpriseOrg().activities.
    const activityRef = adminDb().collection('activities').doc();
    await activityRef.set({
      activityId: activityRef.id,
      organizationId,
      // Legacy field for backwards compatibility with firestore-service.ts
      firmId: organizationId,
      userId: decodedUid,
      type: 'oracle_activated',
      title: 'Oracle Activated',
      description: `Business Snapshot generated — Health Score ${scores.healthScore}/100, Revenue ₹${Math.round(scores.revenue).toLocaleString('en-IN')}, ${scores.customerCount} customers, ${scores.invoiceCount} invoices.`,
      clientId: null,
      entityType: 'oracle',
      entityId: 'activation',
      metadata: {
        healthScore: scores.healthScore,
        riskScore: scores.riskScore,
        revenue: scores.revenue,
        customerCount: scores.customerCount,
        invoiceCount: scores.invoiceCount,
      },
      createdAt: nowIso,
    });

    // ── 6d. Generate AI recommendations FROM the snapshot ──
    // Replace any placeholder recommendations with real ones derived from
    // the actual business data. These persist in aiRecommendations and are
    // picked up by useAIRecommendations() on the home page.
    const recommendations = generateRecommendationsFromSnapshot(snapshot);
    const batch = adminDb().batch();

    // Clear old Oracle-generated recommendations for this org (keep manual ones)
    const oldRecsSnap = await adminDb()
      .collection('aiRecommendations')
      .where('organizationId', '==', organizationId)
      .where('source', '==', 'oracle')
      .get();
    oldRecsSnap.forEach((d) => batch.delete(d.ref));

    // Insert the new snapshot-derived recommendations
    recommendations.forEach((rec, idx) => {
      const recDocRef = adminDb().collection('aiRecommendations').doc();
      batch.set(recDocRef, {
        recId: recDocRef.id,
        organizationId,
        firmId: organizationId, // legacy
        source: 'oracle',
        type: rec.type,
        title: rec.title,
        description: rec.description,
        actionLabel: rec.actionLabel,
        actionView: rec.actionView,
        priority: rec.priority,
        status: 'active',
        clientId: null,
        invoiceId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        sortOrder: idx,
        // Snapshot context that generated this rec (audit trail)
        generatedFromSnapshot: {
          healthScore: scores.healthScore,
          revenue: scores.revenue,
          generatedAt: snapshot.generatedAt,
        },
      });
    });
    await batch.commit();

    // ── 6e. Generate Oracle Insights FROM the snapshot ──
    // Persisted to organizations/{orgId}/oracle/insights — the "Oracle is alive"
    // payload that every page (Dashboard, Oracle Workspace, AI CFO) reads from
    // to show rich, data-driven content immediately after activation.
    // All 7 sections derive from the real BusinessSnapshot — nothing fabricated.
    const insights = generateOracleInsights(snapshot);
    const insightsRef = adminDb().doc(`organizations/${organizationId}/oracle/insights`);
    await insightsRef.set(
      {
        ...insights,
        activatedAt: nowIso,
        activatedBy: decodedUid,
      },
      { merge: true },
    );

    // ── 6f. Log activity: "Oracle Insights Generated" ──
    // Second timeline event (in addition to "oracle_activated") so the Business
    // Timeline surfaces the live insights that were generated — including the
    // health score + alert count in the description for at-a-glance context.
    const insightsActivityRef = adminDb().collection('activities').doc();
    await insightsActivityRef.set({
      activityId: insightsActivityRef.id,
      organizationId,
      firmId: organizationId, // legacy
      userId: decodedUid,
      type: 'oracle_insights_generated',
      title: 'Oracle Insights Generated',
      description: `Generated ${insights.todaysPriorities.length} priorities, ${insights.aiAlerts.length} alerts, ${insights.risks.length} risks from your business snapshot. Health Score ${insights.financialHealth.score}/100.`,
      clientId: null,
      entityType: 'oracle',
      entityId: 'insights',
      metadata: {
        healthScore: insights.financialHealth.score,
        healthStatus: insights.financialHealth.status,
        alertCount: insights.aiAlerts.length,
        riskCount: insights.risks.length,
        priorityCount: insights.todaysPriorities.length,
        generatedFromSnapshotAt: insights.generatedFromSnapshotAt,
      },
      createdAt: nowIso,
    });

    // ── 7. Return the activation result ──
    // ── Business Timeline — emit oracle.activated (fire-and-forget) ──
    // Emitted AFTER all Firestore writes succeed but BEFORE the response so a
    // timeline emit failure cannot falsely report activation failure. The
    // emit call swallows its own errors internally.
    await emitTimelineEvent({
      organizationId,
      type: 'oracle.activated',
      title: 'Oracle activated',
      description: `Business Snapshot generated — Health Score ${scores.healthScore}/100, Revenue ₹${Math.round(scores.revenue).toLocaleString('en-IN')}, ${scores.customerCount} customers, ${scores.invoiceCount} invoices.`,
      actor: decodedUid ? { userId: decodedUid, userName: memberData.userDisplayName ?? memberData.userEmail ?? undefined } : undefined,
      metadata: {
        healthScore: scores.healthScore,
        riskScore: scores.riskScore,
        revenue: scores.revenue,
        customerCount: scores.customerCount,
        invoiceCount: scores.invoiceCount,
        receivables: scores.receivables,
        gstLiability: scores.gstLiability,
        activatedAt: nowIso,
        activatedBy: decodedUid,
      },
      severity: 'success',
    });

    return NextResponse.json({
      ok: true,
      activation: {
        status: 'active',
        activatedAt: nowIso,
        activatedBy: decodedUid,
        snapshotGeneratedAt: snapshot.generatedAt,
      },
      snapshot: scores,
      recommendations: recommendations.length,
      insights: {
        businessSummary: insights.businessSummary,
        priorityCount: insights.todaysPriorities.length,
        alertCount: insights.aiAlerts.length,
        riskCount: insights.risks.length,
        healthScore: insights.financialHealth.score,
        healthStatus: insights.financialHealth.status,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/oracle/activate] error:', msg);
    return NextResponse.json(
      {
        ok: false,
        error:
          'We could not activate Oracle right now. Please check your connection and try again. If the problem persists, contact support.',
      },
      { status: 500 },
    );
  }
}
