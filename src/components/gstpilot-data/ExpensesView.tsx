'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Expenses View
//
// Real-time expense list backed by Firestore onSnapshot:
//   organizations/GSTpilot_SAAS/expenses
//
// Features:
//   • Live list (no refresh button) via onSnapshot
//   • Create / Edit / Delete (writes straight to Firestore)
//   • Free-text search (description / vendor / category / reference)
//   • Vendor selector (real-time from organizations/GSTpilot_SAAS/vendors)
//   • Stats cards (count / total amount / claimable GST)
//   • Loading skeletons + empty state + error/retry
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
  Building2,
  User as UserIcon,
  AlertCircle,
  RefreshCw,
  IndianRupee,
  Wallet,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGSTpilotExpenses } from '@/hooks/useGSTpilotExpenses';
import { useGSTpilotVendors } from '@/hooks/useGSTpilotVendors';
import type {
  Expense,
  CreateExpenseInput,
  ExpenseCategory,
  PaymentMode,
  ExpenseStatus,
} from '@/lib/gstpilot-data';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Office',
  'Travel',
  'Salary',
  'Marketing',
  'Rent',
  'Utilities',
  'Software',
  'Miscellaneous',
];

const PAYMENT_MODES: PaymentMode[] = ['cash', 'upi', 'bank', 'card', 'cheque', 'other'];

const EXPENSE_STATUSES: ExpenseStatus[] = ['recorded', 'billed', 'paid'];

const ADHOC_VENDOR_VALUE = '__adhoc__';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusBadgeClass(status: ExpenseStatus): string {
  switch (status) {
    case 'recorded':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'billed':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
    case 'paid':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    default:
      return 'border-white/20 bg-white/5 text-white/70';
  }
}

function categoryBadgeClass(): string {
  return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface ExpenseFormState {
  vendorId: string | null;
  vendorName: string;
  description: string;
  category: ExpenseCategory;
  amount: string;
  gst: string;
  gstClaimable: boolean;
  date: string;
  paymentMode: PaymentMode;
  status: ExpenseStatus;
  referenceNo: string;
  notes: string;
}

function emptyForm(): ExpenseFormState {
  return {
    vendorId: null,
    vendorName: '',
    description: '',
    category: 'Miscellaneous',
    amount: '',
    gst: '',
    gstClaimable: false,
    date: todayISO(),
    paymentMode: 'other',
    status: 'recorded',
    referenceNo: '',
    notes: '',
  };
}

function formToInput(f: ExpenseFormState): CreateExpenseInput {
  return {
    vendorId: f.vendorId,
    vendorName: f.vendorName,
    category: f.category,
    description: f.description.trim(),
    amount: Number(f.amount) || 0,
    gst: Number(f.gst) || 0,
    gstClaimable: f.gstClaimable,
    date: f.date,
    paymentMode: f.paymentMode,
    status: f.status,
    referenceNo: f.referenceNo.trim() || null,
    notes: f.notes.trim() || null,
  };
}

function expenseToForm(e: Expense): ExpenseFormState {
  return {
    vendorId: e.vendorId,
    vendorName: e.vendorName ?? '',
    description: e.description ?? '',
    category: e.category,
    amount: e.amount ? String(e.amount) : '',
    gst: e.gst ? String(e.gst) : '',
    gstClaimable: !!e.gstClaimable,
    date: e.date || todayISO(),
    paymentMode: e.paymentMode,
    status: e.status,
    referenceNo: e.referenceNo ?? '',
    notes: e.notes ?? '',
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExpensesView() {
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
  } = useGSTpilotExpenses();

  const { vendors } = useGSTpilotVendors();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm(expenseToForm(e));
    setFormError(null);
    setDialogOpen(true);
  };

  const handleVendorChange = (value: string) => {
    if (value === ADHOC_VENDOR_VALUE) {
      setForm((f) => ({ ...f, vendorId: null, vendorName: '' }));
      return;
    }
    const v = vendors.find((x) => x.id === value);
    setForm((f) => ({
      ...f,
      vendorId: v ? v.id : null,
      vendorName: v ? v.name : '',
    }));
  };

  const handleGstChange = (value: string) => {
    const n = Number(value) || 0;
    // Auto-toggle gstClaimable to true when gst > 0, false when gst is 0.
    setForm((f) => ({ ...f, gst: value, gstClaimable: n > 0 }));
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!form.description.trim()) {
      setFormError('Description is required.');
      return;
    }
    const amountNum = Number(form.amount);
    if (!form.amount || Number.isNaN(amountNum) || amountNum <= 0) {
      setFormError('Amount must be a number greater than zero.');
      return;
    }
    const gstNum = Number(form.gst) || 0;
    if (gstNum < 0 || gstNum > amountNum) {
      setFormError('GST cannot be negative or greater than the total amount.');
      return;
    }
    if (!form.date) {
      setFormError('Date is required.');
      return;
    }

    const input = formToInput(form);
    if (editing) {
      const updated = await update(editing.id, input);
      if (updated) {
        toast.success('Expense updated.');
        setDialogOpen(false);
      } else {
        setFormError(error || 'Could not update expense.');
      }
    } else {
      const created = await create(input);
      if (created) {
        toast.success('Expense recorded.');
        setDialogOpen(false);
      } else {
        setFormError(error || 'Could not create expense.');
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await remove(deleteTarget.id);
    if (ok) {
      toast.success('Expense deleted.');
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
            <Receipt className="h-6 w-6 text-cyan-400" />
            Expenses
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Live expense register — synced with Firestore in real-time.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-emerald-500 text-black hover:bg-emerald-400"
        >
          <Plus className="mr-2 h-4 w-4" />
          Record Expense
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20">
              <Receipt className="h-5 w-5 text-teal-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Total Expenses</p>
              <p className="text-2xl font-bold text-white">{stats.count}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Wallet className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Total Amount</p>
              <p className="text-2xl font-bold text-white">{inr(stats.totalAmount)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Claimable GST</p>
              <p className="text-2xl font-bold text-white">{inr(stats.claimableGst)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search by description, vendor, category, reference…"
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
                    <TableHead className="text-white/50">Description</TableHead>
                    <TableHead className="text-white/50">Vendor</TableHead>
                    <TableHead className="text-right text-white/50">Amount</TableHead>
                    <TableHead className="text-right text-white/50">GST</TableHead>
                    <TableHead className="text-white/50">Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="whitespace-nowrap text-sm text-white/70">
                        {formatDate(e.date)}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">{e.description}</p>
                          <Badge
                            variant="outline"
                            className={`mt-1 ${categoryBadgeClass()}`}
                          >
                            {e.category}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {e.vendorId && e.vendorName ? (
                          <span className="flex items-center gap-2 text-white/70">
                            <Building2 className="h-3.5 w-3.5 text-cyan-300" />
                            <span className="truncate">{e.vendorName}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 text-white/40">
                            <UserIcon className="h-3.5 w-3.5" />
                            <span className="italic">Ad-hoc</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium text-white">
                        {inr(e.amount)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-white/70">
                          {e.gstClaimable && (
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
                              title="GST claimable (ITC)"
                            />
                          )}
                          {inr(e.gst)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`capitalize ${statusBadgeClass(e.status)}`}
                        >
                          {e.status}
                        </Badge>
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
                            <DropdownMenuItem onClick={() => openEdit(e)} className="text-white/80 focus:text-white">
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(e)}
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
              {editing ? 'Edit Expense' : 'Record Expense'}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {editing
                ? 'Update the expense details. Changes save to Firestore instantly.'
                : 'Record a new expense. It is saved to Firestore immediately.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Vendor */}
            <div className="grid gap-2">
              <Label className="text-white/70">Vendor</Label>
              <Select
                value={form.vendorId ?? ADHOC_VENDOR_VALUE}
                onValueChange={handleVendorChange}
              >
                <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent className="max-h-60 border-white/10 bg-zinc-900">
                  <SelectItem value={ADHOC_VENDOR_VALUE}>Ad-hoc / no vendor</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-white/40">
                Picking a vendor auto-fills the vendor name on the expense.
              </p>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label className="text-white/70">Description *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What was this expense for?"
                className="min-h-16 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
              />
            </div>

            {/* Category + Payment mode */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-white/70">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v: ExpenseCategory) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-900">
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">Payment Mode</Label>
                <Select
                  value={form.paymentMode}
                  onValueChange={(v: PaymentMode) => setForm({ ...form, paymentMode: v })}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03] text-white capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-900">
                    {PAYMENT_MODES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Amount + GST */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-white/70">Amount (incl. GST) *</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    className="border-white/10 bg-white/[0.03] pl-9 text-white placeholder:text-white/30"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">GST Amount</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.gst}
                    onChange={(e) => handleGstChange(e.target.value)}
                    placeholder="0.00"
                    className="border-white/10 bg-white/[0.03] pl-9 text-white placeholder:text-white/30"
                  />
                </div>
              </div>
            </div>

            {/* GST claimable switch */}
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div>
                <p className="text-sm text-white/80">GST claimable (ITC)</p>
                <p className="text-xs text-white/40">Toggle if input tax credit can be claimed.</p>
              </div>
              <Switch
                checked={form.gstClaimable}
                onCheckedChange={(v) => setForm({ ...form, gstClaimable: v })}
              />
            </div>

            {/* Date + Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-white/70">Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="border-white/10 bg-white/[0.03] text-white"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v: ExpenseStatus) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03] text-white capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-900">
                    {EXPENSE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reference No */}
            <div className="grid gap-2">
              <Label className="text-white/70">Reference No.</Label>
              <Input
                value={form.referenceNo}
                onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
                placeholder="UTR / cheque / invoice ref (optional)"
                className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label className="text-white/70">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Internal notes (optional)"
                className="min-h-16 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
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
              {editing ? 'Save Changes' : 'Record Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-white/10 bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete expense?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This permanently removes <span className="font-medium text-white/80">{deleteTarget?.description}</span> from Firestore. This action cannot be undone.
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
        <Receipt className="h-8 w-8 text-white/40" />
      </div>
      <div>
        <p className="text-lg font-semibold text-white">
          {hasSearch ? 'No expenses match your search' : 'No expenses recorded yet'}
        </p>
        <p className="mt-1 text-sm text-white/50">
          {hasSearch
            ? 'Try a different search term.'
            : 'Record your first expense — it saves straight to Firestore.'}
        </p>
      </div>
      {!hasSearch && (
        <Button onClick={onCreate} className="bg-emerald-500 text-black hover:bg-emerald-400">
          <Plus className="mr-2 h-4 w-4" />
          Record Expense
        </Button>
      )}
    </div>
  );
}
