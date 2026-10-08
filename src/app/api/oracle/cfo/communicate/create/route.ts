// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ — Communication Create API (the THINK step)
//
// POST /api/oracle/cfo/communicate/create
//
// Input:  { message, organizationId, firmId, userId, userEmail, userRole,
//           sellerName, sellerEmail }
// Output: { intent, approval, durationMs }
//
// This endpoint:
//   1. Extracts communication intent from the message (channel, type, recipient,
//      attachment, template, language)
//   2. Resolves the recipient from the REAL Firestore clients collection
//   3. Validates the recipient (email/phone format, active status, prefs)
//   4. Detects the connected email + WhatsApp providers
//   5. Generates a professional branded message (subject + text + HTML body)
//   6. Builds the full approval summary (recipient / message / attachments / provider)
//   7. Writes an "analyze" audit entry
//   8. Returns the approval summary for the CA to review
//
// No email/WhatsApp is sent here — that's the /execute endpoint (after approval).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import {
  extractCommunicationIntent,
  buildCommunicationApproval,
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

  const message: string = body.message || '';
  if (!message || message.trim().length < 3) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const ctx = {
    organizationId: String(body.organizationId ?? 'preview-org'),
    firmId: body.firmId ? String(body.firmId) : null,
    userId: String(body.userId ?? 'preview-user'),
    userEmail: String(body.userEmail ?? 'preview@veyro.com'),
    userRole: (body.userRole as string) ?? 'manager',
  };

  const orgId0 = String(body.organizationId ?? body.orgId ?? body.firmId ?? '');
  const orgResult = await requireOrgMembership(uid, orgId0);
  if (orgResult instanceof NextResponse) return orgResult;

  const sellerName: string = String(body.sellerName ?? 'VEYRO');
  const sellerEmail: string = String(body.sellerEmail ?? 'noreply@veyro.com');

  try {
    // ── 1. Extract intent ──
    const intent = extractCommunicationIntent(message);

    // ── 2-6. Build full approval summary (recipient + validation + provider + message) ──
    const approval = await buildCommunicationApproval(
      ctx.organizationId,
      intent,
      { sellerName, sellerEmail },
    );

    // ── 7. Audit ──
    await writeCfoAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      toolId: 'send-communication',
      toolName: 'Send Communication',
      category: 'communication',
      action: 'analyze',
      status: approval.canProceed ? 'pending' : 'blocked',
      input: {
        channel: intent.channel,
        messageType: intent.messageType,
        recipient: intent.recipientName ?? intent.recipientEmail ?? intent.recipientPhone,
        invoiceNumber: intent.invoiceNumber,
        reportId: intent.reportId,
        attachmentKind: intent.attachmentKind,
        missingFields: intent.missingFields,
      },
      recordsAffected: [],
      decisionCard: {
        canProceed: approval.canProceed,
        blockingReasons: approval.blockingReasons,
        warnings: approval.warnings,
        recipientFound: Boolean(approval.recipient),
        emailProviderConnected: approval.emailProvider.connected,
        whatsappProviderConnected: approval.whatsappProvider.connected,
        emailProvider: approval.emailProvider.provider,
        whatsappProvider: approval.whatsappProvider.provider,
        attachments: approval.attachments.map((a) => a.filename),
      },
      aiProvider: 'communication-engine',
      executionMs: Date.now() - startedAt,
    }).catch(() => {});

    return NextResponse.json({
      intent,
      approval,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Communication analysis failed. Please try rephrasing your request.',
        detail: msg,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
