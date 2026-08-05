// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Invoice Builder · Shared Types
//
// Single source of truth for all types used by the rebuilt InvoiceBuilder.
// Kept 1:1 compatible with the original InvoiceBuilder.tsx prop interface so
// InvoiceWorkspacePage.tsx never needs editing.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ApiInvoice } from '@/hooks/useInvoicesApi';
import type { ApiClient } from '@/hooks/useClientsApi';

/** A single line item in the builder. Money/math fields are recomputed. */
export interface LineItem {
  /** React key (unique, stable for the lifetime of the row). */
  key: string;
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string; // NOS, PCS, KG, MTR, BOX, LOT
  unitPrice: number;
  discountPct: number;
  gstRate: number; // 0, 5, 12, 18, 28
  cessRate: number; // 0 by default
  // Computed (per-line):
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
}

/** Slim shape of the organization block passed by InvoiceWorkspacePage. */
export interface InvoiceBuilderOrganization {
  name: string;
  gstin: string;
  stateCode?: string;
}

/** Shape of each item in the submit payload — matches CreateInvoicePayload. */
export interface InvoiceBuilderItemPayload {
  description: string;
  hsnCode?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPct?: number;
  gstRate: number;
  cessRate?: number;
}

/** Full submit payload — the parent's onSubmit receives this. */
export interface InvoiceBuilderSubmitPayload {
  clientId?: string;
  customerName: string;
  buyerGstin?: string;
  sellerGstin?: string;
  date?: string;
  dueDate?: string;
  invoiceNumber?: string;
  invoiceType?: string;
  items: InvoiceBuilderItemPayload[];
  notes?: string;
  notesFinance?: string;
  terms?: string;
  bankDetails?: string;
  reverseCharge?: boolean;
  placeOfSupply?: string;
  status?: 'draft' | 'sent';
}

/** Public props. UNCHANGED from the original InvoiceBuilder — keep this 1:1. */
export interface InvoiceBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ApiClient[];
  initialInvoice?: ApiInvoice | null;
  organization?: InvoiceBuilderOrganization | null;
  onSubmit: (payload: InvoiceBuilderSubmitPayload) => void | Promise<void>;
  saving?: boolean;
  onCreateClient?: () => void;
}

/** Re-export so callers can grab the type from a single import path. */
export type { ApiInvoice, ApiClient };
