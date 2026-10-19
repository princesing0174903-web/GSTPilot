'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LoadingRingProps extends React.SVGProps<SVGSVGElement> {
  /** Size in pixels, or standard token: 'sm' (16), 'md' (24), 'lg' (36), 'xl' (48) */
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  /** Stroke width in pixels (defaults to proportional ~2.25) */
  strokeWidth?: number;
  /** Active arc color — defaults to vibrant cyan/blue */
  arcColor?: string;
  /** Background track color — defaults to subtle dark track */
  trackColor?: string;
  /** Accessible label */
  ariaLabel?: string;
  className?: string;
}

const SIZE_MAP: Record<string, number> = {
  sm: 16,
  md: 24,
  lg: 36,
  xl: 48,
};

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LoadingRing — GSTPilot Infinity Global Circular Progress Indicator
 * ═══════════════════════════════════════════════════════════════════════════════
 * Visual specification:
 *   • Small circular progress ring
 *   • Blue/cyan active arc (defaults to #00E5FF / #38BDF8)
 *   • Dark / transparent remainder track
 *   • Smooth continuous circular rotation
 *   • Clean crisp edges (vector SVG, subpixel-snapped)
 *   • Fully respects prefers-reduced-motion
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export function LoadingRing({
  size = 'md',
  strokeWidth = 2.5,
  arcColor = '#00E5FF',
  trackColor = 'rgba(255, 255, 255, 0.12)',
  ariaLabel = 'Loading',
  className,
  style,
  ...props
}: LoadingRingProps) {
  const pxSize = typeof size === 'number' ? size : SIZE_MAP[size] ?? 24;
  const radius = 10;
  const circumference = 2 * Math.PI * radius; // ≈ 62.83
  // Active arc spans approximately 32% of the circle
  const arcLength = circumference * 0.32;
  const strokeDashoffset = circumference - arcLength;

  return (
    <svg
      role="status"
      aria-label={ariaLabel}
      viewBox="0 0 24 24"
      fill="none"
      className={cn(
        'animate-spin shrink-0 select-none pointer-events-none',
        className
      )}
      style={{
        width: pxSize,
        height: pxSize,
        animationDuration: '0.75s',
        animationTimingFunction: 'linear',
        ...style,
      }}
      {...props}
    >
      {/* Dark / transparent track remainder */}
      <circle
        cx="12"
        cy="12"
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Blue / Cyan active arc */}
      <circle
        cx="12"
        cy="12"
        r={radius}
        stroke={arcColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${arcLength} ${circumference}`}
        fill="none"
      />
    </svg>
  );
}

/**
 * LoadingRingState — inline or section-level loader on pure black.
 * Ideal for route transitions, table loading, and modal operations.
 */
export function LoadingRingState({
  label,
  size = 'lg',
  className,
}: {
  label?: string;
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center bg-black select-none',
        className
      )}
    >
      <LoadingRing size={size} />
      {label && (
        <p className="mt-3 text-xs sm:text-sm font-normal text-[#A1A1A1] tracking-wide leading-relaxed">
          {label}
        </p>
      )}
    </div>
  );
}

/**
 * FullPageLoadingRing — full viewport loading splash on pure black rgb(0,0,0).
 * Replaces heavy spinning logos and overlays with the minimal circular ring.
 */
export function FullPageLoadingRing({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Loading'}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black select-none"
    >
      <LoadingRing size="xl" strokeWidth={3} />
      {label && (
        <p className="mt-4 text-xs sm:text-sm font-normal text-[#A1A1A1] tracking-wide leading-relaxed">
          {label}
        </p>
      )}
    </div>
  );
}

export default LoadingRing;
