// ═══════════════════════════════════════════════════════════════════════════════
// GSTN Context Block Builder — for Oracle system prompt injection.
// Reads live data from the DB (GSTProfile, GSTReturn, GSTR2BInvoice, ITCMismatch)
// and formats it into a context block that Oracle uses to answer GST questions.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

const inrShort = (n: number) => {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
};

export async function buildGstnContextBlock(): Promise<string> {
  try {
    const profiles = await db.gSTProfile.findMany({ orderBy: { updatedAt: 'desc' }, take: 5 });
    const returns = await db.gSTReturn.findMany({ orderBy: { updatedAt: 'desc' }, take: 10 });
    const mismatches = await db.iTCMismatch.findMany({ where: { status: 'open' }, orderBy: [{ severity: 'desc' }, { amount: 'desc' }], take: 10 });
    const twoBInvoices = await db.gSTR2BInvoice.count();

    if (profiles.length === 0 && returns.length === 0) {
      return `## LIVE GSTN STATE
No GSTN data downloaded yet. Encourage the user to search a GSTIN or download their GSTR-2B from the GSTN Live page. Do not fabricate GST filings, ITC amounts, or mismatch data.`;
    }

    const lines: string[] = [];
    lines.push('── LIVE GSTN STATE ──');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Connected GSTINs: ${profiles.length} · Returns on record: ${returns.length} · GSTR-2B invoices stored: ${twoBInvoices} · Open ITC mismatches: ${mismatches.length}`);
    lines.push('');

    if (profiles.length > 0) {
      lines.push('Connected GST Profiles:');
      profiles.forEach((p) => {
        lines.push(`  • ${p.gstin} — ${p.legalName}${p.tradeName ? ` (${p.tradeName})` : ''} · ${p.state} · ${p.status} · ${p.taxpayerType} · PAN ${p.pan} · synced ${p.lastSyncedAt ? new Date(p.lastSyncedAt).toISOString().slice(0, 10) : '—'}`);
      });
      lines.push('');
    }

    if (returns.length > 0) {
      lines.push('GST Returns on record:');
      returns.forEach((r) => {
        const summary = r.type === 'GSTR-2B'
          ? `${r.invoiceCount} invoices, taxable ${inrShort(r.totalTaxableValue)}, ITC ${inrShort(r.totalITC)}`
          : r.type === 'GSTR-1'
          ? `${r.invoiceCount} invoices, taxable ${inrShort(r.totalTaxableValue)}, tax ${inrShort(r.totalTax)}`
          : r.type === 'GSTR-3B'
          ? `output ${inrShort(r.totalTax)}, ITC ${inrShort(r.totalITC)}`
          : `${r.invoiceCount} records`;
        const ack = r.ackNo ? ` · ACK ${r.ackNo}` : '';
        const dt = r.filedAt ? ` · filed ${new Date(r.filedAt).toISOString().slice(0, 10)}` : r.downloadedAt ? ` · downloaded ${new Date(r.downloadedAt).toISOString().slice(0, 10)}` : '';
        lines.push(`  • ${r.type} ${r.period} [${r.status}] — ${summary}${ack}${dt}`);
      });
      lines.push('');
    }

    if (mismatches.length > 0) {
      const totalMissing = mismatches.filter((m) => m.reason === 'missing_invoice').reduce((s, m) => s + m.amount, 0);
      const totalMismatch = mismatches.filter((m) => m.reason === 'value_difference').reduce((s, m) => s + m.amount, 0);
      lines.push(`ITC Reconciliation — ${mismatches.length} open mismatches:`);
      lines.push(`  Missing ITC: ${inrShort(totalMissing)} · Mismatch value: ${inrShort(totalMismatch)}`);
      mismatches.slice(0, 5).forEach((m) => {
        lines.push(`  • [${m.severity}] ${m.reason.replace(/_/g, ' ')} — ${m.invoiceNo ?? '—'} (${m.supplierGSTIN ?? '—'}) · ${inrShort(m.amount)} · ${m.suggestion}`);
      });
      if (mismatches.length > 5) lines.push(`  ... and ${mismatches.length - 5} more.`);
      lines.push('');
    }

    lines.push('── END GSTN STATE ──');
    return lines.join('\n');
  } catch (err) {
    console.warn('[Oracle] GSTN context unavailable:', err);
    return `## LIVE GSTN STATE
The GSTN engine is not available right now. Fall back to general GST guidance without fabricating filings, ITC, or mismatch data.`;
  }
}
