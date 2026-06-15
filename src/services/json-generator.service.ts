/**
 * GST Return JSON Generator Service
 *
 * Generates official GST return JSON payloads compliant with the GST Portal
 * filing format. Supports GSTR-1 (outward supplies) and GSTR-3B (summary return).
 *
 * Capabilities:
 * - GSTR-1 JSON generation with B2B grouping by counterparty GSTIN
 * - GSTR-3B JSON generation with supply summaries
 * - Browser-side JSON file download
 *
 * V2 roadmap:
 * - GSTR-2 generation (inward supplies)
 * - Credit/Debit note sections
 * - HSN summary generation
 * - JSON validation against GST Portal schema
 */

export interface GSTR1JsonPayload {
  version: string;
  hash: string;
  gstin: string;
  fp: string; // filing period
  gt: number; // gross turnover
  b2b: GSTR1B2BEntry[];
  b2cl: unknown[];
  b2cs: unknown[];
  exp: unknown[];
  cdnr: unknown[];
  cdnur: unknown[];
  nil: { inv: { typ: string; expt_amt: number; nil_amt: number; nongst_amt: number }[] };
  hsn: { data: unknown[] };
}

interface GSTR1B2BEntry {
  ctin: string; // counterparty GSTIN
  inv: {
    inum: string; // invoice number
    idt: string; // invoice date
    val: number; // invoice value
    pos: string; // place of supply
    rchrg: string; // reverse charge
    inv_typ: string; // invoice type
    itms: {
      num: number;
      itm_det: {
        txval: number;
        rt: number;
        camt: number;
        samt: number;
        iamt: number;
        csamt: number;
      };
    }[];
  }[];
}

class JSONGeneratorService {
  /**
   * Generate a GSTR-1 return JSON payload from invoice data.
   * Groups invoices by counterparty GSTIN (B2B section) per GST Portal format.
   */
  generateGSTR1(params: {
    gstin: string;
    period: string;
    invoices: Array<{
      buyerGstin: string;
      invoiceNumber: string;
      invoiceDate: string;
      totalAmount: number;
      placeOfSupply: string;
      reverseCharge: boolean;
      taxableValue: number;
      cgst: number;
      sgst: number;
      igst: number;
      cess: number;
      gstRate: number;
    }>;
  }): GSTR1JsonPayload {
    // Group by counterparty GSTIN
    const b2bMap = new Map<string, GSTR1B2BEntry>();
    for (const inv of params.invoices) {
      if (!inv.buyerGstin) continue;
      if (!b2bMap.has(inv.buyerGstin)) {
        b2bMap.set(inv.buyerGstin, { ctin: inv.buyerGstin, inv: [] });
      }
      const entry = b2bMap.get(inv.buyerGstin)!;
      entry.inv.push({
        inum: inv.invoiceNumber,
        idt: inv.invoiceDate,
        val: inv.totalAmount,
        pos: inv.placeOfSupply || '27',
        rchrg: inv.reverseCharge ? 'Y' : 'N',
        inv_typ: 'R', // Regular
        itms: [
          {
            num: 1,
            itm_det: {
              txval: inv.taxableValue,
              rt: inv.gstRate,
              camt: inv.cgst,
              samt: inv.sgst,
              iamt: inv.igst,
              csamt: inv.cess,
            },
          },
        ],
      });
    }

    return {
      version: '3.1',
      hash: 'hash' + Date.now(),
      gstin: params.gstin,
      fp: params.period.replace('-', ''),
      gt: params.invoices.reduce((sum, i) => sum + i.totalAmount, 0),
      b2b: Array.from(b2bMap.values()),
      b2cl: [],
      b2cs: [],
      exp: [],
      cdnr: [],
      cdnur: [],
      nil: {
        inv: [{ typ: 'NIL', expt_amt: 0, nil_amt: 0, nongst_amt: 0 }],
      },
      hsn: { data: [] },
    };
  }

  /**
   * Generate a GSTR-3B summary return JSON payload.
   * Simplified structure — will be expanded in V2 with all tables.
   */
  generateGSTR3B(params: {
    gstin: string;
    period: string;
    supplies: {
      taxableValue: number;
      cgst: number;
      sgst: number;
      igst: number;
      cess: number;
    }[];
  }) {
    // Simplified GSTR-3B structure
    return {
      version: '3.1',
      hash: 'hash' + Date.now(),
      gstin: params.gstin,
      fp: params.period.replace('-', ''),
      gt: params.supplies.reduce((s, i) => s + i.taxableValue, 0),
      // Table 3.1 — Outward supplies
      // Table 3.2 — Inter-state supplies
      // Table 4 — Eligible ITC
      // Table 5 — Exempt and nil rated
      supplies: params.supplies,
    };
  }

  /**
   * Trigger a browser download of a JSON file.
   * Works client-side only — creates a Blob and initiates download.
   */
  downloadJson(data: object, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const jsonGeneratorService = new JSONGeneratorService();
