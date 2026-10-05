// ═══════════════════════════════════════════════════════════════════════════════
// /api/enterprise-org/activity — Org-scoped audit log reader
//
// GET /api/enterprise-org/activity?take=100&category=member&severity=warning
//   Returns the organization's audit trail (newest first). Requires auth +
//   membership in the org. The `audit.view` permission gates access.
//
// Response: { ok: true, entries: AuditLogEntry[], summary: AuditSummary }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { resolveAuth } from '@/lib/enterprise-org/server-auth';
import { can } from '@/lib/auth/permissions';
import type { AuditCategory, AuditSeverity } from '@/lib/enterprise-org/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { auth, response } = await resolveAuth(req);
  if (response || !auth) return response;

  // Permission gate — auditor+ can view audit logs.
  if (!can(auth.role, 'audit.view')) {
    return NextResponse.json(
      { ok: false, error: 'You do not have permission to view audit logs.' },
      { status: 403 },
    );
  }

  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const sp = req.nextUrl.searchParams;
    const take = Math.min(Number(sp.get('take') ?? '100'), 500);
    const category = sp.get('category') as AuditCategory | null;
    const severity = sp.get('severity') as AuditSeverity | null;

    // Server-side query (admin SDK bypasses rules).
    const snap = await adminDb()
      .collection('organization_audit_logs')
      .where('organizationId', '==', auth.orgId)
      .orderBy('timestamp', 'desc')
      .limit(take)
      .get();

    type RawRow = {
      id: string;
      organizationId?: string;
      category?: string;
      action?: string;
      summary?: string;
      severity?: string;
      actorId?: string | null;
      actorName?: string | null;
      actorEmail?: string | null;
      actorRole?: string | null;
      targetId?: string | null;
      targetType?: string | null;
      ipAddress?: string | null;
      userAgent?: string | null;
      metadata?: unknown;
      timestamp?: string;
    };

    let entries: RawRow[] = [];
    snap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const ts = data.timestamp;
      let timestamp = new Date().toISOString();
      if (ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
        try { timestamp = (ts as { toDate: () => Date }).toDate().toISOString(); } catch { /* keep default */ }
      } else if (ts instanceof Date) {
        timestamp = ts.toISOString();
      } else if (typeof ts === 'string') {
        timestamp = ts;
      }
      entries.push({
        id: d.id,
        organizationId: String(data.organizationId ?? ''),
        category: String(data.category ?? 'info'),
        action: String(data.action ?? ''),
        summary: String(data.summary ?? ''),
        severity: String(data.severity ?? 'info'),
        actorId: (data.actorId as string | null) ?? null,
        actorName: (data.actorName as string | null) ?? null,
        actorEmail: (data.actorEmail as string | null) ?? null,
        actorRole: (data.actorRole as string | null) ?? null,
        targetId: (data.targetId as string | null) ?? null,
        targetType: (data.targetType as string | null) ?? null,
        ipAddress: (data.ipAddress as string | null) ?? null,
        userAgent: (data.userAgent as string | null) ?? null,
        metadata: (data.metadata as unknown) ?? null,
        timestamp,
      });
    });

    // Apply optional in-memory filters.
    if (category) entries = entries.filter((e) => e.category === category);
    if (severity) entries = entries.filter((e) => e.severity === severity);

    // Build a lightweight summary.
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let last24h = 0;
    let critical = 0;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const e of entries) {
      byCategory[e.category ?? 'info'] = (byCategory[e.category ?? 'info'] ?? 0) + 1;
      bySeverity[e.severity ?? 'info'] = (bySeverity[e.severity ?? 'info'] ?? 0) + 1;
      if (e.severity === 'critical') critical++;
      const t = new Date(e.timestamp ?? Date.now()).getTime();
      if (!Number.isNaN(t) && t >= cutoff) last24h++;
    }

    return NextResponse.json({
      ok: true,
      entries,
      summary: {
        total: entries.length,
        last24h,
        critical,
        byCategory,
        bySeverity,
      },
    });
  } catch (err) {
    console.error('[/api/enterprise-org/activity] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load organization activity.' },
      { status: 500 },
    );
  }
}
