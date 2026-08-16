// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Brain — Memory API
// GET  /api/oracle/brain/memory?firmId=...&type=...&limit=...
// POST /api/oracle/brain/memory  (create a memory)
// PATCH /api/oracle/brain/memory?id=...  (update/pin/archive)
// DELETE /api/oracle/brain/memory?id=...
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import {
  createMemory,
  updateMemory,
  getMemory,
  listMemories,
  togglePin,
  archiveMemory,
  deleteMemory,
  getRecentMemories,
  getPinnedMemories,
  searchMemoriesByKeyword,
} from '@/lib/oracle/brain/memory-engine';
import type { BrainMemoryType } from '@/lib/oracle/brain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function firmIdFrom(req: NextRequest, body?: Record<string, unknown>): string {
  const url = new URL(req.url);
  return (
    (body?.firmId as string) ||
    url.searchParams.get('firmId') ||
    'preview-org'
  );
}

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
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const typeParam = url.searchParams.get('type');
    const types = typeParam
      ? (typeParam.split(',') as BrainMemoryType[])
      : undefined;
    const pinnedOnly = url.searchParams.get('pinned') === 'true';
    const query = url.searchParams.get('q');

    let result: unknown;
    if (action === 'recent') {
      result = await getRecentMemories(firmId, limit);
    } else if (action === 'pinned') {
      result = await getPinnedMemories(firmId);
    } else if (action === 'search' && query) {
      result = await searchMemoriesByKeyword({ firmId, query, types, limit });
    } else if (action === 'get' && url.searchParams.get('id')) {
      result = await getMemory(url.searchParams.get('id')!);
    } else {
      result = await listMemories({
        firmId,
        types,
        limit,
        pinnedOnly,
        includeArchived: url.searchParams.get('archived') === 'true',
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
    const memory = await createMemory({
      firmId: firmIdFrom(req, body),
      userId: body.userId as string | undefined,
      type: body.type as BrainMemoryType,
      subtype: body.subtype as string | undefined,
      title: body.title as string,
      content: (body.content as string) || '',
      summary: body.summary as string | undefined,
      tags: body.tags as string[] | undefined,
      importance: body.importance as number | undefined,
      pinned: body.pinned as boolean | undefined,
      source: body.source as string | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
    });
    return NextResponse.json({ ok: true, data: memory });
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

    if (action === 'pin') {
      return NextResponse.json({
        ok: true,
        data: await togglePin(id, body.pinned as boolean | undefined),
      });
    }
    if (action === 'archive') {
      return NextResponse.json({ ok: true, data: await archiveMemory(id) });
    }

    const updated = await updateMemory(id, {
      title: body.title as string | undefined,
      content: body.content as string | undefined,
      summary: body.summary as string | undefined,
      tags: body.tags as string[] | undefined,
      importance: body.importance as number | undefined,
      pinned: body.pinned as boolean | undefined,
      archived: body.archived as boolean | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
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
    await deleteMemory(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
