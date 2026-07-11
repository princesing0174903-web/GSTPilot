// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Enterprise Organization Service
//
// Extends the base organization service (`@/lib/auth/organizations`) with:
//   • Extended org profile fields (industry, size, timezone, currency, country,
//     pan, billing, subscription, branding, apiKeys)
//   • API key lifecycle (create / list / revoke) with hashed storage
//   • Member suspension / reactivation (beyond the base invite/remove/role)
//   • Audit-logged mutations — every write emits an `organization_audit_logs`
//     event via the co-located audit service.
//
// This module is the single server-side entry point for the Enterprise
// Organization Console UI. It is framework-agnostic (pure Firestore) so it
// can be called from API routes, server actions, or background functions.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/firebase';
import {
  doc,
  updateDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import type {
  OrganizationDoc,
  OrganizationBilling,
  OrganizationSubscription,
  OrgApiKey,
  OrgRole,
  MemberStatus,
} from '@/lib/auth/types';
import { logAuditEvent, type AuditCategory } from './audit';

// ─── Web Crypto helpers (isomorphic — works in browser + Node 18+) ──────────

/** Generate `bytes` random bytes as a lowercase hex string. */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 hash of a string, returned as lowercase hex. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Extended org profile update ─────────────────────────────────────────────

export interface UpdateOrgProfileInput {
  name?: string;
  logoUrl?: string | null;
  gstin?: string | null;
  pan?: string | null;
  industry?: string | null;
  companySize?: string | null;
  timezone?: string | null;
  currency?: string | null;
  country?: string | null;
  legalName?: string | null;
  state?: string | null;
  entityType?: string | null;
  officeAddress?: string | null;
}

export interface UpdateOrgProfileResult {
  organization: OrganizationDoc | null;
  error: string | null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'workspace';
}

/**
 * Update the extended organization profile. Owner/admin only (enforced by the
 * API route / caller). Emits an `organization` + `settings` audit event.
 */
export async function updateOrgProfile(
  orgId: string,
  updates: UpdateOrgProfileInput,
  actor?: { id: string; name: string | null; email: string | null; role: OrgRole | null },
): Promise<UpdateOrgProfileResult> {
  try {
    const payload: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
    if (updates.name) payload.slug = slugify(updates.name);

    await updateDoc(doc(db, 'organizations', orgId), payload);

    // Re-fetch the updated doc to return the fresh shape.
    const snap = await getDoc(doc(db, 'organizations', orgId));
    const organization = snap.exists() ? (snap.data() as OrganizationDoc) : null;

    // Best-effort audit log.
    await logAuditEvent({
      organizationId: orgId,
      category: 'settings',
      action: 'org.profile.updated',
      summary: `Updated organization profile (${Object.keys(updates).join(', ')})`,
      severity: 'info',
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
      targetType: 'organization',
      targetId: orgId,
      metadata: { fields: Object.keys(updates) },
    });

    return { organization, error: null };
  } catch (err) {
    return {
      organization: null,
      error: err instanceof Error ? err.message : 'Could not update organization profile.',
    };
  }
}

// ─── Branding ────────────────────────────────────────────────────────────────

export interface OrgBrandingInput {
  primaryColor?: string;
  accentColor?: string;
  customDomain?: string | null;
  logoUrl?: string | null;
}

export async function updateOrgBranding(
  orgId: string,
  branding: OrgBrandingInput,
  actor?: { id: string; name: string | null; email: string | null; role: OrgRole | null },
): Promise<{ error: string | null }> {
  try {
    await updateDoc(doc(db, 'organizations', orgId), {
      branding: {
        primaryColor: branding.primaryColor ?? '#10b981',
        accentColor: branding.accentColor ?? '#0ea5e9',
        customDomain: branding.customDomain ?? null,
      },
      ...(branding.logoUrl !== undefined ? { logoUrl: branding.logoUrl } : {}),
      updatedAt: serverTimestamp(),
    });
    await logAuditEvent({
      organizationId: orgId,
      category: 'settings',
      action: 'org.branding.updated',
      summary: 'Updated organization branding',
      severity: 'info',
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
      targetType: 'organization',
      targetId: orgId,
    });
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not update branding.' };
  }
}

// ─── Localization ────────────────────────────────────────────────────────────

export interface OrgLocalizationInput {
  timezone?: string | null;
  currency?: string | null;
  country?: string | null;
}

export async function updateOrgLocalization(
  orgId: string,
  loc: OrgLocalizationInput,
  actor?: { id: string; name: string | null; email: string | null; role: OrgRole | null },
): Promise<{ error: string | null }> {
  try {
    await updateDoc(doc(db, 'organizations', orgId), {
      timezone: loc.timezone ?? null,
      currency: loc.currency ?? null,
      country: loc.country ?? null,
      updatedAt: serverTimestamp(),
    });
    await logAuditEvent({
      organizationId: orgId,
      category: 'settings',
      action: 'org.localization.updated',
      summary: `Updated localization (timezone=${loc.timezone ?? '-'}, currency=${loc.currency ?? '-'}, country=${loc.country ?? '-'})`,
      severity: 'info',
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
      targetType: 'organization',
      targetId: orgId,
    });
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not update localization.' };
  }
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export async function updateOrgBilling(
  orgId: string,
  billing: OrganizationBilling,
  actor?: { id: string; name: string | null; email: string | null; role: OrgRole | null },
): Promise<{ error: string | null }> {
  try {
    await updateDoc(doc(db, 'organizations', orgId), {
      billing,
      updatedAt: serverTimestamp(),
    });
    await logAuditEvent({
      organizationId: orgId,
      category: 'billing',
      action: 'org.billing.updated',
      summary: `Updated billing contact (${billing.email ?? 'no email'})`,
      severity: 'warning',
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
      targetType: 'organization',
      targetId: orgId,
    });
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not update billing.' };
  }
}

// ─── Subscription ────────────────────────────────────────────────────────────

export async function updateOrgSubscription(
  orgId: string,
  subscription: OrganizationSubscription,
  actor?: { id: string; name: string | null; email: string | null; role: OrgRole | null },
): Promise<{ error: string | null }> {
  try {
    await updateDoc(doc(db, 'organizations', orgId), {
      subscription,
      plan: subscription.plan,
      updatedAt: serverTimestamp(),
    });
    await logAuditEvent({
      organizationId: orgId,
      category: 'subscription',
      action: 'org.subscription.updated',
      summary: `Subscription set to ${subscription.plan} (${subscription.status})`,
      severity: 'warning',
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
      targetType: 'organization',
      targetId: orgId,
      metadata: { plan: subscription.plan, status: subscription.status, seats: subscription.seats },
    });
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not update subscription.' };
  }
}

// ─── API Keys ────────────────────────────────────────────────────────────────

export interface CreateApiKeyInput {
  label: string;
  scopes: string[];
}

export interface CreateApiKeyResult {
  apiKey: OrgApiKey | null;
  /** The full plaintext key — shown ONCE to the user, then never again. */
  plaintext: string | null;
  error: string | null;
}

const KEY_PREFIX = 'gstp_live_';
const KEY_BYTES = 32;

/**
 * Create a new scoped API key for the organization. The key is hashed (SHA-256)
 * before storage so the plaintext is only ever seen by the user at creation
 * time. The stored `prefix` (first 12 chars) lets the UI display a masked
 * reference like `gstp_live_•••••AB12`.
 */
export async function createApiKey(
  orgId: string,
  input: CreateApiKeyInput,
  actor?: { id: string; name: string | null; email: string | null; role: OrgRole | null },
): Promise<CreateApiKeyResult> {
  try {
    const raw = randomHex(KEY_BYTES);
    const plaintext = `${KEY_PREFIX}${raw}`;
    const hash = await sha256Hex(plaintext);
    const prefix = plaintext.slice(0, 12);

    const apiKey: OrgApiKey = {
      id: randomHex(8),
      label: input.label.slice(0, 80) || 'Untitled key',
      prefix,
      scopes: input.scopes.slice(0, 20),
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    };

    // Store the key metadata + hash on the org doc. We use arrayUnion so we
    // can append without a read-modify-write race.
    await updateDoc(doc(db, 'organizations', orgId), {
      apiKeys: arrayUnion({
        ...apiKey,
        hash, // never the plaintext
      }),
      updatedAt: serverTimestamp(),
    });

    await logAuditEvent({
      organizationId: orgId,
      category: 'api_key',
      action: 'api_key.created',
      summary: `Created API key "${apiKey.label}" (${prefix}…)`,
      severity: 'warning',
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
      targetType: 'api_key',
      targetId: apiKey.id,
      metadata: { label: apiKey.label, scopes: apiKey.scopes },
    });

    return { apiKey, plaintext, error: null };
  } catch (err) {
    return {
      apiKey: null,
      plaintext: null,
      error: err instanceof Error ? err.message : 'Could not create API key.',
    };
  }
}

/**
 * Revoke an API key (soft-delete — sets `revokedAt`). The key metadata stays
 * in the array for historical reference but is rejected on auth.
 */
export async function revokeApiKey(
  orgId: string,
  keyId: string,
  actor?: { id: string; name: string | null; email: string | null; role: OrgRole | null },
): Promise<{ error: string | null }> {
  try {
    const snap = await getDoc(doc(db, 'organizations', orgId));
    if (!snap.exists()) return { error: 'Organization not found.' };
    const data = snap.data() as OrganizationDoc;
    const keys = data.apiKeys ?? [];
    const target = keys.find((k) => k.id === keyId);
    if (!target) return { error: 'API key not found.' };

    // Remove the old entry and add the revoked version (arrayRemove + arrayUnion
    // in the same write would race; do a single updateDoc with the new array).
    const updatedKeys = keys.map((k) =>
      k.id === keyId ? { ...k, revokedAt: new Date().toISOString() } : k,
    );
    // Clean up: remove old entry then add updated entry atomically isn't safe
    // with array helpers, so we replace the whole array field.
    await updateDoc(doc(db, 'organizations', orgId), {
      apiKeys: updatedKeys,
      updatedAt: serverTimestamp(),
    });

    await logAuditEvent({
      organizationId: orgId,
      category: 'api_key',
      action: 'api_key.revoked',
      summary: `Revoked API key "${target.label}" (${target.prefix}…)`,
      severity: 'critical',
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
      targetType: 'api_key',
      targetId: keyId,
    });

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not revoke API key.' };
  }
}

// ─── Member management (extended) ────────────────────────────────────────────

export interface MemberActionResult {
  error: string | null;
}

/**
 * Suspend a member (status → `suspended`). They lose access immediately but
 * can be reactivated. Owner/admin/manager only — enforced by the caller.
 */
export async function suspendMember(
  orgId: string,
  userId: string,
  actor?: { id: string; name: string | null; email: string | null; role: OrgRole | null },
): Promise<MemberActionResult> {
  try {
    await updateDoc(doc(db, 'organization_members', `${orgId}_${userId}`), {
      status: 'suspended' as MemberStatus,
      updatedAt: serverTimestamp(),
    });
    await logAuditEvent({
      organizationId: orgId,
      category: 'member',
      action: 'member.suspended',
      summary: `Suspended member ${userId}`,
      severity: 'warning',
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
      targetType: 'member',
      targetId: userId,
    });
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not suspend member.' };
  }
}

/**
 * Reactivate a suspended member (status → `active`).
 */
export async function reactivateMember(
  orgId: string,
  userId: string,
  actor?: { id: string; name: string | null; email: string | null; role: OrgRole | null },
): Promise<MemberActionResult> {
  try {
    await updateDoc(doc(db, 'organization_members', `${orgId}_${userId}`), {
      status: 'active' as MemberStatus,
      updatedAt: serverTimestamp(),
    });
    await logAuditEvent({
      organizationId: orgId,
      category: 'member',
      action: 'member.reactivated',
      summary: `Reactivated member ${userId}`,
      severity: 'info',
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
      targetType: 'member',
      targetId: userId,
    });
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not reactivate member.' };
  }
}

// ─── Re-export audit helpers for convenience ─────────────────────────────────

export { logAuditEvent, listAuditEvents, getAuditSummary } from './audit';
export type { AuditCategory, AuditLogEntry, AuditSummary } from './audit';

// ─── Avoid unused-import lint (arrayRemove kept for future parity) ──────────
void arrayRemove;
