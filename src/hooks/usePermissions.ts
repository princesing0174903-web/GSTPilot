'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — usePermissions Hook (PART 4)
//
// Reusable permission middleware for React components. Reads the current
// user's role from OrgContext and exposes granular permission checks.
//
// Usage:
//   const { can, canAll, canAny, role } = usePermissions();
//   if (!can('invoices.edit')) return <ReadOnly />;
//
// Every page that performs Create / Edit / Delete / Approve / Export /
// Settings actions should gate the action with `can(...)`.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import {
  can as canFn,
  canAll as canAllFn,
  canAny as canAnyFn,
  isPrivileged,
  isReadOnly,
  canMutate,
  permissionsFor,
} from '@/lib/auth/permissions';
import type { OrgRole, Permission } from '@/lib/auth/types';

export interface UsePermissionsResult {
  /** The current user's role within the active org (or null). */
  role: OrgRole | null;
  /** True if the role grants the given permission. */
  can: (permission: Permission) => boolean;
  /** True if the role grants ALL of the given permissions. */
  canAll: (permissions: Permission[]) => boolean;
  /** True if the role grants ANY of the given permissions. */
  canAny: (permissions: Permission[]) => boolean;
  /** True if role is owner or admin. */
  isPrivileged: boolean;
  /** True if the role can mutate any data (not read-only). */
  canMutate: boolean;
  /** True if the role is a read-only tier (auditor / viewer). */
  isReadOnly: boolean;
  /** The full list of permissions for this role (empty if no role). */
  permissions: Permission[];
}

export function usePermissions(): UsePermissionsResult {
  const { role } = useOrg();

  return useMemo(
    () => ({
      role,
      can: (permission: Permission) => canFn(role, permission),
      canAll: (permissions: Permission[]) => canAllFn(role, permissions),
      canAny: (permissions: Permission[]) => canAnyFn(role, permissions),
      isPrivileged: isPrivileged(role),
      canMutate: canMutate(role),
      isReadOnly: isReadOnly(role),
      permissions: role ? permissionsFor(role) : [],
    }),
    [role]
  );
}
