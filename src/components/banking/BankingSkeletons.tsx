'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Loading Skeletons (Premium Shimmer)
//
// Premium shimmer placeholders matching the final layout for no-shift loading.
// Each skeleton mirrors the exact card / table / chart structure it replaces.
// ═══════════════════════════════════════════════════════════════════════════════

export function BankingKpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="glass-surface rounded-2xl border border-white/[0.06] p-4">
          <Skeleton className="mb-3 h-8 w-8 rounded-lg bg-white/[0.06]" />
          <Skeleton className="mb-2 h-3 w-20 bg-white/[0.06]" />
          <Skeleton className="mb-3 h-6 w-24 bg-white/[0.06]" />
          <Skeleton className="h-8 w-full rounded bg-white/[0.04]" />
        </div>
      ))}
    </div>
  );
}

export function BankingCashFlowSkeleton() {
  return (
    <div className="glass-surface rounded-2xl border border-white/[0.06] p-6">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-32 bg-white/[0.06]" />
        <Skeleton className="h-8 w-24 rounded-lg bg-white/[0.06]" />
      </div>
      <Skeleton className="h-[220px] w-full rounded-xl bg-white/[0.04]" />
      <div className="mt-4 grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] p-3">
            <Skeleton className="mb-2 h-3 w-16 bg-white/[0.06]" />
            <Skeleton className="h-5 w-20 bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BankingAccountsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass-surface rounded-2xl border border-white/[0.06] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg bg-white/[0.06]" />
              <div>
                <Skeleton className="mb-1.5 h-4 w-24 bg-white/[0.06]" />
                <Skeleton className="h-3 w-16 bg-white/[0.06]" />
              </div>
            </div>
            <Skeleton className="h-6 w-16 rounded-full bg-white/[0.06]" />
          </div>
          <Skeleton className="mb-2 h-7 w-32 bg-white/[0.06]" />
          <Skeleton className="mb-4 h-3 w-28 bg-white/[0.06]" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20 bg-white/[0.06]" />
            <Skeleton className="h-3 w-16 bg-white/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BankingTransactionsSkeleton() {
  return (
    <div className="glass-surface rounded-2xl border border-white/[0.06]">
      <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
        <Skeleton className="h-5 w-32 bg-white/[0.06]" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-8 w-24 rounded-lg bg-white/[0.06]" />
        </div>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3">
            <Skeleton className="h-4 w-4 rounded bg-white/[0.06]" />
            <Skeleton className="h-8 w-8 rounded-lg bg-white/[0.06]" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48 bg-white/[0.06]" />
              <Skeleton className="h-3 w-32 bg-white/[0.06]" />
            </div>
            <Skeleton className="h-4 w-20 bg-white/[0.06]" />
            <Skeleton className="h-6 w-16 rounded-full bg-white/[0.06]" />
            <Skeleton className="h-6 w-6 rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BankingOracleSkeleton() {
  return (
    <div className="glass-surface rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-500/[0.04] to-transparent p-5">
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg bg-amber-400/10" />
        <div>
          <Skeleton className="mb-1.5 h-4 w-24 bg-white/[0.06]" />
          <Skeleton className="h-3 w-32 bg-white/[0.06]" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

export function BankingReconciliationSkeleton() {
  return (
    <div className="glass-surface rounded-2xl border border-white/[0.06] p-6">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-6 w-40 bg-white/[0.06]" />
        <Skeleton className="h-9 w-32 rounded-lg bg-white/[0.06]" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] p-3">
            <Skeleton className="mb-2 h-3 w-16 bg-white/[0.06]" />
            <Skeleton className="h-6 w-12 bg-white/[0.06]" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

export function BankingFullPageSkeleton() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <BankingKpiSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BankingCashFlowSkeleton />
        </div>
        <BankingOracleSkeleton />
      </div>
      <BankingAccountsSkeleton />
      <BankingTransactionsSkeleton />
    </div>
  );
}
