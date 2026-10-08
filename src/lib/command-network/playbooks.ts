// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Enterprise Playbooks™
//
// Reusable command playbooks. Oracle selects the correct playbook automatically.
// Examples: Quarter End, GST Filing, Audit, Funding Round, International
// Expansion, Payroll Cycle, Disaster Recovery, Incident Response, Acquisition,
// Product Launch. Each playbook is a sequence of phases with actions + modules.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db, cached, safeFindMany, safeCount, TTL, countBy, parseJson } from './helpers';
import type { CommandPlaybook, PlaybookSummary, PlaybookType, PlaybookPhase, CommandModule } from './types';

// ─── Canonical playbook definitions (10 reusable playbooks) ───────────────────
export const PLAYBOOK_DEFS: {
  type: PlaybookType;
  name: string;
  description: string;
  trigger: string;
  objective: string;
  phases: PlaybookPhase[];
  successCriteria: string[];
  risks: string[];
  estimatedDurationHrs: number;
}[] = [
  {
    type: 'quarter_end',
    name: 'Quarter End Close',
    description: 'Complete the quarterly books close, GST reconciliation, audit prep and board reporting.',
    trigger: 'When the fiscal quarter ends or board meeting is scheduled within 14 days.',
    objective: 'Close books, file all GST returns, prepare board pack, archive quarter in Oracle Memory.',
    phases: [
      { name: 'Books Close', actions: ['Reconcile all ledgers', 'Post adjusting entries', 'Generate P&L and Balance Sheet'], modules: ['ai_cfo', 'banking'], expectedDurationHrs: 24, ownerRole: 'CFO' },
      { name: 'GST Reconciliation', actions: ['Reconcile GSTR-2B vs purchase register', 'File GSTR-1 and GSTR-3B', 'Claim pending ITC'], modules: ['gst', 'data_intelligence'], expectedDurationHrs: 12, ownerRole: 'GST Agent' },
      { name: 'Compliance Filings', actions: ['File ROC returns', 'Pay advance tax', 'TDS deposit'], modules: ['compliance_cloud', 'ai_legal'], expectedDurationHrs: 8, ownerRole: 'Compliance Agent' },
      { name: 'Board Reporting', actions: ['Generate quarter analytics', 'Prepare board deck', 'Strategy review with AI CEO'], modules: ['ai_ceo', 'data_intelligence'], expectedDurationHrs: 6, ownerRole: 'CEO' },
      { name: 'Archive', actions: ['Archive quarter in Oracle Memory', 'Update Business Graph', 'Plan next quarter'], modules: ['oracle', 'business_graph'], expectedDurationHrs: 4, ownerRole: 'Oracle' },
    ],
    successCriteria: ['Books closed with zero unreconciled entries', 'All GST returns filed', 'Board pack delivered', 'Quarter archived'],
    risks: ['Unreconciled transactions delay close', 'Late GST filing triggers penalty', 'Board pack incomplete'],
    estimatedDurationHrs: 54,
  },
  {
    type: 'gst_filing',
    name: 'GST Filing Playbook',
    description: 'Monthly GST return preparation, reconciliation, review and filing.',
    trigger: 'When the monthly GST filing deadline is within 7 days.',
    objective: 'File GSTR-1 and GSTR-3B accurately and on time, claiming all eligible ITC.',
    phases: [
      { name: 'Data Collection', actions: ['Download GSTR-2B', 'Import purchase register', 'Import sales invoices'], modules: ['gst', 'data_intelligence'], expectedDurationHrs: 4, ownerRole: 'GST Agent' },
      { name: 'Reconciliation', actions: ['Reconcile 2B vs purchase', 'Identify mismatches', 'Detect data quality issues'], modules: ['gst', 'data_intelligence'], expectedDurationHrs: 8, ownerRole: 'GST Agent' },
      { name: 'Review', actions: ['CFO reviews net liability', 'Validate cash for payment', 'Compliance deadline check'], modules: ['ai_cfo', 'compliance_cloud'], expectedDurationHrs: 4, ownerRole: 'CFO' },
      { name: 'Filing', actions: ['File GSTR-1', 'File GSTR-3B', 'Pay net tax'], modules: ['gst', 'banking'], expectedDurationHrs: 2, ownerRole: 'GST Agent' },
      { name: 'Memory', actions: ['Record filing in Oracle Memory', 'Update compliance graph'], modules: ['oracle'], expectedDurationHrs: 1, ownerRole: 'Oracle' },
    ],
    successCriteria: ['GSTR-1 filed', 'GSTR-3B filed', 'Net tax paid', 'ITC claimed'],
    risks: ['Reconciliation mismatches', 'Insufficient cash for tax payment', 'Missed deadline'],
    estimatedDurationHrs: 19,
  },
  {
    type: 'audit',
    name: 'Audit Readiness Playbook',
    description: 'Prepare for statutory audit — documentation, evidence and walkthroughs.',
    trigger: 'When statutory audit is scheduled or auditor requests documentation.',
    objective: 'Deliver complete audit-ready documentation with full traceability.',
    phases: [
      { name: 'Documentation', actions: ['Compile financial statements', 'Prepare schedules', 'Gather contracts'], modules: ['ai_cfo', 'ai_legal'], expectedDurationHrs: 40, ownerRole: 'CFO' },
      { name: 'Evidence Trail', actions: ['Build lineage for every transaction', 'Export audit log', 'Reconcile balances'], modules: ['data_intelligence', 'compliance_cloud'], expectedDurationHrs: 24, ownerRole: 'Compliance Agent' },
      { name: 'Walkthroughs', actions: ['Process walkthroughs with auditor', 'Address queries', 'Provide samples'], modules: ['ai_cfo'], expectedDurationHrs: 16, ownerRole: 'CFO' },
      { name: 'Closure', actions: ['Sign audit report', 'File with ROC', 'Archive in Oracle Memory'], modules: ['ai_legal', 'oracle'], expectedDurationHrs: 8, ownerRole: 'Legal' },
    ],
    successCriteria: ['All schedules delivered', 'Audit report signed', 'ROC filing complete'],
    risks: ['Missing documentation', 'Unresolved queries', 'Qualification in report'],
    estimatedDurationHrs: 88,
  },
  {
    type: 'funding_round',
    name: 'Funding Round Playbook',
    description: 'Execute a funding round — diligence, valuation, documentation and closing.',
    trigger: 'When the board approves a funding round or term sheet is received.',
    objective: 'Close the funding round with full compliance and investor onboarding.',
    phases: [
      { name: 'Diligence Prep', actions: ['Compile data room', 'Financial diligence pack', 'Legal diligence pack'], modules: ['ai_cfo', 'ai_legal', 'data_intelligence'], expectedDurationHrs: 60, ownerRole: 'CFO' },
      { name: 'Valuation', actions: ['Run valuation models', 'Digital Twin simulation', 'Board approval'], modules: ['digital_twin', 'ai_cfo'], expectedDurationHrs: 16, ownerRole: 'CFO' },
      { name: 'Documentation', actions: ['Draft SHA', 'Draft SSA', 'Legal review'], modules: ['ai_legal'], expectedDurationHrs: 24, ownerRole: 'Legal' },
      { name: 'Closing', actions: ['Sign documents', 'Receive funds', 'File with ROC', 'Update cap table'], modules: ['ai_legal', 'banking', 'compliance_cloud'], expectedDurationHrs: 12, ownerRole: 'Legal' },
      { name: 'Memory', actions: ['Record round in Oracle Memory', 'Update Business Graph'], modules: ['oracle', 'business_graph'], expectedDurationHrs: 4, ownerRole: 'Oracle' },
    ],
    successCriteria: ['Funds received', 'SHA signed', 'ROC filed', 'Cap table updated'],
    risks: ['Diligence findings reduce valuation', 'Legal delays', 'Regulatory approval'],
    estimatedDurationHrs: 116,
  },
  {
    type: 'international_expansion',
    name: 'International Expansion Playbook',
    description: 'Expand into a new country — entity setup, tax registration, banking, compliance.',
    trigger: 'When the board approves a new country expansion.',
    objective: 'Establish a legal operating entity in the target country with full compliance.',
    phases: [
      { name: 'Market Analysis', actions: ['Country regulatory scan', 'Tax system analysis', 'Digital Twin expansion sim'], modules: ['global_enterprise', 'digital_twin'], expectedDurationHrs: 40, ownerRole: 'CEO' },
      { name: 'Entity Setup', actions: ['Register legal entity', 'Obtain tax ID', 'Open bank account'], modules: ['global_enterprise', 'ai_legal', 'banking'], expectedDurationHrs: 80, ownerRole: 'Legal' },
      { name: 'Compliance', actions: ['Register for local tax', 'Setup payroll structure', 'Compliance calendar'], modules: ['compliance_cloud', 'payroll'], expectedDurationHrs: 32, ownerRole: 'Compliance Agent' },
      { name: 'Operations', actions: ['Hire country head', 'Provision systems', 'Launch operations'], modules: ['ai_hr', 'ai_operations'], expectedDurationHrs: 48, ownerRole: 'COO' },
      { name: 'Integration', actions: ['Consolidate into global entity', 'Update Knowledge Graph', 'Oracle Memory'], modules: ['oracle', 'knowledge_graph'], expectedDurationHrs: 16, ownerRole: 'Oracle' },
    ],
    successCriteria: ['Entity registered', 'Tax ID obtained', 'Bank account active', 'First transaction processed'],
    risks: ['Regulatory delays', 'Tax registration rejection', 'Banking onboarding slow'],
    estimatedDurationHrs: 216,
  },
  {
    type: 'payroll_cycle',
    name: 'Payroll Cycle Playbook',
    description: 'Run monthly payroll end-to-end with compliance and disbursement.',
    trigger: 'When the monthly payroll run date is within 3 days.',
    objective: 'Disburse accurate salaries with full PF/TDS/PT compliance.',
    phases: [
      { name: 'Preparation', actions: ['Verify attendance', 'Process leave', 'Compute variable pay'], modules: ['ai_hr'], expectedDurationHrs: 8, ownerRole: 'HR' },
      { name: 'Computation', actions: ['Compute gross', 'Calculate PF/TDS/PT', 'Net pay'], modules: ['payroll', 'ai_cfo'], expectedDurationHrs: 4, ownerRole: 'CFO' },
      { name: 'Compliance', actions: ['Validate PF/ESIC', 'TDS deposit', 'File returns'], modules: ['compliance_cloud'], expectedDurationHrs: 4, ownerRole: 'Compliance Agent' },
      { name: 'Disbursement', actions: ['Approve register', 'Bank file upload', 'Distribute payslips'], modules: ['banking', 'ai_cfo'], expectedDurationHrs: 2, ownerRole: 'CFO' },
      { name: 'Memory', actions: ['Record payroll in Oracle Memory'], modules: ['oracle'], expectedDurationHrs: 1, ownerRole: 'Oracle' },
    ],
    successCriteria: ['Salaries disbursed', 'PF/TDS deposited', 'Payslips distributed'],
    risks: ['Attendance errors', 'Compliance miss', 'Bank file rejection'],
    estimatedDurationHrs: 19,
  },
  {
    type: 'disaster_recovery',
    name: 'Disaster Recovery Playbook',
    description: 'Recover from a major incident — infrastructure, data and operations.',
    trigger: 'When a critical infrastructure failure or data loss is detected.',
    objective: 'Restore full operations within RTO/RPO targets.',
    phases: [
      { name: 'Assess', actions: ['Assess scope of failure', 'Identify affected systems', 'Notify executives'], modules: ['oracle', 'ai_cto'], expectedDurationHrs: 2, ownerRole: 'CTO' },
      { name: 'Restore', actions: ['Restore from backup', 'Failover to standby', 'Verify data integrity'], modules: ['ai_cto', 'execution_cloud'], expectedDurationHrs: 8, ownerRole: 'CTO' },
      { name: 'Validate', actions: ['Run smoke tests', 'Validate business data', 'Confirm transactions'], modules: ['data_intelligence', 'ai_operations'], expectedDurationHrs: 4, ownerRole: 'COO' },
      { name: 'Resume', actions: ['Resume operations', 'Replay missed events', 'Notify stakeholders'], modules: ['ai_operations', 'oracle'], expectedDurationHrs: 4, ownerRole: 'COO' },
      { name: 'Post-mortem', actions: ['Root cause analysis', 'Update runbook', 'Oracle Memory'], modules: ['oracle'], expectedDurationHrs: 4, ownerRole: 'Oracle' },
    ],
    successCriteria: ['All systems restored', 'Data integrity verified', 'Operations resumed', 'Post-mortem documented'],
    risks: ['Backup corruption', 'Extended downtime', 'Data loss beyond RPO'],
    estimatedDurationHrs: 22,
  },
  {
    type: 'incident_response',
    name: 'Incident Response Playbook',
    description: 'Respond to a detected incident — contain, investigate, resolve, learn.',
    trigger: 'When a new incident is detected with severity medium or higher.',
    objective: 'Contain and resolve the incident with minimal business impact.',
    phases: [
      { name: 'Triage', actions: ['Assess severity', 'Assign incident owner', 'Notify stakeholders'], modules: ['oracle'], expectedDurationHrs: 1, ownerRole: 'Oracle' },
      { name: 'Contain', actions: ['Isolate affected systems', 'Stop the bleeding', 'Preserve evidence'], modules: ['ai_operations', 'ai_cto'], expectedDurationHrs: 2, ownerRole: 'CTO' },
      { name: 'Investigate', actions: ['Root cause analysis', 'Impact assessment', 'Recovery plan'], modules: ['oracle', 'data_intelligence'], expectedDurationHrs: 4, ownerRole: 'Oracle' },
      { name: 'Recover', actions: ['Execute recovery plan', 'Validate recovery', 'Resume operations'], modules: ['ai_operations'], expectedDurationHrs: 4, ownerRole: 'COO' },
      { name: 'Learn', actions: ['Post-incident review', 'Update Knowledge Graph', 'Oracle Memory'], modules: ['oracle', 'knowledge_graph'], expectedDurationHrs: 2, ownerRole: 'Oracle' },
    ],
    successCriteria: ['Incident contained', 'Root cause identified', 'Recovery complete', 'Learnings recorded'],
    risks: ['Escalation during containment', 'Incomplete root cause', 'Recurrence'],
    estimatedDurationHrs: 13,
  },
  {
    type: 'acquisition',
    name: 'Acquisition Playbook',
    description: 'Execute an acquisition — diligence, valuation, integration.',
    trigger: 'When the board approves an acquisition target.',
    objective: 'Complete the acquisition with full integration and compliance.',
    phases: [
      { name: 'Diligence', actions: ['Financial diligence', 'Legal diligence', 'IT diligence'], modules: ['ai_cfo', 'ai_legal', 'ai_cto'], expectedDurationHrs: 120, ownerRole: 'CFO' },
      { name: 'Valuation', actions: ['Valuation models', 'Synergy analysis', 'Digital Twin sim'], modules: ['digital_twin', 'ai_cfo'], expectedDurationHrs: 40, ownerRole: 'CFO' },
      { name: 'Negotiation', actions: ['Term sheet', 'Definitive agreement', 'Board approval'], modules: ['ai_legal', 'ai_ceo'], expectedDurationHrs: 32, ownerRole: 'CEO' },
      { name: 'Closing', actions: ['Sign agreement', 'Regulatory approval', 'Payment'], modules: ['ai_legal', 'banking'], expectedDurationHrs: 24, ownerRole: 'Legal' },
      { name: 'Integration', actions: ['Systems integration', 'Process harmonization', 'Oracle Memory'], modules: ['ai_operations', 'oracle'], expectedDurationHrs: 160, ownerRole: 'COO' },
    ],
    successCriteria: ['Agreement signed', 'Regulatory approval', 'Integration complete'],
    risks: ['Diligence findings', 'Regulatory rejection', 'Integration failure'],
    estimatedDurationHrs: 376,
  },
  {
    type: 'product_launch',
    name: 'Product Launch Playbook',
    description: 'Launch a new product — development, testing, marketing, rollout.',
    trigger: 'When a new product is approved for launch.',
    objective: 'Launch the product successfully with market readiness.',
    phases: [
      { name: 'Development', actions: ['Build via AI Software Factory', 'Code review', 'Security review'], modules: ['ai_software_factory', 'ai_cto'], expectedDurationHrs: 80, ownerRole: 'CTO' },
      { name: 'Testing', actions: ['QA testing', 'User acceptance', 'Performance testing'], modules: ['ai_software_factory'], expectedDurationHrs: 32, ownerRole: 'CTO' },
      { name: 'Marketing', actions: ['Campaign launch', 'Content creation', 'Lead gen'], modules: ['ai_marketing'], expectedDurationHrs: 24, ownerRole: 'Marketing' },
      { name: 'Rollout', actions: ['Deploy to production', 'Monitor metrics', 'Customer onboarding'], modules: ['ai_operations', 'crm'], expectedDurationHrs: 16, ownerRole: 'COO' },
      { name: 'Memory', actions: ['Record launch in Oracle Memory', 'Update Business Graph'], modules: ['oracle'], expectedDurationHrs: 4, ownerRole: 'Oracle' },
    ],
    successCriteria: ['Product deployed', 'Marketing live', 'First customers onboarded'],
    risks: ['Build delays', 'Testing failures', 'Low market adoption'],
    estimatedDurationHrs: 156,
  },
];

// ─── Seed canonical playbooks if none exist ──────────────────────────────────
export async function seedPlaybooksIfMissing(): Promise<void> {
  return cached('cn:playbooks:seed', TTL.LONG, async () => {
    const existing = await safeCount(() => db.commandPlaybook.count());
    if (existing >= PLAYBOOK_DEFS.length) return;
    for (const def of PLAYBOOK_DEFS) {
      const key = `playbook-${def.type}`;
      const found = await safeCount(() => db.commandPlaybook.count({ where: { playbookKey: key } }));
      if (found > 0) continue;
      await db.commandPlaybook.create({
        data: {
          playbookKey: key,
          name: def.name,
          type: def.type,
          description: def.description,
          trigger: def.trigger,
          objective: def.objective,
          phases: JSON.stringify(def.phases),
          successCriteria: JSON.stringify(def.successCriteria),
          risks: JSON.stringify(def.risks),
          estimatedDurationHrs: def.estimatedDurationHrs,
          isActive: true,
        },
      });
    }
  });
}

// ─── Map a CommandPlaybook Prisma row → CommandPlaybook ──────────────────────
function mapPlaybook(row: {
  id: string; playbookKey: string; name: string; type: string; description: string;
  trigger: string; objective: string; phases: string; successCriteria: string;
  risks: string; estimatedDurationHrs: number; lastUsedAt: Date | null;
  useCount: number; successRate: number; isActive: boolean;
  createdAt: Date; updatedAt: Date;
}): CommandPlaybook {
  return {
    id: row.id,
    playbookKey: row.playbookKey,
    name: row.name,
    type: row.type as PlaybookType,
    description: row.description,
    trigger: row.trigger,
    objective: row.objective,
    phases: parseJson<PlaybookPhase[]>(row.phases, []),
    successCriteria: parseJson<string[]>(row.successCriteria, []),
    risks: parseJson<string[]>(row.risks, []),
    estimatedDurationHrs: row.estimatedDurationHrs,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    useCount: row.useCount,
    successRate: row.successRate,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Get all playbooks (live from CommandPlaybook). */
export async function getPlaybooks(): Promise<CommandPlaybook[]> {
  return cached<CommandPlaybook[]>('cn:playbooks:all', TTL.MEDIUM, async () => {
    await seedPlaybooksIfMissing();
    const rows = await safeFindMany(() => db.commandPlaybook.findMany({ orderBy: { type: 'asc' } }));
    return rows.map(mapPlaybook);
  });
}

/** Playbook summary — aggregated from real CommandPlaybook rows. */
export async function getPlaybookSummary(): Promise<PlaybookSummary> {
  return cached<PlaybookSummary>('cn:playbooks:summary', TTL.MEDIUM, async () => {
    await seedPlaybooksIfMissing();
    const rows = await safeFindMany(() => db.commandPlaybook.findMany());
    const active = rows.filter((r) => r.isActive);
    const totalUses = rows.reduce((s, r) => s + r.useCount, 0);
    const avgSuccess = rows.length > 0
      ? Math.round((rows.reduce((s, r) => s + r.successRate, 0) / rows.length) * 100) / 100
      : 0;
    const lastUsed = rows
      .map((r) => r.lastUsedAt)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      totalPlaybooks: rows.length,
      byType: countBy(rows, (r) => r.type),
      activePlaybooks: active.length,
      totalUses,
      avgSuccessRate: avgSuccess,
      lastUsedAt: lastUsed?.toISOString() ?? null,
    };
  });
}

/**
 * Oracle auto-selects the correct playbook based on a situation.
 * Simple keyword matching against the playbook trigger + type + objective.
 */
export async function selectPlaybook(situation: string): Promise<CommandPlaybook | null> {
  const playbooks = await getPlaybooks();
  const lower = situation.toLowerCase();
  // score each playbook by keyword overlap
  let best: { playbook: CommandPlaybook; score: number } | null = null;
  for (const p of playbooks) {
    const haystack = `${p.type} ${p.name} ${p.trigger} ${p.objective}`.toLowerCase();
    let score = 0;
    for (const word of lower.split(/\s+/)) {
      if (word.length < 3) continue;
      if (haystack.includes(word)) score += 1;
    }
    if (!best || score > best.score) best = { playbook: p, score };
  }
  return best && best.score > 0 ? best.playbook : (playbooks[0] ?? null);
}

/** Mark a playbook as used (increments useCount, sets lastUsedAt). */
export async function markPlaybookUsed(playbookId: string, success: boolean): Promise<CommandPlaybook | null> {
  const row = await db.commandPlaybook.findUnique({ where: { id: playbookId } });
  if (!row) return null;
  const newUseCount = row.useCount + 1;
  // running success rate: weighted (90% history + 10% new outcome)
  const newSuccessRate = row.useCount === 0
    ? (success ? 1 : 0)
    : Math.round((row.successRate * 0.9 + (success ? 0.1 : 0)) * 100) / 100;
  const updated = await db.commandPlaybook.update({
    where: { id: playbookId },
    data: { useCount: newUseCount, successRate: newSuccessRate, lastUsedAt: new Date() },
  });
  return mapPlaybook(updated);
}
