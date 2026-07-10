// ═══════════════════════════════════════════════════════════════════════════════
// Module 2 — PAN Verification™
// Verify PAN status + detect entity type.
// ═══════════════════════════════════════════════════════════════════════════════

import { resolvePanToEntity, isValidPanFormat } from './client';
import type { PANVerifyResult } from './client';

export async function verifyPan(pan: string): Promise<PANVerifyResult> {
  if (!isValidPanFormat(pan)) {
    throw new Error(`Invalid PAN format: "${pan}". PAN must be 10 characters (5 letters + 4 digits + 1 letter, e.g. ABCDE1234F).`);
  }
  return resolvePanToEntity(pan.toUpperCase());
}
