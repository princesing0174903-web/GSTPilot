'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Products View (Inventory)
//
// Real-time product list backed by Firestore onSnapshot:
//   organizations/GSTpilot_SAAS/products
//
// Features:
//   • Live list (no refresh button) via onSnapshot
//   • Create / Edit / Delete (writes straight to Firestore)
//   • Free-text search (name / sku / hsnSac / description)
//   • Stats cards (total / stock value / low / out)
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
  Package,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertCircle,
  RefreshCw,
  Loader2,
  Boxes,
  IndianRupee,
  TrendingDown,
  PackageX,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGSTpilotProducts } from '@/hooks/useGSTpilotProducts';
import {
  GST_RATES,
  DEFAULT_GST_RATE,
  type Product,
  type CreateProductInput,
  type ProductUnit,
  type GstRate,
} from '@/lib/gstpilot-data';

// ─── Form state ───────────────────────────────────────────────────────────────

interface ProductFormState {
  name: string;
  sku: string;
  description: string;
  hsnSac: string;
  gstRate: GstRate;
  unit: ProductUnit;
  price: string;
  costPrice: string;
  stock: string;
  reorderLevel: string;
  isService: boolean;
}

const EMPTY_FORM: ProductFormState = {
  name: '',
  sku: '',
  description: '',
  hsnSac: '',
  gstRate: DEFAULT_GST_RATE,
  unit: 'NOS',
  price: '',
  costPrice: '',
  stock: '',
  reorderLevel: '',
  isService: false,
};

const UNITS: ProductUnit[] = ['NOS', 'KG', 'GM', 'LTR', 'ML', 'MTR', 'BOX', 'PCS', 'SET', 'HR', 'DAY', 'MONTH'];

function formToInput(f: ProductFormState): CreateProductInput {
  return {
    name: f.name,
    sku: f.sku || null,
    description: f.description || null,
    hsnSac: f.hsnSac,
    gstRate: f.gstRate,
    unit: f.unit,
    price: Number(f.price) || 0,
    costPrice: f.costPrice ? Number(f.costPrice) : null,
    stock: f.isService ? null : (f.stock ? Number(f.stock) : 0),
    reorderLevel: f.reorderLevel ? Number(f.reorderLevel) : null,
    isService: f.isService,
  };
}

function productToForm(p: Product): ProductFormState {
  return {
    name: p.name,
    sku: p.sku ?? '',
    description: p.description ?? '',
    hsnSac: p.hsnSac,
    gstRate: p.gstRate,
    unit: p.unit,
    price: String(p.price ?? ''),
    costPrice: p.costPrice == null ? '' : String(p.costPrice),
    stock: p.stock == null ? '' : String(p.stock),
    reorderLevel: p.reorderLevel == null ? '' : String(p.reorderLevel),
    isService: p.isService,
  };
}

function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n || 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductsView() {
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
  } = useGSTpilotProducts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm(productToForm(p));
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Product name is required.');
      return;
    }
    if (!form.price || Number.isNaN(Number(form.price)) || Number(form.price) < 0) {
      setFormError('A valid price is required.');
      return;
    }
    const input = formToInput(form);
    if (editing) {
      const updated = await update(editing.id, input);
      if (updated) {
        toast.success(`Updated product “${updated.name}”.`);
        setDialogOpen(false);
      } else {
        setFormError(error || 'Could not update product.');
      }
    } else {
      const created = await create(input);
      if (created) {
        toast.success(`Created product “${created.name}”.`);
        setDialogOpen(false);
      } else {
        setFormError(error || 'Could not create product.');
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await remove(deleteTarget.id);
    if (ok) {
      toast.success(`Deleted product “${deleteTarget.name}”.`);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Package className="h-6 w-6 text-emerald-400" />
            Products
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Live product & service catalog — synced with Firestore in real-time.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-500 text-black hover:bg-emerald-400">
          <Plus className="mr-2 h-4 w-4" />
          Create Product
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Boxes className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Total</p>
              <p className="text-xl font-bold text-white">{stats.count}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20">
              <IndianRupee className="h-5 w-5 text-teal-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Stock Value</p>
              <p className="text-xl font-bold text-white">{inr(stats.totalStockValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
              <TrendingDown className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Low Stock</p>
              <p className="text-xl font-bold text-white">{stats.lowStockCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
              <PackageX className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Out of Stock</p>
              <p className="text-xl font-bold text-white">{stats.outOfStockCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search by name, SKU, HSN/SAC…"
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
                    <TableHead className="text-white/50">Product</TableHead>
                    <TableHead className="text-white/50">HSN/SAC</TableHead>
                    <TableHead className="text-white/50">GST</TableHead>
                    <TableHead className="text-right text-white/50">Price</TableHead>
                    <TableHead className="text-right text-white/50">Stock</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const low = !p.isService && p.stock != null && p.reorderLevel != null && p.stock > 0 && p.stock <= p.reorderLevel;
                    const out = !p.isService && p.stock != null && p.stock <= 0;
                    return (
                      <TableRow key={p.id} className="border-white/5 hover:bg-white/[0.02]">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] border border-white/10">
                              <Package className="h-4 w-4 text-emerald-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-white">
                                {p.name}
                                {p.isService && (
                                  <Badge variant="outline" className="ml-2 border-violet-500/30 bg-violet-500/5 text-violet-300">
                                    Service
                                  </Badge>
                                )}
                              </p>
                              <p className="truncate text-xs text-white/40">
                                {p.sku ? `SKU: ${p.sku}` : p.description || '—'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.hsnSac ? (
                            <span className="font-mono text-sm text-white/60">{p.hsnSac}</span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-teal-500/30 bg-teal-500/5 text-teal-300">
                            {p.gstRate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-white">{inr(p.price)}</TableCell>
                        <TableCell className="text-right">
                          {p.isService ? (
                            <span className="text-white/30">—</span>
                          ) : out ? (
                            <Badge variant="outline" className="border-rose-500/30 bg-rose-500/5 text-rose-300">
                              Out
                            </Badge>
                          ) : low ? (
                            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/5 text-amber-300">
                              {p.stock} · Low
                            </Badge>
                          ) : (
                            <span className="text-white/70">{p.stock} {p.unit}</span>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-zinc-950 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editing ? 'Edit Product' : 'Create Product'}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {editing
                ? 'Update the product details. Changes save to Firestore instantly.'
                : 'Add a new product or service. It saves to Firestore immediately.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-white/70">Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Consulting Service / Steel Rod 12mm"
                className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div>
                <Label className="text-white/70">Is a service</Label>
                <p className="text-xs text-white/40">Services don&apos;t track stock.</p>
              </div>
              <Switch
                checked={form.isService}
                onCheckedChange={(v) => setForm({ ...form, isService: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-white/70">SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="SR-12MM"
                  className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">HSN/SAC</Label>
                <Input
                  value={form.hsnSac}
                  onChange={(e) => setForm({ ...form, hsnSac: e.target.value })}
                  placeholder="998314 / 7214"
                  className="border-white/10 bg-white/[0.03] font-mono text-white placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-white/70">GST Rate</Label>
                <Select
                  value={String(form.gstRate)}
                  onValueChange={(v) => setForm({ ...form, gstRate: Number(v) as GstRate })}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-900">
                    {GST_RATES.map((r) => (
                      <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">Unit</Label>
                <Select
                  value={form.unit}
                  onValueChange={(v: ProductUnit) => setForm({ ...form, unit: v })}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-900">
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-white/70">Price (₹) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="1500"
                  className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-white/70">Cost Price (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                  placeholder="1000"
                  className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                />
              </div>
            </div>

            {!form.isService && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-white/70">Opening Stock</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    placeholder="0"
                    className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-white/70">Reorder Level</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.reorderLevel}
                    onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                    placeholder="10"
                    className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label className="text-white/70">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
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
              {editing ? 'Save Changes' : 'Create Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-white/10 bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete product?</AlertDialogTitle>
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

function EmptyState({ onCreate, hasSearch }: { onCreate: () => void; hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/10">
        <Package className="h-8 w-8 text-white/40" />
      </div>
      <div>
        <p className="text-lg font-semibold text-white">
          {hasSearch ? 'No products match your search' : 'No products yet'}
        </p>
        <p className="mt-1 text-sm text-white/50">
          {hasSearch
            ? 'Try a different search term.'
            : 'Create your first product — it saves straight to Firestore.'}
        </p>
      </div>
      {!hasSearch && (
        <Button onClick={onCreate} className="bg-emerald-500 text-black hover:bg-emerald-400">
          <Plus className="mr-2 h-4 w-4" />
          Create Product
        </Button>
      )}
    </div>
  );
}
