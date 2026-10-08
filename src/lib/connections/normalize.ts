// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Data Normalization Engine (PHASE 2A · MODULE 3)
//
// Unifies entities across the Business Graph — Clients, Invoices, Returns,
// Notices, Bank Transactions, Expenses, Payments, Documents, Vendors — into a
// single `UnifiedEntity[]` payload with cross-entity relationships.
//
// Every DB call is wrapped in try/catch so a failure in one source never breaks
// the whole graph. Total entities are capped at 500.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

export type UnifiedEntityType =
  | 'Firm'
  | 'Client'
  | 'Vendor'
  | 'Invoice'
  | 'Return'
  | 'Notice'
  | 'Payment'
  | 'BankTransaction'
  | 'Expense'
  | 'Document';

export type UnifiedSource = 'gstn' | 'bank' | 'manual' | 'system';

export type UnifiedSyncStatus =
  | 'connected'
  | 'syncing'
  | 'partial'
  | 'failed'
  | 'disconnected'
  | 'local';

export interface UnifiedRelationship {
  type: string;
  targetId: string;
  targetLabel?: string;
}

export interface UnifiedEntity {
  id: string;
  entityType: UnifiedEntityType;
  source: UnifiedSource;
  syncStatus: UnifiedSyncStatus;
  label: string;
  createdAt: string;
  updatedAt: string;
  relationships: UnifiedRelationship[];
  data: Record<string, unknown>;
}

export interface NormalizeAllResult {
  entities: UnifiedEntity[];
  counts: Record<string, number>;
}

const MAX_TOTAL = 500;

// ─── Public: normalize all business entities into a unified graph ──────────────
export async function normalizeAllEntities(): Promise<NormalizeAllResult> {
  const entities: UnifiedEntity[] = [];
  const counts: Record<string, number> = {};

  function bump(type: UnifiedEntityType) {
    counts[type] = (counts[type] ?? 0) + 1;
  }

  // Load active connections once so we can map source + syncStatus per entity
  let gstnSyncStatus: UnifiedSyncStatus = 'disconnected';
  let bankSyncStatus: UnifiedSyncStatus = 'disconnected';
  let gstnConnectionId: string | null = null;
  let bankConnectionId: string | null = null;
  let firmTradeName: string | null = null;
  let firmGstin: string | null = null;
  let firmLegalName: string | null = null;

  try {
    const conns = await db.businessConnection.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' },
    });
    const gstnConn = conns.find(c => c.type === 'gstn');
    const bankConn = conns.find(c => c.type === 'bank');
    if (gstnConn) {
      gstnSyncStatus = (gstnConn.syncStatus ?? 'connected') as UnifiedSyncStatus;
      gstnConnectionId = gstnConn.id;
      firmGstin = gstnConn.gstin ?? null;
      firmTradeName = gstnConn.tradeName ?? null;
      firmLegalName = gstnConn.legalName ?? null;
    }
    if (bankConn) {
      bankSyncStatus = (bankConn.syncStatus ?? 'connected') as UnifiedSyncStatus;
      bankConnectionId = bankConn.id;
    }
  } catch (err) {
    console.error('normalizeAllEntities: connections load failed:', err);
  }

  // ── Firm entity (from GSTN connection) ──
  if (gstnConnectionId && firmGstin) {
    try {
      const createdAt = new Date().toISOString();
      entities.push({
        id: `firm:${gstnConnectionId}`,
        entityType: 'Firm',
        source: 'gstn',
        syncStatus: gstnSyncStatus,
        label: firmTradeName ?? firmLegalName ?? 'Your Firm',
        createdAt,
        updatedAt: createdAt,
        relationships: [],
        data: {
          gstin: firmGstin,
          legalName: firmLegalName,
          tradeName: firmTradeName,
        },
      });
      bump('Firm');
    } catch (err) {
      console.error('normalizeAllEntities: firm entity failed:', err);
    }
  }

  // ── Clients (manual source) ──
  const clientIdToName = new Map<string, string>();
  try {
    const clients = await db.client.findMany({ take: 100, orderBy: { createdAt: 'desc' } });
    for (const c of clients) {
      if (entities.length >= MAX_TOTAL) break;
      const label = c.tradeName ?? c.legalName ?? c.gstin;
      clientIdToName.set(c.id, label);
      entities.push({
        id: `client:${c.id}`,
        entityType: 'Client',
        source: 'manual',
        syncStatus: 'local',
        label,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        relationships: gstnConnectionId
          ? [{ type: 'managed_by', targetId: `firm:${gstnConnectionId}`, targetLabel: firmTradeName ?? undefined }]
          : [],
        data: {
          gstin: c.gstin,
          tradeName: c.tradeName,
          legalName: c.legalName,
          state: c.state,
          stateCode: c.stateCode,
          status: c.status,
          healthScore: c.healthScore,
          lastFilingDate: c.lastFilingDate,
        },
      });
      bump('Client');
    }
  } catch (err) {
    console.error('normalizeAllEntities: clients failed:', err);
  }

  // ── Invoices (manual source; relationships to Clients) ──
  const invoiceIdToNumber = new Map<string, string>();
  try {
    const invoices = await db.invoice.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
    });
    for (const inv of invoices) {
      if (entities.length >= MAX_TOTAL) break;
      const clientLabel = clientIdToName.get(inv.clientId) ?? inv.buyerName ?? '—';
      invoiceIdToNumber.set(inv.id, inv.invoiceNumber);
      entities.push({
        id: `invoice:${inv.id}`,
        entityType: 'Invoice',
        source: 'manual',
        syncStatus: 'local',
        label: inv.invoiceNumber,
        createdAt: inv.createdAt.toISOString(),
        updatedAt: inv.updatedAt.toISOString(),
        relationships: [
          { type: 'belongs_to', targetId: `client:${inv.clientId}`, targetLabel: clientLabel },
        ],
        data: {
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          buyerName: inv.buyerName,
          buyerGstin: inv.buyerGstin,
          sellerGstin: inv.sellerGstin,
          taxableValue: inv.taxableValue,
          totalAmount: inv.totalAmount,
          igst: inv.igst,
          cgst: inv.cgst,
          sgst: inv.sgst,
          cess: inv.cess,
          status: inv.status,
          matchStatus: inv.matchStatus,
          riskLevel: inv.riskLevel,
          period: inv.period,
        },
      });
      bump('Invoice');
    }
  } catch (err) {
    console.error('normalizeAllEntities: invoices failed:', err);
  }

  // ── GSTR Filings → Return entities (gstn source; relationship to Client) ──
  try {
    const filings = await db.gSTRFiling.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    for (const f of filings) {
      if (entities.length >= MAX_TOTAL) break;
      const clientLabel = clientIdToName.get(f.clientId) ?? '—';
      entities.push({
        id: `return:${f.id}`,
        entityType: 'Return',
        source: 'gstn',
        syncStatus: gstnSyncStatus,
        label: `${f.returnType} · ${f.period}`,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
        relationships: [
          { type: 'filed_for', targetId: `client:${f.clientId}`, targetLabel: clientLabel },
        ],
        data: {
          returnType: f.returnType,
          period: f.period,
          financialYear: f.financialYear,
          status: f.status,
          filedDate: f.filedDate,
          acknowledgmentNumber: f.acknowledgmentNumber,
          totalInvoices: f.totalInvoices,
          totalTaxableValue: f.totalTaxableValue,
          totalTax: f.totalTax,
          issuesFound: f.issuesFound,
          criticalErrors: f.criticalErrors,
        },
      });
      bump('Return');
    }
  } catch (err) {
    console.error('normalizeAllEntities: gstrFilings failed:', err);
  }

  // ── Notices (gstn source; relationship to Client) ──
  try {
    const notices = await db.notice.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    for (const n of notices) {
      if (entities.length >= MAX_TOTAL) break;
      const clientLabel = clientIdToName.get(n.clientId) ?? '—';
      entities.push({
        id: `notice:${n.id}`,
        entityType: 'Notice',
        source: 'gstn',
        syncStatus: gstnSyncStatus,
        label: n.subject ?? n.noticeType ?? 'GST Notice',
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
        relationships: [
          { type: 'issued_to', targetId: `client:${n.clientId}`, targetLabel: clientLabel },
        ],
        data: {
          noticeType: n.noticeType,
          noticeNumber: n.noticeNumber,
          noticeDate: n.noticeDate,
          subject: n.subject,
          description: n.description,
          status: n.status,
          priority: n.priority,
          dueDate: n.dueDate,
          responseDate: n.responseDate,
        },
      });
      bump('Notice');
    }
  } catch (err) {
    console.error('normalizeAllEntities: notices failed:', err);
  }

  // ── Bank Transactions (bank source) + Payments + Expenses (derived) ──
  // We collect BankTransaction entities first, plus derive Payments (sales/credits)
  // and Expenses (debit 'expense'/'salary'/'vendor') from the same rows.
  const bankTxnIdSet = new Set<string>();
  try {
    const txns = await db.bankTransaction.findMany({
      take: 200,
      orderBy: { txnDate: 'desc' },
    });
    for (const t of txns) {
      if (entities.length >= MAX_TOTAL) break;
      bankTxnIdSet.add(t.id);
      const label = `${t.type === 'credit' ? 'CR' : 'DR'} · ${t.description.slice(0, 48)}`;
      const txnLabel = `${t.txnDate.toISOString().slice(0, 10)} · ${t.description.slice(0, 48)}`;
      const relationships: UnifiedRelationship[] = [];
      if (t.invoiceId) {
        const invLabel = invoiceIdToNumber.get(t.invoiceId);
        relationships.push({ type: 'reconciles', targetId: `invoice:${t.invoiceId}`, targetLabel: invLabel });
      }
      entities.push({
        id: `banktxn:${t.id}`,
        entityType: 'BankTransaction',
        source: 'bank',
        syncStatus: bankSyncStatus,
        label: txnLabel,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.createdAt.toISOString(),
        relationships,
        data: {
          txnDate: t.txnDate.toISOString(),
          description: t.description,
          amount: t.amount,
          type: t.type,
          category: t.category,
          counterparty: t.counterparty,
          referenceNo: t.referenceNo,
          balanceAfter: t.balanceAfter,
          reconciled: t.reconciled,
          bankProvider: t.bankProvider,
        },
      });
      bump('BankTransaction');

      // Synthesize Payment entities for credits categorized 'sales' (or counterparty-matched)
      if (t.type === 'credit' && (t.category === 'sales' || t.invoiceId)) {
        if (entities.length < MAX_TOTAL) {
          entities.push({
            id: `payment:${t.id}`,
            entityType: 'Payment',
            source: 'bank',
            syncStatus: bankSyncStatus,
            label: `Payment · ${t.counterparty ?? '—'} · ₹${Math.round(t.amount).toLocaleString('en-IN')}`,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.createdAt.toISOString(),
            relationships: [
              { type: 'from_txn', targetId: `banktxn:${t.id}`, targetLabel: label },
              ...(t.invoiceId ? [{ type: 'settles', targetId: `invoice:${t.invoiceId}`, targetLabel: invoiceIdToNumber.get(t.invoiceId) }] : []),
            ],
            data: {
              amount: t.amount,
              counterparty: t.counterparty,
              txnDate: t.txnDate.toISOString(),
              referenceNo: t.referenceNo,
              invoiceId: t.invoiceId,
            },
          });
          bump('Payment');
        }
      }

      // Synthesize Expense entities for debits categorized 'expense'/'salary'/'vendor'
      if (t.type === 'debit' && (t.category === 'expense' || t.category === 'salary' || t.category === 'vendor')) {
        if (entities.length < MAX_TOTAL) {
          entities.push({
            id: `expense:${t.id}`,
            entityType: 'Expense',
            source: 'bank',
            syncStatus: bankSyncStatus,
            label: `Expense · ${t.counterparty ?? t.category ?? '—'} · ₹${Math.round(Math.abs(t.amount)).toLocaleString('en-IN')}`,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.createdAt.toISOString(),
            relationships: [
              { type: 'from', targetId: `banktxn:${t.id}`, targetLabel: label },
            ],
            data: {
              amount: Math.abs(t.amount),
              category: t.category,
              counterparty: t.counterparty,
              txnDate: t.txnDate.toISOString(),
              description: t.description,
            },
          });
          bump('Expense');
        }
      }
    }
  } catch (err) {
    console.error('normalizeAllEntities: bank transactions failed:', err);
  }

  // ── Vendors (system source; derived from distinct invoice buyerName + bank counterparty) ──
  try {
    const vendorMap = new Map<string, { source: UnifiedSource; count: number; firstSeen: string }>();
    // From invoices (buyerName)
    try {
      const invs = await db.invoice.findMany({
        take: 200,
        where: { buyerName: { not: null } },
        select: { buyerName: true, createdAt: true },
      });
      for (const inv of invs) {
        if (!inv.buyerName) continue;
        const existing = vendorMap.get(inv.buyerName);
        if (existing) {
          existing.count += 1;
          existing.firstSeen = existing.firstSeen < inv.createdAt.toISOString() ? existing.firstSeen : inv.createdAt.toISOString();
        } else {
          vendorMap.set(inv.buyerName, { source: 'manual', count: 1, firstSeen: inv.createdAt.toISOString() });
        }
      }
    } catch (err) {
      console.error('normalizeAllEntities: vendor invoices failed:', err);
    }
    // From bank transactions (debit counterparty)
    try {
      const txns = await db.bankTransaction.findMany({
        take: 200,
        where: { type: 'debit', counterparty: { not: null } },
        select: { counterparty: true, createdAt: true },
      });
      for (const t of txns) {
        if (!t.counterparty) continue;
        const existing = vendorMap.get(t.counterparty);
        if (existing) {
          existing.count += 1;
          existing.source = 'bank';
          existing.firstSeen = existing.firstSeen < t.createdAt.toISOString() ? existing.firstSeen : t.createdAt.toISOString();
        } else {
          vendorMap.set(t.counterparty, { source: 'bank', count: 1, firstSeen: t.createdAt.toISOString() });
        }
      }
    } catch (err) {
      console.error('normalizeAllEntities: vendor bank txns failed:', err);
    }
    for (const [name, info] of Array.from(vendorMap.entries()).slice(0, 50)) {
      if (entities.length >= MAX_TOTAL) break;
      entities.push({
        id: `vendor:${name.replace(/\s+/g, '_').toLowerCase()}`,
        entityType: 'Vendor',
        source: info.source,
        syncStatus: info.source === 'bank' ? bankSyncStatus : 'local',
        label: name,
        createdAt: info.firstSeen,
        updatedAt: info.firstSeen,
        relationships: gstnConnectionId
          ? [{ type: 'supplies_to', targetId: `firm:${gstnConnectionId}`, targetLabel: firmTradeName ?? undefined }]
          : [],
        data: {
          name,
          transactions: info.count,
        },
      });
      bump('Vendor');
    }
  } catch (err) {
    console.error('normalizeAllEntities: vendors failed:', err);
  }

  // ── Documents (manual source) ──
  try {
    const docs = await db.document.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    for (const d of docs) {
      if (entities.length >= MAX_TOTAL) break;
      const clientLabel = d.clientId ? clientIdToName.get(d.clientId) : undefined;
      entities.push({
        id: `document:${d.id}`,
        entityType: 'Document',
        source: 'manual',
        syncStatus: 'local',
        label: d.name,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        relationships: d.clientId
          ? [{ type: 'belongs_to', targetId: `client:${d.clientId}`, targetLabel: clientLabel }]
          : [],
        data: {
          name: d.name,
          fileType: d.fileType,
          folder: d.folder,
          size: d.size,
          tags: d.tags,
          description: d.description,
          version: d.version,
          isLatest: d.isLatest,
          uploadedBy: d.uploadedBy,
        },
      });
      bump('Document');
    }
  } catch (err) {
    console.error('normalizeAllEntities: documents failed:', err);
  }

  // Hard cap at MAX_TOTAL (just in case mid-iteration overflow happened)
  const trimmed = entities.slice(0, MAX_TOTAL);

  return { entities: trimmed, counts };
}
