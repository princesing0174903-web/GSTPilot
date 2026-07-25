'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Contextual Follow-up Suggestions
//
// After every Oracle answer, generate 3–5 contextual follow-up questions.
// Priority:
//   1. Smart follow-ups from the API (turn.smartFollowUps) — structured, with rationale
//   2. Legacy string follow-ups (turn.followUps)
//   3. Client-side generated suggestions based on the answer content + last user prompt
//
// One click sends the follow-up as a new message.
//
// Examples:
//   "Explain this further"
//   "Generate a report"
//   "Find mistakes"
//   "Show recommendations"
//   "Compare last month"
//
// Memoized for streaming performance.
// ═══════════════════════════════════════════════════════════════════════════════

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Sparkles } from 'lucide-react';
import type { OracleSmartFollowUp } from '@/lib/oracle-conversations';

interface OracleFollowUpsProps {
  /** Structured follow-ups from the API (highest priority). */
  smartFollowUps?: OracleSmartFollowUp[];
  /** Legacy string[] follow-ups. */
  followUps?: string[];
  /** The Oracle answer text — used to generate client-side suggestions if no API follow-ups. */
  answerText?: string;
  /** The last user prompt — used to generate contextual suggestions. */
  lastUserPrompt?: string;
  /** Called when a follow-up is clicked. */
  onPick: (prompt: string) => void;
  /** Disable all chips (e.g. while streaming). */
  disabled?: boolean;
}

// ─── Client-side contextual suggestion generator ─────────────────────────────
// Used as a fallback when the API doesn't return follow-ups. Generates 3–5
// suggestions that adapt to the content of the answer + the user's question.

function generateContextualSuggestions(answer: string, userPrompt: string): string[] {
  const suggestions: string[] = [];
  const a = (answer || '').toLowerCase();
  const u = (userPrompt || '').toLowerCase();

  const isGst = /\bgst\b|gstr|itc|tax liability|tax credit|return/.test(u + a);
  const isCashflow = /cash\s*flow|runway|liquidity|burn|forecast/.test(u + a);
  const isInvoice = /invoice|billed|billing/.test(u + a);
  const isVendor = /vendor|supplier|payable/.test(u + a);
  const isCustomer = /customer|client|receivable/.test(u + a);
  const isCompliance = /compliance|notice|deadline|penalty|audit/.test(u + a);
  const isRevenue = /revenue|sales|top.?line/.test(u + a);
  const isProfit = /profit|margin|bottom.?line|ebitda/.test(u + a);
  const isRisk = /risk|fraud|exposure/.test(u + a);
  const hasNumbers = /\d/.test(a);
  const hasTable = /\|.*\|/.test(a) || /table/i.test(a);

  // Always include "Explain further"
  suggestions.push('Explain this further');

  // Content-aware suggestions
  if (isGst) {
    suggestions.push('Show GST filing deadlines');
    suggestions.push('Compare with last month');
  }
  if (isCashflow) {
    suggestions.push('What improves my runway?');
    suggestions.push('Forecast next quarter');
  }
  if (isInvoice) {
    suggestions.push('List overdue invoices');
    suggestions.push('Flag invoice anomalies');
  }
  if (isVendor) {
    suggestions.push('Which vendor has the highest risk?');
    suggestions.push('Show top 5 vendors by spend');
  }
  if (isCustomer) {
    suggestions.push('Which customers are overdue?');
    suggestions.push('Show collection priorities');
  }
  if (isCompliance) {
    suggestions.push('What penalties am I exposed to?');
    suggestions.push('Generate a compliance checklist');
  }
  if (isRevenue) suggestions.push('Compare revenue to last month');
  if (isProfit) suggestions.push('How can I improve margins?');
  if (isRisk) suggestions.push('What are the top 3 risks?');

  // Generic high-value suggestions
  if (hasNumbers && !suggestions.some((s) => s.includes('report'))) {
    suggestions.push('Generate a report');
  }
  if (hasTable) suggestions.push('Find mistakes in this data');
  if (!suggestions.some((s) => s.includes('recommend'))) {
    suggestions.push('Show recommendations');
  }

  // De-duplicate + cap at 5
  const seen = new Set<string>();
  const unique = suggestions.filter((s) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.slice(0, 5);
}

function OracleFollowUpsImpl({
  smartFollowUps,
  followUps,
  answerText,
  lastUserPrompt,
  onPick,
  disabled = false,
}: OracleFollowUpsProps) {
  // Resolve the final list of suggestions (smart > legacy > generated)
  const suggestions = useMemo(() => {
    if (smartFollowUps && smartFollowUps.length > 0) {
      return smartFollowUps.map((f) => ({ id: f.id, question: f.question, rationale: f.rationale }));
    }
    if (followUps && followUps.length > 0) {
      return followUps.map((q, i) => ({ id: `legacy-${i}`, question: q, rationale: undefined }));
    }
    return generateContextualSuggestions(answerText || '', lastUserPrompt || '').map((q, i) => ({
      id: `gen-${i}`,
      question: q,
      rationale: undefined,
    }));
  }, [smartFollowUps, followUps, answerText, lastUserPrompt]);

  if (suggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mt-3"
    >
      <div className="mb-1.5 flex items-center gap-1.5 px-1">
        <Sparkles className="h-3 w-3 text-amber-400/70" />
        <span className="text-[10.5px] font-medium uppercase tracking-wider text-white/40">Suggested follow-ups</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => !disabled && onPick(s.question)}
            disabled={disabled}
            title={s.rationale || s.question}
            className="group flex items-center gap-1.5 rounded-full border border-[#1F1F1F] bg-[#111111] px-3 py-1.5 text-[12px] text-white/65 transition-all hover:border-amber-500/30 hover:bg-amber-500/[0.06] hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#1F1F1F] disabled:hover:bg-[#111111] disabled:hover:text-white/65"
          >
            <MessageSquare className="h-3 w-3 text-white/30 transition-colors group-hover:text-amber-400/70" />
            <span>{s.question}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export const OracleFollowUps = memo(OracleFollowUpsImpl);
export default OracleFollowUps;
