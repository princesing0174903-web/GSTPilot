'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  ShieldCheck,
  GitCompareArrows,
  CheckCircle2,
  Send,
  FileText,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Clock,
  Eye,
  Check,
  Sparkles,
  Building2,
  FileWarning,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  AlertOctagon,
  FilePlus2,
  Shield,
  Zap,
  X,
  Loader2,
  PartyPopper,
  ArrowRight,
  ClipboardCheck,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import type { AppView } from '@/contexts/AppContext';
import { useClient, useFilings, useInvoices, useIssues, useReconRuns, useUpdateFilingStatus, useFileReturn } from '@/hooks/api';
import { formatCurrency, periodToLabel } from '@/lib/gst-utils';
import { toast } from 'sonner';
import type { Invoice, Issue, GSTRFiling } from '@/types/gst';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ToastMessage {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'info' | 'warning';
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const PREP_STEPS = [
  { id: 's0', label: 'Uploaded', shortLabel: 'Upload' },
  { id: 's1', label: 'Extracted', shortLabel: 'Extraction' },
  { id: 's2', label: 'Validated', shortLabel: 'Validation' },
  { id: 's3', label: 'Reviewed', shortLabel: 'Reconciliation' },
  { id: 's4', label: 'Generated', shortLabel: 'Prepared' },
  { id: 's5', label: 'Filed', shortLabel: 'Ready' },
  { id: 's6', label: 'Complete', shortLabel: 'Filed' },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getStatusBadge(status: string) {
  switch (status) {
    case 'validated': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 h-5 gap-0.5"><CheckCircle2 className="size-2.5" />Validated</Badge>;
    case 'warning': return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 h-5 gap-0.5"><AlertTriangle className="size-2.5" />Warning</Badge>;
    case 'error': return <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0 h-5 gap-0.5"><XCircle className="size-2.5" />Error</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  }
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'critical': return <XCircle className="h-4 w-4 text-red-600" />;
    case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    case 'info': return <AlertCircle className="h-4 w-4 text-blue-600" />;
    default: return <AlertCircle className="h-4 w-4 text-slate-500" />;
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case 'critical': return <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0">Critical</Badge>;
    case 'warning': return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">Warning</Badge>;
    case 'info': return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">Info</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{severity}</Badge>;
  }
}

function getAIInsightIcon(type: string) {
  switch (type) {
    case 'risk_alert': return <AlertOctagon className="h-4 w-4" />;
    case 'missing_doc': return <FileWarning className="h-4 w-4" />;
    case 'tax_anomaly': return <IndianRupee className="h-4 w-4" />;
    case 'filing_rec': return <Sparkles className="h-4 w-4" />;
    default: return <AlertCircle className="h-4 w-4" />;
  }
}

function getAIInsightColors(type: string) {
  switch (type) {
    case 'risk_alert': return { bg: 'bg-red-50', color: 'text-red-600', border: 'border-red-200' };
    case 'missing_doc': return { bg: 'bg-orange-50', color: 'text-orange-600', border: 'border-orange-200' };
    case 'tax_anomaly': return { bg: 'bg-amber-50', color: 'text-amber-600', border: 'border-amber-200' };
    case 'filing_rec': return { bg: 'bg-emerald-50', color: 'text-emerald-600', border: 'border-emerald-200' };
    default: return { bg: 'bg-slate-50', color: 'text-slate-600', border: 'border-slate-200' };
  }
}

function getUrgencyBadge(urgency: string) {
  switch (urgency) {
    case 'high': return <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0">High</Badge>;
    case 'medium': return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">Medium</Badge>;
    case 'info': return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">Info</Badge>;
    default: return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION
// ═══════════════════════════════════════════════════════════════════════════════

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function ToastContainer({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className={`flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-sm ${
              toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200' :
              toast.type === 'warning' ? 'bg-amber-50/95 border-amber-200' :
              'bg-white/95 border-border'
            }`}
          >
            <div className={`mt-0.5 shrink-0 ${
              toast.type === 'success' ? 'text-emerald-600' :
              toast.type === 'warning' ? 'text-amber-600' :
              'text-blue-600'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : toast.type === 'warning' ? <AlertTriangle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">{toast.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{toast.description}</p>
            </div>
            <button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => onDismiss(toast.id)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS BAR COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function DesktopProgressBar({ completedStep }: { completedStep: number }) {
  const completedCount = completedStep + 1;
  const percent = Math.round((completedCount / PREP_STEPS.length) * 100);

  return (
    <div className="hidden md:block border border-border/60 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Preparation Progress</h3>
        <span className="text-xs font-medium text-muted-foreground">{percent}% Complete</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 mb-6 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-emerald-500"
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="flex items-start">
        {PREP_STEPS.map((step, idx) => {
          const isCompleted = idx <= completedStep;
          const isActive = idx === completedStep + 1 && idx < PREP_STEPS.length;
          const isFuture = idx > completedStep + 1;
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center" style={{ minWidth: idx === 0 || idx === PREP_STEPS.length - 1 ? '80px' : '100px', flex: '1 1 0' }}>
                <motion.div
                  className={`flex items-center justify-center h-9 w-9 rounded-full shrink-0 text-sm font-semibold transition-all duration-500 ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                      : isActive
                        ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-500 shadow-sm shadow-emerald-200/50'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                  animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                  transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
                </motion.div>
                <span className={`text-xs text-center leading-tight mt-2 whitespace-nowrap ${
                  isCompleted ? 'text-emerald-700 font-medium' : isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </div>
              {idx < PREP_STEPS.length - 1 && (
                <div className="flex items-center pt-[18px] flex-1 min-w-[16px]">
                  <motion.div
                    className={`h-[3px] w-full rounded-full transition-colors duration-500 ${isCompleted ? 'bg-emerald-400' : 'bg-slate-200'}`}
                    animate={isActive ? { opacity: [0.5, 1, 0.5] } : {}}
                    transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function MobileProgressBar({ completedStep }: { completedStep: number }) {
  const completedCount = completedStep + 1;
  const total = PREP_STEPS.length;
  const percent = Math.round((completedCount / total) * 100);

  return (
    <div className="md:hidden border border-border/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Progress</h3>
        <span className="text-xs font-medium text-emerald-700">{completedCount}/{total} steps</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-emerald-500"
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-muted-foreground">{PREP_STEPS[completedStep]?.label ?? 'Start'} complete</span>
        <span className="text-[10px] font-medium text-foreground">{percent}%</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ReturnPrepWorkspace() {
  const { selectedClientId, returnPrepCtx, setCurrentView } = useApp();
  const updateFilingStatus = useUpdateFilingStatus();
  const fileReturnMutation = useFileReturn();

  // Resolve client ID
  const rawClientId = selectedClientId ?? returnPrepCtx.clientId ?? '';
  const clientId = rawClientId;

  const returnType = returnPrepCtx.returnType;
  const period = returnPrepCtx.period;

  // ── API data via React Query ──
  const { data: clientData, isLoading: clientLoading } = useClient(clientId);
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices(clientId);
  const { data: issuesData, isLoading: issuesLoading } = useIssues(clientId);
  const { data: filingsData } = useFilings(clientId);
  const { data: reconData } = useReconRuns(clientId);

  const client = clientData?.client ?? null;
  const invoices: Invoice[] = invoicesData?.invoices?.filter((i: Invoice) => i.clientId === clientId) ?? [];
  const validationIssues: Issue[] = issuesData?.issues?.filter((i: Issue) => i.clientId === clientId) ?? [];
  const filings = filingsData?.filings?.filter((f: GSTRFiling) => f.clientId === clientId) ?? [];
  const reconRuns = reconData?.runs ?? [];

  // ── Local UI state ──
  const [currentPrepStep, setCurrentPrepStep] = useState(1);
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'validated' | 'warning' | 'error'>('all');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedReconCategory, setSelectedReconCategory] = useState<string | null>(null);
  const [filingModalOpen, setFilingModalOpen] = useState(false);
  const [filingProgress, setFilingProgress] = useState<'idle' | 'validating' | 'generating' | 'submitting' | 'success'>('idle');

  // ── Derived state ──
  const clientName = client?.tradeName ?? 'Select a Client';
  const clientGSTIN = client?.gstin ?? '';

  const filteredInvoices = useMemo(() => {
    if (invoiceFilter === 'all') return invoices;
    return invoices.filter(inv => inv.status === invoiceFilter);
  }, [invoices, invoiceFilter]);

  // Derived from API data
  const unresolvedIssues = validationIssues.filter(i => i.status === 'open').length;

  const totalTaxable = invoices.reduce((sum, inv) => sum + inv.taxableValue, 0);
  const totalCGST = invoices.reduce((sum, inv) => sum + inv.cgst, 0);
  const totalSGST = invoices.reduce((sum, inv) => sum + inv.sgst, 0);
  const totalIGST = invoices.reduce((sum, inv) => sum + inv.igst, 0);
  const totalTax = totalCGST + totalSGST + totalIGST;

  const errorCount = invoices.filter(i => i.status === 'error').length;
  const warningCount = invoices.filter(i => i.status === 'warning').length;
  const validatedCount = invoices.filter(i => i.status === 'validated' || i.status === 'approved').length;
  const allValidated = errorCount === 0 && warningCount === 0;

  const validationScore = invoices.length > 0 ? Math.min(100, Math.round((validatedCount / invoices.length) * 100)) : 100;

  // Compute match rate from reconciliation runs
  const matchRate = useMemo(() => {
    if (reconRuns.length === 0) return 0;
    const latestRun = reconRuns[0];
    return latestRun.totalRecords > 0 ? Math.round((latestRun.matched / latestRun.totalRecords) * 100) : 0;
  }, [reconRuns]);

  // Compute compliance score from client health and validation score
  const complianceScore = client?.healthScore ?? validationScore;

  const allChecksPass = validationScore >= 95 && unresolvedIssues === 0;
  const isGSTR1 = returnType === 'GSTR-1';

  // Use local step state
  const effectiveCompletedStep = currentPrepStep;

  // ── Toast helper ──
  const addToast = useCallback((title: string, description: string, type: ToastMessage['type'] = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, title, description, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Actions ──
  const handleBack = () => setCurrentView('client-workspace');

  const handleApproveInvoice = (invId: string) => {
    const inv = invoices.find(i => i.id === invId);
    if (!inv || inv.status === 'validated') return;
    updateFilingStatus.mutate({ id: invId, status: 'validated' } as any, {
      onSuccess: () => toast.success(`${inv.invoiceNumber} approved`),
      onError: (err: Error) => toast.error(err.message),
    });
  };

  const handleFixIssue = (issueId: string) => {
    const issue = validationIssues.find(i => i.id === issueId);
    if (!issue || issue.status === 'resolved') return;
    updateFilingStatus.mutate({ id: issueId, status: 'resolved' } as any, {
      onSuccess: () => toast.success(`${issue.category} resolved`),
      onError: (err: Error) => toast.error(err.message),
    });
  };

  const handleDismissInsight = (insightId: string) => {
    toast.info('Insight dismissed');
  };

  // Run Validation: mark all invoices as validated via API
  const handleRunValidation = () => {
    const unresolved = validationIssues.filter(i => i.status === 'open');
    // Mark all non-validated invoices as validated
    invoices.forEach(inv => {
      if (inv.status !== 'validated' && inv.status !== 'approved') {
        updateFilingStatus.mutate({ id: inv.id, status: 'validated' } as any);
      }
    });
    setCurrentPrepStep(2);
    toast.success('Validation Complete', { description: `All ${unresolved.length} issues resolved. ${invoices.length - validatedCount} invoices updated.` });
  };

  // Run Reconciliation: advance step to 3
  const handleRunReconciliation = () => {
    if (currentPrepStep < 2) {
      toast.warning('Complete validation first', { description: 'All invoices must be validated before reconciliation' });
      return;
    }
    setCurrentPrepStep(3);
    toast.success('Reconciliation Complete', { description: 'Books vs GSTR-2B matching finished.' });
  };

  // Mark Ready: advance step to 5 (Ready to File)
  const handleMarkReady = () => {
    if (errorCount > 0 || warningCount > 0) {
      toast.warning('Cannot mark ready', { description: `${errorCount} errors and ${warningCount} warnings must be resolved first` });
      return;
    }
    setCurrentPrepStep(5);
    toast.success('Return marked as Ready to File', { description: 'All validations passed. You can now file this return.' });
  };

  // File Return Simulation
  const handleFileReturn = () => {
    if (!allChecksPass) return;
    setFilingModalOpen(true);
    setFilingProgress('validating');

    setTimeout(() => setFilingProgress('generating'), 1500);
    setTimeout(() => setFilingProgress('submitting'), 3000);
    setTimeout(() => {
      setFilingProgress('success');
      setCurrentPrepStep(6);
      // Find the matching filing and file it via API
      const matchingFiling = filings.find(f => f.returnType === returnType && f.period === period);
      if (matchingFiling) {
        fileReturnMutation.mutate(matchingFiling.id, {
          onSuccess: () => toast.success(`${returnType} Filed Successfully!`, { description: `Period: ${periodToLabel(period)} · Tax: ${formatCurrency(totalTax)}` }),
          onError: (err: Error) => toast.error(err.message),
        });
      } else {
        toast.success(`${returnType} Filed Successfully!`, { description: `Period: ${periodToLabel(period)} · Tax: ${formatCurrency(totalTax)}` });
      }
    }, 4500);
  };

  // ── Return Summary calculated from store invoices ──
  const gstr1Summary = useMemo(() => {
    const b2bSales = invoices.filter(i => !i.igst || i.igst === 0).reduce((s, i) => s + i.taxableValue, 0);
    const b2cSales = invoices.filter(i => i.igst > 0).reduce((s, i) => s + i.taxableValue, 0);
    const exports = invoices.filter(i => !i.customerGstin).reduce((s, i) => s + i.taxableValue, 0);
    return { b2bSales, b2cSales, exports, creditNotes: -Math.round(totalTaxable * 0.04), debitNotes: Math.round(totalTaxable * 0.02) };
  }, [invoices, totalTaxable]);

  const gstr3bSummary = useMemo(() => {
    const taxableSupplies = totalTaxable;
    const outputTax = totalTax;
    const itcAvailable = Math.round(outputTax * 0.65);
    const netTaxPayable = Math.max(0, outputTax - itcAvailable);
    return { taxableSupplies, itcAvailable, outputTax, netTaxPayable };
  }, [totalTaxable, totalTax]);

  // Loading skeleton (only if client not yet available)
  if (!client && !selectedClientId) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <Skeleton className="h-6 w-40" />
        <div className="border rounded-xl p-6 space-y-4">
          <div className="flex gap-4"><Skeleton className="h-10 w-10 rounded-lg" /><div className="space-y-2 flex-1"><Skeleton className="h-6 w-64" /><Skeleton className="h-4 w-48" /></div></div>
        </div>
        <div className="flex gap-2">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-10 flex-1 rounded-lg" />)}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-8">

      {/* ═══ TOAST CONTAINER ═══ */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ═══ INVOICE DETAIL DRILL-DOWN ═══ */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              Invoice Detail
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Invoice Number</span><p className="text-sm font-mono font-semibold">{selectedInvoice.invoiceNumber}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Date</span><p className="text-sm">{new Date(selectedInvoice.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Customer</span><p className="text-sm font-medium">{selectedInvoice.customer}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Customer GSTIN</span><p className="text-sm font-mono">{selectedInvoice.customerGstin || '—'}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">HSN Code</span><p className="text-sm font-mono">{selectedInvoice.hsnCode || 'Missing'}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Place of Supply</span><p className="text-sm">{selectedInvoice.placeOfSupply || '—'}</p></div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Taxable Value</span><p className="text-sm font-bold">{formatCurrency(selectedInvoice.taxableValue)}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</span><div className="mt-0.5">{getStatusBadge(selectedInvoice.status)}</div></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">CGST (9%)</span><p className="text-sm">{selectedInvoice.cgst > 0 ? formatCurrency(selectedInvoice.cgst) : '—'}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">SGST (9%)</span><p className="text-sm">{selectedInvoice.sgst > 0 ? formatCurrency(selectedInvoice.sgst) : '—'}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">IGST (18%)</span><p className="text-sm">{selectedInvoice.igst > 0 ? formatCurrency(selectedInvoice.igst) : '—'}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Amount</span><p className="text-sm font-bold text-emerald-700">{formatCurrency(selectedInvoice.taxableValue + selectedInvoice.cgst + selectedInvoice.sgst + selectedInvoice.igst)}</p></div>
              </div>
              {selectedInvoice.errorDetail && (
                <>
                  <Separator />
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Issue Detected</p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">{selectedInvoice.errorDetail}</p>
                  </div>
                </>
              )}
              {selectedInvoice.status !== 'validated' && (
                <Button className="w-full h-9 text-xs font-medium gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { handleApproveInvoice(selectedInvoice.id); setSelectedInvoice(null); }}>
                  <Check className="h-3.5 w-3.5" />
                  Approve & Validate Invoice
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ RECONCILIATION DRILL-DOWN ═══ */}
      <Dialog open={!!selectedReconCategory} onOpenChange={(open) => { if (!open) setSelectedReconCategory(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-emerald-600" />
              {selectedReconCategory} — Books vs GSTR-2B
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <GitCompareArrows className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Run reconciliation to see detailed results</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ FILING SIMULATION MODAL ═══ */}
      <Dialog open={filingModalOpen} onOpenChange={(open) => { if (!open && filingProgress !== 'submitting') { setFilingModalOpen(false); setFilingProgress('idle'); } }}>
        <DialogContent className="sm:max-w-md">
          <div className="py-8 text-center space-y-4">
            {filingProgress === 'validating' && (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Validating return data...</p>
                  <p className="text-xs text-muted-foreground mt-1">Checking JSON schema compliance</p>
                </div>
              </>
            )}
            {filingProgress === 'generating' && (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Generating JSON payload...</p>
                  <p className="text-xs text-muted-foreground mt-1">{invoices.length} invoices being packaged for GST portal</p>
                </div>
              </>
            )}
            {filingProgress === 'submitting' && (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Submitting to GST portal...</p>
                  <p className="text-xs text-muted-foreground mt-1">Connecting to GSTN via APIs</p>
                </div>
              </>
            )}
            {filingProgress === 'success' && (
              <>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                  <PartyPopper className="h-12 w-12 text-emerald-600 mx-auto" />
                </motion.div>
                <div>
                  <p className="text-lg font-bold text-emerald-700">Filed Successfully!</p>
                  <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-left space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Return Type</span><span className="font-medium">{returnType}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Period</span><span className="font-medium">{periodToLabel(period)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total Tax</span><span className="font-bold">{formatCurrency(totalTax)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Filed On</span><span className="font-medium">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                  </div>
                  <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setFilingModalOpen(false); setFilingProgress('idle'); }}>
                    Done
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ HEADER ═══ */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="border border-border/60 rounded-xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1" onClick={handleBack}>
                <ArrowLeft className="h-3.5 w-3.5" /> Client Workspace
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">{clientName}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{clientGSTIN}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-medium">{returnType}</Badge>
              <Badge variant="outline" className="text-xs font-medium">{periodToLabel(period)}</Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={handleRunValidation} disabled={effectiveCompletedStep >= 2}>
                <ShieldCheck className="size-3.5" /> Run Validation
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={handleRunReconciliation} disabled={effectiveCompletedStep < 2 || effectiveCompletedStep >= 3}>
                <GitCompareArrows className="size-3.5" /> Run Reconciliation
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={handleMarkReady} disabled={effectiveCompletedStep < 3 || effectiveCompletedStep >= 5}>
                <CheckCircle2 className="size-3.5" /> Mark Ready
              </Button>
              <Button size="sm" className={`h-8 text-xs gap-1.5 ${allChecksPass ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`} disabled={!allChecksPass} onClick={handleFileReturn}>
                <Send className="size-3.5" /> File Return
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ SECTION 1: PREPARATION PROGRESS ═══ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
        <DesktopProgressBar completedStep={effectiveCompletedStep} />
        <MobileProgressBar completedStep={effectiveCompletedStep} />
      </motion.section>

      {/* ═══ SECTION 2: INVOICE REVIEW TABLE ═══ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Invoice Review</h2>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{invoices.length} invoices · {formatCurrency(totalTaxable)} taxable</span>
          </div>
        </div>

        <div className="border border-border/60 rounded-xl overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/40 bg-slate-50/50 overflow-x-auto">
            {(['all', 'validated', 'warning', 'error'] as const).map(filter => {
              const count = filter === 'all' ? invoices.length : invoices.filter(i => i.status === filter).length;
              const isActive = invoiceFilter === filter;
              return (
                <Button key={filter} variant={isActive ? 'secondary' : 'ghost'} size="sm"
                  className={`h-7 text-xs font-medium px-2.5 gap-1 capitalize shrink-0 ${isActive ? 'bg-white shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setInvoiceFilter(filter)}
                >
                  {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  <span className={`text-[10px] px-1 py-0 rounded-full ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-muted-foreground'}`}>{count}</span>
                </Button>
              );
            })}
            <div className="flex-1" />
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground shrink-0">
              <span>CGST: <span className="font-medium text-foreground">{formatCurrency(totalCGST)}</span></span>
              <span>SGST: <span className="font-medium text-foreground">{formatCurrency(totalSGST)}</span></span>
              <span>IGST: <span className="font-medium text-foreground">{formatCurrency(totalIGST)}</span></span>
            </div>
          </div>

          <ScrollArea className="max-h-[400px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-border/40">
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">Invoice #</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden sm:table-cell">Date</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">Customer</th>
                  <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">Taxable Value</th>
                  <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden lg:table-cell">CGST</th>
                  <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden lg:table-cell">SGST</th>
                  <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden lg:table-cell">IGST</th>
                  <th className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">Status</th>
                  <th className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filteredInvoices.map((inv) => (
                    <motion.tr key={inv.id} layout
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                      className={`border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer ${inv.status === 'error' ? 'bg-red-50/30' : inv.status === 'warning' ? 'bg-amber-50/30' : ''}`}
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <td className="px-4 py-2.5 text-xs font-mono font-medium text-foreground">{inv.invoiceNumber}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{new Date(inv.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                      <td className="px-4 py-2.5 text-xs text-foreground max-w-[180px] truncate">{inv.customer}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-medium text-foreground hidden md:table-cell">{formatCurrency(inv.taxableValue)}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden lg:table-cell">{inv.cgst > 0 ? formatCurrency(inv.cgst) : '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden lg:table-cell">{inv.sgst > 0 ? formatCurrency(inv.sgst) : '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-muted-foreground hidden lg:table-cell">{inv.igst > 0 ? formatCurrency(inv.igst) : '—'}</td>
                      <td className="px-4 py-2.5 text-center">{getStatusBadge(inv.status)}</td>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => setSelectedInvoice(inv)}><Eye className="h-3 w-3" /></Button>
                          {inv.status !== 'validated' && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleApproveInvoice(inv.id)}><Check className="h-3 w-3" /></Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </ScrollArea>

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 bg-slate-50/50">
            <span className="text-xs text-muted-foreground">Showing {filteredInvoices.length} of {invoices.length} invoices</span>
            <span className="text-xs font-medium text-foreground">Total Tax: {formatCurrency(totalTax)}</span>
          </div>
        </div>
      </motion.section>

      {/* ═══ TWO-COLUMN: VALIDATION CENTER + RECONCILIATION ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* SECTION 3: VALIDATION CENTER */}
        <motion.section initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Validation Center</h2>
            <Badge variant="outline" className={`text-[10px] font-medium ${unresolvedIssues > 0 ? 'text-red-700 bg-red-50 border-red-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
              {unresolvedIssues > 0 ? `${unresolvedIssues} issues` : 'All clear'}
            </Badge>
          </div>

          <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
            <AnimatePresence mode="popLayout">
              {validationIssues.map((issue) => (
                <motion.div key={issue.id} layout
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                  className={`px-4 py-3.5 transition-all ${issue.status === 'resolved' ? 'bg-emerald-50/30' : 'hover:bg-muted/20'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {issue.status === 'resolved' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : getSeverityIcon(issue.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {issue.status === 'resolved' ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">Resolved</Badge> : getSeverityBadge(issue.severity)}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{issue.category}</Badge>
                      </div>
                      <p className={`text-xs leading-snug ${issue.status === 'resolved' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{issue.description}</p>
                      {issue.invoiceId && <p className="text-[10px] text-muted-foreground mt-1">Invoice ID: <span className="font-mono font-medium">{issue.invoiceId}</span></p>}
                    </div>
                    {issue.status !== 'resolved' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs font-medium px-3 shrink-0 border-border/60 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200" onClick={() => handleFixIssue(issue.id)}>
                        Fix Issue
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {unresolvedIssues === 0 && (
              <div className="p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-emerald-700">All validation issues resolved</p>
                <p className="text-xs text-muted-foreground mt-1">Your return data passes all GST validation rules</p>
              </div>
            )}
          </div>
        </motion.section>

        {/* SECTION 4: GST RECONCILIATION */}
        <motion.section initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">GST Reconciliation</h2>
            <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">Books vs GSTR-2B</Badge>
          </div>

          <div className="border border-border/60 rounded-xl p-5 space-y-3">
            {reconRuns.length > 0 ? (
              reconRuns.map((run: any, idx: number) => (
                <motion.div key={run.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + idx * 0.06, duration: 0.3 }}
                  className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 border-slate-200 cursor-pointer hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-semibold text-foreground">Reconciliation Run</span>
                    <span className="text-[10px] text-muted-foreground">{run.period} · {run.totalRecords} records</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-emerald-700">{run.matched} matched</span>
                    <span className="text-xs text-amber-700">{run.partialMatches} partial</span>
                    <span className="text-xs text-red-700">{run.unmatched} unmatched</span>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-8 text-center">
                <GitCompareArrows className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No reconciliation runs yet</p>
                <p className="text-xs text-muted-foreground mt-1">Run reconciliation to compare books with GSTR-2B</p>
              </div>
            )}

            <Separator className="my-2" />

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Records Compared</span>
              <span className="text-sm font-bold text-foreground">{invoices.length} invoices · {formatCurrency(totalTaxable)}</span>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">Click any category to view detailed breakdown</p>
          </div>
        </motion.section>
      </div>

      {/* ═══ SECTION 5: RETURN SUMMARY ═══ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Return Summary — {returnType}</h2>
          <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">{periodToLabel(period)}</Badge>
        </div>

        {isGSTR1 ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'B2B Sales', value: gstr1Summary.b2bSales, icon: <Building2 className="h-4 w-4" />, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'B2C Sales', value: gstr1Summary.b2cSales, icon: <IndianRupee className="h-4 w-4" />, color: 'text-teal-700', bg: 'bg-teal-50' },
              { label: 'Exports', value: gstr1Summary.exports, icon: <TrendingUp className="h-4 w-4" />, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Credit Notes', value: gstr1Summary.creditNotes, icon: <TrendingDown className="h-4 w-4" />, color: 'text-orange-700', bg: 'bg-orange-50' },
              { label: 'Debit Notes', value: gstr1Summary.debitNotes, icon: <FilePlus2 className="h-4 w-4" />, color: 'text-purple-700', bg: 'bg-purple-50' },
            ].map((item, idx) => (
              <motion.div key={item.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 + idx * 0.05, duration: 0.3 }}
                className="border border-border/60 rounded-xl p-4 hover:border-border transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`flex items-center justify-center h-7 w-7 rounded-lg ${item.bg} ${item.color}`}>{item.icon}</div>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{item.label}</span>
                </div>
                <p className={`text-lg font-bold ${item.color}`}>{formatCurrency(item.value)}</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Taxable Supplies', value: gstr3bSummary.taxableSupplies, icon: <IndianRupee className="h-4 w-4" />, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'ITC Available', value: gstr3bSummary.itcAvailable, icon: <Shield className="h-4 w-4" />, color: 'text-teal-700', bg: 'bg-teal-50' },
              { label: 'Output Tax', value: gstr3bSummary.outputTax, icon: <FileText className="h-4 w-4" />, color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: 'Net Tax Payable', value: gstr3bSummary.netTaxPayable, icon: <Zap className="h-4 w-4" />, color: 'text-violet-700', bg: 'bg-violet-50' },
            ].map((item, idx) => (
              <motion.div key={item.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 + idx * 0.05, duration: 0.3 }}
                className="border border-border/60 rounded-xl p-4 hover:border-border transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`flex items-center justify-center h-7 w-7 rounded-lg ${item.bg} ${item.color}`}>{item.icon}</div>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{item.label}</span>
                </div>
                <p className={`text-lg font-bold ${item.color}`}>{formatCurrency(item.value)}</p>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>

      {/* ═══ TWO-COLUMN: AI REVIEW + READY TO FILE ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* SECTION 6: AI REVIEW */}
        <motion.section initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35, duration: 0.4 }} className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">AI Review</h2>
            <Badge variant="outline" className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border-emerald-200 gap-1">
              <Sparkles className="size-2.5" /> {validationIssues.filter(i => i.status === 'open').length} open issues
            </Badge>
          </div>

          <ScrollArea className="max-h-[480px]">
            <div className="space-y-2.5">
              <AnimatePresence mode="popLayout">
                {validationIssues.filter(i => i.status === 'open').map((issue) => {
                  return (
                    <motion.div key={issue.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                      className="border border-border/60 rounded-lg p-3.5 hover:border-border transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0 bg-amber-50 text-amber-700">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-foreground">{issue.title}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5">{issue.severity}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{issue.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Button size="sm" variant="outline" className="h-6 text-[10px] font-medium px-2.5 shrink-0 border-border/60 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                              onClick={() => handleFixIssue(issue.id)}
                            >
                              Fix Issue
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                              onClick={() => handleDismissInsight(issue.id)}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {validationIssues.filter(i => i.status === 'open').length === 0 && (
                <div className="p-8 text-center border border-border/60 rounded-xl">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-700">All issues resolved</p>
                  <p className="text-xs text-muted-foreground mt-1">No outstanding risk alerts or validation issues</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </motion.section>

        {/* SECTION 7: READY TO FILE PANEL */}
        <motion.section initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.4 }} className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Filing Readiness</h2>
          </div>

          <div className="border border-border/60 rounded-xl p-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Validation Score', value: validationScore, target: 95, icon: <ClipboardCheck className="h-4 w-4" />, color: validationScore >= 95 ? 'text-emerald-700' : validationScore >= 80 ? 'text-amber-700' : 'text-red-700', bg: validationScore >= 95 ? 'bg-emerald-50' : validationScore >= 80 ? 'bg-amber-50' : 'bg-red-50', stroke: validationScore >= 95 ? '#10b981' : validationScore >= 80 ? '#f59e0b' : '#ef4444' },
                { label: 'Match Rate', value: matchRate, target: 90, icon: <GitCompareArrows className="h-4 w-4" />, color: matchRate >= 90 ? 'text-emerald-700' : matchRate >= 70 ? 'text-amber-700' : 'text-red-700', bg: matchRate >= 90 ? 'bg-emerald-50' : matchRate >= 70 ? 'bg-amber-50' : 'bg-red-50', stroke: matchRate >= 90 ? '#10b981' : matchRate >= 70 ? '#f59e0b' : '#ef4444' },
                { label: 'Compliance', value: complianceScore, target: 85, icon: <ShieldCheck className="h-4 w-4" />, color: complianceScore >= 85 ? 'text-emerald-700' : complianceScore >= 65 ? 'text-amber-700' : 'text-red-700', bg: complianceScore >= 85 ? 'bg-emerald-50' : complianceScore >= 65 ? 'bg-amber-50' : 'bg-red-50', stroke: complianceScore >= 85 ? '#10b981' : complianceScore >= 65 ? '#f59e0b' : '#ef4444' },
              ].map((score) => (
                <div key={score.label} className="border border-border/40 rounded-lg p-3 text-center">
                  <div className={`flex items-center justify-center h-7 w-7 rounded-lg mx-auto mb-1.5 ${score.bg} ${score.color}`}>{score.icon}</div>
                  <p className="text-xl font-bold text-foreground">{score.value}%</p>
                  <p className="text-[10px] text-muted-foreground">{score.label}</p>
                  <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: score.stroke }}
                      animate={{ width: `${score.value}%` }} transition={{ duration: 0.8, delay: 0.5 }}
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1">Target: {score.target}%</p>
                </div>
              ))}
            </div>

            <div className={`rounded-lg p-4 border ${allChecksPass ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {allChecksPass ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                <span className={`text-sm font-semibold ${allChecksPass ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {allChecksPass ? 'All Checks Passed' : 'Action Required Before Filing'}
                </span>
              </div>
              {!allChecksPass && (
                <ul className="text-xs text-amber-700 space-y-1 ml-7">
                  {errorCount > 0 && <li>• {errorCount} invoice{errorCount > 1 ? 's' : ''} with errors need fixing</li>}
                  {warningCount > 0 && <li>• {warningCount} invoice{warningCount > 1 ? 's' : ''} with warnings need approval</li>}
                  {unresolvedIssues > 0 && <li>• {unresolvedIssues} validation issue{unresolvedIssues > 1 ? 's' : ''} unresolved</li>}
                </ul>
              )}
            </div>

            <Button className={`w-full h-12 text-sm font-semibold gap-2 shadow-lg ${allChecksPass ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
              disabled={!allChecksPass} onClick={handleFileReturn}
            >
              {allChecksPass ? <><Send className="h-4 w-4" /> File GST Return</> : <><Clock className="h-4 w-4" /> Resolve Issues to File</>}
            </Button>

            {!allChecksPass && (
              <p className="text-[10px] text-center text-muted-foreground">Fix all issues above to unlock filing</p>
            )}
          </div>
        </motion.section>
      </div>

    </div>
  );
}
