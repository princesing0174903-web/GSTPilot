'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  DialogTrigger,
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
  Checkbox,
} from '@/components/ui/checkbox';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  Check,
  X,
  Eye,
  Edit,
  Trash2,
  Upload,
  ChevronDown,
} from 'lucide-react';
import type {
  Invoice,
  InvoiceType,
  InvoiceStatus,
  GSTR1Section,
  Client,
  MATCH_STATUS_CONFIG,
  RISK_LEVEL_CONFIG,
  INVOICE_TYPE_TO_SECTION,
  GSTR1_SECTION_LABELS,
} from '@/types/gst';
import {
  formatCurrency,
  formatNumber,
  periodToLabel,
  getGSTR1Section,
} from '@/lib/gst-utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const INVOICE_TYPE_COLORS: Record<string, { color: string; bgColor: string }> = {
  'B2B': { color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
  'B2C Large': { color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  'B2C Small': { color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200' },
  'Export': { color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  'Credit Note': { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
  'Debit Note': { color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  'Nil Rated': { color: 'text-slate-700', bgColor: 'bg-slate-50 border-slate-200' },
  'Exempted': { color: 'text-cyan-700', bgColor: 'bg-cyan-50 border-cyan-200' },
};

const INVOICE_STATUS_COLORS: Record<string, { color: string; bgColor: string }> = {
  draft: { color: 'text-slate-700', bgColor: 'bg-slate-100 border-slate-200' },
  approved: { color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
  filed: { color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  cancelled: { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
};

const MATCH_STATUS_CONFIG_LOCAL: Record<string, { label: string; color: string; bgColor: string }> = {
  perfect_match: { label: 'Perfect Match', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
  partial_match: { label: 'Partial Match', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  mismatch: { label: 'Mismatch', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
  missing_in_books: { label: 'Missing in Books', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  missing_in_gstr: { label: 'Missing in GSTR', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  unmatched: { label: 'Unmatched', color: 'text-slate-700', bgColor: 'bg-slate-50 border-slate-200' },
};

const RISK_LEVEL_CONFIG_LOCAL: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  low: { label: 'Low', color: 'text-emerald-700', bgColor: 'bg-emerald-50', icon: '✓' },
  medium: { label: 'Medium', color: 'text-amber-700', bgColor: 'bg-amber-50', icon: '⚠' },
  high: { label: 'High', color: 'text-orange-700', bgColor: 'bg-orange-50', icon: '▲' },
  critical: { label: 'Critical', color: 'text-red-700', bgColor: 'bg-red-50', icon: '✕' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMatchStatusBadge(status: string) {
  const cfg = MATCH_STATUS_CONFIG_LOCAL[status];
  if (!cfg) return <Badge variant="secondary">{status}</Badge>;
  return (
    <Badge variant="outline" className={`${cfg.color} ${cfg.bgColor} text-[10px] whitespace-nowrap`}>
      {cfg.label}
    </Badge>
  );
}

function getRiskLevelBadge(level: string) {
  const cfg = RISK_LEVEL_CONFIG_LOCAL[level];
  if (!cfg) return <Badge variant="secondary">{level}</Badge>;
  return (
    <Badge variant="outline" className={`${cfg.color} ${cfg.bgColor} text-[10px] whitespace-nowrap gap-0.5`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </Badge>
  );
}

function getInvoiceTypeBadge(type: string) {
  const cfg = INVOICE_TYPE_COLORS[type];
  if (!cfg) return <Badge variant="secondary">{type}</Badge>;
  return (
    <Badge variant="outline" className={`${cfg.color} ${cfg.bgColor} text-[10px] whitespace-nowrap`}>
      {type}
    </Badge>
  );
}

function getInvoiceStatusBadge(status: string) {
  const cfg = INVOICE_STATUS_COLORS[status];
  if (!cfg) return <Badge variant="secondary">{status}</Badge>;
  return (
    <Badge variant="outline" className={`${cfg.color} ${cfg.bgColor} text-[10px] whitespace-nowrap`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

// ─── Invoice with Client ──────────────────────────────────────────────────────

interface InvoiceWithClient extends Invoice {
  client?: Client;
}

// ─── New Invoice Form State ───────────────────────────────────────────────────

interface NewInvoiceForm {
  clientId: string;
  invoiceNumber: string;
  invoiceDate: string;
  buyerGstin: string;
  buyerName: string;
  invoiceType: InvoiceType;
  taxableValue: string;
  cgstRate: string;
  sgstRate: string;
  igstRate: string;
  isInterState: boolean;
  hsnCode: string;
  reverseCharge: boolean;
  period: string;
  notes: string;
}

const emptyInvoiceForm: NewInvoiceForm = {
  clientId: '',
  invoiceNumber: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  buyerGstin: '',
  buyerName: '',
  invoiceType: 'B2B',
  taxableValue: '0',
  cgstRate: '9',
  sgstRate: '9',
  igstRate: '18',
  isInterState: false,
  hsnCode: '',
  reverseCharge: false,
  period: new Date().toISOString().slice(0, 7),
  notes: '',
};

// ─── Skeletons ────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceWorkspacePage() {
  // ─── State ────────────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Add/Edit Invoice dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithClient | null>(null);
  const [form, setForm] = useState<NewInvoiceForm>(emptyInvoiceForm);
  const [submitting, setSubmitting] = useState(false);

  // Invoice Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithClient | null>(null);

  // ─── Data Fetching ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [invoicesRes, clientsRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/clients'),
      ]);

      if (invoicesRes.ok) {
        const invData = await invoicesRes.json();
        setInvoices(invData.invoices ?? invData ?? []);
      }
      if (clientsRes.ok) {
        const cliData = await clientsRes.json();
        setClients(cliData.clients ?? cliData ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Derived Data ─────────────────────────────────────────────────────────
  const periods = Array.from(new Set(invoices.map((inv) => inv.period).filter(Boolean) as string[]));

  const filteredInvoices = invoices.filter((inv) => {
    if (filterClient !== 'all' && inv.clientId !== filterClient) return false;
    if (filterPeriod !== 'all' && inv.period !== filterPeriod) return false;
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.buyerName?.toLowerCase().includes(q) ?? false) ||
        (inv.buyerGstin?.toLowerCase().includes(q) ?? false) ||
        (inv.client?.tradeName?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  // ─── Form Handlers ────────────────────────────────────────────────────────
  const handleFormChange = (field: keyof NewInvoiceForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddInvoice = async () => {
    if (!form.clientId || !form.invoiceNumber) return;
    setSubmitting(true);
    try {
      const taxableValue = parseFloat(form.taxableValue) || 0;
      const isInterState = form.isInterState;
      const cgstRate = parseFloat(form.cgstRate) || 0;
      const sgstRate = parseFloat(form.sgstRate) || 0;
      const igstRate = parseFloat(form.igstRate) || 0;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isInterState) {
        igst = Math.round(taxableValue * igstRate / 100);
      } else {
        cgst = Math.round(taxableValue * cgstRate / 100);
        sgst = Math.round(taxableValue * sgstRate / 100);
      }

      const totalAmount = taxableValue + cgst + sgst + igst;
      const gstr1Section = getGSTR1Section(form.invoiceType);

      const client = clients.find((c) => c.id === form.clientId);

      const payload = {
        clientId: form.clientId,
        invoiceNumber: form.invoiceNumber,
        invoiceDate: form.invoiceDate,
        sellerGstin: client?.gstin ?? '',
        buyerGstin: form.buyerGstin || null,
        buyerName: form.buyerName || null,
        invoiceType: form.invoiceType,
        gstr1Section,
        taxableValue,
        cgst,
        sgst,
        igst,
        cess: 0,
        totalAmount,
        hsnCode: form.hsnCode || null,
        reverseCharge: form.reverseCharge,
        status: 'draft',
        matchStatus: 'unmatched',
        riskLevel: 'low',
        riskScore: 0,
        period: form.period,
        notes: form.notes || null,
      };

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setAddDialogOpen(false);
        setForm(emptyInvoiceForm);
        await fetchData();
      } else {
        const data = await res.json();
        console.error('Failed to add invoice:', data.error);
      }
    } catch (err) {
      console.error('Failed to add invoice:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAddDialog = () => {
    setEditMode(false);
    setEditingInvoice(null);
    setForm(emptyInvoiceForm);
    setAddDialogOpen(true);
  };

  const handleOpenEditDialog = (invoice: InvoiceWithClient) => {
    setEditMode(true);
    setEditingInvoice(invoice);
    setForm({
      clientId: invoice.clientId,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      buyerGstin: invoice.buyerGstin ?? '',
      buyerName: invoice.buyerName ?? '',
      invoiceType: invoice.invoiceType as InvoiceType,
      taxableValue: String(invoice.taxableValue),
      cgstRate: '9',
      sgstRate: '9',
      igstRate: '18',
      isInterState: invoice.igst > 0,
      hsnCode: invoice.hsnCode ?? '',
      reverseCharge: invoice.reverseCharge,
      period: invoice.period ?? '',
      notes: invoice.notes ?? '',
    });
    setAddDialogOpen(true);
  };

  // ─── Batch Actions ────────────────────────────────────────────────────────
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map((inv) => inv.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchApprove = async () => {
    // Approve selected draft invoices locally
    setInvoices((prev) =>
      prev.map((inv) =>
        selectedIds.has(inv.id) && inv.status === 'draft'
          ? { ...inv, status: 'approved' as const }
          : inv
      )
    );
    setSelectedIds(new Set());
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-48" />
        </div>
        <TableSkeleton />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
            <FileSpreadsheet className="size-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Invoice Workspace</h1>
            <p className="text-sm text-muted-foreground">
              Manage invoices, track match status, and assess risk levels
            </p>
          </div>
        </div>
        <Button
          onClick={handleOpenAddDialog}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="size-4" />
          Add Invoice
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger>
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tradeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="All Periods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Periods</SelectItem>
                {periods.sort().map((p) => (
                  <SelectItem key={p} value={p}>
                    {periodToLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="filed">Filed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoice, buyer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="size-4" />
              <span>{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}</span>
              {selectedIds.size > 0 && (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 ml-2">
                  {selectedIds.size} selected
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                <Check className="size-4" />
                {selectedIds.size} invoice{selectedIds.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleBatchApprove}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="size-3.5" />
                  Approve Selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedIds(new Set())}
                  className="gap-1.5"
                >
                  <X className="size-3.5" />
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4 text-emerald-600" />
            Invoice Register
            <Badge variant="secondary" className="ml-2">
              {filteredInvoices.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            All invoices with tax breakdown, reconciliation status, and risk assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table style={{ minWidth: 1100 }}>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Invoice #</TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="whitespace-nowrap">Client</TableHead>
                  <TableHead className="whitespace-nowrap">Buyer GSTIN</TableHead>
                  <TableHead className="whitespace-nowrap">Type</TableHead>
                  <TableHead className="whitespace-nowrap">GSTR-1 Section</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Taxable Value</TableHead>
                  <TableHead className="whitespace-nowrap text-right">CGST</TableHead>
                  <TableHead className="whitespace-nowrap text-right">SGST</TableHead>
                  <TableHead className="whitespace-nowrap text-right">IGST</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Cess</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Total</TableHead>
                  <TableHead className="whitespace-nowrap">Match Status</TableHead>
                  <TableHead className="whitespace-nowrap">Risk Level</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={17} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="size-8 text-muted-foreground/50" />
                        <p>No invoices found matching your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((inv) => {
                    const gstr1LabelMap: Record<string, string> = {
                      b2b: 'B2B Invoices',
                      b2cl: 'B2C Large',
                      b2cs: 'B2C Small',
                      cdnr: 'CDN (Reg)',
                      cdnur: 'CDN (Unreg)',
                      exp: 'Export',
                    };
                    return (
                      <TableRow
                        key={inv.id}
                        className={`group hover:bg-muted/30 ${
                          selectedIds.has(inv.id) ? 'bg-emerald-50/50' : ''
                        }`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(inv.id)}
                            onCheckedChange={() => toggleSelect(inv.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap text-xs">
                          {inv.invoiceNumber}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                          {inv.invoiceDate}
                        </TableCell>
                        <TableCell className="whitespace-nowrap max-w-[120px] truncate text-xs">
                          {inv.client?.tradeName ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono text-[10px] whitespace-nowrap text-muted-foreground">
                          {inv.buyerGstin || '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {getInvoiceTypeBadge(inv.invoiceType)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px] border-slate-200 bg-slate-50 text-slate-600">
                            {gstr1LabelMap[inv.gstr1Section] ?? inv.gstr1Section}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-medium text-xs">
                          {formatCurrency(inv.taxableValue)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                          {formatCurrency(inv.cgst)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                          {formatCurrency(inv.sgst)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                          {formatCurrency(inv.igst)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                          {formatCurrency(inv.cess)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-semibold text-xs">
                          {formatCurrency(inv.totalAmount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {getMatchStatusBadge(inv.matchStatus)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {getRiskLevelBadge(inv.riskLevel)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {getInvoiceStatusBadge(inv.status)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <TooltipProvider>
                            <div className="flex items-center justify-center gap-0.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => {
                                      setSelectedInvoice(inv);
                                      setDetailDialogOpen(true);
                                    }}
                                  >
                                    <Eye className="size-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View</TooltipContent>
                              </Tooltip>
                              {inv.status === 'draft' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="size-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                      onClick={() => {
                                        setInvoices((prev) =>
                                          prev.map((i) =>
                                            i.id === inv.id
                                              ? { ...i, status: 'approved' as const }
                                              : i
                                          )
                                        );
                                      }}
                                    >
                                      <Check className="size-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Approve</TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    onClick={() => handleOpenEditDialog(inv)}
                                  >
                                    <Edit className="size-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => {
                                      setInvoices((prev) =>
                                        prev.map((i) =>
                                          i.id === inv.id
                                            ? { ...i, status: 'cancelled' as const }
                                            : i
                                        )
                                      );
                                    }}
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Cancel</TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Invoice Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-emerald-600" />
              {editMode ? 'Edit Invoice' : 'Add New Invoice'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Client *</label>
                <Select value={form.clientId} onValueChange={(v) => handleFormChange('clientId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.tradeName} ({c.gstin})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Invoice Number *</label>
                <Input
                  placeholder="e.g. INV/2024/001"
                  value={form.invoiceNumber}
                  onChange={(e) => handleFormChange('invoiceNumber', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Invoice Date *</label>
                <Input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => handleFormChange('invoiceDate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Invoice Type</label>
                <Select value={form.invoiceType} onValueChange={(v) => handleFormChange('invoiceType', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['B2B', 'B2C Large', 'B2C Small', 'Export', 'Credit Note', 'Debit Note', 'Nil Rated', 'Exempted'] as InvoiceType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Buyer GSTIN</label>
                <Input
                  placeholder="Buyer GSTIN"
                  value={form.buyerGstin}
                  onChange={(e) => handleFormChange('buyerGstin', e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Buyer Name</label>
                <Input
                  placeholder="Buyer name"
                  value={form.buyerName}
                  onChange={(e) => handleFormChange('buyerName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Taxable Value (₹)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.taxableValue}
                  onChange={(e) => handleFormChange('taxableValue', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">HSN Code</label>
                <Input
                  placeholder="e.g. 998314"
                  value={form.hsnCode}
                  onChange={(e) => handleFormChange('hsnCode', e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Period</label>
                <Input
                  type="month"
                  value={form.period}
                  onChange={(e) => handleFormChange('period', e.target.value)}
                />
              </div>
              <div className="flex items-center gap-6 pt-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.isInterState}
                    onCheckedChange={(v) => handleFormChange('isInterState', !!v)}
                  />
                  <label className="text-sm">Inter-State Supply</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.reverseCharge}
                    onCheckedChange={(v) => handleFormChange('reverseCharge', !!v)}
                  />
                  <label className="text-sm">Reverse Charge</label>
                </div>
              </div>
            </div>

            {/* Tax Breakdown Preview */}
            <Separator />
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <h4 className="text-sm font-medium">Tax Breakdown Preview</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">CGST:</span>
                  <span className="ml-2 font-medium">
                    {formatCurrency(
                      form.isInterState
                        ? 0
                        : Math.round((parseFloat(form.taxableValue) || 0) * (parseFloat(form.cgstRate) || 0) / 100)
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">SGST:</span>
                  <span className="ml-2 font-medium">
                    {formatCurrency(
                      form.isInterState
                        ? 0
                        : Math.round((parseFloat(form.taxableValue) || 0) * (parseFloat(form.sgstRate) || 0) / 100)
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">IGST:</span>
                  <span className="ml-2 font-medium">
                    {formatCurrency(
                      form.isInterState
                        ? Math.round((parseFloat(form.taxableValue) || 0) * (parseFloat(form.igstRate) || 0) / 100)
                        : 0
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total:</span>
                  <span className="ml-2 font-bold text-emerald-700">
                    {formatCurrency(
                      (parseFloat(form.taxableValue) || 0) +
                      (form.isInterState
                        ? Math.round((parseFloat(form.taxableValue) || 0) * (parseFloat(form.igstRate) || 0) / 100)
                        : Math.round((parseFloat(form.taxableValue) || 0) * (parseFloat(form.cgstRate) || 0) / 100) +
                          Math.round((parseFloat(form.taxableValue) || 0) * (parseFloat(form.sgstRate) || 0) / 100)
                      )
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Optional notes..."
                value={form.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddInvoice}
              disabled={!form.clientId || !form.invoiceNumber || submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? 'Saving...' : editMode ? 'Update Invoice' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedInvoice && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
                    <FileSpreadsheet className="size-5 text-emerald-700" />
                  </div>
                  <div>
                    <div>Invoice {selectedInvoice.invoiceNumber}</div>
                    <div className="text-sm font-normal text-muted-foreground">
                      {selectedInvoice.client?.tradeName ?? 'Unknown Client'} &middot;{' '}
                      {selectedInvoice.invoiceDate}
                    </div>
                  </div>
                  <div className="ml-auto flex gap-2">
                    {getInvoiceStatusBadge(selectedInvoice.status)}
                    {getInvoiceTypeBadge(selectedInvoice.invoiceType)}
                  </div>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="details" className="space-y-4">
                <TabsList className="w-full flex-wrap sm:w-auto">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="tax">Tax Breakdown</TabsTrigger>
                  <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="space-y-4">
                  <Card>
                    <CardContent className="pt-4 space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Invoice #</span>
                          <span className="font-medium">{selectedInvoice.invoiceNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Date</span>
                          <span className="font-medium">{selectedInvoice.invoiceDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Seller GSTIN</span>
                          <span className="font-mono text-xs">{selectedInvoice.sellerGstin}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Buyer GSTIN</span>
                          <span className="font-mono text-xs">{selectedInvoice.buyerGstin || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Buyer Name</span>
                          <span className="font-medium">{selectedInvoice.buyerName || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">HSN Code</span>
                          <span className="font-mono text-xs">{selectedInvoice.hsnCode || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Period</span>
                          <span className="font-medium">{selectedInvoice.period ? periodToLabel(selectedInvoice.period) : '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Reverse Charge</span>
                          <span className="font-medium">{selectedInvoice.reverseCharge ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tax Breakdown Tab */}
                <TabsContent value="tax" className="space-y-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Taxable Value</span>
                          <span className="font-semibold">{formatCurrency(selectedInvoice.taxableValue)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">CGST</span>
                          <span className="font-medium">{formatCurrency(selectedInvoice.cgst)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">SGST</span>
                          <span className="font-medium">{formatCurrency(selectedInvoice.sgst)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">IGST</span>
                          <span className="font-medium">{formatCurrency(selectedInvoice.igst)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Cess</span>
                          <span className="font-medium">{formatCurrency(selectedInvoice.cess)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-bold">
                          <span>Total Tax</span>
                          <span className="text-emerald-700">
                            {formatCurrency(selectedInvoice.cgst + selectedInvoice.sgst + selectedInvoice.igst + selectedInvoice.cess)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-bold">
                          <span>Total Amount</span>
                          <span className="text-emerald-700">{formatCurrency(selectedInvoice.totalAmount)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Reconciliation Tab */}
                <TabsContent value="reconciliation" className="space-y-4">
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border bg-muted/30">
                          <p className="text-xs text-muted-foreground">Match Status</p>
                          <div className="mt-1">{getMatchStatusBadge(selectedInvoice.matchStatus)}</div>
                        </div>
                        <div className="p-3 rounded-lg border bg-muted/30">
                          <p className="text-xs text-muted-foreground">Risk Level</p>
                          <div className="mt-1">{getRiskLevelBadge(selectedInvoice.riskLevel)}</div>
                        </div>
                        <div className="p-3 rounded-lg border bg-muted/30">
                          <p className="text-xs text-muted-foreground">Risk Score</p>
                          <p className={`text-lg font-bold ${
                            selectedInvoice.riskScore >= 75
                              ? 'text-red-600'
                              : selectedInvoice.riskScore >= 50
                              ? 'text-orange-600'
                              : selectedInvoice.riskScore >= 25
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}>
                            {selectedInvoice.riskScore}/100
                          </p>
                        </div>
                        <div className="p-3 rounded-lg border bg-muted/30">
                          <p className="text-xs text-muted-foreground">GSTR-1 Section</p>
                          <p className="text-sm font-medium mt-1">{selectedInvoice.gstr1Section}</p>
                        </div>
                      </div>
                      {selectedInvoice.aiExplanation && (
                        <div className="p-3 rounded-lg border bg-amber-50 border-amber-200">
                          <p className="text-xs font-medium text-amber-700 mb-1">AI Explanation</p>
                          <p className="text-xs text-amber-800">{selectedInvoice.aiExplanation}</p>
                        </div>
                      )}
                      {selectedInvoice.notes && (
                        <div className="p-3 rounded-lg border bg-muted/30">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                          <p className="text-xs">{selectedInvoice.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
