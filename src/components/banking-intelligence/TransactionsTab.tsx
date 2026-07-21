'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  Link2,
  Tags,
  Split,
  MoreHorizontal,
  AlertCircle,
  ArrowRightLeft,
  X,
  Sparkles,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { ProfessionalEmptyState } from '@/components/shared';
import { toast } from 'sonner';
import {
  useFetch,
  apiPost,
  apiPatch,
  apiDelete,
  fmtINR,
  fmtINRFull,
  fmtDate,
  fmtDateTime,
  CATEGORY_LABELS,
  CATEGORY_LIST,
  categoryBadgeClass,
  STATUS_META,
  SCROLLBAR_CLASS,
  AI_TAG_ICON,
} from './helpers';
import type {
  BankingTransaction,
  BankingAccount,
  TransactionCategory,
  TransactionType,
  TransactionStatus,
} from '@/lib/banking-service/types';

interface TxResponse {
  ok: boolean;
  rows: BankingTransaction[];
  total: number;
  limit: number;
  offset: number;
}
interface AccountsResponse {
  ok: boolean;
  accounts: BankingAccount[];
}

interface TransactionsTabProps {
  initialAccountId?: string;
}

const PAGE_SIZE = 50;

// ─── Filter state ─────────────────────────────────────────────────────────────

interface FilterState {
  accountId: string;
  dateFrom: string;
  dateTo: string;
  category: string;
  type: string;
  status: string;
  search: string;
  minAmount: string;
  maxAmount: string;
}

const EMPTY_FILTERS: FilterState = {
  accountId: '',
  dateFrom: '',
  dateTo: '',
  category: '',
  type: '',
  status: '',
  search: '',
  minAmount: '',
  maxAmount: '',
};

function buildUrl(filters: FilterState, offset: number): string {
  const p = new URLSearchParams();
  p.set('limit', String(PAGE_SIZE));
  p.set('offset', String(offset));
  if (filters.accountId) p.set('accountId', filters.accountId);
  if (filters.dateFrom) p.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) p.set('dateTo', filters.dateTo);
  if (filters.category) p.set('category', filters.category);
  if (filters.type) p.set('type', filters.type);
  if (filters.status) p.set('status', filters.status);
  if (filters.search) p.set('search', filters.search);
  if (filters.minAmount) p.set('minAmount', filters.minAmount);
  if (filters.maxAmount) p.set('maxAmount', filters.maxAmount);
  return `/api/banking-intel/transactions?${p.toString()}`;
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  setFilters,
  accounts,
  onClear,
}: {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  accounts: BankingAccount[];
  onClear: () => void;
}) {
  const update = (patch: Partial<FilterState>) => setFilters({ ...filters, ...patch });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Search</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Description, counterparty…"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Account</Label>
        <Select value={filters.accountId || 'all'} onValueChange={(v) => update({ accountId: v === 'all' ? '' : v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.bankName} {a.accountMasked}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Category</Label>
        <Select value={filters.category || 'all'} onValueChange={(v) => update({ category: v === 'all' ? '' : v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_LIST.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Type</Label>
        <Select value={filters.type || 'all'} onValueChange={(v) => update({ type: v === 'all' ? '' : v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="debit">Debit</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Status</Label>
        <Select value={filters.status || 'all'} onValueChange={(v) => update({ status: v === 'all' ? '' : v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="reconciled">Reconciled</SelectItem>
            <SelectItem value="unreconciled">Unreconciled</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">From</Label>
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => update({ dateFrom: e.target.value })}
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">To</Label>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => update({ dateTo: e.target.value })}
          className="h-8 text-xs"
        />
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-[11px] text-muted-foreground">Min ₹</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={filters.minAmount}
            onChange={(e) => update({ minAmount: e.target.value })}
            className="h-8 text-xs"
            placeholder="0"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-[11px] text-muted-foreground">Max ₹</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={filters.maxAmount}
            onChange={(e) => update({ maxAmount: e.target.value })}
            className="h-8 text-xs"
            placeholder="∞"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function TransactionDetailSheet({
  tx,
  open,
  onOpenChange,
}: {
  tx: BankingTransaction | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!tx) return null;
  const statusMeta = STATUS_META[tx.status] ?? STATUS_META.ignored;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
            Transaction Detail
          </SheetTitle>
          <SheetDescription>{tx.id}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="space-y-2">
            <div className="text-3xl font-semibold tracking-tight">
              <span className={tx.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {tx.type === 'credit' ? '+' : '−'}
              </span>
              {fmtINRFull(tx.amount)}
            </div>
            <p className="text-sm text-muted-foreground">{tx.description}</p>
            {tx.counterparty && (
              <p className="text-xs text-muted-foreground">↳ {tx.counterparty}</p>
            )}
          </div>
          <Badge variant="outline" className={statusMeta.color}>
            <statusMeta.icon className="h-3 w-3" />
            {statusMeta.label}
          </Badge>

          <Separator />

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground">Date</div>
              <div>{fmtDate(tx.date)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Type</div>
              <div className="capitalize">{tx.type}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Category</div>
              {tx.category ? (
                <Badge variant="outline" className={categoryBadgeClass(tx.category)}>
                  {CATEGORY_LABELS[tx.category]}
                </Badge>
              ) : '—'}
            </div>
            {tx.aiCategory && tx.aiCategory !== tx.category && (
              <div>
                <div className="text-muted-foreground">AI Category</div>
                <Badge variant="outline" className={`${categoryBadgeClass(tx.aiCategory)} gap-1`}>
                  <AI_TAG_ICON className="h-3 w-3" />
                  {CATEGORY_LABELS[tx.aiCategory]}
                </Badge>
              </div>
            )}
            <div>
              <div className="text-muted-foreground">Reference</div>
              <div className="font-mono">{tx.referenceNo || '—'}</div>
            </div>
            {tx.upiRef && (
              <div>
                <div className="text-muted-foreground">UPI Ref</div>
                <div className="font-mono">{tx.upiRef}</div>
              </div>
            )}
            <div>
              <div className="text-muted-foreground">Balance After</div>
              <div>{tx.balanceAfter !== undefined && tx.balanceAfter !== null ? fmtINRFull(tx.balanceAfter) : '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Confidence</div>
              <div>{tx.confidence !== undefined && tx.confidence !== null ? `${(tx.confidence * 100).toFixed(0)}%` : '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Linked Invoice</div>
              <div>{tx.linkedInvoiceNumber || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Match Type</div>
              <div className="capitalize">{tx.matchType || '—'}</div>
            </div>
          </div>

          {tx.notes && (
            <>
              <Separator />
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Notes</div>
                <p className="rounded-md bg-muted/50 p-3 text-xs">{tx.notes}</p>
              </div>
            </>
          )}

          <Separator />
          <div className="text-[10px] text-muted-foreground">
            Created {fmtDateTime(tx.createdAt)} · Updated {fmtDateTime(tx.updatedAt)}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditDialog({
  tx,
  open,
  onOpenChange,
  onSaved,
}: {
  tx: BankingTransaction | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<string>('');
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (tx && open) {
      setDescription(tx.description);
      setCategory(tx.category || '');
      setNotes(tx.notes || '');
    }
  }, [tx, open]);

  const handleSubmit = async () => {
    if (!tx) return;
    setSaving(true);
    try {
      await apiPatch(`/api/banking-intel/transactions/${tx.id}`, {
        description,
        category: category || undefined,
        notes: notes || undefined,
      });
      toast.success('Transaction updated');
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>Update description, category, or notes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category || 'none'} onValueChange={(v) => setCategory(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {CATEGORY_LIST.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Link invoice dialog ──────────────────────────────────────────────────────

function LinkInvoiceDialog({
  tx,
  open,
  onOpenChange,
  onSaved,
}: {
  tx: BankingTransaction | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [invoiceId, setInvoiceId] = React.useState('');
  const [matchType, setMatchType] = React.useState<string>('manual');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setInvoiceId('');
      setMatchType('manual');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!tx || !invoiceId.trim()) return;
    setSaving(true);
    try {
      await apiPost('/api/banking-intel/transactions/link-invoice', {
        transactionId: tx.id,
        invoiceId: invoiceId.trim(),
        matchType,
      });
      toast.success('Linked to invoice');
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Link failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-emerald-500" />
            Link Invoice
          </DialogTitle>
          <DialogDescription>
            Manually link this transaction to an invoice ID for reconciliation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inv">Invoice ID</Label>
            <Input id="inv" placeholder="inv-001" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Match type</Label>
            <Select value={matchType} onValueChange={setMatchType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="exact">Exact</SelectItem>
                <SelectItem value="fuzzy">Fuzzy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Categorize dialog ────────────────────────────────────────────────────────

function CategorizeDialog({
  tx,
  open,
  onOpenChange,
  onSaved,
}: {
  tx: BankingTransaction | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (tx && open) setCategory(tx.category || tx.aiCategory || '');
  }, [tx, open]);

  const handleSubmit = async () => {
    if (!tx || !category) return;
    setSaving(true);
    try {
      await apiPost('/api/banking-intel/transactions/categorize', {
        transactionId: tx.id,
        category,
      });
      toast.success('Categorized');
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Categorize failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-4 w-4 text-violet-500" />
            Categorize Transaction
          </DialogTitle>
          <DialogDescription>Pick the most appropriate category.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
              <SelectContent>
                {CATEGORY_LIST.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Split dialog ─────────────────────────────────────────────────────────────

interface SplitRow {
  amount: string;
  category: string;
}

function SplitDialog({
  tx,
  open,
  onOpenChange,
  onSaved,
}: {
  tx: BankingTransaction | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = React.useState<SplitRow[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (tx && open) {
      setRows([
        { amount: '', category: tx.category || tx.aiCategory || 'misc' },
        { amount: '', category: 'misc' },
      ]);
    }
  }, [tx, open]);

  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const overflows = tx ? total - tx.amount : 0;

  const update = (i: number, patch: Partial<SplitRow>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((p) => [...p, { amount: '', category: 'misc' }]);
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!tx) return;
    const splits = rows
      .filter((r) => r.amount && Number(r.amount) > 0)
      .map((r) => ({ amount: Number(r.amount), category: r.category as TransactionCategory }));
    if (splits.length < 2) {
      toast.error('Need at least 2 splits');
      return;
    }
    if (Math.abs(overflows) > 0.01) {
      toast.error(`Splits total ${fmtINRFull(total)} ≠ transaction amount ${fmtINRFull(tx.amount)}`);
      return;
    }
    setSaving(true);
    try {
      await apiPost('/api/banking-intel/transactions/split', {
        transactionId: tx.id,
        splits,
      });
      toast.success(`Split into ${splits.length} transactions`);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Split failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-4 w-4 text-amber-500" />
            Split Transaction
          </DialogTitle>
          <DialogDescription>
            Split {tx ? fmtINRFull(tx.amount) : ''} across multiple categories.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px]">Amount</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={r.amount}
                  onChange={(e) => update(i, { amount: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-[10px]">Category</Label>
                <Select value={r.category} onValueChange={(v) => update(i, { category: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_LIST.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeRow(i)} disabled={rows.length <= 2}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addRow}>
            <Split className="h-3.5 w-3.5" />
            Add row
          </Button>
          <Separator />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total</span>
            <span className={Math.abs(overflows) < 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              {fmtINRFull(total)} {tx && Math.abs(overflows) >= 0.01 && `(${overflows > 0 ? '+' : ''}${fmtINRFull(overflows)})`}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={Math.abs(overflows) > 0.01}>Split</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete dialog ────────────────────────────────────────────────────────────

function DeleteDialog({
  tx,
  open,
  onOpenChange,
  onSaved,
}: {
  tx: BankingTransaction | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const handleDelete = async () => {
    if (!tx) return;
    setSaving(true);
    try {
      await apiDelete(`/api/banking-intel/transactions/${tx.id}`);
      toast.success('Transaction deleted');
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Trash2 className="h-4 w-4" />
            Delete Transaction
          </DialogTitle>
          <DialogDescription>
            This permanently removes the transaction from your ledger. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {tx && (
          <div className="rounded-md bg-muted/50 p-3 text-xs">
            <div className="font-medium">{tx.description}</div>
            <div className="text-muted-foreground">{fmtDate(tx.date)} · {fmtINRFull(tx.amount)}</div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} loading={saving}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function TxRow({
  tx,
  accounts,
  onView,
  onEdit,
  onDelete,
  onLink,
  onCategorize,
  onSplit,
}: {
  tx: BankingTransaction;
  accounts: BankingAccount[];
  onView: (t: BankingTransaction) => void;
  onEdit: (t: BankingTransaction) => void;
  onDelete: (t: BankingTransaction) => void;
  onLink: (t: BankingTransaction) => void;
  onCategorize: (t: BankingTransaction) => void;
  onSplit: (t: BankingTransaction) => void;
}) {
  const account = accounts.find((a) => a.id === tx.accountId);
  const statusMeta = STATUS_META[tx.status] ?? STATUS_META.ignored;
  const confidencePct = tx.confidence !== undefined && tx.confidence !== null
    ? Math.round(tx.confidence * 100)
    : null;

  return (
    <TableRow className="text-xs">
      <TableCell className="whitespace-nowrap font-medium">{fmtDate(tx.date)}</TableCell>
      <TableCell>
        <div className="max-w-[260px]">
          <div className="truncate font-medium">{tx.description}</div>
          {tx.counterparty && (
            <div className="truncate text-[10px] text-muted-foreground">{tx.counterparty}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        {tx.category ? (
          <Badge variant="outline" className={categoryBadgeClass(tx.category)}>
            {CATEGORY_LABELS[tx.category]}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono">
        <span className={tx.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
          {tx.type === 'credit' ? '+' : '−'}{fmtINRFull(tx.amount)}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={tx.type === 'credit'
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
          : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'}>
          {tx.type === 'credit' ? 'Credit' : 'Debit'}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {account ? `${account.bankName} ${account.accountMasked}` : '—'}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusMeta.color}>
          {statusMeta.label}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {tx.linkedInvoiceNumber || (tx.linkedInvoiceId ? tx.linkedInvoiceId : '—')}
      </TableCell>
      <TableCell>
        {confidencePct !== null ? (
          <div className="flex items-center gap-2">
            <Progress value={confidencePct} className="h-1.5 w-12" />
            <span className="text-[10px] text-muted-foreground">{confidencePct}%</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {tx.aiCategory && tx.aiCategory !== tx.category ? (
          <Badge variant="outline" className={`${categoryBadgeClass(tx.aiCategory)} gap-1`}>
            <AI_TAG_ICON className="h-3 w-3" />
            {CATEGORY_LABELS[tx.aiCategory]}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Row actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onView(tx)}>
              <Eye className="h-3.5 w-3.5" /> View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(tx)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCategorize(tx)}>
              <Tags className="h-3.5 w-3.5" /> Categorize
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onLink(tx)}>
              <Link2 className="h-3.5 w-3.5" /> Link Invoice
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSplit(tx)}>
              <Split className="h-3.5 w-3.5" /> Split
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-rose-600 dark:text-rose-400" onClick={() => onDelete(tx)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 rounded-md" />
      ))}
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export function TransactionsTab({ initialAccountId }: TransactionsTabProps) {
  const [filters, setFilters] = React.useState<FilterState>({
    ...EMPTY_FILTERS,
    accountId: initialAccountId || '',
  });
  const [debouncedFilters, setDebouncedFilters] = React.useState<FilterState>(filters);
  const [offset, setOffset] = React.useState(0);
  const [showFiltersMobile, setShowFiltersMobile] = React.useState(false);
  const [activeTx, setActiveTx] = React.useState<BankingTransaction | null>(null);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [categorizeOpen, setCategorizeOpen] = React.useState(false);
  const [splitOpen, setSplitOpen] = React.useState(false);

  // Update initial account if the prop changes
  React.useEffect(() => {
    if (initialAccountId !== undefined) {
      setFilters((f) => ({ ...f, accountId: initialAccountId }));
    }
  }, [initialAccountId]);

  // Debounce filters 400ms
  React.useEffect(() => {
    const h = setTimeout(() => {
      setDebouncedFilters(filters);
      setOffset(0);
    }, 400);
    return () => clearTimeout(h);
  }, [filters]);

  const url = buildUrl(debouncedFilters, offset);
  const { data, loading, error, refetch } = useFetch<TxResponse>(url, [url]);
  const accountsRes = useFetch<AccountsResponse>('/api/banking-intel/accounts');
  const accounts = accountsRes.data?.accounts ?? [];

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? PAGE_SIZE;
  const fromIdx = total === 0 ? 0 : offset + 1;
  const toIdx = Math.min(offset + rows.length, total);

  const openView = (t: BankingTransaction) => { setActiveTx(t); setViewOpen(true); };
  const openEdit = (t: BankingTransaction) => { setActiveTx(t); setEditOpen(true); };
  const openDelete = (t: BankingTransaction) => { setActiveTx(t); setDeleteOpen(true); };
  const openLink = (t: BankingTransaction) => { setActiveTx(t); setLinkOpen(true); };
  const openCategorize = (t: BankingTransaction) => { setActiveTx(t); setCategorizeOpen(true); };
  const openSplit = (t: BankingTransaction) => { setActiveTx(t); setSplitOpen(true); };

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  return (
    <div className="space-y-4">
      {/* ─── Header card ─── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
              Transactions
              {total > 0 && <span className="text-xs font-normal text-muted-foreground">({total})</span>}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setShowFiltersMobile(true)}
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop filters */}
          <div className="hidden lg:block">
            <FilterBar filters={filters} setFilters={setFilters} accounts={accounts} onClear={clearFilters} />
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </div>
          {/* Mobile summary chip */}
          <div className="lg:hidden">
            <p className="text-xs text-muted-foreground">
              {debouncedFilters.search || debouncedFilters.category || debouncedFilters.type || debouncedFilters.status || debouncedFilters.accountId
                ? 'Filters applied — tap "Filters" to edit'
                : 'No filters — tap "Filters" to narrow down'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Table card ─── */}
      <Card>
        <CardContent className="py-4">
          {error ? (
            <ProfessionalEmptyState
              icon={AlertCircle}
              title="Couldn't load transactions"
              description={error}
              accent="rose"
              action={{ label: 'Retry', onClick: refetch, icon: RefreshCw }}
            />
          ) : loading ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <ProfessionalEmptyState
              icon={ArrowRightLeft}
              title="No transactions found"
              description="Try adjusting your filters, or import a bank statement to add transactions."
              accent="emerald"
            />
          ) : (
            <div className={`max-h-[600px] overflow-y-auto rounded-md ${SCROLLBAR_CLASS}`}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="text-[11px]">Date</TableHead>
                    <TableHead className="text-[11px]">Description</TableHead>
                    <TableHead className="text-[11px]">Category</TableHead>
                    <TableHead className="text-right text-[11px]">Amount</TableHead>
                    <TableHead className="text-[11px]">Type</TableHead>
                    <TableHead className="text-[11px]">Account</TableHead>
                    <TableHead className="text-[11px]">Status</TableHead>
                    <TableHead className="text-[11px]">Invoice</TableHead>
                    <TableHead className="text-[11px]">Conf.</TableHead>
                    <TableHead className="text-[11px]">AI Cat.</TableHead>
                    <TableHead className="text-[11px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((tx) => (
                    <TxRow
                      key={tx.id}
                      tx={tx}
                      accounts={accounts}
                      onView={openView}
                      onEdit={openEdit}
                      onDelete={openDelete}
                      onLink={openLink}
                      onCategorize={openCategorize}
                      onSplit={openSplit}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ─── Pagination ─── */}
          {total > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Showing {fromIdx}–{toIdx} of {total}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={offset === 0 || loading}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={offset + limit >= total || loading}
                  onClick={() => setOffset(offset + limit)}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Mobile filter sheet ─── */}
      <Sheet open={showFiltersMobile} onOpenChange={setShowFiltersMobile}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">Filters</SheetTitle>
            <SheetDescription>Narrow your transactions list.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <FilterBar filters={filters} setFilters={setFilters} accounts={accounts} onClear={clearFilters} />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
              <Button size="sm" onClick={() => setShowFiltersMobile(false)}>Apply</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── Dialogs ─── */}
      <TransactionDetailSheet tx={activeTx} open={viewOpen} onOpenChange={setViewOpen} />
      <EditDialog tx={activeTx} open={editOpen} onOpenChange={setEditOpen} onSaved={refetch} />
      <DeleteDialog tx={activeTx} open={deleteOpen} onOpenChange={setDeleteOpen} onSaved={refetch} />
      <LinkInvoiceDialog tx={activeTx} open={linkOpen} onOpenChange={setLinkOpen} onSaved={refetch} />
      <CategorizeDialog tx={activeTx} open={categorizeOpen} onOpenChange={setCategorizeOpen} onSaved={refetch} />
      <SplitDialog tx={activeTx} open={splitOpen} onOpenChange={setSplitOpen} onSaved={refetch} />
    </div>
  );
}

export default TransactionsTab;
