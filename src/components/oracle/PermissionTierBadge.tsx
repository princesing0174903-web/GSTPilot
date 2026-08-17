'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Permission Tier Badge
// ═══════════════════════════════════════════════════════════════════════════════
//
// Small pill that labels a tool call with its permission tier:
//   read-only       → green "READ"
//   confirmation    → amber "CONFIRM"
//   strong-confirm  → red "STRONG CONFIRM"
//
// The tier is server-enforced (see src/lib/oracle/brain/tool-permissions.ts).
// The badge is purely informational — it tells the user "this is a safe read"
// or "this will mutate data — review the preview" or "this is destructive —
// think twice". For strong-confirm tools, the ActionConfirmCard also renders
// a dedicated red warning banner (see OracleBrainCore.tsx).
// ═══════════════════════════════════════════════════════════════════════════════

import { ShieldCheck, ShieldAlert, ShieldX, type LucideIcon } from 'lucide-react';
import type { PermissionTier } from '@/lib/oracle/brain/tool-permissions';
import { cn } from '@/lib/utils';

interface TierConfig {
  label: string;
  icon: LucideIcon;
  classes: string;
  description: string;
}

const TIER_CONFIG: Record<PermissionTier, TierConfig> = {
  'read-only': {
    label: 'READ',
    icon: ShieldCheck,
    classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    description: 'Read-only — safe, no confirmation needed.',
  },
  'confirmation': {
    label: 'CONFIRM',
    icon: ShieldAlert,
    classes: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    description: 'Mutates data — review the preview before confirming.',
  },
  'strong-confirm': {
    label: 'STRONG CONFIRM',
    icon: ShieldX,
    classes: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    description: 'Destructive / externally visible / financial — requires explicit approval.',
  },
};

export interface PermissionTierBadgeProps {
  tier: PermissionTier;
  /** Compact variant — renders just the icon + label without the descriptive title. */
  compact?: boolean;
  className?: string;
}

export function PermissionTierBadge({
  tier,
  compact = false,
  className,
}: PermissionTierBadgeProps) {
  const conf = TIER_CONFIG[tier];
  const Icon = conf.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
        conf.classes,
        className,
      )}
      title={conf.description}
    >
      <Icon className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {conf.label}
    </span>
  );
}

export default PermissionTierBadge;
