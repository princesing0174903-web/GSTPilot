'use client';

import React, { useState, useCallback, useMemo } from 'react';
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
  Label,
} from '@/components/ui/label';
import {
  Textarea,
} from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  Inbox,
  Loader2,
  Search,
  Trash2,
  Plus,
  X,
  FileSpreadsheet,
  FileJson,
  TrendingUp,
  Clock,
  ShieldAlert,
  CalendarPlus,
} from 'lucide-react';
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
import { toast } from 'sonner';
import { ProfessionalEmptyState } from '@/components/shared/ProfessionalEmptyState';
import { useApp } from '@/contexts/AppContext';
import { useOrg } from '@/contexts/OrgContext';
import {
  useInvoicesApi,
  type ApiInvoice,
  type CreateInvoicePayload,
} from '@/hooks/useInvoicesApi';
import { useClientsApi } from '@/hooks/useClientsApi';

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
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
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

// ─── Status Badge Configs ─────────────────────────────────────────────────────

const STATUS_BADGE: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-zinc-900 text-zinc-200 border-zinc-800' },
  approved: { label: 'Approved', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  filed: { label: 'Filed', className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

// The Prisma `Invoice.status` column is a free-form String and the Invoice
// Cloud™ API writes `'issued'` for new invoices. Map that onto the badge set
// so the table doesn't render a blank status pill.
const STATUS_BADGE_EXTENDED: Record<string, { label: string; className: string }> = {
  ...STATUS_BADGE,
  issued: { label: 'Issued', className: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  paid: { label: 'Paid', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  partially_paid: { label: 'Partial', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  overdue: { label: 'Overdue', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

const RISK_BADGE: Record<RiskLevel, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  medium: { label: 'Medium', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  high: { label: 'High', className: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  critical: { label: 'Critical', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

// ─── Create Invoice dialog helpers ────────────────────────────────────────────

interface LineItemInput {
  description: string;
  hsnCode: string;
  quantity: string;
  unitPrice: string;
  gstRate: string;
}

const EMPTY_LINE_ITEM: LineItemInput = {
  description: '',
  hsnCode: '',
  quantity: '1',
  unitPrice: '0',
  gstRate: '18',
};

const GST_RATES = [0, 5, 12, 18, 28];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceWorkspacePage() {
  // ── App navigation + org context ──
  const { setCurrentView } = useApp();
  const { organization } = useOrg();

  // ── Prisma-backed data hooks ──
  const {
    invoices,
    loading: invoicesLoading,
    error: invoicesError,
    refetch: refetchInvoices,
    createInvoice,
    approveInvoice,
    deleteInvoice,
    saving,
  } = useInvoicesApi();

  const {
    clients,
    loading: clientsLoading,
    error: clientsError,
  } = useClientsApi();

  // ── Client map for name lookups ──
  const clientMap = useMemo(() => {
    const map = new Map<string, { id: string; tradeName: string; gstin: string }>();
    for (const c of clients) {
      map.set(c.id, { id: c.id, tradeName: c.tradeName, gstin: c.gstin });
    }
    return map;
  }, [clients]);

  // ── Filter State ──
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Action State ──
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Create Invoice dialog state ──
  const [createOpen, setCreateOpen] = useState(false);
  const [formClient, setFormClient] = useState<string>('');
  const [formInvoiceDate, setFormInvoiceDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formDueDate, setFormDueDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [lineItems, setLineItems] = useState<LineItemInput[]>([{ ...EMPTY_LINE_ITEM }]);
  const [submitting, setSubmitting] = useState(false);

  // ── Loading ──
  const loading = invoicesLoading || clientsLoading;

  // ── Summary Metrics ──
  const summary = useMemo(() => {
    const total = invoices.length;
    const approved = invoices.filter(
      i => i.status === 'approved' || i.status === 'filed',
    ).length;
    const pending = invoices.filter(
      i => i.status === 'draft' || i.status === 'issued',
    ).length;
    const taxVolume = invoices.reduce((sum, i) => sum + (i.totalAmount ?? 0), 0);
    const riskItems = invoices.filter(
      i => i.riskLevel === 'high' || i.riskLevel === 'critical',
    ).length;
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
        const matchesNumber = (inv.invoiceNumber ?? '').toLowerCase().includes(q);
        const matchesBuyer = (inv.buyerName ?? '').toLowerCase().includes(q);
        const matchesClient = clientName.toLowerCase().includes(q);
        if (!matchesNumber && !matchesBuyer && !matchesClient) return false;
      }
      return true;
    });
  }, [invoices, clientFilter, statusFilter, riskFilter, typeFilter, searchQuery, clientMap]);

  // ── Line item helpers ──
  const addLineItem = useCallback(() => {
    setLineItems(prev => [...prev, { ...EMPTY_LINE_ITEM }]);
  }, []);

  const removeLineItem = useCallback((idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateLineItem = useCallback((idx: number, field: keyof LineItemInput, value: string) => {
    setLineItems(prev =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  }, []);

  const resetForm = useCallback(() => {
    setFormClient('');
    setFormInvoiceDate(new Date().toISOString().split('T')[0]);
    setFormDueDate('');
    setFormNotes('');
    setLineItems([{ ...EMPTY_LINE_ITEM }]);
  }, []);

  const openCreateDialog = useCallback(() => {
    resetForm();
    setCreateOpen(true);
  }, [resetForm]);

  // ── Submit Create Invoice ──
  const handleSubmitCreate = useCallback(async () => {
    // ── Validate ──
    if (!formClient) {
      toast.error('Please select a client for this invoice.');
      return;
    }
    const selectedClient = clientMap.get(formClient);
    if (!selectedClient) {
      toast.error('Selected client could not be found. Please refresh and try again.');
      return;
    }

    // Build clean line items, skipping fully-blank rows.
    const cleanedItems = lineItems
      .map(it => ({
        description: it.description.trim(),
        hsnCode: it.hsnCode.trim() || undefined,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        gstRate: Number(it.gstRate),
      }))
      .filter(it => it.description && Number.isFinite(it.quantity) && Number.isFinite(it.unitPrice));

    if (cleanedItems.length === 0) {
      toast.error('Add at least one line item with a description, quantity, and unit price.');
      return;
    }

    const payload: CreateInvoicePayload = {
      cloud: true,
      clientId: formClient,
      customerName: selectedClient.tradeName,
      buyerGstin: selectedClient.gstin,
      sellerGstin: organization?.gstin ?? undefined,
      date: formInvoiceDate || undefined,
      dueDate: formDueDate || undefined,
      items: cleanedItems,
      notes: formNotes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const created = await createInvoice(payload);
      if (created) {
        toast.success(`Invoice ${created.invoiceNumber} created`);
        setCreateOpen(false);
        resetForm();
      } else {
        toast.error('Unable to create this invoice right now. Please try again.');
      }
    } catch (err) {
      console.error('[InvoiceWorkspacePage] create failed:', err);
      toast.error('Unable to create this invoice right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [formClient, lineItems, clientMap, organization, formInvoiceDate, formDueDate, formNotes, createInvoice, resetForm]);

  // ── Invoice action handlers ──
  const handleApprove = useCallback(async (invoiceId: string, invoiceNumber: string) => {
    setApprovingId(invoiceId);
    try {
      const updated = await approveInvoice(invoiceId);
      if (updated) {
        toast.success(`Invoice ${invoiceNumber} approved`);
      } else {
        toast.error('Unable to approve this invoice right now. Please try again.');
      }
    } catch (err) {
      console.error('[InvoiceWorkspacePage] approve failed:', err);
      toast.error('Unable to approve this invoice right now. Please try again.');
    } finally {
      setApprovingId(null);
    }
  }, [approveInvoice]);

  const handleDelete = useCallback(async (invoiceId: string, invoiceNumber: string) => {
    setDeletingId(invoiceId);
    try {
      const ok = await deleteInvoice(invoiceId);
      if (ok) {
        toast.success(`Invoice ${invoiceNumber} deleted`);
      } else {
        toast.error('Unable to delete this invoice. Please try again.');
      }
    } catch (err) {
      console.error('[InvoiceWorkspacePage] delete failed:', err);
      toast.error('Unable to delete this invoice. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }, [deleteInvoice]);

  // ── Loading Skeleton ──
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-40" />
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
        <h3 className="text-lg font-semibold text-foreground">We couldn&apos;t load your invoices</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Please check your connection and try again.
        </p>
        <Button
          onClick={() => {
            refetchInvoices();
          }}
          className="mt-4 gap-2"
          variant="outline"
        >
          <Loader2 className="size-4" />
          Retry
        </Button>
      </div>
    );
  }

  // ── Empty state when no invoices exist ──
  if (invoices.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="space-y-6 p-4 md:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
                Invoice Workspace
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Create, validate, and track GST invoices
              </p>
            </div>
            <Button
              onClick={openCreateDialog}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Plus className="size-4" />
              Create Invoice
            </Button>
          </motion.div>

          <ProfessionalEmptyState
            icon={FileText}
            title="No invoices yet"
            description="Create your first invoice — GSTPilot will calculate the totals, apply the right GST split (CGST/SGST or IGST), and track it through approval."
            accent="emerald"
            action={{
              label: 'Create your first invoice',
              onClick: openCreateDialog,
              icon: Plus,
            }}
            secondaryAction={{
              label: 'Add a client first',
              onClick: () => setCurrentView('clients'),
            }}
          />
        </div>

        <CreateInvoiceDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          clients={clients}
          clientsLoading={clientsLoading}
          formClient={formClient}
          setFormClient={setFormClient}
          formInvoiceDate={formInvoiceDate}
          setFormInvoiceDate={setFormInvoiceDate}
          formDueDate={formDueDate}
          setFormDueDate={setFormDueDate}
          formNotes={formNotes}
          setFormNotes={setFormNotes}
          lineItems={lineItems}
          addLineItem={addLineItem}
          removeLineItem={removeLineItem}
          updateLineItem={updateLineItem}
          sellerGstin={organization?.gstin ?? null}
          submitting={submitting}
          saving={saving}
          onSubmit={handleSubmitCreate}
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
      color: 'text-zinc-300',
      bgColor: 'bg-zinc-900',
    },
    {
      title: 'Approved',
      value: formatNumber(summary.approved),
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Pending',
      value: formatNumber(summary.pending),
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
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
      color: summary.riskItems > 0 ? 'text-red-600' : 'text-zinc-300',
      bgColor: summary.riskItems > 0 ? 'bg-red-500/10' : 'bg-zinc-900',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
              Invoice Workspace
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} &middot; {clients.length} client{clients.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            onClick={openCreateDialog}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            <Plus className="size-4" />
            Create Invoice
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

        {/* ── Create Invoice CTA (replaces Firebase Storage upload area) ── */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card className="border-2 border-dashed border-zinc-800 bg-zinc-900">
            <CardContent className="p-6">
              <button
                type="button"
                onClick={openCreateDialog}
                className="flex w-full flex-col items-center gap-3 text-center focus:outline-none"
              >
                <div className="flex items-center justify-center size-12 rounded-xl bg-emerald-500/10">
                  <CalendarPlus className="size-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Create a new invoice, or{' '}
                    <span className="text-emerald-400 hover:text-emerald-400 font-semibold underline underline-offset-2">
                      get started
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sequential invoice numbers are auto-generated (INV-YYYY-NNN) &middot; CGST/SGST or IGST auto-applied
                  </p>
                </div>
              </button>
            </CardContent>
          </Card>
        </motion.div>

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
              className="pl-9 bg-zinc-900"
            />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-zinc-900">
              <SelectValue placeholder="All Clients" />
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-zinc-900">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="filed">Filed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-zinc-900">
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
            <SelectTrigger className="w-full sm:w-[150px] bg-zinc-900">
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
                  <Inbox className="size-10 text-zinc-500 mb-3" />
                  <p className="text-sm font-medium text-foreground">No invoices match your filters</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filter criteria</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-zinc-900/50">
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
                        {filteredInvoices.map((inv: ApiInvoice) => {
                          const client = clientMap.get(inv.clientId);
                          const clientName = client?.tradeName ?? inv.buyerName ?? 'Unknown';
                          const statusCfg = STATUS_BADGE_EXTENDED[inv.status] ?? STATUS_BADGE.draft;
                          const riskCfg = RISK_BADGE[inv.riskLevel as RiskLevel] ?? RISK_BADGE.low;
                          const matchCfg = MATCH_STATUS_CONFIG[inv.matchStatus as MatchStatus];
                          const totalTax = (inv.cgst ?? 0) + (inv.sgst ?? 0) + (inv.igst ?? 0) + (inv.cess ?? 0);
                          const isApproving = approvingId === inv.id;
                          const isDeleting = deletingId === inv.id;
                          const isActionLoading = isApproving || isDeleting;
                          // Invoice Cloud™ writes `issued`; treat issued + draft as approve-able.
                          const canApprove = inv.status === 'draft' || inv.status === 'issued';
                          // Allow delete for any non-filed state (mirrors prior UX).
                          const canDelete =
                            inv.status === 'draft' ||
                            inv.status === 'issued' ||
                            inv.status === 'approved';

                          return (
                            <motion.tr
                              key={inv.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.2 }}
                              className="hover:bg-zinc-900/50 border-b transition-colors"
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
                                <Badge variant="outline" className="text-[10px] font-medium bg-zinc-900">
                                  {inv.invoiceType}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(inv.taxableValue ?? 0)}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(totalTax)}
                              </TableCell>
                              <TableCell className="text-right text-sm font-semibold">
                                {formatCurrency(inv.totalAmount ?? 0)}
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
                                  {canApprove && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-emerald-400 hover:text-emerald-400 hover:bg-emerald-500/10"
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
                                  {canDelete && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-red-400 hover:text-red-600 hover:bg-red-500/10"
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
      </div>

      <CreateInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        clients={clients}
        clientsLoading={clientsLoading}
        formClient={formClient}
        setFormClient={setFormClient}
        formInvoiceDate={formInvoiceDate}
        setFormInvoiceDate={setFormInvoiceDate}
        formDueDate={formDueDate}
        setFormDueDate={setFormDueDate}
        formNotes={formNotes}
        setFormNotes={setFormNotes}
        lineItems={lineItems}
        addLineItem={addLineItem}
        removeLineItem={removeLineItem}
        updateLineItem={updateLineItem}
        sellerGstin={organization?.gstin ?? null}
        submitting={submitting}
        saving={saving}
        onSubmit={handleSubmitCreate}
      />
    </div>
  );
}

// ─── Create Invoice Dialog (sub-component) ────────────────────────────────────

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Array<{ id: string; tradeName: string; gstin: string }>;
  clientsLoading: boolean;
  formClient: string;
  setFormClient: (v: string) => void;
  formInvoiceDate: string;
  setFormInvoiceDate: (v: string) => void;
  formDueDate: string;
  setFormDueDate: (v: string) => void;
  formNotes: string;
  setFormNotes: (v: string) => void;
  lineItems: LineItemInput[];
  addLineItem: () => void;
  removeLineItem: (idx: number) => void;
  updateLineItem: (idx: number, field: keyof LineItemInput, value: string) => void;
  sellerGstin: string | null;
  submitting: boolean;
  saving: boolean;
  onSubmit: () => void;
}

function CreateInvoiceDialog(props: CreateInvoiceDialogProps) {
  const {
    open,
    onOpenChange,
    clients,
    clientsLoading,
    formClient,
    setFormClient,
    formInvoiceDate,
    setFormInvoiceDate,
    formDueDate,
    setFormDueDate,
    formNotes,
    setFormNotes,
    lineItems,
    addLineItem,
    removeLineItem,
    updateLineItem,
    sellerGstin,
    submitting,
    saving,
    onSubmit,
  } = props;

  // Live preview totals — purely cosmetic so the user sees what they're creating.
  const previewTotals = useMemo(() => {
    let taxable = 0;
    let tax = 0;
    for (const it of lineItems) {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      const rate = Number(it.gstRate) || 0;
      const line = qty * price;
      taxable += line;
      tax += (line * rate) / 100;
    }
    return {
      taxable: Math.round(taxable * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round((taxable + tax) * 100) / 100,
    };
  }, [lineItems]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Sequential invoice number is auto-generated (INV-YYYY-NNN). GST is split
            automatically based on seller/buyer state codes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ── Client + dates ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inv-client">Client *</Label>
              <Select value={formClient} onValueChange={setFormClient}>
                <SelectTrigger id="inv-client" className="bg-zinc-900">
                  <SelectValue placeholder={
                    clientsLoading ? 'Loading clients…' : 'Select a client'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 && !clientsLoading && (
                    <SelectItem value="__none" disabled>
                      No clients yet — add one first
                    </SelectItem>
                  )}
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.tradeName} ({c.gstin})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clients.length === 0 && !clientsLoading && (
                <p className="text-xs text-amber-400">
                  You need at least one client before you can create an invoice.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-seller-gstin">Seller GSTIN</Label>
              <Input
                id="inv-seller-gstin"
                value={sellerGstin ?? ''}
                readOnly
                placeholder="No seller GSTIN set on your organization"
                className="bg-zinc-900 text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Pulled from your organization profile.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-date">Invoice Date *</Label>
              <Input
                id="inv-date"
                type="date"
                value={formInvoiceDate}
                onChange={(e) => setFormInvoiceDate(e.target.value)}
                className="bg-zinc-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-due">Due Date</Label>
              <Input
                id="inv-due"
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                className="bg-zinc-900"
              />
            </div>
          </div>

          {/* ── Line items ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items *</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addLineItem}
                className="gap-1"
              >
                <Plus className="size-3.5" />
                Add Item
              </Button>
            </div>

            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 bg-zinc-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="col-span-5">Description</div>
                <div className="col-span-2">HSN</div>
                <div className="col-span-1 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit Price</div>
                <div className="col-span-1 text-right">GST %</div>
                <div className="col-span-1"></div>
              </div>

              <div className="divide-y divide-slate-100">
                {lineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 px-3 py-2 items-center"
                  >
                    <div className="col-span-5">
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                        placeholder="Item or service description"
                        className="h-8 bg-zinc-900 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        value={item.hsnCode}
                        onChange={(e) => updateLineItem(idx, 'hsnCode', e.target.value)}
                        placeholder="HSN"
                        className="h-8 bg-zinc-900 text-sm"
                      />
                    </div>
                    <div className="col-span-1">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                        className="h-8 bg-zinc-900 text-sm text-right"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value)}
                        className="h-8 bg-zinc-900 text-sm text-right"
                      />
                    </div>
                    <div className="col-span-1">
                      <Select
                        value={item.gstRate}
                        onValueChange={(v) => updateLineItem(idx, 'gstRate', v)}
                      >
                        <SelectTrigger className="h-8 bg-zinc-900 text-sm px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GST_RATES.map(r => (
                            <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => removeLineItem(idx)}
                        disabled={lineItems.length === 1}
                        aria-label="Remove line item"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Preview totals ── */}
              <div className="bg-zinc-900 px-3 py-2 border-t border-zinc-800">
                <div className="flex justify-end gap-6 text-xs">
                  <div>
                    <span className="text-muted-foreground">Taxable: </span>
                    <span className="font-semibold">{formatCurrency(previewTotals.taxable)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tax: </span>
                    <span className="font-semibold">{formatCurrency(previewTotals.tax)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-semibold text-emerald-400">{formatCurrency(previewTotals.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="space-y-2">
            <Label htmlFor="inv-notes">Notes</Label>
            <Textarea
              id="inv-notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Optional notes for this invoice (visible internally)"
              rows={3}
              className="bg-zinc-900"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting || saving}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || saving || clients.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {(submitting || saving) && <Loader2 className="size-4 animate-spin" />}
            Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Unused-but-retained helpers (kept to avoid breaking any future imports) ──
// These were used by the old Firebase-Storage upload UI. They are kept here so
// any external consumers that import them from this module still resolve. They
// are not currently called from this component.

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'json') return <FileJson className="size-4 text-amber-400" />;
  if (ext === 'csv' || ext === 'xlsx') return <FileSpreadsheet className="size-4 text-emerald-400" />;
  return <FileText className="size-4 text-zinc-400" />;
}

// Re-export so callers that imported the helper previously still compile.
export { formatFileSize, getFileIcon };
