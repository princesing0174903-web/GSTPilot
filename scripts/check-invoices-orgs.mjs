import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

console.log('=== Total invoice count ===');
const total = await db.invoice.count();
console.log(total);

console.log('\n=== Sample invoices (first 5) ===');
const sample = await db.invoice.findMany({
  take: 5,
  select: {
    id: true,
    invoiceNumber: true,
    clientId: true,
    totalAmount: true,
    balanceAmount: true,
    paidAmount: true,
    status: true,
    paymentStatus: true,
    createdAt: true,
    invoiceDate: true,
    client: { select: { id: true, tradeName: true, firmId: true } },
  },
});
console.log(JSON.stringify(sample, null, 2));

console.log('\n=== Distinct firmId values on Client rows that have invoices ===');
const firms = await db.client.findMany({
  where: { invoices: { some: {} } },
  select: { id: true, tradeName: true, firmId: true },
});
console.log(`Total clients with invoices: ${firms.length}`);
const grouped = {};
for (const f of firms) {
  const key = f.firmId ?? '(null)';
  grouped[key] = (grouped[key] ?? 0) + 1;
}
console.log('Grouped by firmId:');
console.log(JSON.stringify(grouped, null, 2));

console.log('\n=== Revenue sum (no FY filter, by client.firmId) ===');
const allFirmAgg = await db.invoice.aggregate({
  _sum: { totalAmount: true, balanceAmount: true, paidAmount: true },
  _count: true,
});
console.log(JSON.stringify(allFirmAgg, null, 2));

console.log('\n=== Per-firmId revenue (no FY filter) ===');
const clients = await db.client.findMany({
  where: { firmId: { not: null } },
  select: { id: true, firmId: true, tradeName: true },
});
console.log(`Total clients with firmId: ${clients.length}`);

// Group client IDs by firmId
const byFirm = {};
for (const c of clients) {
  if (!byFirm[c.firmId]) byFirm[c.firmId] = [];
  byFirm[c.firmId].push(c.id);
}

for (const [firmId, clientIds] of Object.entries(byFirm)) {
  const agg = await db.invoice.aggregate({
    where: { clientId: { in: clientIds } },
    _sum: { totalAmount: true },
    _count: true,
  });
  console.log(`  firmId=${firmId}: count=${agg._count}, sum=${agg._sum.totalAmount ?? 0}`);
}

// Also check FY-filtered sum
const fyStart = new Date(new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear(), 3, 1);
console.log(`\n=== FY filter check (fyStart=${fyStart.toISOString()}) ===`);
const fyAgg = await db.invoice.aggregate({
  where: { createdAt: { gte: fyStart } },
  _sum: { totalAmount: true },
  _count: true,
});
console.log(`All invoices in FY: count=${fyAgg._count}, sum=${fyAgg._sum.totalAmount ?? 0}`);

const beforeFyAgg = await db.invoice.aggregate({
  where: { createdAt: { lt: fyStart } },
  _sum: { totalAmount: true },
  _count: true,
});
console.log(`All invoices BEFORE FY: count=${beforeFyAgg._count}, sum=${beforeFyAgg._sum.totalAmount ?? 0}`);

await db.$disconnect();
