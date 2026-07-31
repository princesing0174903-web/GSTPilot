import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// POST /api/invoices/pdf
// Body: { id: string }
// Returns: { success, invoice, html, paymentLink }
//
// Generates a self-contained A4 HTML invoice document (for print/PDF preview)
// scoped to the caller's org. The HTML is rendered into an iframe or a new
// window on the client, where the user can print or "Save as PDF" via the
// browser's native dialog.
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = (await req.json()) as { id: string };
    if (!body.id) {
      return NextResponse.json({ error: 'Invoice id is required' }, { status: 400 });
    }

    const invoice = await db.invoice.findUnique({
      where: { id: body.id },
      include: {
        client: true,
        items: { orderBy: { lineNumber: 'asc' } },
      },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Tenant scope check.
    const memberResult = await requireOrgMembership(uid, invoice.client.firmId ?? '');
    if (memberResult instanceof NextResponse) return memberResult;

    // Mark as sent if it was a draft.
    const updated = await db.invoice.update({
      where: { id: body.id },
      data: {
        sentToCustomer: true,
        sentAt: new Date().toISOString(),
        status: invoice.status === 'draft' ? 'sent' : invoice.status,
      },
    });

    await db.auditLog.create({
      data: {
        clientId: invoice.clientId,
        action: 'Invoice PDF Generated',
        entity: 'invoice',
        entityId: invoice.id,
        details: `PDF generated for invoice ${invoice.invoiceNumber}`,
      },
    });

    const html = buildInvoiceHtml(updated, invoice.client, invoice.items);
    const paymentLink = `upi://pay?pa=business@upi&pn=${encodeURIComponent(invoice.client.tradeName)}&tr=${invoice.invoiceNumber}&am=${updated.totalAmount}&cu=INR`;

    return NextResponse.json({
      success: true,
      invoice: updated,
      html,
      paymentLink,
      message: `Generated the PDF and payment link for Invoice ${invoice.invoiceNumber}.`,
    });
  } catch (err) {
    console.error('[API /invoices/pdf] error:', err);
    return friendlyApiError(err, 'We could not generate the PDF right now. Please try again.');
  }
}

// ─── A4 HTML builder ───────────────────────────────────────────────────────
// Self-contained: inline CSS, no external fonts. Designed for print at A4.
function buildInvoiceHtml(
  inv: {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | null;
    sellerGstin: string;
    buyerGstin: string | null;
    buyerName: string | null;
    invoiceType: string;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    notes: string | null;
  },
  client: { tradeName: string; legalName: string | null; gstin: string; state: string | null; stateCode: string | null; address: string | null; contactEmail: string | null; contactPhone: string | null } | null,
  items: Array<{
    description: string | null;
    hsnCode: string | null;
    quantity: number;
    unit: string | null;
    unitPrice: number;
    taxableValue: number;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
    cessRate: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    totalAmount: number;
  }>,
): string {
  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
  const fmtDate = (s: string | null) => {
    if (!s) return '';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const rows = items.length > 0 ? items : [{
    description: 'Aggregated taxable supply',
    hsnCode: null,
    quantity: 1,
    unit: 'NOS',
    unitPrice: inv.taxableValue,
    taxableValue: inv.taxableValue,
    cgstRate: 0, sgstRate: 0, igstRate: 0, cessRate: 0,
    cgst: inv.cgst, sgst: inv.sgst, igst: inv.igst, cess: inv.cess,
    totalAmount: inv.totalAmount,
  }];
  const sellerName = client?.tradeName ?? 'Your Business';
  const isInter = inv.igst > 0;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${inv.invoiceNumber}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 12px; }
  .wrap { max-width: 800px; margin: 0 auto; padding: 8px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 18px; border-bottom: 2px solid #0f172a; margin-bottom: 18px; }
  .brand { font-size: 22px; font-weight: 700; color: #0f172a; }
  .brand-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
  .inv-meta { text-align: right; }
  .inv-title { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a; }
  .inv-no { font-size: 12px; color: #475569; margin-top: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
  .box h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin: 0 0 8px; }
  .box p { margin: 2px 0; line-height: 1.5; }
  .box .name { font-weight: 700; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  thead th { background: #0f172a; color: #fff; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  tbody td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-left: auto; width: 320px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; }
  .totals .row.grand { border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 10px; font-weight: 700; font-size: 14px; }
  .notes { margin-top: 24px; padding: 12px 14px; background: #f8fafc; border-left: 3px solid #0f172a; font-size: 11px; color: #334155; }
  .foot { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
  .pay { margin-top: 18px; padding: 12px 14px; background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; font-size: 11px; }
  .pay strong { color: #047857; }
</style></head><body><div class="wrap">
  <div class="head">
    <div>
      <div class="brand">${escapeHtml(sellerName)}</div>
      <div class="brand-sub">GSTIN: ${escapeHtml(inv.sellerGstin || '—')}</div>
      ${client?.address ? `<div class="brand-sub">${escapeHtml(client.address)}</div>` : ''}
      ${client?.contactEmail ? `<div class="brand-sub">${escapeHtml(client.contactEmail)}${client.contactPhone ? ' · ' + escapeHtml(client.contactPhone) : ''}</div>` : ''}
    </div>
    <div class="inv-meta">
      <div class="inv-title">INVOICE</div>
      <div class="inv-no">No: <strong>${escapeHtml(inv.invoiceNumber)}</strong></div>
      <div class="inv-no">Date: ${escapeHtml(fmtDate(inv.invoiceDate))}</div>
      ${inv.dueDate ? `<div class="inv-no">Due: ${escapeHtml(fmtDate(inv.dueDate))}</div>` : ''}
      <div class="inv-no">Type: ${escapeHtml(inv.invoiceType)}</div>
    </div>
  </div>
  <div class="grid">
    <div class="box">
      <h4>Bill To</h4>
      <p class="name">${escapeHtml(inv.buyerName || client?.tradeName || 'Customer')}</p>
      ${inv.buyerGstin ? `<p>GSTIN: ${escapeHtml(inv.buyerGstin)}</p>` : ''}
      ${client?.state ? `<p>${escapeHtml(client.state)}${client.stateCode ? ' (' + escapeHtml(client.stateCode) + ')' : ''}</p>` : ''}
      ${client?.contactEmail ? `<p>${escapeHtml(client.contactEmail)}</p>` : ''}
      ${client?.contactPhone ? `<p>${escapeHtml(client.contactPhone)}</p>` : ''}
    </div>
    <div class="box">
      <h4>Payment Details</h4>
      <p><strong>Total:</strong> ₹${fmt(inv.totalAmount)}</p>
      <p><strong>Paid:</strong> ₹${fmt(inv.paidAmount)}</p>
      <p><strong>Balance Due:</strong> ₹${fmt(inv.balanceAmount)}</p>
      ${inv.dueDate ? `<p><strong>Due Date:</strong> ${escapeHtml(fmtDate(inv.dueDate))}</p>` : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Description</th>
        <th>HSN</th>
        <th class="num">Qty</th>
        <th class="num">Rate</th>
        <th class="num">Taxable</th>
        ${isInter ? '<th class="num">IGST</th>' : '<th class="num">CGST</th><th class="num">SGST</th>'}
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((it, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(it.description || '—')}</td>
          <td>${escapeHtml(it.hsnCode || '—')}</td>
          <td class="num">${fmt(it.quantity)} ${escapeHtml(it.unit || '')}</td>
          <td class="num">₹${fmt(it.unitPrice)}</td>
          <td class="num">₹${fmt(it.taxableValue)}</td>
          ${isInter
            ? `<td class="num">${fmt(it.igst)}</td>`
            : `<td class="num">${fmt(it.cgst)}</td><td class="num">${fmt(it.sgst)}</td>`}
          <td class="num">₹${fmt(it.totalAmount)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>₹${fmt(inv.taxableValue)}</span></div>
    ${inv.cgst > 0 ? `<div class="row"><span>CGST</span><span>₹${fmt(inv.cgst)}</span></div>` : ''}
    ${inv.sgst > 0 ? `<div class="row"><span>SGST</span><span>₹${fmt(inv.sgst)}</span></div>` : ''}
    ${inv.igst > 0 ? `<div class="row"><span>IGST</span><span>₹${fmt(inv.igst)}</span></div>` : ''}
    ${inv.cess > 0 ? `<div class="row"><span>CESS</span><span>₹${fmt(inv.cess)}</span></div>` : ''}
    <div class="row grand"><span>Total Payable</span><span>₹${fmt(inv.totalAmount)}</span></div>
  </div>
  ${inv.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(inv.notes)}</div>` : ''}
  <div class="pay"><strong>UPI:</strong> business@upi · Ref: ${escapeHtml(inv.invoiceNumber)} · Amt: ₹${fmt(inv.totalAmount)}</div>
  <div class="foot">This is a computer-generated invoice and does not require a physical signature. · Generated by GSTPilot</div>
</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
