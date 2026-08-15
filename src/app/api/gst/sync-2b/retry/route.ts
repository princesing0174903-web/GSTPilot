// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/gst/sync-2b/retry
// ═══════════════════════════════════════════════════════════════════════════════
// Retry a previous GSTR-2B sync job. Loads the original job, verifies it
// belongs to the org, then runs a fresh sync with `trigger='retry'` and
// `retryOf=originalJobId`. The fresh sync uses the original job's period +
// organizationId — the user does NOT need to re-supply them.
//
// This is mainly for the UI "Retry" button on a failed/partial sync job.
//
// Body: { organizationId, jobId }
// Returns: same shape as POST /api/gst/sync-2b
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { rateLimit, rateLimitedResponse, type RateLimitRule } from '@/lib/rate-limit';
import { runSync2B } from '@/lib/gst-reconciliation/server/sync-2b-runner';

// Retry carries the same cost as a fresh sync — share the same rate limit.
const RETRY_RATE_LIMIT: RateLimitRule = { windowMs: 60_000, max: 10 };

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  organizationId: z.string().min(1),
  jobId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    const rl = rateLimit(request, RETRY_RATE_LIMIT, 'gst-sync-2b-retry', uid);
    if (rl.denied) {
      return rateLimitedResponse(
        rl.retryAfterSec,
        'Too many GSTR-2B retry requests. Please wait a minute and try again.',
      );
    }

    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: err.issues[0]?.message ?? 'Invalid request.', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      }
      throw err;
    }

    const member = await requireOrgMembership(uid, body.organizationId);
    if (member instanceof NextResponse) return member;

    // Load the original job + verify it belongs to the org (tenant isolation).
    const originalJob = await db.gSTSyncJob.findFirst({
      where: { id: body.jobId, organizationId: body.organizationId },
      select: { id: true, period: true, status: true, gstin: true },
    });
    if (!originalJob) {
      return NextResponse.json(
        { error: 'Sync job not found in this organization.', code: 'JOB_NOT_FOUND' },
        { status: 404 },
      );
    }

    // Refuse to retry a job that is currently running — would create duplicate
    // concurrent syncs against the same provider config.
    if (originalJob.status === 'running') {
      return NextResponse.json(
        { error: 'This sync is already running. Wait for it to finish before retrying.', code: 'JOB_RUNNING' },
        { status: 409 },
      );
    }

    // Run a fresh sync with the original job's period + trigger='retry'.
    const outcome = await runSync2B({
      organizationId: body.organizationId,
      period: originalJob.period,
      trigger: 'retry',
      retryOf: originalJob.id,
    });

    // Map outcome to HTTP — identical to the sync-2b route.
    switch (outcome.kind) {
      case 'success':
        return NextResponse.json({
          ok: true,
          jobId: outcome.jobId,
          retryOf: originalJob.id,
          summary: outcome.summary,
        });

      case 'partial':
        return NextResponse.json({
          ok: true,
          jobId: outcome.jobId,
          retryOf: originalJob.id,
          partial: true,
          summary: outcome.summary,
        });

      case 'not_tested':
        return NextResponse.json(
          { error: 'Provider not tested. Run Test Connection first.', code: 'NOT_TESTED' },
          { status: 409 },
        );

      case 'no_gstin':
        return NextResponse.json(
          {
            error: 'No GSTIN configured for this provider. Add your GSTIN in Settings first.',
            code: 'NO_GSTIN',
          },
          { status: 400 },
        );

      case 'unsupported_provider':
        return NextResponse.json(
          {
            error: `Provider '${outcome.providerKey}' is not supported for sync.`,
            code: 'UNSUPPORTED_PROVIDER',
          },
          { status: 400 },
        );

      case 'rate_limited':
        return NextResponse.json(
          { error: outcome.message, code: 'GSP_RATE_LIMIT' },
          { status: 429 },
        );

      case 'auth_error':
        return NextResponse.json(
          { error: outcome.message, code: 'GSP_AUTH_FAILED' },
          { status: 401 },
        );

      case 'outage':
        return NextResponse.json(
          { error: outcome.message, code: 'GSTN_OUTAGE' },
          { status: 502 },
        );

      case 'error':
        return NextResponse.json(
          { error: outcome.message, code: 'SYNC_ERROR' },
          { status: 500 },
        );

      default: {
        const _exhaustive: never = outcome;
        void _exhaustive;
        return NextResponse.json(
          { error: 'Unknown sync outcome.', code: 'SYNC_ERROR' },
          { status: 500 },
        );
      }
    }
  } catch (error) {
    return friendlyApiError(
      error,
      'Unable to retry the GSTR-2B sync. Please check your provider connection and try again.',
    );
  }
}
