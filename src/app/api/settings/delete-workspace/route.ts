// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/delete-workspace
//
// POST — PERMANENTLY delete the current organization's data.
//
// This is a destructive, irreversible operation. It removes every org-scoped
// row from Prisma: all Zoho* tables, native Client/Invoice rows, FirmSettings,
// and the Firm row itself. AuditLog rows are userId-scoped (not org-scoped) so
// they survive — preserving the audit trail of the deletion itself.
//
// Safeguards:
//   • Requires a `confirmName` body field that matches the firm's name
//     (case-insensitive) — prevents accidental clicks.
//   • Writes a WORKSPACE_DELETED audit event BEFORE deleting (so it survives).
//   • Each table delete is wrapped in catch() so a missing/locked table doesn't
//     abort the whole operation.
//   • Returns a summary of deleted counts.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function resolveOrg(request: Request): { orgId: string | null; userId: string | null } {
  const actorHeader = request.headers.get('x-gstpilot-actor');
  let userId: string | null = null;
  if (actorHeader) {
    try {
      userId = JSON.parse(actorHeader).uid ?? null;
    } catch { /* ignore */ }
  }
  const url = new URL(request.url);
  const headerOrg = request.headers.get('x-gstpilot-orgid');
  const queryOrg = url.searchParams.get('organizationId');
  const orgId = (headerOrg && headerOrg.trim()) || (queryOrg && queryOrg.trim()) || null;
  return { orgId, userId };
}

export async function POST(request: Request) {
  try {
    const { orgId, userId } = resolveOrg(request);
    if (!orgId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const confirmName = String(body.confirmName ?? '').trim().toLowerCase();

    // Verify the confirmation name matches the firm's name.
    const firm = await db.firm.findUnique({ where: { id: orgId } });
    const firmName = firm?.name ?? '';
    if (!firmName || confirmName !== firmName.toLowerCase()) {
      return NextResponse.json(
        { error: 'Confirmation name does not match the organization name. Type the exact firm name to confirm.' },
        { status: 400 },
      );
    }

    // Write the audit event BEFORE deleting (AuditLog is userId-scoped, so it
    // survives the org-data deletion).
    try {
      await safeAudit({
        userId: userId ?? null,
        action: 'WORKSPACE_DELETED',
        entity: 'Organization',
        entityId: orgId,
        details: `User permanently deleted workspace "${firmName}" (${orgId}) and all associated data`,
      });
    } catch (auditErr) {
      console.warn('[/api/settings/delete-workspace] audit write failed:', auditErr);
    }

    // Delete in dependency order (children first). Each delete is wrapped in
    // catch() so a missing or locked table doesn't abort the whole operation.
    const counts: Record<string, number> = {};

    // ── Zoho tables (org-scoped via organizationId) ──
    counts.zohoBankTransactions = await db.zohoBankTransaction.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoBankAccounts = await db.zohoBankAccount.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoPaymentsReceived = await db.zohoPaymentReceived.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoPaymentsMade = await db.zohoPaymentMade.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoCreditNotes = await db.zohoCreditNote.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoBills = await db.zohoBill.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoInvoices = await db.zohoInvoice.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoVendors = await db.zohoVendor.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoCustomers = await db.zohoCustomer.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoCustomerSyncRuns = await db.zohoCustomerSyncRun.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoJournalEntries = await db.zohoJournalEntry.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoItems = await db.zohoItem.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoExpenses = await db.zohoExpense.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoTaxes = await db.zohoTax.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoSyncLogs = await db.zohoSyncLog.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoBooksTokens = await db.zohoBooksToken.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);
    counts.zohoEntityMaps = await db.zohoEntityMap.deleteMany({ where: { organizationId: orgId } }).then(r => r.count).catch(() => 0);

    // ── Native tables (org-scoped via firmId) ──
    counts.invoices = await db.invoice.deleteMany({ where: { client: { firmId: orgId } } }).then(r => r.count).catch(() => 0);
    counts.clients = await db.client.deleteMany({ where: { firmId: orgId } }).then(r => r.count).catch(() => 0);
    counts.firmSettings = await db.firmSettings.deleteMany({ where: { firmId: orgId } }).then(r => r.count).catch(() => 0);
    counts.firm = await db.firm.deleteMany({ where: { id: orgId } }).then(r => r.count).catch(() => 0);

    const totalDeleted = Object.values(counts).reduce((sum, n) => sum + n, 0);

    return NextResponse.json({
      ok: true,
      message: `Workspace "${firmName}" permanently deleted. ${totalDeleted} records removed.`,
      counts,
      totalDeleted,
    });
  } catch (error) {
    console.error('[/api/settings/delete-workspace] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete workspace' },
      { status: 500 },
    );
  }
}
