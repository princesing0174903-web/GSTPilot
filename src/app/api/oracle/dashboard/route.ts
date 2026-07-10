// GET /api/oracle/dashboard — Oracle Intelligence Core™ unified dashboard
import { NextResponse } from 'next/server';
import { getOracleDashboard } from '@/lib/oracle-core/orchestrator';

export async function GET() {
  try {
    const dashboard = await getOracleDashboard();
    return NextResponse.json(dashboard);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
