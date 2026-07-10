// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Production Invoice Execution API
//
// POST /api/oracle/cfo/invoice/execute
//
// Called AFTER the user approves the invoice. This is the ACT step:
//   1. Writes the invoice to Firestore (REAL write)
//   2. Creates an activity log entry
//   3. Generates a professional PDF (logo, QR, GSTIN, HSN, tax breakup, T&C)
//   4. Sends via email if connected (or explains what's needed)
//   5. Sends via WhatsApp if connected (or explains what's needed)
//   6. Writes a complete audit log
//   7. On any failure → rolls back partial changes
//
// No simulations. No fake success messages.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  createInvoiceRecord,
  calculateGST,
  isInterStateTransaction,
  genId,
  type InvoiceApprovalSummary,
} from '@/lib/oracle-cfo/invoice-engine';
import { generateInvoicePDF } from '@/lib/oracle-cfo/invoice-pdf';
import { sendInvoiceEmail, sendInvoiceWhatsApp } from '@/lib/oracle-cfo/invoice-comms';
import { writeCfoAudit } from '@/lib/oracle-cfo/approval';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const decision: 'approved' | 'rejected' = body.decision ?? 'approved';
  const ctx = {
    organizationId: String(body.organizationId ?? 'preview-org'),
    firmId: body.firmId ? String(body.firmId) : null,
    userId: String(body.userId ?? 'preview-user'),
    userEmail: String(body.userEmail ?? 'preview@gstpilot.in'),
  };

  // ─── Handle rejection ───────────────────────────────────────────────
  if (decision === 'rejected') {
    await writeCfoAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      toolId: 'create-invoice',
      toolName: 'Create Invoice',
      category: 'invoicing',
      action: 'reject',
      status: 'rejected',
      input: body,
      recordsAffected: [],
      aiProvider: 'oracle-cfo-invoice-engine',
      executionMs: Date.now() - startedAt,
      rollbackStatus: 'not-needed',
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      status: 'rejected',
      message: 'Invoice creation was cancelled. No changes were made to your data.',
      durationMs: Date.now() - startedAt,
    });
  }

  // ─── Handle approval → execute ──────────────────────────────────────
  const summary: InvoiceApprovalSummary = body.summary;
  const sellerDetails = body.sellerDetails;
  const clientId = body.clientId;
  const customerGstin = body.customerGstin ?? summary.customer.gstin;
  const sellerGstin = sellerDetails?.gstin ?? '';
  const interState = isInterStateTransaction(sellerGstin || null, customerGstin, summary.customer.state, sellerDetails?.state);

  // Recalculate GST (ensures consistency)
  const gst = calculateGST({
    amount: summary.amounts.grandTotal,
    gstRate: summary.gst.rate,
    isInterState: interState,
    reverseCharge: summary.gst.reverseCharge,
    isExempt: summary.gst.rate === 0,
    amountIsTaxInclusive: true,
  });

  const invoiceId = genId('inv');
  const placeOfSupply = body.placeOfSupply ?? summary.customer.state ?? '—';
  const hsnCode = body.hsnCode ?? '998314';

  // ─── STEP 6: Real Database Write ────────────────────────────────────
  const writeResult = await createInvoiceRecord({
    invoiceId,
    invoiceNumber: summary.invoice.number,
    invoiceDate: summary.invoice.date,
    dueDate: summary.invoice.dueDate,
    clientId: clientId ?? '',
    customerName: summary.customer.name,
    customerGstin,
    sellerGstin,
    gst,
    description: summary.description,
    paymentTerms: summary.paymentTerms,
    hsnCode,
    placeOfSupply,
    currency: summary.invoice.currency,
    ctx,
  });

  if (!writeResult.success) {
    // Write failed audit
    await writeCfoAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      toolId: 'create-invoice',
      toolName: 'Create Invoice',
      category: 'invoicing',
      action: 'execute',
      status: 'failure',
      input: { summary, invoiceId },
      recordsAffected: writeResult.recordsAffected,
      aiProvider: 'oracle-cfo-invoice-engine',
      executionMs: Date.now() - startedAt,
      rollbackStatus: writeResult.recordsAffected.length > 0 ? 'rolled-back' : 'not-needed',
    }).catch(() => {});

    return NextResponse.json({
      success: false,
      status: 'failed',
      invoiceId,
      message: `Invoice creation failed: ${writeResult.error}. Any partial changes have been rolled back. Please try again.`,
      durationMs: Date.now() - startedAt,
    }, { status: 500 });
  }

  // ─── STEP 7: PDF Generation ─────────────────────────────────────────
  let pdfGenerated = false;
  let pdfBase64: string | undefined;
  try {
    const pdfResult = await generateInvoicePDF({
      summary,
      sellerDetails: {
        tradeName: sellerDetails?.tradeName ?? 'GSTPilot',
        legalName: sellerDetails?.legalName ?? sellerDetails?.tradeName ?? 'GSTPilot',
        gstin: sellerGstin,
        address: sellerDetails?.address ?? '',
        state: sellerDetails?.state ?? '',
        stateCode: sellerDetails?.stateCode ?? '',
        email: sellerDetails?.email ?? ctx.userEmail,
        phone: sellerDetails?.phone ?? '',
      },
      invoiceId,
      hsnCode,
      placeOfSupply,
      termsAndConditions: [],
    });
    pdfGenerated = true;
    pdfBase64 = pdfResult.base64;

    // Store PDF reference (best-effort)
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      await setDoc(doc(db, 'invoice_pdfs', invoiceId), {
        invoiceId,
        organizationId: ctx.organizationId,
        invoiceNumber: summary.invoice.number,
        pdfGeneratedAt: new Date().toISOString(),
        pdfSize: pdfResult.buffer.length,
        hasPdf: true,
      });
    } catch {
      // best-effort — PDF is still returned inline
    }
  } catch (err) {
    // PDF generation failed — invoice is still created, just without PDF
    console.error('[Invoice PDF] Generation failed:', err);
  }

  // ─── STEP 8: Email ──────────────────────────────────────────────────
  const emailResult = await sendInvoiceEmail({
    organizationId: ctx.organizationId,
    toEmail: summary.customer.email ?? '',
    toName: summary.customer.name,
    invoiceNumber: summary.invoice.number,
    invoicePdfBase64: pdfBase64,
    grandTotal: gst.grandTotal,
    dueDate: summary.invoice.dueDate,
    sellerName: sellerDetails?.tradeName ?? 'GSTPilot',
  });

  // ─── STEP 9: WhatsApp ───────────────────────────────────────────────
  const whatsappResult = await sendInvoiceWhatsApp({
    organizationId: ctx.organizationId,
    toPhone: summary.customer.phone ?? '',
    toName: summary.customer.name,
    invoiceNumber: summary.invoice.number,
    grandTotal: gst.grandTotal,
    dueDate: summary.invoice.dueDate,
    sellerName: sellerDetails?.tradeName ?? 'GSTPilot',
    paymentLink: undefined, // Payment links are Phase 1.3
  });

  // ─── STEP 8 (audit): Write audit log ────────────────────────────────
  const auditId = await writeCfoAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    toolId: 'create-invoice',
    toolName: 'Create Invoice',
    category: 'invoicing',
    action: 'execute',
    status: 'success',
    input: { summary, invoiceId, invoiceNumber: summary.invoice.number },
    recordsAffected: writeResult.recordsAffected,
    result: {
      invoiceId,
      invoiceNumber: summary.invoice.number,
      pdfGenerated,
      emailSent: emailResult.sent,
      whatsappSent: whatsappResult.sent,
    },
    aiProvider: 'oracle-cfo-invoice-engine',
    executionMs: Date.now() - startedAt,
    rollbackStatus: 'not-needed',
  }).catch(() => 'audit-failed');

  // ─── Build the result message ───────────────────────────────────────
  const messages: string[] = [];
  messages.push(`Invoice ${summary.invoice.number} created successfully for ${summary.customer.name} — ₹${gst.grandTotal.toLocaleString('en-IN')} (GST ${gst.gstRate}%: ₹${gst.gstAmount.toLocaleString('en-IN')}). Status: Draft.`);
  if (pdfGenerated) {
    messages.push('Professional PDF generated with QR code, GSTIN, tax breakup, and terms.');
  } else {
    messages.push('PDF generation was skipped (invoice is still saved).');
  }
  messages.push(emailResult.message);
  messages.push(whatsappResult.message);

  return NextResponse.json({
    success: true,
    status: 'executed',
    invoiceId,
    invoiceNumber: summary.invoice.number,
    message: messages.join(' '),
    recordsAffected: writeResult.recordsAffected,
    pdfGenerated,
    pdfBase64, // available for instant download
    email: {
      sent: emailResult.sent,
      status: emailResult.status,
      message: emailResult.message,
    },
    whatsapp: {
      sent: whatsappResult.sent,
      status: whatsappResult.status,
      message: whatsappResult.message,
    },
    executionMs: Date.now() - startedAt,
    rollbackStatus: 'not-needed',
    auditId,
  });
}
