'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Premium Skeletons
// ═══════════════════════════════════════════════════════════════════════════════
//
// A small library of skeleton layouts that mirror the real view shapes.
// All skeletons use the existing `.shimmer` class from globals.css — a slow
// left-to-right sweep that makes loading rows feel alive without distracting.
//
// Theme: dark only.
//   • Skeleton block bg: #181818 (matte dark gray on pure black)
//   • Shimmer overlay: rgba(255,255,255,0.04 → 0.08) — defined in globals.css
//   • Borders: rgba(255,255,255,0.06) for cards
//
// Usage:
//   const View = dynamic(() => import('./View'), { loading: () => <DashboardSkeleton /> })
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { cn } from '@/lib/utils';

// ────────────────────────────────────────────────────────────────────────────────
// ShimmerBlock — base primitive. A block of #181818 with the .shimmer sweep.
// ────────────────────────────────────────────────────────────────────────────────
function ShimmerBlock({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn('shimmer rounded-md', className)}
      style={{ background: '#181818', ...style }}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// DashboardSkeleton — KPI cards row + chart panel + list panel.
// Mirrors the dashboard layout: greeting, 4 KPI cards, a wide chart, and a
// recent-activity list beside it.
// ────────────────────────────────────────────────────────────────────────────────
export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-6 p-6', className)}>
      {/* Greeting */}
      <div className="flex flex-col gap-2">
        <ShimmerBlock className="h-6 w-48" />
        <ShimmerBlock className="h-3.5 w-72" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-5"
          >
            <ShimmerBlock className="h-3 w-20" />
            <ShimmerBlock className="mt-3 h-7 w-28" />
            <ShimmerBlock className="mt-3 h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Chart + list */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-5 lg:col-span-2">
          <ShimmerBlock className="h-4 w-32" />
          <div className="mt-6 flex h-48 items-end gap-2">
            {Array.from({ length: 14 }).map((_, i) => (
              <ShimmerBlock
                key={i}
                className="flex-1"
                style={{ height: `${30 + ((i * 37) % 70)}%` }}
              />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-5">
          <ShimmerBlock className="h-4 w-28" />
          <div className="mt-5 flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <ShimmerBlock className="h-8 w-8 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <ShimmerBlock className="h-3 w-3/4" />
                  <ShimmerBlock className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// TableSkeleton — header row + 8 body rows with shimmer.
// Used by tables (clients, invoices, transactions, etc.).
// ────────────────────────────────────────────────────────────────────────────────
export function TableSkeleton({
  rows = 8,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div
        className="grid items-center gap-4 border-b border-white/[0.06] px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <ShimmerBlock key={i} className="h-3.5" style={{ width: `${50 + ((i * 23) % 40)}%` }} />
        ))}
      </div>
      {/* Body */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid items-center gap-4 border-b border-white/[0.04] px-4 py-3.5"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <ShimmerBlock
              key={c}
              className="h-3.5"
              style={{ width: `${40 + ((r * 13 + c * 7) % 50)}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// FormSkeleton — label + input fields layout.
// Used by settings pages, create-invoice forms, etc.
// ────────────────────────────────────────────────────────────────────────────────
export function FormSkeleton({
  fields = 5,
  className,
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <ShimmerBlock className="h-3 w-24" />
          <ShimmerBlock className="h-9 w-full rounded-lg" />
        </div>
      ))}
      <div className="flex gap-3 pt-2">
        <ShimmerBlock className="h-9 w-24 rounded-lg" />
        <ShimmerBlock className="h-9 w-20 rounded-lg" />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// OracleSkeleton — Oracle avatar + message bubbles.
// Used by Oracle Brain view while VEYRO AI chunk loads.
// ────────────────────────────────────────────────────────────────────────────────
export function OracleSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-5 p-6', className)}>
      {/* Oracle header / avatar */}
      <div className="flex items-center gap-3">
        <ShimmerBlock className="h-10 w-10 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <ShimmerBlock className="h-3.5 w-32" />
          <ShimmerBlock className="h-2.5 w-20" />
        </div>
      </div>

      {/* Oracle message bubble (left-aligned) */}
      <div className="max-w-[80%]">
        <div className="rounded-2xl rounded-tl-sm border border-white/[0.06] bg-[#0C0C0C] p-4">
          <ShimmerBlock className="h-3 w-full" />
          <ShimmerBlock className="mt-2 h-3 w-5/6" />
          <ShimmerBlock className="mt-2 h-3 w-2/3" />
        </div>
      </div>

      {/* User reply (right-aligned, slightly narrower) */}
      <div className="ml-auto max-w-[70%]">
        <div className="rounded-2xl rounded-tr-sm border border-white/[0.06] bg-[#0C0C0C] p-4">
          <ShimmerBlock className="h-3 w-full" />
          <ShimmerBlock className="mt-2 h-3 w-3/4" />
        </div>
      </div>

      {/* Oracle reply */}
      <div className="max-w-[80%]">
        <div className="rounded-2xl rounded-tl-sm border border-white/[0.06] bg-[#0C0C0C] p-4">
          <ShimmerBlock className="h-3 w-full" />
          <ShimmerBlock className="mt-2 h-3 w-5/6" />
          <ShimmerBlock className="mt-2 h-3 w-3/4" />
          <ShimmerBlock className="mt-2 h-3 w-1/2" />
        </div>
      </div>

      {/* Composer */}
      <div className="mt-auto flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-3">
        <ShimmerBlock className="h-8 flex-1 rounded-lg" />
        <ShimmerBlock className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ChartSkeleton — chart container with axes + bars.
// Used by reports / analytics pages.
// ────────────────────────────────────────────────────────────────────────────────
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-5',
        className,
      )}
    >
      {/* Title row */}
      <div className="flex items-center justify-between">
        <ShimmerBlock className="h-4 w-32" />
        <ShimmerBlock className="h-6 w-20 rounded-md" />
      </div>

      {/* Chart body */}
      <div className="mt-6 flex h-56 items-end gap-2">
        {/* Y-axis */}
        <div className="flex h-full flex-col justify-between py-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <ShimmerBlock key={i} className="h-2 w-8" />
          ))}
        </div>
        {/* Bars */}
        <div className="flex flex-1 items-end gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <ShimmerBlock
              key={i}
              className="flex-1"
              style={{ height: `${20 + ((i * 41) % 75)}%` }}
            />
          ))}
        </div>
      </div>
      {/* X-axis */}
      <div className="mt-3 flex gap-2 pl-10">
        {Array.from({ length: 12 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-2 flex-1" />
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// InvoiceSkeleton — invoice table with columns.
// Like TableSkeleton but with invoice-specific column widths (number, client,
// amount, status, date, actions).
// ────────────────────────────────────────────────────────────────────────────────
export function InvoiceSkeleton({
  rows = 8,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  // Column widths in % — invoice-flavored layout
  const colWidths = ['12%', '28%', '14%', '14%', '16%', '16%'];
  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div
        className="grid items-center gap-4 border-b border-white/[0.06] px-4 py-3"
        style={{ gridTemplateColumns: colWidths.join(' ') }}
      >
        {colWidths.map((w, i) => (
          <ShimmerBlock key={i} className="h-3.5" style={{ width: '70%' }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid items-center gap-4 border-b border-white/[0.04] px-4 py-3.5"
          style={{ gridTemplateColumns: colWidths.join(' ') }}
        >
          {/* Invoice # — chip-like */}
          <ShimmerBlock className="h-5 w-20 rounded-md" />
          {/* Client */}
          <div className="flex items-center gap-2.5">
            <ShimmerBlock className="h-7 w-7 rounded-full" />
            <ShimmerBlock className="h-3 w-3/4" />
          </div>
          {/* Amount */}
          <ShimmerBlock className="h-3.5 w-16" />
          {/* Status pill */}
          <ShimmerBlock className="h-5 w-16 rounded-full" />
          {/* Date */}
          <ShimmerBlock className="h-3.5 w-20" />
          {/* Actions */}
          <div className="flex gap-2">
            <ShimmerBlock className="h-6 w-6 rounded-md" />
            <ShimmerBlock className="h-6 w-6 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default DashboardSkeleton;
