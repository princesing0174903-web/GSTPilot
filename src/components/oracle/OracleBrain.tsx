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
// ═══════════════════════════════════════════════════════════════════════════════

import { useOrg } from '@/contexts/OrgContext';
import { useApp, type AppView } from '@/contexts/AppContext';
import { OracleBrainCore } from './OracleBrainCore';

export function OracleBrain() {
  const { organization, isPreviewMode } = useOrg();
  const { setCurrentView } = useApp();
  const orgId = organization?.id ?? null;

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
    />
  );
}

export default OracleBrain;
