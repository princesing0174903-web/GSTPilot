// GET  /api/integrations/google/drive/files       — list files
// POST /api/integrations/google/drive/folder      — create folder
// POST /api/integrations/google/drive/upload      — upload a file

import { NextResponse } from 'next/server';
import { drive } from '@/lib/google-workspace';
import { resolveGoogleAuth } from '@/lib/google-workspace/route-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { accessToken, response } = await resolveGoogleAuth(req);
  if (response || !accessToken) return response;

  const url = new URL(req.url);
  const parentId = url.searchParams.get('parentId') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;
  const pageSize = Math.min(Number(url.searchParams.get('pageSize') ?? '25'), 100);

  const res = await drive.listFiles(accessToken, { parentId, q, pageSize });
  if (res.error) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, files: res.data?.files ?? [] });
}

export async function POST(req: Request) {
  const { accessToken, response } = await resolveGoogleAuth(req);
  if (response || !accessToken) return response;

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'folder';

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (action === 'folder') {
    const res = await drive.createFolder(accessToken, String(body.name ?? 'New Folder'), body.parentId ? String(body.parentId) : undefined);
    if (res.error) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, file: res.data });
  }

  if (action === 'upload') {
    const res = await drive.uploadFile(accessToken, {
      name: String(body.name ?? 'Untitled'),
      mimeType: String(body.mimeType ?? 'application/octet-stream'),
      contentBase64: String(body.contentBase64 ?? ''),
      parentId: body.parentId ? String(body.parentId) : undefined,
    });
    if (res.error) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, file: res.data });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action. Use ?action=folder|upload' }, { status: 400 });
}
