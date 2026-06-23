// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/data-quality?userId=<firebase_uid>
// Runs data quality checks + returns the report.
// POST /api/data-quality?userId=<firebase_uid>
// Runs checks + persists alerts to the database.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { runDataQualityChecks, persistQualityAlerts } from '@/lib/data-quality/engine';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const report = await runDataQualityChecks(userId);
    return NextResponse.json(report);
  } catch (err) {
    console.error('[Data Quality] Error:', err);
    return NextResponse.json({ error: 'Failed to run data quality checks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const report = await runDataQualityChecks(userId);
    await persistQualityAlerts(report.alerts);
    return NextResponse.json({ ...report, persisted: true });
  } catch (err) {
    console.error('[Data Quality] Persist error:', err);
    return NextResponse.json({ error: 'Failed to persist quality alerts' }, { status: 500 });
  }
}
