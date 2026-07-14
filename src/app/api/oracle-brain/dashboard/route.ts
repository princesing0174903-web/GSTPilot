// GET /api/oracle-brain/dashboard — Full Oracle Intelligence executive dashboard.
// Combines Memory + Graph + Timeline + Reasoning + KPIs in one payload.
import { NextResponse } from 'next/server';
import { buildExecutiveDashboard } from '@/lib/oracle-intelligence/dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const dashboard = await buildExecutiveDashboard();
    return NextResponse.json(dashboard);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[oracle-brain/dashboard] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
