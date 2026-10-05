// POST /api/global/compliance/check — Compliance check for a specific entity × country
// Verifies compliance posture for a given entity or country: returns score, upcoming
// deadlines, critical open items, recommended actions.

import { NextRequest } from 'next/server';
import { withGlobalApi } from '@/lib/global-enterprise/api-helpers';
import { getComplianceStatus, getComplianceDeadlines, computeNextDueDate, daysUntil } from '@/lib/global-enterprise/compliance';
import { todayISO } from '@/lib/global-enterprise/currency';

interface ComplianceCheckBody {
  countryIso?: string;
  entityId?: string;
  referenceDate?: string; // YYYY-MM-DD
}

export async function POST(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/compliance/check',
    method: 'POST',
    req,
    handler: async ({ body }) => {
      const b = (body ?? {}) as ComplianceCheckBody;
      const countryIso = b.countryIso?.toUpperCase();
      const referenceDate = b.referenceDate ?? todayISO();

      if (!countryIso) {
        throw new Error('countryIso is required in body');
      }

      const [status, deadlines] = await Promise.all([
        getComplianceStatus(countryIso, referenceDate),
        getComplianceDeadlines(countryIso),
      ]);

      // Compute next-due + days-until for each deadline relative to referenceDate
      const enriched = deadlines.map((d) => {
        const next = computeNextDueDate(d.dueDateRule, referenceDate);
        return {
          ...d,
          nextDueDate: next,
          daysUntil: next ? daysUntil(next, referenceDate) : null,
        };
      }).sort((a, b) => {
        const aDays = a.daysUntil ?? Number.MAX_SAFE_INTEGER;
        const bDays = b.daysUntil ?? Number.MAX_SAFE_INTEGER;
        return aDays - bDays;
      });

      const critical = enriched.filter((d) => d.riskLevel === 'critical' && d.daysUntil !== null && d.daysUntil <= 30);
      const high = enriched.filter((d) => d.riskLevel === 'high' && d.daysUntil !== null && d.daysUntil <= 30);

      const recommendedActions: string[] = [];
      if (critical.length > 0) {
        recommendedActions.push(`URGENT: Address ${critical.length} critical deadline(s) in next 30 days`);
        for (const c of critical.slice(0, 3)) {
          recommendedActions.push(`• ${c.title} — due in ${c.daysUntil} days (${c.authority ?? 'N/A'})`);
        }
      }
      if (high.length > 0) {
        recommendedActions.push(`Review ${high.length} high-risk deadline(s) in next 30 days`);
      }
      if (status.complianceScore < 70) {
        recommendedActions.push('Compliance score below 70 — conduct comprehensive compliance review');
      }
      if (recommendedActions.length === 0) {
        recommendedActions.push('Compliance posture healthy — continue regular monitoring');
      }

      return {
        countryIso,
        referenceDate,
        status,
        deadlines: enriched,
        critical,
        high,
        recommendedActions,
      };
    },
  });
}
