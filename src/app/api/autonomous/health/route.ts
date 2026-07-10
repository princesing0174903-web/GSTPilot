// GET /api/autonomous/health — Self-Healing System: live health checks + healing events
import { NextResponse } from 'next/server';
import { runHealthChecks, loadHealingEvents } from '@/lib/autonomous/self-healing';
import { AUTONOMOUS_TAGLINE } from '@/lib/autonomous/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const [systemHealth, recentHealingEvents] = await Promise.all([
      runHealthChecks(),
      loadHealingEvents(10),
    ]);
    const healthy = systemHealth.filter((c) => c.status === 'healthy').length;
    const degraded = systemHealth.filter((c) => c.status === 'degraded').length;
    const down = systemHealth.filter((c) => c.status === 'down').length;
    return NextResponse.json(
      {
        systemHealth,
        recentHealingEvents,
        summary: { total: systemHealth.length, healthy, degraded, down },
        overallStatus: down > 0 ? 'critical' : degraded > 0 ? 'degraded' : 'healthy',
        tagline: AUTONOMOUS_TAGLINE,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true' } },
    );
  } catch (error) {
    console.error('[Autonomous Health] Error:', error);
    return NextResponse.json({ error: 'Failed to run health checks', tagline: AUTONOMOUS_TAGLINE }, { status: 500 });
  }
}
