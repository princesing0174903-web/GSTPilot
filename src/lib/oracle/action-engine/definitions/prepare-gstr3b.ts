// ═══════════════════════════════════════════════════════════════════════════════
// Action: Prepare GSTR-3B
// ═══════════════════════════════════════════════════════════════════════════════
//
// Calls the canonical GSTN module (`prepareGstr3b` from @/lib/gstn/gstr3b) so
// the action performs the EXACT same GSTR-3B draft computation + GSTReturn
// upsert as the Returns page. Output tax, ITC, interest, late fee and net
// liability come from real GSTR-1 / GSTR-2B data (or deterministic fallbacks
// inside the lib when no filings exist yet).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { prepareGstr3b } from '@/lib/gstn/gstr3b';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import {
  registerAction,
  inr,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;

export const prepareGstr3bAction: OracleAction = {
  name: 'prepareGstr3b',
  displayName: 'Prepare GSTR-3B',
  description: 'Prepare a GSTR-3B return draft for a given period. Pulls output tax from GSTR-1, ITC from GSTR-2B, computes interest + late fee, and persists a GSTReturn row.',
  category: 'compliance',
  icon: 'ClipboardCheck',
  intentKeywords: [
    'prepare gstr-3b', 'gstr3b', '3b return', 'prepare 3b', 'file 3b', 'gstr 3b',
  ],
  paramSchema: [
    { key: 'period', label: 'Period', type: 'string', required: true, description: 'YYYY-MM e.g. 2024-01' },
    { key: 'gstin', label: 'GSTIN', type: 'string', required: false, description: 'Your GSTIN; if omitted, uses the org\'s first client\'s seller GSTIN' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Period ──
    const period = String(args.period ?? '').trim();
    if (!period) {
      fields.push({ key: 'period', label: 'Period', status: 'error', message: 'Period is required (YYYY-MM)' });
      errors.push('Period is required. Use YYYY-MM format, e.g. 2024-01.');
    } else if (!/^\d{4}-\d{2}$/.test(period)) {
      fields.push({ key: 'period', label: 'Period', status: 'error', message: 'Use YYYY-MM format', resolvedValue: period });
      errors.push(`Invalid period "${period}". Use YYYY-MM format (e.g. 2024-01).`);
    } else {
      const [yr, mo] = period.split('-').map(Number);
      if (mo < 1 || mo > 12) {
        fields.push({ key: 'period', label: 'Period', status: 'error', message: 'Month must be 01-12', resolvedValue: period });
        errors.push(`Invalid month "${mo}" in period "${period}".`);
      } else {
        fields.push({ key: 'period', label: 'Period', status: 'ok', resolvedValue: period });
        resolvedRefs.period = period;
      }
    }

    // ── GSTIN (derive from latest invoice if missing) ──
    let gstin = String(args.gstin ?? '').trim().toUpperCase();
    if (!gstin) {
      const inv = await db.invoice.findFirst({
        where: { client: { firmId: orgId } },
        orderBy: { createdAt: 'desc' },
        select: { sellerGstin: true },
      }).catch(() => null);
      if (inv?.sellerGstin) {
        gstin = inv.sellerGstin;
        fields.push({ key: 'gstin', label: 'GSTIN', status: 'ok', message: 'Resolved from latest invoice', resolvedValue: gstin });
        resolvedRefs.gstin = gstin;
      } else {
        fields.push({ key: 'gstin', label: 'GSTIN', status: 'error', message: 'No GSTIN found — please provide your GSTIN' });
        errors.push('No GSTIN found — please provide your GSTIN.');
      }
    } else if (!GSTIN_REGEX.test(gstin)) {
      fields.push({ key: 'gstin', label: 'GSTIN', status: 'error', message: 'Does not match GSTIN format', resolvedValue: gstin });
      errors.push(`GSTIN "${gstin}" does not match the standard 15-character format.`);
    } else {
      fields.push({ key: 'gstin', label: 'GSTIN', status: 'ok', resolvedValue: gstin });
      resolvedRefs.gstin = gstin;
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const period = refs.period ?? args.period ?? '—';
    const gstin = refs.gstin ?? (args.gstin ? String(args.gstin).toUpperCase() : '—');
    return {
      title: `Prepare GSTR-3B for ${period}`,
      fields: [
        { label: 'Period', value: period, emphasize: true },
        { label: 'GSTIN', value: gstin, emphasize: true },
      ],
      note: 'Pulls output tax from GSTR-1 + ITC from GSTR-2B (or deterministic fallbacks), computes interest + late fee, and saves a GSTReturn draft. Actual filing with GSTN is a separate step.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const period = String(args.period ?? '').trim();
    const gstin = String(args.gstin ?? '').trim().toUpperCase()
      || await db.invoice.findFirst({
        where: { client: { firmId: orgId } },
        orderBy: { createdAt: 'desc' },
        select: { sellerGstin: true },
      }).then((r) => r?.sellerGstin ?? '').catch(() => '');

    if (!gstin) {
      return { ok: false, summary: 'Failed to prepare GSTR-3B — no GSTIN resolved. Please provide your GSTIN.' };
    }
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return { ok: false, summary: `Failed to prepare GSTR-3B — invalid period "${period}". Use YYYY-MM format.` };
    }

    let draft;
    try {
      draft = await prepareGstr3b(gstin, period);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, summary: `Failed to prepare GSTR-3B for ${period}: ${msg}` };
    }

    await logActivity(orgId, 'gst', `Prepared GSTR-3B for ${period} (GSTIN ${gstin}): output tax ${inr(draft.outputTax)}, ITC ${inr(draft.itcClaimed)}, net liability ${inr(draft.netTaxPayable)}.`, {
      gstin, period,
      outputTax: draft.outputTax,
      itcClaimed: draft.itcClaimed,
      netTaxPayable: draft.netTaxPayable,
      interest: draft.interest,
      lateFee: draft.lateFee,
      totalLiability: draft.totalLiability,
    });

    await emitTimelineEvent({
      organizationId: orgId,
      type: 'gst.gstr3b_prepared',
      title: `GSTR-3B prepared for ${period}`,
      description: `Output tax ${inr(draft.outputTax)}, ITC ${inr(draft.itcClaimed)}, net liability ${inr(draft.netTaxPayable)}.`,
      severity: 'info',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: { gstin, period, netTaxPayable: draft.netTaxPayable, totalLiability: draft.totalLiability },
    });

    return {
      ok: true,
      summary: `✅ Prepared GSTR-3B for ${period}: output tax ${inr(draft.outputTax)}, ITC ${inr(draft.itcClaimed)}, net liability ${inr(draft.netTaxPayable)}.`,
      data: {
        gstin, period,
        outputTax: draft.outputTax,
        itcClaimed: draft.itcClaimed,
        netTaxPayable: draft.netTaxPayable,
        interest: draft.interest,
        lateFee: draft.lateFee,
        totalLiability: draft.totalLiability,
      },
      artifacts: [{
        kind: 'table',
        title: `GSTR-3B Breakdown — ${period}`,
        columns: ['Component', 'Amount'],
        rows: [
          { Component: 'Output Tax (3.1)', Amount: inr(draft.outputTax) },
          { Component: 'ITC Claimed (4)', Amount: inr(draft.itcClaimed) },
          { Component: 'Net Tax Payable (5.1)', Amount: inr(draft.netTaxPayable) },
          { Component: 'Interest', Amount: inr(draft.interest) },
          { Component: 'Late Fee', Amount: inr(draft.lateFee) },
          { Component: 'Total Liability', Amount: inr(draft.totalLiability) },
        ],
      }],
      viewIn: { label: 'View in Returns', href: '/returns' },
    };
  },
};

registerAction(prepareGstr3bAction);
