// Test the AES-256-GCM encryption used for Zoho token storage
import { encrypt, decrypt, safeDecrypt } from '../src/lib/integrations/zoho-books/crypto.ts';

const TEST_CASES = [
  { name: 'access_token', value: '1000.abc123.fake.zoho.access.token' },
  { name: 'refresh_token', value: '1000.def456.fake.zoho.refresh.token' },
  { name: 'empty', value: '' },
  { name: 'unicode', value: '🔐-token-with-emoji-₹' },
];

console.log("=== T2.6: AES-256-GCM Encryption ===\n");
let allPass = true;
for (const tc of TEST_CASES) {
  const encrypted = encrypt(tc.value);
  const decrypted = decrypt(encrypted);
  const ok = decrypted === tc.value;
  if (!ok) allPass = false;
  console.log(`${ok ? '✓' : '✗'} ${tc.name}: encrypt → ${encrypted.slice(0,40)}... → decrypt → ${decrypted === tc.value ? 'MATCH' : 'MISMATCH'}`);
  // Verify format: base64(iv[12] || ciphertext || authTag[16])
  const parts = Buffer.from(encrypted, 'base64');
  console.log(`    encrypted length: ${encrypted.length} chars, decoded: ${parts.length} bytes (iv=12 + ct + tag=16)`);
}

console.log("\n=== T2.7: safeDecrypt (tamper detection) ===");
const enc = encrypt('secret-token');
// Tamper: flip last char
const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'B' : 'A') + enc.slice(-1);
const tamperedResult = safeDecrypt(tampered);
console.log(`${tamperedResult === null ? '✓' : '✗'} Tampered ciphertext → null (graceful): ${tamperedResult}`);

const validResult = safeDecrypt(enc);
console.log(`${validResult === 'secret-token' ? '✓' : '✗'} Valid ciphertext → original: ${validResult}`);

console.log(`\n=== T2.6+T2.7 Overall: ${allPass && tamperedResult === null && validResult === 'secret-token' ? 'PASS' : 'FAIL'} ===`);
