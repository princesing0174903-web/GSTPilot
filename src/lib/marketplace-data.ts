// ═══════════════════════════════════════════════════════════════════════════
// GSTPILOT MARKETPLACE™ & APP ECOSYSTEM™ — Demo Data Layer
// Phase 10: Turn GSTPilot from a SaaS into a Platform.
// ═══════════════════════════════════════════════════════════════════════════

// ── MODULE 1: APP STORE ────────────────────────────────────────────────────
export interface MarketplaceApp {
  id: string;
  name: string;
  developer: string;
  category: 'GST' | 'Banking' | 'Accounting' | 'Payments' | 'Payroll' | 'Communication' | 'Compliance' | 'Analytics';
  tagline: string;
  description: string;
  rating: number;
  reviews: number;
  installs: string;
  price: string;
  pricePeriod: 'free' | 'month' | 'one-time';
  featured: boolean;
  verified: boolean;
  iconBg: string; // gradient class
  iconSymbol: string; // emoji or short text
  capabilities: string[];
}

export const MARKETPLACE_APPS: MarketplaceApp[] = [
  {
    id: 'whatsapp-business',
    name: 'WhatsApp Business Cloud',
    developer: 'Meta Connect Labs',
    category: 'Communication',
    tagline: 'Send invoices, reminders & statements via WhatsApp automatically',
    description: 'Official WhatsApp Business API integration. Auto-send invoice PDFs, payment reminders, GSTR-ready summaries, and collection follow-ups directly to your clients\' WhatsApp. Two-way messaging with template approval.',
    rating: 4.9, reviews: 2847, installs: '12.4K', price: '₹999', pricePeriod: 'month',
    featured: true, verified: true, iconBg: 'from-green-500 to-emerald-600', iconSymbol: '💬',
    capabilities: ['Auto invoice delivery', 'Payment reminders', 'Two-way chat', 'Template approval', 'Broadcast lists'],
  },
  {
    id: 'razorpay',
    name: 'Razorpay Payment Gateway',
    developer: 'Razorpay Software Pvt Ltd',
    category: 'Payments',
    tagline: 'Accept UPI, cards, netbanking & wallets with auto-reconciliation',
    description: 'Full Razorpay integration. Generate payment links from invoices, auto-reconcile settlements, handle refunds, and sync TDS. Supports UPI AutoPay for recurring billing.',
    rating: 4.8, reviews: 5102, installs: '28.7K', price: '₹1,499', pricePeriod: 'month',
    featured: true, verified: true, iconBg: 'from-blue-500 to-indigo-600', iconSymbol: '💳',
    capabilities: ['UPI AutoPay', 'Payment links', 'Auto-reconciliation', 'Refunds', 'TDS sync', 'Settlement reports'],
  },
  {
    id: 'tally-prime',
    name: 'Tally Prime Sync',
    developer: 'Tally Solutions Pvt Ltd',
    category: 'Accounting',
    tagline: 'Two-way sync between Tally Prime and GSTPilot — no manual entry',
    description: 'Official Tally connector. Sync sales, purchase, journal vouchers, and masters bi-directionally. Auto-post GST returns to Tally ledgers. Real-time sync via Tally XML API.',
    rating: 4.7, reviews: 1893, installs: '8.3K', price: '₹2,499', pricePeriod: 'month',
    featured: true, verified: true, iconBg: 'from-amber-500 to-orange-600', iconSymbol: '📊',
    capabilities: ['Bi-directional sync', 'Voucher posting', 'Master sync', 'GST ledger mapping', 'Real-time'],
  },
  {
    id: 'zoho-books',
    name: 'Zoho Books Connector',
    developer: 'Zoho Corporation',
    category: 'Accounting',
    tagline: 'Sync invoices, estimates & expenses with Zoho Books',
    description: 'Native Zoho Books integration. Auto-create invoices in Zoho, sync expense categories, import vendor bills, and reconcile bank feeds. OAuth 2.0 secure connection.',
    rating: 4.6, reviews: 1247, installs: '6.1K', price: '₹1,299', pricePeriod: 'month',
    featured: false, verified: true, iconBg: 'from-red-500 to-rose-600', iconSymbol: '📚',
    capabilities: ['Invoice sync', 'Expense import', 'Bank reconciliation', 'Vendor bills', 'OAuth secure'],
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online Bridge',
    developer: 'Intuit India',
    category: 'Accounting',
    tagline: 'Connect QuickBooks Online with GSTPilot for seamless GST filing',
    description: 'Bridge for QuickBooks Online users in India. Sync sales receipts, purchase orders, and chart of accounts. Auto-generate GSTR-1/3B from QuickBooks data.',
    rating: 4.5, reviews: 682, installs: '3.2K', price: '₹1,999', pricePeriod: 'month',
    featured: false, verified: true, iconBg: 'from-green-600 to-teal-700', iconSymbol: '📗',
    capabilities: ['Sales receipt sync', 'Purchase orders', 'Chart of accounts', 'GSTR auto-gen'],
  },
  {
    id: 'icici-banking',
    name: 'ICICI Bank Corporate Connect',
    developer: 'ICICI Bank Ltd',
    category: 'Banking',
    tagline: 'Direct corporate banking — balances, statements & payments via API',
    description: 'Direct API integration with ICICI Corporate Banking. Live balance, transaction feeds, NEFT/RTGS/IMPS initiation, and auto-reconciliation. Corporate ID-based secure access.',
    rating: 4.8, reviews: 943, installs: '4.7K', price: '₹2,999', pricePeriod: 'month',
    featured: true, verified: true, iconBg: 'from-orange-500 to-amber-600', iconSymbol: '🏦',
    capabilities: ['Live balance', 'Transaction feed', 'NEFT/RTGS/IMPS', 'Auto-reconciliation'],
  },
  {
    id: 'payroll-deputy',
    name: 'Payroll Pro India',
    developer: 'PeopleWorks Labs',
    category: 'Payroll',
    tagline: 'Complete payroll with PF, ESI, TDS & payslip automation',
    description: 'Full Indian payroll engine. Auto-calculate PF, ESI, Professional Tax, TDS. Generate payslips, Form 16, and file PF/ESI returns. Multi-state compliance built-in.',
    rating: 4.7, reviews: 1564, installs: '7.8K', price: '₹49', pricePeriod: 'month',
    featured: false, verified: true, iconBg: 'from-purple-500 to-pink-600', iconSymbol: '👥',
    capabilities: ['PF/ESI calc', 'TDS auto-deduct', 'Form 16', 'Payslips', 'Multi-state'],
  },
  {
    id: 'gst-suvidha',
    name: 'GST Suvidha Provider',
    developer: 'GST Network Official',
    category: 'GST',
    tagline: 'Direct GSP integration for real-time GST return filing',
    description: 'Official GST Suvidha Provider connection. File GSTR-1, 3B, 9, 9C, ITC-04 directly. Real-time status, error handling, and Aadhaar authentication.',
    rating: 4.9, reviews: 4287, installs: '45.2K', price: '₹599', pricePeriod: 'month',
    featured: true, verified: true, iconBg: 'from-indigo-500 to-blue-700', iconSymbol: '🇮🇳',
    capabilities: ['GSTR-1/3B/9/9C', 'ITC-04', 'Aadhaar auth', 'Real-time status'],
  },
  {
    id: 'salesforce-crm',
    name: 'Salesforce CRM Sync',
    developer: 'Salesforce.com Inc',
    category: 'Compliance',
    tagline: 'Sync customer & opportunity data between Salesforce and GSTPilot',
    description: 'Bi-directional sync of accounts, contacts, and opportunities. Auto-create GSTPilot clients from Salesforce accounts. Map revenue stages to GST milestones.',
    rating: 4.4, reviews: 412, installs: '1.8K', price: '₹3,499', pricePeriod: 'month',
    featured: false, verified: true, iconBg: 'from-sky-500 to-blue-600', iconSymbol: '☁️',
    capabilities: ['Account sync', 'Contact sync', 'Opportunity mapping', 'Auto-client create'],
  },
  {
    id: 'clear-tax',
    name: 'ClearTax Direct Tax',
    developer: 'Defmacro Software Pvt Ltd',
    category: 'Compliance',
    tagline: 'Income Tax, ITR & advance tax computation with GSTPilot data',
    description: 'Direct tax suite. Compute income tax, file ITR-1 to ITR-7, calculate advance tax, and generate Form 16/16A. Uses GSTPilot financial data for accurate computation.',
    rating: 4.6, reviews: 2103, installs: '9.4K', price: '₹1,799', pricePeriod: 'month',
    featured: false, verified: true, iconBg: 'from-teal-500 to-cyan-600', iconSymbol: '🧾',
    capabilities: ['ITR-1 to 7', 'Advance tax', 'Form 16/16A', 'Tax planning'],
  },
  {
    id: 'slack-notify',
    name: 'Slack Notifications',
    developer: 'Slack Technologies',
    category: 'Communication',
    tagline: 'Get GST deadlines, filing confirmations & alerts in Slack',
    description: 'Push GSTPilot alerts to Slack channels. Filing due dates, payment confirmations, ITC mismatches, and Oracle insights delivered as rich Slack messages.',
    rating: 4.7, reviews: 856, installs: '5.2K', price: '₹0', pricePeriod: 'free',
    featured: false, verified: true, iconBg: 'from-purple-600 to-violet-700', iconSymbol: '📢',
    capabilities: ['Filing alerts', 'Deadline reminders', 'Oracle insights', 'Channel routing'],
  },
  {
    id: 'powerbi-analytics',
    name: 'Power BI Connector',
    developer: 'Microsoft Corporation',
    category: 'Analytics',
    tagline: 'Stream GSTPilot data to Power BI dashboards in real-time',
    description: 'Real-time data pipeline from GSTPilot to Power BI. Pre-built dashboard templates for GST compliance, cash flow, vendor analysis, and tax liability forecasting.',
    rating: 4.5, reviews: 729, installs: '3.6K', price: '₹899', pricePeriod: 'month',
    featured: false, verified: false, iconBg: 'from-yellow-500 to-amber-600', iconSymbol: '📈',
    capabilities: ['Real-time pipeline', 'Pre-built templates', 'Cash flow dashboard', 'Tax forecasting'],
  },
];

// ── MODULE 2: DEVELOPER PLATFORM ───────────────────────────────────────────
export interface Developer {
  id: string;
  name: string;
  avatar: string;
  appsPublished: number;
  totalInstalls: string;
  revenue: string;
  rating: number;
  status: 'verified' | 'pending' | 'suspended';
  joinedAt: string;
}

export const DEVELOPERS: Developer[] = [
  { id: 'd1', name: 'Meta Connect Labs', avatar: 'ML', appsPublished: 3, totalInstalls: '12.4K', revenue: '₹86.2L', rating: 4.9, status: 'verified', joinedAt: 'Jan 2024' },
  { id: 'd2', name: 'Tally Solutions', avatar: 'TS', appsPublished: 5, totalInstalls: '8.3K', revenue: '₹1.2Cr', rating: 4.7, status: 'verified', joinedAt: 'Nov 2023' },
  { id: 'd3', name: 'Razorpay Software', avatar: 'RP', appsPublished: 2, totalInstalls: '28.7K', revenue: '₹2.4Cr', rating: 4.8, status: 'verified', joinedAt: 'Oct 2023' },
  { id: 'd4', name: 'PeopleWorks Labs', avatar: 'PW', appsPublished: 4, totalInstalls: '7.8K', revenue: '₹54.3L', rating: 4.7, status: 'verified', joinedAt: 'Feb 2024' },
  { id: 'd5', name: 'FinTech Innovators', avatar: 'FI', appsPublished: 7, totalInstalls: '15.2K', revenue: '₹1.8Cr', rating: 4.6, status: 'verified', joinedAt: 'Dec 2023' },
];

// ── MODULE 3: API MARKETPLACE ──────────────────────────────────────────────
export interface ApiProduct {
  id: string;
  name: string;
  category: 'GST' | 'Invoice' | 'CFO' | 'Forecast' | 'Compliance' | 'Oracle';
  description: string;
  endpoints: number;
  calls: string; // monthly calls
  pricing: { tier: string; price: string; calls: string; features: string[] }[];
  latency: string;
  uptime: string;
  popular: boolean;
}

export const API_PRODUCTS: ApiProduct[] = [
  {
    id: 'gst-api',
    name: 'GST APIs™',
    category: 'GST',
    description: 'GSTR-1/3B/9 filing, GSTIN verification, ITC reconciliation, e-invoice generation, e-way bill creation. Full GSTN-compliant.',
    endpoints: 47, calls: '8.4M/mo', latency: '120ms', uptime: '99.97%',
    popular: true,
    pricing: [
      { tier: 'Starter', price: '₹2,999', calls: '10K/mo', features: ['All GST endpoints', 'Email support', '99.9% SLA'] },
      { tier: 'Growth', price: '₹9,999', calls: '100K/mo', features: ['Priority support', '99.97% SLA', 'Webhooks'] },
      { tier: 'Enterprise', price: '₹49,999', calls: '1M/mo', features: ['Dedicated support', '99.99% SLA', 'Custom rate limits'] },
    ],
  },
  {
    id: 'invoice-api',
    name: 'Invoice APIs™',
    category: 'Invoice',
    description: 'Create, send, track e-invoices. IRN generation, QR code, multi-currency, recurring invoices, payment links.',
    endpoints: 32, calls: '12.1M/mo', latency: '95ms', uptime: '99.98%',
    popular: true,
    pricing: [
      { tier: 'Starter', price: '₹1,999', calls: '20K/mo', features: ['All invoice endpoints', 'IRN generation', 'Email support'] },
      { tier: 'Growth', price: '₹6,999', calls: '200K/mo', features: ['Recurring invoices', 'Webhooks', 'Priority support'] },
      { tier: 'Enterprise', price: '₹34,999', calls: '2M/mo', features: ['Multi-currency', 'Dedicated support', '99.99% SLA'] },
    ],
  },
  {
    id: 'cfo-api',
    name: 'CFO APIs™',
    category: 'CFO',
    description: 'Financial analysis, ratio computation, benchmarking, working capital assessment, cash flow projection.',
    endpoints: 28, calls: '3.2M/mo', latency: '210ms', uptime: '99.95%',
    popular: false,
    pricing: [
      { tier: 'Starter', price: '₹3,999', calls: '5K/mo', features: ['Core CFO endpoints', 'Email support'] },
      { tier: 'Growth', price: '₹12,999', calls: '50K/mo', features: ['Benchmarking', 'Webhooks', 'Priority support'] },
      { tier: 'Enterprise', price: '₹59,999', calls: '500K/mo', features: ['Custom models', 'Dedicated support', '99.99% SLA'] },
    ],
  },
  {
    id: 'forecast-api',
    name: 'Forecast APIs™',
    category: 'Forecast',
    description: 'AI-powered cash flow forecasting, revenue prediction, expense modeling, scenario analysis.',
    endpoints: 19, calls: '1.8M/mo', latency: '340ms', uptime: '99.94%',
    popular: false,
    pricing: [
      { tier: 'Starter', price: '₹4,999', calls: '3K/mo', features: ['Basic forecasting', 'Email support'] },
      { tier: 'Growth', price: '₹14,999', calls: '30K/mo', features: ['Scenario analysis', 'Webhooks', 'Priority support'] },
      { tier: 'Enterprise', price: '₹74,999', calls: '300K/mo', features: ['Custom models', 'Dedicated support', '99.99% SLA'] },
    ],
  },
  {
    id: 'compliance-api',
    name: 'Compliance APIs™',
    category: 'Compliance',
    description: 'ROC filing, TDS returns, MCA compliance, legal notice tracking, deadline management.',
    endpoints: 35, calls: '2.6M/mo', latency: '180ms', uptime: '99.96%',
    popular: false,
    pricing: [
      { tier: 'Starter', price: '₹3,499', calls: '5K/mo', features: ['Core compliance', 'Email support'] },
      { tier: 'Growth', price: '₹11,999', calls: '50K/mo', features: ['Deadline alerts', 'Webhooks', 'Priority support'] },
      { tier: 'Enterprise', price: '₹54,999', calls: '500K/mo', features: ['Custom workflows', 'Dedicated support', '99.99% SLA'] },
    ],
  },
  {
    id: 'oracle-api',
    name: 'Oracle APIs™',
    category: 'Oracle',
    description: 'Oracle AI insights, natural language queries, proactive recommendations, anomaly detection.',
    endpoints: 22, calls: '5.7M/mo', latency: '420ms', uptime: '99.92%',
    popular: true,
    pricing: [
      { tier: 'Starter', price: '₹5,999', calls: '2K/mo', features: ['NL queries', 'Email support'] },
      { tier: 'Growth', price: '₹19,999', calls: '20K/mo', features: ['Proactive insights', 'Webhooks', 'Priority support'] },
      { tier: 'Enterprise', price: '₹99,999', calls: '200K/mo', features: ['Custom agents', 'Dedicated support', '99.99% SLA'] },
    ],
  },
];

// ── MODULE 4: AUTOMATION MARKETPLACE ───────────────────────────────────────
export interface WorkflowTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  steps: number;
  trigger: string;
  actions: string[];
  installs: string;
  rating: number;
  price: string;
  iconBg: string;
  iconSymbol: string;
  popular: boolean;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'gst-filing-auto',
    name: 'GST Filing Automation™',
    category: 'Compliance',
    description: 'End-to-end GSTR-1/3B automation: data fetch → ITC reconcile → draft prep → review → file → ack.',
    steps: 8, trigger: 'Monthly schedule (18th)',
    actions: ['Fetch GSTR-2B', 'Reconcile ITC', 'Prepare GSTR-3B draft', 'Notify CA for review', 'File on approval', 'Send acknowledgment', 'Update Tally', 'Archive'],
    installs: '8.4K', rating: 4.9, price: '₹1,499/mo',
    iconBg: 'from-indigo-500 to-blue-600', iconSymbol: '⚙️', popular: true,
  },
  {
    id: 'collections-recovery',
    name: 'Collections Recovery™',
    category: 'Finance',
    description: 'Automated receivables collection: reminder → escalation → call scheduling → legal notice.',
    steps: 6, trigger: 'Invoice overdue +3 days',
    actions: ['Send WhatsApp reminder', 'Email statement', 'Escalate to SMS', 'Schedule collector call', 'Send legal notice draft', 'Update CRM'],
    installs: '6.2K', rating: 4.8, price: '₹999/mo',
    iconBg: 'from-red-500 to-rose-600', iconSymbol: '📞', popular: true,
  },
  {
    id: 'expense-tracking',
    name: 'Expense Tracking™',
    category: 'Finance',
    description: 'Auto-categorize expenses from bank feed, match receipts, flag policy violations.',
    steps: 5, trigger: 'Bank transaction',
    actions: ['Fetch bank feed', 'Categorize via AI', 'Match receipt (OCR)', 'Flag policy breach', 'Post to ledger'],
    installs: '9.1K', rating: 4.7, price: '₹799/mo',
    iconBg: 'from-green-500 to-emerald-600', iconSymbol: '💰', popular: true,
  },
  {
    id: 'vendor-mgmt',
    name: 'Vendor Management™',
    category: 'Procurement',
    description: 'Vendor onboarding → GSTIN verify → PO → GRN → invoice 3-way match → payment.',
    steps: 7, trigger: 'New vendor created',
    actions: ['GSTIN verification', 'Vendor scorecard', 'Auto-PO generation', 'GRN matching', '3-way invoice match', 'Payment scheduling', 'TDS deduction'],
    installs: '4.7K', rating: 4.6, price: '₹1,299/mo',
    iconBg: 'from-purple-500 to-violet-600', iconSymbol: '🏭', popular: false,
  },
  {
    id: 'cash-forecast',
    name: 'Cash Forecast™',
    category: 'Finance',
    description: 'AI cash flow forecasting: receivables → payables → runway → scenario alerts.',
    steps: 4, trigger: 'Daily 6 AM',
    actions: ['Aggregate receivables', 'Aggregate payables', 'AI forecast (90-day)', 'Alert on shortfall'],
    installs: '7.3K', rating: 4.8, price: '₹1,199/mo',
    iconBg: 'from-cyan-500 to-blue-600', iconSymbol: '🔮', popular: true,
  },
  {
    id: 'recon-engine',
    name: 'Auto Reconciliation™',
    category: 'Finance',
    description: 'Bank → books auto-reconciliation with AI categorization and mismatch flagging.',
    steps: 6, trigger: 'Daily bank statement',
    actions: ['Import bank statement', 'Match to ledger', 'AI categorize unmatched', 'Flag discrepancies', 'Auto-post adjustments', 'Report'],
    installs: '5.8K', rating: 4.7, price: '₹899/mo',
    iconBg: 'from-teal-500 to-cyan-600', iconSymbol: '🔄', popular: false,
  },
];

// ── MODULE 5: REVENUE SHARING ──────────────────────────────────────────────
export interface RevenueRecord {
  developer: string;
  app: string;
  grossRevenue: string;
  developerShare: string; // 70%
  gstpilotShare: string;  // 30%
  status: 'paid' | 'pending' | 'processing';
  period: string;
}

export const REVENUE_RECORDS: RevenueRecord[] = [
  { developer: 'Meta Connect Labs', app: 'WhatsApp Business', grossRevenue: '₹12,38,400', developerShare: '₹8,66,880', gstpilotShare: '₹3,71,520', status: 'paid', period: 'Oct 2025' },
  { developer: 'Razorpay Software', app: 'Razorpay Gateway', grossRevenue: '₹43,04,700', developerShare: '₹30,13,290', gstpilotShare: '₹12,91,410', status: 'paid', period: 'Oct 2025' },
  { developer: 'Tally Solutions', app: 'Tally Prime Sync', grossRevenue: '₹20,74,200', developerShare: '₹14,51,940', gstpilotShare: '₹6,22,260', status: 'processing', period: 'Oct 2025' },
  { developer: 'PeopleWorks Labs', app: 'Payroll Pro India', grossRevenue: '₹3,89,220', developerShare: '₹2,72,454', gstpilotShare: '₹1,16,766', status: 'pending', period: 'Oct 2025' },
  { developer: 'FinTech Innovators', app: 'ClearTax Direct Tax', grossRevenue: '₹16,91,300', developerShare: '₹11,83,910', gstpilotShare: '₹5,07,390', status: 'paid', period: 'Oct 2025' },
];

export const REVENUE_SPLIT = { developer: 70, gstpilot: 30 };

// ── MODULE 6: ENTERPRISE EXTENSIONS ────────────────────────────────────────
export interface EnterpriseExtension {
  id: string;
  name: string;
  industry: string;
  description: string;
  modules: string[];
  users: string;
  price: string;
  iconBg: string;
  iconSymbol: string;
  popular: boolean;
}

export const ENTERPRISE_EXTENSIONS: EnterpriseExtension[] = [
  {
    id: 'manufacturing',
    name: 'Manufacturing Suite',
    industry: 'Manufacturing',
    description: 'Production planning, BOM management, shop floor control, cost accounting, GST jobwork.',
    modules: ['BOM & Routing', 'Work Orders', 'Shop Floor', 'Costing', 'Jobwork GST', 'MRP'],
    users: '2,400+', price: '₹4,999/mo',
    iconBg: 'from-orange-500 to-red-600', iconSymbol: '🏭', popular: true,
  },
  {
    id: 'healthcare',
    name: 'Healthcare Suite',
    industry: 'Healthcare',
    description: 'Hospital billing, insurance claims, pharmacy inventory, patient receivables, GST on healthcare.',
    modules: ['IPD/OPD Billing', 'Insurance TPA', 'Pharmacy', 'Patient AR', 'Healthcare GST', 'Equipment'],
    users: '1,800+', price: '₹5,999/mo',
    iconBg: 'from-red-500 to-pink-600', iconSymbol: '🏥', popular: true,
  },
  {
    id: 'real-estate',
    name: 'Real Estate Suite',
    industry: 'Real Estate',
    description: 'Project accounting, RERA compliance, customer receivables, land bank, construction GST.',
    modules: ['Project Accounting', 'RERA Filing', 'Customer AR', 'Land Bank', 'RERA GST', 'Possession'],
    users: '1,200+', price: '₹6,999/mo',
    iconBg: 'from-amber-500 to-yellow-600', iconSymbol: '🏗️', popular: false,
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce Suite',
    industry: 'E-Commerce',
    description: 'Multi-marketplace sync, order management, TCS reconciliation, returns, marketplace GST.',
    modules: ['Marketplace Sync', 'Order Mgmt', 'TCS Recon', 'Returns', 'Marketplace GST', 'Logistics'],
    users: '3,100+', price: '₹3,999/mo',
    iconBg: 'from-purple-500 to-indigo-600', iconSymbol: '🛒', popular: true,
  },
  {
    id: 'education',
    name: 'Education Suite',
    industry: 'Education',
    description: 'Fee management, student receivables, scholarship tracking, faculty payroll, education GST.',
    modules: ['Fee Collection', 'Student AR', 'Scholarships', 'Faculty Payroll', 'Edu GST', 'Hostel'],
    users: '1,600+', price: '₹3,499/mo',
    iconBg: 'from-blue-500 to-cyan-600', iconSymbol: '🎓', popular: false,
  },
  {
    id: 'logistics',
    name: 'Logistics Suite',
    industry: 'Logistics',
    description: 'Fleet management, freight billing, e-way bill automation, fuel tracking, logistics GST.',
    modules: ['Fleet Mgmt', 'Freight Billing', 'E-Way Auto', 'Fuel Tracking', 'Logistics GST', 'LR Mgmt'],
    users: '2,000+', price: '₹4,499/mo',
    iconBg: 'from-green-500 to-teal-600', iconSymbol: '🚛', popular: false,
  },
];

// ── MODULE 7: AI SKILL STORE ───────────────────────────────────────────────
export interface AiSkill {
  id: string;
  name: string;
  domain: string;
  description: string;
  capabilities: string[];
  accuracy: string;
  installs: string;
  rating: number;
  price: string;
  iconBg: string;
  iconSymbol: string;
  popular: boolean;
}

export const AI_SKILLS: AiSkill[] = [
  {
    id: 'gst-expert',
    name: 'GST Expert Skill',
    domain: 'Taxation',
    description: 'Oracle becomes a GST expert — answers GSTIN, HSN, ITC, reverse charge, place of supply questions with cited case laws.',
    capabilities: ['GSTIN validation', 'HSN classification', 'ITC rules', 'Reverse charge', 'Place of supply', 'Case law citations'],
    accuracy: '99.2%', installs: '14.2K', rating: 4.9, price: '₹999/mo',
    iconBg: 'from-indigo-500 to-blue-700', iconSymbol: '🧠', popular: true,
  },
  {
    id: 'legal-expert',
    name: 'Legal Expert Skill',
    domain: 'Legal',
    description: 'Oracle interprets GST notices, drafts replies, flags litigation risk, cites landmark judgments.',
    capabilities: ['Notice interpretation', 'Reply drafting', 'Litigation risk', 'Judgment citations', 'Compliance opinion'],
    accuracy: '97.8%', installs: '8.7K', rating: 4.8, price: '₹1,499/mo',
    iconBg: 'from-amber-500 to-orange-600', iconSymbol: '⚖️', popular: true,
  },
  {
    id: 'banking-expert',
    name: 'Banking Expert Skill',
    domain: 'Banking',
    description: 'Oracle analyzes banking transactions, detects fraud, optimizes cash management, advises on credit.',
    capabilities: ['Transaction analysis', 'Fraud detection', 'Cash optimization', 'Credit advisory', 'Bank reconciliation'],
    accuracy: '98.5%', installs: '6.3K', rating: 4.8, price: '₹1,199/mo',
    iconBg: 'from-green-500 to-emerald-700', iconSymbol: '🏦', popular: false,
  },
  {
    id: 'cfo-expert',
    name: 'CFO Expert Skill',
    domain: 'Finance',
    description: 'Oracle provides CFO-level analysis — ratios, benchmarks, M&A modeling, capital structure.',
    capabilities: ['Financial ratios', 'Industry benchmark', 'M&A modeling', 'Capital structure', 'Investor reporting'],
    accuracy: '96.4%', installs: '9.1K', rating: 4.7, price: '₹1,799/mo',
    iconBg: 'from-purple-500 to-violet-700', iconSymbol: '📊', popular: true,
  },
  {
    id: 'hr-expert',
    name: 'HR Expert Skill',
    domain: 'Human Resources',
    description: 'Oracle handles PF/ESI/PT queries, payroll compliance, labor law, attrition prediction.',
    capabilities: ['PF/ESI/PT queries', 'Payroll compliance', 'Labor law', 'Attrition prediction', 'CTC optimization'],
    accuracy: '97.1%', installs: '4.8K', rating: 4.6, price: '₹899/mo',
    iconBg: 'from-pink-500 to-rose-600', iconSymbol: '👤', popular: false,
  },
  {
    id: 'audit-expert',
    name: 'Audit Expert Skill',
    domain: 'Audit',
    description: 'Oracle conducts internal audits, flags control gaps, prepares audit checklists, suggests remediation.',
    capabilities: ['Internal audit', 'Control gap analysis', 'Audit checklists', 'Risk scoring', 'Remediation'],
    accuracy: '98.9%', installs: '5.4K', rating: 4.8, price: '₹1,299/mo',
    iconBg: 'from-teal-500 to-cyan-700', iconSymbol: '🔍', popular: false,
  },
];

// ── MODULE 8: BILLING ENGINE ───────────────────────────────────────────────
export interface BillingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  highlighted: boolean;
  appAllowance: string;
  apiCalls: string;
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: 'free', name: 'Free', price: '₹0', period: 'forever',
    tagline: 'For individuals getting started',
    features: ['1 user', '1 firm', 'Up to 50 invoices/mo', 'Basic GST filing', 'Community support', '2 marketplace apps'],
    highlighted: false, appAllowance: '2 apps', apiCalls: '1K/mo',
  },
  {
    id: 'starter', name: 'Starter', price: '₹1,499', period: 'per month',
    tagline: 'For small practices & startups',
    features: ['3 users', '1 firm', 'Up to 500 invoices/mo', 'All GST returns', 'Email support', '10 marketplace apps', 'Basic Oracle AI'],
    highlighted: false, appAllowance: '10 apps', apiCalls: '10K/mo',
  },
  {
    id: 'growth', name: 'Growth', price: '₹4,999', period: 'per month',
    tagline: 'For growing businesses',
    features: ['10 users', '3 firms', 'Unlimited invoices', 'All returns + TDS', 'Priority support', 'Unlimited apps', 'Full Oracle AI', 'API access'],
    highlighted: true, appAllowance: 'Unlimited apps', apiCalls: '100K/mo',
  },
  {
    id: 'business', name: 'Business', price: '₹14,999', period: 'per month',
    tagline: 'For mid-market & CA firms',
    features: ['25 users', '10 firms', 'White-label portal', 'Custom workflows', 'Dedicated CSM', 'Unlimited everything', 'Oracle Pro AI', 'Priority API'],
    highlighted: false, appAllowance: 'Unlimited apps', apiCalls: '500K/mo',
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 'Custom', period: 'contact sales',
    tagline: 'For large enterprises',
    features: ['Unlimited users', 'Unlimited firms', 'On-prem option', 'SSO + SAML', 'Custom SLA', 'Dedicated infra', 'Oracle Enterprise', 'Custom API limits'],
    highlighted: false, appAllowance: 'Unlimited apps', apiCalls: 'Custom',
  },
];

// ── MODULE 9: ECOSYSTEM ANALYTICS ──────────────────────────────────────────
export const ECOSYSTEM_STATS = {
  totalApps: 147,
  totalDevelopers: 89,
  totalInstalls: '2.8M',
  totalApiCalls: '34.2M',
  totalRevenue: '₹18.4 Cr',
  developerPayouts: '₹12.9 Cr',
  avgRating: 4.7,
  activeUsers: '1,42,000+',
  monthlyGrowth: '+24.3%',
  topCategories: [
    { name: 'GST', apps: 32, installs: '8.4M', color: '#3B82F6' },
    { name: 'Banking', apps: 24, installs: '5.2M', color: '#8B5CF6' },
    { name: 'Accounting', apps: 28, installs: '6.1M', color: '#22D3EE' },
    { name: 'Payments', apps: 19, installs: '4.8M', color: '#10B981' },
    { name: 'Payroll', apps: 16, installs: '3.2M', color: '#F59E0B' },
    { name: 'Communication', apps: 14, installs: '4.1M', color: '#EC4899' },
    { name: 'Compliance', apps: 9, installs: '1.8M', color: '#6366F1' },
    { name: 'Analytics', apps: 5, installs: '0.6M', color: '#EF4444' },
  ],
  // 12-month install growth series (in thousands)
  installGrowth: [120, 145, 168, 192, 218, 247, 281, 312, 348, 389, 421, 467],
  // 12-month revenue series (in lakhs)
  revenueGrowth: [82, 94, 108, 121, 139, 156, 174, 192, 211, 228, 246, 264],
  topAppsByRevenue: [
    { name: 'Razorpay Gateway', revenue: '₹43L', share: 23 },
    { name: 'Tally Prime Sync', revenue: '₹21L', share: 11 },
    { name: 'ClearTax Direct Tax', revenue: '₹17L', share: 9 },
    { name: 'WhatsApp Business', revenue: '₹12L', share: 7 },
    { name: 'GST Suvidha Provider', revenue: '₹11L', share: 6 },
  ],
};

// ── MODULE 10: PLATFORM MODE TRANSFORMATION ────────────────────────────────
export const PLATFORM_TRANSFORMATION = {
  before: {
    label: 'Before Phase 10',
    title: 'GSTPilot = SaaS',
    points: ['Single product', 'Fixed features', 'No third-party apps', 'Closed system', 'One revenue stream'],
  },
  after: {
    label: 'After Phase 10',
    title: 'GSTPilot = Financial Operating System Platform™',
    points: ['147 apps in store', 'Open developer platform', '6 API products', 'Marketplace revenue', 'AI Skill Store', 'Enterprise extensions', 'Multi-revenue stream'],
  },
};
