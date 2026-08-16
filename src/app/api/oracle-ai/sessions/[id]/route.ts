// GET    /api/oracle-ai/sessions/:id  — get a session
// PATCH  /api/oracle-ai/sessions/:id  — update title/status/agent
// DELETE /api/oracle-ai/sessions/:id  — soft-delete (status = deleted)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { deleteSession, getSession, updateSession } from '@/lib/oracle-ai/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const ctx = await resolveOracleAICtx(req);
    if (!ctx.isDemo) {
      const orgResult = await requireOrgMembership(uid, ctx.firmId);
      if (orgResult instanceof NextResponse) return orgResult;
    }
    const { id } = await params;
    const session = await getSession(id, ctx.firmId);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    return NextResponse.json({ session });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const ctx = await resolveOracleAICtx(req);
    if (!ctx.isDemo) {
      const orgResult = await requireOrgMembership(uid, ctx.firmId);
      if (orgResult instanceof NextResponse) return orgResult;
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const session = await updateSession(
      id,
      {
        title: body.title,
        status: body.status,
        agentId: body.agentId,
        summary: body.summary,
      },
      ctx.firmId,
    );
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    return NextResponse.json({ session });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const ctx = await resolveOracleAICtx(req);
    if (!ctx.isDemo) {
      const orgResult = await requireOrgMembership(uid, ctx.firmId);
      if (orgResult instanceof NextResponse) return orgResult;
    }
    const { id } = await params;
    await deleteSession(id, ctx.firmId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
