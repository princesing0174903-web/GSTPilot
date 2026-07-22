import { NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';
import { getSetuClient, isSetuConfigured, loadSetuConfig, maskString } from '@/lib/setu';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/banking-intel/diagnostics — full diagnostic snapshot
// Returns which provider is active + masked Setu config + env hints.
// NEVER returns raw secrets — all sensitive values are masked (first 4 + last 4).
export async function GET() {
  try {
    const svc = await getBankingService();
    const providerName = svc.constructor.name === 'SetuBankingProvider' ? 'setu' : 'mock';
    const cfg = loadSetuConfig();
    const setuConfigured = isSetuConfigured();
    const client = getSetuClient();

    return NextResponse.json({
      ok: true,
      provider: providerName,
      timestamp: new Date().toISOString(),
      setu: {
        configured: setuConfigured,
        baseUrl: cfg?.baseUrl ?? null,
        authUrl: cfg?.authUrl ?? null,
        // Mask all secrets — show first 4 + last 4 chars only.
        productInstanceId: cfg ? maskString(cfg.productInstanceId, 4, 4) : null,
        clientId: cfg ? maskString(cfg.clientId, 4, 4) : null,
        clientSecretConfigured: cfg ? cfg.clientSecret.length > 0 : false,
        webhookSecretConfigured: Boolean(cfg?.webhookSecret),
        timeoutMs: cfg?.timeoutMs ?? null,
        maxRetries: cfg?.maxRetries ?? null,
        logLevel: cfg?.logLevel ?? null,
      },
      client: {
        hasClient: client !== null,
      },
      env: {
        BANKING_PROVIDER: process.env.BANKING_PROVIDER ?? 'auto (default)',
        NODE_ENV: process.env.NODE_ENV ?? 'development',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/diagnostics GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
