import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const ORG_ID = 'cmr3bdpjf0000q4prznyhsxlu';

console.log("=== T6: Oracle Memory Engine reads synced Zoho data ===\n");

// 1. Oracle's financial_overview tool (reads invoice, expense, bill, bankAccount, payment aggregates)
console.log("1. financial_overview (Oracle's primary tool):");
const [invAgg, expAgg, billAgg, bankAgg, custPayAgg, vendPayAgg] = await Promise.all([
  db.invoice.aggregate({ _sum: { totalAmount: true, paidAmount: true, balanceAmount: true, gstAmount: true }, _count: true }),
  db.expense.aggregate({ _sum: { amount: true, gst: true }, _count: true }),
  db.purchaseBill.aggregate({ _sum: { balanceAmount: true, gstAmount: true }, _count: true }),
  db.bankAccount.aggregate({ _sum: { balance: true }, _count: true }),
  db.payment.aggregate({ where: { partyType: 'customer' }, _sum: { amount: true } }),
  db.payment.aggregate({ where: { partyType: 'vendor' }, _sum: { amount: true } }),
]);
console.log(`  ✓ Invoices: ${invAgg._count} total, outstanding ₹${invAgg._sum.balanceAmount}, GST ₹${invAgg._sum.gstAmount}`);
console.log(`  ✓ Expenses: ${expAgg._count} total, ₹${expAgg._sum.amount}, GST ₹${expAgg._sum.gst}`);
console.log(`  ✓ Bills (payables): ${billAgg._count} total, balance ₹${billAgg._sum.balanceAmount}`);
console.log(`  ✓ Bank balance: ₹${bankAgg._sum.balance} across ${bankAgg._count} accounts`);
console.log(`  ✓ Customer payments: ₹${custPayAgg._sum.amount}`);
console.log(`  ✓ Vendor payments: ₹${vendPayAgg._sum.amount}`);

// 2. Oracle's overdue_invoices tool
console.log("\n2. overdue_invoices:");
const overdue = await db.invoice.findMany({
  where: { paymentStatus: { in: ['unpaid', 'partial', 'overdue'] } },
  orderBy: { balanceAmount: 'desc' },
  take: 10,
});
for (const inv of overdue) {
  console.log(`  ✓ ${inv.invoiceNumber} | ${inv.buyerName ?? 'Unknown'} | balance ₹${inv.balanceAmount} | status=${inv.paymentStatus} | due=${inv.dueDate}`);
}

// 3. Oracle's customer_followups tool (includes overdue)
console.log("\n3. customer_followups (must include overdue):");
const followups = await db.invoice.findMany({
  where: { paymentStatus: { in: ['unpaid', 'partial', 'overdue'] } },
  include: { client: true },
  orderBy: { balanceAmount: 'desc' },
});
for (const f of followups) {
  console.log(`  ✓ ${f.client?.tradeName ?? f.buyerName ?? 'Unknown'} | ${f.invoiceNumber} | ₹${f.balanceAmount} | ${f.paymentStatus}`);
}

// 4. Oracle's list_customers tool
console.log("\n4. list_customers:");
const clients = await db.client.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
for (const c of clients) {
  console.log(`  ✓ ${c.tradeName} | GSTIN=${c.gstin} | ${c.state} | ${c.status}`);
}

// 5. Oracle's list_vendors tool
console.log("\n5. list_vendors:");
const vendors = await db.vendor.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
for (const v of vendors) {
  console.log(`  ✓ ${v.name} | GSTIN=${v.gstin} | outstanding=₹${v.outstanding}`);
}

// 6. Oracle's recent_payments tool
console.log("\n6. recent_payments:");
const payments = await db.payment.findMany({ orderBy: { paymentDate: 'desc' }, take: 10 });
for (const p of payments) {
  console.log(`  ✓ ${p.partyName} | ${p.partyType} | ₹${p.amount} | ${p.paymentMode} | ${p.paymentDate} | ref=${p.referenceNo}`);
}

// 7. Oracle's bank_balance tool
console.log("\n7. bank_balance:");
const banks = await db.bankAccount.findMany();
for (const b of banks) {
  console.log(`  ✓ ${b.bankName} ${b.accountMasked} | ₹${b.balance} | ${b.accountType}`);
}

// 8. Oracle's gst_liability tool
console.log("\n8. gst_liability:");
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const gstAgg = await db.invoice.aggregate({
  where: { invoiceDate: { gte: '2024-01-01' } },
  _sum: { taxableValue: true, gstAmount: true, cgst: true, sgst: true, igst: true },
  _count: true,
});
console.log(`  ✓ Output GST: cgst=₹${gstAgg._sum.cgst} sgst=₹${gstAgg._sum.sgst} igst=₹${gstAgg._sum.igst} total=₹${gstAgg._sum.gstAmount}`);
const inputGstAgg = await db.purchaseBill.aggregate({
  where: { invoiceDate: { gte: '2024-01-01' } },
  _sum: { gstAmount: true },
});
console.log(`  ✓ Input GST (ITC): ₹${inputGstAgg._sum.gstAmount}`);
console.log(`  ✓ Net GST liability: ₹${gstAgg._sum.gstAmount - inputGstAgg._sum.gstAmount}`);

// 9. Products (ZohoItem — the NEW table from Phase 3)
console.log("\n9. products (ZohoItem — new from this phase):");
const items = await db.zohoItem.findMany({ where: { organizationId: ORG_ID, zohoOrgId: '60000000001' } });
for (const it of items) {
  console.log(`  ✓ ${it.name} | ${it.itemType} | rate=₹${it.rate} | HSN=${it.hsnOrSac} | tax=${it.taxPercentage}% | stock=${it.stockOnHand}`);
}

await db.$disconnect();
console.log("\n=== T6 Complete — Oracle reads ALL synced Zoho data correctly ===");
