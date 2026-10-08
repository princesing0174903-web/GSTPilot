'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — useEnterpriseOrg Hook
//
// Client-side data + actions layer for the Enterprise Organization Console.
// Reads the current org + membership from OrgContext, fetches the org activity
// trail, and exposes typed action wrappers around the enterprise-org service
// (profile, branding, localization, billing, subscription, API keys, member
// suspend/reactivate). Every action auto-stamps the actor + reloads the org
// context on success so the UI reflects the change immediately.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  updateOrgProfile,
  updateOrgBranding,
  updateOrgLocalization,
  updateOrgBilling,
  updateOrgSubscription,
  createApiKey,
  revokeApiKey,
  suspendMember,
  reactivateMember,
  listAuditEvents,
  getAuditSummary,
  type UpdateOrgProfileInput,
  type OrgBrandingInput,
  type OrgLocalizationInput,
  type CreateApiKeyInput,
  type AuditLogEntry,
  type AuditSummary,
  type AuditCategory,
  type AuditSeverity,
} from '@/lib/enterprise-org';
import type { OrganizationBilling, OrganizationSubscription } from '@/lib/auth/types';

interface UseEnterpriseOrgResult {
  // ── Data ──
  organization: ReturnType<typeof useOrg>['organization'];
  membership: ReturnType<typeof useOrg>['membership'];
  members: ReturnType<typeof useOrg>['members'];
  role: ReturnType<typeof useOrg>['role'];
  activity: AuditLogEntry[];
  activitySummary: AuditSummary | null;
  activityLoading: boolean;
  activityError: string | null;
  // ── Actions ──
  saveProfile: (input: UpdateOrgProfileInput) => Promise<{ error: string | null }>;
  saveBranding: (input: OrgBrandingInput) => Promise<{ error: string | null }>;
  saveLocalization: (input: OrgLocalizationInput) => Promise<{ error: string | null }>;
  saveBilling: (billing: OrganizationBilling) => Promise<{ error: string | null }>;
  saveSubscription: (sub: OrganizationSubscription) => Promise<{ error: string | null }>;
  createOrgApiKey: (input: CreateApiKeyInput) => Promise<{ plaintext: string | null; error: string | null }>;
  revokeOrgApiKey: (keyId: string) => Promise<{ error: string | null }>;
  suspendOrgMember: (userId: string) => Promise<{ error: string | null }>;
  reactivateOrgMember: (userId: string) => Promise<{ error: string | null }>;
  refreshActivity: () => Promise<void>;
  // ── Flags ──
  saving: boolean;
}

export function useEnterpriseOrg(): UseEnterpriseOrgResult {
  const { organization, membership, members, role, reload } = useOrg();
  const { user } = useAuth();

  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [activitySummary, setActivitySummary] = useState<AuditSummary | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const orgId = organization?.id ?? null;

  const actor = {
    id: user?.id ?? membership?.userId ?? '',
    name: user?.name ?? membership?.userDisplayName ?? null,
    email: user?.email ?? membership?.userEmail ?? null,
    role: role ?? null,
  };

  // ── Activity fetch ──
  const refreshActivity = useCallback(async () => {
    if (!orgId) return;
    setActivityLoading(true);
    setActivityError(null);
    try {
      const [entriesResult, summaryResult] = await Promise.all([
        listAuditEvents(orgId, { take: 100 }),
        getAuditSummary(orgId),
      ]);
      setActivity(entriesResult.entries);
      setActivitySummary(summaryResult.summary);
      if (entriesResult.error) setActivityError(entriesResult.error);
      else if (summaryResult.error) setActivityError(summaryResult.error);
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Could not load activity.');
    } finally {
      setActivityLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void refreshActivity();
  }, [refreshActivity]);

  // ── Action wrappers ──
  const wrap = useCallback(
    async <T>(fn: () => Promise<{ error: string | null }>, onSuccess?: () => Promise<void>): Promise<{ error: string | null }> => {
      setSaving(true);
      try {
        const result = await fn();
        if (!result.error && onSuccess) await onSuccess();
        return result;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const saveProfile = useCallback(
    (input: UpdateOrgProfileInput) =>
      wrap(() => updateOrgProfile(orgId ?? '', input, actor), reload),
    [wrap, orgId, actor, reload],
  );

  const saveBranding = useCallback(
    (input: OrgBrandingInput) =>
      wrap(() => updateOrgBranding(orgId ?? '', input, actor), reload),
    [wrap, orgId, actor, reload],
  );

  const saveLocalization = useCallback(
    (input: OrgLocalizationInput) =>
      wrap(() => updateOrgLocalization(orgId ?? '', input, actor), reload),
    [wrap, orgId, actor, reload],
  );

  const saveBilling = useCallback(
    (billing: OrganizationBilling) =>
      wrap(() => updateOrgBilling(orgId ?? '', billing, actor), reload),
    [wrap, orgId, actor, reload],
  );

  const saveSubscription = useCallback(
    (sub: OrganizationSubscription) =>
      wrap(() => updateOrgSubscription(orgId ?? '', sub, actor), reload),
    [wrap, orgId, actor, reload],
  );

  const createOrgApiKey = useCallback(
    async (input: CreateApiKeyInput): Promise<{ plaintext: string | null; error: string | null }> => {
      setSaving(true);
      try {
        const result = await createApiKey(orgId ?? '', input, actor);
        if (!result.error && orgId) await reload();
        return { plaintext: result.plaintext, error: result.error };
      } finally {
        setSaving(false);
      }
    },
    [orgId, actor, reload],
  );

  const revokeOrgApiKey = useCallback(
    (keyId: string) =>
      wrap(() => revokeApiKey(orgId ?? '', keyId, actor), reload),
    [wrap, orgId, actor, reload],
  );

  const suspendOrgMember = useCallback(
    (userId: string) =>
      wrap(() => suspendMember(orgId ?? '', userId, actor), reload),
    [wrap, orgId, actor, reload],
  );

  const reactivateOrgMember = useCallback(
    (userId: string) =>
      wrap(() => reactivateMember(orgId ?? '', userId, actor), reload),
    [wrap, orgId, actor, reload],
  );

  return {
    organization,
    membership,
    members,
    role,
    activity,
    activitySummary,
    activityLoading,
    activityError,
    saveProfile,
    saveBranding,
    saveLocalization,
    saveBilling,
    saveSubscription,
    createOrgApiKey,
    revokeOrgApiKey,
    suspendOrgMember,
    reactivateOrgMember,
    refreshActivity,
    saving,
  };
}

// Re-export audit filter types for convenience.
export type { AuditCategory, AuditSeverity };
