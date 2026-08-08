// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/gst/verify-gstin
// ═══════════════════════════════════════════════════════════════════════════════
// Verify a GSTIN through the configured provider (real lookup) OR, if no real
// provider is configured, through the offline checksum validator (demo mode).
// Caches the result (legal/trade name) on the GSPProviderConfig.
//
// Body: { organizationId, gstin }
// Returns: { ok: true, result: { gstin, legalName, tradeName, stateCode, status, source } }
//   source: 'live' | 'sandbox' | 'demo'
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { decryptString } from '@/lib/gstn-provider/server/crypto';
import { MastersIndiaGSPProvider, type MastersIndiaConfig } from '@/lib/gst-reconciliation/server/mastersindia-provider';
import { validateGstinChecksum } from '@/lib/gst-reconciliation/server/gstin-validator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  organizationId: z.string().min(1),
  gstin: z.string().length(15),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

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

    const gstin = body.gstin.toUpperCase();

    // Step 1: Always validate the checksum locally first (instant, free).
    const checksum = validateGstinChecksum(gstin);
    if (!checksum.valid) {
      return NextResponse.json({
        ok: true,
        result: {
          gstin,
          valid: false,
          legalName: '',
          tradeName: '',
          stateCode: '',
          status: 'Invalid format',
          source: 'demo',
          message: 'The GSTIN failed checksum validation. Please check the 15-character number.',
        },
      });
    }

    // Step 2: Look up the configured provider
    const cfg = await db.gSPProviderConfig.findFirst({
      where: { organizationId: body.organizationId, enabled: true },
      orderBy: { updatedAt: 'desc' },
    });

    // No real provider → demo-mode result (checksum valid, no live lookup)
    if (!cfg || cfg.providerKey === 'mock' || !cfg.lastTestOk) {
      return NextResponse.json({
        ok: true,
        result: {
          gstin,
          valid: true,
          legalName: '',
          tradeName: '',
          stateCode: checksum.stateCode ?? '',
          status: 'Active (unverified — demo mode)',
          source: 'demo',
          message: 'GSTIN format is valid. Connect a real GSP provider to verify legal name and status against GSTN.',
        },
      });
    }

    // Step 3: Real provider lookup
    if (cfg.providerKey === 'mastersindia') {
      let decryptedSecret = '';
      try { decryptedSecret = cfg.clientSecret ? decryptString(cfg.clientSecret) : ''; } catch { /* */ }
      let decryptedApikey = '';
      try { decryptedApikey = cfg.apikey ? decryptString(cfg.apikey) : ''; } catch { /* */ }

      const miConfig: MastersIndiaConfig = {
        clientId: cfg.clientId ?? '',
        clientSecret: decryptedSecret,
        apikey: decryptedApikey,
        apiEndpoint: cfg.apiEndpoint ?? '',
        mode: (cfg.mode ?? 'sandbox') as 'sandbox' | 'production',
      };
      const provider = new MastersIndiaGSPProvider(miConfig);
      try {
        const lookup = await provider.verifyGSTIN(gstin);
        // Cache the result
        await db.gSPProviderConfig.update({
          where: { id: cfg.id },
          data: { gstin, legalName: lookup.legalName, tradeName: lookup.tradeName },
        });
        return NextResponse.json({
          ok: true,
          result: {
            gstin: lookup.gstin,
            valid: true,
            legalName: lookup.legalName,
            tradeName: lookup.tradeName,
            stateCode: lookup.stateCode,
            status: lookup.status,
            source: cfg.mode === 'production' ? 'live' : 'sandbox',
          },
        });
      } catch (err) {
        return NextResponse.json({
          ok: true,
          result: {
            gstin,
            valid: true,
            legalName: '',
            tradeName: '',
            stateCode: checksum.stateCode ?? '',
            status: 'Lookup failed',
            source: cfg.mode === 'production' ? 'live' : 'sandbox',
            message: err instanceof Error ? err.message : 'GSTIN lookup failed. The provider may be temporarily unavailable.',
          },
        });
      }
    }

    // Generic provider — GSTIN verification not supported via the generic contract
    return NextResponse.json({
      ok: true,
      result: {
        gstin,
        valid: true,
        legalName: '',
        tradeName: '',
        stateCode: checksum.stateCode ?? '',
        status: 'Active (unverified)',
        source: cfg.mode === 'production' ? 'live' : 'sandbox',
        message: 'GSTIN verification is unavailable for the current provider. The format is valid.',
      },
    });
  } catch (error) {
    return friendlyApiError(error, 'Unable to verify GSTIN.');
  }
}
