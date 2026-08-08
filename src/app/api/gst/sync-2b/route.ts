// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/gst/sync-2b
// ═══════════════════════════════════════════════════════════════════════════════
// Sync GSTR-2B for an org's GSTIN + period through the configured provider.
// Creates a GSTSyncJob, fetches records via the provider, upserts them into
// GSTR2BInvoice (idempotent by gstin+period+supplierGSTIN+invoiceNo), and
// updates the job + config timestamps.
//
// Body: { organizationId, period }  (period = YYYY-MM; defaults to current month)
// Returns: { ok: true, jobId, summary: { recordsFetched, recordsImported, recordsChanged, durationMs, mode } }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { decryptString } from '@/lib/gstn-provider/server/crypto';
import { MastersIndiaGSPProvider, type MastersIndiaConfig } from '@/lib/gst-reconciliation/server/mastersindia-provider';
import { GenericWebGSPProvider, type GenericWebConfig } from '@/lib/gst-reconciliation/server/generic-web-provider';
import { MockGSPProvider } from '@/lib/gst-reconciliation/server/mock-provider';
import type { IGSPProvider } from '@/lib/gst-reconciliation/types';
import { GSPError } from '@/lib/gst-reconciliation/errors';
import { rateLimit, rateLimitedResponse, type RateLimitRule } from '@/lib/rate-limit';

// GSTR-2B sync makes external HTTP calls + DB writes — limit to 10/min per user.
const SYNC_RATE_LIMIT: RateLimitRule = { windowMs: 60_000, max: 10 };

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  organizationId: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    // Rate-limit: GSTR-2B sync is expensive (external HTTP + DB writes).
    const rl = rateLimit(request, SYNC_RATE_LIMIT, 'gst-sync-2b', uid);
    if (rl.denied) {
      return rateLimitedResponse(rl.retryAfterSec, 'Too many GSTR-2B sync requests. Please wait a minute and try again.');
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

    // Resolve the provider config
    const cfg = await db.gSPProviderConfig.findFirst({
      where: { organizationId: body.organizationId, enabled: true },
      orderBy: { updatedAt: 'desc' },
    });

    // Determine mode + provider instance
    let provider: IGSPProvider;
    let mode: 'live' | 'sandbox' | 'demo';
    let gstin: string;
    let configId: string | null = null;

    if (!cfg || cfg.providerKey === 'mock' || !cfg.lastTestOk) {
      // Demo mode — use the mock provider. We still need a GSTIN to seed the
      // deterministic data. Fall back to the configured GSTIN or a sample.
      provider = new MockGSPProvider();
      mode = 'demo';
      gstin = cfg?.gstin ?? '27AAACR5058K1Z5';
      configId = cfg?.id ?? null;
    } else {
      gstin = cfg.gstin ?? '';
      if (!gstin || gstin.length !== 15) {
        return NextResponse.json(
          { error: 'No GSTIN configured for this provider. Add your GSTIN in Settings first.', code: 'NO_GSTIN' },
          { status: 400 },
        );
      }
      mode = cfg.mode === 'production' ? 'live' : 'sandbox';

      // Decrypt secrets + build the provider instance
      let decryptedSecret = '';
      try { decryptedSecret = cfg.clientSecret ? decryptString(cfg.clientSecret) : ''; } catch { /* */ }
      let decryptedApikey = '';
      try { decryptedApikey = cfg.apikey ? decryptString(cfg.apikey) : ''; } catch { /* */ }

      if (cfg.providerKey === 'mastersindia') {
        const miConfig: MastersIndiaConfig = {
          clientId: cfg.clientId ?? '',
          clientSecret: decryptedSecret,
          apikey: decryptedApikey,
          apiEndpoint: cfg.apiEndpoint ?? '',
          mode: (cfg.mode ?? 'sandbox') as 'sandbox' | 'production',
        };
        provider = new MastersIndiaGSPProvider(miConfig);
      } else if (cfg.providerKey === 'generic') {
        const genConfig: GenericWebConfig = {
          apikey: decryptedSecret || decryptedApikey,
          apiEndpoint: cfg.apiEndpoint ?? '',
          mode: (cfg.mode ?? 'sandbox') as 'sandbox' | 'production',
        };
        provider = new GenericWebGSPProvider(genConfig);
      } else {
        return NextResponse.json(
          { error: `Provider '${cfg.providerKey}' is not supported for sync.`, code: 'UNSUPPORTED_PROVIDER' },
          { status: 400 },
        );
      }
    }

    // Create the sync job
    const job = await db.gSTSyncJob.create({
      data: {
        organizationId: body.organizationId,
        configId,
        gstin,
        period,
        providerKey: cfg?.providerKey ?? 'mock',
        mode,
        status: 'running',
        trigger: 'manual',
        startedAt: new Date(),
      },
    });

    try {
      // Authenticate + fetch GSTR-2B
      const session = await provider.authenticate({
        clientId: cfg?.clientId ?? undefined,
        apikey: cfg?.apikey ?? undefined,
      });
      const result = await provider.fetchGSTR2B(session, gstin, period);

      const records = result.records;
      let recordsImported = 0;
      let recordsChanged = 0;

      if (records.length > 0) {
        // Idempotent upsert: find existing by (gstin, period, supplierGSTIN, invoiceNo)
        const existingRows = await db.gSTR2BInvoice.findMany({
          where: {
            gstin,
            period,
            OR: records.map((r) => ({
              supplierGSTIN: r.supplierGSTIN,
              invoiceNo: r.invoiceNo,
            })),
          },
          select: { id: true, supplierGSTIN: true, invoiceNo: true, taxableValue: true, igst: true, cgst: true, sgst: true, cess: true },
        });
        const existingMap = new Map<string, { id: string; taxableValue: number; igst: number; cgst: number; sgst: number; cess: number }>();
        for (const e of existingRows) {
          existingMap.set(`${e.supplierGSTIN}||${e.invoiceNo}`, e);
        }

        const toCreate: Array<{
          gstin: string; period: string; supplierGSTIN: string; supplierName: string | null;
          invoiceNo: string; invoiceDate: string | null; taxableValue: number;
          igst: number; cgst: number; sgst: number; cess: number;
          itcAvailable: number; itcEligible: boolean; matched: boolean; matchStatus: string;
        }> = [];
        const updateOps: Promise<unknown>[] = [];

        for (const rec of records) {
          const key = `${rec.supplierGSTIN}||${rec.invoiceNo}`;
          const existing = existingMap.get(key);
          if (existing) {
            // Detect changes
            const changed =
              existing.taxableValue !== rec.taxableValue ||
              existing.igst !== rec.igst ||
              existing.cgst !== rec.cgst ||
              existing.sgst !== rec.sgst ||
              existing.cess !== rec.cess;
            if (changed) recordsChanged++;
            updateOps.push(
              db.gSTR2BInvoice.update({
                where: { id: existing.id },
                data: {
                  invoiceDate: rec.invoiceDate ?? null,
                  taxableValue: rec.taxableValue,
                  igst: rec.igst,
                  cgst: rec.cgst,
                  sgst: rec.sgst,
                  cess: rec.cess,
                  itcAvailable: rec.itcAvailable,
                  itcEligible: rec.itcEligible,
                  supplierName: rec.supplierName ?? null,
                },
              }),
            );
          } else {
            recordsImported++;
            toCreate.push({
              gstin, period,
              supplierGSTIN: rec.supplierGSTIN,
              supplierName: rec.supplierName ?? null,
              invoiceNo: rec.invoiceNo,
              invoiceDate: rec.invoiceDate ?? null,
              taxableValue: rec.taxableValue,
              igst: rec.igst, cgst: rec.cgst, sgst: rec.sgst, cess: rec.cess,
              itcAvailable: rec.itcAvailable,
              itcEligible: rec.itcEligible,
              matched: false, matchStatus: 'unmatched',
            });
          }
        }

        await Promise.all([
          ...updateOps,
          toCreate.length > 0 ? db.gSTR2BInvoice.createMany({ data: toCreate }) : Promise.resolve(),
        ]);
      }

      const durationMs = Date.now() - startedAt;

      // Mark job complete + update config lastSyncAt
      await db.gSTSyncJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          recordsFetched: records.length,
          recordsImported,
          recordsChanged,
          recordsRemoved: 0,
          durationMs,
          completedAt: new Date(),
        },
      });

      if (cfg) {
        await db.gSPProviderConfig.update({
          where: { id: cfg.id },
          data: { lastSyncAt: new Date() },
        });
      }

      return NextResponse.json({
        ok: true,
        jobId: job.id,
        summary: {
          recordsFetched: records.length,
          recordsImported,
          recordsChanged,
          recordsRemoved: 0,
          durationMs,
          mode,
          isLive: result.isLive,
          provider: provider.displayName,
        },
      });
    } catch (err) {
      // Mark job failed
      const message = err instanceof GSPError ? err.message : (err instanceof Error ? err.message : 'Sync failed.');
      await db.gSTSyncJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: message.slice(0, 500),
          durationMs: Date.now() - startedAt,
          completedAt: new Date(),
        },
      });
      throw err;
    }
  } catch (error) {
    return friendlyApiError(error, 'Unable to sync GSTR-2B. Please check your provider connection and try again.');
  }
}
