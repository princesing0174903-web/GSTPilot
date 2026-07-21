'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Database,
  RefreshCw,
  Bell,
  Coins,
  AlertTriangle,
  Settings as SettingsIcon,
  Plug,
  Hourglass,
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { apiPost } from './helpers';
import type { BankingAccount } from '@/lib/banking-service/types';

// ─── Helper: row with switch ──────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export function SettingsTab() {
  // Sync settings
  const [autoSync, setAutoSync] = React.useState(true);
  const [syncFreq, setSyncFreq] = React.useState('hourly');
  const [syncing, setSyncing] = React.useState(false);

  // Notifications
  const [lowBalanceAlert, setLowBalanceAlert] = React.useState(true);
  const [unreconciledReminder, setUnreconciledReminder] = React.useState(true);
  const [weeklySummary, setWeeklySummary] = React.useState(false);

  // Currency
  const [currency, setCurrency] = React.useState('INR');

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/banking-intel/accounts').then((r) => r.json());
      const accounts: BankingAccount[] = res?.accounts ?? [];
      if (accounts.length === 0) {
        toast.info('No accounts to sync');
        return;
      }
      let ok = 0;
      let failed = 0;
      await Promise.all(
        accounts.map(async (a) => {
          try {
            await apiPost('/api/banking-intel/accounts/sync', { accountId: a.id });
            ok += 1;
          } catch {
            failed += 1;
          }
        }),
      );
      if (failed === 0) {
        toast.success(`Synced ${ok} account${ok === 1 ? '' : 's'}`);
      } else {
        toast.warning(`Synced ${ok}, ${failed} failed`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleResetMock = () => {
    toast.info('Mock data resets on server restart — no manual reset required.');
  };

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <SettingsIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Banking Module Settings</p>
              <p className="text-xs text-muted-foreground">
                All settings here are local-only for now. Backend wiring is on the roadmap.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Data Source ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-emerald-500" />
            Data Source
          </CardTitle>
          <CardDescription>
            Where your banking data comes from. When Setu is connected, all banking data switches to live
            without any UI or Oracle changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Database className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Mock Data (in-memory)</p>
                <p className="text-[11px] text-muted-foreground">Active — resets on server restart</p>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
              Active
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border p-3 opacity-60">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Plug className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Setu Account Aggregator</p>
                <p className="text-[11px] text-muted-foreground">Live bank integration — coming soon</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-muted text-muted-foreground">
              Not Connected
            </Badge>
          </div>

          <p className="rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
            <strong>Note:</strong> The Banking Service is provider-agnostic. Swapping from mock to live Setu
            is a one-line change in <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">getBankingService()</code> —
            no UI, Oracle action, or workflow changes required.
          </p>
        </CardContent>
      </Card>

      {/* ─── Sync ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-amber-500" />
            Sync
          </CardTitle>
          <CardDescription>Control how often banking data refreshes from the source.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            label="Auto-sync"
            description="Refresh account balances and transactions on a schedule"
            checked={autoSync}
            onCheckedChange={setAutoSync}
          />
          <div className={`space-y-1.5 ${autoSync ? '' : 'opacity-50'}`}>
            <Label className="text-xs">Sync frequency</Label>
            <Select value={syncFreq} onValueChange={setSyncFreq} disabled={!autoSync}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Hourglass className="h-3 w-3" />
              Currently {syncFreq === 'hourly' ? 'every hour' : syncFreq === 'daily' ? 'once a day at 9am' : 'every Monday at 9am'}
            </p>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button onClick={handleSyncNow} loading={syncing}>
              {!syncing && <RefreshCw className="h-4 w-4" />}
              Sync Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Notifications ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-violet-500" />
            Notifications
          </CardTitle>
          <CardDescription>Choose what banking alerts you want to receive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ToggleRow
            label="Low balance alert"
            description="Notify when any account drops below ₹10,000"
            checked={lowBalanceAlert}
            onCheckedChange={setLowBalanceAlert}
          />
          <ToggleRow
            label="Unreconciled transaction reminder"
            description="Weekly reminder for transactions pending reconciliation"
            checked={unreconciledReminder}
            onCheckedChange={setUnreconciledReminder}
          />
          <ToggleRow
            label="Weekly cash flow summary"
            description="Email summary every Monday morning"
            checked={weeklySummary}
            onCheckedChange={setWeeklySummary}
          />
        </CardContent>
      </Card>

      {/* ─── Currency ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4 text-sky-500" />
            Currency
          </CardTitle>
          <CardDescription>Display currency for amounts across the module.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Display currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR — Indian Rupee</SelectItem>
                <SelectItem value="USD" disabled>USD — US Dollar (coming soon)</SelectItem>
                <SelectItem value="EUR" disabled>EUR — Euro (coming soon)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Multi-currency support is on the roadmap. Currently only INR is supported across all accounts.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Danger zone ─── */}
      <Card className="border-rose-200 dark:border-rose-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-rose-300 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/5">
            <div>
              <p className="text-sm font-medium">Reset mock data</p>
              <p className="text-[11px] text-muted-foreground">
                Mock data is stored in-memory on the server. It automatically resets when the server restarts.
              </p>
            </div>
            <Button variant="destructive" onClick={handleResetMock}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Footer note ─── */}
      <p className="text-center text-[11px] text-muted-foreground">
        Settings are stored locally in your browser for now. Backend persistence is on the roadmap.
      </p>
    </div>
  );
}

export default SettingsTab;
