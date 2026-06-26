// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle Real Data Layer™
// ═══════════════════════════════════════════════════════════════════════════════
//
// Aggregates REAL data from all connected sources so Oracle can answer:
//   "How is my business doing?"  →  using REAL connected data
//   "How much cash do I have?"   →  from REAL bank transactions
//   "Any GST notice?"            →  from REAL Gmail sync
//   "Which clients ignore reminders?" → from REAL WhatsApp data
//
// No demo values. No mock values. Only real connected data.
// If a source is not connected, Oracle knows and says so honestly.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { computeCashPosition, categorizeTransaction } from '@/lib/connectors/bank';
import { identifyIgnoringClients } from '@/lib/connectors/whatsapp';
import type { Connection } from '@/lib/connectors/types';

export interface RealDataSnapshot {
  userId: string;
  connections: Array<{
    type: string;
    label: string;
    status: string;
    lastSyncAt: string | null;
    recordCount: number;
  }>;
  cashPosition: {
    connected: boolean;
    totalBalance: number | null;
    recentCredits: number;
    recentDebits: number;
    netFlow: number;
    todayCollections: number;
    weekCollections: number;
    recentCollections: Array<{ description: string; amount: number; date: string }>;
  };
  gstStatus: {
    connected: boolean;
    gstin: string | null;
    tradeName: string | null;
    filingStatus: string | null;
    itcPosition: number | null;
    recentNotices: Array<{ title: string; date: string }>;
  };
  emailInsights: {
    connected: boolean;
    email: string | null;
    totalSynced: number;
    gstNotices: number;
    vendorInvoices: number;
    clientInvoices: number;
    taxCommunications: number;
    recentNotices: Array<{ subject: string; from: string; date: string }>;
  };
  whatsappInsights: {
    connected: boolean;
    phoneNumber: string | null;
    totalMessages: number;
    remindersSent: number;
    clientsIgnoringReminders: Array<{
      contactName: string;
      remindersSent: number;
      daysSinceLastReminder: number;
    }>;
  };
  accountingSync: {
    connected: boolean;
    software: string | null;
    companyName: string | null;
    salesInvoices: number;
    purchaseBills: number;
    totalSales: number;
    totalPurchases: number;
  };
  dataQuality: {
    totalAlerts: number;
    critical: number;
    high: number;
    topAlerts: Array<{ title: string; severity: string; category: string }>;
  };
  connectedCount: number;
  hasAnyConnection: boolean;
}

/**
 * Build the real data snapshot for Oracle.
 * Reads from DataConnection + SyncedRecord + DataQualityAlert tables.
 */
export async function buildRealDataSnapshot(userId: string): Promise<RealDataSnapshot> {
  // Fetch all connections for this user
  const connections = await db.dataConnection.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  }).catch(() => []);

  // Fetch all synced records for this user
  const syncedRecords = await db.syncedRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  }).catch(() => []);

  // Fetch data quality alerts
  const qualityAlerts = await db.dataQualityAlert.findMany({
    where: { userId, resolved: false },
    orderBy: { createdAt: 'desc' },
  }).catch(() => []);

  const connectedCount = connections.filter((c) => c.status === 'connected').length;

  // ── Cash Position (from bank connections) ──
  const bankConnections = connections.filter((c) => c.type === 'bank' && c.status === 'connected');
  const bankRecords = syncedRecords.filter((r) => r.sourceType === 'bank_tx');
  const bankTxParsed = bankRecords.map((r) => {
    const data = r.rawData ? JSON.parse(r.rawData) : {};
    return {
      transactionId: r.externalId ?? r.id,
      date: r.date ?? '',
      description: r.title ?? '',
      amount: r.amount ?? 0,
      type: (data.type ?? (r.amount && r.amount > 0 ? 'credit' : 'debit')) as 'credit' | 'debit',
      balanceAfter: data.balanceAfter ?? 0,
      category: r.category ?? categorizeTransaction(r.title ?? ''),
    };
  });
  const cashPosition = computeCashPosition(bankTxParsed);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
  const todayCollections = cashPosition.credits
    .filter((t) => new Date(t.date) >= todayStart)
    .reduce((s, t) => s + t.amount, 0);
  const weekCollections = cashPosition.credits
    .filter((t) => new Date(t.date) >= weekStart)
    .reduce((s, t) => s + t.amount, 0);

  // ── GST Status (from GSTN connections) ──
  const gstnConnections = connections.filter((c) => c.type === 'gstn' && c.status === 'connected');
  const gstnMeta = gstnConnections[0]?.metadata ? JSON.parse(gstnConnections[0].metadata) : {};
  const gstNoticeEmails = syncedRecords.filter(
    (r) => r.sourceType === 'email' && r.category === 'gst_notice',
  );

  // ── Email Insights (from Gmail connections) ──
  const gmailConnections = connections.filter((c) => c.type === 'gmail' && c.status === 'connected');
  const gmailMeta = gmailConnections[0]?.metadata ? JSON.parse(gmailConnections[0].metadata) : {};
  const emailRecords = syncedRecords.filter((r) => r.sourceType === 'email');
  const emailCategoryCount = (cat: string) =>
    emailRecords.filter((r) => r.category === cat).length;

  // ── WhatsApp Insights ──
  const waConnections = connections.filter((c) => c.type === 'whatsapp' && c.status === 'connected');
  const waMeta = waConnections[0]?.metadata ? JSON.parse(waConnections[0].metadata) : {};
  const waMessages = syncedRecords
    .filter((r) => r.sourceType === 'whatsapp_msg')
    .map((r) => {
      const data = r.rawData ? JSON.parse(r.rawData) : {};
      return {
        messageId: r.externalId ?? r.id,
        contactName: data.contactName ?? 'Unknown',
        contactPhone: data.contactPhone ?? '',
        direction: (data.direction ?? 'outbound') as 'outbound' | 'inbound',
        messageText: r.title ?? '',
        timestamp: r.date ?? new Date().toISOString(),
        type: data.type ?? 'general',
      };
    });
  const ignoringClients = identifyIgnoringClients(waMessages);

  // ── Accounting Sync ──
  const accConnections = connections.filter(
    (c) => ['tally', 'zoho', 'quickbooks'].includes(c.type) && c.status === 'connected',
  );
  const accMeta = accConnections[0]?.metadata ? JSON.parse(accConnections[0].metadata) : {};
  const accInvoiceRecords = syncedRecords.filter((r) => r.sourceType === 'accounting_invoice');
  const salesInvoices = accInvoiceRecords.filter((r) => r.category === 'client_invoice');
  const purchaseInvoices = accInvoiceRecords.filter((r) => r.category === 'vendor_invoice');

  return {
    userId,
    connections: connections.map((c) => ({
      type: c.type,
      label: c.label,
      status: c.status,
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      recordCount: syncedRecords.filter((r) => r.connectionId === c.id).length,
    })),
    cashPosition: {
      connected: bankConnections.length > 0,
      totalBalance: bankConnections.length > 0 ? cashPosition.currentBalance : null,
      recentCredits: cashPosition.totalCredits,
      recentDebits: cashPosition.totalDebits,
      netFlow: cashPosition.netFlow,
      todayCollections,
      weekCollections,
      recentCollections: cashPosition.collections.slice(0, 5).map((t) => ({
        description: t.description,
        amount: t.amount,
        date: t.date,
      })),
    },
    gstStatus: {
      connected: gstnConnections.length > 0,
      gstin: gstnMeta.gstin ?? null,
      tradeName: gstnMeta.tradeName ?? null,
      filingStatus: gstnMeta.registrationStatus ?? null,
      itcPosition: null, // Requires GSTR-2B fetch
      recentNotices: gstNoticeEmails.slice(0, 3).map((r) => ({
        title: r.title ?? 'GST Notice',
        date: r.date ?? '',
      })),
    },
    emailInsights: {
      connected: gmailConnections.length > 0,
      email: gmailMeta.email ?? null,
      totalSynced: emailRecords.length,
      gstNotices: emailCategoryCount('gst_notice'),
      vendorInvoices: emailCategoryCount('vendor_invoice'),
      clientInvoices: emailCategoryCount('client_invoice'),
      taxCommunications: emailCategoryCount('tax_communication'),
      recentNotices: emailRecords
        .filter((r) => r.category === 'gst_notice')
        .slice(0, 3)
        .map((r) => {
          const data = r.rawData ? JSON.parse(r.rawData) : {};
          return { subject: r.title ?? '', from: data.from ?? '', date: r.date ?? '' };
        }),
    },
    whatsappInsights: {
      connected: waConnections.length > 0,
      phoneNumber: waMeta.phoneNumber ?? null,
      totalMessages: waMessages.length,
      remindersSent: waMessages.filter((m) => m.type === 'payment_reminder').length,
      clientsIgnoringReminders: ignoringClients.slice(0, 5).map((c) => ({
        contactName: c.contactName,
        remindersSent: c.remindersSent,
        daysSinceLastReminder: c.daysSinceLastReminder,
      })),
    },
    accountingSync: {
      connected: accConnections.length > 0,
      software: accMeta.software ?? accConnections[0]?.type ?? null,
      companyName: accMeta.companyName ?? null,
      salesInvoices: salesInvoices.length,
      purchaseBills: purchaseInvoices.length,
      totalSales: salesInvoices.reduce((s, r) => s + (r.amount ?? 0), 0),
      totalPurchases: purchaseInvoices.reduce((s, r) => s + (r.amount ?? 0), 0),
    },
    dataQuality: {
      totalAlerts: qualityAlerts.length,
      critical: qualityAlerts.filter((a) => a.severity === 'critical').length,
      high: qualityAlerts.filter((a) => a.severity === 'high').length,
      topAlerts: qualityAlerts.slice(0, 5).map((a) => ({
        title: a.title,
        severity: a.severity,
        category: a.category,
      })),
    },
    connectedCount,
    hasAnyConnection: connectedCount > 0,
  };
}

/**
 * Format the real data snapshot as a context block for the Oracle system prompt.
 * This is what Oracle reads to answer "How is my business doing?" with REAL data.
 */
export function formatRealDataContextBlock(snapshot: RealDataSnapshot): string {
  if (!snapshot.hasAnyConnection) {
    return `## REAL CONNECTED DATA (Phase 2 — Real Data Engine™)
NO data sources are connected yet. The user has not connected GSTN, Bank, Gmail, WhatsApp, or any accounting software.

When the user asks "How is my business doing?" or any data-dependent question:
1. Answer honestly: "I don't have any live data connections yet."
2. Recommend connecting sources: "Connect your GSTN, Bank, and Gmail so I can read your real business data. Visit the Connections page."
3. Do NOT fabricate numbers. Do NOT use demo values. Only speak to what is connected.

Once the user connects a source, this context block will populate with real data automatically.`;
  }

  const lines: string[] = [
    `## REAL CONNECTED DATA (Phase 2 — Real Data Engine™)`,
    `The user has ${snapshot.connectedCount} active data connection(s). Use ONLY this real data when answering business questions. Never fabricate. If a question requires data from a source that is NOT connected, say so honestly.`,
    ``,
    `### Active Connections`,
    ...snapshot.connections.map(
      (c) => `- ${c.type.toUpperCase()}: ${c.label} — ${c.status} · ${c.recordCount} records · last sync: ${c.lastSyncAt ?? 'never'}`,
    ),
  ];

  // Cash Position
  if (snapshot.cashPosition.connected) {
    const cp = snapshot.cashPosition;
    lines.push(
      ``,
      `### Bank / Cash Position (REAL bank data)`,
      `- Current balance: ${cp.totalBalance !== null ? `₹${cp.totalBalance.toLocaleString('en-IN')}` : 'calculating'}`,
      `- Recent credits (inflow): ₹${cp.recentCredits.toLocaleString('en-IN')}`,
      `- Recent debits (outflow): ₹${cp.recentDebits.toLocaleString('en-IN')}`,
      `- Net flow: ₹${cp.netFlow.toLocaleString('en-IN')}`,
      `- Collections today: ₹${cp.todayCollections.toLocaleString('en-IN')}`,
      `- Collections this week: ₹${cp.weekCollections.toLocaleString('en-IN')}`,
    );
    if (cp.recentCollections.length > 0) {
      lines.push(`- Recent collections:`);
      for (const c of cp.recentCollections) {
        lines.push(`  · ${c.description} — ₹${c.amount.toLocaleString('en-IN')} (${c.date})`);
      }
    }
  } else {
    lines.push(
      ``,
      `### Bank / Cash Position`,
      `NOT CONNECTED — No bank account is linked. When the user asks "How much cash do I have?", say: "I don't have your bank connected yet. Connect your bank account so I can read your real transactions and cash position."`,
    );
  }

  // GST Status
  if (snapshot.gstStatus.connected) {
    const gs = snapshot.gstStatus;
    lines.push(
      ``,
      `### GST Status (REAL GSTN data)`,
      `- GSTIN: ${gs.gstin}`,
      `- Trade Name: ${gs.tradeName ?? '—'}`,
      `- Registration Status: ${gs.filingStatus ?? '—'}`,
    );
    if (gs.recentNotices.length > 0) {
      lines.push(`- Recent GST notices:`);
      for (const n of gs.recentNotices) {
        lines.push(`  · ${n.title} (${n.date})`);
      }
    }
  } else {
    lines.push(
      ``,
      `### GST Status`,
      `NOT CONNECTED — No GSTIN is linked. When the user asks about GST filing status or ITC, say: "I don't have your GSTIN connected. Connect your GSTN so I can read your real filing status, ITC position, and notices."`,
    );
  }

  // Email Insights
  if (snapshot.emailInsights.connected) {
    const em = snapshot.emailInsights;
    lines.push(
      ``,
      `### Gmail Insights (REAL email data)`,
      `- Email: ${em.email}`,
      `- Total emails synced: ${em.totalSynced}`,
      `- GST notices: ${em.gstNotices}`,
      `- Vendor invoices: ${em.vendorInvoices}`,
      `- Client invoices: ${em.clientInvoices}`,
      `- Tax communications: ${em.taxCommunications}`,
    );
    if (em.recentNotices.length > 0) {
      lines.push(`- Recent GST notice emails:`);
      for (const n of em.recentNotices) {
        lines.push(`  · "${n.subject}" from ${n.from} (${n.date})`);
      }
    }
  } else {
    lines.push(
      ``,
      `### Gmail`,
      `NOT CONNECTED — No Gmail is linked. When the user asks "Any GST notice?" or "Show GST emails", say: "I don't have your Gmail connected. Connect Gmail so I can read your GST notices, vendor invoices, and tax communications automatically."`,
    );
  }

  // WhatsApp Insights
  if (snapshot.whatsappInsights.connected) {
    const wa = snapshot.whatsappInsights;
    lines.push(
      ``,
      `### WhatsApp Insights (REAL WhatsApp data)`,
      `- Phone: ${wa.phoneNumber}`,
      `- Total messages tracked: ${wa.totalMessages}`,
      `- Payment reminders sent: ${wa.remindersSent}`,
    );
    if (wa.clientsIgnoringReminders.length > 0) {
      lines.push(`- Clients ignoring payment reminders:`);
      for (const c of wa.clientsIgnoringReminders) {
        lines.push(`  · ${c.contactName} — ${c.remindersSent} reminders sent, ${c.daysSinceLastReminder} days since last (no reply)`);
      }
    }
  } else {
    lines.push(
      ``,
      `### WhatsApp`,
      `NOT CONNECTED — No WhatsApp Business is linked. When the user asks "Which clients are ignoring payment reminders?", say: "I don't have your WhatsApp connected. Connect WhatsApp Business so I can track client communication and collections follow-ups."`,
    );
  }

  // Accounting Sync
  if (snapshot.accountingSync.connected) {
    const ac = snapshot.accountingSync;
    lines.push(
      ``,
      `### Accounting Sync (REAL ${ac.software?.toUpperCase()} data)`,
      `- Software: ${ac.software}`,
      `- Company: ${ac.companyName ?? '—'}`,
      `- Sales invoices synced: ${ac.salesInvoices}`,
      `- Purchase bills synced: ${ac.purchaseBills}`,
      `- Total sales: ₹${ac.totalSales.toLocaleString('en-IN')}`,
      `- Total purchases: ₹${ac.totalPurchases.toLocaleString('en-IN')}`,
    );
  } else {
    lines.push(
      ``,
      `### Accounting Software`,
      `NOT CONNECTED — No Tally, Zoho, or QuickBooks is linked. When the user asks about sales/purchases/ledger from their accounting software, say: "I don't have your accounting software connected. Connect Tally, Zoho Books, or QuickBooks so I can sync your real financial data."`,
    );
  }

  // Data Quality
  if (snapshot.dataQuality.totalAlerts > 0) {
    const dq = snapshot.dataQuality;
    lines.push(
      ``,
      `### Data Quality Alerts (REAL — auto-detected)`,
      `- Total alerts: ${dq.totalAlerts} (${dq.critical} critical, ${dq.high} high)`,
    );
    if (dq.topAlerts.length > 0) {
      lines.push(`- Top alerts:`);
      for (const a of dq.topAlerts) {
        lines.push(`  · [${a.severity.toUpperCase()}] ${a.title} (${a.category})`);
      }
    }
  }

  lines.push(
    ``,
    `### ORACLE REAL DATA RULES (CRITICAL)`,
    `- When answering "How is my business doing?", use ONLY the real numbers above. Round to lakhs/crores naturally.`,
    `- If a source is NOT connected, say so honestly and recommend connecting it. Never fabricate.`,
    `- When the user asks "How much cash do I have?" and bank IS connected, give the exact balance from above.`,
    `- When the user asks "Any GST notice?" and Gmail IS connected, cite the real notice emails above.`,
    `- When the user asks "Which clients are ignoring reminders?" and WhatsApp IS connected, cite the real client names above.`,
    `- Tagline: GSTPilot Oracle™ — Connected. Intelligent. Real.`,
  );

  return lines.join('\n');
}
