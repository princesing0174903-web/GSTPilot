// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — /api/scaling/signed-upload
//
// POST /api/scaling/signed-upload
//   Body: { path: string, contentType?: string, maxSizeBytes?: number }
//   Returns a V4 signed URL the client can PUT bytes directly to (bypasses
//   the Next.js server entirely — the bytes go straight to Cloud Storage).
//
// Default expiry 15 minutes, default max size 50 MB.
//
// Auth: optional `x-org-token` header matched against process.env.ADMIN_TOKEN.
// In dev (NODE_ENV !== 'production'), if ADMIN_TOKEN is unset the endpoint is
// open so local development isn't blocked.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { generateSignedUploadUrl } from '@/lib/scaling/storage-optimization';

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

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = checkOrgToken(request);
    if (!auth.ok) return auth.response;

    let body: { path?: string; contentType?: string; maxSizeBytes?: number };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'invalid_json_body' },
        { status: 400 },
      );
    }

    const { path, contentType, maxSizeBytes } = body;
    if (!path || typeof path !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'missing_required_field', field: 'path' },
        { status: 400 },
      );
    }

    const result = await generateSignedUploadUrl(path, {
      contentType,
      maxSizeBytes,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[/api/scaling/signed-upload] fatal:', err);
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
