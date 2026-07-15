import { db } from '../src/lib/db';
import { mapCustomerToClient, syntheticGstinForContact } from '../src/lib/integrations/zoho-books/sync/mapper';

async function main() {
  const zohoCustomers = await db.zohoCustomer.findMany();
  console.log(`Found ${zohoCustomers.length} ZohoCustomer rows to mirror into Client table`);
  let mirrored = 0;
  for (const zc of zohoCustomers) {
    try {
      const gstin = zc.gstNumber?.trim() || syntheticGstinForContact(zc.zohoContactId);
      const contact = {
        contact_id: zc.zohoContactId,
        contact_name: zc.contactName,
        company_name: zc.companyName ?? undefined,
        gstin: zc.gstNumber ?? undefined,
        email: zc.email ?? undefined,
        phone: zc.phone ?? undefined,
        status: zc.status,
        is_taxable: true,
        billing_address: zc.billingAddress ? JSON.parse(zc.billingAddress) : undefined,
        contact_persons: [] as any[],
      } as any;
      const normalized = mapCustomerToClient(contact, `ZOHO-ORG-${zc.zohoContactId}`);
      await db.client.upsert({
        where: { gstin },
        create: {
          gstin,
          tradeName: normalized.tradeName,
          legalName: normalized.legalName,
          address: normalized.address,
          state: normalized.state,
          stateCode: normalized.stateCode,
          contactEmail: normalized.contactEmail,
          contactPhone: normalized.contactPhone,
          entityType: normalized.entityType,
          status: normalized.status,
          firmId: zc.organizationId,
        },
        update: {
          tradeName: normalized.tradeName,
          legalName: normalized.legalName,
          address: normalized.address,
          state: normalized.state,
          stateCode: normalized.stateCode,
          contactEmail: normalized.contactEmail,
          contactPhone: normalized.contactPhone,
          entityType: normalized.entityType,
          status: normalized.status,
          firmId: zc.organizationId,
        },
      });
      mirrored++;
      console.log(`  ✓ Mirrored: ${zc.contactName} (gstin=${gstin})`);
    } catch (e) {
      console.log(`  ✗ Failed: ${zc.contactName} — ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }
  console.log(`\nDone. Mirrored ${mirrored}/${zohoCustomers.length} customers into Client table.`);
  const clientCount = await db.client.count();
  console.log(`Client table now has ${clientCount} rows.`);
}
main().catch(console.error).finally(() => process.exit(0));
