'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — AnimatedNumber
//
// A premium count-up animation for numeric KPI values. The number animates
// from its previous value to the new value over ~800ms with an ease-out curve.
//
// This is what makes the dashboard feel "alive" — when revenue goes from
// ₹0 to ₹1,18,000 after creating an invoice, the number counts up smoothly
// instead of snapping. (Phase 9 — Animations)
//
// Usage:
//   <AnimatedNumber value={118000} format="currency" />
//   <AnimatedNumber value={42} format="integer" />
//   <AnimatedNumber value={68.5} format="decimal" suffix="%" />
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';

type FormatType = 'currency' | 'currencyCompact' | 'integer' | 'decimal';

interface AnimatedNumberProps {
  value: number;
  format?: FormatType;
  suffix?: string;
  prefix?: string;
  /** Animation duration in ms (default 800) */
  duration?: number;
  /** When true, shows "—" instead of animating (for unavailable metrics) */
  placeholder?: string | null;
  className?: string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Compact Indian-format currency: 1,09,000 → ₹1.09L, 1,18,00,000 → ₹1.18Cr.
// Keeps KPI figures readable in narrow cards without truncating to "₹1,09,...".
function formatCompactINR(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function formatValue(val: number, format: FormatType): string {
  if (format === 'currency') {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  }
  if (format === 'currencyCompact') {
    return formatCompactINR(val);
  }
  if (format === 'decimal') {
    return val.toFixed(1);
  }
  return Math.round(val).toLocaleString('en-IN');
}

export function AnimatedNumber({
  value,
  format = 'integer',
  suffix = '',
  prefix = '',
  duration = 800,
  placeholder,
  className,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // If the value hasn't changed, don't animate.
    if (value === previousValueRef.current) return;

    const from = previousValueRef.current;
    const to = value;
    const startTime = performance.now();

    // Cancel any in-flight animation
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = from + (to - from) * eased;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(to);
        previousValueRef.current = to;
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      previousValueRef.current = value;
    };
  }, [value, duration]);

  // Show placeholder for unavailable metrics
  if (placeholder !== null && placeholder !== undefined) {
    return <span className={className}>{placeholder}</span>;
  }

  return (
    <span className={className}>
      {prefix}
      {formatValue(displayValue, format)}
      {suffix}
    </span>
  );
}

export default AnimatedNumber;
