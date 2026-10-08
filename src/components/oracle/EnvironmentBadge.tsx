'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Environment Badge (Freshness Pill)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Small pill that labels a number / data point with the source environment
// (Live / Sandbox / Demo / Stale / Unavailable). Uses the helpers from the
// unified context type system so the colors + labels stay consistent across
// the entire Oracle UI.
//
// Color policy (matches `environmentBadgeClass`):
//   LIVE       → emerald
//   SANDBOX    → amber
//   DEMO       → violet
//   STALE      → orange
//   UNAVAILABLE→ zinc
// ═══════════════════════════════════════════════════════════════════════════════

import {
  environmentLabel,
  environmentBadgeClass,
  type DataEnvironment,
} from '@/lib/oracle/context/types';
import { cn } from '@/lib/utils';

export interface EnvironmentBadgeProps {
  environment: DataEnvironment;
  /** Override the label (e.g. "LIVE", "Live data"). Defaults to `environmentLabel(env)`. */
  label?: string;
  /** Show a small dot before the label. Default false. */
  withDot?: boolean;
  className?: string;
}

export function EnvironmentBadge({
  environment,
  label,
  withDot = false,
  className,
}: EnvironmentBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        environmentBadgeClass(environment),
        className,
      )}
      title={`Data source: ${environmentLabel(environment)}`}
    >
      {withDot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            environment === 'LIVE' && 'bg-emerald-500',
            environment === 'SANDBOX' && 'bg-amber-500',
            environment === 'DEMO' && 'bg-violet-500',
            environment === 'STALE' && 'bg-orange-500',
            environment === 'UNAVAILABLE' && 'bg-zinc-400',
          )}
        />
      )}
      {label ?? environmentLabel(environment)}
    </span>
  );
}

export default EnvironmentBadge;
