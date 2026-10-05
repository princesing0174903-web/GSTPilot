// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Integration · Barrel Export
//
// Single import surface for the Zoho Books module:
//   import { buildAuthUrl, getValidAccessToken, getConnectionStatus, … } from
//     '@/lib/integrations/zoho-books';
// ═══════════════════════════════════════════════════════════════════════════════

// Types (zero `any`)
export * from './types';

// AES-256-GCM token encryption
export { encrypt, decrypt, safeDecrypt } from './crypto';

// OAuth 2.0 flow + token store + auto-refresh
export {
  resolveDataCenter,
  getZohoEndpoints,
  getZohoOAuthConfig,
  resolvePublicOrigin,
  resolveRedirectUri,
  classifyRequestEnvironment,
  getRedirectUri,
  encodeState,
  decodeState,
  resolveOrgUserFromHeaders,
  buildAuthUrl,
  exchangeCodeForTokens,
  storeTokens,
  refreshOrganizationMapping,
  loadTokens,
  getValidAccessToken,
  refreshAccessToken,
  disconnectZoho,
  getConnectionStatus,
} from './oauth';
export type { ZohoRedirectEnvironment } from './oauth';

// Zoho Books REST API client (retry + never-throw)
export { zohoFetch, zohoGet, zohoPost, zohoPut, zohoDelete } from './client';
export type { ZohoFetchOptions } from './client';

// Route-auth helper (for service routes)
export { resolveZohoAuth } from './auth';
export type { ResolvedZohoAuth } from './auth';

// Service wrappers (Phase 1: organization info only)
export { listOrganizations, getPrimaryOrganization } from './services';

// Phase 2 — Data Sync (pagination + incremental + resume + audit logging)
export * from './sync';

// Phase 5 — Full 13-module sync engine + unified status reader
export { runZohoFullSync, getSyncStatusUnified } from './sync-engine';
export type {
  SyncEngineResult,
  SyncModuleResult,
  SyncMode as EngineSyncMode,
  SyncStatus as EngineSyncStatus,
  UnifiedSyncStatus,
} from './sync-engine';
