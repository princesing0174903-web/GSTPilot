import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const [orgs, users, zohoTokens] = await Promise.all([
  db.platformOrganization.findMany({ take: 5, select: { id: true, name: true, slug: true } }),
  db.user.findMany({ take: 5, select: { id: true, email: true, name: true } }),
  db.zohoBooksToken.findMany({ take: 5, select: { id: true, organizationId: true, userId: true, zohoOrgId: true, zohoOrgName: true, revokedAt: true, expiryDate: true, connectedAt: true, userEmail: true, dataCenter: true } }),
]);
console.log("=== Organizations ==="); console.log(JSON.stringify(orgs, null, 2));
console.log("=== Users ==="); console.log(JSON.stringify(users, null, 2));
console.log("=== ZohoBooksTokens ==="); console.log(JSON.stringify(zohoTokens, null, 2));
console.log("=== Counts ===");
const [clients, invoices, payments, items, vendors, bills, expenses, bankAccounts, bankTxns, journals, taxes, zohoMaps, syncLogs] = await Promise.all([
  db.client.count(), db.invoice.count(), db.payment.count(), db.zohoItem.count(), db.vendor.count(),
  db.purchaseBill.count(), db.expense.count(), db.bankAccount.count(), db.bankTransaction.count(),
  db.zohoJournalEntry.count(), db.taxRule.count(),
  db.zohoEntityMap.count(), db.zohoSyncLog.count(),
]);
console.log({ clients, invoices, payments, items, vendors, bills, expenses, bankAccounts, bankTxns, journals, taxes, zohoMaps, syncLogs });
await db.$disconnect();
