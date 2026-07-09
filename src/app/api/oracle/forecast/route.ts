// GET /api/oracle/forecast — Financial Forecasting Engine
// Returns 30/90/365-day forecasts for 8 financial metrics with confidence.
import { NextResponse } from 'next/server';
import { generateForecasts } from '@/lib/oracle-evolution/forecasting';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const bundle = await generateForecasts();
    return NextResponse.json(bundle);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
