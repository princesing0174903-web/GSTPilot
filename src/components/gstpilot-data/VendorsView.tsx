'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Vendors View (Payables / Suppliers)
//
// Real-time vendor list backed by Firestore onSnapshot:
//   organizations/GSTpilot_SAAS/vendors
//
// Features:
//   • Live list (no refresh button) via onSnapshot
//   • Create / Edit / Delete (writes straight to Firestore)
//   • Free-text search (name / email / phone / gstin / state / category / contact)
//   • Stats cards (total / total payable / with GSTIN)
//   • Loading skeletons + empty state + error/retry
//
// NO mock data. Firestore is the only source of truth.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Store,
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
import { useGSTpilotVendors } from '@/hooks/useGSTpilotVendors';
import { STATE_CODES, validateGstin } from '@/lib/gstpilot-data';
import type {
  Vendor,
  CreateVendorInput,
  VendorCategory,
  CustomerType,
} from '@/lib/gstpilot-data';

// ─── Form state ───────────────────────────────────────────────────────────────

interface VendorFormState {
  name: string;
  type: CustomerType;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  address: string;
  state: string;
  category: VendorCategory;
  contactPerson: string;
  notes: string;
}

const EMPTY_FORM: VendorFormState = {
  name: '',
  type: 'business',
  gstin: '',
  pan: '',
  email: '',
  phone: '',
  address: '',
  state: '',
  category: 'Supplier',
  contactPerson: '',
  notes: '',
};

const VENDOR_CATEGORIES: VendorCategory[] = [
  'Supplier',
  'Contractor',
  'Service Provider',
  'Freelancer',
  'Utility',
  'Other',
];

// Per-category accent (Tailwind classes only from the allowed palette).
const CATEGORY_STYLES: Record<VendorCategory, string> = {
  Supplier: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
  Contractor: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
  'Service Provider': 'border-teal-500/30 bg-teal-500/5 text-teal-300',
  Freelancer: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-300',
  Utility: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-300',
  Other: 'border-rose-500/30 bg-rose-500/5 text-rose-300',
};

function formToInput(f: VendorFormState): CreateVendorInput {
  return {
    name: f.name,
    type: f.type,
    gstin: f.gstin || null,
    pan: f.pan || null,
    email: f.email || null,
    phone: f.phone || null,
    address: f.address || null,
    state: f.state || null,
    // stateCode is auto-derived by the service from STATE_CODES,
    // but passing it explicitly keeps the form self-contained.
    stateCode: f.state && f.state in STATE_CODES ? STATE_CODES[f.state] : null,
    category: f.category,
    contactPerson: f.contactPerson || null,
    notes: f.notes || null,
  };
}

function vendorToForm(v: Vendor): VendorFormState {
  return {
    name: v.name,
    type: v.type,
    gstin: v.gstin ?? '',
    pan: v.pan ?? '',
    email: v.email ?? '',
    phone: v.phone ?? '',
    address: v.address ?? '',
    state: v.state ?? '',
    category: v.category,
    contactPerson: v.contactPerson ?? '',
    notes: v.notes ?? '',
  };
}

// ─── Currency helper ─────────────────────────────────────────────────────────

function inrAmount(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VendorsView() {
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
  } = useGSTpilotVendors();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditing(v);
    setForm(vendorToForm(v));
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Vendor name is required.');
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
        toast.success(`Updated vendor “${updated.name}”.`);
        setDialogOpen(false);
      } else {
        setFormError(error || 'Could not update vendor.');
      }
    } else {
      const created = await create(input);
      if (created) {
        toast.success(`Created vendor “${created.name}”.`);
        setDialogOpen(false);
      } else {
        setFormError(error || 'Could not create vendor.');
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await remove(deleteTarget.id);
    if (ok) {
      toast.success(`Deleted vendor “${deleteTarget.name}”.`);
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
            <Store className="h-6 w-6 text-cyan-400" />
            Vendors
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Live vendor registry — synced with Firestore in real-time.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-cyan-500 text-black hover:bg-cyan-400"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Vendor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <Store className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Total Vendors</p>
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
              <p className="text-xs uppercase tracking-wider text-white/40">Total Payable</p>
              <p className="text-2xl font-bold text-white">
                <span className="inline-flex items-center">
                  <IndianRupee className="mr-1 h-5 w-5 text-amber-400" />
                  {inrAmount(stats.totalPayable)}
                </span>
              </p>
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
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search by name, contact, email, GSTIN, category…"
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
                    <TableHead className="text-white/50">Vendor</TableHead>
                    <TableHead className="text-white/50">Category</TableHead>
                    <TableHead className="text-white/50">GSTIN</TableHead>
                    <TableHead className="text-white/50">State</TableHead>
                    <TableHead className="text-right text-white/50">Payable Balance</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => (
                    <TableRow key={v.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] border border-white/10">
                            {v.type === 'business' ? (
                              <Building2 className="h-4 w-4 text-cyan-400" />
                            ) : (
                              <UserIcon className="h-4 w-4 text-teal-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">{v.name}</p>
                            <p className="truncate text-xs text-white/40">
                              {v.contactPerson || v.email || v.phone || '—'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`font-medium ${CATEGORY_STYLES[v.category]}`}
                        >
                          {v.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {v.gstin ? (
                          <Badge variant="outline" className="border-teal-500/30 bg-teal-500/5 font-mono text-teal-300">
                            {v.gstin}
                          </Badge>
                        ) : (
                          <span className="text-white/30 italic">Unregistered</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {v.state ? (
                          <span className="flex items-center gap-1 text-white/60">
                            <MapPin className="h-3 w-3" /> {v.state}
                          </span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {v.balance > 0 ? (
                          <span className="inline-flex items-center justify-end font-medium text-amber-400">
                            <IndianRupee className="mr-0.5 h-3.5 w-3.5" />
                            {inrAmount(v.balance)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-end text-white/30">
                            <IndianRupee className="mr-0.5 h-3.5 w-3.5" />
                            {inrAmount(0)}
                          </span>
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
                            <DropdownMenuItem onClick={() => openEdit(v)} className="text-white/80 focus:text-white">
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(v)}
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
              {editing ? 'Edit Vendor' : 'Create Vendor'}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {editing
                ? 'Update the vendor details. Changes save to Firestore instantly.'
                : 'Add a new vendor. They are saved to Firestore immediately.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-white/70">Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Acme Supplies Pvt Ltd"
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
                <Label className="text-white/70">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v: VendorCategory) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-900">
                    {VENDOR_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
                  placeholder="ap@acmesupplies.in"
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
              <Label className="text-white/70">Contact Person</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="Ravi Sharma (optional)"
                className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-white/70">State</Label>
              <Select
                value={form.state || '__none__'}
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
              <p className="text-xs text-white/40">
                State code is auto-set from the GST state list.
              </p>
            </div>

            <div className="grid gap-2">
              <Label className="text-white/70">Address</Label>
              <Textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 Industrial Estate, Mumbai 400001"
                rows={2}
                className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-white/70">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Internal notes (optional)"
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
              className="bg-cyan-500 text-black hover:bg-cyan-400"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Vendor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-white/10 bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete vendor?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This permanently removes <span className="font-medium text-white/80">{deleteTarget?.name}</span> from Firestore. This action cannot be undone.
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
        <Store className="h-8 w-8 text-white/40" />
      </div>
      <div>
        <p className="text-lg font-semibold text-white">
          {hasSearch ? 'No vendors match your search' : 'No vendors yet'}
        </p>
        <p className="mt-1 text-sm text-white/50">
          {hasSearch
            ? 'Try a different search term.'
            : 'Create your first vendor — it saves straight to Firestore.'}
        </p>
      </div>
      {!hasSearch && (
        <Button onClick={onCreate} className="bg-cyan-500 text-black hover:bg-cyan-400">
          <Plus className="mr-2 h-4 w-4" />
          Create Vendor
        </Button>
      )}
    </div>
  );
}
