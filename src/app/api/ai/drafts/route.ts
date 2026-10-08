// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Production Pipeline™ — Drafts API
//
// POST /api/ai/drafts          — create a new draft (autosave entry point)
// GET  /api/ai/drafts?orgId=   — list non-archived drafts for an org
//
// Drafts are autosaved input state — lets users resume half-finished prompts
// across sessions / devices. The client normally writes directly to Firestore
// via the service layer; this endpoint exists for server-initiated flows.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createDraft, subscribeToDrafts } from '@/lib/ai-pipeline/service';
import type { GenAssetType, GenProviderName, GenJobInput } from '@/lib/ai-pipeline/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── POST: create a draft ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      organizationId,
      createdBy,
      title,
      input,
      assetType,
      provider,
      model,
    } = body as {
      organizationId: string;
      createdBy: { uid: string; name: string; email: string };
      title: string;
      input: GenJobInput;
      assetType: GenAssetType;
      provider: GenProviderName;
      model: string;
    };

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }
    if (!createdBy?.uid) {
      return NextResponse.json({ error: 'createdBy.uid is required' }, { status: 400 });
    }
    if (!assetType || !input?.prompt) {
      return NextResponse.json({ error: 'assetType and input.prompt are required' }, { status: 400 });
    }

    const draftId = await createDraft(organizationId, {
      organizationId,
      createdBy,
      title: title || 'Untitled',
      input,
      assetType,
      provider: provider ?? 'mock',
      model: model || 'mock-text-pro',
    });

    return NextResponse.json({ ok: true, draftId }, { status: 201 });
  } catch (err) {
    console.error('[api/ai/drafts] POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// ─── GET: list drafts (one-shot read; real-time via the hook's onSnapshot) ────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('orgId');

    if (!organizationId) {
      return NextResponse.json({ error: 'orgId query param is required' }, { status: 400 });
    }

    // subscribeToDrafts returns an unsubscribe; for a one-shot read we grab
    // the first snapshot then unsubscribe.
    return new Promise<NextResponse>((resolve) => {
      let resolved = false;
      const unsub = subscribeToDrafts(
        organizationId,
        (drafts) => {
          if (resolved) return;
          resolved = true;
          try { unsub(); } catch { /* ignore */ }
          resolve(NextResponse.json({ ok: true, drafts }));
        },
        { onError: (err) => {
          if (resolved) return;
          resolved = true;
          try { unsub(); } catch { /* ignore */ }
          resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        } },
      );
    });
  } catch (err) {
    console.error('[api/ai/drafts] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
