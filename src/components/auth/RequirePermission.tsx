'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — RequirePermission Guard Component (PART 4)
//
// A reusable wrapper that hides its children if the current user lacks the
// required permission(s). Used to gate UI sections for Create / Edit /
// Delete / Approve / Export / Settings actions.
//
// Usage:
//   <RequirePermission permission="invoices.edit">
//     <EditInvoiceButton />
//   </RequirePermission>
//
//   <RequirePermission any={['org.settings', 'org.billing']}>
//     <SettingsTabs />
//   </RequirePermission>
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/lib/auth/types';

interface RequirePermissionProps {
  /** Require a single permission. */
  permission?: Permission;
  /** Require ALL of these permissions. */
  all?: Permission[];
  /** Require ANY of these permissions. */
  any?: Permission[];
  children: ReactNode;
  /**
   * Optional fallback rendered when the user lacks permission. Defaults to
   * `null` (render nothing) so callers can compose their own empty states.
   */
  fallback?: ReactNode;
}

export function RequirePermission({
  permission,
  all,
  any,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const { can, canAll, canAny } = usePermissions();

  let allowed = true;
  if (permission) allowed = allowed && can(permission);
  if (all && all.length > 0) allowed = allowed && canAll(all);
  if (any && any.length > 0) allowed = allowed && canAny(any);

  return <>{allowed ? children : fallback}</>;
}

/**
 * Convenience wrapper for the inverse case — render children only when the
 * user does NOT have the permission. Useful for showing "request access"
 * prompts.
 */
export function RequireNoPermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { can } = usePermissions();
  return <>{can(permission) ? null : children}</>;
}
