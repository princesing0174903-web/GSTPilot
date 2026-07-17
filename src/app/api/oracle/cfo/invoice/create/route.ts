// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Production Invoice Creation API
//
// POST /api/oracle/cfo/invoice/create
//
// The REAL invoice creation flow. When a CA types:
//   "Create an invoice for ABC Pvt Ltd worth ₹50,000 at 18% GST"
//
// This endpoint:
//   1. Extracts ALL 9 fields from the message (customer, GSTIN, amount, rate,
//      due date, invoice date, description, payment terms, currency)
//   2. Looks up the customer in the REAL database (fuzzy match, no duplicates)
//   3. If multiple match → returns alternatives for user selection
//   4. If none match → returns "needs creation" status
//   5. Calculates GST correctly (CGST+SGST intra-state, IGST inter-state)
//   6. Generates a unique invoice number (INV-2026-000231)
//   7. Returns the full approval summary for the user to review
//
// No execution happens here — that's the /execute endpoint (after approval).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  extractInvoiceIntent,
  lookupCustomer,
  calculateGST,
  isInterStateTransaction,
  generateInvoiceNumber,
  buildApprovalSummary,
} from '@/lib/oracle-cfo/invoice-engine';
import { checkEmailIntegration, checkWhatsAppIntegration } from '@/lib/oracle-cfo/invoice-comms';
import { writeCfoAudit } from '@/lib/oracle-cfo/approval';
import { getDocs, query, where, collection, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS, type FirestoreClient } from '@/lib/firestore-schema';
import { logActivity } from '@/lib/activity-logger';

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

  const message: string = body.message || '';
  if (!message || message.trim().length < 3) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const ctx = {
    organizationId: String(body.organizationId ?? 'preview-org'),
    firmId: body.firmId ? String(body.firmId) : null,
    userId: String(body.userId ?? 'preview-user'),
    userEmail: String(body.userEmail ?? 'preview@gstpilot.in'),
    userRole: (body.userRole as string) ?? 'manager',
  };

  try {
    // ─── STEP 1: Extract all 9 fields from the message ──────────────────
    const intent = extractInvoiceIntent(message);

    // ─── STEP 2: Customer lookup ────────────────────────────────────────
    let customerLookup = null;
    let matchedClient: FirestoreClient | null = null;
    let needsCustomerSelection = false;
    let needsCustomerCreation = false;
    let customerAlternatives: FirestoreClient[] = [];

    if (intent.customerName || intent.customerGstin) {
      customerLookup = await lookupCustomer(
        intent.customerName ?? '',
        intent.customerGstin,
        ctx.organizationId,
      );
      matchedClient = customerLookup.matched;
      needsCustomerSelection = customerLookup.needsSelection;
      needsCustomerCreation = customerLookup.needsCreation;
      customerAlternatives = customerLookup.alternatives;
    }

    // ─── If customer needs selection or creation, return early ─────────
    if (needsCustomerSelection || needsCustomerCreation || (!matchedClient && intent.customerName)) {
      const response: any = {
        step: 'customer-required',
        intent,
        customerLookup: {
          matched: matchedClient ? serializeClient(matchedClient) : null,
          alternatives: customerAlternatives.map(serializeClient),
          needsSelection: needsCustomerSelection,
          needsCreation: needsCustomerCreation || (!matchedClient && !needsCustomerSelection),
        },
        message: needsCustomerSelection
          ? `I found ${customerAlternatives.length} clients matching "${intent.customerName}". Please select the correct one:`
          : `No existing client matches "${intent.customerName}". Would you like to create a new client, or try a different name?`,
        durationMs: Date.now() - startedAt,
      };

      // Write audit
      await writeCfoAudit({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        toolId: 'create-invoice',
        toolName: 'Create Invoice',
        category: 'invoicing',
        action: 'analyze',
        status: 'pending',
        input: { message, intent },
        recordsAffected: [],
        aiProvider: 'oracle-cfo-invoice-engine',
        executionMs: Date.now() - startedAt,
      }).catch(() => {});

      return NextResponse.json(response);
    }

    // ─── If essential fields are missing, return early (ask for them) ───
    if (intent.missingFields.includes('amount')) {
      return NextResponse.json({
        step: 'missing-fields',
        intent,
        missingFields: intent.missingFields,
        message: 'I need the invoice amount to proceed. Please specify the amount, e.g., "₹50,000" or "50000 rupees".',
        durationMs: Date.now() - startedAt,
      });
    }

    if (intent.missingFields.includes('customerName') && !matchedClient) {
      return NextResponse.json({
        step: 'missing-fields',
        intent,
        missingFields: intent.missingFields,
        message: 'I need to know which customer this invoice is for. Please specify the customer name or GSTIN, e.g., "Create an invoice for ABC Pvt Ltd worth ₹50,000".',
        durationMs: Date.now() - startedAt,
      });
    }

    // ─── STEP 3: GST Calculation ───────────────────────────────────────
    // Determine seller GSTIN (from org's GST profile or firm)
    let sellerGstin = body.sellerGstin ?? '';
    let sellerState = body.sellerState ?? null;
    let sellerStateCode = body.sellerStateCode ?? null;
    try {
      const gstQ = query(
        collection(db, COLLECTIONS.GST_PROFILES),
        where('organizationId', '==', ctx.organizationId),
        limit(1),
      );
      const gstSnap = await getDocs(gstQ);
      if (!gstSnap.empty) {
        const profile = gstSnap.docs[0].data() as any;
        sellerGstin = sellerGstin || profile.gstin || '';
        sellerState = sellerState || profile.state || null;
        sellerStateCode = sellerStateCode || (profile.gstin ? profile.gstin.slice(0, 2) : null);
      }
    } catch {
      // preview mode — no GST profile
    }

    const buyerGstin = intent.customerGstin ?? matchedClient?.gstin ?? null;
    const buyerState = matchedClient?.state ?? null;
    const interState = isInterStateTransaction(sellerGstin || null, buyerGstin, buyerState, sellerState);

    const gst = calculateGST({
      amount: intent.amount!,
      gstRate: intent.gstRate!,
      isInterState: interState,
      reverseCharge: false,
      isExempt: intent.gstRate === 0,
      amountIsTaxInclusive: true, // "₹50,000 at 18% GST" means tax-inclusive
    });

    // ─── STEP 4: Generate invoice number ───────────────────────────────
    const invoiceNumberResult = await generateInvoiceNumber(ctx.organizationId);

    // ─── STEP 5: Build approval summary ────────────────────────────────
    const customerForSummary = matchedClient
      ? matchedClient
      : {
          tradeName: intent.customerName!,
          gstin: intent.customerGstin,
          contactEmail: null as string | null,
          contactPhone: null as string | null,
          state: null as string | null,
        };

    const summary = buildApprovalSummary({
      customer: customerForSummary,
      invoiceNumber: invoiceNumberResult.invoiceNumber,
      invoiceDate: intent.invoiceDate!,
      dueDate: intent.dueDate!,
      gst,
      description: intent.description,
      paymentTerms: intent.paymentTerms,
      hsnCode: '998314', // Default: professional services
      currency: intent.currency,
    });

    // ─── Check email + WhatsApp integration status ─────────────────────
    const [emailIntegration, whatsappIntegration] = await Promise.all([
      checkEmailIntegration(ctx.organizationId),
      checkWhatsAppIntegration(ctx.organizationId),
    ]);

    // ─── Generate approval ID ──────────────────────────────────────────
    const approvalId = `inv_appr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // ─── Write audit ───────────────────────────────────────────────────
    await writeCfoAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      toolId: 'create-invoice',
      toolName: 'Create Invoice',
      category: 'invoicing',
      action: 'analyze',
      status: 'pending',
      input: {
        message,
        intent,
        invoiceNumber: invoiceNumberResult.invoiceNumber,
        gst,
        matchedClientId: matchedClient?.clientId ?? null,
      },
      recordsAffected: [],
      aiProvider: 'oracle-cfo-invoice-engine',
      executionMs: Date.now() - startedAt,
    }).catch(() => {});

    // ─── Business Timeline event — "Invoice Created" ──────────────────
    // Logged when Oracle finishes analyzing the natural-language request
    // and produces the invoice approval summary (step==='review'). The
    // actual DB write happens in /api/oracle/cfo/invoice/execute after the
    // user approves — but from the user's perspective, Oracle has "created"
    // the invoice at this point. The description reflects that this is a
    // draft awaiting approval.
    await logActivity({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      type: 'invoice_created',
      title: 'Invoice Created',
      description: `Invoice ${invoiceNumberResult.invoiceNumber} prepared for ${summary.customer.name} — ₹${gst.grandTotal.toLocaleString('en-IN')} (incl. GST ${intent.gstRate}%). Awaiting your approval.`,
      entityType: 'invoice',
      entityId: approvalId,
      clientId: matchedClient?.clientId ?? null,
      metadata: {
        invoiceNumber: invoiceNumberResult.invoiceNumber,
        customerName: summary.customer.name,
        customerGstin: customerGstin ?? null,
        grandTotal: gst.grandTotal,
        gstRate: intent.gstRate ?? 0,
        gstAmount: gst.gstAmount,
        taxableValue: gst.taxableValue,
        isInterState: interState,
        currency: summary.invoice.currency,
        source: 'oracle-cfo',
      },
    });

    // ─── Return the full approval summary ──────────────────────────────
    return NextResponse.json({
      step: 'review',
      approvalId,
      intent,
      customer: matchedClient ? serializeClient(matchedClient) : {
        name: intent.customerName,
        gstin: intent.customerGstin,
        email: null,
        phone: null,
        state: null,
        isNew: true,
      },
      invoiceNumber: invoiceNumberResult,
      gst,
      summary,
      seller: {
        gstin: sellerGstin,
        state: sellerState,
        stateCode: sellerStateCode,
      },
      integrations: {
        email: emailIntegration,
        whatsapp: whatsappIntegration,
      },
      placeOfSupply: matchedClient?.state ?? sellerState ?? '—',
      hsnCode: '998314',
      message: `Invoice ready for review. ${matchedClient ? `Customer: ${matchedClient.tradeName}. ` : ''}Amount: ₹${gst.grandTotal.toLocaleString('en-IN')} (incl. GST ${intent.gstRate}%). Invoice #: ${invoiceNumberResult.invoiceNumber}. Review and approve to create.`,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Invoice creation analysis failed. Please try rephrasing your request.',
        detail: msg,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

function serializeClient(c: FirestoreClient) {
  return {
    id: c.clientId,
    name: c.tradeName,
    legalName: c.legalName,
    gstin: c.gstin,
    email: c.contactEmail,
    phone: c.contactPhone,
    state: c.state,
    stateCode: c.stateCode,
    entityType: c.entityType,
    isNew: false,
  };
}
