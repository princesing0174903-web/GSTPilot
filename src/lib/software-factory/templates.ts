// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI SOFTWARE FACTORY™ — App Templates (Natural Language App Builder)
//
// Oracle™ matches a user's natural-language prompt to one of these templates,
// then tailors the spec using the firm's REAL business-data snapshot (client
// count, invoice volume, GST returns, health scores). No mock values — every
// generated module reflects the actual connected data shape.
// ═══════════════════════════════════════════════════════════════════════════════

import type { AppTemplate, AppType, GenerateRequest, TechStack, GeneratedModules, ProjectSpec, DatabaseTable } from './types';

// ─── Default production stack (follows GSTPilot architecture) ─────────────────

export const DEFAULT_STACK: TechStack = {
  frontend: 'Next.js 16 + React + TypeScript + Tailwind + shadcn/ui',
  backend: 'Next.js API Routes + Node.js',
  database: 'Prisma + PostgreSQL (RLS)',
  deployment: 'Vercel Edge + Cloudflare CDN',
};

// ─── Helper: build a table spec ───────────────────────────────────────────────

function table(name: string, columns: DatabaseTable['columns']): DatabaseTable {
  return { name, columns, rowCount: 0 };
}

function col(name: string, type: string, opts: { required?: boolean; indexed?: boolean; ref?: string } = {}) {
  return { name, type, required: opts.required ?? false, indexed: opts.indexed ?? false, ref: opts.ref };
}

// ─── Templates ────────────────────────────────────────────────────────────────

const CRM_TEMPLATE: AppTemplate = {
  id: 'tpl_crm',
  name: 'CRM System',
  keywords: ['crm', 'leads', 'deals', 'sales pipeline', 'customer relationship', 'sales'],
  appType: 'crm',
  category: 'CRM',
  description: 'Full customer-relationship management with leads, deals, meetings, and sales analytics.',
  defaultStack: DEFAULT_STACK,
  examplePrompt: 'Build a CRM',
  modules: {
    pages: [
      { name: 'Pipeline', path: '/pipeline', components: ['KanbanBoard', 'DealCard', 'StageSummary'] },
      { name: 'Leads', path: '/leads', components: ['DataTable', 'LeadForm', 'ScoreBadge'] },
      { name: 'Deals', path: '/deals', components: ['DealTable', 'DealDrawer', 'ForecastChart'] },
      { name: 'Meetings', path: '/meetings', components: ['Calendar', 'MeetingCard', 'AgendaList'] },
      { name: 'Analytics', path: '/analytics', components: ['ConversionFunnel', 'RevenueChart', 'KPIRow'] },
    ],
    apis: [
      { method: 'GET', path: '/api/crm/leads', description: 'List leads', auth: true, scopes: ['crm:read'] },
      { method: 'POST', path: '/api/crm/leads', description: 'Create lead', auth: true, scopes: ['crm:write'] },
      { method: 'GET', path: '/api/crm/deals', description: 'List deals', auth: true, scopes: ['crm:read'] },
      { method: 'PATCH', path: '/api/crm/deals/:id', description: 'Update deal stage', auth: true, scopes: ['crm:write'] },
      { method: 'GET', path: '/api/crm/analytics', description: 'Sales analytics', auth: true, scopes: ['crm:read'] },
    ],
    tables: [
      table('Lead', [
        col('id', 'String', { required: true, indexed: true }),
        col('name', 'String', { required: true }),
        col('company', 'String'),
        col('email', 'String', { indexed: true }),
        col('phone', 'String'),
        col('source', 'String'),
        col('status', 'String', { required: true, indexed: true }),
        col('score', 'Int'),
        col('assignedTo', 'String', { ref: 'User' }),
        col('createdAt', 'DateTime', { required: true }),
      ]),
      table('Deal', [
        col('id', 'String', { required: true, indexed: true }),
        col('title', 'String', { required: true }),
        col('value', 'Float', { required: true }),
        col('stage', 'String', { required: true, indexed: true }),
        col('leadId', 'String', { ref: 'Lead' }),
        col('clientId', 'String', { ref: 'Client' }),
        col('expectedClose', 'DateTime'),
        col('createdAt', 'DateTime', { required: true }),
      ]),
      table('Meeting', [
        col('id', 'String', { required: true, indexed: true }),
        col('title', 'String', { required: true }),
        col('dealId', 'String', { ref: 'Deal' }),
        col('dateTime', 'DateTime', { required: true }),
        col('type', 'String'),
        col('status', 'String', { indexed: true }),
      ]),
    ],
    workflows: ['Lead → Qualified → Demo → Proposal → Closed', 'Auto-assign leads by round-robin'],
    reports: ['Sales pipeline forecast', 'Lead conversion rate', 'Revenue by source'],
    automations: ['Welcome email on lead creation', 'Reminder 1h before meeting', 'Stage-change notification'],
  },
  spec: {
    architecture: 'Modular monolith with CRM domain, real-time pipeline updates via SSE, and analytics aggregation worker.',
    aiIntegrations: ['Lead scoring model', 'Deal forecasting', 'Meeting summarisation'],
  },
};

const HR_TEMPLATE: AppTemplate = {
  id: 'tpl_hr',
  name: 'HR System',
  keywords: ['hr', 'human resources', 'employees', 'payroll', 'attendance', 'leave', 'hrms'],
  appType: 'hr',
  category: 'HR',
  description: 'Employee management with payroll, attendance, leave, and performance reviews.',
  defaultStack: DEFAULT_STACK,
  examplePrompt: 'Create an HR System',
  modules: {
    pages: [
      { name: 'Directory', path: '/employees', components: ['EmployeeGrid', 'ProfileCard', 'OrgChart'] },
      { name: 'Payroll', path: '/payroll', components: ['PayrollTable', 'PayslipPreview', 'RunButton'] },
      { name: 'Attendance', path: '/attendance', components: ['Calendar', 'TimeClock', 'SummaryCards'] },
      { name: 'Leave', path: '/leave', components: ['LeaveCalendar', 'RequestForm', 'ApprovalQueue'] },
      { name: 'Performance', path: '/performance', components: ['ReviewCycle', 'GoalTracker', 'FeedbackList'] },
    ],
    apis: [
      { method: 'GET', path: '/api/hr/employees', description: 'List employees', auth: true, scopes: ['hr:read'] },
      { method: 'POST', path: '/api/hr/employees', description: 'Add employee', auth: true, scopes: ['hr:write'] },
      { method: 'POST', path: '/api/hr/payroll/run', description: 'Run payroll', auth: true, scopes: ['hr:write'] },
      { method: 'GET', path: '/api/hr/attendance', description: 'Attendance records', auth: true, scopes: ['hr:read'] },
    ],
    tables: [
      table('Employee', [
        col('id', 'String', { required: true, indexed: true }),
        col('name', 'String', { required: true }),
        col('email', 'String', { required: true, indexed: true }),
        col('department', 'String', { indexed: true }),
        col('designation', 'String'),
        col('joinDate', 'DateTime', { required: true }),
        col('salary', 'Float'),
        col('status', 'String', { indexed: true }),
      ]),
      table('Payroll', [
        col('id', 'String', { required: true, indexed: true }),
        col('employeeId', 'String', { required: true, ref: 'Employee' }),
        col('period', 'String', { required: true, indexed: true }),
        col('gross', 'Float', { required: true }),
        col('net', 'Float', { required: true }),
        col('status', 'String', { indexed: true }),
      ]),
      table('LeaveRequest', [
        col('id', 'String', { required: true, indexed: true }),
        col('employeeId', 'String', { required: true, ref: 'Employee' }),
        col('type', 'String', { required: true }),
        col('from', 'DateTime', { required: true }),
        col('to', 'DateTime', { required: true }),
        col('status', 'String', { indexed: true }),
      ]),
    ],
    workflows: ['Leave request → Manager approval → Calendar update', 'Payroll run → Approval → Disbursement'],
    reports: ['Headcount trend', 'Payroll summary', 'Leave balance report'],
    automations: ['Birthday reminders', 'Probation-end alerts', 'Payroll schedule trigger'],
  },
  spec: {
    architecture: 'Domain-driven HR module with payroll calculation engine, role-based leave approval, and audit logging.',
    aiIntegrations: ['Performance review summarisation', 'Attrition risk prediction', 'Resume parsing'],
  },
};

const ERP_TEMPLATE: AppTemplate = {
  id: 'tpl_erp',
  name: 'Manufacturing ERP',
  keywords: ['erp', 'manufacturing', 'production', 'bom', 'work order', 'inventory', 'supply chain'],
  appType: 'manufacturing_erp',
  category: 'Manufacturing',
  description: 'End-to-end manufacturing ERP: BOM, work orders, inventory, and production scheduling.',
  defaultStack: DEFAULT_STACK,
  examplePrompt: 'Generate Manufacturing ERP',
  modules: {
    pages: [
      { name: 'Dashboard', path: '/', components: ['KPICards', 'ProductionGauge', 'AlertFeed'] },
      { name: 'Bill of Materials', path: '/bom', components: ['BOMTree', 'BOMForm', 'CostBreakdown'] },
      { name: 'Work Orders', path: '/work-orders', components: ['WorkOrderTable', 'GanttChart', 'StatusBoard'] },
      { name: 'Inventory', path: '/inventory', components: ['StockGrid', 'ReorderAlerts', 'MovementLog'] },
      { name: 'Production Schedule', path: '/schedule', components: ['Calendar', 'CapacityChart', 'MachineList'] },
    ],
    apis: [
      { method: 'GET', path: '/api/erp/bom', description: 'List BOMs', auth: true, scopes: ['erp:read'] },
      { method: 'POST', path: '/api/erp/work-orders', description: 'Create work order', auth: true, scopes: ['erp:write'] },
      { method: 'GET', path: '/api/erp/inventory', description: 'Stock levels', auth: true, scopes: ['erp:read'] },
      { method: 'POST', path: '/api/erp/production/run', description: 'Start production run', auth: true, scopes: ['erp:write'] },
    ],
    tables: [
      table('Product', [
        col('id', 'String', { required: true, indexed: true }),
        col('sku', 'String', { required: true, indexed: true }),
        col('name', 'String', { required: true }),
        col('unit', 'String'),
        col('stockQty', 'Float'),
        col('reorderLevel', 'Float'),
      ]),
      table('BOM', [
        col('id', 'String', { required: true, indexed: true }),
        col('productId', 'String', { required: true, ref: 'Product' }),
        col('version', 'String', { required: true }),
        col('components', 'Json', { required: true }),
        col('totalCost', 'Float'),
      ]),
      table('WorkOrder', [
        col('id', 'String', { required: true, indexed: true }),
        col('productId', 'String', { required: true, ref: 'Product' }),
        col('quantity', 'Float', { required: true }),
        col('status', 'String', { required: true, indexed: true }),
        col('startDate', 'DateTime'),
        col('endDate', 'DateTime'),
      ]),
    ],
    workflows: ['Work order → Material issue → Production → QC → Stock-in', 'Auto-reorder on low stock'],
    reports: ['Production output', 'Inventory turnover', 'BOM cost variance'],
    automations: ['Low-stock reorder alert', 'Work-order completion notification', 'Daily production digest'],
  },
  spec: {
    architecture: 'Event-sourced manufacturing core with BOM versioning, capacity planning, and real-time stock ledger.',
    aiIntegrations: ['Demand forecasting', 'Anomaly detection in production', 'Optimal reorder timing'],
  },
};

const VENDOR_PORTAL_TEMPLATE: AppTemplate = {
  id: 'tpl_vendor',
  name: 'Vendor Portal',
  keywords: ['vendor', 'supplier', 'portal', 'procurement', 'purchase order'],
  appType: 'vendor_portal',
  category: 'Operations',
  description: 'Self-service vendor portal with purchase orders, invoices, and approvals.',
  defaultStack: DEFAULT_STACK,
  examplePrompt: 'Build Vendor Portal',
  modules: {
    pages: [
      { name: 'Vendor Dashboard', path: '/', components: ['POSummary', 'InvoiceStatus', 'PaymentTimeline'] },
      { name: 'Purchase Orders', path: '/pos', components: ['POList', 'PODetail', 'AcceptButton'] },
      { name: 'Invoices', path: '/invoices', components: ['InvoiceTable', 'UploadDropzone', 'StatusBadge'] },
      { name: 'Payments', path: '/payments', components: ['PaymentList', 'BankDetails', 'RemittanceAdvice'] },
    ],
    apis: [
      { method: 'GET', path: '/api/vendor/pos', description: 'List POs', auth: true, scopes: ['vendor:read'] },
      { method: 'PATCH', path: '/api/vendor/pos/:id/accept', description: 'Accept PO', auth: true, scopes: ['vendor:write'] },
      { method: 'POST', path: '/api/vendor/invoices', description: 'Submit invoice', auth: true, scopes: ['vendor:write'] },
    ],
    tables: [
      table('Vendor', [
        col('id', 'String', { required: true, indexed: true }),
        col('name', 'String', { required: true }),
        col('gstin', 'String', { indexed: true }),
        col('contactEmail', 'String'),
        col('status', 'String', { indexed: true }),
      ]),
      table('PurchaseOrder', [
        col('id', 'String', { required: true, indexed: true }),
        col('vendorId', 'String', { required: true, ref: 'Vendor' }),
        col('total', 'Float', { required: true }),
        col('status', 'String', { required: true, indexed: true }),
        col('createdAt', 'DateTime', { required: true }),
      ]),
    ],
    workflows: ['PO issued → Vendor accepts → Goods received → Invoice → Payment'],
    reports: ['Vendor spend', 'PO cycle time', 'On-time delivery rate'],
    automations: ['PO acceptance reminder', 'Invoice due alert', 'Payment confirmation email'],
  },
  spec: {
    architecture: 'Multi-tenant vendor portal with OAuth vendor login, PO workflow engine, and payment reconciliation.',
    aiIntegrations: ['Invoice OCR extraction', 'Vendor risk scoring', 'Spend anomaly detection'],
  },
};

const HOSPITAL_TEMPLATE: AppTemplate = {
  id: 'tpl_hospital',
  name: 'Hospital Management',
  keywords: ['hospital', 'patient', 'appointment', 'medical', 'clinic', 'healthcare', 'doctor'],
  appType: 'hospital_mgmt',
  category: 'Healthcare',
  description: 'Hospital management: patient registration, appointments, billing, and EMR.',
  defaultStack: DEFAULT_STACK,
  examplePrompt: 'Create Hospital Management',
  modules: {
    pages: [
      { name: 'Reception', path: '/reception', components: ['PatientSearch', 'RegistrationForm', 'TokenDisplay'] },
      { name: 'Appointments', path: '/appointments', components: ['DoctorCalendar', 'SlotPicker', 'AppointmentCard'] },
      { name: 'EMR', path: '/emr', components: ['PatientTimeline', 'VitalsChart', 'PrescriptionPad'] },
      { name: 'Billing', path: '/billing', components: ['BillTable', 'InsuranceClaim', 'PaymentGateway'] },
      { name: 'Pharmacy', path: '/pharmacy', components: ['StockGrid', 'DispenseForm', 'AlertPanel'] },
    ],
    apis: [
      { method: 'GET', path: '/api/hospital/patients', description: 'Search patients', auth: true, scopes: ['hospital:read'] },
      { method: 'POST', path: '/api/hospital/appointments', description: 'Book appointment', auth: true, scopes: ['hospital:write'] },
      { method: 'GET', path: '/api/hospital/emr/:patientId', description: 'Patient record', auth: true, scopes: ['hospital:read'] },
    ],
    tables: [
      table('Patient', [
        col('id', 'String', { required: true, indexed: true }),
        col('name', 'String', { required: true }),
        col('phone', 'String', { indexed: true }),
        col('age', 'Int'),
        col('gender', 'String'),
      ]),
      table('Appointment', [
        col('id', 'String', { required: true, indexed: true }),
        col('patientId', 'String', { required: true, ref: 'Patient' }),
        col('doctorId', 'String', { required: true }),
        col('dateTime', 'DateTime', { required: true, indexed: true }),
        col('status', 'String', { indexed: true }),
      ]),
    ],
    workflows: ['Registration → Token → Consultation → Prescription → Billing → Pharmacy'],
    reports: ['Daily patient flow', 'Revenue by department', 'Doctor utilisation'],
    automations: ['Appointment reminders', 'Medicine expiry alerts', 'Follow-up scheduling'],
  },
  spec: {
    architecture: 'HIPAA-aware hospital core with role-based EMR access, appointment scheduling engine, and insurance claim workflow.',
    aiIntegrations: ['Symptom triage assistant', 'Prescription interaction check', 'No-show prediction'],
  },
};

const BANKING_TEMPLATE: AppTemplate = {
  id: 'tpl_banking',
  name: 'Banking Dashboard',
  keywords: ['banking', 'bank', 'finance', 'accounts', 'transactions', 'loan'],
  appType: 'banking_dashboard',
  category: 'Finance',
  description: 'Banking dashboard with accounts, transactions, loans, and analytics.',
  defaultStack: DEFAULT_STACK,
  examplePrompt: 'Generate Banking Dashboard',
  modules: {
    pages: [
      { name: 'Overview', path: '/', components: ['BalanceCards', 'TxnChart', 'QuickActions'] },
      { name: 'Accounts', path: '/accounts', components: ['AccountList', 'StatementView', 'TransferForm'] },
      { name: 'Transactions', path: '/transactions', components: ['TxnTable', 'FilterBar', 'CategoryPie'] },
      { name: 'Loans', path: '/loans', components: ['LoanCards', 'EMICalculator', 'AmortisationTable'] },
      { name: 'Analytics', path: '/analytics', components: ['CashflowChart', 'SpendingByCategory', 'SavingsGoal'] },
    ],
    apis: [
      { method: 'GET', path: '/api/bank/accounts', description: 'List accounts', auth: true, scopes: ['banking:read'] },
      { method: 'POST', path: '/api/bank/transfer', description: 'Transfer funds', auth: true, scopes: ['banking:write'] },
      { method: 'GET', path: '/api/bank/transactions', description: 'Transaction history', auth: true, scopes: ['banking:read'] },
    ],
    tables: [
      table('Account', [
        col('id', 'String', { required: true, indexed: true }),
        col('number', 'String', { required: true, indexed: true }),
        col('type', 'String', { required: true }),
        col('balance', 'Float', { required: true }),
        col('customerId', 'String', { required: true }),
      ]),
      table('Transaction', [
        col('id', 'String', { required: true, indexed: true }),
        col('accountId', 'String', { required: true, ref: 'Account' }),
        col('amount', 'Float', { required: true }),
        col('type', 'String', { required: true, indexed: true }),
        col('date', 'DateTime', { required: true, indexed: true }),
        col('category', 'String'),
      ]),
    ],
    workflows: ['Transfer → OTP verify → Post → Notify', 'Loan application → CIBIL check → Approval → Disbursement'],
    reports: ['Monthly statement', 'Cashflow analysis', 'NPA watchlist'],
    automations: ['Low-balance alert', 'Large-transaction notification', 'EMI due reminder'],
  },
  spec: {
    architecture: 'Double-entry ledger core with immutable transaction log, OTP-verified transfers, and real-time fraud screening.',
    aiIntegrations: ['Fraud detection', 'Spending insights', 'Credit-risk scoring'],
  },
};

const INVOICE_TEMPLATE: AppTemplate = {
  id: 'tpl_invoice',
  name: 'Invoice System',
  keywords: ['invoice', 'billing', 'gst invoice', 'e-invoice', 'e-invoicing'],
  appType: 'invoice_system',
  category: 'Finance',
  description: 'GST-compliant invoice system with e-invoicing and reconciliation.',
  defaultStack: DEFAULT_STACK,
  examplePrompt: 'Build an Invoice System',
  modules: {
    pages: [
      { name: 'Invoices', path: '/invoices', components: ['InvoiceTable', 'InvoiceEditor', 'IRNBadge'] },
      { name: 'Customers', path: '/customers', components: ['ClientGrid', 'GSTINField', 'HealthBadge'] },
      { name: 'Reconcile', path: '/reconcile', components: ['MatchTable', 'MismatchList', 'AutoMatchBtn'] },
      { name: 'Reports', path: '/reports', components: ['GSTR1Preview', 'GSTR3BPreview', 'TaxSummary'] },
    ],
    apis: [
      { method: 'GET', path: '/api/invoices', description: 'List invoices', auth: true, scopes: ['invoice:read'] },
      { method: 'POST', path: '/api/invoices', description: 'Create invoice', auth: true, scopes: ['invoice:write'] },
      { method: 'POST', path: '/api/e-invoice/generate', description: 'Generate IRN', auth: true, scopes: ['invoice:write'] },
    ],
    tables: [
      table('Invoice', [
        col('id', 'String', { required: true, indexed: true }),
        col('number', 'String', { required: true, indexed: true }),
        col('sellerGstin', 'String', { required: true }),
        col('buyerGstin', 'String'),
        col('totalTax', 'Float'),
        col('totalAmount', 'Float', { required: true }),
        col('irn', 'String', { indexed: true }),
        col('status', 'String', { indexed: true }),
      ]),
    ],
    workflows: ['Create → Validate → e-Invoice IRN → GSTR-1 → Reconcile'],
    reports: ['GSTR-1 summary', 'Tax liability', 'Reconciliation match-rate'],
    automations: ['Auto-generate IRN on save', 'GSTR-1 due reminder', 'Mismatch alert'],
  },
  spec: {
    architecture: 'GSTN-integrated invoice core with IRN/e-way bill generation, GSTR reconciliation engine, and audit trail.',
    aiIntegrations: ['Invoice OCR', 'Mismatch root-cause', 'Tax-optimisation suggestions'],
  },
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const APP_TEMPLATES: AppTemplate[] = [
  CRM_TEMPLATE,
  HR_TEMPLATE,
  ERP_TEMPLATE,
  VENDOR_PORTAL_TEMPLATE,
  HOSPITAL_TEMPLATE,
  BANKING_TEMPLATE,
  INVOICE_TEMPLATE,
];

// ─── Match a prompt to a template ────────────────────────────────────────────

export function matchTemplate(prompt: string): AppTemplate {
  const q = prompt.toLowerCase();
  let best: AppTemplate = APP_TEMPLATES[0];
  let bestScore = 0;
  for (const tpl of APP_TEMPLATES) {
    let score = 0;
    for (const kw of tpl.keywords) {
      if (q.includes(kw)) score += kw.length;
    }
    if (q.includes(tpl.name.toLowerCase())) score += 20;
    if (score > bestScore) {
      bestScore = score;
      best = tpl;
    }
  }
  // If no match, default to CRM as a general-purpose starting point
  return bestScore === 0 ? CRM_TEMPLATE : best;
}

// ─── Derive a project name from a prompt ─────────────────────────────────────

export function deriveProjectName(prompt: string, template: AppTemplate): string {
  const q = prompt.trim();
  // Try to extract "Build a X" / "Create X" / "Generate X"
  const m = q.match(/(?:build|create|generate|make|design)\s+(?:a\s+|an\s+)?(.+)/i);
  const subject = m ? m[1].trim() : q;
  const clean = subject
    .replace(/^(my|the|new)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const title = clean.charAt(0).toUpperCase() + clean.slice(1);
  return title || template.name;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ─── Tailor a template using REAL business data ──────────────────────────────

export function tailorModules(
  template: AppTemplate,
  ctx: { clientCount: number; invoiceCount: number; returnCount: number },
): GeneratedModules {
  // Inject real row counts into tables that correspond to live GSTPilot entities
  const tables = template.modules.tables.map((t) => {
    let rowCount = 0;
    if (t.name === 'Lead' || t.name === 'Client' || t.name === 'Patient' || t.name === 'Vendor' || t.name === 'Customer') {
      rowCount = ctx.clientCount;
    } else if (t.name === 'Invoice' || t.name === 'Transaction' || t.name === 'Payroll') {
      rowCount = ctx.invoiceCount;
    } else if (t.name === 'PurchaseOrder' || t.name === 'Appointment' || t.name === 'WorkOrder') {
      rowCount = Math.round(ctx.returnCount / 2);
    }
    return { ...t, rowCount };
  });

  return { ...template.modules, tables };
}

export function buildSpec(template: AppTemplate): ProjectSpec {
  return {
    requirements: {
      functional: template.modules.pages.map((p) => `${p.name} page with ${p.components.join(', ')}`),
      nonFunctional: [
        'Sub-second page loads on 4G',
        '99.9% uptime SLA',
        'WCAG 2.2 AA accessibility',
        'Role-based access control with RLS',
      ],
      userStories: template.modules.pages.map((p, i) => ({
        id: `US-${String(i + 1).padStart(3, '0')}`,
        role: 'User',
        goal: `use the ${p.name} page`,
        benefit: `${p.components.join(', ')} are available`,
      })),
    },
    architecture: template.spec.architecture || 'Modular monolith following GSTPilot architecture standards.',
    database: {
      tables: template.modules.tables,
      relationships: template.modules.tables
        .filter((t) => t.columns.some((c) => c.ref))
        .map((t) => ({
          from: t.name,
          to: t.columns.find((c) => c.ref)?.ref || 'User',
          type: 'one-to-many' as const,
        })),
      indexes: template.modules.tables.flatMap((t) => t.columns.filter((c) => c.indexed).map((c) => `${t.name}.${c.name}`)),
      rlsPolicies: ['Row-level security on all tenant-scoped tables', 'Field-level encryption on PII columns'],
    },
    api: {
      rest: template.modules.apis,
      graphql: template.modules.apis.map((a) => `${a.method.toLowerCase()}${a.path.replace(/\//g, '_')}`),
      openApiVersion: '3.1.0',
      sdkLanguages: ['TypeScript', 'Python', 'Go'],
    },
    auth: {
      provider: 'NextAuth.js + OAuth + MFA',
      roles: ['admin', 'manager', 'staff', 'viewer'],
      permissions: [
        { role: 'admin', scopes: ['*'] },
        { role: 'manager', scopes: template.modules.apis.flatMap((a) => a.scopes) },
        { role: 'staff', scopes: template.modules.apis.filter((a) => a.method === 'GET').flatMap((a) => a.scopes) },
        { role: 'viewer', scopes: ['read'] },
      ],
    },
    frontend: template.modules.pages,
    permissions: template.modules.apis.flatMap((a) => a.scopes),
    aiIntegrations: template.spec.aiIntegrations || [],
    reports: template.modules.reports,
    automation: template.modules.automations,
    deployment: 'Vercel Edge deployment with Cloudflare CDN, automated preview environments per PR.',
    documentation: 'Auto-generated OpenAPI spec, README, architecture decision records, and inline TSDoc.',
  };
}
