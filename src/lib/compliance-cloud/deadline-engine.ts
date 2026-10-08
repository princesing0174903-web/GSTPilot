// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — GLOBAL COMPLIANCE CLOUD™ — Subsystem 2: DEADLINE ENGINE™
// Reuses getUpcomingDeadlinesGlobally + getGlobalComplianceReport from the
// Global Enterprise compliance layer; adds per-country + calendar views + Oracle
// executive notification hook. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  getUpcomingDeadlinesGlobally,
  getAllComplianceDeadlines,
  computeNextDueDate,
  daysUntil,
} from '@/lib/global-enterprise/compliance';
import { getCountry } from '@/lib/global-enterprise/registry';
import { todayISO } from '@/lib/global-enterprise/currency';
import type { ComplianceDeadlineItem } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayDate(): Date {
  return new Date(todayISO() + 'T00:00:00Z');
}

// Convert canonical ComplianceDeadlineRecord (from global-enterprise) to the
// ComplianceCloud's typed ComplianceDeadlineItem shape (with optional computed
// due-date info preserved).
async function loadAllItems(): Promise<ComplianceDeadlineItem[]> {
  const all = await getAllComplianceDeadlines();
  const ref = todayISO();
  return all.map((d, idx) => {
    const next = computeNextDueDate(d.dueDateRule, ref);
    const days = daysUntil(next, ref);
    return {
      id: `${d.countryIso}-${d.regulationType}-${idx}-${d.title.replace(/\s+/g, '_').slice(0, 32)}`,
      countryIso: d.countryIso,
      regulationType: d.regulationType,
      title: d.title,
      description: d.description,
      frequency: d.frequency,
      dueDateRule: d.dueDateRule,
      penaltyLate: d.penaltyLate,
      authority: d.authority,
      riskLevel: d.riskLevel,
      isActive: d.isActive,
      nextDueDate: next ?? undefined,
      daysUntil: days,
    };
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getGlobalDeadlines(daysAhead = 30): Promise<ComplianceDeadlineItem[]> {
  const upcoming = await getUpcomingDeadlinesGlobally(daysAhead);
  const items: ComplianceDeadlineItem[] = upcoming.map((u, idx) => ({
    id: `${u.countryIso}-${u.regulationType}-${idx}-${u.title.replace(/\s+/g, '_').slice(0, 32)}`,
    countryIso: u.countryIso,
    regulationType: u.regulationType,
    title: u.title,
    frequency: 'one_time', // upcoming feed is concrete instances; frequency unknown
    dueDateRule: '',
    penaltyLate: undefined,
    authority: u.authority,
    riskLevel: u.riskLevel,
    isActive: true,
    nextDueDate: u.dueDate ?? undefined,
    daysUntil: u.daysUntil,
  }));
  return items;
}

export async function getDeadlinesByCountry(countryIso: string): Promise<ComplianceDeadlineItem[]> {
  const iso = countryIso.toUpperCase();
  const all = await loadAllItems();
  return all.filter((d) => d.countryIso === iso);
}

export interface DeadlineCalendarEntry {
  date: string;
  items: ComplianceDeadlineItem[];
}

export async function getDeadlineCalendar(monthsAhead = 3): Promise<DeadlineCalendarEntry[]> {
  const all = await loadAllItems();
  const today = todayDate();
  const horizonEnd = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth() + monthsAhead,
    today.getUTCDate(),
  ));

  const byDate = new Map<string, ComplianceDeadlineItem[]>();
  for (const item of all) {
    if (!item.nextDueDate) continue;
    const due = new Date(item.nextDueDate + 'T00:00:00Z');
    if (isNaN(due.getTime())) continue;
    if (due.getTime() < today.getTime() || due.getTime() > horizonEnd.getTime()) continue;
    const dateKey = item.nextDueDate;
    const list = byDate.get(dateKey) ?? [];
    list.push(item);
    byDate.set(dateKey, list);
  }

  return Array.from(byDate.entries())
    .map(([date, items]) => ({ date, items }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Simulated Oracle executive reminder. Returns true to indicate the reminder
 * was queued into the Oracle notification stream.
 */
export function notifyExecutives(deadline: ComplianceDeadlineItem): boolean {
  // Oracle reminder channel — currently a no-op flag; future integration point.
  void deadline;
  return true;
}

// Resolve country display name from registry (fallback to ISO code).
export function getCountryName(countryIso: string): string {
  return getCountry(countryIso.toUpperCase())?.name ?? countryIso.toUpperCase();
}

export { todayDate };
