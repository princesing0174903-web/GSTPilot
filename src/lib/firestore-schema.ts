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
  firmName: string | null;
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
  ownerId: string;
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
  gstin: string;
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
  clientId: string;
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
  clientId: string;
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
  clientId: string;
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
  clientId: string;
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
  userId: string;
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
  | 'return_prepared' | 'return_reviewed' | 'return_filed' | 'return_reopened'
  | 'reconciliation_run' | 'mismatch_resolved'
  | 'user_login' | 'user_signup'
  | 'system';

export interface FirestoreActivity {
  activityId: string;
  firmId: string;
  userId: string;
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
  clientId: string | null;
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
