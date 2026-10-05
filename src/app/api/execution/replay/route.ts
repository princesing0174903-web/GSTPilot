// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 12: Executive APIs™ — GET/POST /api/execution/replay
// GET  ?jobId=<id>      → reconstructs a job's execution trace via buildReplay.
// POST { jobId }         → same payload, used by the Replay Console to trigger
//                          a replay action (currently returns the reconstructed trace).
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  buildUnifiedJobStream, buildReplay, withExecutionApi, parseBody,
} from '@/lib/execution-cloud';

export async function GET(req: NextRequest) {
  return withExecutionApi(req, {
    endpoint: '/api/execution/replay',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => {
      const jobId = req.nextUrl.searchParams.get('jobId');
      if (!jobId) throw new Error('jobId query parameter is required');
      const jobs = await buildUnifiedJobStream(db);
      const job = jobs.find((j) => j.id === jobId);
      if (!job) throw new Error(`Job not found: ${jobId}`);
      return buildReplay(db, job);
    },
  });
}

export async function POST(req: NextRequest) {
  return withExecutionApi(req, {
    endpoint: '/api/execution/replay',
    method: 'POST',
    requiredAction: 'replay',
    handler: async () => {
      const body = await parseBody<{ jobId?: string }>(req);
      const jobId = body?.jobId;
      if (!jobId) throw new Error('jobId is required');
      const jobs = await buildUnifiedJobStream(db);
      const job = jobs.find((j) => j.id === jobId);
      if (!job) throw new Error(`Job not found: ${jobId}`);
      return buildReplay(db, job);
    },
  });
}
