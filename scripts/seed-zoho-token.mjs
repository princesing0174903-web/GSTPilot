// Insert a simulated Zoho token (encrypted) into the DB for testing.
// This uses the REAL crypto module + REAL Zoho org ID format.
// The access_token is a FAKE that will be rejected by Zoho API → tests error handling.
import { PrismaClient } from '@prisma/client';
import { encrypt } from '../src/lib/integrations/zoho-books/crypto.ts';

const db = new PrismaClient();
const ORG_ID = 'cmr3bdpjf0000q4prznyhsxlu';
const USER_ID = 'test-zoho-user';
const ZOHO_ORG_ID = '60000000001'; // fake Zoho org ID (11-digit format)
const ZOHO_ORG_NAME = 'GSTPilot Demo Firm (Test)';

const FAKE_ACCESS_TOKEN = '1000.test.fake.access.token.for.testing.error.handling';
const FAKE_REFRESH_TOKEN = '1000.test.fake.refresh.token.for.testing';

// Token expired 1 hour ago → forces refresh attempt on first API call
const expiryDate = new Date(Date.now() - 60 * 60 * 1000);

console.log("=== Seeding simulated Zoho token (encrypted) ===");
console.log(`  org: ${ORG_ID}`);
console.log(`  zohoOrgId: ${ZOHO_ORG_ID}`);
console.log(`  zohoOrgName: ${ZOHO_ORG_NAME}`);
console.log(`  expiryDate: ${expiryDate.toISOString()} (expired 1h ago → forces refresh)`);

const encryptedAccess = encrypt(FAKE_ACCESS_TOKEN);
const encryptedRefresh = encrypt(FAKE_REFRESH_TOKEN);

console.log(`  accessToken encrypted: ${encryptedAccess.slice(0,40)}... (${encryptedAccess.length} chars)`);
console.log(`  refreshToken encrypted: ${encryptedRefresh.slice(0,40)}... (${encryptedRefresh.length} chars)`);

// Clean up any existing token for this org/user
await db.zohoBooksToken.deleteMany({ where: { organizationId: ORG_ID, userId: USER_ID } });

const token = await db.zohoBooksToken.create({
  data: {
    organizationId: ORG_ID,
    userId: USER_ID,
    userEmail: 'founder@gstpilot.in',
    zohoUserId: '12345678',
    zohoOrgId: ZOHO_ORG_ID,
    zohoOrgName: ZOHO_ORG_NAME,
    accessToken: encryptedAccess,
    refreshToken: encryptedRefresh,
    expiryDate,
    scope: 'ZohoBooks.fullaccess.all',
    tokenType: 'Bearer',
    apiDomain: 'https://www.zohoapis.in',
    dataCenter: 'in',
    connectedAt: new Date(),
  },
});

console.log(`\n✓ Token stored (id: ${token.id})`);
console.log(`  accessToken in DB is ENCRYPTED (not plaintext): ${token.accessToken !== FAKE_ACCESS_TOKEN}`);
console.log(`  refreshToken in DB is ENCRYPTED (not plaintext): ${token.refreshToken !== FAKE_REFRESH_TOKEN}`);

// Verify we can decrypt it back
import { decrypt } from '../src/lib/integrations/zoho-books/crypto.ts';
const decAccess = decrypt(token.accessToken);
const decRefresh = decrypt(token.refreshToken);
console.log(`  decrypt(accessToken) === original: ${decAccess === FAKE_ACCESS_TOKEN}`);
console.log(`  decrypt(refreshToken) === original: ${decRefresh === FAKE_REFRESH_TOKEN}`);

await db.$disconnect();
