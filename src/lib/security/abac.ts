// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Enterprise Security Layer: ABAC Engine
//
// Attribute-Based Access Control. Whereas RBAC decides "can this role perform
// this action on this resource type?", ABAC decides "given the caller's
// attributes (org, role, subscription) AND the target resource's attributes
// (owning org, sensitivity), should this specific request be allowed?"
//
// Combination semantics: deny-wins. RBAC must grant the (role, resource,
// action) triple first. Then ABAC runs all matching policies; if ANY matching
// policy returns `false`, the request is denied. If no matching policies
// exist, the RBAC decision stands.
//
// Built-in policies (registered by default on a new `ABACEngine`):
//   1. org-scope     — callers can only touch resources owned by their own org.
//   2. no-billing-for-viewers — viewers can never access billing, even if the
//                      RBAC matrix were to change.
//   3. no-org-delete-for-accountants — accountants can never delete orgs.
//   4. no-erp-sync-for-trials — trialing subs can't trigger ERP sync.
//   5. super-admin-bypass — super-admins bypass all ABAC denials.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ABACPolicy,
  Permission,
  Resource,
  SecurityContext,
} from './types';

// ─── Engine ──────────────────────────────────────────────────────────────────

/**
 * The ABAC engine. Holds a list of registered policies and evaluates them
 * against a security context + resource + action.
 *
 * Stateless across requests (the policies themselves are pure functions).
 * Create one engine per process (module-level singleton is fine) and register
 * policies at boot.
 */
export class ABACEngine {
  private readonly policies: ABACPolicy[] = [];

  /** Register a new policy. Returns `this` for chaining. */
  registerPolicy(policy: ABACPolicy): this {
    this.policies.push(policy);
    return this;
  }

  /** Register multiple policies at once. Returns `this` for chaining. */
  registerPolicies(policies: ABACPolicy[]): this {
    for (const p of policies) this.policies.push(p);
    return this;
  }

  /** Remove all registered policies. Returns `this` for chaining. */
  clear(): this {
    this.policies.length = 0;
    return this;
  }

  /** Returns the list of currently-registered policies (read-only view). */
  listPolicies(): readonly ABACPolicy[] {
    return this.policies;
  }

  /**
   * Evaluate whether the (ctx, resource, action) request is allowed by the
   * registered policies.
   *
   * Deny-wins: if ANY matching policy returns `false`, the request is denied.
   * If NO matching policies exist, returns `true` (ABAC defers to RBAC).
   *
   * @param ctx        — the resolved security context for the caller.
   * @param resource   — the resource being accessed.
   * @param action     — the action being performed.
   * @param resourceAttrs — optional attribute bag for the specific resource
   *                       instance (e.g. `{ ownerUid, orgId }` for a document).
   */
  evaluate(
    ctx: SecurityContext,
    resource: Resource,
    action: Permission,
    resourceAttrs?: Record<string, unknown>,
  ): boolean {
    // Super-admin bypass: super-admins skip all ABAC denials.
    if (ctx.isSuperAdmin) return true;

    let matchedAny = false;
    for (const policy of this.policies) {
      const resourceMatches =
        policy.resource === '*' || policy.resource === resource;
      const actionMatches = policy.action === '*' || policy.action === action;
      if (!resourceMatches || !actionMatches) continue;

      matchedAny = true;
      // Deny-wins: any policy returning false denies the request.
      try {
        const allowed = policy.condition(ctx, resourceAttrs);
        if (!allowed) {
          return false;
        }
      } catch {
        // A throwing policy condition is treated as a deny (fail-closed).
        return false;
      }
    }

    // If no policies matched, ABAC defers to RBAC (allow).
    // If policies matched and all returned true, allow.
    return true;
  }
}

// ─── Built-in Policies ───────────────────────────────────────────────────────

/**
 * Policy: callers can only access resources owned by their own organization.
 *
 * `resourceAttrs.orgId` is the owning org of the target resource instance.
 * If `ctx.orgId` is null (unscoped request), the policy denies.
 * If `resourceAttrs.orgId` is not provided, the policy defers (returns true)
 * — instance-level scoping only applies when the attribute is present.
 */
export const orgScopePolicy: ABACPolicy = {
  name: 'org-scope-isolation',
  resource: '*',
  action: '*',
  condition: (ctx, resourceAttrs) => {
    // No resource attributes → can't enforce instance-level scoping.
    if (!resourceAttrs || typeof resourceAttrs !== 'object') return true;
    const targetOrgId = resourceAttrs['orgId'];
    if (typeof targetOrgId !== 'string' || targetOrgId.length === 0) {
      // No `orgId` attribute → defer.
      return true;
    }
    // Caller has no org context → deny instance-scoped access.
    if (!ctx.orgId) return false;
    // Orgs must match.
    return ctx.orgId === targetOrgId;
  },
};

/**
 * Policy: viewers cannot access billing under any circumstances. Even if the
 * RBAC matrix were edited to grant viewers a billing permission, this ABAC
 * rule hard-blocks it.
 */
export const noBillingForViewersPolicy: ABACPolicy = {
  name: 'viewers-cannot-access-billing',
  resource: 'billing',
  action: '*',
  condition: (ctx) => ctx.role !== 'viewer',
};

/**
 * Policy: accountants cannot delete organizations. RBAC already omits
 * `manage_org` from the accountant row, but this is a defense-in-depth
 * ABAC rule that blocks the specific `delete` action on `organization`
 * for accountants (and viewers/members).
 */
export const noOrgDeleteForAccountantsPolicy: ABACPolicy = {
  name: 'accountants-cannot-delete-org',
  resource: 'organization',
  action: 'delete',
  condition: (ctx) => {
    return ctx.role !== 'accountant' && ctx.role !== 'viewer' && ctx.role !== 'member';
  },
};

/**
 * Policy: trial users cannot trigger ERP sync. ERP integrations are a paid
 * feature — trialing subscriptions are allowed to evaluate the dashboard
 * but not to actually push data into their ERP.
 *
 * The policy triggers on `(erp, write)` — i.e. POST/PUT to ERP routes.
 * Reads (status, connections list) are allowed.
 */
export const noErpSyncForTrialsPolicy: ABACPolicy = {
  name: 'trials-cannot-sync-erp',
  resource: 'erp',
  action: 'write',
  condition: (ctx) => {
    // Active subscriptions can sync ERP.
    if (ctx.subscriptionStatus === 'active') return true;
    // Trialing, past_due, suspended, canceled, incomplete, none → deny.
    return false;
  },
};

/**
 * Policy: super-admin bypass. Registered first so it short-circuits before
 * any other policy can deny. (Note: the engine already short-circuits on
 * `ctx.isSuperAdmin`, but this policy makes the intent explicit and audit-
 * visible.)
 */
export const superAdminBypassPolicy: ABACPolicy = {
  name: 'super-admin-bypass',
  resource: '*',
  action: '*',
  condition: (ctx) => ctx.isSuperAdmin,
};

/**
 * The default set of built-in policies, in evaluation order. Order matters
 * only for audit-log readability — deny-wins semantics mean the result is
 * the same regardless of order.
 */
export const BUILTIN_ABAC_POLICIES: ABACPolicy[] = [
  superAdminBypassPolicy,
  orgScopePolicy,
  noBillingForViewersPolicy,
  noOrgDeleteForAccountantsPolicy,
  noErpSyncForTrialsPolicy,
];

// ─── Module-level Singleton Engine ───────────────────────────────────────────

/**
 * The default ABAC engine instance. Pre-registered with the 5 built-in
 * policies. Route handlers should use this singleton; tests can construct
 * their own `ABACEngine` and register custom policies.
 */
export const defaultABACEngine: ABACEngine = new ABACEngine().registerPolicies(
  BUILTIN_ABAC_POLICIES,
);

// ─── Functional Helpers ──────────────────────────────────────────────────────

/**
 * Evaluate a request against an explicit list of policies (does NOT use the
 * singleton engine). Useful for tests and for one-off policy evaluations.
 *
 * Same deny-wins semantics as `ABACEngine.evaluate`.
 */
export function evaluateAll(
  ctx: SecurityContext,
  resource: Resource,
  action: Permission,
  policies: ABACPolicy[],
  resourceAttrs?: Record<string, unknown>,
): boolean {
  // Super-admin bypass.
  if (ctx.isSuperAdmin) return true;

  let matchedAny = false;
  for (const policy of policies) {
    const resourceMatches = policy.resource === '*' || policy.resource === resource;
    const actionMatches = policy.action === '*' || policy.action === action;
    if (!resourceMatches || !actionMatches) continue;

    matchedAny = true;
    try {
      const allowed = policy.condition(ctx, resourceAttrs);
      if (!allowed) return false;
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Convenience: evaluate against the singleton engine. Returns `true` if
 * allowed by ABAC (does NOT check RBAC — pair with `can()` from `rbac.ts`).
 */
export function abacAllows(
  ctx: SecurityContext,
  resource: Resource,
  action: Permission,
  resourceAttrs?: Record<string, unknown>,
): boolean {
  return defaultABACEngine.evaluate(ctx, resource, action, resourceAttrs);
}
