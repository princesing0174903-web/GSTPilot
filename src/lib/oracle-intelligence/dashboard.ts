// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE INTELLIGENCE — Phase 6: Executive Dashboard Aggregator
// ═══════════════════════════════════════════════════════════════════════════════
// Combines Memory + Graph + Timeline + Reasoning into a single payload for the
// Executive Dashboard UI. Also computes the KPI strip (all real numbers).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { buildMemorySnapshot } from './memory-engine';
import { buildBusinessGraph } from './business-graph';
import { buildTimeline } from './timeline';
import { buildReasoning } from './reasoning-engine';
import type { ExecutiveDashboard } from './types';

const round2 = (n: number): number => Math.round(n * 100) / 100;
const DAY = 1000 * 60 * 60 * 24;

export async function buildExecutiveDashboard(): Promise<ExecutiveDashboard> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY).toISOString();

  // Run all four engines + KPI queries in parallel
  const [memory, graph, timeline, reasoning, kpiData] = await Promise.all([
    buildMemorySnapshot(),
    buildBusinessGraph(),
    buildTimeline(100),
    buildReasoning(),
    (async () => {
      const [
        revenue30d, collected30d, outstanding, overdueAgg, expenses30d,
        gstOutput, gstInput, activeCustomers, activeVendors, bankAgg, monthlyExpenses,
      ] = await Promise.all([
        db.invoice.aggregate({ where: { invoiceDate: { gte: thirtyDaysAgo } }, _sum: { totalAmount: true } }),
        db.payment.aggregate({ where: { partyType: 'customer', paymentDate: { gte: thirtyDaysAgo } }, _sum: { amount: true } }),
        db.invoice.aggregate({ where: { paymentStatus: { not: 'paid' }, balanceAmount: { gt: 0 } }, _sum: { balanceAmount: true } }),
        db.invoice.findMany({
          where: { paymentStatus: { not: 'paid' }, dueDate: { lt: now.toISOString(), not: null }, balanceAmount: { gt: 0 } },
          select: { balanceAmount: true },
        }),
        db.expense.aggregate({ where: { date: { gte: thirtyDaysAgo } }, _sum: { amount: true } }),
        db.invoice.aggregate({ where: { invoiceDate: { gte: monthStart } }, _sum: { gstAmount: true } }),
        db.purchaseBill.aggregate({ where: { invoiceDate: { gte: monthStart } }, _sum: { gstAmount: true } }),
        db.client.count({ where: { status: 'active' } }),
        db.vendor.count({ where: { status: 'active' } }),
        db.bankAccount.aggregate({ _sum: { balance: true } }),
        db.expense.aggregate({ where: { date: { gte: monthStart } }, _sum: { amount: true } }),
      ]);

      const overdueTotal = overdueAgg.reduce((s, r) => s + r.balanceAmount, 0);
      const bankBalance = bankAgg._sum.balance || 0;
      const monthlyBurn = (monthlyExpenses._sum.amount || 0);
      const cashRunwayDays = monthlyBurn > 0 ? Math.floor((bankBalance / monthlyBurn) * 30) : null;

      // Average payment delay
      const paidInvoices = await db.invoice.findMany({
        where: { paymentStatus: 'paid', dueDate: { not: null }, paymentDate: { not: null } },
        select: { dueDate: true, paymentDate: true },
        take: 500,
      });
      let avgDelay = 0;
      if (paidInvoices.length > 0) {
        const totalDelay = paidInvoices.reduce((s, r) => {
          const d = new Date(r.dueDate!).getTime();
          const p = new Date(r.paymentDate!).getTime();
          return s + Math.max(0, Math.round((p - d) / DAY));
        }, 0);
        avgDelay = Math.round(totalDelay / paidInvoices.length);
      }

      return {
        revenue30d: round2(revenue30d._sum.totalAmount || 0),
        collected30d: round2(collected30d._sum.amount || 0),
        outstandingNow: round2(outstanding._sum.balanceAmount || 0),
        overdueNow: round2(overdueTotal),
        expenses30d: round2(expenses30d._sum.amount || 0),
        gstThisMonth: round2((gstOutput._sum.gstAmount || 0) - (gstInput._sum.gstAmount || 0)),
        activeCustomers,
        activeVendors,
        avgPaymentDelayDays: avgDelay,
        cashRunwayDays,
      };
    })(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    empty: memory.empty,
    memory,
    graph,
    timeline,
    reasoning,
    kpis: kpiData,
  };
}
