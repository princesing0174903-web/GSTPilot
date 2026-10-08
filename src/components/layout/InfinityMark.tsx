'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Mark™ — V16 Brand Symbol
// Three connected nodes (Business · AI · Finance) forming an infinite triangle.
// Emerald → Cyan → Blue. Flat design. Recognizable in 1 second.
// Works as: favicon · app icon · mobile icon · website logo.
// ═══════════════════════════════════════════════════════════════════════════════

import { cn } from '@/lib/utils';

interface InfinityMarkProps {
  className?: string;
  size?: number;
  /** Show the wordmark next to the symbol */
  withWordmark?: boolean;
  /** Compact mode: just the symbol, no wordmark */
  compact?: boolean;
}

export function InfinityMark({
  className,
  size = 32,
  withWordmark = false,
  compact = false,
}: InfinityMarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <InfinitySymbol size={size} />
      {!compact && withWordmark && (
        <span className="flex flex-col items-start leading-none">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            VEYRO
            <span className="accent-text">™</span>
          </span>
          <span className="text-[10px] font-medium text-muted-foreground">
            The AI Operating System for Business
          </span>
        </span>
      )}
    </span>
  );
}

// ─── The Symbol ──────────────────────────────────────────────────────────────
// Three nodes (Business top-left, AI top-right, Finance bottom-center) connected
// by curved lines forming an infinity-like loop. Each node is a gradient circle.
// Flat SVG, no raster, scales perfectly to any size.

export function InfinitySymbol({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-label="VEYRO Mark"
      role="img"
    >
      <defs>
        {/* Emerald → Cyan → Blue gradient for nodes + connecting lines */}
        <linearGradient id="infinity-grad-emerald" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="infinity-grad-cyan" x1="48" y1="0" x2="0" y2="48">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="infinity-grad-blue" x1="0" y1="48" x2="48" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        {/* Connecting line gradient: full spectrum */}
        <linearGradient id="infinity-line" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Connecting curves — form an infinity-like loop between 3 nodes */}
      {/* Node positions: Business (12,14) · AI (36,14) · Finance (24,36) */}
      <g stroke="url(#infinity-line)" strokeWidth="1.5" fill="none" strokeLinecap="round">
        {/* Top arc: Business → AI */}
        <path d="M 12 14 Q 24 6, 36 14" />
        {/* Right arc: AI → Finance */}
        <path d="M 36 14 Q 42 24, 24 36" />
        {/* Left arc: Finance → Business */}
        <path d="M 24 36 Q 6 24, 12 14" />
        {/* Inner infinity crossover line */}
        <path d="M 16 18 Q 24 28, 32 18" strokeOpacity="0.4" />
      </g>

      {/* Node 1: Business (top-left) — Emerald → Cyan */}
      <circle cx="12" cy="14" r="4.5" fill="url(#infinity-grad-emerald)" />
      <circle cx="12" cy="14" r="4.5" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
      {/* Inner highlight */}
      <circle cx="10.5" cy="12.5" r="1.5" fill="rgba(255,255,255,0.4)" />

      {/* Node 2: AI (top-right) — Cyan → Blue */}
      <circle cx="36" cy="14" r="4.5" fill="url(#infinity-grad-cyan)" />
      <circle cx="36" cy="14" r="4.5" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
      <circle cx="34.5" cy="12.5" r="1.5" fill="rgba(255,255,255,0.4)" />

      {/* Node 3: Finance (bottom-center) — Blue → Emerald (closes the loop) */}
      <circle cx="24" cy="36" r="4.5" fill="url(#infinity-grad-blue)" />
      <circle cx="24" cy="36" r="4.5" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
      <circle cx="22.5" cy="34.5" r="1.5" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

export default InfinityMark;
