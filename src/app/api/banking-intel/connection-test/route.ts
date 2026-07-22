import { NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';
import { getSetuClient } from '@/lib/setu';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/banking-intel/connection-test — verify live Setu connectivity
// For Mock: returns immediately with a "no-op" ok.
// For Setu: calls setuClient.healthCheck() (getAccessToken + listFips).
export async function POST() {
  try {
    const svc = await getBankingService();
    const isSetu = svc.constructor.name === 'SetuBankingProvider';

    if (!isSetu) {
      return NextResponse.json({
        ok: true,
        provider: 'mock',
        message: 'Mock provider — no external connection tested',
      });
    }

    const client = getSetuClient();
    if (!client) {
      return NextResponse.json(
        { ok: false, provider: 'setu', error: 'Setu provider active but SetuClient is null' },
        { status: 500 },
      );
    }

    // healthCheck() has its own try/catch + 15s timeout baked in.
    const result = await Promise.race([
      client.healthCheck(),
      new Promise<{ ok: false; error: string }>((resolve) =>
        setTimeout(
          () => resolve({ ok: false, error: 'Connection test timed out after 15s' }),
          15_000,
        ),
      ),
    ]);

    return NextResponse.json({
      ok: result.ok,
      provider: 'setu',
      latencyMs: result.latencyMs,
      authOk: result.authOk,
      fipCount: result.fipCount,
      error: result.error,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/connection-test POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
