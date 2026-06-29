// GET /api/dev/components — enterprise component library
import { NextResponse } from 'next/server';
import { getComponents } from '@/lib/software-factory/engine';

export async function GET() {
  try {
    const components = await getComponents();
    return NextResponse.json({ ok: true, components, count: components.length });
  } catch (err) {
    console.error('[/api/dev/components]', err);
    return NextResponse.json({ ok: false, error: 'Failed to load components' }, { status: 500 });
  }
}
