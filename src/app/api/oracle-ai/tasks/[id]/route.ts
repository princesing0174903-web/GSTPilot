// GET   /api/oracle-ai/tasks/:id — get a task
// PATCH /api/oracle-ai/tasks/:id — update status/progress/result
// DELETE /api/oracle-ai/tasks/:id — cancel a task

import { NextRequest, NextResponse } from 'next/server';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { cancelTask, getTask, updateTask } from '@/lib/oracle-ai/tasks';
import type { TaskStatus } from '@/lib/oracle-ai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveOracleAICtx(req);
    const { id } = await params;
    const task = await getTask(id, ctx.firmId);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json({ task });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveOracleAICtx(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const task = await updateTask(
      id,
      {
        status: body.status as TaskStatus | undefined,
        progress: body.progress,
        result: body.result,
        error: body.error,
      },
      ctx.firmId,
    );
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json({ task });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveOracleAICtx(req);
    const { id } = await params;
    const task = await cancelTask(id, ctx.firmId);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json({ task });
  } catch (err) {
    return toErrorResponse(err);
  }
}
