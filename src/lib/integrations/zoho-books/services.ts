// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Zoho Books Service Library
//
// Phase 1 scope: ONLY the organization-info fetch used to populate the
// connection-status UI (multi-tenant organization mapping). No accounting
// data sync yet — that's Phase 2.
//
// Every function takes a pre-resolved `accessToken` (from
// `getValidAccessToken`) so the auth/refresh logic stays in oauth.ts.
// Every function returns `{ data, error, status }` and NEVER throws.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { zohoGet } from './client';
import type {
  ApiResult,
  ZohoBooksOrganizationsResponse,
  ZohoBooksOrganization,
} from './types';

// ─── Organizations (multi-tenant mapping) ───────────────────────────────────

/**
 * Fetch the list of Zoho Books organizations the connected user has access to.
 * Used by the connection-status UI to display the org name.
 */
export async function listOrganizations(
  accessToken: string,
): Promise<ApiResult<ZohoBooksOrganization[]>> {
  const res = await zohoGet<ZohoBooksOrganizationsResponse>('/organizations', accessToken);
  if (res.error || !res.data) {
    return { data: [], error: res.error, status: res.status };
  }
  return {
    data: res.data.organizations ?? [],
    error: null,
    status: res.status,
  };
}

/**
 * Fetch the user's default (or first) Zoho Books organization. Returns null
 * if the user has no organizations.
 */
export async function getPrimaryOrganization(
  accessToken: string,
): Promise<ApiResult<ZohoBooksOrganization | null>> {
  const res = await listOrganizations(accessToken);
  if (res.error) return { data: null, error: res.error, status: res.status };
  const orgs = res.data ?? [];
  if (orgs.length === 0) {
    return { data: null, error: 'No Zoho Books organizations found.', status: 200 };
  }
  const primary = orgs.find((o) => o.is_default_org) ?? orgs[0];
  if (!primary) {
    return { data: null, error: null, status: 200 };
  }
  return { data: primary, error: null, status: 200 };
}

// ─── Phase 2 placeholders (not implemented in Phase 1) ───────────────────────
//
// The following service wrappers will be added in Phase 2 — Real Data Sync:
//   • listInvoices(accessToken, zohoOrgId, opts?)
//   • listCustomers(accessToken, zohoOrgId, opts?)
//   • listVendors(accessToken, zohoOrgId, opts?)
//   • listBills(accessToken, zohoOrgId, opts?)
//   • listExpenses(accessToken, zohoOrgId, opts?)
//   • listBankAccounts(accessToken, zohoOrgId, opts?)
//   • listBankTransactions(accessToken, zohoOrgId, opts?)
//   • listJournals(accessToken, zohoOrgId, opts?)
//   • listTaxes(accessToken, zohoOrgId, opts?)
//
// Phase 1 milestone is OAuth-only: ✅ token encryption, ✅ storage,
// ✅ refresh, ✅ status. No accounting data is synced.
