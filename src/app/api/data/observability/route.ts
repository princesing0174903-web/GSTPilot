// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/data/observability?connectors=true
// Data Observability™ — returns observability metrics + summary, OR per-connector
// health snapshots when connectors=true. REAL production data only.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  getObservabilityMetrics,
  getObservabilitySummary,
  getConnectorHealth,
} from '@/lib/data-intelligence';

export async function GET(request: NextRequest) {
  try {
    const connectors = request.nextUrl.searchParams.get('connectors') === 'true';

    if (connectors) {
      const connectorHealth = await getConnectorHealth();
      return NextResponse.json({ ok: true, connectors: connectorHealth });
    }

    const [metrics, summary] = await Promise.all([
      getObservabilityMetrics(),
      getObservabilitySummary(),
    ]);

    return NextResponse.json({ ok: true, metrics, summary });
  } catch (err) {
    console.error('[/api/data/observability] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to load observability data',
        metrics: [],
        summary: null,
        connectors: [],
      },
      { status: 500 },
    );
  }
}
