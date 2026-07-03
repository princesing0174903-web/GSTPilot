'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Download,
  FileText,
  FileJson,
  FileSpreadsheet,
  Package,
  Eye,
  Clock,
  Search,
  Trash2,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wallet,
  BarChart3,
  Printer,
} from 'lucide-react';
import {
  Invoice,
  GSTRFiling,
  GSTR1Section,
  GSTR1_SECTION_LABELS,
  Client,
} from '@/types/gst';
import { formatCurrency, formatNumber, periodToLabel } from '@/lib/gst-utils';
import {
  useFireReturns,
  useFireReconciliations,
  useLiveDashboardMetrics,
  useFireReports,
} from '@/hooks/use-firestore';
import { useInvoices } from '@/hooks/useInvoices';
import { createReport, deleteReport } from '@/lib/firestore-service';
import type {
  FirestoreReturn,
  FirestoreReconciliation,
  FirestoreReport,
  ReportType,
  ReportFormat,
} from '@/lib/firestore-schema';
import { EmptyState } from '@/components/shared';
import { Database } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SectionPreview {
  section: GSTR1Section;
  invoiceCount: number;
  taxableValue: number;
  totalTax: number;
}

interface RecentExport {
  id: string;
  exportType: string;
  clientName: string;
  period: string;
  generatedAt: string;
  fileSize: string;
  fileType: string;
  data?: unknown;
  firestoreId?: string | null; // P1-M2: linked Firestore report id for delete-sync
  storageUrl?: string | null;  // P1-M2: data: URL for JSON reports (re-download)
}

interface ClientOption {
  id: string;
  tradeName: string;
  gstin: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SECTION_KEYS: GSTR1Section[] = ['b2b', 'b2cl', 'b2cs', 'cdnr', 'cdnur', 'exp'];

const EXPORT_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  'GSTR-1 JSON': { label: 'GSTR-1 JSON', icon: <FileJson className="size-5" />, color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  'GSTR-1 Excel': { label: 'GSTR-1 Excel', icon: <FileSpreadsheet className="size-5" />, color: 'text-amber-700', bgColor: 'bg-amber-50' },
  'Filing Summary PDF': { label: 'Filing Summary PDF', icon: <FileText className="size-5" />, color: 'text-red-700', bgColor: 'bg-red-50' },
  'Working Papers PDF': { label: 'Working Papers PDF', icon: <FileText className="size-5" />, color: 'text-purple-700', bgColor: 'bg-purple-50' },
  'GST Summary PDF': { label: 'GST Summary PDF', icon: <FileText className="size-5" />, color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  'Compliance Report PDF': { label: 'Compliance Report PDF', icon: <FileText className="size-5" />, color: 'text-blue-700', bgColor: 'bg-blue-50' },
  'Financial Report PDF': { label: 'Financial Report PDF', icon: <FileText className="size-5" />, color: 'text-purple-700', bgColor: 'bg-purple-50' },
  'Cash Flow Report PDF': { label: 'Cash Flow Report PDF', icon: <FileText className="size-5" />, color: 'text-teal-700', bgColor: 'bg-teal-50' },
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Report Type Mapping (P1-M2: localStorage exportType → Firestore ReportType/ReportFormat) ────

const EXPORT_TYPE_TO_REPORT_TYPE: Record<string, ReportType> = {
  'GSTR-1 JSON': 'gstr1_json',
  'GSTR-1 Excel': 'gstr1_excel',
  'Filing Summary PDF': 'filing_summary_pdf',
  'Working Papers PDF': 'working_papers_pdf',
  'GST Summary PDF': 'gst_summary_pdf',
  'Compliance Report PDF': 'compliance_report_pdf',
  'Financial Report PDF': 'financial_report_pdf',
  'Cash Flow Report PDF': 'cash_flow_report_pdf',
};

function mapFileTypeToReportFormat(fileType: string): ReportFormat {
  if (fileType === 'json') return 'json';
  if (fileType === 'pdf') return 'pdf';
  if (fileType === 'csv') return 'csv';
  return 'json';
}

function parseFileSizeBytes(fileSize: string): number {
  // Accept formats like "12.3 KB", "1.5 MB", or "PDF" (non-numeric → 0)
  const match = fileSize.match(/([\d.]+)\s*(KB|MB|GB)?/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = (match[2] ?? '').toUpperCase();
  if (unit === 'KB') return Math.round(num * 1024);
  if (unit === 'MB') return Math.round(num * 1024 * 1024);
  if (unit === 'GB') return Math.round(num * 1024 * 1024 * 1024);
  return Math.round(num);
}

// ─── Report History (localStorage — Oracle-style persistence) ──────────────────

const HISTORY_KEY = 'gstpilot:reports-history-v1';
const HISTORY_LIMIT = 25;

function loadHistory(): RecentExport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function saveHistory(items: RecentExport[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
  } catch {
    /* ignore quota errors */
  }
}

// ─── PDF Export (print-window approach — no heavy deps) ────────────────────────

interface PdfSection {
  heading: string;
  rows: Array<{ label: string; value: string }>;
}

interface PdfTable {
  heading: string;
  columns: string[];
  rows: string[][];
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPdfHtml(opts: {
  title: string;
  subtitle?: string;
  generatedAt: string;
  sections?: PdfSection[];
  tables?: PdfTable[];
}): string {
  const { title, subtitle, generatedAt, sections = [], tables = [] } = opts;
  const sectionHtml = sections.map((sec) => `
    <section class="block">
      <h2>${escapeHtml(sec.heading)}</h2>
      <table class="kv">
        <tbody>
          ${sec.rows.map((r) => `
            <tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `).join('');

  const tableHtml = tables.map((t) => `
    <section class="block">
      <h2>${escapeHtml(t.heading)}</h2>
      <table class="grid">
        <thead><tr>${t.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
        <tbody>
          ${t.rows.length === 0
            ? `<tr><td colspan="${t.columns.length}" class="empty">No records</td></tr>`
            : t.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </section>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; }
    .header { border-bottom: 3px solid #10b981; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-mark { width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #10b981, #14b8a6); display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 16px; }
    .brand-name { font-size: 18px; font-weight: 700; color: #10b981; letter-spacing: -0.01em; }
    .brand-tag { font-size: 11px; color: #64748b; margin-top: 2px; }
    h1 { font-size: 22px; margin: 14px 0 4px; color: #0f172a; }
    .subtitle { font-size: 13px; color: #64748b; margin: 0 0 6px; }
    .meta { font-size: 11px; color: #94a3b8; }
    .block { margin-bottom: 22px; page-break-inside: avoid; }
    h2 { font-size: 14px; color: #0f172a; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.04em; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.kv th { text-align: left; width: 45%; padding: 7px 10px; color: #475569; font-weight: 500; background: #f8fafc; border: 1px solid #e2e8f0; }
    table.kv td { padding: 7px 10px; color: #0f172a; font-weight: 600; border: 1px solid #e2e8f0; }
    table.grid th { text-align: left; padding: 8px 10px; background: #ecfdf5; color: #047857; font-weight: 600; border: 1px solid #a7f3d0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
    table.grid td { padding: 7px 10px; color: #0f172a; border: 1px solid #e2e8f0; }
    table.grid tr:nth-child(even) td { background: #f8fafc; }
    .empty { text-align: center; color: #94a3b8; font-style: italic; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
    @media print {
      body { padding: 18px; }
      .block { page-break-inside: avoid; }
      @page { margin: 14mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <span class="brand-mark">∞</span>
      <div>
        <div class="brand-name">GSTPilot™ Infinity</div>
        <div class="brand-tag">The Financial Brain of India™</div>
      </div>
    </div>
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
    <p class="meta">Generated: ${escapeHtml(generatedAt)}</p>
  </div>
  ${sectionHtml}
  ${tableHtml}
  <div class="footer">Confidential — GSTPilot™ Infinity Report Engine • ${escapeHtml(generatedAt)}</div>
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 250);
    };
  </script>
</body>
</html>`;
}

function openPrintWindow(html: string): boolean {
  if (typeof window === 'undefined') return false;
  const printWindow = window.open('', '_blank', 'width=900,height=720');
  if (!printWindow) {
    // Pop-up blocked — fall back to writing into a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return false;
    }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      try { iframe.contentWindow?.print(); } catch { /* ignore */ }
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 400);
    return true;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  return true;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ReportsPage() {
  // ─── State ────────────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filings, setFilings] = useState<GSTRFiling[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const m = new Date().getMonth() + 1;
    return m.toString().padStart(2, '0');
  });
  const [selectedYear, setSelectedYear] = useState<string>(() =>
    new Date().getFullYear().toString()
  );
  const [returnType, setReturnType] = useState<string>('GSTR-1');
  const [includeSections, setIncludeSections] = useState<Record<GSTR1Section, boolean>>({
    b2b: true,
    b2cl: true,
    b2cs: true,
    cdnr: true,
    cdnur: true,
    exp: true,
  });

  const [recentExports, setRecentExports] = useState<RecentExport[]>(() => loadHistory());
  const [generating, setGenerating] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<RecentExport | null>(null);
  const [activeTab, setActiveTab] = useState<string>('export');

  // ─── Live data sources for category tabs ────────────────────────────────
  // Real Invoice Engine™ — org-scoped, real-time invoices + aggregated stats.
  // Replaces the legacy firmId-scoped useFireInvoices() hook so every revenue,
  // sales, GST-summary, outstanding, and cash-flow figure on this page reflects
  // the live invoice collection for the current organization.
  const { invoices: engineInvoices, stats: invoiceStats, loading: engineLoading } = useInvoices();
  // Non-invoice live data (returns, reconciliations, dashboard metrics) — kept as-is
  // per the directive: only invoice-derived values switch to the real engine.
  const fireReturnsQ = useFireReturns();
  const fireReconsQ = useFireReconciliations();
  const { metrics: liveMetrics } = useLiveDashboardMetrics();

  const fireReturns = (fireReturnsQ.data ?? []) as Array<FirestoreReturn & { id?: string }>;
  const fireRecons = (fireReconsQ.data ?? []) as Array<FirestoreReconciliation & { id?: string }>;

  // ─── Persist Report History to localStorage ──────────────────────────────
  useEffect(() => {
    saveHistory(recentExports);
  }, [recentExports]);

  // ─── Data Fetching ────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [invoicesRes, filingsRes] = await Promise.all([
          fetch('/api/invoices'),
          fetch('/api/gstr-filing'),
        ]);

        if (invoicesRes.ok) {
          const invData = await invoicesRes.json();
          setInvoices(invData.invoices ?? invData ?? []);
        }
        if (filingsRes.ok) {
          const filData = await filingsRes.json();
          setFilings(filData.filings ?? filData ?? []);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Extract clients (from old invoices API, the Real Invoice Engine™, and filings)
  useEffect(() => {
    const clientMap = new Map<string, ClientOption>();
    invoices.forEach((inv) => {
      if (inv.client && !clientMap.has(inv.clientId)) {
        clientMap.set(inv.clientId, {
          id: inv.clientId,
          tradeName: inv.client.tradeName,
          gstin: inv.client.gstin,
        });
      }
    });
    // Real Invoice Engine™ — customers may not exist in the legacy /api/invoices
    // payload; include them so the client filter works against engine invoices too.
    engineInvoices.forEach((inv) => {
      if (inv.customerId && !clientMap.has(inv.customerId)) {
        clientMap.set(inv.customerId, {
          id: inv.customerId,
          tradeName: inv.customerName,
          gstin: inv.customerGstin ?? '',
        });
      }
    });
    filings.forEach((f) => {
      if (f.client && !clientMap.has(f.clientId)) {
        clientMap.set(f.clientId, {
          id: f.clientId,
          tradeName: f.client.tradeName,
          gstin: f.client.gstin,
        });
      }
    });
    setClients(Array.from(clientMap.values()));
  }, [invoices, engineInvoices, filings]);

  // ─── Derived Data ─────────────────────────────────────────────────────────
  const selectedPeriod = `${selectedYear}-${selectedMonth}`;

  // ─── Export Preview filter — driven by the Real Invoice Engine™ ──────────
  // Real engine invoices are all B2B (inter-state → IGST, intra-state → CGST+SGST),
  // so every engine invoice maps to GSTR-1 section 'b2b'. Period is derived from
  // invoiceDate (YYYY-MM-DD → YYYY-MM) to match the selected YYYY-MM period.
  const filteredInvoices = engineInvoices.filter((inv) => {
    if (selectedClientId !== 'all' && inv.customerId !== selectedClientId) return false;
    const invPeriod = inv.invoiceDate.slice(0, 7);
    if (invPeriod !== selectedPeriod) return false;
    if (!includeSections.b2b) return false;
    return true;
  });

  const sectionPreviews: SectionPreview[] = SECTION_KEYS
    .filter((s) => includeSections[s])
    .map((section) => {
      // Real engine invoices all map to 'b2b'; other sections stay empty.
      const sectionInvoices = section === 'b2b' ? filteredInvoices : [];
      return {
        section,
        invoiceCount: sectionInvoices.length,
        taxableValue: sectionInvoices.reduce((sum, inv) => sum + inv.taxableValue, 0),
        totalTax: sectionInvoices.reduce((sum, inv) => sum + inv.cgst + inv.sgst + inv.igst, 0),
      };
    });

  const totalTaxableValue = filteredInvoices.reduce((sum, inv) => sum + inv.taxableValue, 0);
  const totalTax = filteredInvoices.reduce((sum, inv) => sum + inv.cgst + inv.sgst + inv.igst, 0);
  const totalInvoices = filteredInvoices.length;

  const matchedFiling = filings.find(
    (f) =>
      (selectedClientId === 'all' || f.clientId === selectedClientId) &&
      f.period === selectedPeriod &&
      f.returnType === returnType
  );

  const clientNameFor = (id: string) =>
    id === 'all'
      ? 'All Clients'
      : clients.find((c) => c.id === id)?.tradeName ?? 'Unknown';

  // ─── Firestore-derived category summaries ─────────────────────────────────

  // GST Reports: GSTR-1 + GSTR-3B summaries.
  // Output tax liability is derived from the Real Invoice Engine™ (org-scoped).
  // Drafts and cancelled invoices are excluded — they don't represent real output tax.
  const gstSummary = useMemo(() => {
    const gstr1Returns = fireReturns.filter((r) => r.returnType === 'GSTR-1');
    const gstr3bReturns = fireReturns.filter((r) => r.returnType === 'GSTR-3B');
    const activeInvoices = engineInvoices.filter(
      (i) => i.status !== 'draft' && i.status !== 'cancelled',
    );
    const outputTax = activeInvoices.reduce(
      (s, i) => s + i.cgst + i.sgst + i.igst + i.cess,
      0,
    );
    const outputTaxable = activeInvoices.reduce((s, i) => s + i.taxableValue, 0);
    const gstr1Filed = gstr1Returns.filter((r) => r.status === 'filed').length;
    const gstr3bFiled = gstr3bReturns.filter((r) => r.status === 'filed').length;
    return {
      gstr1Total: gstr1Returns.length,
      gstr1Filed,
      gstr1Pending: gstr1Returns.length - gstr1Filed,
      gstr3bTotal: gstr3bReturns.length,
      gstr3bFiled,
      gstr3bPending: gstr3bReturns.length - gstr3bFiled,
      outputTaxable,
      outputTax,
    };
  }, [fireReturns, engineInvoices]);

  // Compliance Reports: filing compliance + match rates + issues
  const complianceSummary = useMemo(() => {
    const totalReturns = fireReturns.length;
    const filedReturns = fireReturns.filter((r) => r.status === 'filed').length;
    // Per FilingStatus type ('draft' | 'prepared' | 'validated' | 'reviewed' | 'generated' | 'filed' | 'reopened'),
    // 'overdue' is not a status — we treat non-filed returns as pending/overdue for the report.
    const draftReturns = fireReturns.filter((r) => r.status === 'draft').length;
    const overdueReturns = fireReturns.filter((r) =>
      r.status === 'reopened' || (r.status !== 'filed' && r.status !== 'draft'),
    ).length;
    const filingRate = totalReturns > 0 ? Math.round((filedReturns / totalReturns) * 100) : 0;
    const reconTotal = fireRecons.reduce((s, r) => s + (r.totalRecords || 0), 0);
    const reconMatched = fireRecons.reduce((s, r) => s + (r.matched || 0), 0);
    const matchRate = reconTotal > 0 ? Math.round((reconMatched / reconTotal) * 100) : 0;
    const reconHighRisk = fireRecons.reduce((s, r) => s + (r.highRisk || 0), 0);
    return {
      totalReturns,
      filedReturns,
      overdueReturns,
      draftReturns,
      filingRate,
      matchRate,
      reconHighRisk,
      reconCount: fireRecons.length,
      avgHealth: liveMetrics.averageHealthScore,
      criticalIssues: liveMetrics.criticalIssues,
      warnings: liveMetrics.warnings,
    };
  }, [fireReturns, fireRecons, liveMetrics]);

  // Financial Reports: revenue + tax volumes from the Real Invoice Engine™.
  // Drafts and cancelled invoices are excluded from financial totals.
  const financialSummary = useMemo(() => {
    const active = engineInvoices.filter((i) => i.status !== 'draft' && i.status !== 'cancelled');
    const totalRevenue = active.reduce((s, i) => s + i.grandTotal, 0);
    const totalTaxVolume = active.reduce((s, i) => s + i.cgst + i.sgst + i.igst + i.cess, 0);
    const totalTaxable = active.reduce((s, i) => s + i.taxableValue, 0);
    const igstTotal = active.reduce((s, i) => s + i.igst, 0);
    const cgstTotal = active.reduce((s, i) => s + i.cgst, 0);
    const sgstTotal = active.reduce((s, i) => s + i.sgst, 0);
    const cessTotal = active.reduce((s, i) => s + i.cess, 0);
    const bySection = SECTION_KEYS.map((sec) => {
      // Real engine invoices are all B2B (inter-state → IGST, intra-state → CGST+SGST).
      const secInvoices = sec === 'b2b' ? active : [];
      return {
        section: sec,
        count: secInvoices.length,
        taxable: secInvoices.reduce((s, i) => s + i.taxableValue, 0),
        tax: secInvoices.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0),
      };
    });
    return {
      totalRevenue,
      totalTaxVolume,
      totalTaxable,
      igstTotal,
      cgstTotal,
      sgstTotal,
      cessTotal,
      bySection,
      invoiceCount: active.length,
    };
  }, [engineInvoices]);

  // Cash Flow Reports: reconciliation-based analysis + Real Invoice Engine™ cash flow.
  // Inflow = total collected (paid amounts), Outstanding = unpaid balance, Overdue = past-due.
  // The reconciliation-derived metrics (totalRecords / matched / unmatched / etc.) are
  // preserved so the on-page cards stay exactly the same; the invoice-derived metrics
  // (inflow / outstanding / overdue / invoiceCount) flow into the Cash Flow PDF report.
  const cashFlowSummary = useMemo(() => {
    const totalRecords = fireRecons.reduce((s, r) => s + (r.totalRecords || 0), 0);
    const matched = fireRecons.reduce((s, r) => s + (r.matched || 0), 0);
    const unmatched = fireRecons.reduce((s, r) => s + (r.unmatched || 0), 0);
    const partial = fireRecons.reduce((s, r) => s + (r.partialMatches || 0), 0);
    const highRisk = fireRecons.reduce((s, r) => s + (r.highRisk || 0), 0);
    const itcDifference = fireRecons.reduce((s, r) => s + (r.gstDifference || 0), 0);
    const matchRate = totalRecords > 0 ? Math.round((matched / totalRecords) * 100) : 0;
    const byRecon = fireRecons.slice(0, 10).map((r) => ({
      sources: r.sources,
      period: r.period,
      status: r.status,
      total: r.totalRecords,
      matched: r.matched,
      itcDiff: r.gstDifference,
    }));
    // Invoice-engine-derived cash flow metrics (org-scoped, real-time).
    const inflow = invoiceStats.totalCollected;
    const outstanding = invoiceStats.totalOutstanding;
    const overdue = invoiceStats.totalOverdue;
    const invoiceCount = invoiceStats.count;
    return {
      totalRecords,
      matched,
      unmatched,
      partial,
      highRisk,
      itcDifference,
      matchRate,
      byRecon,
      inflow,
      outstanding,
      overdue,
      invoiceCount,
    };
  }, [fireRecons, invoiceStats]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const toggleSection = (section: GSTR1Section) => {
    setIncludeSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // P1-M2: Live Firestore subscription for SAVED REPORTS (canonical source going
  // forward). localStorage history is kept as a secondary list for back-compat.
  const fireReportsQ = useFireReports();
  const savedReports: Array<FirestoreReport & { id: string }> = fireReportsQ.data ?? [];

  // P1-M2: persist every report generation to Firestore as a `reports` doc.
  // Failures are logged via toast but do NOT block the export (the user's
  // downloaded file is already on disk). The returned firestoreId is stored
  // back onto the RecentExport so we can sync deletes later.
  const persistReportToFirestore = useCallback(async (exp: RecentExport): Promise<string | null> => {
    try {
      const reportType = EXPORT_TYPE_TO_REPORT_TYPE[exp.exportType] ?? 'custom';
      const format = mapFileTypeToReportFormat(exp.fileType);
      // For JSON exports, store the data as a data: URL so the user can re-download
      // the exact payload later. Skip for PDFs (HTML payload too large to persist).
      let storageUrl: string | null = null;
      if (exp.data && format === 'json') {
        try {
          const jsonStr = JSON.stringify(exp.data);
          // Firestore docs are capped at 1MB — guard against oversized payloads.
          if (jsonStr.length < 900_000) {
            storageUrl = `data:application/json;base64,${btoa(unescape(encodeURIComponent(jsonStr)))}`;
          }
        } catch { /* ignore encoding errors */ }
      }
      const reportId = await createReport({
        clientId: null,
        clientTradeName: exp.clientName,
        reportType,
        format,
        title: exp.exportType,
        period: exp.period,
        description: `Generated via ${exp.exportType} export`,
        status: 'ready',
        fileSize: parseFileSizeBytes(exp.fileSize),
        storageUrl,
        generatedBy: 'system',
        generatedAt: new Date(exp.generatedAt).toISOString(),
        metadata: {
          exportType: exp.exportType,
          clientName: exp.clientName,
          period: exp.period,
          fileType: exp.fileType,
          fileSizeLabel: exp.fileSize,
        },
      });
      return reportId;
    } catch (err) {
      console.error('Failed to persist report to Firestore:', err);
      toast.error('Report saved to local history but failed to sync to Firestore');
      return null;
    }
  }, []);

  const addRecentExport = useCallback((exp: RecentExport) => {
    // P1-M2: persist to Firestore in the background; attach the returned id
    // back onto the localStorage entry so deletes stay in sync.
    void persistReportToFirestore(exp).then((firestoreId) => {
      if (firestoreId) {
        setRecentExports((prev) =>
          prev.map((e) => (e.id === exp.id ? { ...e, firestoreId } : e))
        );
      }
    });
    setRecentExports((prev) => [exp, ...prev].slice(0, HISTORY_LIMIT));
  }, [persistReportToFirestore]);

  const handleGenerateJSON = async () => {
    setGenerating('json');
    try {
      const body: Record<string, string> = { type: 'json' };
      if (matchedFiling) body.filingId = matchedFiling.id;
      if (selectedClientId !== 'all') body.clientId = selectedClientId;

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Export failed');

      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR1_${selectedPeriod}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addRecentExport({
        id: crypto.randomUUID(),
        exportType: 'GSTR-1 JSON',
        clientName: clientNameFor(selectedClientId),
        period: periodToLabel(selectedPeriod),
        generatedAt: new Date().toISOString(),
        fileSize: `${(JSON.stringify(data).length / 1024).toFixed(1)} KB`,
        fileType: 'json',
        data,
      });
    } catch (err) {
      console.error('JSON export error:', err);
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateExcel = async () => {
    setGenerating('csv');
    try {
      const body: Record<string, string> = { type: 'csv' };
      if (matchedFiling) body.filingId = matchedFiling.id;
      if (selectedClientId !== 'all') body.clientId = selectedClientId;

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Export failed');

      const csvText = await res.text();
      const blob = new Blob([csvText], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR1_${selectedPeriod}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addRecentExport({
        id: crypto.randomUUID(),
        exportType: 'GSTR-1 Excel',
        clientName: clientNameFor(selectedClientId),
        period: periodToLabel(selectedPeriod),
        generatedAt: new Date().toISOString(),
        fileSize: `${(csvText.length / 1024).toFixed(1)} KB`,
        fileType: 'csv',
      });
    } catch (err) {
      console.error('Excel export error:', err);
    } finally {
      setGenerating(null);
    }
  };

  // ─── PDF EXPORT (RESTORED — print-to-PDF via window.print) ──────────────────
  // Previously this downloaded a JSON file disguised as a "PDF". Now it opens a
  // clean, print-optimized report window. The browser's native Print dialog lets
  // the user "Save as PDF" — no heavy dependencies required.
  const handleGeneratePDF = async () => {
    setGenerating('report');
    try {
      const body: Record<string, string> = { type: 'report' };
      if (selectedClientId !== 'all') body.clientId = selectedClientId;

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Report generation failed');

      const data = await res.json() as {
        summary?: Record<string, number | string>;
        clients?: Array<Record<string, unknown>>;
        filings?: Array<Record<string, unknown>>;
      };

      const clientName = clientNameFor(selectedClientId);
      const generatedAt = new Date().toLocaleString('en-IN');

      const sections: PdfSection[] = [];
      if (data.summary) {
        sections.push({
          heading: 'Filing Summary',
          rows: Object.entries(data.summary).map(([k, v]) => ({
            label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
            value: typeof v === 'number' ? formatNumber(v) : String(v),
          })),
        });
      }

      const tables: PdfTable[] = [];
      if (Array.isArray(data.clients) && data.clients.length > 0) {
        tables.push({
          heading: 'Client Breakdown',
          columns: ['Trade Name', 'GSTIN', 'Health Score', 'Invoices', 'Filings'],
          rows: data.clients.slice(0, 50).map((c) => [
            String(c.tradeName ?? ''),
            String(c.gstin ?? ''),
            String(c.healthScore ?? ''),
            String(c.invoiceCount ?? ''),
            String(c.filingCount ?? ''),
          ]),
        });
      }
      if (Array.isArray(data.filings) && data.filings.length > 0) {
        tables.push({
          heading: 'Filing Breakdown',
          columns: ['Client', 'Return Type', 'Period', 'Status', 'Taxable Value', 'Total Tax'],
          rows: data.filings.slice(0, 50).map((f) => [
            String(f.clientName ?? ''),
            String(f.returnType ?? ''),
            String(f.period ?? ''),
            String(f.status ?? ''),
            formatCurrency(Number(f.totalTaxableValue ?? 0)),
            formatCurrency(Number(f.totalTax ?? 0)),
          ]),
        });
      }

      const html = buildPdfHtml({
        title: 'Filing Summary Report',
        subtitle: `${clientName} — ${periodToLabel(selectedPeriod)}`,
        generatedAt,
        sections,
        tables,
      });

      const ok = openPrintWindow(html);
      if (!ok) {
        alert('Pop-up blocked. Please allow pop-ups for GSTPilot to export PDF reports.');
        return;
      }

      addRecentExport({
        id: crypto.randomUUID(),
        exportType: 'Filing Summary PDF',
        clientName,
        period: periodToLabel(selectedPeriod),
        generatedAt: new Date().toISOString(),
        fileSize: 'PDF',
        fileType: 'pdf',
        data,
      });
    } catch (err) {
      console.error('PDF report error:', err);
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateWorkingPapers = async () => {
    setGenerating('working-papers');
    try {
      const body: Record<string, string> = { type: 'report' };
      if (selectedClientId !== 'all') body.clientId = selectedClientId;

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Working papers generation failed');

      const data = await res.json() as {
        summary?: Record<string, number | string>;
        clients?: Array<Record<string, unknown>>;
        filings?: Array<Record<string, unknown>>;
      };

      const clientName = clientNameFor(selectedClientId);
      const generatedAt = new Date().toLocaleString('en-IN');

      // Working papers = detailed section-by-section tax computation
      const sections: PdfSection[] = [
        {
          heading: 'Working Paper — Overview',
          rows: [
            { label: 'Client', value: clientName },
            { label: 'Period', value: periodToLabel(selectedPeriod) },
            { label: 'Total Invoices (in selection)', value: formatNumber(totalInvoices) },
            { label: 'Total Taxable Value', value: formatCurrency(totalTaxableValue) },
            { label: 'Total Tax (Output)', value: formatCurrency(totalTax) },
          ],
        },
      ];
      if (data.summary) {
        sections.push({
          heading: 'Firm-Wide Summary',
          rows: Object.entries(data.summary).map(([k, v]) => ({
            label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
            value: typeof v === 'number' ? formatNumber(v) : String(v),
          })),
        });
      }

      const tables: PdfTable[] = [
        {
          heading: 'Section-wise Tax Computation',
          columns: ['Section', 'Invoices', 'Taxable Value', 'Total Tax'],
          rows: sectionPreviews.map((sp) => [
            GSTR1_SECTION_LABELS[sp.section] ?? sp.section.toUpperCase(),
            formatNumber(sp.invoiceCount),
            formatCurrency(sp.taxableValue),
            formatCurrency(sp.totalTax),
          ]),
        },
      ];
      if (Array.isArray(data.filings) && data.filings.length > 0) {
        tables.push({
          heading: 'Filing Reconciliation',
          columns: ['Client', 'Return Type', 'Period', 'Status', 'Taxable Value', 'Total Tax'],
          rows: data.filings.slice(0, 50).map((f) => [
            String(f.clientName ?? ''),
            String(f.returnType ?? ''),
            String(f.period ?? ''),
            String(f.status ?? ''),
            formatCurrency(Number(f.totalTaxableValue ?? 0)),
            formatCurrency(Number(f.totalTax ?? 0)),
          ]),
        });
      }

      const html = buildPdfHtml({
        title: 'GST Working Papers',
        subtitle: `${clientName} — ${periodToLabel(selectedPeriod)}`,
        generatedAt,
        sections,
        tables,
      });

      const ok = openPrintWindow(html);
      if (!ok) {
        alert('Pop-up blocked. Please allow pop-ups for GSTPilot to export PDF reports.');
        return;
      }

      addRecentExport({
        id: crypto.randomUUID(),
        exportType: 'Working Papers PDF',
        clientName,
        period: periodToLabel(selectedPeriod),
        generatedAt: new Date().toISOString(),
        fileSize: 'PDF',
        fileType: 'pdf',
        data,
      });
    } catch (err) {
      console.error('Working papers error:', err);
    } finally {
      setGenerating(null);
    }
  };

  // ─── Category-tab PDF generators (use live Firestore data) ─────────────────

  const handlePrintGSTSummary = () => {
    setGenerating('gst-pdf');
    try {
      const generatedAt = new Date().toLocaleString('en-IN');
      const html = buildPdfHtml({
        title: 'GST Summary Report',
        subtitle: 'GSTR-1 & GSTR-3B Filing Status',
        generatedAt,
        sections: [
          {
            heading: 'GSTR-1 Filings',
            rows: [
              { label: 'Total GSTR-1 Returns', value: formatNumber(gstSummary.gstr1Total) },
              { label: 'Filed', value: formatNumber(gstSummary.gstr1Filed) },
              { label: 'Pending', value: formatNumber(gstSummary.gstr1Pending) },
            ],
          },
          {
            heading: 'GSTR-3B Filings',
            rows: [
              { label: 'Total GSTR-3B Returns', value: formatNumber(gstSummary.gstr3bTotal) },
              { label: 'Filed', value: formatNumber(gstSummary.gstr3bFiled) },
              { label: 'Pending', value: formatNumber(gstSummary.gstr3bPending) },
            ],
          },
          {
            heading: 'Output Tax Liability',
            rows: [
              { label: 'Total Taxable Value', value: formatCurrency(gstSummary.outputTaxable) },
              { label: 'Total Output Tax', value: formatCurrency(gstSummary.outputTax) },
            ],
          },
        ],
        tables: [
          {
            heading: 'Recent GSTR-1 & GSTR-3B Returns',
            columns: ['Return Type', 'Period', 'Status', 'Taxable Value', 'Total Tax'],
            rows: fireReturns.slice(0, 30).map((r) => [
              r.returnType,
              r.period,
              r.status,
              formatCurrency(r.totalTaxableValue || 0),
              formatCurrency(r.totalTax || 0),
            ]),
          },
        ],
      });
      const ok = openPrintWindow(html);
      if (!ok) {
        alert('Pop-up blocked. Please allow pop-ups for GSTPilot to export PDF reports.');
        return;
      }
      addRecentExport({
        id: crypto.randomUUID(),
        exportType: 'GST Summary PDF',
        clientName: 'All Clients',
        period: periodToLabel(selectedPeriod),
        generatedAt: new Date().toISOString(),
        fileSize: 'PDF',
        fileType: 'pdf',
      });
    } finally {
      setGenerating(null);
    }
  };

  const handlePrintCompliance = () => {
    setGenerating('compliance-pdf');
    try {
      const generatedAt = new Date().toLocaleString('en-IN');
      const html = buildPdfHtml({
        title: 'Compliance Report',
        subtitle: 'Filing Compliance & ITC Reconciliation Status',
        generatedAt,
        sections: [
          {
            heading: 'Filing Compliance',
            rows: [
              { label: 'Total Returns', value: formatNumber(complianceSummary.totalReturns) },
              { label: 'Filed', value: formatNumber(complianceSummary.filedReturns) },
              { label: 'Draft', value: formatNumber(complianceSummary.draftReturns) },
              { label: 'Overdue', value: formatNumber(complianceSummary.overdueReturns) },
              { label: 'Filing Rate', value: `${complianceSummary.filingRate}%` },
            ],
          },
          {
            heading: 'ITC Reconciliation',
            rows: [
              { label: 'Reconciliation Runs', value: formatNumber(complianceSummary.reconCount) },
              { label: 'Match Rate', value: `${complianceSummary.matchRate}%` },
              { label: 'High-Risk Records', value: formatNumber(complianceSummary.reconHighRisk) },
            ],
          },
          {
            heading: 'Risk & Issues',
            rows: [
              { label: 'Average Health Score', value: formatNumber(complianceSummary.avgHealth) },
              { label: 'Critical Issues', value: formatNumber(complianceSummary.criticalIssues) },
              { label: 'Warnings', value: formatNumber(complianceSummary.warnings) },
            ],
          },
        ],
      });
      const ok = openPrintWindow(html);
      if (!ok) {
        alert('Pop-up blocked. Please allow pop-ups for GSTPilot to export PDF reports.');
        return;
      }
      addRecentExport({
        id: crypto.randomUUID(),
        exportType: 'Compliance Report PDF',
        clientName: 'All Clients',
        period: periodToLabel(selectedPeriod),
        generatedAt: new Date().toISOString(),
        fileSize: 'PDF',
        fileType: 'pdf',
      });
    } finally {
      setGenerating(null);
    }
  };

  const handlePrintFinancial = () => {
    setGenerating('financial-pdf');
    try {
      const generatedAt = new Date().toLocaleString('en-IN');
      const html = buildPdfHtml({
        title: 'Financial Summary Report',
        subtitle: 'Revenue, Tax Liability & Section-wise Breakdown',
        generatedAt,
        sections: [
          {
            heading: 'Financial Overview',
            rows: [
              { label: 'Total Invoices', value: formatNumber(financialSummary.invoiceCount) },
              { label: 'Total Revenue', value: formatCurrency(financialSummary.totalRevenue) },
              { label: 'Total Taxable Value', value: formatCurrency(financialSummary.totalTaxable) },
              { label: 'Total Tax Volume', value: formatCurrency(financialSummary.totalTaxVolume) },
            ],
          },
          {
            heading: 'Tax Component Breakdown',
            rows: [
              { label: 'CGST', value: formatCurrency(financialSummary.cgstTotal) },
              { label: 'SGST', value: formatCurrency(financialSummary.sgstTotal) },
              { label: 'IGST', value: formatCurrency(financialSummary.igstTotal) },
              { label: 'Cess', value: formatCurrency(financialSummary.cessTotal) },
            ],
          },
        ],
        tables: [
          {
            heading: 'Section-wise Financial Breakdown',
            columns: ['Section', 'Invoice Count', 'Taxable Value', 'Tax Amount'],
            rows: financialSummary.bySection.map((s) => [
              GSTR1_SECTION_LABELS[s.section] ?? s.section.toUpperCase(),
              formatNumber(s.count),
              formatCurrency(s.taxable),
              formatCurrency(s.tax),
            ]),
          },
        ],
      });
      const ok = openPrintWindow(html);
      if (!ok) {
        alert('Pop-up blocked. Please allow pop-ups for GSTPilot to export PDF reports.');
        return;
      }
      addRecentExport({
        id: crypto.randomUUID(),
        exportType: 'Financial Report PDF',
        clientName: 'All Clients',
        period: periodToLabel(selectedPeriod),
        generatedAt: new Date().toISOString(),
        fileSize: 'PDF',
        fileType: 'pdf',
      });
    } finally {
      setGenerating(null);
    }
  };

  const handlePrintCashFlow = () => {
    setGenerating('cashflow-pdf');
    try {
      const generatedAt = new Date().toLocaleString('en-IN');
      const html = buildPdfHtml({
        title: 'Cash Flow Report',
        subtitle: 'ITC Reconciliation & Cash Flow Analysis',
        generatedAt,
        sections: [
          {
            heading: 'Reconciliation Summary',
            rows: [
              { label: 'Total Records', value: formatNumber(cashFlowSummary.totalRecords) },
              { label: 'Matched', value: formatNumber(cashFlowSummary.matched) },
              { label: 'Unmatched', value: formatNumber(cashFlowSummary.unmatched) },
              { label: 'Partial Matches', value: formatNumber(cashFlowSummary.partial) },
              { label: 'High-Risk Records', value: formatNumber(cashFlowSummary.highRisk) },
              { label: 'Match Rate', value: `${cashFlowSummary.matchRate}%` },
            ],
          },
          {
            heading: 'Cash Flow Impact',
            rows: [
              { label: 'Cash Inflow (Collected)', value: formatCurrency(cashFlowSummary.inflow) },
              { label: 'Outstanding', value: formatCurrency(cashFlowSummary.outstanding) },
              { label: 'Overdue', value: formatCurrency(cashFlowSummary.overdue) },
              { label: 'Invoice Count', value: formatNumber(cashFlowSummary.invoiceCount) },
              { label: 'ITC Difference', value: formatCurrency(cashFlowSummary.itcDifference) },
            ],
          },
        ],
        tables: [
          {
            heading: 'Recent Reconciliation Runs',
            columns: ['Sources', 'Period', 'Status', 'Total', 'Matched', 'ITC Diff'],
            rows: cashFlowSummary.byRecon.map((r) => [
              r.sources,
              r.period,
              r.status,
              formatNumber(r.total),
              formatNumber(r.matched),
              formatCurrency(r.itcDiff),
            ]),
          },
        ],
      });
      const ok = openPrintWindow(html);
      if (!ok) {
        alert('Pop-up blocked. Please allow pop-ups for GSTPilot to export PDF reports.');
        return;
      }
      addRecentExport({
        id: crypto.randomUUID(),
        exportType: 'Cash Flow Report PDF',
        clientName: 'All Clients',
        period: periodToLabel(selectedPeriod),
        generatedAt: new Date().toISOString(),
        fileSize: 'PDF',
        fileType: 'pdf',
      });
    } finally {
      setGenerating(null);
    }
  };

  const handleDeleteExport = async (id: string) => {
    // P1-M2: also delete the linked Firestore report so the saved reports
    // section stays in sync.
    const exp = recentExports.find((e) => e.id === id);
    if (exp?.firestoreId) {
      try {
        await deleteReport(exp.firestoreId);
        toast.success('Report deleted from saved reports');
      } catch (err) {
        console.error('Failed to delete Firestore report:', err);
        toast.error('Failed to delete from saved reports');
      }
    }
    setRecentExports((prev) => prev.filter((e) => e.id !== id));
  };

  // P1-M2: delete a saved report from Firestore (and also try to remove its
  // localStorage mirror if one exists).
  const handleDeleteSavedReport = async (reportId: string) => {
    try {
      await deleteReport(reportId);
      // Remove the localStorage mirror entry whose firestoreId matches
      setRecentExports((prev) => prev.filter((e) => e.firestoreId !== reportId));
      toast.success('Saved report deleted');
    } catch (err) {
      console.error('Failed to delete saved report:', err);
      toast.error('Failed to delete saved report');
    }
  };

  // P1-M2: re-download a saved JSON report from its persisted data: URL.
  const handleDownloadSavedReport = (report: FirestoreReport & { id: string }) => {
    if (!report.storageUrl) {
      toast.error('Re-download not available for this report. Please regenerate from the export tab.');
      return;
    }
    try {
      // storageUrl is a data:application/json;base64,... URL
      const a = document.createElement('a');
      a.href = report.storageUrl;
      a.download = `${report.title.replace(/\s+/g, '_')}_${report.period ?? 'report'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Report downloaded');
    } catch (err) {
      console.error('Failed to download saved report:', err);
      toast.error('Failed to download saved report');
    }
  };

  const handleViewExport = (exp: RecentExport) => {
    setPreviewData(exp);
    setPreviewOpen(true);
  };

  const handleDownloadExport = (exp: RecentExport) => {
    if (!exp.data) return;
    const blob = new Blob([JSON.stringify(exp.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exp.exportType.replace(/\s+/g, '_')}_${exp.period}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearHistory = () => {
    setRecentExports([]);
  };

  // ─── Loading Skeleton ────────────────────────────────────────────────────
  // Wait for BOTH the legacy /api/invoices fetch (for the client dropdown) AND
  // the real-time invoice engine subscription so the page never renders with
  // stale engine data.
  if (loading || engineLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
            <Package className="size-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Reports & Filing Packages
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate, export, and download GST reports, compliance summaries, and financial statements
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          Tab Navigation — RESTORED report categories
      ═══════════════════════════════════════════════════════════════════════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="export" className="gap-1.5">
            <Package className="size-3.5" /> Export Package
          </TabsTrigger>
          <TabsTrigger value="gst" className="gap-1.5">
            <FileText className="size-3.5" /> GST Reports
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-1.5">
            <ShieldCheck className="size-3.5" /> Compliance
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-1.5">
            <TrendingUp className="size-3.5" /> Financial
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="gap-1.5">
            <Wallet className="size-3.5" /> Cash Flow
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <Clock className="size-3.5" /> History
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: Export Package (existing UI — preserved)
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="export" className="space-y-6 mt-4">
          {/* Export Options */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* GSTR-1 JSON */}
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                    <FileJson className="size-5 text-emerald-700" />
                  </div>
                  <div>
                    <CardTitle className="text-base">GSTR-1 JSON</CardTitle>
                    <CardDescription className="text-xs mt-0.5">GST Portal Upload Format</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generate GSTR-1 return in JSON format for upload to GST portal
                </p>
                <Button
                  onClick={handleGenerateJSON}
                  disabled={generating !== null}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {generating === 'json' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <FileJson className="size-4" />
                  )}
                  {generating === 'json' ? 'Generating...' : 'Generate'}
                </Button>
              </CardContent>
            </Card>

            {/* GSTR-1 Excel */}
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                    <FileSpreadsheet className="size-5 text-amber-700" />
                  </div>
                  <div>
                    <CardTitle className="text-base">GSTR-1 Excel</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Spreadsheet Export</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Export GSTR-1 data in Excel format for review and records
                </p>
                <Button
                  onClick={handleGenerateExcel}
                  disabled={generating !== null}
                  className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
                >
                  {generating === 'csv' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="size-4" />
                  )}
                  {generating === 'csv' ? 'Exporting...' : 'Export'}
                </Button>
              </CardContent>
            </Card>

            {/* Filing Summary PDF — RESTORED real PDF export */}
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-red-50">
                    <FileText className="size-5 text-red-700" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Filing Summary PDF</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Comprehensive Report</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generate comprehensive filing summary report in PDF format
                </p>
                <Button
                  onClick={handleGeneratePDF}
                  disabled={generating !== null}
                  className="w-full gap-2 bg-red-600 hover:bg-red-700"
                >
                  {generating === 'report' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Printer className="size-4" />
                  )}
                  {generating === 'report' ? 'Generating...' : 'Generate PDF'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Configuration Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="size-4 text-emerald-600" />
                Export Configuration
              </CardTitle>
              <CardDescription>
                Select the client, period, and sections to include in the export
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Client Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client</label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.tradeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Month Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Month</label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={(i + 1).toString().padStart(2, '0')}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Year Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Year</label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {[2023, 2024, 2025, 2026].map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Return Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Return Type</label>
                  <Select value={returnType} onValueChange={setReturnType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Return Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GSTR-1">GSTR-1</SelectItem>
                      <SelectItem value="GSTR-3B">GSTR-3B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Section Checkboxes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Include Sections</label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {SECTION_KEYS.map((section) => (
                    <div key={section} className="flex items-center gap-2">
                      <Checkbox
                        id={`section-${section}`}
                        checked={includeSections[section]}
                        onCheckedChange={() => toggleSection(section)}
                      />
                      <label
                        htmlFor={`section-${section}`}
                        className="text-sm cursor-pointer select-none"
                      >
                        {section.toUpperCase()}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview Section */}
          <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-emerald-800">
                <Eye className="size-4" />
                Export Preview
              </CardTitle>
              <CardDescription>
                Summary of data that will be included in the export for{' '}
                <span className="font-medium text-emerald-700">{periodToLabel(selectedPeriod)}</span>
                {selectedClientId !== 'all' && (
                  <>
                    {' '}—{' '}
                    <span className="font-medium text-emerald-700">
                      {clients.find((c) => c.id === selectedClientId)?.tradeName}
                    </span>
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
                  <p className="text-sm text-emerald-600">Total Invoices</p>
                  <p className="text-2xl font-bold text-emerald-900">{formatNumber(totalInvoices)}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
                  <p className="text-sm text-emerald-600">Total Taxable Value</p>
                  <p className="text-2xl font-bold text-emerald-900">{formatCurrency(totalTaxableValue)}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
                  <p className="text-sm text-emerald-600">Total Tax</p>
                  <p className="text-2xl font-bold text-emerald-900">{formatCurrency(totalTax)}</p>
                </div>
              </div>

              <Separator className="my-4 bg-emerald-200" />

              {/* Section Breakdown */}
              <div className="overflow-x-auto rounded-lg border border-emerald-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-emerald-50/50">
                      <TableHead className="whitespace-nowrap">Section</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Invoices</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Taxable Value</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Total Tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sectionPreviews.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                          No sections selected
                        </TableCell>
                      </TableRow>
                    ) : (
                      sectionPreviews.map((sp) => (
                        <TableRow key={sp.section} className="hover:bg-emerald-50/30">
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700"
                            >
                              {GSTR1_SECTION_LABELS[sp.section]}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right font-medium">
                            {formatNumber(sp.invoiceCount)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {formatCurrency(sp.taxableValue)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {formatCurrency(sp.totalTax)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* GST Working Papers */}
          <Card className="border-amber-200 bg-gradient-to-r from-amber-50/50 to-orange-50/50">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100">
                    <FileText className="size-5 text-amber-700" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-amber-900">GST Working Papers</CardTitle>
                    <CardDescription>
                      Detailed working papers with reconciliation summaries, tax computations, and section-wise breakdowns for audit and review purposes
                    </CardDescription>
                  </div>
                </div>
                <Button
                  onClick={handleGenerateWorkingPapers}
                  disabled={generating !== null}
                  className="gap-2 bg-amber-600 hover:bg-amber-700 shrink-0"
                >
                  {generating === 'working-papers' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Printer className="size-4" />
                  )}
                  {generating === 'working-papers' ? 'Generating...' : 'Generate Working Papers PDF'}
                </Button>
              </div>
            </CardHeader>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: GST Reports — GSTR-1 + GSTR-3B Summary (RESTORED)
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="gst" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
                    <FileText className="size-5 text-emerald-700" />
                  </div>
                  <div>
                    <CardTitle className="text-base">GST Filing Reports</CardTitle>
                    <CardDescription>
                      GSTR-1 & GSTR-3B summary based on live returns data
                    </CardDescription>
                  </div>
                </div>
                <Button
                  onClick={handlePrintGSTSummary}
                  disabled={generating !== null}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {generating === 'gst-pdf' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Printer className="size-4" />
                  )}
                  Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* GSTR-1 Summary */}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-emerald-900">GSTR-1 Summary</h3>
                    <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-700">
                      {gstSummary.gstr1Total} total
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Filed</span>
                      <span className="font-semibold text-emerald-700">{formatNumber(gstSummary.gstr1Filed)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="font-semibold text-amber-700">{formatNumber(gstSummary.gstr1Pending)}</span>
                    </div>
                  </div>
                </div>

                {/* GSTR-3B Summary */}
                <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-teal-900">GSTR-3B Summary</h3>
                    <Badge variant="outline" className="border-teal-300 bg-white text-teal-700">
                      {gstSummary.gstr3bTotal} total
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Filed</span>
                      <span className="font-semibold text-teal-700">{formatNumber(gstSummary.gstr3bFiled)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="font-semibold text-amber-700">{formatNumber(gstSummary.gstr3bPending)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Output Tax Liability */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Total Taxable Value</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(gstSummary.outputTaxable)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Total Output Tax</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(gstSummary.outputTax)}</p>
                </div>
              </div>

              {/* Returns Table */}
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap">Return Type</TableHead>
                      <TableHead className="whitespace-nowrap">Period</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Taxable Value</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Total Tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fireReturns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                          No returns data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      fireReturns.slice(0, 15).map((r, idx) => (
                        <TableRow key={r.returnId ?? r.id ?? idx} className="hover:bg-muted/30">
                          <TableCell className="whitespace-nowrap font-medium">{r.returnType}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.period}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{r.status}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">{formatCurrency(r.totalTaxableValue || 0)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right">{formatCurrency(r.totalTax || 0)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: Compliance Reports (RESTORED)
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="compliance" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100">
                    <ShieldCheck className="size-5 text-blue-700" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Compliance Status Report</CardTitle>
                    <CardDescription>
                      Filing compliance, ITC reconciliation, and risk metrics across all clients
                    </CardDescription>
                  </div>
                </div>
                <Button
                  onClick={handlePrintCompliance}
                  disabled={generating !== null}
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  {generating === 'compliance-pdf' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Printer className="size-4" />
                  )}
                  Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Filing Rate</p>
                  <p className="text-xl font-bold text-emerald-700">{complianceSummary.filingRate}%</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Filed Returns</p>
                  <p className="text-xl font-bold text-foreground">{formatNumber(complianceSummary.filedReturns)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="text-xl font-bold text-red-700">{formatNumber(complianceSummary.overdueReturns)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Avg Health Score</p>
                  <p className="text-xl font-bold text-foreground">{formatNumber(complianceSummary.avgHealth)}</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">ITC Match Rate</p>
                  <p className="text-xl font-bold text-emerald-700">{complianceSummary.matchRate}%</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">High-Risk Records</p>
                  <p className="text-xl font-bold text-amber-700">{formatNumber(complianceSummary.reconHighRisk)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Critical Issues</p>
                  <p className="text-xl font-bold text-red-700">{formatNumber(complianceSummary.criticalIssues)}</p>
                </div>
              </div>

              <Separator />

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap">Metric</TableHead>
                      <TableHead className="whitespace-nowrap">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow><TableCell className="whitespace-nowrap">Total Returns</TableCell><TableCell className="font-medium">{formatNumber(complianceSummary.totalReturns)}</TableCell></TableRow>
                    <TableRow><TableCell className="whitespace-nowrap">Filed Returns</TableCell><TableCell className="font-medium">{formatNumber(complianceSummary.filedReturns)}</TableCell></TableRow>
                    <TableRow><TableCell className="whitespace-nowrap">Draft Returns</TableCell><TableCell className="font-medium">{formatNumber(complianceSummary.draftReturns)}</TableCell></TableRow>
                    <TableRow><TableCell className="whitespace-nowrap">Overdue Returns</TableCell><TableCell className="font-medium">{formatNumber(complianceSummary.overdueReturns)}</TableCell></TableRow>
                    <TableRow><TableCell className="whitespace-nowrap">Reconciliation Runs</TableCell><TableCell className="font-medium">{formatNumber(complianceSummary.reconCount)}</TableCell></TableRow>
                    <TableRow><TableCell className="whitespace-nowrap">Warnings</TableCell><TableCell className="font-medium">{formatNumber(complianceSummary.warnings)}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: Financial Reports (RESTORED)
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="financial" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-purple-100">
                    <TrendingUp className="size-5 text-purple-700" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Financial Summary Report</CardTitle>
                    <CardDescription>
                      Revenue, tax liability, and section-wise financial breakdown
                    </CardDescription>
                  </div>
                </div>
                <Button
                  onClick={handlePrintFinancial}
                  disabled={generating !== null}
                  className="gap-2 bg-purple-600 hover:bg-purple-700"
                >
                  {generating === 'financial-pdf' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Printer className="size-4" />
                  )}
                  Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(financialSummary.totalRevenue)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Taxable Value</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(financialSummary.totalTaxable)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Total Tax Volume</p>
                  <p className="text-xl font-bold text-purple-700">{formatCurrency(financialSummary.totalTaxVolume)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Invoice Count</p>
                  <p className="text-xl font-bold text-foreground">{formatNumber(financialSummary.invoiceCount)}</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">CGST</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(financialSummary.cgstTotal)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">SGST</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(financialSummary.sgstTotal)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">IGST</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(financialSummary.igstTotal)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Cess</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(financialSummary.cessTotal)}</p>
                </div>
              </div>

              <Separator />

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap">Section</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Invoices</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Taxable Value</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialSummary.bySection.map((s) => (
                      <TableRow key={s.section} className="hover:bg-muted/30">
                        <TableCell className="whitespace-nowrap font-medium">
                          {GSTR1_SECTION_LABELS[s.section] ?? s.section.toUpperCase()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatNumber(s.count)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatCurrency(s.taxable)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatCurrency(s.tax)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: Cash Flow Reports (RESTORED)
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="cashflow" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-teal-100">
                    <Wallet className="size-5 text-teal-700" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Cash Flow Analysis Report</CardTitle>
                    <CardDescription>
                      ITC reconciliation, match rates, and cash flow impact analysis
                    </CardDescription>
                  </div>
                </div>
                <Button
                  onClick={handlePrintCashFlow}
                  disabled={generating !== null}
                  className="gap-2 bg-teal-600 hover:bg-teal-700"
                >
                  {generating === 'cashflow-pdf' ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Printer className="size-4" />
                  )}
                  Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Total Records</p>
                  <p className="text-xl font-bold text-foreground">{formatNumber(cashFlowSummary.totalRecords)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Matched</p>
                  <p className="text-xl font-bold text-emerald-700">{formatNumber(cashFlowSummary.matched)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Unmatched</p>
                  <p className="text-xl font-bold text-red-700">{formatNumber(cashFlowSummary.unmatched)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Match Rate</p>
                  <p className="text-xl font-bold text-teal-700">{cashFlowSummary.matchRate}%</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Partial Matches</p>
                  <p className="text-lg font-bold text-amber-700">{formatNumber(cashFlowSummary.partial)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">High-Risk Records</p>
                  <p className="text-lg font-bold text-red-700">{formatNumber(cashFlowSummary.highRisk)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted-foreground">ITC Difference</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(cashFlowSummary.itcDifference)}</p>
                </div>
              </div>

              <Separator />

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap">Sources</TableHead>
                      <TableHead className="whitespace-nowrap">Period</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Total</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Matched</TableHead>
                      <TableHead className="whitespace-nowrap text-right">ITC Diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashFlowSummary.byRecon.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                          No reconciliation runs available
                        </TableCell>
                      </TableRow>
                    ) : (
                      cashFlowSummary.byRecon.map((r, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/30">
                          <TableCell className="whitespace-nowrap text-sm">{r.sources}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{r.period}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{r.status}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right text-sm">{formatNumber(r.total)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right text-sm">{formatNumber(r.matched)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right text-sm">{formatCurrency(r.itcDiff)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: Report History (RESTORED — now persisted to localStorage + Firestore)
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="history" className="space-y-6 mt-4">
          {/* ═══ SAVED REPORTS (Firestore — canonical source going forward) ═══ */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-emerald-600" />
                  <div>
                    <CardTitle className="text-base">Saved Reports</CardTitle>
                    <CardDescription>
                      All reports persisted to Firestore — accessible across devices &amp; sessions
                    </CardDescription>
                  </div>
                </div>
                {savedReports.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {savedReports.length} saved
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {fireReportsQ.loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : fireReportsQ.error ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50/50 p-3 text-sm text-red-700">
                  <span>Failed to load saved reports: {fireReportsQ.error}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-100"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="size-3" />
                    Retry
                  </Button>
                </div>
              ) : savedReports.length === 0 ? (
                <EmptyState
                  icon={Database}
                  title="No saved reports yet"
                  description="Generate your first report to see it here."
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="whitespace-nowrap">Report Type</TableHead>
                        <TableHead className="whitespace-nowrap">Client</TableHead>
                        <TableHead className="whitespace-nowrap">Period</TableHead>
                        <TableHead className="whitespace-nowrap">Generated At</TableHead>
                        <TableHead className="whitespace-nowrap">Size</TableHead>
                        <TableHead className="whitespace-nowrap">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedReports.map((report) => {
                        const exportType = String(report.metadata?.exportType ?? report.title ?? report.reportType);
                        const config = EXPORT_TYPE_CONFIG[exportType];
                        const sizeLabel = String(report.metadata?.fileSizeLabel ?? (
                          report.fileSize > 0 ? `${(report.fileSize / 1024).toFixed(1)} KB` : '—'
                        ));
                        return (
                          <TableRow key={report.reportId} className="hover:bg-muted/30">
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className={`flex size-7 items-center justify-center rounded ${config?.bgColor ?? 'bg-slate-50'}`}>
                                  {config?.icon ?? <FileText className="size-3.5" />}
                                </div>
                                <span className="font-medium text-sm">{exportType}</span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {report.clientTradeName ?? 'All Clients'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {report.period ?? '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {report.generatedAt
                                ? new Date(report.generatedAt as string).toLocaleString()
                                : '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              <Badge variant="outline" className="text-xs">{sizeLabel}</Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 p-0"
                                  onClick={() => handleDownloadSavedReport(report)}
                                  title="Download"
                                  disabled={!report.storageUrl}
                                >
                                  <Download className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 p-0 text-red-500 hover:text-red-700"
                                  onClick={() => handleDeleteSavedReport(report.reportId)}
                                  title="Delete"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ LOCAL HISTORY (localStorage — back-compat) ═══ */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-amber-600" />
                  <div>
                    <CardTitle className="text-base">Report History</CardTitle>
                    <CardDescription>
                      Last {HISTORY_LIMIT} generated & exported reports — local browser history
                    </CardDescription>
                  </div>
                </div>
                {recentExports.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearHistory}
                    className="gap-1.5 text-red-600 hover:text-red-700 hover:border-red-300"
                  >
                    <Trash2 className="size-3.5" />
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {recentExports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <BarChart3 className="size-10 mb-3 text-muted-foreground/40" />
                  <p className="text-sm">No reports generated yet</p>
                  <p className="text-xs mt-1">Use the export options and category tabs to generate your first report</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="whitespace-nowrap">Report Type</TableHead>
                        <TableHead className="whitespace-nowrap">Client</TableHead>
                        <TableHead className="whitespace-nowrap">Period</TableHead>
                        <TableHead className="whitespace-nowrap">Generated At</TableHead>
                        <TableHead className="whitespace-nowrap">File Size</TableHead>
                        <TableHead className="whitespace-nowrap">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentExports.map((exp) => {
                        const config = EXPORT_TYPE_CONFIG[exp.exportType];
                        return (
                          <TableRow key={exp.id} className="hover:bg-muted/30">
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className={`flex size-7 items-center justify-center rounded ${config?.bgColor ?? 'bg-slate-50'}`}>
                                  {config?.icon ?? <FileText className="size-3.5" />}
                                </div>
                                <span className="font-medium text-sm">{exp.exportType}</span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {exp.clientName}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {exp.period}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {new Date(exp.generatedAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              <Badge variant="outline" className="text-xs">
                                {exp.fileSize}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 p-0"
                                  onClick={() => handleViewExport(exp)}
                                  title="View"
                                >
                                  <Eye className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 p-0"
                                  onClick={() => handleDownloadExport(exp)}
                                  title="Download JSON"
                                  disabled={!exp.data}
                                >
                                  <Download className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 p-0 text-red-500 hover:text-red-700"
                                  onClick={() => handleDeleteExport(exp.id)}
                                  title="Delete"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════════
          Preview Dialog (kept for export-package view-as-JSON)
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-4 text-emerald-600" />
              Export Preview — {previewData?.exportType}
            </DialogTitle>
          </DialogHeader>
          {previewData?.data ? (
            <div className="rounded-lg border bg-muted/30 p-4">
              <pre className="max-h-96 overflow-auto text-xs whitespace-pre-wrap break-words">
                {JSON.stringify(previewData.data, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">Preview not available for this export type</p>
              <p className="text-xs mt-1">The PDF was opened in your browser's print dialog</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
