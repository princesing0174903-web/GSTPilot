'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — useOrgUserHeaders()
// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE canonical React hook that builds the `x-gstpilot-orgid` +
// `x-gstpilot-actor` JSON header pair every authenticated API route expects.
//
// Before Batch 5 the same builder existed in three places:
//   • src/hooks/useZohoBooks.ts        (buildHeaders)
//   • src/hooks/useGoogleWorkspace.ts   (buildHeaders)
//   • src/hooks/useConnectedSources.ts  (useOrgUserHeaders)
// …each with subtly different memoization + identity. This file is now the
// canonical source. The integration hooks delegate to it.
//
// WHY A HOOK
//   The header values come from two React contexts (`useAuth` + `useOrg`) —
//   reading them outside a hook would require either a global store or
//   passing the values down as props. A hook is the simplest in-tree
//   solution that stays inside React's render-flow.
//
// SECURITY NOTE
//   • This hook never persists credentials to localStorage. It only reads
//     the org id + actor from in-memory React context. The server's
//     `requireAuth()` is the authoritative security boundary.
//   • `contextReady === false` means the workspace hasn't resolved yet —
//     callers MUST NOT fire requests in this state (the routes will
//     return 400 NO_ORG_CONTEXT anyway).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * The canonical actor header payload shape. Server-side
 * `resolveOrgUserFromHeaders()` reads `uid` and `email` (required) and
 * tolerates the optional `name`/`role` fields. We always send all four so
 * downstream audit-log code can attribute actions to a real human.
 */
export interface GstpilotActorPayload {
  uid: string;
  email: string;
  name: string | null;
  role: string | null;
}

/**
 * Build the canonical auth+org header set as a plain object.
 *
 * Returns `{ headers, contextReady }` so callers can guard before firing
 * requests. `headers` is always returned (with empty strings when context
 * hasn't resolved) — but callers MUST check `contextReady` first and skip
 * the request if false.
 */
export interface OrgUserHeadersResult {
  /** The headers object (Content-Type + x-gstpilot-orgid + x-gstpilot-actor). */
  headers: Record<string, string>;
  /** True iff both orgId + userId are present. */
  contextReady: boolean;
  /** The resolved org id (null if not ready). */
  orgId: string | null;
  /** The resolved user id (null if not ready). */
  userId: string | null;
}

export function useOrgUserHeaders(): () => OrgUserHeadersResult {
  const { organization, membership, role } = useOrg();
  const { user } = useAuth();

  const orgId = organization?.id ?? null;
  const userId = user?.id ?? membership?.userId ?? null;
  const contextReady = Boolean(orgId && userId);

  return useCallback(() => {
    const actor: GstpilotActorPayload = {
      uid: userId ?? '',
      email: user?.email ?? membership?.userEmail ?? '',
      name: user?.name ?? membership?.userDisplayName ?? null,
      role: role ?? null,
    };
    return {
      headers: {
        'Content-Type': 'application/json',
        'x-gstpilot-orgid': orgId ?? '',
        'x-gstpilot-actor': JSON.stringify(actor),
      },
      contextReady,
      orgId,
      userId,
    };
  }, [orgId, userId, user, membership, role, contextReady]);
}

export default useOrgUserHeaders;
