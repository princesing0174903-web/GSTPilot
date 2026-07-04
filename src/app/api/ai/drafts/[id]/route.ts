// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — Draft CRUD
//
// PATCH  /api/ai/drafts/[id]   { organizationId, ...patch }  — autosave update
// DELETE /api/ai/drafts/[id]   { organizationId }            — permanent delete
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { updateDraft, archiveDraft, deleteDraft } from '@/lib/ai-pipeline/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── PATCH: autosave update ───────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: draftId } = await params;
    const body = await req.json();
    const { organizationId, archived, ...patch } = body as Record<string, unknown>;

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }
    if (!draftId) {
      return NextResponse.json({ error: 'draft id is required' }, { status: 400 });
    }

    if (archived === true) {
      await archiveDraft(organizationId as string, draftId);
    } else {
      await updateDraft(organizationId as string, draftId, patch);
    }
    return NextResponse.json({ ok: true, draftId });
  } catch (err) {
    console.error('[api/ai/drafts/[id]] PATCH error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// ─── DELETE: permanent delete ─────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: draftId } = await params;
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('orgId');

    if (!organizationId) {
      return NextResponse.json({ error: 'orgId query param is required' }, { status: 400 });
    }
    if (!draftId) {
      return NextResponse.json({ error: 'draft id is required' }, { status: 400 });
    }

    await deleteDraft(organizationId, draftId);
    return NextResponse.json({ ok: true, draftId });
  } catch (err) {
    console.error('[api/ai/drafts/[id]] DELETE error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
