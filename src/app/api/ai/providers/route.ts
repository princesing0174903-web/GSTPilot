// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — Provider Diagnostics
//
// GET /api/ai/providers
//
// Returns information about the active AI provider (name, isLive, supported
// asset types, default models, health). Used by the UI to show which provider
// is servicing jobs and whether it's the mock or a live integration.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getGenProvider, describeProvider } from '@/lib/ai-pipeline/server/registry';
import { providerHealthCheck } from '@/lib/ai-pipeline/server/processor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const provider = getGenProvider();
    const info = describeProvider();
    const health = await providerHealthCheck();
    return NextResponse.json({
      ok: true,
      name: info.name,
      isLive: info.isLive,
      providerName: info.providerName,
      healthy: health.healthy,
      supportedAssetTypes: provider.supportedAssetTypes,
      defaultModels: provider.defaultModels,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
