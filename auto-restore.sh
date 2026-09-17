#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# GSTPilot Infinity™ — Sandbox Reset Auto-Restore
# ═══════════════════════════════════════════════════════════════════════════════
# The Z.ai sandbox periodically resets /home/z/my-project/.env back to only
# DATABASE_URL and deletes src/lib/gstpilot-data/local-workspace.ts. This
# script restores both BEFORE the dev server starts, so the app always boots
# with the correct Google + Zoho + Gemini credentials and the local-workspace
# module that 13+ hooks depend on.
#
# This script is idempotent — it only writes what's missing, never overwrites
# existing values. It's called by the dev script (package.json "dev") before
# `next dev` runs.
# ═══════════════════════════════════════════════════════════════════════════════

set -e
cd /home/z/my-project

# ─── 1. Restore .env if GOOGLE_CLIENT_ID is missing ──────────────────────────
if ! grep -q "^GOOGLE_CLIENT_ID=" .env 2>/dev/null; then
  echo "[auto-restore] .env missing Google credentials — restoring..."
  cat > .env << 'ENV_EOF'
# ═══════════════════════════════════════════════════════════════════════════════
# GSTPilot Infinity™ — Runtime Environment (DEV)
# ═══════════════════════════════════════════════════════════════════════════════

DATABASE_URL=file:/home/z/my-project/db/custom.db
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ─── Google Workspace OAuth ──────────────────────────────────────────────────
GOOGLE_CLIENT_ID=44040248808-3v5kgq04ghog7uddc4n51mps0jr8r946.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# ─── Zoho Books OAuth ─────────────────────────────────────────────────────────
ZOHO_CLIENT_ID=1000.KO5C1LU7AWX944NFH7GDGD6DMOI0MB
ZOHO_CLIENT_SECRET=4a105deba4d40600f7578097dd044c010393ff6e9a
ZOHO_DC=in
ZOHO_REDIRECT_URI=http://localhost:3000/api/integrations/zoho/callback
ZOHO_REDIRECT_URI_DYNAMIC=true

# ─── GitHub OAuth App (Sign In with GitHub) ─────────────────────────────────
# Required for the "Continue with GitHub" button on the login page.
# These are the REAL GitHub App credentials (GSTPilot Infinity GitHub App).
# The Client ID is public (appears in the OAuth URL); the Client Secret is
# server-side only and never sent to the browser, never logged, never stored
# in the database. auto-restore.sh only writes these values when the .env is
# being rebuilt from scratch (sandbox reset wipes the file).
GITHUB_APP_CLIENT_ID=Iv23lihNSU4aLjSsMUot
GITHUB_APP_CLIENT_SECRET=b5c34b55f8c04983f9b317d68bf85cbb84e57419
# Optional: explicit callback URL (defaults to runtime origin + /api/auth/github/callback)
# Set to the preview callback URL registered in the GitHub App so the token
# exchange matches exactly. The GitHub App's registered callback URL is:
#   https://preview-chat-79916a4d-1449-42eb-9867-d92b791821a4.space-z.ai/api/auth/github/callback
GITHUB_REDIRECT_URI=https://preview-chat-79916a4d-1449-42eb-9867-d92b791821a4.space-z.ai/api/auth/github/callback
# Optional: separate secret for signing OAuth state + session JWTs (defaults to
# a domain-separated HMAC of GITHUB_APP_CLIENT_SECRET)
# GITHUB_OAUTH_STATE_SECRET=
# SESSION_JWT_SECRET=

# ─── AI / Oracle (Gemini) ─────────────────────────────────────────────────────
AI_PROVIDER=gemini
GEMINI_API_KEY=AQ.Ab8RN6Iuse7Y5dENE2WcpJ3KD2ccJ0Yf2BuawVsIn2lhkQYxlQ
GEMINI_MODEL=gemini-2.0-flash
ENV_EOF
  echo "[auto-restore] .env restored."
else
  echo "[auto-restore] .env OK (Google credentials present)."
fi

# ─── 1b. Ensure GitHub env vars exist (idempotent — never overwrites) ────────
# If the .env was restored from an old snapshot that doesn't have GitHub vars,
# append them so the GitHub Sign-In button can detect configuration state.
if ! grep -q "^GITHUB_APP_CLIENT_ID=" .env 2>/dev/null; then
  echo "" >> .env
  echo "# ─── GitHub OAuth App (Sign In with GitHub) ─────────────────────────" >> .env
  echo "GITHUB_APP_CLIENT_ID=" >> .env
  echo "GITHUB_APP_CLIENT_SECRET=" >> .env
  echo "[auto-restore] GitHub env vars added (empty — fill in to enable GitHub Sign-In)."
fi

# ─── 2. Restore local-workspace.ts if missing ────────────────────────────────
LW="src/lib/gstpilot-data/local-workspace.ts"
if [ ! -f "$LW" ]; then
  echo "[auto-restore] $LW missing — recreating..."
  mkdir -p src/lib/gstpilot-data
  cat > "$LW" << 'LW_EOF'
// GSTPilot Infinity™ — Local Workspace Helpers
export const LOCAL_ORG_PREFIX = 'local-';

export function buildLocalOrgId(userId: string | null | undefined): string {
  const id = (userId ?? 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${LOCAL_ORG_PREFIX}${id}`;
}

export function isLocalOrgId(
  organizationId: string | null | undefined,
): boolean {
  if (!organizationId) return false;
  return organizationId.startsWith(LOCAL_ORG_PREFIX);
}

export function isPreviewOrgId(
  organizationId: string | null | undefined,
): boolean {
  return organizationId === 'preview-org';
}

export function isLocalWorkspaceSession(
  organizationId: string | null | undefined,
): boolean {
  return isLocalOrgId(organizationId) || isPreviewOrgId(organizationId);
}
LW_EOF
  echo "[auto-restore] $LW recreated."
else
  echo "[auto-restore] $LW OK."
fi

echo "[auto-restore] Done. Starting dev server..."
