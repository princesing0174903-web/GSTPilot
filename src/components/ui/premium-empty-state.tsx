'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Premium Empty State
// ═══════════════════════════════════════════════════════════════════════════════
//
// A large, premium empty state with:
//   • Large illustration (icon)
//   • Meaningful description
//   • Primary CTA
//   • Secondary CTA
//   • Oracle Suggestions (optional)
//   • Quick Tips (optional)
//
// Inspired by Stripe / Linear / Vercel empty states.
//
// Usage:
//   <PremiumEmptyState
//     icon={<FileText className="h-8 w-8" />}
//     title="No invoices yet"
//     description="Create your first invoice to start tracking payments and GST."
//     primaryAction={{ label: "Create Invoice", onClick: () => setView('invoices-new') }}
//     secondaryAction={{ label: "Import from Zoho", onClick: () => setView('zoho') }}
//     oracleSuggestion="Ask Oracle to draft your first invoice from last month's sales data."
//     quickTips={["Use ⌘K to quickly navigate", "Connect Zoho to auto-import invoices"]}
//   />
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { Sparkles, Lightbulb, ArrowRight } from 'lucide-react';

export interface PremiumEmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

export interface PremiumEmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  primaryAction?: PremiumEmptyStateAction;
  secondaryAction?: PremiumEmptyStateAction;
  oracleSuggestion?: string;
  quickTips?: string[];
  className?: string;
}

export function PremiumEmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  oracleSuggestion,
  quickTips,
  className = '',
}: PremiumEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      {/* ── Large illustration ── */}
      <div className="relative mb-6">
        <div className="absolute inset-0 -z-10 rounded-full bg-[#2563EB]/5 blur-2xl" />
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#1F1F1F] bg-[#0F0F0F] shadow-lg">
          <div className="text-[#3B82F6]">{icon}</div>
        </div>
      </div>

      {/* ── Title + Description ── */}
      <h3 className="gst-empty-state-title text-xl">{title}</h3>
      <p className="gst-empty-state-desc max-w-md">{description}</p>

      {/* ── Actions ── */}
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="gst-btn gst-btn-primary gst-btn-lg"
            >
              {primaryAction.icon}
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="gst-btn gst-btn-secondary gst-btn-lg"
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}

      {/* ── Oracle Suggestion ── */}
      {oracleSuggestion && (
        <div className="mt-8 flex max-w-lg items-start gap-3 rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/[0.06] p-4 text-left">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/15">
            <Sparkles className="h-4 w-4 text-[#60A5FA]" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#60A5FA]">
              Oracle Suggestion
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{oracleSuggestion}</p>
          </div>
        </div>
      )}

      {/* ── Quick Tips ── */}
      {quickTips && quickTips.length > 0 && (
        <div className="mt-6 w-full max-w-md">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" />
            Quick Tips
          </div>
          <ul className="space-y-2 text-left">
            {quickTips.map((tip, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] px-3 py-2 text-sm text-muted-foreground"
              >
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3B82F6]" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default PremiumEmptyState;
