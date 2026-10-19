'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity — Shared Global Loading System
// ═══════════════════════════════════════════════════════════════════════════════
//
// Design specification:
//   • Pure black background: rgb(0 0 0) / #000000
//   • Small circular progress ring with blue/cyan active arc & dark track
//   • Clean continuous circular motion
//   • No rotating logos, no bouncing dots, no heavy glass cards
//   • Synchronous rendering for next/dynamic({ loading: ... })
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { cn } from '@/lib/utils';
import { LoadingRing, LoadingRingState, FullPageLoadingRing } from './loading-ring';

export { LoadingRing, LoadingRingState, FullPageLoadingRing };

/**
 * PremiumGlobalLoading — full-screen loading splash on pure black rgb(0,0,0).
 * Displays the blue/cyan circular progress ring.
 */
export function PremiumGlobalLoading({ label }: { label?: string }) {
  return <FullPageLoadingRing label={label && label !== 'VEYRO' ? label : undefined} />;
}

/**
 * PremiumPageLoader — page/route-level circular loader for dynamic view imports.
 * Renders on pure black #000000 without blocking global shell navigation.
 */
export function PremiumPageLoader({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[60vh] w-full items-center justify-center bg-black select-none',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label ? `Loading ${label}` : 'Loading'}
    >
      <div className="flex flex-col items-center gap-3">
        <LoadingRing size="lg" strokeWidth={2.75} />
        {label && (
          <span className="text-xs font-normal text-[#A1A1A1] tracking-wide leading-relaxed">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

export default PremiumGlobalLoading;
