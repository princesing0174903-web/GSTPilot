// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Activation API
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
      actionLabel: 'Ask Oracle for insights',
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
        // snapshot lives in the oracle/activation subcollection doc below).
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

    // ── 6b. Create/update the Oracle activation document (audit record) ──
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

    // ── 7. Return the activation result ──
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
