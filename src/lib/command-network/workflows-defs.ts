// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Command Network Workflow Definitions (Prisma-free)
// ═══════════════════════════════════════════════════════════════════════════════
// Pure static workflow template definitions extracted from workflows.ts so
// client components can import them WITHOUT pulling @prisma/client into the bundle.
// The original workflows.ts re-exports these for backward compatibility.
// ═══════════════════════════════════════════════════════════════════════════════

import type { WorkflowType, CommandModule } from './types';

// ─── Workflow templates — canonical step definitions ──────────────────────────
export const WORKFLOW_TEMPLATES: {
  type: WorkflowType;
  name: string;
  description: string;
  steps: { module: CommandModule; action: string; agent: string }[];
}[] = [
  {
    type: 'hire_employee',
    name: 'Hire Employee',
    description: 'Onboard a new employee end-to-end across HR, Payroll, Compliance, IT and Knowledge Graph.',
    steps: [
      { module: 'ai_hr', action: 'Create employee record & offer letter', agent: 'oracle' },
      { module: 'payroll', action: 'Provision payroll structure (CTC, PF, TDS)', agent: 'cfo_agent' },
      { module: 'compliance_cloud', action: 'Statutory registrations (PF, ESIC, LWF)', agent: 'compliance_agent' },
      { module: 'ai_operations', action: 'IT provisioning (email, laptop, access)', agent: 'gst_agent' },
      { module: 'knowledge_graph', action: 'Add to Knowledge Graph (skills, role)', agent: 'oracle' },
      { module: 'business_graph', action: 'Link to Business Graph (team, manager)', agent: 'oracle' },
      { module: 'oracle', action: 'Oracle Learning — record onboarding outcome', agent: 'oracle' },
    ],
  },
  {
    type: 'lead_to_cash',
    name: 'Lead to Cash',
    description: 'Full revenue chain: Lead → Opportunity → Proposal → Contract → Invoice → Payment → GST → Accounting → Analytics → Forecast → Oracle Memory.',
    steps: [
      { module: 'crm', action: 'Capture lead & qualify opportunity', agent: 'gst_agent' },
      { module: 'ai_marketing', action: 'Score lead & attribute source', agent: 'oracle' },
      { module: 'ai_cro', action: 'Proposal & pricing approval', agent: 'oracle' },
      { module: 'ai_legal', action: 'Contract review & e-signature', agent: 'oracle' },
      { module: 'ai_cfo', action: 'Generate invoice & recognize revenue', agent: 'cfo_agent' },
      { module: 'banking', action: 'Process payment & reconcile', agent: 'gst_agent' },
      { module: 'gst', action: 'File GSTR-1 & claim ITC', agent: 'gst_agent' },
      { module: 'data_intelligence', action: 'Update analytics & forecast', agent: 'reporting_agent' },
      { module: 'oracle', action: 'Store outcome in Oracle Memory', agent: 'oracle' },
    ],
  },
  {
    type: 'gst_filing',
    name: 'GST Filing Cycle',
    description: 'End-to-end monthly GST return preparation, reconciliation and filing.',
    steps: [
      { module: 'gst', action: 'Download GSTR-2B & reconcile purchase register', agent: 'gst_agent' },
      { module: 'data_intelligence', action: 'Detect data quality issues (duplicate/invalid GSTIN)', agent: 'oracle' },
      { module: 'compliance_cloud', action: 'Validate deadlines & risk score', agent: 'compliance_agent' },
      { module: 'ai_cfo', action: 'Review net tax liability & cash impact', agent: 'cfo_agent' },
      { module: 'gst', action: 'File GSTR-1 + GSTR-3B', agent: 'gst_agent' },
      { module: 'oracle', action: 'Record filing outcome in Oracle Memory', agent: 'oracle' },
    ],
  },
  {
    type: 'payroll_cycle',
    name: 'Payroll Cycle',
    description: 'Run monthly payroll across HR, Finance, Compliance and Banking.',
    steps: [
      { module: 'ai_hr', action: 'Verify attendance & leave', agent: 'oracle' },
      { module: 'payroll', action: 'Compute salaries, PF, TDS, PT', agent: 'cfo_agent' },
      { module: 'compliance_cloud', action: 'Validate PF/ESIC/TDS compliance', agent: 'compliance_agent' },
      { module: 'ai_cfo', action: 'Approve payroll register & cash impact', agent: 'cfo_agent' },
      { module: 'banking', action: 'Disburse salaries & vendor payments', agent: 'gst_agent' },
      { module: 'oracle', action: 'Record payroll outcome in Oracle Memory', agent: 'oracle' },
    ],
  },
  {
    type: 'vendor_onboarding',
    name: 'Vendor Onboarding',
    description: 'Onboard a new vendor with compliance, banking and contract validation.',
    steps: [
      { module: 'crm', action: 'Capture vendor master & GSTIN', agent: 'gst_agent' },
      { module: 'compliance_cloud', action: 'Validate GSTIN & compliance status', agent: 'compliance_agent' },
      { module: 'ai_legal', action: 'Contract & MSME check', agent: 'oracle' },
      { module: 'banking', action: 'Provision vendor bank account', agent: 'gst_agent' },
      { module: 'business_graph', action: 'Add vendor to Business Graph', agent: 'oracle' },
      { module: 'oracle', action: 'Record onboarding in Oracle Memory', agent: 'oracle' },
    ],
  },
  {
    type: 'quarter_end',
    name: 'Quarter End Close',
    description: 'Quarterly books close, GST reconciliation, audit prep and board reporting.',
    steps: [
      { module: 'ai_cfo', action: 'Close books & generate P&L', agent: 'cfo_agent' },
      { module: 'gst', action: 'Quarterly GST reconciliation', agent: 'gst_agent' },
      { module: 'compliance_cloud', action: 'ROC & regulatory filings', agent: 'compliance_agent' },
      { module: 'data_intelligence', action: 'Generate quarter analytics', agent: 'reporting_agent' },
      { module: 'ai_ceo', action: 'Board report & strategy review', agent: 'oracle' },
      { module: 'oracle', action: 'Archive quarter in Oracle Memory', agent: 'oracle' },
    ],
  },
];
