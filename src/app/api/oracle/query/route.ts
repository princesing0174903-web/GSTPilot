// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Structured Query API
// POST /api/oracle/query
//
// Detects whether a free-text message matches a structured query intent
// ("unpaid invoices", "top customers", "GST payable", etc.) and, if so, runs
// the real Prisma queries and returns the structured data card payload.
//
// The chat route (/api/oracle/chat) calls the same logic internally and emits
// the structured result as the FIRST SSE event of the chat stream. This
// standalone endpoint is useful for testing, for the client to pre-fetch the
// card before streaming begins, or for any non-chat UI that wants the data.
//
// Auth: Bearer token (Firebase ID token) in the Authorization header.
// Body: { query: string, organizationId: string }
//
// Response (200): { ok: true, matched: true, result: StructuredQueryResult }
// Response (200): { ok: true, matched: false }  (no structured intent detected)
// Response (4xx):  { ok: false, error: string }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  detectQueryIntent,
  executeStructuredQuery,
  type StructuredQueryResult,
} from '@/lib/oracle/structured-queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // ── 1. Authenticate ──
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required. Please sign in.' },
        { status: 401 },
      );
    }

    const { adminAuth, adminDb } = await import('@/lib/firebase-admin');
    let decodedUid: string;
    try {
      const decoded = await adminAuth().verifyIdToken(token);
      decodedUid = decoded.uid;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Your session has expired. Please sign in again.' },
        { status: 401 },
      );
    }

    // ── 2. Parse body + resolve org ──
    const body = (await req.json().catch(() => ({}))) as {
      query?: string;
      organizationId?: string;
    };
    const query = (body.query ?? '').trim();
    const organizationId = (body.organizationId ?? '').trim();

    if (!query) {
      return NextResponse.json(
        { ok: false, error: 'A query string is required.' },
        { status: 400 },
      );
    }
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'No organization selected. Please reload the page.' },
        { status: 400 },
      );
    }

    // ── 3. Verify org membership (server-side security check) ──
    // Same pattern as /api/oracle/activate — prevents cross-org data leakage.
    const memberRef = adminDb().doc(`organization_members/${organizationId}_${decodedUid}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'You are not a member of this organization. Ask an owner or admin to invite you.',
        },
        { status: 403 },
      );
    }
    const memberData = memberSnap.data()!;
    if (memberData.status !== 'active') {
      return NextResponse.json(
        { ok: false, error: `Your membership is ${memberData.status}. Contact an administrator.` },
        { status: 403 },
      );
    }

    // ── 4. Detect intent ──
    const intent = detectQueryIntent(query);
    if (!intent) {
      // Not an error — just no structured-data match. The caller should fall
      // back to the conversational LLM answer.
      return NextResponse.json({ ok: true, matched: false });
    }

    // ── 5. Execute the structured query ──
    const result: StructuredQueryResult = await executeStructuredQuery(intent, organizationId);

    return NextResponse.json({ ok: true, matched: true, result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/oracle/query] error:', msg);
    return NextResponse.json(
      {
        ok: false,
        error:
          'We could not run that query right now. Please check your connection and try again.',
      },
      { status: 500 },
    );
  }
}
