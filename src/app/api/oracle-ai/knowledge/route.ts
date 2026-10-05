// GET  /api/oracle-ai/knowledge — list/search knowledge entries
// POST /api/oracle-ai/knowledge — create a knowledge entry

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { createKnowledge, listKnowledge } from '@/lib/oracle-ai/knowledge';
import type { KnowledgeCategory } from '@/lib/oracle-ai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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
    const url = new URL(req.url);
    const category = url.searchParams.get('category') as KnowledgeCategory | null;
    const query = url.searchParams.get('q') ?? undefined;
    const pinnedOnly = url.searchParams.get('pinned') === 'true';
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const entries = await listKnowledge({
      firmId: ctx.firmId,
      category: category ?? undefined,
      query,
      pinnedOnly,
      limit,
    });
    return NextResponse.json({ entries });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
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
    const body = await req.json().catch(() => ({}));
    const entry = await createKnowledge({
      firmId: ctx.firmId,
      title: String(body.title ?? 'Untitled'),
      content: String(body.content ?? ''),
      category: body.category,
      tags: body.tags,
      source: body.source,
      sourceType: body.sourceType,
      confidence: body.confidence,
      pinned: body.pinned,
      metadata: body.metadata,
    });
    return NextResponse.json({ entry });
  } catch (err) {
    return toErrorResponse(err);
  }
}
