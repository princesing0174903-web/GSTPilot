// GET  /api/oracle-ai/tasks — list tasks
// POST /api/oracle-ai/tasks — enqueue a task

import { NextRequest, NextResponse } from 'next/server';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { enqueueTask, listTasks } from '@/lib/oracle-ai/tasks';
import type { TaskStatus, TaskType } from '@/lib/oracle-ai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveOracleAICtx(req);
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as TaskStatus | null;
    const sessionId = url.searchParams.get('sessionId') ?? undefined;
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const tasks = await listTasks({
      firmId: ctx.firmId,
      status: status ?? undefined,
      sessionId,
      limit,
    });
    return NextResponse.json({ tasks });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveOracleAICtx(req);
    const body = await req.json().catch(() => ({}));
    const task = await enqueueTask({
      firmId: ctx.firmId,
      userId: ctx.uid,
      sessionId: body.sessionId,
      messageId: body.messageId,
      type: body.type as TaskType,
      title: String(body.title ?? 'Untitled task'),
      description: body.description,
      priority: body.priority,
      payload: body.payload,
      agentId: body.agentId,
    });
    return NextResponse.json({ task });
  } catch (err) {
    return toErrorResponse(err);
  }
}
