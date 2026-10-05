// GET /api/dev/apps — list available app templates (Natural Language App Builder)
import { NextResponse } from 'next/server';
import { APP_TEMPLATES } from '@/lib/software-factory/templates';

export async function GET() {
  try {
    return NextResponse.json({ ok: true, apps: APP_TEMPLATES, count: APP_TEMPLATES.length });
  } catch (err) {
    console.error('[/api/dev/apps]', err);
    return NextResponse.json({ ok: false, error: 'Failed to load app templates' }, { status: 500 });
  }
}
