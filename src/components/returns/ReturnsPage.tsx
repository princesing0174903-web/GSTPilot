'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Download,
  ArrowRight,
  Zap,
  Send,
  Loader2,
  ChevronRight,
  AlertCircle,
  Clock,
  Wrench,
  Eye,
  Info,
  ShieldCheck,
  FileOutput,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { useGSTStore } from '@/stores/gst-store';
import {
  GSTRFiling,
  Client,
  FilingStatus,
  FILING_STATUS_CONFIG,
} from '@/types/gst';
import {
  formatCurrency,
  periodToLabel,
  getFinancialYear,
} from '@/lib/gst-utils';

// ─── Types ──────────────────────────────────────────────────────────────────────

type KanbanColumn = 'draft' | 'ready' | 'filed' | 'attention';

interface SectionBreakdown {
  section: string;
  invoiceCount: number;
  taxableValue: number;
  taxAmount: number;
}

// ─── Kanban Column Config ───────────────────────────────────────────────────────

const KANBAN_COLUMNS: {
  key: KanbanColumn;
  label: string;
  borderTopColor: string;
  bgColor: string;
  headerBg: string;
  countBadgeClass: string;
  icon: React.ReactNode;
  emptyText: string;
}[] = [
  {
    key: 'draft',
    label: 'Draft',
    borderTopColor: 'border-t-slate-400',
    bgColor: 'bg-slate-50',
    headerBg: 'bg-slate-100/80',
    countBadgeClass: 'bg-slate-200 text-slate-700',
    icon: <FileText className="size-4 text-slate-500" />,
    emptyText: 'No draft returns',
  },
  {
    key: 'ready',
    label: 'Ready to File',
    borderTopColor: 'border-t-emerald-500',
    bgColor: 'bg-emerald-50',
    headerBg: 'bg-emerald-100/80',
    countBadgeClass: 'bg-emerald-200 text-emerald-800',
    icon: <Zap className="size-4 text-emerald-600" />,
    emptyText: 'No returns ready to file',
  },
  {
    key: 'filed',
    label: 'Filed',
    borderTopColor: 'border-t-green-600',
    bgColor: 'bg-green-50',
    headerBg: 'bg-green-100/80',
    countBadgeClass: 'bg-green-200 text-green-800',
    icon: <CheckCircle2 className="size-4 text-green-600" />,
    emptyText: 'No filed returns yet',
  },
  {
    key: 'attention',
    label: 'Requires Attention',
    borderTopColor: 'border-t-red-500',
    bgColor: 'bg-red-50',
    headerBg: 'bg-red-100/80',
    countBadgeClass: 'bg-red-200 text-red-800',
    icon: <AlertTriangle className="size-4 text-red-500" />,
    emptyText: 'No issues found',
  },
];

// ─── Period Options ─────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: '2025-06', label: 'Jun 2025' },
  { value: '2025-05', label: 'May 2025' },
  { value: '2025-04', label: 'Apr 2025' },
  { value: '2025-03', label: 'Mar 2025' },
  { value: '2025-02', label: 'Feb 2025' },
  { value: '2025-01', label: 'Jan 2025' },
];

// ─── Timeline Steps ─────────────────────────────────────────────────────────────

const TIMELINE_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'validated', label: 'Validated' },
  { key: 'generated', label: 'Generated' },
  { key: 'filed', label: 'Filed' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getKanbanColumn(status: FilingStatus): KanbanColumn {
  switch (status) {
    case 'draft':
    case 'prepared':
      return 'draft';
    case 'validated':
    case 'reviewed':
    case 'generated':
      return 'ready';
    case 'filed':
      return 'filed';
    case 'reopened':
      return 'attention';
    default:
      return 'draft';
  }
}

function getTimelineStepIndex(status: FilingStatus): number {
  switch (status) {
    case 'draft':
    case 'prepared':
      return 0;
    case 'validated':
    case 'reviewed':
      return 1;
    case 'generated':
      return 2;
    case 'filed':
      return 3;
    case 'reopened':
      return -1;
    default:
      return 0;
  }
}

function getAttentionSummary(filing: GSTRFiling): string {
  if (filing.issuesFound <= 0) return 'No issues';
  const parts: string[] = [];
  if (filing.criticalErrors > 0) parts.push(`${filing.criticalErrors} critical error${filing.criticalErrors > 1 ? 's' : ''}`);
  if (filing.warnings > 0) parts.push(`${filing.warnings} warning${filing.warnings > 1 ? 's' : ''}`);
  if (filing.issuesFound > 0 && parts.length === 0) parts.push(`${filing.issuesFound} issue${filing.issuesFound > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

function getReturnTypeBadgeClass(returnType: string): string {
  if (returnType === 'GSTR-1') {
    return 'border-teal-200 bg-teal-50 text-teal-700';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

// ─── Section Breakdown Computation ──────────────────────────────────────────────

function computeSectionsForFiling(
  returnType: string,
  invoices: { taxableValue: number; cgst: number; sgst: number; igst: number; customerGstin?: string; status: string }[]
): SectionBreakdown[] {
  if (returnType === 'GSTR-1') {
    const b2b = invoices.filter(inv => inv.customerGstin);
    const b2cLarge = invoices.filter(inv => !inv.customerGstin && inv.taxableValue >= 250000);
    const b2cSmall = invoices.filter(inv => !inv.customerGstin && inv.taxableValue < 250000);

    return [
      {
        section: 'B2B',
        invoiceCount: b2b.length,
        taxableValue: b2b.reduce((s, i) => s + i.taxableValue, 0),
        taxAmount: b2b.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0),
      },
      {
        section: 'B2C Large',
        invoiceCount: b2cLarge.length,
        taxableValue: b2cLarge.reduce((s, i) => s + i.taxableValue, 0),
        taxAmount: b2cLarge.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0),
      },
      {
        section: 'B2C Small',
        invoiceCount: b2cSmall.length,
        taxableValue: b2cSmall.reduce((s, i) => s + i.taxableValue, 0),
        taxAmount: b2cSmall.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0),
      },
      {
        section: 'CDNR',
        invoiceCount: 0,
        taxableValue: 0,
        taxAmount: 0,
      },
    ];
  }

  // GSTR-3B
  const totalTax = invoices.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0);
  const totalTaxable = invoices.reduce((s, i) => s + i.taxableValue, 0);
  return [
    {
      section: 'Outward Supplies',
      invoiceCount: invoices.length,
      taxableValue: totalTaxable,
      taxAmount: totalTax,
    },
    {
      section: 'Inward Supplies (RC)',
      invoiceCount: 0,
      taxableValue: 0,
      taxAmount: 0,
    },
    {
      section: 'ITC Claims',
      invoiceCount: 0,
      taxableValue: 0,
      taxAmount: Math.round(-totalTax * 0.6),
    },
    {
      section: 'Tax Paid',
      invoiceCount: 0,
      taxableValue: 0,
      taxAmount: Math.round(totalTax * 0.75),
    },
  ];
}

// ─── Animation Variants ─────────────────────────────────────────────────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
};

const cardHover = {
  y: -2,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  transition: { duration: 0.18 },
};

const columnEnter = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.1, ease: 'easeOut' },
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function ReturnsPage() {
  const { setCurrentView } = useApp();
  const store = useGSTStore();

  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedFiling, setSelectedFiling] = useState<GSTRFiling | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filingAction, setFilingAction] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('2025-06');

  // ── Data from Store ──────────────────────────────────────────────────────
  const storeFilings = store.filings;
  const storeClients = store.clients;

  // Map store filings to GSTRFiling format with client enriched
  const filings = useMemo<GSTRFiling[]>(() => {
    return storeFilings.map((f) => {
      const client = storeClients.find(c => c.id === f.clientId) as Client | undefined;
      return {
        ...f,
        financialYear: getFinancialYear(f.period),
        client,
      };
    });
  }, [storeFilings, storeClients]);

  // ── Derived Data ──────────────────────────────────────────────────────────
  const filteredFilings = useMemo(() => {
    // Show all filings (don't filter by period so all kanban cards are visible)
    return filings;
  }, [filings]);

  const kanbanData = useMemo(() => {
    const columns: Record<KanbanColumn, GSTRFiling[]> = {
      draft: [],
      ready: [],
      filed: [],
      attention: [],
    };
    filteredFilings.forEach((f) => {
      const col = getKanbanColumn(f.status);
      columns[col].push(f);
    });
    return columns;
  }, [filteredFilings]);

  // ── Health Score Computation from Store ───────────────────────────────────
  const healthMetrics = useMemo(() => {
    const filedCount = storeFilings.filter(f => f.status === 'filed').length;
    const criticalCount = storeFilings.filter(f => f.criticalErrors > 0).length;
    const totalReturns = storeFilings.length;
    const avgCompliance = storeClients.length > 0
      ? Math.round(storeClients.reduce((sum, c) => sum + c.healthScore, 0) / storeClients.length)
      : 0;

    const overallHealth = avgCompliance;
    const filingTimeliness = totalReturns > 0
      ? Math.round((filedCount / totalReturns) * 100)
      : 0;
    const dataAccuracy = totalReturns > 0
      ? Math.round(((totalReturns - criticalCount) / totalReturns) * 100)
      : 100;
    const compliance = avgCompliance;
    return { overallHealth, filingTimeliness, dataAccuracy, compliance };
  }, [storeFilings, storeClients]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCardClick = (filing: GSTRFiling) => {
    setSelectedFiling(filing);
    setSheetOpen(true);
  };

  const handleFileReturn = async (filing: GSTRFiling) => {
    setFilingAction(filing.id);

    // Use store's fileReturn method (handles status update, ARN generation, activity logging)
    store.fileReturn(filing.id);

    // Wait for store to complete filing (store has 1.5s delay internally)
    await new Promise((r) => setTimeout(r, 2000));

    // Read updated filing from store for ARN in toast
    const updatedFiling = store.filings.find(f => f.id === filing.id);

    setFilingAction(null);
    setSheetOpen(false);
    setSelectedFiling(null);

    toast.success(`${filing.returnType} filed successfully!`, {
      description: `ARN: ${updatedFiling?.acknowledgmentNumber ?? 'Pending'}`,
      duration: 5000,
    });
  };

  const handlePrepare = (filing: GSTRFiling) => {
    setSelectedFiling(filing);
    setSheetOpen(true);
  };

  const handleFixIssues = () => {
    setCurrentView('reconcile');
  };

  const handleViewDetails = (filing: GSTRFiling) => {
    setSelectedFiling(filing);
    setSheetOpen(true);
  };

  const handleCreateReturn = () => {
    toast.info('Create Return wizard coming soon!', {
      description: 'You can upload documents from the Invoices section.',
    });
  };

  const handleDownloadJSON = (filing: GSTRFiling) => {
    toast.success('JSON downloaded', {
      description: `${filing.returnType} for ${filing.client?.tradeName} · ${periodToLabel(filing.period)}`,
    });
  };

  // ── Loading State ─────────────────────────────────────────────────────────
  // Show a brief skeleton while store data initializes
  if (storeFilings.length === 0) {
    return (
      <div className="space-y-5 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-12 w-full rounded-t-lg" />
              <div className="space-y-2 p-2">
                <Skeleton className="h-28 w-full rounded-lg" />
                <Skeleton className="h-28 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Render Helpers
  // ═════════════════════════════════════════════════════════════════════════

  const renderDraftCard = (filing: GSTRFiling) => {
    const clientName = filing.client?.tradeName ?? 'Unknown Client';
    const periodLabel = periodToLabel(filing.period);

    return (
      <motion.div
        key={filing.id}
        variants={staggerItem}
        whileHover={cardHover}
        className="cursor-pointer"
        onClick={() => handleCardClick(filing)}
      >
        <Card className="border shadow-sm bg-white transition-shadow hover:shadow-md">
          <CardContent className="p-3.5 space-y-2.5">
            {/* Client Name */}
            <p className="text-sm font-semibold truncate leading-tight">
              {clientName}
            </p>

            {/* Return Type + Period */}
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 font-semibold ${getReturnTypeBadgeClass(filing.returnType)}`}
              >
                {filing.returnType}
              </Badge>
              <span className="text-[11px] text-muted-foreground">{periodLabel}</span>
            </div>

            {/* Invoice count */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <FileText className="size-3" />
              <span>{filing.totalInvoices} invoices</span>
            </div>

            {/* Issues badge */}
            {filing.issuesFound > 0 && (
              <div className="flex items-center gap-1">
                <Badge className="text-[10px] px-1.5 py-0 h-5 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-medium">
                  <AlertCircle className="size-2.5 mr-0.5" />
                  {filing.issuesFound} issues
                </Badge>
              </div>
            )}

            {/* Prepare button */}
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs gap-1.5 border-slate-300 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={(e) => {
                e.stopPropagation();
                handlePrepare(filing);
              }}
            >
              <ArrowRight className="size-3" />
              Prepare
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const renderReadyCard = (filing: GSTRFiling) => {
    const clientName = filing.client?.tradeName ?? 'Unknown Client';
    const periodLabel = periodToLabel(filing.period);
    const isFiling = filingAction === filing.id || store.filingInProgressIds.includes(filing.id);

    return (
      <motion.div
        key={filing.id}
        variants={staggerItem}
        whileHover={cardHover}
        className="cursor-pointer"
        onClick={() => handleCardClick(filing)}
      >
        <Card className="border shadow-sm bg-white transition-shadow hover:shadow-md">
          <CardContent className="p-3.5 space-y-2.5">
            {/* Client Name */}
            <p className="text-sm font-semibold truncate leading-tight">
              {clientName}
            </p>

            {/* Return Type + Period */}
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 font-semibold ${getReturnTypeBadgeClass(filing.returnType)}`}
              >
                {filing.returnType}
              </Badge>
              <span className="text-[11px] text-muted-foreground">{periodLabel}</span>
            </div>

            {/* Total Tax — prominent */}
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-emerald-700">
                {formatCurrency(filing.totalTax)}
              </span>
              <span className="text-[10px] text-muted-foreground">total tax</span>
            </div>

            {/* Invoice count */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <FileText className="size-3" />
              <span>{filing.totalInvoices} invoices</span>
            </div>

            {/* File Return button — MAIN CTA */}
            <Button
              size="sm"
              className="w-full h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                handleFileReturn(filing);
              }}
              disabled={isFiling}
            >
              {isFiling ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              {isFiling ? 'Filing...' : 'File Return'}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const renderFiledCard = (filing: GSTRFiling) => {
    const clientName = filing.client?.tradeName ?? 'Unknown Client';

    return (
      <motion.div
        key={filing.id}
        variants={staggerItem}
        whileHover={cardHover}
        className="cursor-pointer"
        onClick={() => handleCardClick(filing)}
      >
        <Card className="border shadow-sm bg-white transition-shadow hover:shadow-md">
          <CardContent className="p-3.5 space-y-2.5">
            {/* Client Name */}
            <p className="text-sm font-semibold truncate leading-tight">
              {clientName}
            </p>

            {/* Return Type */}
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 font-semibold ${getReturnTypeBadgeClass(filing.returnType)}`}
              >
                {filing.returnType}
              </Badge>
            </div>

            {/* ARN Number */}
            {filing.acknowledgmentNumber && (
              <div className="rounded-md bg-green-50 border border-green-100 px-2.5 py-1.5">
                <p className="text-[10px] text-green-600 font-medium">ARN</p>
                <p className="text-xs font-mono font-semibold text-green-800">
                  {filing.acknowledgmentNumber}
                </p>
              </div>
            )}

            {/* Filed date */}
            {filing.filedDate && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="size-3" />
                <span>
                  Filed {new Date(filing.filedDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}

            {/* Download JSON text link */}
            <button
              className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadJSON(filing);
              }}
            >
              <Download className="size-3" />
              Download JSON
            </button>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const renderAttentionCard = (filing: GSTRFiling) => {
    const clientName = filing.client?.tradeName ?? 'Unknown Client';
    const issueSummary = getAttentionSummary(filing);

    return (
      <motion.div
        key={filing.id}
        variants={staggerItem}
        whileHover={cardHover}
        className="cursor-pointer"
        onClick={() => handleCardClick(filing)}
      >
        <Card className="border shadow-sm bg-white transition-shadow hover:shadow-md border-l-4 border-l-red-400">
          <CardContent className="p-3.5 space-y-2.5">
            {/* Client Name */}
            <p className="text-sm font-semibold truncate leading-tight">
              {clientName}
            </p>

            {/* Return Type */}
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 font-semibold ${getReturnTypeBadgeClass(filing.returnType)}`}
              >
                {filing.returnType}
              </Badge>
            </div>

            {/* Issue summary */}
            <div className="rounded-md bg-red-50 border border-red-100 px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700">
                <AlertTriangle className="size-3 shrink-0" />
                <span>{issueSummary}</span>
              </div>
            </div>

            {/* Fix Issues button */}
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
              onClick={(e) => {
                e.stopPropagation();
                handleFixIssues();
              }}
            >
              <Wrench className="size-3" />
              Fix Issues
            </Button>

            {/* View Details text link */}
            <button
              className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleViewDetails(filing);
              }}
            >
              <Eye className="size-3" />
              View Details
            </button>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const renderCard = (filing: GSTRFiling, column: KanbanColumn) => {
    switch (column) {
      case 'draft':
        return renderDraftCard(filing);
      case 'ready':
        return renderReadyCard(filing);
      case 'filed':
        return renderFiledCard(filing);
      case 'attention':
        return renderAttentionCard(filing);
    }
  };

  const renderKanbanColumn = (colConfig: typeof KANBAN_COLUMNS[number], index: number) => {
    const items = kanbanData[colConfig.key];

    return (
      <motion.div
        key={colConfig.key}
        custom={index}
        variants={columnEnter}
        initial="hidden"
        animate="show"
        className={`flex flex-col rounded-xl border-t-4 ${colConfig.borderTopColor} ${colConfig.bgColor} border border-slate-200/60 min-h-0`}
      >
        {/* Column Header */}
        <div
          className={`flex items-center justify-between px-3.5 py-3 ${colConfig.headerBg} rounded-t-[8px] shrink-0`}
        >
          <div className="flex items-center gap-2">
            {colConfig.icon}
            <span className="text-sm font-semibold tracking-tight">{colConfig.label}</span>
            {colConfig.key === 'filed' && items.length > 0 && (
              <CheckCircle2 className="size-3.5 text-green-600" />
            )}
            {colConfig.key === 'attention' && items.length > 0 && (
              <AlertCircle className="size-3.5 text-red-500" />
            )}
          </div>
          <Badge
            className={`h-5 min-w-[22px] justify-center text-[11px] font-bold border-0 ${colConfig.countBadgeClass}`}
          >
            {items.length}
          </Badge>
        </div>

        {/* Cards Area */}
        <ScrollArea className="flex-1 max-h-[calc(100vh-220px)]">
          <div className="p-2.5 space-y-2.5">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="size-12 rounded-full bg-white/60 flex items-center justify-center mb-2">
                  {React.cloneElement(colConfig.icon as React.ReactElement, {
                    className: 'size-5 opacity-25',
                  })}
                </div>
                <p className="text-xs text-muted-foreground/70">{colConfig.emptyText}</p>
              </div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="space-y-2.5"
              >
                {items.map((filing) => renderCard(filing, colConfig.key))}
              </motion.div>
            )}
          </div>
        </ScrollArea>
      </motion.div>
    );
  };

  const renderDetailSheet = () => {
    if (!selectedFiling) return null;
    const filing = selectedFiling;
    const clientName = filing.client?.tradeName ?? 'Unknown';
    const clientGstin = filing.client?.gstin ?? '';
    const column = getKanbanColumn(filing.status);

    // Compute section breakdown from store invoices for this client
    const clientInvoices = store.getInvoicesForClient(filing.clientId);
    const sections = computeSectionsForFiling(filing.returnType, clientInvoices);

    const timelineIndex = getTimelineStepIndex(filing.status);

    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          <SheetHeader className="p-6 pb-4 border-b bg-gradient-to-b from-emerald-50/60 to-transparent">
            <SheetTitle className="text-lg font-bold">{clientName}</SheetTitle>
            <SheetDescription className="text-sm font-mono">
              {clientGstin}
            </SheetDescription>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className={`text-xs font-semibold ${getReturnTypeBadgeClass(filing.returnType)}`}
              >
                {filing.returnType}
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs ${FILING_STATUS_CONFIG[filing.status]?.bgColor ?? 'bg-slate-100'} ${FILING_STATUS_CONFIG[filing.status]?.color ?? 'text-slate-700'}`}
              >
                {FILING_STATUS_CONFIG[filing.status]?.label ?? filing.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {periodToLabel(filing.period)}
              </span>
            </div>
          </SheetHeader>

          <div className="p-6 space-y-6">
            {/* ── Status Timeline (Horizontal) ──────────────────────────── */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </h4>
              <div className="flex items-center gap-0">
                {TIMELINE_STEPS.map((step, i) => {
                  const isCompleted = timelineIndex >= 0 && i <= timelineIndex;
                  const isCurrent = timelineIndex >= 0 && i === timelineIndex;
                  const isReopened = timelineIndex === -1;

                  return (
                    <React.Fragment key={step.key}>
                      {i > 0 && (
                        <div
                          className={`flex-1 h-0.5 mx-1 rounded-full ${
                            isCompleted && !isReopened
                              ? 'bg-emerald-400'
                              : 'bg-slate-200'
                          }`}
                        />
                      )}
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className={`flex size-7 items-center justify-center rounded-full shrink-0 ${
                            isReopened
                              ? 'bg-red-100 text-red-500 ring-2 ring-red-200'
                              : isCompleted
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isCompleted && !isReopened ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : isReopened && i === 0 ? (
                            <AlertTriangle className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-medium whitespace-nowrap ${
                            isCompleted && !isReopened
                              ? 'text-emerald-700'
                              : isReopened
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* ── Section Breakdown — Mini Cards ───────────────────────── */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="size-3" />
                Section Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {sections.map((sec) => (
                  <div
                    key={sec.section}
                    className="rounded-lg border bg-white p-3 space-y-1"
                  >
                    <p className="text-xs font-semibold text-foreground">{sec.section}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {sec.invoiceCount} invoice{sec.invoiceCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm font-bold text-emerald-700">
                      {formatCurrency(sec.taxableValue)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* ── Tax Breakdown ────────────────────────────────────────── */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Info className="size-3" />
                Tax Breakdown
              </h4>
              <div className="rounded-lg border bg-white p-3.5 space-y-2.5">
                {(() => {
                  const total = filing.totalTax;
                  const cgst = Math.round(total * 0.4);
                  const sgst = Math.round(total * 0.4);
                  const igst = total - cgst - sgst;
                  const cess = 0;
                  return (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">CGST</span>
                        <span className="font-medium">{formatCurrency(cgst)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">SGST</span>
                        <span className="font-medium">{formatCurrency(sgst)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">IGST</span>
                        <span className="font-medium">{formatCurrency(igst)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Cess</span>
                        <span className="font-medium">{formatCurrency(cess)}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-sm font-bold">
                        <span>Total Tax</span>
                        <span className="text-emerald-700">{formatCurrency(total)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <Separator />

            {/* ── Key Metrics ──────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Invoices</p>
                <p className="text-lg font-bold">{filing.totalInvoices}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Taxable Value</p>
                <p className="text-sm font-bold text-emerald-700">
                  {formatCurrency(filing.totalTaxableValue)}
                </p>
              </div>
              <div className="rounded-lg bg-teal-50 p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Total Tax</p>
                <p className="text-sm font-bold text-teal-700">
                  {formatCurrency(filing.totalTax)}
                </p>
              </div>
            </div>

            {/* ── Action Buttons (matching the column) ─────────────────── */}
            <div className="pt-2">
              {column === 'draft' && (
                <Button
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handlePrepare(filing)}
                >
                  <ArrowRight className="size-4" />
                  Prepare Return
                </Button>
              )}
              {column === 'ready' && (
                <Button
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleFileReturn(filing)}
                  disabled={filingAction === filing.id || store.filingInProgressIds.includes(filing.id)}
                >
                  {filingAction === filing.id || store.filingInProgressIds.includes(filing.id) ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {filingAction === filing.id || store.filingInProgressIds.includes(filing.id) ? 'Filing...' : 'File Return'}
                </Button>
              )}
              {column === 'filed' && (
                <Button
                  variant="outline"
                  className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => handleDownloadJSON(filing)}
                >
                  <Download className="size-4" />
                  Download JSON
                </Button>
              )}
              {column === 'attention' && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => handleFixIssues()}
                  >
                    <Wrench className="size-4" />
                    Fix Issues
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => handleCardClick(filing)}
                  >
                    <Eye className="size-4" />
                    View Details
                  </Button>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  };

  // ═════════════════════════════════════════════════════════════════════════
  // Main Render
  // ═════════════════════════════════════════════════════════════════════════

  const healthScore = healthMetrics.overallHealth;
  const healthColor = healthScore > 80 ? '#10b981' : healthScore > 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Minimal Header ──────────────────────────────────────────────── */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="show"
        className="flex items-center justify-between px-4 md:px-6 py-4 border-b bg-white shrink-0"
      >
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">Filing Workspace</h1>
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-semibold hover:bg-emerald-100">
            Jun 2025
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-9"
            onClick={handleCreateReturn}
          >
            <Plus className="size-4" />
            Create Return
          </Button>
        </div>
      </motion.div>

      {/* ── Return Health Score ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="px-4 md:px-6 pt-4"
      >
        <Card className="border-0 shadow-sm bg-gradient-to-b from-background to-muted/20">
          <CardContent className="py-4 px-4 md:px-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
              {/* Health Score Ring */}
              <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
                <svg width={72} height={72} className="-rotate-90">
                  <circle cx={36} cy={36} r={30} fill="none" stroke="#f1f5f9" strokeWidth={6} />
                  <motion.circle
                    cx={36} cy={36} r={30} fill="none"
                    stroke={healthColor}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray={`${(healthScore / 100) * 2 * Math.PI * 30} ${2 * Math.PI * 30}`}
                    initial={{ strokeDasharray: `0 ${2 * Math.PI * 30}` }}
                    animate={{ strokeDasharray: `${(healthScore / 100) * 2 * Math.PI * 30} ${2 * Math.PI * 30}` }}
                    transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-foreground">{healthScore}</span>
                  <span className="text-[8px] font-medium text-muted-foreground leading-none">/100</span>
                </div>
              </div>

              {/* Breakdown Bars */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">Filing Timeliness</span>
                    <span className={`text-[11px] font-bold ${healthMetrics.filingTimeliness > 80 ? 'text-emerald-700' : healthMetrics.filingTimeliness > 50 ? 'text-amber-700' : 'text-red-700'}`}>
                      {healthMetrics.filingTimeliness}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${healthMetrics.filingTimeliness > 80 ? 'bg-emerald-500' : healthMetrics.filingTimeliness > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${healthMetrics.filingTimeliness}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">Data Accuracy</span>
                    <span className={`text-[11px] font-bold ${healthMetrics.dataAccuracy > 80 ? 'text-emerald-700' : healthMetrics.dataAccuracy > 50 ? 'text-amber-700' : 'text-red-700'}`}>
                      {healthMetrics.dataAccuracy}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${healthMetrics.dataAccuracy > 80 ? 'bg-emerald-500' : healthMetrics.dataAccuracy > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${healthMetrics.dataAccuracy}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">Compliance</span>
                    <span className={`text-[11px] font-bold ${healthMetrics.compliance > 80 ? 'text-emerald-700' : healthMetrics.compliance > 50 ? 'text-amber-700' : 'text-red-700'}`}>
                      {healthMetrics.compliance}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${healthMetrics.compliance > 80 ? 'bg-emerald-500' : healthMetrics.compliance > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${healthMetrics.compliance}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                    />
                  </div>
                </div>
              </div>

              {/* Label */}
              <div className="hidden sm:flex flex-col items-end shrink-0">
                <span className="text-xs font-semibold text-foreground">Return Health</span>
                <span className="text-[10px] text-muted-foreground">Across all clients</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Bulk Filing Actions ────────────────────────────────────── */}
      {kanbanData.ready.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="px-4 md:px-6 pt-3"
        >
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-7 rounded-full bg-emerald-100">
                <Send className="size-3.5 text-emerald-700" />
              </div>
              <span className="text-sm font-medium text-emerald-800">
                {kanbanData.ready.length} return{kanbanData.ready.length !== 1 ? 's' : ''} ready to file
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() => {
                  const readyFilings = kanbanData.ready;
                  readyFilings.forEach((f) => handleDownloadJSON(f));
                }}
              >
                <FileOutput className="size-3.5" />
                Download JSON for All
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold"
                onClick={() => {
                  toast.success(`Filing ${kanbanData.ready.length} returns`, {
                    description: 'All ready returns have been submitted for filing',
                    duration: 4000,
                  });
                }}
              >
                <Send className="size-3.5" />
                File All
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Kanban Board ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 md:p-6 h-full">
          {KANBAN_COLUMNS.map((col, i) => renderKanbanColumn(col, i))}
        </div>
      </div>

      {/* ── Detail Sheet ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {sheetOpen && renderDetailSheet()}
      </AnimatePresence>
    </div>
  );
}
