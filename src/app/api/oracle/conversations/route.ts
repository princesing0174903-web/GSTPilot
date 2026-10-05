// GET /api/oracle/conversations — list conversations
// POST /api/oracle/conversations — start or run an executive conversation
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import {
  listConversations,
  startConversation,
  runExecutiveConversation,
  getConversationStats,
} from '@/lib/oracle-core/conversation';

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

  try {
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;
    const statsOnly = searchParams.get('stats') === 'true';

    if (statsOnly) {
      const stats = await getConversationStats();
      return NextResponse.json(stats);
    }

    const records = await listConversations(limit);
    return NextResponse.json({ records, total: records.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const body = (await request.json()) as {
      topic: string;
      trigger?: 'user_ask' | 'daily_synthesis' | 'ceo_initiative' | 'alert';
      participants?: string[];
      maxTurns?: number;
      runNow?: boolean;
      orgId?: string;
      organizationId?: string;
      firmId?: string;
    };

    const orgId0 = body.orgId || body.organizationId || body.firmId || '';
    if (orgId0) {
      const orgResult = await requireOrgMembership(uid, orgId0);
      if (orgResult instanceof NextResponse) return orgResult;
    }

    if (!body.topic) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 });
    }

    if (body.runNow) {
      const conversation = await runExecutiveConversation(body.topic, {
        participants: body.participants as any,
        maxTurns: body.maxTurns,
      });
      return NextResponse.json(conversation);
    }

    const conversation = await startConversation({
      topic: body.topic,
      trigger: body.trigger || 'user_ask',
      participants: body.participants as any,
    });
    return NextResponse.json(conversation);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
