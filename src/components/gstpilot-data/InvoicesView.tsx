'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Invoices View
//
// Real-time invoice list backed by Firestore onSnapshot:
//   organizations/GSTpilot_SAAS/invoices
//
// Features:
//   • Live list (no refresh button) via onSnapshot
//   • Create / Edit / Delete with server-side GST calculation
//   • Customer picker (live from customers collection)
//   • Product picker per line item (autofills desc/hsn/gst/price)
//   • Live GST preview (CGST+SGST intra-state, IGST inter-state)
//   • Mark paid / cancel
//   • View dialog with full invoice breakdown
//   • Stats cards (invoiced / paid / outstanding / tax)
//
// NO mock data. Firestore is the only source of truth.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Wallet,
  Receipt,
  TrendingUp,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGSTpilotInvoices } from '@/hooks/useGSTpilotInvoices';
import { useGSTpilotCustomers } from '@/hooks/useGSTpilotCustomers';
import { useGSTpilotProducts } from '@/hooks/useGSTpilotProducts';
import {
  GST_RATES,
  DEFAULT_GST_RATE,
  STATE_CODES,
  calculateInvoiceTotals,
  type Invoice,
  type CreateInvoiceInput,
  type InvoiceStatus,
  type GstRate,
  type ProductUnit,
} from '@/lib/gstpilot-data';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_STYLES: Record<InvoiceStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'border-white/20 bg-white/5 text-white/70' },
  sent: { label: 'Sent', cls: 'border-teal-500/30 bg-teal-500/5 text-teal-300' },
  paid: { label: 'Paid', cls: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300' },
  partial: { label: 'Partial', cls: 'border-amber-500/30 bg-amber-500/5 text-amber-300' },
  overdue: { label: 'Overdue', cls: 'border-rose-500/30 bg-rose-500/5 text-rose-300' },
  cancelled: { label: 'Cancelled', cls: 'border-white/10 bg-white/[0.02] text-white/40 line-through' },
};

const UNITS: ProductUnit[] = ['NOS', 'KG', 'GM', 'LTR', 'ML', 'MTR', 'BOX', 'PCS', 'SET', 'HR', 'DAY', 'MONTH'];

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Line item form type ─────────────────────────────────────────────────────

interface LineForm {
  id: string;
  productId: string | null;
  description: string;
  hsnSac: string;
  quantity: string;
  unit: ProductUnit;
  unitPrice: string;
  discount: string;
  gstRate: GstRate;
}

function emptyLine(): LineForm {
  return {
    id: uid(),
    productId: null,
    description: '',
    hsnSac: '',
    quantity: '1',
    unit: 'NOS',
    unitPrice: '',
    discount: '0',
    gstRate: DEFAULT_GST_RATE,
  };
}

// ─── Invoice form state ──────────────────────────────────────────────────────

interface InvoiceFormState {
  customerId: string; // '' = none
  sellerName: string;
  sellerGstin: string;
  sellerAddress: string;
  sellerStateCode: string;
  invoiceDate: string;
  dueDate: string;
  lines: LineForm[];
  notes: string;
}

const EMPTY_FORM: InvoiceFormState = {
  customerId: '',
  sellerName: 'GSTPilot SAAS',
  sellerGstin: '',
  sellerAddress: '',
  sellerStateCode: '27', // Maharashtra default
  invoiceDate: todayISO(),
  dueDate: addDays(todayISO(), 15),
  lines: [emptyLine()],
  notes: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvoicesView() {
  const {
    filtered,
    loading,
    error,
    saving,
    stats,
    search,
    setSearch,
    create,
    update,
    remove,
    markPaid,
    cancel,
    retry,
  } = useGSTpilotInvoices();

  const { customers } = useGSTpilotCustomers();
  const { products } = useGSTpilotProducts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [form, setForm] = useState<InvoiceFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [viewTarget, setViewTarget] = useState<Invoice | null>(null);

  // Form is reset directly in the open handlers — no effect needed.
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setForm(invoiceToForm(inv));
    setFormError(null);
    setDialogOpen(true);
  };

  // ── Live GST preview ──
  const preview = useMemo(() => {
    const items = form.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      description: l.description,
      hsnSac: l.hsnSac,
      quantity: Number(l.quantity) || 0,
      unit: l.unit,
      unitPrice: Number(l.unitPrice) || 0,
      discount: Number(l.discount) || 0,
      gstRate: l.gstRate,
    }));
    const customer = customers.find((c) => c.id === form.customerId);
    const customerStateCode = customer?.stateCode ?? null;
    return calculateInvoiceTotals({
      items,
      sellerStateCode: form.sellerStateCode || null,
      customerStateCode,
      paidAmount: 0,
    });
  }, [form, customers]);

  // ── Line item operations ──
  const updateLine = (id: string, patch: Partial<LineForm>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  };

  const pickProduct = (id: string, productId: string) => {
    if (!productId || productId === '__none__') {
      updateLine(id, { productId: null });
      return;
    }
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    updateLine(id, {
      productId: p.id,
      description: p.name,
      hsnSac: p.hsnSac,
      unitPrice: String(p.price),
      gstRate: p.gstRate,
      unit: p.unit,
    });
  };

  const addLine = () => {
    setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  };

  const removeLine = (id: string) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.length > 1 ? f.lines.filter((l) => l.id !== id) : f.lines,
    }));
  };

  // ── Customer pick → autofill seller fields stay; customer fields fill from customer ──
  const pickCustomer = (customerId: string) => {
    setForm((f) => ({ ...f, customerId: customerId === '__none__' ? '' : customerId }));
  };

  // ── Submit ──
  const handleSubmit = async () => {
    setFormError(null);
    if (!form.sellerName.trim()) {
      setFormError('Seller name is required.');
      return;
    }
    const validLines = form.lines.filter(
      (l) => l.description.trim() && Number(l.quantity) > 0,
    );
    if (validLines.length === 0) {
      setFormError('Add at least one line item with a description and quantity.');
      return;
    }

    const customer = customers.find((c) => c.id === form.customerId);
    const input: CreateInvoiceInput = {
      customerId: form.customerId || null,
      customerName: customer?.name,
      customerGstin: customer?.gstin ?? null,
      customerAddress: customer?.address ?? null,
      customerState: customer?.state ?? null,
      customerStateCode: customer?.stateCode ?? null,
      sellerName: form.sellerName,
      sellerGstin: form.sellerGstin || null,
      sellerAddress: form.sellerAddress || null,
      sellerStateCode: form.sellerStateCode || null,
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate || null,
      items: validLines.map((l) => ({
        id: l.id,
        productId: l.productId,
        description: l.description,
        hsnSac: l.hsnSac,
        quantity: Number(l.quantity) || 0,
        unit: l.unit,
        unitPrice: Number(l.unitPrice) || 0,
        discount: Number(l.discount) || 0,
        gstRate: l.gstRate,
      })),
      notes: form.notes || null,
    };

    if (editing) {
      const updated = await update(editing.id, input);
      if (updated) {
        toast.success(`Updated invoice ${updated.invoiceNumber}.`);
        setDialogOpen(false);
      } else {
        setFormError(error || 'Could not update invoice.');
      }
    } else {
      const created = await create(input);
      if (created) {
        toast.success(`Created invoice ${created.invoiceNumber}.`);
        setDialogOpen(false);
      } else {
        setFormError(error || 'Could not create invoice.');
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await remove(deleteTarget.id);
    if (ok) {
      toast.success(`Deleted invoice ${deleteTarget.invoiceNumber}.`);
      setDeleteTarget(null);
    }
  };

  const handleMarkPaid = async (inv: Invoice) => {
    const updated = await markPaid(inv.id);
    if (updated) toast.success(`Marked ${updated.invoiceNumber} as paid.`);
  };

  const handleCancel = async (inv: Invoice) => {
    const updated = await cancel(inv.id);
    if (updated) toast.success(`Cancelled invoice ${updated.invoiceNumber}.`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-400" />
            Invoices
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Live GST invoices — synced with Firestore in real-time. Totals auto-calculated.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-emerald-500 text-black hover:bg-emerald-400"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Receipt className="h-5 w-5 text-emerald-400" />} label="Total Invoiced" value={inr(stats.totalInvoiced)} tint="emerald" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-teal-400" />} label="Total Paid" value={inr(stats.totalPaid)} tint="teal" />
        <StatCard icon={<Wallet className="h-5 w-5 text-amber-400" />} label="Outstanding" value={inr(stats.totalOutstanding)} tint="amber" />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-violet-400" />} label="Tax Collected" value={inr(stats.totalTaxCollected)} tint="violet" />
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search by invoice #, customer, GSTIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-white/10 bg-white/[0.03] pl-9 text-white placeholder:text-white/30"
          />
        </div>
        {error && (
          <Button variant="outline" size="sm" onClick={retry} className="border-white/10 text-white/70">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
      </div>

      {error && !loading && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="text-sm text-amber-200/90">
            <p className="font-medium">{error}</p>
            <p className="mt-0.5 text-amber-200/60">Your changes will sync automatically once the connection is restored.</p>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="flex-1 border-white/10 bg-white/[0.02]">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-white/[0.04]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onCreate={openCreate} hasSearch={!!search} />
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/50">Invoice #</TableHead>
                    <TableHead className="text-white/50">Customer</TableHead>
                    <TableHead className="text-white/50">Date</TableHead>
                    <TableHead className="text-right text-white/50">Total</TableHead>
                    <TableHead className="text-right text-white/50">Balance</TableHead>
                    <TableHead className="text-white/50">Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => {
                    const st = STATUS_STYLES[inv.status];
                    return (
                      <TableRow key={inv.id} className="border-white/5 hover:bg-white/[0.02]">
                        <TableCell>
                          <span className="font-mono text-sm font-medium text-white">{inv.invoiceNumber}</span>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">{inv.customerName}</p>
                            {inv.customerGstin && (
                              <p className="truncate font-mono text-xs text-white/40">{inv.customerGstin}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-white/60">{fmtDate(inv.invoiceDate)}</TableCell>
                        <TableCell className="text-right font-medium text-white">{inr(inv.grandTotal)}</TableCell>
                        <TableCell className="text-right">
                          {inv.balanceDue > 0 && inv.status !== 'cancelled' ? (
                            <span className="font-medium text-amber-400">{inr(inv.balanceDue)}</span>
                          ) : (
                            <span className="text-white/30">{inr(0)}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border-white/10 bg-zinc-900">
                              <DropdownMenuLabel className="text-white/40">Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => setViewTarget(inv)} className="text-white/80 focus:text-white">
                                <Eye className="mr-2 h-4 w-4" /> View
                              </DropdownMenuItem>
                              {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                                <DropdownMenuItem onClick={() => openEdit(inv)} className="text-white/80 focus:text-white">
                                  <Pencil className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                              )}
                              {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                <DropdownMenuItem onClick={() => handleMarkPaid(inv)} className="text-emerald-300 focus:text-emerald-200">
                                  <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Paid
                                </DropdownMenuItem>
                              )}
                              {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                                <DropdownMenuItem onClick={() => handleCancel(inv)} className="text-amber-300 focus:text-amber-200">
                                  <XCircle className="mr-2 h-4 w-4" /> Cancel
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="bg-white/10" />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(inv)}
                                className="text-rose-300 focus:text-rose-200"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-zinc-950 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editing ? `Edit Invoice ${editing.invoiceNumber}` : 'Create Invoice'}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {editing
                ? 'Update the invoice. GST totals recompute on save.'
                : 'GST is calculated automatically. Intra-state → CGST+SGST, inter-state → IGST.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {/* Customer + seller */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-white/70">Customer</Label>
                <Select value={form.customerId || '__none__'} onValueChange={pickCustomer}>
                  <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                    <SelectValue placeholder="Walk-in Customer" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 border-white/10 bg-zinc-900">
                    <SelectItem value="__none__">— Walk-in Customer —</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.customerId && (() => {
                  const c = customers.find((x) => x.id === form.customerId);
                  if (!c) return null;
                  return (
                    <p className="text-xs text-white/40">
                      {c.gstin ? `GSTIN: ${c.gstin}` : 'No GSTIN'} · {c.state ?? 'No state'}
                    </p>
                  );
                })()}
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">Invoice Date</Label>
                <Input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                  className="border-white/10 bg-white/[0.03] text-white"
                />
              </div>
            </div>

            {/* Seller details */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Seller (Your Business)</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="text-xs text-white/60">Seller Name *</Label>
                  <Input
                    value={form.sellerName}
                    onChange={(e) => setForm({ ...form, sellerName: e.target.value })}
                    className="border-white/10 bg-white/[0.03] text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs text-white/60">Seller GSTIN</Label>
                  <Input
                    value={form.sellerGstin}
                    onChange={(e) => setForm({ ...form, sellerGstin: e.target.value.toUpperCase() })}
                    maxLength={15}
                    placeholder="27AAAAA0000A1Z5"
                    className="border-white/10 bg-white/[0.03] font-mono text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs text-white/60">Seller State</Label>
                  <Select
                    value={form.sellerStateCode}
                    onValueChange={(v) => setForm({ ...form, sellerStateCode: v === '__none__' ? '' : v })}
                  >
                    <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 border-white/10 bg-zinc-900">
                      <SelectItem value="__none__">— None —</SelectItem>
                      {Object.entries(STATE_CODES).map(([name, code]) => (
                        <SelectItem key={code} value={code}>{code} · {name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs text-white/60">Due Date</Label>
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="border-white/10 bg-white/[0.03] text-white"
                  />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label className="text-xs text-white/60">Seller Address</Label>
                  <Input
                    value={form.sellerAddress}
                    onChange={(e) => setForm({ ...form, sellerAddress: e.target.value })}
                    placeholder="123 Business Park, Mumbai 400001"
                    className="border-white/10 bg-white/[0.03] text-white"
                  />
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Line Items</p>
                <Button size="sm" variant="outline" onClick={addLine} className="border-white/10 text-white/70 hover:text-white">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Line
                </Button>
              </div>

              <div className="space-y-3">
                {form.lines.map((line, idx) => {
                  const lineQty = Number(line.quantity) || 0;
                  const linePrice = Number(line.unitPrice) || 0;
                  const lineDisc = Number(line.discount) || 0;
                  const taxable = Math.round((lineQty * linePrice * (1 - lineDisc / 100)) * 100) / 100;
                  const gst = Math.round(taxable * (line.gstRate / 100) * 100) / 100;
                  const amount = Math.round((taxable + gst) * 100) / 100;
                  return (
                    <div key={line.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-white/50">Line {idx + 1}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-white/40 hover:text-rose-300"
                          onClick={() => removeLine(line.id)}
                          disabled={form.lines.length === 1}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-12 md:items-end">
                        <div className="md:col-span-4 grid gap-1">
                          <Label className="text-xs text-white/50">Product (optional)</Label>
                          <Select
                            value={line.productId ?? '__none__'}
                            onValueChange={(v) => pickProduct(line.id, v)}
                          >
                            <SelectTrigger className="h-9 border-white/10 bg-white/[0.03] text-white text-xs">
                              <SelectValue placeholder="Ad-hoc / pick product" />
                            </SelectTrigger>
                            <SelectContent className="max-h-56 border-white/10 bg-zinc-900">
                              <SelectItem value="__none__">— Ad-hoc line —</SelectItem>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name} · {inr(p.price)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-8 grid gap-1">
                          <Label className="text-xs text-white/50">Description</Label>
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(line.id, { description: e.target.value })}
                            placeholder="Description of goods / service"
                            className="h-9 border-white/10 bg-white/[0.03] text-white"
                          />
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-6 md:items-end">
                        <div className="grid gap-1">
                          <Label className="text-xs text-white/50">HSN/SAC</Label>
                          <Input
                            value={line.hsnSac}
                            onChange={(e) => updateLine(line.id, { hsnSac: e.target.value })}
                            className="h-9 border-white/10 bg-white/[0.03] font-mono text-white"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs text-white/50">Qty</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.quantity}
                            onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                            className="h-9 border-white/10 bg-white/[0.03] text-white"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs text-white/50">Unit Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })}
                            className="h-9 border-white/10 bg-white/[0.03] text-white"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs text-white/50">Disc %</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={line.discount}
                            onChange={(e) => updateLine(line.id, { discount: e.target.value })}
                            className="h-9 border-white/10 bg-white/[0.03] text-white"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs text-white/50">GST %</Label>
                          <Select
                            value={String(line.gstRate)}
                            onValueChange={(v) => updateLine(line.id, { gstRate: Number(v) as GstRate })}
                          >
                            <SelectTrigger className="h-9 border-white/10 bg-white/[0.03] text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-white/10 bg-zinc-900">
                              {GST_RATES.map((r) => (
                                <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs text-white/50">Amount</Label>
                          <div className="flex h-9 items-center rounded-md border border-white/10 bg-white/[0.02] px-3 text-sm font-medium text-white">
                            {inr(amount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals preview */}
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="ml-auto max-w-xs space-y-1.5 text-sm">
                  <Row label="Subtotal" value={inr(preview.subtotal)} />
                  <Row label="Discount" value={`− ${inr(preview.discount)}`} />
                  <Row label="Taxable Value" value={inr(preview.taxableValue)} />
                  {preview.isIntraState ? (
                    <>
                      <Row label="CGST" value={inr(preview.cgst)} />
                      <Row label="SGST" value={inr(preview.sgst)} />
                    </>
                  ) : (
                    <Row label="IGST" value={inr(preview.igst)} />
                  )}
                  <Row label="Total Tax" value={inr(preview.totalTax)} />
                  <Separator className="bg-white/10" />
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-semibold text-white">Grand Total</span>
                    <span className="text-lg font-bold text-emerald-400">{inr(preview.grandTotal)}</span>
                  </div>
                  <p className="pt-1 text-xs text-white/40">
                    {preview.isIntraState ? 'Intra-state sale (CGST + SGST)' : 'Inter-state sale (IGST)'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-white/70">Notes (printed on invoice)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Thank you for your business. Payment due within 15 days."
                rows={2}
                className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
              />
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] p-3 text-sm text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-white/10 text-white/70">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-emerald-500 text-black hover:bg-emerald-400"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => !o && setViewTarget(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-zinc-950 sm:max-w-2xl">
          {viewTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white">Invoice {viewTarget.invoiceNumber}</DialogTitle>
                <DialogDescription className="text-white/50">
                  {fmtDate(viewTarget.invoiceDate)} · {viewTarget.isIntraState ? 'Intra-state (CGST+SGST)' : 'Inter-state (IGST)'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wider text-white/40">Seller</p>
                    <p className="mt-1 font-medium text-white">{viewTarget.sellerName}</p>
                    {viewTarget.sellerGstin && <p className="font-mono text-xs text-white/50">{viewTarget.sellerGstin}</p>}
                    {viewTarget.sellerAddress && <p className="text-xs text-white/40">{viewTarget.sellerAddress}</p>}
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wider text-white/40">Buyer</p>
                    <p className="mt-1 font-medium text-white">{viewTarget.customerName}</p>
                    {viewTarget.customerGstin && <p className="font-mono text-xs text-white/50">{viewTarget.customerGstin}</p>}
                    {viewTarget.customerAddress && <p className="text-xs text-white/40">{viewTarget.customerAddress}</p>}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-white/50">Description</TableHead>
                        <TableHead className="text-right text-white/50">Qty</TableHead>
                        <TableHead className="text-right text-white/50">Price</TableHead>
                        <TableHead className="text-right text-white/50">GST</TableHead>
                        <TableHead className="text-right text-white/50">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewTarget.items.map((it) => (
                        <TableRow key={it.id} className="border-white/5">
                          <TableCell>
                            <p className="text-white">{it.description}</p>
                            <p className="font-mono text-xs text-white/40">{it.hsnSac}</p>
                          </TableCell>
                          <TableCell className="text-right text-white/70">{it.quantity} {it.unit}</TableCell>
                          <TableCell className="text-right text-white/70">{inr(it.unitPrice)}</TableCell>
                          <TableCell className="text-right text-white/70">{it.gstRate}%</TableCell>
                          <TableCell className="text-right font-medium text-white">{inr(it.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="ml-auto max-w-xs space-y-1.5 text-sm">
                  <Row label="Subtotal" value={inr(viewTarget.subtotal)} />
                  <Row label="Taxable Value" value={inr(viewTarget.taxableValue)} />
                  {viewTarget.isIntraState ? (
                    <>
                      <Row label="CGST" value={inr(viewTarget.cgst)} />
                      <Row label="SGST" value={inr(viewTarget.sgst)} />
                    </>
                  ) : (
                    <Row label="IGST" value={inr(viewTarget.igst)} />
                  )}
                  <Separator className="bg-white/10" />
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-semibold text-white">Grand Total</span>
                    <span className="text-lg font-bold text-emerald-400">{inr(viewTarget.grandTotal)}</span>
                  </div>
                  <Row label="Paid" value={inr(viewTarget.paidAmount)} />
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-amber-300">Balance Due</span>
                    <span className="font-bold text-amber-300">{inr(viewTarget.balanceDue)}</span>
                  </div>
                </div>

                {viewTarget.notes && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wider text-white/40">Notes</p>
                    <p className="mt-1 text-sm text-white/70">{viewTarget.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-white/10 bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete invoice?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This permanently removes invoice <span className="font-mono font-medium text-white/80">{deleteTarget?.invoiceNumber}</span> from Firestore. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/70">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 text-white hover:bg-rose-500"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Small presentational helpers ────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: 'emerald' | 'teal' | 'amber' | 'violet';
}) {
  const tints: Record<string, string> = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20',
    teal: 'bg-teal-500/10 border-teal-500/20',
    amber: 'bg-amber-500/10 border-amber-500/20',
    violet: 'bg-violet-500/10 border-violet-500/20',
  };
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${tints[tint]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-white/40">{label}</p>
          <p className="truncate text-xl font-bold text-white">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/50">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function EmptyState({ onCreate, hasSearch }: { onCreate: () => void; hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/10">
        <FileText className="h-8 w-8 text-white/40" />
      </div>
      <div>
        <p className="text-lg font-semibold text-white">
          {hasSearch ? 'No invoices match your search' : 'No invoices yet'}
        </p>
        <p className="mt-1 text-sm text-white/50">
          {hasSearch
            ? 'Try a different search term.'
            : 'Create your first GST invoice — it saves straight to Firestore.'}
        </p>
      </div>
      {!hasSearch && (
        <Button onClick={onCreate} className="bg-emerald-500 text-black hover:bg-emerald-400">
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      )}
    </div>
  );
}

// ─── Convert an Invoice to form state for editing ────────────────────────────

function invoiceToForm(inv: Invoice): InvoiceFormState {
  return {
    customerId: inv.customerId ?? '',
    sellerName: inv.sellerName,
    sellerGstin: inv.sellerGstin ?? '',
    sellerAddress: inv.sellerAddress ?? '',
    sellerStateCode: inv.sellerStateCode ?? '',
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate ?? '',
    lines: inv.items.map((it) => ({
      id: it.id || uid(),
      productId: it.productId,
      description: it.description,
      hsnSac: it.hsnSac,
      quantity: String(it.quantity),
      unit: it.unit,
      unitPrice: String(it.unitPrice),
      discount: String(it.discount),
      gstRate: it.gstRate,
    })),
    notes: inv.notes ?? '',
  };
}
