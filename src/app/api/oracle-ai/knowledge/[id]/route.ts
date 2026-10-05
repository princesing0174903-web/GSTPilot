// GET    /api/oracle-ai/knowledge/:id — get a knowledge entry (increments view count)
// PATCH  /api/oracle-ai/knowledge/:id — update a knowledge entry
// DELETE /api/oracle-ai/knowledge/:id — delete a knowledge entry

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { deleteKnowledge, getKnowledge, updateKnowledge } from '@/lib/oracle-ai/knowledge';
import type { KnowledgeCategory } from '@/lib/oracle-ai/types';

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
    const entry = await getKnowledge(id, ctx.firmId);
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    return NextResponse.json({ entry });
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
    const entry = await updateKnowledge(
      id,
      {
        title: body.title,
        content: body.content,
        category: body.category as KnowledgeCategory | undefined,
        tags: body.tags,
        source: body.source,
        confidence: body.confidence,
        pinned: body.pinned,
      },
      ctx.firmId,
    );
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    return NextResponse.json({ entry });
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
    await deleteKnowledge(id, ctx.firmId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
