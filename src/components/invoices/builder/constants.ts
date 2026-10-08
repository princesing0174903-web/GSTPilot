// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Invoice Builder · Constants
//
// All static data tables: GST rates, units, invoice types, payment terms,
// payment modes, state code → name map, default T&C, default bank details,
// currencies, templates.
// ═══════════════════════════════════════════════════════════════════════════════

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export const UNITS = ['NOS', 'PCS', 'KG', 'MTR', 'BOX', 'LOT', 'LTR', 'HRS'] as const;

export const INVOICE_TYPES = [
  'B2B',
  'B2C Large',
  'B2C Small',
  'Export',
  'Credit Note',
  'Debit Note',
] as const;

export const PAYMENT_TERMS_OPTIONS = [
  { value: '0', label: 'Due on receipt' },
  { value: '7', label: 'Net 7' },
  { value: '15', label: 'Net 15' },
  { value: '30', label: 'Net 30' },
  { value: '45', label: 'Net 45' },
  { value: '60', label: 'Net 60' },
  { value: '90', label: 'Net 90' },
] as const;

export const PAYMENT_MODES = [
  'UPI',
  'Bank Transfer',
  'Cheque',
  'Cash',
  'Card',
  'Razorpay',
] as const;

export const INVOICE_STATUSES = [
  { value: 'draft', label: 'Draft', tone: 'neutral' as const },
  { value: 'sent', label: 'Sent', tone: 'info' as const },
  { value: 'paid', label: 'Paid', tone: 'success' as const },
  { value: 'overdue', label: 'Overdue', tone: 'danger' as const },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' as const },
];

export const PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Unpaid', tone: 'danger' as const },
  { value: 'partial', label: 'Partial', tone: 'warning' as const },
  { value: 'paid', label: 'Paid', tone: 'success' as const },
];

export const CURRENCIES = [
  { value: 'INR', label: '₹ INR · Indian Rupee', symbol: '₹' },
  { value: 'USD', label: '$ USD · US Dollar', symbol: '$' },
  { value: 'EUR', label: '€ EUR · Euro', symbol: '€' },
  { value: 'GBP', label: '£ GBP · Pound Sterling', symbol: '£' },
  { value: 'AED', label: 'د.إ AED · UAE Dirham', symbol: 'AED' },
];

export const INVOICE_TEMPLATES = [
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'bold', label: 'Bold' },
];

/** Indian state codes (first 2 digits of GSTIN). Used for Place of Supply select
 *  and inter-state detection. */
export const STATE_CODE_TO_NAME: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

/** Sorted list of {code, name} for Select dropdowns. */
export const STATE_LIST = Object.entries(STATE_CODE_TO_NAME)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_TERMS = [
  '1. Payment is due within the agreed credit period from the date of invoice.',
  '2. Interest @ 18% p.a. will be charged on overdue invoices.',
  '3. All disputes are subject to local jurisdiction only.',
  '4. Goods once sold will not be taken back or exchanged.',
  '5. E. & O.E. — Errors and omissions excepted.',
].join('\n');

export const DEFAULT_BANK_DETAILS = [
  'Bank Name: HDFC Bank Ltd.',
  'Account Name: <Your Company Name>',
  'Account No.: 000000000000000',
  'IFSC: HDFC0000000',
  'Branch: Bengaluru — MG Road',
  'UPI ID: yourcompany@hdfcbank',
].join('\n');

export const DEFAULT_NOTES = 'Thank you for your business. We look forward to serving you again.';
