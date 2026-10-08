// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ — Main Engine Orchestrator
//
// The single entry point: askCFO(message, history, ctx) → CFOAnswer
//
// Orchestrates the full production pipeline:
//   1. Load business context (cached, <200ms target)
//   2. Run reasoning pipeline (8 steps, real data)
//   3. Detect action intent (tool calling)
//   4. If intent detected → create pending approval (no execution yet)
//   5. Compute confidence + alternatives + risks
//   6. Call AI provider with structured context (with retry + fallback)
//   7. Parse AI response + assemble structured CFOAnswer
//   8. Audit log the entire operation
//
// Performance target: <2s total. Cache hit + AI stream: <1s.
// ═══════════════════════════════════════════════════════════════════════════════

import ZAI from 'z-ai-web-dev-sdk';
import { loadBusinessContext, formatContextForPrompt } from './business-context';
import { runReasoningPipeline } from './reasoning';
import { detectActionIntent, createPendingApproval, type IntentMatch } from './tools';
import {
  computeConfidence,
  generateAlternatives,
  identifyRisks,
  buildAnswerParts,
  parseAiBrief,
} from './explainable';
import { withRetry } from './retry';
import { logOracleOperation, type AuditContext } from './audit';
import type { CFOAnswer, CFOAskRequest, BusinessContext } from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

const AI_PROVIDER = 'zai-glm-4.6';
const PREVIEW_ORG_ID = 'preview-org';
const PREVIEW_ORG_NAME = 'Preview Organization';

// ─── Main entry point ────────────────────────────────────────────────────────

export async function askCFO(
  request: CFOAskRequest,
): Promise<CFOAnswer> {
  const startTime = Date.now();
  const {
    message,
    history = [],
    organizationId = PREVIEW_ORG_ID,
    userId = 'preview-user',
    userEmail = 'preview@gstpilot.in',
    conversationTurnId = `turn_${Date.now()}`,
  } = request;

  const auditCtx: AuditContext = { organizationId, userId, userEmail };
  const answerId = `cfo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 1. Load business context (cached, fast)
  let ctx: BusinessContext;
  try {
    ctx = await loadBusinessContext(organizationId, PREVIEW_ORG_NAME);
  } catch (err) {
    // Critical: if context loading fails, return a structured error answer
    const errorAnswer = buildErrorAnswer(
      answerId,
      conversationTurnId,
      message,
      startTime,
      'CONTEXT_LOAD_FAILED',
      `I couldn't load your business data. This is usually a temporary database connectivity issue.`,
      true,
      'Try again in a moment. If the issue persists, your data sources may need attention.',
    );
    await logOracleOperation(auditCtx, {
      operationType: 'cfo-error',
      question: message,
      recordsAffected: 0,
      aiProvider: AI_PROVIDER,
      executionTimeMs: Date.now() - startTime,
      result: 'failure',
      errorMessage: `Context load failed: ${err instanceof Error ? err.message : 'unknown'}`,
      rollbackStatus: 'not-required',
    });
    return errorAnswer;
  }

  // 2. Run reasoning pipeline (real data analysis)
  const reasoning = await runReasoningPipeline(message, ctx);

  // 3. Detect action intent (tool calling)
  const intent = detectActionIntent(message, ctx);
  let proposedActions = await Promise.all(
    intent
      ? [createPendingApproval(
          intent.action,
          intent.preFilledInput,
          intent.reason,
          intent.severity,
          auditCtx,
          conversationTurnId,
        )]
      : [],
  );

  // 4. Compute explainability metadata
  const { confidence, confidenceRationale } = computeConfidence(ctx, reasoning, message);
  const alternatives = generateAlternatives(ctx, message, reasoning);
  const risks = identifyRisks(ctx, message, reasoning);

  // 5. Call AI provider with structured context (with retry)
  const aiResult = await callAiProvider(message, history, ctx, reasoning);

  if (!aiResult.ok) {
    const errorAnswer = buildErrorAnswer(
      answerId,
      conversationTurnId,
      message,
      startTime,
      aiResult.error.code,
      aiResult.error.message,
      aiResult.error.retryable,
      aiResult.error.suggestedAction,
      ctx,
      reasoning,
      proposedActions,
      confidence,
      confidenceRationale,
    );
    await logOracleOperation(auditCtx, {
      operationType: 'cfo-error',
      question: message,
      recordsAffected: reasoning.totalRecordsTouched,
      aiProvider: AI_PROVIDER,
      executionTimeMs: Date.now() - startTime,
      result: 'failure',
      errorMessage: aiResult.error.rawError ?? aiResult.error.message,
      rollbackStatus: 'not-required',
    });
    return errorAnswer;
  }

  // 6. Parse AI response
  const aiBrief = parseAiBrief(aiResult.value);

  // 7. Assemble structured CFOAnswer
  const parts = buildAnswerParts(message, ctx, reasoning, aiBrief, {
    confidence,
    confidenceRationale,
    alternatives,
    risks,
  });

  const totalDurationMs = Date.now() - startTime;

  // 8. Audit log the successful answer
  const auditId = await logOracleOperation(auditCtx, {
    operationType: 'cfo-answer',
    question: message,
    recordsAffected: reasoning.totalRecordsTouched,
    aiProvider: AI_PROVIDER,
    executionTimeMs: totalDurationMs,
    result: 'success',
    rollbackStatus: 'not-required',
  });

  return {
    answerId,
    conversationTurnId,
    question: message,
    createdAt: new Date().toISOString(),
    parts,
    reasoning: reasoning.steps.map((s, i) => ({ ...s, step: i + 1 })),
    supportingRecords: reasoning.supportingRecords,
    confidence,
    confidenceRationale,
    calculation: reasoning.calculationBreakdown,
    alternatives,
    proposedActions,
    businessContext: {
      organizationId: ctx.organizationId,
      organizationName: ctx.organizationName,
      financialYear: ctx.financialYear,
      currentGstPeriod: ctx.currentGstPeriod,
      dataAvailability: ctx.dataAvailability,
    },
    dataSourcesUsed: reasoning.dataSourcesUsed,
    totalDurationMs,
    aiProvider: AI_PROVIDER,
    auditId,
  };
}

// ─── AI provider call (with retry + fallback) ────────────────────────────────

async function callAiProvider(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ctx: BusinessContext,
  reasoning: { findings: string[]; calculationBreakdown: string },
): Promise<{ ok: true; value: string } | { ok: false; error: import('./retry').CFOError }> {
  const systemPrompt = buildSystemPrompt(ctx, reasoning);
  const userPrompt = buildUserPrompt(message, history, ctx, reasoning);

  const result = await withRetry(
    async () => {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        model: process.env.ZAI_MODEL ?? 'glm-4.6',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1500,
      });
      const content = completion.choices?.[0]?.message?.content ?? '';
      if (!content) throw new Error('AI provider returned empty response');
      return content;
    },
    {
      maxAttempts: 3,
      operationName: 'Oracle CFO AI generation',
    },
  );

  return result;
}

function buildSystemPrompt(ctx: BusinessContext, reasoning: { findings: string[] }): string {
  return [
    `You are Oracle, the AI Chief Financial Officer for ${ctx.organizationName}.`,
    `You are a seasoned Indian CA-firm CFO with 20+ years of experience in GST, banking, collections, and compliance.`,
    ``,
    `## YOUR PERSONALITY`,
    `- Speak like a real CFO: direct, specific, and numbers-first.`,
    `- Never use phrases like "As an AI..." or "I cannot...". You ARE the CFO.`,
    `- When data is missing, say so explicitly: "I don't have X connected yet."`,
    `- Use ₹ symbol for all Indian Rupee amounts. Format large numbers as ₹X.XL / ₹X.XXCr.`,
    ``,
    `## STRICT RULES (NON-NEGOTIABLE)`,
    `1. NEVER fabricate numbers. Only use figures from the LIVE BUSINESS CONTEXT below.`,
    `2. If asked about something not in the context, say "I don't have that data connected yet."`,
    `3. Your response MUST have two sections marked with markdown headers:`,
    `   ## Key Insight`,
    `   (One sentence — the headline finding. Include the key number.)`,
    `   ## Analysis`,
    `   (2-4 short paragraphs of strategic analysis. Cite the specific records.)`,
    `4. Do NOT include "Recommended Actions" or "Risks" sections — those are generated separately.`,
    `5. Do NOT repeat the user's question back to them.`,
    `6. Be concise. Total response under 400 words.`,
    ``,
    `## LIVE BUSINESS CONTEXT`,
    formatContextForPrompt(ctx),
    ``,
    `## REASONING FINDINGS (from the multi-step pipeline)`,
    ...reasoning.findings.map((f, i) => `${i + 1}. ${f}`),
  ].join('\n');
}

function buildUserPrompt(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  _ctx: BusinessContext,
  reasoning: { calculationBreakdown: string },
): string {
  const recentHistory = history.slice(-4).map((h) => `[${h.role}]: ${h.content}`).join('\n');
  return [
    `## USER QUESTION`,
    message,
    ``,
    recentHistory ? `## RECENT CONVERSATION\n${recentHistory}\n` : '',
    `## CALCULATION BREAKDOWN (already computed — cite these numbers)`,
    reasoning.calculationBreakdown,
    ``,
    `## YOUR TASK`,
    `Answer the user's question as the CFO. Use the LIVE BUSINESS CONTEXT and CALCULATION BREAKDOWN above.`,
    `Format your response with:`,
    `## Key Insight`,
    `(one sentence with the headline number)`,
    `## Analysis`,
    `(2-4 paragraphs citing specific records)`,
  ].join('\n');
}

// ─── Error answer builder ────────────────────────────────────────────────────

function buildErrorAnswer(
  answerId: string,
  conversationTurnId: string,
  question: string,
  startTime: number,
  code: string,
  message: string,
  retryable: boolean,
  suggestedAction?: string,
  ctx?: BusinessContext,
  reasoning?: { steps: CFOAnswer['reasoning']; supportingRecords: CFOAnswer['supportingRecords']; dataSourcesUsed: string[]; calculationBreakdown: string },
  proposedActions?: CFOAnswer['proposedActions'],
  confidence?: number,
  confidenceRationale?: string,
): CFOAnswer {
  return {
    answerId,
    conversationTurnId,
    question,
    createdAt: new Date().toISOString(),
    parts: {
      keyInsight: 'I ran into an issue answering that.',
      analysis: message + (suggestedAction ? `\n\n**Next step:** ${suggestedAction}` : ''),
      recommendedActions: suggestedAction ? [suggestedAction] : ['Try rephrasing your question or try again in a moment.'],
      potentialRisks: [],
      nextBestStep: suggestedAction ?? 'Try again or contact support if the issue persists.',
    },
    reasoning: reasoning?.steps ?? [],
    supportingRecords: reasoning?.supportingRecords ?? [],
    confidence: confidence ?? 0.1,
    confidenceRationale: confidenceRationale ?? 'Error occurred during processing.',
    calculation: reasoning?.calculationBreakdown ?? '',
    alternatives: [],
    proposedActions: proposedActions ?? [],
    businessContext: ctx
      ? {
          organizationId: ctx.organizationId,
          organizationName: ctx.organizationName,
          financialYear: ctx.financialYear,
          currentGstPeriod: ctx.currentGstPeriod,
          dataAvailability: ctx.dataAvailability,
        }
      : {
          organizationId: 'unknown',
          organizationName: 'Unknown',
          financialYear: 'Unknown',
          currentGstPeriod: 'Unknown',
          dataAvailability: {
            hasInvoices: false,
            hasPayments: false,
            hasBankAccounts: false,
            hasGstReturns: false,
            hasClients: false,
            hasExpenses: false,
            overall: 'empty' as const,
          },
        },
    dataSourcesUsed: reasoning?.dataSourcesUsed ?? [],
    totalDurationMs: Date.now() - startTime,
    aiProvider: AI_PROVIDER,
    auditId: '',
    error: { code, message, retryable, suggestedAction },
  };
}
