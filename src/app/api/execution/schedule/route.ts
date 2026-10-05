// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 12: Executive APIs™ — POST /api/execution/schedule
// Creates a new ExecutionSchedule row (cron-driven background job). Validates
// the module is one of the 22 ExecutionModule ids, computes the next run time
// from the cron expression, and persists the schedule.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withExecutionApi, parseBody } from '@/lib/execution-cloud';
import { ALL_MODULES } from '@/lib/execution-cloud';
import type { ScheduleJobRequest } from '@/lib/execution-cloud';

// Parse a simple "m H * * *" (minute hour dom month dow) cron expression and
// return the next occurrence Date after `now`. Supports the "*" wildcard in
// every field and a single integer per field. If the expression is missing or
// unparseable, returns `now + 1 hour` as a safe default.
function computeNextRun(cron: string | null | undefined, now: Date = new Date()): Date {
  if (!cron) return new Date(now.getTime() + 60 * 60 * 1000);
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return new Date(now.getTime() + 60 * 60 * 1000);
  const [mStr, hStr, domStr, monStr, dowStr] = parts;
  // Only support simple "*" or single integer fields. Bail to default otherwise.
  const m = mStr === '*' ? null : parseInt(mStr, 10);
  const h = hStr === '*' ? null : parseInt(hStr, 10);
  if (m !== null && (Number.isNaN(m) || m < 0 || m > 59)) return new Date(now.getTime() + 60 * 60 * 1000);
  if (h !== null && (Number.isNaN(h) || h < 0 || h > 23)) return new Date(now.getTime() + 60 * 60 * 1000);
  // For simplicity we ignore dom/mon/dow constraints other than "*" — production
  // cron parsing should use a real library (cron-parser). This is a good enough
  // approximation for the dashboard's "next run" preview.
  if (domStr !== '*' || monStr !== '*' || dowStr !== '*') {
    // If specific day/month/dow is requested, fall back to +24h.
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  const next = new Date(now);
  next.setSeconds(0, 0);
  if (m !== null) next.setMinutes(m);
  if (h !== null) next.setHours(h);
  if (next.getTime() <= now.getTime()) {
    next.setTime(next.getTime() + 24 * 60 * 60 * 1000);
  }
  return next;
}

export async function POST(req: NextRequest) {
  return withExecutionApi(req, {
    endpoint: '/api/execution/schedule',
    method: 'POST',
    requiredAction: 'schedule',
    handler: async () => {
      const body = await parseBody<ScheduleJobRequest>(req);
      if (!body) throw new Error('Request body is required');
      if (!body.name) throw new Error('name is required');
      if (!body.module) throw new Error('module is required');
      if (!ALL_MODULES.includes(body.module)) {
        throw new Error(`module must be one of: ${ALL_MODULES.join(', ')}`);
      }
      if (!body.type) throw new Error('type is required');

      const nextRunAt = computeNextRun(body.cron);

      const schedule = await db.executionSchedule.create({
        data: {
          name: body.name,
          module: body.module,
          type: 'scheduled',
          cron: body.cron ?? null,
          organizationId: body.organizationId ?? null,
          countryIso: body.countryIso ?? null,
          enabled: true,
          nextRunAt,
        },
      });

      return { schedule };
    },
  });
}
