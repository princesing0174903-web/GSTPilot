// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Status API
//
// GET /api/erp/status?provider=tally
//   Returns: { ok: true, name, provider, isLive, healthy, mode }
//
// Reports the active ERP provider's health + whether it's a live or mock
// implementation. Used by the UI to show "Connected to Mock Tally Prime" etc.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { describeERPProvider } from '@/lib/erp-provider/server/registry';
import { providerHealthCheck } from '@/lib/erp-provider/server/orchestrator';
import type { ERPProviderName } from '@/lib/erp-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_PROVIDERS: ERPProviderName[] = ['tally', 'zoho_books', 'busy', 'quickbooks'];

export async function GET(req: NextRequest) {
  const providerParam = req.nextUrl.searchParams.get('provider') as ERPProviderName | null;
  const provider: ERPProviderName = providerParam ?? 'tally';

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { ok: false, error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` },
      { status: 400 },
    );
  }

  const desc = describeERPProvider(provider);
  const health = await providerHealthCheck(provider);

  return NextResponse.json({
    ok: true,
    name: desc.name,
    provider: desc.provider,
    isLive: desc.isLive,
    healthy: health.healthy,
    mode: desc.mode,
  });
}
