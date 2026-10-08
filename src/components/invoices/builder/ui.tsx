'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Invoice Builder · Shared UI primitives
//
// Premium-grade primitives consumed by every panel of the rebuilt Invoice
// Builder. All inputs are LARGE (h-12 / 48px), all surfaces use the gst-card
// system, and everything ships with proper label + helper text + focus rings
// for accessibility.
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { IndianRupee } from 'lucide-react';
import { clampNonNeg } from './gst';

// ─── Premium input classnames (LARGE — h-12) ─────────────────────────────────

export const PREMIUM_INPUT_CLASSNAMES =
  'h-12 rounded-lg border-[#2A2E36] bg-[#0F1115] text-[15px] text-foreground placeholder:text-muted-foreground/50 ' +
  'focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40 transition-colors';

export const PREMIUM_SELECT_TRIGGER_CLASSNAMES =
  'h-12 rounded-lg border-[#2A2E36] bg-[#0F1115] text-[15px] text-foreground ' +
  'focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40 transition-colors';

export const PREMIUM_SELECT_CONTENT_CLASSNAMES =
  'border-[#2A2E36] bg-[#171A21]/95 text-foreground backdrop-blur-xl';

export const PREMIUM_TEXTAREA_CLASSNAMES =
  'rounded-lg border-[#2A2E36] bg-[#0F1115] text-[15px] text-foreground placeholder:text-muted-foreground/50 ' +
  'focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40 transition-colors';

// ─── SectionCard ─────────────────────────────────────────────────────────────

export function SectionCard({
  icon,
  title,
  description,
  right,
  children,
  className,
  bodyClassName,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('gst-card gst-animate-in relative', className)}>
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon ? (
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 text-[#60A5FA] ring-1 ring-[#2563EB]/25">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className="gst-section-title text-foreground">{title}</h3>
            {description ? <p className="gst-description mt-1">{description}</p> : null}
          </div>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

// ─── FieldLabel ──────────────────────────────────────────────────────────────

export function FieldLabel({
  children,
  hint,
  htmlFor,
  required,
}: {
  children: React.ReactNode;
  hint?: string;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className="gst-label mb-2 block text-[13px] text-muted-foreground">
      {children}
      {required ? <span className="ml-0.5 text-[#F87171]">*</span> : null}
      {hint ? (
        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground/70">· {hint}</span>
      ) : null}
    </Label>
  );
}

// ─── MoneyInput ──────────────────────────────────────────────────────────────

/** Money input — ₹ prefix, numeric only, clamped to ≥ 0. LARGE (h-12). */
export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'> & { value: number; onValueChange: (n: number) => void }
>(function MoneyInput({ value, onValueChange, className, ...props }, ref) {
  return (
    <div
      className={cn(
        'group flex h-12 items-center rounded-lg border border-[#2A2E36] bg-[#0F1115] px-3.5',
        'transition-all focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/40',
        className,
      )}
    >
      <span className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground group-focus-within:text-[#60A5FA]">
        <IndianRupee className="h-3.5 w-3.5" />
      </span>
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          onValueChange(clampNonNeg(n));
        }}
        className="gst-input w-full bg-transparent text-right text-[15px] tabular-nums text-foreground outline-none placeholder:text-muted-foreground/50"
        {...props}
      />
    </div>
  );
});

// ─── NumberInput ─────────────────────────────────────────────────────────────

/** Numeric input — no ₹ prefix, clamped to ≥ 0. LARGE (h-12). */
export const NumberInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'> & { value: number; onValueChange: (n: number) => void }
>(function NumberInput({ value, onValueChange, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="number"
      inputMode="decimal"
      min={0}
      step="0.01"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => {
        const n = Number(e.target.value);
        onValueChange(clampNonNeg(n));
      }}
      className={cn(
        'gst-input h-12 w-full rounded-lg border border-[#2A2E36] bg-[#0F1115] px-3.5 text-right text-[15px] tabular-nums text-foreground outline-none',
        'transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40',
        'placeholder:text-muted-foreground/50',
        className,
      )}
      {...props}
    />
  );
});

// ─── HelperTextInput ─────────────────────────────────────────────────────────

/** Small helper text below a field — for "Due date auto-set to …" hints. */
export function HelperText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('gst-caption mt-2 text-[12px] text-muted-foreground', className)}>{children}</p>;
}

// ─── PremiumInput (text input wrapper with consistent classnames) ────────────

export const PremiumInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'>
>(function PremiumInput({ className, ...props }, ref) {
  return <Input ref={ref} className={cn(PREMIUM_INPUT_CLASSNAMES, className)} {...props} />;
});

// ─── RowIconButton ───────────────────────────────────────────────────────────

export function RowIconButton({
  label,
  onClick,
  icon,
  disabled = false,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-[#2A2E36] hover:text-foreground',
        'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
        tone === 'danger' && 'hover:bg-[#EF4444]/15 hover:text-[#F87171]',
      )}
    >
      {icon}
    </button>
  );
}
