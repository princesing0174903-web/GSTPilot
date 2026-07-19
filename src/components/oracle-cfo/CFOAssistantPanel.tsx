'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Production Assistant Panel
//
// Renders inline BELOW an Oracle assistant message when the CFO analyze
// endpoint detects an actionable intent. This is NOT a new page, NOT a
// redesign — it's an inline panel that turns Oracle's chat answer into a
// real, executable, audited business action.
//
// Flow:
//   1. Oracle answers the question (streaming chat — unchanged)
//   2. This panel appears below the answer showing:
//      • The detected tool + confidence
//      • WHY (explainable decision card)
//      • Supporting records (real IDs)
//      • Calculation breakdown
//      • Risks + alternatives
//      • Input params (editable if missing)
//   3. If approval required → Approve / Reject buttons
//   4. On Approve → POST /api/oracle/cfo/execute → real tool runs
//   5. Result shown inline: success/failure, records affected, audit ID
//
// Dark theme matching Oracle workspace: bg #0a0a0a, border rgba(255,255,255,0.08),
// accent emerald. NO indigo/blue.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  FileBarChart,
  Loader2,
  Mail,
  MessageCircle,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types (mirror the API response shapes) ─────────────────────────────────

interface DecisionCard {
  toolId: string;
  toolName: string;
  why: string;
  records: Array<{ collection: string; id: string; label: string; detail: string }>;
  confidence: number;
  confidenceFactors: Array<{ label: string; weight: number; score: number }>;
  calculation: Array<{ label: string; value: string }>;
  risks: Array<{ severity: 'low' | 'medium' | 'high'; description: string; mitigation?: string }>;
  alternatives: Array<{ title: string; tradeOff: string; recommended: boolean }>;
  generatedAt: string;
}

interface ApprovalRequest {
  approvalId: string;
  toolId: string;
  toolName: string;
  toolIcon: string;
  category: string;
  input: Record<string, unknown>;
  decisionCard: DecisionCard;
  missingParams: string[];
  createdAt: string;
}

interface ExecuteResult {
  success: boolean;
  message: string;
  recordsAffected: Array<{ collection: string; id: string; action: 'created' | 'updated' | 'deleted' }>;
  output?: Record<string, unknown>;
  executionMs: number;
  rollbackStatus?: string;
}

interface CFOAssistantPanelProps {
  approvalRequests: ApprovalRequest[];
  organizationId: string;
  userId: string;
  userEmail: string;
  onExecuted?: () => void;
}

// ─── Icon map (tool icon name → Lucide component) ───────────────────────────

const TOOL_ICONS: Record<string, LucideIcon> = {
  FileText,
  Mail,
  MessageCircle,
  Receipt,
  CheckCircle2,
  CheckSquare: CheckCircle2,
  FileBarChart,
  CreditCard: Zap,
};

// ─── Confidence color ───────────────────────────────────────────────────────

function confidenceColor(c: number): string {
  if (c >= 80) return '#2563EB'; // emerald
  if (c >= 60) return '#f59e0b'; // amber
  return '#ef4444'; // rose
}

function riskColor(sev: 'low' | 'medium' | 'high'): string {
  if (sev === 'high') return '#ef4444';
  if (sev === 'medium') return '#f59e0b';
  return '#2563EB';
}

// ─── GST Report Payload type (mirror of gst-report-engine.ts GSTReport) ──────

interface GSTSlabBreakdown {
  gstRate: number;
  invoiceCount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  totalAmount: number;
}

interface GSTReportPayload {
  reportId: string;
  intent: {
    reportType: string;
    periodLabel: string;
    startDate: string;
    endDate: string;
    periodKey: string;
  };
  generatedAt: string;
  generatedBy: string;
  dataSummary: {
    salesInvoiceCount: number;
    purchaseInvoiceCount: number;
    creditNoteCount: number;
    debitNoteCount: number;
    expenseCount: number;
    paymentCount: number;
    priorPeriodInvoiceCount: number;
  };
  validation: {
    totalChecked: number;
    passed: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    duplicateInvoiceNumbers: string[];
    invalidGstins: string[];
    futureDatedInvoices: string[];
    reverseChargeInvoices: string[];
    exemptInvoices: string[];
    zeroRatedInvoices: string[];
    exportInvoices: string[];
    issues: Array<{
      invoiceId: string;
      invoiceNumber: string;
      severity: 'critical' | 'warning' | 'info';
      field: string;
      message: string;
      value: string;
    }>;
  };
  calculations: {
    totalTaxableTurnover: number;
    totalExempt: number;
    totalZeroRated: number;
    totalExport: number;
    outputCGST: number;
    outputSGST: number;
    outputIGST: number;
    outputCess: number;
    totalOutputTax: number;
    itcAvailable: number;
    itcCGST: number;
    itcSGST: number;
    itcIGST: number;
    itcCess: number;
    itcReversed: number;
    itcUtilized: number;
    netCGSTPayable: number;
    netSGSTPayable: number;
    netIGSTPayable: number;
    netCessPayable: number;
    netPayable: number;
    refundEligible: number;
    salesBySlab: GSTSlabBreakdown[];
    purchasesBySlab: GSTSlabBreakdown[];
    priorPeriodOutputTax: number;
    deltaOutputTax: number;
    deltaPercent: number;
    crossChecks: Array<{ label: string; expected: string; actual: string; match: boolean }>;
  };
  topCustomers: Array<{
    id: string;
    name: string;
    gstin: string | null;
    invoiceCount: number;
    taxableValue: number;
    taxAmount: number;
    totalAmount: number;
  }>;
  topVendors: Array<{
    id: string;
    name: string;
    gstin: string | null;
    invoiceCount: number;
    taxableValue: number;
    taxAmount: number;
    totalAmount: number;
  }>;
  monthlyComparison: Array<{
    periodKey: string;
    periodLabel: string;
    taxableValue: number;
    outputTax: number;
    itc: number;
    netPayable: number;
  }>;
}

// ─── Report Result Card (Phase 1.2) ────────────────────────────────────────
// Renders below the standard result block when generate-gst-report executed.
// Shows: KPI grid, sales/purchase slab breakdown, GST liability, ITC summary,
// validation summary, top customers/vendors, Oracle insights, and three
// download buttons (PDF / Excel / CSV) that POST the inline reportPayload
// to /api/oracle/cfo/report/export.

function ReportResultCard({
  report,
  reportId,
  insights,
  recommendations,
}: {
  report: GSTReportPayload;
  reportId: string;
  insights: string[];
  recommendations: string[];
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showAllIssues, setShowAllIssues] = useState(false);

  const handleDownload = useCallback(async (format: 'pdf' | 'excel' | 'csv') => {
    setDownloading(format);
    setDownloadError(null);
    try {
      // POST the inline payload so the export works even when the report
      // couldn't be persisted (preview mode — Firestore security rules).
      const res = await fetch('/api/oracle/cfo/report/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportPayload: report, format }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const periodSlug = report.intent.periodKey.replace(/[^a-zA-Z0-9-]/g, '-');
      const typeSlug = report.intent.reportType.replace(/[^a-zA-Z0-9-]/g, '-');
      const ext = format === 'excel' ? 'xlsx' : format;
      a.download = `GST-${typeSlug}-${periodSlug}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setDownloadError(msg);
    } finally {
      setDownloading(null);
    }
  }, [report]);

  const calc = report.calculations;
  const val = report.validation;
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'rgba(37,99,235,0.2)', background: '#0d0d0d' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(59,130,246,0.04) 100%)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileBarChart className="h-4 w-4 shrink-0" style={{ color: '#2563EB' }} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">
              GST Report — {report.intent.reportType.toUpperCase()} · {report.intent.periodLabel}
            </div>
            <div className="text-xs text-white/50">
              {report.dataSummary.salesInvoiceCount} sales + {report.dataSummary.purchaseInvoiceCount} purchase invoices ·
              {' '}{val.criticalCount} critical / {val.warningCount} warnings · ID {reportId.slice(-12)}
            </div>
          </div>
        </div>
        <code className="text-[10px] text-white/40 font-mono shrink-0 hidden sm:block">
          {report.intent.startDate} → {report.intent.endDate}
        </code>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* KPI grid */}
        <section>
          <SectionLabel icon={<Sparkles className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />} label="Executive Summary" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <KpiCell label="Taxable Turnover" value={inr(calc.totalTaxableTurnover)} />
            <KpiCell label="Total Output Tax" value={inr(calc.totalOutputTax)} />
            <KpiCell label="ITC Available" value={inr(calc.itcAvailable)} />
            <KpiCell label="Net GST Payable" value={inr(calc.netPayable)} highlight />
            <KpiCell label="Exempt Supplies" value={inr(calc.totalExempt)} />
            <KpiCell label="Zero-Rated + Export" value={inr(calc.totalZeroRated + calc.totalExport)} />
          </div>
        </section>

        {/* Sales by Slab */}
        <section>
          <SectionLabel icon={<ArrowRight className="h-3.5 w-3.5" style={{ color: '#3B82F6' }} />} label="Sales Summary (by GST Slab)" />
          <SlabTable rows={calc.salesBySlab} />
        </section>

        {/* Purchases by Slab */}
        {calc.purchasesBySlab.some((s) => s.invoiceCount > 0) && (
          <section>
            <SectionLabel icon={<ArrowRight className="h-3.5 w-3.5" style={{ color: '#3B82F6' }} />} label="Purchase Summary (ITC by Slab)" />
            <SlabTable rows={calc.purchasesBySlab} itcMode />
          </section>
        )}

        {/* GST Liability */}
        <section>
          <SectionLabel icon={<Zap className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />} label="GST Liability Breakdown" />
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <KeyValueRow label="Output CGST" value={inr(calc.outputCGST)} />
            <KeyValueRow label="Output SGST" value={inr(calc.outputSGST)} />
            <KeyValueRow label="Output IGST" value={inr(calc.outputIGST)} />
            <KeyValueRow label="Output Cess" value={inr(calc.outputCess)} />
            <KeyValueRow label="Total Output Tax" value={inr(calc.totalOutputTax)} bold />
            <KeyValueRow label="Less: ITC Utilized" value={`−${inr(calc.itcUtilized)}`} />
            <KeyValueRow label="Net CGST Payable" value={inr(calc.netCGSTPayable)} />
            <KeyValueRow label="Net SGST Payable" value={inr(calc.netSGSTPayable)} />
            <KeyValueRow label="Net IGST Payable" value={inr(calc.netIGSTPayable)} />
            <KeyValueRow label="Net Cess Payable" value={inr(calc.netCessPayable)} />
            <KeyValueRow label="Net GST Payable" value={inr(calc.netPayable)} bold highlight />
          </div>
        </section>

        {/* ITC Summary */}
        <section>
          <SectionLabel icon={<ShieldCheck className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />} label="ITC Summary" />
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <KeyValueRow label="ITC Available (CGST + SGST + IGST + Cess)" value={inr(calc.itcAvailable)} bold />
            <KeyValueRow label="ITC Reversed (Rule 42/43 — exempt supplies)" value={`−${inr(calc.itcReversed)}`} />
            <KeyValueRow label="ITC Utilized" value={inr(calc.itcUtilized)} />
            <KeyValueRow label="Refund Eligible" value={inr(calc.refundEligible)} />
          </div>
        </section>

        {/* Period delta */}
        {calc.priorPeriodOutputTax > 0 && (
          <section>
            <SectionLabel icon={<TrendingDelta percent={calc.deltaPercent} />} label="Period-over-Period Comparison" />
            <div
              className="rounded-lg border px-3 py-2.5"
              style={{
                borderColor: calc.deltaPercent > 20 || calc.deltaPercent < -20 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)',
                background: calc.deltaPercent > 20 || calc.deltaPercent < -20 ? 'rgba(245,158,11,0.05)' : '#111111',
              }}
            >
              <div className="text-sm text-white/85">
                Output tax {calc.deltaOutputTax > 0 ? 'increased' : calc.deltaOutputTax < 0 ? 'decreased' : 'stayed flat'} by{' '}
                <span className="font-semibold" style={{ color: calc.deltaOutputTax > 0 ? '#f59e0b' : '#2563EB' }}>
                  {inr(Math.abs(calc.deltaOutputTax))} ({calc.deltaPercent > 0 ? '+' : ''}{calc.deltaPercent}%)
                </span>{' '}
                vs prior period.
              </div>
              <div className="text-xs text-white/50 mt-1">
                Prior: {inr(calc.priorPeriodOutputTax)} → Current: {inr(calc.totalOutputTax)}
              </div>
            </div>
          </section>
        )}

        {/* Top customers */}
        {report.topCustomers.length > 0 && (
          <section>
            <SectionLabel icon={<Database className="h-3.5 w-3.5" style={{ color: '#3B82F6' }} />} label="Top Customers (by tax contribution)" />
            <div className="rounded-lg border overflow-hidden max-h-72 overflow-y-auto" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {report.topCustomers.slice(0, 10).map((c, i) => (
                <ContributorRow key={i} name={c.name} gstin={c.gstin} count={c.invoiceCount} taxable={c.taxableValue} tax={c.taxAmount} />
              ))}
            </div>
          </section>
        )}

        {/* Top vendors */}
        {report.topVendors.length > 0 && (
          <section>
            <SectionLabel icon={<Database className="h-3.5 w-3.5" style={{ color: '#a78bfa' }} />} label="Top Vendors (by ITC contribution)" />
            <div className="rounded-lg border overflow-hidden max-h-72 overflow-y-auto" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {report.topVendors.slice(0, 10).map((v, i) => (
                <ContributorRow key={i} name={v.name} gstin={v.gstin} count={v.invoiceCount} taxable={v.taxableValue} tax={v.taxAmount} />
              ))}
            </div>
          </section>
        )}

        {/* Validation report */}
        <section>
          <SectionLabel
            icon={<AlertTriangle className="h-3.5 w-3.5" style={{ color: val.criticalCount > 0 ? '#ef4444' : '#2563EB' }} />}
            label={`Validation Report — ${val.passed}/${val.totalChecked} passed · ${val.criticalCount} critical · ${val.warningCount} warnings`}
          />
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <KeyValueRow label="Invoices checked" value={String(val.totalChecked)} />
            <KeyValueRow label="Passed validation" value={String(val.passed)} />
            <KeyValueRow
              label="Critical issues"
              value={String(val.criticalCount)}
              bold={val.criticalCount > 0}
              valueColor={val.criticalCount > 0 ? '#ef4444' : undefined}
            />
            <KeyValueRow label="Warnings" value={String(val.warningCount)} valueColor={val.warningCount > 0 ? '#f59e0b' : undefined} />
            <KeyValueRow label="Duplicate invoice numbers" value={String(val.duplicateInvoiceNumbers.length)} valueColor={val.duplicateInvoiceNumbers.length > 0 ? '#ef4444' : undefined} />
            <KeyValueRow label="Invalid GSTINs" value={String(val.invalidGstins.length)} valueColor={val.invalidGstins.length > 0 ? '#ef4444' : undefined} />
            <KeyValueRow label="Future-dated invoices" value={String(val.futureDatedInvoices.length)} valueColor={val.futureDatedInvoices.length > 0 ? '#f59e0b' : undefined} />
            <KeyValueRow label="Reverse-charge invoices" value={String(val.reverseChargeInvoices.length)} />
            <KeyValueRow label="Exempt / nil-rated invoices" value={String(val.exemptInvoices.length)} />
            <KeyValueRow label="Zero-rated invoices" value={String(val.zeroRatedInvoices.length)} />
            <KeyValueRow label="Export invoices" value={String(val.exportInvoices.length)} />
          </div>

          {/* Top critical issues */}
          {val.issues.filter((i) => i.severity === 'critical').length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="text-xs text-white/60 font-bold uppercase tracking-wide">Top Critical Issues</div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {val.issues
                  .filter((i) => i.severity === 'critical')
                  .slice(0, showAllIssues ? undefined : 5)
                  .map((issue, i) => (
                    <div
                      key={i}
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-white/80">{issue.invoiceNumber}</span>
                        <span className="text-[10px] font-bold uppercase" style={{ color: '#ef4444' }}>{issue.field}</span>
                      </div>
                      <div className="text-white/70">{issue.message}</div>
                    </div>
                  ))}
              </div>
              {val.issues.filter((i) => i.severity === 'critical').length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllIssues((v) => !v)}
                  className="text-xs text-white/60 hover:text-white underline mt-1"
                >
                  {showAllIssues ? 'Show fewer' : `Show all ${val.issues.filter((i) => i.severity === 'critical').length} critical issues`}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Cross-checks */}
        <section>
          <SectionLabel icon={<ShieldCheck className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />} label="Cross-Checks" />
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {calc.crossChecks.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 text-xs"
                style={{ background: i % 2 === 0 ? '#0d0d0d' : '#111111' }}
              >
                <span className="text-white/70">{c.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-white/50 font-mono">{c.expected} / {c.actual}</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                    style={{
                      background: c.match ? 'rgba(37,99,235,0.12)' : 'rgba(239,68,68,0.12)',
                      color: c.match ? '#2563EB' : '#ef4444',
                    }}
                  >
                    {c.match ? 'Pass' : 'Fail'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Oracle insights */}
        {insights.length > 0 && (
          <section>
            <SectionLabel icon={<Sparkles className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />} label="Oracle Insights" />
            <ul className="space-y-1.5 max-h-80 overflow-y-auto">
              {insights.map((insight, i) => (
                <li key={i} className="flex gap-2 text-xs text-white/80">
                  <span style={{ color: '#2563EB' }}>•</span>
                  <span className="leading-relaxed">{insight}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <section>
            <SectionLabel icon={<ArrowRight className="h-3.5 w-3.5" style={{ color: '#a78bfa' }} />} label="Recommended Actions" />
            <ul className="space-y-1.5">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2 text-xs text-white/80">
                  <span style={{ color: '#2563EB' }}>→</span>
                  <span className="leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Download buttons */}
        <section>
          <SectionLabel icon={<Download className="h-3.5 w-3.5" style={{ color: '#3B82F6' }} />} label="Download Report" />
          <div className="flex flex-wrap gap-2">
            <DownloadButton
              format="pdf"
              label="PDF"
              icon={<FileText className="h-3.5 w-3.5" />}
              loading={downloading === 'pdf'}
              disabled={downloading !== null}
              onClick={() => handleDownload('pdf')}
            />
            <DownloadButton
              format="excel"
              label="Excel"
              icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
              loading={downloading === 'excel'}
              disabled={downloading !== null}
              onClick={() => handleDownload('excel')}
            />
            <DownloadButton
              format="csv"
              label="CSV"
              icon={<Table className="h-3.5 w-3.5" />}
              loading={downloading === 'csv'}
              disabled={downloading !== null}
              onClick={() => handleDownload('csv')}
            />
          </div>
          {downloadError && (
            <div className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> {downloadError}
            </div>
          )}
          <div className="mt-1.5 text-[10px] text-white/40">
            Files are generated from the live invoice data shown above — no fake values.
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Report sub-components ──────────────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      {icon}
      <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">{label}</h4>
    </div>
  );
}

function KpiCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{
        borderColor: highlight ? 'rgba(37,99,235,0.4)' : 'rgba(255,255,255,0.06)',
        background: highlight ? 'rgba(37,99,235,0.08)' : '#111111',
      }}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide text-white/50">{label}</div>
      <div className="text-sm font-bold font-mono" style={{ color: highlight ? '#2563EB' : '#ffffff' }}>{value}</div>
    </div>
  );
}

function SlabTable({ rows, itcMode }: { rows: GSTSlabBreakdown[]; itcMode?: boolean }) {
  return (
    <div className="rounded-lg border overflow-hidden overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="grid grid-cols-7 gap-1 px-2 py-1.5 text-[10px] font-bold uppercase text-white/50" style={{ background: '#111111' }}>
        <div>Slab</div>
        <div className="text-right">Count</div>
        <div className="text-right">Taxable</div>
        <div className="text-right">CGST</div>
        <div className="text-right">SGST</div>
        <div className="text-right">IGST</div>
        <div className="text-right">{itcMode ? 'ITC' : 'Tax'}</div>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid grid-cols-7 gap-1 px-2 py-1.5 text-xs font-mono"
          style={{ background: i % 2 === 0 ? '#0d0d0d' : '#111111' }}
        >
          <div className="text-white/80">{r.gstRate}%</div>
          <div className="text-right text-white/60">{r.invoiceCount}</div>
          <div className="text-right text-white">{r.taxableValue.toLocaleString('en-IN')}</div>
          <div className="text-right text-white/70">{r.cgst.toLocaleString('en-IN')}</div>
          <div className="text-right text-white/70">{r.sgst.toLocaleString('en-IN')}</div>
          <div className="text-right text-white/70">{r.igst.toLocaleString('en-IN')}</div>
          <div className="text-right font-bold" style={{ color: '#2563EB' }}>{r.totalTax.toLocaleString('en-IN')}</div>
        </div>
      ))}
    </div>
  );
}

function KeyValueRow({
  label,
  value,
  bold,
  highlight,
  valueColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
  valueColor?: string;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 text-sm"
      style={{
        background: highlight ? '#2563EB' : bold ? 'rgba(255,255,255,0.04)' : 'transparent',
      }}
    >
      <span style={{ color: highlight ? '#ffffff' : 'rgba(255,255,255,0.6)', fontWeight: bold ? 600 : 400 }}>
        {label}
      </span>
      <span
        className="font-mono font-semibold"
        style={{ color: valueColor ?? (highlight ? '#ffffff' : '#ffffff'), fontWeight: bold ? 700 : 600 }}
      >
        {value}
      </span>
    </div>
  );
}

function ContributorRow({
  name,
  gstin,
  count,
  taxable,
  tax,
}: {
  name: string;
  gstin: string | null;
  count: number;
  taxable: number;
  tax: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-white truncate">{name}</div>
        <div className="text-[10px] text-white/40 font-mono truncate">{gstin ?? 'No GSTIN'}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-white/70 font-mono">{count} inv · ₹{taxable.toLocaleString('en-IN')}</div>
        <div className="font-mono font-bold" style={{ color: '#2563EB' }}>₹{tax.toLocaleString('en-IN')}</div>
      </div>
    </div>
  );
}

function TrendingDelta({ percent }: { percent: number }) {
  const up = percent > 0;
  const flat = percent === 0;
  const color = flat ? '#2563EB' : up ? '#f59e0b' : '#2563EB';
  return (
    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${color}20`, color }}>
      {flat ? '→' : up ? '▲' : '▼'} {Math.abs(percent)}%
    </span>
  );
}

function DownloadButton({
  format,
  label,
  icon,
  loading,
  disabled,
  onClick,
}: {
  format: 'pdf' | 'excel' | 'csv';
  label: string;
  icon: React.ReactNode;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const accent = format === 'pdf' ? '#ef4444' : format === 'excel' ? '#2563EB' : '#f59e0b';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ borderColor: `${accent}40`, background: `${accent}10`, color: accent }}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {loading ? 'Generating…' : `Download ${label}`}
    </button>
  );
}

// ─── Single Approval Card ───────────────────────────────────────────────────

function ApprovalCard({
  approval,
  organizationId,
  userId,
  userEmail,
  onExecuted,
}: {
  approval: ApprovalRequest;
  organizationId: string;
  userId: string;
  userEmail: string;
  onExecuted?: () => void;
}) {
  const [status, setStatus] = useState<'pending' | 'executing' | 'executed' | 'failed' | 'rejected'>('pending');
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const card = approval.decisionCard;
  const ToolIcon = TOOL_ICONS[approval.toolIcon] ?? Sparkles;
  const confColor = confidenceColor(card.confidence);
  const hasMissingParams = approval.missingParams.length > 0;

  const handleExecute = useCallback(async () => {
    setStatus('executing');
    setError(null);
    try {
      const res = await fetch('/api/oracle/cfo/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId: approval.approvalId,
          decision: 'approved',
          organizationId,
          userId,
          userEmail,
          // Pass the full approval inline so the server can execute even in
          // preview mode where Firestore reads are denied by security rules.
          approval: {
            toolId: approval.toolId,
            toolName: approval.toolName,
            toolIcon: approval.toolIcon,
            category: approval.category,
            input: approval.input,
            decisionCard: approval.decisionCard,
            createdAt: approval.createdAt,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || 'Execution failed');
      }
      setResult(data.result);
      setStatus(data.success ? 'executed' : 'failed');
      onExecuted?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setStatus('failed');
    }
  }, [approval, organizationId, userId, userEmail, onExecuted]);

  const handleReject = useCallback(async () => {
    setStatus('executing');
    try {
      await fetch('/api/oracle/cfo/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId: approval.approvalId,
          decision: 'rejected',
          organizationId,
          userId,
          userEmail,
        }),
      });
      setStatus('rejected');
    } catch {
      setStatus('rejected');
    }
  }, [approval.approvalId, organizationId, userId, userEmail]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-3 overflow-hidden rounded-xl border"
      style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0a0a0a' }}
    >
      {/* ─── Header ─── */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
        style={{ background: 'rgba(37,99,235,0.04)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.2) 0%, rgba(5,150,105,0.2) 100%)' }}
          >
            <ToolIcon className="h-4 w-4" style={{ color: '#2563EB' }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{approval.toolName}</span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: 'rgba(37,99,235,0.12)', color: '#2563EB' }}
              >
                Oracle CFO
              </span>
            </div>
            <div className="text-xs text-white/50">
              {card.confidence}% confidence · {approval.category}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status === 'executed' && (
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#2563EB' }}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Done
            </span>
          )}
          {status === 'failed' && (
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#ef4444' }}>
              <AlertTriangle className="h-3.5 w-3.5" /> Failed
            </span>
          )}
          {status === 'rejected' && (
            <span className="flex items-center gap-1 text-xs font-semibold text-white/50">
              <X className="h-3.5 w-3.5" /> Rejected
            </span>
          )}
          {status === 'executing' && (
            <span className="flex items-center gap-1 text-xs text-white/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
            </span>
          )}
          {status === 'pending' && (
            <span className="flex items-center gap-1 text-xs text-white/50">
              <Clock className="h-3.5 w-3.5" /> Pending approval
            </span>
          )}
        </div>
      </div>

      {/* ─── Body (expandable) ─── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 space-y-4">
              {/* WHY */}
              <section>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />
                  <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">Why this action</h4>
                </div>
                <p className="text-sm text-white/85 leading-relaxed">{card.why}</p>
              </section>

              {/* SUPPORTING RECORDS */}
              {card.records.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Database className="h-3.5 w-3.5" style={{ color: '#3B82F6' }} />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">Supporting records</h4>
                  </div>
                  <div className="space-y-1.5">
                    {card.records.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2"
                        style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#111111' }}
                      >
                        <div className="text-xs font-mono text-white/40 w-20 shrink-0 truncate">{r.collection}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white truncate">{r.label}</div>
                          <div className="text-xs text-white/50 truncate">{r.detail}</div>
                        </div>
                        <code className="text-[10px] text-white/40 font-mono shrink-0">{r.id.slice(-12)}</code>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* CALCULATION */}
              {card.calculation.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Zap className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">Calculation</h4>
                  </div>
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    {card.calculation.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-1.5 text-sm"
                        style={{ background: i % 2 === 0 ? '#0d0d0d' : '#111111' }}
                      >
                        <span className="text-white/60">{c.label}</span>
                        <span className="font-mono font-semibold text-white">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* CONFIDENCE BREAKDOWN */}
              {card.confidenceFactors.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" style={{ color: confColor }} />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">
                      Confidence: {card.confidence}%
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {card.confidenceFactors.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-white/60 w-48 shrink-0 truncate">{f.label}</span>
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${f.score * 100}%`, background: confidenceColor(f.score * 100) }}
                          />
                        </div>
                        <span className="text-xs font-mono text-white/40 w-10 text-right shrink-0">
                          {Math.round(f.score * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* RISKS */}
              {card.risks.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">Potential risks</h4>
                  </div>
                  <div className="space-y-1.5">
                    {card.risks.map((r, i) => (
                      <div
                        key={i}
                        className="rounded-lg border px-3 py-2"
                        style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#111111' }}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shrink-0"
                            style={{ background: `${riskColor(r.severity)}20`, color: riskColor(r.severity) }}
                          >
                            {r.severity}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm text-white/85">{r.description}</div>
                            {r.mitigation && <div className="text-xs text-white/50 mt-0.5">→ {r.mitigation}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ALTERNATIVES */}
              {card.alternatives.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ArrowRight className="h-3.5 w-3.5" style={{ color: '#a78bfa' }} />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">Alternatives</h4>
                  </div>
                  <div className="space-y-1.5">
                    {card.alternatives.map((a, i) => (
                      <div
                        key={i}
                        className="rounded-lg border px-3 py-2"
                        style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#111111' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{a.title}</span>
                          {a.recommended && (
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                              style={{ background: 'rgba(37,99,235,0.12)', color: '#2563EB' }}
                            >
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/50 mt-0.5">{a.tradeOff}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* MISSING PARAMS WARNING */}
              {hasMissingParams && status === 'pending' && (
                <div
                  className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
                  style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                  <div className="text-sm">
                    <div className="font-semibold text-white">Missing information</div>
                    <div className="text-white/60 text-xs mt-0.5">
                      Some required details weren&apos;t found in your message or live data:{' '}
                      <span className="font-mono text-white/80">{approval.missingParams.join(', ')}</span>.
                      Default values will be used — review before approving.
                    </div>
                  </div>
                </div>
              )}

              {/* RESULT (after execution) */}
              {result && (
                <div
                  className="rounded-lg border px-3 py-3"
                  style={{
                    borderColor: result.success ? 'rgba(37,99,235,0.3)' : 'rgba(239,68,68,0.3)',
                    background: result.success ? 'rgba(37,99,235,0.05)' : 'rgba(239,68,68,0.05)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4" style={{ color: '#2563EB' }} />
                    ) : (
                      <AlertTriangle className="h-4 w-4" style={{ color: '#ef4444' }} />
                    )}
                    <span className="text-sm font-semibold text-white">
                      {result.success ? 'Action executed successfully' : 'Action failed'}
                    </span>
                    <span className="ml-auto text-xs text-white/40 font-mono">{result.executionMs}ms</span>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed">{result.message}</p>
                  {result.recordsAffected.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {result.recordsAffected.map((r, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}
                        >
                          <span style={{ color: r.action === 'created' ? '#2563EB' : r.action === 'updated' ? '#f59e0b' : '#ef4444' }}>
                            {r.action}
                          </span>
                          {r.collection}/{r.id.slice(-8)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* GST REPORT RESULT CARD (Phase 1.2) — shows when generate-gst-report executed */}
              {result?.output?.reportPayload && approval.toolId === 'generate-gst-report' && (
                <ReportResultCard
                  report={result.output.reportPayload as GSTReportPayload}
                  reportId={String(result.output.reportId ?? '')}
                  insights={(result.output.insights as string[]) ?? []}
                  recommendations={(result.output.recommendations as string[]) ?? []}
                />
              )}

              {/* ERROR */}
              {error && (
                <div
                  className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
                  style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                  <div className="text-sm">
                    <div className="font-semibold text-white">Something went wrong</div>
                    <div className="text-white/60 text-xs mt-0.5">{error}</div>
                    <div className="text-white/40 text-xs mt-1">The error has been logged. You can retry safely.</div>
                  </div>
                </div>
              )}

              {/* APPROVAL BUTTONS */}
              {status === 'pending' && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExecute}
                    disabled={status !== 'pending'}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
                  >
                    <Check className="h-4 w-4" />
                    Approve & Execute
                  </button>
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={status !== 'pending'}
                    className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium text-white/70 transition-all hover:text-white hover:bg-white/5 disabled:opacity-50"
                    style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                  <div className="ml-auto flex items-center gap-1 text-xs text-white/40">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Audit logged
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Panel (wraps multiple approval cards) ─────────────────────────────

export function CFOAssistantPanel({
  approvalRequests,
  organizationId,
  userId,
  userEmail,
  onExecuted,
}: CFOAssistantPanelProps) {
  if (approvalRequests.length === 0) return null;

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {approvalRequests.map((approval) => (
          <ApprovalCard
            key={approval.approvalId}
            approval={approval}
            organizationId={organizationId}
            userId={userId}
            userEmail={userEmail}
            onExecuted={onExecuted}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
