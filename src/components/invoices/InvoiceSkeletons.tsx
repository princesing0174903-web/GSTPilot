'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Invoice Skeletons (Premium Shimmer)
//
// Layout-matched skeletons for every part of the Invoice Workspace so the page
// never shifts on load. Uses the shimmer animation defined in globals.css
// (premium shimmer with emerald tint).
// ═══════════════════════════════════════════════════════════════════════════════

// ─── KPI Card Skeleton ────────────────────────────────────────────────────────

export function KpiCardSkeleton() {
  return (
    <div className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 bg-white/5" />
          <Skeleton className="h-7 w-20 bg-white/5" />
        </div>
        <Skeleton className="h-9 w-9 rounded-xl bg-white/5" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16 bg-white/5" />
        <Skeleton className="h-8 w-24 bg-white/5" />
      </div>
    </div>
  );
}

export function KpiCardsSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Filter Bar Skeleton ──────────────────────────────────────────────────────

export function FilterBarSkeleton() {
  return (
    <div className="glass-surface rounded-2xl p-4 border border-white/[0.06]">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-64 bg-white/5 rounded-lg" />
        <Skeleton className="h-10 w-32 bg-white/5 rounded-lg" />
        <Skeleton className="h-10 w-32 bg-white/5 rounded-lg" />
        <Skeleton className="h-10 w-32 bg-white/5 rounded-lg" />
        <Skeleton className="h-10 w-32 bg-white/5 rounded-lg" />
        <div className="ml-auto">
          <Skeleton className="h-10 w-32 bg-white/5 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── Table Skeleton ───────────────────────────────────────────────────────────

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="glass-surface rounded-2xl border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 py-3 bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-4 bg-white/5 rounded" />
          <Skeleton className="h-3 w-24 bg-white/5" />
          <Skeleton className="h-3 w-32 bg-white/5" />
          <Skeleton className="h-3 w-20 bg-white/5 hidden md:block" />
          <Skeleton className="h-3 w-20 bg-white/5 hidden md:block" />
          <Skeleton className="h-3 w-20 bg-white/5 hidden lg:block" />
          <Skeleton className="h-3 w-24 bg-white/5 hidden lg:block" />
          <Skeleton className="h-3 w-20 bg-white/5 hidden xl:block" />
          <div className="ml-auto">
            <Skeleton className="h-3 w-10 bg-white/5" />
          </div>
        </div>
      </div>
      {/* Rows */}
      <div className="divide-y divide-white/[0.04]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 hover:bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-4 bg-white/5 rounded" />
              <Skeleton className="h-3 w-28 bg-white/5" />
              <Skeleton className="h-3 w-36 bg-white/5" />
              <Skeleton className="h-5 w-16 bg-white/5 rounded-full hidden md:block" />
              <Skeleton className="h-3 w-20 bg-white/5 hidden md:block" />
              <Skeleton className="h-3 w-20 bg-white/5 hidden lg:block" />
              <Skeleton className="h-3 w-24 bg-white/5 hidden lg:block" />
              <Skeleton className="h-5 w-20 bg-white/5 rounded-full hidden xl:block" />
              <div className="ml-auto flex gap-2">
                <Skeleton className="h-7 w-7 bg-white/5 rounded-md" />
                <Skeleton className="h-7 w-7 bg-white/5 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Full Page Skeleton ───────────────────────────────────────────────────────

export function InvoiceWorkspaceSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <KpiCardsSkeleton />
      <FilterBarSkeleton />
      <TableSkeleton />
    </div>
  );
}

// ─── Preview Skeleton (A4) ────────────────────────────────────────────────────

export function A4PreviewSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-2xl p-10 w-full aspect-[1/1.414] mx-auto">
      <div className="flex justify-between items-start mb-8 pb-6 border-b border-zinc-200">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32 bg-zinc-200" />
          <Skeleton className="h-3 w-40 bg-zinc-200" />
          <Skeleton className="h-3 w-28 bg-zinc-200" />
        </div>
        <div className="text-right space-y-2">
          <Skeleton className="h-6 w-20 bg-zinc-200" />
          <Skeleton className="h-3 w-24 bg-zinc-200" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16 bg-zinc-200" />
          <Skeleton className="h-3 w-32 bg-zinc-200" />
          <Skeleton className="h-3 w-24 bg-zinc-200" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16 bg-zinc-200" />
          <Skeleton className="h-3 w-28 bg-zinc-200" />
          <Skeleton className="h-3 w-20 bg-zinc-200" />
        </div>
      </div>
      <div className="space-y-3 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full bg-zinc-200" />
        ))}
      </div>
      <div className="flex justify-end">
        <div className="w-64 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full bg-zinc-200" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Oracle Panel Skeleton ────────────────────────────────────────────────────

export function OraclePanelSkeleton() {
  return (
    <div className="glass-surface rounded-2xl border border-white/[0.06] p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-xl bg-white/5" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 bg-white/5" />
          <Skeleton className="h-2 w-32 bg-white/5" />
        </div>
      </div>
      <Skeleton className="h-24 w-full bg-white/5 rounded-xl" />
      <Skeleton className="h-16 w-full bg-white/5 rounded-xl" />
      <Skeleton className="h-16 w-full bg-white/5 rounded-xl" />
      <Skeleton className="h-10 w-full bg-white/5 rounded-lg" />
    </div>
  );
}
