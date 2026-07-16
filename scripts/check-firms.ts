import { db } from '../src/lib/db';
async function main() {
  const firms = await db.firm.findMany({ select: { id: true, name: true } });
  console.log('Firms:', JSON.stringify(firms, null, 2));
  const clients = await db.client.findMany({ select: { id: true, tradeName: true, firmId: true, gstin: true } });
  console.log('Clients:', JSON.stringify(clients, null, 2));
  const zohoCustomers = await db.zohoCustomer.findMany({ select: { id: true, contactName: true, organizationId: true, gstNumber: true, zohoContactId: true } });
  console.log('ZohoCustomers:', JSON.stringify(zohoCustomers, null, 2));
}
main().catch(console.error).finally(() => process.exit(0));
