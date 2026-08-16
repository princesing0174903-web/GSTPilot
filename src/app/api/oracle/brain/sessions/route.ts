// GET  /api/oracle/brain/sessions — list conversations for an org
// POST /api/oracle/brain/sessions — create a new conversation

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  const orgId = request.nextUrl.searchParams.get('orgId') || request.nextUrl.searchParams.get('firmId') || '';
  const orgResult = await requireOrgMembership(uid, orgId);
  if (orgResult instanceof NextResponse) return orgResult;
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }
  const sessions = await db.oracleAISession.findMany({
    where: { firmId: orgId, status: { not: 'deleted' } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true, title: true, status: true, modelUsed: true,
      messageCount: true, lastMessageAt: true, createdAt: true, updatedAt: true,
    },
  });
  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  let body: any = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const orgId = String(body.orgId ?? body.firmId ?? '').trim();
  const userId = body.userId ? String(body.userId) : undefined;
  const title = body.title ? String(body.title) : 'New conversation';
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });

  const orgResult = await requireOrgMembership(uid, orgId);
  if (orgResult instanceof NextResponse) return orgResult;

  const session = await db.oracleAISession.create({
    data: {
      firmId: orgId,
      userId,
      title,
      status: 'active',
      modelUsed: 'glm-4.6',
      messageCount: 0,
      tokensUsed: 0,
      metadata: '{}',
    },
  });
  return NextResponse.json({ session });
}
