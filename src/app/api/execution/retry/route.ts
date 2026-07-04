// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 12: Executive APIs™ — POST /api/execution/retry
// Retries a job by id: looks up the original (DB row or derived job in the unified
// stream), enforces maxRetries, then creates a NEW ExecutionJob row that's a
// retry of it (retryCount incremented, sourceJobId → original). Also enqueues it.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  withExecutionApi, parseBody, buildUnifiedJobStream,
} from '@/lib/execution-cloud';
import type { ExecutionPriority } from '@/lib/execution-cloud';

const PRIORITY_RANK: Record<ExecutionPriority, number> = {
  critical: 0, high: 25, normal: 50, low: 75, deferred: 100,
};

export async function POST(req: NextRequest) {
  return withExecutionApi(req, {
    endpoint: '/api/execution/retry',
    method: 'POST',
    requiredAction: 'retry',
    handler: async () => {
      const body = await parseBody<{ jobId?: string }>(req);
      const jobId = body?.jobId;
      if (!jobId) throw new Error('jobId is required');

      // Resolve the original job — prefer a persisted row, fall back to the unified stream.
      const originalRow = await db.executionJob.findUnique({ where: { id: jobId } });
      let original: {
        id: string; module: string; type: string; description: string;
        priority: string; retryCount: number; maxRetries: number; queueName: string;
        organizationId: string | null; countryIso: string | null; entityId: string | null;
        userId: string | null; aiModule: string | null; payload: string;
      };
      if (originalRow) {
        original = originalRow;
      } else {
        const jobs = await buildUnifiedJobStream(db);
        const found = jobs.find((j) => j.id === jobId);
        if (!found) throw new Error(`Job not found: ${jobId}`);
        original = {
          id: found.id,
          module: found.module,
          type: found.type,
          description: found.description,
          priority: found.priority,
          retryCount: found.retryCount,
          maxRetries: found.maxRetries,
          queueName: found.queueName,
          organizationId: found.organizationId,
          countryIso: found.countryIso,
          entityId: found.entityId,
          userId: found.userId,
          aiModule: found.aiModule,
          payload: JSON.stringify(found.payload),
        };
      }

      const newRetryCount = (original.retryCount ?? 0) + 1;
      if (newRetryCount > original.maxRetries) {
        throw new Error('Max retries exceeded');
      }

      const priority = (original.priority as ExecutionPriority) ?? 'normal';
      const originalPayload = safeParse(original.payload);
      const newPayload = { ...originalPayload, retriedFrom: jobId, attempt: newRetryCount };

      const newJob = await db.executionJob.create({
        data: {
          module: original.module,
          type: original.type,
          description: original.description,
          status: 'queued',
          priority,
          organizationId: original.organizationId ?? null,
          countryIso: original.countryIso ?? null,
          entityId: original.entityId ?? null,
          userId: original.userId ?? null,
          aiModule: original.aiModule ?? null,
          payload: JSON.stringify(newPayload),
          sourceJobId: original.id,
          queueName: original.queueName ?? 'default',
          retryCount: newRetryCount,
          maxRetries: original.maxRetries,
        },
      });

      await db.executionQueue.create({
        data: {
          jobId: newJob.id,
          queueName: newJob.queueName,
          priority: PRIORITY_RANK[priority],
          status: 'queued',
          dependencies: JSON.stringify([original.id]),
        },
      });

      return {
        job: { ...newJob, payload: newPayload, result: {} },
        originalJobId: jobId,
        attempt: newJob.retryCount,
      };
    },
  });
}

function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}
