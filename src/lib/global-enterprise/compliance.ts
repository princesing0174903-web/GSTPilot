// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Global Enterprise Operating System™
// Global Compliance Engine™ — Multi-jurisdiction compliance deadline tracker
// with risk scoring, upcoming-deadline detection, and Oracle narrative intelligence.
// Founder & Owner: Prince Singh. All values derived from REAL production data.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  COMPLIANCE_DEADLINES_REGISTRY,
  getCountry,
  getComplianceDeadlinesForCountry,
} from './registry';
import { cacheGet, cacheSet, TTL_PRESETS, buildKey } from './cache';
import { todayISO } from './currency';
import type {
  ComplianceDeadlineRecord,
  ComplianceStatus,
  GlobalComplianceReport,
  RegulationType,
} from './types';

// ─── Internal constants & helpers ────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FIVE_MIN_TTL = 5 * 60 * 1000; // 5 min — global report + upcoming feed

type Frequency = ComplianceDeadlineRecord['frequency']; // 'one_time' | 'monthly' | 'quarterly' | 'annually'
type RiskLevel = ComplianceDeadlineRecord['riskLevel']; // 'low' | 'medium' | 'high' | 'critical'

/**
 * ComplianceDeadlineRecord extended with computed next-due info. Used internally
 * to enrich the regulation lists returned by getComplianceStatus (structurally
 * assignable to ComplianceDeadlineRecord[] since it only adds optional fields).
 */
export interface ComplianceDeadlineWithDue extends ComplianceDeadlineRecord {
  nextDueDate?: string;
  daysUntil?: number | null;
}

/**
 * Item returned by getUpcomingDeadlinesGlobally — one row per country×deadline
 * whose next concrete due date falls within the requested horizon.
 */
export interface UpcomingDeadlineItem {
  countryIso: string;
  countryName: string;
  title: string;
  regulationType: RegulationType;
  riskLevel: string;
  dueDate: string | null;
  daysUntil: number | null;
  authority?: string;
}

// Maps a raw Prisma ComplianceDeadline row to the canonical ComplianceDeadlineRecord.
// Prisma's regulationType/frequency/riskLevel are strings — cast to the typed unions.
function mapDbToRecord(r: {
  id: string;
  countryIso: string;
  regulationType: string;
  title: string;
  description: string | null;
  frequency: string;
  dueDateRule: string;
  penaltyLate: string | null;
  authority: string | null;
  riskLevel: string;
  isActive: boolean;
}): ComplianceDeadlineRecord {
  return {
    id: r.id,
    countryIso: r.countryIso,
    regulationType: r.regulationType as RegulationType,
    title: r.title,
    description: r.description ?? undefined,
    frequency: r.frequency as Frequency,
    dueDateRule: r.dueDateRule,
    penaltyLate: r.penaltyLate ?? undefined,
    authority: r.authority ?? undefined,
    riskLevel: r.riskLevel as RiskLevel,
    isActive: r.isActive,
  };
}

// Parse a YYYY-MM-DD string into a UTC-midnight Date. Returns NaN Date on bad input.
function parseISODate(s: string | null | undefined): Date {
  if (!s || s.length < 10) return new Date(NaN);
  return new Date(s.slice(0, 10) + 'T00:00:00Z');
}

// Format a Date as YYYY-MM-DD using UTC.
function formatISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Public: Deadline loaders (DB-first, registry fallback, 10-min cache) ────

/**
 * Load compliance deadlines for a single country (ISO 3166-1 alpha-2).
 *
 * Strategy: DB-first via `db.complianceDeadline.findMany`; if the DB returns no
 * rows for that country (e.g. before seeding or DB unavailable), falls back to
 * the canonical in-memory `COMPLIANCE_DEADLINES_REGISTRY`. Result cached 10 min
 * (TTL_PRESETS.COLD) keyed by country.
 */
export async function getComplianceDeadlines(
  countryIso: string
): Promise<ComplianceDeadlineRecord[]> {
  const iso = countryIso.toUpperCase();
  const cacheKey = buildKey('compliance-deadlines', { country: iso });
  const cached = cacheGet<ComplianceDeadlineRecord[]>(cacheKey);
  if (cached) return cached.value;

  let records: ComplianceDeadlineRecord[];
  try {
    const rows = await db.complianceDeadline.findMany({
      where: { countryIso: iso, isActive: true },
    });
    records =
      rows.length > 0 ? rows.map(mapDbToRecord) : getComplianceDeadlinesForCountry(iso);
  } catch {
    // DB unreachable — fall back to registry
    records = getComplianceDeadlinesForCountry(iso);
  }

  cacheSet(cacheKey, records, TTL_PRESETS.COLD);
  return records;
}

/**
 * Load ALL active compliance deadlines across every jurisdiction.
 *
 * Strategy: DB-first via `db.complianceDeadline.findMany({ where: { isActive: true } })`;
 * falls back to the in-memory registry if the DB is empty or unreachable.
 * Cached 10 min (TTL_PRESETS.COLD).
 */
export async function getAllComplianceDeadlines(): Promise<ComplianceDeadlineRecord[]> {
  const cacheKey = buildKey('compliance-deadlines', { country: 'all' });
  const cached = cacheGet<ComplianceDeadlineRecord[]>(cacheKey);
  if (cached) return cached.value;

  let records: ComplianceDeadlineRecord[];
  try {
    const rows = await db.complianceDeadline.findMany({ where: { isActive: true } });
    records =
      rows.length > 0
        ? rows.map(mapDbToRecord)
        : COMPLIANCE_DEADLINES_REGISTRY.filter((d) => d.isActive);
  } catch {
    records = COMPLIANCE_DEADLINES_REGISTRY.filter((d) => d.isActive);
  }

  cacheSet(cacheKey, records, TTL_PRESETS.COLD);
  return records;
}

// ─── Public: Due-date math ───────────────────────────────────────────────────

/**
 * Compute the next concrete due date (YYYY-MM-DD) for a regulation given its
 * human-readable `dueDateRule` and an optional reference date (defaults to today).
 *
 * Returns `null` for continuous or entity-specific rules (e.g. "Continuous",
 * "On payday", "Anniversary of incorporation").
 *
 * Recognized rule patterns (covering the VEYRO canonical registry):
 *  - Monthly: `"11th of next month"`, `"20th of next month"`, `"7th of next month"`,
 *    `"10th of next month"`, `"15th of next month"`, `"25th of next month (e-filing)"`
 *  - Last day: `"Last day of next month"`
 *  - FY-relative: `"1 month after FY end"`, `"2 months after FY end"`, …,
 *    `"12 months after FY end"`, `"120 days after FY end"` (also accepts `from`).
 *  - Quarter-relative: `"Last day of month after quarter"`,
 *    `"Last day of next month after quarter"`, `"1 month + 7 days after quarter end"`,
 *    `"28th of month after quarter"`, `"15th of month after quarter"`,
 *    `"28th of next month after quarter"`.
 *  - Fixed calendar: `"30th September"`, `"31st December of next FY"`, `"31st January"`.
 *  - Business-day: `"Last business day of May"`, `"Last business day of July"`.
 *  - Approximate: `"1st week of April (normal)"` → April 7 of current year.
 *  - Continuous / entity-specific: `"Continuous"`, `"On/before payday"`,
 *    `"On payday"`, `"Anniversary of incorporation"`, `"Anniversary of registration"`.
 *
 * Uses plain UTC Date math. Unknown rules → null.
 */
export function computeNextDueDate(
  dueDateRule: string,
  referenceDate?: string
): string | null {
  const refStr =
    referenceDate && referenceDate.trim().length >= 10
      ? referenceDate.slice(0, 10)
      : todayISO();
  const ref = new Date(refStr + 'T00:00:00Z');
  if (isNaN(ref.getTime())) return null;

  const rule = (dueDateRule ?? '').trim();
  if (!rule) return null;

  // Continuous / entity-specific rules → no fixed due date
  if (
    rule === 'Continuous' ||
    rule === 'On/before payday' ||
    rule === 'On payday' ||
    rule === 'Anniversary of incorporation' ||
    rule === 'Anniversary of registration'
  ) {
    return null;
  }

  const year = ref.getUTCFullYear();
  const month0 = ref.getUTCMonth(); // 0..11

  // ── Nth of next month ──
  // e.g. "11th of next month", "25th of next month (e-filing)"
  const nthNextMonth = rule.match(
    /^(\d+)(?:st|nd|rd|th)? of next month(?:\s*\([^)]+\))?$/
  );
  if (nthNextMonth) {
    const day = parseInt(nthNextMonth[1], 10);
    let m = month0 + 1;
    let y = year;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    return formatISO(new Date(Date.UTC(y, m, day)));
  }

  // ── Last day of next month ──
  if (rule === 'Last day of next month') {
    let m = month0 + 1;
    let y = year;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return formatISO(new Date(Date.UTC(y, m, lastDay)));
  }

  // ── N months after/from FY end ──
  // e.g. "1 month after FY end", "12 months after FY end", "12 months from FY end"
  const nMonths = rule.match(/^(\d+) months? (after|from) FY end$/);
  if (nMonths) {
    const n = parseInt(nMonths[1], 10);
    const due = new Date(Date.UTC(year, month0 + n, ref.getUTCDate()));
    return formatISO(due);
  }

  // ── N days after/from FY end ──
  // e.g. "120 days after FY end"
  const nDays = rule.match(/^(\d+) days? (after|from) FY end$/);
  if (nDays) {
    const n = parseInt(nDays[1], 10);
    return formatISO(new Date(ref.getTime() + n * MS_PER_DAY));
  }

  // ── Quarter-relative rules ──
  // Current quarter-end month0: Q1→2(Mar), Q2→5(Jun), Q3→8(Sep), Q4→11(Dec)
  const qEndMonth0 = Math.floor(month0 / 3) * 3 + 2;

  if (
    rule === 'Last day of month after quarter' ||
    rule === 'Last day of next month after quarter'
  ) {
    let m = qEndMonth0 + 1;
    let y = year;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return formatISO(new Date(Date.UTC(y, m, lastDay)));
  }

  if (rule === '1 month + 7 days after quarter end') {
    const qEnd = new Date(Date.UTC(year, qEndMonth0 + 1, 0)); // last day of quarter-end month
    const due = new Date(qEnd.getTime());
    due.setUTCMonth(due.getUTCMonth() + 1);
    due.setUTCDate(due.getUTCDate() + 7);
    return formatISO(due);
  }

  // Nth of (next) month after quarter — covers "28th of month after quarter",
  // "15th of month after quarter", "28th of next month after quarter"
  const nthAfterQuarter = rule.match(
    /^(\d+)(?:st|nd|rd|th)? of (?:next )?month after quarter$/
  );
  if (nthAfterQuarter) {
    const day = parseInt(nthAfterQuarter[1], 10);
    let m = qEndMonth0 + 1;
    let y = year;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    return formatISO(new Date(Date.UTC(y, m, day)));
  }

  // ── Fixed calendar dates ──
  if (rule === '30th September') {
    let due = new Date(Date.UTC(year, 8, 30));
    if (due.getTime() < ref.getTime()) due = new Date(Date.UTC(year + 1, 8, 30));
    return formatISO(due);
  }

  if (rule === '31st December of next FY') {
    return formatISO(new Date(Date.UTC(year + 1, 11, 31)));
  }

  if (rule === '31st January') {
    let due = new Date(Date.UTC(year, 0, 31));
    if (due.getTime() < ref.getTime()) due = new Date(Date.UTC(year + 1, 0, 31));
    return formatISO(due);
  }

  // ── Last business day of May / July ──
  if (rule === 'Last business day of May' || rule === 'Last business day of July') {
    const m = rule.includes('May') ? 4 : 6;
    let day = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    let due = new Date(Date.UTC(year, m, day));
    // Walk backward until we hit a weekday (Mon–Fri)
    while (due.getUTCDay() === 0 || due.getUTCDay() === 6) {
      day -= 1;
      due = new Date(Date.UTC(year, m, day));
    }
    return formatISO(due);
  }

  // ── 1st week of April (normal) → April 7 of current year ──
  if (rule === '1st week of April (normal)') {
    return formatISO(new Date(Date.UTC(year, 3, 7)));
  }

  // Unknown rule — cannot compute a concrete date
  return null;
}

/**
 * Whole-day difference between a due date and a reference date (defaults to today).
 *
 * Positive = future, 0 = due today, negative = overdue. Returns `null` when no
 * due date is available (continuous / entity-specific rules).
 */
export function daysUntil(
  dueDate: string | null,
  referenceDate?: string
): number | null {
  if (!dueDate) return null;
  const refStr =
    referenceDate && referenceDate.trim().length >= 10
      ? referenceDate.slice(0, 10)
      : todayISO();
  const ref = new Date(refStr + 'T00:00:00Z');
  const due = parseISODate(dueDate);
  if (isNaN(ref.getTime()) || isNaN(due.getTime())) return null;
  return Math.ceil((due.getTime() - ref.getTime()) / MS_PER_DAY);
}

// ─── Public: Country compliance status ───────────────────────────────────────

/**
 * Compute the live compliance posture for a single country.
 *
 * Fetches the country's deadlines, computes each one's next concrete due date
 * and days-until, then derives:
 *  - `upcomingDeadlines` — count of deadlines due in the next 30 days
 *  - `criticalOpen` — count of `riskLevel==='critical'` deadlines due in next 30 days
 *  - `complianceScore` — 100 minus penalties for upcoming deadlines
 *    (-10 critical / -5 high / -2 medium per upcoming; floored at 0)
 *  - `nextDeadline` — soonest upcoming deadline (title, dueDate, daysUntil, riskLevel)
 *  - `regulations` — full deadline list enriched with `nextDueDate` + `daysUntil`
 *
 * Country name resolved via `getCountry(iso)`.
 */
export async function getComplianceStatus(
  countryIso: string,
  referenceDate?: string
): Promise<ComplianceStatus> {
  const iso = countryIso.toUpperCase();
  const refDate = referenceDate ?? todayISO();
  const country = getCountry(iso);
  const countryName = country?.name ?? iso;

  const deadlines = await getComplianceDeadlines(iso);

  const regulations: ComplianceDeadlineWithDue[] = deadlines.map((d) => {
    const nextDueDate = computeNextDueDate(d.dueDateRule, refDate);
    const days = daysUntil(nextDueDate, refDate);
    return { ...d, nextDueDate: nextDueDate ?? undefined, daysUntil: days };
  });

  // Upcoming = due in next 30 days (0..30 inclusive). Continuous rules (null
  // daysUntil) are excluded.
  const upcoming = regulations.filter(
    (r): r is ComplianceDeadlineWithDue & { daysUntil: number; nextDueDate: string } =>
      r.daysUntil !== null &&
      r.daysUntil !== undefined &&
      r.daysUntil >= 0 &&
      r.daysUntil <= 30 &&
      r.nextDueDate !== undefined
  );

  const criticalOpen = upcoming.filter((r) => r.riskLevel === 'critical').length;

  let penalty = 0;
  for (const r of upcoming) {
    if (r.riskLevel === 'critical') penalty += 10;
    else if (r.riskLevel === 'high') penalty += 5;
    else if (r.riskLevel === 'medium') penalty += 2;
  }
  const complianceScore = Math.max(0, 100 - penalty);

  const sortedUpcoming = [...upcoming].sort((a, b) => a.daysUntil - b.daysUntil);
  const nextDeadline =
    sortedUpcoming.length > 0
      ? {
          title: sortedUpcoming[0].title,
          dueDate: sortedUpcoming[0].nextDueDate,
          daysUntil: sortedUpcoming[0].daysUntil,
          riskLevel: sortedUpcoming[0].riskLevel,
        }
      : undefined;

  return {
    countryIso: iso,
    countryName,
    totalDeadlines: deadlines.length,
    upcomingDeadlines: upcoming.length,
    criticalOpen,
    complianceScore,
    nextDeadline,
    regulations,
  };
}

// ─── Public: Global compliance report ────────────────────────────────────────

/**
 * Aggregate compliance posture across all (or a subset of) jurisdictions.
 *
 * For each country in `countryIsos` (default: every unique countryIso in the
 * COMPLIANCE_DEADLINES_REGISTRY), computes a full `ComplianceStatus`. Aggregates
 * overall avg score, total jurisdictions, total deadlines, critical-open sum,
 * and a `byRegulationType` breakdown. Generates an `oracleNarrative` — a 2-3
 * sentence Oracle-style executive summary naming the strongest posture, the
 * highest-risk jurisdiction, and the most urgent deadline.
 *
 * Cached 5 min via `buildKey('global-compliance', { countries: countryIsos?.join(',') ?? 'all' })`.
 */
export async function getGlobalComplianceReport(
  countryIsos?: string[]
): Promise<GlobalComplianceReport> {
  const cacheKey = buildKey('global-compliance', {
    countries: countryIsos?.join(',') ?? 'all',
  });
  const cached = cacheGet<GlobalComplianceReport>(cacheKey);
  if (cached) return cached.value;

  const isos =
    countryIsos && countryIsos.length > 0
      ? Array.from(new Set(countryIsos.map((c) => c.toUpperCase())))
      : Array.from(new Set(COMPLIANCE_DEADLINES_REGISTRY.map((d) => d.countryIso)));

  const byCountry: ComplianceStatus[] = await Promise.all(
    isos.map((iso) => getComplianceStatus(iso))
  );

  const totalJurisdictions = byCountry.length;
  const totalDeadlines = byCountry.reduce((s, c) => s + c.totalDeadlines, 0);
  const criticalOpen = byCountry.reduce((s, c) => s + c.criticalOpen, 0);
  const overallScore =
    totalJurisdictions > 0
      ? Math.round(
          byCountry.reduce((s, c) => s + c.complianceScore, 0) / totalJurisdictions
        )
      : 100;

  // byRegulationType aggregation — count deadlines + critical-open per regulation type
  const regTypeMap = new Map<RegulationType, { count: number; criticalOpen: number }>();
  for (const c of byCountry) {
    for (const r of c.regulations) {
      const rt = r.regulationType;
      const entry = regTypeMap.get(rt) ?? { count: 0, criticalOpen: 0 };
      entry.count += 1;
      if (
        r.riskLevel === 'critical' &&
        r.daysUntil !== null &&
        r.daysUntil !== undefined &&
        r.daysUntil >= 0 &&
        r.daysUntil <= 30
      ) {
        entry.criticalOpen += 1;
      }
      regTypeMap.set(rt, entry);
    }
  }
  const byRegulationType: Array<{
    type: RegulationType;
    count: number;
    criticalOpen: number;
  }> = Array.from(regTypeMap.entries())
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.count - a.count);

  const oracleNarrative = buildOracleNarrative(
    byCountry,
    overallScore,
    criticalOpen,
    totalJurisdictions
  );

  const report: GlobalComplianceReport = {
    overallScore,
    totalJurisdictions,
    totalDeadlines,
    criticalOpen,
    byCountry,
    byRegulationType,
    oracleNarrative,
  };

  cacheSet(cacheKey, report, FIVE_MIN_TTL);
  return report;
}

/**
 * Builds VEYRO AI narrative — a 2-3 sentence executive summary naming:
 *  (1) total jurisdictions + critical-open count,
 *  (2) strongest compliance posture (highest score),
 *  (3) highest-risk jurisdiction (most critical-open), and
 *  (4) the most urgent deadline across all jurisdictions.
 */
function buildOracleNarrative(
  byCountry: ComplianceStatus[],
  _overallScore: number,
  criticalOpen: number,
  totalJurisdictions: number
): string {
  if (byCountry.length === 0) {
    return 'No compliance jurisdictions configured. Oracle recommends seeding the Global Compliance Engine™ registry to begin monitoring.';
  }

  const strongest = [...byCountry].sort(
    (a, b) => b.complianceScore - a.complianceScore
  )[0];
  const highestRisk = [...byCountry].sort(
    (a, b) => b.criticalOpen - a.criticalOpen
  )[0];

  const withNext = byCountry
    .filter(
      (c): c is ComplianceStatus & {
        nextDeadline: NonNullable<ComplianceStatus['nextDeadline']>;
      } => c.nextDeadline !== undefined
    )
    .sort((a, b) => a.nextDeadline.daysUntil - b.nextDeadline.daysUntil);
  const topDeadline = withNext[0]?.nextDeadline;

  const parts: string[] = [];
  parts.push(
    `Across ${totalJurisdictions} jurisdictions, ${criticalOpen} critical compliance deadline${criticalOpen === 1 ? '' : 's'} require${criticalOpen === 1 ? 's' : ''} action within 30 days.`
  );
  parts.push(
    `Strongest compliance posture: ${strongest.countryName} (score ${strongest.complianceScore}).`
  );
  if (highestRisk && highestRisk.criticalOpen > 0) {
    parts.push(
      `Highest-risk: ${highestRisk.countryName} with ${highestRisk.criticalOpen} critical deadline${highestRisk.criticalOpen === 1 ? '' : 's'}.`
    );
  }
  if (topDeadline) {
    parts.push(
      `Oracle recommends prioritizing ${topDeadline.title} (due in ${topDeadline.daysUntil} day${topDeadline.daysUntil === 1 ? '' : 's'}).`
    );
  }
  return parts.join(' ');
}

// ─── Public: Global upcoming-deadline feed ───────────────────────────────────

/**
 * Return every country×deadline whose next concrete due date falls within
 * `daysAhead` days from today (default 30).
 *
 * Iterates all active deadlines globally, computes each one's next due date,
 * filters to those with `0 ≤ daysUntil ≤ daysAhead` (excluding continuous /
 * entity-specific rules), and returns the result sorted ascending by
 * `daysUntil` so the most urgent deadlines appear first. Cached 5 min.
 */
export async function getUpcomingDeadlinesGlobally(
  daysAhead = 30
): Promise<UpcomingDeadlineItem[]> {
  const cacheKey = buildKey('upcoming-deadlines-global', { days: daysAhead });
  const cached = cacheGet<UpcomingDeadlineItem[]>(cacheKey);
  if (cached) return cached.value;

  const all = await getAllComplianceDeadlines();
  const refDate = todayISO();

  const items: UpcomingDeadlineItem[] = [];
  for (const d of all) {
    const due = computeNextDueDate(d.dueDateRule, refDate);
    const days = daysUntil(due, refDate);
    if (due !== null && days !== null && days >= 0 && days <= daysAhead) {
      const country = getCountry(d.countryIso);
      items.push({
        countryIso: d.countryIso,
        countryName: country?.name ?? d.countryIso,
        title: d.title,
        regulationType: d.regulationType,
        riskLevel: d.riskLevel,
        dueDate: due,
        daysUntil: days,
        authority: d.authority,
      });
    }
  }

  items.sort((a, b) => (a.daysUntil as number) - (b.daysUntil as number));

  cacheSet(cacheKey, items, FIVE_MIN_TTL);
  return items;
}
