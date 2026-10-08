// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ — GST Report Export API
//
// GET /api/oracle/cfo/report/export?reportId=X&format=pdf|excel|csv
//
// Loads a previously-generated GST report from Firestore (by reportId) and
// streams back the file in the requested format. Used by the CFOAssistantPanel
// "Download PDF / Excel / CSV" buttons after a generate-gst-report execution.
//
// The report payload (full structured GSTReport) is stored inside the reports
// doc as `reportPayload`, so this route just rebuilds the file from that
// payload — no re-computation, no fake numbers.
//
// If the report can't be loaded from Firestore (preview mode / not found),
// the route accepts a POST body with the inline `reportPayload` so the user
// can still download the report from the in-memory result of the just-run
// generate-gst-report tool.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { loadGSTReport } from '@/lib/oracle-cfo/gst-report-engine';
import {
  generateGSTReportPDF,
  generateGSTReportExcel,
  generateGSTReportCSV,
} from '@/lib/oracle-cfo/gst-report-export';
import type { GSTReport } from '@/lib/oracle-cfo/gst-report-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_FORMATS = ['pdf', 'excel', 'csv'] as const;
type ExportFormat = typeof VALID_FORMATS[number];

const MIME_TYPES: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

const FILE_EXTENSIONS: Record<ExportFormat, string> = {
  pdf: 'pdf',
  excel: 'xlsx',
  csv: 'csv',
};

export async function GET(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const startedAt = Date.now();
  const url = new URL(request.url);
  const orgId0 = url.searchParams.get('orgId') || url.searchParams.get('organizationId') || url.searchParams.get('firmId') || '';
  if (orgId0) {
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
  }

  const reportId = url.searchParams.get('reportId');
  const formatParam = (url.searchParams.get('format') ?? 'pdf').toLowerCase() as ExportFormat;

  if (!reportId) {
    return NextResponse.json(
      { error: 'reportId query parameter is required' },
      { status: 400 },
    );
  }
  if (!VALID_FORMATS.includes(formatParam)) {
    return NextResponse.json(
      { error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const report = await loadGSTReport(reportId);
    if (!report) {
      return NextResponse.json(
        {
          error: 'Report not found. It may have been generated in preview mode and not persisted. Re-run the report or pass the reportPayload via POST.',
          reportId,
          durationMs: Date.now() - startedAt,
        },
        { status: 404 },
      );
    }
    return await streamReport(report, formatParam);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to export report. The error has been logged.',
        detail: msg,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const url = new URL(request.url);
  const orgId0 = url.searchParams.get('orgId') || url.searchParams.get('organizationId') || url.searchParams.get('firmId') || '';
  if (orgId0) {
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
  }

  const startedAt = Date.now();
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const reportPayload = body.reportPayload as GSTReport | undefined;
  const formatParam = (String(body.format ?? 'pdf')).toLowerCase() as ExportFormat;

  if (!reportPayload) {
    return NextResponse.json(
      { error: 'reportPayload is required in POST body' },
      { status: 400 },
    );
  }
  if (!VALID_FORMATS.includes(formatParam)) {
    return NextResponse.json(
      { error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    return await streamReport(reportPayload, formatParam);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to export report. The error has been logged.',
        detail: msg,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

async function streamReport(report: GSTReport, format: ExportFormat) {
  let buffer: Buffer;
  try {
    if (format === 'pdf') {
      const { buffer: b } = await generateGSTReportPDF(report);
      buffer = b;
    } else if (format === 'excel') {
      const { buffer: b } = await generateGSTReportExcel(report);
      buffer = b;
    } else {
      const { buffer: b } = generateGSTReportCSV(report);
      buffer = b;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        error: `Failed to generate ${format.toUpperCase()} file. The error has been logged.`,
        detail: msg,
      },
      { status: 500 },
    );
  }

  const periodSlug = report.intent.periodKey.replace(/[^a-zA-Z0-9-]/g, '-');
  const typeSlug = report.intent.reportType.replace(/[^a-zA-Z0-9-]/g, '-');
  const filename = `GST-${typeSlug}-${periodSlug}.${FILE_EXTENSIONS[format]}`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': MIME_TYPES[format],
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Report-Id': report.reportId,
    },
  });
}
