import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isOverdue } from '@/lib/gst-utils';
import { emitGstReturnNode } from '@/lib/graph/auto-emit';
import { logActivity, getOptionalUserId } from '@/lib/activity-logger';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

// `isOverdue` is imported for re-export consumers. Unused locally.
void isOverdue;

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-tenant scoping — P3-AUTH-FIX
//
// GSTRFiling has NO direct `firmId` column — tenant scoping goes through the
// related Client.firmId (Prisma nested relation filter). This mirrors the
// sibling `/api/returns` route exactly:
//   1. requireAuth(request) → resolve caller's uid (verifies Firebase ID token)
//   2. requireOrgMembership(uid, tenantId) → verify active membership in the org
//   3. For mutations: fetch the entity → resolve its client.firmId → 404 if
//      orphan (no firm) — never reveal existence — otherwise requireOrgMembership
//      again with the entity's firmId before mutating.
//
// Before this fix, GET built `where.client = { organizationId }` from a
// spoofable query param with NO auth check, and POST/PATCH/DELETE had no auth
// at all — anyone knowing a clientId could read/write any tenant's filings.
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    // Accept either organizationId (modern) or firmId (legacy) — same tenant id.
    const tenantId = searchParams.get('organizationId') || searchParams.get('firmId');

    // ── Defensive empty-state: no tenant scope → no data ──
    if (!tenantId) {
      return NextResponse.json({ filings: [] });
    }

    // ── 2. AUTHORIZATION — verify org membership for the requested tenant ──
    const memberResult = await requireOrgMembership(uid, tenantId);
    if (memberResult instanceof NextResponse) return memberResult;

    // Build tenant-scoped where clause via the related Client.firmId.
    // GSTRFiling has NO direct firmId column — scope through client.firmId.
    const where: Record<string, unknown> = { client: { firmId: tenantId } };
    if (clientId) where.clientId = clientId;

    const filings = await db.gSTRFiling.findMany({
      where,
      include: {
        client: true,
        events: {
          orderBy: { timestamp: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ filings });
  } catch (error) {
    console.error('GET /api/gstr-filing error:', error);
    return friendlyApiError(error, 'We could not load your GSTR filings right now. Please try again.');
  }
}

export async function POST(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = await request.json();
    const { clientId, returnType, period, financialYear, organizationId } = body;

    if (!clientId || !returnType || !period) {
      return NextResponse.json(
        { error: 'clientId, returnType, and period are required' },
        { status: 400 }
      );
    }

    // ── 2. AUTHORIZATION — verify org membership before creating ──────────
    // Accept either organizationId (modern) or firmId (legacy) — same tenant id.
    const tenantId =
      (typeof organizationId === 'string' && organizationId.trim()) ||
      (typeof body.firmId === 'string' && body.firmId.trim()) ||
      null;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'organizationId (or firmId) is required' },
        { status: 400 }
      );
    }
    const memberResult = await requireOrgMembership(uid, tenantId);
    if (memberResult instanceof NextResponse) return memberResult;

    // Verify the target client belongs to the caller's org (prevents cross-tenant
    // filing creation via a spoofed clientId). Mirrors /api/returns POST pattern.
    const client = await db.client.findFirst({
      where: { id: clientId, firmId: tenantId },
      select: { id: true, tradeName: true, legalName: true, gstin: true },
    });
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found in this organization', code: 'CLIENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if a filing already exists for this client + returnType + period
    const existing = await db.gSTRFiling.findFirst({
      where: {
        clientId,
        returnType,
        period,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A filing already exists for this client, return type, and period', filing: existing },
        { status: 409 }
      );
    }

    // Count invoices for this client and period
    const invoiceCount = await db.invoice.count({
      where: {
        clientId,
        period,
      },
    });

    const totalTaxable = await db.invoice.aggregate({
      where: { clientId, period },
      _sum: { taxableValue: true },
    });

    const totalTax = await db.invoice.aggregate({
      where: { clientId, period },
      _sum: { cgst: true, sgst: true, igst: true, cess: true },
    });

    const taxSum =
      (totalTax._sum.cgst ?? 0) +
      (totalTax._sum.sgst ?? 0) +
      (totalTax._sum.igst ?? 0) +
      (totalTax._sum.cess ?? 0);

    const filing = await db.gSTRFiling.create({
      data: {
        clientId,
        returnType,
        period,
        financialYear: financialYear ?? null,
        status: 'draft',
        totalInvoices: invoiceCount,
        readyForFiling: 0,
        issuesFound: 0,
        criticalErrors: 0,
        warnings: 0,
        totalTaxableValue: totalTaxable._sum.taxableValue ?? 0,
        totalTax: taxSum,
      },
      include: {
        client: true,
      },
    });

    // Create filing event
    await db.filingEvent.create({
      data: {
        filingId: filing.id,
        clientId,
        eventType: 'data_imported',
        description: `New ${returnType} filing created for period ${period}`,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId,
        action: 'Filing Created',
        entity: 'gstr_filing',
        entityId: filing.id,
        details: `New ${returnType} filing created for period ${period}`,
      },
    });

    // PT-2-b: canonical graph node emit — auto-create gst-return node + Client→Filing edge
    try { await emitGstReturnNode(filing.id); } catch (e) { console.error('[graph] emitGstReturnNode failed', e); }

    // Business Timeline event — "GST return created"
    // Org id is the verified tenantId (not the spoofable body param).
    const resolvedOrgId: string = tenantId;

    const userId = await getOptionalUserId(request);
    const clientName =
      filing.client?.tradeName ?? filing.client?.legalName ?? 'Unknown client';
    await logActivity({
      organizationId: resolvedOrgId,
      userId,
      type: 'gst_return_created',
      title: 'GST Return Created',
      description: `${returnType} for period ${period} created for ${clientName} — ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'}, ₹${Number(totalTaxable._sum.taxableValue ?? 0).toLocaleString('en-IN')} taxable, ₹${taxSum.toLocaleString('en-IN')} tax.`,
      entityType: 'gstr_filing',
      entityId: filing.id,
      clientId,
      metadata: {
        returnType,
        period,
        invoiceCount,
        totalTaxableValue: Number(totalTaxable._sum.taxableValue ?? 0),
        totalTax: taxSum,
        status: 'draft',
      },
    });

    // ── Business Timeline — emit return.created (fire-and-forget) ──
    await emitTimelineEvent({
      organizationId: resolvedOrgId,
      type: 'return.created',
      title: `GST Return ${returnType} created`,
      description: `${returnType} for period ${period} created for ${clientName} — ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'}, ₹${taxSum.toLocaleString('en-IN')} tax.`,
      actor: userId ? { userId } : undefined,
      metadata: {
        filingId: filing.id,
        returnType,
        period,
        financialYear: financialYear ?? null,
        clientId,
        clientName,
        invoiceCount,
        totalTaxableValue: Number(totalTaxable._sum.taxableValue ?? 0),
        totalTax: taxSum,
        status: 'draft',
      },
      severity: 'info',
    });

    return NextResponse.json({ filing }, { status: 201 });
  } catch (error) {
    console.error('POST /api/gstr-filing error:', error);
    return friendlyApiError(error, 'We could not create the filing right now. Please try again.');
  }
}

// PATCH /api/gstr-filing — Update a filing's status or details
export async function PATCH(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = await request.json();
    const { id, status, readyForFiling, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Filing id is required' },
        { status: 400 }
      );
    }

    const existing = await db.gSTRFiling.findUnique({
      where: { id },
      include: { client: true },
    });

    // ── 2. AUTHORIZATION — verify org membership for the filing's tenant ──
    // GSTRFiling has no firmId; resolve through the related Client. Return
    // 404 (not 403) for orphan filings to avoid leaking their existence.
    const firmId = existing?.client?.firmId;
    if (!firmId) {
      return NextResponse.json({ error: 'Filing not found' }, { status: 404 });
    }
    const memberResult = await requireOrgMembership(uid, firmId);
    if (memberResult instanceof NextResponse) return memberResult;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (status !== undefined) {
      // Validate status transitions
      const validStatuses = ['draft', 'ready', 'review', 'approved', 'filed'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.status = status;

      // Create filing event for status change
      await db.filingEvent.create({
        data: {
          filingId: id,
          clientId: existing.clientId,
          eventType: `status_changed_to_${status}`,
          description: `Filing status changed from "${existing.status}" to "${status}"`,
        },
      });
    }

    if (readyForFiling !== undefined) {
      updateData.readyForFiling = readyForFiling;
    }

    // Apply any other allowed updates
    const allowedFields = [
      'totalInvoices', 'issuesFound', 'criticalErrors', 'warnings',
      'totalTaxableValue', 'totalTax', 'financialYear',
    ];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    // Remove fields that shouldn't be directly updated
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const filing = await db.gSTRFiling.update({
      where: { id },
      data: updateData,
      include: { client: true },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId: existing.clientId,
        action: 'Filing Updated',
        entity: 'gstr_filing',
        entityId: id,
        oldValue: existing.status,
        newValue: status ?? existing.status,
        details: `${filing.returnType} for period ${filing.period} updated for ${filing.client.tradeName}`,
      },
    });

    return NextResponse.json({ filing });
  } catch (error) {
    console.error('PATCH /api/gstr-filing error:', error);
    return friendlyApiError(error, 'We could not update the filing right now. Please try again.');
  }
}

// DELETE /api/gstr-filing — Delete a filing
export async function DELETE(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Filing id is required' },
        { status: 400 }
      );
    }

    const existing = await db.gSTRFiling.findUnique({
      where: { id },
      include: { client: true },
    });

    // ── 2. AUTHORIZATION — verify org membership for the filing's tenant ──
    // 404 (not 403) for orphan filings to avoid leaking existence.
    const firmId = existing?.client?.firmId;
    if (!firmId) {
      return NextResponse.json({ error: 'Filing not found' }, { status: 404 });
    }
    const memberResult = await requireOrgMembership(uid, firmId);
    if (memberResult instanceof NextResponse) return memberResult;

    if (existing!.status === 'filed') {
      return NextResponse.json(
        { error: 'Cannot delete a filed return' },
        { status: 400 }
      );
    }

    // Create audit log before deletion
    await db.auditLog.create({
      data: {
        clientId: existing!.clientId,
        action: 'Filing Deleted',
        entity: 'gstr_filing',
        entityId: id,
        details: `${existing!.returnType} for period ${existing!.period} deleted for ${existing!.client.tradeName}`,
      },
    });

    await db.gSTRFiling.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/gstr-filing error:', error);
    return friendlyApiError(error, 'We could not delete the filing right now. Please try again.');
  }
}
