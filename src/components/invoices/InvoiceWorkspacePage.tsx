'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Badge,
} from '@/components/ui/badge';
import {
  Button,
} from '@/components/ui/button';
import {
  Input,
} from '@/components/ui/input';
import {
  Skeleton,
} from '@/components/ui/skeleton';
import {
  ScrollArea,
} from '@/components/ui/scroll-area';
import {
  Progress,
} from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  CloudUpload,
  FileJson,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Edit3,
  ShieldCheck,
  ChevronDown,
  FileUp,
  Bot,
  X,
  Upload,
  AlertCircle,
  Sparkles,
  FileCheck2,
  Clock,
  Eye,
  ThumbsUp,
} from 'lucide-react';
import type {
  Invoice,
  Client,
  GSTR1Section,
} from '@/types/gst';
import {
  GSTR1_SECTION_LABELS,
} from '@/types/gst';
import {
  formatCurrency,
  formatNumber,
} from '@/lib/gst-utils';
import { useApp } from '@/contexts/AppContext';
import { useGSTStore } from '@/stores/gst-store';

// ─── Local Types ──────────────────────────────────────────────────────────────

interface ProcessingFile {
  id: string;
  name: string;
  size: number;
  format: string;
  progress: number;
  status: 'uploading' | 'extracting' | 'validating' | 'complete' | 'error';
  invoiceCount: number;
  ocrConfidence: number;
  errorMsg?: string;
}

type ValidationStatus = 'validated' | 'warning' | 'error';

interface ExtractedInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  invoiceDate: string;
  section: GSTR1Section;
  sectionLabel: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
  validationStatus: ValidationStatus;
  ocrConfidence: number;
  missingFields: string[];
  validationMessages: string[];
}

interface ValidationIssueItem {
  id: string;
  severity: 'critical' | 'warning';
  description: string;
  invoiceNumber: string;
  invoiceId: string;
}

// ─── Mock Data removed — all data comes from GST store now ───

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const pulseGlow = {
  pulse: {
    boxShadow: [
      '0 0 0 0 rgba(16, 185, 129, 0)',
      '0 0 0 8px rgba(16, 185, 129, 0.15)',
      '0 0 0 0 rgba(16, 185, 129, 0)',
    ],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 95) return 'text-emerald-600';
  if (confidence >= 80) return 'text-amber-600';
  return 'text-red-600';
}

function getConfidenceBarColor(confidence: number): string {
  if (confidence >= 95) return 'bg-emerald-500';
  if (confidence >= 80) return 'bg-amber-500';
  return 'bg-red-500';
}

function getSectionBadgeStyle(section: string): string {
  const styles: Record<string, string> = {
    b2b: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    b2cl: 'bg-teal-50 text-teal-700 border-teal-200',
    b2cs: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    exp: 'bg-amber-50 text-amber-700 border-amber-200',
    cdnr: 'bg-orange-50 text-orange-700 border-orange-200',
    cdnur: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return styles[section] || 'bg-slate-50 text-slate-700 border-slate-200';
}

function getValidationIcon(status: ValidationStatus) {
  switch (status) {
    case 'validated':
      return <CheckCircle2 className="size-4 text-emerald-500" />;
    case 'warning':
      return <AlertTriangle className="size-4 text-amber-500" />;
    case 'error':
      return <XCircle className="size-4 text-red-500" />;
  }
}

function getValidationBadge(status: ValidationStatus): string {
  switch (status) {
    case 'validated':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'warning':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'error':
      return 'bg-red-50 text-red-700 border-red-200';
  }
}

function getValidationLabel(status: ValidationStatus): string {
  switch (status) {
    case 'validated':
      return 'Validated';
    case 'warning':
      return 'Warning';
    case 'error':
      return 'Error';
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceWorkspacePage() {
  const { selectedClientId, setSelectedClientId } = useApp();
  const store = useGSTStore();

  // ── Clients from store ──
  const clients = store.clients;

  // ── Upload State ──
  const [isDragging, setIsDragging] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<ProcessingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Invoices from store ──
  // Get all invoices across clients (or filtered by selectedClientId)
  const storeInvoices = useMemo(() => {
    if (selectedClientId) {
      return store.getInvoicesForClient(selectedClientId);
    }
    // Flatten all client invoices
    return store.clients.flatMap(c => store.getInvoicesForClient(c.id));
  }, [store, selectedClientId]);

  // Map store invoices to the local ExtractedInvoice type for the UI
  const invoices: ExtractedInvoice[] = useMemo(() =>
    storeInvoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: store.getClient(inv.clientId)?.tradeName ?? 'Unknown',
      invoiceDate: inv.date,
      section: (inv.placeOfSupply && inv.placeOfSupply !== store.getClient(inv.clientId)?.stateCode ? 'b2cl' : 'b2b') as GSTR1Section,
      sectionLabel: (inv.placeOfSupply && inv.placeOfSupply !== store.getClient(inv.clientId)?.stateCode ? 'B2C Large' : 'B2B'),
      taxableValue: inv.taxableValue,
      cgst: inv.cgst,
      sgst: inv.sgst,
      igst: inv.igst,
      totalTax: inv.cgst + inv.sgst + inv.igst,
      totalAmount: inv.taxableValue + inv.cgst + inv.sgst + inv.igst,
      validationStatus: inv.status as ValidationStatus,
      ocrConfidence: inv.status === 'error' ? 75.0 : inv.status === 'warning' ? 92.0 : 98.5,
      missingFields: inv.errorDetail ? [inv.errorDetail.split(' ').slice(0, 2).join(' ')] : [],
      validationMessages: inv.errorDetail ? [inv.errorDetail] : [],
    })),
    [storeInvoices, store]
  );

  const hasInvoices = invoices.length > 0;

  // ── Filter State ──
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // ── Collapsible ──
  const [issuesOpen, setIssuesOpen] = useState(true);

  // ── AI Review Queue ──
  const [reviewingInvoiceId, setReviewingInvoiceId] = useState<string | null>(null);

  // Loading is instant — data comes from store
  const loading = false;

  // ── Pipeline Counts ──
  const pipelineCounts = useMemo(() => {
    const uploading = processingFiles.filter(f => f.status === 'uploading').length;
    const extracting = processingFiles.filter(f => f.status === 'extracting' || f.status === 'validating').length;
    const validated = invoices.filter(i => i.validationStatus === 'validated').length;
    const errors = invoices.filter(i => i.validationStatus === 'error').length;
    return { uploading, extracting, validated, errors };
  }, [processingFiles, invoices]);

  // ── Validation Issues ──
  const validationIssues = useMemo(() => {
    const issues: ValidationIssueItem[] = [];
    for (const inv of invoices) {
      if (inv.validationStatus === 'error') {
        for (const msg of inv.validationMessages) {
          issues.push({
            id: `${inv.id}-err-${issues.length}`,
            severity: 'critical',
            description: msg,
            invoiceNumber: inv.invoiceNumber,
            invoiceId: inv.id,
          });
        }
      }
      if (inv.validationStatus === 'warning') {
        for (const msg of inv.validationMessages) {
          issues.push({
            id: `${inv.id}-warn-${issues.length}`,
            severity: 'warning',
            description: msg,
            invoiceNumber: inv.invoiceNumber,
            invoiceId: inv.id,
          });
        }
      }
      for (const field of inv.missingFields) {
        issues.push({
          id: `${inv.id}-missing-${field}`,
          severity: 'warning',
          description: `Missing: ${field}`,
          invoiceNumber: inv.invoiceNumber,
          invoiceId: inv.id,
        });
      }
    }
    return issues;
  }, [invoices]);

  const criticalCount = validationIssues.filter(i => i.severity === 'critical').length;
  const warningCount = validationIssues.filter(i => i.severity === 'warning').length;

  // ── Filtered Invoices ──
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (sectionFilter !== 'all' && inv.section !== sectionFilter) return false;
      if (statusFilter !== 'all' && inv.validationStatus !== statusFilter) return false;
      return true;
    });
  }, [invoices, sectionFilter, statusFilter]);

  // ── Active Pipeline Stage ──
  const activePipelineStage = useMemo(() => {
    if (pipelineCounts.uploading > 0) return 'uploading';
    if (pipelineCounts.extracting > 0) return 'extracting';
    return 'idle';
  }, [pipelineCounts]);

  // ── Upload Handlers ──
  // Deterministic file sizes based on file name hash
  function getDeterministicSize(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 1500000) + 200000; // 200KB - 1.7MB
  }

  const simulateUpload = useCallback((fileNames: string[]) => {
    const newFiles: ProcessingFile[] = fileNames.map((name, idx) => ({
      id: `file-${Date.now()}-${idx}`,
      name,
      size: getDeterministicSize(name),
      format: name.split('.').pop()?.toUpperCase() || 'JSON',
      progress: 0,
      status: 'uploading' as const,
      invoiceCount: 0,
      ocrConfidence: 0,
    }));

    setProcessingFiles(prev => [...prev, ...newFiles]);

    newFiles.forEach((file, idx) => {
      const fileIndex = idx;
      let progress = 0;

      // Phase 1: Upload — deterministic progress steps
      const uploadInterval = setInterval(() => {
        progress += 25; // Fixed increment
        if (progress >= 100) {
          progress = 100;
          clearInterval(uploadInterval);
          setProcessingFiles(prev =>
            prev.map((f, i) =>
              i === prev.length - newFiles.length + fileIndex
                ? { ...f, progress: 100, status: 'extracting' }
                : f
            )
          );

          // Phase 2: Extracting
          setTimeout(() => {
            const invCount = 8; // Fixed realistic count
            const ocr = 96.5;  // Fixed realistic confidence
            setProcessingFiles(prev =>
              prev.map((f, i) =>
                i === prev.length - newFiles.length + fileIndex
                  ? { ...f, status: 'validating', invoiceCount: invCount, ocrConfidence: ocr }
                  : f
              )
            );

            // Phase 3: Validating -> Complete
            setTimeout(() => {
              setProcessingFiles(prev =>
                prev.map((f, i) =>
                  i === prev.length - newFiles.length + fileIndex
                    ? { ...f, status: 'complete' }
                    : f
                )
              );

              // Record upload in store
              store.addUpload({
                fileName: file.name,
                fileType: file.format.toLowerCase() as 'json' | 'csv' | 'xlsx',
                uploadTime: new Date().toISOString(),
                status: 'processed',
                invoiceCount: invCount,
              });
            }, 1200);
          }, 1800);
        } else {
          setProcessingFiles(prev =>
            prev.map((f, i) =>
              i === prev.length - newFiles.length + fileIndex
                ? { ...f, progress: Math.min(progress, 100) }
                : f
            )
          );
        }
      }, 300);
    });
  }, [store]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      simulateUpload(files.map(f => f.name));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      simulateUpload(files.map(f => f.name));
    }
    e.target.value = '';
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleDemoUpload = () => {
    simulateUpload(['GSTR1_Jun2025_SharmaEnt.json', 'SalesRegister_Jun2025.csv']);
  };

  const removeFile = (fileId: string) => {
    setProcessingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // ── Loading Skeleton ──
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-48" />
        </div>
        <Skeleton className="h-56 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/80 to-white">
      <div className="space-y-6 p-4 md:p-6 lg:p-8">

        {/* ════════════════════════════════════════════════════════════════════
            1. HEADER
        ════════════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Document Processing
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload, extract, and validate invoices
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={selectedClientId ?? 'all'}
              onValueChange={(v) => setSelectedClientId(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-[200px] h-9 text-sm border-slate-200">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tradeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════════════════════════════
            2. UPLOAD HERO ZONE
        ════════════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <motion.div
            animate={isDragging ? { scale: 1.01 } : { scale: 1 }}
            transition={{ duration: 0.2 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
              ${isDragging
                ? 'border-emerald-400 bg-emerald-50/60'
                : 'border-slate-300 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 hover:border-emerald-300 hover:bg-emerald-50/20'
              }
            `}
            onClick={handleBrowseClick}
          >
            {/* Background decoration */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-20 -right-20 size-64 rounded-full bg-emerald-100/30 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 size-64 rounded-full bg-teal-100/20 blur-3xl" />
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center py-12 px-6 md:py-16">
              <motion.div
                animate={isDragging ? { y: -6, scale: 1.1 } : { y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`
                  mb-4 flex size-16 items-center justify-center rounded-2xl transition-colors duration-300
                  ${isDragging ? 'bg-emerald-200 text-emerald-700' : 'bg-emerald-100 text-emerald-600'}
                `}
              >
                <CloudUpload className="size-8" />
              </motion.div>

              <h2 className="text-lg font-semibold text-slate-800 sm:text-xl">
                {isDragging ? 'Drop your files here!' : 'Drop GST documents here'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                or click to browse
              </p>

              {/* Format badges */}
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 border-slate-200 bg-white/80 text-slate-600 text-xs font-medium">
                  <FileJson className="size-3" />
                  JSON
                </Badge>
                <span className="text-xs text-slate-300">·</span>
                <Badge variant="outline" className="gap-1.5 border-slate-200 bg-white/80 text-slate-600 text-xs font-medium">
                  <FileSpreadsheet className="size-3" />
                  CSV
                </Badge>
                <span className="text-xs text-slate-300">·</span>
                <Badge variant="outline" className="gap-1.5 border-slate-200 bg-white/80 text-slate-600 text-xs font-medium">
                  <FileText className="size-3" />
                  Excel
                </Badge>
              </div>

              {/* Demo button */}
              {!hasInvoices && processingFiles.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-5 gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDemoUpload();
                  }}
                >
                  <Sparkles className="size-3.5" />
                  Try with sample data
                </Button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,.xlsx,.xls"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </motion.div>
        </motion.div>

        {/* ════════════════════════════════════════════════════════════════════
            3. PROCESSING PIPELINE
        ════════════════════════════════════════════════════════════════════ */}
        {(processingFiles.length > 0 || hasInvoices) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <div className="flex items-stretch gap-2 sm:gap-3 overflow-x-auto pb-2">
              {[
                {
                  key: 'uploaded',
                  icon: <Upload className="size-4" />,
                  label: 'Uploaded',
                  count: processingFiles.length,
                  color: 'text-slate-600',
                  bgColor: 'bg-slate-50 border-slate-200',
                  active: activePipelineStage === 'uploading',
                },
                {
                  key: 'extracting',
                  icon: <Bot className="size-4" />,
                  label: 'AI Extracting',
                  count: pipelineCounts.extracting,
                  color: 'text-teal-600',
                  bgColor: 'bg-teal-50 border-teal-200',
                  active: activePipelineStage === 'extracting',
                },
                {
                  key: 'validated',
                  icon: <ShieldCheck className="size-4" />,
                  label: 'Validated',
                  count: pipelineCounts.validated,
                  color: 'text-emerald-600',
                  bgColor: 'bg-emerald-50 border-emerald-200',
                  active: false,
                },
                {
                  key: 'errors',
                  icon: <XCircle className="size-4" />,
                  label: 'Has Errors',
                  count: pipelineCounts.errors,
                  color: 'text-red-600',
                  bgColor: 'bg-red-50 border-red-200',
                  active: false,
                },
              ].map((stage, idx) => (
                <React.Fragment key={stage.key}>
                  <motion.div
                    variants={staggerItem}
                    initial="hidden"
                    animate="visible"
                    className="flex-1 min-w-[120px]"
                  >
                    <motion.div
                      animate={stage.active ? 'pulse' : undefined}
                      variants={stage.active ? pulseGlow : undefined}
                    >
                      <Card className={`border transition-all ${stage.bgColor} ${stage.active ? 'ring-2 ring-teal-300/50' : ''}`}>
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-center gap-2">
                            <div className={`${stage.color}`}>
                              {stage.icon}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[10px] sm:text-xs font-medium uppercase tracking-wider ${stage.color} truncate`}>
                                {stage.label}
                              </p>
                              <p className={`text-lg sm:text-xl font-bold ${stage.color}`}>
                                {stage.count}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </motion.div>

                  {idx < 3 && (
                    <div className="flex items-center text-slate-300 shrink-0">
                      <ArrowRight className="size-4 sm:size-5" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            3.5. PROCESSING TIMELINE
        ════════════════════════════════════════════════════════════════════ */}
        {(processingFiles.length > 0 || hasInvoices) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
          >
            <Card className="border-slate-200/60 shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Clock className="size-4 text-teal-600" />
                  Processing Timeline
                </h3>
                <div className="relative pl-6">
                  {/* Timeline vertical line */}
                  <div className="absolute left-[9px] top-1 bottom-1 w-px bg-slate-200" />

                  {[
                    {
                      key: 'upload',
                      label: 'Upload',
                      time: '10:32 AM',
                      status: 'complete' as const,
                      icon: <Upload className="size-3" />,
                    },
                    {
                      key: 'extraction',
                      label: 'AI Extraction',
                      time: '10:33 AM',
                      status: activePipelineStage === 'extracting' ? ('active' as const) : hasInvoices || processingFiles.some(f => f.status !== 'uploading') ? ('complete' as const) : ('pending' as const),
                      icon: <Bot className="size-3" />,
                    },
                    {
                      key: 'validation',
                      label: 'Validation',
                      time: '10:34 AM',
                      status: hasInvoices && invoices.length > 0 ? ('complete' as const) : activePipelineStage === 'extracting' ? ('active' as const) : ('pending' as const),
                      icon: <ShieldCheck className="size-3" />,
                    },
                    {
                      key: 'complete',
                      label: 'Complete',
                      time: '10:35 AM',
                      status: hasInvoices && invoices.length > 0 ? ('complete' as const) : ('pending' as const),
                      icon: <CheckCircle2 className="size-3" />,
                    },
                  ].map((step) => {
                    const isComplete = step.status === 'complete';
                    const isActive = step.status === 'active';
                    const isPending = step.status === 'pending';

                    return (
                      <div key={step.key} className="relative flex items-start gap-3 pb-4 last:pb-0">
                        {/* Timeline dot */}
                        <div className={`
                          absolute -left-6 top-0.5 flex size-[18px] items-center justify-center rounded-full ring-2 ring-white shrink-0
                          ${isComplete ? 'bg-emerald-500 text-white' : isActive ? 'bg-teal-500 text-white' : 'bg-slate-200 text-slate-400'}
                        `}>
                          {isActive ? (
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            >
                              {step.icon}
                            </motion.div>
                          ) : (
                            step.icon
                          )}
                        </div>

                        {/* Step content */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div>
                            <p className={`text-xs font-semibold ${isComplete ? 'text-emerald-700' : isActive ? 'text-teal-700' : 'text-slate-400'}`}>
                              {step.label}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] ${isComplete ? 'text-emerald-600' : isActive ? 'text-teal-600' : 'text-slate-400'}`}>
                              {step.time}
                            </span>
                            {isComplete && <CheckCircle2 className="size-3 text-emerald-500" />}
                            {isActive && (
                              <motion.div
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                              >
                                <div className="size-2 rounded-full bg-teal-500" />
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            4. PROCESSING QUEUE
        ════════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {processingFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-slate-200/60 shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <FileUp className="size-4 text-teal-600" />
                    Processing Queue
                  </h3>
                  <div className="space-y-3">
                    <AnimatePresence>
                      {processingFiles.map((file) => (
                        <motion.div
                          key={file.id}
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 16, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <Card className={`border transition-colors ${
                            file.status === 'complete'
                              ? 'border-emerald-200 bg-emerald-50/30'
                              : file.status === 'error'
                              ? 'border-red-200 bg-red-50/30'
                              : 'border-slate-200 bg-white'
                          }`}>
                            <CardContent className="p-3 sm:p-4">
                              <div className="flex items-start gap-3">
                                {/* File icon */}
                                <div className={`
                                  shrink-0 flex size-9 items-center justify-center rounded-lg
                                  ${file.status === 'complete'
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : file.status === 'error'
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-slate-100 text-slate-600'
                                  }
                                `}>
                                  {file.status === 'complete' ? (
                                    <CheckCircle2 className="size-4" />
                                  ) : file.status === 'error' ? (
                                    <XCircle className="size-4" />
                                  ) : (
                                    <FileText className="size-4" />
                                  )}
                                </div>

                                {/* File info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium text-slate-800 truncate">
                                      {file.name}
                                    </p>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {file.status !== 'complete' && file.status !== 'error' && (
                                        <Badge variant="outline" className="text-[10px] border-teal-200 bg-teal-50 text-teal-700">
                                          {file.format}
                                        </Badge>
                                      )}
                                      <button
                                        onClick={() => removeFile(file.id)}
                                        className="text-slate-400 hover:text-slate-600 transition-colors"
                                      >
                                        <X className="size-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Progress bar */}
                                  {(file.status === 'uploading' || file.status === 'extracting' || file.status === 'validating') && (
                                    <div className="mt-2 space-y-1.5">
                                      <Progress
                                        value={file.progress}
                                        className="h-1.5 bg-slate-100"
                                      />
                                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        {file.status === 'uploading' && (
                                          <>
                                            <motion.span
                                              animate={{ opacity: [1, 0.4, 1] }}
                                              transition={{ duration: 1.5, repeat: Infinity }}
                                            >
                                              Uploading...
                                            </motion.span>
                                            <span>{Math.round(file.progress)}%</span>
                                          </>
                                        )}
                                        {file.status === 'extracting' && (
                                          <motion.span
                                            animate={{ opacity: [1, 0.4, 1] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="flex items-center gap-1"
                                          >
                                            <Bot className="size-3" />
                                            Extracting invoices...
                                          </motion.span>
                                        )}
                                        {file.status === 'validating' && (
                                          <motion.span
                                            animate={{ opacity: [1, 0.4, 1] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="flex items-center gap-1"
                                          >
                                            <ShieldCheck className="size-3" />
                                            Validating data...
                                          </motion.span>
                                        )}
                                      </p>
                                    </div>
                                  )}

                                  {/* Completed file info */}
                                  {file.status === 'complete' && (
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                      <span className="text-xs text-emerald-700 font-medium">
                                        {file.invoiceCount} invoices extracted
                                      </span>
                                      {/* OCR confidence bar */}
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-muted-foreground">OCR</span>
                                        <div className="h-1 w-16 rounded-full bg-slate-100 overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${getConfidenceBarColor(file.ocrConfidence)}`}
                                            style={{ width: `${file.ocrConfidence}%` }}
                                          />
                                        </div>
                                        <span className={`text-[10px] font-medium ${getConfidenceColor(file.ocrConfidence)}`}>
                                          {file.ocrConfidence}%
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Error info */}
                                  {file.status === 'error' && (
                                    <p className="mt-1 text-xs text-red-600">
                                      {file.errorMsg || 'Unable to parse — try CSV format'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════════════════════════════════
            5. EXTRACTED INVOICES
        ════════════════════════════════════════════════════════════════════ */}
        {hasInvoices && invoices.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {/* Filter pills: Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'b2b', label: 'B2B' },
                    { key: 'b2cl', label: 'B2C Large' },
                    { key: 'b2cs', label: 'B2C Small' },
                    { key: 'exp', label: 'Export' },
                    { key: 'cdnr', label: 'CDNR' },
                  ].map(pill => (
                    <button
                      key={pill.key}
                      onClick={() => setSectionFilter(pill.key)}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-medium transition-all
                        ${sectionFilter === pill.key
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }
                      `}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  {[
                    { key: 'all', label: 'All Status' },
                    { key: 'validated', label: 'Validated' },
                    { key: 'warning', label: 'Warning' },
                    { key: 'error', label: 'Error' },
                  ].map(pill => (
                    <button
                      key={pill.key}
                      onClick={() => setStatusFilter(pill.key)}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-medium transition-all
                        ${statusFilter === pill.key
                          ? pill.key === 'error'
                            ? 'bg-red-600 text-white shadow-sm'
                            : pill.key === 'warning'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : pill.key === 'validated'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-800 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }
                      `}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground ml-auto shrink-0">
                  {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Invoice card grid */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                <AnimatePresence mode="popLayout">
                  {filteredInvoices.map(inv => (
                    <motion.div
                      key={inv.id}
                      variants={staggerItem}
                      layout
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <Card className={`
                        border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden
                        ${inv.validationStatus === 'error'
                          ? 'border-red-200/80 hover:border-red-300'
                          : inv.validationStatus === 'warning'
                          ? 'border-amber-200/80 hover:border-amber-300'
                          : 'border-slate-200/60 hover:border-emerald-200'
                        }
                      `}>
                        <CardContent className="p-4 sm:p-5">
                          {/* Header: Invoice # + section badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {inv.invoiceNumber}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {inv.clientName}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-medium ${getSectionBadgeStyle(inv.section)}`}
                              >
                                {inv.sectionLabel}
                              </Badge>
                            </div>
                          </div>

                          {/* Date */}
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {inv.invoiceDate}
                          </p>

                          {/* Tax breakdown */}
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Taxable Amount</span>
                              <span className="font-semibold text-slate-800">
                                {formatCurrency(inv.taxableValue)}
                              </span>
                            </div>
                            {inv.cgst > 0 && (
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">CGST</span>
                                <span className="text-slate-600">{formatCurrency(inv.cgst)}</span>
                              </div>
                            )}
                            {inv.sgst > 0 && (
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">SGST</span>
                                <span className="text-slate-600">{formatCurrency(inv.sgst)}</span>
                              </div>
                            )}
                            {inv.igst > 0 && (
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">IGST</span>
                                <span className="text-slate-600">{formatCurrency(inv.igst)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-1.5">
                              <span className="text-muted-foreground font-medium">Total</span>
                              <span className="font-bold text-slate-900">
                                {formatCurrency(inv.totalAmount)}
                              </span>
                            </div>
                          </div>

                          {/* Validation status + OCR confidence */}
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {getValidationIcon(inv.validationStatus)}
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-medium ${getValidationBadge(inv.validationStatus)}`}
                              >
                                {getValidationLabel(inv.validationStatus)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="h-1 w-10 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${getConfidenceBarColor(inv.ocrConfidence)}`}
                                  style={{ width: `${inv.ocrConfidence}%` }}
                                />
                              </div>
                              <span className={`text-[10px] font-medium ${getConfidenceColor(inv.ocrConfidence)}`}>
                                {inv.ocrConfidence}%
                              </span>
                            </div>
                          </div>

                          {/* Missing fields indicator */}
                          {inv.missingFields.length > 0 && (
                            <div className="mt-2 flex items-center gap-1">
                              <AlertCircle className="size-3 text-amber-500 shrink-0" />
                              <p className="text-[10px] text-amber-700 truncate">
                                Missing: {inv.missingFields.join(', ')}
                              </p>
                            </div>
                          )}

                          {/* Validation messages */}
                          {inv.validationMessages.length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {inv.validationMessages.map((msg, i) => (
                                <p
                                  key={i}
                                  className={`text-[10px] truncate ${
                                    inv.validationStatus === 'error'
                                      ? 'text-red-600'
                                      : 'text-amber-600'
                                  }`}
                                >
                                  {msg}
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-7 text-xs gap-1.5 border-slate-200 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              <Edit3 className="size-3" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={inv.validationStatus === 'error'}
                            >
                              <FileCheck2 className="size-3" />
                              Approve
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            5.5. AI REVIEW QUEUE
        ════════════════════════════════════════════════════════════════════ */}
        {hasInvoices && invoices.some(i => i.validationStatus === 'warning' || i.validationStatus === 'error') && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="border-slate-200/60 shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Eye className="size-4 text-teal-600" />
                    AI Review Queue
                  </h3>
                  <Badge className="text-[10px] font-semibold bg-amber-50 text-amber-700 border-amber-200 px-2.5 py-0.5">
                    {invoices.filter(i => i.validationStatus === 'warning' || i.validationStatus === 'error').length} items
                  </Badge>
                </div>
                <div className="space-y-2">
                  {invoices
                    .filter(i => i.validationStatus === 'warning' || i.validationStatus === 'error')
                    .map((inv, idx) => (
                      <motion.div
                        key={inv.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.05 }}
                        className={`
                          flex items-start gap-3 rounded-lg border p-3 transition-all
                          ${reviewingInvoiceId === inv.id
                            ? 'border-teal-300 bg-teal-50/50 ring-1 ring-teal-200'
                            : inv.validationStatus === 'error'
                            ? 'border-red-100 bg-red-50/30'
                            : 'border-amber-100 bg-amber-50/30'
                          }
                        `}
                      >
                        <div className={`shrink-0 mt-0.5 flex size-7 items-center justify-center rounded-lg ${
                          inv.validationStatus === 'error' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {inv.validationStatus === 'error' ? <XCircle className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-semibold text-slate-800">{inv.invoiceNumber}</p>
                            <Badge variant="outline" className={`text-[9px] font-medium ${getValidationBadge(inv.validationStatus)}`}>
                              {getValidationLabel(inv.validationStatus)}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{inv.clientName}</p>
                          <p className={`text-[10px] mt-1 ${inv.validationStatus === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
                            {inv.validationMessages.length > 0 ? inv.validationMessages[0] : inv.missingFields.length > 0 ? `Missing: ${inv.missingFields.join(', ')}` : 'Requires review'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[9px] text-muted-foreground">Confidence</span>
                            <div className="h-1 w-12 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getConfidenceBarColor(inv.ocrConfidence)}`}
                                style={{ width: `${inv.ocrConfidence}%` }}
                              />
                            </div>
                            <span className={`text-[9px] font-medium ${getConfidenceColor(inv.ocrConfidence)}`}>
                              {inv.ocrConfidence}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-7 text-[10px] gap-1 ${
                              reviewingInvoiceId === inv.id
                                ? 'border-teal-300 text-teal-700 bg-teal-50'
                                : 'border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50'
                            }`}
                            onClick={() => setReviewingInvoiceId(reviewingInvoiceId === inv.id ? null : inv.id)}
                          >
                            <Eye className="size-3" />
                            Review
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                            onClick={() => {
                              setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, validationStatus: 'validated' as ValidationStatus, validationMessages: [], missingFields: [] } : i));
                            }}
                          >
                            <ThumbsUp className="size-3" />
                            Approve
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            6. VALIDATION ISSUES PANEL
        ════════════════════════════════════════════════════════════════════ */}
        {hasInvoices && validationIssues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Collapsible open={issuesOpen} onOpenChange={setIssuesOpen}>
              <Card className="border-slate-200/60 shadow-sm">
                <CollapsibleTrigger asChild>
                  <button className="w-full text-left">
                    <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-red-50">
                          <AlertTriangle className="size-4 text-red-500" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800">Validation Issues</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <span className="text-red-600 font-medium">{criticalCount} Critical</span>
                            <span className="mx-1.5">·</span>
                            <span className="text-amber-600 font-medium">{warningCount} Warnings</span>
                          </p>
                        </div>
                      </div>
                      <motion.div
                        animate={{ rotate: issuesOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="size-5 text-slate-400" />
                      </motion.div>
                    </CardContent>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                    <ScrollArea className="max-h-64">
                      <div className="space-y-2">
                        {validationIssues.map((issue, idx) => (
                          <motion.div
                            key={issue.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: idx * 0.03 }}
                            className={`
                              flex items-start gap-3 rounded-lg border p-3 transition-colors
                              ${issue.severity === 'critical'
                                ? 'border-red-100 bg-red-50/50'
                                : 'border-amber-100 bg-amber-50/50'
                              }
                            `}
                          >
                            <div className="shrink-0 mt-0.5">
                              {issue.severity === 'critical' ? (
                                <XCircle className="size-4 text-red-500" />
                              ) : (
                                <AlertTriangle className="size-4 text-amber-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-800">
                                {issue.description}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Invoice: {issue.invoiceNumber}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className={`
                                shrink-0 h-6 text-[10px] gap-1
                                ${issue.severity === 'critical'
                                  ? 'border-red-200 text-red-700 hover:bg-red-50'
                                  : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                                }
                              `}
                            >
                              Fix
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            7. EMPTY STATE
        ════════════════════════════════════════════════════════════════════ */}
        {!hasInvoices && processingFiles.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="border-slate-200/60 shadow-sm">
              <CardContent className="py-16 px-6 flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
                  <CloudUpload className="size-7 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-700">
                  No documents uploaded yet
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
                  Upload your GST documents to start processing — we&apos;ll extract and validate invoices automatically
                </p>
                <Button
                  className="mt-5 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleDemoUpload}
                >
                  <Upload className="size-4" />
                  Upload Documents
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
