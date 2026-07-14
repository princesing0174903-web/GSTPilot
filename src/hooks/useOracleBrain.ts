'use client';

import { useState, useEffect, useCallback } from 'react';

export interface OracleDashboardData {
  generatedAt: string;
  empty: boolean;
  memory: {
    generatedAt: string;
    counts: Record<string, number>;
    totalRecords: number;
    financials: {
      totalSalesInvoiced: number;
      totalCollected: number;
      totalOutstanding: number;
      totalOverdue: number;
      totalExpenses: number;
      totalGstCollected: number;
      totalGstPaid: number;
      totalPayables: number;
      totalBankBalance: number;
      totalTdsDeducted: number;
    };
  };
  graph: {
    generatedAt: string;
    nodes: Array<{ id: string; kind: string; label: string; amount?: number; status?: string }>;
    edges: Array<{ from: string; to: string; kind: string; weight?: number }>;
    stats: { totalNodes: number; totalEdges: number; byKind: Record<string, number> };
  };
  timeline: {
    generatedAt: string;
    events: Array<{
      id: string;
      kind: string;
      timestamp: string;
      title: string;
      description: string;
      amount?: number;
      party?: string;
    }>;
    total: number;
    empty: boolean;
  };
  reasoning: {
    generatedAt: string;
    insights: Array<{
      id: string;
      category: string;
      severity: string;
      headline: string;
      detail: string;
      metric?: number;
      metricLabel?: string;
      sources: Array<{ kind: string; id: string; label: string }>;
      recommendation?: string;
    }>;
    executiveSummary: string;
    dataPoints: number;
    empty: boolean;
  };
  kpis: {
    revenue30d: number;
    collected30d: number;
    outstandingNow: number;
    overdueNow: number;
    expenses30d: number;
    gstThisMonth: number;
    activeCustomers: number;
    activeVendors: number;
    avgPaymentDelayDays: number;
    cashRunwayDays: number | null;
  };
}

export interface CommandResultData {
  query: string;
  interpreted: string;
  answer: string;
  data?: unknown;
  sources: Array<{ kind: string; id: string; label: string }>;
  durationMs: number;
  empty: boolean;
}

export function useOracleDashboard() {
  const [data, setData] = useState<OracleDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/oracle-brain/dashboard', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Oracle dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, error, refreshing, refresh: () => fetchDashboard(true) };
}

export function useOracleCommand() {
  const [result, setResult] = useState<CommandResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCommand = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/oracle-brain/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Command failed');
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, runCommand, clear: () => setResult(null) };
}
