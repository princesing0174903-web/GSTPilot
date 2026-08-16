// GET /api/oracle/agents — List all 8 specialist agents
// POST /api/oracle/agents — Route a query to the best agent
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { AGENT_LIST, routeToAgent, getAgentById, type AgentId } from '@/lib/oracle-evolution/agents';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const { searchParams } = new URL(request.url);
  const orgId0 = searchParams.get('orgId') || searchParams.get('organizationId') || searchParams.get('firmId') || '';
  if (orgId0) {
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
  }

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
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const body = await request.json();
    const orgId0 = body.orgId || body.organizationId || body.firmId || '';
    if (orgId0) {
      const orgResult = await requireOrgMembership(uid, orgId0);
      if (orgResult instanceof NextResponse) return orgResult;
    }
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
