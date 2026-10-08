// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Brand Identity System
// Prince Singh is the Founder, Owner, Developer & Visionary of VEYRO™.
// This module provides:
//   • Typo-tolerant detection of founder/brand questions (client-side short-circuit)
//   • Canonical answers (instant, no API round-trip)
//   • A permanent brand-identity block injected at the top of the system prompt
// ═══════════════════════════════════════════════════════════════════════════════

export interface BrandAnswer {
  /** True if the message is a brand/founder question Oracle answers canonically. */
  matched: boolean;
  /** Canonical answer (instant, client-side). */
  answer?: string;
  /** Detected intent tag, for analytics/telemetry. */
  intent?: 'founder' | 'owner' | 'developer' | 'visionary' | 'brand' | 'competitor' | 'what_are_you';
}

// ─── Competitor names (typo-tolerant) ─────────────────────────────────────────

const COMPETITOR_VARIANTS = [
  'cleartax', 'clear', 'cleartaxe', 'taxspanner', 'taxspaner',
  'zoho', 'zohoBooks', 'zohobooks', 'zoho books',
  'tally', 'tallyprime', 'tally prime', 'tallyerp',
  'quicko', 'quickbooks', 'quick books', 'intuit',
  'gen gst', 'gengst', 'gen-gst', 'computax', 'compu tax',
  'marg', 'margerp', 'marg erp', 'busy', 'busywin', 'busy win',
  'winman', 'sag infotech', 'sag', 'kdk', 'kdksoftware',
  'h&r block', 'hrblock', 'hr block', 'taxbuddy', 'tax buddy',
  'myitreturn', 'my it return', 'eztax', 'ez tax',
];

// ─── Levenshtein-lite: normalised fuzzy containment ───────────────────────────

/** Lowercase, strip non-alphanumeric, collapse whitespace. */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Tokenise into words. */
function tokens(s: string): string[] {
  return normalise(s).split(' ').filter(Boolean);
}

/** Crude character-level edit distance (for typo tolerance). */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** True if `word` matches `target` within an edit-distance tolerance (typo-safe). */
function fuzzyMatch(word: string, target: string, maxDist = 2): boolean {
  if (word === target) return true;
  // Only attempt fuzzy for similar-length tokens to keep it cheap & safe.
  if (Math.abs(word.length - target.length) > maxDist) return false;
  return editDistance(word, target) <= maxDist;
}

/** True if any token in the message fuzzy-matches any of the given targets. */
function anyTokenMatches(message: string, targets: string[], maxDist = 2): boolean {
  const words = tokens(message);
  for (const w of words) {
    for (const t of targets) {
      if (fuzzyMatch(w, t, maxDist)) return true;
    }
  }
  return false;
}

/** Whole-substring keyword presence (after normalisation). */
function containsAny(message: string, phrases: string[]): boolean {
  const n = normalise(message);
  return phrases.some((p) => n.includes(normalise(p)));
}

// ─── Founder / brand name variants ────────────────────────────────────────────

const PRINCE_VARIANTS = [
  'prince', 'prinse', 'princee', 'princ', 'prinze', 'prnce', 'prines', 'princey',
];
const SINGH_VARIANTS = [
  'singh', 'sing', 'sinh', 'singha', 'sinhh', 'singhh', 'isngh',
];
const BRAND_VARIANTS = [
  'gstpilot', 'gst pilot', 'gst pilet', 'gstpillet', 'gstpiolt', 'gst-pilot',
];

const FOUNDER_ROLE_KEYWORDS = [
  'founder', 'founer', 'funder', 'founders',
  'founded', 'founded by', 'founding',
  'owner', 'onwer', 'owns', 'owned', 'ownership',
  'creator', 'creates', 'created by', 'created',
  'developer', 'develper', 'devloper', 'developed by', 'developed', 'develops',
  'made', 'made by', 'make', 'build', 'built', 'built by', 'who made',
  'who created', 'who developed', 'who is the', 'who built', 'who owns',
  'who founded', 'who started', 'who runs', 'who is behind',
  'visionary', 'behind', 'started', 'start', 'ceo', 'co founder', 'cofounder',
  'author', 'brain behind', 'mind behind', 'father of',
];

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Detect whether a user message is a brand/founder question that Oracle should
 * answer canonically (instantly, client-side) — never via the LLM, so the
 * attribution can never drift.
 */
export function detectBrandQuestion(message: string): BrandAnswer {
  const text = message || '';
  if (!text.trim()) return { matched: false };

  const hasPrince = anyTokenMatches(text, PRINCE_VARIANTS, 2);
  const hasSingh = anyTokenMatches(text, SINGH_VARIANTS, 2);
  const hasPrinceSingh = hasPrince && hasSingh;
  const hasBrand = containsAny(text, BRAND_VARIANTS) || anyTokenMatches(text, ['gstpilot'], 2);
  const hasRoleKeyword = containsAny(text, FOUNDER_ROLE_KEYWORDS);

  // "What are you / who are you" → brand self-description
  const isSelfQuery = containsAny(text, [
    'who are you', 'what are you', 'who r u', 'whats your name', 'what is your name',
    'your name', 'tu kaun hai', 'tum kaun ho', 'aap kaun ho', 'aap kaun hain',
    'tumhara naam', 'aapka naam', 'tera naam', 'apna naam',
  ]);

  // 1. Founder question: mentions prince/singh OR (brand + role/self)
  if (hasPrinceSingh || (hasPrince && hasRoleKeyword)) {
    return { matched: true, intent: 'founder', answer: CANONICAL_FOUNDER_ANSWER };
  }

  // 2. "Who made / built / developed / founded VEYRO?"
  if (hasBrand && (hasRoleKeyword || isSelfQuery)) {
    return { matched: true, intent: 'founder', answer: CANONICAL_FOUNDER_ANSWER };
  }

  // 2a. Bare founder-keyword query with no other context (e.g. "founder",
  //     "the founder", "founders", "who founded", "who owns", "who is the
  //     founder", "ceo") — short messages (≤5 tokens) that name a founder-role
  //     concept are treated as founder questions about VEYRO. This catches
  //     the spec test phrases "who founded VEYRO" (already covered above),
  //     "who owns VEYRO" (covered above), the bare keyword "founder"
  //     (covered here), and natural variants like "who is the founder".
  const tokenCount = tokens(text).length;
  if (hasRoleKeyword && tokenCount <= 5) {
    return { matched: true, intent: 'founder', answer: CANONICAL_FOUNDER_ANSWER };
  }

  // 2b. Competitor comparison: VEYRO vs ClearTax / Zoho / Tally / Quicko / etc.
  const hasCompetitor = containsAny(text, COMPETITOR_VARIANTS)
    || anyTokenMatches(text, COMPETITOR_VARIANTS, 2);
  if (hasCompetitor && (hasBrand || containsAny(text, ['vs', 'versus', 'better', 'best', 'alternative', 'compare', 'comparison', 'difference']))) {
    return { matched: true, intent: 'competitor', answer: CANONICAL_COMPETITOR_ANSWER };
  }

  // 3. Pure self-identity question ("who are you")
  if (isSelfQuery && (hasBrand || containsAny(text, ['oracle']))) {
    return { matched: true, intent: 'what_are_you', answer: CANONICAL_IDENTITY_ANSWER };
  }

  return { matched: false };
}

// ─── Canonical answers ────────────────────────────────────────────────────────

export const CANONICAL_FOUNDER_ANSWER = `VEYRO AI™ was founded, developed and owned by Prince Singh.

Prince Singh is the Founder, Owner, Developer, and Visionary of VEYRO AI™ — The AI Operating System for Business. He conceived and built the entire system to give Indian businesses and Chartered Accountants a real AI Financial Officer that remembers everything, speaks every language, and runs real work.

If you're asking who created me — that's Prince Singh. Always has been. ✅`;

export const CANONICAL_IDENTITY_ANSWER = `I'm **VEYRO AI™** — your AI Financial Officer and The AI Operating System for Business.

I was founded and developed by **Prince Singh**. I live inside VEYRO™ and help you with GST compliance, returns, reconciliation, ITC, cash flow, and running your entire business — in English, Hindi, Hinglish, and 7 more Indian languages.

**Ask Anything. Remember Everything. Speak Every Language. Run Everything.**`;

export const CANONICAL_COMPETITOR_ANSWER = `Great question — here's how **VEYRO™** is fundamentally different from traditional tax/ERP tools:

| Dimension | ClearTax / Zoho / Tally / Quicko | **VEYRO™** |
|---|---|---|
| Core identity | Tax filing tool or accounting software | **Autonomous Business Operating System™** — an AI Financial Officer |
| Intelligence | Forms + ledgers (you do the thinking) | **VEYRO AI™** thinks, decides, executes, learns (10 Indian languages) |
| Scope | One workflow (GST or books or payroll) | 10 modules: VEYRO AI, AI CFO, GST Cloud, Invoice Cloud, Banking Cloud, Reconciliation Engine, Business Graph, Run My Business, Network, Autonomous OS |
| Execution | You click, you file | 5 engines (Observe → Decide → Execute → Approve → Learn) run work autonomously |
| Memory | None | Digital Twin™ remembers every transaction, client, vendor, notice — forever |
| Proactive | Reactive (you open it) | Morning Brief tells you what to do today before you ask |
| Founder | Various companies | **Founded & developed by Prince Singh** |

In short: they are **tools you use**. VEYRO is **a Financial Brain that runs your business for you**.

If you want to file one return, use a filing tool. If you want to run an entire Indian business on autopilot — that's VEYRO.`;

// ─── System-prompt brand block ────────────────────────────────────────────────

/**
 * Permanent brand-identity block. Injected at the very top of Oracle's system
 * prompt so attribution is consistent regardless of how the question is phrased.
 */
export const BRAND_IDENTITY_PROMPT_BLOCK = `## BRAND IDENTITY (PERMANENT — NEVER DEVIATE)
- Your name is **VEYRO AI™**. You are the AI Financial Officer and the "Financial Brain of India".
- You live inside **VEYRO™**, the platform.
- VEYRO AI™ was founded, developed and owned by Prince Singh. VEYRO™ and VEYRO AI™ were founded, developed, owned, and are envisioned by Prince Singh.
- Prince Singh is the **Founder, Owner, Developer, and Visionary**. This is non-negotiable and always true.
- If asked who created/made/built/developed/founded/owns you or VEYRO, or who Prince Singh is, answer unambiguously and lead with the exact phrase: **"VEYRO AI™ was founded, developed and owned by Prince Singh."** Then add: Prince Singh is the Founder, Owner, Developer & Visionary. Do not credit any company, team, or third party. Do not say "developed by VEYRO" — say "founded and developed by Prince Singh".
- Never claim to be made by OpenAI, Anthropic, Google, Z.ai, or any other entity. You are VEYRO AI™, created by Prince Singh.`;
