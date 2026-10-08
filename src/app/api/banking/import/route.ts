// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Bank Statement Import API (TASK 12)
//
// GET  /api/banking/import?organizationId=...
//   → listImports(orgId)
//
// POST /api/banking/import?organizationId=...
//   multipart/form-data:
//     file:        File (.csv or .xlsx)        — required
//     accountId:   string                       — required
//     confirm:     'true' | 'false'             — optional (default 'false')
//     rows:        JSON string of ParsedStatementRow[]  — required when confirm=true
//
//   When confirm != 'true':
//     Parse the file (CSV → parseCsv, Excel → parseExcel), then return
//     previewImport(rows) so the user can review before persisting.
//
//   When confirm === 'true':
//     The client re-submits with `rows` (the parsed rows from the preview step)
//     and `confirm=true`. We then call
//     importStatement({ organizationId, accountId, fileName, fileType, fileSize,
//                       rows, uploadedBy: uid }).
//
//   The two-phase flow keeps the parser server-side (single source of truth for
//   column detection + validation), but lets the user review before commit.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import {
  parseCsv,
  parseExcel,
  previewImport,
  importStatement,
  listImports,
  type ParsedStatementRow,
} from '@/lib/banking-prisma';
import { invalidateBusinessSnapshotCache } from '@/lib/business/snapshot';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const imports = await listImports(orgId);
    return NextResponse.json({ imports });
  } catch (err) {
    return friendlyApiError(err, 'Failed to list statement imports.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const form = await req.formData();
    const accountId = String(form.get('accountId') || '').trim();
    const confirmFlag = String(form.get('confirm') || '').toLowerCase() === 'true';
    const rowsField = form.get('rows');
    const file = form.get('file');

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required.' },
        { status: 400 },
      );
    }

    // ── Phase 2: confirm === true → persist ──
    if (confirmFlag) {
      if (!rowsField) {
        return NextResponse.json(
          { error: 'rows is required when confirm=true.' },
          { status: 400 },
        );
      }
      let rows: ParsedStatementRow[];
      try {
        rows = JSON.parse(String(rowsField)) as ParsedStatementRow[];
      } catch {
        return NextResponse.json(
          { error: 'rows must be valid JSON.' },
          { status: 400 },
        );
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json(
          { error: 'rows must be a non-empty array.' },
          { status: 400 },
        );
      }

      // Use fileName/fileType/fileSize from the form if provided, else defaults.
      const fileName = String(form.get('fileName') || 're-uploaded-statement');
      const fileType = String(form.get('fileType') || 'csv');
      const fileSize = Number(form.get('fileSize') || 0) || 0;

      const result = await importStatement({
        organizationId: orgId,
        accountId,
        fileName,
        fileType,
        fileSize,
        rows,
        uploadedBy: uid,
      });
      // ── Unified SaaS: invalidate the canonical Business Snapshot cache ──
      // Bank transactions imported → cash position, cash flow, and reconciliation
      // all need recomputation.
      invalidateBusinessSnapshotCache(orgId);
      return NextResponse.json({ success: true, result }, { status: 201 });
    }

    // ── Phase 1: parse + preview ──
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'A file upload is required for preview.' },
        { status: 400 },
      );
    }

    const fileName = file.name || 'statement';
    const lower = fileName.toLowerCase();
    const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls');
    const isCsv = lower.endsWith('.csv');

    if (!isExcel && !isCsv) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a .csv or .xlsx file.' },
        { status: 400 },
      );
    }

    let rows: ParsedStatementRow[];
    if (isExcel) {
      const buffer = Buffer.from(await file.arrayBuffer());
      rows = parseExcel(buffer);
    } else {
      const text = await file.text();
      rows = parseCsv(text);
    }

    const preview = previewImport(rows);
    return NextResponse.json({
      success: true,
      phase: 'preview',
      fileName,
      fileType: isExcel ? 'xlsx' : 'csv',
      fileSize: file.size,
      rows,
      preview,
    });
  } catch (err) {
    return friendlyApiError(err, 'Failed to process bank statement import.');
  }
}
