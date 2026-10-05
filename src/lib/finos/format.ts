/**
 * Currency & date formatters for Indian Rupee financial data.
 */

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const INR_COMPACT = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const NUM_COMPACT = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** ₹12,34,567 — full Indian-format currency. */
export function formatINR(value: number): string {
  return INR.format(value)
}

/** ₹12.3L / ₹1.2Cr — compact for chart axes and KPI tiles. */
export function formatINRCompact(value: number): string {
  return INR_COMPACT.format(value)
}

/** 12.3K / 1.2M — compact for unit counts. */
export function formatCompact(value: number): string {
  return NUM_COMPACT.format(value)
}

/** Percentage with one decimal. */
export function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

/** Indian short date — 12 Jul 2025. */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Relative day — Today / Yesterday / 3 days ago. */
export function formatRelative(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return formatDate(iso)
}

/** Convert a number to Indian-format string with thousand separators only. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value)
}

/** Title-case a snake or kebab string. */
export function titleCase(s: string): string {
  return s
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
