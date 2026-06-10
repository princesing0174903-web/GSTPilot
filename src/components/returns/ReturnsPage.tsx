'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Download,
  ArrowRight,
  Zap,
  Upload,
  ChevronRight,
  Calendar,
  AlertCircle,
  Send,
  Loader2,
  FileCheck2,
  RotateCcw,
  ExternalLink,
  Info,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import {
  GSTRFiling,
  Client,
  FilingStatus,
  FILING_STATUS_CONFIG,
} from '@/types/gst';
import {
  formatCurrency,
  periodToLabel,
  isOverdue,
  getFilingDueDate,
} from '@/lib/gst-utils';

// ─── Pipeline Stage Config ────────────────────────────────────────────────────

type PipelineStage = 'draft' | 'ready' | 'filed' | 'issues';

interface PipelineStageConfig {
  key: PipelineStage;
  label: string;
  borderColor: string;
  bgColor: string;
  headerBg: string;
  icon: React.ReactNode;
  emptyText: string;
}

const PIPELINE_STAGES: PipelineStageConfig[] = [
  {
    key: 'draft',
    label: 'Draft',
    borderColor: 'border-t-slate-400',
    bgColor: 'bg-slate-50/50',
    headerBg: 'bg-slate-100',
    icon: <FileText className="size-4 text-slate-500" />,
    emptyText: 'No drafts yet',
  },
  {
    key: 'ready',
    label: 'Ready to File',
    borderColor: 'border-t-emerald-500',
    bgColor: 'bg-emerald-50/30',
    headerBg: 'bg-emerald-100',
    icon: <Zap className="size-4 text-emerald-600" />,
    emptyText: 'No returns ready',
  },
  {
    key: 'filed',
    label: 'Filed',
    borderColor: 'border-t-green-600',
    bgColor: 'bg-green-50/30',
    headerBg: 'bg-green-100',
    icon: <CheckCircle2 className="size-4 text-green-600" />,
    emptyText: 'No filed returns',
  },
  {
    key: 'issues',
    label: 'Issues',
    borderColor: 'border-t-red-500',
    bgColor: 'bg-red-50/20',
    headerBg: 'bg-red-100',
    icon: <AlertTriangle className="size-4 text-red-500" />,
    emptyText: 'No issues found',
  },
];

// ─── Section Breakdown for Detail Sheet ───────────────────────────────────────

interface SectionBreakdown {
  section: string;
  invoiceCount: number;
  taxableValue: number;
  taxAmount: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CLIENTS: Client[] = [
  {
    id: 'cl-1',
    gstin: '27AABCU9603R1ZM',
    tradeName: 'Sharma Enterprises',
    legalName: 'Sharma Enterprises Pvt Ltd',
    state: 'Maharashtra',
    stateCode: '27',
    entityType: 'Regular',
    status: 'active',
    healthScore: 92,
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
  },
  {
    id: 'cl-2',
    gstin: '29AABCU9603R1ZP',
    tradeName: 'Patel & Sons',
    legalName: 'Patel & Sons Trading Co',
    state: 'Karnataka',
    stateCode: '29',
    entityType: 'Regular',
    status: 'active',
    healthScore: 85,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
  },
  {
    id: 'cl-3',
    gstin: '06AABCU9603R1ZQ',
    tradeName: 'Krishna Industries',
    legalName: 'Krishna Industries Ltd',
    state: 'Haryana',
    stateCode: '06',
    entityType: 'Regular',
    status: 'active',
    healthScore: 78,
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
  },
  {
    id: 'cl-4',
    gstin: '33AABCU9603R1ZR',
    tradeName: 'Rajesh Textiles',
    legalName: 'Rajesh Textiles Pvt Ltd',
    state: 'Tamil Nadu',
    stateCode: '33',
    entityType: 'Regular',
    status: 'active',
    healthScore: 95,
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
  },
  {
    id: 'cl-5',
    gstin: '24AABCU9603R1ZS',
    tradeName: 'Gujarat Traders',
    legalName: 'Gujarat Traders Association',
    state: 'Gujarat',
    stateCode: '24',
    entityType: 'Regular',
    status: 'active',
    healthScore: 88,
    createdAt: '2024-02-10T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
  },
  {
    id: 'cl-6',
    gstin: '19AABCU9603R1ZT',
    tradeName: 'Mohan Exports',
    legalName: 'Mohan Exports India Pvt Ltd',
    state: 'West Bengal',
    stateCode: '19',
    entityType: 'Regular',
    status: 'active',
    healthScore: 71,
    createdAt: '2024-01-05T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
  },
];

const MOCK_FILINGS: GSTRFiling[] = [
  // Draft
  {
    id: 'fil-1',
    clientId: 'cl-1',
    returnType: 'GSTR-1',
    period: '2026-03',
    financialYear: '2025-26',
    status: 'draft',
    totalInvoices: 42,
    readyForFiling: 38,
    issuesFound: 4,
    criticalErrors: 0,
    warnings: 3,
    totalTaxableValue: 2850000,
    totalTax: 513000,
    createdAt: '2026-03-05T10:00:00Z',
    updatedAt: '2026-03-06T10:00:00Z',
    client: MOCK_CLIENTS[0],
  },
  {
    id: 'fil-2',
    clientId: 'cl-3',
    returnType: 'GSTR-3B',
    period: '2026-03',
    financialYear: '2025-26',
    status: 'draft',
    totalInvoices: 18,
    readyForFiling: 15,
    issuesFound: 3,
    criticalErrors: 1,
    warnings: 2,
    totalTaxableValue: 1240000,
    totalTax: 223200,
    createdAt: '2026-03-04T10:00:00Z',
    updatedAt: '2026-03-05T10:00:00Z',
    client: MOCK_CLIENTS[2],
  },
  {
    id: 'fil-10',
    clientId: 'cl-6',
    returnType: 'GSTR-1',
    period: '2026-02',
    financialYear: '2025-26',
    status: 'draft',
    totalInvoices: 31,
    readyForFiling: 28,
    issuesFound: 3,
    criticalErrors: 0,
    warnings: 2,
    totalTaxableValue: 1780000,
    totalTax: 320400,
    createdAt: '2026-02-28T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    client: MOCK_CLIENTS[5],
  },
  // Ready to File
  {
    id: 'fil-3',
    clientId: 'cl-2',
    returnType: 'GSTR-1',
    period: '2026-03',
    financialYear: '2025-26',
    status: 'generated',
    totalInvoices: 56,
    readyForFiling: 56,
    issuesFound: 0,
    criticalErrors: 0,
    warnings: 0,
    totalTaxableValue: 4520000,
    totalTax: 813600,
    createdAt: '2026-03-02T10:00:00Z',
    updatedAt: '2026-03-07T10:00:00Z',
    client: MOCK_CLIENTS[1],
  },
  {
    id: 'fil-4',
    clientId: 'cl-4',
    returnType: 'GSTR-3B',
    period: '2026-03',
    financialYear: '2025-26',
    status: 'validated',
    totalInvoices: 34,
    readyForFiling: 34,
    issuesFound: 0,
    criticalErrors: 0,
    warnings: 0,
    totalTaxableValue: 2180000,
    totalTax: 392400,
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-06T10:00:00Z',
    client: MOCK_CLIENTS[3],
  },
  {
    id: 'fil-5',
    clientId: 'cl-5',
    returnType: 'GSTR-1',
    period: '2026-02',
    financialYear: '2025-26',
    status: 'generated',
    totalInvoices: 29,
    readyForFiling: 29,
    issuesFound: 0,
    criticalErrors: 0,
    warnings: 0,
    totalTaxableValue: 1960000,
    totalTax: 352800,
    createdAt: '2026-02-25T10:00:00Z',
    updatedAt: '2026-03-03T10:00:00Z',
    client: MOCK_CLIENTS[4],
  },
  // Filed
  {
    id: 'fil-6',
    clientId: 'cl-1',
    returnType: 'GSTR-1',
    period: '2026-02',
    financialYear: '2025-26',
    status: 'filed',
    filedDate: '2026-03-09T14:30:00Z',
    acknowledgmentNumber: 'ARN271603091430001',
    totalInvoices: 38,
    readyForFiling: 38,
    issuesFound: 0,
    criticalErrors: 0,
    warnings: 0,
    totalTaxableValue: 2680000,
    totalTax: 482400,
    createdAt: '2026-02-28T10:00:00Z',
    updatedAt: '2026-03-09T14:30:00Z',
    client: MOCK_CLIENTS[0],
  },
  {
    id: 'fil-7',
    clientId: 'cl-2',
    returnType: 'GSTR-3B',
    period: '2026-02',
    financialYear: '2025-26',
    status: 'filed',
    filedDate: '2026-03-10T11:15:00Z',
    acknowledgmentNumber: 'ARN291603101115002',
    totalInvoices: 48,
    readyForFiling: 48,
    issuesFound: 0,
    criticalErrors: 0,
    warnings: 0,
    totalTaxableValue: 3950000,
    totalTax: 711000,
    createdAt: '2026-02-27T10:00:00Z',
    updatedAt: '2026-03-10T11:15:00Z',
    client: MOCK_CLIENTS[1],
  },
  {
    id: 'fil-8',
    clientId: 'cl-4',
    returnType: 'GSTR-1',
    period: '2026-01',
    financialYear: '2025-26',
    status: 'filed',
    filedDate: '2026-02-10T16:45:00Z',
    acknowledgmentNumber: 'ARN331602101645003',
    totalInvoices: 41,
    readyForFiling: 41,
    issuesFound: 0,
    criticalErrors: 0,
    warnings: 0,
    totalTaxableValue: 3120000,
    totalTax: 561600,
    createdAt: '2026-01-30T10:00:00Z',
    updatedAt: '2026-02-10T16:45:00Z',
    client: MOCK_CLIENTS[3],
  },
  // Issues
  {
    id: 'fil-9',
    clientId: 'cl-3',
    returnType: 'GSTR-1',
    period: '2026-02',
    financialYear: '2025-26',
    status: 'reopened',
    totalInvoices: 22,
    readyForFiling: 16,
    issuesFound: 6,
    criticalErrors: 2,
    warnings: 4,
    totalTaxableValue: 1450000,
    totalTax: 261000,
    createdAt: '2026-02-25T10:00:00Z',
    updatedAt: '2026-03-08T10:00:00Z',
    client: MOCK_CLIENTS[2],
  },
  {
    id: 'fil-11',
    clientId: 'cl-6',
    returnType: 'GSTR-3B',
    period: '2026-01',
    financialYear: '2025-26',
    status: 'reopened',
    totalInvoices: 15,
    readyForFiling: 10,
    issuesFound: 5,
    criticalErrors: 1,
    warnings: 3,
    totalTaxableValue: 980000,
    totalTax: 176400,
    createdAt: '2026-01-28T10:00:00Z',
    updatedAt: '2026-03-05T10:00:00Z',
    client: MOCK_CLIENTS[5],
  },
];

const MOCK_SECTION_BREAKDOWN: Record<string, SectionBreakdown[]> = {
  'GSTR-1': [
    { section: 'B2B Invoices', invoiceCount: 28, taxableValue: 1850000, taxAmount: 333000 },
    { section: 'B2C Large', invoiceCount: 8, taxableValue: 640000, taxAmount: 115200 },
    { section: 'B2C Small', invoiceCount: 4, taxableValue: 120000, taxAmount: 21600 },
    { section: 'Credit/Debit Notes', invoiceCount: 2, taxableValue: 40000, taxAmount: -7200 },
    { section: 'Exports', invoiceCount: 3, taxableValue: 200000, taxAmount: 0 },
  ],
  'GSTR-3B': [
    { section: 'Outward Supplies', invoiceCount: 30, taxableValue: 2180000, taxAmount: 392400 },
    { section: 'Inward Supplies (RC)', invoiceCount: 2, taxableValue: 120000, taxAmount: 21600 },
    { section: 'ITC Claims', invoiceCount: 15, taxableValue: 0, taxAmount: -180000 },
    { section: 'Tax Paid', invoiceCount: 0, taxableValue: 0, taxAmount: 234000 },
  ],
};

// ─── Upcoming Deadlines Mock ──────────────────────────────────────────────────

interface Deadline {
  returnType: string;
  period: string;
  dueDate: string;
  clientName: string;
  clientId: string;
}

const MOCK_DEADLINES: Deadline[] = [
  { returnType: 'GSTR-1', period: '2026-03', dueDate: '2026-04-11', clientName: 'Sharma Enterprises', clientId: 'cl-1' },
  { returnType: 'GSTR-3B', period: '2026-03', dueDate: '2026-04-20', clientName: 'Patel & Sons', clientId: 'cl-2' },
  { returnType: 'GSTR-1', period: '2026-03', dueDate: '2026-04-11', clientName: 'Krishna Industries', clientId: 'cl-3' },
  { returnType: 'GSTR-3B', period: '2026-03', dueDate: '2026-04-20', clientName: 'Rajesh Textiles', clientId: 'cl-4' },
  { returnType: 'GSTR-1', period: '2026-03', dueDate: '2026-04-11', clientName: 'Gujarat Traders', clientId: 'cl-5' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPipelineStage(status: FilingStatus): PipelineStage {
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
      return 'issues';
    default:
      return 'draft';
  }
}

function getDaysUntilDue(dueDateStr: string): number {
  const dueDate = new Date(dueDateStr);
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getDeadlineUrgency(daysLeft: number): 'overdue' | 'this_week' | 'this_month' | 'safe' {
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 7) return 'this_week';
  if (daysLeft <= 30) return 'this_month';
  return 'safe';
}

function getIssueSummary(filing: GSTRFiling): string {
  const parts: string[] = [];
  if (filing.criticalErrors > 0) parts.push(`${filing.criticalErrors} critical`);
  if (filing.warnings > 0) parts.push(`${filing.warnings} warnings`);
  if (filing.issuesFound > 0 && parts.length === 0) parts.push(`${filing.issuesFound} issues`);
  return parts.length > 0 ? parts.join(', ') : 'No issues';
}

// ─── Animation Variants ──────────────────────────────────────────────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const cardHover = {
  scale: 1.015,
  transition: { duration: 0.15 },
};

// ─── Status Timeline Data ─────────────────────────────────────────────────────

const STATUS_TIMELINE_STEPS = [
  { key: 'data_imported', label: 'Created', icon: FileText },
  { key: 'validation_completed', label: 'Validated', icon: CheckCircle2 },
  { key: 'gstr_generated', label: 'Generated', icon: FileCheck2 },
  { key: 'filed', label: 'Filed', icon: Send },
];

function getTimelineProgress(status: FilingStatus): number {
  switch (status) {
    case 'draft':
    case 'prepared':
      return 0;
    case 'validated':
      return 1;
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

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function ReturnsPage() {
  const { setCurrentView } = useApp();

  // ── State ─────────────────────────────────────────────────────────────────
  const [filings, setFilings] = useState<GSTRFiling[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiling, setSelectedFiling] = useState<GSTRFiling | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filingAction, setFilingAction] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successArn, setSuccessArn] = useState('');

  // ── Data Fetching ─────────────────────────────────────────────────────────
  const fetchFilings = useCallback(async () => {
    try {
      const res = await fetch('/api/gstr-filing');
      if (res.ok) {
        const data = await res.json();
        const rawFilings = data.filings ?? data ?? [];
        if (Array.isArray(rawFilings) && rawFilings.length > 0) {
          setFilings(rawFilings);
        } else {
          setFilings(MOCK_FILINGS);
        }
      } else {
        setFilings(MOCK_FILINGS);
      }
    } catch {
      setFilings(MOCK_FILINGS);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        const rawClients = data.clients ?? data ?? [];
        if (Array.isArray(rawClients) && rawClients.length > 0) {
          setClients(rawClients);
        } else {
          setClients(MOCK_CLIENTS);
        }
      } else {
        setClients(MOCK_CLIENTS);
      }
    } catch {
      setClients(MOCK_CLIENTS);
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchFilings(), fetchClients()]);
      setLoading(false);
    }
    load();
  }, [fetchFilings, fetchClients]);

  // ── Derived Data ──────────────────────────────────────────────────────────
  const pipelineData = useMemo(() => {
    const stages: Record<PipelineStage, GSTRFiling[]> = {
      draft: [],
      ready: [],
      filed: [],
      issues: [],
    };
    filings.forEach((f) => {
      const stage = getPipelineStage(f.status);
      stages[stage].push(f);
    });
    return stages;
  }, [filings]);

  const currentPeriod = useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${year}-${month}`;
  }, []);

  const deadlines = useMemo(() => {
    return MOCK_DEADLINES.map((d) => ({
      ...d,
      daysLeft: getDaysUntilDue(d.dueDate),
    }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCardClick = (filing: GSTRFiling) => {
    setSelectedFiling(filing);
    setSheetOpen(true);
  };

  const handleFileReturn = async (filing: GSTRFiling) => {
    setFilingAction(filing.id);
    // Simulate filing
    await new Promise((r) => setTimeout(r, 2000));
    const arn = `ARN${filing.client?.gstin?.slice(0, 2) ?? '00'}${Date.now()}`;
    setSuccessArn(arn);
    setShowSuccess(true);
    setFilingAction(null);
    setSheetOpen(false);

    // Update filing status locally
    setFilings((prev) =>
      prev.map((f) =>
        f.id === filing.id
          ? {
              ...f,
              status: 'filed' as FilingStatus,
              filedDate: new Date().toISOString(),
              acknowledgmentNumber: arn,
            }
          : f
      )
    );

    setTimeout(() => setShowSuccess(false), 6000);
  };

  const handlePrepare = (filing: GSTRFiling) => {
    setSelectedFiling(filing);
    setSheetOpen(true);
  };

  const handleFixIssues = () => {
    setCurrentView('reconcile');
  };

  const handleCreateReturn = () => {
    setCurrentView('upload');
  };

  // ── Loading State ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-10 w-full rounded-t-lg" />
              <div className="space-y-2 p-2">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty State ───────────────────────────────────────────────────────────
  const totalFilings = filings.length;

  if (totalFilings === 0) {
    return (
      <motion.div
        className="flex min-h-[70vh] items-center justify-center p-4"
        variants={fadeInUp}
        initial="hidden"
        animate="show"
      >
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-emerald-100">
            <FileText className="size-10 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">No returns yet</h2>
            <p className="text-muted-foreground">
              Upload documents to start preparing returns. GSTPilot will handle the rest.
            </p>
          </div>
          <Button
            onClick={handleCreateReturn}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6"
          >
            <Upload className="size-4" />
            Go to Upload
          </Button>
        </div>
      </motion.div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Render Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  const renderReturnCard = (filing: GSTRFiling, stage: PipelineStage) => {
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
        <Card className="border shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-3 space-y-2.5">
            {/* Client & Return Type */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate leading-tight">
                  {clientName}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 border-emerald-200 bg-emerald-50 text-emerald-700 font-medium"
                  >
                    {filing.returnType}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">{periodLabel}</span>
                </div>
              </div>
            </div>

            {/* Stage-specific content */}
            {stage === 'draft' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Invoices</span>
                  <span className="font-medium">{filing.totalInvoices}</span>
                </div>
                {filing.issuesFound > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-amber-600">
                    <AlertCircle className="size-3" />
                    <span>{filing.issuesFound} issues to resolve</span>
                  </div>
                )}
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
              </div>
            )}

            {stage === 'ready' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Total Tax</span>
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(filing.totalTax)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Invoices</span>
                  <span className="font-medium">{filing.totalInvoices}</span>
                </div>
                <Button
                  size="sm"
                  className="w-full h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileReturn(filing);
                  }}
                  disabled={filingAction === filing.id}
                >
                  {filingAction === filing.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Send className="size-3" />
                  )}
                  {filingAction === filing.id ? 'Filing...' : 'File Return'}
                </Button>
              </div>
            )}

            {stage === 'filed' && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <CheckCircle2 className="size-3 text-green-600" />
                  <span className="text-green-700 font-medium">Filed</span>
                </div>
                {filing.acknowledgmentNumber && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">ARN</span>
                    <span className="font-mono text-[10px] font-medium">
                      {filing.acknowledgmentNumber}
                    </span>
                  </div>
                )}
                {filing.filedDate && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">
                      {new Date(filing.filedDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full h-7 text-xs gap-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Download className="size-3" />
                  Download JSON
                </Button>
              </div>
            )}

            {stage === 'issues' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Issues</span>
                  <span className="font-semibold text-red-600">{filing.issuesFound}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-red-600">
                  <AlertTriangle className="size-3 shrink-0" />
                  <span className="truncate">{getIssueSummary(filing)}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFixIssues();
                  }}
                >
                  <RotateCcw className="size-3" />
                  Fix Issues
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const renderPipelineColumn = (stageConfig: PipelineStageConfig) => {
    const items = pipelineData[stageConfig.key];
    return (
      <div
        className={`flex flex-col rounded-xl border-t-4 ${stageConfig.borderColor} ${stageConfig.bgColor} border border-slate-200/80`}
      >
        {/* Column Header */}
        <div
          className={`flex items-center justify-between px-3 py-2.5 ${stageConfig.headerBg} rounded-t-[10px]`}
        >
          <div className="flex items-center gap-2">
            {stageConfig.icon}
            <span className="text-sm font-semibold">{stageConfig.label}</span>
          </div>
          <Badge
            variant="secondary"
            className="h-5 min-w-[20px] justify-center text-[11px] font-semibold"
          >
            {items.length}
          </Badge>
        </div>

        {/* Cards */}
        <ScrollArea className="flex-1 max-h-[420px]">
          <div className="p-2 space-y-2">
            <AnimatePresence>
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="space-y-2"
              >
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="size-10 rounded-full bg-white/80 flex items-center justify-center mb-2">
                      {React.cloneElement(stageConfig.icon as React.ReactElement, {
                        className: 'size-5 opacity-30',
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">{stageConfig.emptyText}</p>
                  </div>
                ) : (
                  items.map((filing) => renderReturnCard(filing, stageConfig.key))
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderDetailSheet = () => {
    if (!selectedFiling) return null;
    const filing = selectedFiling;
    const clientName = filing.client?.tradeName ?? 'Unknown';
    const stage = getPipelineStage(filing.status);
    const sections = MOCK_SECTION_BREAKDOWN[filing.returnType] ?? MOCK_SECTION_BREAKDOWN['GSTR-1'];
    const timelineProgress = getTimelineProgress(filing.status);

    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          <SheetHeader className="p-6 pb-4 border-b bg-gradient-to-b from-emerald-50/50 to-transparent">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                {filing.returnType}
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs ${FILING_STATUS_CONFIG[filing.status]?.bgColor ?? 'bg-slate-100'} ${FILING_STATUS_CONFIG[filing.status]?.color ?? 'text-slate-700'}`}
              >
                {FILING_STATUS_CONFIG[filing.status]?.label ?? filing.status}
              </Badge>
            </div>
            <SheetTitle className="text-lg">{clientName}</SheetTitle>
            <SheetDescription className="text-sm">
              {filing.client?.gstin} &middot; {periodToLabel(filing.period)}
            </SheetDescription>
          </SheetHeader>

          <div className="p-6 space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Invoices</p>
                <p className="text-lg font-bold">{filing.totalInvoices}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Taxable Value</p>
                <p className="text-lg font-bold text-emerald-700">
                  {formatCurrency(filing.totalTaxableValue)}
                </p>
              </div>
              <div className="rounded-lg bg-teal-50 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Total Tax</p>
                <p className="text-lg font-bold text-teal-700">
                  {formatCurrency(filing.totalTax)}
                </p>
              </div>
            </div>

            {/* Section-wise Breakdown */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="size-3.5 text-muted-foreground" />
                Section-wise Breakdown
              </h4>
              <div className="grid gap-2">
                {sections.map((sec) => (
                  <div
                    key={sec.section}
                    className="flex items-center justify-between rounded-lg border bg-white p-3"
                  >
                    <div>
                      <p className="text-xs font-medium">{sec.section}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {sec.invoiceCount} invoice{sec.invoiceCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold">
                        {formatCurrency(sec.taxableValue)}
                      </p>
                      <p
                        className={`text-[11px] ${sec.taxAmount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                      >
                        Tax: {formatCurrency(Math.abs(sec.taxAmount))}
                        {sec.taxAmount < 0 ? ' (cr)' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax Breakdown */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Info className="size-3.5 text-muted-foreground" />
                Tax Breakdown
              </h4>
              <div className="rounded-lg border bg-white p-3 space-y-2">
                {(() => {
                  const total = filing.totalTax;
                  const cgst = Math.round(total * 0.4);
                  const sgst = Math.round(total * 0.4);
                  const igst = total - cgst - sgst;
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
                      <Separator />
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>Total Tax</span>
                        <span className="text-emerald-700">{formatCurrency(total)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Status Timeline */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                Status Timeline
              </h4>
              <div className="space-y-0">
                {STATUS_TIMELINE_STEPS.map((step, i) => {
                  const isCompleted =
                    filing.status === 'reopened'
                      ? false
                      : i <= timelineProgress;
                  const isCurrent =
                    filing.status === 'reopened'
                      ? false
                      : i === timelineProgress;

                  return (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex size-7 items-center justify-center rounded-full ${
                            isCompleted
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : (
                            <step.icon className="size-3.5" />
                          )}
                        </div>
                        {i < STATUS_TIMELINE_STEPS.length - 1 && (
                          <div
                            className={`w-0.5 h-6 ${
                              i < timelineProgress && filing.status !== 'reopened'
                                ? 'bg-emerald-300'
                                : 'bg-slate-200'
                            }`}
                          />
                        )}
                      </div>
                      <div className="pb-3">
                        <p
                          className={`text-xs font-medium ${
                            isCompleted
                              ? 'text-emerald-700'
                              : isCurrent
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {step.label}
                        </p>
                        {filing.status === 'reopened' && i === 0 && (
                          <p className="text-[10px] text-red-600 mt-0.5">
                            Return reopened due to issues
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <Separator />
            <div className="space-y-2 pb-4">
              {stage === 'ready' && (
                <>
                  <Button
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleFileReturn(filing)}
                    disabled={filingAction === filing.id}
                  >
                    {filingAction === filing.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {filingAction === filing.id
                      ? 'Filing with GST Portal...'
                      : 'File with GST Portal'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {}}
                  >
                    <Download className="size-4" />
                    Download JSON
                  </Button>
                </>
              )}

              {stage === 'draft' && (
                <Button
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setSheetOpen(false);
                    setCurrentView('upload');
                  }}
                >
                  <ArrowRight className="size-4" />
                  Continue Preparing
                </Button>
              )}

              {stage === 'filed' && (
                <>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {}}
                  >
                    <Download className="size-4" />
                    Download Filed JSON
                  </Button>
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-green-600" />
                      <div>
                        <p className="text-xs font-medium text-green-800">
                          Successfully Filed
                        </p>
                        {filing.acknowledgmentNumber && (
                          <p className="text-[11px] text-green-700 font-mono mt-0.5">
                            ARN: {filing.acknowledgmentNumber}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {stage === 'issues' && (
                <>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                    onClick={handleFixIssues}
                  >
                    <RotateCcw className="size-4" />
                    Go to Reconciliation
                  </Button>
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-red-600" />
                      <div>
                        <p className="text-xs font-medium text-red-800">
                          {filing.issuesFound} Issues Found
                        </p>
                        <p className="text-[11px] text-red-700 mt-0.5">
                          {getIssueSummary(filing)} — resolve before filing
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  };

  const renderDeadlineCard = (deadline: Deadline & { daysLeft: number }) => {
    const urgency = getDeadlineUrgency(deadline.daysLeft);

    const urgencyStyles: Record<string, { bg: string; border: string; text: string; label: string }> = {
      overdue: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Overdue' },
      this_week: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Due this week' },
      this_month: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', label: 'Due this month' },
      safe: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', label: '' },
    };

    const style = urgencyStyles[urgency];

    return (
      <motion.div
        key={`${deadline.clientId}-${deadline.returnType}-${deadline.period}`}
        variants={staggerItem}
      >
        <Card className={`${style.border} ${style.bg} shadow-sm`}>
          <CardContent className="p-3 flex items-center gap-3">
            <div
              className={`flex size-9 items-center justify-center rounded-lg ${
                urgency === 'overdue'
                  ? 'bg-red-100'
                  : urgency === 'this_week'
                  ? 'bg-amber-100'
                  : 'bg-slate-100'
              }`}
            >
              <Calendar
                className={`size-4 ${
                  urgency === 'overdue'
                    ? 'text-red-600'
                    : urgency === 'this_week'
                    ? 'text-amber-600'
                    : 'text-slate-500'
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium truncate">{deadline.clientName}</p>
                <Badge
                  variant="outline"
                  className="text-[9px] h-4 px-1 border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  {deadline.returnType}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Due: {new Date(deadline.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                {' '}&middot;{' '}
                <span className={style.text}>
                  {deadline.daysLeft < 0
                    ? `${Math.abs(deadline.daysLeft)}d overdue`
                    : deadline.daysLeft === 0
                    ? 'Due today'
                    : `${deadline.daysLeft}d left`}
                </span>
              </p>
            </div>
            {urgency !== 'safe' && (
              <Badge
                variant="outline"
                className={`text-[10px] h-5 shrink-0 ${style.border} ${style.text}`}
              >
                {style.label}
              </Badge>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Main Render
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ─── Success Toast ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
          >
            <Card className="border-green-200 bg-green-50 shadow-lg shadow-green-100/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="size-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">
                    Return filed successfully! 🎉
                  </p>
                  <p className="text-xs text-green-700 font-mono mt-0.5">
                    ARN: {successArn}
                  </p>
                  <p className="text-[11px] text-green-600 mt-1">
                    You can download the filed JSON from the Filed column.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-600 hover:text-green-800 hover:bg-green-100 ml-2"
                  onClick={() => setShowSuccess(false)}
                >
                  Dismiss
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Page Header ─────────────────────────────────────────────────────── */}
      <motion.div
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        variants={fadeInUp}
        initial="hidden"
        animate="show"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100">
            <FileText className="size-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              GST Returns
            </h1>
            <p className="text-sm text-muted-foreground">
              File your returns on time, every time
              <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                <Calendar className="size-3" />
                {periodToLabel(currentPeriod)}
              </span>
            </p>
          </div>
        </div>
        <Button
          onClick={handleCreateReturn}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          <Plus className="size-4" />
          Create Return
        </Button>
      </motion.div>

      {/* ─── Summary Stats ───────────────────────────────────────────────────── */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {PIPELINE_STAGES.map((stage) => {
          const count = pipelineData[stage.key].length;
          const stageColors: Record<PipelineStage, { bg: string; icon: string; text: string }> = {
            draft: { bg: 'bg-slate-50', icon: 'text-slate-500', text: 'text-slate-700' },
            ready: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-700' },
            filed: { bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-700' },
            issues: { bg: 'bg-red-50', icon: 'text-red-500', text: 'text-red-700' },
          };
          const colors = stageColors[stage.key];
          return (
            <motion.div key={stage.key} variants={staggerItem}>
              <Card className={`${colors.bg} border-0 shadow-sm`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`flex size-8 items-center justify-center rounded-lg bg-white/80 ${colors.icon}`}>
                    {stage.icon}
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight">{count}</p>
                    <p className={`text-[11px] font-medium ${colors.text}`}>{stage.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ─── Filing Pipeline ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.key} className="min-h-[300px] flex flex-col">
              {renderPipelineColumn(stage)}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── Upcoming Deadlines ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Clock className="size-4 text-muted-foreground" />
            Upcoming Deadlines
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-emerald-700 hover:text-emerald-800 gap-1"
            onClick={() => setCurrentView('reconcile')}
          >
            View Calendar
            <ChevronRight className="size-3" />
          </Button>
        </div>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3"
        >
          {deadlines.map((d) => renderDeadlineCard(d))}
        </motion.div>
      </motion.div>

      {/* ─── Detail Sheet ────────────────────────────────────────────────────── */}
      {renderDetailSheet()}
    </div>
  );
}
