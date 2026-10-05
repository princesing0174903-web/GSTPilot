// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Communication Execute API (the ACT step)
//
// POST /api/oracle/cfo/communicate/execute
//
// Input:  { intent, organizationId, firmId, userId, userEmail, userRole,
//           sellerName, sellerEmail }
// Output: { success, message, communicationId, emailDelivery, whatsappDelivery,
//           recordsAffected, rollbackStatus, durationMs }
//
// Called after the CA approves the communication. This endpoint:
//   1. Re-validates the recipient + providers (state may have changed)
//   2. Regenerates the message + attachments
//   3. Sends via email (if channel includes email + provider connected)
//   4. Sends via WhatsApp (if channel includes whatsapp + provider connected)
//   5. Persists notification records with REAL provider message IDs + status
//   6. Writes activity + audit logs
//   7. Returns the full delivery result
//
// NEVER fakes a successful send. If the provider is not connected or the API
// call fails, the response clearly explains what happened.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import {
  executeCommunication,
  type CommunicationIntent,
} from '@/lib/oracle-cfo/communication-engine';
import { writeCfoAudit } from '@/lib/oracle-cfo/approval';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  const startedAt = Date.now();
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const intent = body.intent as CommunicationIntent | undefined;
  if (!intent) {
    return NextResponse.json({ error: 'intent is required (from the create step)' }, { status: 400 });
  }

  const ctx = {
    organizationId: String(body.organizationId ?? 'preview-org'),
    firmId: body.firmId ? String(body.firmId) : null,
    userId: String(body.userId ?? 'preview-user'),
    userEmail: String(body.userEmail ?? 'preview@gstpilot.in'),
    userRole: (body.userRole as string) ?? 'manager',
  };

  const orgId0 = String(body.organizationId ?? body.orgId ?? body.firmId ?? '');
  const orgResult = await requireOrgMembership(uid, orgId0);
  if (orgResult instanceof NextResponse) return orgResult;

  const sellerName: string = String(body.sellerName ?? 'GSTPilot');
  const sellerEmail: string = String(body.sellerEmail ?? 'noreply@gstpilot.in');

  try {
    const result = await executeCommunication({
      organizationId: ctx.organizationId,
      firmId: ctx.firmId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      intent,
      sellerName,
      sellerEmail,
    });

    // Audit the execute attempt (success or failure)
    await writeCfoAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      toolId: 'send-communication',
      toolName: 'Send Communication',
      category: 'communication',
      action: 'execute',
      status: result.success ? 'success' : 'failed',
      input: {
        channel: intent.channel,
        messageType: intent.messageType,
        recipient: intent.recipientName ?? intent.recipientEmail ?? intent.recipientPhone,
        invoiceNumber: intent.invoiceNumber,
        reportId: intent.reportId,
      },
      recordsAffected: result.recordsAffected,
      decisionCard: {
        success: result.success,
        communicationId: result.communicationId,
        emailSent: result.emailDelivery.sent,
        emailStatus: result.emailDelivery.status,
        emailProviderMessageId: result.emailDelivery.providerMessageId,
        whatsappSent: result.whatsappDelivery.sent,
        whatsappStatus: result.whatsappDelivery.status,
        whatsappProviderMessageId: result.whatsappDelivery.providerMessageId,
        rollbackStatus: result.rollbackStatus,
      },
      aiProvider: 'communication-engine',
      executionMs: Date.now() - startedAt,
    }).catch(() => {});

    return NextResponse.json({
      ...result,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        message: `Communication execution failed: ${msg}`,
        communicationId: null,
        emailDelivery: { sent: false, status: 'failed', providerMessageId: null, provider: null, message: 'Execution failed.', retryable: false },
        whatsappDelivery: { sent: false, status: 'failed', providerMessageId: null, provider: null, message: 'Execution failed.', retryable: false },
        recordsAffected: [],
        rollbackStatus: 'not-needed',
        error: msg,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
