// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Brain — Reports API
// GET  /api/oracle/brain/reports?firmId=...&type=daily&limit=...
// POST /api/oracle/brain/reports  { firmId, type: 'daily'|'weekly'|'monthly' }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  getReport,
  getLatestReport,
  listReports,
  getOrCreateDailyReport,
} from '@/lib/oracle/brain/reports';
import type { ReportType } from '@/lib/oracle/brain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const firmId = url.searchParams.get('firmId') || 'preview-org';
    const action = url.searchParams.get('action') || 'list';
    const type = url.searchParams.get('type') as ReportType | null;
    const period = url.searchParams.get('period');
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    let result: unknown;
    if (action === 'latest' && type) {
      result = await getLatestReport(firmId, type);
    } else if (action === 'get' && type && period) {
      result = await getReport(firmId, type, period);
    } else if (action === 'today') {
      result = await getOrCreateDailyReport(firmId);
    } else {
      result = await listReports({ firmId, type: type ?? undefined, limit });
    }
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const firmId = (body.firmId as string) || 'preview-org';
    const userId = body.userId as string | undefined;
    const type = (body.type as ReportType) || 'daily';

    let result;
    if (type === 'daily') {
      result = await generateDailyReport(firmId, userId);
    } else if (type === 'weekly') {
      result = await generateWeeklyReport(firmId, userId);
    } else if (type === 'monthly') {
      result = await generateMonthlyReport(firmId, userId, body.yearMonth as string | undefined);
    } else {
      return NextResponse.json(
        { ok: false, error: `Unknown report type: ${type}` },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
