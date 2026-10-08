// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/gst-reconciliation/[id]/pdf
// ═══════════════════════════════════════════════════════════════════════════════
// Generate a CFO-grade PDF report for a reconciliation run.
//
// Sections:
//   1. Header (VEYRO branding + run metadata)
//   2. Executive Summary (AI-generated narrative + key metrics)
//   3. ITC Position (safe ITC vs at-risk)
//   4. Risk Assessment (level + score + reasoning)
//   5. Top Issues (by ITC impact)
//   6. Action Items (CFO checklist)
//   7. Vendor Compliance Scores (top suppliers)
//   8. Match Distribution Breakdown
//   9. Recommendations (per VEYRO AI)
//  10. Footer (generated timestamp + disclaimer)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { generateAISummary, computeVendorScores, type AIReconciliationSummary, type VendorScore } from '@/lib/gst-reconciliation';

export const dynamic = 'force-dynamic';

const BLUE = '#2563EB';
const DARK = '#0F1115';
const GRAY = '#6B7280';
const LIGHT_GRAY = '#E5E7EB';
const BG_LIGHT = '#F9FAFB';
const AMBER = '#F59E0B';
const ROSE = '#EF4444';
const EMERALD = '#10B981';
const PURPLE = '#8B5CF6';

function fmtINR(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function safeParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { id: runId } = await params;

    const run = await db.gSTReconciliationRun.findUnique({ where: { id: runId } });
    if (!run) {
      return NextResponse.json({ error: 'Run not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const memberResult = await requireOrgMembership(uid, run.organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    // ── Load AI summary + vendor scores (regenerate if missing) ──
    let aiSummary: AIReconciliationSummary | null = safeParse(run.aiSummary, null);
    let vendorScores: VendorScore[] = safeParse(run.vendorScores, []);

    const matches = await db.gSTReconciliationMatch.findMany({
      where: { runId },
      select: {
        status: true,
        itcAtRisk: true,
        booksTaxableValue: true,
        gstr2bTaxableValue: true,
        confidence: true,
        booksSupplierGSTIN: true,
        gstr2bSupplierGSTIN: true,
      },
    });

    if (!aiSummary) {
      aiSummary = generateAISummary(
        {
          totalBooks: run.totalBooks,
          total2B: run.total2B,
          matched: run.matched,
          unmatched: run.unmatched,
          missingInBooks: run.missingInBooks,
          missingIn2B: run.missingIn2B,
          duplicates: run.duplicates,
          matchPercent: run.matchPercent,
          potentialITCLoss: run.potentialITCLoss,
          totalTaxableValue: run.totalTaxableValue,
          totalMatchedTax: run.totalMatchedTax,
          avgConfidence: matches.length > 0
            ? matches.reduce((s, m) => s + (m.confidence || 0), 0) / matches.length
            : 0,
        },
        matches.map((m) => ({
          status: m.status as never,
          itcAtRisk: m.itcAtRisk,
          booksTaxableValue: m.booksTaxableValue,
          gstr2bTaxableValue: m.gstr2bTaxableValue,
          confidence: m.confidence,
        })),
      );
    }

    if (vendorScores.length === 0) {
      vendorScores = computeVendorScores(
        matches.map((m) => ({
          status: m.status as never,
          booksSupplierGSTIN: m.booksSupplierGSTIN,
          gstr2bSupplierGSTIN: m.gstr2bSupplierGSTIN,
          itcAtRisk: m.itcAtRisk,
        })),
      );
    }

    // ── Generate PDF ──
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const W = 595; // A4 width
    const M = 50;
    const CW = W - M * 2;

    // ═══ HEADER ═══
    doc.save();
    doc.rect(0, 0, W, 6).fill(BLUE);
    doc.restore();

    doc.save();
    doc.roundedRect(M, 30, 44, 44, 10).fill(BLUE);
    doc.fillColor('#ffffff').fontSize(26).font('Helvetica-Bold');
    doc.text('G', M + 14, 38);
    doc.restore();

    doc.fillColor(DARK).fontSize(22).font('Helvetica-Bold');
    doc.text('VEYRO', M + 56, 32);

    doc.fillColor(GRAY).fontSize(9).font('Helvetica');
    doc.text('GST Reconciliation Report — Oracle CFO™', M + 56, 58);

    doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK);
    doc.text('GSTR-2B vs BOOKS', W - M - 130, 30, { width: 130, align: 'right' });
    doc.font('Helvetica').fillColor(GRAY).fontSize(9);
    doc.text(`Period: ${run.period}`, W - M - 130, 46, { width: 130, align: 'right' });
    doc.text(`Generated ${new Date().toLocaleDateString('en-IN')}`, W - M - 130, 60, { width: 130, align: 'right' });

    doc.save();
    doc.moveTo(M, 90).lineTo(W - M, 90).strokeColor(LIGHT_GRAY).lineWidth(1).stroke();
    doc.restore();

    // ═══ RUN METADATA ═══
    let y = 105;
    doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold');
    doc.text('Reconciliation Run', M, y);
    y += 16;
    doc.font('Helvetica').fillColor(GRAY).fontSize(9);
    doc.text(`GSTIN: ${run.gstin}`, M, y); y += 12;
    doc.text(`Period: ${run.period}`, M, y); y += 12;
    doc.text(`GSP Provider: ${run.gspProvider}`, M, y); y += 12;
    doc.text(`Run ID: ${run.id}`, M, y); y += 12;
    if (run.completedAt) {
      doc.text(`Completed: ${new Date(run.completedAt).toLocaleString('en-IN')}`, M, y); y += 12;
    }
    y += 8;

    // ═══ EXECUTIVE SUMMARY ═══
    doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold');
    doc.text('Executive Summary', M, y);
    y += 18;

    doc.font('Helvetica').fillColor(DARK).fontSize(9.5);
    const summaryLines = wrapText(aiSummary.executiveSummary, CW, doc);
    for (const line of summaryLines) {
      doc.text(line, M, y);
      y += 12;
    }
    y += 8;

    // ═══ KPI CARDS ═══
    const kpis = [
      { label: 'Match Rate', value: `${run.matchPercent}%`, color: BLUE },
      { label: 'Avg Confidence', value: `${Math.round(aiSummary.avgConfidence * 100)}%`, color: EMERALD },
      { label: 'ITC at Risk', value: fmtINR(aiSummary.estimatedITCBlocked), color: ROSE },
      { label: 'Expected Recovery', value: fmtINR(aiSummary.expectedRecovery), color: EMERALD },
    ];
    const cardW = (CW - 30) / 4;
    const cardH = 50;
    for (let i = 0; i < kpis.length; i++) {
      const kpi = kpis[i];
      const x = M + i * (cardW + 10);
      doc.save();
      doc.roundedRect(x, y, cardW, cardH, 6).fill(BG_LIGHT);
      doc.fillColor(kpi.color).fontSize(8).font('Helvetica-Bold');
      doc.text(kpi.label.toUpperCase(), x + 8, y + 8, { width: cardW - 16 });
      doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold');
      doc.text(kpi.value, x + 8, y + 22, { width: cardW - 16 });
      doc.restore();
    }
    y += cardH + 16;

    // ═══ RISK ASSESSMENT ═══
    if (y > 720) { doc.addPage(); y = 50; }
    doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold');
    doc.text('Risk Assessment', M, y);
    y += 18;

    const riskColor = aiSummary.riskLevel === 'critical' ? ROSE
      : aiSummary.riskLevel === 'high' ? ROSE
      : aiSummary.riskLevel === 'medium' ? AMBER
      : EMERALD;
    doc.save();
    doc.roundedRect(M, y, CW, 36, 6).fill(BG_LIGHT);
    doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold');
    doc.text('RISK LEVEL', M + 12, y + 8);
    doc.fillColor(riskColor).fontSize(16).font('Helvetica-Bold');
    doc.text(aiSummary.riskLevel.toUpperCase(), M + 12, y + 18);
    doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold');
    doc.text('RISK SCORE', M + 200, y + 8);
    doc.fillColor(DARK).fontSize(16).font('Helvetica-Bold');
    doc.text(`${aiSummary.riskScore}/100`, M + 200, y + 18);
    doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold');
    doc.text('SAFE ITC', M + 350, y + 8);
    doc.fillColor(EMERALD).fontSize(16).font('Helvetica-Bold');
    doc.text(fmtINR(aiSummary.safeITC), M + 350, y + 18);
    doc.restore();
    y += 46;

    // ═══ TOP ISSUES ═══
    if (aiSummary.topIssues.length > 0) {
      if (y > 680) { doc.addPage(); y = 50; }
      doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold');
      doc.text('Top Issues by ITC Impact', M, y);
      y += 18;

      for (const issue of aiSummary.topIssues.slice(0, 6)) {
        if (y > 760) { doc.addPage(); y = 50; }
        doc.save();
        doc.roundedRect(M, y, CW, 44, 4).fill(BG_LIGHT);
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold');
        doc.text(issue.label, M + 10, y + 8, { width: CW - 200 });
        doc.fillColor(ROSE).fontSize(11).font('Helvetica-Bold');
        doc.text(fmtINR(issue.itcAtRisk), W - M - 130, y + 8, { width: 120, align: 'right' });
        doc.fillColor(GRAY).fontSize(8).font('Helvetica');
        doc.text(`${issue.count} invoice${issue.count !== 1 ? 's' : ''}`, M + 10, y + 26, { width: CW - 200 });
        doc.fillColor(DARK).fontSize(8).font('Helvetica-Oblique');
        const recLines = wrapText(issue.recommendation, CW - 200, doc);
        doc.text(recLines[0] || '', W - M - 130, y + 26, { width: 120, align: 'right' });
        doc.restore();
        y += 50;
      }
    }

    // ═══ VENDOR COMPLIANCE ═══
    if (vendorScores.length > 0) {
      if (y > 680) { doc.addPage(); y = 50; }
      doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold');
      doc.text('Vendor Compliance Scores', M, y);
      y += 18;

      // Table header
      doc.save();
      doc.rect(M, y, CW, 18).fill(DARK);
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('SUPPLIER', M + 8, y + 5, { width: 200 });
      doc.text('GSTIN', M + 220, y + 5, { width: 130 });
      doc.text('INVOICES', M + 360, y + 5, { width: 60, align: 'right' });
      doc.text('SCORE', W - M - 60, y + 5, { width: 50, align: 'right' });
      doc.restore();
      y += 18;

      for (const v of vendorScores.slice(0, 8)) {
        if (y > 760) { doc.addPage(); y = 50; }
        const vColor = v.score >= 75 ? EMERALD : v.score >= 50 ? AMBER : ROSE;
        doc.save();
        doc.rect(M, y, CW, 20).fill(y % 40 === 0 ? BG_LIGHT : '#ffffff');
        doc.fillColor(DARK).fontSize(9).font('Helvetica');
        doc.text(v.name || 'Unknown', M + 8, y + 5, { width: 200 });
        doc.fillColor(GRAY).fontSize(8).font('Helvetica');
        doc.text(v.gstin, M + 220, y + 5, { width: 130 });
        doc.fillColor(DARK).fontSize(9).font('Helvetica');
        doc.text(String(v.invoiceCount), M + 360, y + 5, { width: 60, align: 'right' });
        doc.fillColor(vColor).fontSize(11).font('Helvetica-Bold');
        doc.text(`${v.score}%`, W - M - 60, y + 4, { width: 50, align: 'right' });
        doc.restore();
        y += 20;
      }
      y += 12;
    }

    // ═══ ACTION ITEMS ═══
    if (aiSummary.actionItems.length > 0) {
      if (y > 680) { doc.addPage(); y = 50; }
      doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold');
      doc.text('Action Items', M, y);
      y += 18;

      doc.font('Helvetica').fillColor(DARK).fontSize(9.5);
      for (const item of aiSummary.actionItems) {
        if (y > 760) { doc.addPage(); y = 50; }
        doc.fillColor(BLUE);
        doc.text('•', M, y);
        doc.fillColor(DARK);
        const lines = wrapText(item, CW - 16, doc);
        for (const line of lines) {
          doc.text(line, M + 16, y);
          y += 12;
        }
        y += 4;
      }
    }

    // ═══ MATCH DISTRIBUTION ═══
    if (y > 680) { doc.addPage(); y = 50; }
    y += 8;
    doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold');
    doc.text('Match Distribution', M, y);
    y += 18;

    const distRows = [
      { label: 'Perfect Match', value: run.matched, color: BLUE },
      { label: 'Mismatches', value: run.unmatched, color: AMBER },
      { label: 'Missing in Books', value: run.missingInBooks, color: ROSE },
      { label: 'Missing in GSTR-2B', value: run.missingIn2B, color: PURPLE },
      { label: 'Duplicates', value: run.duplicates, color: GRAY },
    ];
    for (const r of distRows) {
      if (y > 760) { doc.addPage(); y = 50; }
      doc.fillColor(r.color);
      doc.rect(M, y + 4, 8, 8).fill(r.color);
      doc.fillColor(DARK).fontSize(9).font('Helvetica');
      doc.text(r.label, M + 14, y);
      doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold');
      doc.text(String(r.value), W - M - 60, y, { width: 50, align: 'right' });
      y += 16;
    }

    // ═══ FOOTER ═══
    y += 16;
    if (y > 740) { doc.addPage(); y = 50; }
    doc.save();
    doc.moveTo(M, y).lineTo(W - M, y).strokeColor(LIGHT_GRAY).lineWidth(1).stroke();
    doc.restore();
    y += 8;
    doc.fillColor(GRAY).fontSize(8).font('Helvetica-Oblique');
    const footerLines = wrapText(
      `Generated by VEYRO AI CFO™ on ${new Date().toLocaleString('en-IN')}. This report is based on automated reconciliation between your purchase register and GSTR-2B data. Please review each mismatch with your CA before filing. ITC eligibility is subject to Section 16 of the CGST Act, 2017.`,
      CW, doc,
    );
    for (const line of footerLines) {
      doc.text(line, M, y);
      y += 10;
    }

    doc.end();
    const buffer = await pdfPromise;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="gst-reconciliation-${run.gstin}-${run.period}.pdf"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    return friendlyApiError(error, 'Could not generate PDF report.');
  }
}

function wrapText(text: string, maxWidth: number, doc: import('pdfkit').PDFDocument): string[] {
  if (!text) return [];
  return doc.widthOfString(text) <= maxWidth
    ? [text]
    : (doc as unknown as { _text?: string }).font
      ? text.split(/(?<=\.)\s+|(?<=,)\s+/).reduce<string[]>((acc, sentence) => {
          const last = acc[acc.length - 1] || '';
          const candidate = last ? `${last} ${sentence}` : sentence;
          if (doc.widthOfString(candidate) <= maxWidth) {
            if (last) acc[acc.length - 1] = candidate;
            else acc.push(sentence);
          } else {
            acc.push(sentence);
          }
          return acc;
        }, [])
      : [text];
}
