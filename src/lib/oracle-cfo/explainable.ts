// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ — Explainable AI Layer
//
// Structures every answer with the 6 mandatory explainability fields:
//   1. WHY            — the core reasoning (1-2 sentences)
//   2. Supporting records — the actual database records used
//   3. Confidence     — calibrated 0-1 score with rationale
//   4. Calculation    — explicit math (no black-box numbers)
//   5. Risks          — what could go wrong if recommendations are followed
//   6. Alternatives   — other valid approaches with trade-offs
//
// Also computes confidence from data availability + reasoning step success rate.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BusinessContext, ReasoningStep, SupportingRecord, CFOAnswerParts } from './types';
import type { ReasoningResult } from './reasoning';

export interface ExplainableResult {
  confidence: number;
  confidenceRationale: string;
  alternatives: Array<{ option: string; tradeOff: string }>;
  risks: string[];
}

/**
 * Compute confidence score based on:
 *   - Data availability (more data = higher confidence)
 *   - Reasoning step success rate (more successful steps = higher confidence)
 *   - Whether the question references data we actually have
 */
export function computeConfidence(
  ctx: BusinessContext,
  reasoning: ReasoningResult,
  question: string,
): { confidence: number; rationale: string } {
  let confidence = 0.5; // baseline
  const factors: string[] = [];

  // Factor 1: Data availability (max +0.3)
  const availWeights: Record<string, number> = {
    complete: 0.3,
    partial: 0.2,
    sparse: 0.1,
    empty: 0,
  };
  const availBoost = availWeights[ctx.dataAvailability.overall] ?? 0;
  confidence += availBoost;
  factors.push(`${ctx.dataAvailability.overall} data availability (+${availBoost.toFixed(2)})`);

  // Factor 2: Reasoning step success rate (max +0.15)
  const totalSteps = reasoning.steps.length;
  const successSteps = reasoning.steps.filter((s) => s.status === 'success').length;
  const successRate = totalSteps > 0 ? successSteps / totalSteps : 0;
  const stepBoost = successRate * 0.15;
  confidence += stepBoost;
  factors.push(`${successSteps}/${totalSteps} reasoning steps succeeded (+${stepBoost.toFixed(2)})`);

  // Factor 3: Supporting records count (max +0.1)
  const recordsBoost = Math.min(0.1, reasoning.supportingRecords.length * 0.02);
  confidence += recordsBoost;
  factors.push(`${reasoning.supportingRecords.length} supporting records (+${recordsBoost.toFixed(2)})`);

  // Factor 4: Question-data relevance penalty (max -0.3)
  const q = question.toLowerCase();
  const askedAboutInvoices = q.includes('invoice') || q.includes('outstanding') || q.includes('overdue');
  const askedAboutGst = q.includes('gst') || q.includes('return') || q.includes('filing');
  const askedAboutBank = q.includes('bank') || q.includes('cash') || q.includes('balance');
  const askedAboutExpense = q.includes('expense') || q.includes('cost') || q.includes('profit');

  let penalty = 0;
  if (askedAboutInvoices && !ctx.dataAvailability.hasInvoices) {
    penalty += 0.15;
    factors.push('asked about invoices but no invoice data (-0.15)');
  }
  if (askedAboutGst && !ctx.dataAvailability.hasGstReturns) {
    penalty += 0.15;
    factors.push('asked about GST but no GST return data (-0.15)');
  }
  if (askedAboutBank && !ctx.dataAvailability.hasBankAccounts) {
    penalty += 0.1;
    factors.push('asked about bank/cash but no bank accounts connected (-0.10)');
  }
  if (askedAboutExpense && !ctx.dataAvailability.hasExpenses) {
    penalty += 0.1;
    factors.push('asked about expenses but no expense data (-0.10)');
  }
  confidence -= penalty;

  // Clamp
  confidence = Math.max(0.1, Math.min(0.97, confidence));

  return {
    confidence: Math.round(confidence * 100) / 100,
    rationale: factors.join('; '),
  };
}

/**
 * Generate alternative approaches for the question.
 */
export function generateAlternatives(
  ctx: BusinessContext,
  question: string,
  reasoning: ReasoningResult,
): Array<{ option: string; tradeOff: string }> {
  const q = question.toLowerCase();
  const alts: Array<{ option: string; tradeOff: string }> = [];

  if (q.includes('overdue') || q.includes('collect')) {
    alts.push({
      option: 'Send automated email reminders via WhatsApp',
      tradeOff: 'Fastest to deploy (5 min) but lower response rate (~30%) compared to phone calls.',
    });
    alts.push({
      option: 'Call top 3 overdue clients personally',
      tradeOff: 'Highest recovery rate (~70%) but time-intensive (~2 hours of your day).',
    });
    if (ctx.invoices.totalOverdue > 10000) {
      alts.push({
        option: 'Generate payment links for overdue invoices',
        tradeOff: 'Enables instant payment but Razorpay/Stripe fees apply (~2% per transaction).',
      });
    }
  } else if (q.includes('gst') || q.includes('filing')) {
    alts.push({
      option: 'File GST return yourself via GST portal',
      tradeOff: 'Free but requires 30-60 minutes of manual data entry and review.',
    });
    alts.push({
      option: 'Have Oracle prepare a draft return for your review',
      tradeOff: 'Saves 80% of the time but you must still review and file manually.',
    });
  } else if (q.includes('cash') || q.includes('flow')) {
    alts.push({
      option: 'Connect more bank accounts for complete cash visibility',
      tradeOff: 'Most accurate picture but requires bank API authorization (5-10 min per bank).',
    });
    alts.push({
      option: 'Use invoice outstanding as a proxy for cash position',
      tradeOff: 'No setup required but doesn\'t account for actual bank balances or pending vendor payments.',
    });
  }

  if (alts.length === 0) {
    alts.push({
      option: 'Ask VEYRO AI for a more specific analysis',
      tradeOff: 'More targeted question yields a more actionable recommendation.',
    });
  }

  return alts;
}

/**
 * Identify risks associated with the recommendations.
 */
export function identifyRisks(
  ctx: BusinessContext,
  question: string,
  reasoning: ReasoningResult,
): string[] {
  const q = question.toLowerCase();
  const risks: string[] = [];

  if (q.includes('collect') || q.includes('remind')) {
    if (ctx.invoices.totalOverdue > 0) {
      risks.push('Aggressive collection reminders may damage client relationships — escalate gradually.');
    }
    risks.push('GST law requires invoices to be issued within 30 days of supply — verify dates before sending reminders.');
  }

  if (q.includes('gst') || q.includes('file')) {
    if (ctx.gstReturns.overdue > 0) {
      risks.push(`Late filing attracts ₹200/day penalty + 10% tax after 30 days — ${ctx.gstReturns.overdue} returns are already overdue.`);
    }
    risks.push('GST returns once filed cannot be easily amended — review carefully before submission.');
  }

  if (q.includes('payment') || q.includes('link')) {
    risks.push('Payment link amounts are final — verify the invoice total before generating.');
    risks.push('Payment gateway fees (typically 2%) will be deducted from the collected amount.');
  }

  if (q.includes('expense') || q.includes('cost')) {
    risks.push('Cutting expenses too aggressively may impact operational capacity — prioritize discretionary spend.');
  }

  if (ctx.dataAvailability.overall === 'empty' || ctx.dataAvailability.overall === 'sparse') {
    risks.push('Limited data availability means recommendations are based on partial information — connect more data sources for higher confidence.');
  }

  if (risks.length === 0) {
    risks.push('Always verify critical financial decisions with a qualified Chartered Accountant before execution.');
  }

  return risks;
}

/**
 * Build the structured CFO answer parts (compatible with existing OracleMessage rendering).
 */
export function buildAnswerParts(
  question: string,
  ctx: BusinessContext,
  reasoning: ReasoningResult,
  aiBrief: { keyInsight: string; analysis: string },
  explainable: ExplainableResult,
): CFOAnswerParts {
  // Recommended actions = synthesized from reasoning findings
  const recommendedActions: string[] = [];
  for (const finding of reasoning.findings) {
    // Findings that contain actionable verbs become recommendations
    if (/(collect|send|file|prepare|connect|review|follow|generate|create|assign)/i.test(finding)) {
      recommendedActions.push(finding);
    }
  }
  // Dedupe + cap at 4
  const uniqueRecs = Array.from(new Set(recommendedActions)).slice(0, 4);

  // Next best step = the most urgent single action
  let nextBestStep = 'No urgent action needed — your business is in a stable state.';
  if (ctx.gstReturns.overdue > 0) {
    nextBestStep = `File ${ctx.gstReturns.overdue} overdue GST return(s) immediately to avoid penalty escalation.`;
  } else if (ctx.invoices.overdue > 0) {
    nextBestStep = `Send reminders for ${ctx.invoices.overdue} overdue invoice(s) totaling ₹${ctx.invoices.totalOverdue.toLocaleString('en-IN')}.`;
  } else if (ctx.compliance.upcomingDeadlines.length > 0 && ctx.compliance.upcomingDeadlines[0].daysLeft <= 7) {
    const d = ctx.compliance.upcomingDeadlines[0];
    nextBestStep = `Prepare ${d.title} — due in ${d.daysLeft} day(s).`;
  } else if (ctx.invoices.draft > 0) {
    nextBestStep = `Send ${ctx.invoices.draft} draft invoice(s) to clients to begin the collection cycle.`;
  }

  return {
    keyInsight: aiBrief.keyInsight,
    analysis: aiBrief.analysis,
    recommendedActions: uniqueRecs.length > 0 ? uniqueRecs : ['Review the analysis above and prioritize based on your business context.'],
    potentialRisks: explainable.risks,
    nextBestStep,
  };
}

/**
 * Parse the AI provider's response into { keyInsight, analysis }.
 * The provider is prompted to return markdown with a "## Key Insight" header
 * followed by "## Analysis". We parse those sections.
 */
export function parseAiBrief(rawText: string): { keyInsight: string; analysis: string } {
  // If the AI returned structured markdown, parse it
  const keyInsightMatch = rawText.match(/##\s*Key Insight\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  const analysisMatch = rawText.match(/##\s*Analysis\s*\n([\s\S]*?)(?=\n##\s|$)/i);

  if (keyInsightMatch && analysisMatch) {
    return {
      keyInsight: keyInsightMatch[1].trim(),
      analysis: analysisMatch[1].trim(),
    };
  }

  // Fallback: first paragraph is the key insight, rest is analysis
  const paragraphs = rawText.split('\n\n').filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) {
    return { keyInsight: 'No response generated.', analysis: '' };
  }
  if (paragraphs.length === 1) {
    return { keyInsight: paragraphs[0].trim(), analysis: '' };
  }
  return {
    keyInsight: paragraphs[0].trim(),
    analysis: paragraphs.slice(1).join('\n\n').trim(),
  };
}
