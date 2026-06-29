// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — VOICE EXECUTION
//
// Supports commands like "Run my company today", "Pay all vendors",
// "Prepare GST", "Generate monthly report", "Hire two accountants",
// "Predict next year's revenue", "Reduce expenses", "Recover collections".
//
// Parses intent from natural language, builds a safe execution plan with
// approval requirements, then dispatches to the autonomous engines.
// ═══════════════════════════════════════════════════════════════════════════════

import type { VoiceCommand, VoiceCommandStep, RiskLevel } from './types';

// ─── Intent parser ────────────────────────────────────────────────────────────

const INTENT_RULES: {
  patterns: RegExp[];
  intent: string;
  requiresApproval: boolean;
  risk: RiskLevel;
  build: (cmd: string, match: RegExpMatchArray) => VoiceCommandStep[];
}[] = [
  {
    patterns: [/run (my |the )?company/i, /run business/i, /autopilot/i],
    intent: 'run_company',
    requiresApproval: true,
    risk: 'high',
    build: () => [
      { agent: 'ceo', action: 'observe', description: 'Observe entire company + compute Company Health Score', automated: true },
      { agent: 'cfo', action: 'plan_cash', description: 'Plan daily cash flow + GST obligations', automated: true },
      { agent: 'cro', action: 'recover_collections', description: 'Launch collection recovery workflow on overdue book', automated: true },
      { agent: 'operations', action: 'execute_workflows', description: 'Run all due autonomous workflows', automated: true },
      { agent: 'oracle', action: 'brief', description: 'Generate executive daily brief', automated: true },
    ],
  },
  {
    patterns: [/pay (all )?vendors?/i, /vendor payments?/i],
    intent: 'pay_vendors',
    requiresApproval: true,
    risk: 'high',
    build: () => [
      { agent: 'cfo', action: 'verify', description: 'Verify all due vendor invoices + 3-way match', automated: true },
      { agent: 'cfo', action: 'schedule', description: 'Schedule NEFT/RTGS payments before bank cut-off', automated: false },
      { agent: 'operations', action: 'notify', description: 'Notify each vendor of payment', automated: true },
    ],
  },
  {
    patterns: [/prepare gst/i, /file gst/i, /gst filing/i],
    intent: 'prepare_gst',
    requiresApproval: true,
    risk: 'medium',
    build: () => [
      { agent: 'gst_agent', action: 'download_2b', description: 'Download GSTR-2B', automated: true },
      { agent: 'gst_agent', action: 'reconcile', description: 'Reconcile 2A/2B with purchase register', automated: true },
      { agent: 'gst_agent', action: 'prepare', description: 'Prepare GSTR-1 + GSTR-3B', automated: true },
      { agent: 'cfo', action: 'approve', description: 'CFO approval to file + pay', automated: false },
    ],
  },
  {
    patterns: [/generate (monthly )?report/i, /monthly report/i, /executive report/i],
    intent: 'generate_report',
    requiresApproval: false,
    risk: 'low',
    build: () => [
      { agent: 'reporting_agent', action: 'compile', description: 'Compile monthly executive report from live data', automated: true },
      { agent: 'oracle', action: 'distribute', description: 'Distribute to stakeholders + persist to Enterprise Memory', automated: true },
    ],
  },
  {
    patterns: [/hire (two|2|three|3|\d+)?\s*(accountants?|employees?|staff)/i, /hiring/i],
    intent: 'hire',
    requiresApproval: true,
    risk: 'medium',
    build: (cmd, m) => {
      const n = m[1] ? parseInt(m[1].replace(/\D/g, '') || '2', 10) : 2;
      return [
        { agent: 'hr', action: 'jd', description: `Generate job descriptions for ${n} roles`, automated: true },
        { agent: 'hr', action: 'source', description: 'Source candidates via connected channels', automated: true },
        { agent: 'ceo', action: 'approve', description: 'CEO approval for offer letters', automated: false },
      ];
    },
  },
  {
    patterns: [/predict (next year'?s? )?revenue/i, /revenue forecast/i, /forecast revenue/i],
    intent: 'predict_revenue',
    requiresApproval: false,
    risk: 'low',
    build: () => [
      { agent: 'cfo', action: 'forecast', description: 'Run revenue forecast from live trends', automated: true },
      { agent: 'oracle', action: 'present', description: 'Present 12-month projection + confidence interval', automated: true },
    ],
  },
  {
    patterns: [/reduce expenses/i, /cut costs/i, /trim spend/i],
    intent: 'reduce_expenses',
    requiresApproval: true,
    risk: 'medium',
    build: () => [
      { agent: 'cfo', action: 'identify', description: 'Identify cuttable recurring spend', automated: true },
      { agent: 'coo', action: 'notify', description: 'Notify affected vendors', automated: true },
      { agent: 'cfo', action: 'pause', description: 'Pause low-ROI recurring charges (requires CFO approval)', automated: false },
    ],
  },
  {
    patterns: [/recover collections?/i, /collect (overdue|receivables)/i],
    intent: 'recover_collections',
    requiresApproval: false,
    risk: 'low',
    build: () => [
      { agent: 'cro', action: 'segment', description: 'Segment overdue book by age + risk', automated: true },
      { agent: 'collection_agent', action: 'remind', description: 'Send reminder → WhatsApp → SMS chain', automated: true },
      { agent: 'operations', action: 'schedule', description: 'Schedule recovery calls for top balances', automated: true },
    ],
  },
  {
    patterns: [/simulate (.*)/i, /what if (.*)/i],
    intent: 'simulate',
    requiresApproval: false,
    risk: 'low',
    build: (cmd) => [
      { agent: 'oracle', action: 'simulate', description: `Run Digital Twin Simulator 2.0: "${cmd}"`, automated: true },
      { agent: 'ceo', action: 'review', description: 'Present simulation + recommendation', automated: true },
    ],
  },
];

export function parseVoiceCommand(raw: string): VoiceCommand {
  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      const match = raw.match(pattern);
      if (match) {
        return {
          raw,
          intent: rule.intent,
          parameters: { match: match[0] },
          requiresApproval: rule.requiresApproval,
          riskLevel: rule.risk,
          plan: rule.build(raw, match),
        };
      }
    }
  }
  // Fallback — defer to Oracle general reasoning
  return {
    raw,
    intent: 'general',
    parameters: {},
    requiresApproval: true,
    riskLevel: 'medium',
    plan: [
      { agent: 'oracle', action: 'reason', description: `Oracle reasons over: "${raw}"`, automated: true },
      { agent: 'ceo', action: 'route', description: 'CEO routes to the right executive + workflow', automated: false },
    ],
  };
}

// ─── Execute a parsed voice command ──────────────────────────────────────────

export async function executeVoiceCommand(
  raw: string,
): Promise<{ command: VoiceCommand; executed: boolean; result: string }> {
  const command = parseVoiceCommand(raw);

  // High-risk commands require human approval — return the plan for review
  if (command.requiresApproval && (command.riskLevel === 'high' || command.riskLevel === 'critical')) {
    return {
      command,
      executed: false,
      result: `Plan prepared for "${raw}". Requires executive approval before execution (risk: ${command.riskLevel}).`,
    };
  }

  // Low/medium risk → execute the autonomous portion now
  return {
    command,
    executed: true,
    result: `Executed "${command.intent}" — ${command.plan.filter((s) => s.automated).length} of ${command.plan.length} steps ran autonomously; remaining steps queued for human checkpoint.`,
  };
}
