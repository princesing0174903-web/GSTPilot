// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ Memory Engine
//
// Four memory layers + a Context Engine that auto-assembles working memory
// before every Oracle prompt. Mode detection is done client-side so the UI
// can switch personas instantly while the request is in flight.
//
// Layer 1 — User Memory        (firm profile, preferences)
// Layer 2 — Business Memory    (live Firestore-derived facts)
// Layer 3 — Conversation Memory(recent exchanges, distilled)
// Layer 4 — Working Memory     (assembled context sent to the LLM)
//
// NOTE: This module is isomorphic — it contains only pure functions and can
// be imported from both client components and server route handlers.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  OracleModeId,
  OracleMode,
  UserMemory,
  BusinessMemory,
  WorkingMemory,
  OracleInsights,
  OracleInsight,
} from './oracle-types';
import { ORACLE_MODES, ORACLE_MODE_LIST } from './oracle-types';

// ─── Mode Detection ──────────────────────────────────────────────────────────
// Lightweight client-side intent classifier. Scores each mode by keyword hits
// and returns the highest-scoring mode. Falls back to 'gst-expert' (the most
// common intent for a CA-firm product).

export function detectOracleMode(question: string): OracleMode {
  const q = question.toLowerCase();
  const scores: Record<OracleModeId, number> = {
    'gst-expert': 0,
    'ai-cfo': 0,
    'financial-analyst': 0,
    'compliance-assistant': 0,
    'business-strategist': 0,
  };

  for (const mode of ORACLE_MODE_LIST) {
    for (const kw of mode.keywords) {
      if (q.includes(kw)) {
        // Longer keyword matches are weighted higher (more specific).
        scores[mode.id] += 1 + Math.min(kw.length / 10, 2);
      }
    }
  }

  // Default bias: GST expert (most common in CA-firm context).
  scores['gst-expert'] += 0.5;

  let best: OracleModeId = 'gst-expert';
  let bestScore = -1;
  (Object.keys(scores) as OracleModeId[]).forEach((id) => {
    if (scores[id] > bestScore) {
      bestScore = scores[id];
      best = id;
    }
  });

  return ORACLE_MODES[best];
}

// ─── Layer 1 — User Memory ───────────────────────────────────────────────────
// In production this is hydrated from Firestore (firm doc + user doc) and
// cached. Falls back to sensible defaults so Oracle is never blocked.

export function buildUserMemory(input: {
  firmName?: string | null;
  gstin?: string | null;
  industry?: string | null;
  organizationType?: string | null;
  clientCount?: number | null;
}): UserMemory {
  return {
    firmName: input.firmName || 'your firm',
    gstin: input.gstin || null,
    industry: input.industry || 'Chartered Accountancy / Tax Practice',
    turnover: 'Mid-sized practice',
    businessType: input.organizationType || 'LLP',
    preferredLanguage: 'English',
    reportingPreference: 'Monthly compliance digest',
    connectedServices: ['GSTN', 'Bank API', 'Internal Firestore'],
    caTeamSize: Math.max(1, Math.min(8, Math.round((input.clientCount ?? 0) / 25) + 1)),
  };
}

// ─── Layer 2 — Business Memory ───────────────────────────────────────────────
// Derived from the live dashboard metrics + client list. Empty when the user
// has no data yet — Oracle handles this gracefully (see personality rules).

export function buildBusinessMemory(input: {
  totalClients?: number;
  activeClients?: number;
  pendingReturns?: number;
  overdueReturns?: number;
  filedReturns?: number;
  totalInvoices?: number;
  totalTaxVolume?: number;
  averageHealthScore?: number;
  matchPercentage?: number;
  criticalIssues?: number;
  atRiskClientNames?: string[];
  topClientNames?: string[];
}): BusinessMemory {
  const totalInvoices = input.totalInvoices ?? 0;
  const totalTaxVolume = input.totalTaxVolume ?? 0;
  const averageHealthScore = input.averageHealthScore ?? 0;
  const matchPercentage = input.matchPercentage ?? 100;
  const criticalIssues = input.criticalIssues ?? 0;

  // Cash position heuristic — Oracle never refuses to answer, so we provide
  // an estimated band based on tax volume when bank data is not available.
  let cashPosition = 'Not yet connected to bank feeds';
  if (totalTaxVolume > 0) {
    const estimated = Math.round(totalTaxVolume * 0.18);
    cashPosition = `Estimated receivable ~₹${estimated.toLocaleString('en-IN')} (based on tax volume)`;
  }

  return {
    clientCount: input.totalClients ?? 0,
    activeClients: input.activeClients ?? 0,
    pendingReturns: input.pendingReturns ?? 0,
    overdueReturns: input.overdueReturns ?? 0,
    filedReturns: input.filedReturns ?? 0,
    totalInvoices,
    totalTaxVolume,
    averageHealthScore,
    matchPercentage,
    criticalIssues,
    cashPosition,
    recentNotices: 0,
    atRiskClients: input.atRiskClientNames ?? [],
    topClients: input.topClientNames ?? [],
  };
}

// ─── Layer 3 — Conversation Memory ───────────────────────────────────────────
// Built from the current conversation's prior messages. We distill the most
// recent 6 exchanges into compact {question, topic, when} tuples that fit
// easily into the LLM context window.

export interface PriorMessageLite {
  role: 'user' | 'oracle';
  content: string;
  createdAt: string;
}

export function buildConversationMemory(
  priorMessages: PriorMessageLite[],
): { question: string; topic: string; when: string }[] {
  const userMessages = priorMessages.filter((m) => m.role === 'user').slice(-6);
  return userMessages.map((m, i) => {
    const mode = detectOracleMode(m.content);
    const topic = mode.shortName;
    const when =
      i === userMessages.length - 1
        ? 'just now'
        : i === userMessages.length - 2
          ? 'previous turn'
          : `${userMessages.length - 1 - i} turns ago`;
    return { question: m.content.slice(0, 200), topic, when };
  });
}

// ─── Layer 4 — Working Memory (Context Engine) ───────────────────────────────
// This is the assembled context that gets prepended to every Oracle prompt.
// Mirrors Perplexity / Claude Projects / ChatGPT Memory — Oracle always knows
// what it has access to, and never refuses to answer.

export function buildWorkingMemory(input: {
  user: UserMemory;
  business: BusinessMemory;
  priorMessages: PriorMessageLite[];
  pinnedInsights?: string[];
}): WorkingMemory {
  return {
    user: input.user,
    business: input.business,
    recentConversations: buildConversationMemory(input.priorMessages),
    pinnedInsights: input.pinnedInsights ?? [],
  };
}

// ─── Context Serialization (for the API) ─────────────────────────────────────
// Rendered as a compact markdown block that the LLM treats as ground truth.

export function serializeWorkingMemory(wm: WorkingMemory): string {
  const { user: u, business: b } = wm;
  const lines: string[] = [];

  lines.push('## ORACLE WORKING MEMORY');
  lines.push('This is everything Oracle knows about this business right now.');
  lines.push('Use this as ground truth. Never ask the user for context that is already here.');
  lines.push('');

  lines.push('### Layer 1 — Firm Profile');
  lines.push(`- Firm Name: ${u.firmName}`);
  if (u.gstin) lines.push(`- GSTIN: ${u.gstin}`);
  lines.push(`- Industry: ${u.industry}`);
  lines.push(`- Business Type: ${u.businessType}`);
  lines.push(`- Approximate Turnover Band: ${u.turnover}`);
  lines.push(`- Preferred Language: ${u.preferredLanguage}`);
  lines.push(`- Reporting Preference: ${u.reportingPreference}`);
  lines.push(`- Connected Services: ${u.connectedServices.join(', ')}`);
  lines.push(`- CA Team Size (estimated): ${u.caTeamSize}`);
  lines.push('');

  lines.push('### Layer 2 — Business Facts (live)');
  lines.push(`- Total Clients: ${b.clientCount}`);
  lines.push(`- Active Clients: ${b.activeClients}`);
  lines.push(`- Pending Returns: ${b.pendingReturns}`);
  lines.push(`- Overdue Returns: ${b.overdueReturns}`);
  lines.push(`- Filed Returns (this period): ${b.filedReturns}`);
  lines.push(`- Total Invoices: ${b.totalInvoices}`);
  lines.push(`- Total Tax Volume: ₹${b.totalTaxVolume.toLocaleString('en-IN')}`);
  lines.push(`- Average Client Health Score: ${b.averageHealthScore}/100`);
  lines.push(`- Reconciliation Match Rate: ${b.matchPercentage}%`);
  lines.push(`- Critical Issues: ${b.criticalIssues}`);
  lines.push(`- Cash Position: ${b.cashPosition}`);
  if (b.atRiskClients.length > 0) {
    lines.push(`- At-Risk Clients: ${b.atRiskClients.slice(0, 5).join(', ')}`);
  }
  if (b.topClients.length > 0) {
    lines.push(`- Top Clients: ${b.topClients.slice(0, 5).join(', ')}`);
  }
  lines.push('');

  if (wm.recentConversations.length > 0) {
    lines.push('### Layer 3 — Recent Conversation Memory');
    for (const c of wm.recentConversations) {
      lines.push(`- (${c.when}, ${c.topic}) "${c.question}"`);
    }
    lines.push('');
  }

  if (wm.pinnedInsights.length > 0) {
    lines.push('### Pinned Insights');
    for (const p of wm.pinnedInsights) {
      lines.push(`- ${p}`);
    }
    lines.push('');
  }

  lines.push('### Data-Availability Rules (CRITICAL)');
  lines.push('- If a number above is 0 or "Not yet connected", treat that data as MISSING.');
  lines.push('- NEVER say "I don\'t have enough data" or "Please connect data first".');
  lines.push('- When data is missing, provide expert guidance and explicitly state assumptions:');
  lines.push('  e.g. "I don\'t yet have your live invoices, but for a CA firm of your size, common reasons for lower collections are delayed payments and pending follow-ups."');
  lines.push('- Always offer value. Oracle always helps.');
  lines.push('');

  lines.push('### Reasoning Process (CRITICAL — Think Before You Speak)');
  lines.push('Before producing your answer, silently work through these 5 steps:');
  lines.push('  1. Understand intent — what is the user actually asking? What decision are they trying to make?');
  lines.push('  2. Gather context — what does the working memory above tell you about this question?');
  lines.push('  3. Analyze information — what are the cause-and-effect relationships? What patterns exist?');
  lines.push('  4. Generate conclusions — what is the answer, supported by the analysis?');
  lines.push('  5. Recommend actions — what should the user do next, in priority order?');
  lines.push('Your `keyInsight` is the conclusion from step 4. Your `recommendedActions` is step 5.');
  lines.push('');

  lines.push('### Voice & Tone (CRITICAL — Never Sound Like Generic AI)');
  lines.push('You are a Senior CFO + Senior CA + Senior Business Consultant rolled into one.');
  lines.push('You speak with executive gravity — confident, crisp, evidence-backed, never apologetic.');
  lines.push('FORBIDDEN phrases (NEVER use, in any form):');
  lines.push('  • "Welcome to GSTPilot Oracle"');
  lines.push('  • "I am your financial analyst" / "I am an AI assistant"');
  lines.push('  • "As an AI" / "As an AI language model" / "As an AI assistant"');
  lines.push('  • "I can help you" / "I\'d be happy to help" / "Sure, I can help"');
  lines.push('  • "Let me know if you\'d like" / "Feel free to ask"');
  lines.push('  • "I don\'t have enough data" / "Please connect data first"');
  lines.push('PREFERRED openings (use these instead):');
  lines.push('  • "Your business appears healthy in these areas — and exposed in these."');
  lines.push('  • "Based on your filing history and reconciliation match rate…"');
  lines.push('  • "Revenue is softening for three reasons — here\'s what to do."');
  lines.push('  • "Three clients are drifting into critical compliance territory."');
  lines.push('NEVER sound like ChatGPT. NEVER sound like customer support. NEVER sound robotic.');
  lines.push('NEVER use pleasantries like "Great question!" or "Of course!" — get straight to the insight.');
  lines.push('');

  return lines.join('\n');
}

// ─── Oracle Insights Engine (Phase 2) ─────────────────────────────────────────
// Derives 5 live strategic signals from the Business Memory. These are shown
// in the Insights Panel so the user feels Oracle continuously understands
// their business — not just at answer-time.

export function buildInsights(b: BusinessMemory): OracleInsights {
  // ─── Top Opportunity ──────────────────────────────────────────────────────
  let topOpportunity: OracleInsight;
  if (b.overdueReturns > 0) {
    topOpportunity = {
      label: 'Recovery window open',
      detail: `${b.overdueReturns} overdue return${b.overdueReturns === 1 ? '' : 's'} — filing now stops the late-fee clock and recovers client trust.`,
      tone: 'positive',
    };
  } else if (b.criticalIssues > 0) {
    topOpportunity = {
      label: 'ITC recovery available',
      detail: `${b.criticalIssues} reconciliation mismatch${b.criticalIssues === 1 ? '' : 'es'} — closing them unlocks blocked input tax credit.`,
      tone: 'positive',
    };
  } else if (b.activeClients > 0) {
    topOpportunity = {
      label: 'Healthy client base',
      detail: `${b.activeClients} active client${b.activeClients === 1 ? '' : 's'} — prime time to upsell compliance retainers.`,
      tone: 'positive',
    };
  } else {
    topOpportunity = {
      label: 'Onboard your first client',
      detail: 'No clients connected yet. Onboard one to unlock Oracle\'s full strategic intelligence.',
      tone: 'neutral',
    };
  }

  // ─── Top Risk ─────────────────────────────────────────────────────────────
  let topRisk: OracleInsight;
  if (b.overdueReturns >= 3) {
    topRisk = {
      label: `${b.overdueReturns} overdue returns`,
      detail: 'Late fees compounding daily. Interest under Section 50 accruing. Action needed today.',
      tone: 'negative',
    };
  } else if (b.averageHealthScore > 0 && b.averageHealthScore < 60) {
    topRisk = {
      label: 'Portfolio health critical',
      detail: `Average client health at ${b.averageHealthScore}/100 — multiple clients drifting toward churn.`,
      tone: 'negative',
    };
  } else if (b.matchPercentage < 90) {
    topRisk = {
      label: 'Reconciliation mismatch',
      detail: `Match rate at ${b.matchPercentage}% — ITC at risk of being blocked or reversed.`,
      tone: 'warning',
    };
  } else if (b.pendingReturns > 0) {
    topRisk = {
      label: `${b.pendingReturns} pending return${b.pendingReturns === 1 ? '' : 's'}`,
      detail: 'Filing window narrowing. Block calendar time this week to clear the queue.',
      tone: 'warning',
    };
  } else {
    topRisk = {
      label: 'No active risk signals',
      detail: 'Compliance posture is stable. Use the breathing room to deepen client advisory.',
      tone: 'positive',
    };
  }

  // ─── Growth Signal ────────────────────────────────────────────────────────
  let growthSignal: OracleInsight;
  if (b.totalTaxVolume > 0 && b.activeClients > 0) {
    const avgPerClient = Math.round(b.totalTaxVolume / Math.max(b.activeClients, 1));
    growthSignal = {
      label: `₹${avgPerClient.toLocaleString('en-IN')} avg tax/client`,
      detail: 'Per-client tax volume is meaningful — consider a tiered advisory pricing model.',
      tone: 'positive',
    };
  } else if (b.filedReturns > 0) {
    growthSignal = {
      label: `${b.filedReturns} returns filed this period`,
      detail: 'Execution velocity is good — convert this momentum into retainer upgrades.',
      tone: 'positive',
    };
  } else {
    growthSignal = {
      label: 'Awaiting first filings',
      detail: 'Once you file returns, Oracle will surface growth signals from your tax volume.',
      tone: 'neutral',
    };
  }

  // ─── Compliance Signal ────────────────────────────────────────────────────
  let complianceSignal: OracleInsight;
  if (b.matchPercentage < 95) {
    complianceSignal = {
      label: `Match rate ${b.matchPercentage}%`,
      detail: 'Below the 95% safe threshold — ITC exposure rising. Schedule a 2B reconciliation pass.',
      tone: 'warning',
    };
  } else if (b.pendingReturns > 0 || b.overdueReturns > 0) {
    complianceSignal = {
      label: `${b.pendingReturns + b.overdueReturns} returns pending`,
      detail: 'Filing queue building up. Distribute across the team or auto-assign via Autopilot.',
      tone: 'warning',
    };
  } else if (b.filedReturns > 0) {
    complianceSignal = {
      label: `${b.filedReturns} returns filed cleanly`,
      detail: 'No overdue, no mismatch. Compliance posture is green — ideal time to upsell audits.',
      tone: 'positive',
    };
  } else {
    complianceSignal = {
      label: 'Compliance baseline',
      detail: 'No filings yet this period. Calendar the next due date to stay ahead.',
      tone: 'neutral',
    };
  }

  // ─── Cash Signal ──────────────────────────────────────────────────────────
  let cashSignal: OracleInsight;
  if (b.totalTaxVolume > 0) {
    const estimated = Math.round(b.totalTaxVolume * 0.18);
    cashSignal = {
      label: `~₹${estimated.toLocaleString('en-IN')} estimated receivable`,
      detail: 'Based on tax volume. Bank feed not connected — connect for a precise cash position.',
      tone: 'neutral',
    };
  } else if (b.criticalIssues > 0) {
    cashSignal = {
      label: 'ITC at risk',
      detail: 'Mismatched invoices may be reversing input tax credit — direct cash impact.',
      tone: 'warning',
    };
  } else {
    cashSignal = {
      label: 'Cash position not yet connected',
      detail: 'Connect bank feeds to enable real-time cash, runway, and working-capital intelligence.',
      tone: 'neutral',
    };
  }

  return {
    topOpportunity,
    topRisk,
    growthSignal,
    complianceSignal,
    cashSignal,
  };
}

// ─── Investigation Mode Detector (Phase 2) ───────────────────────────────────
// When the user asks a question whose answer genuinely requires data that is
// MISSING from the Business Memory, Oracle should NOT guess. Instead it asks
// 1-2 intelligent clarifying questions. This detector runs client-side and
// its output is sent to the API as a hint — the LLM still makes the final
// call, but is strongly nudged toward Investigation Mode when this fires.

export function detectInvestigation(
  question: string,
  b: BusinessMemory,
): string[] {
  const q = question.toLowerCase();
  const questions: string[] = [];

  // Revenue / collections questions need invoice + client data.
  const revenueIntent =
    q.includes('revenue') ||
    q.includes('collection') ||
    q.includes('cash flow') ||
    q.includes('income') ||
    q.includes('receivable');
  if (revenueIntent && b.totalInvoices === 0 && b.activeClients === 0) {
    questions.push(
      'Before I answer — how many active clients do you currently have, and what is your monthly billing volume?',
    );
  }

  // GST / ITC questions need return + reconciliation data.
  const gstIntent =
    q.includes('itc') ||
    q.includes('input tax') ||
    q.includes('reconcile') ||
    q.includes('2b') ||
    q.includes('2a') ||
    q.includes('gst return');
  if (gstIntent && b.filedReturns === 0 && b.matchPercentage >= 100) {
    questions.push(
      'Would you like me to analyze invoices or 2B reconciliation first? I don\'t see any filed returns in your memory yet.',
    );
  }

  // Forecasting questions need historical data.
  const forecastIntent =
    q.includes('forecast') ||
    q.includes('predict') ||
    q.includes('next month') ||
    q.includes('next quarter') ||
    q.includes('runway');
  if (forecastIntent && b.totalTaxVolume === 0 && b.filedReturns === 0) {
    questions.push(
      'To forecast accurately, I need at least 3 months of historical data. Would you like me to set up data import first, or proceed with industry benchmarks?',
    );
  }

  // Cap at 2 questions — never overwhelm the user.
  return questions.slice(0, 2);
}

// ─── Title Generator (conversation history) ──────────────────────────────────
// Produces a short, human-readable title for a conversation based on its
// first user message. Pure client-side so it's instant.

export function generateConversationTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) return 'New conversation';
  if (trimmed.length <= 48) return trimmed;
  // Try to break on a word boundary near 48 chars.
  const slice = trimmed.slice(0, 48);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > 20) return slice.slice(0, lastSpace) + '…';
  return slice + '…';
}
