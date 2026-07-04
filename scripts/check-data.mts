import { db } from '../src/lib/db'

async function main() {
  const clients = await db.client.count()
  const invoices = await db.invoice.count()
  const vendors = await db.vendor.count()
  const employees = await db.employee.count()
  const expenses = await db.expense.count()
  const purchaseBills = await db.purchaseBill.count()
  const payables = await db.payable.count()
  const receivables = await db.receivable.count()
  const payments = await db.payment.count()
  const tdsRecords = await db.tDSRecord.count()
  const payrolls = await db.payroll.count()
  console.log({ clients, invoices, vendors, employees, expenses, purchaseBills, payables, receivables, payments, tdsRecords, payrolls })
  const sampleClient = await db.client.findFirst({ select: { id: true, tradeName: true, gstin: true, stateCode: true, firmId: true } })
  console.log('Sample client:', sampleClient)
  const sampleInvoice = await db.invoice.findFirst({ select: { id: true, invoiceNumber: true, clientId: true, totalAmount: true, status: true, invoiceDate: true, dueDate: true } })
  console.log('Sample invoice:', sampleInvoice)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
