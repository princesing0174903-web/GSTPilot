import { NextResponse } from 'next/server';
import { extractBill, importBillToPurchase, type OCRInput } from '@/lib/invoices/ocr';
import {
  requireAuth,
  requireOrgMembership,
  friendlyApiError,
} from '@/lib/auth/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // ── Auth: every invoice mutation requires a verified caller. ──
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = (await req.json()) as OCRInput & {
      import?: boolean;
      organizationId?: string;
      firmId?: string;
      clientId?: string;
    };
    if (!body.fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    // ── Tenant scope: read org id from header or body, then verify membership. ──
    // If an explicit clientId is supplied we resolve its firmId from Prisma so
    // orphan-org callers (who only know the client) still pass membership.
    const headerOrg = req.headers.get('x-gstpilot-orgid') ?? '';
    let orgId = headerOrg.trim() || body.organizationId || body.firmId || '';
    if (!orgId && body.clientId) {
      try {
        const client = await db.client.findUnique({
          where: { id: body.clientId },
          select: { firmId: true },
        });
        if (client?.firmId) orgId = client.firmId;
      } catch {
        /* ignore — best-effort */
      }
    }
    if (!orgId) {
      return NextResponse.json(
        { error: 'An organization or client is required to import a bill.', code: 'NO_ORG' },
        { status: 400 },
      );
    }
    const memberResult = await requireOrgMembership(uid, orgId);
    if (memberResult instanceof NextResponse) return memberResult;

    // ── Run OCR extraction (deterministic) ──
    const ocr = await extractBill(body);

    // ── Optionally import into PurchaseBill master ──
    let imported: { billId: string; vendorId: string; created: boolean } | null = null;
    if (body.import !== false && ocr.success && ocr.totalAmount > 0) {
      try {
        imported = await importBillToPurchase(ocr);
      } catch (importErr) {
        console.warn('[API /invoices/import] bill import skipped:', importErr);
      }
    }

    return NextResponse.json({
      success: true,
      ocr,
      imported,
      message: ocr.vendorDetected
        ? `I've extracted invoice details from ${body.fileName} — vendor ${ocr.vendorName ?? 'detected'}, ${ocr.confidence} confidence, ITC ${ocr.itcEligible ? 'eligible' : 'blocked'}.`
        : `I've extracted ${ocr.confidence}-confidence details from ${body.fileName}${ocr.warnings.length ? ' — ' + ocr.warnings[0] : ''}.`,
    });
  } catch (err) {
    return friendlyApiError(err, 'We could not import this invoice. Please try again.');
  }
}
