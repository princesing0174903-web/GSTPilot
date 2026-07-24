// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Brain — Tasks API
// GET  /api/oracle/brain/tasks?firmId=...&status=...&limit=...
// POST /api/oracle/brain/tasks  (create)
// PATCH /api/oracle/brain/tasks?id=...  (update / complete / cancel / reminder)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  createTask,
  updateTask,
  getTask,
  listTasks,
  completeTask,
  cancelTask,
  markReminderSent,
  markFollowUpSent,
  getOverdueTasks,
  getPendingTasks,
  getTaskStats,
} from '@/lib/oracle/brain/task-engine';
import type { TaskStatus, TaskType, TaskPriority } from '@/lib/oracle/brain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const firmId = url.searchParams.get('firmId') || 'preview-org';
    const action = url.searchParams.get('action') || 'list';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const statusParam = url.searchParams.get('status');
    const status = statusParam
      ? (statusParam.includes(',')
          ? (statusParam.split(',') as TaskStatus[])
          : (statusParam as TaskStatus))
      : undefined;
    const priority = url.searchParams.get('priority') as TaskPriority | null;
    const type = url.searchParams.get('type') as TaskType | null;

    let result: unknown;
    if (action === 'stats') {
      result = await getTaskStats(firmId);
    } else if (action === 'overdue') {
      result = await getOverdueTasks(firmId);
    } else if (action === 'pending') {
      result = await getPendingTasks(firmId, limit);
    } else if (action === 'get' && url.searchParams.get('id')) {
      result = await getTask(url.searchParams.get('id')!);
    } else {
      result = await listTasks({ firmId, status, priority: priority ?? undefined, type: type ?? undefined, limit });
    }
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const task = await createTask({
      firmId: (body.firmId as string) || 'preview-org',
      userId: body.userId as string | undefined,
      title: body.title as string,
      description: body.description as string | undefined,
      type: body.type as TaskType | undefined,
      priority: body.priority as TaskPriority | undefined,
      relatedType: body.relatedType as string | undefined,
      relatedId: body.relatedId as string | undefined,
      relatedLabel: body.relatedLabel as string | undefined,
      dueDate: body.dueDate ? new Date(body.dueDate as string) : undefined,
      sourceMemoryId: body.sourceMemoryId as string | undefined,
      autonomous: body.autonomous as boolean | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
    });
    return NextResponse.json({ ok: true, data: task });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'id query param required' },
        { status: 400 },
      );
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action as string | undefined;

    if (action === 'complete') {
      return NextResponse.json({
        ok: true,
        data: await completeTask(id, (body.completedBy as string) || 'user', body.completionNote as string | undefined),
      });
    }
    if (action === 'cancel') {
      return NextResponse.json({ ok: true, data: await cancelTask(id) });
    }
    if (action === 'reminder') {
      return NextResponse.json({ ok: true, data: await markReminderSent(id) });
    }
    if (action === 'followup') {
      return NextResponse.json({ ok: true, data: await markFollowUpSent(id) });
    }

    const updated = await updateTask(id, {
      title: body.title as string | undefined,
      description: body.description as string | undefined,
      status: body.status as TaskStatus | undefined,
      priority: body.priority as TaskPriority | undefined,
      dueDate: body.dueDate ? new Date(body.dueDate as string) : body.dueDate === null ? null : undefined,
      relatedId: body.relatedId as string | undefined,
      relatedLabel: body.relatedLabel as string | undefined,
      completionNote: body.completionNote as string | undefined,
      completedBy: body.completedBy as string | undefined,
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
