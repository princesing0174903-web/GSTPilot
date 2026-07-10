// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ABOS™ — POST /api/abos/predict
// Fetch a focused prediction for a single metric + horizon from the Prediction Lab™.
// Body: { metric?: PredictionMetric; horizon?: PredictionHorizon }
// Returns: { matrix, reading, spokenAck }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getAbosState } from '@/lib/abos/engine';
import { HORIZON_LABEL } from '@/lib/abos/types';
import type { PredictionHorizon, PredictionMetric } from '@/lib/abos/types';

function inrShort(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export async function POST(request: Request) {
  let body: { metric?: string; horizon?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  try {
    const state = await getAbosState(null);
    const metric = body.metric as PredictionMetric | undefined;
    const horizon = (body.horizon ?? '30d') as PredictionHorizon;
    const matrix = metric
      ? state.predictions.find((p) => p.metric === metric)
      : state.predictions[0];
    if (!matrix) {
      return NextResponse.json({ error: 'Metric not found' }, { status: 404 });
    }
    const reading = matrix.horizons[horizon] ?? matrix.horizons['30d'];
    const valStr = matrix.unit === 'INR' ? inrShort(reading.value) : `${reading.value}${matrix.unit === 'pct' ? '%' : ''}`;
    const spokenAck = `I've generated the ${matrix.label} prediction for ${HORIZON_LABEL[horizon]}: ${valStr} (${reading.confidencePct}% confidence). ${reading.note}`;
    return NextResponse.json({ ok: true, matrix, reading, horizon, spokenAck });
  } catch (err) {
    console.error('[/api/abos/predict] error:', err);
    return NextResponse.json(
      { error: 'Prediction failed', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
