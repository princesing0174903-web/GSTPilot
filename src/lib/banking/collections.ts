// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Cloud™ — Module 7: Collection Recovery Cloud
// Detect → Remind → Escalate → Recover → Report.
// WhatsApp + Email reminders. Deterministic engine. No LLM.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { CollectionState, CollectionRecord, CollectionSummary, CollectionStage, CollectionStatus } from './types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

function timeAgo(d: Date | null): string {
  if (!d) return 'never';
  const diff = Date.now() - d.getTime();
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function riskFromDays(days: number, amount: number): { score: number; level: 'low' | 'medium' | 'high' | 'critical' } {
  // Score 0..100 — weighted by days overdue + amount.
  let score = Math.min(60, days * 2);
  if (amount > 500000) score += 25;
  else if (amount > 100000) score += 15;
  else if (amount > 25000) score += 8;
  score = Math.min(100, score);
  const level = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  return { score, level };
}

function stageFor(daysOverdue: number, reminderCount: number, recoveredAmount: number): CollectionStage {
  if (recoveredAmount > 0) return 'recover';
  if (daysOverdue > 45 || reminderCount >= 3) return 'escalate';
  if (reminderCount > 0) return 'remind';
  return 'detect';
}

function statusFor(daysOverdue: number, reminderCount: number, recoveredAmount: number, totalAmount: number): CollectionStatus {
  if (recoveredAmount >= totalAmount) return 'recovered';
  if (daysOverdue > 90) return 'written_off';
  if (reminderCount >= 3) return 'escalated';
  if (reminderCount > 0) return 'reminded';
  return 'overdue';
}

function nextActionFor(stage: CollectionStage, days: number): string {
  switch (stage) {
    case 'detect': return `Send first WhatsApp reminder (overdue ${days}d)`;
    case 'remind': return `Send follow-up email + call (overdue ${days}d)`;
    case 'escalate': return `Escalate to legal notice (overdue ${days}d)`;
    case 'recover': return `Confirm recovery + send receipt`;
    case 'report': return `Mark as written off + update books`;
  }
}

// ─── Detect overdue invoices → CollectionRecovery records ──────────────────────

export async function detectOverdue(): Promise<{ detected: number }> {
  const invoices = await db.invoice.findMany({
    where: { status: { in: ['overdue', 'sent', 'partial'] } },
    take: 300,
  });

  let detected = 0;
  for (const inv of invoices) {
    if (!inv.invoiceDate) continue;
    const dueDate = new Date(inv.invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30); // 30-day payment terms
    const daysOverdue = daysBetween(new Date(), dueDate);
    if (daysOverdue <= 0) continue;

    // Skip if already tracked.
    const existing = await db.collectionRecovery.findFirst({
      where: { invoiceId: inv.id },
    });
    if (existing) continue;

    const { score } = riskFromDays(daysOverdue, inv.totalAmount);
    await db.collectionRecovery.create({
      data: {
        invoiceId: inv.id,
        customerName: inv.buyerName || 'Unknown Customer',
        customerGstin: inv.buyerGstin || null,
        amount: inv.totalAmount,
        dueDate: dueDate.toISOString(),
        daysOverdue,
        status: 'overdue',
        stage: 'detect',
        riskScore: score,
      },
    });
    detected++;
  }

  return { detected };
}

// ─── DTO builder ───────────────────────────────────────────────────────────────

function toDTO(row: {
  id: string;
  invoiceId: string | null;
  customerName: string;
  customerGstin: string | null;
  amount: number;
  dueDate: string | null;
  daysOverdue: number;
  status: string;
  stage: string;
  lastReminder: Date | null;
  reminderCount: number;
  channel: string | null;
  recoveredAmount: number;
  riskScore: number;
}): CollectionRecord {
  const { score, level } = riskFromDays(row.daysOverdue, row.amount);
  const stage = stageFor(row.daysOverdue, row.reminderCount, row.recoveredAmount);
  const status = statusFor(row.daysOverdue, row.reminderCount, row.recoveredAmount, row.amount);
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    customerName: row.customerName,
    customerGstin: row.customerGstin,
    amount: row.amount,
    dueDate: row.dueDate,
    daysOverdue: row.daysOverdue,
    status: status as CollectionStatus,
    stage: stage as CollectionStage,
    lastReminder: row.lastReminder ? row.lastReminder.toISOString() : null,
    lastReminderAgo: timeAgo(row.lastReminder),
    reminderCount: row.reminderCount,
    channel: row.channel,
    recoveredAmount: row.recoveredAmount,
    riskScore: score,
    riskLevel: level,
    nextAction: nextActionFor(stage, row.daysOverdue),
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function getCollectionsState(): Promise<CollectionState> {
  const records = await db.collectionRecovery.findMany({
    orderBy: [{ daysOverdue: 'desc' }, { amount: 'desc' }],
    take: 200,
  });

  const dtos = records.map(toDTO);

  const totalOverdue = dtos.filter((r) => r.status !== 'recovered' && r.status !== 'written_off').reduce((s, r) => s + r.amount, 0);
  const overdueCount = dtos.filter((r) => r.status === 'overdue').length;
  const remindedCount = dtos.filter((r) => r.status === 'reminded').length;
  const escalatedCount = dtos.filter((r) => r.status === 'escalated').length;
  const recoveredRecords = dtos.filter((r) => r.status === 'recovered');
  const recoveredThisWeek = recoveredRecords
    .filter((r) => r.recoveredAmount > 0)
    .reduce((s, r) => s + r.recoveredAmount, 0);
  const totalInvoiced = dtos.reduce((s, r) => s + r.amount, 0);
  const recoveryRate = totalInvoiced > 0 ? Math.round((recoveredThisWeek / totalInvoiced) * 100) : 0;
  const avgDaysOverdue = dtos.length > 0 ? Math.round(dtos.reduce((s, r) => s + r.daysOverdue, 0) / dtos.length) : 0;
  const totalAtRisk = dtos.filter((r) => r.riskLevel === 'high' || r.riskLevel === 'critical').reduce((s, r) => s + (r.amount - r.recoveredAmount), 0);

  const summary: CollectionSummary = {
    totalOverdue,
    overdueCount,
    remindedCount,
    escalatedCount,
    recoveredThisWeek,
    recoveredCount: recoveredRecords.length,
    recoveryRate,
    avgDaysOverdue,
    totalAtRisk,
  };

  // Workflow stages.
  const stages: CollectionStage[] = ['detect', 'remind', 'escalate', 'recover', 'report'];
  const workflow = stages.map((stage) => {
    const items = dtos.filter((r) => r.stage === stage);
    return {
      stage,
      label: stage.charAt(0).toUpperCase() + stage.slice(1),
      count: items.length,
      amount: items.reduce((s, r) => s + r.amount, 0),
    };
  });

  return {
    summary,
    records: dtos,
    workflow,
    hasLiveData: dtos.length > 0,
  };
}

export async function sendReminders(filter?: { stage?: CollectionStage }): Promise<{ sent: number; channel: string }> {
  // Deterministic reminder dispatch — marks records as reminded + increments count.
  const where: Record<string, unknown> = { status: { in: ['overdue', 'reminded'] } };
  if (filter?.stage) where.stage = filter.stage;
  const records = await db.collectionRecovery.findMany({ where, take: 100 });

  let sent = 0;
  const now = new Date();
  for (const r of records) {
    const newCount = r.reminderCount + 1;
    const newStage = newCount >= 3 || r.daysOverdue > 45 ? 'escalate' : 'remind';
    const newStatus = newCount >= 3 ? 'escalated' : 'reminded';
    const channel = r.daysOverdue > 30 ? 'whatsapp' : 'email';
    await db.collectionRecovery.update({
      where: { id: r.id },
      data: {
        lastReminder: now,
        reminderCount: newCount,
        stage: newStage,
        status: newStatus,
        channel,
      },
    });
    sent++;
  }

  return { sent, channel: 'whatsapp' };
}

export async function markRecovered(id: string, amount: number): Promise<{ recovered: boolean }> {
  await db.collectionRecovery.update({
    where: { id },
    data: {
      recoveredAmount: amount,
      recoveredAt: new Date(),
      status: 'recovered',
      stage: 'recover',
    },
  });
  return { recovered: true };
}
