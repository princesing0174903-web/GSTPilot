import { getInvoiceCloudState } from '../src/lib/invoices/oracle'

async function main() {
  console.log('Testing getInvoiceCloudState...')
  const state = await getInvoiceCloudState()
  console.log('Success!')
  console.log('Has live data:', state.hasLiveData)
  console.log('Invoices:', state.invoices.total, 'total revenue:', state.invoices.totalRevenue)
  console.log('Purchases:', state.purchases.total, 'eligible ITC:', state.purchases.eligibleITC)
  console.log('Expenses:', state.expenses.total, 'this month:', state.expenses.thisMonthTotal)
  console.log('Receivables:', state.receivables.total, 'outstanding:', state.receivables.totalOutstanding)
  console.log('Payables:', state.payables.total, 'due:', state.payables.totalDue)
  console.log('Payments:', state.payments.total, 'incoming:', state.payments.totalIncoming)
  console.log('TDS:', state.tds.total, 'total TDS:', state.tds.totalTDS)
  console.log('Employees:', state.payroll.totalEmployees, 'net:', state.payroll.currentMonthPayroll.totalNet)
  console.log('Analytics revenue:', state.analytics.totalRevenue, 'margin:', state.analytics.grossMarginPct + '%')
}
main().then(() => process.exit(0)).catch((e) => { console.error('FAILED:', e); process.exit(1) })
