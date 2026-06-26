import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  seedInvoices,
  calculateInvoiceTotals,
  generateInvoiceNumber,
  type InvoiceLineItem,
} from '@/lib/invoices/invoices';
import { graphEvents } from '@/lib/graph/live-update';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const period = searchParams.get('period');
    const cloud = searchParams.get('cloud') === 'true';

    // ── Invoice Cloud™ branch ────────────────────────────────────────────────
    // When cloud=true and no specific filters, return invoices with the new
    // financial fields. Falls back to seed data when the DB is empty.
    if (cloud && !clientId && !period) {
      const invoices = await db.invoice.findMany({
        orderBy: { createdAt: 'desc' },
      });
      if (!invoices || invoices.length === 0) {
        return NextResponse.json({ invoices: seedInvoices() });
      }
      return NextResponse.json({ invoices });
    }

    const where: Record<string, string> = {};
    if (clientId) where.clientId = clientId;
    if (period) where.period = period;

    const invoices = await db.invoice.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        client: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

// POST /api/invoices — Create a new invoice
// Branches on `body.cloud === true` to invoke the Invoice Cloud™ creation
// flow. When `cloud` is not set, the original GST invoice flow runs unchanged.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // ── Invoice Cloud™ branch ──────────────────────────────────────────────
    // Accepts customerName, date, dueDate, items[] (with description, hsnCode,
    // quantity, unitPrice, gstRate). Computes totals via calculateInvoiceTotals
    // and generates an invoice number when not supplied.
    if (body?.cloud === true) {
      const {
        clientId: cloudClientId,
        invoiceNumber: cloudInvoiceNumber,
        customerName,
        buyerGstin: cloudBuyerGstin,
        date,
        dueDate,
        items,
        sellerGstin: cloudSellerGstin,
        isInterState,
        notes: cloudNotes,
        recurring,
        recurringCycle,
        notesFinance,
      } = body ?? {}

      if (!customerName || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { error: 'customerName and at least one line item are required for Invoice Cloud creation' },
          { status: 400 }
        );
      }

      // Determine inter-state vs intra-state from GSTIN state codes (first 2 digits)
      // unless explicitly provided via `isInterState`.
      const sellerState = cloudSellerGstin?.slice(0, 2) ?? '';
      const buyerState = cloudBuyerGstin?.slice(0, 2) ?? '';
      const interState =
        typeof isInterState === 'boolean'
          ? isInterState
          : Boolean(sellerState && buyerState && sellerState !== buyerState);

      // Convert the API's line-item shape ({ description, quantity, unitPrice, gstRate })
      // to the engine's shape ({ taxableValue, cgstRate, sgstRate, igstRate }).
      const lineItems: InvoiceLineItem[] = items.map((it: {
        quantity?: number;
        unitPrice?: number;
        gstRate?: number;
      }) => {
        const qty = Number(it.quantity) || 0;
        const price = Number(it.unitPrice) || 0;
        const taxable = Math.round(qty * price * 100) / 100;
        const rate = Number(it.gstRate) || 0;
        return {
          taxableValue: taxable,
          cgstRate: interState ? 0 : rate / 2,
          sgstRate: interState ? 0 : rate / 2,
          igstRate: interState ? rate : 0,
        };
      });

      const totals = calculateInvoiceTotals(lineItems);

      // Generate the next invoice number if not provided
      let invoiceNumber = cloudInvoiceNumber
      if (!invoiceNumber) {
        const existing = await db.invoice.findMany({
          where: { invoiceNumber: { startsWith: `INV-${new Date().getFullYear()}-` } },
          select: { invoiceNumber: true },
        })
        invoiceNumber = generateInvoiceNumber(existing.map((i) => i.invoiceNumber))
      }

      // ── Resolve a clientId (required by the Invoice model).
      // If the caller did not supply one, fall back to the first client in the DB,
      // or auto-create a generic "Invoice Cloud Customer" client so the invoice
      // can always be persisted. This keeps the Invoice Cloud UX frictionless. ──
      let resolvedClientId = cloudClientId as string | undefined
      if (!resolvedClientId) {
        const firstClient = await db.client.findFirst({ select: { id: true } })
        if (firstClient) {
          resolvedClientId = firstClient.id
        } else {
          const created = await db.client.create({
            data: {
              gstin: `29CLOUD${Date.now().toString().slice(-6)}Z1Z5`,
              tradeName: customerName || 'Invoice Cloud Customer',
              legalName: customerName || 'Invoice Cloud Customer',
              status: 'active',
              healthScore: 100,
            },
          })
          resolvedClientId = created.id
        }
      }

      const invoice = await db.invoice.create({
        data: {
          clientId: resolvedClientId,
          invoiceNumber,
          invoiceDate: date ?? new Date().toISOString().split('T')[0],
          sellerGstin: cloudSellerGstin ?? '',
          buyerGstin: cloudBuyerGstin ?? null,
          buyerName: customerName,
          invoiceType: 'B2B',
          gstr1Section: 'b2b',
          taxableValue: totals.taxableValue,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          cess: 0,
          totalAmount: totals.totalAmount,
          hsnCode: null,
          reverseCharge: false,
          status: 'issued',
          matchStatus: 'unmatched',
          riskLevel: 'low',
          riskScore: 0,
          period: (date ?? new Date().toISOString().split('T')[0]).slice(0, 7),
          notes: cloudNotes ?? null,
          // Invoice Cloud™ financial fields
          dueDate: dueDate ?? null,
          gstAmount: totals.gstAmount,
          paidAmount: 0,
          balanceAmount: totals.totalAmount,
          paymentStatus: 'unpaid',
          recurring: Boolean(recurring),
          recurringCycle: recurringCycle ?? null,
          notesFinance: notesFinance ?? null,
          sentToCustomer: false,
        },
      });

      await db.auditLog.create({
        data: {
          clientId: resolvedClientId,
          action: 'Invoice Created',
          entity: 'invoice',
          entityId: invoice.id,
          details: `Invoice Cloud™ ${invoiceNumber} created for ${customerName} (₹${totals.totalAmount})`,
        },
      });

      return NextResponse.json({ invoice }, { status: 201 });
    }

    // ── Original GST invoice flow (unchanged) ──────────────────────────────
    const {
      clientId,
      invoiceNumber,
      invoiceDate,
      sellerGstin,
      buyerGstin,
      buyerName,
      invoiceType,
      gstr1Section,
      taxableValue,
      cgst,
      sgst,
      igst,
      cess,
      totalAmount,
      hsnCode,
      reverseCharge,
      status,
      matchStatus,
      riskLevel,
      riskScore,
      period,
      notes,
    } = body;

    if (!clientId || !invoiceNumber) {
      return NextResponse.json(
        { error: 'clientId and invoiceNumber are required' },
        { status: 400 }
      );
    }

    const invoice = await db.invoice.create({
      data: {
        clientId,
        invoiceNumber,
        invoiceDate: invoiceDate ?? new Date().toISOString().split('T')[0],
        sellerGstin: sellerGstin ?? '',
        buyerGstin: buyerGstin ?? null,
        buyerName: buyerName ?? null,
        invoiceType: invoiceType ?? 'B2B',
        gstr1Section: gstr1Section ?? 'b2b',
        taxableValue: taxableValue ?? 0,
        cgst: cgst ?? 0,
        sgst: sgst ?? 0,
        igst: igst ?? 0,
        cess: cess ?? 0,
        totalAmount: totalAmount ?? 0,
        hsnCode: hsnCode ?? null,
        reverseCharge: reverseCharge ?? false,
        status: status ?? 'draft',
        matchStatus: matchStatus ?? 'unmatched',
        riskLevel: riskLevel ?? 'low',
        riskScore: riskScore ?? 0,
        period: period ?? null,
        notes: notes ?? null,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId,
        action: 'Invoice Created',
        entity: 'invoice',
        entityId: invoice.id,
        details: `New invoice ${invoiceNumber} created for client ${clientId}`,
      },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('POST /api/invoices error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create invoice' },
      { status: 500 }
    );
  }
}

// PATCH /api/invoices — Update an existing invoice
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Invoice id is required' },
        { status: 400 }
      );
    }

    // Remove fields that shouldn't be directly updated
    delete updates.createdAt;
    delete updates.updatedAt;

    const invoice = await db.invoice.update({
      where: { id },
      data: updates,
      include: { client: true },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId: invoice.clientId,
        action: 'Invoice Updated',
        entity: 'invoice',
        entityId: invoice.id,
        details: `Invoice ${invoice.invoiceNumber} updated`,
      },
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('PATCH /api/invoices error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update invoice' },
      { status: 500 }
    );
  }
}

// DELETE /api/invoices — Delete an invoice
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Invoice id is required' },
        { status: 400 }
      );
    }

    const existing = await db.invoice.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Create audit log before deletion
    await db.auditLog.create({
      data: {
        clientId: existing.clientId,
        action: 'Invoice Deleted',
        entity: 'invoice',
        entityId: id,
        details: `Invoice ${existing.invoiceNumber} deleted for ${existing.client.tradeName}`,
      },
    });

    await db.invoice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/invoices error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete invoice' },
      { status: 500 }
    );
  }
}
