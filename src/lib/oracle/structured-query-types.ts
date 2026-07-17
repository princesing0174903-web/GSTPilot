// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Structured Query Types (CLIENT-SAFE, no Prisma import)
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module contains ONLY TypeScript types — no runtime imports — so it is
// safe to import from both client and server code. The server-side executor
// (src/lib/oracle/structured-queries.ts) imports these types and adds the
// Prisma-backed implementation; the client-side Oracle UI imports the same
// types to render the data cards.
// ═══════════════════════════════════════════════════════════════════════════════

/** The 10 structured query types Oracle can answer with a data card. */
export type StructuredQueryType =
  | 'unpaid_invoices'
  | 'overdue_invoices'
  | 'top_customers'
  | 'gst_payable'
  | 'cash_position'
  | 'revenue_trend'
  | 'profit'
  | 'expenses'
  | 'compliance'
  | 'health_score';

/** A single stat tile (label + value + optional hint / delta). */
export interface StructuredStatRow {
  label: string;
  value: string;
  hint?: string;
  /** Percentage change vs the prior period. Positive = up. */
  delta?: number;
  deltaLabel?: string;
  /** Visual tone for the value (default = neutral). */
  tone?: 'default' | 'warning' | 'success' | 'danger';
}

/** A row in a list-style card (key/value pairs). */
export interface StructuredListRow {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'success' | 'danger';
}

/** A single point in a trend series. */
export interface StructuredTrendPoint {
  label: string;
  value: number;
}

/** Column descriptor for table-format results. */
export interface StructuredColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  /** Render the cell as currency (₹), number, date, or text. */
  format?: 'text' | 'currency' | 'number' | 'date' | 'badge';
}

/**
 * The canonical structured-query result. The `format` field tells the client
 * which renderer to use; the typed fields carry the payload.
 *
 *   - format: 'table'  → use `columns` + `rows`
 *   - format: 'list'   → use `items`
 *   - format: 'number' → use `stats` (one or more stat tiles)
 *   - format: 'chart'  → use `trend` + `trendDirection` (+ optional `stats`)
 */
export interface StructuredQueryResult {
  type: StructuredQueryType;
  title: string;
  /** Renderer hint for the client card. */
  format: 'table' | 'list' | 'number' | 'chart';
  /** One-line plain-text summary the LLM also uses as context. */
  summary: string;
  /** When the underlying query was run (ISO). */
  generatedAt: string;

  // ── Table payload ──
  columns?: StructuredColumn[];
  rows?: Record<string, unknown>[];

  // ── Number/stat payload ──
  stats?: StructuredStatRow[];

  // ── List payload ──
  items?: StructuredListRow[];

  // ── Chart payload ──
  trend?: StructuredTrendPoint[];
  trendDirection?: 'up' | 'down' | 'flat';
}
