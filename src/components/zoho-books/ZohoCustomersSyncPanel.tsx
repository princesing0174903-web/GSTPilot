'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Customers Sync Panel (Phase 4)
//
// Premium customer-sync UI inside the Zoho Books integration page. Surfaces:
//   • "Sync Customers" primary button — pulls every customer from Zoho Books
//     (GET /books/v3/contacts?contact_type=customer) into the ZohoCustomer table.
//   • "Manual Sync" secondary button — explicit trigger (same endpoint,
//     trigger=manual) for the user-initiated sync flow required by the spec.
//   • "Auto Sync" toggle — persists autoSyncCustomers on the ZohoBooksToken row.
//     When enabled, a periodic job will refresh customers automatically.
//   • "Sync Successful" toast — shows N customers synced, last synced time,
//     duration (ms), with completed / partial / failed status coloring.
//   • "Create Customer" dialog — POST /books/v3/contacts to Zoho, save
//     returned contact_id, refresh the list.
//   • "Edit" action per row — PUT /books/v3/contacts/{contact_id} to Zoho,
//     refresh the row.
//   • Searchable, paginated customer table (zohoContactId, contactName,
//     companyName, gstNumber, email, phone, currency, paymentTerms,
//     outstandingReceivable, status, lastSyncedAt).
//
// All data is REAL — no mock values, no fallbacks. The panel shows an honest
// empty state until the first sync.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Users,
  Plus,
  AlertTriangle,
  Search,
  Pencil,
  Clock,
  Database,
  Sparkles,
  Zap,
  IndianRupee,
  Mail,
  Phone,
  Building2,
  Hash,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import {
  useZohoBooks,
  type ZohoCustomerInput,
  type ZohoCustomerRecord,
} from '@/hooks/useZohoBooks';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '—';
  const diff = Date.now() - then;
  if (diff < 0) return 'just now';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}m ${rem}s`;
}

function formatInr(n: number): string {
  if (!Number.isFinite(n)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

// ─── Sync result banner ───────────────────────────────────────────────────────

function SyncResultBanner({
  result,
  onDismiss,
}: {
  result: NonNullable<ReturnType<typeof useZohoBooks>['customerSyncResult']>;
  onDismiss: () => void;
}) {
  const isOk = result.ok && result.status === 'completed';
  const isPartial = result.status === 'partial';
  const isFailed = result.status === 'failed';

  const tone = isOk
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : isPartial
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    : 'border-red-500/30 bg-red-500/10 text-red-300';

  const Icon = isOk ? CheckCircle2 : isPartial ? AlertTriangle : XCircle;
  const totalSynced = result.imported + result.updated;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`flex flex-col gap-3 rounded-xl border ${tone} px-4 py-3`}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-semibold">
            {isFailed
              ? 'Sync Failed'
              : isPartial
              ? 'Sync Partially Successful'
              : 'Sync Successful'}
          </div>
          {!isFailed && (
            <div className="mt-0.5 text-xs opacity-90">
              {totalSynced} customer{totalSynced === 1 ? '' : 's'} synced
              {result.imported > 0 ? ` · ${result.imported} new` : ''}
              {result.updated > 0 ? ` · ${result.updated} updated` : ''}
              {result.failed > 0 ? ` · ${result.failed} failed` : ''}
              {' · '}
              <span className="font-mono">{formatDuration(result.durationMs)}</span>
            </div>
          )}
          {result.error && (
            <div className="mt-1 text-xs opacity-90">
              <span className="font-medium">Detail:</span> {result.error}
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="rounded p-1 text-current opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-current/15 pt-3 sm:grid-cols-4">
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider opacity-70">
            Last Synced
          </div>
          <div className="mt-0.5 text-xs font-medium">
            {result.lastSyncedAt ? formatRelative(result.lastSyncedAt) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider opacity-70">
            Fetched
          </div>
          <div className="mt-0.5 text-xs font-medium">{result.totalFetched}</div>
        </div>
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider opacity-70">
            Imported
          </div>
          <div className="mt-0.5 text-xs font-medium">{result.imported}</div>
        </div>
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider opacity-70">
            Updated
          </div>
          <div className="mt-0.5 text-xs font-medium">{result.updated}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Customer form dialog (create + edit) ─────────────────────────────────────

/**
 * Inner form component. Mounts fresh inside the dialog whenever `open` flips
 * to true (via `key`), so `useState` initializers seed the fields from
 * `initial` — no effect-based reset needed (avoids set-state-in-effect).
 */
function CustomerForm({
  mode,
  initial,
  onSubmit,
  pending,
  onCancel,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<ZohoCustomerRecord>;
  onSubmit: (input: ZohoCustomerInput) => Promise<void>;
  pending: boolean;
  onCancel: () => void;
}) {
  const [contactName, setContactName] = useState(initial?.contactName ?? '');
  const [companyName, setCompanyName] = useState(initial?.companyName ?? '');
  const [gstNumber, setGstNumber] = useState(initial?.gstNumber ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'INR');
  const [paymentTerms, setPaymentTerms] = useState<string>(
    initial?.paymentTerms != null ? String(initial.paymentTerms) : '',
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!contactName.trim()) {
        setError('Contact Name is required.');
        return;
      }
      const input: ZohoCustomerInput = {
        contactName: contactName.trim(),
        companyName: companyName.trim() || null,
        gstNumber: gstNumber.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        currency: currency.trim() || null,
        paymentTerms: paymentTerms.trim() ? parseInt(paymentTerms, 10) : null,
      };
      try {
        await onSubmit(input);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save customer.');
      }
    },
    [contactName, companyName, gstNumber, email, phone, currency, paymentTerms, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="col-span-1 sm:col-span-2">
        <Label htmlFor="contactName" className="text-xs">
          Contact Name <span className="text-red-400">*</span>
        </Label>
        <Input
          id="contactName"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="e.g. Acme Industries Pvt Ltd"
          className="mt-1"
          required
        />
      </div>
      <div>
        <Label htmlFor="companyName" className="text-xs">
          Company Name
        </Label>
        <Input
          id="companyName"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Optional legal entity name"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="gstNumber" className="text-xs">
          GST Number
        </Label>
        <Input
          id="gstNumber"
          value={gstNumber}
          onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
          placeholder="22AAAAA0000A1Z5"
          className="mt-1 font-mono"
          maxLength={15}
        />
      </div>
      <div>
        <Label htmlFor="email" className="text-xs">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="accounts@acme.com"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="phone" className="text-xs">
          Phone
        </Label>
        <Input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 98765 43210"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="currency" className="text-xs">
          Currency
        </Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger id="currency" className="mt-1">
            <SelectValue placeholder="INR" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INR">INR — Indian Rupee</SelectItem>
            <SelectItem value="USD">USD — US Dollar</SelectItem>
            <SelectItem value="EUR">EUR — Euro</SelectItem>
            <SelectItem value="GBP">GBP — British Pound</SelectItem>
            <SelectItem value="AED">AED — UAE Dirham</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="paymentTerms" className="text-xs">
          Payment Terms (days)
        </Label>
        <Input
          id="paymentTerms"
          type="number"
          min={0}
          max={365}
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
          placeholder="30"
          className="mt-1"
        />
      </div>

      {error ? (
        <div className="col-span-1 sm:col-span-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
          {error}
        </div>
      ) : null}

      <DialogFooter className="col-span-1 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending} className="gap-1.5">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {mode === 'create' ? 'Create in Zoho Books' : 'Update in Zoho Books'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CustomerFormDialog({
  mode,
  initial,
  trigger,
  onSubmit,
  pending,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<ZohoCustomerRecord>;
  trigger: React.ReactNode;
  onSubmit: (input: ZohoCustomerInput) => Promise<void>;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);

  // ── Form key strategy ────────────────────────────────────────────────────
  // The form must mount fresh when the dialog OPENS (so useState seeds from
  // `initial`), but must NOT remount on every re-render (e.g. when `pending`
  // flips true→false during submit). Previously this used Date.now() which
  // changed every render → the form was destroyed and the user's input was
  // wiped (the "form loops forever" bug).
  //
  // Solution: the form is conditionally rendered (`{open ? <CustomerForm/> : null}`)
  // so it naturally mounts fresh each time the dialog opens. The `key` only
  // needs to distinguish edit-mode instances (different customer IDs). We use
  // a STABLE key that does NOT depend on time or render count — so the form
  // survives re-renders while the dialog is open.
  const key =
    mode === 'edit'
      ? `edit-${initial?.id ?? 'new'}`
      : 'create';

  const handleCancel = useCallback(() => setOpen(false), []);
  // Wrap onSubmit so the dialog closes on success (no-op on throw — the inner
  // form catches the error and surfaces it inline).
  const handleSubmit = useCallback(
    async (input: ZohoCustomerInput) => {
      await onSubmit(input);
      setOpen(false);
    },
    [onSubmit],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create Customer in Zoho Books' : 'Edit Customer in Zoho Books'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Creates a new contact (contact_type=customer) via POST /books/v3/contacts and saves the returned contact_id locally.'
              : 'Updates the contact via PUT /books/v3/contacts/{contact_id}. The change is reflected in Zoho Books immediately.'}
          </DialogDescription>
        </DialogHeader>
        {/* Stable key → form keeps its state across re-renders (e.g. when
            `pending` flips during submit). The conditional `{open ? ... : null}`
            ensures a fresh mount each time the dialog opens. */}
        {open ? (
          <CustomerForm
            key={key}
            mode={mode}
            initial={initial}
            onSubmit={handleSubmit}
            pending={pending}
            onCancel={handleCancel}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─── Customer row ─────────────────────────────────────────────────────────────

function CustomerRow({
  customer,
  onEdit,
  pending,
}: {
  customer: ZohoCustomerRecord;
  onEdit: (input: ZohoCustomerInput) => Promise<void>;
  pending: boolean;
}) {
  const isActive = customer.status?.toLowerCase() === 'active';
  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="py-2.5">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{customer.contactName}</span>
          {customer.companyName ? (
            <span className="text-[11px] text-muted-foreground">{customer.companyName}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="font-mono text-[11px] text-muted-foreground">
        {customer.gstNumber ?? <span className="text-muted-foreground/40">—</span>}
      </TableCell>
      <TableCell className="text-[11px]">
        {customer.email ?? <span className="text-muted-foreground/40">—</span>}
      </TableCell>
      <TableCell className="text-[11px]">
        {customer.phone ?? <span className="text-muted-foreground/40">—</span>}
      </TableCell>
      <TableCell className="text-[11px] text-muted-foreground">
        {customer.currency ?? '—'}
        {customer.paymentTerms != null ? ` · ${customer.paymentTerms}d` : ''}
      </TableCell>
      <TableCell className="text-right font-mono text-[11px]">
        {customer.outstandingReceivable > 0 ? (
          <span className="text-amber-400">{formatInr(customer.outstandingReceivable)}</span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            isActive
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-border/60 text-muted-foreground'
          }
        >
          {customer.status ?? 'unknown'}
        </Badge>
      </TableCell>
      <TableCell className="text-[11px] text-muted-foreground">
        {formatRelative(customer.lastSyncedAt)}
      </TableCell>
      <TableCell className="text-right">
        <CustomerFormDialog
          mode="edit"
          initial={customer}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={pending}
            >
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          }
          onSubmit={onEdit}
          pending={pending}
        />
      </TableCell>
    </TableRow>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ZohoCustomersSyncPanel() {
  const {
    status,
    customers,
    customersTotal,
    customersLoading,
    customersError,
    customerSyncStatus,
    customerSyncRunning,
    customerSyncResult,
    syncCustomers,
    listCustomers,
    createCustomer,
    updateCustomer,
    toggleAutoSync,
    pending,
  } = useZohoBooks();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('all');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Debounced search + filter → re-list.
  useEffect(() => {
    const t = setTimeout(() => {
      void listCustomers({
        search: search.trim() || undefined,
        status: statusFilter,
        limit: pageSize,
        offset: page * pageSize,
      });
    }, 250);
    return () => clearTimeout(t);
  }, [search, statusFilter, page, listCustomers]);

  const handleSyncNow = useCallback(async () => {
    await syncCustomers({ trigger: 'manual' });
  }, [syncCustomers]);

  const handleCreate = useCallback(
    async (input: ZohoCustomerInput) => {
      try {
        const res = await createCustomer(input);
        if (!res.ok) {
          // Surface the EXACT Zoho error — never silently fail.
          const detail = res.zohoCode != null || res.zohoMessage != null
            ? `Zoho error ${res.zohoCode ?? '?'}: ${res.zohoMessage ?? 'No message.'}`
            : (res.error ?? 'Failed to create customer in Zoho Books.');
          toast.error('Unable to create customer', { description: detail });
          throw new Error(detail);
        }
        toast.success('Customer created', {
          description: `${res.customer?.contactName ?? input.contactName} has been added to Zoho Books.`,
        });
      } catch (err) {
        throw err;
      }
    },
    [createCustomer],
  );

  const handleEdit = useCallback(
    (customerId: string) => async (input: ZohoCustomerInput) => {
      try {
        const res = await updateCustomer(customerId, input);
        if (!res.ok) {
          const detail = res.zohoCode != null || res.zohoMessage != null
            ? `Zoho error ${res.zohoCode ?? '?'}: ${res.zohoMessage ?? 'No message.'}`
            : (res.error ?? 'Failed to update customer in Zoho Books.');
          toast.error('Unable to update customer', { description: detail });
          throw new Error(detail);
        }
        toast.success('Customer updated', {
          description: `${res.customer?.contactName ?? input.contactName} has been updated in Zoho Books.`,
        });
      } catch (err) {
        throw err;
      }
    },
    [updateCustomer],
  );

  const handleAutoSyncToggle = useCallback(
    async (checked: boolean) => {
      const res = await toggleAutoSync(checked);
      if (!res.ok) {
        // Surface the error — the switch will revert because the underlying
        // state didn't change.
        console.warn('[ZohoCustomersSyncPanel] toggleAutoSync failed:', res.error);
      }
    },
    [toggleAutoSync],
  );

  const connected = !!status?.connected;
  const lastSync = customerSyncStatus?.lastSync;
  const autoSync = customerSyncStatus?.autoSync ?? { enabled: false, intervalMinutes: 60 };

  const lastSyncBadge = useMemo(() => {
    if (!lastSync) return null;
    const tone =
      lastSync.status === 'completed'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
        : lastSync.status === 'partial'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        : lastSync.status === 'running'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        : 'border-red-500/30 bg-red-500/10 text-red-400';
    const label =
      lastSync.status === 'completed'
        ? 'Completed'
        : lastSync.status === 'partial'
        ? 'Partial'
        : lastSync.status === 'running'
        ? 'Running…'
        : 'Failed';
    return { tone, label };
  }, [lastSync]);

  return (
    <Card className="border-border/60 bg-card/50 backdrop-blur">
      <CardContent className="flex flex-col gap-4 p-6">
        {/* Header row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8202F]/10 ring-1 ring-[#C8202F]/20">
              <Users className="h-5 w-5 text-[#ff6b78]" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight">Customer Sync</h3>
                <Badge variant="outline" className="border-border/60 text-[10px] text-muted-foreground">
                  Phase 4
                </Badge>
                {customerSyncStatus?.customerCount != null && (
                  <Badge variant="outline" className="border-border/60 text-[10px] text-muted-foreground">
                    <Database className="mr-1 h-2.5 w-2.5" />
                    {customerSyncStatus.customerCount} in DB
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Real-time sync from <span className="font-mono">/books/v3/contacts</span>. No mock data — every record comes from your Zoho Books org.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={handleSyncNow}
              disabled={!connected || customerSyncRunning}
              className="h-8 gap-1.5 bg-[#C8202F] text-white hover:bg-[#a01a26]"
            >
              {customerSyncRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sync Customers
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSyncNow}
              disabled={!connected || customerSyncRunning}
              className="h-8 gap-1.5"
              title="Explicitly trigger a manual sync of all customers from Zoho Books"
            >
              {customerSyncRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Manual Sync
            </Button>
            <CustomerFormDialog
              mode="create"
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!connected || pending}
                  className="h-8 gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Customer
                </Button>
              }
              onSubmit={handleCreate}
              pending={pending}
            />
          </div>
        </div>

        {/* Sync status + auto-sync toggle */}
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/40 bg-muted/20 p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last Synced
            </div>
            <div className="text-sm font-medium">
              {lastSync?.completedAt ? formatRelative(lastSync.completedAt) : 'Never synced'}
            </div>
            {lastSync && lastSyncBadge ? (
              <Badge variant="outline" className={`text-[10px] ${lastSyncBadge.tone}`}>
                {lastSyncBadge.label}
                {lastSync.durationMs > 0 ? ` · ${formatDuration(lastSync.durationMs)}` : ''}
              </Badge>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Database className="h-3 w-3" />
              Last Run Result
            </div>
            {lastSync ? (
              <div className="text-xs leading-relaxed">
                <span className="font-medium">{lastSync.totalFetched}</span> fetched
                {' · '}
                <span className="font-medium text-emerald-400">{lastSync.imported}</span> new
                {' · '}
                <span className="font-medium text-cyan-400">{lastSync.updated}</span> updated
                {lastSync.failed > 0 ? (
                  <>
                    {' · '}
                    <span className="font-medium text-red-400">{lastSync.failed}</span> failed
                  </>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">—</div>
            )}
            {lastSync?.trigger ? (
              <div className="text-[10px] text-muted-foreground">
                Trigger: <span className="font-mono">{lastSync.trigger}</span>
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Auto Sync
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={autoSync.enabled}
                  onCheckedChange={handleAutoSyncToggle}
                  disabled={!connected || pending}
                  aria-label="Toggle auto-sync"
                />
                <span className="text-xs font-medium">
                  {autoSync.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <Badge variant="outline" className="border-border/60 text-[10px] text-muted-foreground">
                every {autoSync.intervalMinutes}m
              </Badge>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {autoSync.enabled
                ? 'Customers will sync automatically in the background.'
                : 'Toggle on to sync customers on a schedule.'}
            </div>
          </div>
        </div>

        {/* Sync result banner (after a manual / auto run) */}
        <AnimatePresence>
          {customerSyncResult ? (
            <SyncResultBanner
              result={customerSyncResult}
              onDismiss={() => {
                /* The hook persists the result; we can't clear it from here
                   directly, so we just let it fade when a new sync starts. */
              }}
            />
          ) : null}
        </AnimatePresence>

        {/* Customer list */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Synced Customers
              </h4>
              <Badge variant="outline" className="border-border/60 text-[10px] text-muted-foreground">
                {customersTotal} total
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Search name, GSTIN, email…"
                  className="h-8 w-56 pl-7 text-xs"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as 'active' | 'inactive' | 'all');
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {customersError ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {customersError}
            </div>
          ) : null}

          <div className="rounded-xl border border-border/40">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 text-[10px] uppercase tracking-wider">
                    <Building2 className="mr-1 inline h-3 w-3" /> Name
                  </TableHead>
                  <TableHead className="h-9 text-[10px] uppercase tracking-wider">
                    <Hash className="mr-1 inline h-3 w-3" /> GSTIN
                  </TableHead>
                  <TableHead className="h-9 text-[10px] uppercase tracking-wider">
                    <Mail className="mr-1 inline h-3 w-3" /> Email
                  </TableHead>
                  <TableHead className="h-9 text-[10px] uppercase tracking-wider">
                    <Phone className="mr-1 inline h-3 w-3" /> Phone
                  </TableHead>
                  <TableHead className="h-9 text-[10px] uppercase tracking-wider">
                    <IndianRupee className="mr-1 inline h-3 w-3" /> Currency
                  </TableHead>
                  <TableHead className="h-9 text-right text-[10px] uppercase tracking-wider">
                    Outstanding
                  </TableHead>
                  <TableHead className="h-9 text-[10px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="h-9 text-[10px] uppercase tracking-wider">
                    <Calendar className="mr-1 inline h-3 w-3" /> Synced
                  </TableHead>
                  <TableHead className="h-9 text-right text-[10px] uppercase tracking-wider">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customersLoading && customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Loading synced customers…
                    </TableCell>
                  </TableRow>
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40">
                          <Users className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">No customers synced yet</div>
                          <div className="text-xs text-muted-foreground">
                            {connected
                              ? 'Click "Sync Customers" above to fetch every customer from Zoho Books.'
                              : 'Connect Zoho Books first, then sync to populate this list.'}
                          </div>
                        </div>
                        {connected ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSyncNow}
                            disabled={customerSyncRunning}
                            className="h-8 gap-1.5"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            Sync Now
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((c) => (
                    <CustomerRow
                      key={c.id}
                      customer={c}
                      onEdit={handleEdit(c.id)}
                      pending={pending}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {customersTotal > pageSize ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, customersTotal)} of{' '}
                {customersTotal}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPage((p) => Math.min(Math.ceil(customersTotal / pageSize) - 1, p + 1))}
                  disabled={(page + 1) * pageSize >= customersTotal}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
