// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/data-export
//
// POST — export the current organization's data as a JSON download.
//
// Gathers all Prisma rows scoped to the orgId (Firm, FirmSettings, Client,
// Invoice, ZohoCustomer, ZohoInvoice, ZohoPaymentReceived, ZohoBankAccount,
// AuditLog) and returns them as a single JSON blob. Real data, no mock.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const actorHeader = request.headers.get('x-gstpilot-actor');
    let userId: string | null = null;
    if (actorHeader) {
      try {
        userId = JSON.parse(actorHeader).uid ?? null;
      } catch { /* ignore */ }
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Gather everything. Each query is tenant-scoped by organizationId.
    // Use safe finds so a missing table (e.g. on a fresh org) doesn't crash.
    const [
      firm,
      firmSettings,
      clients,
      invoices,
      zohoCustomers,
      zohoInvoices,
      zohoPayments,
      zohoBankAccounts,
      zohoBankTransactions,
      auditLogs,
    ] = await Promise.all([
      db.firm.findUnique({ where: { id: organizationId } }).catch(() => null),
      db.firmSettings.findUnique({ where: { firmId: organizationId } }).catch(() => null),
      db.client.findMany({ where: { firmId: organizationId } }).catch(() => []),
      db.invoice.findMany({ where: { client: { firmId: organizationId } }, take: 500 }).catch(() => []),
      db.zohoCustomer.findMany({ where: { organizationId } }).catch(() => []),
      db.zohoInvoice.findMany({ where: { organizationId } }).catch(() => []),
      db.zohoPaymentReceived.findMany({ where: { organizationId } }).catch(() => []),
      db.zohoBankAccount.findMany({ where: { organizationId } }).catch(() => []),
      db.zohoBankTransaction.findMany({ where: { organizationId } }).catch(() => []),
      db.auditLog.findMany({ take: 200, orderBy: { timestamp: 'desc' } }).catch(() => []),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      organizationId,
      firm,
      firmSettings,
      clients,
      invoices,
      zohoCustomers,
      zohoInvoices,
      zohoPayments,
      zohoBankAccounts,
      zohoBankTransactions,
      auditLogs,
    };

    try {
      await safeAudit({
        userId,
        action: 'DATA_EXPORTED',
        entity: 'Organization',
        entityId: organizationId,
        details: `User exported organization data`,
      });
    } catch (auditErr) {
      console.warn('[/api/settings/data-export] audit write failed:', auditErr);
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="gstpilot-export-${organizationId}-${Date.now()}.json"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[/api/settings/data-export] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export data' },
      { status: 500 },
    );
  }
}
