// GET  /api/oracle/brain/memory — list workspace memory facts
// POST /api/oracle/brain/memory — manually add a fact
// DELETE /api/oracle/brain/memory?id=... — delete a fact

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listMemory, saveMemory, deleteMemory } from '@/lib/oracle/brain/memory';

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  const facts = await listMemory(orgId);
  return NextResponse.json({ facts });
}

export async function POST(request: NextRequest) {
  let body: any = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const orgId = String(body.orgId ?? '').trim();
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  const title = String(body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const fact = await saveMemory(orgId, {
    title,
    summary: body.summary ?? null,
    category: body.category ?? 'note',
    tags: Array.isArray(body.tags) ? body.tags : [],
    source: 'manual',
  });
  return NextResponse.json({ fact });
}

export async function DELETE(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('orgId');
  const id = request.nextUrl.searchParams.get('id');
  if (!orgId || !id) return NextResponse.json({ error: 'orgId and id are required' }, { status: 400 });
  const ok = await deleteMemory(orgId, id);
  return NextResponse.json({ ok });
}
