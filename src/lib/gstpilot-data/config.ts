// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Firestore Data Config
//
// Single source of truth for the Firestore collection paths the
// Customers / Products / Invoices modules write to.
//
// The user has manually created these collections in Firebase Firestore:
//
//   organizations
//      └── GSTpilot_SAAS              ← organization document
//             ├── customers           ← subcollection
//             ├── products            ← subcollection
//             └── invoices            ← subcollection
//
// Firestore is the ONLY source of truth. No mock data, no local JSON,
// no placeholder arrays. Every list reads via onSnapshot(); every write
// goes directly to these paths.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The fixed organization document id the user created in Firestore.
 * All three modules live as subcollections under this document.
 */
export const ORG_ID = 'GSTpilot_SAAS';

/** Root organization document path. */
export const ORG_PATH = `organizations/${ORG_ID}`;

/** Subcollection paths — used by collection(db, ...). */
export const CUSTOMERS_COLLECTION = `${ORG_PATH}/customers`;
export const PRODUCTS_COLLECTION = `${ORG_PATH}/products`;
export const INVOICES_COLLECTION = `${ORG_PATH}/invoices`;
export const VENDORS_COLLECTION = `${ORG_PATH}/vendors`;
export const EXPENSES_COLLECTION = `${ORG_PATH}/expenses`;
export const PAYMENTS_COLLECTION = `${ORG_PATH}/payments`;

/**
 * Counters subcollection — used for atomic sequence generation
 * (invoice numbers, etc.). Lives at `organizations/{orgId}/counters`
 * so each counter is a document with an EVEN number of path segments:
 *
 *   organizations/{orgId}/counters/{counterName}   ← 4 segments ✓
 *
 * IMPORTANT: Never place a counter inside a data subcollection such as
 * `organizations/{orgId}/invoices/_counter/invoiceCounter` — that path
 * has 5 segments (odd) and Firestore rejects it with
 * "Invalid document reference. Document references must have an even
 * number of segments." because `invoices` is a collection and a
 * counter document cannot nest under another collection's document.
 */
export const COUNTERS_COLLECTION = `${ORG_PATH}/counters`;

/** Full document path for the invoice-number counter (4 segments — valid). */
export const INVOICE_COUNTER_DOC = `${COUNTERS_COLLECTION}/invoiceCounter`;

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
