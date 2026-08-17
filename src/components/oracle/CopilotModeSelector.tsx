'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Copilot Mode Selector
// ═══════════════════════════════════════════════════════════════════════════════
//
// A dropdown that lets the user switch Oracle into one of 11 specialized copilot
// modes (General, CFO, GST, Cash Flow, Receivables, Payables, Tax, Operations,
// Invoices, Customers, Banking). Each mode shapes the system prompt + tool
// allowlist + suggested prompts on the backend (see copilot-modes.ts).
//
// The selector:
//   - Shows the current mode's icon + label + a small accent dot.
//   - Clicking opens a dropdown listing all 11 modes (icon, label, tagline).
//   - Selecting a mode calls `onChange(mode)` — the parent is responsible for
//     persisting to localStorage and sending `mode` in the brain POST body.
//
// Dark-themed to match the Oracle chat panel. Uses a hand-rolled dropdown
// (radix DropdownMenu's portal styling clashes with the black Oracle theme),
// with click-outside-to-close + keyboard escape support.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import {
  Sparkles, TrendingUp, Receipt, Wallet, ArrowDownToLine, ArrowUpFromLine,
  Calculator, Settings, FileText, Users, Landmark, ChevronDown, Check,
  type LucideIcon,
} from 'lucide-react';
import { COPILOT_MODES, type CopilotModeId } from '@/lib/oracle/brain/copilot-modes';
import { cn } from '@/lib/utils';

const MODE_ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, TrendingUp, Receipt, Wallet, ArrowDownToLine, ArrowUpFromLine,
  Calculator, Settings, FileText, Users, Landmark,
};

export interface CopilotModeSelectorProps {
  mode: CopilotModeId;
  onChange: (mode: CopilotModeId) => void;
  disabled?: boolean;
  className?: string;
}

export function CopilotModeSelector({
  mode,
  onChange,
  disabled = false,
  className,
}: CopilotModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click + escape
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = COPILOT_MODES[mode] ?? COPILOT_MODES.general;
  const CurrentIcon = MODE_ICON_MAP[current.icon] ?? Sparkles;
  const modes = Object.values(COPILOT_MODES);

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Oracle mode: ${current.label} — ${current.tagline}`}
        className={cn(
          'inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg text-[12px] font-medium transition-colors',
          'border border-[#1F1F1F] bg-[#0A0A0A] text-zinc-200',
          'hover:bg-[#0F0F0F] hover:border-[#2A2A2A] hover:text-white',
          'disabled:opacity-50 disabled:pointer-events-none',
          open && 'border-[#2A2A2A] bg-[#0F0F0F]',
        )}
      >
        <CurrentIcon className="h-3.5 w-3.5 text-emerald-400" />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">Mode</span>
        <ChevronDown
          className={cn('h-3 w-3 text-zinc-500 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Oracle copilot modes"
          className="absolute right-0 mt-1 w-[300px] max-w-[calc(100vw-2rem)] max-h-[420px] overflow-y-auto rounded-xl border border-[#1F1F1F] bg-[#0A0A0A] shadow-2xl shadow-black/60 z-50 p-1"
        >
          <div className="px-2 py-1.5 border-b border-[#1F1F1F] mb-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
              Copilot Mode
            </div>
            <div className="text-[11px] text-zinc-600 mt-0.5">
              Shapes Oracle&apos;s focus, tools &amp; suggested prompts
            </div>
          </div>
          {modes.map((m) => {
            const Icon = MODE_ICON_MAP[m.icon] ?? Sparkles;
            const isCurrent = m.id === mode;
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={isCurrent}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-start gap-2.5 px-2 py-2 rounded-lg text-left transition-colors',
                  isCurrent
                    ? 'bg-[#0F0F0F] ring-1 ring-emerald-500/20'
                    : 'hover:bg-[#0F0F0F]',
                )}
              >
                <div className="h-7 w-7 rounded-md bg-[#0F0F0F] border border-[#1F1F1F] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-zinc-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium text-white truncate">{m.label}</span>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider text-emerald-400 font-semibold">
                        <Check className="h-2.5 w-2.5" />
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate mt-0.5">{m.tagline}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CopilotModeSelector;
