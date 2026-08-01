import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';
import { assertInvoiceTenantAccess } from '../../_helpers';
import { isOverdue, daysToDue } from '@/lib/invoices/invoices';

export const dynamic = 'force-dynamic';

// GET /api/invoices/[id]/insights
//
// Returns deterministic, heuristic "Oracle AI" insights for a single invoice.
// NO external LLM call — every value is computed from the invoice + its line
// items + a small window of recent same-tenant invoices (for anomaly + dup
// detection). The response shape is intentionally stable so the frontend can
// render it without conditional handling.
//
// Auth + tenant-scoped via assertInvoiceTenantAccess. Always returns 200 with
// the insights object on the success path; only genuine server errors bubble
// up as a friendly 500.

interface Anomaly {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

interface DuplicateMatch {
  type: string;
  invoiceId: string;
  invoiceNumber: string;
  confidence: number;
  reason: string;
}

interface OneClickFix {
  id: string;
  label: string;
  description: string;
  endpoint: string;
  method: 'POST' | 'PATCH';
  body: Record<string, unknown>;
}

const VALID_GST_RATES = new Set([0, 5, 12, 18, 28]);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { id } = await params;

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        items: { orderBy: { lineNumber: 'asc' } },
      },
    });
    const accessErr = await assertInvoiceTenantAccess(uid, invoice);
    if (accessErr) return accessErr;

    const firmId = invoice.client?.firmId ?? '';

    // ── Fetch recent invoices (last 50, same tenant) for anomaly + dup detection ──
    const recentInvoices = firmId
      ? await db.invoice.findMany({
          where: { client: { firmId } },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            invoiceNumber: true,
            buyerName: true,
            totalAmount: true,
            createdAt: true,
          },
        })
      : [];

    const total = Number(invoice.totalAmount) || 0;
    const paid = Number(invoice.paidAmount) || 0;
    const isFullyPaid = paid >= total && total > 0;
    const buyerLabel = invoice.buyerName ?? invoice.client?.tradeName ?? 'the customer';

    // ── 1. paymentPrediction ─────────────────────────────────────────────────
    let paymentPrediction: {
      likelyPayDate: string | null;
      confidence: number;
      reasoning: string;
    };
    if (isFullyPaid) {
      paymentPrediction = {
        likelyPayDate: null,
        confidence: 1,
        reasoning: 'Already paid.',
      };
    } else if (invoice.dueDate && isOverdue(invoice.dueDate, paid, total)) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      paymentPrediction = {
        likelyPayDate: d.toISOString().split('T')[0],
        confidence: 0.6,
        reasoning:
          'Invoice is overdue. Based on typical SME collection patterns, payment is expected within 7 days of the first reminder.',
      };
    } else if (invoice.dueDate) {
      paymentPrediction = {
        likelyPayDate: invoice.dueDate,
        confidence: 0.8,
        reasoning:
          'Invoice is due on the due date. Most B2B customers settle on or just before the due date.',
      };
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      paymentPrediction = {
        likelyPayDate: d.toISOString().split('T')[0],
        confidence: 0.5,
        reasoning:
          'No due date set. Assuming net-15 from today as a conservative estimate.',
      };
    }

    // ── 2. latePaymentRisk ───────────────────────────────────────────────────
    let latePaymentRisk: {
      level: 'low' | 'medium' | 'high' | 'critical';
      score: number;
      factors: string[];
    };
    if (!isFullyPaid && invoice.dueDate && isOverdue(invoice.dueDate, paid, total)) {
      latePaymentRisk = {
        level: 'critical',
        score: 90,
        factors: [
          'Invoice is past its due date',
          `Outstanding balance: ₹${r2(invoice.balanceAmount).toFixed(2)}`,
        ],
      };
    } else if (
      !isFullyPaid &&
      invoice.dueDate &&
      daysToDue(invoice.dueDate) >= 0 &&
      daysToDue(invoice.dueDate) <= 3
    ) {
      latePaymentRisk = {
        level: 'high',
        score: 75,
        factors: [
          `Due in ${daysToDue(invoice.dueDate)} day(s)`,
          'Not yet paid',
        ],
      };
    } else if (paid > 0 && !isFullyPaid) {
      latePaymentRisk = {
        level: 'medium',
        score: 50,
        factors: [
          'Partially paid',
          `Outstanding: ₹${r2(invoice.balanceAmount).toFixed(2)}`,
        ],
      };
    } else {
      latePaymentRisk = {
        level: 'low',
        score: 15,
        factors: ['No immediate risk indicators'],
      };
    }

    // ── 3. anomalies ─────────────────────────────────────────────────────────
    const anomalies: Anomaly[] = [];

    // Unusual GST rate per line item (not in {0,5,12,18,28}).
    for (const it of invoice.items) {
      const rate = r2((Number(it.cgstRate) || 0) + (Number(it.sgstRate) || 0) + (Number(it.igstRate) || 0));
      if (!VALID_GST_RATES.has(rate)) {
        anomalies.push({
          type: 'unusual_gst_rate',
          severity: 'warning',
          message: `Line item "${it.description || '—'}" has GST rate ${rate}% — not a standard Indian slab (0/5/12/18/28).`,
        });
      }
    }

    // Rounding mismatch: |taxable + gst - total| > ₹1.
    const computedTotal = r2(Number(invoice.taxableValue) + Number(invoice.gstAmount) + Number(invoice.cess));
    if (Math.abs(computedTotal - total) > 1) {
      anomalies.push({
        type: 'rounding_mismatch',
        severity: 'warning',
        message: `Taxable + GST + CESS (₹${computedTotal.toFixed(2)}) differs from total (₹${total.toFixed(2)}) by more than ₹1.`,
      });
    }

    // Amount 3× recent average.
    if (recentInvoices.length > 0) {
      const avg =
        recentInvoices.reduce((s, i) => s + Number(i.totalAmount), 0) /
        recentInvoices.length;
      if (avg > 0 && total > avg * 3) {
        anomalies.push({
          type: 'unusual_amount',
          severity: 'info',
          message: `Invoice total (₹${total.toFixed(2)}) is ${(total / avg).toFixed(1)}× the recent tenant average (₹${avg.toFixed(2)}).`,
        });
      }
    }

    // ── 4. duplicateDetection ────────────────────────────────────────────────
    // Same buyerName + same totalAmount (within ₹1) created within 30 days. Max 3.
    const duplicateDetection: DuplicateMatch[] = [];
    if (invoice.buyerName) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      for (const other of recentInvoices) {
        if (other.id === invoice.id) continue;
        if (other.buyerName !== invoice.buyerName) continue;
        if (Math.abs(Number(other.totalAmount) - total) > 1) continue;
        if (new Date(other.createdAt) < thirtyDaysAgo) continue;
        duplicateDetection.push({
          type: 'same_buyer_same_amount',
          invoiceId: other.id,
          invoiceNumber: other.invoiceNumber,
          confidence: 0.85,
          reason: `Same buyer "${invoice.buyerName}" + same total (₹${total.toFixed(2)}) within 30 days.`,
        });
        if (duplicateDetection.length >= 3) break;
      }
    }

    // ── 5. gstMismatch ───────────────────────────────────────────────────────
    const sellerState = invoice.sellerGstin?.slice(0, 2) ?? '';
    const buyerState = invoice.buyerGstin?.slice(0, 2) ?? '';
    const isInterState = Boolean(
      sellerState && buyerState && sellerState !== buyerState,
    );
    const mismatchFactors: string[] = [];
    const taxSum = r2(
      Number(invoice.cgst) + Number(invoice.sgst) + Number(invoice.igst) + Number(invoice.cess),
    );
    if (Math.abs(taxSum - Number(invoice.gstAmount)) > 1) {
      mismatchFactors.push(
        `Sum of CGST+SGST+IGST+CESS (₹${taxSum.toFixed(2)}) ≠ gstAmount (₹${Number(invoice.gstAmount).toFixed(2)}).`,
      );
    }
    if (isInterState && (Number(invoice.cgst) > 0 || Number(invoice.sgst) > 0)) {
      mismatchFactors.push(
        `Inter-state sale (seller ${sellerState} → buyer ${buyerState}) should use IGST, but CGST/SGST are non-zero.`,
      );
    }
    if (
      !isInterState &&
      Number(invoice.igst) > 0 &&
      sellerState &&
      buyerState
    ) {
      mismatchFactors.push(
        `Intra-state sale (both ${sellerState}) should use CGST+SGST, but IGST is non-zero.`,
      );
    }
    const gstMismatch = {
      hasMismatch: mismatchFactors.length > 0,
      details:
        mismatchFactors.join(' ') ||
        'No GST composition mismatches detected.',
    };

    // ── 6. collectionSuggestion ──────────────────────────────────────────────
    let collectionSuggestion: {
      action: string;
      message: string;
      channel: 'email' | 'whatsapp' | 'call';
    };
    if (isFullyPaid) {
      collectionSuggestion = {
        action: 'send_thank_you',
        message: `Send a thank-you note to ${buyerLabel} for prompt payment.`,
        channel: 'email',
      };
    } else if (invoice.dueDate && isOverdue(invoice.dueDate, paid, total)) {
      collectionSuggestion = {
        action: 'send_whatsapp_reminder',
        message: `Invoice is overdue. Send a friendly WhatsApp reminder to ${buyerLabel} with the UPI payment link.`,
        channel: 'whatsapp',
      };
    } else if (
      invoice.dueDate &&
      daysToDue(invoice.dueDate) >= 0 &&
      daysToDue(invoice.dueDate) <= 3
    ) {
      collectionSuggestion = {
        action: 'send_predue_email',
        message: `Invoice is due in ${daysToDue(invoice.dueDate)} day(s). Send a pre-due email reminder to ${buyerLabel}.`,
        channel: 'email',
      };
    } else {
      collectionSuggestion = {
        action: 'no_action_needed',
        message: 'No collection action needed at this time.',
        channel: 'email',
      };
    }

    // ── 7. oneClickFixes ─────────────────────────────────────────────────────
    const oneClickFixes: OneClickFix[] = [];

    if (!isFullyPaid && invoice.dueDate && isOverdue(invoice.dueDate, paid, total)) {
      oneClickFixes.push({
        id: 'send-reminder',
        label: 'Send Reminder',
        description:
          'Send a payment reminder to the customer via email with the UPI payment link.',
        endpoint: '/api/invoices/send',
        method: 'POST',
        body: { id: invoice.id, channel: 'email' },
      });
    }

    if (gstMismatch.hasMismatch) {
      // Recompute the GST split from current line items based on inter/intra-state rules.
      const recalculatedItems = invoice.items.map((it) => {
        const rate =
          (Number(it.cgstRate) || 0) +
          (Number(it.sgstRate) || 0) +
          (Number(it.igstRate) || 0);
        const cgstRate = isInterState ? 0 : rate / 2;
        const sgstRate = isInterState ? 0 : rate / 2;
        const igstRate = isInterState ? rate : 0;
        return {
          description: it.description ?? undefined,
          hsnCode: it.hsnCode ?? undefined,
          quantity: it.quantity,
          unit: it.unit ?? 'NOS',
          unitPrice: it.unitPrice,
          gstRate: rate,
          cessRate: it.cessRate,
          // Hint the PATCH handler with the correct split (it recomputes from
          // gstRate anyway, but being explicit avoids any inter-state ambiguity).
          cgstRate,
          sgstRate,
          igstRate,
        };
      });
      oneClickFixes.push({
        id: 'recalculate',
        label: 'Recalculate GST',
        description:
          'Recompute CGST/SGST/IGST split from line items based on inter/intra-state rules.',
        endpoint: '/api/invoices',
        method: 'PATCH',
        body: { id: invoice.id, items: recalculatedItems },
      });
    }

    if (invoice.status === 'draft') {
      oneClickFixes.push({
        id: 'approve-send',
        label: 'Approve & Send',
        description:
          'Approve the draft and mark it as sent to the customer.',
        endpoint: '/api/invoices',
        method: 'PATCH',
        body: { id: invoice.id, status: 'sent' },
      });
    }

    return NextResponse.json({
      paymentPrediction,
      latePaymentRisk,
      anomalies,
      duplicateDetection,
      gstMismatch,
      collectionSuggestion,
      oneClickFixes,
    });
  } catch (err) {
    console.error('[API /invoices/:id/insights] error:', err);
    return friendlyApiError(
      err,
      'We could not generate insights for this invoice right now. Please try again.',
    );
  }
}
