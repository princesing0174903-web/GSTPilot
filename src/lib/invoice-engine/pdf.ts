// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — PDF / Printable Invoice Generator
//
// Generates a self-contained, print-ready HTML invoice. The HTML uses
// inline styles (no external CSS) so it renders identically when opened in a
// new tab or piped through a headless browser to produce a PDF.
//
// The layout is a professional Indian tax invoice:
//   • Seller header (name, GSTIN, address)
//   • Invoice meta (number, dates, status)
//   • Customer block (name, GSTIN, address)
//   • Line-items table (HSN, qty, rate, discount, taxable, CGST, SGST, IGST, amount)
//   · Totals block (subtotal, discount, taxable, CGST, SGST, IGST, CESS, round-off, grand total)
//   • QR placeholder (visual square — no third-party QR lib)
//   • Notes + terms
//   • Footer (thank-you + generated timestamp)
// ═══════════════════════════════════════════════════════════════════════════════

import type { Invoice } from './types';
import { formatInvoiceCurrencyDetailed } from './calculations';

/**
 * Generate a complete HTML document for a single invoice.
 * The returned string can be:
 *   • written to a new tab via `window.open()` + `document.write()`
 *   • returned from an API route with `Content-Type: text/html`
 *   • passed to a headless browser to produce a PDF
 */
export function generateInvoiceHTML(invoice: Invoice): string {
  const fmt = (n: number) => formatInvoiceCurrencyDetailed(n);
  const statusLabel = invoice.status.replace(/_/g, ' ').toUpperCase();
  const generatedAt = new Date().toLocaleString('en-IN');

  const itemsRows = invoice.items
    .map(
      (it, idx) => `
        <tr>
          <td class="num">${idx + 1}</td>
          <td>${escapeHtml(it.description)}</td>
          <td class="center">${escapeHtml(it.hsnSac)}</td>
          <td class="num">${it.quantity}</td>
          <td class="center">${escapeHtml(it.unit)}</td>
          <td class="num">${fmt(it.unitPrice)}</td>
          <td class="num">${fmt(it.discount)}</td>
          <td class="num">${fmt(it.taxableValue)}</td>
          <td class="num">${it.gstRate}%</td>
          <td class="num">${fmt(it.cgst + it.sgst + it.igst)}</td>
          <td class="num bold">${fmt(it.amount)}</td>
        </tr>`,
    )
    .join('');

  const cgstRow =
    invoice.cgst > 0
      ? totalsRow('CGST', fmt(invoice.cgst))
      : '';
  const sgstRow =
    invoice.sgst > 0
      ? totalsRow('SGST', fmt(invoice.sgst))
      : '';
  const igstRow =
    invoice.igst > 0
      ? totalsRow('IGST', fmt(invoice.igst))
      : '';
  const cessRow =
    invoice.cess > 0
      ? totalsRow('CESS', fmt(invoice.cess))
      : '';
  const roundOffRow =
    invoice.roundOff !== 0
      ? totalsRow('Round Off', fmt(invoice.roundOff))
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1e293b;
    background: #f1f5f9;
    padding: 24px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .invoice {
    max-width: 820px;
    margin: 0 auto;
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
  }
  .header {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #fff;
    padding: 32px 40px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .seller-name { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
  .seller-gstin { font-size: 13px; color: #cbd5e1; margin-bottom: 2px; }
  .seller-addr { font-size: 12px; color: #94a3b8; line-height: 1.5; }
  .invoice-badge {
    text-align: right;
  }
  .invoice-badge .label {
    font-size: 11px;
    letter-spacing: 2px;
    color: #94a3b8;
    text-transform: uppercase;
  }
  .invoice-badge .number {
    font-size: 22px;
    font-weight: 700;
    margin-top: 4px;
  }
  .status-pill {
    display: inline-block;
    margin-top: 8px;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    background: ${statusBg(invoice.status)};
    color: ${statusFg(invoice.status)};
  }
  .meta-bar {
    display: flex;
    justify-content: space-between;
    padding: 16px 40px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    font-size: 13px;
  }
  .meta-item { display: flex; gap: 8px; }
  .meta-item .k { color: #64748b; font-weight: 500; }
  .meta-item .v { color: #0f172a; font-weight: 600; }
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    padding: 28px 40px;
  }
  .party-block .role {
    font-size: 10px;
    letter-spacing: 2px;
    color: #3b82f6;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .party-block .name { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .party-block .line { font-size: 12px; color: #64748b; line-height: 1.5; }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 40px;
    width: calc(100% - 80px);
  }
  .items-table th {
    background: #0f172a;
    color: #fff;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 10px 8px;
    text-align: left;
    font-weight: 600;
  }
  .items-table td {
    padding: 10px 8px;
    font-size: 12px;
    border-bottom: 1px solid #e2e8f0;
  }
  .items-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .items-table .center { text-align: center; }
  .items-table .bold { font-weight: 700; }
  .items-table tr:nth-child(even) td { background: #f8fafc; }
  .body-section {
    padding: 24px 40px;
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 24px;
    align-items: start;
  }
  .notes-terms {
    font-size: 12px;
    color: #475569;
    line-height: 1.6;
  }
  .notes-terms h4 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #64748b;
    margin-bottom: 6px;
    margin-top: 12px;
  }
  .notes-terms h4:first-child { margin-top: 0; }
  .totals-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    padding: 6px 0;
    border-bottom: 1px solid #e2e8f0;
  }
  .totals-row:last-child { border-bottom: none; }
  .totals-row.grand {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    padding-top: 12px;
    margin-top: 6px;
    border-top: 2px solid #0f172a;
  }
  .qr-section {
    padding: 0 40px 24px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .qr-placeholder {
    width: 90px;
    height: 90px;
    background:
      linear-gradient(45deg, #0f172a 25%, transparent 25%) 0 0/18px 18px,
      linear-gradient(-45deg, #0f172a 25%, transparent 25%) 0 0/18px 18px,
      linear-gradient(45deg, transparent 75%, #0f172a 75%) 0 0/18px 18px,
      linear-gradient(-45deg, transparent 75%, #0f172a 75%) 0 0/18px 18px,
      #fff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    position: relative;
  }
  .qr-placeholder::after {
    content: 'QR';
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: #0f172a;
    background: rgba(255,255,255,0.85);
  }
  .qr-label { font-size: 10px; color: #94a3b8; margin-top: 6px; text-align: center; }
  .amount-due {
    text-align: right;
  }
  .amount-due .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
  .amount-due .value { font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 4px; }
  .footer {
    background: #0f172a;
    color: #94a3b8;
    padding: 20px 40px;
    text-align: center;
    font-size: 11px;
    line-height: 1.6;
  }
  .footer .thank { color: #fff; font-weight: 600; font-size: 13px; margin-bottom: 4px; }
  @media print {
    body { background: #fff; padding: 0; }
    .invoice { box-shadow: none; border-radius: 0; max-width: 100%; }
    .no-print { display: none !important; }
  }
  .print-btn {
    position: fixed;
    top: 16px;
    right: 16px;
    background: #0f172a;
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
  .print-btn:hover { background: #1e293b; }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="invoice">
    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="header">
      <div>
        <div class="seller-name">${escapeHtml(invoice.sellerName)}</div>
        <div class="seller-gstin">GSTIN: ${escapeHtml(invoice.sellerGstin)}</div>
        ${invoice.sellerAddress ? `<div class="seller-addr">${escapeHtml(invoice.sellerAddress)}</div>` : ''}
      </div>
      <div class="invoice-badge">
        <div class="label">Tax Invoice</div>
        <div class="number">${escapeHtml(invoice.invoiceNumber)}</div>
        <div class="status-pill">${statusLabel}</div>
      </div>
    </div>

    <!-- ── Meta bar ───────────────────────────────────────────── -->
    <div class="meta-bar">
      <div class="meta-item"><span class="k">Invoice Date:</span><span class="v">${formatDate(invoice.invoiceDate)}</span></div>
      <div class="meta-item"><span class="k">Due Date:</span><span class="v">${formatDate(invoice.dueDate)}</span></div>
      <div class="meta-item"><span class="k">Payment:</span><span class="v">${escapeHtml(invoice.paymentStatus)}</span></div>
    </div>

    <!-- ── Parties ────────────────────────────────────────────── -->
    <div class="parties">
      <div class="party-block">
        <div class="role">Billed By (Seller)</div>
        <div class="name">${escapeHtml(invoice.sellerName)}</div>
        <div class="line">GSTIN: ${escapeHtml(invoice.sellerGstin)}</div>
        ${invoice.sellerAddress ? `<div class="line">${escapeHtml(invoice.sellerAddress)}</div>` : ''}
        ${invoice.sellerStateCode ? `<div class="line">State Code: ${escapeHtml(invoice.sellerStateCode)}</div>` : ''}
      </div>
      <div class="party-block">
        <div class="role">Billed To (Customer)</div>
        <div class="name">${escapeHtml(invoice.customerName)}</div>
        ${invoice.customerGstin ? `<div class="line">GSTIN: ${escapeHtml(invoice.customerGstin)}</div>` : ''}
        ${invoice.customerAddress ? `<div class="line">${escapeHtml(invoice.customerAddress)}</div>` : ''}
        ${invoice.customerState ? `<div class="line">State: ${escapeHtml(invoice.customerState)}</div>` : ''}
        ${invoice.customerStateCode ? `<div class="line">State Code: ${escapeHtml(invoice.customerStateCode)}</div>` : ''}
      </div>
    </div>

    <!-- ── Items table ────────────────────────────────────────── -->
    <table class="items-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th>HSN/SAC</th>
          <th>Qty</th>
          <th>Unit</th>
          <th>Rate</th>
          <th>Disc</th>
          <th>Taxable</th>
          <th>GST%</th>
          <th>Tax</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows || '<tr><td colspan="11" class="center" style="padding:24px;color:#94a3b8;">No line items</td></tr>'}
      </tbody>
    </table>

    <!-- ── Body: notes/terms + totals ─────────────────────────── -->
    <div class="body-section">
      <div class="notes-terms">
        ${invoice.notes ? `<h4>Notes</h4><p>${escapeHtml(invoice.notes)}</p>` : ''}
        ${invoice.terms ? `<h4>Terms &amp; Conditions</h4><p>${escapeHtml(invoice.terms)}</p>` : ''}
        ${!invoice.notes && !invoice.terms ? '<p style="color:#94a3b8;">No notes or terms specified.</p>' : ''}
      </div>
      <div class="totals-box">
        <div class="totals-row"><span>Subtotal</span><span>${fmt(invoice.subtotal)}</span></div>
        <div class="totals-row"><span>Discount</span><span>- ${fmt(invoice.discount)}</span></div>
        <div class="totals-row"><span>Taxable Value</span><span>${fmt(invoice.taxableValue)}</span></div>
        ${cgstRow}
        ${sgstRow}
        ${igstRow}
        ${cessRow}
        ${roundOffRow}
        <div class="totals-row"><span>Paid Amount</span><span>- ${fmt(invoice.paidAmount)}</span></div>
        <div class="totals-row grand"><span>Grand Total</span><span>${fmt(invoice.grandTotal)}</span></div>
      </div>
    </div>

    <!-- ── QR + Amount Due ────────────────────────────────────── -->
    <div class="qr-section">
      <div>
        <div class="qr-placeholder"></div>
        <div class="qr-label">Scan to verify</div>
      </div>
      <div class="amount-due">
        <div class="label">Amount Due</div>
        <div class="value">${fmt(invoice.balanceDue)}</div>
      </div>
    </div>

    <!-- ── Footer ─────────────────────────────────────────────── -->
    <div class="footer">
      <div class="thank">Thank you for your business!</div>
      <div>This is a computer-generated invoice and does not require a physical signature.</div>
      <div>Generated by GSTPilot on ${generatedAt}</div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function totalsRow(label: string, value: string): string {
  return `<div class="totals-row"><span>${escapeHtml(label)}</span><span>${value}</span></div>`;
}

function statusBg(status: string): string {
  switch (status) {
    case 'paid':
      return '#dcfce7';
    case 'sent':
      return '#dbeafe';
    case 'partially_paid':
      return '#fef9c3';
    case 'overdue':
      return '#fee2e2';
    case 'cancelled':
      return '#f1f5f9';
    default:
      return '#f1f5f9';
  }
}

function statusFg(status: string): string {
  switch (status) {
    case 'paid':
      return '#166534';
    case 'sent':
      return '#1e40af';
    case 'partially_paid':
      return '#854d0e';
    case 'overdue':
      return '#991b1b';
    case 'cancelled':
      return '#475569';
    default:
      return '#475569';
  }
}
