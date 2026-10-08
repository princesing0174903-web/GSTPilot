// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Oracle™ & AI CFO™ — MockAIProvider (SERVER-ONLY, default)
//
// The DEFAULT AI provider. Implements IAIProvider by delegating to the pure
// deterministic engines (insights, recommendations, scoring, chat, predictions).
//
// CRITICAL: This provider does NOT call any external LLM. It analyses the REAL
// BusinessContext (built from live Firestore data by the orchestrator) using
// deterministic rules and template phrasing. "Never answer using fake data" is
// guaranteed because every method only reads from the BusinessContext it's
// given — it never fabricates values.
//
// Switching to production later = replace this provider in registry.ts. No UI,
// hook, or service code changes.
//
// This file is SERVER-ONLY — it's imported by the registry which is imported
// only by API routes / orchestrator.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IAIProvider } from '../provider';
import type {
  AIProviderName,
  Alert,
  AnalysisModule,
  AnalysisResult,
  BusinessContext,
  BusinessScore,
  ChatResponse,
  Insight,
  Prediction,
  Recommendation,
  RiskScore,
} from '../types';
import { generateInsightsFromContext, detectDuplicateInvoices } from '../insights';
import { generateRecommendationsFromContext } from '../recommendations';
import { computeBusinessScoreFromContext, computeRiskScoreFromContext, generateAlertsFromContext } from '../scoring';
import { answerQuestionWithContext } from '../chat';
import { predictRevenueFromContext, predictCashFlowFromContext, generateBriefFromContext } from '../predictions';

/**
 * The MockAIProvider — deterministic real-data analysis, NO external LLM.
 *
 * Every method is synchronous-compute wrapped in a Promise to satisfy the
 * IAIProvider async contract (so swapping to a real LLM provider later
 * requires zero caller changes).
 */
export class MockAIProvider implements IAIProvider {
  readonly name = 'Mock AI Oracle';
  readonly provider: AIProviderName = 'mock';
  readonly isLive = false;

  async generateInsights(context: BusinessContext): Promise<Insight[]> {
    // Core insights from the context.
    const insights = generateInsightsFromContext(context);
    // The orchestrator passes raw invoices via metadata for duplicate detection.
    // (Duplicate detection needs the raw invoice list, which isn't in the
    // BusinessContext — the orchestrator calls detectDuplicateInvoices directly
    // and merges the results before persisting.)
    return insights;
  }

  async generateRecommendations(
    context: BusinessContext,
    insights: Insight[],
  ): Promise<Recommendation[]> {
    return generateRecommendationsFromContext(context, insights);
  }

  async generateAlerts(context: BusinessContext, insights: Insight[]): Promise<Alert[]> {
    return generateAlertsFromContext(context, insights);
  }

  async computeBusinessScore(context: BusinessContext): Promise<BusinessScore> {
    return computeBusinessScoreFromContext(context);
  }

  async computeRiskScore(context: BusinessContext, insights: Insight[]): Promise<RiskScore> {
    return computeRiskScoreFromContext(context, insights);
  }

  async answerBusinessQuestion(
    question: string,
    context: BusinessContext,
  ): Promise<ChatResponse> {
    return answerQuestionWithContext(question, context);
  }

  async predictRevenue(context: BusinessContext, months: number): Promise<Prediction> {
    return predictRevenueFromContext(context, months);
  }

  async predictCashFlow(context: BusinessContext, months: number): Promise<Prediction> {
    return predictCashFlowFromContext(context, months);
  }

  async generateBrief(
    context: BusinessContext,
    insights: Insight[],
    recommendations: Recommendation[],
  ): Promise<string> {
    return generateBriefFromContext(context, insights, recommendations);
  }

  async analyzeModule(module: AnalysisModule, context: BusinessContext): Promise<AnalysisResult> {
    return analyzeModuleSync(module, context);
  }

  async healthCheck(): Promise<boolean> {
    // The mock provider is always "available" — it's pure computation.
    return true;
  }
}

// ─── Module analysis (deterministic) ──────────────────────────────────────────

function analyzeModuleSync(module: AnalysisModule, context: BusinessContext): AnalysisResult {
  const allInsights = generateInsightsFromContext(context);
  const allRecs = generateRecommendationsFromContext(context, allInsights, 20);

  switch (module) {
    case 'business':
      return {
        module: 'business',
        summary: `Business snapshot for ${context.period}: revenue ${formatMetric(context.revenue.current)}, expenses ${formatMetric(context.expenses.current)}, profit ${formatMetric(context.profit.current)}, bank balance ${formatMetric(context.banking.totalBalance)}.`,
        metrics: [
          { label: 'Revenue', value: context.revenue.current, previous: context.revenue.previous, changePercent: context.revenue.changePercent, format: 'currency' },
          { label: 'Expenses', value: context.expenses.current, previous: context.expenses.previous, changePercent: context.expenses.changePercent, format: 'currency' },
          { label: 'Profit', value: context.profit.current, format: 'currency' },
          { label: 'Receivables', value: context.outstanding.receivables, format: 'currency' },
          { label: 'Payables', value: context.outstanding.payables, format: 'currency' },
          { label: 'Bank balance', value: context.banking.totalBalance, format: 'currency' },
        ],
        insights: allInsights.slice(0, 5),
        recommendations: allRecs.slice(0, 3),
      };

    case 'cashflow':
      return {
        module: 'cashflow',
        summary: `Cash flow for ${context.period}: net ${formatMetric(context.cashFlow.netInflow)}, burn rate ${formatMetric(context.cashFlow.burnRate)}/mo, runway ${Number.isFinite(context.cashFlow.runwayMonths) ? context.cashFlow.runwayMonths.toFixed(1) + ' months' : 'unlimited'}.`,
        metrics: [
          { label: 'Net cash flow', value: context.cashFlow.netInflow, format: 'currency' },
          { label: 'Incoming', value: context.banking.incomingPayments, format: 'currency' },
          { label: 'Outgoing', value: context.banking.outgoingPayments, format: 'currency' },
          { label: 'Burn rate', value: context.cashFlow.burnRate, format: 'currency' },
          { label: 'Runway (months)', value: Number.isFinite(context.cashFlow.runwayMonths) ? context.cashFlow.runwayMonths : 999, format: 'number' },
          { label: 'Bank balance', value: context.banking.totalBalance, format: 'currency' },
        ],
        insights: allInsights.filter((i) => i.category === 'cashflow' || i.category === 'banking').slice(0, 5),
        recommendations: allRecs.filter((r) => r.type === 'improve_cash_flow' || r.type === 'reconcile_bank' || r.type === 'connect_bank').slice(0, 3),
      };

    case 'gst':
      return {
        module: 'gst',
        summary: `GST for ${context.period}: output liability ${formatMetric(context.gst.liability)}, ITC ${formatMetric(context.gst.itcAvailable)}, net payable ${formatMetric(context.gst.netPayable)}. Filing status: ${context.gst.filingStatus}.`,
        metrics: [
          { label: 'Output tax', value: context.gst.liability, format: 'currency' },
          { label: 'ITC available', value: context.gst.itcAvailable, format: 'currency' },
          { label: 'Net payable', value: context.gst.netPayable, format: 'currency' },
          { label: 'Pending returns', value: context.gst.pendingReturns, format: 'number' },
        ],
        insights: allInsights.filter((i) => i.category === 'gst' || i.category === 'compliance').slice(0, 5),
        recommendations: allRecs.filter((r) => r.type === 'file_gstr3b' || r.type === 'file_gstr1' || r.type === 'pay_gst' || r.type === 'connect_gstn').slice(0, 3),
      };

    case 'invoices':
      return {
        module: 'invoices',
        summary: `Invoices for ${context.period}: ${context.invoices.total} total, ${context.invoices.pending} pending (${formatMetric(context.invoices.pendingValue)}), ${context.invoices.overdue} overdue (${formatMetric(context.invoices.overdueValue)}), ${context.invoices.draft} draft.`,
        metrics: [
          { label: 'Total invoices', value: context.invoices.total, format: 'number' },
          { label: 'Pending', value: context.invoices.pending, format: 'number' },
          { label: 'Pending value', value: context.invoices.pendingValue, format: 'currency' },
          { label: 'Overdue', value: context.invoices.overdue, format: 'number' },
          { label: 'Overdue value', value: context.invoices.overdueValue, format: 'currency' },
          { label: 'Draft', value: context.invoices.draft, format: 'number' },
        ],
        insights: allInsights.filter((i) => i.category === 'invoices' || i.category === 'customers').slice(0, 5),
        recommendations: allRecs.filter((r) => r.type === 'follow_up_customer' || r.type === 'send_invoice_reminder' || r.type === 'review_overdue').slice(0, 3),
      };

    case 'expenses':
      return {
        module: 'expenses',
        summary: `Expenses for ${context.period}: ${formatMetric(context.expenses.current)}${context.expenses.previous > 0 ? ` (${context.expenses.changePercent >= 0 ? '+' : ''}${context.expenses.changePercent.toFixed(1)}% vs last period)` : ''}. Top: ${context.expenses.topCategories.map((c) => `${c.label} (${formatMetric(c.amount)})`).join(', ') || 'none'}.`,
        metrics: [
          { label: 'Current expenses', value: context.expenses.current, previous: context.expenses.previous, changePercent: context.expenses.changePercent, format: 'currency' },
          { label: 'Payables', value: context.outstanding.payables, format: 'currency' },
          ...context.expenses.topCategories.map((c) => ({ label: c.label, value: c.amount, format: 'currency' as const })),
        ],
        insights: allInsights.filter((i) => i.category === 'expense').slice(0, 5),
        recommendations: allRecs.filter((r) => r.type === 'reduce_expenses').slice(0, 3),
      };
  }
}

function formatMetric(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/**
 * Detect duplicate invoices — exposed for the orchestrator to call directly
 * (it has access to raw invoices which aren't in the BusinessContext).
 */
export { detectDuplicateInvoices };
