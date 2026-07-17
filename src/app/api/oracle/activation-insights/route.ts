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
    // ── 1. Resolve org first ──
    const { searchParams } = new URL(req.url);
    const organizationId = (searchParams.get('organizationId') ?? '').trim();
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId query parameter is required.' },
        { status: 400 },
      );
    }

    // ── 2. Authenticate ──
    // Local workspace org IDs (guest/demo users) skip Firebase auth — they have
    // no real Firebase session or Firestore membership record. We generate
    // insights from the BusinessSnapshot directly so the Oracle panel still
    // renders without throwing a 401 every poll cycle (which polluted dev.log
    // and caused the hook to silently no-op).
    const isLocalOrg = organizationId.startsWith('local-');
    let decodedUid = 'local-user';
    let canPersist = false;

    if (!isLocalOrg) {
      const authHeader = req.headers.get('authorization') ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) {
        return NextResponse.json(
          { ok: false, error: 'Authentication required.' },
          { status: 401 },
        );
      }

      const { adminAuth, adminDb } = await import('@/lib/firebase-admin');
      try {
        const decoded = await adminAuth().verifyIdToken(token);
        decodedUid = decoded.uid;
      } catch {
        return NextResponse.json(
          { ok: false, error: 'Your session has expired. Please sign in again.' },
          { status: 401 },
        );
      }

      // ── 3. Verify membership ──
      const memberSnap = await adminDb()
        .doc(`organization_members/${organizationId}_${decodedUid}`)
        .get();
      if (!memberSnap.exists) {
        return NextResponse.json(
          { ok: false, error: 'You are not a member of this organization.' },
          { status: 403 },
        );
      }
      canPersist = true;
    }

    // ── 4. Read the persisted insights doc (real orgs only) ──
    if (canPersist) {
      const { adminDb } = await import('@/lib/firebase-admin');
      const insightsRef = adminDb().doc(
        `organizations/${organizationId}/oracle/insights`,
      );
      const insightsSnap = await insightsRef.get();

      if (insightsSnap.exists) {
        const data = insightsSnap.data() as OracleInsights;
        return NextResponse.json(data);
      }

      // Missing → generate fresh from the snapshot + persist
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
    }

    // ── 5. Local- org: generate fresh insights in-memory (no persistence) ──
    // These orgs have no Firestore doc to read from or write to. We always
    // recompute from the BusinessSnapshot so the panel reflects the latest
    // state (snapshot has its own 30s cache, so this is cheap).
    const snapshot = await getBusinessSnapshot(organizationId);
    const insights = generateOracleInsights(snapshot);
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
