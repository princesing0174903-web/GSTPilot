// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/connectivity/marketplace
// Connector Marketplace — developers publish connectors; orgs install them.
// Supports certification, reviews, versioning, revenue sharing, licensing.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { listMarketplace, topMarketplace, getMarketplaceStats, publishMarketplaceConnector } from '@/lib/connectivity/marketplace';
import type { ConnectorCategory } from '@/lib/connectivity/types';

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10);
    const category = request.nextUrl.searchParams.get('category') as ConnectorCategory | null;

    const [listings, top, stats] = await Promise.all([
      listMarketplace(limit, category ?? undefined),
      topMarketplace(8),
      getMarketplaceStats(),
    ]);

    return NextResponse.json({ listings, top, stats });
  } catch (err) {
    console.error('[Connectivity] Marketplace error:', err);
    return NextResponse.json({ error: 'Failed to load marketplace' }, { status: 500 });
  }
}

// ─── POST /api/connectivity/marketplace — developer publishes a new connector ───
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await publishMarketplaceConnector({
      slug: body.slug,
      name: body.name,
      tagline: body.tagline,
      description: body.description,
      developerName: body.developerName,
      developerHandle: body.developerHandle,
      category: body.category,
      provider: body.provider,
      capabilities: body.capabilities ?? [],
      authMethods: body.authMethods ?? [],
      regions: body.regions ?? [],
      pricingModel: body.pricingModel,
      priceUsd: body.priceUsd,
      licenseType: body.licenseType,
      revenueSharePct: body.revenueSharePct,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error('[Connectivity] Marketplace publish error:', err);
    return NextResponse.json({ error: 'Failed to publish connector' }, { status: 500 });
  }
}
