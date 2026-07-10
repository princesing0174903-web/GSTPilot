// POST /api/gstr1/file — File prepared GSTR-1 with GSTN.

import { NextResponse } from 'next/server';
import { fileGstr1 } from '@/lib/gstn/gstr1';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { gstin?: string; period?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const gstin = (body.gstin ?? '').toUpperCase().trim();
  const period = body.period ?? new Date().toISOString().slice(0, 7);
  if (!gstin) return NextResponse.json({ error: 'gstin is required' }, { status: 400 });
  try {
    const result = await fileGstr1(gstin, period);
    return NextResponse.json({ ok: true, result, message: result.message }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
