// POST /api/integrations/google/docs?action=create — create a Google Doc
//   Body: { title, paragraphs?: [{ text, heading? }] }

import { NextResponse } from 'next/server';
import { createDoc } from '@/lib/google-workspace';
import { resolveGoogleAuth } from '@/lib/google-workspace/route-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { accessToken, response } = await resolveGoogleAuth(req);
  if (response || !accessToken) return response;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = String(body.title ?? 'Untitled Document');
  const paragraphsRaw = Array.isArray(body.paragraphs) ? body.paragraphs : [];
  const paragraphs = paragraphsRaw.map((p) => {
    const obj = p as { text?: string; heading?: string };
    return {
      text: String(obj.text ?? ''),
      heading: (obj.heading as 'TITLE' | 'HEADING_1' | 'HEADING_2' | 'NORMAL_TEXT' | undefined),
    };
  });

  const res = await createDoc(accessToken, title, paragraphs);
  if (res.error) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, document: res.data });
}
