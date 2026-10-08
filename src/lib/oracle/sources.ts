// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Source Engine
//
// A curated knowledge base of GST Law, CBIC Circulars, and GSTN documentation.
// Two responsibilities:
//   1. retrieveSources(query) — lightweight keyword retrieval returning the most
//      relevant citable sources for a user's question (top-K).
//   2. ensureSourcesSeeded() — idempotently seed VEYRO AISource table on first
//      load so citations resolve to real references.
//
// Every important Oracle answer should cite sources; this engine supplies them.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SourceCategory = 'law' | 'circular' | 'notification' | 'gstn_doc' | 'rule';

export interface OracleSourceRef {
  id: string;
  category: SourceCategory;
  title: string;
  citation: string;
  referenceNumber?: string;
  summary?: string;
  url?: string;
  /** Relevance score 0–1 for the query that retrieved it. */
  score?: number;
}

// ─── Seed data (real GST references) ──────────────────────────────────────────
// Compact, authoritative extracts of the most-cited GST provisions. The content
// field is the substantive rule; the summary is the one-line takeaway shown in
// the UI. Tags drive keyword retrieval.

interface SeedSource {
  category: SourceCategory;
  title: string;
  citation: string;
  referenceNumber: string;
  summary: string;
  content: string;
  tags: string;
  url?: string;
  effectiveDate?: string;
}

const SEED_SOURCES: SeedSource[] = [
  {
    category: 'law',
    title: 'Input Tax Credit — Eligibility & Conditions',
    citation: 'Section 16 of the Central Goods and Services Tax (CGST) Act, 2017',
    referenceNumber: 'CGST Act S16',
    summary:
      'ITC is available only if the registered person possesses a tax invoice, has received goods/services, tax has been paid by the supplier, and the return under Section 39 has been furnished. ITC is lost if the supplier does not file GSTR-1/3B or if invoice is not reflected in GSTR-2B within the time limit (earlier of due date of GSTR-3B for November or annual return).',
    content:
      'Section 16 of the CGST Act, 2017 — Eligibility and conditions for taking input tax credit. (1) Every registered person shall, subject to conditions, be entitled to take credit of input tax charged on any supply of goods or services. (2) No registered person shall be entitled to the credit unless: (a) he is in possession of a tax invoice or debit note; (b) he has received the goods or services; (c) tax has actually been paid to the Government; (d) he has furnished the return under section 39; and (e) where goods are received in lots, credit shall be allowed when the last lot is received. (4) A registered person shall not be entitled to input tax credit in respect of any invoice or debit note for supply of goods or services after 30th November of the following financial year or furnishing of the annual return, whichever is earlier.',
    tags: 'itc,input tax credit,sec16,section 16,eligibility,conditions,time limit,invoice,2b',
    url: 'https://www.cbic-gst.gov.in/ cgst-act-2017.html',
  },
  {
    category: 'law',
    title: 'Apportionment of Tax and Interest — Interest on delayed payment',
    citation: 'Section 50 of the CGST Act, 2017',
    referenceNumber: 'CGST Act S50',
    summary:
      'Interest at 18% per annum is payable on delayed payment of tax. On undue or excess ITC claimed, interest is payable at 18% on the excess ITC from the date it was availed till the date of reversal.',
    content:
      'Section 50 of the CGST Act, 2017 — Interest on delayed payment of tax. (1) Every person who is liable to pay tax in accordance with the provisions of this Act but fails to pay the tax or any part thereof to the Government within the period prescribed shall pay, on his own, interest at such rate not exceeding eighteen per cent. as may be notified by the Government. (3) Where interest is payable on undue or excess claim of input tax credit, it shall be calculated on the amount of undue or excess input tax credit from the date of availing such credit till the date of reversal of such credit.',
    tags: 'interest,18%,penalty,late,delayed payment,sec50,section 50,itc reversal',
  },
  {
    category: 'law',
    title: 'Late Fee for Delayed Filing of Returns',
    citation: 'Section 47 of the CGST Act, 2017',
    referenceNumber: 'CGST Act S47',
    summary:
      'Late fee is payable for delayed filing of returns. As notified: ₹50 per day (₹20 per day for nil returns), subject to maximum caps per return (₹10,000 for GSTR-3B regular, lower caps for nil).',
    content:
      'Section 47 of the CGST Act, 2017 — Late fee for delayed filing of return. (1) Any registered person who fails to furnish the details of outward supplies or return shall, in addition to the tax payable, be liable to pay a late fee. The late fee is currently notified at ₹50 per day of delay (₹100 CGST + ₹100 SGST in some cases), capped per return. Nil returns attract a reduced late fee of ₹20 per day. Maximum late fee caps have been rationalized by CBIC notifications for GSTR-1 and GSTR-3B.',
    tags: 'late fee,penalty,delayed filing,47,sec47,nil return,gstr-3b,gstr-1,₹50',
  },
  {
    category: 'circular',
    title: 'Reconciliation of Input Tax Credit — GSTR-2A/2B vs Books',
    citation: 'CBIC Circular No. 170/2022-CGST dated 12 August 2022',
    referenceNumber: 'CBIC Circular 170/2022',
    summary:
      'GSTR-2B is a static, auto-drafted ITC statement generated on the 14th of the following month. Only ITC reflected in GSTR-2B can be claimed in GSTR-3B of that month. Reconciliation between books (purchase register) and GSTR-2B is mandatory to avoid ITC denial.',
    content:
      'CBIC Circular 170/2022-CGST — Clarifications on section 38 and 16(2)(aa) of CGST Act regarding reconciliation. The circular clarifies that GSTR-2B is an auto-drafted ITC statement (static) generated on the 14th of the next month, and the ITC available in GSTR-2B alone can be claimed in GSTR-3B for that tax period. Taxpayers must reconcile their purchase register with GSTR-2B. Invoices not appearing in GSTR-2B cannot be claimed as ITC until they appear in a subsequent 2B. Rule 36(4), now aligned with section 16(2)(aa), restricts ITC to 2B-attributed invoices.',
    tags: '2a,2b,reconciliation,itc claim,sec16 2aa,rule 36 4,auto drafted,circular 170',
    url: 'https://www.cbic.gov.in/resources//htdocs-cbec/gst/circulars/circular-no-170cgst.pdf',
  },
  {
    category: 'notification',
    title: 'GSTR-3B Late Fee Rationalization',
    citation: 'CBIC Notification No. 17/2021 – Central Tax dated 1 June 2021',
    referenceNumber: 'CBIC Notification 17/2021-CT',
    summary:
      'Late fee for delayed filing of GSTR-3B was rationalized with scaled maximum caps based on turnover, and nil returns capped at ₹500 (CGST) + ₹500 (SGST). Effective for returns from July 2017 onwards.',
    content:
      'CBIC Notification 17/2021-Central Tax — In exercise of the powers conferred by section 47 of the CGST Act, the maximum late fee for delayed filing of FORM GSTR-3B is rationalized: Nil return maximum ₹500 (CGST) + ₹500 (SGST). For regular filers with turnover up to ₹1.5 crore, maximum late fee ₹2,000 per return; turnover ₹1.5–5 crore, ₹4,000; turnover above ₹5 crore, ₹10,000. Applicable retrospectively for returns from July 2017.',
    tags: 'late fee,gstr-3b,notification 17 2021,rationalization,nil return,turnover,cap',
  },
  {
    category: 'rule',
    title: 'Return Filing Due Dates',
    citation: 'Rule 6 of the CGST Rules, 2017 (read with relevant notifications)',
    referenceNumber: 'CGST Rule 6',
    summary:
      'GSTR-1 is due by the 11th of next month (monthly filers) or quarterly as per QRMP. GSTR-3B is due by the 20th of next month (monthly) or as per the QRMP scheme. GSTR-2B is auto-generated on the 14th.',
    content:
      'CGST Rule 6, 2017 — Returns. GSTR-1 (outward supplies): due 11th of the following month for monthly filers; for QRMP quarterly filers, the IFF is due on the 13th of the following two months of the quarter and the full GSTR-1 by the 13th of the month following the quarter. GSTR-3B (summary return): due 20th of the following month for monthly filers; for QRMP, due on the 22nd or 24th based on the state/UT of the registered place. GSTR-2B is auto-drafted on the 14th of the following month.',
    tags: 'due date,gstr-1,11th,gstr-3b,20th,2b,14th,qrmp,monthly,quarterly,iff',
  },
  {
    category: 'law',
    title: 'Reverse Charge Mechanism (RCM)',
    citation: 'Section 9(3) & 9(4) of the CGST Act, 2017',
    referenceNumber: 'CGST Act S9',
    summary:
      'Under RCM, the recipient of goods/services pays GST instead of the supplier. Specified categories (e.g., GTA, legal services, sponsorship) attract mandatory RCM under Section 9(3). Unregistered-to-registered supplies attract RCM under Section 9(4) (currently suspended for most categories except specified cases).',
    content:
      'Section 9(3) & 9(4) of the CGST Act, 2017 — Reverse charge mechanism. (3) The Government may specify categories of supply of goods or services the tax on which shall be paid on reverse charge basis by the recipient. (4) The tax in respect of supply of taxable goods or services by a supplier who is not registered, to a registered person, shall be paid by the recipient on a reverse charge basis. Notified RCM categories include Goods Transport Agency (GTA) services, legal services by advocates/firms, sponsorship services, director\'s remuneration, and certain imports of services.',
    tags: 'rcm,reverse charge,9 3,9 4,gta,legal services,sponsorship,recipient pays',
  },
  {
    category: 'law',
    title: 'Refund of Unutilized ITC',
    citation: 'Section 54 of the CGST Act, 2017',
    referenceNumber: 'CGST Act S54',
    summary:
      'Refund of unutilized ITC is allowed for zero-rated supplies (exports/SEZ), inverted duty structure, or excess balance in electronic credit ledger. Refund must be claimed within 2 years. Interest at 6% p.a. is payable on delayed refunds.',
    content:
      'Section 54 of the CGST Act, 2017 — Refunds. (1) Any person claiming refund may make an application before the expiry of two years. (3) Refund of unutilized input tax credit is allowed in cases of: (i) zero-rated supplies made without payment of tax; (ii) where credit has accumulated on account of rate of tax on inputs being higher than the rate of tax on output supplies (other than nil-rated or fully exempt supplies) — inverted duty. The refund is subject to restrictions under Rule 89(5) which excludes the net ITC on common inputs from the inverted duty refund calculation.',
    tags: 'refund,54,zero rated,export,sez,inverted duty,rule 89 5,unutilized itc',
  },
  {
    category: 'circular',
    title: 'E-Invoicing Mandate & IRN',
    citation: 'CBIC Circular No. 130/2020-CGST dated 21 January 2020',
    referenceNumber: 'CBIC Circular 130/2020',
    summary:
      'E-invoicing (Invoice Reference Number — IRN) is mandatory for taxpayers with turnover above the notified threshold (currently ₹5 crore) for B2B supplies. IRN must be generated from the IRP before issuing the invoice. Invoice without IRN is not legally valid.',
    content:
      'CBIC Circular 130/2020-CGST — e-invoicing in GST. Specifies the applicability of Invoice Reference Number (IRN) and QR code for B2B invoices issued by registered persons whose aggregate turnover in any preceding financial year exceeds the notified threshold (progressively reduced from ₹500 crore to ₹5 crore). Taxpayers must report invoices to the Invoice Registration Portal (IRP), which generates an IRN and a signed QR code. An invoice without a valid IRN is not a valid document. E-invoicing applies to specified documents: tax invoice, debit note, credit note, and export invoices.',
    tags: 'e-invoice,einvoicing,irn,irp,qr code,130 2020,5 crore,threshold,b2b',
  },
  {
    category: 'circular',
    title: 'E-Way Bill Generation & Validity',
    citation: 'CBIC Circular No. 47/21/2018-GST dated 4 June 2018',
    referenceNumber: 'CBIC Circular 47/2018',
    summary:
      'E-way bill is mandatory for movement of goods of consignment value exceeding ₹50,000. Validity is 1 day per 200 km (over-dimensional cargo: 1 day per 20 km). Must be generated before movement commences.',
    content:
      'CBIC Circular 47/21/2018-GST — e-way bill. E-way bill is required for inter-state and intra-state movement of goods where the consignment value exceeds ₹50,000 (certain states have lower intra-state thresholds). It is generated on the EWB portal (ewaybill.nic.in) by the registered person causing the movement, containing Part A (invoice details) and Part B (vehicle details). Validity: 1 day for up to 200 km, and 1 additional day for every 200 km or part thereof (1 day per 20 km for over-dimensional cargo). Extension must be done within 8 hours of expiry.',
    tags: 'e-way bill,eway,ewb,50 000,200 km,validity,transport,consignment,47 2018',
  },
  {
    category: 'gstn_doc',
    title: 'GSTR-2B — Auto-drafted ITC Statement',
    citation: 'GSTN Advisory on GSTR-2B',
    referenceNumber: 'GSTN 2B Advisory',
    summary:
      'GSTR-2B is a static month-wise auto-drafted ITC statement generated on the 14th of the following month based on GSTR-1/IFF filed by suppliers. ITC in GSTR-3B must match GSTR-2B. Differences flow to Table 4 of GSTR-3B for reversal.',
    content:
      'GSTR-2B is an auto-drafted ITC statement (static) generated on the 14th of the following month based on the GSTR-1 / IFF filed by suppliers and GSTR-5/6/7 filed by others. It is fixed for that tax period and cannot be amended. Taxpayers must claim ITC only to the extent reflected in GSTR-2B. Any ITC availed in GSTR-3B but not in GSTR-2B must be reversed in Table 4(B)(1) and can be reclaimed later when it appears in GSTR-2B.',
    tags: 'gstr-2b,2b,auto drafted,itc statement,14th,static,4b,reversal,reclaim',
  },
  {
    category: 'law',
    title: 'Annual Return — GSTR-9',
    citation: 'Section 44 of the CGST Act, 2017',
    referenceNumber: 'CGST Act S44',
    summary:
      'Every regular registered person must file GSTR-9 (annual return) by 31st December of the following financial year. Small taxpayers (turnover up to ₹2 crore) have the option to not file, as notified. GSTR-9C reconciliation statement is required for turnover above ₹5 crore.',
    content:
      'Section 44 of the CGST Act, 2017 — Annual return. Every registered person, other than an Input Service Distributor, a person paying tax under section 51 or section 52, a casual taxable person and a non-resident taxable person, shall furnish an annual return electronically in FORM GSTR-9 by the 31st December following the end of such financial year. CBIC has notified that taxpayers with aggregate turnover up to ₹2 crore are exempt from filing GSTR-9 for specified financial years. GSTR-9C (self-certified reconciliation statement) is required for taxpayers with turnover exceeding ₹5 crore.',
    tags: 'gstr-9,annual return,9c,december,31st,2 crore,5 crore,reconciliation,44',
  },
  {
    category: 'law',
    title: 'Composition Scheme — Section 10',
    citation: 'Section 10 of the CGST Act, 2017',
    referenceNumber: 'CGST Act S10',
    summary:
      'Small taxpayers (turnover up to ₹1.5 crore; ₹75 lakh for special category states; ₹50 lakh for services) can opt for composition scheme paying tax at 1% (traders), 0.5% (manufacturers), or 6% (services) on turnover. No ITC is allowed. CMP-08 quarterly return + GSTR-4 annual.',
    content:
      'Section 10 of the CGST Act, 2017 — Composition levy. The composition scheme is available to registered persons whose aggregate turnover in the preceding financial year did not exceed ₹1.5 crore (₹75 lakh for certain special-category states). Service providers with turnover up to ₹50 lakh are also eligible (rate 6%). Tax rates: 1% for manufacturers and traders (0.5% CGST + 0.5% SGST), 5% for restaurant services, 6% for other service providers. Composition dealers cannot collect tax, cannot claim ITC, and file CMP-08 quarterly plus GSTR-4 annually.',
    tags: 'composition,scheme,1%,0.5%,6%,cmp-08,gstr-4,1.5 crore,75 lakh,50 lakh,small taxpayer',
  },
];

// ─── Public: idempotently seed sources ────────────────────────────────────────

let seedPromise: Promise<void> | null = null;

export function ensureSourcesSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const count = await db.oracleSource.count();
      if (count > 0) return;
      await db.oracleSource.createMany({
        data: SEED_SOURCES.map((s) => ({
          category: s.category,
          title: s.title,
          citation: s.citation,
          referenceNumber: s.referenceNumber,
          content: s.content,
          summary: s.summary,
          tags: s.tags,
          url: s.url ?? null,
          effectiveDate: s.effectiveDate ?? null,
        })),
      });
    })().catch(() => {
      // Allow a retry on the next request if seeding failed.
      seedPromise = null;
    });
  }
  return seedPromise;
}

// ─── Public: retrieve relevant sources for a query ────────────────────────────

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'my',
  'what', 'how', 'why', 'when', 'who', 'do', 'i', 'me', 'you', 'can', 'should',
  'will', 'would', 'please', 'tell', 'explain', 'about', 'this', 'that', 'with',
  'from', 'by', 'as', 'at', 'be', 'has', 'have', 'had', 'was', 'were', 'been',
  'it', 'its', 'they', 'them', 'their', 'we', 'us', 'our', 'kya', 'hai', 'kaise',
  'kyu', 'kab', 'kaun', 'mere', 'mera', 'mujhe', 'batao', 'samjhao',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Lightweight keyword-overlap retrieval. Returns the top-K sources whose tags /
 * title / summary best match the query. Each hit gets a 0–1 relevance score.
 */
export async function retrieveSources(query: string, topK = 3): Promise<OracleSourceRef[]> {
  await ensureSourcesSeeded();

  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const all = await db.oracleSource.findMany();
  const scored = all.map((row) => {
    const tagTokens = new Set((row.tags ?? '').toLowerCase().split(/[,\s]+/).filter(Boolean));
    const titleTokens = tokenize(row.title);
    const summaryTokens = tokenize(row.summary ?? '');
    const refTokens = tokenize(row.referenceNumber ?? '');

    let hits = 0;
    let weighted = 0;
    for (const t of tokens) {
      // Tag match = strongest signal.
      if (tagTokens.has(t)) {
        hits += 1;
        weighted += 3;
        continue;
      }
      if (refTokens.includes(t)) {
        hits += 1;
        weighted += 2.5;
        continue;
      }
      if (titleTokens.includes(t)) {
        hits += 1;
        weighted += 2;
        continue;
      }
      if (summaryTokens.includes(t)) {
        hits += 1;
        weighted += 1;
        continue;
      }
      // Partial tag match (e.g. "itc" inside "itc claim").
      for (const tag of tagTokens) {
        if (tag.includes(t) || t.includes(tag)) {
          hits += 0.5;
          weighted += 1;
          break;
        }
      }
    }

    const score = Math.min(1, weighted / (Math.max(1, tokens.length) * 1.5));
    return {
      id: row.id,
      category: row.category as SourceCategory,
      title: row.title,
      citation: row.citation,
      referenceNumber: row.referenceNumber ?? undefined,
      summary: row.summary ?? undefined,
      url: row.url ?? undefined,
      score: hits > 0 ? Number(score.toFixed(2)) : 0,
    };
  });

  return scored
    .filter((s) => (s.score ?? 0) > 0.15)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, topK);
}

// ─── Public: render sources as a system-prompt block ──────────────────────────

export function renderSourcesBlock(sources: OracleSourceRef[]): string {
  if (sources.length === 0) return '';
  const lines: string[] = [];
  lines.push('## RELEVANT GST SOURCES (cite these where applicable)');
  for (const s of sources) {
    lines.push(`- **${s.citation}** — ${s.summary}`);
  }
  lines.push('When your answer relies on a rule above, cite the reference inline (e.g. "as per Section 16 of the CGST Act").');
  return lines.join('\n');
}
