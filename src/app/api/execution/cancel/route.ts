// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 12: Executive APIs™ — POST /api/execution/cancel
// Cancels a job by id. If the ExecutionJob row exists, marks it status='cancelled'
// with the cancellation reason in `result`. If not found (derived job, not persisted),
// creates a new ExecutionJob row recording the cancellation of that sourceRef.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { withExecutionApi, parseBody } from '@/lib/execution-cloud';

export async function POST(req: NextRequest) {
  return withExecutionApi(req, {
    endpoint: '/api/execution/cancel',
    method: 'POST',
    requiredAction: 'cancel',
    handler: async () => {
      const body = await parseBody<{ jobId?: string; reason?: string }>(req);
      const jobId = body?.jobId;
      if (!jobId) throw new Error('jobId is required');
      const reason = body?.reason ?? 'cancelled by user';
      const cancelledAt = new Date().toISOString();
      const result = JSON.stringify({ cancelledReason: reason, cancelledAt });

      try {
        await db.executionJob.update({
          where: { id: jobId },
          data: { status: 'cancelled', result },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          // Job wasn't persisted (derived from a source table). Record the cancellation.
          await db.executionJob.create({
            data: {
              module: 'automation',
              type: 'cancel',
              description: `Cancel ${jobId}`,
              status: 'cancelled',
              priority: 'normal',
              payload: JSON.stringify({ originalJobId: jobId, reason }),
              result,
            },
          });
        } else {
          throw err;
        }
      }

      return { ok: true, jobId, status: 'cancelled' as const };
    },
  });
}
