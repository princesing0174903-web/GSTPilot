'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  Play,
  AlertCircle,
  RefreshCw,
  Code,
  Type,
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
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
  apiPatch,
  apiDelete,
  fmtDateTime,
  CATEGORY_LABELS,
  CATEGORY_LIST,
  categoryBadgeClass,
} from './helpers';
import type { CategorizationRule, TransactionCategory } from '@/lib/banking-service/types';

interface RulesResponse {
  ok: boolean;
  rules: CategorizationRule[];
}
interface ApplyResponse {
  ok: boolean;
  applied: number;
  touched: number;
}

// ─── Rule form ────────────────────────────────────────────────────────────────

interface RuleForm {
  pattern: string;
  isRegex: boolean;
  category: TransactionCategory;
  counterparty: string;
  priority: string;
  active: boolean;
}

const EMPTY_FORM: RuleForm = {
  pattern: '',
  isRegex: false,
  category: 'misc',
  counterparty: '',
  priority: '50',
  active: true,
};

function ruleToForm(r: CategorizationRule): RuleForm {
  return {
    pattern: r.pattern,
    isRegex: r.isRegex,
    category: r.category,
    counterparty: r.counterparty || '',
    priority: String(r.priority),
    active: r.active,
  };
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function RuleDialog({
  open,
  onOpenChange,
  initial,
  ruleId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: RuleForm;
  ruleId: string | null; // null = creating
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<RuleForm>(initial);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  const handleSubmit = async () => {
    if (!form.pattern.trim()) {
      toast.error('Pattern is required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        pattern: form.pattern.trim(),
        isRegex: form.isRegex,
        category: form.category,
        counterparty: form.counterparty.trim() || undefined,
        priority: Number(form.priority) || 0,
        active: form.active,
      };
      if (ruleId) {
        await apiPatch(`/api/banking-intel/rules/${ruleId}`, body);
        toast.success('Rule updated');
      } else {
        await apiPost('/api/banking-intel/rules', body);
        toast.success('Rule created');
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
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
            {ruleId ? 'Edit Rule' : 'New Categorization Rule'}
          </DialogTitle>
          <DialogDescription>
            Rules are evaluated in priority order (higher first). The first match wins.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pattern">Pattern *</Label>
            <Input
              id="pattern"
              placeholder={form.isRegex ? '^UPI/.*SALARY' : 'salary'}
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-2">
            <div>
              <Label htmlFor="regex" className="text-xs">Regex match</Label>
              <p className="text-[10px] text-muted-foreground">
                {form.isRegex ? 'Match against regex' : 'Case-insensitive substring'}
              </p>
            </div>
            <Switch
              id="regex"
              checked={form.isRegex}
              onCheckedChange={(v) => setForm({ ...form, isRegex: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as TransactionCategory })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_LIST.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp">Counterparty (optional)</Label>
            <Input
              id="cp"
              placeholder="Auto-set counterparty on match"
              value={form.counterparty}
              onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-2">
            <Label htmlFor="active" className="text-xs">Active</Label>
            <Switch
              id="active"
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>
            {ruleId ? 'Save changes' : 'Create rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete dialog ────────────────────────────────────────────────────────────

function DeleteDialog({
  rule,
  open,
  onOpenChange,
  onSaved,
}: {
  rule: CategorizationRule | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const handleDelete = async () => {
    if (!rule) return;
    setSaving(true);
    try {
      await apiDelete(`/api/banking-intel/rules/${rule.id}`);
      toast.success('Rule deleted');
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
            <Trash2 className="h-4 w-4" /> Delete Rule
          </DialogTitle>
          <DialogDescription>
            This permanently removes the rule. Existing categorized transactions are not affected.
          </DialogDescription>
        </DialogHeader>
        {rule && (
          <div className="rounded-md bg-muted/50 p-3 text-xs">
            <div className="font-mono">{rule.pattern}</div>
            <div className="text-muted-foreground">{CATEGORY_LABELS[rule.category]} · priority {rule.priority}</div>
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RulesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-md" />
      ))}
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export function RulesTab() {
  const { data, loading, error, refetch } = useFetch<RulesResponse>('/api/banking-intel/rules');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editRule, setEditRule] = React.useState<CategorizationRule | null>(null);
  const [deleteRule, setDeleteRule] = React.useState<CategorizationRule | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const rules = React.useMemo(() => {
    const arr = data?.rules ?? [];
    return [...arr].sort((a, b) => b.priority - a.priority);
  }, [data]);

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await apiPost<ApplyResponse>('/api/banking-intel/rules/apply', {});
      toast.success(`Recategorized ${res.applied} transaction${res.applied === 1 ? '' : 's'} (${res.touched} touched)`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const handleToggle = async (rule: CategorizationRule, next: boolean) => {
    setTogglingId(rule.id);
    try {
      await apiPatch(`/api/banking-intel/rules/${rule.id}`, { active: next });
      toast.success(`Rule ${next ? 'enabled' : 'disabled'}`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Toggle failed');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) return <RulesSkeleton />;
  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10">
          <ProfessionalEmptyState
            icon={AlertCircle}
            title="Couldn't load rules"
            description={error || 'Unknown error'}
            accent="rose"
            action={{ label: 'Retry', onClick: refetch, icon: RefreshCw }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="text-sm font-medium">Categorization Rules</p>
            <p className="text-xs text-muted-foreground">
              {rules.length} rule{rules.length === 1 ? '' : 's'} · {rules.filter((r) => r.active).length} active
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleApply} loading={applying}>
              {!applying && <Play className="h-3.5 w-3.5" />}
              Apply All Rules
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Rule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Rules table / empty ─── */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <ProfessionalEmptyState
              icon={Tags}
              title="No rules yet"
              description="Create a rule to auto-categorize transactions based on their description patterns."
              accent="violet"
              action={{ label: 'Create Rule', onClick: () => setCreateOpen(true), icon: Plus }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px]">Pattern</TableHead>
                    <TableHead className="text-[11px]">Type</TableHead>
                    <TableHead className="text-[11px]">Category</TableHead>
                    <TableHead className="text-[11px]">Counterparty</TableHead>
                    <TableHead className="text-right text-[11px]">Priority</TableHead>
                    <TableHead className="text-right text-[11px]">Matches</TableHead>
                    <TableHead className="text-[11px]">Active</TableHead>
                    <TableHead className="text-[11px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id} className="text-xs">
                      <TableCell className="font-mono">{r.pattern}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={r.isRegex
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 border-violet-200 dark:border-violet-500/30 gap-1'
                          : 'bg-muted text-muted-foreground gap-1'}>
                          {r.isRegex ? <Code className="h-3 w-3" /> : <Type className="h-3 w-3" />}
                          {r.isRegex ? 'regex' : 'substring'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={categoryBadgeClass(r.category)}>
                          {CATEGORY_LABELS[r.category]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.counterparty || '—'}</TableCell>
                      <TableCell className="text-right font-mono">{r.priority}</TableCell>
                      <TableCell className="text-right">
                        {r.matchCount !== undefined ? (
                          <span className={r.matchCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                            {r.matchCount}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={r.active}
                          onCheckedChange={(v) => handleToggle(r, v)}
                          disabled={togglingId === r.id}
                          aria-label={`Toggle ${r.pattern}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditRule(r)}
                            aria-label="Edit rule"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-600 dark:text-rose-400"
                            onClick={() => setDeleteRule(r)}
                            aria-label="Delete rule"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator className="my-3" />
            <p className="text-[10px] text-muted-foreground">
              Last updated {rules[0] ? fmtDateTime(rules[0].updatedAt) : '—'}. Rules apply to new and existing transactions
              when you click "Apply All Rules".
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Dialogs ─── */}
      <RuleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initial={EMPTY_FORM}
        ruleId={null}
        onSaved={refetch}
      />
      <RuleDialog
        open={!!editRule}
        onOpenChange={(v) => !v && setEditRule(null)}
        initial={editRule ? ruleToForm(editRule) : EMPTY_FORM}
        ruleId={editRule?.id ?? null}
        onSaved={() => {
          setEditRule(null);
          refetch();
        }}
      />
      <DeleteDialog
        rule={deleteRule}
        open={!!deleteRule}
        onOpenChange={(v) => !v && setDeleteRule(null)}
        onSaved={refetch}
      />
    </div>
  );
}

export default RulesTab;
