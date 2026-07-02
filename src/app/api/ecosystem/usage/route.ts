// GET /api/ecosystem/usage
// Observability: real API usage analytics (today/7d/30d, per-endpoint, per-status,
// per-day, top keys, plugin usage, marketplace revenue, SDK activity).

import { NextResponse } from 'next/server';
import { getObservabilitySummary } from '@/lib/ecosystem/observability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const summary = await getObservabilitySummary();
    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Ecosystem': 'true' },
    });
  } catch (error) {
    console.error('[Ecosystem usage] Error:', error);
    return NextResponse.json(
      { error: 'Failed to compute observability', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
