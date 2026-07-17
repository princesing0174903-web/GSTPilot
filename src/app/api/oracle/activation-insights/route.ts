// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Activation Insights API
// GET /api/oracle/activation-insights?organizationId=...
//
// NOTE on path: This route lives at `/api/oracle/activation-insights` rather
// than `/api/oracle/insights` because the latter is ALREADY taken by the
// "Knowledge Synthesis" insights route used by OracleIntelligenceCorePage
// (listInsights / synthesizeInsights / etc.). Replacing it would break that
// page. This route handles a different concern — the persisted "Oracle is
// alive" insights doc at organizations/{orgId}/oracle/insights.
//
// Workflow:
//   1. Authenticate the caller (Firebase ID token, Bearer header)
//   2. Verify org membership (organization_members/{orgId}_{uid} exists)
//   3. Read `organizations/{orgId}/oracle/insights` from Firestore
//   4. If missing → generate fresh from getBusinessSnapshot() +
//      generateOracleInsights() and persist (merge: true)
//   5. Return the insights doc
//
// Auth: Bearer token in the Authorization header (Firebase ID token).
// Query: ?organizationId=<orgId>
//
// Response (200): OracleInsights
// Response (4xx/5xx): { ok: false, error: string }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getBusinessSnapshot } from '@/lib/business/snapshot';
import {
  generateOracleInsights,
  type OracleInsights,
} from '@/app/api/oracle/activate/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // ── 1. Authenticate ──
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required.' },
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

    // ── 2. Resolve org + verify membership ──
    const { searchParams } = new URL(req.url);
    const organizationId = (searchParams.get('organizationId') ?? '').trim();
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId query parameter is required.' },
        { status: 400 },
      );
    }

    const memberSnap = await adminDb()
      .doc(`organization_members/${organizationId}_${decodedUid}`)
      .get();
    if (!memberSnap.exists) {
      return NextResponse.json(
        { ok: false, error: 'You are not a member of this organization.' },
        { status: 403 },
      );
    }

    // ── 3. Read the persisted insights doc ──
    const insightsRef = adminDb().doc(
      `organizations/${organizationId}/oracle/insights`,
    );
    const insightsSnap = await insightsRef.get();

    if (insightsSnap.exists) {
      const data = insightsSnap.data() as OracleInsights;
      return NextResponse.json(data);
    }

    // ── 4. Missing → generate fresh from the snapshot + persist ──
    // This handles the edge case where Oracle was activated before this
    // endpoint existed (or the insights doc was deleted). We regenerate
    // from the real BusinessSnapshot so the page never shows an empty panel.
    const snapshot = await getBusinessSnapshot(organizationId, {
      forceRefresh: true,
    });
    const insights = generateOracleInsights(snapshot);

    const nowIso = new Date().toISOString();
    await insightsRef.set(
      {
        ...insights,
        activatedAt: nowIso,
        activatedBy: decodedUid,
      },
      { merge: true },
    );

    return NextResponse.json(insights);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/oracle/activation-insights] error:', msg);
    return NextResponse.json(
      {
        ok: false,
        error:
          'We could not load Oracle insights right now. Please try again in a moment.',
      },
      { status: 500 },
    );
  }
}
