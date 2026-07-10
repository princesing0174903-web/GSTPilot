// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Shared Mock Data Generator
//
// Deterministic realistic Indian business data shared by all four Mock ERP
// providers (Tally, Zoho Books, Busy, QuickBooks). Seeded by company name so
// the same company always yields the same dataset — syncs are idempotent.
//
// This module is SERVER-ONLY (imported by the mock providers in server/).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ERPCustomer,
  ERPInventoryItem,
  ERPInvoice,
  ERPLineItem,
  ERPLedger,
  ERPPayment,
  ERPProviderName,
  ERPBankTransaction,
  ERPTax,
  ERPVendor,
} from '../types';

// ─── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────

/** Hash a string into a 32-bit unsigned int (FNV-1a). */
function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG seeded by a string. Returns a function → [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MockRng {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(arr: T[]) => T;
  bool: (probabilityTrue?: number) => boolean;
  date: (fromDays: number, toDays: number) => string; // ISO date, offset from today
  money: (min: number, max: number) => number; // rounded to 2 decimals
}

export function makeRng(seed: string): MockRng {
  const rand = mulberry32(hashSeed(seed));
  return {
    next: rand,
    int: (min, max) => Math.floor(rand() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
    bool: (p = 0.5) => rand() < p,
    date: (fromDays, toDays) => {
      const now = new Date();
      const offset = Math.floor(rand() * (toDays - fromDays + 1)) + fromDays;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      return d.toISOString().slice(0, 10);
    },
    money: (min, max) => Math.round((min + rand() * (max - min)) * 100) / 100,
  };
}

// ─── Reference data pools ─────────────────────────────────────────────────────

const CUSTOMER_NAMES = [
  'Reliance Retail Ltd', 'Tata Steel Industries', 'Infosys Technologies', 'Wipro Enterprises',
  'Mahindra Auto Parts', 'Aditya Birla Group', 'L&T Construction', 'Bharti Airtel Ltd',
  'HDFC Bank Services', 'ICICI Securities', 'Asian Paints Co', 'Britannia Industries',
  'Dabur India Ltd', 'Godrej Industries', 'Hindustan Unilever', 'Maruti Suzuki India',
  'Bajaj Electricals', 'Crompton Greaves', 'Pidilite Industries', 'Ambuja Cements',
  'Shree Cements Ltd', 'UltraTech Cement', 'JSW Steel Ltd', 'Vedanta Resources',
  'Hero MotoCorp Ltd', 'TVS Motor Company', 'Ashok Leyland Ltd', 'Eicher Motors',
];

const VENDOR_NAMES = [
  'Tata Steel Suppliers', 'Jindal Steel & Power', 'Adani Enterprises', 'SAIL Raw Materials',
  'Reliance Industries Supply', 'Coal India Ltd', 'Hindalco Industries', 'Nalco Suppliers',
  'Vedanta Logistics', 'Sundaram Clayton', 'Bosch Auto Parts', 'Schaeffler India',
  'Timken India Ltd', 'SKF Bearings', 'NSK Steels', 'NBC Bearings',
  'LG Electronics Supply', 'Samsung Components', 'Whirlpool Parts', 'Voltas Supplies',
  'Blue Star Components', 'Hitachi Industrial', 'Mitsubishi Electric', 'Siemens India',
];

const INVENTORY_ITEMS = [
  { code: 'STL-RD-12MM', name: 'TMT Steel Rod 12mm', hsn: '7213', unit: 'Ton', cost: 58000, price: 62000, reorder: 5 },
  { code: 'STL-RD-16MM', name: 'TMT Steel Rod 16mm', hsn: '7213', unit: 'Ton', cost: 57500, price: 61500, reorder: 5 },
  { code: 'CMT-OPC-50KG', name: 'OPC Cement 50kg Bag', hsn: '2523', unit: 'Bag', cost: 380, price: 420, reorder: 100 },
  { code: 'CMT-PPC-50KG', name: 'PPC Cement 50kg Bag', hsn: '2523', unit: 'Bag', cost: 360, price: 400, reorder: 100 },
  { code: 'BRK-RED-9IN', name: 'Red Brick 9 inch', hsn: '6901', unit: 'Pcs', cost: 8, price: 11, reorder: 5000 },
  { code: 'SND-RIVER-1CU', name: 'River Sand 1 Cubic Mtr', hsn: '2505', unit: 'Cum', cost: 4500, price: 5500, reorder: 20 },
  { code: 'AGG-20MM-1CU', name: 'Coarse Aggregate 20mm', hsn: '2517', unit: 'Cum', cost: 1800, price: 2400, reorder: 30 },
  { code: 'PLY-18MM-8X4', name: 'Plywood 18mm 8x4 ft', hsn: '4412', unit: 'Sheet', cost: 1850, price: 2400, reorder: 50 },
  { code: 'PNT-EMUL-20L', name: 'Emulsion Paint 20L', hsn: '3208', unit: 'Drum', cost: 4200, price: 5400, reorder: 15 },
  { code: 'ELE-WIRE-2.5', name: 'Electrical Wire 2.5sqmm', hsn: '8544', unit: 'Meter', cost: 18, price: 26, reorder: 500 },
  { code: 'PVC-PIPE-4IN', name: 'PVC Pipe 4 inch', hsn: '3917', unit: 'Meter', cost: 220, price: 310, reorder: 200 },
  { code: 'TAP-MIX-DELTA', name: 'Mixer Tap Delta', hsn: '7418', unit: 'Pcs', cost: 850, price: 1250, reorder: 40 },
  { code: 'SAN-WC-COMPL', name: 'WC Commode Complete', hsn: '6910', unit: 'Set', cost: 4200, price: 5800, reorder: 20 },
  { code: 'LOCK-DOOR-BR', name: 'Door Lock Brass', hsn: '8301', unit: 'Pcs', cost: 680, price: 980, reorder: 60 },
  { code: 'HNG-SS-4IN', name: 'SS Hinge 4 inch', hsn: '8302', unit: 'Pcs', cost: 95, price: 145, reorder: 200 },
  { code: 'GLS-FLT-6MM', name: 'Float Glass 6mm', hsn: '7003', unit: 'Sqft', cost: 145, price: 210, reorder: 300 },
];

const CITIES = [
  ['Mumbai', 'Maharashtra', '27'],
  ['Pune', 'Maharashtra', '27'],
  ['Delhi', 'Delhi', '07'],
  ['Bangalore', 'Karnataka', '29'],
  ['Chennai', 'Tamil Nadu', '33'],
  ['Hyderabad', 'Telangana', '36'],
  ['Ahmedabad', 'Gujarat', '24'],
  ['Surat', 'Gujarat', '24'],
  ['Kolkata', 'West Bengal', '19'],
  ['Jaipur', 'Rajasthan', '08'],
  ['Indore', 'Madhya Pradesh', '23'],
  ['Nagpur', 'Maharashtra', '27'],
];

const GST_RATES = [0, 5, 12, 18, 28];

const INVOICE_PREFIXES = ['INV', 'SAL', 'BILL', 'CRT', 'VN'];

// ─── GSTIN generator (valid format: 2 state + 10 pan + 1 entity + 1 z + 1 checksum) ──

function makeGstin(stateCode: string, pan: string, rng: MockRng): string {
  const entity = String(rng.int(1, 9));
  const z = 'Z';
  const checksumChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const checksum = checksumChars[rng.int(0, checksumChars.length - 1)];
  return `${stateCode}${pan}${entity}${z}${checksum}`;
}

function makePan(rng: MockRng): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  let pan = '';
  for (let i = 0; i < 5; i++) pan += letters[rng.int(0, 25)];
  for (let i = 0; i < 4; i++) pan += digits[rng.int(0, 9)];
  pan += letters[rng.int(0, 25)];
  return pan;
}

// ─── Period helper ────────────────────────────────────────────────────────────

function currentPeriod(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
}

function currentFY(): string {
  const now = new Date();
  const y = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  return `FY${y}-${String(y + 1).slice(2)}`;
}

// ─── Customer generator ───────────────────────────────────────────────────────

export function generateCustomers(
  seed: string,
  provider: ERPProviderName,
  connectionId: string,
  organizationId: string,
  count: number,
): ERPCustomer[] {
  const rng = makeRng(seed + ':customers');
  const customers: ERPCustomer[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < count; i++) {
    let name = rng.pick(CUSTOMER_NAMES);
    while (usedNames.has(name)) name = rng.pick(CUSTOMER_NAMES) + ' ' + rng.int(2, 9);
    usedNames.add(name);
    const city = rng.pick(CITIES);
    const pan = makePan(rng);
    const gstin = rng.bool(0.85) ? makeGstin(city[2], pan, rng) : null;
    const totalSales = rng.money(50000, 8500000);
    const outstanding = rng.bool(0.6) ? rng.money(0, totalSales * 0.3) : 0;
    const now = new Date().toISOString();
    customers.push({
      id: `${organizationId}:${connectionId}:cust:${i}`,
      organizationId,
      connectionId,
      provider,
      erpCustomerId: `${i + 1001}`,
      mappedClientId: null,
      name,
      gstin,
      email: `accounts@${name.toLowerCase().replace(/[^a-z]/g, '')}.in`,
      phone: `+91${rng.int(7000000000, 9999999999)}`,
      address: `${rng.int(1, 200)}, ${city[0]} Business Park`,
      city: city[0],
      state: city[1],
      stateCode: city[2],
      outstandingBalance: Math.round(outstanding * 100) / 100,
      totalSales: Math.round(totalSales * 100) / 100,
      lastTransactionDate: rng.date(-90, 0),
      active: rng.bool(0.9),
      raw: { source: provider, ledgerName: name, creditDays: rng.pick([15, 30, 45, 60]) },
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  return customers;
}

// ─── Vendor generator ─────────────────────────────────────────────────────────

export function generateVendors(
  seed: string,
  provider: ERPProviderName,
  connectionId: string,
  organizationId: string,
  count: number,
): ERPVendor[] {
  const rng = makeRng(seed + ':vendors');
  const vendors: ERPVendor[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < count; i++) {
    let name = rng.pick(VENDOR_NAMES);
    while (usedNames.has(name)) name = rng.pick(VENDOR_NAMES) + ' ' + rng.int(2, 9);
    usedNames.add(name);
    const city = rng.pick(CITIES);
    const pan = makePan(rng);
    const gstin = rng.bool(0.8) ? makeGstin(city[2], pan, rng) : null;
    const totalPurchases = rng.money(80000, 12000000);
    const payable = rng.bool(0.5) ? rng.money(0, totalPurchases * 0.25) : 0;
    const now = new Date().toISOString();
    vendors.push({
      id: `${organizationId}:${connectionId}:vend:${i}`,
      organizationId,
      connectionId,
      provider,
      erpVendorId: `${i + 2001}`,
      name,
      gstin,
      email: `purchase@${name.toLowerCase().replace(/[^a-z]/g, '')}.in`,
      phone: `+91${rng.int(7000000000, 9999999999)}`,
      address: `${rng.int(1, 200)}, ${city[0]} Industrial Area`,
      city: city[0],
      state: city[1],
      stateCode: city[2],
      outstandingPayable: Math.round(payable * 100) / 100,
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      lastTransactionDate: rng.date(-60, 0),
      active: rng.bool(0.92),
      raw: { source: provider, ledgerName: name, creditDays: rng.pick([15, 30, 45]) },
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  return vendors;
}

// ─── Invoice generator (sales + purchase) ─────────────────────────────────────

export function generateInvoices(
  seed: string,
  provider: ERPProviderName,
  connectionId: string,
  organizationId: string,
  count: number,
  customers: ERPCustomer[],
  vendors: ERPVendor[],
  inventory: ERPInventoryItem[],
): ERPInvoice[] {
  const rng = makeRng(seed + ':invoices');
  const invoices: ERPInvoice[] = [];
  for (let i = 0; i < count; i++) {
    const isSales = rng.bool(0.65);
    const party = isSales ? rng.pick(customers) : rng.pick(vendors);
    const lineCount = rng.int(1, 6);
    const lineItems: ERPLineItem[] = [];
    let subtotal = 0;
    let taxAmount = 0;
    for (let l = 0; l < lineCount; l++) {
      const item = rng.pick(inventory);
      const qty = rng.int(1, 50);
      const rate = isSales ? item.salePrice : item.purchasePrice;
      const taxableValue = Math.round(qty * rate * 100) / 100;
      const gstRate = rng.pick(GST_RATES);
      // CGST+SGST for intra-state, IGST for inter-state (simplified)
      const isInter = party.stateCode !== '27'; // assume home state MH
      const igst = isInter ? Math.round(taxableValue * gstRate) / 100 : 0;
      const cgst = !isInter ? Math.round(taxableValue * gstRate / 2) / 100 : 0;
      const sgst = cgst;
      const lineTotal = Math.round((taxableValue + igst + cgst + sgst) * 100) / 100;
      lineItems.push({
        itemCode: item.itemCode,
        description: item.name,
        hsn: item.hsn,
        quantity: qty,
        rate,
        taxableValue,
        igst,
        cgst,
        sgst,
        cess: 0,
        total: lineTotal,
      });
      subtotal += taxableValue;
      taxAmount += igst + cgst + sgst;
    }
    const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;
    const invoiceDate = rng.date(-120, 0);
    const dueDate = new Date(new Date(invoiceDate).getTime() + rng.pick([15, 30, 45, 60]) * 86400000)
      .toISOString()
      .slice(0, 10);
    const paidRatio = rng.bool(0.55) ? 1 : rng.pick([0, 0.25, 0.5, 0.75]);
    const balanceDue = Math.round(grandTotal * (1 - paidRatio) * 100) / 100;
    const isOverdue = balanceDue > 0 && new Date(dueDate) < new Date();
    const status =
      balanceDue === 0 ? 'paid' : isOverdue ? 'overdue' : balanceDue < grandTotal ? 'partial' : 'unpaid';
    const prefix = rng.pick(INVOICE_PREFIXES);
    const now = new Date().toISOString();
    invoices.push({
      id: `${organizationId}:${connectionId}:inv:${i}`,
      organizationId,
      connectionId,
      provider,
      erpInvoiceNumber: `${prefix}/${new Date(invoiceDate).getFullYear()}/${String(i + 1).padStart(4, '0')}`,
      mappedInvoiceId: null,
      invoiceType: isSales ? 'sales' : 'purchase',
      partyName: party.name,
      partyGstin: party.gstin,
      invoiceDate,
      dueDate,
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      grandTotal,
      balanceDue,
      status,
      lineItems,
      raw: { source: provider, voucherType: isSales ? 'Sales' : 'Purchase' },
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  // Sort newest first
  return invoices.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
}

// ─── Inventory generator ──────────────────────────────────────────────────────

export function generateInventory(
  seed: string,
  provider: ERPProviderName,
  connectionId: string,
  organizationId: string,
): ERPInventoryItem[] {
  const rng = makeRng(seed + ':inventory');
  const now = new Date().toISOString();
  return INVENTORY_ITEMS.map((item, i) => {
    const quantity = rng.int(0, 500);
    const stockStatus =
      quantity === 0
        ? 'out_of_stock'
        : quantity < item.reorder
          ? 'low_stock'
          : quantity > item.reorder * 10
            ? 'excess'
            : 'in_stock';
    return {
      id: `${organizationId}:${connectionId}:inv:${i}`,
      organizationId,
      connectionId,
      provider,
      erpItemId: `${i + 3001}`,
      itemCode: item.code,
      name: item.name,
      hsn: item.hsn,
      unit: item.unit,
      quantity,
      stockValue: Math.round(quantity * item.cost * 100) / 100,
      salePrice: item.price,
      purchasePrice: item.cost,
      reorderLevel: item.reorder,
      godown: rng.pick(['Main Store', 'Warehouse A', 'Warehouse B', 'Site Store']),
      stockStatus,
      raw: { source: provider, batch: `B${rng.int(100, 999)}` },
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    } as ERPInventoryItem;
  });
}

// ─── Ledger generator (chart of accounts) ─────────────────────────────────────

export function generateLedgers(
  seed: string,
  provider: ERPProviderName,
  connectionId: string,
  organizationId: string,
): ERPLedger[] {
  const rng = makeRng(seed + ':ledgers');
  const now = new Date().toISOString();
  const asOf = new Date().toISOString().slice(0, 10);
  const base: Array<{ name: string; type: ERPLedger['ledgerType']; group: string }> = [
    { name: 'Cash in Hand', type: 'cash', group: 'Cash-in-Hand' },
    { name: 'HDFC Bank A/c', type: 'bank', group: 'Bank Accounts' },
    { name: 'ICICI Bank A/c', type: 'bank', group: 'Bank Accounts' },
    { name: 'SBI Current A/c', type: 'bank', group: 'Bank Accounts' },
    { name: 'Sales Account', type: 'income', group: 'Sales Accounts' },
    { name: 'Purchase Account', type: 'expense', group: 'Purchase Accounts' },
    { name: 'Rent Expense', type: 'expense', group: 'Indirect Expenses' },
    { name: 'Salary Expense', type: 'expense', group: 'Indirect Expenses' },
    { name: 'Electricity Expense', type: 'expense', group: 'Indirect Expenses' },
    { name: 'Office Expenses', type: 'expense', group: 'Indirect Expenses' },
    { name: 'GST Output IGST', type: 'tax', group: 'Duties & Taxes' },
    { name: 'GST Output CGST', type: 'tax', group: 'Duties & Taxes' },
    { name: 'GST Output SGST', type: 'tax', group: 'Duties & Taxes' },
    { name: 'GST Input IGST', type: 'tax', group: 'Duties & Taxes' },
    { name: 'GST Input CGST', type: 'tax', group: 'Duties & Taxes' },
    { name: 'GST Input SGST', type: 'tax', group: 'Duties & Taxes' },
    { name: 'Capital Account', type: 'equity', group: 'Capital Account' },
    { name: 'Loans & Advances', type: 'asset', group: 'Current Assets' },
    { name: 'Fixed Assets', type: 'asset', group: 'Fixed Assets' },
    { name: 'Sundry Debtors', type: 'sundry_debtor', group: 'Sundry Debtors' },
    { name: 'Sundry Creditors', type: 'sundry_creditor', group: 'Sundry Creditors' },
  ];
  return base.map((b, i) => {
    const opening = rng.money(-2000000, 5000000);
    const closing = opening + rng.money(-500000, 1500000);
    return {
      id: `${organizationId}:${connectionId}:led:${i}`,
      organizationId,
      connectionId,
      provider,
      erpLedgerId: `${i + 4001}`,
      name: b.name,
      ledgerType: b.type,
      gstin: null,
      openingBalance: Math.round(opening * 100) / 100,
      closingBalance: Math.round(closing * 100) / 100,
      asOfDate: asOf,
      parentGroup: b.group,
      raw: { source: provider },
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    } as ERPLedger;
  });
}

// ─── Payment generator ────────────────────────────────────────────────────────

export function generatePayments(
  seed: string,
  provider: ERPProviderName,
  connectionId: string,
  organizationId: string,
  count: number,
  invoices: ERPInvoice[],
): ERPPayment[] {
  const rng = makeRng(seed + ':payments');
  const now = new Date().toISOString();
  const payments: ERPPayment[] = [];
  for (let i = 0; i < count; i++) {
    const isReceipt = rng.bool(0.55);
    const inv = rng.pick(invoices);
    const amount = rng.money(5000, inv.grandTotal);
    const mode = rng.pick(['cash', 'bank', 'upi', 'cheque'] as const);
    const now2 = new Date().toISOString();
    payments.push({
      id: `${organizationId}:${connectionId}:pay:${i}`,
      organizationId,
      connectionId,
      provider,
      erpVoucherNumber: `${isReceipt ? 'RCT' : 'PMT'}/${rng.int(1000, 9999)}`,
      paymentType: isReceipt ? 'receipt' : 'payment',
      date: rng.date(-90, 0),
      amount: Math.round(amount * 100) / 100,
      debitLedger: isReceipt ? 'Bank A/c' : inv.partyName,
      creditLedger: isReceipt ? inv.partyName : 'Bank A/c',
      mode,
      referenceNumber: mode === 'cheque' ? `${rng.int(100000, 999999)}` : mode === 'upi' ? `UPI${rng.int(100000000, 999999999)}` : null,
      narration: `${isReceipt ? 'Payment received from' : 'Payment made to'} ${inv.partyName}`,
      linkedInvoiceNumbers: [inv.erpInvoiceNumber],
      raw: { source: provider },
      lastSyncedAt: now2,
      createdAt: now2,
      updatedAt: now2,
    });
  }
  void now;
  return payments.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Bank transaction generator ───────────────────────────────────────────────

export function generateBankTransactions(
  seed: string,
  provider: ERPProviderName,
  connectionId: string,
  organizationId: string,
  count: number,
): ERPBankTransaction[] {
  const rng = makeRng(seed + ':banktxns');
  const now = new Date().toISOString();
  const bankLedgers = ['HDFC Bank A/c', 'ICICI Bank A/c', 'SBI Current A/c'];
  const txns: ERPBankTransaction[] = [];
  let balance = rng.money(500000, 3000000);
  for (let i = 0; i < count; i++) {
    const isCredit = rng.bool(0.45);
    const amount = rng.money(2000, 500000);
    balance = isCredit ? balance + amount : balance - amount;
    const descriptions = isCredit
      ? ['NEFT Credit from customer', 'RTGS Inward', 'UPI Credit', 'Cheque Deposit', 'IMPS Received', 'Customer Payment']
      : ['NEFT Debit to vendor', 'RTGS Outward', 'UPI Debit', 'Cheque Issued', 'IMPS Sent', 'Vendor Payment', 'Salary Disbursement', 'GST Payment', 'Electricity Bill'];
    txns.push({
      id: `${organizationId}:${connectionId}:btxn:${i}`,
      organizationId,
      connectionId,
      provider,
      date: rng.date(-60, 0),
      bankLedger: rng.pick(bankLedgers),
      description: rng.pick(descriptions),
      amount: Math.round(amount * 100) / 100,
      type: isCredit ? 'credit' : 'debit',
      balance: Math.round(balance * 100) / 100,
      referenceNumber: `REF${rng.int(1000000, 9999999)}`,
      raw: { source: provider },
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  return txns.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Tax summary generator ────────────────────────────────────────────────────

export function generateTaxes(
  seed: string,
  provider: ERPProviderName,
  connectionId: string,
  organizationId: string,
  invoices: ERPInvoice[],
): ERPTax[] {
  const rng = makeRng(seed + ':taxes');
  const now = new Date().toISOString();
  const period = currentPeriod();
  // Aggregate from invoices by tax head + rate.
  const buckets = new Map<string, { taxable: number; tax: number }>();
  for (const inv of invoices) {
    for (const li of inv.lineItems) {
      const rate =
        li.igst > 0 ? Math.round((li.igst / Math.max(li.taxableValue, 1)) * 100)
        : li.cgst > 0 ? Math.round((li.cgst * 2 / Math.max(li.taxableValue, 1)) * 100)
        : 0;
      const direction = inv.invoiceType === 'sales' ? 'output' : 'input';
      if (li.igst > 0) {
        const k = `IGST:${rate}:${direction}`;
        const b = buckets.get(k) ?? { taxable: 0, tax: 0 };
        b.taxable += li.taxableValue;
        b.tax += li.igst;
        buckets.set(k, b);
      }
      if (li.cgst > 0) {
        const k = `CGST:${rate}:${direction}`;
        const b = buckets.get(k) ?? { taxable: 0, tax: 0 };
        b.taxable += li.taxableValue;
        b.tax += li.cgst;
        buckets.set(k, b);
      }
      if (li.sgst > 0) {
        const k = `SGST:${rate}:${direction}`;
        const b = buckets.get(k) ?? { taxable: 0, tax: 0 };
        b.taxable += li.taxableValue;
        b.tax += li.sgst;
        buckets.set(k, b);
      }
    }
  }
  const taxes: ERPTax[] = [];
  let idx = 0;
  for (const [key, val] of buckets) {
    const [head, rateStr, direction] = key.split(':');
    taxes.push({
      id: `${organizationId}:${connectionId}:tax:${idx}`,
      organizationId,
      connectionId,
      provider,
      taxHead: head as ERPTax['taxHead'],
      rate: Number(rateStr),
      direction: direction as 'output' | 'input',
      taxableValue: Math.round(val.taxable * 100) / 100,
      taxAmount: Math.round(val.tax * 100) / 100,
      period,
      raw: { source: provider, fy: currentFY() },
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    idx++;
  }
  void rng;
  return taxes;
}

// ─── Token expiry helper ──────────────────────────────────────────────────────

export function tokenExpiryFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}
