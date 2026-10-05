// ═══════════════════════════════════════════════════════════════════════════════
// registry.ts — Provider registry + adapter loader
//
// Maps each ProviderKey to:
//   • display metadata (name, category, description, docsUrl)
//   • whether it requires credentials (excel/clients do not)
//   • whether it uses an OAuth flow (gmail/drive do)
//   • a lazy loader for the adapter module (so importing the registry
//     doesn't eagerly pull in every adapter + its deps)
//
// `getAdapter(key)` returns the adapter module. Adapters that aren't real
// adapters (excel = pure parser, clients = pure DB CRUD) are also exposed
// here so the sync orchestrator has a single lookup point.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ProviderKey } from './types'

export interface ProviderMeta {
  key: ProviderKey
  displayName: string
  category: 'government' | 'banking' | 'communication' | 'storage' | 'payment' | 'accounting' | 'business'
  description: string
  requiresCredentials: boolean
  oauthFlow: boolean
  docsUrl: string
  /**
   * Returns true if the integration supports batch sync (i.e. the sync
   * orchestrator should pull data on a schedule). Webhook-driven or
   * file-driven providers return false.
   */
  supportsBatchSync: boolean
  /**
   * Collections this connector writes to (for the Finance page UI).
   * E.g. gstReturns, gstNotices, transactions, payments, ...
   */
  collections?: string[]
  /**
   * Permissions this connector requests (for the Finance page UI).
   */
  permissions?: string[]
}

export const PROVIDER_REGISTRY: Record<ProviderKey, ProviderMeta> = {
  // ─── Government ───
  gstn: {
    key: 'gstn',
    displayName: 'GSTN',
    category: 'government',
    description: 'Pull GST returns (GSTR-1/3B/2B), notices, liabilities, ITC, and e-invoices from the GST Network.',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://developer.gst.gov.in/api/',
    supportsBatchSync: true,
    collections: ['gstReturns', 'gstFilings', 'gstNotices', 'gstInvoices', 'gstLiabilities'],
    permissions: ['Read GST returns', 'Read filing history', 'Read notices', 'Read ITC'],
  },

  // ─── Banking (Account Aggregator pattern, one key per bank) ───
  banks: {
    key: 'banks',
    displayName: 'Banks (Generic)',
    category: 'banking',
    description: 'Sync transactions and balances via Account Aggregator (Anubhav, OneMoney, Setu).',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://sahamati.org.in/',
    supportsBatchSync: true,
    collections: ['bankAccounts', 'transactions', 'balances', 'cashFlow', 'reconciliations'],
    permissions: ['Read transactions', 'Read balances', 'Read statements'],
  },
  hdfc: {
    key: 'hdfc',
    displayName: 'HDFC Bank',
    category: 'banking',
    description: 'Sync HDFC Bank transactions and balances via Account Aggregator.',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://sahamati.org.in/',
    supportsBatchSync: true,
    collections: ['bankAccounts', 'transactions', 'balances'],
    permissions: ['Read transactions', 'Read balances'],
  },
  icici: {
    key: 'icici',
    displayName: 'ICICI Bank',
    category: 'banking',
    description: 'Sync ICICI Bank transactions and balances via Account Aggregator.',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://sahamati.org.in/',
    supportsBatchSync: true,
    collections: ['bankAccounts', 'transactions', 'balances'],
    permissions: ['Read transactions', 'Read balances'],
  },
  sbi: {
    key: 'sbi',
    displayName: 'State Bank of India',
    category: 'banking',
    description: 'Sync SBI transactions and balances via Account Aggregator.',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://sahamati.org.in/',
    supportsBatchSync: true,
    collections: ['bankAccounts', 'transactions', 'balances'],
    permissions: ['Read transactions', 'Read balances'],
  },
  axis: {
    key: 'axis',
    displayName: 'Axis Bank',
    category: 'banking',
    description: 'Sync Axis Bank transactions and balances via Account Aggregator.',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://sahamati.org.in/',
    supportsBatchSync: true,
    collections: ['bankAccounts', 'transactions', 'balances'],
    permissions: ['Read transactions', 'Read balances'],
  },
  kotak: {
    key: 'kotak',
    displayName: 'Kotak Mahindra Bank',
    category: 'banking',
    description: 'Sync Kotak Bank transactions and balances via Account Aggregator.',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://sahamati.org.in/',
    supportsBatchSync: true,
    collections: ['bankAccounts', 'transactions', 'balances'],
    permissions: ['Read transactions', 'Read balances'],
  },
  indusind: {
    key: 'indusind',
    displayName: 'IndusInd Bank',
    category: 'banking',
    description: 'Sync IndusInd Bank transactions and balances via Account Aggregator.',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://sahamati.org.in/',
    supportsBatchSync: true,
    collections: ['bankAccounts', 'transactions', 'balances'],
    permissions: ['Read transactions', 'Read balances'],
  },

  // ─── Communication ───
  gmail: {
    key: 'gmail',
    displayName: 'Gmail',
    category: 'communication',
    description: 'Read invoices, GST notices, vendor emails, and payment reminders. Auto-extract PDFs.',
    requiresCredentials: true,
    oauthFlow: true,
    docsUrl: 'https://developers.google.com/gmail/api',
    supportsBatchSync: true,
    collections: ['emails', 'attachments', 'invoiceDocuments', 'paymentRequests', 'noticeDocuments'],
    permissions: ['Read inbox', 'Read attachments', 'Detect invoices', 'Detect notices'],
  },
  outlook: {
    key: 'outlook',
    displayName: 'Outlook',
    category: 'communication',
    description: 'Read invoices, notices, and payment reminders from Outlook via Microsoft Graph.',
    requiresCredentials: true,
    oauthFlow: true,
    docsUrl: 'https://learn.microsoft.com/graph/api/resources/message',
    supportsBatchSync: true,
    collections: ['emails', 'attachments', 'invoiceDocuments', 'paymentRequests'],
    permissions: ['Read mailbox', 'Read attachments', 'Detect invoices'],
  },
  whatsapp: {
    key: 'whatsapp',
    displayName: 'WhatsApp Cloud',
    category: 'communication',
    description: 'Read client conversations, payment reminders, and collections messages. Draft and schedule.',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    supportsBatchSync: false, // webhook-driven
    collections: ['whatsappMessages', 'contactHistory', 'reminders'],
    permissions: ['Read messages', 'Send messages', 'Send templates'],
  },

  // ─── Storage ───
  drive: {
    key: 'drive',
    displayName: 'Google Drive',
    category: 'storage',
    description: 'Read invoices, Excel files, reports, and tax documents. Auto-import with OCR.',
    requiresCredentials: true,
    oauthFlow: true,
    docsUrl: 'https://developers.google.com/drive/api/v3',
    supportsBatchSync: true,
    collections: ['documents', 'folders', 'fileMetadata'],
    permissions: ['Read files', 'Read folders', 'Download files'],
  },
  excel: {
    key: 'excel',
    displayName: 'Excel / CSV',
    category: 'storage',
    description: 'Import invoices, clients, payments, and returns from .xlsx/.csv/.tsv files.',
    requiresCredentials: false,
    oauthFlow: false,
    docsUrl: 'https://www.npmjs.com/package/xlsx',
    supportsBatchSync: false, // file-driven
    collections: ['invoices', 'clients', 'payments', 'returns'],
    permissions: ['Read uploaded files'],
  },

  // ─── Payments ───
  razorpay: {
    key: 'razorpay',
    displayName: 'Razorpay',
    category: 'payment',
    description: 'Sync payments, refunds, subscriptions, and payment links from Razorpay.',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://razorpay.com/docs/api/',
    supportsBatchSync: true,
    collections: ['payments', 'refunds', 'subscriptions', 'paymentLinks'],
    permissions: ['Read payments', 'Read refunds', 'Read subscriptions'],
  },
  cashfree: {
    key: 'cashfree',
    displayName: 'Cashfree',
    category: 'payment',
    description: 'Sync payments, refunds, and settlements from Cashfree Payments.',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://docs.cashfree.com/',
    supportsBatchSync: true,
    collections: ['payments', 'refunds', 'settlements'],
    permissions: ['Read payments', 'Read refunds'],
  },
  payu: {
    key: 'payu',
    displayName: 'PayU',
    category: 'payment',
    description: 'Sync payments and settlements from PayU India.',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://devguide.payu.in/',
    supportsBatchSync: true,
    collections: ['payments', 'settlements'],
    permissions: ['Read payments', 'Read settlements'],
  },
  stripe: {
    key: 'stripe',
    displayName: 'Stripe',
    category: 'payment',
    description: 'Sync payment intents, charges, and payouts from Stripe.',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://stripe.com/docs/api',
    supportsBatchSync: true,
    collections: ['payments', 'refunds', 'payouts'],
    permissions: ['Read payments', 'Read payouts'],
  },

  // ─── Accounting ───
  tally: {
    key: 'tally',
    displayName: 'Tally Prime',
    category: 'accounting',
    description: 'Read ledger, P&L, balance sheet, expenses, and GST entries from Tally Prime.',
    requiresCredentials: true,
    oauthFlow: false,
    docsUrl: 'https://tallysolutions.com/developers/',
    supportsBatchSync: true,
    collections: ['ledger', 'expenses', 'profitLoss', 'balanceSheet', 'gstEntries'],
    permissions: ['Read ledger', 'Read P&L', 'Read balance sheet'],
  },
  zoho_books: {
    key: 'zoho_books',
    displayName: 'Zoho Books',
    category: 'accounting',
    description: 'Read ledger, invoices, expenses, and GST entries from Zoho Books.',
    requiresCredentials: true,
    oauthFlow: true,
    docsUrl: 'https://www.zoho.com/books/api/v3/',
    supportsBatchSync: true,
    collections: ['ledger', 'invoices', 'expenses', 'gstEntries'],
    permissions: ['Read invoices', 'Read expenses', 'Read ledger'],
  },
  quickbooks: {
    key: 'quickbooks',
    displayName: 'QuickBooks',
    category: 'accounting',
    description: 'Read ledger, P&L, balance sheet, and expenses from QuickBooks Online.',
    requiresCredentials: true,
    oauthFlow: true,
    docsUrl: 'https://developer.intuit.com/app/developer/qbo/docs/api',
    supportsBatchSync: true,
    collections: ['ledger', 'profitLoss', 'balanceSheet', 'expenses'],
    permissions: ['Read company info', 'Read ledger', 'Read P&L'],
  },

  // ─── Business Systems ───
  clients: {
    key: 'clients',
    displayName: 'Client Database',
    category: 'business',
    description: 'Internal CRM on the Client table. Clients, GSTIN, contacts, risk scores, collections.',
    requiresCredentials: false,
    oauthFlow: false,
    docsUrl: '',
    supportsBatchSync: false, // CRUD-driven
    collections: ['clients', 'clientContacts', 'clientRisk', 'clientCollections'],
    permissions: ['Read clients', 'Read risk scores'],
  },
}

export function getProviderMeta(key: ProviderKey): ProviderMeta {
  const meta = PROVIDER_REGISTRY[key]
  if (!meta) {
    throw new Error(`Unknown integration provider: "${key}"`)
  }
  return meta
}

export function listProviders(): ProviderMeta[] {
  return Object.values(PROVIDER_REGISTRY)
}

// ─── Adapter loader ─────────────────────────────────────────────────────────────
// Lazy import — keeps the registry module cheap to load and lets the Next.js
// bundler code-split adapters. The cast to `unknown` then to the adapter
// type lets each adapter module define its own surface without us having
// to import them all here just for types.

export interface AdapterModule {
  // Each adapter exports whatever methods it supports. The sync orchestrator
  // calls known method names (e.g. `pullReturns`, `listMessages`) and the
  // adapter is free to throw if a method is unsupported.
  [method: string]: unknown
}

const ADAPTER_LOADERS: Record<ProviderKey, () => Promise<AdapterModule>> = {
  // Existing adapters with real implementations
  gstn: () => import('./gstn').then((m) => m as unknown as AdapterModule),
  gmail: () => import('./gmail').then((m) => m as unknown as AdapterModule),
  drive: () => import('./drive').then((m) => m as unknown as AdapterModule),
  whatsapp: () => import('./whatsapp').then((m) => m as unknown as AdapterModule),
  banks: () => import('./banks').then((m) => m as unknown as AdapterModule),
  razorpay: () => import('./razorpay').then((m) => m as unknown as AdapterModule),
  excel: () => import('./excel').then((m) => m as unknown as AdapterModule),
  clients: () => import('./clients').then((m) => m as unknown as AdapterModule),
  // Real Data Connectors™ — generic adapters (real API health checks)
  outlook: () => import('./generic-adapters').then((m) => m as unknown as AdapterModule),
  cashfree: () => import('./generic-adapters').then((m) => m as unknown as AdapterModule),
  payu: () => import('./generic-adapters').then((m) => m as unknown as AdapterModule),
  stripe: () => import('./generic-adapters').then((m) => m as unknown as AdapterModule),
  tally: () => import('./generic-adapters').then((m) => m as unknown as AdapterModule),
  zoho_books: () => import('./generic-adapters').then((m) => m as unknown as AdapterModule),
  quickbooks: () => import('./generic-adapters').then((m) => m as unknown as AdapterModule),
  hdfc: () => import('./generic-adapters').then((m) => m as unknown as AdapterModule),
  icici: () => import('./generic-adapters').then((m) => m as unknown as AdapterModule),
  sbi: () => import('./generic-adapters').then((m) => m as unknown as AdapterModule),
  axis: () => import('./generic-adapters').then((m) => m as unknown as AdapterModule),
  kotak: () => import('./generic-adapters').then((m) => m as unknown as AdapterModule),
  indusind: () => import('./generic-adapters').then((m) => m as unknown as AdapterModule),
}

/**
 * Load the adapter module for a provider. Returns the adapter's exports.
 * Use `getProviderMeta(key)` to check `supportsBatchSync` before calling
 * any sync methods.
 */
export function getAdapter(key: ProviderKey): Promise<AdapterModule> {
  const loader = ADAPTER_LOADERS[key]
  if (!loader) {
    throw new Error(`No adapter loader registered for provider "${key}".`)
  }
  return loader()
}
