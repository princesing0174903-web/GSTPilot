// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — GLOBAL COMPLIANCE CLOUD™ — Subsystem 1: REGULATION GRAPH™
// Global Regulation Knowledge Graph — DB-first, seed fallback with 20+ REAL Indian
// regulations (CGST Act, Income Tax, TDS, EPF, ESI, Companies Act, RBI, Labour laws).
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  ComplianceRegulation,
  RegulationType,
  RegulationCategory,
  RegulationSection,
} from './types';

// ─── Canonical seed: 20+ REAL Indian regulations ─────────────────────────────
// Each entry uses real regulation codes, real section numbers, real authorities.
// Sourced from public statutes (CGST Act 2017, IT Act 1961, EPF Act 1952, etc.).

interface SeedRegulation {
  regulationCode: string;
  title: string;
  description: string;
  jurisdiction: string;
  countryIso: string;
  regulationType: RegulationType;
  authority: string;
  category: RegulationCategory;
  penaltySummary: string;
  interestRatePct: number;
  sections: RegulationSection[];
  industryTags: string[];
  riskWeight: number;
  sourceUrl: string;
}

const REGULATION_GRAPH_SEED: SeedRegulation[] = [
  {
    regulationCode: 'CGST-2017-S9',
    title: 'CGST Act Section 9 — Levy and Collection',
    description: 'Central GST chargeable on intra-State supplies of goods/services.',
    jurisdiction: 'IN-CGST', countryIso: 'IN', regulationType: 'gst', authority: 'CBIC',
    category: 'compliance', penaltySummary: '₹10,000 + tax evasion penalty up to 100%',
    interestRatePct: 18,
    sections: [
      { section: '9(1)', title: 'Levy', summary: 'CGST on intra-State supplies at notified rates.' },
      { section: '9(3)', title: 'RCM', summary: 'Reverse charge on specified goods/services.' },
      { section: '9(4)', title: 'RCM from unregistered', summary: 'RCM on purchases from unregistered dealers (suspended for small taxpayers).' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 80,
    sourceUrl: 'https://www.cbic-gst.gov.in/CGST-act.html',
  },
  {
    regulationCode: 'CGST-2017-S16',
    title: 'CGST Act Section 16 — Input Tax Credit Eligibility',
    description: 'Conditions for claiming ITC: invoice, receipt, tax paid, return filed, GSTR-2B match.',
    jurisdiction: 'IN-CGST', countryIso: 'IN', regulationType: 'gst', authority: 'CBIC',
    category: 'compliance', penaltySummary: 'ITC denied + 100% penalty on wrongful claim',
    interestRatePct: 18,
    sections: [
      { section: '16(1)', title: 'Eligibility', summary: 'ITC only if all 4 conditions met.' },
      { section: '16(2)(aa)', title: 'GSTR-2B match', summary: 'ITC restricted to GSTR-2B auto-populated from supplier GSTR-1.' },
      { section: '16(4)', title: 'Time limit', summary: 'ITC must be claimed by 30th Nov of following FY.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 90,
    sourceUrl: 'https://www.cbic-gst.gov.in/CGST-act.html',
  },
  {
    regulationCode: 'CGST-2017-S37',
    title: 'CGST Act Section 37 — GSTR-1 Furnishing',
    description: 'Outward supplies return — monthly/quarterly; due 11th of next month.',
    jurisdiction: 'IN-CGST', countryIso: 'IN', regulationType: 'gst', authority: 'GSTN',
    category: 'filing', penaltySummary: '₹200/day (₹100 CGST + ₹100 SGST), no maximum',
    interestRatePct: 18,
    sections: [
      { section: '37(1)', title: 'Filing frequency', summary: 'Monthly (QRMP quarterly for ≤5cr turnover).' },
      { section: '37(3)', title: 'Late fee', summary: '₹200/day capped at ₹5,000 (NIL returns ₹20/day).' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 75,
    sourceUrl: 'https://www.cbic-gst.gov.in/CGST-act.html',
  },
  {
    regulationCode: 'CGST-2017-S39',
    title: 'CGST Act Section 39 — GSTR-3B Return',
    description: 'Monthly summary return + tax payment — due 20th of next month.',
    jurisdiction: 'IN-CGST', countryIso: 'IN', regulationType: 'gst', authority: 'GSTN',
    category: 'filing', penaltySummary: '₹200/day + 18% interest on delayed tax',
    interestRatePct: 18,
    sections: [
      { section: '39(1)', title: 'Regular return', summary: 'Summary of outward/inward supplies, ITC, tax payable.' },
      { section: '39(3)', title: 'Composition', summary: 'Quarterly CMP-08 for composition dealers.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 95,
    sourceUrl: 'https://www.cbic-gst.gov.in/CGST-act.html',
  },
  {
    regulationCode: 'CGST-2017-S122',
    title: 'CGST Act Section 122 — Penalties',
    description: 'General penalty provisions — ₹10,000 or 10% tax whichever higher for non-filing.',
    jurisdiction: 'IN-CGST', countryIso: 'IN', regulationType: 'gst', authority: 'CBIC',
    category: 'audit', penaltySummary: 'Up to 100% of tax evaded + ₹10,000 minimum',
    interestRatePct: 18,
    sections: [
      { section: '122(1)', title: 'Offences', summary: '21 listed offences including non-filing, wrongful ITC.' },
      { section: '122(3)', title: 'Penalty amount', summary: '₹10,000 or 10% tax whichever higher.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 70,
    sourceUrl: 'https://www.cbic-gst.gov.in/CGST-act.html',
  },
  {
    regulationCode: 'IT-1961-S139',
    title: 'Income Tax Act Section 139 — Return Filing',
    description: 'Mandatory ITR filing for companies, firms, individuals above exemption.',
    jurisdiction: 'IN-IT', countryIso: 'IN', regulationType: 'income_tax', authority: 'CBDT',
    category: 'filing', penaltySummary: '₹1,000-10,000 late fee u/s 234F + 1% per month interest u/s 234A',
    interestRatePct: 12,
    sections: [
      { section: '139(1)', title: 'Mandatory filing', summary: 'Companies: 31st Oct; others: 31st Jul/31st Oct.' },
      { section: '139(3)', title: 'Loss return', summary: 'Loss return required to carry forward losses.' },
      { section: '139(9)', title: 'Defective return', summary: '15 days to cure defective return notice.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading', 'professionals'], riskWeight: 85,
    sourceUrl: 'https://incometaxindia.gov.in/pages/acts/income-tax-act.aspx',
  },
  {
    regulationCode: 'IT-1961-S44AB',
    title: 'Income Tax Section 44AB — Tax Audit',
    description: 'Mandatory tax audit for turnover > ₹1cr (business), > ₹50L (profession).',
    jurisdiction: 'IN-IT', countryIso: 'IN', regulationType: 'income_tax', authority: 'CBDT',
    category: 'audit', penaltySummary: '0.5% of turnover (max ₹1.5 lakh) u/s 271B',
    interestRatePct: 12,
    sections: [
      { section: '44AB(a)', title: 'Business', summary: 'Audit if turnover > ₹1cr (₹10cr if digital).' },
      { section: '44AB(b)', title: 'Profession', summary: 'Audit if gross receipts > ₹50 lakh.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading', 'professionals'], riskWeight: 95,
    sourceUrl: 'https://incometaxindia.gov.in/pages/acts/income-tax-act.aspx',
  },
  {
    regulationCode: 'IT-1961-S206AA',
    title: 'Income Tax Section 206AA — TDS on No-PAN',
    description: 'TDS at 20% (or higher rate) when deductee has not furnished PAN.',
    jurisdiction: 'IN-IT', countryIso: 'IN', regulationType: 'tds', authority: 'CBDT',
    category: 'payment', penaltySummary: 'TDS at 20% instead of normal rate',
    interestRatePct: 12,
    sections: [
      { section: '206AA(1)', title: 'Higher rate', summary: '20% TDS when PAN not provided.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 60,
    sourceUrl: 'https://incometaxindia.gov.in/pages/acts/income-tax-act.aspx',
  },
  {
    regulationCode: 'IT-1961-S194C',
    title: 'Income Tax Section 194C — TDS on Contractor',
    description: 'TDS 1% (individual/HUF) / 2% (others) on payments to contractors > ₹30,000.',
    jurisdiction: 'IN-IT', countryIso: 'IN', regulationType: 'tds', authority: 'CBDT',
    category: 'payment', penaltySummary: 'Disallowance 30% expense u/s 40(a)(ia) + interest 1% per month',
    interestRatePct: 12,
    sections: [
      { section: '194C(1)', title: 'Rate', summary: '1% individual/HUF, 2% other deductees.' },
      { section: '194C(3)', title: 'Threshold', summary: '₹30,000 single payment, ₹1,00,000 annual aggregate.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading', 'construction'], riskWeight: 75,
    sourceUrl: 'https://incometaxindia.gov.in/pages/acts/income-tax-act.aspx',
  },
  {
    regulationCode: 'IT-1961-S194J',
    title: 'Income Tax Section 194J — TDS on Professional Fees',
    description: 'TDS 10% on professional/technical fees > ₹30,000.',
    jurisdiction: 'IN-IT', countryIso: 'IN', regulationType: 'tds', authority: 'CBDT',
    category: 'payment', penaltySummary: 'Disallowance 30% expense + interest 1% per month',
    interestRatePct: 12,
    sections: [
      { section: '194J(1)', title: 'Professional services', summary: '10% on fees for professional/technical services.' },
      { section: '194J(1)(ba)', title: 'Technical services', summary: '2% on call centre technical services.' },
    ],
    industryTags: ['services', 'professionals', 'consulting'], riskWeight: 70,
    sourceUrl: 'https://incometaxindia.gov.in/pages/acts/income-tax-act.aspx',
  },
  {
    regulationCode: 'EPF-1952-S5',
    title: 'EPF Act Section 5 — Contributory Fund',
    description: 'EPF applies to establishments with ≥20 employees; 12% employer + 12% employee.',
    jurisdiction: 'IN-LABOUR', countryIso: 'IN', regulationType: 'epfo', authority: 'EPFO',
    category: 'payment', penaltySummary: 'Damage up to 100% of dues + 17% interest p.a. + 6 months-1 year imprisonment',
    interestRatePct: 17,
    sections: [
      { section: '5(1)', title: 'Applicability', summary: 'Establishments with ≥20 employees.' },
      { section: '6', title: 'Contribution', summary: '12% employer + 12% employee on basic+DA.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 80,
    sourceUrl: 'https://www.epfindia.gov.in/',
  },
  {
    regulationCode: 'EPF-1952-S7A',
    title: 'EPF Act Section 7A — Assessment',
    description: 'EPFO assessment proceedings to determine dues.',
    jurisdiction: 'IN-LABOUR', countryIso: 'IN', regulationType: 'epfo', authority: 'EPFO',
    category: 'audit', penaltySummary: '100% damages on concealment + 17% interest',
    interestRatePct: 17,
    sections: [
      { section: '7A(1)', title: 'Inquiry', summary: 'Assessment of contributions due.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 65,
    sourceUrl: 'https://www.epfindia.gov.in/',
  },
  {
    regulationCode: 'ESI-1948-S2',
    title: 'ESI Act Section 2 — Employees State Insurance',
    description: 'ESI applies to establishments with ≥10 employees; 3.25% employer + 0.75% employee.',
    jurisdiction: 'IN-LABOUR', countryIso: 'IN', regulationType: 'esic', authority: 'ESIC',
    category: 'payment', penaltySummary: 'Damages up to 100% + 12% interest p.a. + imprisonment',
    interestRatePct: 12,
    sections: [
      { section: '2(12)', title: 'Employee', summary: 'All employees earning ≤ ₹21,000/month covered.' },
      { section: '2(13)', title: 'Wages', summary: 'All remuneration excluding specific items.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 75,
    sourceUrl: 'https://www.esic.gov.in/',
  },
  {
    regulationCode: 'CA-2013-S137',
    title: 'Companies Act Section 137 — Annual Financial Statements',
    description: 'Filing of annual financial statements (AOC-4) with ROC within 30 days of AGM.',
    jurisdiction: 'IN-MCA', countryIso: 'IN', regulationType: 'mca', authority: 'MCA',
    category: 'filing', penaltySummary: '₹100/day per default with no maximum',
    interestRatePct: 0,
    sections: [
      { section: '137(1)', title: 'Filing', summary: 'AOC-4 within 30 days of AGM.' },
      { section: '137(3)', title: 'Penalty', summary: '₹100/day company + officer default.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 75,
    sourceUrl: 'https://www.mca.gov.in/MinistryV2/companiesact2013.html',
  },
  {
    regulationCode: 'CA-2013-S92',
    title: 'Companies Act Section 92 — Annual Return (MGT-7)',
    description: 'Filing of annual return (MGT-7/7A) with ROC within 60 days of AGM.',
    jurisdiction: 'IN-MCA', countryIso: 'IN', regulationType: 'mca', authority: 'MCA',
    category: 'filing', penaltySummary: '₹100/day with no maximum + ≤ ₹50,000 + officer fine',
    interestRatePct: 0,
    sections: [
      { section: '92(1)', title: 'Annual return', summary: 'MGT-7/7A within 60 days of AGM.' },
      { section: '92(5)', title: 'Penalty', summary: '₹100/day company + ₹50,000-5,00,000 officer.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 70,
    sourceUrl: 'https://www.mca.gov.in/MinistryV2/companiesact2013.html',
  },
  {
    regulationCode: 'CA-2013-S135',
    title: 'Companies Act Section 135 — CSR',
    description: 'CSR mandatory for companies meeting net-worth/turnover/profit thresholds; 2% of avg net profit.',
    jurisdiction: 'IN-MCA', countryIso: 'IN', regulationType: 'companies_act', authority: 'MCA',
    category: 'compliance', penaltySummary: 'Penalty ₹50,000-25,00,000 + officer ₹25,000-3,00,000',
    interestRatePct: 0,
    sections: [
      { section: '135(1)', title: 'Applicability', summary: 'NW ≥₹500cr / turnover ≥₹1000cr / NP ≥₹5cr.' },
      { section: '135(5)', title: '2% spend', summary: '2% of avg net profit of preceding 3 years.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 60,
    sourceUrl: 'https://www.mca.gov.in/MinistryV2/companiesact2013.html',
  },
  {
    regulationCode: 'CA-2013-S149',
    title: 'Companies Act Section 149 — Directors',
    description: 'Board composition: min/max directors, independent director requirements.',
    jurisdiction: 'IN-MCA', countryIso: 'IN', regulationType: 'companies_act', authority: 'MCA',
    category: 'registration', penaltySummary: '₹10,000-1,00,000 per default',
    interestRatePct: 0,
    sections: [
      { section: '149(1)', title: 'Minimum directors', summary: 'Min 3 (public)/2 (private)/1 (OPC).' },
      { section: '149(4)', title: 'Independent', summary: '1/3rd independent if listed/public above threshold.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 50,
    sourceUrl: 'https://www.mca.gov.in/MinistryV2/companiesact2013.html',
  },
  {
    regulationCode: 'RBI-1934-S24',
    title: 'RBI Act Section 24 — Legal Tender',
    description: 'Bank notes legal tender; RBI regulates issue and circulation.',
    jurisdiction: 'IN-RBI', countryIso: 'IN', regulationType: 'rbi', authority: 'RBI',
    category: 'compliance', penaltySummary: 'As per RBI directions, up to ₹1 crore per violation',
    interestRatePct: 0,
    sections: [
      { section: '24(1)', title: 'Legal tender', summary: 'Bank notes guaranteed by Central Government.' },
    ],
    industryTags: ['banking', 'nbfc'], riskWeight: 60,
    sourceUrl: 'https://www.rbi.org.in/Scripts/BS_viewact.aspx',
  },
  {
    regulationCode: 'RBI-FEMA-1999',
    title: 'FEMA 1999 — Foreign Exchange Management',
    description: 'Regulates foreign exchange, cross-border payments, ECBs, FDI.',
    jurisdiction: 'IN-FEMA', countryIso: 'IN', regulationType: 'rbi', authority: 'RBI',
    category: 'compliance', penaltySummary: '3x amount confiscated + ₹10,000-2,00,000 per violation',
    interestRatePct: 0,
    sections: [
      { section: '13(1)', title: 'Penalty', summary: 'Up to 3x the amount involved.' },
      { section: '13(1)(c)', title: 'Continuing', summary: 'Continuing violation: ₹5,000/day.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading', 'import-export'], riskWeight: 80,
    sourceUrl: 'https://www.rbi.org.in/Scripts/BS_Fema.aspx',
  },
  {
    regulationCode: 'MIN-1948-S11',
    title: 'Minimum Wages Act Section 11 — Payment',
    description: 'Employer must pay minimum wages at not less than intervals specified.',
    jurisdiction: 'IN-LABOUR', countryIso: 'IN', regulationType: 'labour_law', authority: 'Labour Ministry',
    category: 'payment', penaltySummary: '6 months imprisonment + ₹500 fine; continuing: ₹10/day',
    interestRatePct: 0,
    sections: [
      { section: '11(1)', title: 'Wage periods', summary: 'Wages fixed according to wage periods.' },
      { section: '20(1)', title: 'Penalty', summary: 'Imprisonment up to 6 months + fine.' },
    ],
    industryTags: ['manufacturing', 'services', 'construction'], riskWeight: 65,
    sourceUrl: 'https://labour.gov.in/',
  },
  {
    regulationCode: 'PF-1976-EDLI',
    title: 'EDLI Scheme — Employee Deposit Linked Insurance',
    description: 'Life insurance cover linked to EPF balance; 0.5% of basic wages contributed by employer.',
    jurisdiction: 'IN-LABOUR', countryIso: 'IN', regulationType: 'epfo', authority: 'EPFO',
    category: 'payment', penaltySummary: 'Same as EPF damages — 100% on concealment',
    interestRatePct: 17,
    sections: [
      { section: '1', title: 'Coverage', summary: 'Automatic for all EPF members.' },
      { section: '22', title: 'Contribution', summary: '0.5% of basic wages by employer.' },
    ],
    industryTags: ['manufacturing', 'services', 'trading'], riskWeight: 55,
    sourceUrl: 'https://www.epfindia.gov.in/',
  },
  {
    regulationCode: 'PT-PROFESSIONAL-TAX',
    title: 'Professional Tax (State Levies)',
    description: 'State-level tax on professions/trades; slab-based; deducted monthly from payroll.',
    jurisdiction: 'IN-STATES', countryIso: 'IN', regulationType: 'payroll', authority: 'State Commercial Tax',
    category: 'payment', penaltySummary: '10% of tax due + interest; varies by state',
    interestRatePct: 18,
    sections: [
      { section: 'Schedule I', title: 'Slabs', summary: '₹0-2,500/month based on salary slab (state-specific).' },
    ],
    industryTags: ['manufacturing', 'services', 'trading', 'professionals'], riskWeight: 45,
    sourceUrl: 'https://gstcouncil.gov.in/',
  },
];

// ─── Mapper: Prisma row → typed record ───────────────────────────────────────

function mapRow(r: {
  id: string;
  regulationCode: string;
  title: string;
  description: string | null;
  jurisdiction: string;
  countryIso: string;
  regulationType: string;
  authority: string | null;
  category: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  penaltySummary: string | null;
  interestRatePct: number;
  sections: string;
  linkedEntityIds: string;
  linkedGraphNodes: string;
  crossBorderRefs: string;
  industryTags: string;
  riskWeight: number;
  sourceUrl: string | null;
  lastReviewedAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ComplianceRegulation {
  return {
    id: r.id,
    regulationCode: r.regulationCode,
    title: r.title,
    description: r.description ?? undefined,
    jurisdiction: r.jurisdiction,
    countryIso: r.countryIso,
    regulationType: r.regulationType as RegulationType,
    authority: r.authority ?? undefined,
    category: r.category as RegulationCategory,
    effectiveFrom: r.effectiveFrom?.toISOString(),
    effectiveTo: r.effectiveTo?.toISOString(),
    penaltySummary: r.penaltySummary ?? undefined,
    interestRatePct: r.interestRatePct,
    sections: safeParse<RegulationSection[]>(r.sections, []),
    linkedEntityIds: safeParse<string[]>(r.linkedEntityIds, []),
    linkedGraphNodes: safeParse<string[]>(r.linkedGraphNodes, []),
    crossBorderRefs: safeParse<string[]>(r.crossBorderRefs, []),
    industryTags: safeParse<string[]>(r.industryTags, []),
    riskWeight: r.riskWeight,
    sourceUrl: r.sourceUrl ?? undefined,
    lastReviewedAt: r.lastReviewedAt.toISOString(),
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function safeParse<T>(json: string | null | undefined, fallback: T): T {
  try {
    if (!json) return fallback;
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// ─── Seed (only if DB has zero rows) ─────────────────────────────────────────

let seedPromise: Promise<void> | null = null;

async function seedIfEmpty(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      const count = await db.complianceRegulation.count();
      if (count > 0) return;
      for (const r of REGULATION_GRAPH_SEED) {
        await db.complianceRegulation.create({
          data: {
            regulationCode: r.regulationCode,
            title: r.title,
            description: r.description,
            jurisdiction: r.jurisdiction,
            countryIso: r.countryIso,
            regulationType: r.regulationType,
            authority: r.authority,
            category: r.category,
            penaltySummary: r.penaltySummary,
            interestRatePct: r.interestRatePct,
            sections: JSON.stringify(r.sections),
            industryTags: JSON.stringify(r.industryTags),
            riskWeight: r.riskWeight,
            sourceUrl: r.sourceUrl,
            isActive: true,
          },
        });
      }
    } catch {
      // non-fatal — read path will fall back to seed array
    }
  })();
  return seedPromise;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface RegulationFilters {
  countryIso?: string;
  regulationType?: RegulationType | string;
  authority?: string;
}

export async function getRegulations(
  filters?: RegulationFilters,
): Promise<ComplianceRegulation[]> {
  await seedIfEmpty();
  try {
    const where: Record<string, unknown> = { isActive: true };
    if (filters?.countryIso) where.countryIso = filters.countryIso.toUpperCase();
    if (filters?.regulationType) where.regulationType = filters.regulationType;
    if (filters?.authority) where.authority = filters.authority;
    const rows = await db.complianceRegulation.findMany({
      where,
      orderBy: { riskWeight: 'desc' },
    });
    if (rows.length === 0) {
      // Fallback to in-memory seed filtered
      return REGULATION_GRAPH_SEED.filter((s) => {
        if (filters?.countryIso && s.countryIso !== filters.countryIso.toUpperCase()) return false;
        if (filters?.regulationType && s.regulationType !== filters.regulationType) return false;
        if (filters?.authority && s.authority !== filters.authority) return false;
        return true;
      }).map(seedToRecord);
    }
    return rows.map(mapRow);
  } catch {
    return REGULATION_GRAPH_SEED.map(seedToRecord);
  }
}

function seedToRecord(s: SeedRegulation, idx: number): ComplianceRegulation {
  const now = new Date().toISOString();
  return {
    id: `seed-${idx}-${s.regulationCode}`,
    regulationCode: s.regulationCode,
    title: s.title,
    description: s.description,
    jurisdiction: s.jurisdiction,
    countryIso: s.countryIso,
    regulationType: s.regulationType,
    authority: s.authority,
    category: s.category,
    penaltySummary: s.penaltySummary,
    interestRatePct: s.interestRatePct,
    sections: s.sections,
    linkedEntityIds: [],
    linkedGraphNodes: [],
    crossBorderRefs: [],
    industryTags: s.industryTags,
    riskWeight: s.riskWeight,
    sourceUrl: s.sourceUrl,
    lastReviewedAt: now,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getRegulationById(id: string): Promise<ComplianceRegulation | null> {
  await seedIfEmpty();
  try {
    const row = await db.complianceRegulation.findUnique({ where: { id } });
    if (!row) return null;
    return mapRow(row);
  } catch {
    return null;
  }
}

export async function linkRegulationToBusinessGraph(
  regulationId: string,
  entityIds: string[],
): Promise<void> {
  await seedIfEmpty();
  const reg = await getRegulationById(regulationId);
  if (!reg) throw new Error(`Regulation not found: ${regulationId}`);
  const merged = Array.from(new Set([...reg.linkedEntityIds, ...entityIds]));
  try {
    await db.complianceRegulation.update({
      where: { id: regulationId },
      data: {
        linkedEntityIds: JSON.stringify(merged),
        linkedGraphNodes: JSON.stringify(merged.map((id) => `entity:${id}`)),
      },
    });
  } catch {
    // non-fatal
  }
}

export async function searchRegulations(query: string): Promise<ComplianceRegulation[]> {
  await seedIfEmpty();
  const q = query.trim().toLowerCase();
  if (!q) return getRegulations();
  try {
    const rows = await db.complianceRegulation.findMany({
      where: {
        OR: [
          { regulationCode: { contains: query } },
          { title: { contains: query } },
          { description: { contains: query } },
          { authority: { contains: query } },
        ],
        isActive: true,
      },
      take: 50,
      orderBy: { riskWeight: 'desc' },
    });
    if (rows.length === 0) {
      return REGULATION_GRAPH_SEED.filter((s) =>
        s.regulationCode.toLowerCase().includes(q)
        || s.title.toLowerCase().includes(q)
        || s.description.toLowerCase().includes(q)
        || s.authority.toLowerCase().includes(q),
      ).map(seedToRecord);
    }
    return rows.map(mapRow);
  } catch {
    return REGULATION_GRAPH_SEED.filter((s) =>
      s.regulationCode.toLowerCase().includes(q)
      || s.title.toLowerCase().includes(q)
      || s.description.toLowerCase().includes(q)
    ).map(seedToRecord);
  }
}
