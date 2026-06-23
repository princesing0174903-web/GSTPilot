// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Data Engine™ — Connector Type System
// Shared types for all data connectors (GSTN, Bank, Gmail, WhatsApp, Accounting)
// ═══════════════════════════════════════════════════════════════════════════════

export type ConnectorType =
  | 'gstn'
  | 'bank'
  | 'gmail'
  | 'whatsapp'
  | 'tally'
  | 'zoho'
  | 'quickbooks';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

export type SyncInterval = '15m' | '1h' | '6h' | 'daily';

export type SourceType =
  | 'gst_profile'
  | 'gst_return'
  | 'gst_filing_status'
  | 'gst_notice'
  | 'bank_tx'
  | 'bank_balance'
  | 'email'
  | 'whatsapp_msg'
  | 'accounting_invoice'
  | 'accounting_ledger'
  | 'accounting_client'
  | 'accounting_vendor';

/** A user-scoped data connection stored in the database. */
export interface Connection {
  id: string;
  userId: string;
  type: ConnectorType;
  status: ConnectionStatus;
  label: string;
  identifier: string | null;
  metadata: ConnectionMetadata;
  lastSyncAt: Date | null;
  syncInterval: SyncInterval;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Type-safe metadata accessor — each connector stores its own shape here. */
export interface ConnectionMetadata {
  [key: string]: unknown;
}

/** GSTN connection metadata. */
export interface GstnMetadata extends ConnectionMetadata {
  gstin: string;
  tradeName?: string;
  legalName?: string;
  businessType?: string;
  registrationStatus?: string;
  stateCode?: string;
  state?: string;
  centre?: string;
  registrationDate?: string;
  constitution?: string;
  taxPayerType?: string;
}

/** Bank connection metadata. */
export interface BankMetadata extends ConnectionMetadata {
  bankName: string;
  bankCode: string;
  accountNumberMasked: string;
  accountType?: string;
  ifsc?: string;
  currentBalance?: number;
  availableBalance?: number;
}

/** Gmail connection metadata. */
export interface GmailMetadata extends ConnectionMetadata {
  email: string;
  scopes: string[];
  messageCount?: number;
  lastMessageDate?: string;
}

/** WhatsApp connection metadata. */
export interface WhatsAppMetadata extends ConnectionMetadata {
  phoneNumber: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  displayName?: string;
}

/** Accounting software connection metadata. */
export interface AccountingMetadata extends ConnectionMetadata {
  software: 'tally' | 'zoho' | 'quickbooks';
  companyName?: string;
  companyGstin?: string;
  financialYear?: string;
  syncedEntities?: string[];
}

/** A synced raw record from a connector. */
export interface SyncedRecord {
  id: string;
  connectionId: string;
  userId: string;
  sourceType: SourceType;
  externalId: string | null;
  title: string | null;
  amount: number | null;
  date: string | null;
  rawData: Record<string, unknown> | null;
  category: string | null;
  processed: boolean;
  createdAt: Date;
}

/** Result of a sync operation. */
export interface SyncResult {
  success: boolean;
  connectionId: string;
  recordsSynced: number;
  errors: string[];
  summary: string;
}

/** Connector definition — describes a connector type for the UI. */
export interface ConnectorDefinition {
  type: ConnectorType;
  name: string;
  description: string;
  icon: string;
  category: 'government' | 'banking' | 'communication' | 'accounting';
  connectLabel: string;
  capabilities: string[];
}

/** All supported connectors — used by the Connections UI. */
export const CONNECTOR_DEFINITIONS: ConnectorDefinition[] = [
  {
    type: 'gstn',
    name: 'GSTN / GST Portal',
    description: 'GST Profile, GSTIN details, GSTR-1/3B/2B, ITC, filing status, notices, compliance history',
    icon: 'FileText',
    category: 'government',
    connectLabel: 'Connect GSTIN',
    capabilities: ['GST Profile', 'GSTR-1', 'GSTR-3B', 'GSTR-2B', 'ITC Data', 'Filing Status', 'GST Notices', 'Compliance History'],
  },
  {
    type: 'bank',
    name: 'Bank Account',
    description: 'HDFC, ICICI, SBI, Axis, Kotak, Yes Bank — balance, transactions, credits, debits, collections',
    icon: 'Landmark',
    category: 'banking',
    connectLabel: 'Connect Bank',
    capabilities: ['Balance', 'Transactions', 'Credits', 'Debits', 'Collections', 'Cash Position'],
  },
  {
    type: 'gmail',
    name: 'Gmail',
    description: 'Read GST notices, vendor invoices, client invoices, tax communications automatically',
    icon: 'Mail',
    category: 'communication',
    connectLabel: 'Connect Gmail',
    capabilities: ['GST Notices', 'Vendor Invoices', 'Client Invoices', 'Tax Communications'],
  },
  {
    type: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Track client communication, collections follow-ups, reminder messages',
    icon: 'MessageCircle',
    category: 'communication',
    connectLabel: 'Connect WhatsApp',
    capabilities: ['Client Communication', 'Collections Follow-ups', 'Reminder Messages'],
  },
  {
    type: 'tally',
    name: 'Tally Prime',
    description: 'Sync sales, purchases, expenses, ledger, clients, vendors from Tally',
    icon: 'Calculator',
    category: 'accounting',
    connectLabel: 'Connect Tally',
    capabilities: ['Sales', 'Purchases', 'Expenses', 'Ledger', 'Clients', 'Vendors'],
  },
  {
    type: 'zoho',
    name: 'Zoho Books',
    description: 'Sync sales, purchases, expenses, ledger, clients, vendors from Zoho Books',
    icon: 'BookOpen',
    category: 'accounting',
    connectLabel: 'Connect Zoho Books',
    capabilities: ['Sales', 'Purchases', 'Expenses', 'Ledger', 'Clients', 'Vendors'],
  },
  {
    type: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync sales, purchases, expenses, ledger, clients, vendors from QuickBooks',
    icon: 'Wallet',
    category: 'accounting',
    connectLabel: 'Connect QuickBooks',
    capabilities: ['Sales', 'Purchases', 'Expenses', 'Ledger', 'Clients', 'Vendors'],
  },
];

/** Supported banks for the Bank connector UI. */
export const SUPPORTED_BANKS = [
  { code: 'hdfc', name: 'HDFC Bank', color: '#004C8F' },
  { code: 'icici', name: 'ICICI Bank', color: '#AE1C28' },
  { code: 'sbi', name: 'State Bank of India', color: '#1E3A8A' },
  { code: 'axis', name: 'Axis Bank', color: '#97144D' },
  { code: 'kotak', name: 'Kotak Mahindra Bank', color: '#ED1C24' },
  { code: 'yes', name: 'Yes Bank', color: '#00A0DF' },
] as const;
