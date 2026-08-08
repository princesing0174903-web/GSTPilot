// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/gst-reconciliation/run
// ═══════════════════════════════════════════════════════════════════════════════
// Run a GST reconciliation: fetch purchase invoices from Books, download
// GSTR-2B from the configured GSP, run the match engine, persist results.
//
// Body: { organizationId, gstin, period, clientId?, gspProvider? }
// Returns: { runId, summary }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import {
  getGSPProvider,
  getGSPProviderForOrg,
  reconcile,
  generateAISummary,
  computeVendorScores,
  suggestAction,
  generateFixes,
  type BooksInvoice,
} from '@/lib/gst-reconciliation';
import { modeLabel } from '@/lib/gst-reconciliation/server/provider-mode';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = await request.json();
    const { organizationId, gstin: bodyGstin, period, clientId, gspProvider } = body;

    if (!organizationId || !bodyGstin || !period) {
      return NextResponse.json(
        { error: 'organizationId, gstin, and period are required', code: 'MISSING_PARAMS' },
        { status: 400 },
      );
    }

    const memberResult = await requireOrgMembership(uid, organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    // ── Resolve the provider ──
    // If the caller explicitly passed gspProvider AND it's 'mock', honor it.
    // Otherwise resolve from the org's saved config (live/sandbox/demo).
    let provider;
    let resolvedMode: 'live' | 'sandbox' | 'demo' | 'not_connected' = 'demo';
    let resolvedGstin = bodyGstin;
    if (gspProvider === 'mock') {
      provider = getGSPProvider('mock');
      resolvedMode = 'demo';
    } else {
      const resolution = await getGSPProviderForOrg(organizationId);
      provider = resolution.provider;
      resolvedMode = resolution.mode;
      // Use the configured GSTIN if available (it's the authoritative one)
      if (resolution.gstin) resolvedGstin = resolution.gstin;
    }
    const gstin = resolvedGstin;

    // ── 1. Fetch purchase invoices from Books (Prisma) ──
    // Pull from PurchaseBill table, scoped to the org + optional client.
    const whereClause: Record<string, unknown> = {
      client: { firmId: organizationId },
    };
    if (clientId) (whereClause as Record<string, unknown>).clientId = clientId;

    const purchaseBills = await db.purchaseBill.findMany({
      where: whereClause as never,
      select: {
        id: true,
        invoiceNo: true,
        invoiceDate: true,
        vendorGstin: true,
        vendorName: true,
        taxableValue: true,
        cgst: true,
        sgst: true,
        igst: true,
        cess: true,
        totalAmount: true,
      },
    });

    const booksInvoices: BooksInvoice[] = purchaseBills.map((b) => ({
      id: b.id,
      invoiceNo: b.invoiceNo || '',
      invoiceDate: b.invoiceDate || undefined,
      supplierGSTIN: b.vendorGstin || '',
      supplierName: b.vendorName || undefined,
      taxableValue: Number(b.taxableValue || 0),
      cgst: Number(b.cgst || 0),
      sgst: Number(b.sgst || 0),
      igst: Number(b.igst || 0),
      cess: Number(b.cess || 0),
      total: Number(b.totalAmount || 0),
    }));

    // ── 2. Fetch GSTR-2B from the resolved provider ──
    const gspSession = await provider.authenticate({
      clientId: 'gstpilot',
      apikey: 'gstpilot-key',
    });
    const gstr2bResult = await provider.fetchGSTR2B(gspSession, gstin, period);

    // Persist GSTR-2B records (upsert) for audit + future runs.
    // (Was N+1: for each record, a findFirst + update/create. Now batched:
    //   1. One findMany for ALL existing records matching (gstin, period).
    //   2. Partition records into updates vs creates based on the existing map.
    //   3. Bulk updates via Promise.all + bulk create via createMany.)
    const records = gstr2bResult.records;
    if (records.length > 0) {
      const compositeKeys = records.map((r) => `${r.supplierGSTIN}||${r.invoiceNo}`);
      const existingRows = await db.gSTR2BInvoice.findMany({
        where: {
          gstin,
          period,
          OR: records.map((r) => ({
            supplierGSTIN: r.supplierGSTIN,
            invoiceNo: r.invoiceNo,
          })),
        },
        select: { id: true, supplierGSTIN: true, invoiceNo: true },
      });
      const existingMap = new Map<string, string>();
      for (const e of existingRows) {
        existingMap.set(`${e.supplierGSTIN}||${e.invoiceNo}`, e.id);
      }

      const toCreate: Array<{
        gstin: string; period: string; supplierGSTIN: string; supplierName: string | null;
        invoiceNo: string; invoiceDate: string | null; taxableValue: number;
        igst: number; cgst: number; sgst: number; cess: number;
        itcAvailable: number; itcEligible: boolean;
        matched: boolean; matchStatus: string;
      }> = [];
      const updateOps: Promise<unknown>[] = [];
      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const key = compositeKeys[i];
        const existingId = existingMap.get(key);
        if (existingId) {
          updateOps.push(
            db.gSTR2BInvoice.update({
              where: { id: existingId },
              data: {
                invoiceDate: rec.invoiceDate ?? null,
                taxableValue: rec.taxableValue,
                igst: rec.igst,
                cgst: rec.cgst,
                sgst: rec.sgst,
                cess: rec.cess,
                itcAvailable: rec.itcAvailable,
                itcEligible: rec.itcEligible,
                supplierName: rec.supplierName ?? null,
              },
            }),
          );
        } else {
          toCreate.push({
            gstin,
            period,
            supplierGSTIN: rec.supplierGSTIN,
            supplierName: rec.supplierName ?? null,
            invoiceNo: rec.invoiceNo,
            invoiceDate: rec.invoiceDate ?? null,
            taxableValue: rec.taxableValue,
            igst: rec.igst,
            cgst: rec.cgst,
            sgst: rec.sgst,
            cess: rec.cess,
            itcAvailable: rec.itcAvailable,
            itcEligible: rec.itcEligible,
            matched: false,
            matchStatus: 'unmatched',
          });
        }
      }
      // Run all updates in parallel + a single bulk create.
      await Promise.all([
        ...updateOps,
        toCreate.length > 0
          ? db.gSTR2BInvoice.createMany({ data: toCreate })
          : Promise.resolve(),
      ]);
    }

    // ── 3. Run the match engine ──
    const { results, summary } = reconcile(booksInvoices, gstr2bResult.records);

    // ── 4. Persist the run + matches ──
    const run = await db.gSTReconciliationRun.create({
      data: {
        organizationId,
        clientId: clientId || null,
        gstin,
        period,
        gspProvider: provider.key,
        status: 'completed',
        totalBooks: summary.totalBooks,
        total2B: summary.total2B,
        matched: summary.matched,
        unmatched: summary.unmatched,
        missingInBooks: summary.missingInBooks,
        missingIn2B: summary.missingIn2B,
        duplicates: summary.duplicates,
        matchPercent: summary.matchPercent,
        potentialITCLoss: summary.potentialITCLoss,
        totalTaxableValue: summary.totalTaxableValue,
        totalMatchedTax: summary.totalMatchedTax,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
      },
    });

    // Persist matches in batches (Prisma createMany)
    const matchRows = results.map((r) => {
      // Generate Oracle AI suggestion + fixes for each match (rule-based, instant)
      const suggestion = suggestAction({
        status: r.status,
        confidence: r.confidence,
        itcAtRisk: r.itcAtRisk,
        booksInvoiceNo: r.booksInvoice?.invoiceNo || null,
        gstr2bInvoiceNo: r.gstr2bRecord?.invoiceNo || null,
        booksSupplierGSTIN: r.booksInvoice?.supplierGSTIN || null,
        gstr2bSupplierGSTIN: r.gstr2bRecord?.supplierGSTIN || null,
        booksTaxableValue: r.booksInvoice?.taxableValue || 0,
        gstr2bTaxableValue: r.gstr2bRecord?.taxableValue || 0,
      });
      const fixes = generateFixes({
        status: r.status,
        confidence: r.confidence,
        booksInvoiceId: r.booksInvoice?.id || null,
        booksInvoiceNo: r.booksInvoice?.invoiceNo || null,
        booksInvoiceDate: r.booksInvoice?.invoiceDate || null,
        gstr2bInvoiceNo: r.gstr2bRecord?.invoiceNo || null,
        gstr2bInvoiceDate: r.gstr2bRecord?.invoiceDate || null,
        booksSupplierGSTIN: r.booksInvoice?.supplierGSTIN || null,
        gstr2bSupplierGSTIN: r.gstr2bRecord?.supplierGSTIN || null,
        booksTaxableValue: r.booksInvoice?.taxableValue || 0,
        gstr2bTaxableValue: r.gstr2bRecord?.taxableValue || 0,
        booksCGST: r.booksInvoice?.cgst || 0,
        gstr2bCGST: r.gstr2bRecord?.cgst || 0,
        booksSGST: r.booksInvoice?.sgst || 0,
        gstr2bSGST: r.gstr2bRecord?.sgst || 0,
        booksIGST: r.booksInvoice?.igst || 0,
        gstr2bIGST: r.gstr2bRecord?.igst || 0,
        booksCESS: r.booksInvoice?.cess || 0,
        gstr2bCESS: r.gstr2bRecord?.cess || 0,
        itcAtRisk: r.itcAtRisk,
      });
      return {
        runId: run.id,
        booksInvoiceId: r.booksInvoice?.id || null,
        booksInvoiceNo: r.booksInvoice?.invoiceNo || null,
        booksInvoiceDate: r.booksInvoice?.invoiceDate || null,
        booksSupplierGSTIN: r.booksInvoice?.supplierGSTIN || null,
        booksTaxableValue: r.booksInvoice?.taxableValue || 0,
        booksCGST: r.booksInvoice?.cgst || 0,
        booksSGST: r.booksInvoice?.sgst || 0,
        booksIGST: r.booksInvoice?.igst || 0,
        booksCESS: r.booksInvoice?.cess || 0,
        booksTotal: r.booksInvoice?.total || 0,
        gstr2bInvoiceNo: r.gstr2bRecord?.invoiceNo || null,
        gstr2bInvoiceDate: r.gstr2bRecord?.invoiceDate || null,
        gstr2bSupplierGSTIN: r.gstr2bRecord?.supplierGSTIN || null,
        gstr2bTaxableValue: r.gstr2bRecord?.taxableValue || 0,
        gstr2bCGST: r.gstr2bRecord?.cgst || 0,
        gstr2bSGST: r.gstr2bRecord?.sgst || 0,
        gstr2bIGST: r.gstr2bRecord?.igst || 0,
        gstr2bCESS: r.gstr2bRecord?.cess || 0,
        gstr2bTotal:
          (r.gstr2bRecord?.taxableValue || 0) +
          (r.gstr2bRecord?.cgst || 0) +
          (r.gstr2bRecord?.sgst || 0) +
          (r.gstr2bRecord?.igst || 0) +
          (r.gstr2bRecord?.cess || 0),
        status: r.status,
        confidence: r.confidence,
        scoreBreakdown: JSON.stringify(r.scoreBreakdown),
        mismatchReasons: JSON.stringify(r.mismatchReasons),
        itcAtRisk: r.itcAtRisk,
        aiSuggestion: suggestion.key,
        fixSuggestions: fixes.length > 0 ? JSON.stringify(fixes) : null,
      };
    });

    // Insert in chunks of 100 to avoid SQLite parameter limits
    for (let i = 0; i < matchRows.length; i += 100) {
      await db.gSTReconciliationMatch.createMany({
        data: matchRows.slice(i, i + 100),
      });
    }

    // ── 5. Generate + persist the AI CFO summary + vendor scores ──
    const aiSummary = generateAISummary(
      {
        totalBooks: summary.totalBooks,
        total2B: summary.total2B,
        matched: summary.matched,
        unmatched: summary.unmatched,
        missingInBooks: summary.missingInBooks,
        missingIn2B: summary.missingIn2B,
        duplicates: summary.duplicates,
        matchPercent: summary.matchPercent,
        potentialITCLoss: summary.potentialITCLoss,
        totalTaxableValue: summary.totalTaxableValue,
        totalMatchedTax: summary.totalMatchedTax,
        avgConfidence: summary.avgConfidence,
      },
      results.map((r) => ({
        status: r.status,
        itcAtRisk: r.itcAtRisk,
        booksTaxableValue: r.booksInvoice?.taxableValue || 0,
        gstr2bTaxableValue: r.gstr2bRecord?.taxableValue || 0,
        confidence: r.confidence,
      })),
    );

    const vendorScores = computeVendorScores(
      results.map((r) => ({
        status: r.status,
        booksSupplierGSTIN: r.booksInvoice?.supplierGSTIN || null,
        gstr2bSupplierGSTIN: r.gstr2bRecord?.supplierGSTIN || null,
        itcAtRisk: r.itcAtRisk,
        booksSupplierName: r.booksInvoice?.supplierName || null,
        gstr2bSupplierName: r.gstr2bRecord?.supplierName || null,
      })),
    );

    await db.gSTReconciliationRun.update({
      where: { id: run.id },
      data: {
        aiSummary: JSON.stringify(aiSummary),
        vendorScores: JSON.stringify(vendorScores),
      },
    });

    return NextResponse.json({
      runId: run.id,
      summary,
      isLive: gstr2bResult.isLive,
      provider: provider.displayName,
      mode: resolvedMode,
      modeLabel: modeLabel(resolvedMode),
      gstin,
    });
  } catch (error) {
    return friendlyApiError(
      error,
      'We could not run the GST reconciliation. Please try again.',
    );
  }
}
