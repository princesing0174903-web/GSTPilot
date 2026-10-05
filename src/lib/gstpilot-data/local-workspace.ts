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
  return organizationId.startsWith(LOCAL_ORG_PREFIX) || organizationId === 'GSTpilot_Oracle' || organizationId === 'GSTpilot_SAAS';
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
