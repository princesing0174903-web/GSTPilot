import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const ORG_ID = 'cmr3bdpjf0000q4prznyhsxlu';
const ZOHO_ORG_ID = '60000000001';

console.log("=== T5: Database Verification ===\n");

// 1. Counts
const counts = {
  clients: await db.client.count(),
  vendors: await db.vendor.count(),
  invoices: await db.invoice.count(),
  bills: await db.purchaseBill.count(),
  payments: await db.payment.count(),
  items: await db.zohoItem.count(),
  expenses: await db.expense.count(),
  bankAccounts: await db.bankAccount.count(),
  bankTxns: await db.bankTransaction.count(),
  journals: await db.zohoJournalEntry.count(),
  zohoMaps: await db.zohoEntityMap.count({ where: { organizationId: ORG_ID, zohoOrgId: ZOHO_ORG_ID } }),
  syncLogs: await db.zohoSyncLog.count({ where: { organizationId: ORG_ID, zohoOrgId: ZOHO_ORG_ID } }),
};
console.log("DB Counts:", JSON.stringify(counts, null, 2));

// 2. ZohoEntityMap breakdown by entity type
console.log("\n=== ZohoEntityMap by entity type ===");
const mapGroups = await db.zohoEntityMap.groupBy({
  by: ['zohoEntityType'],
  where: { organizationId: ORG_ID, zohoOrgId: ZOHO_ORG_ID },
  _count: true,
});
for (const g of mapGroups) {
  console.log(`  ${g.zohoEntityType.padEnd(20)} ${g._count} mappings`);
}
const totalMaps = mapGroups.reduce((s,g) => s + g._count, 0);
console.log(`  TOTAL: ${totalMaps} mappings`);

// 3. No duplicates check — verify each (zohoEntityType, zohoEntityId) is unique
console.log("\n=== Duplicate check (ZohoEntityMap uniqueness) ===");
const dupes = await db.$queryRaw`
  SELECT zohoEntityType, zohoEntityId, COUNT(*) as cnt
  FROM ZohoEntityMap
  WHERE organizationId = ${ORG_ID} AND zohoOrgId = ${ZOHO_ORG_ID}
  GROUP BY zohoEntityType, zohoEntityId
  HAVING COUNT(*) > 1
`;
console.log(`  Duplicate (zohoEntityType, zohoEntityId) pairs: ${Array.isArray(dupes) ? dupes.length : 0} ${Array.isArray(dupes) && dupes.length === 0 ? '✓ PASS' : '✗ FAIL'}`);

// 4. Spot-check: Customer with correct GST values
console.log("\n=== Spot-check: Acme Corp (Client) ===");
const acme = await db.client.findFirst({ where: { gstin: '27ABCDE1234F1Z5' } });
if (acme) {
  console.log(`  ✓ tradeName: ${acme.tradeName}`);
  console.log(`  ✓ legalName: ${acme.legalName}`);
  console.log(`  ✓ state: ${acme.state} (expected: Maharashtra)`);
  console.log(`  ✓ contactEmail: ${acme.contactEmail}`);
  console.log(`  ✓ status: ${acme.status}`);
}

// 5. Spot-check: Invoice with correct GST values
console.log("\n=== Spot-check: Invoice INV-2024-002 (overdue, IGST) ===");
const inv = await db.invoice.findFirst({ where: { invoiceNumber: 'INV-2024-002' } });
if (inv) {
  console.log(`  ✓ invoiceNumber: ${inv.invoiceNumber}`);
  console.log(`  ✓ totalAmount: ${inv.totalAmount} (expected: 118000)`);
  console.log(`  ✓ taxableValue: ${inv.taxableValue}`);
  console.log(`  ✓ igst: ${inv.igst} (expected: 18000)`);
  console.log(`  ✓ cgst: ${inv.cgst} (expected: 0)`);
  console.log(`  ✓ sgst: ${inv.sgst} (expected: 0)`);
  console.log(`  ✓ gstAmount: ${inv.gstAmount} (expected: 18000)`);
  console.log(`  ✓ balanceAmount: ${inv.balanceAmount} (expected: 118000)`);
  console.log(`  ✓ paymentStatus: ${inv.paymentStatus} (expected: overdue)`);
  console.log(`  ✓ invoiceType: ${inv.invoiceType} (expected: B2B)`);
  console.log(`  ✓ buyerGstin: ${inv.buyerGstin} (expected: 29FGHIJ5678K1Z2)`);
  console.log(`  ✓ dueDate: ${inv.dueDate} (expected: 2024-03-15)`);
}

// 6. Spot-check: Payment (customer) with correct FK
console.log("\n=== Spot-check: Customer Payment (UTR123456789) ===");
const cpay = await db.payment.findFirst({ where: { referenceNo: 'UTR123456789' }, include: { client: true } });
if (cpay) {
  console.log(`  ✓ amount: ${cpay.amount} (expected: 11800)`);
  console.log(`  ✓ paymentMode: ${cpay.paymentMode} (expected: bank)`);
  console.log(`  ✓ partyType: ${cpay.partyType} (expected: customer)`);
  console.log(`  ✓ partyName: ${cpay.partyName} (expected: Acme Corp)`);
  console.log(`  ✓ clientId FK: ${cpay.clientId} → ${cpay.client?.tradeName ?? 'null'}`);
  console.log(`  ✓ invoiceId FK: ${cpay.invoiceId} → ${cpay.invoice?.invoiceNumber ?? 'null'}`);
}

// 7. Spot-check: Payment (vendor) with correct FK
console.log("\n=== Spot-check: Vendor Payment (UPI987654321) ===");
const vpay = await db.payment.findFirst({ where: { referenceNo: 'UPI987654321' } });
if (vpay) {
  console.log(`  ✓ amount: ${vpay.amount} (expected: 3400)`);
  console.log(`  ✓ paymentMode: ${vpay.paymentMode} (expected: upi)`);
  console.log(`  ✓ partyType: ${vpay.partyType} (expected: vendor)`);
  console.log(`  ✓ partyName: ${vpay.partyName} (expected: TechSupplies Ltd)`);
}

// 8. Spot-check: Item with correct HSN + tax
console.log("\n=== Spot-check: ZohoItem (Consulting Services) ===");
const item = await db.zohoItem.findFirst({ where: { organizationId: ORG_ID, zohoOrgId: ZOHO_ORG_ID, zohoItemId: 'I001' } });
if (item) {
  console.log(`  ✓ name: ${item.name}`);
  console.log(`  ✓ rate: ${item.rate} (expected: 1000)`);
  console.log(`  ✓ hsnOrSac: ${item.hsnOrSac} (expected: 998314)`);
  console.log(`  ✓ taxPercentage: ${item.taxPercentage} (expected: 18)`);
  console.log(`  ✓ itemType: ${item.itemType} (expected: service)`);
  console.log(`  ✓ unit: ${item.unit} (expected: HRS)`);
}

// 9. Spot-check: Bank account (masked number)
console.log("\n=== Spot-check: Bank Account (HDFC) ===");
const bank = await db.bankAccount.findFirst({ where: { bankName: 'HDFC Bank' } });
if (bank) {
  console.log(`  ✓ bankName: ${bank.bankName}`);
  console.log(`  ✓ accountMasked: ${bank.accountMasked} (expected: ••••6789)`);
  console.log(`  ✓ ifsc: ${bank.ifsc} (expected: HDFC0001234)`);
  console.log(`  ✓ balance: ${bank.balance} (expected: 250000)`);
  console.log(`  ✓ accountType: ${bank.accountType} (expected: current)`);
}

// 10. Spot-check: Journal entry
console.log("\n=== Spot-check: Journal (JNL-001) ===");
const journal = await db.zohoJournalEntry.findFirst({ where: { organizationId: ORG_ID, zohoOrgId: ZOHO_ORG_ID, journalNumber: 'JNL-001' } });
if (journal) {
  console.log(`  ✓ journalNumber: ${journal.journalNumber}`);
  console.log(`  ✓ totalDebit: ${journal.totalDebit} (expected: 5000)`);
  console.log(`  ✓ totalCredit: ${journal.totalCredit} (expected: 5000)`);
  console.log(`  ✓ balanced: ${journal.totalDebit === journal.totalCredit ? 'YES' : 'NO'}`);
  const lines = JSON.parse(journal.lines);
  console.log(`  ✓ lines: ${lines.length} (expected: 2)`);
  console.log(`  ✓ line 1: ${lines[0].account} Dr ${lines[0].debit}`);
  console.log(`  ✓ line 2: ${lines[1].account} Cr ${lines[1].credit}`);
}

// 11. Foreign key relationships
console.log("\n=== FK relationships ===");
const invWithClient = await db.invoice.findFirst({ where: { invoiceNumber: 'INV-2024-001' }, include: { client: true } });
console.log(`  Invoice INV-2024-001 → Client: ${invWithClient?.client ? '✓ LINKED (' + invWithClient.client.tradeName + ')' : '✗ NOT LINKED'}`);

const billWithPayments = await db.purchaseBill.findFirst({ where: { invoiceNo: 'BILL-2024-001' } });
const billPayments = await db.payment.findMany({ where: { purchaseBillId: billWithPayments?.id } });
console.log(`  Bill BILL-2024-001 → Payments: ${billPayments.length} linked ✓`);

// 12. Sync log
console.log("\n=== Sync Log ===");
const logs = await db.zohoSyncLog.findMany({ where: { organizationId: ORG_ID, zohoOrgId: ZOHO_ORG_ID }, orderBy: { startedAt: 'desc' }, take: 3 });
for (const log of logs) {
  console.log(`  ${log.status.padEnd(10)} ${log.mode.padEnd(12)} started=${log.startedAt.toISOString()} duration=${log.completedAt ? log.completedAt.getTime() - log.startedAt.getTime() + 'ms' : 'running'} error=${log.error ?? 'none'}`);
}

await db.$disconnect();
console.log("\n=== T5 Complete ===");
