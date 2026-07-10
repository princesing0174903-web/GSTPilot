'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Payments View
//
// Real-time payments ledger backed by Firestore onSnapshot:
//   organizations/GSTpilot_SAAS/payments
//
// Features:
//   • Live list (no refresh button) via onSnapshot
//   • Create / Edit / Delete (writes straight to Firestore)
//   • Free-text search (party name, invoice #, reference, mode)
//   • Stats cards (count / total received / total paid out / reconciled)
//   • Loading skeletons + empty state + error/retry
//   • Invoice linkage: completed customer payments auto-update the linked
//     invoice's paidAmount / balanceDue / paymentStatus (handled in the
//     payments service — the UI just passes invoiceId + invoiceNumber).
//
// NO mock data. Firestore is the only source of truth.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
  Receipt,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  User as UserIcon,
  Truck,
  AlertCircle,
  RefreshCw,
  Wallet,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGSTpilotPayments } from '@/hooks/useGSTpilotPayments';
import { useGSTpilotCustomers } from '@/hooks/useGSTpilotCustomers';
import { useGSTpilotVendors } from '@/hooks/useGSTpilotVendors';
import { useGSTpilotInvoices } from '@/hooks/useGSTpilotInvoices';
import type {
  Payment,
  CreatePaymentInput,
  PartyType,
  PaymentMode,
  PaymentTxStatus,
} from '@/lib/gstpilot-data';

// ─── Form state ───────────────────────────────────────────────────────────────

interface PaymentFormState {
  partyType: PartyType;
  partyId: string | null;
  partyName: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  amount: string;
  paymentDate: string;
  paymentMode: PaymentMode;
  status: PaymentTxStatus;
  referenceNo: string;
  reconciled: boolean;
  notes: string;
}

const PARTY_SENTINEL = '__none__';
const INVOICE_SENTINEL = '__none__';

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyForm(): PaymentFormState {
  return {
    partyType: 'customer',
    partyId: null,
    partyName: '',
    invoiceId: null,
    invoiceNumber: null,
    amount: '',
    paymentDate: todayISO(),
    paymentMode: 'upi',
    status: 'completed',
    referenceNo: '',
    reconciled: false,
    notes: '',
  };
}

function paymentToForm(p: Payment): PaymentFormState {
  return {
    partyType: p.partyType,
    partyId: p.partyId,
    partyName: p.partyName ?? '',
    invoiceId: p.invoiceId,
    invoiceNumber: p.invoiceNumber,
    amount: p.amount ? String(p.amount) : '',
    paymentDate: p.paymentDate || todayISO(),
    paymentMode: p.paymentMode,
    status: p.status,
    referenceNo: p.referenceNo ?? '',
    reconciled: !!p.reconciled,
    notes: p.notes ?? '',
  };
}

function formToInput(f: PaymentFormState): CreatePaymentInput {
  const isCustomer = f.partyType === 'customer';
  const trimmedName = f.partyName.trim();
  return {
    partyType: f.partyType,
    partyId: f.partyId || null,
    partyName: trimmedName || (f.partyId ? '' : 'Walk-in'),
    invoiceId: isCustomer ? (f.invoiceId || null) : null,
    invoiceNumber: isCustomer ? (f.invoiceNumber || null) : null,
    amount: Number(f.amount) || 0,
    paymentDate: f.paymentDate,
    paymentMode: f.paymentMode,
    referenceNo: f.referenceNo.trim() || null,
    status: f.status,
    reconciled: f.reconciled,
    notes: f.notes.trim() || null,
  };
}

// ─── Currency helper ─────────────────────────────────────────────────────────

function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n || 0);
}

// ─── Badge helpers ───────────────────────────────────────────────────────────

function PartyTypeBadge({ type }: { type: PartyType }) {
  if (type === 'customer') {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
      >
        <UserIcon className="mr-1 h-3 w-3" /> customer
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-cyan-500/30 bg-cyan-500/5 text-cyan-300"
    >
      <Truck className="mr-1 h-3 w-3" /> vendor
    </Badge>
  );
}

function StatusBadge({ status }: { status: PaymentTxStatus }) {
  if (status === 'completed') {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
      >
        completed
      </Badge>
    );
  }
  if (status === 'pending') {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/5 text-amber-300"
      >
        pending
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-rose-500/30 bg-rose-500/5 text-rose-300"
    >
      failed
    </Badge>
  );
}

function ModeBadge({ mode }: { mode: PaymentMode }) {
  return (
    <Badge
      variant="outline"
      className="border-white/10 bg-white/[0.03] uppercase text-white/60"
    >
      {mode}
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaymentsView() {
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
    retry,
  } = useGSTpilotPayments();

  // Selectors populated from sibling collections (read-only here).
  const { customers } = useGSTpilotCustomers();
  const { vendors } = useGSTpilotVendors();
  const { invoices } = useGSTpilotInvoices();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState<PaymentFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (p: Payment) => {
    setEditing(p);
    setForm(paymentToForm(p));
    setFormError(null);
    setDialogOpen(true);
  };

  const handlePartyTypeChange = (v: PartyType) => {
    // Switching customer↔vendor invalidates the current party + invoice links.
    setForm((prev) => ({
      ...prev,
      partyType: v,
      partyId: null,
      partyName: '',
      invoiceId: null,
      invoiceNumber: null,
    }));
  };

  const handlePartySelect = (v: string) => {
    if (v === PARTY_SENTINEL) {
      setForm((prev) => ({ ...prev, partyId: null, partyName: '' }));
      return;
    }
    if (form.partyType === 'customer') {
      const c = customers.find((x) => x.id === v);
      setForm((prev) => ({ ...prev, partyId: v, partyName: c?.name ?? '' }));
    } else {
      const vd = vendors.find((x) => x.id === v);
      setForm((prev) => ({ ...prev, partyId: v, partyName: vd?.name ?? '' }));
    }
  };

  const handleInvoiceSelect = (v: string) => {
    if (v === INVOICE_SENTINEL) {
      setForm((prev) => ({ ...prev, invoiceId: null, invoiceNumber: null }));
      return;
    }
    const inv = invoices.find((x) => x.id === v);
    setForm((prev) => ({
      ...prev,
      invoiceId: v,
      invoiceNumber: inv?.invoiceNumber ?? null,
    }));
  };

  const handleSubmit = async () => {
    setFormError(null);

    const amountNum = Number(form.amount);
    if (!form.amount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
      setFormError('Amount must be a number greater than 0.');
      return;
    }
    if (!form.paymentDate) {
      setFormError('Payment date is required.');
      return;
    }

    const input = formToInput(form);
    if (editing) {
      const updated = await update(editing.id, input);
      if (updated) {
        toast.success(`Updated payment ${updated.referenceNo ? `(${updated.referenceNo})` : ''}.`);
        setDialogOpen(false);
      } else {
        setFormError(error || 'Could not update payment.');
      }
    } else {
      const created = await create(input);
      if (created) {
        toast.success(`Recorded ${created.status} payment of ${inr(created.amount)}.`);
        setDialogOpen(false);
      } else {
        setFormError(error || 'Could not create payment.');
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await remove(deleteTarget.id);
    if (ok) {
      toast.success(`Deleted payment of ${inr(deleteTarget.amount)}.`);
      setDeleteTarget(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Receipt className="h-6 w-6 text-emerald-400" />
            Payments
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Live payments ledger — synced with Firestore in real-time.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-emerald-500 text-black hover:bg-emerald-400"
        >
          <Plus className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Receipt className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Total Payments</p>
              <p className="text-2xl font-bold text-white">{stats.count}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <ArrowDownLeft className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Total Received</p>
              <p className="text-2xl font-bold text-white">{inr(stats.totalReceived)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
              <ArrowUpRight className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Total Paid Out</p>
              <p className="text-2xl font-bold text-white">{inr(stats.totalPaidOut)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <CheckCircle2 className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Reconciled</p>
              <p className="text-2xl font-bold text-white">{inr(stats.totalReconciled)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search by party, invoice #, reference, mode…"
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

      {/* Error banner */}
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
                    <TableHead className="text-white/50">Date</TableHead>
                    <TableHead className="text-white/50">Party</TableHead>
                    <TableHead className="text-white/50">Invoice #</TableHead>
                    <TableHead className="text-right text-white/50">Amount</TableHead>
                    <TableHead className="text-white/50">Mode</TableHead>
                    <TableHead className="text-white/50">Status</TableHead>
                    <TableHead className="text-center text-white/50">Reconciled</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell>
                        <span className="whitespace-nowrap text-sm text-white/70">
                          {p.paymentDate || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PartyTypeBadge type={p.partyType} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">
                              {p.partyName || 'Walk-in'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.invoiceNumber ? (
                          <Badge
                            variant="outline"
                            className="border-teal-500/30 bg-teal-500/5 font-mono text-teal-300"
                          >
                            {p.invoiceNumber}
                          </Badge>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.partyType === 'customer' ? (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                            {inr(p.amount)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-400">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            {inr(p.amount)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ModeBadge mode={p.paymentMode} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        {p.reconciled ? (
                          <CheckCircle2 className="mx-auto h-4 w-4 text-cyan-400" />
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
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
                            <DropdownMenuItem onClick={() => openEdit(p)} className="text-white/80 focus:text-white">
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(p)}
                              className="text-rose-300 focus:text-rose-200"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-zinc-950 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editing ? 'Edit Payment' : 'Record Payment'}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {editing
                ? 'Update the payment details. Changes save to Firestore instantly.'
                : 'Record a new payment. It is saved to Firestore immediately.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Party type */}
            <div className="grid gap-2">
              <Label className="text-white/70">Party Type</Label>
              <Select
                value={form.partyType}
                onValueChange={(v: PartyType) => handlePartyTypeChange(v)}
              >
                <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-zinc-900">
                  <SelectItem value="customer">Customer (received)</SelectItem>
                  <SelectItem value="vendor">Vendor (paid out)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Party */}
            <div className="grid gap-2">
              <Label className="text-white/70">Party</Label>
              <Select
                value={form.partyId ?? PARTY_SENTINEL}
                onValueChange={handlePartySelect}
              >
                <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                  <SelectValue placeholder="Select party" />
                </SelectTrigger>
                <SelectContent className="max-h-60 border-white/10 bg-zinc-900">
                  <SelectItem value={PARTY_SENTINEL}>Walk-in / unlinked</SelectItem>
                  {form.partyType === 'customer'
                    ? customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    : vendors.map((vd) => (
                        <SelectItem key={vd.id} value={vd.id}>{vd.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {form.partyId === null && (
                <Input
                  value={form.partyName}
                  onChange={(e) => setForm({ ...form, partyName: e.target.value })}
                  placeholder="Walk-in party name (optional)"
                  className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                />
              )}
            </div>

            {/* Invoice (only for customer) */}
            {form.partyType === 'customer' && (
              <div className="grid gap-2">
                <Label className="text-white/70">Linked Invoice</Label>
                <Select
                  value={form.invoiceId ?? INVOICE_SENTINEL}
                  onValueChange={handleInvoiceSelect}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                    <SelectValue placeholder="Link to invoice (optional)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 border-white/10 bg-zinc-900">
                    <SelectItem value={INVOICE_SENTINEL}>No invoice</SelectItem>
                    {invoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} · {inv.customerName} · ₹{inv.grandTotal}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.invoiceId && (
                  <p className="text-xs text-white/40">
                    Invoice #{form.invoiceNumber} linked. A completed payment will auto-update
                    the invoice&apos;s paid amount and balance.
                  </p>
                )}
              </div>
            )}

            {/* Amount + date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-white/70">Amount (₹) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">Payment Date</Label>
                <Input
                  type="date"
                  value={form.paymentDate}
                  onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                  className="border-white/10 bg-white/[0.03] text-white"
                />
              </div>
            </div>

            {/* Mode + status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-white/70">Payment Mode</Label>
                <Select
                  value={form.paymentMode}
                  onValueChange={(v: PaymentMode) => setForm({ ...form, paymentMode: v })}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-900">
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v: PaymentTxStatus) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-900">
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reference no */}
            <div className="grid gap-2">
              <Label className="text-white/70">Reference No.</Label>
              <Input
                value={form.referenceNo}
                onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
                placeholder="UTR / cheque no. (optional)"
                className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
              />
            </div>

            {/* Reconciled */}
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
              <div className="pr-3">
                <p className="text-sm font-medium text-white/80">Reconciled</p>
                <p className="text-xs text-white/40">Mark once matched against the bank statement.</p>
              </div>
              <Switch
                checked={form.reconciled}
                onCheckedChange={(v) => setForm({ ...form, reconciled: v })}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label className="text-white/70">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Internal notes (optional)"
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
              {editing ? 'Save Changes' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-white/10 bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete payment?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This permanently removes the payment of{' '}
              <span className="font-medium text-white/80">{inr(deleteTarget?.amount ?? 0)}</span>
              {deleteTarget?.invoiceNumber ? (
                <> linked to invoice <span className="font-mono text-white/80">{deleteTarget.invoiceNumber}</span></>
              ) : null}
              {' '}from Firestore. This action cannot be undone.
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

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onCreate, hasSearch }: { onCreate: () => void; hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/10">
        <Wallet className="h-8 w-8 text-white/40" />
      </div>
      <div>
        <p className="text-lg font-semibold text-white">
          {hasSearch ? 'No payments match your search' : 'No payments recorded yet'}
        </p>
        <p className="mt-1 text-sm text-white/50">
          {hasSearch
            ? 'Try a different search term.'
            : 'Record your first payment — it saves straight to Firestore.'}
        </p>
      </div>
      {!hasSearch && (
        <Button onClick={onCreate} className="bg-emerald-500 text-black hover:bg-emerald-400">
          <Plus className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      )}
    </div>
  );
}
