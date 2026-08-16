// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Brain — Reminders API
// GET  /api/oracle/brain/reminders?firmId=...&status=active&limit=...
// POST /api/oracle/brain/reminders  (create or generate-from-snapshot)
// PATCH /api/oracle/brain/reminders?id=...  (snooze / dismiss / act)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import {
  createReminder,
  updateReminder,
  getReminder,
  listReminders,
  getActiveReminders,
  snoozeReminder,
  dismissReminder,
  markActed,
  generateRemindersFromSnapshot,
  getReminderStats,
} from '@/lib/oracle/brain/reminder-engine';
import type { ReminderType, ReminderSeverity, ReminderStatus } from '@/lib/oracle/brain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const url = new URL(req.url);
  const orgId0 = url.searchParams.get('firmId') || url.searchParams.get('orgId') || '';
  const orgResult = await requireOrgMembership(uid, orgId0);
  if (orgResult instanceof NextResponse) return orgResult;

  try {
    const firmId = url.searchParams.get('firmId') || 'preview-org';
    const action = url.searchParams.get('action') || 'list';
    const limit = parseInt(url.searchParams.get('limit') || '30', 10);
    const status = url.searchParams.get('status') as ReminderStatus | null;
    const severity = url.searchParams.get('severity') as ReminderSeverity | null;
    const type = url.searchParams.get('type') as ReminderType | null;

    let result: unknown;
    if (action === 'stats') {
      result = await getReminderStats(firmId);
    } else if (action === 'active') {
      result = await getActiveReminders(firmId, limit);
    } else if (action === 'get' && url.searchParams.get('id')) {
      result = await getReminder(url.searchParams.get('id')!);
    } else {
      result = await listReminders({
        firmId,
        status: status ?? undefined,
        severity: severity ?? undefined,
        type: type ?? undefined,
        limit,
      });
    }
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const orgId0 = (body.firmId as string) || (body.orgId as string) || '';
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
    const firmId = (body.firmId as string) || 'preview-org';

    // Autonomous generation mode: create reminders from a business snapshot.
    if (body.action === 'generate') {
      const result = await generateRemindersFromSnapshot(firmId, {
        gstLiability: body.gstLiability as number | undefined,
        cashBalance: body.cashBalance as number | undefined,
        monthlyBurn: body.monthlyBurn as number | undefined,
        overdueInvoices: body.overdueInvoices as
          | { id: string; number: string; customer: string; amount: number; daysOverdue: number }[]
          | undefined,
        upcomingGst: body.upcomingGst as
          | { title: string; dueDate: string; daysLeft: number }[]
          | undefined,
        revenueChangePct: body.revenueChangePct as number | undefined,
      });
      return NextResponse.json({ ok: true, data: result });
    }

    const reminder = await createReminder({
      firmId,
      userId: body.userId as string | undefined,
      type: body.type as ReminderType,
      title: body.title as string,
      message: (body.message as string) || '',
      severity: body.severity as ReminderSeverity | undefined,
      relatedType: body.relatedType as string | undefined,
      relatedId: body.relatedId as string | undefined,
      relatedLabel: body.relatedLabel as string | undefined,
      dueDate: body.dueDate ? new Date(body.dueDate as string) : undefined,
      triggerDate: body.triggerDate ? new Date(body.triggerDate as string) : undefined,
    });
    return NextResponse.json({ ok: true, data: reminder });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const url = new URL(req.url);
  const orgId0 = url.searchParams.get('firmId') || url.searchParams.get('orgId') || '';
  if (orgId0) {
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
  }

  try {
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'id query param required' },
        { status: 400 },
      );
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action as string | undefined;

    if (action === 'snooze') {
      const hours = parseFloat((body.hours as string) || '24');
      return NextResponse.json({
        ok: true,
        data: await snoozeReminder(id, new Date(Date.now() + hours * 3600 * 1000)),
      });
    }
    if (action === 'dismiss') {
      return NextResponse.json({ ok: true, data: await dismissReminder(id) });
    }
    if (action === 'act') {
      return NextResponse.json({
        ok: true,
        data: await markActed(id, (body.actionTaken as string) || 'acted'),
      });
    }

    const updated = await updateReminder(id, {
      status: body.status as ReminderStatus | undefined,
      actionTaken: body.actionTaken as string | undefined,
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
