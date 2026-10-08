// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — GSTIN Checksum Validator (SERVER-SAFE, no node:crypto)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Re-implements the official GSTN checksum algorithm so we can validate GSTIN
// format WITHOUT a network call. This is used:
//   • As a pre-flight check before calling the provider's verifyGSTIN
//   • As the ONLY validation available in demo mode (no provider configured)
//
// The algorithm: each of the first 14 chars is mapped to a value (0-9 → 0-9,
// A-Z → 10-35), multiplied by an alternating factor (1,2,1,2,...), the digits
// of each product are summed, the total is mod 36, and the checksum char is
// (36 - mod) mod 36 mapped back to a char.
// ═══════════════════════════════════════════════════════════════════════════════

const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

const GST_FACTOR = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
const GST_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function computeChecksum(gstin14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const ch = gstin14[i].toUpperCase();
    const val = GST_CHARS.indexOf(ch);
    if (val < 0) return '?';
    let prod = val * GST_FACTOR[i];
    prod = Math.floor(prod / 36) + (prod % 36);
    sum += prod;
  }
  const mod = sum % 36;
  const checksum = (36 - mod) % 36;
  return GST_CHARS[checksum];
}

export interface GstinValidationResult {
  valid: boolean;
  stateCode?: string;
  stateName?: string;
}

export function validateGstinChecksum(gstin: string): GstinValidationResult {
  if (typeof gstin !== 'string' || gstin.length !== 15) return { valid: false };
  const upper = gstin.toUpperCase();
  if (!/^[0-9A-Z]{15}$/.test(upper)) return { valid: false };
  const expected = computeChecksum(upper.slice(0, 14));
  if (expected !== upper[14]) return { valid: false };
  const stateCode = upper.slice(0, 2);
  return { valid: true, stateCode, stateName: GST_STATE_CODES[stateCode] };
}

export function getStateName(stateCode: string): string | undefined {
  return GST_STATE_CODES[stateCode];
}
