// GET /api/ecosystem/forms
// Low-Code Studio forms + recent submissions. Real schema, real counts.

import { NextResponse } from 'next/server';
import { getLowCodeSummary } from '@/lib/ecosystem/lowcode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('orgId') ?? undefined;
    const summary = await getLowCodeSummary(orgId);
    return NextResponse.json(
      {
        totalForms: summary.totalForms,
        activeForms: summary.activeForms,
        totalSubmissions: summary.totalSubmissions,
        forms: summary.forms,
        recentSubmissions: summary.recentSubmissions,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Ecosystem': 'true' } },
    );
  } catch (error) {
    console.error('[Ecosystem forms] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load low-code forms', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
