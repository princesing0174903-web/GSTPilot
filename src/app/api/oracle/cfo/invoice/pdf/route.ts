// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ — Invoice PDF Download API
//
// GET /api/oracle/cfo/invoice/pdf?invoiceId=...
//
// Generates and returns the invoice PDF on demand. The invoice data is passed
// inline (query params / body) so this works even in preview mode where
// Firestore reads are denied.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { generateInvoicePDF } from '@/lib/oracle-cfo/invoice-pdf';
import type { InvoiceApprovalSummary } from '@/lib/oracle-cfo/invoice-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  try {
    const body = await request.json();
    const { summary, sellerDetails, invoiceId, placeOfSupply, hsnCode } = body;

    if (!summary) {
      return NextResponse.json({ error: 'summary is required' }, { status: 400 });
    }

    const result = await generateInvoicePDF({
      summary: summary as InvoiceApprovalSummary,
      sellerDetails,
      invoiceId: invoiceId ?? 'manual',
      hsnCode: hsnCode ?? '998314',
      placeOfSupply: placeOfSupply ?? '—',
      termsAndConditions: [],
    });

    return new NextResponse(Buffer.from(result.base64, 'base64'), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${(summary as InvoiceApprovalSummary).invoice.number}.pdf"`,
        'Content-Length': String(result.buffer.length),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'PDF generation failed', detail: msg },
      { status: 500 },
    );
  }
}
