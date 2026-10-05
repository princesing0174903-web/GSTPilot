import { NextResponse } from 'next/server';
import { listSandboxExecutions, getSandboxStats } from '@/lib/app-platform/sandbox';
import { resolveDefaultTenantId } from '@/lib/app-platform/registry';

/** GET /api/app-platform/sandbox — sandbox execution records + stats. */
export async function GET() {
  try {
    const tenantId = await resolveDefaultTenantId();
    const [executions, stats] = await Promise.all([
      listSandboxExecutions(tenantId, 50),
      getSandboxStats(tenantId),
    ]);
    return NextResponse.json({ executions, total: executions.length, stats });
  } catch (error) {
    console.error('[API /app-platform/sandbox] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sandbox executions' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
