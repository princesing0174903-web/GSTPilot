// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Forecasting — Pure formatting helpers (Prisma-free)
// ═══════════════════════════════════════════════════════════════════════════════
// Pure currency formatter extracted out of `./forecasting` so client
// components can format forecast values without dragging Prisma into their
// bundle. The Prisma-backed forecast generator (`generateForecasts`) lives in
// `./forecasting` (server-only).
// ═══════════════════════════════════════════════════════════════════════════════

export function formatForecastCurrency(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}
