'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ Brain — Context Wrapper
// ═══════════════════════════════════════════════════════════════════════════════
//
// This is a thin wrapper that reads the organization from OrgContext and
// passes it as props to OracleBrainCore. The actual UI + logic lives in
// OracleBrainCore.tsx, which has NO context dependency (so it can be used
// in lightweight preview environments without pulling in Firebase).
//
// The full dashboard imports THIS wrapper (via DashboardViews.tsx) because
// it already has OrgContext available. The lightweight Oracle preview
// imports OracleBrainCore directly to avoid the Firebase dependency graph.
//
// Oracle Navigation: this wrapper also wires the dashboard's setCurrentView
// (from AppContext) to OracleBrainCore's onNavigate prop — so when Oracle
// calls the `navigate` tool ("open invoices", "go to customers"), it moves
// the user through the SaaS without touching the sidebar.
//
// AUTH: this wrapper builds `getAuthHeaders` from useAuth + useOrg and passes
// it down to OracleBrainCore. This is REQUIRED because the Oracle routes
// (/api/oracle/brain, /api/oracle/brain/confirm, /api/oracle/brain/sessions,
// /api/oracle/brain/memory, /api/oracle/executive-briefing) all use
// requireAuth() + requireOrgMembership(). Without the Bearer token + org
// headers, every call returns HTTP 401 AUTH_REQUIRED.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useApp, type AppView } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { OracleBrainCore } from './OracleBrainCore';

export function OracleBrain() {
  const { organization, membership, role, isPreviewMode } = useOrg();
  const { user } = useAuth();
  const { setCurrentView } = useApp();
  const orgId = organization?.id ?? null;

  // ─── Build auth headers for Oracle API calls ──────────────────────────────
  // Called by OracleBrainCore before every fetch(). Returns BOTH:
  //   • Authorization: Bearer <Firebase ID token> (preferred — verified via
  //     Firebase Admin SDK by requireAuth)
  //   • x-gstpilot-orgid + x-gstpilot-actor (fallback when Admin SDK is
  //     unavailable, e.g. sandbox/preview — requireAuth reads these instead)
  //
  // The Firebase ID token is refreshed on each call (getIdToken() returns a
  // cached token if still valid, or fetches a fresh one if expired). This
  // prevents the hourly token-expiry 401 loop.
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {};

    // 1. Firebase Bearer token (preferred auth path — verified by Admin SDK)
    try {
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken(/* forceRefresh */ false);
        if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      }
    } catch (err) {
      console.warn('[oracle-brain] getIdToken failed:', err);
    }

    // 2. x-gstpilot-orgid + x-gstpilot-actor (fallback when Admin SDK unavailable)
    if (orgId) headers['x-gstpilot-orgid'] = orgId;
    const uid = user?.id ?? membership?.userId ?? '';
    const email = user?.email ?? membership?.userEmail ?? '';
    const name = user?.name ?? membership?.userDisplayName ?? null;
    if (uid) {
      headers['x-gstpilot-actor'] = JSON.stringify({ uid, email, name, role: role ?? null });
    }

    return headers;
  }, [orgId, user?.id, user?.email, user?.name, membership?.userId, membership?.userEmail, membership?.userDisplayName, role]);

  // Oracle Navigation handler — called when Oracle emits a `navigate` SSE event.
  // Maps the requested view string to the AppView union and switches the dashboard.
  const handleNavigate = (view: string, _entityId?: string) => {
    try {
      setCurrentView(view as AppView);
    } catch (e) {
      console.warn('[oracle] navigation failed for view:', view, e);
    }
  };

  return (
    <OracleBrainCore
      orgId={orgId}
      isPreviewMode={isPreviewMode}
      onNavigate={handleNavigate}
      getAuthHeaders={getAuthHeaders}
    />
  );
}

export default OracleBrain;
