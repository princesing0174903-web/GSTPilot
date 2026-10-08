'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Zoho Books Premium Skeletons
// ═══════════════════════════════════════════════════════════════════════════════
//
// Loading state for the connected-mode dashboard. Mirrors the real layout
// (sticky header → KPI row → modules grid → timeline) so the page does NOT
// jump when data arrives. Uses the existing `.shimmer` class from
// globals.css — no new CSS.
//
// RULE 4: NEVER show "Loading..." text. Skeletons only.
// ═══════════════════════════════════════════════════════════════════════════════

import { cn } from '@/lib/utils';

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

// ─── Single KPI skeleton (icon tile + label + value + sparkline) ─────────────
function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-5">
      <div className="flex items-start justify-between">
        <ShimmerBlock className="h-3 w-24" />
        <ShimmerBlock className="h-8 w-8 rounded-lg" />
      </div>
      <ShimmerBlock className="mt-4 h-7 w-28" />
      <div className="mt-3 flex items-center justify-between">
        <ShimmerBlock className="h-3 w-16" />
        <ShimmerBlock className="h-3 w-16" />
      </div>
    </div>
  );
}

// ─── Single module skeleton ──────────────────────────────────────────────────
function ModuleCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShimmerBlock className="h-9 w-9 rounded-full" />
          <ShimmerBlock className="h-3 w-20" />
        </div>
        <ShimmerBlock className="h-5 w-16 rounded-full" />
      </div>
      <ShimmerBlock className="mt-5 h-7 w-20" />
      <ShimmerBlock className="mt-2 h-2.5 w-24" />
      <ShimmerBlock className="mt-4 h-1.5 w-full rounded-full" />
    </div>
  );
}

// ─── Full dashboard skeleton (header + KPIs + modules + timeline) ────────────
export function ZohoDashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Sticky header bar */}
      <div className="sticky top-0 z-20 -mx-4 mb-2 border-b border-white/[0.06] bg-background/80 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ShimmerBlock className="h-10 w-10 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <ShimmerBlock className="h-4 w-32" />
              <ShimmerBlock className="h-3 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShimmerBlock className="h-9 w-28 rounded-lg" />
            <ShimmerBlock className="h-9 w-28 rounded-lg" />
            <ShimmerBlock className="h-9 w-9 rounded-lg" />
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>

      {/* Modules grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ModuleCardSkeleton key={i} />
        ))}
      </div>

      {/* Sync history timeline */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-6">
        <div className="flex items-center justify-between">
          <ShimmerBlock className="h-4 w-32" />
          <ShimmerBlock className="h-3 w-16" />
        </div>
        <div className="mt-6 flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <ShimmerBlock className="mt-1 h-2 w-2 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <ShimmerBlock className="h-3 w-1/2" />
                <ShimmerBlock className="h-2.5 w-1/3" />
              </div>
              <ShimmerBlock className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ZohoDashboardSkeleton;
