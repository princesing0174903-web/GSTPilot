// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Firestore Schema Types & Collection Definitions
// All 10 collections with relationships and workflow state machines
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  InvoiceType, GSTR1Section, MatchStatus, WorkflowStatus,
  ReconSourceType, AIRecommendationType, RiskLevel, IssueSeverity,
  FilingStatus, InvoiceStatus, ClientStatus, EventType,
} from '@/types/gst';

// ─── Firestore Collection Names ──────────────────────────────────────────────

export const COLLECTIONS = {
  USERS: 'users',
  FIRMS: 'firms',
  CLIENTS: 'clients',
  DOCUMENTS: 'documents',
  INVOICES: 'invoices',
  RETURNS: 'returns',
  RECONCILIATIONS: 'reconciliations',
  NOTIFICATIONS: 'notifications',
  ACTIVITIES: 'activities',
  AI_RECOMMENDATIONS: 'aiRecommendations',
  // AI Executive Layer
  PREDICTIONS: 'predictions',
  PRIORITY_QUEUE: 'priorityQueue',
  ORGANIZATIONS: 'organizations',
  MEMBERSHIPS: 'memberships',
  // The canonical multi-tenant membership collection. Join docs live at
  // `organization_members/{orgId}_{uid}` and carry role + status per user.
  // `memberships` above is the vestigial alias kept only for legacy callers.
  ORGANIZATION_MEMBERS: 'organization_members',
  // CRM & Productivity (recovered)
  LEADS: 'leads',
  DEALS: 'deals',
  MEETINGS: 'meetings',
  TASKS: 'tasks',
  // Banking, GST, Finance & AI Memory (PT-3-5)
  BANK_ACCOUNTS: 'bank_accounts',
  BANK_TRANSACTIONS: 'bank_transactions',
  GST_PROFILES: 'gst_profiles',
  GST_RETURNS: 'gst_returns',
  EXPENSES: 'expenses',
  PAYMENTS: 'payments',
  AI_MEMORY: 'ai_memory',
  // Phase 1 — Notices & Reports (regulatory notices + generated business reports)
  NOTICES: 'notices',
  REPORTS: 'reports',
  // Manual journal entries (adjusting entries, depreciation, accruals, etc.)
  JOURNAL_ENTRIES: 'journal_entries',
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

// ─── User (top-level: users/{uid}) ──────────────────────────────────────────

export interface FirestoreUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  provider: 'google' | 'email';
  role: 'admin' | 'manager' | 'staff' | 'viewer';
  firmId: string | null;
  organizationId: string;  firmName: string | null;
  phone: string | null;
  onboardingCompleted: boolean;
  emailVerified: boolean;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: unknown; // serverTimestamp
  updatedAt: unknown;
}

// ─── Firm (top-level: firms/{firmId}) ───────────────────────────────────────

export interface FirestoreFirm {
  firmId: string;
  organizationId: string;  ownerId: string;
  firmName: string;
  gstin: string | null;
  state: string | null;
  stateCode: string | null;
  organizationType: string | null;
  icaiMembershipNo: string | null;
  officeAddress: string | null;
  activeClientCount: number;
  totalReturnCount: number;
  filedReturnCount: number;
  totalTaxVolume: number;
  complianceScore: number;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Client (top-level: clients/{clientId}) ─────────────────────────────────

export interface FirestoreClient {
  clientId: string;
  firmId: string;
  organizationId: string;  gstin: string;
  tradeName: string;
  legalName: string;
  address: string | null;
  state: string | null;
  stateCode: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  entityType: string;
  returnPeriod: string | null;
  lastFilingDate: string | null;
  status: ClientStatus;
  healthScore: number;
  // Compliance profile (auto-generated)
  complianceProfile: {
    filingCompliance: number;    // 0-100
    gstinValidity: boolean;
    lastFilingStatus: string | null;
    overdueReturns: number;
    totalReturnsFiled: number;
    averageFilingDelay: number;  // days
  };
  // Counters
  invoiceCount: number;
  totalTaxPaid: number;
  pendingReturnCount: number;
  documentCount: number;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Document (top-level: documents/{docId}) ────────────────────────────────

export type DocumentStatus = 'uploading' | 'processing' | 'extracted' | 'reviewed' | 'archived' | 'failed';
export type DocumentType = 'purchase_register' | 'sales_register' | 'gstr1' | 'gstr2b' | 'gstr3b' | 'invoice' | 'other';

export interface FirestoreDocument {
  docId: string;
  firmId: string;
  organizationId: string;  clientId: string;
  uploadedBy: string;
  fileName: string;
  filePath: string | null;     // Firebase Storage path
  fileSize: number;
  fileType: string;            // mime type
  documentType: DocumentType;
  status: DocumentStatus;
  extractionStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  extractedInvoiceCount: number;
  extractionAccuracy: number;  // 0-100
  extractionError: string | null;
  period: string | null;       // MM-YYYY
  metadata: Record<string, string>;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Invoice (top-level: invoices/{invoiceId}) ──────────────────────────────

export interface FirestoreInvoice {
  invoiceId: string;
  firmId: string;
  organizationId: string;  clientId: string;
  documentId: string | null;   // source document
  invoiceNumber: string;
  invoiceDate: string;
  sellerGstin: string;
  buyerGstin: string | null;
  buyerName: string | null;
  invoiceType: InvoiceType;
  gstr1Section: GSTR1Section;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  hsnCode: string | null;
  reverseCharge: boolean;
  placeOfSupply: string | null;
  status: InvoiceStatus;
  matchStatus: MatchStatus;
  riskLevel: RiskLevel;
  riskScore: number;           // 0-100
  aiExplanation: string | null;
  notes: string | null;
  period: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Return (top-level: returns/{returnId}) ─────────────────────────────────

export interface FirestoreReturn {
  returnId: string;
  firmId: string;
  organizationId: string;  clientId: string;
  returnType: 'GSTR-1' | 'GSTR-3B';
  period: string;              // MM-YYYY
  financialYear: string;
  status: FilingStatus;
  filedDate: string | null;
  acknowledgmentNumber: string | null;
  // Aggregate metrics
  totalInvoices: number;
  readyForFiling: number;
  issuesFound: number;
  criticalErrors: number;
  warnings: number;
  totalTaxableValue: number;
  totalTax: number;
  jsonPayload: string | null;  // Generated JSON for filing
  // Workflow
  assignedTo: string | null;
  reviewedBy: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Reconciliation (top-level: reconciliations/{reconId}) ──────────────────

export type ReconStatus = 'running' | 'completed' | 'failed';

export interface FirestoreReconciliation {
  reconId: string;
  firmId: string;
  organizationId: string;  clientId: string;
  period: string;
  sources: string;             // e.g., "GSTR-2B vs Purchase Register"
  status: ReconStatus;
  // Match stats
  totalRecords: number;
  matched: number;
  unmatched: number;
  partialMatches: number;
  highRisk: number;
  gstDifference: number;       // ITC difference amount
  // Mismatch details
  mismatches: ReconMismatch[];
  runBy: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ReconMismatch {
  invoiceNumber: string;
  invoiceDate: string;
  sourceGstin: string;
  matchedGstin: string | null;
  matchStatus: MatchStatus;
  matchScore: number;
  booksAmount: number;
  portalAmount: number;
  difference: number;
  reason: string;
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

// ─── Notification (top-level: notifications/{notifId}) ──────────────────────

export type NotificationType = 'filing_due' | 'filing_overdue' | 'filing_completed' | 'extraction_complete' | 'mismatch_found' | 'issue_detected' | 'return_reviewed' | 'system' | 'ai_insight';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface FirestoreNotification {
  notifId: string;
  firmId: string;
  organizationId: string;  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  entityType: CollectionName | null;
  entityId: string | null;
  read: boolean;
  actionUrl: string | null;
  createdAt: unknown;
}

// ─── Activity (top-level: activities/{activityId}) ──────────────────────────

export type ActivityType =
  | 'client_created' | 'client_updated' | 'client_deleted'
  | 'document_uploaded' | 'document_processed' | 'document_failed'
  | 'invoice_extracted' | 'invoice_approved' | 'invoice_corrected'
  | 'invoice_created'
  | 'return_prepared' | 'return_reviewed' | 'return_filed' | 'return_reopened'
  | 'gst_return_created'
  | 'reconciliation_run' | 'mismatch_resolved'
  | 'integration_connected'
  | 'payment_recorded'
  | 'purchase_created'
  | 'user_login' | 'user_signup'
  | 'oracle_activated'
  | 'oracle_insights_generated'
  | 'system';

export interface FirestoreActivity {
  activityId: string;
  firmId: string;
  organizationId: string;  userId: string;
  clientId: string | null;
  type: ActivityType;
  title: string;
  description: string;
  entityType: CollectionName | null;
  entityId: string | null;
  metadata: Record<string, string | number | boolean>;
  createdAt: unknown;
}

// ─── AI Recommendation (top-level: aiRecommendations/{recId}) ───────────────

export interface FirestoreAIRecommendation {
  recId: string;
  firmId: string;
  organizationId: string;  clientId: string | null;
  invoiceId: string | null;
  reconId: string | null;
  type: AIRecommendationType;
  title: string;
  description: string;
  suggestedAction: string;
  confidenceScore: number;     // 0-100
  riskLevel: RiskLevel;
  status: 'active' | 'dismissed' | 'applied';
  dismissedBy: string | null;
  appliedBy: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Prediction (top-level: predictions/{predictionId}) ────────────────────

export type PredictionType =
  | 'revenue' | 'client_churn' | 'late_filing' | 'team_burnout'
  | 'cash_collection' | 'compliance_risk';

export interface FirestorePrediction {
  predictionId: string;
  firmId: string;
  organizationId: string;  type: PredictionType;
  entityId: string | null;        // clientId, userId, etc.
  score: number;                   // 0-100
  confidence: number;              // 0-100
  recommendation: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Priority Queue (top-level: priorityQueue/{priorityId}) ─────────────────

export type PriorityCategory = 'filing' | 'follow_up' | 'review' | 'upload' | 'call' | 'reconciliation' | 'payment';

export interface FirestorePriority {
  priorityId: string;
  firmId: string;
  organizationId: string;  clientId: string | null;
  category: PriorityCategory;
  title: string;
  description: string;
  urgency: number;                 // 1-10
  revenueImpact: number;           // 1-10
  complianceRisk: number;          // 1-10
  clientValue: number;             // 1-10
  priorityScore: number;           // computed: urgency × revenueImpact × complianceRisk × clientValue
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  assignedTo: string | null;
  dueDate: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Organization (top-level: organizations/{orgId}) ────────────────────────

export interface FirestoreOrganization {
  orgId: string;
  name: string;
  ownerId: string;
  plan: 'starter' | 'professional' | 'enterprise';
  firmIds: string[];
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Membership (top-level: memberships/{membershipId}) ─────────────────────

export type MembershipRole = 'owner' | 'partner' | 'manager' | 'staff' | 'client';

export interface FirestoreMembership {
  membershipId: string;
  orgId: string;
  firmId: string;
  organizationId: string;  userId: string;
  role: MembershipRole;
  permissions: string[];
  invitedBy: string;
  status: 'active' | 'invited' | 'suspended';
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Lead (CRM: leads/{leadId}) ──────────────────────────────────────────────

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiation' | 'converted' | 'lost';
export type LeadSource = 'website' | 'referral' | 'advertisement' | 'cold_call' | 'event' | 'social_media' | 'other';

export interface FirestoreLead {
  leadId: string;
  firmId: string;
  organizationId: string;  contactName: string;
  contactEmail: string;
  contactPhone: string;
  company: string;
  gstin: string | null;
  source: LeadSource;
  status: LeadStatus;
  leadScore: number;
  estimatedValue: number;
  notes: string;
  assignedTo: string | null;
  nextFollowUp: string | null;
  convertedClientId: string | null;
  tags: string[];
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Deal (CRM: deals/{dealId}) ──────────────────────────────────────────────

export type DealStage = 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export interface FirestoreDeal {
  dealId: string;
  firmId: string;
  organizationId: string;  leadId: string | null;
  clientId: string | null;
  title: string;
  description: string;
  value: number;
  stage: DealStage;
  probability: number;
  expectedCloseDate: string | null;
  assignedTo: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Meeting (CRM: meetings/{meetingId}) ─────────────────────────────────────

export type MeetingType = 'in_person' | 'video_call' | 'phone_call';
export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface FirestoreMeeting {
  meetingId: string;
  firmId: string;
  organizationId: string;  clientId: string | null;
  leadId: string | null;
  title: string;
  description: string;
  dateTime: string;
  duration: number;
  type: MeetingType;
  status: MeetingStatus;
  attendees: string[];
  notes: string;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Task (tasks/{taskId}) ───────────────────────────────────────────────────

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
// 'review' added in P1-M2 so the TasksPage 4-column board (Todo / In Progress /
// Review / Completed) maps 1:1 to Firestore statuses without coercion.
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled';

export interface FirestoreTask {
  taskId: string;
  firmId: string;
  organizationId: string;  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string | null;
  clientId: string | null;
  dueDate: string | null;
  tags: string[];
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Bank Account (bank_accounts/{bankAccountId}) ──────────────────────────
// Firm's connected bank accounts (linked via DataConnection / aggregator).

export type BankAccountType = 'savings' | 'current' | 'od' | 'cc';
export type BankAccountStatus = 'connected' | 'disconnected' | 'syncing' | 'error';

export interface FirestoreBankAccount {
  bankAccountId: string;
  firmId: string;
  organizationId: string;  userId: string;                 // Firebase UID of the user who linked the account
  bankName: string;
  accountNumberMasked: string;    // e.g. "XXXX1234"
  accountType: BankAccountType;
  ifsc: string | null;
  currentBalance: number;
  availableBalance: number;
  currency: string;               // default 'INR'
  status: BankAccountStatus;
  lastSyncAt: unknown;            // serverTimestamp
  connectionId: string | null;    // links to DataConnection
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Bank Transaction (bank_transactions/{bankTxnId}) ──────────────────────
// Transactions pulled from a connected bank account.

export type BankTransactionType = 'credit' | 'debit';

export interface FirestoreBankTransaction {
  bankTxnId: string;
  firmId: string;
  organizationId: string;  bankAccountId: string;
  date: string;                   // ISO date string
  description: string;
  amount: number;                 // positive = credit, negative = debit
  type: BankTransactionType;
  balanceAfter: number | null;
  category: string | null;
  referenceNo: string | null;
  reconciled: boolean;
  reconciledWith: string | null;  // invoiceId / paymentId
  metadata: Record<string, unknown>;
  createdAt: unknown;
}

// ─── GST Profile (gst_profiles/{gstProfileId}) ─────────────────────────────
// Firm's own GSTN profile (separate from client RETURNS collection).

export type GstProfileStatus = 'active' | 'suspended' | 'cancelled';
export type GstTaxpayerType = 'regular' | 'composition' | 'casual' | 'non_resident' | 'input_service_distributor' | 'tcs' | 'tds';
export type GstFilingFrequency = 'monthly' | 'quarterly';

export interface FirestoreGstProfile {
  gstProfileId: string;
  firmId: string;
  organizationId: string;  userId: string;
  gstin: string;
  legalName: string;
  tradeName: string | null;
  constitution: string | null;
  status: GstProfileStatus;
  taxpayerType: GstTaxpayerType;
  jurisdiction: {
    state: string;
    center: string;
  };
  filingFrequency: GstFilingFrequency;
  lastReturnPeriod: string | null;     // MM-YYYY
  complianceRating: number;            // 0-100
  connectionId: string | null;
  lastSyncAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── GST Return (gst_returns/{gstReturnId}) ────────────────────────────────
// Firm's own GST returns (different from client-facing RETURNS collection).

export type GstReturnType = 'GSTR-1' | 'GSTR-3B' | 'GSTR-9' | 'GSTR-2B';
export type GstReturnStatus = 'draft' | 'prepared' | 'filed' | 'acknowledged' | 'overdue';

export interface FirestoreGstReturn {
  gstReturnId: string;
  firmId: string;
  organizationId: string;  gstProfileId: string;
  returnType: GstReturnType;
  period: string;                 // MM-YYYY
  financialYear: string;
  status: GstReturnStatus;
  totalTaxableValue: number;
  totalTax: number;
  totalItc: number;
  netPayable: number;
  filingDate: string | null;
  acknowledgmentNumber: string | null;
  dueDate: string;
  jsonPayload: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Expense (expenses/{expenseId}) ────────────────────────────────────────
// Operational expenses logged against a firm (optionally a client).

export type ExpenseStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paid';

export interface FirestoreExpense {
  expenseId: string;
  firmId: string;
  organizationId: string;  clientId: string | null;
  category: string;
  description: string | null;
  vendor: string | null;
  amount: number;
  gst: number;
  gstClaimable: boolean;
  date: string;                   // ISO date string
  paymentMode: string | null;
  status: ExpenseStatus;
  receiptUrl: string | null;
  ocrExtracted: boolean;
  notes: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Payment (payments/{paymentId}) ────────────────────────────────────────
// Customer + vendor payments (linkable to invoice / purchase bill).

export type PaymentPartyType = 'customer' | 'vendor';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export interface FirestorePayment {
  paymentId: string;
  firmId: string;
  organizationId: string;  clientId: string | null;
  invoiceId: string | null;
  purchaseBillId: string | null;
  partyName: string;
  partyType: PaymentPartyType;
  amount: number;
  paymentDate: string;            // ISO date string
  paymentMode: string;
  referenceNo: string | null;
  status: PaymentStatus;
  reconciled: boolean;
  /**
   * The bank transaction this payment was reconciled against (null if not
   * linked to a bank transaction). Persisted when a user clicks "Match" /
   * "Resolve" so the reconciliation link survives refreshes — fixes audit 1d
   * issue #8 (boolean flip without linking).
   */
  reconciledTransactionId?: string | null;
  notes: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── AI Memory (ai_memory/{memoryId}) ──────────────────────────────────────
// Persistent agent memory entries (facts / preferences / patterns / outcomes).

export type AiMemoryAgent =
  | 'gst_agent' | 'cfo_agent' | 'collection_agent' | 'compliance_agent'
  | 'oracle' | 'reporting_agent' | 'finance_agent';

export type AiMemoryType = 'fact' | 'preference' | 'pattern' | 'outcome' | 'skill';

export interface FirestoreAiMemory {
  memoryId: string;
  firmId: string;
  organizationId: string;  agent: AiMemoryAgent;
  memoryType: AiMemoryType;
  key: string;
  value: string;
  importance: number;             // 0-1
  lastUsedAt: unknown;            // serverTimestamp
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Notice (notices/{noticeId}) ──────────────────────────────────────────────
// Regulatory / GST / ROC / Income-Tax notices received by or served on a client.
// Each notice tracks ownership, priority, due date and resolution.

export type NoticeType =
  | 'gst_show_cause' | 'gst_demand' | 'gst_assessment' | 'gst_scrutiny'
  | 'gst_refund_rejection' | 'gst_cancellation' | 'gst_3b_mismatch'
  | 'roc_notice' | 'income_tax_notice' | 'tds_notice' | 'other';

export type NoticeStatus = 'open' | 'acknowledged' | 'in_progress' | 'responded' | 'resolved' | 'closed';
export type NoticePriority = 'low' | 'medium' | 'high' | 'urgent';

export interface FirestoreNotice {
  noticeId: string;
  firmId: string;
  organizationId: string;  clientId: string | null;
  clientTradeName: string | null;
  clientGstin: string | null;
  noticeType: NoticeType;
  noticeNumber: string | null;
  noticeDate: string | null;        // ISO date — when the notice was issued
  subject: string;
  description: string | null;
  status: NoticeStatus;
  priority: NoticePriority;
  assignedTo: string | null;        // Firebase UID of the assignee
  assigneeName: string | null;
  assigneeEmail: string | null;
  dueDate: string | null;           // ISO date — response deadline
  responseDate: string | null;      // ISO date — when response was filed
  resolution: string | null;
  attachmentUrl: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Report (reports/{reportId}) ──────────────────────────────────────────────
// Generated business / compliance / financial reports (GSTR-1 JSON, working
// papers, compliance reports, cash-flow reports, etc.). Persisted so the user
// can re-download or audit them later.

export type ReportType =
  | 'gstr1_json' | 'gstr1_excel' | 'gstr3b_json'
  | 'filing_summary_pdf' | 'working_papers_pdf'
  | 'gst_summary_pdf' | 'compliance_report_pdf'
  | 'financial_report_pdf' | 'cash_flow_report_pdf' | 'custom';

export type ReportFormat = 'json' | 'pdf' | 'excel' | 'csv';

export interface FirestoreReport {
  reportId: string;
  firmId: string;
  organizationId: string;  clientId: string | null;
  clientTradeName: string | null;
  reportType: ReportType;
  format: ReportFormat;
  title: string;
  period: string | null;            // MM-YYYY or FY-YYYY
  description: string | null;
  status: 'generating' | 'ready' | 'failed' | 'archived';
  fileSize: number;                 // bytes
  storageUrl: string | null;        // Firebase Storage path or download URL
  generatedBy: string;              // Firebase UID
  generatedAt: unknown;             // serverTimestamp
  metadata: Record<string, string | number | boolean>;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Manual Journal Entry (journal_entries/{jeId}) ───────────────────────────
// Adjusting entries, depreciation, accruals, and other manual postings that
// supplement the auto-generated entries derived from invoices/expenses/payments.

export interface FirestoreJournalEntry {
  jeId: string;
  organizationId: string;
  entryDate: string;             // ISO date
  description: string;
  debitAccount: string;          // account name (e.g. "Cash & Bank")
  creditAccount: string;         // account name (e.g. "Sales Revenue")
  amount: number;
  status: 'posted' | 'pending';
  source: 'manual';
  createdBy: string;             // Firebase UID
  createdByName: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── AI Executive Scores (computed from live data) ───────────────────────────

export interface FirmExecutiveScores {
  firmHealth: number;             // 0-100
  revenue: number;                // 0-100
  compliance: number;             // 0-100
  teamEfficiency: number;         // 0-100
  clientSatisfaction: number;     // 0-100
  cashFlow: number;               // 0-100
}

// ─── Dashboard Metrics (computed, not stored — derived from live data) ──────

export interface LiveDashboardMetrics {
  totalClients: number;
  activeClients: number;
  totalInvoices: number;
  totalTaxVolume: number;
  filedReturns: number;
  pendingReturns: number;
  overdueReturns: number;
  readyToFile: number;
  criticalIssues: number;
  warnings: number;
  averageHealthScore: number;
  matchPercentage: number;
  riskPercentage: number;
  documentsProcessed: number;
  extractionsPending: number;
  recentActivities: FirestoreActivity[];
  upcomingFilings: FirestoreReturn[];
}

// ─── Firestore Data Converter Helpers ───────────────────────────────────────

/** Convert Firestore timestamps to ISO strings for UI consumption */
export function withId<T extends Record<string, unknown>>(doc: { id: string; data: () => T }): T & { id: string } {
  const data = doc.data();
  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      converted[key] = (value as { toDate: () => Date }).toDate().toISOString();
    } else {
      converted[key] = value;
    }
  }
  return { id: doc.id, ...converted } as T & { id: string };
}

/** Convert an array of Firestore docs with timestamp conversion */
export function convertDocs<T extends Record<string, unknown>>(docs: Array<{ id: string; data: () => T }>): Array<T & { id: string }> {
  return docs.map(withId);
}
