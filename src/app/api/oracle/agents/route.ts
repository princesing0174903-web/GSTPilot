// GET /api/oracle/agents — List all 8 specialist agents
// POST /api/oracle/agents — Route a query to the best agent
import { NextRequest, NextResponse } from 'next/server';
import { AGENT_LIST, routeToAgent, getAgentById, type AgentId } from '@/lib/oracle-evolution/agents';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') as AgentId | null;

  if (id) {
    const agent = getAgentById(id);
    if (!agent) return NextResponse.json({ error: 'Unknown agent' }, { status: 404 });
    return NextResponse.json({ agent });
  }

  return NextResponse.json({
    agents: AGENT_LIST.map((a) => ({
      id: a.id,
      name: a.name,
      title: a.title,
      specialty: a.specialty,
      icon: a.icon,
      accent: a.accent,
      dataSources: a.dataSources,
      tools: a.tools,
    })),
    total: AGENT_LIST.length,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query as string;
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }
    const decision = routeToAgent(query);
    return NextResponse.json(decision);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
