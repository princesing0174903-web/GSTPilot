'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  Upload,
  CheckCircle2,
  Activity,
  Sparkles,
  TrendingUp,
  Tags,
  Settings as SettingsIcon,
  RefreshCw,
  Database,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiPost } from './helpers';
import type { BankingAccount } from '@/lib/banking-service/types';
import { fetchWithTimeout } from '@/lib/async';

// ─── Lazy-loaded tab components (keeps initial bundle small) ──────────────────

const DashboardTab = React.lazy(() =>
  import('./DashboardTab').then((m) => ({ default: m.DashboardTab })),
);
const AccountsTab = React.lazy(() =>
  import('./AccountsTab').then((m) => ({ default: m.AccountsTab })),
);
const TransactionsTab = React.lazy(() =>
  import('./TransactionsTab').then((m) => ({ default: m.TransactionsTab })),
);
const ImportTab = React.lazy(() =>
  import('./ImportTab').then((m) => ({ default: m.ImportTab })),
);
const ReconciliationTab = React.lazy(() =>
  import('./ReconciliationTab').then((m) => ({ default: m.ReconciliationTab })),
);
const CashFlowTab = React.lazy(() =>
  import('./CashFlowTab').then((m) => ({ default: m.CashFlowTab })),
);
const AIInsightsTab = React.lazy(() =>
  import('./AIInsightsTab').then((m) => ({ default: m.AIInsightsTab })),
);
const ForecastTab = React.lazy(() =>
  import('./ForecastTab').then((m) => ({ default: m.ForecastTab })),
);
const RulesTab = React.lazy(() =>
  import('./RulesTab').then((m) => ({ default: m.RulesTab })),
);
const SettingsTab = React.lazy(() =>
  import('./SettingsTab').then((m) => ({ default: m.SettingsTab })),
);

// ─── Tab registry ─────────────────────────────────────────────────────────────

type TabKey =
  | 'dashboard'
  | 'accounts'
  | 'transactions'
  | 'import'
  | 'reconciliation'
  | 'cashflow'
  | 'insights'
  | 'forecast'
  | 'rules'
  | 'settings';

interface TabDef {
  key: TabKey;
  label: string;
  icon: typeof LayoutDashboard;
}

const TABS: TabDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'accounts', label: 'Accounts', icon: Landmark },
  { key: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { key: 'import', label: 'Import', icon: Upload },
  { key: 'reconciliation', label: 'Reconciliation', icon: CheckCircle2 },
  { key: 'cashflow', label: 'Cash Flow', icon: Activity },
  { key: 'insights', label: 'AI Insights', icon: Sparkles },
  { key: 'forecast', label: 'Forecast', icon: TrendingUp },
  { key: 'rules', label: 'Rules', icon: Tags },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

// ─── Skeleton fallback ─────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export interface BankingIntelligencePageProps {
  /** Optional initial tab (used when navigated from another view). */
  initialTab?: TabKey;
  /** Optional initial account filter for the transactions tab. */
  initialAccountId?: string;
}

export default function BankingIntelligencePage({
  initialTab = 'dashboard',
  initialAccountId,
}: BankingIntelligencePageProps) {
  const [tab, setTab] = React.useState<TabKey>(initialTab);
  const [txAccountId, setTxAccountId] = React.useState<string | undefined>(initialAccountId);
  const [syncingAll, setSyncingAll] = React.useState(false);

  // Navigate to transactions tab pre-filtered by an account.
  const goToTransactions = React.useCallback((accountId?: string) => {
    setTxAccountId(accountId);
    setTab('transactions');
  }, []);

  // Sync All — iterate over every account.
  // Single-flight: prevent double-clicks from firing concurrent sync runs.
  // Each per-account sync gets its own timeout via apiPost's underlying
  // fetchWithTimeout (30s default).
  const handleSyncAll = React.useCallback(async () => {
    if (syncingAll) return;
    setSyncingAll(true);
    try {
      const res = await fetchWithTimeout('/api/banking-intel/accounts', { timeoutMs: 20_000 })
        .then((r) => r.json());
      const accounts: BankingAccount[] = res?.accounts ?? [];
      if (accounts.length === 0) {
        toast.info('No accounts to sync');
        return;
      }
      let ok = 0;
      let failed = 0;
      // Promise.allSettled so a single hung/failed account doesn't block the rest.
      const results = await Promise.allSettled(
        accounts.map((a) =>
          apiPost('/api/banking-intel/accounts/sync', { accountId: a.id }, { timeoutMs: 30_000 }),
        ),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') ok += 1;
        else failed += 1;
      }
      if (failed === 0) {
        toast.success(`Synced ${ok} account${ok === 1 ? '' : 's'}`);
      } else {
        toast.warning(`Synced ${ok}, ${failed} failed`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed';
      toast.error(msg);
    } finally {
      setSyncingAll(false);
    }
  }, [syncingAll]);

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Banking Intelligence</h1>
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300"
            >
              <Database className="h-3 w-3" />
              Mock Data
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Accounts, transactions, reconciliation &amp; cash flow forecasting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            loading={syncingAll}
          >
            {!syncingAll && <RefreshCw className="h-4 w-4" />}
            Sync All
          </Button>
        </div>
      </motion.header>

      {/* ─── Tabs ─── */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
        className="w-full"
      >
        <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
          <TabsList className="flex h-auto w-max min-w-full flex-nowrap gap-1 bg-muted/60 p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  className="flex h-9 flex-1 items-center gap-1.5 px-3 data-[state=active]:bg-background"
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                  <span className="whitespace-nowrap">{t.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="mt-4">
          <React.Suspense fallback={<TabSkeleton />}>
            <DashboardTab onNavigateToTransactions={goToTransactions} />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <React.Suspense fallback={<TabSkeleton />}>
            <AccountsTab onNavigateToTransactions={goToTransactions} />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="transactions" className="mt-4">
          <React.Suspense fallback={<TabSkeleton />}>
            <TransactionsTab initialAccountId={txAccountId} />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="import" className="mt-4">
          <React.Suspense fallback={<TabSkeleton />}>
            <ImportTab onNavigateToTransactions={goToTransactions} />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="reconciliation" className="mt-4">
          <React.Suspense fallback={<TabSkeleton />}>
            <ReconciliationTab />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="cashflow" className="mt-4">
          <React.Suspense fallback={<TabSkeleton />}>
            <CashFlowTab />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="insights" className="mt-4">
          <React.Suspense fallback={<TabSkeleton />}>
            <AIInsightsTab />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="forecast" className="mt-4">
          <React.Suspense fallback={<TabSkeleton />}>
            <ForecastTab />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <React.Suspense fallback={<TabSkeleton />}>
            <RulesTab />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <React.Suspense fallback={<TabSkeleton />}>
            <SettingsTab />
          </React.Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
