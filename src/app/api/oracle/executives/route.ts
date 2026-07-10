// GET /api/oracle/executives — list all AI modules with live status
import { NextResponse } from 'next/server';
import { listAIModules } from '@/lib/oracle-core/orchestrator';

export async function GET() {
  try {
    const modules = await listAIModules();
    return NextResponse.json({ modules, total: modules.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
