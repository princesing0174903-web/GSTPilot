'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  Upload,
  FileText,
  GitCompareArrows,
  Send,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Eye,
  RefreshCw,
  Download,
  AlertCircle,
  XCircle,
  UploadCloud,
  Activity,
  MapPin,
  Building2,
  ChevronRight,
  ArrowRight,
  Sparkles,
  FileCheck,
  Gauge,
  FolderOpen,
  IndianRupee,
  CircleDot,
  Inbox,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useApp } from '@/contexts/AppContext';
import type { AppView } from '@/contexts/AppContext';
import { formatCurrency, periodToLabel, getFilingDueDate } from '@/lib/gst-utils';
import { toast } from 'sonner';
import {
  useClient,
  useFilings,
  useInvoices,
  useIssues,
  useUploadedFiles,
  useAuditLogs,
  useReconRuns,
  useUploadFile,
  useCreateReconRun,
} from '@/hooks/api';
import type {
  Client,
  GSTRFiling,
  Invoice,
  Issue,
  AuditLogEntry,
  ReconciliationRun,
  FilingStatus,
} from '@/types/gst';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ReturnEntry {
  id: string;
  type: string;
  period: string;
  filingDate: string;
  arn: string;
  status: 'Filed' | 'Pending' | 'Overdue' | 'Draft' | 'Ready to File' | 'In Review';
  taxAmount: number;
}

interface PendingAction {
  id: string;
  type: 'missing_documents' | 'gstin_error' | 'recon_mismatch' | 'awaiting_review' | 'ready_to_file';
  title: string;
  description: string;
  dueDate?: string;
  actionLabel: string;
  targetView: AppView;
  priority: 'high' | 'medium' | 'low';
}

interface DocumentEntry {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  status: 'Processed' | 'Processing' | 'Uploaded' | 'Error';
  invoicesExtracted: number;
  totalRows: number;
  accuracy: number;
  size: string;
}

interface ReconRun {
  id: string;
  period: string;
  matchRate: number;
  mismatches: number;
  missingInvoices: number;
  taxDifference: number;
  runDate: string;
  status: 'Completed' | 'Running' | 'Failed';
}

interface AIInsight {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  suggestedAction: string;
  actionView: AppView;
  category: string;
}

interface ActivityEvent {
  id: string;
  type: 'upload' | 'return_created' | 'filing_submitted' | 'recon_run' | 'user_action' | 'ai_action';
  description: string;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getHealthColor(score: number): { bg: string; text: string; stroke: string } {
  if (score > 80) return { bg: 'bg-emerald-50', text: 'text-emerald-700', stroke: '#10b981' };
  if (score >= 50) return { bg: 'bg-amber-50', text: 'text-amber-700', stroke: '#f59e0b' };
  return { bg: 'bg-red-50', text: 'text-red-700', stroke: '#ef4444' };
}

function getRiskBadge(risk: string) {
  switch (risk) {
    case 'Low': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[10px] px-2 py-0.5"><Shield className="size-2.5" />Low</Badge>;
    case 'Medium': return <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-[10px] px-2 py-0.5"><AlertTriangle className="size-2.5" />Medium</Badge>;
    case 'High': return <Badge className="bg-orange-50 text-orange-700 border-orange-200 gap-1 text-[10px] px-2 py-0.5"><AlertTriangle className="size-2.5" />High</Badge>;
    case 'Critical': return <Badge className="bg-red-50 text-red-700 border-red-200 gap-1 text-[10px] px-2 py-0.5"><XCircle className="size-2.5" />Critical</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{risk}</Badge>;
  }
}

function getReturnStatusBadge(status: string) {
  switch (status) {
    case 'Filed': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0"><CheckCircle2 className="size-2.5 mr-0.5" />Filed</Badge>;
    case 'Pending': return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0"><Clock className="size-2.5 mr-0.5" />Pending</Badge>;
    case 'Overdue': return <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0"><AlertCircle className="size-2.5 mr-0.5" />Overdue</Badge>;
    case 'Draft': return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] px-1.5 py-0"><FileText className="size-2.5 mr-0.5" />Draft</Badge>;
    case 'Ready to File': return <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] px-1.5 py-0"><CheckCircle2 className="size-2.5 mr-0.5" />Ready</Badge>;
    case 'In Review': return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0"><Eye className="size-2.5 mr-0.5" />Review</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  }
}

function getDocStatusBadge(status: string) {
  switch (status) {
    case 'Processed': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">Processed</Badge>;
    case 'Processing': return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">Processing</Badge>;
    case 'Uploaded': return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] px-1.5 py-0">Uploaded</Badge>;
    case 'Error': return <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0">Error</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  }
}

function getActionTypeIcon(type: string) {
  switch (type) {
    case 'missing_documents': return UploadCloud;
    case 'gstin_error': return XCircle;
    case 'recon_mismatch': return GitCompareArrows;
    case 'awaiting_review': return Eye;
    case 'ready_to_file': return CheckCircle2;
    default: return AlertCircle;
  }
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'upload': return UploadCloud;
    case 'return_created': return FileText;
    case 'filing_submitted': return FileCheck;
    case 'recon_run': return GitCompareArrows;
    case 'user_action': return Activity;
    case 'ai_action': return Sparkles;
    default: return CircleDot;
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case 'upload': return 'bg-blue-50 text-blue-600';
    case 'return_created': return 'bg-purple-50 text-purple-600';
    case 'filing_submitted': return 'bg-emerald-50 text-emerald-600';
    case 'recon_run': return 'bg-teal-50 text-teal-600';
    case 'user_action': return 'bg-slate-100 text-slate-600';
    case 'ai_action': return 'bg-amber-50 text-amber-600';
    default: return 'bg-slate-100 text-slate-500';
  }
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAPPING HELPERS (API data → UI types)
// ═══════════════════════════════════════════════════════════════════════════════

const SIMULATED_NOW = new Date('2025-07-08T12:00:00Z');

/** Check if a filing period is overdue relative to current date */
function isFilingOverdue(period: string): boolean {
  const dueDate = new Date(getFilingDueDate('GSTR-1', period));
  return SIMULATED_NOW > dueDate;
}

/** Map API filing status to UI ReturnEntry status */
function mapFilingStatus(status: FilingStatus, period: string): ReturnEntry['status'] {
  if (status === 'filed') return 'Filed';
  const readyStatuses: FilingStatus[] = ['validated', 'reviewed', 'generated'];
  if (readyStatuses.includes(status)) {
    return isFilingOverdue(period) ? 'Overdue' : 'Ready to File';
  }
  return isFilingOverdue(period) ? 'Overdue' : 'Draft';
}

/** Map an API document to a DocumentEntry for the UI */
function mapApiDocument(doc: Record<string, unknown>): DocumentEntry {
  const statusStr = (doc.processingStep as string) ?? (doc.status as string) ?? 'uploaded';
  const statusMap: Record<string, DocumentEntry['status']> = {
    extracted: 'Processed',
    processing: 'Processing',
    processed: 'Processed',
    uploaded: 'Uploaded',
    failed: 'Error',
    error: 'Error',
  };
  const sizeBytes = (doc.size as number) ?? 0;
  const sizeStr = sizeBytes > 1048576
    ? `${(sizeBytes / 1048576).toFixed(1)} MB`
    : sizeBytes > 1024
      ? `${(sizeBytes / 1024).toFixed(0)} KB`
      : sizeBytes > 0
        ? `${sizeBytes} B`
        : '1.0 MB';

  return {
    id: (doc.id as string) ?? '',
    name: (doc.name as string) ?? (doc.filename as string) ?? 'Document',
    type: (doc.fileType as string) ?? (doc.folder as string) ?? 'Document',
    uploadDate: ((doc.createdAt as string) ?? new Date().toISOString()).split('T')[0],
    status: statusMap[statusStr.toLowerCase()] ?? 'Uploaded',
    invoicesExtracted: (doc.invoiceCount as number) ?? 0,
    totalRows: (doc.rowCount as number) ?? 0,
    accuracy: (doc.accuracy as number) ?? 0,
    size: sizeStr,
  };
}

/** Map an API reconciliation run to a UI ReconRun */
function mapApiReconRun(run: ReconciliationRun): ReconRun {
  const matchRate = run.totalRecords > 0 ? Math.round((run.matched / run.totalRecords) * 100) : 0;
  return {
    id: run.id,
    period: periodToLabel(run.period),
    matchRate,
    mismatches: run.unmatched + run.partialMatches,
    missingInvoices: run.unmatched,
    taxDifference: run.gstDifference,
    runDate: run.createdAt.split('T')[0],
    status: run.status === 'completed' ? 'Completed' as const : run.status === 'running' ? 'Running' as const : 'Failed' as const,
  };
}

/** Map an API audit log to an ActivityEvent for the UI */
function mapAuditLogToEvent(log: AuditLogEntry): ActivityEvent {
  const action = log.action?.toLowerCase() ?? '';
  let type: ActivityEvent['type'] = 'user_action';
  if (action.includes('upload') || action.includes('import')) type = 'upload';
  else if (action.includes('file') || action.includes('submit')) type = 'filing_submitted';
  else if (action.includes('reconcil')) type = 'recon_run';
  else if (action.includes('valid') || action.includes('generat')) type = 'ai_action';
  else if (action.includes('return') || action.includes('creat')) type = 'return_created';

  return {
    id: log.id,
    type,
    description: log.details ?? log.action,
    timestamp: log.timestamp,
  };
}

/** Map issue category to pending action type */
function issueCategoryToActionType(category: string): PendingAction['type'] {
  const lower = category.toLowerCase();
  if (lower.includes('gstin') || lower.includes('invalid')) return 'gstin_error';
  if (lower.includes('missing') || lower.includes('mandatory') || lower.includes('hsn')) return 'missing_documents';
  if (lower.includes('duplicate') || lower.includes('calculation') || lower.includes('tax')) return 'recon_mismatch';
  return 'awaiting_review';
}

/** Map API issue to AIInsight */
function mapIssueToInsight(issue: Issue): AIInsight {
  const severity: AIInsight['severity'] =
    issue.severity === 'critical' ? 'critical' : issue.severity === 'warning' ? 'warning' : 'info';
  const category = issue.category ?? 'General';

  let actionView: AppView = 'dashboard';
  let suggestedAction = 'Review';
  if (category.toLowerCase().includes('gstin') || category.toLowerCase().includes('tax')) {
    actionView = 'reconcile';
    suggestedAction = 'Review Details';
  } else if (category.toLowerCase().includes('missing') || category.toLowerCase().includes('document')) {
    actionView = 'invoices';
    suggestedAction = 'Upload Documents';
  } else if (category.toLowerCase().includes('filing') || category.toLowerCase().includes('deadline')) {
    actionView = 'returns';
    suggestedAction = 'File Return';
  }

  return {
    id: issue.id,
    severity,
    title: issue.title ?? category,
    description: issue.description ?? '',
    suggestedAction,
    actionView,
    category,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG Health Ring
// ═══════════════════════════════════════════════════════════════════════════════

function HealthRing({ score, size = 72, strokeWidth = 5 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getHealthColor(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color.stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold text-lg ${color.text}`}>{score}</span>
        <span className="text-[8px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION
// ═══════════════════════════════════════════════════════════════════════════════

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ClientWorkspacePage() {
  const { selectedClientId, setCurrentView, setSelectedClientId, setReturnPrepCtx } = useApp();
  const [returnFilter, setReturnFilter] = useState('all');

  // ─── React Query hooks ─────────────────────────────────────────────────
  const { data: clientData, isLoading: clientLoading, error: clientError } = useClient(selectedClientId ?? undefined);
  const { data: filingsData, isLoading: filingsLoading } = useFilings(selectedClientId ?? undefined);
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices(selectedClientId ?? undefined);
  const { data: issuesData, isLoading: issuesLoading } = useIssues(selectedClientId ?? undefined);
  const { data: docsData, isLoading: docsLoading } = useUploadedFiles(selectedClientId ?? undefined);
  const { data: auditData, isLoading: auditLoading } = useAuditLogs(selectedClientId ?? undefined);
  const { data: reconData, isLoading: reconLoading } = useReconRuns(selectedClientId ?? undefined);

  // Mutations
  const uploadFileMutation = useUploadFile();
  const createReconRunMutation = useCreateReconRun();

  // ─── Extract data from query responses ──────────────────────────────────
  const client = clientData?.clients?.[0] as (Client & { _aggregations?: { totalInvoices: number; filedReturns: number; pendingReturns: number; matchPercentage: number } }) | undefined;
  // Filter filings/issues/reconRuns by clientId (API may return all records)
  const allFilings: GSTRFiling[] = filingsData?.filings ?? [];
  const filings = useMemo(() => allFilings.filter(f => f.clientId === selectedClientId), [allFilings, selectedClientId]);
  const allInvoices: Invoice[] = invoicesData?.invoices ?? [];
  const invoices = useMemo(() => allInvoices.filter(inv => inv.clientId === selectedClientId), [allInvoices, selectedClientId]);
  const allIssues: Issue[] = issuesData?.issues ?? [];
  const issues = useMemo(() => allIssues.filter(i => i.clientId === selectedClientId), [allIssues, selectedClientId]);
  const rawDocuments: Array<Record<string, unknown>> = docsData?.documents ?? [];
  const allAuditLogs: AuditLogEntry[] = auditData?.logs ?? [];
  const auditLogs = useMemo(() => allAuditLogs.filter(l => l.clientId === selectedClientId), [allAuditLogs, selectedClientId]);
  const allReconRuns: ReconciliationRun[] = reconData?.runs ?? [];
  const reconRuns = useMemo(() => allReconRuns.filter(r => r.clientId === selectedClientId), [allReconRuns, selectedClientId]);

  const isLoading = clientLoading || filingsLoading;

  // ─── Derive workspace data from API responses ─────────────────────────
  const name = client?.tradeName ?? 'Unknown Client';

  // Map filings → ReturnEntry[]
  const returns: ReturnEntry[] = useMemo(() => {
    return filings.map(f => ({
      id: f.id,
      type: f.returnType,
      period: periodToLabel(f.period),
      filingDate: f.filedDate ?? '',
      arn: f.acknowledgmentNumber ?? '',
      status: mapFilingStatus(f.status, f.period),
      taxAmount: f.totalTax,
    }));
  }, [filings]);

  // Filter returns
  const filteredReturns = useMemo(() => {
    if (returnFilter === 'all') return returns;
    return returns.filter(r => r.type === returnFilter);
  }, [returns, returnFilter]);

  // Map issues → Pending Actions
  const pendingActions: PendingAction[] = useMemo(() => {
    const openIssues = issues.filter(i => i.status === 'open');

    const issueActions: PendingAction[] = openIssues.map(i => {
      const actionType = issueCategoryToActionType(i.category);
      const priority: PendingAction['priority'] =
        i.severity === 'critical' ? 'high' : i.severity === 'warning' ? 'medium' : 'low';
      const targetView: AppView =
        actionType === 'gstin_error' || actionType === 'recon_mismatch' ? 'reconcile'
        : actionType === 'missing_documents' ? 'invoices'
        : 'returns';
      return {
        id: i.id,
        type: actionType,
        title: i.category,
        description: i.description ?? i.title,
        actionLabel: actionType === 'gstin_error' ? 'Fix Error' : actionType === 'missing_documents' ? 'Upload' : 'Review',
        targetView,
        priority,
      };
    });

    // Ready-to-file actions from filings
    const readyStatuses: FilingStatus[] = ['validated', 'reviewed', 'generated'];
    const readyFilings = filings.filter(f => readyStatuses.includes(f.status));
    const readyActions: PendingAction[] = readyFilings.map(f => ({
      id: `ready-${f.id}`,
      type: 'ready_to_file' as const,
      title: `${f.returnType} ${periodToLabel(f.period)} ready to file`,
      description: `${f.readyForFiling} invoices validated, ${formatCurrency(f.totalTax)} total tax`,
      dueDate: getFilingDueDate(f.returnType, f.period),
      actionLabel: 'File Return',
      targetView: 'returns' as AppView,
      priority: 'high' as const,
    }));

    // Overdue filing actions
    const overdueFilings = filings.filter(f => f.status !== 'filed' && isFilingOverdue(f.period) && !readyStatuses.includes(f.status));
    const overdueActions: PendingAction[] = overdueFilings.map(f => ({
      id: `overdue-${f.id}`,
      type: 'awaiting_review' as const,
      title: `${f.returnType} ${periodToLabel(f.period)} overdue`,
      description: `Return was due ${new Date(getFilingDueDate(f.returnType, f.period)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. Late fee may be accruing.`,
      dueDate: getFilingDueDate(f.returnType, f.period),
      actionLabel: 'Prepare Return',
      targetView: 'returns' as AppView,
      priority: 'high' as const,
    }));

    return [
      ...readyActions,
      ...issueActions.sort((a, b) => (a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0)),
      ...overdueActions,
    ];
  }, [issues, filings]);

  // Map documents
  const documents: DocumentEntry[] = useMemo(() => {
    return rawDocuments.map(mapApiDocument);
  }, [rawDocuments]);

  // Map recon runs
  const mappedReconRuns: ReconRun[] = useMemo(() => {
    return reconRuns.map(mapApiReconRun);
  }, [reconRuns]);

  // Map audit logs → ActivityEvent[]
  const activities: ActivityEvent[] = useMemo(() => {
    return auditLogs.map(mapAuditLogToEvent);
  }, [auditLogs]);

  // Map issues → AI insights
  const insights: AIInsight[] = useMemo(() => {
    return issues.filter(i => i.status === 'open').map(mapIssueToInsight);
  }, [issues]);

  // Computed metrics
  const healthScore = client?.healthScore ?? 0;
  const isLowRisk = healthScore > 80;
  const isHighRisk = healthScore < 50;
  const riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' =
    isLowRisk ? 'Low' : healthScore >= 50 ? 'Medium' : healthScore >= 30 ? 'High' : 'Critical';
  const matchRate = client?._aggregations?.matchPercentage ?? (healthScore > 80 ? 94 : healthScore < 50 ? 58 : 78);
  const pendingReturnsCount = filings.filter(f => f.status !== 'filed').length;
  const openIssuesCount = issues.filter(i => i.status === 'open').length;
  const taxVolume = filings.reduce((sum, f) => sum + f.totalTaxableValue, 0);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleBack = () => { setSelectedClientId(null); setCurrentView('clients'); };
  const handleAction = (view: AppView) => setCurrentView(view);

  const handleOpenReturnPrep = (returnType: 'GSTR-1' | 'GSTR-3B' = 'GSTR-1') => {
    const resolvedId = client?.id ?? selectedClientId ?? 'client-1';
    setReturnPrepCtx({
      clientId: resolvedId,
      returnType,
      period: '2025-06',
    });
    setCurrentView('return-prep');
  };

  const handleUploadDocument = () => {
    // Trigger file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv,.pdf,.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && selectedClientId) {
        uploadFileMutation.mutate(
          { clientId: selectedClientId, name: file.name, fileType: file.name.split('.').pop(), size: file.size },
          {
            onSuccess: () => toast.success('Document uploaded', { description: file.name }),
            onError: (err) => toast.error('Upload failed', { description: err.message }),
          }
        );
      }
    };
    input.click();
  };

  const handleRunReconciliation = () => {
    if (!selectedClientId) return;
    createReconRunMutation.mutate(
      { clientId: selectedClientId, period: '2025-06' },
      {
        onSuccess: () => toast.success('Reconciliation started', { description: 'Results will appear shortly' }),
        onError: (err) => toast.error('Reconciliation failed', { description: err.message }),
      }
    );
  };

  // ─── No client selected ───────────────────────────────────────────────
  if (!selectedClientId) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <Skeleton className="h-6 w-40" />
        <div className="border rounded-xl p-6 space-y-4">
          <div className="flex gap-4"><Skeleton className="h-16 w-16 rounded-full" /><div className="space-y-2 flex-1"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></div></div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      </div>
    );
  }

  // ─── Loading state ────────────────────────────────────────────────────
  if (isLoading && !client) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <Skeleton className="h-6 w-40" />
        <div className="border rounded-xl p-6 space-y-4">
          <div className="flex gap-4"><Skeleton className="h-16 w-16 rounded-full" /><div className="space-y-2 flex-1"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></div></div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────
  if (clientError) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 text-center space-y-4">
        <AlertCircle className="size-12 text-red-400 mx-auto" />
        <h2 className="text-lg font-semibold text-foreground">Failed to load client</h2>
        <p className="text-sm text-muted-foreground">{clientError.message}</p>
        <Button variant="outline" onClick={handleBack}>Go Back</Button>
      </div>
    );
  }

  // ─── Client not found ─────────────────────────────────────────────────
  if (!client) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 text-center space-y-4">
        <Building2 className="size-12 text-muted-foreground/40 mx-auto" />
        <h2 className="text-lg font-semibold text-foreground">Client not found</h2>
        <p className="text-sm text-muted-foreground">The selected client could not be found.</p>
        <Button variant="outline" onClick={handleBack}>Back to Clients</Button>
      </div>
    );
  }

  const healthColor = getHealthColor(healthScore);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-8">

      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1" onClick={handleBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Client Portfolio
          </Button>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{name}</span>
        </div>

        {/* Main header */}
        <div className="border border-border/60 rounded-xl p-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            {/* Left: Identity */}
            <div className="flex items-start gap-4">
              <HealthRing score={healthScore} size={72} strokeWidth={5} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold text-foreground tracking-tight">{name}</h1>
                  {getRiskBadge(riskLevel)}
                </div>
                {client.legalName && <p className="text-sm text-muted-foreground mt-0.5">{client.legalName}</p>}

                {/* Key info row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="size-3 text-slate-400" />
                    <span className="font-mono font-medium text-foreground">{client.gstin}</span>
                  </div>
                  <Separator orientation="vertical" className="h-3.5" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3 text-slate-400" />
                    <span>{client.state}</span>
                  </div>
                  <Separator orientation="vertical" className="h-3.5" />
                  <span className="text-xs text-muted-foreground">
                    {client.returnPeriod === 'quarterly' ? 'Quarterly' : 'Monthly'} Filing
                  </span>
                  <Separator orientation="vertical" className="h-3.5" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="size-3 text-slate-400" />
                    <span>Last Filed: {client.lastFilingDate ? new Date(client.lastFilingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Quick actions */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleUploadDocument}>
                <Upload className="size-3.5" />
                Upload Documents
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleOpenReturnPrep('GSTR-1')}>
                <FileText className="size-3.5" />
                Create Return
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleRunReconciliation} disabled={createReconRunMutation.isPending}>
                <GitCompareArrows className="size-3.5" />
                {createReconRunMutation.isPending ? 'Running...' : 'Run Reconciliation'}
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleOpenReturnPrep('GSTR-3B')}>
                <Send className="size-3.5" />
                File Return
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1: CLIENT HEALTH OVERVIEW
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Client Health Overview</h2>
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Compliance Score', value: `${healthScore}%`, icon: Gauge, color: healthColor.text, bg: healthColor.bg },
            { label: 'Pending Returns', value: String(pendingReturnsCount), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Open Issues', value: String(openIssuesCount), icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Tax Volume', value: formatCurrency(taxVolume), icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Match Rate', value: `${matchRate}%`, icon: GitCompareArrows, color: 'text-teal-600', bg: 'bg-teal-50' },
            { label: 'Documents', value: String(documents.length), icon: FolderOpen, color: 'text-slate-600', bg: 'bg-slate-50' },
          ].map((item) => (
            <motion.div key={item.label} variants={fadeUp} whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
              <div className="border border-border/60 rounded-xl p-4 hover:border-border transition-colors">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className={`flex items-center justify-center h-7 w-7 rounded-md ${item.bg}`}>
                    <item.icon className={`size-3.5 ${item.color}`} />
                  </div>
                </div>
                <p className="text-lg font-bold text-foreground leading-tight">{item.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{item.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2: GST RETURN TIMELINE
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">GST Return Timeline</h2>
          <Select value={returnFilter} onValueChange={setReturnFilter}>
            <SelectTrigger className="h-7 w-32 text-xs border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Returns</SelectItem>
              <SelectItem value="GSTR-1">GSTR-1</SelectItem>
              <SelectItem value="GSTR-3B">GSTR-3B</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredReturns.length === 0 ? (
          <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <FileText className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No returns filed yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Start by preparing your first GST return</p>
            <Button size="sm" className="mt-4 h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleOpenReturnPrep('GSTR-1')}>
              <FileText className="size-3.5" />
              Prepare First Return
            </Button>
          </div>
        ) : (
          <div className="border border-border/60 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Period</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Filed Date</div>
              <div className="col-span-2">ARN</div>
              <div className="col-span-2 text-right">Tax Amount</div>
            </div>
            {/* Table rows */}
            <div className="divide-y divide-border/40">
              <AnimatePresence>
                {filteredReturns.map((ret, index) => (
                  <motion.div
                    key={ret.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + index * 0.04, duration: 0.3 }}
                    className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-muted/20 transition-colors items-center"
                  >
                    <div className="col-span-2 text-sm font-medium text-foreground">{ret.type}</div>
                    <div className="col-span-2 text-sm text-muted-foreground">{ret.period}</div>
                    <div className="col-span-2">{getReturnStatusBadge(ret.status)}</div>
                    <div className="col-span-2 text-xs text-muted-foreground">{ret.filingDate ? new Date(ret.filingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</div>
                    <div className="col-span-2 text-xs font-mono text-muted-foreground">{ret.arn || '—'}</div>
                    <div className="col-span-2 text-sm font-medium text-foreground text-right">{formatCurrency(ret.taxAmount)}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3: PENDING ACTIONS
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Pending Actions</h2>
          <Badge variant="outline" className="text-[11px] text-muted-foreground">
            {pendingActions.filter(a => a.priority === 'high').length} urgent
          </Badge>
        </div>

        {pendingActions.length === 0 ? (
          <div className="border border-border/60 rounded-xl p-6 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="size-10 text-emerald-300 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground/70 mt-1">No pending actions for this client</p>
          </div>
        ) : (
          <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
            <AnimatePresence>
              {pendingActions.map((action, index) => {
                const IconComp = getActionTypeIcon(action.type);
                const priorityStripe = action.priority === 'high' ? 'bg-red-500' : action.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-300';
                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + index * 0.05, duration: 0.3 }}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors group"
                  >
                    <div className={`h-8 w-1 rounded-full shrink-0 ${priorityStripe}`} />
                    <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${
                      action.priority === 'high' ? 'bg-red-50 text-red-600'
                      : action.priority === 'medium' ? 'bg-amber-50 text-amber-600'
                      : 'bg-slate-100 text-slate-500'
                    }`}>
                      <IconComp className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{action.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{action.description}</p>
                    </div>
                    {action.dueDate && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        Due {new Date(action.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    <Button
                      size="sm"
                      className={`h-7 text-xs font-medium px-3 shrink-0 ${
                        action.priority === 'high' ? 'bg-red-600 hover:bg-red-700 text-white'
                        : action.type === 'ready_to_file' ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      onClick={() => {
                        if (action.targetView === 'returns' || action.type === 'ready_to_file') {
                          handleOpenReturnPrep('GSTR-1');
                        } else {
                          handleAction(action.targetView);
                        }
                      }}
                    >
                      {action.actionLabel}
                    </Button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4: UPLOADED DOCUMENTS
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Uploaded Documents</h2>
          <Button variant="ghost" size="sm" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-7 gap-1" onClick={() => handleAction('invoices')}>
            View All <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {documents.length === 0 ? (
          <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <UploadCloud className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No documents uploaded yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Upload sales registers, purchase data, or GST portal exports</p>
            <Button size="sm" className="mt-4 h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleUploadDocument} disabled={uploadFileMutation.isPending}>
              <Upload className="size-3.5" />
              {uploadFileMutation.isPending ? 'Uploading...' : 'Upload Document'}
            </Button>
          </div>
        ) : (
          <div className="border border-border/60 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-3">File Name</div>
              <div className="col-span-2">Upload Date</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-center">Invoices</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            <div className="divide-y divide-border/40">
              {documents.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + index * 0.04, duration: 0.3 }}
                  className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-muted/20 transition-colors items-center"
                >
                  <div className="col-span-3 flex items-center gap-2 min-w-0">
                    <FileText className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate" title={doc.name}>{doc.name}</span>
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground">
                    {new Date(doc.uploadDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground">{doc.type}</div>
                  <div className="col-span-2">{getDocStatusBadge(doc.status)}</div>
                  <div className="col-span-1 text-center">
                    {doc.invoicesExtracted > 0 ? (
                      <span className="text-xs font-medium text-foreground">{doc.invoicesExtracted}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-muted-foreground hover:text-foreground" onClick={() => handleAction('invoices')}>
                      <Eye className="size-3" />
                    </Button>
                    {doc.status === 'Error' && (
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleAction('invoices')}>
                        <RefreshCw className="size-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-muted-foreground hover:text-foreground" onClick={() => handleAction('invoices')}>
                      <Download className="size-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TWO-COLUMN: RECONCILIATION HISTORY + AI COMPLIANCE ADVISOR
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* SECTION 5: RECONCILIATION HISTORY */}
        <motion.section initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Reconciliation History</h2>
            <Button variant="ghost" size="sm" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-7 gap-1" onClick={handleRunReconciliation} disabled={createReconRunMutation.isPending}>
              {createReconRunMutation.isPending ? 'Running...' : 'Run Reconciliation'} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {mappedReconRuns.length === 0 ? (
            <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <GitCompareArrows className="size-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No reconciliation runs yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Run reconciliation to match your books with GST portal data</p>
              <Button size="sm" className="mt-4 h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleRunReconciliation} disabled={createReconRunMutation.isPending}>
                <GitCompareArrows className="size-3.5" />
                {createReconRunMutation.isPending ? 'Running...' : 'Run Reconciliation'}
              </Button>
            </div>
          ) : (
            <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
              {mappedReconRuns.map((run, index) => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 + index * 0.05, duration: 0.3 }}
                  className="px-4 py-3.5 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{run.period}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                      run.matchRate >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : run.matchRate >= 70 ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {run.matchRate}% match
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Mismatches</p>
                      <p className="font-medium text-foreground">{run.mismatches}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Missing</p>
                      <p className="font-medium text-foreground">{run.missingInvoices}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tax Diff</p>
                      <p className="font-medium text-foreground">{formatCurrency(run.taxDifference)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Run Date</p>
                      <p className="font-medium text-foreground">{new Date(run.runDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        {/* SECTION 6: AI COMPLIANCE ADVISOR */}
        <motion.section initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="size-3.5 text-emerald-600" />
              AI Compliance Advisor
            </h2>
            <Badge variant="outline" className="text-[11px] text-muted-foreground">
              {insights.filter(i => i.severity === 'critical').length} critical
            </Badge>
          </div>

          {insights.length === 0 ? (
            <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="size-10 text-emerald-300 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No compliance issues detected</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Your client data looks clean</p>
            </div>
          ) : (
            <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
              {insights.map((insight, index) => {
                const severityConfig = {
                  critical: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700 border-red-200' },
                  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
                  info: { icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
                }[insight.severity];
                const SevIcon = severityConfig.icon;

                return (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + index * 0.05, duration: 0.3 }}
                    className="px-4 py-3.5 hover:bg-muted/20 transition-colors group"
                  >
                    <div className="flex gap-3">
                      <div className={`flex items-center justify-center h-7 w-7 rounded-lg shrink-0 ${severityConfig.bg}`}>
                        <SevIcon className={`size-3.5 ${severityConfig.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground leading-snug">{insight.title}</p>
                          {insight.severity === 'critical' && (
                            <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded shrink-0">URGENT</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{insight.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${severityConfig.badge}`}>{insight.category}</Badge>
                          <button
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group-hover:gap-1.5 transition-all"
                            onClick={() => {
                              if (insight.actionView === 'returns') {
                                handleOpenReturnPrep('GSTR-1');
                              } else {
                                handleAction(insight.actionView);
                              }
                            }}
                          >
                            {insight.suggestedAction}
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 7: ACTIVITY TIMELINE
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.4 }}>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Activity Timeline</h2>

        {activities.length === 0 ? (
          <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <Inbox className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No activity recorded yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Activities will appear as you upload documents, file returns, and run reconciliation</p>
          </div>
        ) : (
          <div className="border border-border/60 rounded-xl overflow-hidden">
            <div className="divide-y divide-border/40">
              {activities.map((event, index) => {
                const IconComp = getActivityIcon(event.type);
                const iconColor = getActivityColor(event.type);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.65 + index * 0.04, duration: 0.3 }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className={`flex items-center justify-center h-7 w-7 rounded-lg shrink-0 ${iconColor}`}>
                      <IconComp className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{event.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(event.timestamp)}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </motion.section>

    </div>
  );
}
