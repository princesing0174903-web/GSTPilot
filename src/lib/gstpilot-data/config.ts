// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Firestore Data Config
//
// Single source of truth for the Firestore collection paths the
// Customers / Products / Invoices modules write to.
//
// IMPORTANT — ORG-SCOPED PATHS (MULTI-TENANT):
//   Every Firestore path is now dynamically built from the authenticated
//   user's organizationId. The OLD code hardcode `organizations/GSTpilot_SAAS/...`
//   which caused FirebaseError: Missing or insufficient permissions because
//   the user is NOT a member of the `GSTpilot_SAAS` org — they are a member of
//   their OWN org (e.g. `preview-org` or a real Firestore org id).
//
//   The Firestore security rules require:
//     isOrgMember(orgId)  →  the path's orgId must match an org the user belongs to
//
//   So every read/write MUST use:
//     currentUser → organization membership → organizationId → Firestore path
//
//   The path builders below accept an `organizationId` parameter. Callers
//   (hooks) obtain it from OrgContext and pass it through. If no orgId is
//   provided, the functions return empty results (honest empty state) rather
//   than writing to a hardcoded path.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the Firestore collection path for a given org's subcollection.
 *
 *   organizations/{organizationId}/{subcollection}
 *
 * Example: orgCollectionPath('preview-org', 'customers')
 *       → 'organizations/preview-org/customers'
 *
 * If organizationId is null/empty, returns null (caller should short-circuit
 * to an empty result rather than writing to a fallback path).
 */
export function orgCollectionPath(
  organizationId: string | null | undefined,
  subcollection: string,
): string | null {
  if (!organizationId || !organizationId.trim()) return null;
  return `organizations/${organizationId}/${subcollection}`;
}

/**
 * Build the Firestore document path for a specific doc in an org subcollection.
 *
 *   organizations/{organizationId}/{subcollection}/{docId}
 */
export function orgDocPath(
  organizationId: string | null | undefined,
  subcollection: string,
  docId: string,
): string | null {
  const base = orgCollectionPath(organizationId, subcollection);
  if (!base) return null;
  return `${base}/${docId}`;
}

// ─── Subcollection names (single source of truth) ────────────────────────────

export const CUSTOMERS_SUB = 'customers';
export const PRODUCTS_SUB = 'products';
export const INVOICES_SUB = 'invoices';
export const VENDORS_SUB = 'vendors';
export const EXPENSES_SUB = 'expenses';
export const PAYMENTS_SUB = 'payments';
export const COUNTERS_SUB = 'counters';
export const ACTIVITIES_SUB = 'activities';

/**
 * DEPRECATED — kept only for backward compatibility with any caller that
 * hasn't been migrated yet. Returns the literal 'GSTpilot_SAAS' string.
 * New code MUST use orgCollectionPath(realOrgId, ...) instead.
 *
 * @deprecated Use orgCollectionPath(organizationId, subcollection) instead.
 */
export const ORG_ID = 'GSTpilot_SAAS';

/**
 * DEPRECATED — same as above. New code should call:
 *   orgCollectionPath(orgId, CUSTOMERS_SUB)
 *
 * @deprecated Use orgCollectionPath(organizationId, CUSTOMERS_SUB) instead.
 */
export const ORG_PATH = `organizations/${ORG_ID}`;

/**
 * DEPRECATED — hardcoded collection paths. New code should use the dynamic
 * path builders with the real organizationId.
 *
 * @deprecated Use orgCollectionPath(orgId, ...) instead.
 */
export const CUSTOMERS_COLLECTION = `${ORG_PATH}/customers`;
export const PRODUCTS_COLLECTION = `${ORG_PATH}/products`;
export const INVOICES_COLLECTION = `${ORG_PATH}/invoices`;
export const VENDORS_COLLECTION = `${ORG_PATH}/vendors`;
export const EXPENSES_COLLECTION = `${ORG_PATH}/expenses`;
export const PAYMENTS_COLLECTION = `${ORG_PATH}/payments`;
export const COUNTERS_COLLECTION = `${ORG_PATH}/counters`;
export const INVOICE_COUNTER_DOC = `${ORG_PATH}/counters/invoiceCounter`;

/** Standard GST rates (%) supported by the invoice line items. */
export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28] as const;
export type GstRate = (typeof GST_RATES)[number];

/** Default GST rate applied to new line items. */
export const DEFAULT_GST_RATE: GstRate = 18;

/** Indian states + GST state codes (for intra/inter-state tax logic). */
export const STATE_CODES: Record<string, string> = {
  'Andaman & Nicobar Islands': '35',
  'Andhra Pradesh': '37',
  'Arunachal Pradesh': '12',
  Assam: '18',
  Bihar: '10',
  Chandigarh: '04',
  Chhattisgarh: '22',
  'Dadra & Nagar Haveli and Daman & Diu': '26',
  Delhi: '07',
  Goa: '30',
  Gujarat: '24',
  Haryana: '06',
  'Himachal Pradesh': '02',
  'Jammu & Kashmir': '01',
  Jharkhand: '20',
  Karnataka: '29',
  Kerala: '32',
  Ladakh: '38',
  Lakshadweep: '31',
  'Madhya Pradesh': '23',
  Maharashtra: '27',
  Manipur: '14',
  Meghalaya: '17',
  Mizoram: '15',
  Nagaland: '13',
  Odisha: '21',
  Puducherry: '34',
  Punjab: '03',
  Rajasthan: '08',
  Sikkim: '11',
  'Tamil Nadu': '33',
  Telangana: '36',
  Tripura: '16',
  'Uttar Pradesh': '09',
  Uttarakhand: '05',
  'West Bengal': '19',
};

/** Reverse lookup: state code → state name. */
export const CODE_TO_STATE: Record<string, string> = Object.entries(
  STATE_CODES,
).reduce(
  (acc, [name, code]) => {
    acc[code] = name;
    return acc;
  },
  {} as Record<string, string>,
);
