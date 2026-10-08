// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Global Compliance Cloud™ (AUTONOMOUS COMPLIANCE ENGINE)
// Type system — shared contract for all 13 subsystems.
// Predict. Prepare. Validate. Comply. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. Regulation Knowledge Graph™ ──────────────────────────────────────────

export type RegulationType =
  | 'gst' | 'income_tax' | 'tds' | 'payroll' | 'epfo' | 'esic'
  | 'mca' | 'rbi' | 'companies_act' | 'labour_law'
  | 'corporate_filing' | 'banking' | 'privacy';

export type RegulationCategory =
  | 'filing' | 'payment' | 'reporting' | 'registration' | 'compliance' | 'audit';

export interface RegulationSection {
  section: string;
  title: string;
  summary: string;
}

export interface ComplianceRegulation {
  id: string;
  regulationCode: string;
  title: string;
  description?: string;
  jurisdiction: string;
  countryIso: string;
  regulationType: RegulationType;
  authority?: string;
  category: RegulationCategory;
  effectiveFrom?: string;
  effectiveTo?: string;
  penaltySummary?: string;
  interestRatePct: number;
  sections: RegulationSection[];
  linkedEntityIds: string[];
  linkedGraphNodes: string[];
  crossBorderRefs: string[];
  industryTags: string[];
  riskWeight: number;
  sourceUrl?: string;
  lastReviewedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── 2. Autonomous Compliance Execution™ — filings ───────────────────────────

export type FilingType =
  | 'gstr1' | 'gstr3b' | 'gstr9' | 'gstr2b_reconcile'
  | 'itr' | 'tds_24q' | 'tds_26q' | 'tds_27q'
  | 'epf_ecn' | 'esi_return' | 'pt_return'
  | 'mca_aoc4' | 'mca_mgt7' | 'mca_dir3'
  | 'rbi_furnish' | 'payroll_return' | 'corp_filing' | 'audit_report';

export type FilingStatus =
  | 'draft' | 'analyzed' | 'prepared' | 'approved'
  | 'submitted' | 'acknowledged' | 'rejected' | 'failed';

export type PreparedBy = 'oracle' | 'ai_cfo' | 'ai_legal' | 'ai_coo' | 'human';

export interface FilingSummary {
  totalLiability?: number;
  totalRefund?: number;
  taxPayable?: number;
  itcClaimed?: number;
  outputTax?: number;
  inputTax?: number;
  netTax?: number;
  headcount?: number;
  grossPayroll?: number;
  [k: string]: unknown;
}

export interface ComplianceFiling {
  id: string;
  filingType: FilingType;
  title: string;
  description?: string;
  organizationId?: string;
  entityId?: string;
  countryIso: string;
  period: string;
  dueDate?: string;
  preparedAt: string;
  preparedBy: PreparedBy;
  status: FilingStatus;
  payload: Record<string, unknown>;
  summary: FilingSummary;
  riskAssessment: Record<string, unknown>;
  aiRecommendation?: string;
  approvedBy?: string;
  approvedAt?: string;
  submittedAt?: string;
  acknowledgedAt?: string;
  ackReference?: string;
  errorMessage?: string;
  auditId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 3. Compliance Risk Engine™ ──────────────────────────────────────────────

export type RiskType =
  | 'late_filing' | 'missing_invoice' | 'gst_mismatch' | 'cash_anomaly'
  | 'payroll_inconsistency' | 'banking_violation' | 'audit_risk'
  | 'director_compliance' | 'vendor_compliance' | 'tds_shortfall'
  | 'epfo_gap' | 'esi_gap' | 'mca_default' | 'rbi_breach';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskStatus = 'open' | 'acknowledged' | 'mitigating' | 'resolved' | 'accepted';

export interface ComplianceRisk {
  id: string;
  riskType: RiskType;
  title: string;
  description: string;
  severity: RiskSeverity;
  confidence: number;
  financialImpact: number;
  countryIso: string;
  organizationId?: string;
  entityId?: string;
  regulationId?: string;
  filingId?: string;
  recommendedAction?: string;
  expectedDeadline?: string;
  detectedAt: string;
  resolvedAt?: string;
  status: RiskStatus;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 4. Policy Engine™ ───────────────────────────────────────────────────────

export type PolicyType =
  | 'approval_workflow' | 'filing_approval' | 'multi_level_auth'
  | 'country_rule' | 'department_rule' | 'risk_tolerance' | 'escalation_chain';

export type RiskTolerance = 'low' | 'medium' | 'high';

export interface ApprovalLevel {
  level: number;
  role: string;
  autoApproveBelowINR: number;
}

export interface EscalationStep {
  hours: number;
  notifyRole: string;
}

export interface CompliancePolicy {
  id: string;
  name: string;
  description?: string;
  policyType: PolicyType;
  countryIso?: string;
  department?: string;
  filingTypes: FilingType[];
  riskTolerance: RiskTolerance;
  approvalLevels: ApprovalLevel[];
  escalationChain: EscalationStep[];
  maxAutoApproveINR: number;
  requiresSignature: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── 5. Audit Cloud™ ─────────────────────────────────────────────────────────

export type AuditActionType =
  | 'filing_prepared' | 'filing_approved' | 'filing_submitted' | 'filing_rejected'
  | 'risk_detected' | 'risk_resolved' | 'policy_evaluated' | 'regulation_updated'
  | 'twin_simulated' | 'ai_recommendation' | 'signature_applied' | 'replay_requested';

export type EntityType =
  | 'filing' | 'risk' | 'regulation' | 'policy' | 'score'
  | 'organization' | 'entity' | 'vendor' | 'employee';

export type ActorType = 'oracle' | 'ai_cfo' | 'ai_legal' | 'ai_coo' | 'human' | 'system' | 'connector';

export interface ComplianceAuditEntry {
  id: string;
  actionType: AuditActionType;
  entityType: EntityType;
  entityId?: string;
  organizationId?: string;
  countryIso?: string;
  actorId?: string;
  actorType: ActorType;
  action: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  signature?: string;
  ipAddress?: string;
  replayToken: string;
  createdAt: string;
}

// ─── 6. Global Compliance Score™ ─────────────────────────────────────────────

export type ScoreScopeType =
  | 'organization' | 'department' | 'country' | 'entity' | 'vendor' | 'employee';

export interface ComplianceScoreRecord {
  id: string;
  scopeType: ScoreScopeType;
  scopeId: string;
  scopeName: string;
  countryIso?: string;
  taxScore: number;
  payrollScore: number;
  corporateScore: number;
  bankingScore: number;
  legalScore: number;
  overallScore: number;
  openRisks: number;
  criticalRisks: number;
  upcomingDeadlines: number;
  trendDelta: number;
  computedAt: string;
  createdAt: string;
}

// ─── 7. Regulation Update Engine™ ────────────────────────────────────────────

export type RegulationUpdateType =
  | 'new_law' | 'amendment' | 'circular' | 'notification'
  | 'rate_change' | 'deadline_change' | 'abolished';

export interface RegulationUpdateImpact {
  affectedFilings: FilingType[];
  riskDelta: number;
  estimatedINR: number;
}

export interface RegulationUpdateRecord {
  id: string;
  updateType: RegulationUpdateType;
  regulationId?: string;
  regulationCode: string;
  title: string;
  summary: string;
  jurisdiction: string;
  countryIso: string;
  authority?: string;
  effectiveDate?: string;
  impactAssessment: RegulationUpdateImpact;
  oracleAdvice?: string;
  sourceUrl?: string;
  notifiedExecutives: boolean;
  acknowledgedAt?: string;
  detectedAt: string;
  createdAt: string;
}

// ─── 8. Compliance Digital Twin™ ─────────────────────────────────────────────

export type RegulatoryRisk = 'low' | 'medium' | 'high' | 'critical';

export interface ComplianceTwinResult {
  id: string;
  filingId?: string;
  scenario: string;
  gstImpact: number;
  taxImpact: number;
  penaltyEstimate: number;
  interestEstimate: number;
  cashFlowEffect: number;
  auditProbability: number;
  complianceScoreDelta: number;
  regulatoryRisk: RegulatoryRisk;
  recommendation?: string;
  simulatedAt: string;
  createdAt: string;
}

// ─── 9. Global Deadline Engine™ ──────────────────────────────────────────────

export type DeadlineFrequency = 'one_time' | 'monthly' | 'quarterly' | 'annually';

export interface ComplianceDeadlineItem {
  id: string;
  countryIso: string;
  regulationType: RegulationType | string;
  title: string;
  description?: string;
  frequency: DeadlineFrequency;
  dueDateRule: string;
  penaltyLate?: string;
  authority?: string;
  riskLevel: string;
  isActive: boolean;
  nextDueDate?: string;
  daysUntil?: number | null;
}

// ─── 10. Unified Compliance Dashboard™ ───────────────────────────────────────

export interface ComplianceDashboard {
  overallScore: number;
  totalRegulations: number;
  totalFilings: number;
  openRisks: number;
  criticalRisks: number;
  upcomingDeadlines: number;
  pendingApprovals: number;
  submittedFilings: number;
  acknowledgedFilings: number;
  regulationUpdates: number;
  byRegulationType: Array<{ type: RegulationType; count: number; riskCount: number }>;
  byCountry: Array<{
    countryIso: string;
    countryName: string;
    score: number;
    openRisks: number;
    upcomingDeadlines: number;
  }>;
  recentFilings: ComplianceFiling[];
  topRisks: ComplianceRisk[];
  upcomingDeadlineFeed: Array<{
    countryIso: string;
    countryName: string;
    title: string;
    regulationType: string;
    riskLevel: string;
    dueDate: string | null;
    daysUntil: number | null;
    authority?: string;
  }>;
  recentAuditEntries: ComplianceAuditEntry[];
  recentRegulationUpdates: RegulationUpdateRecord[];
  scoreBreakdown: {
    tax: number;
    payroll: number;
    corporate: number;
    banking: number;
    legal: number;
  };
  oracleNarrative: string;
  generatedAt: string;
}

// ─── 11. Executive API request/response contracts ────────────────────────────

export interface AnalyzeRequest {
  filingType: FilingType;
  period: string;
  countryIso: string;
  organizationId?: string;
  entityId?: string;
}

export interface AnalyzeResponse {
  filing: ComplianceFiling;
  twin: ComplianceTwinResult;
  risks: ComplianceRisk[];
  oracleRecommendation: string;
}

export interface PrepareRequest {
  filingType: FilingType;
  period: string;
  countryIso: string;
  organizationId?: string;
  entityId?: string;
  preparedBy?: PreparedBy;
}

export interface PrepareResponse {
  filing: ComplianceFiling;
  auditEntry: ComplianceAuditEntry;
  oracleRecommendation: string;
}

export interface ApproveRequest {
  filingId: string;
  approvedBy: string;
  level?: number;
  comment?: string;
}

export interface ApproveResponse {
  filing: ComplianceFiling;
  auditEntry: ComplianceAuditEntry;
  approved: boolean;
}

export interface SubmitRequest {
  filingId: string;
  submittedBy: string;
}

export interface SubmitResponse {
  filing: ComplianceFiling;
  auditEntry: ComplianceAuditEntry;
  ackReference?: string;
  submitted: boolean;
}

export interface ReplayRequest {
  replayToken: string;
  requestedBy?: string;
}

export interface ReplayResponse {
  auditEntry: ComplianceAuditEntry;
  reconstructedState: Record<string, unknown>;
  replayed: boolean;
}

// ─── 12. Security™ ───────────────────────────────────────────────────────────

export interface ComplianceAuthContext {
  userId?: string;
  role: ComplianceRole;
  organizationId?: string;
  countryIso?: string;
  ipAddress?: string;
  fingerprint: string;
}

export type ComplianceRole =
  | 'compliance_admin' | 'compliance_officer' | 'cfo' | 'ceo'
  | 'legal_counsel' | 'auditor' | 'viewer' | 'system';

export interface SignedAction {
  actionId: string;
  signature: string;
  timestamp: string;
  actor: string;
}

// ─── 13. Module metadata (for UI badges) ─────────────────────────────────────

export const REGULATION_TYPE_META: Record<RegulationType, { label: string; icon: string; color: string }> = {
  gst: { label: 'GST', icon: '🧾', color: 'text-violet-600 bg-violet-50 border-violet-200' },
  income_tax: { label: 'Income Tax', icon: '💰', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  tds: { label: 'TDS', icon: '🔻', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  payroll: { label: 'Payroll', icon: '👥', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  epfo: { label: 'EPFO', icon: '🏛️', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  esic: { label: 'ESIC', icon: '🏥', color: 'text-rose-600 bg-rose-50 border-rose-200' },
  mca: { label: 'MCA', icon: '📋', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  rbi: { label: 'RBI', icon: '🏦', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  companies_act: { label: 'Companies Act', icon: '⚖️', color: 'text-slate-600 bg-slate-50 border-slate-200' },
  labour_law: { label: 'Labour Law', icon: '👷', color: 'text-teal-600 bg-teal-50 border-teal-200' },
  corporate_filing: { label: 'Corporate Filing', icon: '📁', color: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-200' },
  banking: { label: 'Banking', icon: '💳', color: 'text-green-600 bg-green-50 border-green-200' },
  privacy: { label: 'Privacy', icon: '🔒', color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

export const FILING_TYPE_META: Record<FilingType, { label: string; regulation: RegulationType }> = {
  gstr1: { label: 'GSTR-1', regulation: 'gst' },
  gstr3b: { label: 'GSTR-3B', regulation: 'gst' },
  gstr9: { label: 'GSTR-9 Annual', regulation: 'gst' },
  gstr2b_reconcile: { label: 'GSTR-2B Reconcile', regulation: 'gst' },
  itr: { label: 'Income Tax Return', regulation: 'income_tax' },
  tds_24q: { label: 'TDS 24Q (Salary)', regulation: 'tds' },
  tds_26q: { label: 'TDS 26Q (Non-Salary)', regulation: 'tds' },
  tds_27q: { label: 'TDS 27Q (Non-Resident)', regulation: 'tds' },
  epf_ecn: { label: 'EPF ECR', regulation: 'epfo' },
  esi_return: { label: 'ESI Return', regulation: 'esic' },
  pt_return: { label: 'Professional Tax', regulation: 'payroll' },
  mca_aoc4: { label: 'MCA AOC-4', regulation: 'mca' },
  mca_mgt7: { label: 'MCA MGT-7', regulation: 'mca' },
  mca_dir3: { label: 'MCA DIR-3 KYC', regulation: 'mca' },
  rbi_furnish: { label: 'RBI Furnishing', regulation: 'rbi' },
  payroll_return: { label: 'Payroll Return', regulation: 'payroll' },
  corp_filing: { label: 'Corporate Filing', regulation: 'corporate_filing' },
  audit_report: { label: 'Audit Report', regulation: 'companies_act' },
};

export const RISK_SEVERITY_META: Record<RiskSeverity, { label: string; color: string; weight: number }> = {
  critical: { label: 'Critical', color: 'text-rose-700 bg-rose-50 border-rose-200', weight: 25 },
  high: { label: 'High', color: 'text-orange-700 bg-orange-50 border-orange-200', weight: 12 },
  medium: { label: 'Medium', color: 'text-amber-700 bg-amber-50 border-amber-200', weight: 5 },
  low: { label: 'Low', color: 'text-slate-600 bg-slate-50 border-slate-200', weight: 2 },
};

export const FILING_STATUS_META: Record<FilingStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'text-slate-600 bg-slate-50 border-slate-200' },
  analyzed: { label: 'Analyzed', color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
  prepared: { label: 'Prepared', color: 'text-violet-700 bg-violet-50 border-violet-200' },
  approved: { label: 'Approved', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  submitted: { label: 'Submitted', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  acknowledged: { label: 'Acknowledged', color: 'text-green-700 bg-green-50 border-green-200' },
  rejected: { label: 'Rejected', color: 'text-rose-700 bg-rose-50 border-rose-200' },
  failed: { label: 'Failed', color: 'text-red-700 bg-red-50 border-red-200' },
};

// Subsystems list for UI display
export const COMPLIANCE_SUBSYSTEMS = [
  { id: 'engine', label: 'Global Compliance Engine™', icon: '⚙️', desc: 'One unified pipeline — every compliance activity flows through it' },
  { id: 'regulation-graph', label: 'Regulation Knowledge Graph™', icon: '🕸️', desc: 'Continuously updated regulation graph linked to Business Graph™' },
  { id: 'digital-twin', label: 'Compliance Digital Twin™', icon: '🔮', desc: 'Simulate before execution — predict GST/tax/penalty/cash-flow impact' },
  { id: 'autonomous-execution', label: 'Autonomous Compliance Execution™', icon: '🤖', desc: 'Oracle prepares every return — nothing submits without approval' },
  { id: 'risk-engine', label: 'Compliance Risk Engine™', icon: '⚠️', desc: 'Continuous detection of late filings, mismatches, anomalies, violations' },
  { id: 'deadline-engine', label: 'Global Deadline Engine™', icon: '📅', desc: 'One enterprise calendar — GST/IT/Payroll/EPFO/ESIC/MCA/RBI deadlines' },
  { id: 'legal-center', label: 'AI Legal Command Center™', icon: '⚖️', desc: 'AI Legal reviews contracts, obligations, filings, litigation risks' },
  { id: 'policy-engine', label: 'Policy Engine™', icon: '🔐', desc: 'Approval workflows, multi-level auth, country/department rules' },
  { id: 'audit-cloud', label: 'Audit Cloud™', icon: '📚', desc: 'Permanent immutable store — every filing/approval/decision replayable' },
  { id: 'score-engine', label: 'Global Compliance Score™', icon: '📊', desc: 'Live scores for org/dept/country/entity/vendor/employee' },
  { id: 'update-engine', label: 'Regulation Update Engine™', icon: '🔄', desc: 'Auto-detects new tax laws, GST changes, RBI/MCA notifications' },
  { id: 'executive-apis', label: 'Executive APIs™', icon: '🔌', desc: '13 production endpoints — all return LIVE data' },
  { id: 'security', label: 'Security™', icon: '🛡️', desc: 'RBAC, org isolation, audit logs, signatures, zero-trust' },
] as const;
