// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Intelligent Collections Engine (Phase Delta · 6)
// Customer payment scoring, smart escalation, payment prediction, analytics.
// ═══════════════════════════════════════════════════════════════════════════════

export type PaymentTier = 'excellent' | 'good' | 'at-risk' | 'critical';

export interface CustomerPaymentScore {
  clientId: string;
  clientName: string;
  score: number; // 0-100
  tier: PaymentTier;
  avgDaysToPay: number;
  predictedPayDate?: string;
  totalOutstanding: number;
  overdueAmount: number;
  oldestOverdueDays: number;
  recommendedAction: string;
  escalationLevel: 0 | 1 | 2 | 3 | 4;
}

export interface CollectionAnalytics {
  totalOutstanding: number;
  totalOverdue: number;
  byTier: { excellent: { count: number; amount: number }; good: { count: number; amount: number }; atRisk: { count: number; amount: number }; critical: { count: number; amount: number } };
  byAgeBucket: { '0-30': number; '31-60': number; '61-90': number; '90+': number };
  avgDaysToPayOverall: number;
  collectionEffectiveness: number; // 0-100
}

export interface EscalationStep {
  level: 0 | 1 | 2 | 3 | 4;
  triggerDays: number;
  action: string;
  channel: string;
}

export interface IntelligentCollectionsReport {
  generatedAt: Date;
  scores: CustomerPaymentScore[];
  analytics: CollectionAnalytics;
}

interface CollectionsInput {
  invoices: Array<Record<string, unknown>>;
  clients: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
}

export const ESCALATION_LADDER: EscalationStep[] = [
  { level: 0, triggerDays: 0, action: 'No action — invoice on standard terms', channel: 'none' },
  { level: 1, triggerDays: 3, action: 'Friendly email reminder', channel: 'email' },
  { level: 2, triggerDays: 7, action: 'WhatsApp reminder + statement', channel: 'whatsapp' },
  { level: 3, triggerDays: 14, action: 'Phone call + hold further services', channel: 'phone' },
  { level: 4, triggerDays: 30, action: 'Legal notice via advocate', channel: 'legal' },
];

function tierFor(score: number): PaymentTier {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'at-risk';
  return 'critical';
}

function escalationFor(daysOverdue: number): 0 | 1 | 2 | 3 | 4 {
  if (daysOverdue >= 30) return 4;
  if (daysOverdue >= 14) return 3;
  if (daysOverdue >= 7) return 2;
  if (daysOverdue >= 3) return 1;
  return 0;
}

function ageBucket(daysOverdue: number): '0-30' | '31-60' | '61-90' | '90+' {
  if (daysOverdue > 90) return '90+';
  if (daysOverdue > 60) return '61-90';
  if (daysOverdue > 30) return '31-60';
  return '0-30';
}

export function computeIntelligentCollections(input: CollectionsInput): IntelligentCollectionsReport {
  const { invoices, clients, payments = [] } = input;
  const now = Date.now();
  const clientMap = new Map<string, Record<string, unknown>>();
  for (const c of clients) clientMap.set(String(c.clientId ?? ''), c);

  // Group invoices by client
  const invoicesByClient: Record<string, Array<Record<string, unknown>>> = {};
  for (const inv of invoices) {
    const cid = String(inv.clientId ?? '');
    (invoicesByClient[cid] ||= []).push(inv);
  }

  const scores: CustomerPaymentScore[] = [];
  let totalOutstanding = 0;
  let totalOverdue = 0;
  const byTier = {
    excellent: { count: 0, amount: 0 }, good: { count: 0, amount: 0 },
    atRisk: { count: 0, amount: 0 }, critical: { count: 0, amount: 0 },
  };
  const byAgeBucket = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  let totalDaysToPay = 0;
  let paidCount = 0;
  let totalCollected = 0;
  let totalBilled = 0;

  for (const [clientId, clientInvoices] of Object.entries(invoicesByClient)) {
    const client = clientMap.get(clientId);
    const clientName = String(client?.tradeName ?? client?.legalName ?? 'Unknown');

    let outstanding = 0;
    let overdue = 0;
    let oldestOverdueDays = 0;
    let daysToPaySum = 0;
    let paidInvoiceCount = 0;

    for (const inv of clientInvoices) {
      const amt = Number(inv.totalAmount ?? 0);
      totalBilled += amt;
      const status = String(inv.status ?? '');
      if (status === 'paid') {
        totalCollected += amt;
        // Compute days to pay from invoice date to payment date
        const invDate = inv.invoiceDate ? new Date(String(inv.invoiceDate)).getTime() : null;
        const pay = payments.find((p) => String(p.invoiceId ?? '') === String(inv.invoiceId ?? ''));
        const payDate = pay?.paymentDate ? new Date(String(pay.paymentDate)).getTime() : null;
        if (invDate && payDate && payDate >= invDate) {
          daysToPaySum += Math.round((payDate - invDate) / (24 * 60 * 60 * 1000));
          paidInvoiceCount++;
        }
      } else {
        outstanding += amt;
        const dueDateStr = inv.dueDate ? String(inv.dueDate) : inv.invoiceDate ? String(inv.invoiceDate) : null;
        if (dueDateStr) {
          const due = new Date(dueDateStr).getTime();
          if (!isNaN(due)) {
            const daysOverdue = Math.max(0, Math.round((now - due) / (24 * 60 * 60 * 1000)));
            if (daysOverdue > 0) {
              overdue += amt;
              byAgeBucket[ageBucket(daysOverdue)] += amt;
              if (daysOverdue > oldestOverdueDays) oldestOverdueDays = daysOverdue;
            }
          }
        }
      }
    }

    const avgDaysToPay = paidInvoiceCount > 0 ? Math.round(daysToPaySum / paidInvoiceCount) : 30;
    const overdueRatio = outstanding > 0 ? overdue / outstanding : 0;
    const score = Math.max(0, Math.min(100, Math.round(100 - avgDaysToPay * 1.5 - overdueRatio * 30)));
    const tier = tierFor(score);
    const escLevel = escalationFor(oldestOverdueDays);
    const escAction = ESCALATION_LADDER[escLevel];

    totalOutstanding += outstanding;
    totalOverdue += overdue;
    byTier[tier].count++;
    byTier[tier].amount += outstanding;
    totalDaysToPay += daysToPaySum;
    paidCount += paidInvoiceCount;

    const predictedPayDate = outstanding > 0
      ? new Date(now + avgDaysToPay * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : undefined;

    scores.push({
      clientId,
      clientName,
      score,
      tier,
      avgDaysToPay,
      predictedPayDate,
      totalOutstanding: outstanding,
      overdueAmount: overdue,
      oldestOverdueDays,
      recommendedAction: escLevel === 0
        ? 'No action needed — monitor on standard terms.'
        : `${escAction.action} (escalation level ${escLevel}).`,
      escalationLevel: escLevel,
    });
  }

  scores.sort((a, b) => b.overdueAmount - a.overdueAmount);

  const avgDaysToPayOverall = paidCount > 0 ? Math.round(totalDaysToPay / paidCount) : 0;
  const collectionEffectiveness = totalBilled > 0
    ? Math.round((totalCollected / totalBilled) * 100)
    : 0;

  return {
    generatedAt: new Date(),
    scores,
    analytics: {
      totalOutstanding,
      totalOverdue,
      byTier,
      byAgeBucket,
      avgDaysToPayOverall,
      collectionEffectiveness,
    },
  };
}
