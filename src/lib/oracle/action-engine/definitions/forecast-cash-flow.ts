// ═══════════════════════════════════════════════════════════════════════════════
// Action: Forecast Cash Flow
// ═══════════════════════════════════════════════════════════════════════════════
//
// Projects cash flow 7 or 30 days forward from the last 60 days of history.
// Returns projectedEndBalance, runwayDays, minBalance, confidence, narrative,
// risks[], recommendations[]. Non-destructive — but we add it to
// CONFIRMATION_REQUIRED_TOOLS so the user sees a preview card (showing the
// horizon) before it runs.
//
// Oracle calls the Banking Service directly (NOT the API routes, NOT Prisma).
// ═══════════════════════════════════════════════════════════════════════════════

import { getBankingService } from '@/lib/banking-service';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import {
  registerAction,
  inr,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_HORIZONS = ['7d', '30d'] as const;

export const forecastCashFlowAction: OracleAction = {
  name: 'forecastCashFlow',
  displayName: 'Forecast Cash Flow',
  description: 'Project cash flow 7 or 30 days forward using historical averages with a confidence band. Returns projected end balance, runway days, min balance, confidence, narrative, risks, and recommendations. Calls the Banking Service.',
  category: 'finance',
  icon: 'TrendingUp',
  intentKeywords: [
    'forecast cash flow', 'cash forecast', 'project cash',
    'predict cash flow', 'forecast balance',
  ],
  paramSchema: [
    { key: 'horizon', label: 'Horizon', type: 'enum', required: false, options: [...VALID_HORIZONS], description: '7d (default) or 30d — how far forward to project' },
  ],

  async validate(args, _orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    const horizon = String(args.horizon ?? '7d').toLowerCase();
    if (!VALID_HORIZONS.includes(horizon as any)) {
      fields.push({ key: 'horizon', label: 'Horizon', status: 'warn', message: `Unknown — defaulting to "7d"`, resolvedValue: '7d' });
      warnings.push(`Unknown horizon "${horizon}" — defaulting to 7d.`);
      resolvedRefs.horizon = '7d';
    } else {
      fields.push({ key: 'horizon', label: 'Horizon', status: 'ok', resolvedValue: horizon });
      resolvedRefs.horizon = horizon;
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const horizon = refs.horizon ?? '7d';
    return {
      title: `Forecast cash flow (${horizon})`,
      fields: [
        { label: 'Horizon', value: horizon, emphasize: true },
      ],
      note: 'Projects inflow/outflow from historical averages (last 60 days) with a ±1.15σ confidence band. The forecast is informational — no transactions are created or modified.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const horizon = VALID_HORIZONS.includes(String(args.horizon ?? '7d').toLowerCase() as any)
      ? (String(args.horizon ?? '7d').toLowerCase() as '7d' | '30d')
      : '7d';

    let svc;
    try {
      svc = await getBankingService();
    } catch (e) {
      return { ok: false, summary: `Banking Service unavailable: ${(e as Error).message}` };
    }

    let forecast;
    try {
      forecast = await svc.forecastCashFlow(orgId, horizon);
    } catch (e) {
      const msg = (e as Error).message;
      console.error('[forecastCashFlow] forecastCashFlow failed:', msg);
      return { ok: false, summary: `Cash flow forecast failed: ${msg}` };
    }

    await logActivity(orgId, 'banking', `Generated ${horizon} cash flow forecast — projected end balance ${inr(forecast.projectedEndBalance)}, runway ${isFinite(forecast.runwayDays) ? `${Math.round(forecast.runwayDays)}d` : '∞'}, confidence ${(forecast.confidence * 100).toFixed(0)}%`, {
      horizon,
      projectedEndBalance: forecast.projectedEndBalance,
      runwayDays: forecast.runwayDays,
      minBalance: forecast.minBalance,
      confidence: forecast.confidence,
    });

    await emitTimelineEvent({
      organizationId: orgId,
      type: 'banking.forecast_generated',
      title: `${horizon} cash flow forecast generated`,
      description: `Projected end balance: ${inr(forecast.projectedEndBalance)} · min balance: ${inr(forecast.minBalance)} · confidence: ${(forecast.confidence * 100).toFixed(0)}%.`,
      severity: forecast.minBalance < 0 ? 'warning' : 'info',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: {
        horizon,
        projectedEndBalance: forecast.projectedEndBalance,
        runwayDays: forecast.runwayDays,
        minBalance: forecast.minBalance,
        confidence: forecast.confidence,
      },
    });

    const summary =
      `✅ **${horizon} cash flow forecast**\n\n` +
      `${forecast.narrative}\n\n` +
      `• Projected end balance: **${inr(forecast.projectedEndBalance)}**\n` +
      `• Minimum balance: **${inr(forecast.minBalance)}**${forecast.minBalanceDate ? ` (on ${forecast.minBalanceDate.slice(0, 10)})` : ''}\n` +
      `• Runway: **${isFinite(forecast.runwayDays) ? `${Math.round(forecast.runwayDays)} days` : '∞ (never hits zero)'}**\n` +
      `• Confidence: **${(forecast.confidence * 100).toFixed(0)}%**` +
      (forecast.risks.length > 0 ? `\n\n**Risks:**\n${forecast.risks.map(r => `• ${r}`).join('\n')}` : '') +
      (forecast.recommendations.length > 0 ? `\n\n**Recommendations:**\n${forecast.recommendations.map(r => `• ${r}`).join('\n')}` : '');

    return {
      ok: true,
      summary,
      data: {
        horizon,
        projectedEndBalance: forecast.projectedEndBalance,
        runwayDays: forecast.runwayDays,
        minBalance: forecast.minBalance,
        minBalanceDate: forecast.minBalanceDate,
        confidence: forecast.confidence,
        narrative: forecast.narrative,
        risks: forecast.risks,
        recommendations: forecast.recommendations,
        points: forecast.points,
      },
      artifacts: forecast.points.length > 0 ? [{
        kind: 'table',
        title: `${horizon} projection`,
        columns: ['Date', 'Inflow', 'Outflow', 'Balance', 'Low', 'High'],
        rows: forecast.points.map(p => ({
          Date: p.date.slice(0, 10),
          Inflow: inr(p.projectedInflow),
          Outflow: inr(p.projectedOutflow),
          Balance: inr(p.projectedBalance),
          Low: inr(p.lowBalance),
          High: inr(p.highBalance),
        })),
      }] : undefined,
      viewIn: { label: 'View forecast', href: '/banking' },
    };
  },
};

registerAction(forecastCashFlowAction);
