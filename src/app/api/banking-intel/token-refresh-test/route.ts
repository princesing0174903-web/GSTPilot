import { NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';
import { getSetuClient, SetuApiError } from '@/lib/setu';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/banking-intel/token-refresh-test — force an OAuth2 token refresh
// For Mock: returns immediately with a "no-op" ok.
// For Setu: calls setuAuth.refreshToken(), reports whether it worked + the
// expiry. NEVER returns the token itself.
export async function POST() {
  try {
    const svc = await getBankingService();
    const isSetu = svc.constructor.name === 'SetuBankingProvider';

    if (!isSetu) {
      return NextResponse.json({
        ok: true,
        provider: 'mock',
        message: 'No token to refresh (mock provider)',
      });
    }

    const client = getSetuClient();
    if (!client) {
      return NextResponse.json(
        { ok: false, provider: 'setu', error: 'Setu provider active but SetuClient is null' },
        { status: 500 },
      );
    }

    try {
      // Force a refresh — bypasses the cache.
      await client.getAuth().refreshToken();
      // Fetch the token once to verify it's now cached + get expiry.
      const token = await client.getAuth().getAccessToken();
      const ok = typeof token === 'string' && token.length > 0;

      return NextResponse.json({
        ok,
        provider: 'setu',
        tokenReceived: ok,
        refreshedAt: new Date().toISOString(),
        // We deliberately do NOT return the token itself.
        message: ok ? 'Token refreshed successfully' : 'Token refresh returned empty token',
      });
    } catch (err) {
      const isSetuErr = err instanceof SetuApiError;
      return NextResponse.json({
        ok: false,
        provider: 'setu',
        tokenReceived: false,
        error: err instanceof Error ? err.message : String(err),
        code: isSetuErr ? err.code : undefined,
        status: isSetuErr ? err.status : undefined,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/token-refresh-test POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
