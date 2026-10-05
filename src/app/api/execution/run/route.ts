// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 12: Executive APIs™ — POST /api/execution/run
// Submits a new job to the Enterprise Execution Cloud. Validates the request,
// applies the approval policy (needsApproval), persists an ExecutionJob row +
// an ExecutionQueue row, signs the execution (tamper-evidence), and returns the
// created job + signature + approval flag.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  withExecutionApi, parseBody, validateRunRequest, needsApproval, signExecution,
} from '@/lib/execution-cloud';
import type { RunJobRequest, ExecutionPriority } from '@/lib/execution-cloud';

// Mirrors PRIORITY_RANK in queue.ts: critical=0, high=25, normal=50, low=75, deferred=100
const PRIORITY_RANK: Record<ExecutionPriority, number> = {
  critical: 0, high: 25, normal: 50, low: 75, deferred: 100,
};

export async function POST(req: NextRequest) {
  return withExecutionApi(req, {
    endpoint: '/api/execution/run',
    method: 'POST',
    requiredAction: 'run',
    handler: async () => {
      const body = await parseBody<RunJobRequest>(req);
      if (!body) throw new Error('Request body is required');
      const validationError = validateRunRequest(body);
      if (validationError) throw new Error(validationError);

      const priority: ExecutionPriority = body.priority ?? 'normal';
      const moduleId = body.module;
      const type = body.type;
      const description = body.description ?? `${moduleId}.${type}`;
      const queueName = body.queueName ?? 'default';
      const payload = body.payload ?? {};

      const status = needsApproval(priority, moduleId) ? 'awaiting_approval' : 'queued';

      const job = await db.executionJob.create({
        data: {
          module: moduleId,
          type,
          description,
          status,
          priority,
          organizationId: body.organizationId ?? null,
          countryIso: body.countryIso ?? null,
          entityId: body.entityId ?? null,
          userId: body.userId ?? null,
          aiModule: body.aiModule ?? null,
          payload: JSON.stringify(payload),
          sourceJobId: body.sourceJobId ?? null,
          queueName,
          retryCount: 0,
          maxRetries: 3,
        },
      });

      await db.executionQueue.create({
        data: {
          jobId: job.id,
          queueName,
          priority: PRIORITY_RANK[priority],
          status,
          dependencies: body.sourceJobId ? JSON.stringify([body.sourceJobId]) : '[]',
        },
      });

      const signature = signExecution(moduleId, type, payload, job.createdAt.toISOString());

      await db.executionJob.update({
        where: { id: job.id },
        data: { auditId: signature },
      });

      return {
        job: {
          ...job,
          payload,
          result: {},
          auditId: signature,
        },
        signature,
        approved: status !== 'awaiting_approval',
      };
    },
  });
}
