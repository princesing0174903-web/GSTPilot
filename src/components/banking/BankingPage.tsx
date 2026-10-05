'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — BankingPage (Lean Orchestrator) (TASK 12)
//
// Composes all premium banking sub-components into a single dashboard.
// Pure-black GSTPilot theme. Sticky header + sticky footer. Mobile responsive.
//
// Layout:
//   ┌─────────────────────────────────────────────────────────────────────┐
//   │ Sticky Header: title + AskOracle + Refresh + Import + Add Account   │
//   ├─────────────────────────────────────────────────────────────────────┤
//   │ Tab Bar: Overview · Accounts · Transactions · Reconciliation ·      │
//   │          Oracle · Reports                                          │
//   ├─────────────────────────────────────────────────────────────────────┤
//   │ Tab Content (scrollable):                                          │
//   │   Overview: KPIs + CashFlowChart + Accounts + Recent Txns          │
//   │   Accounts: BankAccountsPanel                                      │
//   │   Transactions: BankingTransactionsTable                           │
//   │   Reconciliation: BankingReconciliation + PaymentTimeline          │
//   │   Oracle: BankingOraclePanel                                       │
//   │   Reports: BankingReports                                          │
//   ├─────────────────────────────────────────────────────────────────────┤
//   │ Sticky Footer: provider badge + last sync + links                  │
//   └─────────────────────────────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Landmark,
  RefreshCw,
  Plus,
  Upload,
  Sparkles,
  ShieldCheck,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useBankingApi } from '@/hooks/useBankingApi';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';

// Sub-components
import { BankingKpiCards } from './BankingKpiCards';
import { BankingCashFlowChart } from './BankingCashFlowChart';
import { BankAccountsPanel } from './BankAccountsPanel';
import { BankingTransactionsTable } from './BankingTransactionsTable';
import { BankingReconciliation } from './BankingReconciliation';
import { BankingOraclePanel } from './BankingOraclePanel';
import { BankingReports } from './BankingReports';
import { BankingImportModal } from './BankingImportModal';
import { ProviderBadge } from './BankingStatusPills';
import { BankingFullPageSkeleton } from './BankingSkeletons';
import { BankingEmptyState, BankingErrorState } from './BankingEmptyErrorStates';

import type {
  BankingDashboardSummary,
  BankingAccount,
  BankingTransaction,
  BankingAccountListResult,
  BankingTransactionListResult,
  CashFlowResult,
  BankingReport,
  ReconciliationSummary,
  BankReconciliationRecord,
  ReportPeriod,
  ProviderInfo,
} from '@/lib/banking-prisma/types';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function BankingPage() {
  const api = useBankingApi();
  const { currentOrg } = useOrg();
  const orgId = currentOrg?.id || 'local';

  // ─── State ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<BankingDashboardSummary | null>(null);
  const [accountsResult, setAccountsResult] = useState<BankingAccountListResult | null>(null);
  const [txnsResult, setTxnsResult] = useState<BankingTransactionListResult | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowResult | null>(null);
  const [cashFlowPeriod, setCashFlowPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [reconSummary, setReconSummary] = useState<ReconciliationSummary | null>(null);
  const [reconRecords, setReconRecords] = useState<BankReconciliationRecord[]>([]);
  const [report, setReport] = useState<BankingReport | null>(null);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('monthly');
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Load dashboard data ───────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, accts, cf, provider] = await Promise.all([
        api.fetchDashboard(),
        api.fetchAccounts(),
        api.fetchCashFlow('30d'),
        api.fetchProviderInfo(),
      ]);
      setDashboard(dash);
      setAccountsResult(accts);
      setCashFlow(cf);
      setProviderInfo(provider);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  // ─── Load transactions (lazy, when tab is opened) ──────────────────────────
  const loadTransactions = useCallback(async () => {
    try {
      const result = await api.fetchTransactions({ limit: 100 });
      setTxnsResult(result);
    } catch (err) {
      toast.error('Failed to load transactions', { description: (err as Error).message });
    }
  }, [api]);

  // ─── Load reconciliation (lazy) ────────────────────────────────────────────
  const loadReconciliation = useCallback(async () => {
    try {
      const result = await api.fetchReconciliationSummary();
      setReconSummary(result.summary);
      setReconRecords(result.records);
    } catch (err) {
      toast.error('Failed to load reconciliation', { description: (err as Error).message });
    }
  }, [api]);

  // ─── Load report (lazy) ────────────────────────────────────────────────────
  const loadReport = useCallback(async (period: ReportPeriod) => {
    try {
      const r = await api.fetchReport(period);
      setReport(r);
    } catch (err) {
      toast.error('Failed to load report', { description: (err as Error).message });
    }
  }, [api]);

  // ─── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, orgId]);

  // ─── Lazy load on tab change ───────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'transactions' && !txnsResult) loadTransactions();
    if (activeTab === 'reconciliation' && !reconSummary) loadReconciliation();
    if (activeTab === 'reports' && !report) loadReport(reportPeriod);
  }, [activeTab, txnsResult, reconSummary, report, reportPeriod, loadTransactions, loadReconciliation, loadReport]);

  // ─── Refresh handler ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard();
    if (activeTab === 'transactions') await loadTransactions();
    if (activeTab === 'reconciliation') await loadReconciliation();
    if (activeTab === 'reports') await loadReport(reportPeriod);
    setRefreshing(false);
    toast.success('Banking data refreshed');
  }, [loadDashboard, loadTransactions, loadReconciliation, loadReport, activeTab, reportPeriod]);

  // ─── Cash flow period change ───────────────────────────────────────────────
  const handleCashFlowPeriod = useCallback(async (p: '7d' | '30d' | '90d' | '1y') => {
    setCashFlowPeriod(p);
    try {
      const cf = await api.fetchCashFlow(p);
      setCashFlow(cf);
    } catch (err) {
      toast.error('Failed to load cash flow', { description: (err as Error).message });
    }
  }, [api]);

  // ─── Report period change ──────────────────────────────────────────────────
  const handleReportPeriod = useCallback(async (p: ReportPeriod) => {
    setReportPeriod(p);
    await loadReport(p);
  }, [loadReport]);

  // ─── Run reconciliation ────────────────────────────────────────────────────
  const handleRunReconciliation = useCallback(async () => {
    try {
      const result = await api.runReconciliation();
      setReconSummary(result.summary);
      setReconRecords(result.matched);
      toast.success('Reconciliation complete', {
        description: `${result.summary.matched} matched, ${result.summary.unmatched} unmatched`,
      });
    } catch (err) {
      toast.error('Reconciliation failed', { description: (err as Error).message });
    }
  }, [api]);

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading && !dashboard) return <BankingFullPageSkeleton />;

  if (error && !dashboard) {
    return (
      <div className="flex h-full flex-col bg-black">
        <main className="flex-1 px-4 py-6 sm:px-6">
          <BankingErrorState message={error} onRetry={loadDashboard} />
        </main>
      </div>
    );
  }

  if (!dashboard || (dashboard.connectedAccounts === 0 && !loading)) {
    return (
      <div className="flex h-full flex-col bg-black">
        <BankingHeader
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onImport={() => setImportOpen(true)}
          providerInfo={providerInfo}
        />
        <main className="flex-1 px-4 py-6 sm:px-6">
          <BankingEmptyState
            onConnect={() => setActiveTab('accounts')}
            onImport={() => setImportOpen(true)}
            onAskOracle={() => setActiveTab('oracle')}
          />
        </main>
        <BankingImportModal
          open={importOpen}
          onOpenChange={setImportOpen}
          accounts={accountsResult?.accounts ?? []}
          onImport={api.importStatement}
        />
        <BankingFooter providerInfo={providerInfo} lastSync={dashboard?.recentTransactions?.[0]?.date} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-black">
      {/* ─── Sticky Header ─────────────────────────────────────────────────── */}
      <BankingHeader
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onImport={() => setImportOpen(true)}
        providerInfo={providerInfo}
      />

      {/* ─── Tab Bar ───────────────────────────────────────────────────────── */}
      <div className="sticky top-[60px] z-20 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-12 gap-1 bg-transparent p-0">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'accounts', label: 'Accounts' },
                { key: 'transactions', label: 'Transactions' },
                { key: 'reconciliation', label: 'Reconciliation' },
                { key: 'oracle', label: 'Oracle AI' },
                { key: 'reports', label: 'Reports' },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="rounded-none border-b-2 border-transparent bg-transparent px-4 text-xs font-medium text-muted-foreground data-[state=active]:border-blue-400 data-[state=active]:bg-transparent data-[state=active]:text-blue-300 data-[state=active]:shadow-none"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* ─── Tab Content ───────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          {activeTab === 'overview' && dashboard && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <BankingKpiCards summary={dashboard} />
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  {cashFlow && (
                    <BankingCashFlowChart
                      data={cashFlow.daily}
                      period={cashFlowPeriod}
                      onPeriodChange={handleCashFlowPeriod}
                    />
                  )}
                </div>
                <BankingOraclePanel />
              </div>
              {accountsResult && (
                <BankAccountsPanel accounts={accountsResult.accounts} loading={loading} />
              )}
              {dashboard.recentTransactions.length > 0 && (
                <RecentTransactionsCard transactions={dashboard.recentTransactions} />
              )}
            </motion.div>
          )}

          {activeTab === 'accounts' && accountsResult && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <BankAccountsPanel accounts={accountsResult.accounts} loading={loading} />
            </motion.div>
          )}

          {activeTab === 'transactions' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {txnsResult ? (
                <BankingTransactionsTable
                  transactions={txnsResult.transactions}
                  total={txnsResult.total}
                  totalInflow={txnsResult.totalInflow}
                  totalOutflow={txnsResult.totalOutflow}
                  loading={false}
                  accounts={accountsResult?.accounts}
                />
              ) : (
                <BankingFullPageSkeleton />
              )}
            </motion.div>
          )}

          {activeTab === 'reconciliation' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {reconSummary ? (
                <BankingReconciliation
                  summary={reconSummary}
                  records={reconRecords}
                  loading={false}
                  onRunReconciliation={handleRunReconciliation}
                />
              ) : (
                <BankingFullPageSkeleton />
              )}
            </motion.div>
          )}

          {activeTab === 'oracle' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <BankingOraclePanel onRunReconciliation={handleRunReconciliation} />
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <BankingReports
                report={report}
                loading={!report}
                onPeriodChange={handleReportPeriod}
              />
            </motion.div>
          )}
        </div>
      </main>

      {/* ─── Import Modal ──────────────────────────────────────────────────── */}
      <BankingImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        accounts={accountsResult?.accounts ?? []}
        onImport={api.importStatement}
      />

      {/* ─── Sticky Footer ────────────────────────────────────────────────── */}
      <BankingFooter
        providerInfo={providerInfo}
        lastSync={dashboard?.recentTransactions?.[0]?.date}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════════════════════

function BankingHeader({
  onRefresh,
  refreshing,
  onImport,
  providerInfo,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  onImport: () => void;
  providerInfo: ProviderInfo | null;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-black/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 border border-blue-500/20">
            <Landmark className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
              GSTPilot Banking™
            </h1>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              Banking & Reconciliation Platform
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {providerInfo && <ProviderBadge provider={providerInfo.provider} isLive={providerInfo.isLive} />}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onImport}
            className="gap-1.5 border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04]"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOOTER (sticky to bottom)
// ═══════════════════════════════════════════════════════════════════════════════

function BankingFooter({
  providerInfo,
  lastSync,
}: {
  providerInfo: ProviderInfo | null;
  lastSync?: string;
}) {
  return (
    <footer className="mt-auto border-t border-white/[0.06] bg-black/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-2 px-4 py-3 text-[11px] text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
          <span>Banking data is encrypted at rest · Audit-logged</span>
        </div>
        <div className="flex items-center gap-3">
          {providerInfo && (
            <span>
              Provider: <span className="font-medium text-foreground">{providerInfo.name}</span>
            </span>
          )}
          {lastSync && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last activity {new Date(lastSync).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECENT TRANSACTIONS CARD (overview tab)
// ═══════════════════════════════════════════════════════════════════════════════

function RecentTransactionsCard({ transactions }: { transactions: BankingTransaction[] }) {
  const fmt = new Intl.NumberFormat('en-IN', { currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (
    <div className="glass-surface rounded-2xl border border-white/[0.06] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Recent Transactions</h3>
        <span className="text-xs text-muted-foreground">{transactions.length} recent</span>
      </div>
      <div className="space-y-1">
        {transactions.slice(0, 6).map((txn, i) => (
          <motion.div
            key={txn.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/[0.02]"
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                txn.type === 'credit' ? 'bg-blue-500/10' : 'bg-red-500/10'
              }`}
            >
              {txn.type === 'credit' ? (
                <ArrowLeft className="h-4 w-4 rotate-45 text-blue-400" />
              ) : (
                <ArrowLeft className="h-4 w-4 -rotate-45 text-red-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{txn.description}</p>
              <p className="text-[11px] text-muted-foreground">
                {txn.bankName} · {new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </p>
            </div>
            <span
              className={`text-sm font-semibold tabular-nums ${
                txn.type === 'credit' ? 'text-blue-400' : 'text-red-400'
              }`}
            >
              {txn.type === 'credit' ? '+' : '−'}₹{fmt.format(txn.amount)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
