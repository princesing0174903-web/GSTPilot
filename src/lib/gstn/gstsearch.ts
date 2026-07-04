// ═══════════════════════════════════════════════════════════════════════════════
// Module 1 — GST Search™
// Search by GSTIN → verify taxpayer status + fetch business information.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { resolveGstinToBusiness, getOrCreateGstProfile, isValidGstinFormat } from './client';
import type { GSTSearchResult } from './client';

export async function searchGstin(gstin: string): Promise<GSTSearchResult> {
  if (!isValidGstinFormat(gstin)) {
    throw new Error(`Invalid GSTIN format: "${gstin}". GSTIN must be 15 characters (2 state + 10 PAN + entity + Z + checksum).`);
  }
  const result = resolveGstinToBusiness(gstin);
  // Persist to DB so it's "really" searched
  await db.gSTProfile.upsert({
    where: { gstin },
    create: {
      gstin,
      pan: result.pan,
      legalName: result.legalName,
      tradeName: result.tradeName,
      state: result.state,
      stateCode: result.stateCode,
      address: result.address,
      registrationDate: result.registrationDate,
      taxpayerType: result.taxpayerType,
      status: result.status,
      businessType: result.businessType,
      lastSyncedAt: new Date(),
    },
    update: {
      legalName: result.legalName,
      tradeName: result.tradeName,
      state: result.state,
      stateCode: result.stateCode,
      address: result.address,
      status: result.status,
      lastSyncedAt: new Date(),
    },
  });
  return result;
}

export async function getCachedProfile(gstin: string) {
  return db.gSTProfile.findUnique({ where: { gstin } });
}

export async function listSearchedProfiles() {
  return db.gSTProfile.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 });
}

export { getOrCreateGstProfile };
