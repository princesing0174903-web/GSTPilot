'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PremiumEmptyState } from '@/components/ui/premium-empty-state';
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
import {
  displayGSTIN,
  displayText,
  displayNumber,
} from '@/lib/clients/display-utils';
import { toast } from 'sonner';
import {
  useFireClient,
  useFireReturns,
  useFireInvoices,
  useFireDocuments,
  useFireActivities,
} from '@/hooks/use-firestore';
import { fileReturn, updateReturnStatus, createReconciliation } from '@/lib/firestore-service';
import type {
  FirestoreClient,
  FirestoreReturn,
  FirestoreInvoice,
  FirestoreDocument,
} from '@/lib/firestore-schema';
import { useDocuments } from '@/hooks/useDocuments';
import { validateFile } from '@/lib/firebase/storage-service';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getHealthColor(score: number) {
  if (score > 80) return { bg: 'bg-emerald-50', text: 'text-emerald-700', stroke: '#2563EB' };
  if (score >= 50) return { bg: 'bg-amber-50', text: 'text-amber-700', stroke: '#f59e0b' };
  return { bg: 'bg-red-50', text: 'text-red-700', stroke: '#ef4444' };
}

function getReturnStatusBadge(status: string) {
  switch (status) {
    case 'filed': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] px-1.5 py-0"><CheckCircle2 className="size-2.5 mr-0.5" />Filed</Badge>;
    case 'pending': return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] px-1.5 py-0"><Clock className="size-2.5 mr-0.5" />Pending</Badge>;
    case 'overdue': return <Badge className="bg-red-50 text-red-700 border-red-200 text-[11px] px-1.5 py-0"><AlertCircle className="size-2.5 mr-0.5" />Overdue</Badge>;
    case 'draft': return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[11px] px-1.5 py-0"><FileText className="size-2.5 mr-0.5" />Draft</Badge>;
    case 'validated': case 'reviewed': case 'generated':
      return <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[11px] px-1.5 py-0"><CheckCircle2 className="size-2.5 mr-0.5" />Ready</Badge>;
    default: return <Badge variant="secondary" className="text-[11px]">{status}</Badge>;
  }
}

function getDocStatusBadge(status: string) {
  switch (status) {
    case 'extracted': case 'reviewed': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] px-1.5 py-0">Processed</Badge>;
    case 'processing': return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] px-1.5 py-0">Processing</Badge>;
    case 'uploading': return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[11px] px-1.5 py-0">Uploading</Badge>;
    case 'failed': return <Badge className="bg-red-50 text-red-700 border-red-200 text-[11px] px-1.5 py-0">Error</Badge>;
    default: return <Badge variant="secondary" className="text-[11px]">{status}</Badge>;
  }
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'document_uploaded': case 'document_processed': return UploadCloud;
    case 'return_prepared': case 'return_reviewed': return FileText;
    case 'return_filed': return FileCheck;
    case 'reconciliation_run': case 'mismatch_resolved': return GitCompareArrows;
    case 'invoice_extracted': case 'invoice_approved': return Activity;
    default: return CircleDot;
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case 'document_uploaded': case 'document_processed': return 'bg-cyan-50 text-cyan-600';
    case 'return_prepared': case 'return_reviewed': return 'bg-emerald-50 text-emerald-600';
    case 'return_filed': return 'bg-emerald-50 text-emerald-600';
    case 'reconciliation_run': case 'mismatch_resolved': return 'bg-teal-50 text-teal-600';
    default: return 'bg-slate-100 text-slate-500';
  }
}

function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(Math.abs(diffMs) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function isOverduePeriod(period: string): boolean {
  try {
    const dueDate = new Date(getFilingDueDate('GSTR-1', period));
    return new Date() > dueDate;
  } catch {
    return false;
  }
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
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color.stroke} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, delay: 0.3, ease: 'easeOut' as const }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold text-lg ${color.text}`}>{score}</span>
        <span className="text-[8px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
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
  const [filingReturnId, setFilingReturnId] = useState<string | null>(null);
  const [reconRunning, setReconRunning] = useState(false);

  // ─── Firestore live hooks ────────────────────────────────────────────
  const { data: client, loading: clientLoading, error: clientError } = useFireClient(selectedClientId);
  const { data: returns, loading: returnsLoading } = useFireReturns(selectedClientId);
  const { data: invoices, loading: invoicesLoading } = useFireInvoices(selectedClientId);
  const { data: documents, loading: docsLoading } = useFireDocuments(selectedClientId);
  const { data: activities, loading: activitiesLoading } = useFireActivities(selectedClientId);

  // ─── Firebase Storage uploads (real) ──────────────────────────────────
  // useDocuments().upload() pushes files to org-isolated Firebase Storage
  // under `documents/{clientId}/...` and writes Firestore metadata linked
  // to the selected client. The Document Vault page reads the same metadata
  // collection, so uploads from here appear there in real time.
  const { upload: uploadToStorage } = useDocuments();

  const isLoading = clientLoading || returnsLoading;

  // ─── Derived data ────────────────────────────────────────────────────
  const pendingReturns = useMemo(
    () => returns.filter(r => r.status !== 'filed'),
    [returns],
  );

  const filteredReturns = useMemo(() => {
    if (returnFilter === 'all') return returns;
    return returns.filter(r => r.returnType === returnFilter);
  }, [returns, returnFilter]);

  const recentInvoices = useMemo(() => invoices.slice(0, 10), [invoices]);

  const totalTaxVolume = useMemo(
    () => returns.reduce((sum, r) => sum + (r.totalTaxableValue ?? 0), 0),
    [returns],
  );

  const healthScore = client?.healthScore ?? 0;
  const healthColor = getHealthColor(healthScore);
  const riskLevel: string =
    healthScore > 80 ? 'Low' : healthScore >= 50 ? 'Medium' : healthScore >= 30 ? 'High' : 'Critical';

  // ─── Handlers ────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    setSelectedClientId(null);
    setCurrentView('clients');
  }, [setSelectedClientId, setCurrentView]);

  const handleOpenReturnPrep = useCallback((returnType: 'GSTR-1' | 'GSTR-3B' = 'GSTR-1') => {
    const resolvedId = client?.id ?? selectedClientId ?? '';
    setReturnPrepCtx({ clientId: resolvedId, returnType, period: '2025-06' });
    setCurrentView('return-prep');
  }, [client?.id, selectedClientId, setReturnPrepCtx, setCurrentView]);

  const handleFileReturn = useCallback(async (returnId: string) => {
    setFilingReturnId(returnId);
    try {
      await fileReturn(returnId);
      toast.success('Return filed successfully', { description: 'Acknowledgment number generated' });
    } catch (err) {
      toast.error('Filing failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setFilingReturnId(null);
    }
  }, []);

  const handleUploadDocument = useCallback(() => {
    // No client selected (or still loading) — bail out. The button is only
    // visible once a client is loaded, but the guard keeps TS happy.
    if (!selectedClientId || !client) {
      toast.error('Select a client before uploading documents');
      return;
    }

    // Build a transient <input type="file"> and trigger a real upload to
    // Firebase Storage on selection. We don't redirect to another page —
    // the upload runs in place and the file appears in the Document Vault.
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx';
    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) return;

      const fileArr = Array.from(files);

      // Pre-flight validation (100 MB limit + supported file types).
      for (const f of fileArr) {
        const err = validateFile(f);
        if (err) {
          toast.error(`${f.name}: ${err}`);
          return;
        }
      }

      toast.info(`Uploading ${fileArr.length} document(s) to Firebase Storage...`);

      const linkedTo = {
        type: 'client' as const,
        id: selectedClientId,
        label: client.tradeName,
      };

      try {
        const results = await Promise.all(
          fileArr.map((f) =>
            uploadToStorage({
              file: f,
              category: 'documents',
              subPath: selectedClientId,
              linkedTo,
            }),
          ),
        );
        const successCount = results.filter(Boolean).length;
        if (successCount > 0) {
          toast.success(`${successCount} document(s) uploaded`);
        } else {
          toast.error('Upload failed — please try again.');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed');
      }
    };
    input.click();
  }, [selectedClientId, client, uploadToStorage]);

  const handleRunReconciliation = useCallback(async () => {
    if (!selectedClientId) return;
    setReconRunning(true);
    try {
      await createReconciliation({
        clientId: selectedClientId,
        period: '2025-06',
        sources: 'GSTR-2B vs Purchase Register',
      });
      toast.success('Reconciliation started', { description: 'Results will appear shortly' });
    } catch (err) {
      toast.error('Reconciliation failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setReconRunning(false);
    }
  }, [selectedClientId]);

  // ─── No client selected ──────────────────────────────────────────────
  if (!selectedClientId) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <Skeleton className="h-6 w-40" />
        <div className="border rounded-xl p-6 space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2 flex-1"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></div>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    );
  }

  // ─── Loading state ──────────────────────────────────────────────────
  if (isLoading && !client) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <Skeleton className="h-6 w-40" />
        <div className="border rounded-xl p-6 space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2 flex-1"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></div>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────
  if (clientError) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 text-center space-y-4">
        <AlertCircle className="size-12 text-red-400 mx-auto" />
        <h2 className="text-lg font-semibold text-foreground">Failed to load client</h2>
        <p className="text-sm text-muted-foreground">{clientError}</p>
        <Button variant="outline" onClick={handleBack}>Go Back</Button>
      </div>
    );
  }

  // ─── Client not found — professional empty state ────────────────────
  if (!client) {
    return (
      <PremiumEmptyState
        icon={<Building2 className="h-8 w-8" />}
        title="Client Not Found"
        description="The client you are looking for does not exist or has been removed. Select another client from your portfolio to continue."
        primaryAction={{
          label: 'Back to Client Portfolio',
          onClick: handleBack,
          icon: <ArrowLeft className="h-4 w-4" />,
        }}
      />
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════

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
          <span className="text-xs text-muted-foreground">{displayText(client.tradeName, 'Client')}</span>
        </div>

        {/* Main header card */}
        <div className="border border-border/60 rounded-xl p-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            {/* Left: Identity + Compliance Profile */}
            <div className="flex items-start gap-4">
              <HealthRing score={healthScore} size={72} strokeWidth={5} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold text-foreground tracking-tight">
                    {displayText(client.tradeName, 'Unnamed Client')}
                  </h1>
                  <Badge className={`gap-1 text-[11px] px-2 py-0.5 ${
                    riskLevel === 'Low' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : riskLevel === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : riskLevel === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    <Shield className="size-2.5" />{riskLevel}
                  </Badge>
                </div>
                {displayText(client.legalName, '') !== '' && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {displayText(client.legalName, '')}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
                  {/* GSTIN — sanitized (synthetic IDs render as em dash) */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="size-3 text-slate-400" />
                    <span className={`font-mono font-medium ${displayGSTIN(client.gstin) === '—' ? 'italic text-muted-foreground/60' : 'text-foreground'}`}>
                      {displayGSTIN(client.gstin)}
                    </span>
                  </div>
                  <Separator orientation="vertical" className="h-3.5" />
                  {/* State — sanitized */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3 text-slate-400" />
                    <span>{displayText(client.state)}</span>
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

                {/* Compliance Profile Summary */}
                {client.complianceProfile && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    <div className="text-xs text-muted-foreground">
                      Filing Compliance: <span className={`font-medium ${client.complianceProfile.filingCompliance >= 80 ? 'text-emerald-600' : client.complianceProfile.filingCompliance >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {displayNumber(client.complianceProfile.filingCompliance, '—')}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Overdue Returns: <span className={`font-medium ${client.complianceProfile.overdueReturns > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {displayNumber(client.complianceProfile.overdueReturns, '—')}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Avg Filing Delay: <span className="font-medium text-foreground">{displayNumber(client.complianceProfile.averageFilingDelay, '—')}d</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleFileReturn(returns.find(r => ['validated', 'reviewed', 'generated'].includes(r.status))?.id ?? '')} disabled={!returns.some(r => ['validated', 'reviewed', 'generated'].includes(r.status)) || !!filingReturnId}>
                <Send className="size-3.5" />
                {filingReturnId ? 'Filing...' : 'File Return'}
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleUploadDocument}>
                <Upload className="size-3.5" />
                Upload Document
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleRunReconciliation} disabled={reconRunning}>
                <GitCompareArrows className="size-3.5" />
                {reconRunning ? 'Running...' : 'Run Reconciliation'}
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleOpenReturnPrep('GSTR-1')}>
                <FileText className="size-3.5" />
                Create Return
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
            { label: 'Pending Returns', value: String(pendingReturns.length), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Invoices', value: String(client.invoiceCount ?? invoices.length), icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50' },
            { label: 'Tax Volume', value: formatCurrency(totalTaxVolume), icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Documents', value: String(client.documentCount ?? documents.length), icon: FolderOpen, color: 'text-slate-600', bg: 'bg-slate-50' },
            { label: 'Total Tax Paid', value: formatCurrency(client.totalTaxPaid ?? 0), icon: IndianRupee, color: 'text-teal-600', bg: 'bg-teal-50' },
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
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Period</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Filed Date</div>
              <div className="col-span-2">ARN</div>
              <div className="col-span-2 text-right">Tax Amount</div>
            </div>
            <div className="divide-y divide-border/40 max-h-96 overflow-y-auto">
              <AnimatePresence>
                {filteredReturns.map((ret, index) => (
                  <motion.div
                    key={ret.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + index * 0.04, duration: 0.3 }}
                    className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-muted/20 transition-colors items-center"
                  >
                    <div className="col-span-2 text-sm font-medium text-foreground">{ret.returnType || '—'}</div>
                    <div className="col-span-2 text-sm text-muted-foreground">{periodToLabel(ret.period)}</div>
                    <div className="col-span-2">{getReturnStatusBadge(ret.status)}</div>
                    <div className="col-span-2 text-xs text-muted-foreground">
                      {ret.filedDate ? new Date(ret.filedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    </div>
                    <div className="col-span-2 text-xs font-mono text-muted-foreground">{ret.acknowledgmentNumber || '—'}</div>
                    <div className="col-span-2 text-sm font-medium text-foreground text-right">{formatCurrency(ret.totalTax ?? 0)}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3: RECENT INVOICES
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Recent Invoices</h2>
          <Button variant="ghost" size="sm" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-7 gap-1" onClick={() => setCurrentView('invoices')}>
            View All <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <FileText className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No invoices yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Invoices will appear after uploading and processing documents</p>
          </div>
        ) : (
          <div className="border border-border/60 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-2">Invoice #</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Match</div>
              <div className="col-span-2">Risk</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>
            <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
              <AnimatePresence>
                {recentInvoices.map((inv, index) => (
                  <motion.div
                    key={inv.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 + index * 0.03, duration: 0.3 }}
                    className="grid grid-cols-12 gap-2 px-4 py-2.5 hover:bg-muted/20 transition-colors items-center"
                  >
                    <div className="col-span-2 text-xs font-medium text-foreground truncate">{inv.invoiceNumber || '—'}</div>
                    <div className="col-span-2 text-xs text-muted-foreground">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</div>
                    <div className="col-span-2 text-xs text-muted-foreground">{inv.invoiceType || '—'}</div>
                    <div className="col-span-2">
                      <Badge variant="outline" className={`text-[11px] px-1.5 py-0 ${
                        inv.matchStatus === 'matched' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : inv.matchStatus === 'mismatch' ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {inv.matchStatus || '—'}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <Badge variant="outline" className={`text-[11px] px-1.5 py-0 ${
                        inv.riskLevel === 'low' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : inv.riskLevel === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : inv.riskLevel === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {inv.riskLevel || '—'}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-xs font-medium text-foreground text-right">{formatCurrency(inv.totalAmount ?? 0)}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TWO-COLUMN: DOCUMENTS + ACTIVITY TIMELINE
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* SECTION 4: UPLOADED DOCUMENTS */}
        <motion.section initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Documents</h2>
            <Button variant="ghost" size="sm" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-7 gap-1" onClick={() => setCurrentView('invoices')}>
              View All <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {documents.length === 0 ? (
            <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <UploadCloud className="size-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No documents uploaded yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Upload sales registers, purchase data, or GST portal exports</p>
              <Button size="sm" className="mt-4 h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleUploadDocument}>
                <Upload className="size-3.5" />
                Upload Document
              </Button>
            </div>
          ) : (
            <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden max-h-80 overflow-y-auto">
              {documents.slice(0, 8).map((doc, index) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + index * 0.04, duration: 0.3 }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-100 shrink-0">
                    <FileText className="size-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" title={doc.fileName}>{displayText(doc.fileName, 'Untitled document')}</p>
                    <p className="text-xs text-muted-foreground">{doc.documentType || 'document'} &middot; {doc.createdAt ? formatRelativeTime(doc.createdAt as string) : '—'}</p>
                  </div>
                  <div className="shrink-0">{getDocStatusBadge(doc.status)}</div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        {/* SECTION 5: ACTIVITY TIMELINE */}
        <motion.section initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Activity className="size-3.5 text-slate-500" />
              Activity Timeline
            </h2>
          </div>

          {activities.length === 0 ? (
            <div className="border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <Inbox className="size-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No activity recorded yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Activities will appear as you work with this client</p>
            </div>
          ) : (
            <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden max-h-80 overflow-y-auto">
              {activities.slice(0, 15).map((event, index) => {
                const IconComp = getActivityIcon(event.type);
                const iconColor = getActivityColor(event.type);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.03, duration: 0.3 }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className={`flex items-center justify-center h-7 w-7 rounded-lg shrink-0 ${iconColor}`}>
                      <IconComp className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{displayText(event.title, 'Activity')}</p>
                      {event.description && (
                        <p className="text-xs text-muted-foreground truncate">{displayText(event.description, '')}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(event.createdAt as string)}</span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>
      </div>

    </div>
  );
}
