'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Landmark,
  Plus,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  CreditCard,
  Wallet,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProfessionalEmptyState } from '@/components/shared';
import { toast } from 'sonner';
import {
  useFetch,
  apiPost,
  fmtINR,
  fmtINRFull,
  relativeTime,
  ACCOUNT_STATUS_META,
  ACCOUNT_TYPE_LABELS,
} from './helpers';
import type { BankingAccount, AccountType } from '@/lib/banking-service/types';

interface AccountsResponse {
  ok: boolean;
  accounts: BankingAccount[];
}

interface AccountsTabProps {
  onNavigateToTransactions?: (accountId?: string) => void;
}

// ─── Account card ─────────────────────────────────────────────────────────────

function AccountCard({
  account,
  onSync,
  onView,
}: {
  account: BankingAccount;
  onSync: (a: BankingAccount) => void;
  onView: (a: BankingAccount) => void;
}) {
  const meta = ACCOUNT_STATUS_META[account.status] ?? ACCOUNT_STATUS_META.disconnected;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Landmark className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="text-base">{account.bankName}</CardTitle>
                <CardDescription className="text-xs">{account.accountName}</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={meta.color}>
              <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-xs text-muted-foreground">{account.accountMasked}</span>
            <Badge variant="secondary" className="text-[10px]">
              {ACCOUNT_TYPE_LABELS[account.accountType]}
            </Badge>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</div>
            <div className="text-2xl font-semibold tracking-tight">{fmtINR(account.balance)}</div>
            <div className="text-xs text-muted-foreground">
              Available: {fmtINRFull(account.availableBalance)} {account.currency}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">IFSC</div>
              <div className="font-mono">{account.ifsc || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Last sync</div>
              <div>{relativeTime(account.lastSyncAt)}</div>
            </div>
            {account.overdraftLimit ? (
              <div>
                <div className="text-muted-foreground">Overdraft</div>
                <div>{fmtINR(account.overdraftLimit)}</div>
              </div>
            ) : null}
            {account.upiHandle ? (
              <div>
                <div className="text-muted-foreground">UPI</div>
                <div className="truncate font-mono">{account.upiHandle}</div>
              </div>
            ) : null}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => onSync(account)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={() => onView(account)}
            >
              Transactions
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Add account dialog ───────────────────────────────────────────────────────

interface NewAccountForm {
  bankName: string;
  accountName: string;
  accountNumber: string;
  accountType: AccountType;
  ifsc: string;
  currency: string;
  balance: string;
  upiHandle: string;
}

const EMPTY_FORM: NewAccountForm = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  accountType: 'savings',
  ifsc: '',
  currency: 'INR',
  balance: '',
  upiHandle: '',
};

function AddAccountDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = React.useState<NewAccountForm>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  const reset = () => setForm(EMPTY_FORM);

  const handleSubmit = async () => {
    if (!form.bankName.trim() || !form.accountName.trim() || !form.accountNumber.trim()) {
      toast.error('Bank name, account name and number are required');
      return;
    }
    setSaving(true);
    try {
      const last4 = form.accountNumber.replace(/\s+/g, '').slice(-4);
      const masked = `••••${last4}`;
      const balanceNum = form.balance ? Number(form.balance) : 0;
      await apiPost('/api/banking-intel/accounts', {
        bankName: form.bankName.trim(),
        accountName: form.accountName.trim(),
        accountMasked: masked,
        accountType: form.accountType,
        ifsc: form.ifsc.trim() || undefined,
        currency: form.currency || 'INR',
        balance: balanceNum,
        availableBalance: balanceNum,
        upiHandle: form.upiHandle.trim() || undefined,
      });
      toast.success('Account connected');
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add account';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-500" />
            Connect Bank Account
          </DialogTitle>
          <DialogDescription>
            Add a new account to track. Live bank integration via Setu is coming soon —
            for now this adds an account to the mock data store.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="bankName">Bank name *</Label>
            <Input
              id="bankName"
              placeholder="HDFC Bank"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="accountName">Account name *</Label>
            <Input
              id="accountName"
              placeholder="HDFC Current — Acme Pvt Ltd"
              value={form.accountName}
              onChange={(e) => setForm({ ...form, accountName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="accountNumber">Account number *</Label>
              <Input
                id="accountNumber"
                placeholder="1234567890"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Account type</Label>
              <Select
                value={form.accountType}
                onValueChange={(v) => setForm({ ...form, accountType: v as AccountType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="overdraft">Overdraft</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ifsc">IFSC</Label>
              <Input
                id="ifsc"
                placeholder="HDFC0000123"
                value={form.ifsc}
                onChange={(e) => setForm({ ...form, ifsc: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="balance">Opening balance</Label>
              <Input
                id="balance"
                inputMode="decimal"
                placeholder="0"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                placeholder="INR"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="upi">UPI handle</Label>
              <Input
                id="upi"
                placeholder="acme@hdfc"
                value={form.upiHandle}
                onChange={(e) => setForm({ ...form, upiHandle: e.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            <Plus className="h-4 w-4" />
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Loading + error states ───────────────────────────────────────────────────

function AccountsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-72 rounded-xl" />
      ))}
    </div>
  );
}

// ─── Tab component ────────────────────────────────────────────────────────────

export function AccountsTab({ onNavigateToTransactions }: AccountsTabProps) {
  const { data, loading, error, refetch } = useFetch<AccountsResponse>('/api/banking-intel/accounts');
  const [addOpen, setAddOpen] = React.useState(false);
  const [syncingId, setSyncingId] = React.useState<string | null>(null);

  const handleSync = async (a: BankingAccount) => {
    setSyncingId(a.id);
    try {
      await apiPost('/api/banking-intel/accounts/sync', { accountId: a.id });
      toast.success(`${a.bankName} synced`);
      refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed';
      toast.error(msg);
    } finally {
      setSyncingId(null);
    }
  };

  if (loading) return <AccountsSkeleton />;
  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10">
          <ProfessionalEmptyState
            icon={AlertCircle}
            title="Couldn't load accounts"
            description={error || 'Unknown error'}
            accent="rose"
            action={{ label: 'Retry', onClick: refetch, icon: RefreshCw }}
          />
        </CardContent>
      </Card>
    );
  }

  const accounts = data.accounts ?? [];

  if (accounts.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="py-16">
            <ProfessionalEmptyState
              icon={Landmark}
              title="Connect your first bank account"
              description="Add a savings, current, or overdraft account to start tracking transactions and cash flow."
              accent="emerald"
              action={{ label: 'Connect Account', onClick: () => setAddOpen(true), icon: Plus }}
            />
          </CardContent>
        </Card>
        <AddAccountDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onCreated={refetch}
        />
      </>
    );
  }

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  return (
    <div className="space-y-4">
      {/* ─── Summary bar ─── */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs text-muted-foreground">Combined balance · {accounts.length} accounts</div>
              <div className="text-xl font-semibold tracking-tight">{fmtINR(totalBalance)}</div>
            </div>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </CardContent>
      </Card>

      {/* ─── Account cards ─── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <div key={a.id} className="relative">
            <AccountCard
              account={a}
              onSync={handleSync}
              onView={(acc) => onNavigateToTransactions?.(acc.id)}
            />
            {syncingId === a.id && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
                <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ─── Footer hint ─── */}
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 py-3 text-xs text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          Live bank integration via Setu Account Aggregator is coming soon — all data shown
          is mock data that resets on server restart.
        </CardContent>
      </Card>

      <AddAccountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={refetch}
      />
    </div>
  );
}

export default AccountsTab;
