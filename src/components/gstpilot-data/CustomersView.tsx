'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Customers View (CRM)
//
// Real-time customer list backed by Firestore onSnapshot:
//   organizations/GSTpilot_SAAS/customers
//
// Features:
//   • Live list (no refresh button) via onSnapshot
//   • Create / Edit / Delete (writes straight to Firestore)
//   • Free-text search (name / email / phone / gstin / state)
//   • Stats cards (total / with GSTIN / outstanding)
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
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Building2,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  RefreshCw,
  IndianRupee,
  Wallet,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGSTpilotCustomers } from '@/hooks/useGSTpilotCustomers';
import { STATE_CODES, validateGstin } from '@/lib/gstpilot-data';
import type { Customer, CreateCustomerInput, CustomerType } from '@/lib/gstpilot-data';

// ─── Form state ───────────────────────────────────────────────────────────────

interface CustomerFormState {
  name: string;
  type: CustomerType;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  address: string;
  state: string;
  notes: string;
}

const EMPTY_FORM: CustomerFormState = {
  name: '',
  type: 'business',
  gstin: '',
  pan: '',
  email: '',
  phone: '',
  address: '',
  state: '',
  notes: '',
};

function formToInput(f: CustomerFormState): CreateCustomerInput {
  return {
    name: f.name,
    type: f.type,
    gstin: f.gstin || null,
    pan: f.pan || null,
    email: f.email || null,
    phone: f.phone || null,
    address: f.address || null,
    state: f.state || null,
    notes: f.notes || null,
  };
}

function customerToForm(c: Customer): CustomerFormState {
  return {
    name: c.name,
    type: c.type,
    gstin: c.gstin ?? '',
    pan: c.pan ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    state: c.state ?? '',
    notes: c.notes ?? '',
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomersView() {
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
  } = useGSTpilotCustomers();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm(customerToForm(c));
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    const gstinErr = validateGstin(form.gstin || null);
    if (gstinErr) {
      setFormError(gstinErr);
      return;
    }
    const input = formToInput(form);
    if (editing) {
      const updated = await update(editing.id, input);
      if (updated) {
        toast.success(`Updated customer “${updated.name}”.`);
        setDialogOpen(false);
      } else {
        setFormError(error || 'Could not update customer.');
      }
    } else {
      const created = await create(input);
      if (created) {
        toast.success(`Created customer “${created.name}”.`);
        setDialogOpen(false);
      } else {
        setFormError(error || 'Could not create customer.');
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    // Single-flight: clear deleteTarget synchronously so a second click is a no-op.
    const target = deleteTarget;
    setDeleteTarget(null);
    const ok = await remove(target.id);
    if (ok) {
      toast.success(`Deleted customer “${target.name}”.`);
    } else {
      // Restore the dialog target so the user can retry.
      setDeleteTarget(target);
      toast.error('Could not delete customer. Please try again.');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-400" />
            Customers
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Live customer registry — synced with Firestore in real-time.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-emerald-500 text-black hover:bg-emerald-400"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Customer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Users className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Total Customers</p>
              <p className="text-2xl font-bold text-white">{stats.count}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20">
              <FileText className="h-5 w-5 text-teal-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">With GSTIN</p>
              <p className="text-2xl font-bold text-white">{stats.withGstin}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Wallet className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Outstanding</p>
              <p className="text-2xl font-bold text-white">{inr(stats.totalOutstanding)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search by name, email, phone, GSTIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-white/10 bg-white/[0.03] pl-9 text-white placeholder:text-white/30"
          />
        </div>
        {error && (
          <Button variant="outline" size="sm" onClick={retry} disabled={loading} className="border-white/10 text-white/70">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
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
                    <TableHead className="text-white/50">Customer</TableHead>
                    <TableHead className="text-white/50">GSTIN</TableHead>
                    <TableHead className="text-white/50">Contact</TableHead>
                    <TableHead className="text-white/50">State</TableHead>
                    <TableHead className="text-right text-white/50">Outstanding</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] border border-white/10">
                            {c.type === 'business' ? (
                              <Building2 className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <UserIcon className="h-4 w-4 text-teal-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">{c.name}</p>
                            <p className="truncate text-xs text-white/40">{c.email || c.phone || '—'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.gstin ? (
                          <Badge variant="outline" className="border-teal-500/30 bg-teal-500/5 font-mono text-teal-300">
                            {c.gstin}
                          </Badge>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs">
                          {c.email && (
                            <span className="flex items-center gap-1 text-white/60">
                              <Mail className="h-3 w-3" /> {c.email}
                            </span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-1 text-white/60">
                              <Phone className="h-3 w-3" /> {c.phone}
                            </span>
                          )}
                          {!c.email && !c.phone && <span className="text-white/30">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.state ? (
                          <span className="flex items-center gap-1 text-white/60">
                            <MapPin className="h-3 w-3" /> {c.state}
                          </span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.balance > 0 ? (
                          <span className="font-medium text-amber-400">{inr(c.balance)}</span>
                        ) : (
                          <span className="text-white/30">{inr(0)}</span>
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
                            <DropdownMenuItem onClick={() => openEdit(c)} className="text-white/80 focus:text-white">
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(c)}
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
              {editing ? 'Edit Customer' : 'Create Customer'}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {editing
                ? 'Update the customer details. Changes save to Firestore instantly.'
                : 'Add a new customer. They are saved to Firestore immediately.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-white/70">Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Acme Traders Pvt Ltd"
                className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-white/70">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: CustomerType) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-900">
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">State</Label>
                <Select
                  value={form.state}
                  onValueChange={(v) => setForm({ ...form, state: v === '__none__' ? '' : v })}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 border-white/10 bg-zinc-900">
                    <SelectItem value="__none__">— None —</SelectItem>
                    {Object.keys(STATE_CODES).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-white/70">GSTIN</Label>
                <Input
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                  className="border-white/10 bg-white/[0.03] font-mono text-white placeholder:text-white/30"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">PAN</Label>
                <Input
                  value={form.pan}
                  onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                  placeholder="AAAAA0000A"
                  maxLength={10}
                  className="border-white/10 bg-white/[0.03] font-mono text-white placeholder:text-white/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-white/70">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="accounts@acme.in"
                  className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-white/70">Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 Business Park, Mumbai 400001"
                className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-white/70">Notes</Label>
              <Input
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
              {editing ? 'Save Changes' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-white/10 bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete customer?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This permanently removes <span className="font-medium text-white/80">{deleteTarget?.name}</span> from Firestore. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/70">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-rose-600 text-white hover:bg-rose-500"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
        <Users className="h-8 w-8 text-white/40" />
      </div>
      <div>
        <p className="text-lg font-semibold text-white">
          {hasSearch ? 'No customers match your search' : 'No customers yet'}
        </p>
        <p className="mt-1 text-sm text-white/50">
          {hasSearch
            ? 'Try a different search term.'
            : 'Create your first customer — it saves straight to Firestore.'}
        </p>
      </div>
      {!hasSearch && (
        <Button onClick={onCreate} className="bg-emerald-500 text-black hover:bg-emerald-400">
          <Plus className="mr-2 h-4 w-4" />
          Create Customer
        </Button>
      )}
    </div>
  );
}
