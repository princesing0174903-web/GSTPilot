/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * VEYRO FinOS — Shared types + seed data for an Indian SME business.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * NOTE: `company` and `executiveKpis` are intentionally empty placeholders.
 * Hardcoded company/KPI values have been removed so the UI renders honest
 * empty states until real per-organization data is loaded.
 *
 * All modules consume this single source of truth. Mutations from the UI
 * (create invoice, mark paid, restock, etc.) are applied to an in-memory store
 * exposed via the `useFinosStore` hook so every screen stays in sync without a
 * backend round-trip. AI features augment this data via the LLM API routes.
 */

// ─── Company profile ───────────────────────────────────────────────────────────
// No hardcoded company. Real company profile is loaded per-organization from
// the database; this export is intentionally blank so consumers can render
// honest empty states until real data is available.
export const company = {
  name: '',
  legalName: '',
  gstin: '',
  pan: '',
  cin: '',
  incorporationDate: '',
  registeredAddress: '',
  financialYear: '',
  taxRegime: '',
  industry: '',
  employees: 0,
  annualRevenue: 0,
  fiscalYearStart: '',
}

// ─── KPIs for the Executive Dashboard ──────────────────────────────────────────
export interface Kpi {
  id: string
  label: string
  value: string
  rawValue: number
  rawUnit: 'inr' | 'count' | 'pct'
  changePct: number
  trend: number[] // last 7 points
  icon: string
  accent: 'emerald' | 'rose' | 'amber' | 'sky' | 'violet'
  insight: string
}

// No hardcoded KPIs. Real KPIs are computed from live financial data and
// surfaced through the executive dashboard hooks; this export is intentionally
// empty so the UI shows honest empty states.
export const executiveKpis: Kpi[] = []

// ─── Revenue trend (last 12 months) ────────────────────────────────────────────
export const revenueTrend = [
  { month: 'Aug', revenue: 14200000, expense: 9800000, profit: 4400000 },
  { month: 'Sep', revenue: 15100000, expense: 10200000, profit: 4900000 },
  { month: 'Oct', revenue: 13800000, expense: 9600000, profit: 4200000 },
  { month: 'Nov', revenue: 16200000, expense: 10800000, profit: 5400000 },
  { month: 'Dec', revenue: 18400000, expense: 12100000, profit: 6300000 },
  { month: 'Jan', revenue: 15800000, expense: 10600000, profit: 5200000 },
  { month: 'Feb', revenue: 17200000, expense: 11300000, profit: 5900000 },
  { month: 'Mar', revenue: 19600000, expense: 12800000, profit: 6800000 },
  { month: 'Apr', revenue: 17800000, expense: 11600000, profit: 6200000 },
  { month: 'May', revenue: 16500000, expense: 10900000, profit: 5600000 },
  { month: 'Jun', revenue: 18800000, expense: 12300000, profit: 6500000 },
  { month: 'Jul', revenue: 18400000, expense: 11900000, profit: 6500000 },
]

// ─── Cash flow (last 6 months) ─────────────────────────────────────────────────
export const cashFlow = [
  { month: 'Feb', inflow: 17200000, outflow: 11300000, net: 5900000 },
  { month: 'Mar', inflow: 19600000, outflow: 12800000, net: 6800000 },
  { month: 'Apr', inflow: 17800000, outflow: 11600000, net: 6200000 },
  { month: 'May', inflow: 16500000, outflow: 10900000, net: 5600000 },
  { month: 'Jun', inflow: 18800000, outflow: 12300000, net: 6500000 },
  { month: 'Jul', inflow: 18400000, outflow: 11900000, net: 6500000 },
]

// ─── GST returns ───────────────────────────────────────────────────────────────
export type ReturnStatus = 'Filed' | 'Pending' | 'Draft' | 'Overdue'

export interface GstReturn {
  id: string
  type: 'GSTR-1' | 'GSTR-3B' | 'GSTR-9' | 'GSTR-2B' | 'ITC-04'
  period: string
  dueDate: string
  status: ReturnStatus
  taxLiability: number
  inputTaxCredit: number
  netPayable: number
  filingDate?: string
  ackNo?: string
}

export const gstReturns: GstReturn[] = [
  {
    id: 'ret-001',
    type: 'GSTR-1',
    period: 'Jul 2025',
    dueDate: '2025-08-11',
    status: 'Filed',
    taxLiability: 3280000,
    inputTaxCredit: 0,
    netPayable: 3280000,
    filingDate: '2025-08-09',
    ackNo: 'AB9X23F8K7',
  },
  {
    id: 'ret-002',
    type: 'GSTR-3B',
    period: 'Jul 2025',
    dueDate: '2025-08-20',
    status: 'Pending',
    taxLiability: 3280000,
    inputTaxCredit: 790000,
    netPayable: 2490000,
  },
  {
    id: 'ret-003',
    type: 'GSTR-2B',
    period: 'Jul 2025',
    dueDate: '2025-08-12',
    status: 'Filed',
    taxLiability: 0,
    inputTaxCredit: 790000,
    netPayable: 0,
    filingDate: '2025-08-12',
    ackNo: 'AB9X24G1L2',
  },
  {
    id: 'ret-004',
    type: 'GSTR-1',
    period: 'Jun 2025',
    dueDate: '2025-07-11',
    status: 'Filed',
    taxLiability: 3040000,
    inputTaxCredit: 0,
    netPayable: 3040000,
    filingDate: '2025-07-10',
    ackNo: 'AB8X19D5M3',
  },
  {
    id: 'ret-005',
    type: 'GSTR-3B',
    period: 'Jun 2025',
    status: 'Filed',
    dueDate: '2025-07-20',
    taxLiability: 3040000,
    inputTaxCredit: 760000,
    netPayable: 2280000,
    filingDate: '2025-07-19',
    ackNo: 'AB8X20E6N4',
  },
  {
    id: 'ret-006',
    type: 'GSTR-9',
    period: 'FY 2024-25',
    dueDate: '2025-12-31',
    status: 'Draft',
    taxLiability: 0,
    inputTaxCredit: 0,
    netPayable: 0,
  },
  {
    id: 'ret-007',
    type: 'ITC-04',
    period: 'Q1 FY 25-26',
    dueDate: '2025-07-25',
    status: 'Overdue',
    taxLiability: 0,
    inputTaxCredit: 0,
    netPayable: 0,
  },
]

// ─── Sales / Invoices ──────────────────────────────────────────────────────────
export type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Draft' | 'Cancelled'

export interface Invoice {
  id: string
  number: string
  customer: string
  customerGstin?: string
  date: string
  dueDate: string
  amount: number
  tax: number
  total: number
  status: InvoiceStatus
  paidDate?: string
  place: string
}

export const invoices: Invoice[] = [
  { id: 'inv-001', number: 'AUR-2025-0142', customer: 'Tata Technologies Ltd', customerGstin: '27AAACT1234F1Z5', date: '2025-07-28', dueDate: '2025-08-12', amount: 1240000, tax: 223200, total: 1463200, status: 'Paid', paidDate: '2025-08-09', place: 'Pune' },
  { id: 'inv-002', number: 'AUR-2025-0143', customer: 'Mahindra Group', customerGstin: '27AABCM4567G1Z2', date: '2025-07-30', dueDate: '2025-08-14', amount: 890000, tax: 160200, total: 1050200, status: 'Pending', place: 'Mumbai' },
  { id: 'inv-003', number: 'AUR-2025-0144', customer: 'L&T Construction', customerGstin: '27AAACL7890H1Z9', date: '2025-08-01', dueDate: '2025-08-16', amount: 2150000, tax: 387000, total: 2537000, status: 'Pending', place: 'Chennai' },
  { id: 'inv-004', number: 'AUR-2025-0145', customer: 'Bosch India', customerGstin: '29AABCB2345K1Z7', date: '2025-07-15', dueDate: '2025-07-30', amount: 760000, tax: 136800, total: 896800, status: 'Overdue', place: 'Bengaluru' },
  { id: 'inv-005', number: 'AUR-2025-0146', customer: 'Ashok Leyland', customerGstin: '33AAACA6789B1Z4', date: '2025-08-03', dueDate: '2025-08-18', amount: 1480000, tax: 266400, total: 1746400, status: 'Pending', place: 'Chennai' },
  { id: 'inv-006', number: 'AUR-2025-0147', customer: 'Siemens Ltd', customerGstin: '27AABCS9876L1Z8', date: '2025-08-04', dueDate: '2025-08-19', amount: 980000, tax: 176400, total: 1156400, status: 'Pending', place: 'Mumbai' },
  { id: 'inv-007', number: 'AUR-2025-0148', customer: 'Adani Power', customerGstin: '24AAACA3456P1Z1', date: '2025-07-22', dueDate: '2025-08-06', amount: 3200000, tax: 576000, total: 3776000, status: 'Paid', paidDate: '2025-08-04', place: 'Ahmedabad' },
  { id: 'inv-008', number: 'AUR-2025-0149', customer: 'Hero MotoCorp', customerGstin: '06AAACH5678M1Z3', date: '2025-08-05', dueDate: '2025-08-20', amount: 670000, tax: 120600, total: 790600, status: 'Pending', place: 'Gurugram' },
  { id: 'inv-009', number: 'AUR-2025-0150', customer: 'BHEL', customerGstin: '07AAACB1357C1Z6', date: '2025-06-28', dueDate: '2025-07-13', amount: 1850000, tax: 333000, total: 2183000, status: 'Overdue', place: 'New Delhi' },
  { id: 'inv-010', number: 'AUR-2025-0151', customer: 'ABB India', customerGstin: '29AABCA2468N1Z2', date: '2025-08-07', dueDate: '2025-08-22', amount: 1120000, tax: 201600, total: 1321600, status: 'Draft', place: 'Bengaluru' },
  { id: 'inv-011', number: 'AUR-2025-0152', customer: 'Cummins India', customerGstin: '27AAACC3691K1Z5', date: '2025-08-08', dueDate: '2025-08-23', amount: 890000, tax: 160200, total: 1050200, status: 'Pending', place: 'Pune' },
  { id: 'inv-012', number: 'AUR-2025-0153', customer: 'Thermax Ltd', customerGstin: '27AAACT1470L1Z9', date: '2025-07-25', dueDate: '2025-08-09', amount: 1450000, tax: 261000, total: 1711000, status: 'Paid', paidDate: '2025-08-08', place: 'Pune' },
]

// ─── Customers ─────────────────────────────────────────────────────────────────
export interface Customer {
  id: string
  name: string
  gstin?: string
  place: string
  phone: string
  email: string
  outstanding: number
  lifetimeValue: number
  lastInvoice?: string
  status: 'Active' | 'Inactive'
}

export const customers: Customer[] = [
  { id: 'cus-001', name: 'Tata Technologies Ltd', gstin: '27AAACT1234F1Z5', place: 'Pune', phone: '+91 20 6608 1000', email: 'ap@tatatechnologies.com', outstanding: 0, lifetimeValue: 28400000, lastInvoice: '2025-07-28', status: 'Active' },
  { id: 'cus-002', name: 'Mahindra Group', gstin: '27AABCM4567G1Z2', place: 'Mumbai', phone: '+91 22 2490 1441', email: 'accounts@mahindra.com', outstanding: 1050200, lifetimeValue: 42100000, lastInvoice: '2025-07-30', status: 'Active' },
  { id: 'cus-003', name: 'L&T Construction', gstin: '27AAACL7890H1Z9', place: 'Chennai', phone: '+91 44 2232 2222', email: 'finance@lntinfotech.com', outstanding: 2537000, lifetimeValue: 67800000, lastInvoice: '2025-08-01', status: 'Active' },
  { id: 'cus-004', name: 'Bosch India', gstin: '29AABCB2345K1Z7', place: 'Bengaluru', phone: '+91 80 2299 4444', email: 'vendor@bosch.in', outstanding: 896800, lifetimeValue: 19400000, lastInvoice: '2025-07-15', status: 'Active' },
  { id: 'cus-005', name: 'Ashok Leyland', gstin: '33AAACA6789B1Z4', place: 'Chennai', phone: '+91 44 2522 2222', email: 'ap@ashokleyland.com', outstanding: 1746400, lifetimeValue: 31200000, lastInvoice: '2025-08-03', status: 'Active' },
  { id: 'cus-006', name: 'Siemens Ltd', gstin: '27AABCS9876L1Z8', place: 'Mumbai', phone: '+91 22 6603 2222', email: 'accounts@siemens.in', outstanding: 1156400, lifetimeValue: 24500000, lastInvoice: '2025-08-04', status: 'Active' },
  { id: 'cus-007', name: 'Adani Power', gstin: '24AAACA3456P1Z1', place: 'Ahmedabad', phone: '+91 79 2656 5555', email: 'finance@adani.com', outstanding: 0, lifetimeValue: 52100000, lastInvoice: '2025-07-22', status: 'Active' },
  { id: 'cus-008', name: 'Hero MotoCorp', gstin: '06AAACH5678M1Z3', place: 'Gurugram', phone: '+91 124 2455 111', email: 'ap@heromotocorp.com', outstanding: 790600, lifetimeValue: 8900000, lastInvoice: '2025-08-05', status: 'Active' },
  { id: 'cus-009', name: 'BHEL', gstin: '07AAACB1357C1Z6', place: 'New Delhi', phone: '+91 11 2618 2222', email: 'accounts@bhel.in', outstanding: 2183000, lifetimeValue: 16200000, lastInvoice: '2025-06-28', status: 'Active' },
  { id: 'cus-010', name: 'Cummins India', gstin: '27AAACC3691K1Z5', place: 'Pune', phone: '+91 20 6740 2222', email: 'ap@cummins.in', outstanding: 1050200, lifetimeValue: 22800000, lastInvoice: '2025-08-08', status: 'Active' },
]

// ─── Purchases / Bills ─────────────────────────────────────────────────────────
export type BillStatus = 'Paid' | 'Pending' | 'Overdue' | 'Scheduled'

export interface Bill {
  id: string
  number: string
  vendor: string
  vendorGstin?: string
  date: string
  dueDate: string
  amount: number
  tax: number
  total: number
  status: BillStatus
  category: string
}

export const bills: Bill[] = [
  { id: 'bill-001', number: 'VEN-7821', vendor: 'Steel Authority of India', vendorGstin: '27AABCS0579E1Z8', date: '2025-07-20', dueDate: '2025-08-19', amount: 1240000, tax: 223200, total: 1463200, status: 'Pending', category: 'Raw Material' },
  { id: 'bill-002', number: 'JIS-4502', vendor: 'Jindal Steel & Power', vendorGstin: '21AAACJ1234M1Z3', date: '2025-07-22', dueDate: '2025-08-21', amount: 890000, tax: 160200, total: 1050200, status: 'Pending', category: 'Raw Material' },
  { id: 'bill-003', number: 'TPO-3344', vendor: 'Tata Power Ltd', vendorGstin: '27AAACT1234F1Z5', date: '2025-07-25', dueDate: '2025-08-09', amount: 312000, tax: 56160, total: 368160, status: 'Paid', category: 'Utilities' },
  { id: 'bill-004', number: 'MAH-9912', vendor: 'Mahindra Logistics', vendorGstin: '27AABCM4567G1Z2', date: '2025-07-26', dueDate: '2025-08-10', amount: 178000, tax: 32040, total: 210040, status: 'Paid', category: 'Logistics' },
  { id: 'bill-005', number: 'HCL-2287', vendor: 'HCL Technologies', vendorGstin: '29AAACH4567N1Z1', date: '2025-07-28', dueDate: '2025-08-27', amount: 450000, tax: 81000, total: 531000, status: 'Pending', category: 'IT Services' },
  { id: 'bill-006', number: 'BLU-5561', vendor: 'Blue Star Ltd', vendorGstin: '27AAACB2345P1Z2', date: '2025-07-12', dueDate: '2025-07-27', amount: 245000, tax: 44100, total: 289100, status: 'Overdue', category: 'Equipment' },
  { id: 'bill-007', number: 'SCH-1199', vendor: 'Schneider Electric', vendorGstin: '29AABCS9876L1Z8', date: '2025-08-01', dueDate: '2025-08-31', amount: 680000, tax: 122400, total: 802400, status: 'Pending', category: 'Equipment' },
  { id: 'bill-008', number: 'IOC-3340', vendor: 'Indian Oil Corp', vendorGstin: '27AAACI4567O1Z1', date: '2025-08-02', dueDate: '2025-09-01', amount: 156000, tax: 28080, total: 184080, status: 'Scheduled', category: 'Fuel' },
  { id: 'bill-009', number: 'ASO-7782', vendor: 'Asian Paints', vendorGstin: '27AAACA6789B1Z4', date: '2025-08-04', dueDate: '2025-09-03', amount: 98000, tax: 17640, total: 115640, status: 'Scheduled', category: 'Consumables' },
]

// ─── Vendors ───────────────────────────────────────────────────────────────────
export interface Vendor {
  id: string
  name: string
  gstin?: string
  place: string
  category: string
  outstanding: number
  lifetimeSpend: number
  status: 'Active' | 'Inactive'
}

export const vendors: Vendor[] = [
  { id: 'ven-001', name: 'Steel Authority of India', gstin: '27AABCS0579E1Z8', place: 'Mumbai', category: 'Raw Material', outstanding: 1463200, lifetimeSpend: 38400000, status: 'Active' },
  { id: 'ven-002', name: 'Jindal Steel & Power', gstin: '21AAACJ1234M1Z3', place: 'Raigarh', category: 'Raw Material', outstanding: 1050200, lifetimeSpend: 22100000, status: 'Active' },
  { id: 'ven-003', name: 'Tata Power Ltd', gstin: '27AAACT1234F1Z5', place: 'Mumbai', category: 'Utilities', outstanding: 0, lifetimeSpend: 8420000, status: 'Active' },
  { id: 'ven-004', name: 'Mahindra Logistics', gstin: '27AABCM4567G1Z2', place: 'Mumbai', category: 'Logistics', outstanding: 0, lifetimeSpend: 5610000, status: 'Active' },
  { id: 'ven-005', name: 'HCL Technologies', gstin: '29AAACH4567N1Z1', place: 'Noida', category: 'IT Services', outstanding: 531000, lifetimeSpend: 12800000, status: 'Active' },
  { id: 'ven-006', name: 'Blue Star Ltd', gstin: '27AAACB2345P1Z2', place: 'Mumbai', category: 'Equipment', outstanding: 289100, lifetimeSpend: 3450000, status: 'Active' },
  { id: 'ven-007', name: 'Schneider Electric', gstin: '29AABCS9876L1Z8', place: 'Bengaluru', category: 'Equipment', outstanding: 802400, lifetimeSpend: 9870000, status: 'Active' },
  { id: 'ven-008', name: 'Indian Oil Corp', gstin: '27AAACI4567O1Z1', place: 'Mumbai', category: 'Fuel', outstanding: 184080, lifetimeSpend: 2190000, status: 'Active' },
]

// ─── Banking ───────────────────────────────────────────────────────────────────
export interface BankAccount {
  id: string
  bank: string
  accountNumber: string
  ifsc: string
  type: 'Current' | 'Savings' | 'OD' | 'CC'
  balance: number
  currency: 'INR' | 'USD'
  syncedAt: string
}

export const bankAccounts: BankAccount[] = [
  { id: 'bk-001', bank: 'HDFC Bank', accountNumber: '5028 **** **** 1842', ifsc: 'HDFC0000123', type: 'Current', balance: 18400000, currency: 'INR', syncedAt: '2025-08-10T09:30:00Z' },
  { id: 'bk-002', bank: 'ICICI Bank', accountNumber: '6201 **** **** 9921', ifsc: 'ICIC0000456', type: 'CC', balance: 4200000, currency: 'INR', syncedAt: '2025-08-10T09:25:00Z' },
  { id: 'bk-003', bank: 'State Bank of India', accountNumber: '3021 **** **** 4471', ifsc: 'SBIN0000789', type: 'Current', balance: 980000, currency: 'INR', syncedAt: '2025-08-10T09:20:00Z' },
  { id: 'bk-004', bank: 'Axis Bank', accountNumber: '9140 **** **** 2233', ifsc: 'UTIB0000321', type: 'OD', balance: 2200000, currency: 'INR', syncedAt: '2025-08-10T09:15:00Z' },
]

export interface BankTransaction {
  id: string
  account: string
  date: string
  description: string
  type: 'Credit' | 'Debit'
  amount: number
  category: string
  matched: boolean
}

export const bankTransactions: BankTransaction[] = [
  { id: 'tx-001', account: 'HDFC **** 1842', date: '2025-08-10', description: 'NECR TATA TECHNOLOGIES LTD', type: 'Credit', amount: 1463200, category: 'Sales Receipt', matched: true },
  { id: 'tx-002', account: 'HDFC **** 1842', date: '2025-08-09', description: 'UPI/SCHNEIDER ELEC/447182', type: 'Debit', amount: 80240, category: 'Vendor Payment', matched: false },
  { id: 'tx-003', account: 'HDFC **** 1842', date: '2025-08-09', description: 'SALARY AUG AURUM INDUS', type: 'Debit', amount: 1820000, category: 'Payroll', matched: true },
  { id: 'tx-004', account: 'ICICI **** 9921', date: '2025-08-08', description: 'NEFT ADANI POWER LTD', type: 'Credit', amount: 3776000, category: 'Sales Receipt', matched: true },
  { id: 'tx-005', account: 'HDFC **** 1842', date: '2025-08-08', description: 'GST PAYMENT JUL25 CBIC', type: 'Debit', amount: 2280000, category: 'Tax Payment', matched: true },
  { id: 'tx-006', account: 'HDFC **** 1842', date: '2025-08-07', description: 'UPI/JINDAL STEEL/9921', type: 'Debit', amount: 1050200, category: 'Vendor Payment', matched: false },
  { id: 'tx-007', account: 'SBI **** 4471', date: '2025-08-07', description: 'TDS PAYMENT Q1 AURUM', type: 'Debit', amount: 412000, category: 'Tax Payment', matched: true },
  { id: 'tx-008', account: 'HDFC **** 1842', date: '2025-08-06', description: 'NEFT THERMAX LTD', type: 'Credit', amount: 1711000, category: 'Sales Receipt', matched: true },
  { id: 'tx-009', account: 'Axis **** 2233', date: '2025-08-05', description: 'ECS TATA POWER LTD', type: 'Debit', amount: 368160, category: 'Utilities', matched: false },
  { id: 'tx-010', account: 'HDFC **** 1842', date: '2025-08-04', description: 'NEFT ADANI POWER LTD', type: 'Credit', amount: 3776000, category: 'Sales Receipt', matched: true },
]

// ─── Inventory ─────────────────────────────────────────────────────────────────
export interface Product {
  id: string
  sku: string
  name: string
  category: string
  hsn: string
  unit: string
  stock: number
  reorderLevel: number
  cost: number
  price: number
  warehouse: string
  status: 'In Stock' | 'Low Stock' | 'Out of Stock'
}

export const products: Product[] = [
  { id: 'prd-001', sku: 'AUR-BR-001', name: 'Industrial Bearing 50mm', category: 'Bearings', hsn: '8482', unit: 'PCS', stock: 1240, reorderLevel: 200, cost: 450, price: 780, warehouse: 'Pune-W1', status: 'In Stock' },
  { id: 'prd-002', sku: 'AUR-BR-002', name: 'Industrial Bearing 75mm', category: 'Bearings', hsn: '8482', unit: 'PCS', stock: 184, reorderLevel: 200, cost: 720, price: 1240, warehouse: 'Pune-W1', status: 'Low Stock' },
  { id: 'prd-003', sku: 'AUR-CP-001', name: 'Coupling 25mm Flexible', category: 'Couplings', hsn: '8483', unit: 'PCS', stock: 540, reorderLevel: 100, cost: 380, price: 680, warehouse: 'Pune-W1', status: 'In Stock' },
  { id: 'prd-004', sku: 'AUR-GB-001', name: 'Helical Gear Module 4', category: 'Gears', hsn: '8483', unit: 'PCS', stock: 0, reorderLevel: 50, cost: 2400, price: 4200, warehouse: 'Pune-W2', status: 'Out of Stock' },
  { id: 'prd-005', sku: 'AUR-GB-002', name: 'Worm Gear Assembly', category: 'Gears', hsn: '8483', unit: 'PCS', stock: 92, reorderLevel: 50, cost: 5400, price: 9200, warehouse: 'Pune-W2', status: 'In Stock' },
  { id: 'prd-006', sku: 'AUR-SF-001', name: 'Shaft 32mm x 500mm', category: 'Shafts', hsn: '8483', unit: 'PCS', stock: 318, reorderLevel: 80, cost: 920, price: 1580, warehouse: 'Pune-W1', status: 'In Stock' },
  { id: 'prd-007', sku: 'AUR-SF-002', name: 'Shaft 45mm x 750mm', category: 'Shafts', hsn: '8483', unit: 'PCS', stock: 64, reorderLevel: 80, cost: 1640, price: 2800, warehouse: 'Pune-W1', status: 'Low Stock' },
  { id: 'prd-008', sku: 'AUR-MT-001', name: 'Motor Frame 5HP Cast Iron', category: 'Motor Parts', hsn: '8501', unit: 'PCS', stock: 28, reorderLevel: 20, cost: 8400, price: 14200, warehouse: 'Pune-W2', status: 'In Stock' },
  { id: 'prd-009', sku: 'AUR-VB-001', name: 'V-Belt B-95 Industrial', category: 'Belts', hsn: '4010', unit: 'PCS', stock: 840, reorderLevel: 200, cost: 180, price: 340, warehouse: 'Pune-W1', status: 'In Stock' },
  { id: 'prd-010', sku: 'AUR-CL-001', name: 'Clutch Plate 250mm', category: 'Clutches', hsn: '8483', unit: 'PCS', stock: 0, reorderLevel: 30, cost: 2200, price: 3800, warehouse: 'Pune-W2', status: 'Out of Stock' },
]

// ─── Payroll ───────────────────────────────────────────────────────────────────
export interface Employee {
  id: string
  name: string
  role: string
  department: string
  email: string
  joinedAt: string
  ctc: number
  gross: number
  net: number
  status: 'Active' | 'On Leave' | 'Resigned'
  pan: string
  uan: string
}

export const employees: Employee[] = [
  { id: 'emp-001', name: 'Rajesh Kumar', role: 'Chief Financial Officer', department: 'Finance', email: 'rajesh@aurumindus.com', joinedAt: '2018-06-01', ctc: 4200000, gross: 320000, net: 248000, status: 'Active', pan: 'ABCPK1234K', uan: '101234567890' },
  { id: 'emp-002', name: 'Priya Sharma', role: 'Accounting Manager', department: 'Finance', email: 'priya@aurumindus.com', joinedAt: '2019-03-15', ctc: 1800000, gross: 142000, net: 112800, status: 'Active', pan: 'ABCPS5678P', uan: '101234567891' },
  { id: 'emp-003', name: 'Amit Patel', role: 'Senior Accountant', department: 'Finance', email: 'amit@aurumindus.com', joinedAt: '2020-07-22', ctc: 1200000, gross: 96000, net: 78400, status: 'Active', pan: 'ABCPA2345A', uan: '101234567892' },
  { id: 'emp-004', name: 'Sneha Iyer', role: 'GST Specialist', department: 'Finance', email: 'sneha@aurumindus.com', joinedAt: '2021-02-10', ctc: 980000, gross: 78000, net: 64200, status: 'Active', pan: 'ABCPI6789I', uan: '101234567893' },
  { id: 'emp-005', name: 'Vikram Singh', role: 'Plant Manager', department: 'Operations', email: 'vikram@aurumindus.com', joinedAt: '2018-08-12', ctc: 2400000, gross: 186000, net: 146800, status: 'Active', pan: 'ABCPV1234V', uan: '101234567894' },
  { id: 'emp-006', name: 'Deepak Yadav', role: 'Production Supervisor', department: 'Operations', email: 'deepak@aurumindus.com', joinedAt: '2019-11-05', ctc: 840000, gross: 68000, net: 56400, status: 'Active', pan: 'ABCPY2345Y', uan: '101234567895' },
  { id: 'emp-007', name: 'Anjali Mehta', role: 'HR Manager', department: 'HR', email: 'anjali@aurumindus.com', joinedAt: '2020-01-20', ctc: 1100000, gross: 88000, net: 71200, status: 'Active', pan: 'ABCPM3456M', uan: '101234567896' },
  { id: 'emp-008', name: 'Suresh Reddy', role: 'Sales Lead', department: 'Sales', email: 'suresh@aurumindus.com', joinedAt: '2019-04-18', ctc: 1600000, gross: 128000, net: 102400, status: 'Active', pan: 'ABCPR4567R', uan: '101234567897' },
  { id: 'emp-009', name: 'Kavya Nair', role: 'Sales Executive', department: 'Sales', email: 'kavya@aurumindus.com', joinedAt: '2022-06-01', ctc: 720000, gross: 58000, net: 48600, status: 'Active', pan: 'ABCPN5678N', uan: '101234567898' },
  { id: 'emp-010', name: 'Manoj Gupta', role: 'Procurement Officer', department: 'Operations', email: 'manoj@aurumindus.com', joinedAt: '2021-09-12', ctc: 900000, gross: 72000, net: 58400, status: 'Active', pan: 'ABCPG6789G', uan: '101234567899' },
  { id: 'emp-011', name: 'Lakshmi Venkat', role: 'Quality Analyst', department: 'Operations', email: 'lakshmi@aurumindus.com', joinedAt: '2022-03-08', ctc: 680000, gross: 55000, net: 46200, status: 'Active', pan: 'ABCPV7890V', uan: '101234567900' },
  { id: 'emp-012', name: 'Rohit Desai', role: 'Machine Operator', department: 'Operations', email: 'rohit@aurumindus.com', joinedAt: '2020-05-15', ctc: 480000, gross: 38000, net: 32400, status: 'Active', pan: 'ABCPD1234D', uan: '101234567901' },
]

export interface PayrollRun {
  id: string
  month: string
  runDate: string
  employees: number
  grossPaid: number
  taxDeducted: number
  pfDeposited: number
  status: 'Completed' | 'Processing' | 'Scheduled'
}

export const payrollRuns: PayrollRun[] = [
  { id: 'pr-001', month: 'August 2025', runDate: '2025-08-01', employees: 47, grossPaid: 1820000, taxDeducted: 244000, pfDeposited: 218400, status: 'Completed' },
  { id: 'pr-002', month: 'July 2025', runDate: '2025-07-01', employees: 45, grossPaid: 1740000, taxDeducted: 232000, pfDeposited: 208800, status: 'Completed' },
  { id: 'pr-003', month: 'June 2025', runDate: '2025-06-01', employees: 45, grossPaid: 1740000, taxDeducted: 232000, pfDeposited: 208800, status: 'Completed' },
  { id: 'pr-004', month: 'September 2025', runDate: '2025-09-01', employees: 47, grossPaid: 1840000, taxDeducted: 248000, pfDeposited: 220800, status: 'Scheduled' },
]

// ─── Compliance & Notices ──────────────────────────────────────────────────────
export interface ComplianceItem {
  id: string
  title: string
  category: 'GST' | 'TDS' | 'PF' | 'ESI' | 'ROC' | 'Income Tax'
  dueDate: string
  status: 'Compliant' | 'Due Soon' | 'Overdue' | 'Action Needed'
  severity: 'low' | 'medium' | 'high'
  description: string
}

export const complianceItems: ComplianceItem[] = [
  { id: 'cmp-001', title: 'GSTR-3B July 2025 Filing', category: 'GST', dueDate: '2025-08-20', status: 'Due Soon', severity: 'high', description: 'Monthly summary return — tax liability ₹24.9L after ITC.' },
  { id: 'cmp-002', title: 'TDS Deposit Q1 (Apr-Jun)', category: 'TDS', dueDate: '2025-08-07', status: 'Compliant', severity: 'low', description: '₹4.12L deposited on 7 Aug; challan generated.' },
  { id: 'cmp-003', title: 'PF Contribution July', category: 'PF', dueDate: '2025-08-15', status: 'Compliant', severity: 'low', description: '₹2.18L deposited via EPFO portal.' },
  { id: 'cmp-004', title: 'ESI Contribution July', category: 'ESI', dueDate: '2025-08-21', status: 'Due Soon', severity: 'medium', description: '₹84K pending — 11 days remaining.' },
  { id: 'cmp-005', title: 'ITC-04 Q1 Job Work', category: 'GST', dueDate: '2025-07-25', status: 'Overdue', severity: 'high', description: '17 days overdue — penalty of ₹200/day accruing.' },
  { id: 'cmp-006', title: 'Form DPT-3 (Deposits)', category: 'ROC', dueDate: '2025-08-30', status: 'Action Needed', severity: 'medium', description: 'Annual return on deposits > ₹4.8L accepted — auditor review required.' },
  { id: 'cmp-007', title: 'Advance Tax Q2', category: 'Income Tax', dueDate: '2025-09-15', status: 'Due Soon', severity: 'medium', description: 'Estimated ₹18.4L — 36 days remaining.' },
  { id: 'cmp-008', title: 'AOC-4 (Financials)', category: 'ROC', dueDate: '2025-10-30', status: 'Action Needed', severity: 'low', description: 'Annual financial statements filing — board approval pending.' },
]

// ─── AI Insights (pre-generated, but real LLM augmentations via API) ──────────
export interface AIInsight {
  id: string
  title: string
  category: 'Cash Flow' | 'Tax' | 'Revenue' | 'Risk' | 'Compliance' | 'Growth'
  severity: 'info' | 'success' | 'warning' | 'critical'
  summary: string
  recommendation: string
  impact: string
  module: string
}

export const aiInsights: AIInsight[] = [
  {
    id: 'ai-001',
    title: 'ITC reconciliation gap detected',
    category: 'Tax',
    severity: 'warning',
    summary: 'GSTR-2B ITC (₹7.9L) is ₹1.2L lower than books. 4 vendor invoices missing in 2B.',
    recommendation: 'Follow up with Bosch India, Blue Star, Schneider & Jindal for delayed GSTR-1 filing.',
    impact: 'Recover ₹1.2L input credit before Sep 2025 return deadline.',
    module: 'GST Intelligence',
  },
  {
    id: 'ai-002',
    title: 'Cash runway extended by 18 days',
    category: 'Cash Flow',
    severity: 'success',
    summary: 'DSO improved from 46 to 38 days; receivables down ₹4.2L MoM.',
    recommendation: 'Continue automated reminder cadence; add early-payment discount (1%/10) for BHEL.',
    impact: '+₹2.1L monthly cash flow; reduced working capital stress.',
    module: 'AI CFO',
  },
  {
    id: 'ai-003',
    title: 'GSTR-3B liability forecast — August',
    category: 'Tax',
    severity: 'info',
    summary: 'Predicted net GST payable: ₹22.4L (vs ₹24.9L last month).',
    recommendation: 'Schedule payment for 18 Aug; ensure ₹22.4L cash reserve in HDFC account.',
    impact: 'Avoids ₹50K interest + penalty on late payment.',
    module: 'AI CFO',
  },
  {
    id: 'ai-004',
    title: '2 SKUs requiring restock this week',
    category: 'Risk',
    severity: 'warning',
    summary: 'Industrial Bearing 75mm (184 units) and Shaft 45mm (64 units) below reorder level.',
    recommendation: 'Place PO with SAIL for 500 + 200 units; ETA 7 days.',
    impact: 'Prevents lost sales of ₹4.8L from 3 active customer POs.',
    module: 'Inventory',
  },
  {
    id: 'ai-005',
    title: 'Vendor concentration risk — top 2 = 64%',
    category: 'Risk',
    severity: 'warning',
    summary: 'SAIL + Jindal combined spend ₹6.05Cr = 64% of procurement.',
    recommendation: 'Onboard 1-2 alternate steel suppliers; negotiate secondary contract with Vizag Steel.',
    impact: 'Reduces supply disruption risk; potential 3-5% cost savings.',
    module: 'Purchases',
  },
  {
    id: 'ai-006',
    title: 'GST notice — ITC-04 overdue',
    category: 'Compliance',
    severity: 'critical',
    summary: 'ITC-04 for Q1 (Apr-Jun) is 17 days overdue; penalty ₹200/day accruing.',
    recommendation: 'File immediately via GST portal; estimated penalty ₹3,400 already accrued.',
    impact: 'Stops further penalty; avoids show-cause notice from jurisdictional officer.',
    module: 'Compliance Center',
  },
  {
    id: 'ai-007',
    title: 'Sales pipeline — 3 deals above ₹50L',
    category: 'Growth',
    severity: 'info',
    summary: 'Cummins (₹84L), L&T (₹62L), ABB (₹55L) in final negotiation.',
    recommendation: 'Offer 1.5% volume discount on Cummins deal to close before Q2 end.',
    impact: '+₹2.01Cr revenue; lifts Q2 to ₹5.8Cr target.',
    module: 'Sales',
  },
  {
    id: 'ai-008',
    title: 'PF & ESI deadline — 21 Aug',
    category: 'Compliance',
    severity: 'warning',
    summary: 'ESI ₹84K pending for July; PF ₹2.18L already deposited.',
    recommendation: 'Schedule ESI payment for 19 Aug via portal; auto-challan generation available.',
    impact: 'Avoids ₹8,400 penalty (1% per day) and compliance score drop.',
    module: 'Compliance Center',
  },
]

// ─── Automations ───────────────────────────────────────────────────────────────
export interface Automation {
  id: string
  name: string
  description: string
  trigger: string
  action: string
  status: 'Active' | 'Paused' | 'Draft'
  runs: number
  lastRun: string
  category: 'GST' | 'Banking' | 'Sales' | 'Payroll' | 'Compliance'
}

export const automations: Automation[] = [
  { id: 'aut-001', name: 'Auto GSTR-1 from Sales Invoices', description: 'Generates GSTR-1 JSON from all issued invoices on the 5th of every month.', trigger: 'Schedule: 5th of month', action: 'Compile GSTR-1 → Validate → Push to GST portal', status: 'Active', runs: 14, lastRun: '2025-08-05', category: 'GST' },
  { id: 'aut-002', name: 'Receivable Reminder Cadence', description: 'Sends 3-tier reminders (3/7/14 days) to customers with overdue invoices.', trigger: 'Invoice overdue by 3 days', action: 'Send email + WhatsApp + log call', status: 'Active', runs: 286, lastRun: '2025-08-09', category: 'Sales' },
  { id: 'aut-003', name: 'Bank Feed Auto-Reconciliation', description: 'Matches incoming NEFT/IMPS to open invoices using fuzzy name + amount match.', trigger: 'New bank transaction', action: 'Auto-match → mark invoice paid → notify', status: 'Active', runs: 1240, lastRun: '2025-08-10', category: 'Banking' },
  { id: 'aut-004', name: 'Low Stock Reorder Alert', description: 'Creates draft PO when any SKU drops below reorder level.', trigger: 'SKU below reorder level', action: 'Create PO draft → email procurement → log in Operations', status: 'Active', runs: 47, lastRun: '2025-08-08', category: 'Sales' },
  { id: 'aut-005', name: 'Payroll Auto-Run', description: 'Computes payroll on 1st of month, generates challans, deposits PF/TDS.', trigger: 'Schedule: 1st of month', action: 'Calculate net pay → generate bank file → deposit taxes', status: 'Active', runs: 12, lastRun: '2025-08-01', category: 'Payroll' },
  { id: 'aut-006', name: 'Compliance Calendar Sync', description: 'Pushes all GST/TDS/PF/ESI due dates to finance team calendar.', trigger: 'New compliance item created', action: 'Create calendar event → assign owner → set 3-day reminder', status: 'Active', runs: 84, lastRun: '2025-08-07', category: 'Compliance' },
  { id: 'aut-007', name: 'Vendor Bill OCR + Auto-entry', description: 'Reads vendor bill PDFs from Gmail, extracts data, creates draft bill.', trigger: 'Email with bill PDF attachment', action: 'OCR → extract → create bill draft → flag for review', status: 'Paused', runs: 156, lastRun: '2025-07-28', category: 'Banking' },
  { id: 'aut-008', name: 'Daily CFO Briefing Email', description: 'Sends 7 AM email with KPIs, alerts, and AI recommendations.', trigger: 'Schedule: 7 AM daily', action: 'Aggregate KPIs → AI summary → email CFO + CEO', status: 'Active', runs: 89, lastRun: '2025-08-10', category: 'Compliance' },
]

// ─── Audit log ─────────────────────────────────────────────────────────────────
export interface AuditEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  module: string
  detail: string
  ip: string
}

export const auditLog: AuditEntry[] = [
  { id: 'aud-001', timestamp: '2025-08-10T09:32:14Z', actor: 'Rajesh Kumar', action: 'GSTR-1 Filed', module: 'GST', detail: 'GSTR-1 Jul 2025 filed — ack AB9X23F8K7', ip: '203.0.113.42' },
  { id: 'aud-002', timestamp: '2025-08-10T09:18:02Z', actor: 'System', action: 'Auto-Reconciliation', module: 'Banking', detail: 'Matched 4 transactions to invoices', ip: '127.0.0.1' },
  { id: 'aud-003', timestamp: '2025-08-10T08:45:33Z', actor: 'Priya Sharma', action: 'Invoice Created', module: 'Sales', detail: 'AUR-2025-0153 — Thermax Ltd — ₹17.1L', ip: '203.0.113.42' },
  { id: 'aud-004', timestamp: '2025-08-09T17:22:11Z', actor: 'Amit Patel', action: 'Vendor Payment', module: 'Purchases', detail: 'Paid SAIL ₹14.6L via NEFT', ip: '203.0.113.51' },
  { id: 'aud-005', timestamp: '2025-08-09T15:08:44Z', actor: 'System', action: 'Payroll Run', module: 'Payroll', detail: 'August payroll processed — 47 employees — ₹18.2L', ip: '127.0.0.1' },
  { id: 'aud-006', timestamp: '2025-08-09T12:14:27Z', actor: 'Sneha Iyer', action: 'ITC Reconciled', module: 'GST', detail: 'GSTR-2B reconciled — 4 gaps identified', ip: '203.0.113.42' },
  { id: 'aud-007', timestamp: '2025-08-08T16:42:09Z', actor: 'Rajesh Kumar', action: 'Tax Payment', module: 'GST', detail: 'GST Jul ₹22.8L paid — challan CN2025ABC123', ip: '203.0.113.42' },
  { id: 'aud-008', timestamp: '2025-08-08T11:09:53Z', actor: 'Anjali Mehta', action: 'Employee Onboarded', module: 'Payroll', detail: 'Lakshmi Venkat added — Quality Analyst', ip: '203.0.113.51' },
]

// ─── Module registry metadata ──────────────────────────────────────────────────
export interface ModuleMeta {
  id: string
  name: string
  shortName: string
  description: string
  icon: string
  category: 'Core' | 'Operations' | 'Intelligence' | 'Compliance'
  accent: 'emerald' | 'sky' | 'amber' | 'violet' | 'rose' | 'cyan'
  badge?: string
}

export const modules: ModuleMeta[] = [
  { id: 'dashboard', name: 'Executive Dashboard', shortName: 'Dashboard', description: 'Real-time KPIs, P&L, cash flow, AI briefings', icon: 'LayoutDashboard', category: 'Core', accent: 'emerald' },
  { id: 'ai-cfo', name: 'AI CFO', shortName: 'AI CFO', description: 'Financial intelligence, forecasts, what-if simulations', icon: 'Brain', category: 'Intelligence', accent: 'violet', badge: 'AI' },
  { id: 'ai-accountant', name: 'AI Accountant', shortName: 'Accountant', description: 'Auto categorization, journal entries, ledger review', icon: 'Calculator', category: 'Intelligence', accent: 'violet', badge: 'AI' },
  { id: 'gst', name: 'GST Intelligence', shortName: 'GST', description: 'Returns, reconciliation, e-invoicing, e-way bill', icon: 'Receipt', category: 'Compliance', accent: 'amber' },
  { id: 'banking', name: 'Banking', shortName: 'Banking', description: 'Connected accounts, transactions, reconciliation', icon: 'Landmark', category: 'Operations', accent: 'sky' },
  { id: 'sales', name: 'Sales', shortName: 'Sales', description: 'Invoices, customers, receivables, e-invoicing', icon: 'TrendingUp', category: 'Operations', accent: 'emerald' },
  { id: 'purchases', name: 'Purchases', shortName: 'Purchases', description: 'Bills, vendors, payables, procurement', icon: 'ShoppingCart', category: 'Operations', accent: 'cyan' },
  { id: 'inventory', name: 'Inventory', shortName: 'Inventory', description: 'Stock, products, warehouses, reorder alerts', icon: 'Package', category: 'Operations', accent: 'amber' },
  { id: 'payroll', name: 'Payroll', shortName: 'Payroll', description: 'Employees, runs, PF/TDS, payslips', icon: 'Users', category: 'Operations', accent: 'sky' },
  { id: 'compliance', name: 'Compliance Center', shortName: 'Compliance', description: 'GST/TDS/PF/ESI/ROC — calendar + notices', icon: 'ShieldCheck', category: 'Compliance', accent: 'rose' },
  { id: 'oracle', name: 'VEYRO AI', shortName: 'Oracle', description: 'Conversational AI for any business question', icon: 'Sparkles', category: 'Intelligence', accent: 'violet', badge: 'AI' },
  { id: 'automation', name: 'Automation Builder', shortName: 'Automation', description: 'Build no-code workflows across modules', icon: 'Workflow', category: 'Intelligence', accent: 'cyan' },
]
