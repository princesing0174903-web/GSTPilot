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
  Calendar,
  Receipt,
  History,
  Filter,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ClipboardCheck,
  FileCheck2,
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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
import { useGSTTransactions } from '@/hooks/useGSTTransactions';
import { useBanking } from '@/hooks/useBanking';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_CATEGORIES, CATEGORY_LABELS } from '@/lib/banking';
import type { TransactionCategory } from '@/lib/banking-provider';
import { createReport, deleteReport } from '@/lib/firestore-service';
import type {
  FirestoreReturn,
  FirestoreReconciliation,
  FirestoreReport,
  ReportType,
  ReportFormat,
} from '@/lib/firestore-schema';
import { EmptyState, ProfessionalEmptyState } from '@/components/shared';
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
  'GSTR-1 JSON': { label: 'GSTR-1 JSON', icon: <FileJson className="size-5" />, color: 'text-blue-700', bgColor: 'bg-blue-50' },
  'GSTR-1 Excel': { label: 'GSTR-1 Excel', icon: <FileSpreadsheet className="size-5" />, color: 'text-amber-700', bgColor: 'bg-amber-50' },
  'Filing Summary PDF': { label: 'Filing Summary PDF', icon: <FileText className="size-5" />, color: 'text-red-700', bgColor: 'bg-red-50' },
  'Working Papers PDF': { label: 'Working Papers PDF', icon: <FileText className="size-5" />, color: 'text-blue-700', bgColor: 'bg-blue-50' },
  'GST Summary PDF': { label: 'GST Summary PDF', icon: <FileText className="size-5" />, color: 'text-blue-700', bgColor: 'bg-blue-50' },
  'Compliance Report PDF': { label: 'Compliance Report PDF', icon: <FileText className="size-5" />, color: 'text-sky-700', bgColor: 'bg-sky-50' },
  'Financial Report PDF': { label: 'Financial Report PDF', icon: <FileText className="size-5" />, color: 'text-blue-700', bgColor: 'bg-blue-50' },
  'Cash Flow Report PDF': { label: 'Cash Flow Report PDF', icon: <FileText className="size-5" />, color: 'text-sky-700', bgColor: 'bg-sky-50' },
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

// ─── Report Catalog (drives the Export Center UI) ─────────────────────────────
// A single source of truth for every report card on the page. Each entry maps to
// an existing handler (or null = "Not Configured"), so the UI reflects reality
// without ever touching the export API contract.

type ReportHandlerKey =
  | 'json'
  | 'csv'
  | 'report'
  | 'working-papers'
  | 'gst-pdf'
  | 'compliance-pdf'
  | 'financial-pdf'
  | 'cashflow-pdf'
  | null;

interface ReportCardConfig {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  exportType: string; // matches EXPORT_TYPE_CONFIG key for last-generated lookup
  handler: ReportHandlerKey;
  fileType: 'json' | 'csv' | 'pdf';
  estimatedSize: string;
  accent: 'blue' | 'emerald' | 'amber' | 'purple' | 'teal' | 'rose' | 'slate';
}

interface ReportCategoryConfig {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  reports: ReportCardConfig[];
}

const REPORT_CATALOG: ReportCategoryConfig[] = [
  {
    id: 'gst-filing',
    title: 'GST Filing Package',
    description: 'GST portal-ready JSON exports + statutory reconciliation reports',
    icon: FileJson,
    reports: [
      {
        id: 'gstr1-json',
        title: 'GSTR-1 JSON Export',
        description: 'GST portal upload format — outward supplies (B2B / B2C / CDN / Exports).',
        icon: FileJson,
        exportType: 'GSTR-1 JSON',
        handler: 'json',
        fileType: 'json',
        estimatedSize: '~18 KB',
        accent: 'blue',
      },
      {
        id: 'gstr3b-json',
        title: 'GSTR-3B JSON Export',
        description: 'Monthly summary return — output tax, ITC, net liability.',
        icon: FileJson,
        exportType: 'GSTR-3B JSON',
        handler: null,
        fileType: 'json',
        estimatedSize: '~12 KB',
        accent: 'emerald',
      },
      {
        id: 'gstr2b-recon',
        title: 'GSTR-2B Reconciliation',
        description: 'Auto-reconcile purchase register against GSTR-2B from GST portal.',
        icon: FileCheck2,
        exportType: 'GSTR-2B Reconciliation',
        handler: null,
        fileType: 'pdf',
        estimatedSize: '~220 KB',
        accent: 'teal',
      },
      {
        id: 'gstr9-annual',
        title: 'Annual GSTR-9 Summary',
        description: 'Annual reconciliation of all monthly / quarterly returns filed.',
        icon: Calendar,
        exportType: 'GSTR-9 Annual',
        handler: null,
        fileType: 'pdf',
        estimatedSize: '~340 KB',
        accent: 'purple',
      },
    ],
  },
  {
    id: 'excel-export',
    title: 'Excel Export',
    description: 'Spreadsheet exports for accountants — full transactional registers',
    icon: FileSpreadsheet,
    reports: [
      {
        id: 'sales-register',
        title: 'Sales Register',
        description: 'Invoice-by-invoice sales register with GST classification.',
        icon: FileSpreadsheet,
        exportType: 'GSTR-1 Excel',
        handler: 'csv',
        fileType: 'csv',
        estimatedSize: '~85 KB',
        accent: 'amber',
      },
      {
        id: 'purchase-register',
        title: 'Purchase Register',
        description: 'Vendor-wise purchase register with ITC eligibility flag.',
        icon: FileSpreadsheet,
        exportType: 'Purchase Register',
        handler: null,
        fileType: 'csv',
        estimatedSize: '~95 KB',
        accent: 'emerald',
      },
      {
        id: 'expense-summary',
        title: 'Expense Summary',
        description: 'Category-wise expense breakdown with GST input analysis.',
        icon: Receipt,
        exportType: 'Expense Summary',
        handler: null,
        fileType: 'csv',
        estimatedSize: '~45 KB',
        accent: 'rose',
      },
      {
        id: 'tax-liability',
        title: 'Tax Liability Summary',
        description: 'Output vs input tax, net liability, by-rate breakdown.',
        icon: Wallet,
        exportType: 'Tax Liability Summary',
        handler: null,
        fileType: 'csv',
        estimatedSize: '~32 KB',
        accent: 'blue',
      },
    ],
  },
  {
    id: 'pdf-summary',
    title: 'PDF Summary',
    description: 'Board-ready formatted reports — print or save as PDF',
    icon: FileText,
    reports: [
      {
        id: 'monthly-business-summary',
        title: 'Monthly Business Summary',
        description: 'Revenue, tax liability, and section-wise financial breakdown.',
        icon: TrendingUp,
        exportType: 'Financial Report PDF',
        handler: 'financial-pdf',
        fileType: 'pdf',
        estimatedSize: '~280 KB',
        accent: 'purple',
      },
      {
        id: 'tax-compliance-report',
        title: 'Tax Compliance Report',
        description: 'Filing compliance, ITC reconciliation, and risk metrics.',
        icon: ShieldCheck,
        exportType: 'Compliance Report PDF',
        handler: 'compliance-pdf',
        fileType: 'pdf',
        estimatedSize: '~310 KB',
        accent: 'blue',
      },
      {
        id: 'audit-trail-report',
        title: 'Audit Trail Report',
        description: 'GSTR-1 / 3B filings + GST engine totals — audit trail of returns.',
        icon: History,
        exportType: 'GST Summary PDF',
        handler: 'gst-pdf',
        fileType: 'pdf',
        estimatedSize: '~260 KB',
        accent: 'teal',
      },
      {
        id: 'cash-flow-report',
        title: 'Cash Flow Report',
        description: 'Reconciliation runs, cash inflow, and banking cash position.',
        icon: Wallet,
        exportType: 'Cash Flow Report PDF',
        handler: 'cashflow-pdf',
        fileType: 'pdf',
        estimatedSize: '~290 KB',
        accent: 'emerald',
      },
    ],
  },
  {
    id: 'working-papers',
    title: 'Working Papers',
    description: 'Detailed working papers with section-wise tax computation',
    icon: ClipboardCheck,
    reports: [
      {
        id: 'working-papers-bundle',
        title: 'Working Papers Bundle',
        description: 'Section-wise tax computation + filing reconciliation summary.',
        icon: ClipboardCheck,
        exportType: 'Working Papers PDF',
        handler: 'working-papers',
        fileType: 'pdf',
        estimatedSize: '~420 KB',
        accent: 'amber',
      },
      {
        id: 'recon-working-papers',
        title: 'Reconciliation Working Papers',
        description: 'ITC reconciliation working papers with match / mismatch detail.',
        icon: FileCheck2,
        exportType: 'Reconciliation Working Papers',
        handler: null,
        fileType: 'pdf',
        estimatedSize: '~380 KB',
        accent: 'teal',
      },
    ],
  },
  {
    id: 'audit-package',
    title: 'Audit Package',
    description: 'Complete audit-ready bundles for statutory auditors',
    icon: Package,
    reports: [
      {
        id: 'audit-package-bundle',
        title: 'Audit Package Bundle',
        description: 'Filing summary + client breakdown + filings table for audit.',
        icon: Package,
        exportType: 'Filing Summary PDF',
        handler: 'report',
        fileType: 'pdf',
        estimatedSize: '~520 KB',
        accent: 'blue',
      },
      {
        id: 'ca-review-package',
        title: 'CA Review Package',
        description: 'Comprehensive package for CA review with all supporting docs.',
        icon: ClipboardCheck,
        exportType: 'CA Review Package',
        handler: null,
        fileType: 'pdf',
        estimatedSize: '~680 KB',
        accent: 'purple',
      },
    ],
  },
];

const TOTAL_REPORTS = REPORT_CATALOG.reduce((sum, c) => sum + c.reports.length, 0);
const CONFIGURED_REPORTS = REPORT_CATALOG.reduce(
  (sum, c) => sum + c.reports.filter((r) => r.handler !== null).length,
  0,
);

const ACCENT_BG: Record<ReportCardConfig['accent'], string> = {
  blue: 'bg-[#2563EB]/10 border-[#2563EB]/25',
  emerald: 'bg-[#3B82F6]/10 border-[#3B82F6]/25',
  amber: 'bg-[#F59E0B]/10 border-[#F59E0B]/25',
  purple: 'bg-[#60A5FA]/10 border-[#60A5FA]/25',
  teal: 'bg-[#60A5FA]/10 border-[#60A5FA]/25',
  rose: 'bg-[#F43F5E]/10 border-[#F43F5E]/25',
  slate: 'bg-[#181818] border-[#222222]',
};

const ACCENT_TEXT: Record<ReportCardConfig['accent'], string> = {
  blue: 'text-[#60A5FA]',
  emerald: 'text-[#60A5FA]',
  amber: 'text-[#FBBF24]',
  purple: 'text-[#60A5FA]',
  teal: 'text-[#60A5FA]',
  rose: 'text-[#FB7185]',
  slate: 'text-muted-foreground',
};

// Relative time formatter ("2 hours ago", "Just now", "Never")
function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Never';
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 0) return 'Just now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day > 1 ? 's' : ''} ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} month${mo > 1 ? 's' : ''} ago`;
  const yr = Math.floor(mo / 12);
  return `${yr} year${yr > 1 ? 's' : ''} ago`;
}

// ─── ReportCard (premium export-center card) ──────────────────────────────────

interface ReportCardProps {
  report: ReportCardConfig;
  generating: string | null;
  lastGeneratedAt: string | null;
  hasDownload: boolean;
  onGenerate: () => void;
  onDownload: () => void;
}

function ReportCard({
  report,
  generating,
  lastGeneratedAt,
  hasDownload,
  onGenerate,
  onDownload,
}: ReportCardProps) {
  const Icon = report.icon;
  const isConfigured = report.handler !== null;
  const isGenerating = isConfigured && generating === report.handler;
  const anyGenerating = generating !== null;

  const statusNode = !isConfigured ? (
    <span className="gst-status gst-status-neutral">
      <AlertCircle className="size-3" />
      Not Configured
    </span>
  ) : isGenerating ? (
    <span className="gst-status gst-status-warning">
      <RefreshCw className="size-3 animate-spin" />
      Generating…
    </span>
  ) : (
    <span className="gst-status gst-status-success">
      <CheckCircle2 className="size-3" />
      Ready
    </span>
  );

  return (
    <div className="gst-card gst-card-hover h-full flex flex-col">
      {/* Top: Icon + Title */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-lg border shrink-0',
            ACCENT_BG[report.accent],
          )}
        >
          <Icon className={cn('size-5', ACCENT_TEXT[report.accent])} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="gst-card-title text-foreground truncate">{report.title}</h3>
          <p className="gst-description text-xs mt-1 line-clamp-2 leading-snug">
            {report.description}
          </p>
        </div>
      </div>

      {/* Status pill */}
      <div className="mb-3">{statusNode}</div>

      {/* Spacer pushes metadata + actions to the bottom for consistent card heights */}
      <div className="flex-1" />

      {/* Metadata row */}
      <div className="grid grid-cols-2 gap-3 py-3 border-t border-b border-[#1F1F1F] mb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Last Generated
          </p>
          <p className="text-xs text-foreground font-medium truncate">
            {formatRelativeTime(lastGeneratedAt)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Est. Size
          </p>
          <p className="text-xs text-foreground font-medium truncate">{report.estimatedSize}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onGenerate}
          disabled={!isConfigured || anyGenerating}
          loading={isGenerating}
          className="flex-1"
        >
          {!isGenerating && <Sparkles className="size-3.5" />}
          {isGenerating ? 'Generating…' : isConfigured ? 'Generate' : 'Coming Soon'}
        </Button>
        {hasDownload && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onDownload}
            title="Download last generated file"
          >
            <Download className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
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
    .header { border-bottom: 3px solid #2563EB; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-mark { width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #2563EB, #3B82F6); display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 16px; }
    .brand-name { font-size: 18px; font-weight: 700; color: #2563EB; letter-spacing: -0.01em; }
    .brand-tag { font-size: 11px; color: #64748b; margin-top: 2px; }
    h1 { font-size: 22px; margin: 14px 0 4px; color: #0f172a; }
    .subtitle { font-size: 13px; color: #64748b; margin: 0 0 6px; }
    .meta { font-size: 11px; color: #94a3b8; }
    .block { margin-bottom: 22px; page-break-inside: avoid; }
    h2 { font-size: 14px; color: #0f172a; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.04em; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.kv th { text-align: left; width: 45%; padding: 7px 10px; color: #475569; font-weight: 500; background: #f8fafc; border: 1px solid #e2e8f0; }
    table.kv td { padding: 7px 10px; color: #0f172a; font-weight: 600; border: 1px solid #e2e8f0; }
    table.grid th { text-align: left; padding: 8px 10px; background: #eff6ff; color: #1D4ED8; font-weight: 600; border: 1px solid #bfdbfe; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
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
  // ─── Org + Auth context (for local-workspace API calls) ──────────────────
  const { organization } = useOrg();
  const { user } = useAuth();
  const orgId = organization?.id ?? null;

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
  const [historyTab, setHistoryTab] = useState<string>('saved');

  // ─── Export Center UI state (search / filter / collapsible config) ─────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'not_configured'>('all');
  const [configOpen, setConfigOpen] = useState(true);

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

  // ─── GST Return Engine™ — live GST summary, ITC, GSTR-1/3B drafts ────────
  // The GST Return Engine produces authoritative GSTSummary (output/input tax,
  // net liability, by-rate/by-type breakdowns), ITCSummary (eligible/blocked/
  // remaining), and GSTR-1/3B draft structures from the real org-scoped
  // `gst_transactions` collection. fireReturns is kept ONLY for filing STATUS
  // (filed/pending counts); all tax math flows through the engine.
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const {
    summary: gstSummary,
    itcSummary,
    gstr1Draft,
    gstr3bDraft,
    loading: gstLoading,
  } = useGSTTransactions({ period: currentPeriod });

  // ─── Real Banking Foundation™ — live bank connections + transactions ─────
  // The Banking Foundation provides real bank-account balances, incoming /
  // outgoing payment volumes, reconciliation counts, and category breakdowns
  // from the org-scoped `bank_connections` + `bank_transactions` collections.
  // Banking values are surfaced alongside invoice + GST values in the Cash
  // Flow / Financial PDF generators. All reads are null-safe (`?? 0`) so the
  // page renders IDENTICALLY when no bank is connected yet.
  const {
    summary: bankingSummary,
    transactions: bankTransactions,
    loading: bankingLoading,
  } = useBanking();

  // Banking-derived values — all null-safe. Used by the Cash Flow + Financial
  // memos and the enhanced PDF generators (Banking Summary, Bank
  // Reconciliation, Banking Cash Flow Breakdown sections).
  const bankBalance = bankingSummary?.totalBalance ?? 0;
  const bankAvailable = bankingSummary?.availableBalance ?? 0;
  const bankIncoming = bankingSummary?.incomingPayments ?? 0;
  const bankOutgoing = bankingSummary?.outgoingPayments ?? 0;
  const pendingReconciliation = bankingSummary?.pendingReconciliation ?? 0;
  const matchedCount = bankingSummary?.matchedCount ?? 0;
  const partiallyMatchedCount = bankingSummary?.partiallyMatchedCount ?? 0;
  const netCashFlow = bankIncoming - bankOutgoing;

  // ─── Persist Report History to localStorage ──────────────────────────────
  useEffect(() => {
    saveHistory(recentExports);
  }, [recentExports]);

  // ─── Data Fetching ────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Build org-scoped URLs + headers for local-workspace compatibility
        const actor = JSON.stringify({ uid: user?.uid ?? 'local-user', email: user?.email ?? 'local@gstpilot.dev' });
        const headers = { 'x-gstpilot-actor': actor };
        const orgParam = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : '';
        const [invoicesRes, filingsRes] = await Promise.all([
          fetch(`/api/invoices${orgParam}`, { headers }),
          fetch(`/api/gstr-filing${orgParam}`, { headers }),
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
  }, [orgId, user?.uid]);

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

  // GST Reports: GSTR-1 + GSTR-3B FILING STATUS (filed/pending counts only).
  // The actual tax math (output tax, taxable sales, ITC, net liability) flows
  // through the GST Return Engine™ via the `gstSummary` (engine) bound above —
  // see `useGSTTransactions`. This memo is kept ONLY for the filing-status
  // badges and the returns table that show how many GSTR-1/GSTR-3B returns
  // exist (filed vs pending) from the Firestore `returns` collection.
  const gstFilingSummary = useMemo(() => {
    const gstr1Returns = fireReturns.filter((r) => r.returnType === 'GSTR-1');
    const gstr3bReturns = fireReturns.filter((r) => r.returnType === 'GSTR-3B');
    const gstr1Filed = gstr1Returns.filter((r) => r.status === 'filed').length;
    const gstr3bFiled = gstr3bReturns.filter((r) => r.status === 'filed').length;
    return {
      gstr1Total: gstr1Returns.length,
      gstr1Filed,
      gstr1Pending: gstr1Returns.length - gstr1Filed,
      gstr3bTotal: gstr3bReturns.length,
      gstr3bFiled,
      gstr3bPending: gstr3bReturns.length - gstr3bFiled,
    };
  }, [fireReturns]);

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

  // Financial Reports: revenue + tax volumes.
  // Tax components (CGST/SGST/IGST/Cess), taxable sales, output tax, and the
  // sales-count now flow from the GST Return Engine™ (authoritative for GST
  // math). Total revenue still comes from engineInvoices.grandTotal (which
  // includes round-off — the GST engine summary doesn't carry that). Drafts
  // and cancelled invoices are excluded from the revenue figure.
  // Real Banking Foundation™ — cashPosition / bankAvailable flow into the
  // Financial PDF (Banking Summary section). They are NOT rendered as new
  // cards on the page (no UI change); the existing 4 revenue + 4 tax cards
  // stay exactly the same. The banking fields are consumed only by the PDF.
  const financialSummary = useMemo(() => {
    const active = engineInvoices.filter((i) => i.status !== 'draft' && i.status !== 'cancelled');
    const totalRevenue = active.reduce((s, i) => s + i.grandTotal, 0);
    // GST Return Engine™ — authoritative tax math for the current period.
    const totalTaxVolume = gstSummary?.totalOutputTax ?? 0;
    const totalTaxable = gstSummary?.taxableSales ?? 0;
    const igstTotal = gstSummary?.igstCollected ?? 0;
    const cgstTotal = gstSummary?.cgstCollected ?? 0;
    const sgstTotal = gstSummary?.sgstCollected ?? 0;
    const cessTotal = gstSummary?.cessCollected ?? 0;
    // Section breakdown stays from engine invoices — the existing UI uses
    // GSTR-1 section labels (b2b/b2cl/b2cs/cdnr/cdnur/exp) which differ from
    // the GST engine's invoiceType enum (b2b/b2c_large/b2c_small/exports/nil).
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
    // Real Banking Foundation™ — cash position derived from connected bank
    // accounts. Augments (does NOT replace) the existing invoice-derived
    // revenue/tax fields. Surfaced in the Financial PDF's Banking Summary
    // section; no rendered UI card is added or modified.
    return {
      totalRevenue,
      totalTaxVolume,
      totalTaxable,
      igstTotal,
      cgstTotal,
      sgstTotal,
      cessTotal,
      bySection,
      invoiceCount: gstSummary?.salesCount ?? active.length,
      // Banking-derived (all null-safe — 0 when no bank connected)
      cashPosition: bankBalance,
      bankAvailable,
      bankIncoming,
      bankOutgoing,
      netCashFlow,
      pendingReconciliation,
      bankMatchedCount: matchedCount,
    };
  }, [engineInvoices, gstSummary, bankBalance, bankAvailable, bankIncoming, bankOutgoing, netCashFlow, pendingReconciliation, matchedCount]);

  // Cash Flow Reports: reconciliation-based analysis + Real Invoice Engine™ cash flow.
  // Inflow = total collected (paid amounts), Outstanding = unpaid balance, Overdue = past-due.
  // The reconciliation-derived metrics (totalRecords / matched / unmatched / etc.) are
  // preserved so the on-page cards stay exactly the same; the invoice-derived metrics
  // (inflow / outstanding / overdue / invoiceCount) flow into the Cash Flow PDF report.
  //
  // Real Banking Foundation™ — banking cash flow values (bankIncoming /
  // bankOutgoing / netCashFlow / bankBalance) AUGMENT the invoice-derived
  // `inflow` field. They are NOT rendered as new cards on the page (no UI
  // change); the existing 7 reconciliation cards stay exactly the same. The
  // banking fields surface only in the Cash Flow PDF's Banking Cash Flow
  // Breakdown section + by-category table.
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
    // Real Banking Foundation™ — banking cash flow metrics. The invoice-based
    // `inflow` above is preserved (AUGMENT, not replace). Banking values are
    // null-safe (0 when no bank connected).
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
      // Banking-derived (all null-safe — 0 when no bank connected)
      bankIncoming,
      bankOutgoing,
      netCashFlow,
      bankBalance,
      bankAvailable,
      pendingReconciliation,
      bankMatchedCount: matchedCount,
      bankPartiallyMatchedCount: partiallyMatchedCount,
      inflowByCategory: bankingSummary?.inflowByCategory,
      outflowByCategory: bankingSummary?.outflowByCategory,
    };
  }, [fireRecons, invoiceStats, bankIncoming, bankOutgoing, netCashFlow, bankBalance, bankAvailable, pendingReconciliation, matchedCount, partiallyMatchedCount, bankingSummary]);

  // ─── Export Center derived state ──────────────────────────────────────────
  // Live Firestore subscription for SAVED REPORTS (canonical source going
  // forward). localStorage history is kept as a secondary list for back-compat.
  const fireReportsQ = useFireReports();
  const savedReports: Array<FirestoreReport & { id: string }> = fireReportsQ.data ?? [];

  // Last-generated timestamp lookup for each report card — searches both
  // localStorage (recentExports) and Firestore (savedReports) for the most
  // recent matching export. Returns null when a report has never been generated.
  const findReportLastGenerated = useCallback(
    (exportType: string): string | null => {
      const localMatch = recentExports.find((e) => e.exportType === exportType);
      if (localMatch) return localMatch.generatedAt;
      const savedMatch = savedReports.find(
        (r) => String(r.metadata?.exportType ?? r.title ?? r.reportType) === exportType,
      );
      if (savedMatch?.generatedAt) return savedMatch.generatedAt as string;
      return null;
    },
    [recentExports, savedReports],
  );

  // Whether a re-downloadable file exists for a report (only JSON exports
  // persist their data payload in localStorage — PDFs open in a print window).
  const hasDownloadForReport = useCallback(
    (exportType: string, fileType: 'json' | 'csv' | 'pdf'): boolean => {
      if (fileType !== 'json') return false;
      return recentExports.some((e) => e.exportType === exportType && !!e.data);
    },
    [recentExports],
  );

  // Most recent generation event across ALL reports — drives the header KPI.
  const lastGeneratedAny = useMemo(() => {
    const candidates: string[] = [];
    recentExports.forEach((e) => e.generatedAt && candidates.push(e.generatedAt));
    savedReports.forEach((r) => {
      if (r.generatedAt) candidates.push(r.generatedAt as string);
    });
    const valid = candidates.filter((iso) => !isNaN(new Date(iso).getTime()));
    if (valid.length === 0) return null;
    return valid.reduce((latest, cur) => (new Date(cur) > new Date(latest) ? cur : latest));
  }, [recentExports, savedReports]);

  // Filtered catalog — applies search query + status filter to each category,
  // dropping empty categories so the page never shows an empty section header.
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return REPORT_CATALOG.map((category) => ({
      ...category,
      reports: category.reports.filter((r) => {
        const matchesSearch =
          !q ||
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q);
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'ready' && r.handler !== null) ||
          (statusFilter === 'not_configured' && r.handler === null);
        return matchesSearch && matchesStatus;
      }),
    })).filter((category) => category.reports.length > 0);
  }, [searchQuery, statusFilter]);

  const totalFilteredReports = filteredCatalog.reduce(
    (sum, c) => sum + c.reports.length,
    0,
  );

  // ─── Handlers ────────────────────────────────────────────────────────────
  const toggleSection = (section: GSTR1Section) => {
    setIncludeSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

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
        toast.error('Pop-up blocked. Allow pop-ups for GSTPilot to export PDF reports.', { description: 'Update your browser settings to permit pop-ups from this site, then try again.' });
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
        toast.error('Pop-up blocked. Allow pop-ups for GSTPilot to export PDF reports.', { description: 'Update your browser settings to permit pop-ups from this site, then try again.' });
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
      // GST Return Engine™ — authoritative tax math for the current period.
      const engineTaxableSales = gstSummary?.taxableSales ?? 0;
      const engineOutputTax = gstSummary?.totalOutputTax ?? 0;
      const engineTaxablePurchases = gstSummary?.taxablePurchases ?? 0;
      const engineInputTax = gstSummary?.totalInputTax ?? 0;
      const engineNetLiability = gstSummary?.netLiability ?? 0;
      const engineOutstandingGST = gstSummary?.outstandingGST ?? 0;
      const engineHealthScore = gstSummary?.healthScore ?? 0;
      const html = buildPdfHtml({
        title: 'GST Summary Report',
        subtitle: 'GSTR-1 & GSTR-3B Filing Status + GST Engine Totals',
        generatedAt,
        sections: [
          {
            heading: 'GSTR-1 Filings (Status)',
            rows: [
              { label: 'Total GSTR-1 Returns', value: formatNumber(gstFilingSummary.gstr1Total) },
              { label: 'Filed', value: formatNumber(gstFilingSummary.gstr1Filed) },
              { label: 'Pending', value: formatNumber(gstFilingSummary.gstr1Pending) },
            ],
          },
          {
            heading: 'GSTR-3B Filings (Status)',
            rows: [
              { label: 'Total GSTR-3B Returns', value: formatNumber(gstFilingSummary.gstr3bTotal) },
              { label: 'Filed', value: formatNumber(gstFilingSummary.gstr3bFiled) },
              { label: 'Pending', value: formatNumber(gstFilingSummary.gstr3bPending) },
            ],
          },
          {
            heading: 'GST Engine — Output Tax Liability',
            rows: [
              { label: 'Taxable Sales', value: formatCurrency(engineTaxableSales) },
              { label: 'Total Output Tax', value: formatCurrency(engineOutputTax) },
              { label: 'CGST Collected', value: formatCurrency(gstSummary?.cgstCollected ?? 0) },
              { label: 'SGST Collected', value: formatCurrency(gstSummary?.sgstCollected ?? 0) },
              { label: 'IGST Collected', value: formatCurrency(gstSummary?.igstCollected ?? 0) },
              { label: 'CESS Collected', value: formatCurrency(gstSummary?.cessCollected ?? 0) },
            ],
          },
          {
            heading: 'GST Engine — Input Tax Credit',
            rows: [
              { label: 'Taxable Purchases', value: formatCurrency(engineTaxablePurchases) },
              { label: 'Total Input Tax', value: formatCurrency(engineInputTax) },
              { label: 'Eligible ITC', value: formatCurrency(itcSummary?.eligibleITC ?? 0) },
              { label: 'Blocked ITC (Sec 17(5))', value: formatCurrency(itcSummary?.blockedITC ?? 0) },
              { label: 'Remaining ITC', value: formatCurrency(itcSummary?.remainingITC ?? 0) },
            ],
          },
          {
            heading: 'GST Engine — Net Liability',
            rows: [
              { label: 'Net GST Liability', value: formatCurrency(engineNetLiability) },
              { label: 'Outstanding GST', value: formatCurrency(engineOutstandingGST) },
              { label: 'GST Health Score', value: formatNumber(engineHealthScore) },
            ],
          },
          {
            heading: 'GSTR-1 Draft Totals (Engine)',
            rows: gstr1Draft
              ? [
                  { label: 'Invoice Count', value: formatNumber(gstr1Draft.totals.invoiceCount) },
                  { label: 'Total Taxable Value', value: formatCurrency(gstr1Draft.totals.taxableValue) },
                  { label: 'CGST', value: formatCurrency(gstr1Draft.totals.cgst) },
                  { label: 'SGST', value: formatCurrency(gstr1Draft.totals.sgst) },
                  { label: 'IGST', value: formatCurrency(gstr1Draft.totals.igst) },
                  { label: 'CESS', value: formatCurrency(gstr1Draft.totals.cess) },
                  { label: 'Total Tax', value: formatCurrency(gstr1Draft.totals.totalTax) },
                ]
              : [{ label: 'GSTR-1 Draft', value: 'No data for current period' }],
          },
          {
            heading: 'GSTR-3B Draft (Engine)',
            rows: gstr3bDraft
              ? [
                  { label: 'Outward Taxable Value', value: formatCurrency(gstr3bDraft.outwardSupplies.taxableValue) },
                  { label: 'Outward CGST', value: formatCurrency(gstr3bDraft.outwardSupplies.cgst) },
                  { label: 'Outward SGST', value: formatCurrency(gstr3bDraft.outwardSupplies.sgst) },
                  { label: 'Outward IGST', value: formatCurrency(gstr3bDraft.outwardSupplies.igst) },
                  { label: 'Eligible ITC (Total)', value: formatCurrency(gstr3bDraft.itc.totalITC) },
                  { label: 'Ineligible ITC', value: formatCurrency(gstr3bDraft.itc.ineligibleITC) },
                  {
                    label: 'Net Liability (CGST+SGST+IGST+CESS)',
                    value: formatCurrency(
                      gstr3bDraft.netLiability.cgst +
                        gstr3bDraft.netLiability.sgst +
                        gstr3bDraft.netLiability.igst +
                        gstr3bDraft.netLiability.cess,
                    ),
                  },
                ]
              : [{ label: 'GSTR-3B Draft', value: 'No data for current period' }],
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
        toast.error('Pop-up blocked. Allow pop-ups for GSTPilot to export PDF reports.', { description: 'Update your browser settings to permit pop-ups from this site, then try again.' });
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
          {
            heading: 'ITC Summary (GST Engine)',
            rows: [
              { label: 'Eligible ITC', value: formatCurrency(itcSummary?.eligibleITC ?? 0) },
              { label: 'Blocked ITC (Sec 17(5))', value: formatCurrency(itcSummary?.blockedITC ?? 0) },
              { label: 'Reverse-Charge ITC', value: formatCurrency(itcSummary?.reverseChargeITC ?? 0) },
              { label: 'Pending ITC', value: formatCurrency(itcSummary?.pendingITC ?? 0) },
              { label: 'Used ITC', value: formatCurrency(itcSummary?.usedITC ?? 0) },
              { label: 'Remaining ITC', value: formatCurrency(itcSummary?.remainingITC ?? 0) },
            ],
          },
          {
            heading: 'Bank Reconciliation (Banking Foundation)',
            rows: [
              { label: 'Pending Reconciliation', value: formatNumber(bankingSummary?.pendingReconciliation ?? 0) },
              { label: 'Matched Transactions', value: formatNumber(bankingSummary?.matchedCount ?? 0) },
              { label: 'Partially Matched', value: formatNumber(bankingSummary?.partiallyMatchedCount ?? 0) },
              {
                label: 'Unmatched',
                value: formatNumber(
                  Math.max(
                    0,
                    (bankingSummary?.incomingCount ?? 0) +
                      (bankingSummary?.outgoingCount ?? 0) -
                      (bankingSummary?.matchedCount ?? 0) -
                      (bankingSummary?.partiallyMatchedCount ?? 0),
                  ),
                ),
              },
              { label: 'Connected Accounts', value: formatNumber(bankingSummary?.connectedAccounts ?? 0) },
            ],
          },
        ],
      });
      const ok = openPrintWindow(html);
      if (!ok) {
        toast.error('Pop-up blocked. Allow pop-ups for GSTPilot to export PDF reports.', { description: 'Update your browser settings to permit pop-ups from this site, then try again.' });
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
          {
            heading: 'GST Engine — Period Totals',
            rows: [
              { label: 'Taxable Sales', value: formatCurrency(gstSummary?.taxableSales ?? 0) },
              { label: 'Total Output Tax', value: formatCurrency(gstSummary?.totalOutputTax ?? 0) },
              { label: 'Taxable Purchases', value: formatCurrency(gstSummary?.taxablePurchases ?? 0) },
              { label: 'Total Input Tax', value: formatCurrency(gstSummary?.totalInputTax ?? 0) },
              { label: 'Net GST Liability', value: formatCurrency(gstSummary?.netLiability ?? 0) },
              { label: 'Outstanding GST', value: formatCurrency(gstSummary?.outstandingGST ?? 0) },
              { label: 'Sales Count', value: formatNumber(gstSummary?.salesCount ?? 0) },
              { label: 'Purchase Count', value: formatNumber(gstSummary?.purchaseCount ?? 0) },
              { label: 'GST Health Score', value: formatNumber(gstSummary?.healthScore ?? 0) },
            ],
          },
          {
            heading: 'Banking Summary (Banking Foundation)',
            rows: [
              { label: 'Total Balance', value: formatCurrency(bankingSummary?.totalBalance ?? 0) },
              { label: 'Available Balance', value: formatCurrency(bankingSummary?.availableBalance ?? 0) },
              { label: 'Incoming Payments', value: formatCurrency(bankingSummary?.incomingPayments ?? 0) },
              { label: 'Outgoing Payments', value: formatCurrency(bankingSummary?.outgoingPayments ?? 0) },
              {
                label: 'Net Cash Flow',
                value: formatCurrency(
                  (bankingSummary?.incomingPayments ?? 0) - (bankingSummary?.outgoingPayments ?? 0),
                ),
              },
              { label: 'Pending Reconciliation', value: formatNumber(bankingSummary?.pendingReconciliation ?? 0) },
              { label: 'Matched Transactions', value: formatNumber(bankingSummary?.matchedCount ?? 0) },
              { label: 'Connected Accounts', value: formatNumber(bankingSummary?.connectedAccounts ?? 0) },
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
        toast.error('Pop-up blocked. Allow pop-ups for GSTPilot to export PDF reports.', { description: 'Update your browser settings to permit pop-ups from this site, then try again.' });
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
      // Real Banking Foundation™ — banking cash flow values for the PDF.
      // All null-safe (0 when no bank connected) so the PDF renders cleanly
      // even before any bank is connected.
      const bankInflow = bankingSummary?.incomingPayments ?? 0;
      const bankOutflow = bankingSummary?.outgoingPayments ?? 0;
      const bankNet = bankInflow - bankOutflow;
      const bankTotalBalance = bankingSummary?.totalBalance ?? 0;
      const bankAvailBalance = bankingSummary?.availableBalance ?? 0;
      const bankPendingRecon = bankingSummary?.pendingReconciliation ?? 0;
      const bankMatched = bankingSummary?.matchedCount ?? 0;
      const inflowByCat = bankingSummary?.inflowByCategory;
      const outflowByCat = bankingSummary?.outflowByCategory;
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
            heading: 'Cash Flow Impact (Invoice Engine)',
            rows: [
              { label: 'Cash Inflow (Collected)', value: formatCurrency(cashFlowSummary.inflow) },
              { label: 'Outstanding', value: formatCurrency(cashFlowSummary.outstanding) },
              { label: 'Overdue', value: formatCurrency(cashFlowSummary.overdue) },
              { label: 'Invoice Count', value: formatNumber(cashFlowSummary.invoiceCount) },
              { label: 'ITC Difference', value: formatCurrency(cashFlowSummary.itcDifference) },
            ],
          },
          {
            heading: 'Banking Cash Flow (Banking Foundation)',
            rows: [
              { label: 'Bank Incoming Payments', value: formatCurrency(bankInflow) },
              { label: 'Bank Outgoing Payments', value: formatCurrency(bankOutflow) },
              { label: 'Net Bank Cash Flow', value: formatCurrency(bankNet) },
              { label: 'Total Bank Balance', value: formatCurrency(bankTotalBalance) },
              { label: 'Available Balance', value: formatCurrency(bankAvailBalance) },
              { label: 'Pending Reconciliation', value: formatNumber(bankPendingRecon) },
              { label: 'Matched Transactions', value: formatNumber(bankMatched) },
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
          {
            heading: 'Banking Inflow / Outflow by Category',
            columns: ['Category', 'Inflow (Credit)', 'Outflow (Debit)', 'Net'],
            rows: ALL_CATEGORIES.map((cat: TransactionCategory) => {
              const inflowAmt = inflowByCat?.[cat] ?? 0;
              const outflowAmt = outflowByCat?.[cat] ?? 0;
              return [
                CATEGORY_LABELS[cat] ?? cat,
                formatCurrency(inflowAmt),
                formatCurrency(outflowAmt),
                formatCurrency(inflowAmt - outflowAmt),
              ];
            }),
          },
        ],
      });
      const ok = openPrintWindow(html);
      if (!ok) {
        toast.error('Pop-up blocked. Allow pop-ups for GSTPilot to export PDF reports.', { description: 'Update your browser settings to permit pop-ups from this site, then try again.' });
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
  // Wait for the legacy /api/invoices fetch (client dropdown), the real-time
  // invoice engine subscription, the GST Return Engine™ subscription, AND the
  // Real Banking Foundation™ subscription so the page never renders with
  // stale engine, GST, or banking data.
  if (loading || engineLoading || gstLoading || bankingLoading) {
    return (
      <div className="gst-container-wide py-6 md:py-8 space-y-8">
        <div className="flex items-start gap-4">
          <Skeleton className="size-12 rounded-xl" />
          <div className="space-y-2 pt-1">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Handler lookup for each catalog report card ─────────────────────────
  // Maps a catalog entry's handler key to its actual function so the
  // ReportCard component can fire the right generator with one prop.
  const handlerFor = (key: ReportHandlerKey): (() => void) => {
    switch (key) {
      case 'json':
        return handleGenerateJSON;
      case 'csv':
        return handleGenerateExcel;
      case 'report':
        return handleGeneratePDF;
      case 'working-papers':
        return handleGenerateWorkingPapers;
      case 'gst-pdf':
        return handlePrintGSTSummary;
      case 'compliance-pdf':
        return handlePrintCompliance;
      case 'financial-pdf':
        return handlePrintFinancial;
      case 'cashflow-pdf':
        return handlePrintCashFlow;
      default:
        return () => {};
    }
  };

  const downloadFor = (exportType: string): (() => void) => {
    const match = recentExports.find((e) => e.exportType === exportType && e.data);
    return () => match && handleDownloadExport(match);
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="gst-container-wide py-6 md:py-8 space-y-8">
      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER — page title + summary KPIs
      ═══════════════════════════════════════════════════════════════════════ */}
      <header className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/25">
              <Package className="size-6 text-[#60A5FA]" />
            </div>
            <div className="min-w-0">
              <h1 className="gst-page-title">Reports &amp; Export Center</h1>
              <p className="gst-description mt-1.5 max-w-2xl">
                Generate, export, and download GST returns, reconciliation reports, and audit-ready
                packages — all in one place.
              </p>
            </div>
          </div>
          {lastGeneratedAny && (
            <div className="gst-card gst-card-compact hidden sm:flex items-center gap-2.5 shrink-0">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20">
                <Clock className="size-3.5 text-[#60A5FA]" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Last Activity
                </p>
                <p className="text-xs text-foreground font-semibold">
                  {formatRelativeTime(lastGeneratedAny)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="gst-card gst-card-compact">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#181818] border border-[#222222]">
                <Package className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Total Reports
                </p>
                <p className="text-2xl font-bold tabular-nums text-foreground">{TOTAL_REPORTS}</p>
              </div>
            </div>
          </div>
          <div className="gst-card gst-card-compact">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20">
                <CheckCircle2 className="size-4 text-[#60A5FA]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Ready
                </p>
                <p className="text-2xl font-bold tabular-nums text-[#60A5FA]">
                  {CONFIGURED_REPORTS}
                </p>
              </div>
            </div>
          </div>
          <div className="gst-card gst-card-compact">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#181818] border border-[#222222]">
                <Database className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Saved Reports
                </p>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {savedReports.length}
                </p>
              </div>
            </div>
          </div>
          <div className="gst-card gst-card-compact">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#181818] border border-[#222222]">
                <History className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Local History
                </p>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {recentExports.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          FILTER BAR — search + status filter
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="gst-card gst-card-compact">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports by name or keyword…"
              className="h-10 pl-9 border-[#222222] bg-[#0F0F0F] focus-visible:border-[#2563EB]/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-[#181818] hover:text-foreground"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline mr-1 text-xs text-muted-foreground">Status:</span>
            {(['all', 'ready', 'not_configured'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'gst-btn gst-btn-sm',
                  statusFilter === s ? 'gst-btn-primary' : 'gst-btn-ghost',
                )}
              >
                {s === 'all' ? 'All' : s === 'ready' ? 'Ready' : 'Not Configured'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          EXPORT CONFIGURATION — collapsible card with client / period / sections
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="gst-card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#181818] border border-[#222222]">
              <Filter className="size-4 text-[#60A5FA]" />
            </div>
            <div className="min-w-0">
              <h2 className="gst-section-title">Export Configuration</h2>
              <p className="gst-description text-xs">
                Applies to GSTR-1 JSON, Sales Register, and Working Papers exports
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfigOpen((o) => !o)}
            className="gst-btn gst-btn-ghost gst-btn-sm shrink-0"
          >
            <ChevronDown
              className={cn('size-4 transition-transform duration-200', configOpen && 'rotate-180')}
            />
            {configOpen ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {configOpen && (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Client
                </label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="bg-[#0F0F0F] border-[#222222]">
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
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Month
                </label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="bg-[#0F0F0F] border-[#222222]">
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
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Year
                </label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="bg-[#0F0F0F] border-[#222222]">
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
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Return Type
                </label>
                <Select value={returnType} onValueChange={setReturnType}>
                  <SelectTrigger className="bg-[#0F0F0F] border-[#222222]">
                    <SelectValue placeholder="Return Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GSTR-1">GSTR-1</SelectItem>
                    <SelectItem value="GSTR-3B">GSTR-3B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="bg-[#1F1F1F]" />

            <div className="space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Include Sections
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {SECTION_KEYS.map((section) => (
                  <label
                    key={section}
                    htmlFor={`section-${section}`}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] px-3 py-2 transition-colors hover:border-[#2A2A2A]"
                  >
                    <Checkbox
                      id={`section-${section}`}
                      checked={includeSections[section]}
                      onCheckedChange={() => toggleSection(section)}
                    />
                    <span className="select-none text-xs font-medium">
                      {section.toUpperCase()}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <Separator className="bg-[#1F1F1F]" />

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Total Invoices
                </p>
                <p className="mt-0.5 text-lg font-bold text-foreground tabular-nums">
                  {formatNumber(totalInvoices)}
                </p>
              </div>
              <div className="rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Taxable Value
                </p>
                <p className="mt-0.5 text-lg font-bold text-foreground tabular-nums">
                  {formatCurrency(totalTaxableValue)}
                </p>
              </div>
              <div className="rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Total Tax
                </p>
                <p className="mt-0.5 text-lg font-bold text-foreground tabular-nums">
                  {formatCurrency(totalTax)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          REPORTS CATALOG — 5 categories of premium report cards
      ═══════════════════════════════════════════════════════════════════════ */}
      {totalFilteredReports === 0 ? (
        <div className="gst-card">
          <div className="gst-empty-state">
            <div className="gst-empty-state-icon">
              <Search className="size-7 text-muted-foreground" />
            </div>
            <p className="gst-empty-state-title">No reports match your search</p>
            <p className="gst-empty-state-desc">
              Try a different keyword or change the status filter to see more reports.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="gst-btn gst-btn-sm gst-btn-primary"
            >
              Clear Filters
            </button>
          </div>
        </div>
      ) : (
        filteredCatalog.map((category, catIdx) => {
          const CategoryIcon = category.icon;
          return (
            <section key={category.id} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#181818] border border-[#222222]">
                    <CategoryIcon className="size-4 text-[#60A5FA]" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="gst-section-title truncate">{category.title}</h2>
                    <p className="gst-description truncate text-xs">{category.description}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 text-[11px] uppercase tracking-wider"
                >
                  {category.reports.length}{' '}
                  {category.reports.length === 1 ? 'report' : 'reports'}
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {category.reports.map((report, idx) => (
                  <div
                    key={report.id}
                    className="gst-animate-in"
                    style={{ animationDelay: `${(catIdx * 4 + idx) * 50}ms` }}
                  >
                    <ReportCard
                      report={report}
                      generating={generating}
                      lastGeneratedAt={findReportLastGenerated(report.exportType)}
                      hasDownload={hasDownloadForReport(report.exportType, report.fileType)}
                      onGenerate={handlerFor(report.handler)}
                      onDownload={downloadFor(report.exportType)}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          HISTORY & SAVED REPORTS — Firestore + localStorage
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#181818] border border-[#222222]">
            <History className="size-4 text-[#60A5FA]" />
          </div>
          <div className="min-w-0">
            <h2 className="gst-section-title">History &amp; Saved Reports</h2>
            <p className="gst-description text-xs">
              All previously generated reports — saved to the cloud or stored locally in this browser
            </p>
          </div>
        </div>

        <Tabs value={historyTab} onValueChange={setHistoryTab}>
          <TabsList className="h-auto">
            <TabsTrigger value="saved" className="gap-1.5">
              <Database className="size-3.5" />
              Saved Reports
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[11px]">
                {savedReports.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="local" className="gap-1.5">
              <Clock className="size-3.5" />
              Local History
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[11px]">
                {recentExports.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── SAVED REPORTS (Firestore) ── */}
          <TabsContent value="saved" className="mt-4">
            <div className="gst-card">
              <div className="mb-4">
                <h3 className="gst-card-title">Saved Reports</h3>
                <p className="gst-description text-xs">
                  Persisted to the cloud — accessible across devices &amp; sessions
                </p>
              </div>

              {fireReportsQ.loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : fireReportsQ.error ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                  <span>Failed to load saved reports: {fireReportsQ.error}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 border-red-500/30 text-xs text-red-400 hover:bg-red-500/10"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="size-3" />
                    Retry
                  </Button>
                </div>
              ) : savedReports.length === 0 ? (
                <div className="gst-empty-state">
                  <div className="gst-empty-state-icon">
                    <Database className="size-7 text-muted-foreground" />
                  </div>
                  <p className="gst-empty-state-title">No saved reports yet</p>
                  <p className="gst-empty-state-desc">
                    Generate your first report above — it will be saved to the cloud automatically
                    for access across all your devices.
                  </p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-lg border border-[#1F1F1F]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#0F0F0F] hover:bg-[#0F0F0F]">
                        <TableHead className="whitespace-nowrap">Report Type</TableHead>
                        <TableHead className="whitespace-nowrap">Client</TableHead>
                        <TableHead className="whitespace-nowrap">Period</TableHead>
                        <TableHead className="whitespace-nowrap">Generated</TableHead>
                        <TableHead className="whitespace-nowrap">Size</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedReports.map((report) => {
                        const exportType = String(
                          report.metadata?.exportType ?? report.title ?? report.reportType,
                        );
                        const config = EXPORT_TYPE_CONFIG[exportType];
                        const sizeLabel = String(
                          report.metadata?.fileSizeLabel ??
                            (report.fileSize > 0
                              ? `${(report.fileSize / 1024).toFixed(1)} KB`
                              : '—'),
                        );
                        return (
                          <TableRow key={report.reportId} className="hover:bg-[#0F0F0F]">
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    'flex size-7 items-center justify-center rounded',
                                    config?.bgColor ?? 'bg-white/[0.03]',
                                  )}
                                >
                                  {config?.icon ?? <FileText className="size-3.5" />}
                                </div>
                                <span className="text-sm font-medium">{exportType}</span>
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
                                ? formatRelativeTime(report.generatedAt as string)
                                : '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              <Badge variant="outline" className="text-xs">
                                {sizeLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-1">
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
            </div>
          </TabsContent>

          {/* ── LOCAL HISTORY (localStorage) ── */}
          <TabsContent value="local" className="mt-4">
            <div className="gst-card">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="gst-card-title">Local Report History</h3>
                  <p className="gst-description text-xs">
                    Last {HISTORY_LIMIT} generated reports — stored only in this browser
                  </p>
                </div>
                {recentExports.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearHistory}
                    className="gap-1.5 text-red-500 hover:border-red-500/30 hover:text-red-700"
                  >
                    <Trash2 className="size-3.5" />
                    Clear All
                  </Button>
                )}
              </div>

              {recentExports.length === 0 ? (
                <div className="gst-empty-state">
                  <div className="gst-empty-state-icon">
                    <Clock className="size-7 text-muted-foreground" />
                  </div>
                  <p className="gst-empty-state-title">No reports generated yet</p>
                  <p className="gst-empty-state-desc">
                    Generate a report above — completed exports will appear here for quick
                    re-download.
                  </p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-lg border border-[#1F1F1F]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#0F0F0F] hover:bg-[#0F0F0F]">
                        <TableHead className="whitespace-nowrap">Report Type</TableHead>
                        <TableHead className="whitespace-nowrap">Client</TableHead>
                        <TableHead className="whitespace-nowrap">Period</TableHead>
                        <TableHead className="whitespace-nowrap">Generated</TableHead>
                        <TableHead className="whitespace-nowrap">File Size</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentExports.map((exp) => {
                        const config = EXPORT_TYPE_CONFIG[exp.exportType];
                        return (
                          <TableRow key={exp.id} className="hover:bg-[#0F0F0F]">
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    'flex size-7 items-center justify-center rounded',
                                    config?.bgColor ?? 'bg-white/[0.03]',
                                  )}
                                >
                                  {config?.icon ?? <FileText className="size-3.5" />}
                                </div>
                                <span className="text-sm font-medium">{exp.exportType}</span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {exp.clientName}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{exp.period}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {formatRelativeTime(exp.generatedAt)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              <Badge variant="outline" className="text-xs">
                                {exp.fileSize}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-1">
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
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          PREVIEW DIALOG (preserved for export-package view-as-JSON)
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-4 text-[#60A5FA]" />
              Export Preview — {previewData?.exportType}
            </DialogTitle>
          </DialogHeader>
          {previewData?.data ? (
            <div className="rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] p-4">
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">
                {JSON.stringify(previewData.data, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">Preview not available for this export type</p>
              <p className="mt-1 text-xs">
                The PDF was opened in your browser&apos;s print dialog
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
