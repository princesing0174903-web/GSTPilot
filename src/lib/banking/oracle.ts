// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Cloud™ — Orchestrator + Oracle Context Block
// Composes the full BankingState from all 8 modules and formats it for Oracle.
// Deterministic. No LLM. Oracle consumes the formatted block.
// ═══════════════════════════════════════════════════════════════════════════════

import { getAccounts } from './accounts';
import { getTransactions } from './statements';
import { getUPITransactions } from './upi';
import { getAAState } from './aggregator';
import { getCashFlowState } from './cashflow';
import { getReconcileState } from './reconcile';
import { getCollectionsState } from './collections';
import { getPaymentIntelligence } from './intelligence';
import type { BankingState } from './types';

// ─── INR formatting (server-side) ──────────────────────────────────────────────

function inrShort(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return sign + '₹' + Math.round(abs).toLocaleString('en-IN');
}

// ─── Compose full BankingState ─────────────────────────────────────────────────

export async function getBankingState(): Promise<BankingState> {
  const [accounts, transactions, upi, aa, cashFlow, reconcile, collections, intelligence] = await Promise.all([
    getAccounts(),
    getTransactions({ limit: 200 }),
    getUPITransactions({ limit: 200 }),
    getAAState(),
    getCashFlowState(),
    getReconcileState(),
    getCollectionsState(),
    getPaymentIntelligence(),
  ]);

  const hasLiveData =
    accounts.hasLiveData ||
    transactions.hasLiveData ||
    upi.hasLiveData ||
    cashFlow.hasLiveData ||
    reconcile.hasLiveData ||
    collections.hasLiveData ||
    intelligence.hasLiveData;

  return {
    accounts,
    transactions,
    upi,
    aa,
    cashFlow,
    reconcile,
    collections,
    intelligence,
    hasLiveData,
  };
}

// ─── Oracle Context Block ──────────────────────────────────────────────────────

export function formatBankingContextBlock(state: BankingState): string {
  if (!state.hasLiveData) {
    return `## LIVE BANKING CLOUD STATE
No bank accounts connected yet. Encourage the user to connect a bank account (HDFC, ICICI, Axis, SBI, Kotak, Yes Bank, PNB, Bank of Baroda) or link via Account Aggregator to unlock the Banking Cloud. Do not fabricate banking numbers.`;
  }

  const a = state.accounts;
  const cf = state.cashFlow;
  const rc = state.reconcile;
  const col = state.collections;
  const intel = state.intelligence;
  const upi = state.upi;
  const aa = state.aa;

  const accountLines = a.accounts.slice(0, 8).map(
    (acc) => `  - ${acc.bankName} ${acc.accountNumberMasked} (${acc.accountType}): ${inrShort(acc.currentBalance)} · ${acc.status} · last sync ${acc.lastSyncAgo}`,
  ).join('\n');

  const riskTriggers = cf.riskTriggers.map((t) => `  - ${t}`).join('\n');

  const reconcileByType = Object.entries(rc.summary.byMatchType)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  const topCollections = col.records.slice(0, 5).map(
    (r) => `  - ${r.customerName}: ${inrShort(r.amount)} overdue ${r.daysOverdue}d (${r.riskLevel}) — ${r.nextAction}`,
  ).join('\n');

  const riskyClients = intel.riskyClients.slice(0, 5).map(
    (c) => `  - ${c.customerName}: outstanding ${inrShort(c.outstanding)}, avg delay ${c.avgDelayDays}d, risk ${c.riskScore}/100 (${c.riskLevel}), delay probability ${Math.round(c.delayProbability * 100)}%`,
  ).join('\n');

  return `## LIVE BANKING CLOUD STATE (Phase 8 Step 2 — VEYRO Banking Cloud™)
You have real-time access to the user's banking position. Treat these numbers as authoritative when the user asks about cash, banks, UPI, collections, reconciliation, or payment behaviour.

### Module 1 — Bank Accounts
- Total balance across ${a.totalAccounts} accounts: ${inrShort(a.totalBalance)}
- Active accounts: ${a.activeAccounts} · Synced today: ${a.syncedToday}
${accountLines || '  · No bank accounts connected.'}

### Module 2 — Bank Transactions
- Last 200 transactions: ${inrShort(state.transactions.totalInflow)} inflow · ${inrShort(state.transactions.totalOutflow)} outflow · net ${inrShort(state.transactions.netFlow)}

### Module 3 — UPI Cloud
- ${upi.total} UPI transactions: ${upi.incomingCount} incoming (${inrShort(upi.incomingAmount)}), ${upi.outgoingCount} outgoing (${inrShort(upi.outgoingAmount)})
- ${upi.pendingCount} pending · ${upi.matchedCount} matched to bank

### Module 4 — Account Aggregator
- ${aa.totalLinked} accounts linked via AA · Aggregated balance: ${inrShort(aa.totalBalance)}
- ${aa.consents.length} active consents

### Module 5 — Cash Flow Engine (FLAGSHIP)
- Current Cash: ${inrShort(cf.metrics.currentCash)}
- 7-Day Forecast: +${inrShort(cf.metrics.cashIn7Days)} in / -${inrShort(cf.metrics.cashOut7Days)} out / net ${inrShort(cf.metrics.net7Days)}
- 30-Day Forecast: +${inrShort(cf.metrics.cashIn30Days)} in / -${inrShort(cf.metrics.cashOut30Days)} out / net ${inrShort(cf.metrics.net30Days)}
- 90-Day projected balance: ${inrShort(cf.forecast.ninetyDay)}
- Daily Burn: ${inrShort(cf.metrics.dailyBurn)}/day · Monthly Burn: ${inrShort(cf.metrics.monthlyBurn)}
- Runway: ${cf.metrics.runwayDays === 999 ? '∞' : cf.metrics.runwayDays + ' days'} · Risk: ${cf.metrics.riskLevel.toUpperCase()}
- Collection Forecast (30d): ${inrShort(cf.metrics.collectionForecast)}
- Payment Forecast (30d): ${inrShort(cf.metrics.paymentForecast)}
- Upcoming GST: ${inrShort(cf.metrics.upcomingGST)}
${cf.forecast.cashGapDate ? `- ⚠️ CASH GAP detected: ${inrShort(cf.forecast.cashGap)} shortfall projected on ${new Date(cf.forecast.cashGapDate).toLocaleDateString('en-IN')}` : ''}

### Cash Risk Triggers (narrative)
${riskTriggers || '  · No cash risks detected.'}

### Module 6 — Auto Reconciliation
- Matched: ${rc.summary.matched}/${rc.summary.totalTransactions} (${rc.summary.matchedPct}%) · Matched amount: ${inrShort(rc.summary.matchedAmount)}
- Unmatched amount: ${inrShort(rc.summary.unmatchedAmount)} · Pending collections: ${rc.summary.pendingCollections}
- Risk level: ${rc.summary.riskLevel.toUpperCase()}
- Breakdown: ${reconcileByType || 'none'}

### Module 7 — Collection Recovery
- Total overdue: ${inrShort(col.summary.totalOverdue)} across ${col.summary.overdueCount} invoices
- Reminded: ${col.summary.remindedCount} · Escalated: ${col.summary.escalatedCount}
- Recovered this week: ${inrShort(col.summary.recoveredThisWeek)} · Recovery rate: ${col.summary.recoveryRate}%
- Avg days overdue: ${col.summary.avgDaysOverdue} · Total at risk: ${inrShort(col.summary.totalAtRisk)}
${topCollections || '  · No overdue collections.'}

### Module 8 — Payment Intelligence
- Risky clients: ${intel.riskyClients.length} · Total at risk: ${inrShort(intel.totalAtRisk)}
- Expected collections (30d): ${inrShort(intel.expectedCollections30d)}
- Avg delay probability: ${Math.round(intel.avgDelayProbability * 100)}% · Trend: ${intel.trend}
${riskyClients || '  · No risky clients detected.'}

When answering Banking Cloud questions, ALWAYS:
1. Lead with the spoken ack in past tense ("I've detected a cash shortage in 18 days.", "I've reconciled your bank transactions.", "I've scheduled collections recovery.", "I've identified risky clients.", "I've predicted your cash runway.")
2. Cite the exact numbers from above — never fabricate.
3. For cash flow questions, give the runway + burn + forecast horizon.
4. For reconciliation questions, give the matched % + unmatched amount + pending collections.
5. For collections questions, give the total overdue + recovered this week + next actions.
6. For payment behaviour, name the risky clients with their outstanding + delay probability.
NEVER say "You can check your cash flow." Instead: "I've detected..." / "I've reconciled..." / "I've scheduled..."`;
}
