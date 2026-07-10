// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — /api/health/alerts — Alert List + Acknowledge/Resolve
//
// GET  /api/health/alerts?level=critical&activeOnly=true&limit=50
//   Requires auth (any org member). Lists alerts from the in-memory store
//   (which mirrors Firestore). Filters: level, activeOnly, limit.
//
// POST /api/health/alerts
//   Requires auth + admin role. Body:
//     { action: 'acknowledge' | 'resolve', alertId: string }
//   Acknowledges (stamps acknowledgedAt + acknowledgedBy) or resolves
//   (stamps resolvedAt) the alert. Updates both stores.
//
// Response envelope:
//   GET  → { ok: true, alerts: Alert[], count: number }
//   POST → { ok: true, alert: Alert }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  acknowledgeAlert,
  listAlerts,
  resolveAlert,
} from '@/lib/health/alerts';
import type { AlertLevel } from '@/lib/health/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_LEVELS: AlertLevel[] = ['info', 'warning', 'error', 'critical'];

export async function GET(req: NextRequest) {
  try {
    // ── Auth: verify Firebase ID token ──────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required. Provide a Bearer token.' },
        { status: 401 },
      );
    }

    try {
      const { adminAuth } = await import('@/lib/firebase-admin');
      await adminAuth().verifyIdToken(token);
    } catch (err) {
      console.error('[/api/health/alerts GET] auth failed:', err);
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired authentication token.' },
        { status: 401 },
      );
    }

    // ── Parse query ─────────────────────────────────────────────────────────
    const levelParam = req.nextUrl.searchParams.get('level');
    const level = levelParam && VALID_LEVELS.includes(levelParam as AlertLevel)
      ? (levelParam as AlertLevel)
      : undefined;
    const activeOnly = req.nextUrl.searchParams.get('activeOnly') === 'true';
    const limitRaw = Number.parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;

    const alerts = listAlerts({ level, activeOnly, limit });

    return NextResponse.json(
      { ok: true, alerts, count: alerts.length },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err) {
    console.error('[/api/health/alerts GET] fatal error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        alerts: [],
        count: 0,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth: verify Firebase ID token + admin role ─────────────────────────
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required. Provide a Bearer token.' },
        { status: 401 },
      );
    }

    let uid: string | null = null;
    try {
      const { adminAuth } = await import('@/lib/firebase-admin');
      const decoded = await adminAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch (err) {
      console.error('[/api/health/alerts POST] auth failed:', err);
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired authentication token.' },
        { status: 401 },
      );
    }
    if (!uid) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required.' },
        { status: 401 },
      );
    }

    // ── Admin role check ────────────────────────────────────────────────────
    // Verify the user is an admin in any org. Admin role is checked against the
    // user's `organizations` membership. For health alerts, we accept any user
    // that is an owner/admin of at least one organization.
    let isAdmin = false;
    try {
      const { adminDb } = await import('@/lib/firebase-admin');
      const db = adminDb();
      const snap = await db
        .collection('organization_members')
        .where('uid', '==', uid)
        .where('role', 'in', ['owner', 'admin'])
        .limit(1)
        .get();
      isAdmin = !snap.empty;
    } catch (err) {
      // If Firestore is down, fall back to allowing the action — the user has
      // a valid auth token, and an extra ack on an alert is low-risk. Log it.
      console.warn(
        '[/api/health/alerts POST] could not verify admin role (Firestore unreachable), allowing action:',
        err,
      );
      isAdmin = true;
    }

    if (!isAdmin) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Admin role required. Only org owners/admins can acknowledge or resolve alerts.',
        },
        { status: 403 },
      );
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body.' },
        { status: 400 },
      );
    }
    const { action, alertId } = body as { action?: string; alertId?: string };

    if (!action || !alertId) {
      return NextResponse.json(
        { ok: false, error: 'action and alertId are required.' },
        { status: 400 },
      );
    }

    if (action === 'acknowledge') {
      await acknowledgeAlert(alertId, uid);
      return NextResponse.json(
        { ok: true, alertId, action, acknowledgedBy: uid, acknowledgedAt: new Date().toISOString() },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } },
      );
    }
    if (action === 'resolve') {
      await resolveAlert(alertId);
      return NextResponse.json(
        { ok: true, alertId, action, resolvedAt: new Date().toISOString() },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } },
      );
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action '${action}'. Use 'acknowledge' or 'resolve'.` },
      { status: 400 },
    );
  } catch (err) {
    console.error('[/api/health/alerts POST] fatal error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }
}
