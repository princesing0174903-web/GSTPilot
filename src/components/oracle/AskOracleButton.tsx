'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI — AskOracleButton
// ═══════════════════════════════════════════════════════════════════════════════
//
// A small, subtle "Ask VEYRO AI" chip rendered in the top-right of each major
// workspace page (Invoices, Customers, Returns, Finance). Clicking it:
//   1. Sets a pending prompt on VEYRO AI-conversations store (the prompt is
//      either the explicit `prompt` prop or a smart default derived from the
//      page `context`).
//   2. Navigates to /oracle (the canonical Oracle page). OracleChat consumes
//      the pending prompt on mount and pre-fills the composer.
//
// Design rules:
//   • ONE small button per page — top-right of the page header.
//   • Uses the existing Oracle amber/gold accent (Brain icon + amber text on
//     hover). Stays subtle in the resting state so it never competes with the
//     page's primary CTA.
//   • Never says "Activate Oracle" — only "Ask VEYRO AI".
//   • Uses router.push('/oracle') (the same path the sidebar uses) so there is
//     exactly ONE Oracle entry point.
// ═══════════════════════════════════════════════════════════════════════════════

import { Brain } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useOracleConversations } from '@/lib/oracle-conversations';

export type AskOracleContext =
  | 'invoices'
  | 'customers'
  | 'returns'
  | 'finance'
  | 'dashboard'
  | 'reconcile'
  | 'vendors'
  | 'expenses'
  | 'payments'
  | 'documents'
  | 'generic';

/** Smart default prompts per workspace. The page-specific copy is intentionally
 *  concrete ("which ones are overdue and what should I do?") so Oracle has a
 *  clear, actionable entry point. */
const DEFAULT_PROMPTS: Record<AskOracleContext, string> = {
  invoices:
    'Review my invoices — which ones are overdue and what should I do?',
  customers:
    'Analyze my customers — which are most profitable and which need attention?',
  returns:
    'Review my GST filings — any risks or upcoming deadlines?',
  finance:
    'How is my cash flow looking? Any risks this month?',
  dashboard:
    "What should I prioritize today across my business?",
  reconcile:
    'What reconciliation mismatches need my attention right now?',
  vendors:
    'Which vendors account for most of my spend, and are there any anomalies?',
  expenses:
    'Are my expenses trending in the right direction this month?',
  payments:
    'Which payments are pending or delayed, and what should I follow up on?',
  documents:
    'Which documents still need processing, and are any blocking filings?',
  generic:
    'What should I focus on right now based on my live business data?',
};

export interface AskOracleButtonProps {
  /** The workspace the button lives in — picks the default prompt. */
  context: AskOracleContext;
  /** Optional explicit prompt. Overrides the default for the context. */
  prompt?: string;
  /** Optional className passthrough so the host page can tweak spacing. */
  className?: string;
  /** Visual size — default "sm" matches the page header buttons. */
  size?: 'sm' | 'md';
  /** Optional label override. Defaults to "Ask VEYRO AI". */
  label?: string;
}

export function AskOracleButton({
  context,
  prompt,
  className,
  size = 'sm',
  label = 'Ask VEYRO AI',
}: AskOracleButtonProps) {
  const router = useRouter();
  const setPendingPrompt = useOracleConversations((s) => s.setPendingPrompt);

  const handleClick = useCallback(() => {
    const finalPrompt = (prompt ?? DEFAULT_PROMPTS[context] ?? DEFAULT_PROMPTS.generic).trim();
    if (finalPrompt) {
      setPendingPrompt(finalPrompt);
    }
    router.push('/oracle');
  }, [context, prompt, router, setPendingPrompt]);

  const heightClass = size === 'sm' ? 'h-8' : 'h-9';
  const paddingClass = size === 'sm' ? 'px-2.5' : 'px-3';
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const textClass = size === 'sm' ? 'text-xs' : 'text-[13px]';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={prompt ?? DEFAULT_PROMPTS[context] ?? DEFAULT_PROMPTS.generic}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/[0.06] font-medium text-amber-400 outline-none transition-all duration-150',
        'hover:border-amber-500/40 hover:bg-amber-500/[0.12] hover:text-amber-300',
        'focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'active:scale-[0.98] gst-btn-press',
        heightClass,
        paddingClass,
        textClass,
        className,
      )}
    >
      <Brain className={iconClass} aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

export default AskOracleButton;
