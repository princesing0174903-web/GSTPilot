'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Textarea,
} from '@/components/ui/textarea';
import {
  Skeleton,
} from '@/components/ui/skeleton';
import {
  Separator,
} from '@/components/ui/separator';
import {
  ScrollArea,
} from '@/components/ui/scroll-area';
import {
  Progress,
} from '@/components/ui/progress';
import {
  Label,
} from '@/components/ui/label';
import {
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Eye,
  Edit,
  Wrench,
  FileText,
  X,
  CloudUpload,
  FileCheck,
  AlertCircle,
  FolderOpen,
  Receipt,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';
import type {
  Invoice,
  InvoiceType,
  InvoiceStatus,
  GSTR1Section,
  Client,
} from '@/types/gst';
import {
  formatCurrency,
  validateGSTIN,
  getGSTR1Section,
} from '@/lib/gst-utils';
import { useApp } from '@/contexts/AppContext';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface InvoiceWithClient extends Invoice {
  client?: Client;
}

interface ValidationIssue {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  issue: string;
  severity: 'critical' | 'warning';
  invoice: InvoiceWithClient;
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
}

interface InvoiceFormState {
  clientId: string;
  invoiceNumber: string;
  invoiceDate: string;
  sellerGstin: string;
  buyerGstin: string;
  invoiceType: InvoiceType;
  hsnCode: string;
  taxableValue: string;
  cgst: string;
  sgst: string;
  igst: string;
  cess: string;
  isInterState: boolean;
  reverseCharge: boolean;
  period: string;
  notes: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const EMPTY_FORM: InvoiceFormState = {
  clientId: '',
  invoiceNumber: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  sellerGstin: '',
  buyerGstin: '',
  invoiceType: 'B2B',
  hsnCode: '',
  taxableValue: '0',
  cgst: '0',
  sgst: '0',
  igst: '0',
  cess: '0',
  isInterState: false,
  reverseCharge: false,
  period: new Date().toISOString().slice(0, 7),
  notes: '',
};

const INVOICE_TYPES: InvoiceType[] = [
  'B2B', 'B2C Large', 'B2C Small', 'Export', 'Credit Note', 'Debit Note', 'Nil Rated', 'Exempted',
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Validated' },
  { value: 'filed', label: 'Filed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'B2B', label: 'B2B' },
  { value: 'B2C Large', label: 'B2C Large' },
  { value: 'B2C Small', label: 'B2C Small' },
  { value: 'Export', label: 'Export' },
  { value: 'Credit Note', label: 'Credit Note' },
  { value: 'Debit Note', label: 'Debit Note' },
];

const GSTR1_SECTIONS: { key: GSTR1Section; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
  { key: 'b2b', label: 'B2B Invoices', icon: <Receipt className="size-5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200' },
  { key: 'b2cl', label: 'B2C Large', icon: <FileText className="size-5" />, color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200' },
  { key: 'b2cs', label: 'B2C Small', icon: <FolderOpen className="size-5" />, color: 'text-teal-600', bgColor: 'bg-teal-50 border-teal-200' },
  { key: 'cdnr', label: 'CDNR', icon: <ArrowUpDown className="size-5" />, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  { key: 'cdnur', label: 'CDNUR', icon: <ArrowUpDown className="size-5" />, color: 'text-rose-600', bgColor: 'bg-rose-50 border-rose-200' },
  { key: 'exp', label: 'Export', icon: <TrendingUp className="size-5" />, color: 'text-violet-600', bgColor: 'bg-violet-50 border-violet-200' },
];

const ITEMS_PER_PAGE = 20;

// ─── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    filed:      { label: 'Filed',      className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    approved:   { label: 'Validated',  className: 'bg-green-50 text-green-700 border-green-200' },
    pending:    { label: 'Pending',    className: 'bg-amber-50 text-amber-700 border-amber-200' },
    draft:      { label: 'Draft',      className: 'bg-slate-50 text-slate-600 border-slate-200' },
    cancelled:  { label: 'Cancelled',  className: 'bg-red-50 text-red-700 border-red-200' },
    error:      { label: 'Error',      className: 'bg-red-50 text-red-700 border-red-200' },
  };
  const c = config[status] || { label: status, className: 'bg-slate-50 text-slate-600 border-slate-200' };
  return <Badge variant="outline" className={`${c.className} text-[10px] whitespace-nowrap font-medium`}>{c.label}</Badge>;
}

function TypeBadge({ type }: { type: string }) {
  const config: Record<string, { className: string }> = {
    'B2B':         { className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'B2C Large':   { className: 'bg-amber-50 text-amber-700 border-amber-200' },
    'B2C Small':   { className: 'bg-teal-50 text-teal-700 border-teal-200' },
    'Export':      { className: 'bg-violet-50 text-violet-700 border-violet-200' },
    'Credit Note': { className: 'bg-orange-50 text-orange-700 border-orange-200' },
    'Debit Note':  { className: 'bg-rose-50 text-rose-700 border-rose-200' },
    'Nil Rated':   { className: 'bg-slate-50 text-slate-600 border-slate-200' },
    'Exempted':    { className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  };
  const c = config[type] || { className: 'bg-slate-50 text-slate-600 border-slate-200' };
  return <Badge variant="outline" className={`${c.className} text-[10px] whitespace-nowrap font-medium`}>{type}</Badge>;
}

// ─── Animation Variants ─────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const cardHover = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.2 } },
};

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function InvoiceWorkspacePage() {
  const { selectedClientId } = useApp();

  // ── Data State ──
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filter State ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [activeSectionFilter, setActiveSectionFilter] = useState<string | null>(null);

  // ── Pagination ──
  const [currentPage, setCurrentPage] = useState(1);

  // ── Dialog State ──
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithClient | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithClient | null>(null);
  const [form, setForm] = useState<InvoiceFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [gstinValidation, setGstinValidation] = useState<{ seller: boolean | null; buyer: boolean | null }>({ seller: null, buyer: null });

  // ── Upload State ──
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Active Tab ──
  const [activeTab, setActiveTab] = useState('all');

  // ── Data Fetching ──
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedClientId) params.set('clientId', selectedClientId);

      const [invoicesRes, clientsRes] = await Promise.all([
        fetch(`/api/invoices?${params.toString()}`),
        fetch('/api/clients'),
      ]);

      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        setInvoices(data.invoices ?? data ?? []);
      }
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(data.clients ?? data ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterClient, filterType, activeSectionFilter]);

  // ── Derived Data ──
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (filterClient !== 'all' && inv.clientId !== filterClient) return false;
      if (filterStatus !== 'all') {
        if (filterStatus === 'pending') {
          if (inv.status !== 'draft' && inv.matchStatus !== 'mismatch' && inv.matchStatus !== 'partial_match') return false;
        } else if (inv.status !== filterStatus) return false;
      }
      if (filterType !== 'all' && inv.invoiceType !== filterType) return false;
      if (activeSectionFilter && inv.gstr1Section !== activeSectionFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          (inv.buyerName?.toLowerCase().includes(q) ?? false) ||
          (inv.buyerGstin?.toLowerCase().includes(q) ?? false) ||
          (inv.sellerGstin?.toLowerCase().includes(q) ?? false) ||
          (inv.client?.tradeName?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [invoices, filterClient, filterStatus, filterType, activeSectionFilter, searchQuery]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = invoices.length;
    const validated = invoices.filter((i) => i.status === 'approved' || i.status === 'filed').length;
    const pending = invoices.filter((i) => i.status === 'draft' || i.matchStatus === 'mismatch' || i.matchStatus === 'partial_match').length;
    const errors = invoices.filter((i) => i.riskLevel === 'high' || i.riskLevel === 'critical').length;
    return { total, validated, pending, errors };
  }, [invoices]);

  // ── Section Aggregates ──
  const sectionAggregates = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    for (const inv of invoices) {
      const sec = inv.gstr1Section || 'b2b';
      if (!map[sec]) map[sec] = { count: 0, total: 0 };
      map[sec].count++;
      map[sec].total += inv.totalAmount;
    }
    return map;
  }, [invoices]);

  // ── Validation Issues ──
  const validationIssues = useMemo(() => {
    const issues: ValidationIssue[] = [];
    for (const inv of invoices) {
      // Missing GSTIN
      if (inv.invoiceType === 'B2B' && !inv.buyerGstin) {
        issues.push({
          id: `${inv.id}-missing-gstin`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.client?.tradeName ?? 'Unknown',
          issue: 'Missing Buyer GSTIN',
          severity: 'critical',
          invoice: inv,
        });
      }
      // Invalid GSTIN
      if (inv.buyerGstin && !validateGSTIN(inv.buyerGstin)) {
        issues.push({
          id: `${inv.id}-invalid-gstin`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.client?.tradeName ?? 'Unknown',
          issue: 'Invalid Buyer GSTIN',
          severity: 'critical',
          invoice: inv,
        });
      }
      if (inv.sellerGstin && !validateGSTIN(inv.sellerGstin)) {
        issues.push({
          id: `${inv.id}-invalid-seller`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.client?.tradeName ?? 'Unknown',
          issue: 'Invalid Seller GSTIN',
          severity: 'critical',
          invoice: inv,
        });
      }
      // HSN Code Missing
      if (!inv.hsnCode) {
        issues.push({
          id: `${inv.id}-missing-hsn`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.client?.tradeName ?? 'Unknown',
          issue: 'HSN Code Missing',
          severity: 'warning',
          invoice: inv,
        });
      }
      // Tax Calculation Error
      const expectedTax = inv.taxableValue * 0.18;
      const actualTax = inv.cgst + inv.sgst + inv.igst;
      if (inv.taxableValue > 0 && Math.abs(actualTax - expectedTax) > expectedTax * 0.05 && inv.igst === 0) {
        issues.push({
          id: `${inv.id}-tax-error`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.client?.tradeName ?? 'Unknown',
          issue: 'Tax Calculation Error',
          severity: 'warning',
          invoice: inv,
        });
      }
      // Duplicate
      if (inv.matchStatus === 'duplicate') {
        issues.push({
          id: `${inv.id}-duplicate`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.client?.tradeName ?? 'Unknown',
          issue: 'Duplicate Invoice',
          severity: 'critical',
          invoice: inv,
        });
      }
    }
    return issues.sort((a, b) => (a.severity === 'critical' ? -1 : 1));
  }, [invoices]);

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE));
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInvoices.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInvoices, currentPage]);

  // ── Form Auto-Calculation ──
  const computedTax = useMemo(() => {
    const taxable = parseFloat(form.taxableValue) || 0;
    const cgst = parseFloat(form.cgst) || 0;
    const sgst = parseFloat(form.sgst) || 0;
    const igst = parseFloat(form.igst) || 0;
    const cess = parseFloat(form.cess) || 0;
    const totalGst = cgst + sgst + igst + cess;
    const total = taxable + totalGst;
    return { taxable, cgst, sgst, igst, cess, totalGst, total };
  }, [form.taxableValue, form.cgst, form.sgst, form.igst, form.cess]);

  // ── Form Handlers ──
  const handleFormChange = (field: keyof InvoiceFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleInterStateToggle = (checked: boolean) => {
    const taxable = parseFloat(form.taxableValue) || 0;
    if (checked) {
      const igst = Math.round(taxable * 18 / 100);
      setForm((prev) => ({ ...prev, isInterState: true, igst: String(igst), cgst: '0', sgst: '0' }));
    } else {
      const cgst = Math.round(taxable * 9 / 100);
      const sgst = Math.round(taxable * 9 / 100);
      setForm((prev) => ({ ...prev, isInterState: false, cgst: String(cgst), sgst: String(sgst), igst: '0' }));
    }
  };

  const handleTaxableValueChange = (value: string) => {
    const taxable = parseFloat(value) || 0;
    if (form.isInterState) {
      const igst = Math.round(taxable * 18 / 100);
      setForm((prev) => ({ ...prev, taxableValue: value, igst: String(igst) }));
    } else {
      const cgst = Math.round(taxable * 9 / 100);
      const sgst = Math.round(taxable * 9 / 100);
      setForm((prev) => ({ ...prev, taxableValue: value, cgst: String(cgst), sgst: String(sgst) }));
    }
  };

  const handleGstinBlur = (field: 'sellerGstin' | 'buyerGstin', value: string) => {
    if (!value) {
      setGstinValidation((prev) => ({ ...prev, [field === 'sellerGstin' ? 'seller' : 'buyer']: null }));
      return;
    }
    const isValid = validateGSTIN(value);
    setGstinValidation((prev) => ({ ...prev, [field === 'sellerGstin' ? 'seller' : 'buyer']: isValid }));
  };

  const openAddDialog = () => {
    setEditMode(false);
    setEditingInvoice(null);
    setForm(EMPTY_FORM);
    setGstinValidation({ seller: null, buyer: null });
    setAddDialogOpen(true);
  };

  const openEditDialog = (invoice: InvoiceWithClient) => {
    setEditMode(true);
    setEditingInvoice(invoice);
    setForm({
      clientId: invoice.clientId,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      sellerGstin: invoice.sellerGstin,
      buyerGstin: invoice.buyerGstin ?? '',
      invoiceType: invoice.invoiceType as InvoiceType,
      hsnCode: invoice.hsnCode ?? '',
      taxableValue: String(invoice.taxableValue),
      cgst: String(invoice.cgst),
      sgst: String(invoice.sgst),
      igst: String(invoice.igst),
      cess: String(invoice.cess),
      isInterState: invoice.igst > 0,
      reverseCharge: invoice.reverseCharge,
      period: invoice.period ?? '',
      notes: invoice.notes ?? '',
    });
    setGstinValidation({
      seller: invoice.sellerGstin ? validateGSTIN(invoice.sellerGstin) : null,
      buyer: invoice.buyerGstin ? validateGSTIN(invoice.buyerGstin) : null,
    });
    setAddDialogOpen(true);
  };

  const handleSubmitInvoice = async () => {
    if (!form.clientId || !form.invoiceNumber) return;
    setSubmitting(true);
    try {
      const gstr1Section = getGSTR1Section(form.invoiceType);
      const payload = {
        ...(editMode && editingInvoice ? { id: editingInvoice.id } : {}),
        clientId: form.clientId,
        invoiceNumber: form.invoiceNumber,
        invoiceDate: form.invoiceDate,
        sellerGstin: form.sellerGstin,
        buyerGstin: form.buyerGstin || null,
        invoiceType: form.invoiceType,
        gstr1Section,
        taxableValue: computedTax.taxable,
        cgst: computedTax.cgst,
        sgst: computedTax.sgst,
        igst: computedTax.igst,
        cess: computedTax.cess,
        totalAmount: computedTax.total,
        hsnCode: form.hsnCode || null,
        reverseCharge: form.reverseCharge,
        period: form.period,
        notes: form.notes || null,
      };

      if (editMode) {
        const res = await fetch('/api/invoices', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          console.error('Failed to update invoice:', data.error);
        }
      } else {
        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, status: 'draft', matchStatus: 'unmatched', riskLevel: 'low', riskScore: 0 }),
        });
        if (!res.ok) {
          const data = await res.json();
          console.error('Failed to create invoice:', data.error);
        }
      }

      setAddDialogOpen(false);
      setForm(EMPTY_FORM);
      await fetchData();
    } catch (err) {
      console.error('Failed to save invoice:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Upload Handlers ──
  const simulateUpload = (files: File[]) => {
    const newFiles: UploadedFile[] = files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type || f.name.split('.').pop() || 'unknown',
      progress: 0,
      status: 'uploading' as const,
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);

    newFiles.forEach((_, idx) => {
      const fileIdx = uploadedFiles.length + idx;
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 25 + 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setUploadedFiles((prev) =>
            prev.map((f, i) => i === fileIdx ? { ...f, progress: 100, status: 'processing' } : f)
          );
          setTimeout(() => {
            setUploadedFiles((prev) =>
              prev.map((f, i) => i === fileIdx ? { ...f, status: 'done' } : f)
            );
          }, 1500);
        } else {
          setUploadedFiles((prev) =>
            prev.map((f, i) => i === fileIdx ? { ...f, progress: Math.min(progress, 100) } : f)
          );
        }
      }, 400);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) simulateUpload(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) simulateUpload(files);
    e.target.value = '';
  };

  // ── Format file size ──
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // ── Loading Skeleton ──
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-80 rounded-lg" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
            <FileSpreadsheet className="size-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Invoices</h1>
            <p className="text-sm text-muted-foreground">Process, classify, and validate GST invoices</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setUploadDialogOpen(true)}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Upload className="size-4" />
            Upload Invoices
          </Button>
          <Button
            variant="outline"
            onClick={openAddDialog}
            className="gap-2"
          >
            <Plus className="size-4" />
            Add Invoice
          </Button>
        </div>
      </motion.div>

      {/* ── Quick Stats ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={itemVariants}>
          <motion.div variants={cardHover} initial="rest" whileHover="hover">
            <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Invoices</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100">
                    <FileSpreadsheet className="size-5 text-slate-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <motion.div variants={cardHover} initial="rest" whileHover="hover">
            <Card className="border-emerald-200/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Validated</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.validated}</p>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                    <ShieldCheck className="size-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <motion.div variants={cardHover} initial="rest" whileHover="hover">
            <Card className="border-amber-200/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Review</p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pending}</p>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                    <Clock className="size-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <motion.div variants={cardHover} initial="rest" whileHover="hover">
            <Card className="border-red-200/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Errors</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{stats.errors}</p>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-red-50">
                    <AlertTriangle className="size-5 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* ── Main Content Tabs ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setActiveSectionFilter(null); }}>
          <TabsList className="bg-slate-100/80 p-1">
            <TabsTrigger value="all" className="gap-1.5 text-xs sm:text-sm">
              <FileSpreadsheet className="size-3.5" />
              All Invoices
            </TabsTrigger>
            <TabsTrigger value="sections" className="gap-1.5 text-xs sm:text-sm">
              <FolderOpen className="size-3.5" />
              By Section
            </TabsTrigger>
            <TabsTrigger value="issues" className="gap-1.5 text-xs sm:text-sm">
              <AlertCircle className="size-3.5" />
              Validation Issues
              {validationIssues.length > 0 && (
                <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0 ml-1">
                  {validationIssues.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: All Invoices ── */}
          <TabsContent value="all" className="mt-4 space-y-4">
            {/* Filters */}
            <Card className="border-slate-200/60 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search invoices..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterClient} onValueChange={setFilterClient}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileSpreadsheet className="size-4" />
                    <span>{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}</span>
                    {activeSectionFilter && (
                      <Badge
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] cursor-pointer"
                        onClick={() => setActiveSectionFilter(null)}
                      >
                        {activeSectionFilter} <X className="size-2.5 ml-0.5" />
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Table */}
            <Card className="border-slate-200/60 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="whitespace-nowrap text-xs font-semibold">Invoice #</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold">Date</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold">Client</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold hidden md:table-cell">Seller GSTIN</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold hidden lg:table-cell">Buyer GSTIN</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold text-right">Taxable</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold text-right hidden sm:table-cell">GST</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold text-right">Total</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold hidden md:table-cell">Type</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold">Status</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {paginatedInvoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="h-32 text-center">
                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <FileSpreadsheet className="size-8 opacity-40" />
                                <p className="text-sm">No invoices found</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedInvoices.map((inv, idx) => (
                            <motion.tr
                              key={inv.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 8 }}
                              transition={{ duration: 0.2, delay: idx * 0.02 }}
                              className="group hover:bg-emerald-50/30 cursor-pointer transition-colors border-b border-slate-100"
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setDetailDialogOpen(true);
                              }}
                            >
                              <TableCell className="font-medium whitespace-nowrap text-xs py-3">
                                {inv.invoiceNumber}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground py-3">
                                {inv.invoiceDate}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs max-w-[120px] truncate py-3">
                                {inv.client?.tradeName ?? '—'}
                              </TableCell>
                              <TableCell className="font-mono text-[10px] whitespace-nowrap text-muted-foreground hidden md:table-cell py-3">
                                {inv.sellerGstin || '—'}
                              </TableCell>
                              <TableCell className="font-mono text-[10px] whitespace-nowrap text-muted-foreground hidden lg:table-cell py-3">
                                {inv.buyerGstin || '—'}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right text-xs font-medium py-3">
                                {formatCurrency(inv.taxableValue)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground hidden sm:table-cell py-3">
                                {formatCurrency(inv.cgst + inv.sgst + inv.igst)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right text-xs font-semibold py-3">
                                {formatCurrency(inv.totalAmount)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap hidden md:table-cell py-3">
                                <TypeBadge type={inv.invoiceType} />
                              </TableCell>
                              <TableCell className="whitespace-nowrap py-3">
                                <StatusBadge status={inv.status} />
                              </TableCell>
                              <TableCell className="whitespace-nowrap py-3">
                                <div className="flex items-center justify-center gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-7 p-0 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                    onClick={(e) => { e.stopPropagation(); openEditDialog(inv); }}
                                  >
                                    <Edit className="size-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </motion.tr>
                          ))
                        )}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                    <p className="text-xs text-muted-foreground">
                      Page {currentPage} of {totalPages} &middot; {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            className={`h-8 w-8 p-0 text-xs ${currentPage === pageNum ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab: By Section ── */}
          <TabsContent value="sections" className="mt-4">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {GSTR1_SECTIONS.map((section) => {
                const agg = sectionAggregates[section.key] || { count: 0, total: 0 };
                return (
                  <motion.div key={section.key} variants={itemVariants}>
                    <motion.div
                      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card
                        className="cursor-pointer border-slate-200/60 shadow-sm hover:shadow-md transition-all"
                        onClick={() => {
                          setActiveSectionFilter(section.key);
                          setActiveTab('all');
                        }}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div className={`flex size-11 items-center justify-center rounded-lg ${section.bgColor} border`}>
                              <span className={section.color}>{section.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-foreground">{section.label}</h3>
                              <div className="flex items-baseline gap-2 mt-1.5">
                                <span className="text-2xl font-bold text-foreground">{agg.count}</span>
                                <span className="text-xs text-muted-foreground">invoices</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Total: {formatCurrency(agg.total)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </motion.div>
                );
              })}
            </motion.div>

            {Object.keys(sectionAggregates).length === 0 && (
              <Card className="border-slate-200/60">
                <CardContent className="py-12 text-center">
                  <FolderOpen className="size-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No invoices to classify yet</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={openAddDialog}>
                    <Plus className="size-3.5" /> Add Invoice
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Tab: Validation Issues ── */}
          <TabsContent value="issues" className="mt-4">
            <Card className="border-slate-200/60 shadow-sm">
              <CardContent className="p-0">
                {validationIssues.length === 0 ? (
                  <div className="py-12 text-center">
                    <CheckCircle2 className="size-10 mx-auto text-emerald-400 mb-3" />
                    <p className="text-sm font-medium text-emerald-700">All Clear!</p>
                    <p className="text-xs text-muted-foreground mt-1">No validation issues found across your invoices</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          <TableHead className="whitespace-nowrap text-xs font-semibold">Invoice #</TableHead>
                          <TableHead className="whitespace-nowrap text-xs font-semibold">Client</TableHead>
                          <TableHead className="whitespace-nowrap text-xs font-semibold">Issue</TableHead>
                          <TableHead className="whitespace-nowrap text-xs font-semibold">Severity</TableHead>
                          <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationIssues.map((issue, idx) => (
                          <motion.tr
                            key={issue.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: idx * 0.03 }}
                            className="hover:bg-slate-50/60 transition-colors border-b border-slate-100"
                          >
                            <TableCell className="font-medium whitespace-nowrap text-xs py-3">
                              {issue.invoiceNumber}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground py-3">
                              {issue.clientName}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs py-3">
                              {issue.issue}
                            </TableCell>
                            <TableCell className="whitespace-nowrap py-3">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-medium ${
                                  issue.severity === 'critical'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {issue.severity === 'critical' ? (
                                  <><AlertCircle className="size-2.5 mr-1" /> Critical</>
                                ) : (
                                  <><AlertTriangle className="size-2.5 mr-1" /> Warning</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-center py-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                onClick={() => openEditDialog(issue.invoice)}
                              >
                                <Wrench className="size-3" />
                                Fix
                              </Button>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* ── Upload Dialog ── */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-5 text-emerald-600" />
              Upload Invoices
            </DialogTitle>
            <DialogDescription>
              Upload PDF, Excel, CSV, or image files containing invoices
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Drag & Drop Zone */}
            <div
              className={`relative rounded-xl border-2 border-dashed transition-all duration-200 ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-50/50'
                  : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center gap-3 py-10 px-4 text-center">
                <div className={`flex size-12 items-center justify-center rounded-full ${
                  isDragging ? 'bg-emerald-100' : 'bg-slate-100'
                } transition-colors`}>
                  <CloudUpload className={`size-6 ${isDragging ? 'text-emerald-600' : 'text-slate-400'} transition-colors`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {isDragging ? 'Drop files here' : 'Drag & drop files here'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to browse &middot; PDF, Excel, CSV, Images
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FolderOpen className="size-3.5" />
                  Browse Files
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <div className={`flex size-8 items-center justify-center rounded-md ${
                        file.status === 'done'
                          ? 'bg-emerald-100'
                          : file.status === 'error'
                          ? 'bg-red-100'
                          : 'bg-amber-100'
                      }`}>
                        {file.status === 'done' ? (
                          <FileCheck className="size-4 text-emerald-600" />
                        ) : file.status === 'error' ? (
                          <AlertCircle className="size-4 text-red-600" />
                        ) : (
                          <FileText className="size-4 text-amber-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
                        {file.status === 'uploading' && (
                          <Progress value={file.progress} className="h-1 mt-1" />
                        )}
                      </div>
                      <div>
                        {file.status === 'uploading' && (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            {Math.round(file.progress)}%
                          </Badge>
                        )}
                        {file.status === 'processing' && (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            Processing...
                          </Badge>
                        )}
                        {file.status === 'done' && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            Done
                          </Badge>
                        )}
                        {file.status === 'error' && (
                          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                            Error
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadDialogOpen(false); setUploadedFiles([]); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Invoice Dialog ── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-emerald-600" />
              {editMode ? 'Edit Invoice' : 'Add Invoice'}
            </DialogTitle>
            <DialogDescription>
              {editMode ? 'Update invoice details and fix validation issues' : 'Create a new GST invoice record'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* Basic Details */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Basic Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Client *</Label>
                  <Select value={form.clientId} onValueChange={(v) => handleFormChange('clientId', v)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.tradeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Invoice Number *</Label>
                  <Input
                    placeholder="e.g. INV/2024/001"
                    value={form.invoiceNumber}
                    onChange={(e) => handleFormChange('invoiceNumber', e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Date *</Label>
                  <Input
                    type="date"
                    value={form.invoiceDate}
                    onChange={(e) => handleFormChange('invoiceDate', e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Invoice Type</Label>
                  <Select value={form.invoiceType} onValueChange={(v) => handleFormChange('invoiceType', v as InvoiceType)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVOICE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* GSTIN Details */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">GSTIN Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Seller GSTIN</Label>
                  <div className="relative">
                    <Input
                      placeholder="Seller GSTIN"
                      value={form.sellerGstin}
                      onChange={(e) => handleFormChange('sellerGstin', e.target.value.toUpperCase())}
                      onBlur={(e) => handleGstinBlur('sellerGstin', e.target.value)}
                      className={`h-9 text-sm font-mono pr-8 ${
                        gstinValidation.seller === false ? 'border-red-300 focus-visible:ring-red-200' :
                        gstinValidation.seller === true ? 'border-emerald-300 focus-visible:ring-emerald-200' : ''
                      }`}
                    />
                    {gstinValidation.seller === true && (
                      <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                    )}
                    {gstinValidation.seller === false && (
                      <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-red-500" />
                    )}
                  </div>
                  {gstinValidation.seller === false && (
                    <p className="text-[10px] text-red-500 mt-0.5">Invalid GSTIN format</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Buyer GSTIN</Label>
                  <div className="relative">
                    <Input
                      placeholder="Buyer GSTIN"
                      value={form.buyerGstin}
                      onChange={(e) => handleFormChange('buyerGstin', e.target.value.toUpperCase())}
                      onBlur={(e) => handleGstinBlur('buyerGstin', e.target.value)}
                      className={`h-9 text-sm font-mono pr-8 ${
                        gstinValidation.buyer === false ? 'border-red-300 focus-visible:ring-red-200' :
                        gstinValidation.buyer === true ? 'border-emerald-300 focus-visible:ring-emerald-200' : ''
                      }`}
                    />
                    {gstinValidation.buyer === true && (
                      <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                    )}
                    {gstinValidation.buyer === false && (
                      <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-red-500" />
                    )}
                  </div>
                  {gstinValidation.buyer === false && (
                    <p className="text-[10px] text-red-500 mt-0.5">Invalid GSTIN format</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Tax Details */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tax Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">HSN Code</Label>
                  <Input
                    placeholder="e.g. 998314"
                    value={form.hsnCode}
                    onChange={(e) => handleFormChange('hsnCode', e.target.value)}
                    className="h-9 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Taxable Value (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.taxableValue}
                    onChange={(e) => handleTaxableValueChange(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">CGST (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.cgst}
                    onChange={(e) => handleFormChange('cgst', e.target.value)}
                    className="h-9 text-sm"
                    disabled={form.isInterState}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">SGST (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.sgst}
                    onChange={(e) => handleFormChange('sgst', e.target.value)}
                    className="h-9 text-sm"
                    disabled={form.isInterState}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">IGST (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.igst}
                    onChange={(e) => handleFormChange('igst', e.target.value)}
                    className="h-9 text-sm"
                    disabled={!form.isInterState}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Cess (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.cess}
                    onChange={(e) => handleFormChange('cess', e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-6 mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isInterState}
                    onChange={(e) => handleInterStateToggle(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-medium">Inter-State Supply</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.reverseCharge}
                    onChange={(e) => handleFormChange('reverseCharge', e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-medium">Reverse Charge</span>
                </label>
              </div>
            </div>

            <Separator />

            {/* Total Preview */}
            <div className="rounded-lg border bg-slate-50/80 p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Summary</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground">Taxable Value</p>
                  <p className="font-medium">{formatCurrency(computedTax.taxable)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Total GST</p>
                  <p className="font-medium">{formatCurrency(computedTax.totalGst)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Cess</p>
                  <p className="font-medium">{formatCurrency(computedTax.cess)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Total Amount</p>
                  <p className="font-bold text-emerald-700 text-base">{formatCurrency(computedTax.total)}</p>
                </div>
              </div>
            </div>

            {/* Period & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Period</Label>
                <Input
                  type="month"
                  value={form.period}
                  onChange={(e) => handleFormChange('period', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes</Label>
                <Input
                  placeholder="Optional notes..."
                  value={form.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitInvoice}
              disabled={submitting || !form.clientId || !form.invoiceNumber}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submitting ? (
                <>
                  <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  {editMode ? 'Update Invoice' : 'Save Invoice'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invoice Detail Dialog ── */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          {selectedInvoice && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="size-5 text-emerald-600" />
                  {selectedInvoice.invoiceNumber}
                </DialogTitle>
                <DialogDescription>
                  Invoice details and status
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedInvoice.status} />
                  <TypeBadge type={selectedInvoice.invoiceType} />
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                    {selectedInvoice.gstr1Section.toUpperCase()}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Client</p>
                    <p className="font-medium text-xs">{selectedInvoice.client?.tradeName ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Date</p>
                    <p className="font-medium text-xs">{selectedInvoice.invoiceDate}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Seller GSTIN</p>
                    <p className="font-mono text-[10px]">{selectedInvoice.sellerGstin || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Buyer GSTIN</p>
                    <p className="font-mono text-[10px]">{selectedInvoice.buyerGstin || '—'}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Taxable Value</p>
                    <p className="font-medium">{formatCurrency(selectedInvoice.taxableValue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">CGST</p>
                    <p className="font-medium">{formatCurrency(selectedInvoice.cgst)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">SGST</p>
                    <p className="font-medium">{formatCurrency(selectedInvoice.sgst)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">IGST</p>
                    <p className="font-medium">{formatCurrency(selectedInvoice.igst)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Cess</p>
                    <p className="font-medium">{formatCurrency(selectedInvoice.cess)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                    <p className="font-bold text-emerald-700 text-base">{formatCurrency(selectedInvoice.totalAmount)}</p>
                  </div>
                </div>

                {selectedInvoice.hsnCode && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">HSN:</span>{' '}
                    <span className="font-mono">{selectedInvoice.hsnCode}</span>
                  </div>
                )}

                {selectedInvoice.notes && (
                  <div className="text-xs bg-slate-50 rounded-lg p-3">
                    <p className="text-muted-foreground mb-1">Notes</p>
                    <p>{selectedInvoice.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    openEditDialog(selectedInvoice);
                  }}
                >
                  <Edit className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailDialogOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
