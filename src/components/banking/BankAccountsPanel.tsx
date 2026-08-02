'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Bank Accounts Panel (Premium Edition)
//
// Premium bank account cards grid with Add/Edit slide-over sheet, delete
// confirmation dialog, sync action, and per-account dropdown menu. Self-contained:
// if no callbacks are provided, falls back to `useBankingApi()` for create/update/
// delete/sync. Parent owns the accounts list (fetched separately) and passes it in.
//
// Design tokens: pure-black GSTPilot theme. Cards: `glass-surface rounded-2xl
// border border-white/[0.06]`. Primary emerald — NO indigo/blue.
// ═══════════════════════════════════════════════════════════════════════════════

import * as React from 'react';
import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  RefreshCw,
  MoreHorizontal,
  Pencil,
  Trash2,
  User,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useBankingApi } from '@/hooks/useBankingApi';
import { AccountStatusPill, StaggeredItem } from '@/components/banking/BankingStatusPills';
import { BankingEmptyState } from '@/components/banking/BankingEmptyErrorStates';
import type { BankingAccount, BankAccountType } from '@/lib/banking-prisma/types';

// ─── Currency formatter (Indian grouping, ₹ symbol) ──────────────────────────

const inrFormatter = new Intl.NumberFormat('en-IN', {
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatINR(n: number): string {
  return `₹${inrFormatter.format(n)}`;
}

// ─── Bank list (Indian banks + wallets) ───────────────────────────────────────

const BANK_OPTIONS = [
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'State Bank of India',
  'Kotak Mahindra Bank',
  'Yes Bank',
  'IndusInd Bank',
  'IDFC First Bank',
  'Federal Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Cash Wallet',
  'UPI Wallet',
] as const;

// ─── Account type labels ──────────────────────────────────────────────────────

const ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  current: 'Current',
  savings: 'Savings',
  od: 'Overdraft',
  cash_wallet: 'Cash Wallet',
  upi_wallet: 'UPI Wallet',
  credit_card: 'Credit Card',
};

const ACCOUNT_TYPE_OPTIONS: BankAccountType[] = [
  'current',
  'savings',
  'od',
  'cash_wallet',
  'upi_wallet',
];

// ─── Validators ───────────────────────────────────────────────────────────────

// IFSC format: 4 letters + 0 + 6 alphanumeric (11 chars total, e.g. HDFC0001234)
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function isValidIfsc(ifsc: string): boolean {
  return IFSC_REGEX.test(ifsc.trim().toUpperCase());
}

// Hex color validator: accepts #RGB, #RRGGBB, #RRGGBBAA
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function isHexColor(value: string | null | undefined): value is string {
  return !!value && HEX_COLOR_REGEX.test(value);
}

// Default dark color used when bankLogoUrl is not a hex color.
const DEFAULT_BANK_COLOR = '#1f1f23';

function getBankColor(account: BankingAccount): string {
  if (isHexColor(account.bankLogoUrl)) return account.bankLogoUrl;
  return DEFAULT_BANK_COLOR;
}

// ─── Bank logo (colored rounded square with first letter) ────────────────────

function BankLogo({ account }: { account: BankingAccount }) {
  const color = getBankColor(account);
  const initial = (account.bankName || 'B').charAt(0).toUpperCase();
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-inner"
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

// ─── Card skeleton (loading state) ────────────────────────────────────────────

function AccountCardSkeleton() {
  return (
    <div className="glass-surface rounded-2xl border border-white/[0.06] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-24 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-16 animate-pulse rounded bg-white/[0.06]" />
          </div>
        </div>
        <div className="h-5 w-16 animate-pulse rounded-full bg-white/[0.06]" />
      </div>
      <div className="mb-2 h-7 w-32 animate-pulse rounded bg-white/[0.06]" />
      <div className="mb-4 h-3 w-28 animate-pulse rounded bg-white/[0.06]" />
      <div className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
    </div>
  );
}

// ─── Account Card ─────────────────────────────────────────────────────────────

interface AccountCardProps {
  account: BankingAccount;
  index: number;
  onSync: (id: string) => Promise<void>;
  onEdit: (account: BankingAccount) => void;
  onDelete: (account: BankingAccount) => void;
  syncingId: string | null;
}

const AccountCard = React.memo(function AccountCard({
  account,
  index,
  onSync,
  onEdit,
  onDelete,
  syncingId,
}: AccountCardProps) {
  const isSyncing = syncingId === account.id;

  return (
    <StaggeredItem index={index} className="h-full">
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="glass-surface flex h-full flex-col rounded-2xl border border-white/[0.06] p-5 transition-colors hover:border-white/[0.12]"
      >
        {/* Top row: logo + bank name + type label + status pill */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BankLogo account={account} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {account.bankName}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {ACCOUNT_TYPE_LABELS[account.accountType] ?? account.accountType}
              </p>
            </div>
          </div>
          <AccountStatusPill status={account.status} />
        </div>

        {/* Account number (masked, mono) */}
        <p className="mb-3 font-mono text-xs text-muted-foreground">
          {account.accountMasked || account.accountNumber}
        </p>

        {/* Balance */}
        <div className="mb-3">
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {formatINR(account.balance)}
          </p>
          <p className="text-xs text-muted-foreground">
            Available: {formatINR(account.availableBalance)}
          </p>
        </div>

        {/* IFSC + Branch */}
        <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              IFSC
            </p>
            <p className="truncate font-mono text-foreground/90">
              {account.ifsc || '—'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Branch
            </p>
            <p className="truncate text-foreground/90">{account.branch || '—'}</p>
          </div>
        </div>

        {/* Owner */}
        {account.owner && (
          <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{account.owner}</span>
          </div>
        )}

        {/* Monthly inflow / outflow */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-emerald-500/[0.06] p-2">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-400">
              <ArrowDownLeft className="h-3 w-3" />
              Inflow
            </p>
            <p className="text-sm font-semibold tabular-nums text-emerald-300">
              {formatINR(account.monthlyInflow)}
            </p>
          </div>
          <div className="rounded-lg bg-red-500/[0.06] p-2">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-red-400">
              <ArrowUpRight className="h-3 w-3" />
              Outflow
            </p>
            <p className="text-sm font-semibold tabular-nums text-red-300">
              {formatINR(account.monthlyOutflow)}
            </p>
          </div>
        </div>

        {/* Footer: txn count + last sync + actions */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="flex min-w-0 items-center gap-2">
            <Badge
              variant="outline"
              className="border-white/[0.08] bg-white/[0.02] text-muted-foreground"
            >
              {account.transactionCount} txns
            </Badge>
            <span className="truncate text-[11px] text-muted-foreground">
              {account.lastSyncAt ? `Synced ${account.lastSyncAgo}` : 'Never synced'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-white/[0.06]"
              onClick={() => onSync(account.id)}
              disabled={isSyncing}
              loading={isSyncing}
              aria-label="Sync account"
            >
              {!isSyncing && <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-white/[0.06]"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => onSync(account.id)}
                  disabled={isSyncing}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync now
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(account)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(account)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>
    </StaggeredItem>
  );
});

// ─── Add/Edit form state ──────────────────────────────────────────────────────

interface AccountFormState {
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  owner: string;
  accountType: BankAccountType;
  upiHandle: string;
  openingBalance: string;
}

const EMPTY_FORM: AccountFormState = {
  bankName: '',
  accountNumber: '',
  ifsc: '',
  branch: '',
  owner: '',
  accountType: 'current',
  upiHandle: '',
  openingBalance: '',
};

function formFromAccount(a: BankingAccount): AccountFormState {
  return {
    bankName: a.bankName,
    accountNumber: a.accountNumber,
    ifsc: a.ifsc ?? '',
    branch: a.branch ?? '',
    owner: a.owner ?? '',
    accountType: a.accountType,
    upiHandle: a.upiHandle ?? '',
    openingBalance: String(a.balance ?? 0),
  };
}

// ─── Add/Edit Sheet ───────────────────────────────────────────────────────────

interface AccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: BankingAccount | null;
  onSave: (form: AccountFormState, id: string | null) => Promise<void>;
  saving: boolean;
}

function AccountSheet({ open, onOpenChange, initial, onSave, saving }: AccountSheetProps) {
  const [form, setForm] = useState<AccountFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof AccountFormState, string>>>({});

  // Reset form whenever the sheet opens or the target account changes.
  React.useEffect(() => {
    if (open) {
      setForm(initial ? formFromAccount(initial) : EMPTY_FORM);
      setErrors({});
    }
  }, [open, initial]);

  function update<K extends keyof AccountFormState>(key: K, value: AccountFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function validate(): boolean {
    const next: Partial<Record<keyof AccountFormState, string>> = {};
    if (!form.bankName) next.bankName = 'Bank name is required';
    if (!form.accountNumber) next.accountNumber = 'Account number is required';
    if (form.ifsc && !isValidIfsc(form.ifsc)) {
      next.ifsc = 'IFSC must be 4 letters + 0 + 6 alphanumeric (e.g. HDFC0001234)';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await onSave(form, initial?.id ?? null);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-emerald-400" />
            {initial ? 'Edit Account' : 'Add Bank Account'}
          </SheetTitle>
          <SheetDescription>
            {initial
              ? 'Update the account details below.'
              : 'Connect a new bank account or wallet to GSTPilot.'}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6">
          {/* Bank Name */}
          <div className="space-y-1.5">
            <Label htmlFor="bankName">Bank Name *</Label>
            <Select value={form.bankName} onValueChange={(v) => update('bankName', v)}>
              <SelectTrigger id="bankName" className="w-full">
                <SelectValue placeholder="Select a bank" />
              </SelectTrigger>
              <SelectContent>
                {BANK_OPTIONS.map((bank) => (
                  <SelectItem key={bank} value={bank}>
                    {bank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.bankName && <p className="text-xs text-red-400">{errors.bankName}</p>}
          </div>

          {/* Account Number */}
          <div className="space-y-1.5">
            <Label htmlFor="accountNumber">Account Number *</Label>
            <Input
              id="accountNumber"
              value={form.accountNumber}
              onChange={(e) => update('accountNumber', e.target.value)}
              placeholder="e.g. 501000123456789"
              autoComplete="off"
            />
            {errors.accountNumber && (
              <p className="text-xs text-red-400">{errors.accountNumber}</p>
            )}
          </div>

          {/* IFSC */}
          <div className="space-y-1.5">
            <Label htmlFor="ifsc">IFSC Code</Label>
            <Input
              id="ifsc"
              value={form.ifsc}
              onChange={(e) => update('ifsc', e.target.value.toUpperCase())}
              placeholder="e.g. HDFC0001234"
              className="font-mono uppercase"
              autoComplete="off"
            />
            {errors.ifsc && <p className="text-xs text-red-400">{errors.ifsc}</p>}
          </div>

          {/* Branch */}
          <div className="space-y-1.5">
            <Label htmlFor="branch">Branch</Label>
            <Input
              id="branch"
              value={form.branch}
              onChange={(e) => update('branch', e.target.value)}
              placeholder="e.g. MG Road, Bengaluru"
              autoComplete="off"
            />
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <Label htmlFor="owner">Owner</Label>
            <Input
              id="owner"
              value={form.owner}
              onChange={(e) => update('owner', e.target.value)}
              placeholder="Account holder name"
              autoComplete="off"
            />
          </div>

          {/* Account Type */}
          <div className="space-y-1.5">
            <Label>Account Type *</Label>
            <Select
              value={form.accountType}
              onValueChange={(v) => update('accountType', v as BankAccountType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* UPI Handle (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="upiHandle">UPI Handle (optional)</Label>
            <Input
              id="upiHandle"
              value={form.upiHandle}
              onChange={(e) => update('upiHandle', e.target.value)}
              placeholder="e.g. yourname@hdfcbank"
              autoComplete="off"
            />
          </div>

          {/* Opening Balance */}
          <div className="space-y-1.5">
            <Label htmlFor="openingBalance">Opening Balance (₹)</Label>
            <Input
              id="openingBalance"
              type="number"
              inputMode="numeric"
              value={form.openingBalance}
              onChange={(e) => update('openingBalance', e.target.value)}
              placeholder="0"
              autoComplete="off"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={saving}
              className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
            >
              {initial ? 'Save Changes' : 'Add Account'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Delete Confirmation Dialog ───────────────────────────────────────────────

interface DeleteDialogProps {
  account: BankingAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  deleting: boolean;
}

function DeleteDialog({ account, open, onOpenChange, onConfirm, deleting }: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-400" />
            Delete account
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{' '}
            <strong className="text-foreground">{account?.bankName}</strong>
            {account?.accountMasked ? (
              <>
                {' '}
                (<span className="font-mono">{account.accountMasked}</span>)?
              </>
            ) : (
              '?'
            )}{' '}
            This action cannot be undone. All linked transactions and reconciliation
            records will remain in your ledger.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            loading={deleting}
            onClick={onConfirm}
          >
            Delete Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Panel header (title + count badge + Add Account button) ─────────────────

function PanelHeader({ count, onAdd }: { count: number; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Bank Accounts
        </h2>
        <Badge
          variant="outline"
          className="border-white/[0.08] bg-white/[0.04] text-muted-foreground"
        >
          {count} {count === 1 ? 'account' : 'accounts'}
        </Badge>
      </div>
      <Button
        size="sm"
        onClick={onAdd}
        className="gap-1.5 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
      >
        <Plus className="h-4 w-4" />
        Add Account
      </Button>
    </div>
  );
}

// ─── Props + Main panel ───────────────────────────────────────────────────────

export interface BankAccountsPanelProps {
  accounts: BankingAccount[];
  onSync?: (id: string) => Promise<void>;
  onAdd?: () => void;
  onEdit?: (account: BankingAccount) => void;
  onDelete?: (id: string) => Promise<void>;
  loading?: boolean;
}

export function BankAccountsPanel({
  accounts,
  onSync,
  onAdd,
  onEdit,
  onDelete,
  loading = false,
}: BankAccountsPanelProps) {
  const api = useBankingApi();

  // Sheet (Add/Edit) state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankingAccount | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<BankingAccount | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync state — tracks which account is currently syncing (for the spinner)
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAddClick = useCallback(() => {
    if (onAdd) {
      onAdd();
      return;
    }
    setEditingAccount(null);
    setSheetOpen(true);
  }, [onAdd]);

  const handleEditClick = useCallback(
    (account: BankingAccount) => {
      if (onEdit) {
        onEdit(account);
        return;
      }
      setEditingAccount(account);
      setSheetOpen(true);
    },
    [onEdit],
  );

  const handleSync = useCallback(
    async (id: string) => {
      setSyncingId(id);
      try {
        if (onSync) {
          await onSync(id);
        } else {
          const result = await api.syncAccount(id);
          toast.success(
            result?.newTransactions
              ? `Synced — ${result.newTransactions} new transactions`
              : 'Account synced',
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Sync failed');
      } finally {
        setSyncingId(null);
      }
    },
    [api, onSync],
  );

  const handleSave = useCallback(
    async (form: AccountFormState, id: string | null) => {
      setSaving(true);
      try {
        const payload: Partial<BankingAccount> & {
          bankName: string;
          accountNumber: string;
        } = {
          bankName: form.bankName,
          accountNumber: form.accountNumber,
          ifsc: form.ifsc || null,
          branch: form.branch || null,
          owner: form.owner || null,
          accountType: form.accountType,
          upiHandle: form.upiHandle || null,
          balance: form.openingBalance ? Number(form.openingBalance) : 0,
        };
        if (id) {
          await api.updateAccount(id, payload);
          toast.success('Account updated');
        } else {
          await api.createAccount(payload);
          toast.success('Account added');
        }
        setSheetOpen(false);
        setEditingAccount(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    },
    [api],
  );

  const handleDeleteClick = useCallback((account: BankingAccount) => {
    setDeleteTarget(account);
    setDeleteOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (onDelete) {
        await onDelete(deleteTarget.id);
      } else {
        await api.deleteAccount(deleteTarget.id);
        toast.success('Account deleted');
      }
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }, [api, deleteTarget, onDelete]);

  // ─── Empty state ───────────────────────────────────────────────────────────

  if (!loading && accounts.length === 0) {
    return (
      <div className="space-y-4">
        <PanelHeader count={0} onAdd={handleAddClick} />
        <BankingEmptyState variant="compact" onConnect={handleAddClick} />
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <PanelHeader count={accounts.length} onAdd={handleAddClick} />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <AccountCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account, i) => (
            <AccountCard
              key={account.id}
              account={account}
              index={i}
              onSync={handleSync}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              syncingId={syncingId}
            />
          ))}
        </div>
      )}

      <AccountSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initial={editingAccount}
        onSave={handleSave}
        saving={saving}
      />

      <DeleteDialog
        account={deleteTarget}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}

export default BankAccountsPanel;
