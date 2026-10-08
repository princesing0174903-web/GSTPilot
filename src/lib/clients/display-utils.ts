// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Customer Display Utilities (PQA-3 · Internal IDs Removal)
// ═══════════════════════════════════════════════════════════════════════════════
// Pure display-layer helpers that ensure NO internal IDs, UUIDs, or synthetic
// database references ever reach the user's screen in the Customers module.
//
// BACKGROUND
//   The Customer (Client) table has `gstin` as a @unique column. When a real
//   GSTIN isn't available — e.g., Zoho-imported contacts without a GST number,
//   unregistered walk-in customers, or Oracle-created placeholder customers —
//   the data layer stores a SYNTHETIC key so the unique constraint is
//   satisfied:
//
//     • `ZOHO-CONTACT-{contactId}`  ← Zoho Books imports (mapper.ts)
//     • `LOCAL-{timestamp}`         ← Walk-in/unregistered customers (services/customers.ts)
//     • `LOCAL-{timestamp}-{slug}`  ← Retry-on-collision variant
//
//   These are LEGITIMATE database identifiers but should NEVER be shown to the
//   end user — they look like internal IDs/UUIDs and confuse non-technical
//   users. The user explicitly complained about seeing:
//     `ZOHO-CONTACT-397665...`, `LOCAL-178...`, `BX64KOOZ`, `undefined 11`
//
//   This module sanitizes those values at the DISPLAY LAYER ONLY — the
//   underlying database rows are untouched, APIs are unchanged, and data
//   fetching is unchanged. We only transform what the user SEES.
//
// USAGE
//   import { displayGSTIN, displayText, displayNumber, displayOwner } from '@/lib/clients/display-utils';
//
//   <span>{displayGSTIN(client.gstin)}</span>           // → "— " for synthetic, real GSTIN otherwise
//   <span>{displayText(client.state)}</span>             // → "— " for null/undefined/empty
//   <span>{displayNumber(client.healthScore)}</span>     // → "— " for null/undefined
//   <span>{displayOwner(client)}</span>                  // → email | phone | "— "
// ═══════════════════════════════════════════════════════════════════════════════

import { validateGSTIN } from '@/lib/gst-utils';

/**
 * Prefixes the data layer uses for synthetic GSTIN keys. Any value starting
 * with one of these (case-insensitive) is an internal ID, NOT a real GSTIN.
 */
const SYNTHETIC_ID_PREFIXES = [
  'LOCAL-',
  'ZOHO-CONTACT-',
  'ZOHO-VENDOR-',
  'TEMP-',
  'GUEST-',
  'WALKIN-',
  'UNREGISTERED-',
  'SYNTHETIC-',
] as const;

/**
 * Standard UUID v1-v5 pattern: 8-4-4-4-12 hex digits.
 * Used by Prisma @db.Uuid columns and Firestore doc IDs in some places.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prisma CUID pattern: `c` + 23+ base36 chars. Default id type for most models.
 */
const CUID_REGEX = /^c[a-z0-9]{20,}$/i;

/**
 * Returns `true` if the value looks like an internal ID rather than a
 * business-meaningful string. Detects:
 *   • Synthetic GSTIN prefixes (LOCAL-*, ZOHO-CONTACT-*, etc.)
 *   • Standard UUIDs
 *   • Prisma CUIDs (c + 20+ alphanumeric)
 *   • Pure 16+ char hex strings (MongoDB ObjectIds, hex IDs)
 *
 * Note: this is intentionally CONSERVATIVE — it does NOT flag short alphanumeric
 * slugs (8-15 chars) because those can be legitimate business identifiers
 * (invoice numbers like "BX64KOOZ", GSTINs, etc.). The GSTIN format check in
 * `displayGSTIN` handles the GSTIN case specifically.
 */
export function isSyntheticOrInternalId(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  const upper = v.toUpperCase();

  // Synthetic prefix check
  if (SYNTHETIC_ID_PREFIXES.some((p) => upper.startsWith(p))) return true;

  // Pure-numeric or pure-hex strings of 16+ chars look like DB IDs
  if (/^[0-9a-f]{16,}$/i.test(v)) return true;

  // Standard UUID
  if (UUID_REGEX.test(v)) return true;

  // Prisma CUID
  if (CUID_REGEX.test(v)) return true;

  return false;
}

/**
 * Sanitize a GSTIN for DISPLAY. Returns the formatted GSTIN if it's real,
 * otherwise returns the placeholder (default `—`).
 *
 * A GSTIN is considered "real" if it:
 *   1. Is a non-empty string
 *   2. Does NOT start with a synthetic prefix (LOCAL-, ZOHO-CONTACT-, etc.)
 *   3. Passes the standard 15-char GSTIN format check
 *
 * Anything else (synthetic IDs, UUIDs stored as GSTINs, null, undefined,
 * empty string) renders as the placeholder.
 *
 * The DATABASE still stores the synthetic value — we only hide it from the UI.
 */
export function displayGSTIN(
  gstin: string | null | undefined,
  placeholder = '—',
): string {
  if (gstin === null || gstin === undefined) return placeholder;
  if (typeof gstin !== 'string') return placeholder;
  const v = gstin.trim().toUpperCase();
  if (!v) return placeholder;
  if (isSyntheticOrInternalId(v)) return placeholder;
  if (!validateGSTIN(v)) return placeholder;
  return v;
}

/**
 * Returns `true` if the GSTIN is real (non-synthetic, valid format).
 * Useful for deciding whether to render the GSTIN column at all.
 */
export function isRealGstin(gstin: string | null | undefined): boolean {
  return displayGSTIN(gstin, '__INVALID__') !== '__INVALID__';
}

/**
 * Sanitize a generic text field for DISPLAY. Returns the trimmed value if
 * it's a non-empty, non-internal-ID string; otherwise returns the placeholder.
 *
 * Use this for: tradeName, legalName, state, contactEmail, contactPhone,
 * entityType, returnPeriod, etc.
 */
export function displayText(
  value: string | null | undefined,
  placeholder = '—',
): string {
  if (value === null || value === undefined) return placeholder;
  if (typeof value !== 'string') return placeholder;
  const v = value.trim();
  if (!v) return placeholder;
  // Reject the literal strings "undefined" / "null" (data-quality guard)
  if (v.toLowerCase() === 'undefined' || v.toLowerCase() === 'null') {
    return placeholder;
  }
  // Reject internal IDs that leaked into a business-name field
  if (isSyntheticOrInternalId(v)) return placeholder;
  return v;
}

/**
 * Sanitize a numeric field for DISPLAY. Returns the number as a string if
 * it's a finite number; otherwise returns the placeholder.
 *
 * Use this for: healthScore, totalReturnsFiled, overdueReturns, invoiceCount,
 * outstanding amount, etc.
 */
export function displayNumber(
  value: number | null | undefined,
  placeholder = '—',
): string {
  if (value === null || value === undefined) return placeholder;
  if (typeof value !== 'number' || !Number.isFinite(value)) return placeholder;
  return String(value);
}

/**
 * Pick the best "Owner" display string for a client. The Client model doesn't
 * have an explicit owner field, so we derive it from contact info in this
 * priority order:
 *   1. contactEmail (most identifying)
 *   2. contactPhone
 *   3. placeholder (default `—`)
 *
 * Each candidate is sanitized via `displayText` so internal IDs never leak.
 */
export function displayOwner(
  client: {
    contactEmail?: string | null;
    contactPhone?: string | null;
  },
  placeholder = '—',
): string {
  const email = displayText(client.contactEmail, '');
  if (email) return email;
  const phone = displayText(client.contactPhone, '');
  if (phone) return phone;
  return placeholder;
}

/**
 * Format an outstanding (receivables) amount for display.
 *
 * The current /api/clients response doesn't include an outstanding amount
 * field — only `_aggregations: { totalInvoices, filedReturns, pendingReturns,
 * matchPercentage }`. Rather than fabricate a number, we return the placeholder
 * until the API is extended.
 *
 * If a real outstanding amount IS provided (future API), it will be formatted
 * as Indian Rupees with no decimal places.
 */
export function displayOutstanding(
  amount: number | null | undefined,
  placeholder = '—',
): string {
  if (amount === null || amount === undefined) return placeholder;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return placeholder;
  if (amount <= 0) return placeholder;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return placeholder;
  }
}
