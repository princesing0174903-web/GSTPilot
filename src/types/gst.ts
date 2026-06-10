export type InvoiceType = 'B2B' | 'B2C Large' | 'B2C Small' | 'Export' | 'Credit Note' | 'Debit Note' | 'Nil Rated' | 'Exempted';

export type GSTR1Section = 'b2b' | 'b2cl' | 'b2cs' | 'cdnr' | 'cdnur' | 'exp';

export type MatchStatus = 'perfect_match' | 'partial_match' | 'mismatch' | 'missing_in_books' | 'missing_in_gstr' | 'unmatched' | 'duplicate';

export type WorkflowStatus = 'pending' | 'under_review' | 'resolved' | 'ignored' | 'escalated';

export type ReconSourceType = 'Purchase Register' | 'Sales Register' | 'GSTR-1' | 'GSTR-2B' | 'GSTR-3B';

export type AIRecommendationType = 'correct_gstin' | 'correct_invoice_number' | 'adjust_gst_amount' | 'review_vendor_data' | 'mark_as_duplicate' | 'review_manually';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type IssueSeverity = 'critical' | 'warning' | 'info';

export type FilingStatus = 'draft' | 'prepared' | 'validated' | 'reviewed' | 'generated' | 'filed' | 'reopened';

export type InvoiceStatus = 'draft' | 'approved' | 'filed' | 'cancelled';

export type ClientStatus = 'active' | 'inactive' | 'suspended';

export type EventType = 'data_imported' | 'validation_completed' | 'review_completed' | 'gstr_generated' | 'filed' | 'reopened' | 'downloaded';

export interface Client {
  id: string;
  gstin: string;
  tradeName: string;
  legalName?: string;
  address?: string;
  state?: string;
  stateCode?: string;
  contactEmail?: string;
  contactPhone?: string;
  entityType: string;
  returnPeriod?: string;
  lastFilingDate?: string;
  status: ClientStatus;
  healthScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: string;
  sellerGstin: string;
  buyerGstin?: string;
  buyerName?: string;
  invoiceType: InvoiceType;
  gstr1Section: GSTR1Section;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  hsnCode?: string;
  reverseCharge: boolean;
  status: InvoiceStatus;
  matchStatus: MatchStatus;
  riskLevel: RiskLevel;
  riskScore: number;
  aiExplanation?: string;
  notes?: string;
  period?: string;
  createdAt: string;
  updatedAt: string;
  client?: Client;
}

export interface GSTRFiling {
  id: string;
  clientId: string;
  returnType: string;
  period: string;
  financialYear?: string;
  status: FilingStatus;
  filedDate?: string;
  acknowledgmentNumber?: string;
  totalInvoices: number;
  readyForFiling: number;
  issuesFound: number;
  criticalErrors: number;
  warnings: number;
  totalTaxableValue: number;
  totalTax: number;
  jsonPayload?: string;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  events?: FilingEvent[];
}

export interface ReconciliationResult {
  id: string;
  clientId: string;
  invoiceId: string;
  sourceType: string;
  sourceA?: string;
  sourceB?: string;
  sourceGstin?: string;
  matchedGstin?: string;
  matchStatus: MatchStatus;
  matchScore: number;
  mismatches?: string;
  aiExplanation?: string;
  aiRecommendation?: string;
  confidenceScore: number;
  workflowStatus: WorkflowStatus;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  runId?: string;
  createdAt: string;
  updatedAt: string;
  invoice?: Invoice;
  run?: ReconciliationRun;
}

export interface ReconciliationRun {
  id: string;
  clientId: string;
  period: string;
  sources: string;
  totalRecords: number;
  matched: number;
  unmatched: number;
  partialMatches: number;
  highRisk: number;
  gstDifference: number;
  status: string;
  runBy?: string;
  createdAt: string;
  results?: ReconciliationResult[];
}

export interface FilingEvent {
  id: string;
  filingId: string;
  clientId: string;
  eventType: EventType;
  description?: string;
  userId?: string;
  timestamp: string;
}

export interface Issue {
  id: string;
  clientId: string;
  invoiceId?: string;
  filingId?: string;
  severity: IssueSeverity;
  category: string;
  title: string;
  description?: string;
  status: 'open' | 'resolved' | 'ignored';
  assignedTo?: string;
  notes?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  invoice?: Invoice;
}

export interface HealthScoreRecord {
  id: string;
  clientId: string;
  score: number;
  missingGstin: number;
  invalidGstin: number;
  duplicateInvoices: number;
  filingDelays: number;
  validationErrors: number;
  period?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  clientId?: string;
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
  timestamp: string;
  client?: Client;
}

export interface DashboardMetrics {
  totalClients: number;
  totalInvoices: number;
  filedReturns: number;
  pendingReturns: number;
  overdueReturns: number;
  averageHealthScore: number;
  criticalIssues: number;
  warnings: number;
  matchPercentage: number;
  riskPercentage: number;
}

export interface FilingCalendarItem {
  id: string;
  returnType: string;
  period: string;
  dueDate: string;
  status: 'filed' | 'pending' | 'overdue' | 'upcoming';
  clientId: string;
  clientName: string;
}

export const MATCH_STATUS_CONFIG: Record<MatchStatus, { label: string; color: string; bgColor: string }> = {
  perfect_match: { label: 'Perfect Match', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
  partial_match: { label: 'Partial Match', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  mismatch: { label: 'Mismatch', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
  missing_in_books: { label: 'Missing in Books', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  missing_in_gstr: { label: 'Missing in GSTR', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  unmatched: { label: 'Unmatched', color: 'text-slate-700', bgColor: 'bg-slate-50 border-slate-200' },
  duplicate: { label: 'Duplicate', color: 'text-pink-700', bgColor: 'bg-pink-50 border-pink-200' },
};

export const WORKFLOW_STATUS_CONFIG: Record<WorkflowStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-slate-700', bgColor: 'bg-slate-50 border-slate-200' },
  under_review: { label: 'Under Review', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  resolved: { label: 'Resolved', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
  ignored: { label: 'Ignored', color: 'text-slate-500', bgColor: 'bg-slate-50 border-slate-200' },
  escalated: { label: 'Escalated', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
};

export const AI_RECOMMENDATION_CONFIG: Record<AIRecommendationType, { label: string; icon: string; color: string }> = {
  correct_gstin: { label: 'Correct GSTIN', icon: '🔧', color: 'text-blue-700' },
  correct_invoice_number: { label: 'Correct Invoice #', icon: '📝', color: 'text-purple-700' },
  adjust_gst_amount: { label: 'Adjust GST Amount', icon: '💰', color: 'text-amber-700' },
  review_vendor_data: { label: 'Review Vendor Data', icon: '🔍', color: 'text-orange-700' },
  mark_as_duplicate: { label: 'Mark as Duplicate', icon: '📋', color: 'text-pink-700' },
  review_manually: { label: 'Review Manually', icon: '👁️', color: 'text-slate-700' },
};

export const RISK_LEVEL_CONFIG: Record<RiskLevel, { label: string; color: string; bgColor: string; icon: string }> = {
  low: { label: 'Low', color: 'text-emerald-700', bgColor: 'bg-emerald-50', icon: '✓' },
  medium: { label: 'Medium', color: 'text-amber-700', bgColor: 'bg-amber-50', icon: '⚠' },
  high: { label: 'High', color: 'text-orange-700', bgColor: 'bg-orange-50', icon: '▲' },
  critical: { label: 'Critical', color: 'text-red-700', bgColor: 'bg-red-50', icon: '✕' },
};

export const INVOICE_TYPE_TO_SECTION: Record<InvoiceType, GSTR1Section> = {
  'B2B': 'b2b',
  'B2C Large': 'b2cl',
  'B2C Small': 'b2cs',
  'Export': 'exp',
  'Credit Note': 'cdnr',
  'Debit Note': 'cdnur',
  'Nil Rated': 'b2cs',
  'Exempted': 'b2cs',
};

export const GSTR1_SECTION_LABELS: Record<GSTR1Section, string> = {
  b2b: 'B2B Invoices',
  b2cl: 'B2C Large Invoices',
  b2cs: 'B2C Small Invoices',
  cdnr: 'Credit/Debit Notes (Registered)',
  cdnur: 'Credit/Debit Notes (Unregistered)',
  exp: 'Export Invoices',
};

export const FILING_STATUS_CONFIG: Record<FilingStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  prepared: { label: 'Prepared', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  validated: { label: 'Validated', color: 'text-cyan-700', bgColor: 'bg-cyan-50' },
  reviewed: { label: 'Reviewed', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  generated: { label: 'Generated', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  filed: { label: 'Filed', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  reopened: { label: 'Reopened', color: 'text-red-700', bgColor: 'bg-red-50' },
};

export const ISSUE_SEVERITY_CONFIG: Record<IssueSeverity, { label: string; color: string; bgColor: string; borderColor: string }> = {
  critical: { label: 'Critical', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  warning: { label: 'Warning', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  info: { label: 'Info', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
};
