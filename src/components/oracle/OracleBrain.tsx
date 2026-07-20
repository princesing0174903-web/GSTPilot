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
// ═══════════════════════════════════════════════════════════════════════════════

import { useOrg } from '@/contexts/OrgContext';
import { OracleBrainCore } from './OracleBrainCore';

export function OracleBrain() {
  const { organization, isPreviewMode } = useOrg();
  const orgId = organization?.id ?? null;
  return <OracleBrainCore orgId={orgId} isPreviewMode={isPreviewMode} />;
}

export default OracleBrain;
