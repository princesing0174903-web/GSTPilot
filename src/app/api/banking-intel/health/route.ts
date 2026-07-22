import { NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';
import { isSetuConfigured, loadSetuConfig } from '@/lib/setu';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/banking-intel/health — quick health snapshot
// Returns which provider is active + (if Setu) whether Setu is configured.
export async function GET() {
  try {
    const svc = await getBankingService();
    // constructor.name is sufficient — MockBankingProvider vs SetuBankingProvider.
    const providerName = svc.constructor.name === 'SetuBankingProvider' ? 'setu' : 'mock';

    const setuConfigured = isSetuConfigured();
    const cfg = loadSetuConfig();

    return NextResponse.json({
      ok: true,
      provider: providerName,
      configured: setuConfigured,
      setuConfigured,
      setuBaseUrl: cfg?.baseUrl ?? null,
      uptime: process.uptime(),
      version: '1.0.0',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/health GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
