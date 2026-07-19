'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PremiumEmptyState — UI Pro Max™ empty state primitive
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Renders the `.premium-empty` CSS class defined in globals.css
 * ("PREMIUM EMPTY STATES" section). The visual treatment — centered column,
 * 56px icon chip, 18px title, 13px muted description, primary + secondary
 * CTA buttons — is owned by the stylesheet so this component stays a thin,
 * design-token-driven wrapper.
 *
 * Usage:
 *   <PremiumEmptyState
 *     icon={FileText}
 *     title="No invoices yet"
 *     description="Create your first GST invoice to start tracking receivables."
 *     actionLabel="Create Invoice"
 *     onAction={() => navigate('invoices/new')}
 *     secondaryActionLabel="Import"
 *     onSecondaryAction={() => navigate('invoices/import')}
 *   />
 */

export interface PremiumEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  compact?: boolean;
}

export function PremiumEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  compact = false,
}: PremiumEmptyStateProps) {
  return (
    <div className={cn('premium-empty', compact && 'min-h-[160px] py-8', className)}>
      <div className="empty-icon">
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-2 flex flex-col items-center">
        <h3 className="empty-title">{title}</h3>
        {description && <p className="empty-desc">{description}</p>}
      </div>
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
          {actionLabel && onAction && (
            <Button size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default PremiumEmptyState;
