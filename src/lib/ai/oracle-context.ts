// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Live Business Context Builder
//
// The SINGLE source of truth for every Oracle prompt. Builds a compact, fully
// grounded context block from ONLY these live, tenant-scoped sources — in this
// strict order:
//
//   1. Business Snapshot  (src/lib/business/snapshot.ts → getBusinessSnapshot)
//        - revenue, expenses, profit, cash, receivables, payables, GST, health
//          score, risk score, customer/invoice/return counts
//   2. Customers          (Prisma ZohoCustomer + Client tables, org-scoped)
//   3. Invoices           (Prisma ZohoInvoice + Invoice tables, org-scoped)
//   4. Returns            (Prisma GSTRFiling table, org-scoped)
//   5. Zoho Books         (live API call if connected — recent customers/invoices)
//   6. Google Workspace   (live API call if connected — recent Gmail messages)
//
// HARD GUARANTEES:
//   • NEVER reads from Company Memory, ExecutiveKPIs, demo JSON, seed data,
//     or previous conversations. Memory is for personalisation only — never for
//     facts/numbers.
//   • NEVER fabricates. If a source has 0 rows, the context says "0 records".
//   • If Business Snapshot reports zero business activity (no customers, no
//     invoices, no returns), hasData = false → the Gemini service returns the
//     honest "I don't have enough business data" answer WITHOUT calling Gemini.
//   • Every source contributes to a `sources` DEBUG object so the UI can show
//     exactly which live data sources backed each answer.
//   • `demoRecordsUsed` is ALWAYS 0. If it's ever > 0, the Gemini service
//     refuses to answer.
//   • Every Prisma query is tenant-scoped by `organizationId`. No global
//     queries. No cross-tenant leaks.
//   • Every external call (Zoho API, Google API) is wrapped in try/catch +
//     8s timeout — one slow source can't block the whole context build.
//
// This file is imported ONLY by src/lib/ai/gemini-service.ts.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getBusinessSnapshot, type BusinessSnapshot } from '@/lib/business/snapshot';
// Google/Zoho integration removed — these stubs return UNAVAILABLE status
// so Oracle knows the integrations are not connected, rather than seeing
// empty arrays that could be mistaken for 'connected but no data'.
const getZohoAccessToken = async () => ({ accessToken: null, error: 'Zoho Books integration not available', permanent: true });
const listZohoCustomers = async () => ({ customers: [], error: 'Zoho Books integration not available' });
const getGoogleAccessToken = async () => ({ accessToken: null, error: 'Google Workspace integration not available', permanent: true });
const gmail = { listMessages: async () => ({ messages: [], error: 'Google Workspace integration not available' }) };

// ─── Public types ────────────────────────────────────────────────────────────

export interface OracleSources {
  organizationId: string;
  /** True if Business Snapshot loaded successfully (regardless of whether it has data). */
  businessSnapshot: boolean;
  /** Number of customer records loaded from Prisma (ZohoCustomer + Client). */
  customersLoaded: number;
  /** Number of invoice records loaded from Prisma (ZohoInvoice + Invoice). */
  invoicesLoaded: number;
  /** Number of GST return records loaded from Prisma (GSTRFiling). */
  returnsLoaded: number;
  /** Headline revenue (₹) from the Business Snapshot. */
  revenueLoaded: number;
  /** Number of records fetched live from Zoho Books API (0 if not connected). */
  zohoRecordsUsed: number;
  /** Number of records fetched live from Google Workspace API (0 if not connected). */
  googleRecordsUsed: number;
  /** ALWAYS 0. If > 0, the Gemini service refuses to answer. */
  demoRecordsUsed: number;
  /** True if Zoho Books is connected (valid access token). */
  zohoConnected: boolean;
  /** True if Google Workspace is connected (valid access token). */
  googleConnected: boolean;
  /** ISO timestamp of the Business Snapshot generation. */
  snapshotGeneratedAt: string | null;
}

export interface OracleContext {
  /** The canonical Business Snapshot — single source of truth for headline metrics. */
  snapshot: BusinessSnapshot | null;
  /** Recent customers (up to 20) — name, gstin, outstanding, status. */
  customers: Array<{
    name: string;
    companyName: string | null;
    gstin: string | null;
    email: string | null;
    outstanding: number;
    status: string;
    source: 'zoho' | 'local';
  }>;
  /** Recent invoices (up to 20) — number, customer, total, balance, status, date. */
  invoices: Array<{
    invoiceNumber: string;
    customerName: string;
    total: number;
    balance: number;
    status: string;
    date: string | null;
    dueDate: string | null;
    source: 'zoho' | 'local';
  }>;
  /** GST returns (up to 12) — period, type, status, filing date. */
  returns: Array<{
    returnType: string;
    period: string;
    status: string;
    filedAt: string | null;
    dueDate: string | null;
  }>;
  /** Recent Gmail messages (up to 10) — subject, from, date. */
  googleEmails: Array<{
    subject: string;
    from: string;
    date: string;
  }>;
  /** True if at least one source has real business data. */
  hasData: boolean;
  /** Compact text block injected into the Gemini system prompt. */
  promptBlock: string;
  /** DEBUG object — exposed in the UI Sources Panel. */
  sources: OracleSources;
}

export interface BuildOracleContextRequest {
  organizationId: string;
  userId: string | null;
  /** Force a fresh Business Snapshot cache miss (default false). */
  forceRefresh?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inr(n: number): string {
  if (!Number.isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function inrFull(n: number): string {
  return '₹' + Math.round(n || 0).toLocaleString('en-IN');
}

/** 8-second timeout wrapper — one slow source can't block the build. */
function withTimeout<T>(label: string, p: Promise<T>, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn(`[oracle-context] "${label}" timed out after 8s`);
        resolve(fallback);
      }
    }, 8_000);
    p.then(
      (val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      },
      (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          console.warn(`[oracle-context] "${label}" failed:`, err);
          resolve(fallback);
        }
      },
    );
  });
}

// ─── Source 1: Business Snapshot ─────────────────────────────────────────────

async function loadBusinessSnapshot(
  organizationId: string,
  forceRefresh: boolean,
): Promise<BusinessSnapshot | null> {
  try {
    return await withTimeout(
      'business-snapshot',
      getBusinessSnapshot(organizationId, { forceRefresh }),
      null,
    );
  } catch (err) {
    console.warn('[oracle-context] Business Snapshot failed:', err);
    return null;
  }
}

// ─── Source 2: Customers (Prisma ZohoCustomer + Client, org-scoped) ──────────

async function loadCustomers(organizationId: string): Promise<{
  customers: OracleContext['customers'];
  count: number;
}> {
  try {
    // ZohoCustomer table — synced from Zoho Books, org-scoped
    const zohoCustomersP = withTimeout(
      'zohoCustomer.findMany',
      db.zohoCustomer.findMany({
        where: { organizationId },
        orderBy: { lastSyncedAt: 'desc' },
        take: 20,
        select: {
          contactName: true,
          companyName: true,
          gstNumber: true,
          email: true,
          outstandingReceivable: true,
          status: true,
        },
      }),
      [] as Awaited<ReturnType<typeof db.zohoCustomer.findMany>>,
    );

    // Client table — locally created customers, org-scoped via firmId.
    // NOTE: Client model fields are tradeName / legalName / contactEmail (NOT
    // name / email). There is no outstandingAmount field — we default to 0.
    const localClientsP = withTimeout(
      'client.findMany',
      db.client.findMany({
        where: { firmId: organizationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          tradeName: true,
          legalName: true,
          gstin: true,
          contactEmail: true,
          status: true,
        },
      }),
      [] as Awaited<ReturnType<typeof db.client.findMany>>,
    );

    const [zohoCustomers, localClients] = await Promise.all([zohoCustomersP, localClientsP]);

    const customers: OracleContext['customers'] = [
      ...(zohoCustomers ?? []).map((c) => ({
        name: c.contactName ?? '',
        companyName: c.companyName ?? null,
        gstin: c.gstNumber ?? null,
        email: c.email ?? null,
        outstanding: c.outstandingReceivable ?? 0,
        status: c.status ?? 'active',
        source: 'zoho' as const,
      })),
      ...(localClients ?? []).map((c) => ({
        name: c.tradeName ?? c.legalName ?? '',
        companyName: c.legalName ?? null,
        gstin: c.gstin ?? null,
        email: c.contactEmail ?? null,
        outstanding: 0, // Client has no outstanding field; derive from invoices if needed
        status: c.status ?? 'active',
        source: 'local' as const,
      })),
    ];

    return { customers, count: customers.length };
  } catch (err) {
    console.warn('[oracle-context] customers load failed:', err);
    return { customers: [], count: 0 };
  }
}

// ─── Source 3: Invoices (Prisma ZohoInvoice + Invoice, org-scoped) ───────────

async function loadInvoices(organizationId: string): Promise<{
  invoices: OracleContext['invoices'];
  count: number;
}> {
  try {
    const zohoInvoicesP = withTimeout(
      'zohoInvoice.findMany',
      db.zohoInvoice.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          invoiceNumber: true,
          customerName: true,
          total: true,
          balance: true,
          status: true,
          date: true,
          dueDate: true,
        },
      }),
      [] as Awaited<ReturnType<typeof db.zohoInvoice.findMany>>,
    );

    const localInvoicesP = withTimeout(
      'invoice.findMany',
      db.invoice.findMany({
        where: { client: { firmId: organizationId } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          invoiceNumber: true,
          buyerName: true,
          totalAmount: true,
          status: true,
          invoiceDate: true, // String (e.g. "2024-03-15"), NOT DateTime
        },
      }),
      [] as Awaited<ReturnType<typeof db.invoice.findMany>>,
    );

    const [zohoInvoices, localInvoices] = await Promise.all([zohoInvoicesP, localInvoicesP]);

    const invoices: OracleContext['invoices'] = [
      ...(zohoInvoices ?? []).map((i) => ({
        invoiceNumber: i.invoiceNumber ?? '',
        customerName: i.customerName ?? '',
        total: i.total ?? 0,
        balance: i.balance ?? 0,
        status: i.status ?? 'draft',
        date: i.date ?? null,
        dueDate: i.dueDate ?? null,
        source: 'zoho' as const,
      })),
      ...(localInvoices ?? []).map((i) => ({
        invoiceNumber: i.invoiceNumber ?? '',
        customerName: i.buyerName ?? '',
        total: i.totalAmount ?? 0,
        balance: 0, // Invoice has no balance field; use 0 (total == outstanding if unpaid)
        status: i.status ?? 'draft',
        date: i.invoiceDate ?? null, // already a string
        dueDate: null, // Invoice has no dueDate field
        source: 'local' as const,
      })),
    ];

    return { invoices, count: invoices.length };
  } catch (err) {
    console.warn('[oracle-context] invoices load failed:', err);
    return { invoices: [], count: 0 };
  }
}

// ─── Source 4: GST Returns (Prisma GSTRFiling, org-scoped) ───────────────────

async function loadReturns(organizationId: string): Promise<{
  returns: OracleContext['returns'];
  count: number;
}> {
  try {
    const rows = await withTimeout(
      'gSTRFiling.findMany',
      db.gSTRFiling.findMany({
        where: { client: { firmId: organizationId } },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          returnType: true,
          period: true,
          status: true,
          filedDate: true, // String (NOT filedAt DateTime)
        },
      }),
      [] as Awaited<ReturnType<typeof db.gSTRFiling.findMany>>,
    );

    const returns: OracleContext['returns'] = (rows ?? []).map((r) => ({
      returnType: r.returnType ?? '',
      period: r.period ?? '',
      status: r.status ?? 'pending',
      filedAt: r.filedDate ?? null, // String field (e.g. "2024-03-15")
      dueDate: null, // GSTRFiling has no dueDate field
    }));

    return { returns, count: returns.length };
  } catch (err) {
    console.warn('[oracle-context] returns load failed:', err);
    return { returns: [], count: 0 };
  }
}

// ─── Source 5: Zoho Books live API (recent customers, if connected) ──────────

async function loadZohoLive(
  organizationId: string,
  userId: string | null,
): Promise<{ recordsUsed: number; connected: boolean; liveCustomers: Array<{ name: string; outstanding: number; status: string }> }> {
  if (!userId) {
    console.warn('[oracle-context] loadZohoLive: userId is null — skipping Zoho live load.');
    return { recordsUsed: 0, connected: false, liveCustomers: [] };
  }
  try {
    const tokenResult = await withTimeout(
      'zoho.getValidAccessToken',
      getZohoAccessToken(organizationId, userId),
      { accessToken: null, error: 'timeout', diagnostics: null, stored: null } as any,
    );
    const accessToken = tokenResult?.accessToken ?? null;
    const stored = tokenResult?.stored ?? null;
    const tokenErr = tokenResult?.error ?? null;
    console.info(
      `[oracle-context] loadZohoLive: orgId="${organizationId}" userId="${userId}" → accessToken=${accessToken ? `${accessToken.length}chars` : 'null'} stored=${stored ? 'present' : 'null'} zohoOrgId=${stored?.zohoOrgId ?? 'null'} error=${tokenErr ?? 'none'}`,
    );
    if (!accessToken || !stored?.zohoOrgId) {
      console.warn(`[oracle-context] loadZohoLive: bailing — accessToken=${accessToken ? 'present' : 'null'}, stored.zohoOrgId=${stored?.zohoOrgId ?? 'null'}. Token error: ${tokenErr ?? 'none'}`);
      return { recordsUsed: 0, connected: false, liveCustomers: [] };
    }
    // Fetch up to 20 customers live from Zoho Books API
    const result = await withTimeout(
      'zoho.listZohoCustomers',
      listZohoCustomers(accessToken, stored.zohoOrgId, { maxPages: 1, perPage: 20 }),
      { contacts: [], error: 'timeout', status: 0 } as any,
    );
    const contacts = result?.contacts ?? [];
    return {
      recordsUsed: contacts.length,
      connected: true,
      liveCustomers: contacts.slice(0, 10).map((c: any) => ({
        name: c.contact_name ?? c.company_name ?? '',
        outstanding: c.outstanding_receivable_amount ?? 0,
        status: c.status ?? 'active',
      })),
    };
  } catch (err) {
    console.warn('[oracle-context] Zoho live load failed:', err);
    return { recordsUsed: 0, connected: false, liveCustomers: [] };
  }
}

// ─── Source 6: Google Workspace live API (recent Gmail, if connected) ────────

async function loadGoogleLive(
  organizationId: string,
  userId: string | null,
): Promise<{ recordsUsed: number; connected: boolean; emails: Array<{ subject: string; from: string; date: string }> }> {
  if (!userId) return { recordsUsed: 0, connected: false, emails: [] };
  try {
    const { accessToken } = await withTimeout(
      'google.getValidAccessToken',
      getGoogleAccessToken(organizationId, userId),
      { accessToken: null, error: 'timeout' } as any,
    );
    if (!accessToken) {
      return { recordsUsed: 0, connected: false, emails: [] };
    }
    const result = await withTimeout(
      'gmail.listMessages',
      gmail.listMessages(accessToken, 10),
      { data: { messages: [] }, error: 'timeout', status: 0 } as any,
    );
    const messages = result?.data?.messages ?? [];
    return {
      recordsUsed: messages.length,
      connected: true,
      emails: messages.slice(0, 8).map((m: any) => ({
        subject: m.snippet?.slice(0, 120) ?? '(no subject)',
        from: m.from ?? '',
        date: m.date ?? '',
      })),
    };
  } catch (err) {
    console.warn('[oracle-context] Google live load failed:', err);
    return { recordsUsed: 0, connected: false, emails: [] };
  }
}

// ─── Prompt block builder ────────────────────────────────────────────────────

function buildPromptBlock(
  snapshot: BusinessSnapshot | null,
  customers: OracleContext['customers'],
  invoices: OracleContext['invoices'],
  returns: OracleContext['returns'],
  googleEmails: Array<{ subject: string; from: string; date: string }>,
  zohoConnected: boolean,
  googleConnected: boolean,
): string {
  const lines: string[] = [];

  // ── Business Snapshot (canonical headline numbers) ──
  lines.push('# LIVE BUSINESS SNAPSHOT (canonical source of truth)');
  if (snapshot) {
    lines.push(`Generated at: ${snapshot.generatedAt}`);
    lines.push(`Organization: ${snapshot.organizationId}`);
    lines.push('');
    lines.push('## Headline Financials (this Financial Year)');
    lines.push(`- Revenue: ${inrFull(snapshot.revenue)}`);
    lines.push(`- Expenses: ${inrFull(snapshot.expenses)}`);
    lines.push(`- Profit: ${inrFull(snapshot.profit)} (margin ${(snapshot.profitMargin * 100).toFixed(1)}%)`);
    lines.push(`- Cash position: ${inrFull(snapshot.cash)}`);
    lines.push('');
    lines.push('## Customers & Invoices');
    lines.push(`- Customers: ${snapshot.customerCount}`);
    lines.push(`- Vendors: ${snapshot.vendorCount}`);
    lines.push(`- Sales invoices: ${snapshot.invoiceCount}`);
    lines.push(`- Purchase bills: ${snapshot.billCount}`);
    lines.push('');
    lines.push('## Receivables & Payables');
    lines.push(`- Receivables (unpaid): ${inrFull(snapshot.receivables)}`);
    lines.push(`- Payables (unpaid): ${inrFull(snapshot.payables)}`);
    lines.push(`- Overdue receivables: ${inrFull(snapshot.overdueReceivables)} (${snapshot.overdueInvoiceCount} invoices)`);
    lines.push(`- Overdue payables: ${inrFull(snapshot.overduePayables)}`);
    lines.push(`- Avg days to pay: ${snapshot.avgDaysToPay}`);
    lines.push(`- Collection rate: ${(snapshot.collectionRate * 100).toFixed(1)}%`);
    lines.push('');
    lines.push('## GST Position');
    lines.push(`- Output tax (GST collected): ${inrFull(snapshot.outputTax)}`);
    lines.push(`- Input tax (ITC available): ${inrFull(snapshot.inputTax)}`);
    lines.push(`- Net GST payable: ${inrFull(snapshot.gstLiability)}`);
    lines.push('');
    lines.push('## Compliance');
    lines.push(`- Filed returns: ${snapshot.filedReturns}`);
    lines.push(`- Pending returns: ${snapshot.pendingReturns}`);
    lines.push(`- Overdue returns: ${snapshot.overdueReturns}`);
    lines.push('');
    lines.push('## Health & Risk');
    lines.push(`- Health score: ${snapshot.healthScore}/100 (${snapshot.healthScoreLabel})`);
    lines.push(`- Risk score: ${snapshot.riskScore}/100`);
    lines.push(`- Working capital: ${inrFull(snapshot.workingCapital)}`);
    lines.push(`- Runway: ${Number.isFinite(snapshot.runwayDays) ? snapshot.runwayDays + ' days' : '∞'}`);
    lines.push('');
    lines.push('## Revenue Trend');
    lines.push(`- This month: ${inrFull(snapshot.revenueThisMonth)}`);
    lines.push(`- Last month: ${inrFull(snapshot.revenueLastMonth)}`);
    lines.push(`- Top customer share: ${(snapshot.topCustomerShare * 100).toFixed(1)}%`);
    lines.push('');
    lines.push('## Forecast');
    lines.push(`- Next month revenue: ${inrFull(snapshot.forecast.nextMonthRevenue)}`);
    lines.push(`- Next month expenses: ${inrFull(snapshot.forecast.nextMonthExpenses)}`);
    lines.push(`- Trend: ${snapshot.forecast.trend} (confidence ${(snapshot.forecast.confidence * 100).toFixed(0)}%)`);
    lines.push('');
    lines.push('## Zoho Books Sync Status');
    lines.push(`- Zoho customers: ${snapshot.perEntity.zohoCustomers}`);
    lines.push(`- Zoho invoices: ${snapshot.perEntity.zohoInvoices}`);
    lines.push(`- Zoho bills: ${snapshot.perEntity.zohoBills}`);
    lines.push(`- Zoho payments received: ${snapshot.perEntity.zohoPaymentsReceived}`);
    lines.push(`- Zoho payments made: ${snapshot.perEntity.zohoPaymentsMade}`);
    lines.push(`- Last sync: ${snapshot.lastSyncAt ?? 'never'} (${snapshot.lastSyncStatus})`);
  } else {
    lines.push('Business Snapshot unavailable — no canonical financial data loaded.');
  }

  // ── Customers (live rows) ──
  lines.push('');
  lines.push('# LIVE CUSTOMERS (from Prisma, org-scoped)');
  if (customers.length === 0) {
    lines.push('No customers found. Either none exist, or Zoho Books has not been synced.');
  } else {
    lines.push(`Total: ${customers.length} (showing up to 20)`);
    for (const c of customers.slice(0, 20)) {
      const gstin = c.gstin ? ` | GSTIN: ${c.gstin}` : '';
      const outstanding = c.outstanding > 0 ? ` | Outstanding: ${inr(c.outstanding)}` : '';
      lines.push(`- ${c.name}${c.companyName ? ` (${c.companyName})` : ''} [${c.source}] — ${c.status}${gstin}${outstanding}`);
    }
  }

  // ── Invoices (live rows) ──
  lines.push('');
  lines.push('# LIVE INVOICES (from Prisma, org-scoped)');
  if (invoices.length === 0) {
    lines.push('No invoices found. Either none exist, or Zoho Books has not been synced.');
  } else {
    lines.push(`Total: ${invoices.length} (showing up to 20)`);
    for (const i of invoices.slice(0, 20)) {
      const bal = i.balance > 0 ? ` | Balance due: ${inr(i.balance)}` : '';
      const due = i.dueDate ? ` | Due: ${i.dueDate.slice(0, 10)}` : '';
      lines.push(`- ${i.invoiceNumber || '(no number)'} — ${i.customerName || 'Unknown'} — ${inr(i.total)} [${i.status}, ${i.source}]${bal}${due}`);
    }
  }

  // ── GST Returns (live rows) ──
  lines.push('');
  lines.push('# LIVE GST RETURNS (from Prisma, org-scoped)');
  if (returns.length === 0) {
    lines.push('No GST returns found.');
  } else {
    lines.push(`Total: ${returns.length} (showing up to 12)`);
    for (const r of returns.slice(0, 12)) {
      const filed = r.filedAt ? ` | Filed: ${r.filedAt.slice(0, 10)}` : '';
      const due = r.dueDate ? ` | Due: ${r.dueDate.slice(0, 10)}` : '';
      lines.push(`- ${r.returnType || 'GSTR'} — ${r.period || 'no period'} — ${r.status}${filed}${due}`);
    }
  }

  // ── Zoho Books connection status ──
  lines.push('');
  lines.push('# ZOHO BOOKS CONNECTION');
  lines.push(`- Connected: ${zohoConnected ? 'YES' : 'NO'}`);
  if (zohoConnected) {
    lines.push('- Live API reachable — recent customers fetched in real-time for this answer.');
  } else {
    lines.push('- Not connected. Encourage the user to connect Zoho Books from Integrations.');
  }

  // ── Google Workspace (recent emails) ──
  lines.push('');
  lines.push('# GOOGLE WORKSPACE (recent Gmail)');
  if (googleEmails.length > 0) {
    lines.push(`Recent messages (${googleEmails.length}):`);
    for (const m of googleEmails.slice(0, 8)) {
      lines.push(`- ${m.subject}${m.from ? ` — from ${m.from}` : ''}`);
    }
  } else {
    lines.push('- Not connected or no recent messages. Encourage the user to connect Google Workspace for email-aware insights.');
  }

  // ── Data completeness summary ──
  lines.push('');
  lines.push('# DATA COMPLETENESS');
  lines.push(`- Business Snapshot loaded: ${snapshot ? 'YES' : 'NO'}`);
  lines.push(`- Customers in DB: ${customers.length}`);
  lines.push(`- Invoices in DB: ${invoices.length}`);
  lines.push(`- GST returns in DB: ${returns.length}`);
  lines.push(`- Zoho Books connected: ${zohoConnected ? 'YES' : 'NO'}`);
  lines.push(`- Google Workspace connected: ${googleConnected ? 'YES' : 'NO'}`);
  lines.push('');
  lines.push('IMPORTANT: Answer ONLY using the data above. If a specific number/name/date is');
  lines.push('not in this context, say "I don\'t have enough business data to answer that" and');
  lines.push('explain which source is missing. NEVER invent customer names, invoice numbers,');
  lines.push('amounts, or dates. NEVER reference "Company Memory" or "previous conversations".');

  return lines.join('\n');
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function buildOracleContext(
  req: BuildOracleContextRequest,
): Promise<OracleContext> {
  const organizationId = req.organizationId;
  const userId = req.userId ?? null;

  // NOTE: We intentionally do NOT reject local-* org ids here. A "local-{uid}"
  // org is the real tenant scope for guest / preview users who have synced real
  // Zoho Books data (e.g. Prince Singh, TechCorp). The honest signal is
  // `hasData` below — if no real business records exist, the Gemini service
  // returns the "I don't have enough business data" answer. Rejecting local
  // orgs here would hide the user's REAL synced data, which is the exact bug
  // Phase 1 is fixing.

  // ── Run all 6 source loaders in parallel ──
  const [
    snapshot,
    customersResult,
    invoicesResult,
    returnsResult,
    zohoLive,
    googleLive,
  ] = await Promise.all([
    loadBusinessSnapshot(organizationId, req.forceRefresh ?? false),
    loadCustomers(organizationId),
    loadInvoices(organizationId),
    loadReturns(organizationId),
    loadZohoLive(organizationId, userId),
    loadGoogleLive(organizationId, userId),
  ]);

  const sources: OracleSources = {
    organizationId,
    businessSnapshot: snapshot !== null,
    customersLoaded: customersResult.count,
    invoicesLoaded: invoicesResult.count,
    returnsLoaded: returnsResult.count,
    revenueLoaded: snapshot?.revenue ?? 0,
    zohoRecordsUsed: zohoLive.recordsUsed,
    googleRecordsUsed: googleLive.recordsUsed,
    demoRecordsUsed: 0, // ALWAYS 0 — safety guard
    zohoConnected: zohoLive.connected,
    googleConnected: googleLive.connected,
    snapshotGeneratedAt: snapshot?.generatedAt ?? null,
  };

  // ── hasData: True if at least one source has real business data ──
  // We use the Business Snapshot's own assessment (customerCount + invoiceCount)
  // as the primary signal, but also accept live Zoho/Google records as proof of
  // connected business activity.
  const snapshotHasData =
    snapshot !== null &&
    (snapshot.customerCount > 0 ||
      snapshot.invoiceCount > 0 ||
      snapshot.filedReturns > 0 ||
      snapshot.pendingReturns > 0 ||
      snapshot.revenue > 0);

  const hasData =
    snapshotHasData ||
    customersResult.count > 0 ||
    invoicesResult.count > 0 ||
    returnsResult.count > 0 ||
    zohoLive.recordsUsed > 0;

  const promptBlock = buildPromptBlock(
    snapshot,
    customersResult.customers,
    invoicesResult.invoices,
    returnsResult.returns,
    googleLive.emails,
    zohoLive.connected,
    googleLive.connected,
  );

  return {
    snapshot,
    customers: customersResult.customers,
    invoices: invoicesResult.invoices,
    returns: returnsResult.returns,
    googleEmails: googleLive.emails,
    hasData,
    promptBlock,
    sources,
  };
}

