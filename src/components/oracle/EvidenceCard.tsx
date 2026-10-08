'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Evidence Card (Source Citation)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Renders a clickable "source citation" card BELOW a tool-result block. This is
// the audit-trail UI: when Oracle reports a number, the user can see exactly
// where that number came from (which Prisma table, which integration, when it
// was last updated) and jump to the underlying view.
//
// Layout (matches the spec wireframe):
//   ┌─────────────────────────────────────────┐
//   │ 📊 Source: Invoices (FY 2024-25)        │
//   │ System: Prisma · Invoice                │
//   │ Environment: [LIVE] (green badge)       │
//   │ Last updated: 2h ago                    │
//   │ [View invoices →] (deepLink)            │
//   └─────────────────────────────────────────┘
//
// The card is clickable when `source.deepLink` is present and `onNavigate` is
// supplied. Otherwise it renders as a static info panel.
// ═══════════════════════════════════════════════════════════════════════════════

import { Database, ExternalLink, Clock } from 'lucide-react';
import type { Evidence } from '@/lib/oracle/context/types';
import { ago } from '@/lib/oracle/context/types';
import { EnvironmentBadge } from './EnvironmentBadge';
import { cn } from '@/lib/utils';

export interface EvidenceCardProps {
  evidence: Evidence;
  /** Navigation callback — when supplied AND evidence.source.deepLink exists,
   *  the card becomes clickable and clicking it navigates to the source view. */
  onNavigate?: (view: string, entityId?: string) => void;
  className?: string;
}

/**
 * Parse a deepLink (e.g. "/dashboard?view=invoices" or "/customers") into the
 * dashboard's setCurrentView view string. Mirrors the viewMap in ActionConfirmCard.
 */
function deepLinkToView(deepLink: string): string {
  const viewMap: Record<string, string> = {
    '/customers': 'clients',
    '/invoices': 'invoices',
    '/expenses': 'expenses',
    '/payments': 'payments',
    '/banking': 'banking',
    '/returns': 'returns',
    '/reports': 'analytics',
    '/crm': 'crm',
    '/documents': 'documents',
    '/team': 'team',
    '/settings': 'settings',
    '/timeline': 'timeline',
    '/dashboard': 'dashboard',
    '/gst': 'gst',
    '/gst-returns': 'gst-returns',
    '/gst-reconciliation': 'gst-reconciliation',
    '/integrations': 'integrations',
    '/receivables': 'receivables',
  };
  try {
    // Tolerate both "/path?view=X" and "/path"
    const u = new URL(deepLink, 'http://oracle.local');
    const explicitView = u.searchParams.get('view');
    if (explicitView) return explicitView;
    const path = u.pathname;
    // Try exact match first, then prefix match (longest prefix wins)
    if (viewMap[path]) return viewMap[path];
    const sorted = Object.keys(viewMap).sort((a, b) => b.length - a.length);
    for (const k of sorted) {
      if (path.startsWith(k)) return viewMap[k];
    }
    return 'dashboard';
  } catch {
    return 'dashboard';
  }
}

export function EvidenceCard({ evidence, onNavigate, className }: EvidenceCardProps) {
  const deepLink = evidence.source.deepLink;
  const clickable = !!deepLink && !!onNavigate;
  const handle = () => {
    if (!clickable || !deepLink || !onNavigate) return;
    onNavigate(deepLinkToView(deepLink));
  };

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handle : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handle();
              }
            }
          : undefined
      }
      className={cn(
        'rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] p-3 text-left',
        clickable && 'cursor-pointer hover:border-[#2A2A2A] hover:bg-[#0F0F0F] transition-colors',
        className,
      )}
    >
      {/* Header row: icon + "Source: <label>" */}
      <div className="flex items-start gap-2">
        <div className="h-6 w-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <Database className="h-3 w-3 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">
            Source
          </div>
          <div className="text-[13px] font-semibold text-white truncate">
            {evidence.label}
          </div>
        </div>
        {clickable && (
          <ExternalLink className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-1" />
        )}
      </div>

      {/* Detail rows */}
      <div className="mt-2.5 space-y-1.5 pl-8">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-zinc-500 shrink-0">System:</span>
          <span className="text-zinc-300 truncate">{evidence.source.system}</span>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-zinc-500 shrink-0">Environment:</span>
          <EnvironmentBadge environment={evidence.source.environment} withDot />
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <Clock className="h-3 w-3 text-zinc-600 shrink-0" />
          <span className="text-zinc-500 shrink-0">Last updated:</span>
          <span className="text-zinc-300">{ago(evidence.source.lastUpdatedAt)}</span>
        </div>
        {evidence.source.period && (
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-zinc-500 shrink-0">Period:</span>
            <span className="text-zinc-300">{evidence.source.period}</span>
          </div>
        )}
        {evidence.source.recordCount != null && evidence.source.recordCount > 0 && (
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-zinc-500 shrink-0">Records:</span>
            <span className="text-zinc-300 tabular-nums">
              {evidence.source.recordCount.toLocaleString('en-IN')}
            </span>
          </div>
        )}
        {evidence.source.note && (
          <div className="text-[11px] text-amber-400/90 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1 mt-1.5">
            {evidence.source.note}
          </div>
        )}
      </div>

      {/* Deep-link CTA */}
      {clickable && (
        <div className="mt-2.5 pl-8">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
            View source
            <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      )}
    </div>
  );
}

export default EvidenceCard;
