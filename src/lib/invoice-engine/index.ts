// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Invoice Engine™ — Barrel Export
//
// Single import surface for the entire invoice engine. Import everything from
// `@/lib/invoice-engine` — never reach into individual files.
// ═══════════════════════════════════════════════════════════════════════════════

export * from './types';
export * from './calculations';
export * from './service';
export { generateInvoiceHTML } from './pdf';
