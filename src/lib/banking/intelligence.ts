// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Cloud™ — Module 8: Payment Intelligence
// Payment behaviour, risk scoring, late payer prediction, collection probability.
// Deterministic engine. No LLM.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  PaymentIntelligenceState,
  ClientPaymentProfile,
  PaymentTrend,
} from './types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

function riskLevelFromScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function trendFromDelay(avgDelay: number): PaymentTrend {
  if (avgDelay > 30) return 'declining';
  if (avgDelay > 7) return 'stable';
  return 'improving';
}

// ─── Build client payment profiles from invoices + collections ─────────────────

export async function getPaymentIntelligence(): Promise<PaymentIntelligenceState> {
  const invoices = await db.invoice.findMany({
    where: { buyerName: { not: null } },
    take: 500,
  });
  const collections = await db.collectionRecovery.findMany({ take: 200 });

  // Group invoices by buyer.
  const byBuyer = new Map<string, typeof invoices>();
  for (const inv of invoices) {
    const key = inv.buyerName || 'Unknown';
    if (!byBuyer.has(key)) byBuyer.set(key, []);
    byBuyer.get(key)!.push(inv);
  }

  const profiles: ClientPaymentProfile[] = [];

  for (const [buyerName, invs] of byBuyer) {
    const totalInvoiced = invs.reduce((s, i) => s + i.totalAmount, 0);
    const paidInvs = invs.filter((i) => i.status === 'paid');
    const totalCollected = paidInvs.reduce((s, i) => s + i.totalAmount, 0);
    const outstanding = totalInvoiced - totalCollected;
    const invoiceCount = invs.length;

    // Avg delay — from collections records for this buyer.
    const buyerCollections = collections.filter((c) => c.customerName === buyerName);
    const avgDelayDays = buyerCollections.length > 0
      ? Math.round(buyerCollections.reduce((s, c) => s + c.daysOverdue, 0) / buyerCollections.length)
      : (outstanding > 0 ? 15 : 0); // default 15d if outstanding but no collection record

    const onTimeRate = invoiceCount > 0 ? Math.round((paidInvs.length / invoiceCount) * 100) : 100;

    // Risk score 0..100.
    let riskScore = 0;
    riskScore += Math.min(40, avgDelayDays); // up to 40 from delay
    if (outstanding > 500000) riskScore += 30;
    else if (outstanding > 100000) riskScore += 20;
    else if (outstanding > 25000) riskScore += 10;
    if (onTimeRate < 50) riskScore += 20;
    else if (onTimeRate < 80) riskScore += 10;
    riskScore = Math.min(100, riskScore);

    const delayProbability = Math.min(0.95, avgDelayDays / 60 + (onTimeRate < 80 ? 0.2 : 0));
    const collectionProbability = Math.max(0.1, 1 - delayProbability - (riskScore / 200));
    const expectedCollection = outstanding * collectionProbability;
    const lastPaymentDate = paidInvs.length > 0
      ? paidInvs.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())[0].invoiceDate
      : null;

    profiles.push({
      customerName: buyerName,
      customerGstin: invs[0]?.buyerGstin || null,
      totalInvoiced,
      totalCollected,
      outstanding,
      avgDelayDays,
      onTimeRate,
      riskScore,
      riskLevel: riskLevelFromScore(riskScore),
      trend: trendFromDelay(avgDelayDays),
      delayProbability,
      collectionProbability,
      expectedCollection,
      lastPaymentDate,
      invoiceCount,
    });
  }

  // Sort by risk score descending.
  profiles.sort((a, b) => b.riskScore - a.riskScore);

  const riskyClients = profiles.filter((p) => p.riskLevel === 'high' || p.riskLevel === 'critical');
  const topLatePayers = [...profiles].sort((a, b) => b.avgDelayDays - a.avgDelayDays).slice(0, 5);
  const expectedCollections30d = profiles.reduce((s, p) => s + p.expectedCollection, 0);
  const avgDelayProbability = profiles.length > 0
    ? profiles.reduce((s, p) => s + p.delayProbability, 0) / profiles.length
    : 0;
  const totalAtRisk = riskyClients.reduce((s, p) => s + p.outstanding, 0);
  const overallTrend: PaymentTrend = avgDelayProbability > 0.5 ? 'declining' : avgDelayProbability > 0.25 ? 'stable' : 'improving';

  return {
    riskyClients: riskyClients.slice(0, 20),
    expectedCollections30d,
    avgDelayProbability,
    totalAtRisk,
    trend: overallTrend,
    topLatePayers,
    hasLiveData: profiles.length > 0,
  };
}
