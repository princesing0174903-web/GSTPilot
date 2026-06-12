'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  FileCheck2,
  CalendarClock,
  Sparkles,
  FileText,
  ShieldCheck,
  AlertOctagon,
  ClipboardCheck,
  GitCompareArrows,
  XCircle,
  Search,
  FileWarning,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Loader2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import type { GSTRFiling, Client, DashboardMetrics } from '@/types/gst';
import { formatCurrency, periodToLabel, isOverdue } from '@/lib/gst-utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface MetricCard {
  id: string;
  label: string;
  value: number;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  subtitle: string;
}

interface PriorityItem {
  id: string;
  clientName: string;
  clientInitials: string;
  clientId: string;
  returnType: string;
  period: string;
  dueDate: string;
  daysRemaining: number;
  urgency: 'overdue' | 'due-soon' | 'upcoming';
  reason: string;
  actionLabel: string;
  actionView: string;
}

interface ReadyToFileItem {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  returnType: string;
  invoiceCount: number;
  taxAmount: number;
  period: string;
}

interface BlockingIssue {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  category: 'gstin_error' | 'missing_invoice' | 'recon_mismatch' | 'validation_failure';
  title: string;
  detail: string;
  invoiceRef?: string;
  amount?: number;
  actionLabel: string;
  actionView: string;
}

interface RecentUpload {
  id: string;
  filename: string;
  uploadTime: string;
  status: 'processing' | 'extracted' | 'failed';
  clientName: string;
  rowCount?: number;
  invoiceCount?: number;
  accuracy?: number;
}

interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  actionLabel: string;
  actionView: string;
  urgency: 'high' | 'medium' | 'info';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK / FALLBACK DATA — Realistic Indian GST business data (June 2025)
// ═══════════════════════════════════════════════════════════════════════════════

const CURRENT_PERIOD = '2025-06';

const mockMetrics: MetricCard[] = [
  {
    id: 'ready',
    label: 'Ready to File',
    value: 5,
    icon: <ShieldCheck className="h-4 w-4" />,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    subtitle: 'Validated & approved',
  },
  {
    id: 'critical',
    label: 'Critical Issues',
    value: 4,
    icon: <AlertOctagon className="h-4 w-4" />,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50',
    subtitle: 'Blocking 3 filings',
  },
  {
    id: 'pending',
    label: 'Pending Returns',
    value: 11,
    icon: <Clock className="h-4 w-4" />,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
    subtitle: 'Due this month',
  },
  {
    id: 'filed',
    label: 'Filed This Month',
    value: 5,
    icon: <CheckCircle2 className="h-4 w-4" />,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    subtitle: 'of 16 total',
  },
];

const mockPriorities: PriorityItem[] = [
  {
    id: 'p1',
    clientName: 'Sharma Enterprises',
    clientInitials: 'SE',
    clientId: 'client-1',
    returnType: 'GSTR-1',
    period: '2025-06',
    dueDate: '2025-07-11',
    daysRemaining: 3,
    urgency: 'due-soon',
    reason: 'GSTR-1 due in 3 days — 47 invoices ready',
    actionLabel: 'File Return',
    actionView: 'returns',
  },
  {
    id: 'p2',
    clientName: 'Krishna Traders',
    clientInitials: 'KT',
    clientId: 'client-3',
    returnType: 'GSTR-1',
    period: '2025-05',
    dueDate: '2025-06-11',
    daysRemaining: -3,
    urgency: 'overdue',
    reason: 'GSTR-1 overdue by 3 days — late fee accruing',
    actionLabel: 'File Now',
    actionView: 'returns',
  },
  {
    id: 'p3',
    clientName: 'Patel & Sons',
    clientInitials: 'PS',
    clientId: 'client-2',
    returnType: 'GSTR-3B',
    period: '2025-06',
    dueDate: '2025-07-20',
    daysRemaining: 12,
    urgency: 'upcoming',
    reason: '₹2,40,650 ITC mismatch needs resolution',
    actionLabel: 'Review Issue',
    actionView: 'reconcile',
  },
  {
    id: 'p4',
    clientName: 'Metro Retail',
    clientInitials: 'MR',
    clientId: 'client-4',
    returnType: 'GSTR-1',
    period: '2025-06',
    dueDate: '2025-07-11',
    daysRemaining: 3,
    urgency: 'due-soon',
    reason: '2 GSTIN validation errors blocking filing',
    actionLabel: 'Review Issue',
    actionView: 'reconcile',
  },
  {
    id: 'p5',
    clientName: 'Gupta Manufacturing',
    clientInitials: 'GM',
    clientId: 'client-6',
    returnType: 'GSTR-1',
    period: '2025-06',
    dueDate: '2025-07-11',
    daysRemaining: 3,
    urgency: 'due-soon',
    reason: 'Ready to file — 32 invoices, ₹12.87L tax',
    actionLabel: 'File Return',
    actionView: 'returns',
  },
];

const mockReadyToFile: ReadyToFileItem[] = [
  {
    id: 'rf1',
    clientId: 'client-1',
    clientName: 'Sharma Enterprises',
    clientInitials: 'SE',
    returnType: 'GSTR-1',
    invoiceCount: 47,
    taxAmount: 452310,
    period: '2025-06',
  },
  {
    id: 'rf2',
    clientId: 'client-6',
    clientName: 'Gupta Manufacturing',
    clientInitials: 'GM',
    returnType: 'GSTR-1',
    invoiceCount: 32,
    taxAmount: 1287650,
    period: '2025-06',
  },
  {
    id: 'rf3',
    clientId: 'client-5',
    clientName: 'Sunrise Exports',
    clientInitials: 'SX',
    returnType: 'GSTR-1',
    invoiceCount: 19,
    taxAmount: 893420,
    period: '2025-06',
  },
  {
    id: 'rf4',
    clientId: 'client-4',
    clientName: 'Metro Retail',
    clientInitials: 'MR',
    returnType: 'GSTR-3B',
    invoiceCount: 56,
    taxAmount: 674890,
    period: '2025-06',
  },
  {
    id: 'rf5',
    clientId: 'client-2',
    clientName: 'Patel & Sons',
    clientInitials: 'PS',
    returnType: 'GSTR-1',
    invoiceCount: 23,
    taxAmount: 341200,
    period: '2025-06',
  },
];

const mockBlockingIssues: BlockingIssue[] = [
  {
    id: 'bi1',
    clientId: 'client-4',
    clientName: 'Metro Retail',
    clientInitials: 'MR',
    category: 'gstin_error',
    title: 'Invalid GSTIN in 2 B2B invoices',
    detail: '27AAACM5241Z2ZM fails checksum — buyer GSTIN in INV-2025-1089, INV-2025-1092',
    invoiceRef: 'INV-2025-1089',
    actionLabel: 'Review Issue',
    actionView: 'reconcile',
  },
  {
    id: 'bi2',
    clientId: 'client-2',
    clientName: 'Patel & Sons',
    clientInitials: 'PS',
    category: 'recon_mismatch',
    title: '₹42,560 ITC mismatch on INV-2025-1045',
    detail: 'Books: ₹25,000 CGST + ₹25,000 SGST. Portal: ₹22,000 CGST + ₹22,000 SGST. Difference: ₹6,000',
    invoiceRef: 'INV-2025-1045',
    amount: 42560,
    actionLabel: 'Run Reconciliation',
    actionView: 'reconcile',
  },
  {
    id: 'bi3',
    clientId: 'client-7',
    clientName: 'Apex Logistics',
    clientInitials: 'AL',
    category: 'missing_invoice',
    title: '4 invoices missing from GSTR-2B',
    detail: 'Purchase invoices from May 2025 not reflected in GSTR-2B. Vendors may not have filed.',
    actionLabel: 'Upload Missing Document',
    actionView: 'invoices',
  },
  {
    id: 'bi4',
    clientId: 'client-3',
    clientName: 'Krishna Traders',
    clientInitials: 'KT',
    category: 'validation_failure',
    title: 'HSN code validation failed for 3 line items',
    detail: 'HSN codes 8471, 8517, 8528 returned invalid in GSTR-1 JSON schema validation',
    actionLabel: 'Review Issue',
    actionView: 'returns',
  },
  {
    id: 'bi5',
    clientId: 'client-8',
    clientName: 'RK Electronics',
    clientInitials: 'RK',
    category: 'recon_mismatch',
    title: '₹18,240 tax difference in INV-2025-0923',
    detail: 'Books: ₹54,720 IGST. Portal: ₹36,480 IGST. Possible partial reporting by supplier.',
    invoiceRef: 'INV-2025-0923',
    amount: 18240,
    actionLabel: 'Run Reconciliation',
    actionView: 'reconcile',
  },
];

const mockRecentUploads: RecentUpload[] = [
  {
    id: 'u1',
    filename: 'Sales_Register_Jun2025.xlsx',
    uploadTime: '2 hours ago',
    status: 'extracted',
    clientName: 'Sharma Enterprises',
    rowCount: 342,
    invoiceCount: 47,
    accuracy: 98.7,
  },
  {
    id: 'u2',
    filename: 'Purchase_Register_Jun2025.pdf',
    uploadTime: '3 hours ago',
    status: 'processing',
    clientName: 'Gupta Manufacturing',
    rowCount: 186,
  },
  {
    id: 'u3',
    filename: 'GSTR1_May2025.json',
    uploadTime: '5 hours ago',
    status: 'extracted',
    clientName: 'Sunrise Exports',
    invoiceCount: 19,
    accuracy: 100,
  },
  {
    id: 'u4',
    filename: 'Bank_Statement_Jun2025.pdf',
    uploadTime: 'Yesterday',
    status: 'failed',
    clientName: 'Metro Retail',
  },
];

const mockAIRecommendations: AIRecommendation[] = [
  {
    id: 'ai1',
    title: '4 invoices missing from GSTR-2B for Apex Logistics',
    description: 'Purchase invoices from May 2025 not reflected. Contact vendors Sun Pharma & Reliance Retail to file their GSTR-1.',
    icon: <AlertTriangle className="h-4 w-4" />,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    actionLabel: 'Review Missing Invoices',
    actionView: 'reconcile',
    urgency: 'high',
  },
  {
    id: 'ai2',
    title: '₹42,560 ITC mismatch detected for Patel & Sons',
    description: 'INV-2025-1045 shows Books ₹50,000 vs Portal ₹44,000. Possible partial reporting by supplier Mahalaxmi Textiles.',
    icon: <GitCompareArrows className="h-4 w-4" />,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    actionLabel: 'Run Reconciliation',
    actionView: 'reconcile',
    urgency: 'high',
  },
  {
    id: 'ai3',
    title: 'GSTR-1 due in 3 days for 3 clients',
    description: 'Sharma Enterprises, Metro Retail, and Gupta Manufacturing have GSTR-1 due Jul 11. Start filing now to avoid ₹50/day late fee.',
    icon: <CalendarClock className="h-4 w-4" />,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    actionLabel: 'File Return',
    actionView: 'returns',
    urgency: 'high',
  },
  {
    id: 'ai4',
    title: 'Auto-draft GSTR-1 ready for Gupta Manufacturing',
    description: '32 invoices extracted from Sales_Register_Jun2025.xlsx with 99.2% accuracy. Review and file directly.',
    icon: <Sparkles className="h-4 w-4" />,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    actionLabel: 'Review & File',
    actionView: 'returns',
    urgency: 'info',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getDaysRemaining(dueDateStr: string): number {
  const dueDate = new Date(dueDateStr);
  const today = new Date('2025-07-08');
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDaysRemaining(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Tomorrow';
  return `${days}d left`;
}

const issueCategoryConfig: Record<BlockingIssue['category'], { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  gstin_error: {
    label: 'GSTIN Error',
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
  },
  missing_invoice: {
    label: 'Missing Invoice',
    icon: <FileWarning className="h-3.5 w-3.5" />,
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
  },
  recon_mismatch: {
    label: 'Recon Mismatch',
    icon: <GitCompareArrows className="h-3.5 w-3.5" />,
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
  },
  validation_failure: {
    label: 'Validation Failure',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-200',
  },
};

const uploadStatusConfig: Record<RecentUpload['status'], { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  processing: { label: 'Processing', icon: <Clock className="h-3.5 w-3.5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
  extracted: { label: 'Extracted', icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  failed: { label: 'Failed', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-red-600', bg: 'bg-red-50' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const { setCurrentView, setSelectedClientId, setReturnPrepCtx } = useApp();

  // ── State ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricCard[]>(mockMetrics);
  const [priorities, setPriorities] = useState<PriorityItem[]>(mockPriorities);
  const [readyToFile, setReadyToFile] = useState<ReadyToFileItem[]>(mockReadyToFile);
  const [blockingIssues, setBlockingIssues] = useState<BlockingIssue[]>(mockBlockingIssues);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>(mockRecentUploads);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>(mockAIRecommendations);
  const [filingItems, setFilingItems] = useState<Set<string>>(new Set());
  const [filedItems, setFiledItems] = useState<Set<string>>(new Set());
  const [dashboardToasts, setDashboardToasts] = useState<{ id: string; title: string; desc: string; type: 'success' | 'info' }[]>([]);

  const currentPeriodLabel = periodToLabel(CURRENT_PERIOD);

  // ── Data Fetching ────────────────────────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [dashRes, clientRes, filingRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/clients'),
        fetch('/api/gstr-filing'),
      ]);

      const clientData = clientRes.ok ? await clientRes.json() : { clients: [] };
      const filingData = filingRes.ok ? await filingRes.json() : { filings: [] };

      const clients: Client[] = clientData.clients ?? [];
      const filings: GSTRFiling[] = filingData.filings ?? [];
      const clientMap = new Map<string, Client>();
      clients.forEach((c) => clientMap.set(c.id, c));

      // ── Metrics ──
      const readyStatuses = ['validated', 'generated', 'reviewed'];
      const readyCount = filings.filter((f) => readyStatuses.includes(f.status)).length || 5;
      const criticalCount = filings.filter((f) => f.criticalErrors > 0).length || 4;
      const pendingCount = filings.filter((f) => f.status !== 'filed').length || 11;
      const filedCount = filings.filter((f) => f.status === 'filed').length || 5;

      setMetrics([
        {
          id: 'ready',
          label: 'Ready to File',
          value: readyCount,
          icon: <ShieldCheck className="h-4 w-4" />,
          iconColor: 'text-emerald-600',
          iconBg: 'bg-emerald-50',
          subtitle: 'Validated & approved',
        },
        {
          id: 'critical',
          label: 'Critical Issues',
          value: criticalCount,
          icon: <AlertOctagon className="h-4 w-4" />,
          iconColor: 'text-red-600',
          iconBg: 'bg-red-50',
          subtitle: `Blocking ${Math.min(criticalCount, filings.length - filedCount)} filings`,
        },
        {
          id: 'pending',
          label: 'Pending Returns',
          value: pendingCount,
          icon: <Clock className="h-4 w-4" />,
          iconColor: 'text-amber-600',
          iconBg: 'bg-amber-50',
          subtitle: 'Due this month',
        },
        {
          id: 'filed',
          label: 'Filed This Month',
          value: filedCount,
          icon: <CheckCircle2 className="h-4 w-4" />,
          iconColor: 'text-emerald-600',
          iconBg: 'bg-emerald-50',
          subtitle: `of ${filings.length || 16} total`,
        },
      ]);

      // ── Priorities ──
      if (filings.length > 0) {
        const unfiled = filings
          .filter((f) => f.status !== 'filed')
          .sort((a, b) => {
            const aOverdue = isOverdue(a.period) ? 0 : 1;
            const bOverdue = isOverdue(b.period) ? 0 : 1;
            return aOverdue - bOverdue || a.period.localeCompare(b.period);
          });

        if (unfiled.length > 0) {
          const priorityItems: PriorityItem[] = unfiled.slice(0, 5).map((f, idx) => {
            const client = clientMap.get(f.clientId);
            const name = client?.tradeName ?? ['Sharma Enterprises', 'Patel & Sons', 'Krishna Traders', 'Metro Retail', 'Gupta Manufacturing'][idx % 5];
            const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            const dueDateStr = f.period + '-11';
            const days = getDaysRemaining(dueDateStr);

            let urgency: PriorityItem['urgency'] = 'upcoming';
            if (days < 0) urgency = 'overdue';
            else if (days <= 5) urgency = 'due-soon';

            return {
              id: f.id,
              clientName: name,
              clientInitials: initials,
              clientId: f.clientId,
              returnType: f.returnType,
              period: f.period,
              dueDate: dueDateStr,
              daysRemaining: days,
              urgency,
              reason: urgency === 'overdue'
                ? `${f.returnType} overdue — late fee accruing`
                : urgency === 'due-soon'
                ? `${f.returnType} due in ${days} days`
                : `${f.totalInvoices} invoices pending`,
              actionLabel: urgency === 'overdue' ? 'File Now' : urgency === 'due-soon' ? 'File Return' : 'Prepare',
              actionView: 'returns',
            };
          });
          setPriorities(priorityItems.length > 0 ? priorityItems : mockPriorities);
        }
      }

      // ── Ready to File ──
      if (filings.length > 0) {
        const readyFilings = filings.filter((f) => readyStatuses.includes(f.status));
        if (readyFilings.length > 0) {
          const readyItems: ReadyToFileItem[] = readyFilings.slice(0, 5).map((f) => {
            const client = clientMap.get(f.clientId);
            const name = client?.tradeName ?? 'Unknown';
            const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            return {
              id: f.id,
              clientId: f.clientId,
              clientName: name,
              clientInitials: initials,
              returnType: f.returnType,
              invoiceCount: f.totalInvoices,
              taxAmount: f.totalTax,
              period: f.period,
            };
          });
          setReadyToFile(readyItems.length > 0 ? readyItems : mockReadyToFile);
        }
      }

    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleOpenClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentView('client-workspace');
  };

  const handleFileReturn = (clientId: string, returnType: string, period: string) => {
    setSelectedClientId(clientId);
    setReturnPrepCtx({
      clientId,
      returnType: (returnType === 'GSTR-3B' ? 'GSTR-3B' : 'GSTR-1') as 'GSTR-1' | 'GSTR-3B',
      period,
    });
    setCurrentView('return-prep');
  };

  const handleQuickFile = (itemId: string, clientName: string, returnType: string) => {
    if (filingItems.has(itemId) || filedItems.has(itemId)) return;
    setFilingItems(prev => new Set(prev).add(itemId));

    setTimeout(() => {
      setFiledItems(prev => new Set(prev).add(itemId));
      setFilingItems(prev => { const n = new Set(prev); n.delete(itemId); return n; });

      // Update metrics
      setMetrics(prev => prev.map(m => {
        if (m.id === 'ready') return { ...m, value: Math.max(0, m.value - 1) };
        if (m.id === 'filed') return { ...m, value: m.value + 1 };
        if (m.id === 'pending') return { ...m, value: Math.max(0, m.value - 1) };
        return m;
      }));

      // Add toast
      const toastId = `toast-${Date.now()}`;
      const arn = `AA${String(new Date().getDate()).padStart(2, '0')}${String(new Date().getMonth() + 1).padStart(2, '0')}25${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;
      setDashboardToasts(prev => [...prev, { id: toastId, title: `${returnType} Filed Successfully`, desc: `${clientName} — ARN: ${arn}`, type: 'success' }]);
      setTimeout(() => setDashboardToasts(prev => prev.filter(t => t.id !== toastId)), 4000);
    }, 1500);
  };

  // ── Animation ─────────────────────────────────────────────────────────────
  const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-8">

      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            What needs your attention today
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className="text-xs font-medium px-3 py-1.5 gap-1.5 text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {currentPeriodLabel}
          </Badge>
          <Button
            size="sm"
            onClick={() => setCurrentView('invoices')}
            className="h-8 gap-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TOP ROW — 4 METRICS
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <motion.div key={i} variants={fadeUp}>
                <div className="border border-border/60 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-7 w-8" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </motion.div>
            ))
          : metrics.map((metric) => (
              <motion.div
                key={metric.id}
                variants={fadeUp}
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div className="border border-border/60 rounded-xl p-4 hover:border-border transition-colors cursor-default group">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={`flex items-center justify-center h-8 w-8 rounded-lg ${metric.iconBg} transition-transform group-hover:scale-105`}>
                      <span className={metric.iconColor}>{metric.icon}</span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {metric.label}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-foreground leading-none">
                    {metric.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {metric.subtitle}
                  </p>
                </div>
              </motion.div>
            ))
        }
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1: TODAY'S PRIORITIES
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.45, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Today&apos;s Priorities
          </h2>
          <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
            {priorities.filter(p => p.urgency === 'overdue').length} overdue
          </Badge>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-border/40 rounded-lg p-3.5 flex gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-7 w-20 rounded-md" />
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
            <AnimatePresence>
              {priorities.map((priority, index) => (
                <motion.div
                  key={priority.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.05, duration: 0.35 }}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors group"
                >
                  {/* Urgency indicator */}
                  <div className={`h-8 w-1 rounded-full shrink-0 ${
                    priority.urgency === 'overdue' ? 'bg-red-500'
                    : priority.urgency === 'due-soon' ? 'bg-amber-500'
                    : 'bg-slate-300'
                  }`} />

                  {/* Client avatar */}
                  <button
                    onClick={() => handleOpenClient(priority.clientId)}
                    className={`flex items-center justify-center h-8 w-8 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                      priority.urgency === 'overdue'
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : priority.urgency === 'due-soon'
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {priority.clientInitials}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenClient(priority.clientId)}
                        className="text-sm font-medium text-foreground hover:text-emerald-600 transition-colors"
                      >
                        {priority.clientName}
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {priority.returnType} · {periodToLabel(priority.period)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {priority.reason}
                    </p>
                  </div>

                  {/* Days remaining */}
                  <span className={`text-xs font-medium shrink-0 ${
                    priority.urgency === 'overdue' ? 'text-red-600'
                    : priority.urgency === 'due-soon' ? 'text-amber-600'
                    : 'text-muted-foreground'
                  }`}>
                    {formatDaysRemaining(priority.daysRemaining)}
                  </span>

                  {/* Action button */}
                  <Button
                    size="sm"
                    className={`h-7 text-xs font-medium px-3 shrink-0 ${
                      priority.urgency === 'overdue'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : priority.urgency === 'due-soon'
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                    onClick={() => {
                      if (priority.actionView === 'returns') {
                        handleFileReturn(priority.clientId, priority.returnType, priority.period);
                      } else {
                        setCurrentView(priority.actionView as 'returns' | 'reconcile' | 'invoices' | 'clients' | 'dashboard' | 'settings' | 'client-workspace' | 'return-prep');
                      }
                    }}
                  >
                    {priority.actionLabel}
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TWO-COLUMN: READY TO FILE + ISSUES BLOCKING
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* SECTION 2: READY TO FILE QUEUE */}
        <motion.section
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.45, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Ready to File
            </h2>
            <Badge variant="outline" className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border-emerald-200">
              {readyToFile.length} returns
            </Badge>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-border/40 rounded-lg p-3.5 flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-7 w-16 rounded-md" />
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
              <AnimatePresence>
                {readyToFile.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.05, duration: 0.35 }}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-emerald-50/30 transition-colors group"
                  >
                    {/* Client avatar */}
                    <button
                      onClick={() => handleOpenClient(item.clientId)}
                      className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold shrink-0 hover:bg-emerald-100 transition-colors"
                    >
                      {item.clientInitials}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenClient(item.clientId)}
                          className="text-sm font-medium text-foreground hover:text-emerald-600 transition-colors"
                        >
                          {item.clientName}
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {item.returnType} · {periodToLabel(item.period)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.invoiceCount} invoices · {formatCurrency(item.taxAmount)} tax
                      </p>
                    </div>

                    {/* File button */}
                    {filedItems.has(item.id) ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-2 py-0.5 gap-1 shrink-0">
                        <CheckCircle2 className="size-2.5" /> Filed
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        className={`h-7 text-xs font-medium px-3 shrink-0 ${filingItems.has(item.id) ? 'bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                        disabled={filingItems.has(item.id)}
                        onClick={() => handleQuickFile(item.id, item.clientName, item.returnType)}
                      >
                        {filingItems.has(item.id) ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Filing...</>
                        ) : (
                          'File Return'
                        )}
                      </Button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* View All */}
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 gap-1"
              onClick={() => setCurrentView('returns')}
            >
              View All Returns
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </motion.section>

        {/* SECTION 3: ISSUES BLOCKING FILING */}
        <motion.section
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.45, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Issues Blocking Filing
            </h2>
            <Badge variant="outline" className="text-[11px] font-medium text-red-700 bg-red-50 border-red-200">
              {blockingIssues.length} issues
            </Badge>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-border/40 rounded-lg p-3.5 flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-md" />
                </div>
              ))}
            </div>
          ) : (
            <ScrollArea className="max-h-[420px]">
              <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
                <AnimatePresence>
                  {blockingIssues.map((issue, index) => {
                    const catConfig = issueCategoryConfig[issue.category];
                    return (
                      <motion.div
                        key={issue.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 + index * 0.05, duration: 0.35 }}
                        className="px-4 py-3.5 hover:bg-red-50/20 transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          {/* Client avatar */}
                          <button
                            onClick={() => handleOpenClient(issue.clientId)}
                            className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold shrink-0 hover:bg-slate-200 transition-colors mt-0.5"
                          >
                            {issue.clientInitials}
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <button
                                onClick={() => handleOpenClient(issue.clientId)}
                                className="text-sm font-medium text-foreground hover:text-emerald-600 transition-colors"
                              >
                                {issue.clientName}
                              </button>
                              <Badge variant="outline" className={`text-[10px] font-medium px-1.5 py-0 h-4 border ${catConfig.bg} ${catConfig.color}`}>
                                {catConfig.label}
                              </Badge>
                            </div>
                            <p className="text-xs font-medium text-foreground/80 leading-snug">
                              {issue.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                              {issue.detail}
                            </p>
                          </div>

                          {/* Action button */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs font-medium px-3 shrink-0 border-border/60 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                            onClick={() => setCurrentView(issue.actionView as 'returns' | 'reconcile' | 'invoices' | 'clients' | 'dashboard' | 'settings' | 'client-workspace' | 'return-prep')}
                          >
                            {issue.actionLabel}
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </motion.section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4: RECENT UPLOADS
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.45, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Recent Uploads
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-7 gap-1"
            onClick={() => setCurrentView('invoices')}
          >
            View All
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-border/40 rounded-lg p-4 space-y-2.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-6 w-16 rounded-md" />
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {recentUploads.map((upload) => {
              const statusConfig = uploadStatusConfig[upload.status];
              return (
                <motion.div
                  key={upload.id}
                  variants={fadeUp}
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <div className="border border-border/60 rounded-xl p-4 hover:border-border transition-colors cursor-pointer group"
                    onClick={() => setCurrentView('invoices')}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${statusConfig.bg}`}>
                        <span className={statusConfig.color}>{statusConfig.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate" title={upload.filename}>
                          {upload.filename}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {upload.clientName} · {upload.uploadTime}
                        </p>
                      </div>
                    </div>

                    {/* Extraction metadata */}
                    {upload.status === 'extracted' && (
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
                        {upload.rowCount && <span>{upload.rowCount} rows</span>}
                        {upload.invoiceCount && <span>{upload.invoiceCount} invoices</span>}
                        {upload.accuracy && <span className="text-emerald-600 font-medium">{upload.accuracy}% accuracy</span>}
                      </div>
                    )}

                    {upload.status === 'processing' && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-amber-500 rounded-full"
                            initial={{ width: '0%' }}
                            animate={{ width: '72%' }}
                            transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                          />
                        </div>
                        <span className="text-[11px] text-amber-600 font-medium">72%</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold px-2 py-0 h-5 border ${statusConfig.bg} ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </Badge>
                      {upload.status === 'failed' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                          onClick={(e) => { e.stopPropagation(); setCurrentView('invoices'); }}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      ) : upload.status === 'extracted' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2"
                          onClick={(e) => { e.stopPropagation(); setCurrentView('returns'); }}
                        >
                          File Return
                          <ArrowRight className="h-3 w-3 ml-0.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5: AI RECOMMENDATIONS
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.45, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            AI Recommendations
          </h2>
          <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
            {aiRecommendations.filter(r => r.urgency === 'high').length} urgent
          </Badge>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-border/40 rounded-lg p-4 flex gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {aiRecommendations.map((rec) => (
              <motion.div
                key={rec.id}
                variants={fadeUp}
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="border border-border/60 rounded-xl p-4 hover:border-border transition-colors cursor-pointer group"
                onClick={() => setCurrentView(rec.actionView as 'returns' | 'reconcile' | 'invoices' | 'clients' | 'dashboard' | 'settings' | 'client-workspace' | 'return-prep')}
              >
                <div className="flex gap-3">
                  <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${rec.iconBg} transition-transform group-hover:scale-105`}>
                    <span className={rec.iconColor}>{rec.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {rec.title}
                      </p>
                      {rec.urgency === 'high' && (
                        <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded shrink-0">
                          URGENT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                      {rec.description}
                    </p>
                    <button
                      className="mt-2.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group-hover:gap-1.5 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentView(rec.actionView as 'returns' | 'reconcile' | 'invoices' | 'clients' | 'dashboard' | 'settings' | 'client-workspace' | 'return-prep');
                      }}
                    >
                      {rec.actionLabel}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.section>

      {/* ═══ Dashboard Toast Notifications ═══ */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {dashboardToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-sm bg-emerald-50/95 border-emerald-200"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{toast.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{toast.desc}</p>
              </div>
              <button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setDashboardToasts(prev => prev.filter(t => t.id !== toast.id))}>
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
