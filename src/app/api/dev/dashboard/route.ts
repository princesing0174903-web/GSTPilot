// GET /api/dev/dashboard — Enterprise Observability dashboard
import { NextResponse } from 'next/server';
import { getFactoryDashboard } from '@/lib/software-factory/engine';

export async function GET() {
  try {
    const dashboard = await getFactoryDashboard();
    return NextResponse.json({ ok: true, dashboard });
  } catch (err) {
    console.error('[/api/dev/dashboard]', err);
    return NextResponse.json({ ok: false, error: 'Failed to load factory dashboard' }, { status: 500 });
  }
}
