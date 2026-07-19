'use client';

/**
 * FormField / FormSection / FormActions — Premium form primitives
 * ---------------------------------------------------------------------------
 * Wraps shadcn Label + Input/Textarea/Select children with:
 *  · required asterisk (red #EF4444)
 *  · helper text (muted-foreground, 12px)
 *  · inline error (red with AlertCircle icon)
 *  · inline success (green with CheckCircle2 icon)
 *  · computed status precedence: error > success > status
 *
 * Visual styling for the actual input borders (data-error / data-success rings)
 * lives in src/app/globals.css under "FORM VALIDATION STATES".
 *
 * These primitives are ADDITIVE — they do not replace shadcn/ui <Form> or any
 * existing form code. They are available for opt-in use across the app.
 * ---------------------------------------------------------------------------
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

// Re-export the underlying primitives so consumers can import everything from
// a single barrel if they choose to.
export { Label, Input, Textarea };

export type FieldStatus = 'default' | 'success' | 'error' | 'warning';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  success?: string;
  helperText?: string;
  status?: FieldStatus;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  success,
  helperText,
  status = 'default',
  className,
  children,
}: FormFieldProps) {
  const computedStatus: FieldStatus = error ? 'error' : success ? 'success' : status;
  // computedStatus is reserved for future per-status icon/border signalling
  // (currently the border color is driven by data-error/data-success attrs on
  // the underlying input, or by the .input-error/.input-success helper class).
  void computedStatus;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="flex items-center gap-1">
        {label}
        {required && <span className="text-[#EF4444]">*</span>}
      </Label>
      {children}
      {helperText && !error && !success && (
        <p className="helper-text">{helperText}</p>
      )}
      {error && (
        <p className="text-xs text-[#F87171] flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
      {success && !error && (
        <p className="text-xs text-[#4ADE80] flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {success}
        </p>
      )}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
  actions,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
          {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </section>
  );
}

export function FormActions({
  children,
  className,
  align = 'right',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'between';
}) {
  return (
    <div className={cn(
      'flex items-center gap-2 pt-2',
      align === 'right' && 'justify-end',
      align === 'between' && 'justify-between',
      align === 'left' && 'justify-start',
      className,
    )}>
      {children}
    </div>
  );
}
