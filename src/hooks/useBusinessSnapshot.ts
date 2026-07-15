'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// useBusinessSnapshot() — THE client hook for business metrics
// ═══════════════════════════════════════════════════════════════════════════════
//
// Every client component that needs Revenue, Cash, Profit, Customers, Invoices,
// Receivables, Payables, GST Liability, ITC, Health Score, Forecast, Risk Score,
// Collection Rate, Working Capital, or Runway MUST use this hook.
//
// This is the single source of truth on the client. No component is allowed to
// fetch business metrics from any other endpoint or compute them independently.
//
// Usage:
//   const { snapshot, loading, error, refetch } = useBusinessSnapshot();
//   if (loading) return <Skeleton />;
//   return <div>Revenue: ₹{snapshot.revenue}</div>;
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { useCurrentOrgId } from '@/contexts/OrgContext';
import type { BusinessSnapshot } from '@/lib/business/snapshot';

export interface UseBusinessSnapshotResult {
  snapshot: BusinessSnapshot | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useBusinessSnapshot(): UseBusinessSnapshotResult {
  const orgId = useCurrentOrgId();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['business-snapshot', orgId ?? 'no-org'],
    queryFn: async ({ signal }) => {
      if (!orgId) return null;
      const res = await fetch(
        `/api/business-snapshot?organizationId=${encodeURIComponent(orgId)}`,
        { signal },
      );
      if (!res.ok) {
        throw new Error(`Failed to load business snapshot (HTTP ${res.status})`);
      }
      return (await res.json()) as BusinessSnapshot;
    },
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
    retry: 1,
  });

  return {
    snapshot: data ?? null,
    loading: isLoading || !orgId,
    error: error instanceof Error ? error.message : null,
    refetch: () => void refetch(),
  };
}
