// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Live Dashboard Update (PROMPT 5)
// ═══════════════════════════════════════════════════════════════════════════════
//
// After Oracle finishes answering, the right-side Insights panel auto-updates
// WITHOUT a page refresh. This module builds the update payload from real data
// + the findings from this run.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import type { DashboardUpdate, AgentFinding, AITimeline } from './types';
import type { BusinessSnapshot } from '@/lib/business/snapshot';
import { inr } from './tools';

/**
 * Build a dashboard update payload that the right-side panel can render
 * immediately after Oracle finishes answering.
 */
export function buildDashboardUpdate(
  snapshot: BusinessSnapshot | null,
  findings: AgentFinding[],
  timeline: AITimeline,
): DashboardUpdate | null {
  if (!snapshot) return null;

  // Today's priorities — derive from critical findings + overdue items.
  const priorities: DashboardUpdate['priorities'] = [];

  if (snapshot.overdueReturns > 0) {
    priorities.push({
      label: `File ${snapshot.overdueReturns} overdue GST return${snapshot.overdueReturns > 1 ? 's' : ''}`,
      severity: 'critical',
    });
  }
  if (snapshot.overdueInvoiceCount > 0) {
    priorities.push({
      label: `Collect ${inr(snapshot.overdueReceivables)} from ${snapshot.overdueInvoiceCount} overdue invoice${snapshot.overdueInvoiceCount > 1 ? 's' : ''}`,
      severity: 'warn',
    });
  }
  if (isFinite(snapshot.runwayDays) && snapshot.runwayDays < 60) {
    priorities.push({
      label: `Cash runway critical — ${snapshot.runwayDays} days left`,
      severity: snapshot.runwayDays < 30 ? 'critical' : 'warn',
    });
  }
  if (snapshot.topCustomerShare > 0.3) {
    priorities.push({
      label: `Diversify customer base (top = ${(snapshot.topCustomerShare * 100).toFixed(0)}%)`,
      severity: 'watch',
    });
  }
  if (snapshot.gstLiability > 0) {
    priorities.push({
      label: `Pay ${inr(snapshot.gstLiability)} GST liability`,
      severity: 'watch',
    });
  }

  // Add critical findings as priorities if not already covered.
  for (const f of findings.filter((f) => f.severity === 'critical').slice(0, 3)) {
    if (priorities.length >= 5) break;
    if (!priorities.some((p) => p.label.toLowerCase().includes(f.headline.toLowerCase().slice(0, 15)))) {
      priorities.push({ label: f.headline, severity: 'critical' });
    }
  }

  // Upcoming deadlines — pull from timeline.
  const upcomingDeadlines: DashboardUpdate['upcomingDeadlines'] = timeline.items
    .filter((t) => t.bucket === 'this_week' || t.bucket === 'this_month' || t.bucket === 'upcoming')
    .slice(0, 4)
    .map((t) => ({
      label: t.title,
      when: t.when,
      severity: t.severity ?? 'info',
    }));

  return {
    healthScore: snapshot.healthScore,
    healthLabel: snapshot.healthScoreLabel,
    revenue: inr(snapshot.revenueThisMonth || snapshot.revenue),
    receivables: inr(snapshot.receivables),
    gstLiability: inr(snapshot.gstLiability),
    cash: inr(snapshot.cash),
    riskScore: snapshot.riskScore,
    priorities: priorities.slice(0, 5),
    upcomingDeadlines,
  };
}
