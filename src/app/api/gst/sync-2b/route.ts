// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/gst/sync-2b
// ═══════════════════════════════════════════════════════════════════════════════
// Sync GSTR-2B for an org's GSTIN + period through the configured provider.
// Delegates the actual sync logic to `runSync2B` (shared with the retry route)
// and maps the structured outcome to an HTTP response.
//
// Body: { organizationId, period }  (period = YYYY-MM; defaults to current month)
// Returns:
//   200 { ok: true, jobId, summary: { recordsFetched, recordsImported,
//        recordsUpdated, recordsSkipped, recordsFailed, recordsChanged,
//        recordsRemoved, durationMs, mode, isLive, provider } }
//   200 { ok: true, jobId, partial: true, summary: {...} }  (some records failed)
//   400 { error, code: 'VALIDATION_ERROR' | 'NO_GSTIN' | 'UNSUPPORTED_PROVIDER' }
//   401 { error, code: 'GSP_AUTH_FAILED' }
//   409 { error, code: 'NOT_TESTED' }     ← real provider configured but not tested
//   429 { error, code: 'RATE_LIMITED' }   ← GSP rate limit OR per-user rate limit
//   502 { error, code: 'GSTN_OUTAGE' }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { rateLimit, rateLimitedResponse, type RateLimitRule } from '@/lib/rate-limit';
import { runSync2B } from '@/lib/gst-reconciliation/server/sync-2b-runner';

// GSTR-2B sync makes external HTTP calls + DB writes — limit to 10/min per user.
const SYNC_RATE_LIMIT: RateLimitRule = { windowMs: 60_000, max: 10 };

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  organizationId: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    // Rate-limit: GSTR-2B sync is expensive (external HTTP + DB writes).
    const rl = rateLimit(request, SYNC_RATE_LIMIT, 'gst-sync-2b', uid);
    if (rl.denied) {
      return rateLimitedResponse(
        rl.retryAfterSec,
        'Too many GSTR-2B sync requests. Please wait a minute and try again.',
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

    const period = body.period ?? new Date().toISOString().slice(0, 7);

    // Run the sync. The runner handles provider resolution, job creation,
    // record upsert, connection-state transitions, and error mapping.
    const outcome = await runSync2B({
      organizationId: body.organizationId,
      period,
      trigger: 'manual',
    });

    // Map the structured outcome to an HTTP response.
    switch (outcome.kind) {
      case 'success':
        return NextResponse.json({ ok: true, jobId: outcome.jobId, summary: outcome.summary });

      case 'partial':
        return NextResponse.json({
          ok: true,
          jobId: outcome.jobId,
          partial: true,
          summary: outcome.summary,
        });

      case 'not_tested':
        // Real provider configured but lastTestOk !== true. Refuse to silently
        // fall back to demo — the user must run "Test Connection" first.
        return NextResponse.json(
          {
            error: 'Provider not tested. Run Test Connection first.',
            code: 'NOT_TESTED',
          },
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
        // Exhaustiveness check — if a new outcome kind is added, this fails loudly.
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
      'Unable to sync GSTR-2B. Please check your provider connection and try again.',
    );
  }
}
