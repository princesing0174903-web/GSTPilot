// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Intelligence Core™ — Explainable AI
// Every Oracle recommendation answers the seven executive questions:
//   Why?  How?  Based on what?  What if ignored?  What happens next?
//   Expected benefit?  Risk?  Confidence?
// No black boxes. Every decision is auditable and defensible.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { AIModuleId, Explanation } from './types';

// ─── Text Helpers ───────────────────────────────────────────────────────────
// We don't ship an LLM call here — the reasoning record itself was authored by
// the LLM through the orchestrator. We only *extract* and *structure*.

/** Split a body of text into sentences (best-effort, English-only). */
function splitSentences(text: string): string[] {
  if (!text) return [];
  // Replace newlines with spaces, then match sentence-like runs ending in
  // . ! or ?. Lookbehind assertions require ES2018+, but the project targets
  // ES2017 — so we use a global match instead of split-with-lookbehind.
  const normalized = text.replace(/\n+/g, ' ').trim();
  if (!normalized) return [];
  const parts = normalized.match(/[^.!?]+[.!?]+/g);
  if (!parts) return [normalized];
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Take the first N sentences of a text block, joined with spaces. */
function firstSentences(text: string, n: number): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return text.trim();
  return sentences.slice(0, n).join(' ');
}

function firstSentence(text: string): string {
  const sentences = splitSentences(text);
  return sentences.length > 0 ? sentences[0] : text.trim();
}

// ─── Reasoning Loader ───────────────────────────────────────────────────────

interface ReasoningRow {
  id: string;
  request: string;
  businessReasoning: string;
  financialReasoning: string;
  riskReasoning: string;
  complianceReasoning: string;
  operationalReasoning: string;
  legalReasoning: string;
  historicalEvidence: string;
  supportingData: string;
  confidence: number;
  alternatives: string;
  expectedRoi: string | null;
  rollbackStrategy: string;
  finalAnswer: string;
  modelUsed: string;
  executivesConsulted: string;
}

async function loadReasoning(
  reasoningId: string,
): Promise<ReasoningRow | null> {
  try {
    const row = (await db.oracleReasoning.findUnique({
      where: { id: reasoningId },
    })) as unknown as ReasoningRow | null;
    return row ?? null;
  } catch (e) {
    console.warn('[Oracle Explainable] failed to load reasoning:', e);
    return null;
  }
}

function safeParseJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ─── Explanation Builder ────────────────────────────────────────────────────

/**
 * Build a structured Explanation for an Oracle reasoning record.
 * Returns null if the reasoning record does not exist.
 */
export async function explain(
  reasoningId: string,
): Promise<Explanation | null> {
  const row = await loadReasoning(reasoningId);
  if (!row) return null;

  // ── WHY ── derived from businessReasoning (first 1-2 sentences).
  const why =
    firstSentences(row.businessReasoning, 2) ||
    row.request ||
    'No business reasoning was recorded.';

  // ── HOW ── derived from operationalReasoning + finalAnswer execution approach.
  const operationalPart = firstSentences(row.operationalReasoning, 2);
  const finalAnswerPart = firstSentence(row.finalAnswer);
  const how =
    [operationalPart, finalAnswerPart].filter(Boolean).join(' → ') ||
    'No execution approach was recorded.';

  // ── BASED ON ── array of contributing data sources.
  const supportingData = safeParseJSON<Record<string, unknown>>(
    row.supportingData,
    {},
  );
  const supportingKeys = Object.keys(supportingData).map(
    (k) => `supportingData.${k}`,
  );
  const executivesConsulted = safeParseJSON<AIModuleId[]>(
    row.executivesConsulted,
    [],
  );
  const moduleNames = executivesConsulted.length > 0 ? executivesConsulted : [];
  const basedOn: string[] = [
    ...new Set<string>([...moduleNames, ...supportingKeys]),
  ];
  if (basedOn.length === 0) {
    basedOn.push('historicalEvidence');
  }
  // If historicalEvidence has content, surface it as an explicit source.
  if (row.historicalEvidence && row.historicalEvidence.trim().length > 0) {
    basedOn.push('historicalEvidence');
  }

  // ── WHAT IF IGNORED ── first risk sentence.
  const firstRisk = firstSentence(row.riskReasoning);
  const whatIfIgnored = firstRisk
    ? `If ignored: ${firstRisk}`
    : 'If ignored: no material risk was identified in the reasoning record.';

  // ── WHAT HAPPENS NEXT ── next-step sentence from finalAnswer.
  // Heuristic: the next-step sentence usually contains an action verb or a
  // temporal marker. We pick the first sentence that looks like a next step;
  // otherwise we fall back to the last sentence.
  const finalSentences = splitSentences(row.finalAnswer);
  const nextStepRegex =
    /\b(next|then|after|proceed|execute|schedule|follow up|deploy|launch|approve|fund|hire|contact|file|submit|pay|review)\b/i;
  const nextStepSentence =
    finalSentences.find((s) => nextStepRegex.test(s)) ??
    finalSentences[finalSentences.length - 1];
  const whatHappensNext = nextStepSentence
    ? nextStepSentence
    : 'No explicit next step was recorded.';

  // ── EXPECTED BENEFIT ── from expectedRoi, or fallback message.
  const expectedBenefit =
    row.expectedRoi && row.expectedRoi.trim().length > 0
      ? row.expectedRoi
      : 'See ROI analysis above';

  // ── RISK ── top 1 risk sentence.
  const risk = firstRisk || 'No risk was identified in the reasoning record.';

  // ── CONFIDENCE ── from the confidence field (clamped 0-100).
  const confidence = Math.max(0, Math.min(100, row.confidence ?? 0));

  return {
    why,
    how,
    basedOn,
    whatIfIgnored,
    whatHappensNext,
    expectedBenefit,
    risk,
    confidence,
  };
}

// ─── Batch Helper ───────────────────────────────────────────────────────────

/** Build explanations for multiple reasoning records. Skips missing ids. */
export async function explainBatch(
  reasoningIds: string[],
): Promise<Explanation[]> {
  const results: Explanation[] = [];
  for (const id of reasoningIds) {
    try {
      const explanation = await explain(id);
      if (explanation) results.push(explanation);
    } catch (e) {
      console.warn(
        `[Oracle Explainable] explainBatch failed for ${id}:`,
        e,
      );
    }
  }
  return results;
}

// ─── Display Formatter ──────────────────────────────────────────────────────

export interface ExplanationSection {
  label: string;
  content: string;
}

export interface ExplanationDisplay {
  title: string;
  sections: ExplanationSection[];
}

/** Produce a structured object the UI can render directly. */
export function formatExplanationForDisplay(
  expl: Explanation,
): ExplanationDisplay {
  const confidenceLabel =
    expl.confidence >= 85
      ? 'High'
      : expl.confidence >= 70
        ? 'Good'
        : expl.confidence >= 60
          ? 'Moderate'
          : 'Low';

  return {
    title: 'Why Oracle recommends this',
    sections: [
      { label: 'Why', content: expl.why },
      { label: 'How', content: expl.how },
      {
        label: 'Based on',
        content:
          expl.basedOn.length > 0
            ? expl.basedOn.map((s) => `• ${s}`).join('\n')
            : 'No data sources were recorded.',
      },
      { label: 'What if ignored', content: expl.whatIfIgnored },
      { label: 'What happens next', content: expl.whatHappensNext },
      { label: 'Expected benefit', content: expl.expectedBenefit },
      { label: 'Risk', content: expl.risk },
      {
        label: 'Confidence',
        content: `${expl.confidence}% — ${confidenceLabel}`,
      },
    ],
  };
}
