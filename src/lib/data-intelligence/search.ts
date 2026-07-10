// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Global Data Intelligence Cloud™
// Subsystem 9: Enterprise Search™ — unified search across ALL enterprise records.
// Indexes invoices, clients, employees, payments, bills, filings, memory,
// knowledge nodes, compliance filings, execution jobs and global entities into a
// single EnterpriseSearchIndex table; supports keyword, semantic (token-overlap)
// and hybrid search modes. Every value originates from REAL Prisma data.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  db,
  safeFindMany,
  safeCount,
  countBy,
  cached,
  TTL,
  parseJson,
} from './helpers';
import type {
  EnterpriseSearchHit,
  EnterpriseSearchResult,
} from './types';

// ─── Index row shape (internal) ──────────────────────────────────────────────
interface IndexRowInput {
  recordKey: string;
  recordType: string;
  sourceSystem: string;
  title: string;
  searchText: string;
  datasetKey: string | null;
  metadata: Record<string, unknown>;
}

const MAX_PER_TYPE = 10_000;
const SNIPPET_LEN = 240;

function snippet(text: string): string {
  if (text.length <= SNIPPET_LEN) return text;
  return `${text.slice(0, SNIPPET_LEN)}…`;
}

function lowerBlob(parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((p) => p !== null && p !== undefined && String(p).trim() !== '')
    .map((p) => String(p))
    .join(' ')
    .toLowerCase();
}

/** Upsert one row into EnterpriseSearchIndex; silently swallows individual errors. */
async function upsertIndexRow(input: IndexRowInput): Promise<void> {
  try {
    await db.enterpriseSearchIndex.upsert({
      where: { recordKey: input.recordKey },
      create: {
        recordKey: input.recordKey,
        recordType: input.recordType,
        sourceSystem: input.sourceSystem,
        title: input.title,
        searchText: input.searchText,
        datasetKey: input.datasetKey,
        metadata: JSON.stringify(input.metadata),
        indexedAt: new Date(),
      },
      update: {
        recordType: input.recordType,
        sourceSystem: input.sourceSystem,
        title: input.title,
        searchText: input.searchText,
        datasetKey: input.datasetKey,
        metadata: JSON.stringify(input.metadata),
        indexedAt: new Date(),
      },
    });
  } catch {
    // individual row failures should not abort the whole index build
  }
}

/**
 * Scan REAL production records and upsert EnterpriseSearchIndex rows for every
 * supported entity type. Returns the total count of rows upserted.
 */
export async function buildSearchIndex(): Promise<number> {
  let indexed = 0;

  // ── Invoices ─────────────────────────────────────────────────────────────
  const invoices = await safeFindMany(() =>
    db.invoice.findMany({ take: MAX_PER_TYPE }),
  );
  for (const inv of invoices) {
    const searchText = lowerBlob([
      inv.invoiceNumber,
      inv.buyerName,
      inv.buyerGstin,
      inv.sellerGstin,
      inv.invoiceType,
      inv.gstr1Section,
      inv.status,
      inv.paymentStatus,
      inv.hsnCode,
      inv.period,
      inv.totalAmount,
      inv.taxableValue,
      inv.gstAmount,
      inv.invoiceDate,
      inv.dueDate,
    ]);
    await upsertIndexRow({
      recordKey: `inv-${inv.id}`,
      recordType: 'invoice',
      sourceSystem: 'prisma',
      title: inv.invoiceNumber,
      searchText,
      datasetKey: 'invoice',
      metadata: {
        id: inv.id,
        clientId: inv.clientId,
        amount: inv.totalAmount,
        date: inv.invoiceDate,
        status: inv.status,
        paymentStatus: inv.paymentStatus,
      },
    });
    indexed++;
  }

  // ── Clients ──────────────────────────────────────────────────────────────
  const clients = await safeFindMany(() =>
    db.client.findMany({ take: MAX_PER_TYPE }),
  );
  for (const c of clients) {
    const searchText = lowerBlob([
      c.tradeName,
      c.legalName,
      c.gstin,
      c.state,
      c.stateCode,
      c.contactEmail,
      c.contactPhone,
      c.entityType,
      c.status,
      c.returnPeriod,
    ]);
    await upsertIndexRow({
      recordKey: `client-${c.id}`,
      recordType: 'client',
      sourceSystem: 'prisma',
      title: c.tradeName,
      searchText,
      datasetKey: 'client',
      metadata: {
        id: c.id,
        gstin: c.gstin,
        state: c.state,
        healthScore: c.healthScore,
        status: c.status,
      },
    });
    indexed++;
  }

  // ── Employees ────────────────────────────────────────────────────────────
  const employees = await safeFindMany(() =>
    db.employee.findMany({ take: MAX_PER_TYPE }),
  );
  for (const e of employees) {
    const searchText = lowerBlob([
      e.name,
      e.designation,
      e.department,
      e.employeeId,
      e.pan,
      e.status,
      String(e.salary),
    ]);
    await upsertIndexRow({
      recordKey: `emp-${e.id}`,
      recordType: 'employee',
      sourceSystem: 'prisma',
      title: e.name,
      searchText,
      datasetKey: 'employee',
      metadata: {
        id: e.id,
        designation: e.designation,
        department: e.department,
        status: e.status,
      },
    });
    indexed++;
  }

  // ── Payments ─────────────────────────────────────────────────────────────
  const payments = await safeFindMany(() =>
    db.payment.findMany({ take: MAX_PER_TYPE }),
  );
  for (const p of payments) {
    const searchText = lowerBlob([
      p.partyName,
      p.partyType,
      p.paymentMode,
      p.referenceNo,
      p.status,
      p.notes,
      String(p.amount),
      p.paymentDate,
    ]);
    await upsertIndexRow({
      recordKey: `pay-${p.id}`,
      recordType: 'payment',
      sourceSystem: 'prisma',
      title: `${p.partyName} — ${p.amount}`,
      searchText,
      datasetKey: 'payment',
      metadata: {
        id: p.id,
        amount: p.amount,
        date: p.paymentDate,
        mode: p.paymentMode,
        status: p.status,
        partyType: p.partyType,
      },
    });
    indexed++;
  }

  // ── Purchase Bills ───────────────────────────────────────────────────────
  const bills = await safeFindMany(() =>
    db.purchaseBill.findMany({ take: MAX_PER_TYPE }),
  );
  for (const b of bills) {
    const searchText = lowerBlob([
      b.vendorName,
      b.vendorGstin,
      b.invoiceNo,
      b.category,
      b.hsnCode,
      b.status,
      b.paymentStatus,
      b.notes,
      String(b.totalAmount),
      b.invoiceDate,
      b.dueDate,
    ]);
    await upsertIndexRow({
      recordKey: `bill-${b.id}`,
      recordType: 'vendor',
      sourceSystem: 'prisma',
      title: `${b.vendorName} — ${b.invoiceNo}`,
      searchText,
      datasetKey: 'purchase_bill',
      metadata: {
        id: b.id,
        vendor: b.vendorName,
        invoiceNo: b.invoiceNo,
        amount: b.totalAmount,
        status: b.status,
      },
    });
    indexed++;
  }

  // ── GSTR Filings ─────────────────────────────────────────────────────────
  const filings = await safeFindMany(() =>
    db.gSTRFiling.findMany({ take: MAX_PER_TYPE }),
  );
  for (const f of filings) {
    const searchText = lowerBlob([
      f.returnType,
      f.period,
      f.financialYear,
      f.status,
      f.acknowledgmentNumber,
      String(f.totalInvoices),
      String(f.totalTaxableValue),
      String(f.totalTax),
      f.filedDate,
    ]);
    await upsertIndexRow({
      recordKey: `gstr-${f.id}`,
      recordType: 'tax',
      sourceSystem: 'prisma',
      title: `${f.returnType} — ${f.period}`,
      searchText,
      datasetKey: 'gstr_filing',
      metadata: {
        id: f.id,
        clientId: f.clientId,
        returnType: f.returnType,
        period: f.period,
        status: f.status,
        totalTax: f.totalTax,
      },
    });
    indexed++;
  }

  // ── Synced Records ───────────────────────────────────────────────────────
  const synced = await safeFindMany(() =>
    db.syncedRecord.findMany({ take: MAX_PER_TYPE }),
  );
  for (const s of synced) {
    const searchText = lowerBlob([
      s.sourceType,
      s.title,
      s.category,
      s.externalId,
      s.date,
      String(s.amount ?? ''),
    ]);
    await upsertIndexRow({
      recordKey: `synced-${s.id}`,
      recordType: 'connector',
      sourceSystem: 'connector',
      title: s.title ?? s.sourceType,
      searchText,
      datasetKey: 'synced_record',
      metadata: {
        id: s.id,
        sourceType: s.sourceType,
        category: s.category,
        amount: s.amount,
      },
    });
    indexed++;
  }

  // ── CEO Memory ───────────────────────────────────────────────────────────
  const ceoMem = await safeFindMany(() =>
    db.cEOMemory.findMany({ take: MAX_PER_TYPE }),
  );
  for (const m of ceoMem) {
    const tags = parseJson<string[]>(m.tags, []);
    const searchText = lowerBlob([
      m.memoryType,
      m.title,
      m.description,
      tags.join(' '),
    ]);
    await upsertIndexRow({
      recordKey: `ceomem-${m.id}`,
      recordType: 'ai_conversation',
      sourceSystem: 'oracle',
      title: m.title,
      searchText,
      datasetKey: 'ceo_memory',
      metadata: {
        id: m.id,
        memoryType: m.memoryType,
        importance: m.importance,
        occurredAt: m.occurredAt,
      },
    });
    indexed++;
  }

  // ── Agent Memory ─────────────────────────────────────────────────────────
  const agentMem = await safeFindMany(() =>
    db.agentMemory.findMany({ take: MAX_PER_TYPE }),
  );
  for (const m of agentMem) {
    const searchText = lowerBlob([
      m.agent,
      m.memoryType,
      m.key,
      m.value,
    ]);
    await upsertIndexRow({
      recordKey: `agentmem-${m.id}`,
      recordType: 'ai_conversation',
      sourceSystem: 'oracle',
      title: `${m.agent} · ${m.key}`,
      searchText,
      datasetKey: 'agent_memory',
      metadata: {
        id: m.id,
        agent: m.agent,
        memoryType: m.memoryType,
        importance: m.importance,
      },
    });
    indexed++;
  }

  // ── Knowledge Nodes ──────────────────────────────────────────────────────
  const nodes = await safeFindMany(() =>
    db.knowledgeNode.findMany({ take: MAX_PER_TYPE }),
  );
  for (const n of nodes) {
    const searchText = lowerBlob([
      n.kind,
      n.label,
      n.industry,
      n.region,
    ]);
    await upsertIndexRow({
      recordKey: `knode-${n.id}`,
      recordType: 'knowledge_node',
      sourceSystem: 'knowledge_graph',
      title: n.label,
      searchText,
      datasetKey: 'knowledge_node',
      metadata: {
        id: n.id,
        kind: n.kind,
        industry: n.industry,
        region: n.region,
        weight: n.weight,
      },
    });
    indexed++;
  }

  // ── Compliance Filings ───────────────────────────────────────────────────
  const compFilings = await safeFindMany(() =>
    db.complianceFiling.findMany({ take: MAX_PER_TYPE }),
  );
  for (const cf of compFilings) {
    const searchText = lowerBlob([
      cf.filingType,
      cf.title,
      cf.description,
      cf.period,
      cf.countryIso,
      cf.status,
      cf.preparedBy,
      cf.aiRecommendation,
    ]);
    await upsertIndexRow({
      recordKey: `cfiling-${cf.id}`,
      recordType: 'report',
      sourceSystem: 'compliance_cloud',
      title: cf.title,
      searchText,
      datasetKey: 'compliance_filing',
      metadata: {
        id: cf.id,
        filingType: cf.filingType,
        period: cf.period,
        countryIso: cf.countryIso,
        status: cf.status,
      },
    });
    indexed++;
  }

  // ── Execution Jobs ───────────────────────────────────────────────────────
  const jobs = await safeFindMany(() =>
    db.executionJob.findMany({ take: MAX_PER_TYPE }),
  );
  for (const j of jobs) {
    const searchText = lowerBlob([
      j.module,
      j.type,
      j.description,
      j.status,
      j.priority,
      j.aiModule,
      j.queueName,
    ]);
    await upsertIndexRow({
      recordKey: `job-${j.id}`,
      recordType: 'report',
      sourceSystem: 'execution_cloud',
      title: `${j.module} · ${j.type}`,
      searchText,
      datasetKey: 'execution_job',
      metadata: {
        id: j.id,
        module: j.module,
        type: j.type,
        status: j.status,
        priority: j.priority,
        durationMs: j.durationMs,
      },
    });
    indexed++;
  }

  // ── Global Entities ──────────────────────────────────────────────────────
  const entities = await safeFindMany(() =>
    db.globalEntity.findMany({ take: MAX_PER_TYPE }),
  );
  for (const g of entities) {
    const searchText = lowerBlob([
      g.legalName,
      g.tradeName,
      g.entityKind,
      g.countryIso,
      g.registrationNo,
      g.taxId,
      g.baseCurrency,
      g.status,
    ]);
    await upsertIndexRow({
      recordKey: `entity-${g.id}`,
      recordType: 'report',
      sourceSystem: 'global_enterprise',
      title: g.legalName,
      searchText,
      datasetKey: 'global_entity',
      metadata: {
        id: g.id,
        legalName: g.legalName,
        countryIso: g.countryIso,
        baseCurrency: g.baseCurrency,
        status: g.status,
      },
    });
    indexed++;
  }

  return indexed;
}

// ─── Search modes ────────────────────────────────────────────────────────────

interface RawIndexRow {
  id: string;
  recordKey: string;
  recordType: string;
  sourceSystem: string;
  title: string;
  searchText: string;
  datasetKey: string | null;
  metadata: string | null;
  indexedAt: Date;
}

function rowToHit(row: RawIndexRow, score: number): EnterpriseSearchHit {
  return {
    recordKey: row.recordKey,
    recordType: row.recordType,
    sourceSystem: row.sourceSystem,
    title: row.title,
    snippet: snippet(row.searchText),
    score,
    datasetKey: row.datasetKey,
    metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
  };
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 0);
}

async function keywordSearch(
  query: string,
  limit: number,
): Promise<EnterpriseSearchHit[]> {
  const q = query.toLowerCase();
  const rows = await safeFindMany(() =>
    db.enterpriseSearchIndex.findMany({
      where: { searchText: { contains: q } },
      take: limit,
      orderBy: { indexedAt: 'desc' },
    }),
  );
  return rows.map((r) => rowToHit(r as RawIndexRow, 1));
}

async function semanticSearch(
  query: string,
  limit: number,
): Promise<EnterpriseSearchHit[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const candidates = await safeFindMany(() =>
    db.enterpriseSearchIndex.findMany({
      take: 500,
      orderBy: { indexedAt: 'desc' },
    }),
  );
  const scored: EnterpriseSearchHit[] = [];
  for (const row of candidates) {
    const r = row as RawIndexRow;
    const text = r.searchText ?? '';
    let score = 0;
    for (const t of tokens) {
      if (text.includes(t)) score += 1;
    }
    if (score > 0) scored.push(rowToHit(r, score));
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

async function hybridSearch(
  query: string,
  limit: number,
): Promise<EnterpriseSearchHit[]> {
  const [kwHits, semHits] = await Promise.all([
    keywordSearch(query, limit * 2),
    semanticSearch(query, limit * 2),
  ]);
  const merged = new Map<string, EnterpriseSearchHit>();
  for (const h of kwHits) {
    merged.set(h.recordKey, { ...h, score: h.score });
  }
  for (const h of semHits) {
    const existing = merged.get(h.recordKey);
    if (existing) {
      merged.set(h.recordKey, { ...existing, score: existing.score + h.score });
    } else {
      merged.set(h.recordKey, h);
    }
  }
  const all = Array.from(merged.values());
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, limit);
}

/**
 * Search across ALL enterprise records. Modes:
 *  - keyword: SQL LIKE on searchText (case-insensitive)
 *  - semantic: token-overlap scoring across candidate rows
 *  - hybrid: combine keyword + semantic, dedupe by recordKey, sum scores
 */
export async function searchEnterprise(
  query: string,
  mode: 'keyword' | 'semantic' | 'hybrid' = 'hybrid',
  limit = 50,
): Promise<EnterpriseSearchResult> {
  const start = Date.now();
  const trimmed = query.trim();
  let hits: EnterpriseSearchHit[] = [];
  if (trimmed.length === 0) {
    hits = [];
  } else if (mode === 'keyword') {
    hits = await keywordSearch(trimmed, limit);
  } else if (mode === 'semantic') {
    hits = await semanticSearch(trimmed, limit);
  } else {
    hits = await hybridSearch(trimmed, limit);
  }
  const tookMs = Date.now() - start;
  return {
    query,
    totalHits: hits.length,
    hits,
    searchMode: mode,
    tookMs,
  };
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export interface SearchIndexSummary {
  indexedRecords: number;
  byRecordType: Record<string, number>;
  bySourceSystem: Record<string, number>;
  lastIndexedAt: string | null;
}

/**
 * Aggregate stats about the current Enterprise Search index.
 */
export async function getSearchIndexSummary(): Promise<SearchIndexSummary> {
  return cached<SearchIndexSummary>(
    'data-intel:search:summary',
    TTL.SHORT,
    async () => {
      const indexedRecords = await safeCount(() =>
        db.enterpriseSearchIndex.count(),
      );
      const rows = await safeFindMany(() =>
        db.enterpriseSearchIndex.findMany({
          select: {
            recordType: true,
            sourceSystem: true,
            indexedAt: true,
          },
          take: MAX_PER_TYPE,
        }),
      );
      const byRecordType = countBy(rows, (r) => r.recordType);
      const bySourceSystem = countBy(rows, (r) => r.sourceSystem);
      let lastIndexedAt: string | null = null;
      let lastTs = 0;
      for (const r of rows) {
        const ts = r.indexedAt ? new Date(r.indexedAt).getTime() : 0;
        if (ts > lastTs) {
          lastTs = ts;
          lastIndexedAt = r.indexedAt ? new Date(r.indexedAt).toISOString() : null;
        }
      }
      return { indexedRecords, byRecordType, bySourceSystem, lastIndexedAt };
    },
  );
}
