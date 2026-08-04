import { redirect } from 'next/navigation';

// ═══════════════════════════════════════════════════════════════════════════════
// /oracle → redirect to the main app's Oracle Brain view.
//
// The standalone /oracle route previously rendered <OracleChat /> directly
// WITHOUT the AuthContext / OrgContext providers. This caused every
// /api/business/snapshot call to return 401 AUTH_REQUIRED (no x-gstpilot-actor
// header was injected because the session wasn't in localStorage).
//
// The canonical Oracle experience now lives inside the main app shell at
// view=oracle-brain (rendered by DashboardViews.tsx). It has full provider
// access (AuthContext, OrgContext, AppContext) so all API calls are properly
// authenticated. Redirecting here ensures a single, premium, authenticated
// Oracle surface.
// ═══════════════════════════════════════════════════════════════════════════════

export default function OraclePage() {
  redirect('/?view=oracle-brain');
}
