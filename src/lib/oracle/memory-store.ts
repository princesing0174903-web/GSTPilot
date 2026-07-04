// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Long-Term Memory Store
//
// Permanent, cross-session memory of: firm profile, GSTIN, industry, user
// preferences, reports generated, previous conversations (topics), connected
// services, and business history. Backed by the OracleMemory Prisma table.
//
// Two responsibilities:
//   1. loadMemorySnapshot() — read everything into a compact object injected
//      into the Oracle system prompt on every chat request.
//   2. extractAndPersistFacts() — scan the latest user/oracle exchange and
//      persist any durable facts (GSTIN, industry, preferences, …) so Oracle
//      "remembers" them forever.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemoryCategory =
  | 'firm'
  | 'gst'
  | 'industry'
  | 'preference'
  | 'report'
  | 'connection'
  | 'history'
  | 'fact';

export interface MemorySnapshot {
  firmName?: string;
  userName?: string;
  gstin?: string;
  industry?: string;
  preferredLanguage?: string;
  connectedServices: string[];
  reportsGenerated: string[];
  recentTopics: string[];
  facts: { category: string; key: string; value: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gstinPattern(): RegExp {
  return /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/gi;
}

/** Extract a GSTIN from free text. */
export function extractGstin(text: string): string | undefined {
  const m = text.match(gstinPattern());
  return m ? m[0].toUpperCase() : undefined;
}

/** Detect industry from keywords. */
export function detectIndustry(text: string): string | undefined {
  const t = text.toLowerCase();
  const map: { pattern: RegExp; industry: string }[] = [
    { pattern: /\b(manufactur|factory|production)\b/, industry: 'Manufacturing' },
    { pattern: /\b(trading|trader|wholesale|retail|distributor)\b/, industry: 'Trading' },
    { pattern: /\b(software|saas|it services|technology|app development)\b/, industry: 'IT / Software' },
    { pattern: /\b(restaurant|food|catering|fssai)\b/, industry: 'Food & Beverage' },
    { pattern: /\b(construction|contractor|real estate|builder)\b/, industry: 'Construction & Real Estate' },
    { pattern: /\b(consult|professional services|ca firm|advocate)\b/, industry: 'Professional Services' },
    { pattern: /\b(export|import)\b/, industry: 'Import-Export' },
    { pattern: /\b(transport|logistics|freight|warehouse)\b/, industry: 'Logistics & Transport' },
    { pattern: /\b(textile|garment|apparel)\b/, industry: 'Textiles' },
    { pattern: /\b(pharma|medical|hospital|clinic)\b/, industry: 'Healthcare & Pharma' },
    { pattern: /\b(agriculture|farm|agri)\b/, industry: 'Agriculture' },
    { pattern: /\b(e-commerce|ecommerce|online seller)\b/, industry: 'E-commerce' },
  ];
  for (const { pattern, industry } of map) {
    if (pattern.test(t)) return industry;
  }
  return undefined;
}

/** Detect explicit preference statements (e.g. "I prefer Hindi", "reply in Tamil"). */
export function detectLanguagePreference(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\b(prefer|reply|respond|answer)\b.*\b(hindi|devanagari)\b/.test(t)) return 'hindi';
  if (/\b(prefer|reply|respond|answer)\b.*\b(tamil)\b/.test(t)) return 'tamil';
  if (/\b(prefer|reply|respond|answer)\b.*\b(telugu)\b/.test(t)) return 'telugu';
  if (/\b(prefer|reply|respond|answer)\b.*\b(bengali)\b/.test(t)) return 'bengali';
  if (/\b(prefer|reply|respond|answer)\b.*\b(gujarati)\b/.test(t)) return 'gujarati';
  if (/\b(prefer|reply|respond|answer)\b.*\b(marathi)\b/.test(t)) return 'marathi';
  if (/\b(prefer|reply|respond|answer)\b.*\b(punjabi)\b/.test(t)) return 'punjabi';
  if (/\b(prefer|reply|respond|answer)\b.*\b(english)\b/.test(t)) return 'english';
  return undefined;
}

// ─── Public: read the full memory snapshot ────────────────────────────────────

export async function loadMemorySnapshot(): Promise<MemorySnapshot> {
  const rows = await db.oracleMemory.findMany({
    orderBy: { updatedAt: 'asc' },
  });

  const facts = rows.map((r) => ({ category: r.category, key: r.key, value: r.value }));
  const get = (cat: MemoryCategory, key: string) =>
    rows.find((r) => r.category === cat && r.key === key)?.value;

  return {
    firmName: get('firm', 'name'),
    userName: get('preference', 'userName'),
    gstin: get('gst', 'gstin'),
    industry: get('industry', 'industry'),
    preferredLanguage: get('preference', 'preferredLanguage'),
    connectedServices: rows
      .filter((r) => r.category === 'connection')
      .map((r) => r.key),
    reportsGenerated: rows
      .filter((r) => r.category === 'report')
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((r) => r.value),
    recentTopics: rows
      .filter((r) => r.category === 'history')
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 6)
      .map((r) => r.value),
    facts,
  };
}

// ─── Public: persist a single fact (upsert) ───────────────────────────────────

export async function rememberFact(
  category: MemoryCategory,
  key: string,
  value: string,
  source: 'user' | 'oracle_inferred' | 'system' = 'oracle_inferred',
  confidence = 1,
): Promise<void> {
  if (!value || !value.trim()) return;
  await db.oracleMemory.upsert({
    where: { category_key: { category, key } },
    create: { category, key, value: value.trim(), source, confidence },
    update: { value: value.trim(), source, confidence },
  });
}

// ─── Public: scan an exchange and persist durable facts ───────────────────────

export interface ExchangeContext {
  userMessage: string;
  oracleResponse?: string;
  /** From the workspace (localStorage) — userName/firmName if known. */
  knownUserName?: string;
  knownFirmName?: string;
  knownGstin?: string;
}

/**
 * Scan a user/oracle exchange and persist any durable facts worth remembering
 * permanently: GSTIN, industry, language preference, firm name, user name.
 * Also pushes the user's topic into the rolling "history" list.
 */
export async function extractAndPersistFacts(ctx: ExchangeContext): Promise<void> {
  const text = `${ctx.userMessage ?? ''}\n${ctx.oracleResponse ?? ''}`;

  const tasks: Promise<void>[] = [];

  // GSTIN — anywhere in the exchange.
  const gstin = extractGstin(text) ?? ctx.knownGstin;
  if (gstin) tasks.push(rememberFact('gst', 'gstin', gstin, 'user', 1));

  // Industry.
  const industry = detectIndustry(text);
  if (industry) tasks.push(rememberFact('industry', 'industry', industry, 'oracle_inferred', 0.85));

  // Preferred language.
  const lang = detectLanguagePreference(ctx.userMessage ?? '');
  if (lang) tasks.push(rememberFact('preference', 'preferredLanguage', lang, 'user', 1));

  // User name / firm name (from workspace, if provided).
  if (ctx.knownUserName) tasks.push(rememberFact('preference', 'userName', ctx.knownUserName, 'user', 1));
  if (ctx.knownFirmName) tasks.push(rememberFact('firm', 'name', ctx.knownFirmName, 'user', 1));

  // Rolling topic history — keep last 12, dedupe.
  const topic = (ctx.userMessage ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (topic.length >= 4) {
    tasks.push(
      (async () => {
        const key = `topic-${Date.now()}`;
        await rememberFact('history', key, topic, 'user', 1);
        // Trim to last 12 topics.
        const history = await db.oracleMemory.findMany({
          where: { category: 'history' },
          orderBy: { updatedAt: 'desc' },
        });
        if (history.length > 12) {
          const stale = history.slice(12);
          if (stale.length > 0) {
            await db.oracleMemory.deleteMany({
              where: { id: { in: stale.map((r) => r.id) } },
            });
          }
        }
      })(),
    );
  }

  await Promise.allSettled(tasks);
}

// ─── Public: render the memory snapshot as a system-prompt block ──────────────

export function renderMemoryBlock(mem: MemorySnapshot): string {
  const lines: string[] = [];
  let headerAdded = false;
  const ensureHeader = () => {
    if (!headerAdded) {
      lines.push('## LONG-TERM MEMORY (remembered across sessions)');
      headerAdded = true;
    }
  };

  const bits: string[] = [];
  if (mem.userName) bits.push(`User name: ${mem.userName}`);
  if (mem.firmName) bits.push(`Firm: ${mem.firmName}`);
  if (mem.gstin) bits.push(`GSTIN: ${mem.gstin}`);
  if (mem.industry) bits.push(`Industry: ${mem.industry}`);
  if (mem.preferredLanguage) bits.push(`Preferred reply language: ${mem.preferredLanguage}`);
  if (mem.connectedServices.length > 0)
    bits.push(`Connected services: ${mem.connectedServices.join(', ')}`);

  if (bits.length > 0) {
    ensureHeader();
    for (const b of bits) lines.push(`- ${b}`);
  }

  if (mem.reportsGenerated.length > 0) {
    ensureHeader();
    lines.push(`- Reports previously generated: ${mem.reportsGenerated.slice(0, 5).join('; ')}`);
  }

  if (mem.recentTopics.length > 0) {
    ensureHeader();
    lines.push(`- Recently discussed topics: ${mem.recentTopics.join(' · ')}`);
  }

  return lines.join('\n');
}
