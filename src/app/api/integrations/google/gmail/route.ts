// GET  /api/integrations/google/gmail/profile  — Gmail user profile
// GET  /api/integrations/google/gmail/messages  — recent messages
// POST /api/integrations/google/gmail/send      — send an email
// POST /api/integrations/google/gmail/draft     — create a draft

import { NextResponse } from 'next/server';
import { gmail } from '@/lib/google-workspace';
import { resolveGoogleAuth } from '@/lib/google-workspace/route-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { accessToken, response } = await resolveGoogleAuth(req);
  if (response || !accessToken) return response;

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'profile';

  if (action === 'profile') {
    const res = await gmail.getProfile(accessToken);
    if (res.error) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, profile: res.data });
  }

  if (action === 'messages') {
    const max = Math.min(Number(url.searchParams.get('max') ?? '20'), 100);
    const res = await gmail.listMessages(accessToken, max);
    if (res.error) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, messages: res.data?.messages ?? [] });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action. Use ?action=profile|messages' }, { status: 400 });
}

export async function POST(req: Request) {
  const { accessToken, response } = await resolveGoogleAuth(req);
  if (response || !accessToken) return response;

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'send';

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (action === 'send') {
    const res = await gmail.send(accessToken, {
      to: String(body.to ?? ''),
      subject: String(body.subject ?? ''),
      body: String(body.body ?? ''),
      cc: body.cc ? String(body.cc) : undefined,
      bcc: body.bcc ? String(body.bcc) : undefined,
      isHtml: body.isHtml === true,
    });
    if (res.error) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, message: res.data });
  }

  if (action === 'draft') {
    const res = await gmail.createDraft(accessToken, {
      to: String(body.to ?? ''),
      subject: String(body.subject ?? ''),
      body: String(body.body ?? ''),
      cc: body.cc ? String(body.cc) : undefined,
      bcc: body.bcc ? String(body.bcc) : undefined,
      isHtml: body.isHtml === true,
      draftId: body.draftId ? String(body.draftId) : undefined,
    });
    if (res.error) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, draft: res.data });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action. Use ?action=send|draft' }, { status: 400 });
}
