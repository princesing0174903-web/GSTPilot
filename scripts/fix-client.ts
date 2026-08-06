import { db } from '../src/lib/db';
async function main() {
  const updated = await db.client.updateMany({
    where: { tradeName: '7654321' },
    data: { tradeName: 'Pioneer Traders', legalName: 'Pioneer Traders Pvt Ltd' },
  });
  console.log('Updated:', updated.count, 'clients');
  const clients = await db.client.findMany({ select: { tradeName: true, gstin: true } });
  clients.forEach(c => console.log(c.tradeName, '|', c.gstin));
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
