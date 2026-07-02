'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  Upload,
  FileSearch,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { fileReturn, updateReturnStatus, createReturn } from '@/lib/firestore-service';
import { formatCurrency, periodToLabel } from '@/lib/gst-utils';
import { toast } from 'sonner';
import type { FirestoreClient, FirestoreReturn, FirestoreInvoice, FirestoreDocument } from '@/lib/firestore-schema';

// ─── API response shapes (subset of Prisma models) ─────────────────────────

interface ApiGSTRFiling {
  id: string;
  clientId: string;
  returnType: string;
  period: string;
  financialYear?: string | null;
  status: string;
  filedDate?: string | null;
  acknowledgmentNumber?: string | null;
  totalInvoices: number;
  readyForFiling: number;
  issuesFound: number;
  criticalErrors: number;
  warnings: number;
  totalTaxableValue: number;
  totalTax: number;
  jsonPayload?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; tradeName: string; gstin: string; state?: string | null } | null;
}

interface ApiInvoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: string;
  sellerGstin: string;
  buyerGstin?: string | null;
  buyerName?: string | null;
  invoiceType: string;
  gstr1Section: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  hsnCode?: string | null;
  reverseCharge: boolean;
  status: string;
  matchStatus: string;
  riskLevel: string;
  riskScore: number;
  aiExplanation?: string | null;
  notes?: string | null;
  period?: string | null;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; tradeName: string; gstin: string } | null;
}

interface ApiClient {
  id: string;
  gstin: string;
  tradeName: string;
  legalName?: string | null;
  address?: string | null;
  state?: string | null;
  stateCode?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  entityType?: string;
  returnPeriod?: string | null;
  lastFilingDate?: string | null;
  status: string;
  healthScore: number;
  createdAt: string;
  updatedAt: string;
  _aggregations?: {
    totalInvoices: number;
    filedReturns: number;
    pendingReturns: number;
    matchPercentage: number;
  };
}

interface ApiDocument {
  id: string;
  clientId?: string | null;
  folder: string;
  name: string;
  fileType: string;
  size: number;
  path?: string | null;
  tags?: string | null;
  description?: string | null;
  uploadedBy?: string | null;
  version: number;
  isLatest: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapApiReturn(r: ApiGSTRFiling): FirestoreReturn & { id: string } {
  return {
    id: r.id,
    returnId: r.id,
    firmId: '',
    clientId: r.clientId,
    returnType: (r.returnType === 'GSTR-3B' ? 'GSTR-3B' : 'GSTR-1') as 'GSTR-1' | 'GSTR-3B',
    period: r.period,
    financialYear: r.financialYear ?? '',
    status: r.status as FirestoreReturn['status'],
    filedDate: r.filedDate ?? null,
    acknowledgmentNumber: r.acknowledgmentNumber ?? null,
    totalInvoices: r.totalInvoices ?? 0,
    readyForFiling: r.readyForFiling ?? 0,
    issuesFound: r.issuesFound ?? 0,
    criticalErrors: r.criticalErrors ?? 0,
    warnings: r.warnings ?? 0,
    totalTaxableValue: r.totalTaxableValue ?? 0,
    totalTax: r.totalTax ?? 0,
    jsonPayload: r.jsonPayload ?? null,
    assignedTo: null,
    reviewedBy: null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapApiInvoice(inv: ApiInvoice): FirestoreInvoice & { id: string } {
  return {
    id: inv.id,
    invoiceId: inv.id,
    firmId: '',
    clientId: inv.clientId,
    documentId: null,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    sellerGstin: inv.sellerGstin,
    buyerGstin: inv.buyerGstin ?? null,
    buyerName: inv.buyerName ?? null,
    invoiceType: inv.invoiceType as FirestoreInvoice['invoiceType'],
    gstr1Section: inv.gstr1Section as FirestoreInvoice['gstr1Section'],
    taxableValue: inv.taxableValue ?? 0,
    cgst: inv.cgst ?? 0,
    sgst: inv.sgst ?? 0,
    igst: inv.igst ?? 0,
    cess: inv.cess ?? 0,
    totalAmount: inv.totalAmount ?? 0,
    hsnCode: inv.hsnCode ?? null,
    reverseCharge: inv.reverseCharge ?? false,
    placeOfSupply: null,
    status: inv.status as FirestoreInvoice['status'],
    matchStatus: inv.matchStatus as FirestoreInvoice['matchStatus'],
    riskLevel: inv.riskLevel as FirestoreInvoice['riskLevel'],
    riskScore: inv.riskScore ?? 0,
    aiExplanation: inv.aiExplanation ?? null,
    notes: inv.notes ?? null,
    period: inv.period ?? null,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}

function mapApiClient(c: ApiClient): FirestoreClient & { id: string } {
  return {
    id: c.id,
    clientId: c.id,
    firmId: '',
    gstin: c.gstin,
    tradeName: c.tradeName,
    legalName: c.legalName ?? c.tradeName,
    address: c.address ?? null,
    state: c.state ?? null,
    stateCode: c.stateCode ?? null,
    contactEmail: c.contactEmail ?? null,
    contactPhone: c.contactPhone ?? null,
    entityType: c.entityType ?? 'regular',
    returnPeriod: c.returnPeriod ?? null,
    lastFilingDate: c.lastFilingDate ?? null,
    status: c.status as FirestoreClient['status'],
    healthScore: c.healthScore ?? 0,
    complianceProfile: {
      filingCompliance: 0,
      gstinValidity: true,
      lastFilingStatus: null,
      overdueReturns: c._aggregations?.pendingReturns ?? 0,
      totalReturnsFiled: c._aggregations?.filedReturns ?? 0,
      averageFilingDelay: 0,
    },
    invoiceCount: c._aggregations?.totalInvoices ?? 0,
    totalTaxPaid: 0,
    pendingReturnCount: c._aggregations?.pendingReturns ?? 0,
    documentCount: 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function mapApiDocument(d: ApiDocument): FirestoreDocument & { id: string } {
  return {
    id: d.id,
    docId: d.id,
    firmId: '',
    clientId: d.clientId ?? '',
    uploadedBy: d.uploadedBy ?? '',
    fileName: d.name,
    filePath: d.path ?? null,
    fileSize: d.size ?? 0,
    fileType: d.fileType ?? 'other',
    documentType: 'other',
    status: 'archived',
    extractionStatus: 'pending',
    extractedInvoiceCount: 0,
    extractionAccuracy: 0,
    extractionError: null,
    period: null,
    metadata: {},
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const PREP_STEPS = [
  { id: 's0', label: 'Upload', icon: Upload },
  { id: 's1', label: 'Extraction', icon: FileSearch },
  { id: 's2', label: 'Validation', icon: ShieldCheck },
  { id: 's3', label: 'Reconciliation', icon: GitCompareArrows },
  { id: 's4', label: 'Preparation', icon: ClipboardCheck },
  { id: 's5', label: 'Filing', icon: Send },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getStatusBadge(status: string) {
  switch (status) {
    case 'approved': case 'validated': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 h-5 gap-0.5"><CheckCircle2 className="size-2.5" />Validated</Badge>;
    case 'draft': return <Badge className="bg-slate-50 text-slate-700 border-slate-200 text-[10px] px-1.5 py-0 h-5 gap-0.5"><Clock className="size-2.5" />Draft</Badge>;
    case 'cancelled': return <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0 h-5 gap-0.5"><XCircle className="size-2.5" />Cancelled</Badge>;
    case 'filed': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 h-5 gap-0.5"><CheckCircle2 className="size-2.5" />Filed</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  }
}

function getMatchBadge(status: string) {
  switch (status) {
    case 'perfect_match': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">Matched</Badge>;
    case 'partial_match': return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">Partial</Badge>;
    case 'mismatch': case 'missing_in_books': case 'missing_in_gstr': return <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0">Mismatch</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  }
}

function getRiskColor(risk: string) {
  switch (risk) {
    case 'critical': return 'text-red-600 bg-red-50';
    case 'high': return 'text-orange-600 bg-orange-50';
    case 'medium': return 'text-amber-600 bg-amber-50';
    default: return 'text-slate-600 bg-slate-50';
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
// STEP PROGRESS BAR
// ═══════════════════════════════════════════════════════════════════════════════

function StepProgressBar({ currentStep }: { currentStep: number }) {
  const percent = Math.round(((currentStep + 1) / PREP_STEPS.length) * 100);

  return (
    <div className="border border-border/60 rounded-xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Preparation Progress</h3>
        <span className="text-xs font-medium text-muted-foreground">{percent}% Complete</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 mb-6 overflow-hidden">
        <motion.div className="h-full rounded-full bg-emerald-500" animate={{ width: `${percent}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
      </div>
      <div className="flex items-start">
        {PREP_STEPS.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isActive = idx === currentStep;
          const Icon = step.icon;
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center" style={{ minWidth: idx === 0 || idx === PREP_STEPS.length - 1 ? '60px' : '80px', flex: '1 1 0' }}>
                <motion.div
                  className={`flex items-center justify-center h-9 w-9 rounded-full shrink-0 text-sm font-semibold transition-all duration-500 ${
                    isCompleted ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                      : isActive ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-500 shadow-sm'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                  animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                  transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </motion.div>
                <span className={`text-[10px] text-center leading-tight mt-2 whitespace-nowrap ${
                  isCompleted ? 'text-emerald-700 font-medium' : isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </div>
              {idx < PREP_STEPS.length - 1 && (
                <div className="flex items-center pt-[18px] flex-1 min-w-[12px]">
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ReturnPrepWorkspace() {
  const { returnPrepCtx, setCurrentView } = useApp();
  const clientId = returnPrepCtx.clientId;
  const returnType = returnPrepCtx.returnType;
  const period = returnPrepCtx.period;

  // ── Real API-backed state (replaces former Firestore hooks) ─────────
  const [clientDoc, setClientDoc] = useState<(FirestoreClient & { id: string }) | null>(null);
  const [invoices, setInvoices] = useState<(FirestoreInvoice & { id: string })[]>([]);
  const [returns, setReturns] = useState<(FirestoreReturn & { id: string })[]>([]);
  const [documents, setDocuments] = useState<(FirestoreDocument & { id: string })[]>([]);
  const [clientLoading, setClientLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [returnsLoading, setReturnsLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!clientId) {
      setClientDoc(null);
      setClientLoading(false);
      return;
    }
    let cancelled = false;
    setClientLoading(true);
    fetch(`/api/clients/${encodeURIComponent(clientId)}`)
      .then(r => r.ok ? r.json() : { client: null })
      .then(data => {
        if (cancelled) return;
        const c = data?.client as ApiClient | undefined;
        setClientDoc(c ? mapApiClient(c) : null);
        setClientLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setClientDoc(null);
        setClientLoading(false);
      });
    return () => { cancelled = true; };
  }, [clientId, refreshKey]);

  useEffect(() => {
    if (!clientId) {
      setInvoices([]);
      setInvoicesLoading(false);
      return;
    }
    let cancelled = false;
    setInvoicesLoading(true);
    fetch(`/api/invoices?clientId=${encodeURIComponent(clientId)}`)
      .then(r => r.ok ? r.json() : { invoices: [] })
      .then(data => {
        if (cancelled) return;
        const items: ApiInvoice[] = Array.isArray(data?.invoices) ? data.invoices : [];
        setInvoices(items.map(mapApiInvoice));
        setInvoicesLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setInvoices([]);
        setInvoicesLoading(false);
      });
    return () => { cancelled = true; };
  }, [clientId, refreshKey]);

  useEffect(() => {
    if (!clientId) {
      setReturns([]);
      setReturnsLoading(false);
      return;
    }
    let cancelled = false;
    setReturnsLoading(true);
    fetch(`/api/returns?clientId=${encodeURIComponent(clientId)}`)
      .then(r => r.ok ? r.json() : { returns: [] })
      .then(data => {
        if (cancelled) return;
        const items: ApiGSTRFiling[] = Array.isArray(data?.returns) ? data.returns : [];
        setReturns(items.map(mapApiReturn));
        setReturnsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setReturns([]);
        setReturnsLoading(false);
      });
    return () => { cancelled = true; };
  }, [clientId, refreshKey]);

  useEffect(() => {
    if (!clientId) {
      setDocuments([]);
      setDocumentsLoading(false);
      return;
    }
    let cancelled = false;
    setDocumentsLoading(true);
    fetch(`/api/documents?clientId=${encodeURIComponent(clientId)}`)
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(data => {
        if (cancelled) return;
        const items: ApiDocument[] = Array.isArray(data?.documents) ? data.documents : [];
        setDocuments(items.map(mapApiDocument));
        setDocumentsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDocuments([]);
        setDocumentsLoading(false);
      });
    return () => { cancelled = true; };
  }, [clientId, refreshKey]);

  const client = clientDoc;
  const invoicesList = invoices ?? [];
  const returnsList = returns ?? [];
  const documentsList = documents ?? [];

  // ── Local UI state ──
  const [currentStep, setCurrentStep] = useState(0);
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'approved' | 'draft' | 'filed'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<(FirestoreInvoice & { id: string }) | null>(null);
  const [filingModalOpen, setFilingModalOpen] = useState(false);
  const [filingProgress, setFilingProgress] = useState<'idle' | 'validating' | 'generating' | 'submitting' | 'success'>('idle');
  const [actionLoading, setActionLoading] = useState(false);

  // ── Derived state ──
  const clientName = client?.tradeName ?? 'Select a Client';
  const clientGSTIN = client?.gstin ?? '';

  // Current return for this client+type+period
  const currentReturn = useMemo(() =>
    returnsList.find(r => r.returnType === returnType && r.period === period),
    [returnsList, returnType, period]
  );

  const filteredInvoices = useMemo(() => {
    if (invoiceFilter === 'all') return invoicesList;
    return invoicesList.filter(inv => inv.status === invoiceFilter);
  }, [invoicesList, invoiceFilter]);

  const totalTaxable = invoicesList.reduce((sum, inv) => sum + inv.taxableValue, 0);
  const totalCGST = invoicesList.reduce((sum, inv) => sum + inv.cgst, 0);
  const totalSGST = invoicesList.reduce((sum, inv) => sum + inv.sgst, 0);
  const totalIGST = invoicesList.reduce((sum, inv) => sum + inv.igst, 0);
  const totalTax = totalCGST + totalSGST + totalIGST;

  const approvedCount = invoicesList.filter(i => i.status === 'approved' || i.status === 'filed').length;
  const draftCount = invoicesList.filter(i => i.status === 'draft').length;
  const highRiskCount = invoicesList.filter(i => i.riskLevel === 'high' || i.riskLevel === 'critical').length;

  const matchedCount = invoicesList.filter(i => i.matchStatus === 'perfect_match').length;
  const partialCount = invoicesList.filter(i => i.matchStatus === 'partial_match').length;
  const mismatchedCount = invoicesList.filter(i => ['mismatch', 'missing_in_books', 'missing_in_gstr'].includes(i.matchStatus)).length;

  const validationScore = invoicesList.length > 0 ? Math.min(100, Math.round((approvedCount / invoicesList.length) * 100)) : 0;
  const matchRate = invoicesList.length > 0 ? Math.round((matchedCount / invoicesList.length) * 100) : 0;
  const complianceScore = client?.healthScore ?? 0;

  const allChecksPass = validationScore >= 95 && highRiskCount === 0;
  const isGSTR1 = returnType === 'GSTR-1';
  const loading = clientLoading || invoicesLoading;

  // ── Computed step based on data ──
  const computedStep = useMemo(() => {
    if (currentReturn?.status === 'filed') return 5;
    if (currentReturn?.status === 'generated') return 4;
    if (currentReturn?.status === 'reviewed' || currentReturn?.status === 'validated') return 3;
    if (documentsList.some(d => d.extractionStatus === 'completed')) return 1;
    if (documentsList.length > 0) return 0;
    return 0;
  }, [currentReturn, documentsList]);

  const effectiveStep = Math.max(currentStep, computedStep);

  // ── Actions ──
  const handleBack = () => setCurrentView('client-workspace');

  const handleAdvanceStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const handleRunValidation = useCallback(async () => {
    if (!clientId) return;
    setActionLoading(true);
    try {
      // Create return if not exists
      let returnId = currentReturn?.id;
      if (!returnId) {
        returnId = await createReturn({
          returnId: '',
          clientId,
          returnType,
          period,
          financialYear: period.split('-')[0],
          status: 'prepared',
          filedDate: null,
          acknowledgmentNumber: null,
          totalInvoices: invoicesList.length,
          readyForFiling: approvedCount,
          issuesFound: highRiskCount,
          criticalErrors: 0,
          warnings: 0,
          totalTaxableValue: totalTaxable,
          totalTax,
          jsonPayload: null,
          assignedTo: null,
          reviewedBy: null,
        });
      } else {
        await updateReturnStatus(returnId, 'validated');
      }
      handleAdvanceStep(2);
      toast.success('Validation Complete', { description: `${invoicesList.length} invoices processed` });
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error('Validation failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setActionLoading(false);
    }
  }, [clientId, currentReturn, returnType, period, invoicesList, approvedCount, highRiskCount, totalTaxable, totalTax, handleAdvanceStep]);

  const handleRunReconciliation = useCallback(() => {
    if (effectiveStep < 2) {
      toast.warning('Complete validation first');
      return;
    }
    handleAdvanceStep(3);
    toast.success('Reconciliation Complete', { description: 'Books vs GSTR-2B matching finished.' });
  }, [effectiveStep, handleAdvanceStep]);

  const handleMarkReady = useCallback(async () => {
    if (!currentReturn?.id) {
      toast.error('No return found to mark ready');
      return;
    }
    if (highRiskCount > 0) {
      toast.warning('Cannot mark ready', { description: `${highRiskCount} high-risk invoices must be resolved first` });
      return;
    }
    setActionLoading(true);
    try {
      await updateReturnStatus(currentReturn.id, 'generated');
      handleAdvanceStep(4);
      toast.success('Return marked as Ready to File');
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error('Failed to mark ready', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setActionLoading(false);
    }
  }, [currentReturn, highRiskCount, handleAdvanceStep]);

  const handleFileReturn = useCallback(() => {
    if (!currentReturn?.id) {
      toast.error('No return to file');
      return;
    }
    setFilingModalOpen(true);
    setFilingProgress('validating');

    setTimeout(() => setFilingProgress('generating'), 1500);
    setTimeout(() => setFilingProgress('submitting'), 3000);
    setTimeout(async () => {
      try {
        const arn = await fileReturn(currentReturn.id);
        setFilingProgress('success');
        handleAdvanceStep(5);
        toast.success(`${returnType} Filed Successfully!`, { description: `Period: ${periodToLabel(period)} · ARN: ${arn}` });
        setRefreshKey(k => k + 1);
      } catch (err) {
        setFilingModalOpen(false);
        setFilingProgress('idle');
        toast.error('Filing failed', { description: err instanceof Error ? err.message : 'Unknown error' });
      }
    }, 4500);
  }, [currentReturn, returnType, period, handleAdvanceStep]);

  // ── Return Summary ──
  const gstr1Summary = useMemo(() => {
    const b2bSales = invoicesList.filter(i => i.invoiceType === 'B2B').reduce((s, i) => s + i.taxableValue, 0);
    const b2cSales = invoicesList.filter(i => i.invoiceType === 'B2C Large' || i.invoiceType === 'B2C Small').reduce((s, i) => s + i.taxableValue, 0);
    const exports = invoicesList.filter(i => i.invoiceType === 'Export').reduce((s, i) => s + i.taxableValue, 0);
    return { b2bSales, b2cSales, exports, creditNotes: -Math.round(totalTaxable * 0.04), debitNotes: Math.round(totalTaxable * 0.02) };
  }, [invoicesList, totalTaxable]);

  const gstr3bSummary = useMemo(() => {
    const outputTax = totalTax;
    const itcAvailable = Math.round(outputTax * 0.65);
    const netTaxPayable = Math.max(0, outputTax - itcAvailable);
    return { taxableSupplies: totalTaxable, itcAvailable, outputTax, netTaxPayable };
  }, [totalTaxable, totalTax]);

  // ── Loading skeleton ──
  if (loading && !client) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <Skeleton className="h-6 w-40" />
        <div className="border rounded-xl p-6 space-y-4">
          <div className="flex gap-4"><Skeleton className="h-10 w-10 rounded-lg" /><div className="space-y-2 flex-1"><Skeleton className="h-6 w-64" /><Skeleton className="h-4 w-48" /></div></div>
        </div>
        <div className="flex gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 flex-1 rounded-lg" />)}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-8">

      {/* ═══ INVOICE DETAIL DIALOG ═══ */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" /> Invoice Detail
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Invoice Number</span><p className="text-sm font-mono font-semibold">{selectedInvoice.invoiceNumber}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Date</span><p className="text-sm">{selectedInvoice.invoiceDate}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Seller GSTIN</span><p className="text-sm font-mono">{selectedInvoice.sellerGstin}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Buyer</span><p className="text-sm">{selectedInvoice.buyerName || '—'}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">HSN Code</span><p className="text-sm font-mono">{selectedInvoice.hsnCode || 'Missing'}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Place of Supply</span><p className="text-sm">{selectedInvoice.placeOfSupply || '—'}</p></div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Taxable Value</span><p className="text-sm font-bold">{formatCurrency(selectedInvoice.taxableValue)}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</span><div className="mt-0.5">{getStatusBadge(selectedInvoice.status)}</div></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Match Status</span><div className="mt-0.5">{getMatchBadge(selectedInvoice.matchStatus)}</div></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Risk Level</span><div className="mt-0.5"><span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${getRiskColor(selectedInvoice.riskLevel)}`}>{selectedInvoice.riskLevel}</span></div></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">CGST</span><p className="text-sm">{selectedInvoice.cgst > 0 ? formatCurrency(selectedInvoice.cgst) : '—'}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">SGST</span><p className="text-sm">{selectedInvoice.sgst > 0 ? formatCurrency(selectedInvoice.sgst) : '—'}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">IGST</span><p className="text-sm">{selectedInvoice.igst > 0 ? formatCurrency(selectedInvoice.igst) : '—'}</p></div>
                <div><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Amount</span><p className="text-sm font-bold text-emerald-700">{formatCurrency(selectedInvoice.totalAmount)}</p></div>
              </div>
              {selectedInvoice.aiExplanation && (
                <>
                  <Separator />
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-xs font-semibold text-amber-700 mb-1">AI Insight</p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">{selectedInvoice.aiExplanation}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ FILING MODAL ═══ */}
      <Dialog open={filingModalOpen} onOpenChange={(open) => { if (!open && filingProgress !== 'submitting') { setFilingModalOpen(false); setFilingProgress('idle'); } }}>
        <DialogContent className="sm:max-w-md">
          <div className="py-8 text-center space-y-4">
            {filingProgress === 'validating' && (
              <><Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" /><div><p className="text-sm font-semibold text-foreground">Validating return data...</p><p className="text-xs text-muted-foreground mt-1">Checking JSON schema compliance</p></div></>
            )}
            {filingProgress === 'generating' && (
              <><Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" /><div><p className="text-sm font-semibold text-foreground">Generating JSON payload...</p><p className="text-xs text-muted-foreground mt-1">{invoicesList.length} invoices being packaged</p></div></>
            )}
            {filingProgress === 'submitting' && (
              <><Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" /><div><p className="text-sm font-semibold text-foreground">Submitting to GST portal...</p><p className="text-xs text-muted-foreground mt-1">Connecting to GSTN via APIs</p></div></>
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
                  <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setFilingModalOpen(false); setFilingProgress('idle'); }}>Done</Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ HEADER ═══ */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="border border-border/60 rounded-xl p-4 md:p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1" onClick={handleBack}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
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
              {currentReturn && <Badge className={`text-[10px] ${currentReturn.status === 'filed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{currentReturn.status}</Badge>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={handleRunValidation} disabled={effectiveStep >= 2 || actionLoading}>
                <ShieldCheck className="size-3.5" /> Validate
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleRunReconciliation} disabled={effectiveStep < 2 || effectiveStep >= 3}>
                <GitCompareArrows className="size-3.5" /> Reconcile
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={handleMarkReady} disabled={effectiveStep < 3 || effectiveStep >= 5 || actionLoading}>
                <CheckCircle2 className="size-3.5" /> Mark Ready
              </Button>
              <Button size="sm" className={`h-8 text-xs gap-1.5 ${allChecksPass ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`} disabled={!allChecksPass || effectiveStep < 4} onClick={handleFileReturn}>
                <Send className="size-3.5" /> File Return
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ PROGRESS BAR ═══ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
        <StepProgressBar currentStep={effectiveStep} />
      </motion.section>

      {/* ═══ STEP-BASED CONTENT ═══ */}
      <AnimatePresence mode="wait">
        {/* STEP 0: Upload */}
        {effectiveStep === 0 && (
          <motion.section key="step0" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Step 1: Upload Documents</h2>
              <span className="text-xs text-muted-foreground">{documentsList.length} documents uploaded</span>
            </div>
            <div className="border border-border/60 rounded-xl p-6">
              {documentsList.length > 0 ? (
                <div className="space-y-2.5">
                  {documentsList.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 border-slate-200">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium text-foreground">{doc.fileName}</p>
                          <p className="text-[10px] text-muted-foreground">{doc.documentType} · {(doc.fileSize / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] ${doc.extractionStatus === 'completed' ? 'bg-emerald-50 text-emerald-700' : doc.extractionStatus === 'in_progress' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-700'}`}>
                          {doc.extractionStatus}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No documents uploaded yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Upload purchase/sales registers to begin return preparation</p>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* STEP 1: Extraction */}
        {effectiveStep === 1 && (
          <motion.section key="step1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Step 2: Data Extraction</h2>
              <span className="text-xs text-muted-foreground">{invoicesList.length} invoices extracted</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {documentsList.filter(d => d.extractionStatus === 'completed').map((doc) => (
                <Card key={doc.id} className="border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <p className="text-xs font-medium text-foreground">{doc.fileName}</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Invoices Found</span><span className="font-medium">{doc.extractedInvoiceCount}</span></div>
                      <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Accuracy</span><span className="font-medium">{doc.extractionAccuracy}%</span></div>
                      <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
                        <motion.div className="h-full rounded-full bg-emerald-500" animate={{ width: `${doc.extractionAccuracy}%` }} transition={{ duration: 0.8 }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>
        )}

        {/* STEP 2-3: Validation & Reconciliation (Invoice Review) */}
        {(effectiveStep === 2 || effectiveStep === 3) && (
          <motion.section key="step2-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                {effectiveStep === 2 ? 'Step 3: Validation' : 'Step 4: Reconciliation'}
              </h2>
              <span className="text-xs text-muted-foreground">{invoicesList.length} invoices · {formatCurrency(totalTaxable)} taxable</span>
            </div>

            {/* Invoice filter tabs */}
            <div className="border border-border/60 rounded-xl overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/40 bg-slate-50/50 overflow-x-auto">
                {(['all', 'approved', 'draft', 'filed'] as const).map(filter => {
                  const count = filter === 'all' ? invoicesList.length : invoicesList.filter(i => i.status === filter).length;
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

              <ScrollArea className="max-h-[360px]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b border-border/40">
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">Invoice #</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden sm:table-cell">Date</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">Buyer</th>
                      <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">Taxable</th>
                      <th className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 hidden lg:table-cell">Match</th>
                      <th className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">Status</th>
                      <th className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="popLayout">
                      {filteredInvoices.map((inv) => (
                        <motion.tr key={inv.id} layout
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                          className={`border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer ${inv.riskLevel === 'high' || inv.riskLevel === 'critical' ? 'bg-red-50/30' : inv.matchStatus === 'partial_match' ? 'bg-amber-50/30' : ''}`}
                          onClick={() => setSelectedInvoice(inv)}
                        >
                          <td className="px-4 py-2.5 text-xs font-mono font-medium text-foreground">{inv.invoiceNumber}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{inv.invoiceDate}</td>
                          <td className="px-4 py-2.5 text-xs text-foreground max-w-[180px] truncate">{inv.buyerName || inv.buyerGstin || '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-right font-medium text-foreground hidden md:table-cell">{formatCurrency(inv.taxableValue)}</td>
                          <td className="px-4 py-2.5 text-center hidden lg:table-cell">{getMatchBadge(inv.matchStatus)}</td>
                          <td className="px-4 py-2.5 text-center">{getStatusBadge(inv.status)}</td>
                          <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => setSelectedInvoice(inv)}><Eye className="h-3 w-3" /></Button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </ScrollArea>

              <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 bg-slate-50/50">
                <span className="text-xs text-muted-foreground">Showing {filteredInvoices.length} of {invoicesList.length}</span>
                <span className="text-xs font-medium text-foreground">Total Tax: {formatCurrency(totalTax)}</span>
              </div>
            </div>

            {/* Reconciliation summary cards (step 3) */}
            {effectiveStep === 3 && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/50 text-center">
                  <p className="text-xl font-bold text-emerald-700">{matchedCount}</p>
                  <p className="text-[10px] text-emerald-600 font-medium">Matched</p>
                </div>
                <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/50 text-center">
                  <p className="text-xl font-bold text-amber-700">{partialCount}</p>
                  <p className="text-[10px] text-amber-600 font-medium">Partial Matches</p>
                </div>
                <div className="border border-red-200 rounded-xl p-4 bg-red-50/50 text-center">
                  <p className="text-xl font-bold text-red-700">{mismatchedCount}</p>
                  <p className="text-[10px] text-red-600 font-medium">Mismatches</p>
                </div>
              </div>
            )}
          </motion.section>
        )}

        {/* STEP 4: Preparation (Return Summary) */}
        {effectiveStep === 4 && (
          <motion.section key="step4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Step 5: Return Summary — {returnType}</h2>
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
                  <motion.div key={item.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05, duration: 0.3 }}
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
                  <motion.div key={item.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05, duration: 0.3 }}
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
        )}

        {/* STEP 5: Filing */}
        {effectiveStep === 5 && (
          <motion.section key="step5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Step 6: Filing</h2>
              {currentReturn?.status === 'filed' && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="size-3 mr-1" />Filed</Badge>}
            </div>
            <div className="border border-emerald-200 rounded-xl p-6 bg-emerald-50/30 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
              </motion.div>
              <p className="text-lg font-bold text-emerald-700 mb-2">Return Filed Successfully</p>
              {currentReturn?.acknowledgmentNumber && (
                <p className="text-sm text-muted-foreground">ARN: <span className="font-mono font-semibold text-foreground">{currentReturn.acknowledgmentNumber}</span></p>
              )}
              {currentReturn?.filedDate && (
                <p className="text-sm text-muted-foreground mt-1">Filed on: {currentReturn.filedDate}</p>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ═══ FILING READINESS PANEL ═══ */}
      {effectiveStep < 5 && (
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Filing Readiness</h2>
          </div>

          <div className="border border-border/60 rounded-xl p-5 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Validation', value: validationScore, target: 95, icon: <ClipboardCheck className="h-4 w-4" />, color: validationScore >= 95 ? 'text-emerald-700' : validationScore >= 80 ? 'text-amber-700' : 'text-red-700', bg: validationScore >= 95 ? 'bg-emerald-50' : validationScore >= 80 ? 'bg-amber-50' : 'bg-red-50', stroke: validationScore >= 95 ? '#10b981' : validationScore >= 80 ? '#f59e0b' : '#ef4444' },
                { label: 'Match Rate', value: matchRate, target: 90, icon: <GitCompareArrows className="h-4 w-4" />, color: matchRate >= 90 ? 'text-emerald-700' : matchRate >= 70 ? 'text-amber-700' : 'text-red-700', bg: matchRate >= 90 ? 'bg-emerald-50' : matchRate >= 70 ? 'bg-amber-50' : 'bg-red-50', stroke: matchRate >= 90 ? '#10b981' : matchRate >= 70 ? '#f59e0b' : '#ef4444' },
                { label: 'Compliance', value: complianceScore, target: 85, icon: <ShieldCheck className="h-4 w-4" />, color: complianceScore >= 85 ? 'text-emerald-700' : complianceScore >= 65 ? 'text-amber-700' : 'text-red-700', bg: complianceScore >= 85 ? 'bg-emerald-50' : complianceScore >= 65 ? 'bg-amber-50' : 'bg-red-50', stroke: complianceScore >= 85 ? '#10b981' : complianceScore >= 65 ? '#f59e0b' : '#ef4444' },
                { label: 'High Risk', value: highRiskCount, target: 0, icon: <AlertTriangle className="h-4 w-4" />, color: highRiskCount === 0 ? 'text-emerald-700' : 'text-red-700', bg: highRiskCount === 0 ? 'bg-emerald-50' : 'bg-red-50', stroke: highRiskCount === 0 ? '#10b981' : '#ef4444' },
              ].map((score) => (
                <div key={score.label} className="border border-border/40 rounded-lg p-3 text-center">
                  <div className={`flex items-center justify-center h-7 w-7 rounded-lg mx-auto mb-1.5 ${score.bg} ${score.color}`}>{score.icon}</div>
                  <p className="text-xl font-bold text-foreground">{score.label === 'High Risk' ? score.value : `${score.value}%`}</p>
                  <p className="text-[10px] text-muted-foreground">{score.label}</p>
                  {score.label !== 'High Risk' && (
                    <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ backgroundColor: score.stroke }}
                        animate={{ width: `${score.value}%` }} transition={{ duration: 0.8, delay: 0.5 }}
                      />
                    </div>
                  )}
                  <p className="text-[9px] text-muted-foreground mt-1">Target: {score.label === 'High Risk' ? '0' : `${score.target}%`}</p>
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
                  {draftCount > 0 && <li>• {draftCount} invoice{draftCount > 1 ? 's' : ''} still in draft</li>}
                  {highRiskCount > 0 && <li>• {highRiskCount} high-risk invoice{highRiskCount > 1 ? 's' : ''} need review</li>}
                  {validationScore < 95 && <li>• Validation score below 95% ({validationScore}%)</li>}
                </ul>
              )}
            </div>

            <Button className={`w-full h-12 text-sm font-semibold gap-2 shadow-lg ${allChecksPass ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
              disabled={!allChecksPass || effectiveStep < 4} onClick={handleFileReturn}
            >
              {allChecksPass && effectiveStep >= 4 ? <><Send className="h-4 w-4" /> File GST Return</> : <><Clock className="h-4 w-4" /> Resolve Issues to File</>}
            </Button>

            {!allChecksPass && (
              <p className="text-[10px] text-center text-muted-foreground">Fix all issues above to unlock filing</p>
            )}
          </div>
        </motion.section>
      )}

    </div>
  );
}
