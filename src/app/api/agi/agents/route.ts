// GET /api/agi/agents
// Returns the 15-agent swarm roster + swarm summary + recent inter-agent messages.
import { NextResponse } from 'next/server';
import { getSwarmAgents, getSwarmSummary, getRecentAgentMessages } from '@/lib/agi/swarm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const [agents, summary, recentMessages] = await Promise.all([
      getSwarmAgents(),
      getSwarmSummary(),
      getRecentAgentMessages(30),
    ]);
    return NextResponse.json({ ok: true, agents, summary, recentMessages });
  } catch (err) {
    console.error('[agi/agents] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load AGI agent swarm' }, { status: 500 });
  }
}
