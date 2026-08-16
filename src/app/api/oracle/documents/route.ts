// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Document Intelligence API
// POST /api/oracle/documents  → multipart upload (field: "file"); extracts text +
//   summary via direct read (text-like) or VLM (PDF/image/DOCX/XLSX) and returns
//   an ExtractedDocument the chat client attaches to the next prompt.
// GET  /api/oracle/documents  → list recent documents
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { ingestDocument } from '@/lib/oracle/documents';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const url = new URL(req.url);
  const orgId0 = url.searchParams.get('orgId') || url.searchParams.get('organizationId') || url.searchParams.get('firmId') || '';
  if (orgId0) {
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
  }

  try {
    const rows = await db.oracleDocument.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        fileName: true,
        fileType: true,
        docType: true,
        status: true,
        summary: true,
        fileSize: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ ok: true, documents: rows });
  } catch {
    return NextResponse.json({ ok: false, documents: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const url = new URL(req.url);
  const orgId0 = url.searchParams.get('orgId') || url.searchParams.get('organizationId') || url.searchParams.get('firmId') || '';
  if (orgId0) {
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file required' }, { status: 400 });
    }

    // Hard size cap: 8 MB to keep VLM calls + DB sane.
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: 'File too large (max 8 MB).' },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = await ingestDocument({
      fileName: file.name,
      mimeType: file.type,
      buffer,
    });

    return NextResponse.json({
      ok: true,
      document: {
        id: doc.id,
        fileName: doc.fileName,
        docType: doc.docType,
        status: doc.extractedText ? 'ready' : 'failed',
        summary: doc.summary,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Could not process document. Please try a PDF, image, or text file.' },
      { status: 200 },
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60;
