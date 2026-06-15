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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CloudUpload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  FileUp,
  Upload,
  AlertCircle,
  ThumbsUp,
  Inbox,
  Loader2,
  Search,
  Trash2,
  FileSpreadsheet,
  FileJson,
  TrendingUp,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import type {
  FirestoreInvoice,
  FirestoreClient,
  FirestoreDocument,
} from '@/lib/firestore-schema';
import type {
  InvoiceStatus,
  RiskLevel,
  MatchStatus,
  InvoiceType,
} from '@/types/gst';
import {
  MATCH_STATUS_CONFIG,
  RISK_LEVEL_CONFIG,
  INVOICE_TYPE_TO_SECTION,
} from '@/types/gst';
import {
  formatCurrency,
  formatNumber,
} from '@/lib/gst-utils';
import {
  useFireInvoices,
  useFireClients,
  useFireDocuments,
} from '@/hooks/use-firestore';
import {
  createInvoice,
  approveInvoice,
  deleteInvoice,
  createDocument,
} from '@/lib/firestore-service';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';

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

// ─── Status Badge Configs ─────────────────────────────────────────────────────

const STATUS_BADGE: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  filed: { label: 'Filed', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
};

const RISK_BADGE: Record<RiskLevel, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  medium: { label: 'Medium', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  high: { label: 'High', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  critical: { label: 'Critical', className: 'bg-red-50 text-red-700 border-red-200' },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'json') return <FileJson className="size-4 text-amber-500" />;
  if (ext === 'csv' || ext === 'xlsx') return <FileSpreadsheet className="size-4 text-emerald-500" />;
  return <FileText className="size-4 text-slate-500" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceWorkspacePage() {
  // ── Firestore data hooks ──
  const { data: invoices, loading: invoicesLoading, error: invoicesError } = useFireInvoices();
  const { data: clients, loading: clientsLoading, error: clientsError } = useFireClients();
  const { data: documents, loading: documentsLoading } = useFireDocuments();

  // ── Client map for name lookups ──
  const clientMap = useMemo(() => {
    const map = new Map<string, FirestoreClient & { id: string }>();
    for (const c of clients) {
      map.set(c.clientId, c);
    }
    return map;
  }, [clients]);

  // ── Upload State ──
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Array<{ id: string; name: string; progress: number }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Filter State ──
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Action State ──
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Loading ──
  const loading = invoicesLoading || clientsLoading;

  // ── Summary Metrics ──
  const summary = useMemo(() => {
    const total = invoices.length;
    const approved = invoices.filter(i => i.status === 'approved').length;
    const pending = invoices.filter(i => i.status === 'draft').length;
    const taxVolume = invoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const riskItems = invoices.filter(i => i.riskLevel === 'high' || i.riskLevel === 'critical').length;
    return { total, approved, pending, taxVolume, riskItems };
  }, [invoices]);

  // ── Filtered Invoices ──
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (clientFilter !== 'all' && inv.clientId !== clientFilter) return false;
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (riskFilter !== 'all' && inv.riskLevel !== riskFilter) return false;
      if (typeFilter !== 'all' && inv.invoiceType !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const clientName = clientMap.get(inv.clientId)?.tradeName ?? '';
        const matchesNumber = inv.invoiceNumber.toLowerCase().includes(q);
        const matchesBuyer = (inv.buyerName ?? '').toLowerCase().includes(q);
        const matchesClient = clientName.toLowerCase().includes(q);
        if (!matchesNumber && !matchesBuyer && !matchesClient) return false;
      }
      return true;
    });
  }, [invoices, clientFilter, statusFilter, riskFilter, typeFilter, searchQuery, clientMap]);

  // ── Upload Handlers ──
  const handleUpload = useCallback(async (files: File[]) => {
    for (const file of files) {
      const fileId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setUploadingFiles(prev => [...prev, { id: fileId, name: file.name, progress: 0 }]);

      try {
        // Simulate upload progress
        setUploadingFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, progress: 30 } : f)
        );

        // Determine document type from file extension
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        let docType: 'purchase_register' | 'sales_register' | 'gstr1' | 'gstr2b' | 'gstr3b' | 'invoice' | 'other' = 'other';
        if (ext === 'json') docType = 'gstr1';
        else if (ext === 'csv' || ext === 'xlsx') docType = 'sales_register';
        else docType = 'invoice';

        // Use first client if available, otherwise empty string
        const clientId = clients[0]?.clientId ?? '';

        setUploadingFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, progress: 60 } : f)
        );

        await createDocument({
          clientId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          documentType: docType,
          period: '2025-06',
        });

        setUploadingFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, progress: 100 } : f)
        );

        toast.success(`${file.name} uploaded successfully`);

        // Remove from uploading list after a short delay
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
        }, 1500);
      } catch (err) {
        setUploadingFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, progress: 0 } : f)
        );
        toast.error(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
        }, 2000);
      }
    }
  }, [clients]);

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
    if (files.length > 0) handleUpload(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleUpload(files);
    e.target.value = '';
  };

  // ── Invoice action handlers ──
  const handleApprove = async (invoiceId: string, invoiceNumber: string) => {
    setApprovingId(invoiceId);
    try {
      await approveInvoice(invoiceId);
      toast.success(`Invoice ${invoiceNumber} approved`);
    } catch (err) {
      toast.error(`Failed to approve: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setApprovingId(null);
    }
  };

  const handleDelete = async (invoiceId: string, invoiceNumber: string) => {
    setDeletingId(invoiceId);
    try {
      await deleteInvoice(invoiceId);
      toast.success(`Invoice ${invoiceNumber} deleted`);
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  // ── Error state ──
  if (invoicesError || clientsError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="size-10 text-red-400 mb-4" />
        <h3 className="text-lg font-semibold text-foreground">Failed to load data</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          {invoicesError || clientsError}
        </p>
      </div>
    );
  }

  // ── Empty state when no invoices exist ──
  if (invoices.length === 0 && uploadingFiles.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50/80 to-white">
        <div className="space-y-6 p-4 md:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Invoice Workspace
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload, extract, and validate GST invoices
              </p>
            </div>
          </motion.div>

          <EmptyState
            icon={FileUp}
            title="No invoices yet"
            description="Upload your first document to start processing and validating GST invoices."
            action={{
              label: 'Upload your first document',
              onClick: () => fileInputRef.current?.click(),
              icon: Upload,
            }}
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.json,.pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    );
  }

  // ─── Summary Cards ────────────────────────────────────────────────────────────

  const summaryCards = [
    {
      title: 'Total Invoices',
      value: formatNumber(summary.total),
      icon: FileText,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
    },
    {
      title: 'Approved',
      value: formatNumber(summary.approved),
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Pending',
      value: formatNumber(summary.pending),
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Tax Volume',
      value: formatCurrency(summary.taxVolume),
      icon: TrendingUp,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
    {
      title: 'Risk Items',
      value: formatNumber(summary.riskItems),
      icon: ShieldAlert,
      color: summary.riskItems > 0 ? 'text-red-600' : 'text-slate-600',
      bgColor: summary.riskItems > 0 ? 'bg-red-50' : 'bg-slate-50',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/80 to-white">
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Invoice Workspace
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} &middot; {documents.length} document{documents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            <Upload className="size-4" />
            Upload Document
          </Button>
        </motion.div>

        {/* ── Summary Cards ── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
        >
          {summaryCards.map((card) => (
            <motion.div key={card.title} variants={staggerItem}>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center size-9 rounded-lg ${card.bgColor}`}>
                      <card.icon className={`size-4 ${card.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{card.title}</p>
                      <p className="text-lg font-bold tracking-tight">{card.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Upload Area ── */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card className={`border-2 border-dashed transition-colors ${
            isDragging ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 bg-white'
          }`}>
            <CardContent className="p-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="flex flex-col items-center gap-3 text-center"
              >
                <div className="flex items-center justify-center size-12 rounded-xl bg-slate-50">
                  <CloudUpload className="size-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Drag & drop files here, or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-emerald-600 hover:text-emerald-700 font-semibold underline underline-offset-2"
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports JSON, CSV, XLSX, PDF &middot; Max 10MB per file
                  </p>
                </div>

                {/* Uploading files indicator */}
                <AnimatePresence>
                  {uploadingFiles.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full max-w-md mt-2 space-y-2"
                    >
                      {uploadingFiles.map(f => (
                        <div key={f.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                          {getFileIcon(f.name)}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{f.name}</p>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1">
                              <motion.div
                                className="h-full bg-emerald-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${f.progress}%` }}
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">{f.progress}%</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.json,.pdf"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* ── Filters ── */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by invoice # or buyer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.clientId} value={c.clientId}>
                  {c.tradeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-white">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="filed">Filed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-white">
              <SelectValue placeholder="All Risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-white">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.keys(INVOICE_TYPE_TO_SECTION).map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* ── Invoice Table ── */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Inbox className="size-10 text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-foreground">No invoices match your filters</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filter criteria</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="text-xs font-semibold">Invoice #</TableHead>
                        <TableHead className="text-xs font-semibold">Date</TableHead>
                        <TableHead className="text-xs font-semibold">Client</TableHead>
                        <TableHead className="text-xs font-semibold">Type</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Taxable Value</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Tax</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="text-xs font-semibold">Risk</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filteredInvoices.map((inv) => {
                          const client = clientMap.get(inv.clientId);
                          const clientName = client?.tradeName ?? inv.buyerName ?? 'Unknown';
                          const statusCfg = STATUS_BADGE[inv.status as InvoiceStatus] ?? STATUS_BADGE.draft;
                          const riskCfg = RISK_BADGE[inv.riskLevel as RiskLevel] ?? RISK_BADGE.low;
                          const matchCfg = MATCH_STATUS_CONFIG[inv.matchStatus as MatchStatus];
                          const totalTax = inv.cgst + inv.sgst + inv.igst + inv.cess;
                          const isApproving = approvingId === inv.id;
                          const isDeleting = deletingId === inv.id;
                          const isActionLoading = isApproving || isDeleting;

                          return (
                            <motion.tr
                              key={inv.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.2 }}
                              className="hover:bg-slate-50/50 border-b transition-colors"
                            >
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm">{inv.invoiceNumber}</span>
                                  {matchCfg && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border inline-block w-fit mt-0.5 ${matchCfg.bgColor} ${matchCfg.color}`}>
                                      {matchCfg.label}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{clientName}</span>
                                  {inv.buyerGstin && (
                                    <span className="text-[10px] text-muted-foreground">{inv.buyerGstin}</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] font-medium bg-slate-50">
                                  {inv.invoiceType}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(inv.taxableValue)}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(totalTax)}
                              </TableCell>
                              <TableCell className="text-right text-sm font-semibold">
                                {formatCurrency(inv.totalAmount)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] font-medium ${statusCfg.className}`}>
                                  {statusCfg.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] font-medium ${riskCfg.className}`}>
                                  {RISK_LEVEL_CONFIG[inv.riskLevel as RiskLevel]?.icon ?? ''} {riskCfg.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {inv.status === 'draft' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                      onClick={() => handleApprove(inv.id, inv.invoiceNumber)}
                                      disabled={isActionLoading}
                                    >
                                      {isApproving ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                      ) : (
                                        <ThumbsUp className="size-3.5" />
                                      )}
                                    </Button>
                                  )}
                                  {(inv.status === 'draft' || inv.status === 'approved') && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                                      onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                                      disabled={isActionLoading}
                                    >
                                      {isDeleting ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="size-3.5" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Recent Documents ── */}
        {documents.length > 0 && (
          <motion.div variants={fadeInUp} initial="hidden" animate="visible">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Recent Documents</h3>
                <ScrollArea className="max-h-48">
                  <div className="space-y-2">
                    {documents.slice(0, 10).map((doc) => {
                      const client = clientMap.get(doc.clientId);
                      return (
                        <div key={doc.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors">
                          {getFileIcon(doc.fileName)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.fileName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {client?.tradeName ?? 'Unknown'} &middot; {formatFileSize(doc.fileSize)} &middot; {doc.documentType.replace(/_/g, ' ')}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              doc.status === 'extracted'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : doc.status === 'processing'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : doc.status === 'failed'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {doc.status}
                          </Badge>
                          {doc.extractedInvoiceCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {doc.extractedInvoiceCount} invoice{doc.extractedInvoiceCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
