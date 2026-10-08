// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — GLOBAL COMPLIANCE CLOUD™ — Public barrel
// Re-exports all 13 subsystems + shared types. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

export * from './types';

// Subsystem 1: Regulation Knowledge Graph™
export {
  getRegulations, getRegulationById, linkRegulationToBusinessGraph, searchRegulations,
  type RegulationFilters,
} from './regulation-graph';

// Subsystem 2: Global Deadline Engine™
export {
  getGlobalDeadlines, getDeadlinesByCountry, getDeadlineCalendar, notifyExecutives,
  getCountryName,
  type DeadlineCalendarEntry,
} from './deadline-engine';

// Subsystem 3: Compliance Risk Engine™
export {
  detectRisks, getRiskById, resolveRisk, getTopRisks,
  type RiskFilters,
} from './risk-engine';

// Subsystem 4: Compliance Digital Twin™
export {
  simulateFiling, simulateScenario,
  type SimulationParams,
} from './digital-twin';

// Subsystem 5: Policy Engine™
export {
  getPolicies, getPolicyForFiling, evaluateApproval, getEscalationChain,
  type PolicyFilters, type ApprovalEvaluation,
} from './policy-engine';

// Subsystem 6: Audit Cloud™
export {
  recordAuditEntry, getAuditEntries, getAuditEntryByToken, replayAuditEntry,
  type RecordAuditParams, type AuditFilters, type AuditReplay,
} from './audit-cloud';

// Subsystem 7: Global Compliance Score™
export {
  computeScore, getScores, getOverallScore, getScoreBreakdown,
} from './score-engine';

// Subsystem 8: Regulation Update Engine™
export {
  detectRegulationUpdates, getRegulationUpdates, acknowledgeUpdate, notifyOracle,
  type UpdateFilters,
} from './update-engine';

// Subsystem 9: AI Legal Command Center™
export {
  getLegalSummary, reviewContracts, getFilingStatusOverview,
  type LegalSummary, type ContractReview, type FilingStatusEntry,
} from './legal-center';

// Subsystem 10: Global Compliance Engine™ (unified pipeline)
export {
  prepareFiling, analyzeFiling, approveFiling, submitFiling, replayFiling,
} from './engine';

// Subsystem 11: Unified Compliance Dashboard™
export {
  getComplianceDashboard, invalidateComplianceDashboardCache,
} from './dashboard';

// Subsystem 12: Security™
export {
  canPerformCompliance, needsComplianceApproval, signComplianceAction,
  fingerprintComplianceActor, defaultComplianceAuth, parseComplianceBody,
  withComplianceApi, complianceRateLimit,
  type ComplianceApiOpts,
} from './security';
