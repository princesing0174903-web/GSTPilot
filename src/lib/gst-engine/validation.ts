// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot GST Return Engine™ — Validation Engine
//
// Pure validation functions for GST data. NO Firebase imports, NO client-only
// code. Safe to import from both client and server.
//
// Every function returns a ValidationResult with `valid`, `errors[]`, and
// `warnings[]`.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ValidationResult, GSTTransaction } from './types';
import type { Invoice } from '@/lib/invoice-engine/types';

// ─── Valid State Codes (01–38) ───────────────────────────────────────────────

const VALID_STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38',
]);

// ─── Valid GST Rates ─────────────────────────────────────────────────────────

const VALID_GST_RATES = new Set([0, 0.25, 3, 5, 12, 18, 28]);

// ─── GSTIN Validation ────────────────────────────────────────────────────────

/**
 * Validate a GSTIN.
 * Format: 2 digits (state) + 5 letters (PAN) + 4 digits + 1 letter
 *         + 1 alphanumeric + 'Z' + 1 alphanumeric (check digit)
 *
 * Total: 15 characters.
 */
export function validateGSTIN(gstin: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!gstin) {
    errors.push('GSTIN is required.');
    return { valid: false, errors, warnings };
  }

  const trimmed = gstin.trim().toUpperCase();

  if (trimmed.length !== 15) {
    errors.push(`GSTIN must be 15 characters (got ${trimmed.length}).`);
    return { valid: false, errors, warnings };
  }

  // State code (first 2 digits)
  const stateCode = trimmed.slice(0, 2);
  if (!VALID_STATE_CODES.has(stateCode)) {
    errors.push(`Invalid state code "${stateCode}" in GSTIN (must be 01–38).`);
  }

  // PAN (next 10 chars: 5 letters + 4 digits + 1 letter)
  const pan = trimmed.slice(2, 12);
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    errors.push('Invalid PAN segment in GSTIN (expected 5 letters + 4 digits + 1 letter).');
  }

  // Entity type (char 13: alphanumeric)
  const entityType = trimmed[12];
  if (!/^[A-Z0-9]$/.test(entityType)) {
    errors.push('Invalid entity type character (position 13 must be alphanumeric).');
  }

  // 'Z' (char 14)
  if (trimmed[13] !== 'Z') {
    errors.push('Character 14 must be "Z" (reserved for regular taxpayers).');
  }

  // Check digit (char 15: alphanumeric)
  if (!/^[0-9A-Z]$/.test(trimmed[14])) {
    errors.push('Check digit (position 15) must be alphanumeric.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── HSN/SAC Validation ────────────────────────────────────────────────────────

/**
 * Validate an HSN/SAC code.
 * Must be 2, 4, 6, or 8 digits. The required length depends on turnover:
 *   • < ₹1.5 crore  → 2-digit minimum
 *   • < ₹5 crore    → 4-digit minimum
 *   • ≥ ₹5 crore    → 6-digit minimum
 */
export function validateHSN(hsn: string, turnoverCrore = 0): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!hsn) {
    warnings.push('HSN/SAC code is empty — required for GSTR-1 filing.');
    return { valid: true, errors, warnings };
  }

  const trimmed = hsn.trim();

  if (!/^\d{2,8}$/.test(trimmed)) {
    errors.push('HSN/SAC must be 2–8 digits (numeric only).');
    return { valid: false, errors, warnings };
  }

  if (trimmed.length !== 2 && trimmed.length !== 4 && trimmed.length !== 6 && trimmed.length !== 8) {
    errors.push(`HSN/SAC must be 2, 4, 6, or 8 digits (got ${trimmed.length}).`);
  }

  // Turnover-based minimum length
  const minLength = turnoverCrore >= 5 ? 6 : turnoverCrore >= 1.5 ? 4 : 2;
  if (trimmed.length < minLength) {
    warnings.push(
      `HSN/SAC should be at least ${minLength} digits for your turnover slab (₹${turnoverCrore}cr).`,
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── GST Rate Validation ─────────────────────────────────────────────────────

/**
 * Validate a GST rate. Valid slabs: 0, 0.25, 3, 5, 12, 18, 28.
 */
export function validateGSTRate(rate: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof rate !== 'number' || isNaN(rate)) {
    errors.push('GST rate must be a number.');
    return { valid: false, errors, warnings };
  }

  if (rate < 0 || rate > 28) {
    errors.push(`GST rate ${rate}% is out of range (0–28%).`);
  }

  if (!VALID_GST_RATES.has(rate)) {
    warnings.push(
      `GST rate ${rate}% is not a standard slab. Valid slabs: 0, 0.25, 3, 5, 12, 18, 28.`,
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── State Code Validation ───────────────────────────────────────────────────

/**
 * Validate an Indian state code (01–38).
 */
export function validateStateCode(code: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!code) {
    errors.push('State code is required.');
    return { valid: false, errors, warnings };
  }

  if (!/^\d{2}$/.test(code)) {
    errors.push('State code must be exactly 2 digits.');
    return { valid: false, errors, warnings };
  }

  if (!VALID_STATE_CODES.has(code)) {
    errors.push(`Invalid state code "${code}" (must be 01–38).`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Invoice Date Validation ─────────────────────────────────────────────────

/**
 * Validate an invoice date.
 *   • Must be valid YYYY-MM-DD format
 *   • Must not be in the future
 *   • Warning if more than 1 year in the past
 */
export function validateInvoiceDate(dateStr: string, today?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!dateStr) {
    errors.push('Invoice date is required.');
    return { valid: false, errors, warnings };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    errors.push('Invoice date must be in YYYY-MM-DD format.');
    return { valid: false, errors, warnings };
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    errors.push('Invoice date is not a valid date.');
    return { valid: false, errors, warnings };
  }

  const now = today ? new Date(today) : new Date();
  if (d > now) {
    errors.push('Invoice date cannot be in the future.');
  }

  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  if (d < oneYearAgo) {
    warnings.push('Invoice date is more than 1 year old — verify this is correct.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Duplicate Invoice Validation ────────────────────────────────────────────

/**
 * Check for duplicate invoice numbers (same seller GSTIN + invoice number).
 */
export function validateDuplicateInvoice(
  transactions: GSTTransaction[],
  newInvoiceNumber: string,
  sellerGstin: string,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!newInvoiceNumber) {
    warnings.push('Invoice number is empty.');
    return { valid: true, errors, warnings };
  }

  const duplicate = transactions.find(
    (t) =>
      t.sellerGstin === sellerGstin &&
      t.invoiceNumber === newInvoiceNumber,
  );

  if (duplicate) {
    errors.push(
      `Duplicate invoice number "${newInvoiceNumber}" already exists for GSTIN ${sellerGstin}.`,
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Customer Validation ─────────────────────────────────────────────────────

/**
 * Validate customer data for a GST transaction.
 */
export function validateCustomer(customer: {
  name: string;
  gstin: string | null;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!customer.name || customer.name.trim().length < 3) {
    errors.push('Customer name must be at least 3 characters.');
  }

  if (customer.gstin) {
    const gstinResult = validateGSTIN(customer.gstin);
    if (!gstinResult.valid) {
      errors.push(...gstinResult.errors);
    }
  } else {
    warnings.push('No customer GSTIN provided — this will be classified as B2C.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Full Invoice Validation ─────────────────────────────────────────────────

/**
 * Validate an invoice for GST compliance. Runs all validators.
 */
export function validateInvoiceForGST(
  invoice: Invoice,
  existingTransactions: GSTTransaction[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Seller GSTIN
  if (invoice.sellerGstin) {
    const sellerResult = validateGSTIN(invoice.sellerGstin);
    if (!sellerResult.valid) {
      errors.push(...sellerResult.errors.map((e) => `Seller: ${e}`));
    }
  } else {
    errors.push('Seller GSTIN is required for GST filing.');
  }

  // Customer GSTIN (optional but recommended for B2B)
  if (invoice.customerGstin) {
    const customerResult = validateGSTIN(invoice.customerGstin);
    if (!customerResult.valid) {
      errors.push(...customerResult.errors.map((e) => `Customer: ${e}`));
    }
  }

  // State codes
  if (invoice.sellerStateCode) {
    const sellerStateResult = validateStateCode(invoice.sellerStateCode);
    if (!sellerStateResult.valid) {
      errors.push(...sellerStateResult.errors.map((e) => `Seller state: ${e}`));
    }
  }
  if (invoice.customerStateCode) {
    const customerStateResult = validateStateCode(invoice.customerStateCode);
    if (!customerStateResult.valid) {
      errors.push(...customerStateResult.errors.map((e) => `Customer state: ${e}`));
    }
  }

  // Invoice date
  const dateResult = validateInvoiceDate(invoice.invoiceDate);
  if (!dateResult.valid) {
    errors.push(...dateResult.errors);
  }
  warnings.push(...dateResult.warnings);

  // Line items — GST rate + HSN
  for (const item of invoice.items) {
    const rateResult = validateGSTRate(item.gstRate);
    if (!rateResult.valid) {
      errors.push(`Line "${item.description}": ${rateResult.errors.join(' ')}`);
    }
    warnings.push(...rateResult.warnings.map((w) => `Line "${item.description}": ${w}`));

    const hsnResult = validateHSN(item.hsnSac);
    if (hsnResult.warnings.length > 0) {
      warnings.push(...hsnResult.warnings.map((w) => `Line "${item.description}": ${w}`));
    }
  }

  // Duplicate invoice number
  const dupResult = validateDuplicateInvoice(
    existingTransactions,
    invoice.invoiceNumber,
    invoice.sellerGstin,
  );
  if (!dupResult.valid) {
    errors.push(...dupResult.errors);
  }

  return { valid: errors.length === 0, errors, warnings };
}
