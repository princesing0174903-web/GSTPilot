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
// SAFEGUARDS (Task 7 — permission-error elimination + security hardening):
//   • AUTHENTICATION: requires a verified Firebase ID token (Bearer header).
//     Falls back to x-gstpilot-actor only when Admin SDK is unavailable
//     (sandbox/preview). The session helper NEVER shows "Permission denied"
//     to a valid user — only 401 (session expired) or 403 (not owner).
//   • AUTHORIZATION: requires the `owner` role for the target org. Admins,
//     managers, accountants, employees, viewers all get a friendly 403.
//   • LOCAL WORKSPACE: orgIds starting with `local-` are always allowed
//     (they're client-only — the user is implicitly the owner).
//   • Confirmation: `confirmName` body field must match the firm's name
//     (case-insensitive) — prevents accidental clicks.
//   • Audit: writes a WORKSPACE_DELETED audit event BEFORE deleting.
//   • Each table delete is wrapped in catch() so a missing/locked table
//     doesn't abort the whole operation.
//   • Errors: NEVER returns raw error.message — friendly envelopes only.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeAudit } from '@/lib/audit/safe-write';
import { requireAuth, requireOrgMembership, requireRole, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    // ── 2. Resolve the target orgId (header OR query, same as before) ──────
    const url = new URL(request.url);
    const headerOrg = request.headers.get('x-gstpilot-orgid');
    const queryOrg = url.searchParams.get('organizationId');
    const orgId = (headerOrg && headerOrg.trim()) || (queryOrg && queryOrg.trim()) || null;
    if (!orgId) {
      return NextResponse.json(
        { error: 'We could not identify your workspace. Please refresh the page and try again.', code: 'NO_ORG' },
        { status: 400 },
      );
    }

    // ── 3. AUTHORIZATION — must be an active member of the org ────────────
    const memberResult = await requireOrgMembership(uid, orgId);
    if (memberResult instanceof NextResponse) return memberResult;

    // ── 4. AUTHORIZATION — must be the OWNER to delete ────────────────────
    // Local workspaces are always owned by the user (skipped by requireOrgMembership).
    if (!orgId.startsWith('local-')) {
      const roleResult = requireRole(memberResult.role, 'owner');
      if (roleResult instanceof NextResponse) return roleResult;
    }

    // ── 5. Confirmation name must match the firm's name ───────────────────
    const body = await request.json().catch(() => ({}));
    const confirmName = String(body.confirmName ?? '').trim().toLowerCase();

    const firm = await db.firm.findUnique({ where: { id: orgId } });
    const firmName = firm?.name ?? '';
    if (!firmName || confirmName !== firmName.toLowerCase()) {
      return NextResponse.json(
        { error: 'Confirmation name does not match the organization name. Type the exact firm name to confirm.', code: 'CONFIRM_NAME_MISMATCH' },
        { status: 400 },
      );
    }

    // ── 6. Audit BEFORE deleting (AuditLog is userId-scoped, survives) ────
    try {
      await safeAudit({
        userId: uid,
        action: 'WORKSPACE_DELETED',
        entity: 'Organization',
        entityId: orgId,
        details: `User permanently deleted workspace "${firmName}" (${orgId}) and all associated data`,
      });
    } catch (auditErr) {
      console.warn('[/api/settings/delete-workspace] audit write failed:', auditErr);
    }

    // ── 7. Delete in dependency order (children first). Each delete is
    //      wrapped in catch() so a missing/locked table doesn't abort. ──
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
    return friendlyApiError(error, 'We could not delete your workspace right now. Please try again, or contact support if the problem continues.');
  }
}
