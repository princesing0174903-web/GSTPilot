// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Phase 3: Invoice Extraction API
//
// POST /api/invoices/extract
//
// Receives a base64 data URL (image or PDF) that the client already uploaded
// to Firebase Storage, runs Gemini/VLM extraction, and returns the structured
// invoice JSON + confidence + processing time + model name.
//
// This route does NOT touch Firestore. Customer/product matching and duplicate
// detection happen client-side against the live onSnapshot collections.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import { extractInvoiceFromDataUrl } from '@/lib/gstpilot-data/invoice-extraction';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90; // VLM can take 10–40s on multi-page documents.

interface ExtractRequestBody {
  dataUrl: string;
  mimeType: string;
  fileName?: string;
  storageUrl?: string;
}

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

export async function POST(req: NextRequest) {
  try {
    // ── Auth: this is a stateless VLM call (no DB write), but the
    // extraction service is metered + returns business data, so we still
    // require a verified caller. ──
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = (await req.json()) as ExtractRequestBody;

    if (!body.dataUrl || !body.mimeType) {
      return NextResponse.json(
        { ok: false, error: 'dataUrl and mimeType are required.' },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME.has(body.mimeType)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unsupported file type: ${body.mimeType}. Only PDF, JPG, JPEG, PNG are accepted.`,
        },
        { status: 400 },
      );
    }

    const prefix = `data:${body.mimeType};base64,`;
    if (!body.dataUrl.startsWith(prefix) && !body.dataUrl.startsWith('data:')) {
      return NextResponse.json(
        { ok: false, error: 'dataUrl must be a base64 data URL (data:<mime>;base64,...).' },
        { status: 400 },
      );
    }

    const result = await extractInvoiceFromDataUrl(body.dataUrl, body.mimeType);

    return NextResponse.json({
      ok: result.ok,
      extracted: result.extracted,
      confidence: result.confidence,
      model: result.model,
      processingTimeMs: result.processingTimeMs,
      notes: result.notes,
      fileName: body.fileName ?? null,
      storageUrl: body.storageUrl ?? null,
      error: result.error,
    });
  } catch (err) {
    return friendlyApiError(err, 'We could not analyze this invoice. Please ensure the document is clear and try again.');
  }
}
