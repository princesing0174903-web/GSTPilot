'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — PermissionGate
//
// A full-PAGE permission gate (distinct from RequirePermission, which hides
// inline UI). When the current user lacks the required permission, this
// renders a premium "Access Restricted" panel with the user's role + a hint
// to request access — instead of silently rendering nothing.
//
// Use this to wrap entire dashboard views so unauthorized users see a clear,
// branded deny state rather than a blank page.
//
// Usage:
//   <PermissionGate permission="org.settings">
//     <OrganizationDashboard />
//   </PermissionGate>
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { ShieldAlert, Lock } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useOrg } from '@/contexts/OrgContext';
import { ROLE_LABELS } from '@/lib/auth/types';
import type { Permission } from '@/lib/auth/types';

interface PermissionGateProps {
  permission?: Permission;
  all?: Permission[];
  any?: Permission[];
  children: ReactNode;
  /** Optional custom title for the deny state. */
  title?: string;
  /** Optional custom description. */
  description?: string;
}

export function PermissionGate({
  permission,
  all,
  any,
  children,
  title = 'Access Restricted',
  description,
}: PermissionGateProps) {
  const { can, canAll, canAny, role } = usePermissions();
  const { organization } = useOrg();

  let allowed = true;
  if (permission) allowed = allowed && can(permission);
  if (all && all.length > 0) allowed = allowed && canAll(all);
  if (any && any.length > 0) allowed = allowed && canAny(any);

  if (allowed) return <>{children}</>;

  const roleName = role ? ROLE_LABELS[role] : 'Guest';
  const orgName = organization?.name ?? 'this workspace';
  const fallbackDescription =
    description ??
    `Your role (${roleName}) in ${orgName} doesn't include permission to view this page. Ask an Owner or Admin to update your role if you need access.`;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-5 rounded-2xl border border-border/60 bg-card/50 p-8 text-center shadow-sm backdrop-blur">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
          <ShieldAlert className="h-7 w-7 text-amber-500" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{fallbackDescription}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>Current role: {roleName}</span>
        </div>
      </div>
    </div>
  );
}

export default PermissionGate;
