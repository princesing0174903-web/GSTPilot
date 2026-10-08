// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Universal Search Engine
//
// Searches across every major business entity in one shot:
//   • Clients (trade name / GSTIN / legal name)
//   • Invoices (invoice number / buyer name)
//   • GSTR Filings (return type / period / status)
//   • Executive Reports (title / report type)
//   • Oracle Documents (file name / doc type / extracted text)
//   • AI Tasks (title / description)
//   • Notices (subject / notice type)
//
// Each table is queried independently in its own try/catch — a single failing
// table never breaks the whole search. Results are deduped, capped at 30, and
// sorted so title-matches float to the top.
//
// Note: SQLite `contains` is ASCII-case-insensitive by default, but we still
// normalize the query to trimmed lowercase to keep behaviour consistent across
// future provider swaps.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchResultType =
  | 'client'
  | 'invoice'
  | 'return'
  | 'report'
  | 'document'
  | 'task'
  | 'notice';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Indian-style number formatting for ₹ amounts. */
function inr(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '0';
  return Math.round(amount).toLocaleString('en-IN');
}

// ─── Per-entity searchers (each isolated — never throws) ──────────────────────

async function searchClients(q: string): Promise<SearchResult[]> {
  try {
    const rows = await db.client.findMany({
      where: {
        OR: [
          { tradeName: { contains: q } },
          { gstin: { contains: q } },
          { legalName: { contains: q } },
        ],
      },
      take: 5,
    });
    return rows.map((r) => ({
      type: 'client' as const,
      id: r.id,
      title: r.tradeName,
      subtitle: r.gstin,
      meta: r.state ?? undefined,
    }));
  } catch {
    return [];
  }
}

async function searchInvoices(q: string): Promise<SearchResult[]> {
  try {
    const rows = await db.invoice.findMany({
      where: {
        OR: [{ invoiceNumber: { contains: q } }, { buyerName: { contains: q } }],
      },
      take: 5,
    });
    return rows.map((r) => ({
      type: 'invoice' as const,
      id: r.id,
      title: r.invoiceNumber,
      subtitle: r.buyerName ?? undefined,
      meta: `₹${inr(r.totalAmount)}`,
    }));
  } catch {
    return [];
  }
}

async function searchReturns(q: string): Promise<SearchResult[]> {
  try {
    const rows = await db.gSTRFiling.findMany({
      where: {
        OR: [
          { returnType: { contains: q } },
          { period: { contains: q } },
          { status: { contains: q } },
        ],
      },
      take: 5,
    });
    return rows.map((r) => ({
      type: 'return' as const,
      id: r.id,
      title: `${r.returnType} ${r.period}`,
      subtitle: r.status,
    }));
  } catch {
    return [];
  }
}

async function searchReports(q: string): Promise<SearchResult[]> {
  try {
    const rows = await db.executiveReport.findMany({
      where: {
        OR: [{ title: { contains: q } }, { reportType: { contains: q } }],
      },
      take: 5,
    });
    return rows.map((r) => ({
      type: 'report' as const,
      id: r.id,
      title: r.title,
      subtitle: r.reportType,
    }));
  } catch {
    return [];
  }
}

async function searchDocuments(q: string): Promise<SearchResult[]> {
  try {
    const rows = await db.oracleDocument.findMany({
      where: {
        OR: [
          { fileName: { contains: q } },
          { docType: { contains: q } },
          { extractedText: { contains: q } },
        ],
      },
      take: 5,
    });
    return rows.map((r) => ({
      type: 'document' as const,
      id: r.id,
      title: r.fileName,
      subtitle: r.docType,
    }));
  } catch {
    return [];
  }
}

async function searchTasks(q: string): Promise<SearchResult[]> {
  try {
    const rows = await db.aITask.findMany({
      where: {
        OR: [{ title: { contains: q } }, { description: { contains: q } }],
      },
      take: 5,
    });
    return rows.map((r) => ({
      type: 'task' as const,
      id: r.id,
      title: r.title,
      subtitle: r.sourceType,
    }));
  } catch {
    return [];
  }
}

async function searchNotices(q: string): Promise<SearchResult[]> {
  try {
    const rows = await db.notice.findMany({
      where: {
        OR: [{ subject: { contains: q } }, { noticeType: { contains: q } }],
      },
      take: 5,
    });
    return rows.map((r) => ({
      type: 'notice' as const,
      id: r.id,
      title: r.subject,
      subtitle: r.noticeType,
    }));
  } catch {
    return [];
  }
}

// ─── Main entry: searchAll ────────────────────────────────────────────────────

export async function searchAll(query: string): Promise<SearchResult[]> {
  const q = (query ?? '').trim().toLowerCase();
  if (q.length < 2) return [];

  // Run all seven searchers in parallel; each swallows its own errors.
  const [clients, invoices, returns, reports, documents, tasks, notices] =
    await Promise.all([
      searchClients(q),
      searchInvoices(q),
      searchReturns(q),
      searchReports(q),
      searchDocuments(q),
      searchTasks(q),
      searchNotices(q),
    ]);

  const all = [
    ...clients,
    ...invoices,
    ...returns,
    ...reports,
    ...documents,
    ...tasks,
    ...notices,
  ];

  // Dedupe by (type, id) — never return the same row twice from different
  // searchers (defensive; current per-table queries don't overlap, but the
  // shape is stable if we add cross-table joins later).
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];
  for (const r of all) {
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  // Sort: title-matches first (case-insensitive), then everything else.
  const qLower = q;
  const sorted = deduped.sort((a, b) => {
    const aTitle = (a.title ?? '').toLowerCase();
    const bTitle = (b.title ?? '').toLowerCase();
    const aMatch = aTitle.includes(qLower) ? 0 : 1;
    const bMatch = bTitle.includes(qLower) ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return aTitle.localeCompare(bTitle);
  });

  // Cap at 30 results.
  return sorted.slice(0, 30);
}
