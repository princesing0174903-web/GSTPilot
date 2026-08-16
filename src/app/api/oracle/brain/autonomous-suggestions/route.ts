// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Autonomous Suggestions API
// GET /api/oracle/brain/autonomous-suggestions?orgId=xxx
//
// Proactively analyzes the business snapshot and generates actionable
// suggestions WITHOUT the user asking. Deterministic + fast (no LLM call).
//
// Response shape:
//   { ok: true, suggestions: [{
//       id: string,
//       type: 'collection'|'compliance'|'integration'|'cashflow'|'revenue',
//       title: string,
//       description: string,
//       action: string,            // command-palette slug
//       priority: 'high'|'medium'|'low',
//       category: 'Finance'|'GST'|'CRM'|'Banking'|'Operations'
//   }] }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getBusinessSnapshot, type BusinessSnapshot } from '@/lib/business/snapshot';

export const runtime = 'nodejs';

// ─── Types ─────────────────────────────────────────────────────────────────────

type SuggestionType = 'collection' | 'compliance' | 'integration' | 'cashflow' | 'revenue';
type Priority = 'high' | 'medium' | 'low';
type Category = 'Finance' | 'GST' | 'CRM' | 'Banking' | 'Operations';

interface Suggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description: string;
  action: string;
  priority: Priority;
  category: Category;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
}

let suggestionSeq = 0;
function makeId(prefix: string): string {
  suggestionSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${suggestionSeq}`;
}

// ─── Integration status (defensive) ────────────────────────────────────────────

async function fetchIntegrationStatus(orgId: string): Promise<{ google: boolean; zoho: boolean }> {
  const [g, z] = await Promise.all([
    (async () => {
      try {
        return await db.googleWorkspaceToken.count({ where: { organizationId: orgId, revokedAt: null } });
      } catch { return 0; }
    })(),
    (async () => {
      try {
        return await db.zohoBooksToken.count({ where: { organizationId: orgId, revokedAt: null } });
      } catch { return 0; }
    })(),
  ]);
  return { google: g > 0, zoho: z > 0 };
}

// ─── Build suggestions from snapshot ───────────────────────────────────────────

function buildSuggestions(
  s: BusinessSnapshot,
  integrations: { google: boolean; zoho: boolean },
  pendingReturns: Array<{ returnType: string; period: string; status: string; dueDate?: string | null }>,
): Suggestion[] {
  const out: Suggestion[] = [];

  // ── Collections: overdue receivables ───────────────────────────────────────
  if (s.overdueReceivables > 0 && s.overdueInvoiceCount > 0) {
    out.push({
      id: makeId('collect'),
      type: 'collection',
      title: `Collect ₹${inr(s.overdueReceivables)} from ${s.overdueInvoiceCount} overdue customer${s.overdueInvoiceCount === 1 ? '' : 's'}`,
      description: `${s.overdueInvoiceCount} invoice${s.overdueInvoiceCount === 1 ? '' : 's'} past due, totalling ₹${inr(s.overdueReceivables)}. Send reminders to free up working capital.`,
      action: 'send-reminders',
      priority: s.overdueReceivables > 100000 ? 'high' : 'medium',
      category: 'Finance',
    });
  } else if (s.overdueInvoiceCount > 0) {
    out.push({
      id: makeId('collect'),
      type: 'collection',
      title: `${s.overdueInvoiceCount} invoice${s.overdueInvoiceCount === 1 ? '' : 's'} overdue`,
      description: `${s.overdueInvoiceCount} invoice${s.overdueInvoiceCount === 1 ? '' : 's'} are past their due date. Review and follow up with customers.`,
      action: 'view-overdue',
      priority: 'medium',
      category: 'Finance',
    });
  }

  // ── Compliance: pending GST returns ────────────────────────────────────────
  if (s.pendingReturns > 0) {
    const nextReturn = pendingReturns.find(r => r.status !== 'filed') ?? pendingReturns[0];
    if (nextReturn) {
      const isOverdue = nextReturn.status === 'overdue' || s.overdueReturns > 0;
      out.push({
        id: makeId('gst'),
        type: 'compliance',
        title: `Generate ${nextReturn.returnType} for ${nextReturn.period}`,
        description: `${nextReturn.returnType} for ${nextReturn.period} is ${nextReturn.status === 'filed' ? 'filed' : 'pending'}. ${isOverdue ? 'Overdue — file immediately to avoid penalties.' : 'File before the due date.'}`,
        action: 'generate-gst',
        priority: isOverdue ? 'high' : 'medium',
        category: 'GST',
      });
    } else {
      out.push({
        id: makeId('gst'),
        type: 'compliance',
        title: `${s.pendingReturns} GST return${s.pendingReturns === 1 ? '' : 's'} pending`,
        description: `${s.pendingReturns} GST return${s.pendingReturns === 1 ? '' : 's'} need attention${s.overdueReturns > 0 ? `, ${s.overdueReturns} overdue` : ''}. Generate and file to stay compliant.`,
        action: 'generate-gst',
        priority: s.overdueReturns > 0 ? 'high' : 'medium',
        category: 'GST',
      });
    }
  }

  // ── GST liability outstanding ──────────────────────────────────────────────
  if (s.gstLiability > 0) {
    out.push({
      id: makeId('gst-liab'),
      type: 'compliance',
      title: `₹${inr(s.gstLiability)} GST liability outstanding`,
      description: `Output tax ₹${inr(s.outputTax)} minus input tax ₹${inr(s.inputTax)} = ₹${inr(s.gstLiability)} net payable. Set aside funds for the next filing.`,
      action: 'view-gst',
      priority: s.pendingReturns > 0 ? 'high' : 'low',
      category: 'GST',
    });
  }

  // ── Cashflow: negative or low runway ───────────────────────────────────────
  if (s.netCashFlow < 0) {
    const runway = s.runwayDays === Infinity ? null : s.runwayDays;
    out.push({
      id: makeId('cashflow-neg'),
      type: 'cashflow',
      title: `Cash flow is negative (₹${inr(s.netCashFlow)})`,
      description: `You paid out more than you collected this period${runway ? `. At current burn, cash lasts ~${runway} days` : ''}. Cut non-essential spending and accelerate collections.`,
      action: 'view-cashflow',
      priority: 'high',
      category: 'Finance',
    });
  } else if (s.runwayDays !== Infinity && s.runwayDays < 30) {
    out.push({
      id: makeId('cashflow-low'),
      type: 'cashflow',
      title: `Cash flow may become negative in ${s.runwayDays} days`,
      description: `At the current burn rate, cash reserves will last ~${s.runwayDays} days. Review outflows and chase receivables.`,
      action: 'view-cashflow',
      priority: 'high',
      category: 'Finance',
    });
  }

  // ── Revenue decline MoM ────────────────────────────────────────────────────
  if (s.revenueLastMonth > 0 && s.revenueThisMonth < s.revenueLastMonth) {
    const pct = Math.round(((s.revenueLastMonth - s.revenueThisMonth) / s.revenueLastMonth) * 100);
    if (pct >= 5) {
      out.push({
        id: makeId('rev-down'),
        type: 'revenue',
        title: `Revenue is down ${pct}% MoM`,
        description: `Revenue dropped from ₹${inr(s.revenueLastMonth)} last month to ₹${inr(s.revenueThisMonth)} this month (${pct}% decline). Investigate the cause — fewer invoices, lower ticket size, or churned customers.`,
        action: 'view-revenue',
        priority: pct >= 20 ? 'high' : 'medium',
        category: 'Finance',
      });
    }
  }

  // ── Low collection rate ────────────────────────────────────────────────────
  if (s.collectionRate < 0.7 && s.receivables > 0) {
    out.push({
      id: makeId('collect-rate'),
      type: 'collection',
      title: `Collection rate is low (${(s.collectionRate * 100).toFixed(0)}%)`,
      description: `You've collected only ${(s.collectionRate * 100).toFixed(0)}% of invoiced revenue. ₹${inr(s.receivables)} is still outstanding. Tighten payment terms and follow up.`,
      action: 'view-receivables',
      priority: 'medium',
      category: 'CRM',
    });
  }

  // ── Avg days to pay too high ───────────────────────────────────────────────
  if (s.avgDaysToPay > 45 && s.invoiceCount > 0) {
    out.push({
      id: makeId('adp'),
      type: 'collection',
      title: `Customers take ${Math.round(s.avgDaysToPay)} days to pay on average`,
      description: `Average days-to-pay is ${Math.round(s.avgDaysToPay)} (target: 45). Consider shorter payment terms or early-payment discounts.`,
      action: 'view-receivables',
      priority: 'low',
      category: 'CRM',
    });
  }

  // ── Integration: reconnect Zoho / Google ───────────────────────────────────
  if (!integrations.zoho) {
    out.push({
      id: makeId('zoho'),
      type: 'integration',
      title: 'Connect Zoho Books',
      description: 'Sync invoices, bills, customers, and payments from Zoho Books automatically. Eliminates manual data entry.',
      action: 'reconnect-zoho',
      priority: 'medium',
      category: 'Operations',
    });
  }
  if (!integrations.google) {
    out.push({
      id: makeId('google'),
      type: 'integration',
      title: 'Connect Google Workspace',
      description: 'Link Google for email reminders, calendar scheduling, and document storage.',
      action: 'reconnect-google',
      priority: 'low',
      category: 'Operations',
    });
  }

  // ── High working capital tied up ───────────────────────────────────────────
  if (s.receivables > 0 && s.receivables > s.revenue * 0.3 && s.revenue > 0) {
    out.push({
      id: makeId('wc'),
      type: 'cashflow',
      title: `${Math.round((s.receivables / Math.max(s.revenue, 1)) * 100)}% of revenue is tied up in receivables`,
      description: `₹${inr(s.receivables)} outstanding vs ₹${inr(s.revenue)} revenue. Consider invoice factoring or stricter credit terms.`,
      action: 'view-receivables',
      priority: 'low',
      category: 'Finance',
    });
  }

  // ── Low health score ───────────────────────────────────────────────────────
  if (s.healthScore > 0 && s.healthScore < 50) {
    out.push({
      id: makeId('health'),
      type: 'cashflow',
      title: `Business health is ${s.healthScoreLabel} (${s.healthScore}/100)`,
      description: `Composite health score is ${s.healthScore}/100 (${s.healthScoreLabel}). Focus on collections, cash reserves, and GST compliance to improve.`,
      action: 'view-dashboard',
      priority: 'high',
      category: 'Finance',
    });
  }

  // ── Sort by priority (high → medium → low) ─────────────────────────────────
  const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  return out;
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  const orgId = request.nextUrl.searchParams.get('orgId') || request.nextUrl.searchParams.get('firmId') || '';
  const orgResult = await requireOrgMembership(uid, orgId);
  if (orgResult instanceof NextResponse) return orgResult;

  if (!orgId) {
    return NextResponse.json(
      { ok: false, error: 'orgId is required' },
      { status: 400 },
    );
  }

  // ─── 1. Snapshot (defensive) ───────────────────────────────────────────────
  let snapshot: BusinessSnapshot | null = null;
  try {
    snapshot = await getBusinessSnapshot(orgId);
  } catch (e) {
    console.error('[oracle/autonomous-suggestions] snapshot failed:', (e as Error).message);
    snapshot = null;
  }

  if (!snapshot) {
    return NextResponse.json({ ok: true, suggestions: [] });
  }

  // ─── 2. Fetch pending returns + integration status (defensive) ─────────────
  const [pendingReturns, integrations] = await Promise.all([
    (async () => {
      try {
        return await db.gSTRFiling.findMany({
          where: { client: { firmId: orgId }, status: { not: 'filed' } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { returnType: true, period: true, status: true },
        });
      } catch { return []; }
    })(),
    fetchIntegrationStatus(orgId),
  ]);

  // ─── 3. Build + return suggestions ─────────────────────────────────────────
  let suggestions: Suggestion[] = [];
  try {
    suggestions = buildSuggestions(snapshot, integrations, pendingReturns);
  } catch (e) {
    console.error('[oracle/autonomous-suggestions] build failed:', (e as Error).message);
    suggestions = [];
  }

  return NextResponse.json({ ok: true, suggestions });
}
