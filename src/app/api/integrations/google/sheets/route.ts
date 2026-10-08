// POST /api/integrations/google/sheets?action=export — create a spreadsheet + populate rows
//   Body: { title, rows: [{ values: string[] }], sheetName? }

import { NextResponse } from 'next/server';
import { exportToSheet } from '@/lib/google-workspace';
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

  const title = String(body.title ?? 'VEYRO Export');
  const rowsRaw = Array.isArray(body.rows) ? body.rows : [];
  const rows = rowsRaw.map((r) => {
    const obj = r as { values?: string[] };
    return { values: Array.isArray(obj.values) ? obj.values.map(String) : [] };
  });

  const res = await exportToSheet(accessToken, {
    title,
    rows,
    sheetName: body.sheetName ? String(body.sheetName) : undefined,
  });
  if (res.error) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, spreadsheet: res.data });
}
