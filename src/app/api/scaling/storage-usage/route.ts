// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — /api/scaling/storage-usage
//
// GET /api/scaling/storage-usage?orgId=...
//   Returns per-org storage usage: total bytes, file count, and per-category
//   breakdown (invoices / receipts / documents / exports / avatars / reports /
//   temp + "other").
//
// Auth: optional `x-org-token` header matched against process.env.ADMIN_TOKEN.
// In dev (NODE_ENV !== 'production'), if ADMIN_TOKEN is unset the endpoint is
// open so local development isn't blocked.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getStorageUsage } from '@/lib/scaling/storage-optimization';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function checkOrgToken(request: Request): { ok: true } | { ok: false; response: Response } {
  const provided = request.headers.get('x-org-token');
  const expected = process.env.ADMIN_TOKEN;
  const isDev = process.env.NODE_ENV !== 'production';

  if (expected) {
    const a = Buffer.from(String(provided ?? ''));
    const b = Buffer.from(expected);
    const ok = a.length === b.length && a.equals(b);
    if (!ok) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: 'unauthorized' },
          { status: 401 },
        ),
      };
    }
  } else if (!isDev) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'ADMIN_TOKEN not configured' },
        { status: 500 },
      ),
    };
  }
  return { ok: true };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = checkOrgToken(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const orgId = url.searchParams.get('orgId');
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: 'missing_required_param', param: 'orgId' },
        { status: 400 },
      );
    }

    const usage = await getStorageUsage(orgId);
    return NextResponse.json({ ok: true, usage });
  } catch (err) {
    console.error('[/api/scaling/storage-usage] fatal:', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'internal_error',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
