// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Daily Briefing API
// GET /api/oracle/brain/briefing?orgId=xxx
//
// Generates a structured daily briefing for the business by:
//   1. Reading the live business snapshot (getBusinessSnapshot)
//   2. Reading recent invoices / payments / filings for context
//   3. Asking the LLM to produce a structured JSON briefing
//   4. Falling back to a deterministic briefing if the LLM fails
//
// Response shape:
//   { ok: true, briefing: {
//       greeting: string,
//       generatedAt: string (ISO),
//       sections: [{ title, icon, items: [{ label, value, trend? }] }],
//       riskAlerts: [{ level: 'high'|'medium'|'low', message }],
//       recommendations: [{ action, reasoning, priority: 'high'|'medium'|'low' }]
//   } }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { getBusinessSnapshot, type BusinessSnapshot } from '@/lib/business/snapshot';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BriefingItem {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
}

interface BriefingSection {
  title: string;
  icon: string;
  items: BriefingItem[];
}

interface RiskAlert {
  level: 'high' | 'medium' | 'low';
  message: string;
}

interface Recommendation {
  action: string;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
}

interface Briefing {
  greeting: string;
  generatedAt: string;
  sections: BriefingSection[];
  riskAlerts: RiskAlert[];
  recommendations: Recommendation[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Time-of-day greeting based on IST hour. */
function greetingForIST(now = new Date()): string {
  // IST = UTC + 5:30
  const istMs = now.getTime() + (5 * 60 + 30) * 60 * 1000;
  const istHour = new Date(istMs).getUTCHours();
  if (istHour < 12) return 'Good morning';
  if (istHour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Format an INR amount with lakh/crore-style separators (en-IN). */
function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
}

/** Safe JSON parse that strips markdown code fences if present. */
function parseLLMJson(text: string): any | null {
  if (!text) return null;
  let cleaned = text.trim();
  // Strip ```json ... ``` fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  // If the model wrapped the whole thing in braces with leading prose, try to isolate
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ─── Recent-data fetchers (defensive; never throw) ─────────────────────────────

async function fetchRecentInvoices(orgId: string, take = 3) {
  try {
    return await db.invoice.findMany({
      where: { client: { firmId: orgId } },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        invoiceNumber: true,
        buyerName: true,
        totalAmount: true,
        paymentStatus: true,
        invoiceDate: true,
        client: { select: { tradeName: true } },
      },
    });
  } catch {
    return [];
  }
}

async function fetchRecentPayments(orgId: string, take = 3) {
  try {
    return await db.payment.findMany({
      where: { client: { firmId: orgId } },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        amount: true,
        partyName: true,
        partyType: true,
        paymentDate: true,
        paymentMode: true,
      },
    });
  } catch {
    return [];
  }
}

async function fetchUpcomingReturns(orgId: string, take = 4) {
  try {
    return await db.gSTRFiling.findMany({
      where: { client: { firmId: orgId } },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        returnType: true,
        period: true,
        status: true,
        totalTax: true,
        filedDate: true,
      },
    });
  } catch {
    return [];
  }
}

// ─── Risk + recommendation derivations (used by the fallback path too) ──────────

function deriveRiskAlerts(s: BusinessSnapshot): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  if (s.overdueInvoiceCount > 0 || s.overdueReceivables > 0) {
    alerts.push({
      level: s.overdueReceivables > 100000 ? 'high' : 'medium',
      message: `${s.overdueInvoiceCount} overdue invoice(s) totalling ₹${inr(s.overdueReceivables)} await collection.`,
    });
  }
  if (s.pendingReturns > 0) {
    alerts.push({
      level: s.overdueReturns > 0 ? 'high' : 'medium',
      message: `${s.pendingReturns} GST return(s) pending${s.overdueReturns > 0 ? `, ${s.overdueReturns} overdue` : ''}.`,
    });
  }
  if (s.cash < 0 || (s.runwayDays !== Infinity && s.runwayDays < 30)) {
    alerts.push({
      level: 'high',
      message: `Cash position is low (₹${inr(s.cash)}). Runway ≈ ${s.runwayDays === Infinity ? '∞' : s.runwayDays} days.`,
    });
  }
  if (s.netCashFlow < 0) {
    alerts.push({
      level: 'medium',
      message: `Net cash flow is negative (₹${inr(s.netCashFlow)}) — outflows exceed inflows.`,
    });
  }
  if (s.revenueLastMonth > 0 && s.revenueThisMonth < s.revenueLastMonth) {
    const pct = Math.round(((s.revenueLastMonth - s.revenueThisMonth) / s.revenueLastMonth) * 100);
    if (pct >= 10) {
      alerts.push({
        level: 'medium',
        message: `Revenue is down ${pct}% month-over-month (₹${inr(s.revenueLastMonth)} → ₹${inr(s.revenueThisMonth)}).`,
      });
    }
  }
  return alerts;
}

function deriveRecommendations(s: BusinessSnapshot, recentReturns: any[]): Recommendation[] {
  const recs: Recommendation[] = [];

  if (s.overdueInvoiceCount > 0) {
    recs.push({
      action: `send-reminders:${s.overdueInvoiceCount}`,
      reasoning: `${s.overdueInvoiceCount} overdue invoice(s) worth ₹${inr(s.overdueReceivables)} are tying up working capital. Send reminders today.`,
      priority: 'high',
    });
  }

  if (s.pendingReturns > 0) {
    const next = recentReturns.find(r => r.status !== 'filed');
    const label = next ? `${next.returnType} for ${next.period}` : `${s.pendingReturns} pending return(s)`;
    recs.push({
      action: 'generate-gst',
      reasoning: `${label} — file before the due date to avoid late fees and compliance penalties.`,
      priority: s.overdueReturns > 0 ? 'high' : 'medium',
    });
  }

  if (s.netCashFlow < 0 || (s.runwayDays !== Infinity && s.runwayDays < 30)) {
    recs.push({
      action: 'view-cashflow',
      reasoning: `Cash is tight (runway ≈ ${s.runwayDays === Infinity ? '∞' : s.runwayDays} days). Review outflows and chase receivables.`,
      priority: 'high',
    });
  }

  if (s.revenueLastMonth > 0 && s.revenueThisMonth < s.revenueLastMonth) {
    const pct = Math.round(((s.revenueLastMonth - s.revenueThisMonth) / s.revenueLastMonth) * 100);
    if (pct >= 5) {
      recs.push({
        action: 'view-revenue',
        reasoning: `Revenue dropped ${pct}% MoM. Investigate the cause — fewer invoices, lower ticket size, or churned customers.`,
        priority: 'medium',
      });
    }
  }

  if (s.collectionRate < 0.7 && s.receivables > 0) {
    recs.push({
      action: 'view-receivables',
      reasoning: `Collection rate is ${(s.collectionRate * 100).toFixed(0)}% — below the 70% healthy threshold. Tighten payment terms.`,
      priority: 'medium',
    });
  }

  if (s.gstLiability > 0 && s.pendingReturns > 0) {
    recs.push({
      action: 'view-gst',
      reasoning: `GST liability of ₹${inr(s.gstLiability)} is outstanding. Set aside funds and file the pending return.`,
      priority: 'medium',
    });
  }

  // Always ensure at least one recommendation so the UI isn't empty
  if (recs.length === 0) {
    recs.push({
      action: 'view-dashboard',
      reasoning: 'Business metrics look healthy. Keep monitoring cash flow and GST filings weekly.',
      priority: 'low',
    });
  }
  return recs.slice(0, 5);
}

// ─── Build the deterministic fallback briefing ──────────────────────────────────

function buildFallbackBriefing(
  s: BusinessSnapshot,
  recentInvoices: any[],
  recentPayments: any[],
  recentReturns: any[],
): Briefing {
  const sections: BriefingSection[] = [];

  // Today's Business Summary
  sections.push({
    title: "Today's Business Summary",
    icon: 'trending-up',
    items: [
      { label: 'Revenue (FY)', value: `₹${inr(s.revenue)}` },
      { label: 'Cash on hand', value: `₹${inr(s.cash)}` },
      { label: 'Receivables', value: `₹${inr(s.receivables)}` },
      { label: 'GST due', value: `₹${inr(s.gstLiability)}` },
    ],
  });

  // Upcoming Returns
  sections.push({
    title: 'Upcoming Returns',
    icon: 'file-text',
    items: recentReturns.length > 0
      ? recentReturns.map(r => ({
          label: `${r.returnType} — ${r.period}`,
          value: r.status === 'filed' ? 'Filed' : r.status === 'overdue' ? 'Overdue' : 'Pending',
        }))
      : [{ label: 'No returns', value: 'None scheduled' }],
  });

  // Recent Customers (via invoices)
  sections.push({
    title: 'Recent Customers',
    icon: 'users',
    items: recentInvoices.length > 0
      ? recentInvoices.map(i => ({
          label: i.buyerName ?? i.client?.tradeName ?? '—',
          value: `₹${inr(i.totalAmount)} • ${i.invoiceNumber ?? '—'}`,
        }))
      : [{ label: 'No recent invoices', value: '—' }],
  });

  // Recent Payments
  sections.push({
    title: 'Recent Payments',
    icon: 'credit-card',
    items: recentPayments.length > 0
      ? recentPayments.map(p => ({
          label: p.partyName ?? (p.partyType === 'customer' ? 'Customer' : 'Vendor'),
          value: `₹${inr(p.amount)}${p.paymentMode ? ' • ' + p.paymentMode : ''}`,
        }))
      : [{ label: 'No recent payments', value: '—' }],
  });

  // Cash Flow
  sections.push({
    title: 'Cash Flow',
    icon: 'wallet',
    items: [
      { label: 'Collected', value: `₹${inr(s.totalCollected)}` },
      { label: 'Paid out', value: `₹${inr(s.totalPaid)}` },
      { label: 'Net', value: `₹${inr(s.netCashFlow)}`, trend: s.netCashFlow >= 0 ? 'up' : 'down' },
      { label: 'Runway', value: s.runwayDays === Infinity ? '∞ days' : `${s.runwayDays} days` },
    ],
  });

  return {
    greeting: greetingForIST(),
    generatedAt: new Date().toISOString(),
    sections,
    riskAlerts: deriveRiskAlerts(s),
    recommendations: deriveRecommendations(s, recentReturns),
  };
}

// ─── LLM output sanitizer ──────────────────────────────────────────────────────

function sanitizeLLMBriefing(raw: any, s: BusinessSnapshot): Briefing | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sections)) return null;

  const validIcons = ['trending-up', 'trending-down', 'file-text', 'users', 'credit-card', 'wallet', 'alert-triangle', 'calendar', 'check-circle', 'rupee'];

  const sections: BriefingSection[] = raw.sections
    .filter((sec: any) => sec && typeof sec.title === 'string')
    .map((sec: any) => ({
      title: String(sec.title).slice(0, 80),
      icon: typeof sec.icon === 'string' && validIcons.includes(sec.icon) ? sec.icon : 'trending-up',
      items: Array.isArray(sec.items)
        ? sec.items
            .filter((it: any) => it && (it.label || it.value))
            .slice(0, 8)
            .map((it: any) => ({
              label: String(it.label ?? ''),
              value: String(it.value ?? ''),
              trend: it.trend === 'up' || it.trend === 'down' || it.trend === 'flat' ? it.trend : undefined,
            }))
        : [],
    }))
    .slice(0, 6);

  const riskAlerts: RiskAlert[] = Array.isArray(raw.riskAlerts)
    ? raw.riskAlerts
        .filter((a: any) => a && a.message)
        .slice(0, 6)
        .map((a: any) => ({
          level: a.level === 'high' || a.level === 'low' ? a.level : 'medium',
          message: String(a.message).slice(0, 240),
        }))
    : deriveRiskAlerts(s);

  const recommendations: Recommendation[] = Array.isArray(raw.recommendations)
    ? raw.recommendations
        .filter((r: any) => r && (r.action || r.reasoning))
        .slice(0, 5)
        .map((r: any) => ({
          action: String(r.action ?? 'view-dashboard').slice(0, 120),
          reasoning: String(r.reasoning ?? '').slice(0, 300),
          priority: r.priority === 'high' || r.priority === 'low' ? r.priority : 'medium',
        }))
    : deriveRecommendations(s, []);

  const greeting =
    typeof raw.greeting === 'string' &&
    ['Good morning', 'Good afternoon', 'Good evening'].includes(raw.greeting)
      ? raw.greeting
      : greetingForIST();

  const generatedAt =
    typeof raw.generatedAt === 'string' && !isNaN(Date.parse(raw.generatedAt))
      ? raw.generatedAt
      : new Date().toISOString();

  return { greeting, generatedAt, sections, riskAlerts, recommendations };
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json(
      { ok: false, error: 'orgId is required' },
      { status: 400 },
    );
  }

  // ─── 1. Gather live data (defensive — never crash on DB issues) ─────────────
  let snapshot: BusinessSnapshot | null = null;
  try {
    snapshot = await getBusinessSnapshot(orgId);
  } catch (e) {
    console.error('[oracle/briefing] snapshot failed:', (e as Error).message);
    snapshot = null;
  }

  if (!snapshot) {
    // Minimal valid response — empty arrays, never crash
    const empty: Briefing = {
      greeting: greetingForIST(),
      generatedAt: new Date().toISOString(),
      sections: [],
      riskAlerts: [],
      recommendations: [],
    };
    return NextResponse.json({ ok: true, briefing: empty });
  }

  const [recentInvoices, recentPayments, recentReturns] = await Promise.all([
    fetchRecentInvoices(orgId),
    fetchRecentPayments(orgId),
    fetchUpcomingReturns(orgId),
  ]);

  // ─── 2. Build the LLM prompt ────────────────────────────────────────────────
  const snapshotJson = JSON.stringify({
    generatedAt: snapshot.generatedAt,
    revenue: snapshot.revenue,
    revenueThisMonth: snapshot.revenueThisMonth,
    revenueLastMonth: snapshot.revenueLastMonth,
    expenses: snapshot.expenses,
    profit: snapshot.profit,
    profitMargin: snapshot.profitMargin,
    cash: snapshot.cash,
    receivables: snapshot.receivables,
    payables: snapshot.payables,
    overdueReceivables: snapshot.overdueReceivables,
    overdueInvoiceCount: snapshot.overdueInvoiceCount,
    customerCount: snapshot.customerCount,
    invoiceCount: snapshot.invoiceCount,
    vendorCount: snapshot.vendorCount,
    filedReturns: snapshot.filedReturns,
    pendingReturns: snapshot.pendingReturns,
    overdueReturns: snapshot.overdueReturns,
    outputTax: snapshot.outputTax,
    inputTax: snapshot.inputTax,
    gstLiability: snapshot.gstLiability,
    totalCollected: snapshot.totalCollected,
    totalPaid: snapshot.totalPaid,
    netCashFlow: snapshot.netCashFlow,
    avgDaysToPay: snapshot.avgDaysToPay,
    collectionRate: snapshot.collectionRate,
    workingCapital: snapshot.workingCapital,
    runwayDays: snapshot.runwayDays === Infinity ? null : snapshot.runwayDays,
    healthScore: snapshot.healthScore,
    healthScoreLabel: snapshot.healthScoreLabel,
    riskScore: snapshot.riskScore,
    forecast: snapshot.forecast,
    recentInvoices: recentInvoices.map(i => ({
      number: i.invoiceNumber,
      customer: i.buyerName ?? i.client?.tradeName,
      amount: i.totalAmount,
      status: i.paymentStatus,
    })),
    recentPayments: recentPayments.map(p => ({
      party: p.partyName,
      amount: p.amount,
      mode: p.paymentMode,
    })),
    upcomingReturns: recentReturns.map(r => ({
      type: r.returnType,
      period: r.period,
      status: r.status,
      tax: r.totalTax,
    })),
  });

  const systemPrompt = `You are Oracle, the AI CFO of GSTPilot. Generate a structured daily briefing for this business.

Output ONLY valid JSON (no markdown fences, no prose) with this EXACT shape:
{
  "greeting": "Good morning" | "Good afternoon" | "Good evening",
  "generatedAt": "ISO timestamp",
  "sections": [
    { "title": string, "icon": string, "items": [ { "label": string, "value": string, "trend"?: "up"|"down"|"flat" } ] }
  ],
  "riskAlerts": [ { "level": "high"|"medium"|"low", "message": string } ],
  "recommendations": [ { "action": string, "reasoning": string, "priority": "high"|"medium"|"low" } ]
}

Rules:
- Use the data provided; never invent numbers.
- Include exactly 5 sections: "Today's Business Summary" (revenue, cash, receivables, GST due), "Upcoming Returns", "Recent Customers", "Recent Payments", "Cash Flow".
- icon should be a lucide-react icon name (kebab-case), e.g. "trending-up", "file-text", "users", "credit-card", "wallet".
- Each section should have 3-5 items. Values should be human-readable strings with ₹ prefix for money.
- riskAlerts: derive from the data — overdue invoices, pending GST returns, low cash, negative cashflow, MoM revenue decline. Keep messages concrete (include numbers).
- recommendations: 3-5 actionable suggestions. "action" is a short command-palette slug (e.g. "send-reminders", "generate-gst", "view-cashflow"). "reasoning" explains why in one sentence. Order by priority (high first).
- If a data field is 0 or empty, still represent it honestly (e.g. "₹0", "None pending").`;

  const userMessage = `Generate today's daily briefing. Business snapshot (JSON):\n\n${snapshotJson}`;

  // ─── 3. Call the LLM ────────────────────────────────────────────────────────
  let llmBriefing: Briefing | null = null;
  try {
    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      thinking: { type: 'disabled' },
    });
    const text = result?.choices?.[0]?.message?.content ?? '';
    const parsed = parseLLMJson(text);
    if (parsed) {
      llmBriefing = sanitizeLLMBriefing(parsed, snapshot);
    }
  } catch (e) {
    console.error('[oracle/briefing] LLM failed:', (e as Error).message);
  }

  // ─── 4. Fall back to the deterministic briefing if LLM failed ───────────────
  const briefing: Briefing =
    llmBriefing ?? buildFallbackBriefing(snapshot, recentInvoices, recentPayments, recentReturns);

  return NextResponse.json({ ok: true, briefing });
}
