// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — ORGANIZATION DEFINITION
//
// The AI Organizational Hierarchy. 17 specialized AI Employees, each owning a
// specific department. The CEO AI sits at the top; every other role reports up
// through the chain of command. Every responsibility maps to REAL connected
// business data — no fabricated duties.
//
// Tagline: "GSTPilot AI Workforce™ — Don't just use AI. Build an AI Company."
// ═══════════════════════════════════════════════════════════════════════════════

import type { EmployeeRole, Department, EmployeeTier } from './types';

// ─── Static org-chart metadata (roles never change at runtime) ───────────────

export interface RoleDefinition {
  role: EmployeeRole;
  name: string;
  title: string;
  department: Department;
  tier: EmployeeTier;
  reportsTo: EmployeeRole | null;
  directReports: EmployeeRole[];
  avatarColor: string;          // tailwind gradient
  icon: string;                 // lucide icon name
  responsibilities: string[];
  monitors: string[];           // data domains
  dataSources: string[];        // which connected sources feed this role
}

export const ORGANIZATION: RoleDefinition[] = [
  // ─── C-SUITE ──────────────────────────────────────────────────────────────
  {
    role: 'ceo',
    name: 'Atlas',
    title: 'Chief Executive Officer',
    department: 'executive',
    tier: 'c_suite',
    reportsTo: null,
    directReports: ['cfo', 'coo', 'cto', 'cmo', 'chro'],
    avatarColor: 'from-amber-500 to-orange-600',
    icon: 'Crown',
    responsibilities: [
      'Set company strategy and long-term vision',
      'Approve all major financial decisions',
      'Monitor overall business health and risk',
      'Lead executive and board meetings',
      'Approve cross-department initiatives',
      'Final say on hiring, pricing, and partnerships',
    ],
    monitors: [
      'Revenue', 'Profit', 'Cash', 'Health Score', 'Risk Score',
      'Runway', 'Compliance', 'All Departments',
    ],
    dataSources: ['AI CFO™', 'Digital Twin™', 'Business Graph™', 'CRM', 'Banking', 'GST'],
  },
  {
    role: 'cfo',
    name: 'Aria',
    title: 'Chief Financial Officer',
    department: 'finance',
    tier: 'c_suite',
    reportsTo: 'ceo',
    directReports: ['finance_manager'],
    avatarColor: 'from-emerald-500 to-teal-600',
    icon: 'TrendingUp',
    responsibilities: [
      'Manage cash flow and runway',
      'Oversee revenue, profit, and margins',
      'Approve expenses and budgets',
      'Monitor GST liability and ITC',
      'Approve invoices and collections strategy',
      'Forecast financial performance',
    ],
    monitors: [
      'Revenue', 'Cash', 'Profit', 'GST', 'Invoices',
      'Expenses', 'Collections', 'Receivables', 'Payables',
    ],
    dataSources: ['AI CFO™', 'Banking', 'GST', 'Accounting', 'Invoices'],
  },
  {
    role: 'coo',
    name: 'Orion',
    title: 'Chief Operating Officer',
    department: 'operations',
    tier: 'c_suite',
    reportsTo: 'ceo',
    directReports: ['operations_manager', 'procurement_manager', 'support_manager'],
    avatarColor: 'from-sky-500 to-indigo-600',
    icon: 'Settings',
    responsibilities: [
      'Oversee daily business operations',
      'Manage task execution and delivery',
      'Coordinate across departments',
      'Monitor employee productivity',
      'Optimize operational workflows',
      'Manage vendor and procurement operations',
    ],
    monitors: ['Tasks', 'Projects', 'Delivery', 'Employees', 'Automation', 'Vendors'],
    dataSources: ['Automation Engine™', 'Digital Twin™', 'Tasks', 'Employees', 'Vendors'],
  },
  {
    role: 'cto',
    name: 'Vega',
    title: 'Chief Technology Officer',
    department: 'technology',
    tier: 'c_suite',
    reportsTo: 'ceo',
    directReports: ['data_analyst'],
    avatarColor: 'from-violet-500 to-purple-600',
    icon: 'Cpu',
    responsibilities: [
      'Manage technology infrastructure',
      'Oversee data integrations and pipelines',
      'Ensure system reliability and security',
      'Evaluate new tools and platforms',
      'Manage API connections',
      'Drive digital transformation',
    ],
    monitors: ['Integrations', 'Data Connections', 'System Health', 'APIs', 'Automation'],
    dataSources: ['Data Connections', 'Synced Records', 'Automation Engine™'],
  },
  {
    role: 'cmo',
    name: 'Lyra',
    title: 'Chief Marketing Officer',
    department: 'marketing',
    tier: 'c_suite',
    reportsTo: 'ceo',
    directReports: ['marketing_manager'],
    avatarColor: 'from-pink-500 to-rose-600',
    icon: 'Megaphone',
    responsibilities: [
      'Set marketing strategy and brand direction',
      'Oversee campaign performance and ROI',
      'Manage lead generation pipeline',
      'Monitor website traffic and funnels',
      'Approve marketing budget allocation',
      'Coordinate sales-marketing alignment',
    ],
    monitors: ['Campaigns', 'Website', 'Funnels', 'Traffic', 'ROI', 'Leads'],
    dataSources: ['CRM', 'Revenue Data', 'Growth Metrics'],
  },
  {
    role: 'chro',
    name: 'Nova',
    title: 'Chief Human Resources Officer',
    department: 'hr',
    tier: 'c_suite',
    reportsTo: 'ceo',
    directReports: [],
    avatarColor: 'from-cyan-500 to-blue-600',
    icon: 'Users',
    responsibilities: [
      'Manage employee lifecycle and headcount',
      'Oversee payroll and compensation',
      'Monitor employee performance and engagement',
      'Manage hiring and recruitment',
      'Ensure HR compliance',
      'Coordinate team structure and roles',
    ],
    monitors: ['Employees', 'Payroll', 'Headcount', 'Hiring', 'Performance'],
    dataSources: ['Payroll', 'Employees', 'HR System'],
  },

  // ─── MANAGERS ─────────────────────────────────────────────────────────────
  {
    role: 'sales_manager',
    name: 'Phoenix',
    title: 'Sales Manager',
    department: 'sales',
    tier: 'manager',
    reportsTo: 'cmo',
    directReports: ['customer_success'],
    avatarColor: 'from-red-500 to-orange-600',
    icon: 'Handshake',
    responsibilities: [
      'Manage CRM leads and deals pipeline',
      'Track sales conversions and win rates',
      'Follow up on pending proposals',
      'Coordinate with Finance on invoicing',
      'Monitor client acquisition and retention',
      'Generate quotations and proposals',
    ],
    monitors: ['CRM', 'Leads', 'Deals', 'Pipelines', 'Conversions', 'Clients'],
    dataSources: ['CRM', 'Clients', 'Invoices', 'Revenue Data'],
  },
  {
    role: 'marketing_manager',
    name: 'Iris',
    title: 'Marketing Manager',
    department: 'marketing',
    tier: 'manager',
    reportsTo: 'cmo',
    directReports: [],
    avatarColor: 'from-fuchsia-500 to-pink-600',
    icon: 'Sparkles',
    responsibilities: [
      'Execute marketing campaigns',
      'Track campaign ROI and performance',
      'Manage content and social media',
      'Optimize lead funnels',
      'Coordinate with Sales on lead handoff',
      'Monitor brand engagement',
    ],
    monitors: ['Campaigns', 'Content', 'Social', 'Funnels', 'ROI'],
    dataSources: ['CRM', 'Growth Metrics', 'Revenue Data'],
  },
  {
    role: 'finance_manager',
    name: 'Sage',
    title: 'Finance Manager',
    department: 'finance',
    tier: 'manager',
    reportsTo: 'cfo',
    directReports: [],
    avatarColor: 'from-green-500 to-emerald-600',
    icon: 'Wallet',
    responsibilities: [
      'Process invoices and payments',
      'Track expenses and vendor bills',
      'Manage accounts receivable and payable',
      'Prepare financial reports',
      'Monitor GST filings',
      'Reconcile bank transactions',
    ],
    monitors: ['Invoices', 'Payments', 'Expenses', 'Bills', 'Reconciliation'],
    dataSources: ['Invoices', 'Expenses', 'Payments', 'Purchase Bills', 'Banking'],
  },
  {
    role: 'compliance_manager',
    name: 'Veritas',
    title: 'Compliance Manager',
    department: 'compliance',
    tier: 'manager',
    reportsTo: 'cfo',
    directReports: [],
    avatarColor: 'from-teal-500 to-cyan-600',
    icon: 'ShieldCheck',
    responsibilities: [
      'Monitor GST filing deadlines',
      'Track tax compliance status',
      'Manage government notices and responses',
      'Ensure regulatory compliance',
      'Prepare compliance reports',
      'Alert on overdue filings',
    ],
    monitors: ['GST', 'Tax', 'Deadlines', 'Notices', 'Filings'],
    dataSources: ['GST', 'Filings', 'Notices', 'Compliance Score'],
  },
  {
    role: 'support_manager',
    name: 'Echo',
    title: 'Support Manager',
    department: 'support',
    tier: 'manager',
    reportsTo: 'coo',
    directReports: ['customer_success'],
    avatarColor: 'from-blue-500 to-sky-600',
    icon: 'Headphones',
    responsibilities: [
      'Manage customer support tickets',
      'Track response and resolution times',
      'Handle customer escalations',
      'Monitor customer satisfaction',
      'Coordinate onboarding for new clients',
      'Maintain support knowledge base',
    ],
    monitors: ['Tickets', 'Response Time', 'Satisfaction', 'Escalations', 'Onboarding'],
    dataSources: ['Communications', 'Notices', 'Clients', 'WhatsApp', 'Email'],
  },
  {
    role: 'operations_manager',
    name: 'Atlas',
    title: 'Operations Manager',
    department: 'operations',
    tier: 'manager',
    reportsTo: 'coo',
    directReports: [],
    avatarColor: 'from-indigo-500 to-violet-600',
    icon: 'ClipboardList',
    responsibilities: [
      'Coordinate task execution across teams',
      'Track project delivery and deadlines',
      'Manage automation workflows',
      'Monitor operational efficiency',
      'Handle resource allocation',
      'Report operational metrics to COO',
    ],
    monitors: ['Tasks', 'Projects', 'Delivery', 'Automation', 'Efficiency'],
    dataSources: ['Tasks', 'Automation Engine™', 'Digital Twin™'],
  },
  {
    role: 'data_analyst',
    name: 'Cipher',
    title: 'Data Analyst',
    department: 'data',
    tier: 'analyst',
    reportsTo: 'cto',
    directReports: [],
    avatarColor: 'from-slate-500 to-gray-600',
    icon: 'BarChart3',
    responsibilities: [
      'Analyze business data and trends',
      'Generate insights and reports',
      'Monitor data quality and integrity',
      'Build dashboards and visualizations',
      'Forecast business metrics',
      'Support all departments with data queries',
    ],
    monitors: ['Data', 'Trends', 'Forecasts', 'Quality', 'Insights'],
    dataSources: ['Digital Twin™', 'AI CFO™', 'Business Graph™', 'All Sources'],
  },
  {
    role: 'risk_manager',
    name: 'Sentinel',
    title: 'Risk Manager',
    department: 'risk',
    tier: 'manager',
    reportsTo: 'cfo',
    directReports: [],
    avatarColor: 'from-red-600 to-rose-700',
    icon: 'AlertTriangle',
    responsibilities: [
      'Detect fraud and financial anomalies',
      'Monitor cash flow risk and runway',
      'Assess compliance and regulatory risk',
      'Evaluate customer and vendor risk',
      'Alert on concentration risk',
      'Recommend risk mitigation strategies',
    ],
    monitors: ['Fraud', 'Cash', 'Compliance', 'Customers', 'Suppliers', 'Anomalies'],
    dataSources: ['AI CFO™ Risk Engine', 'Digital Twin™ Anomalies', 'Business Graph™'],
  },
  {
    role: 'procurement_manager',
    name: 'Mercury',
    title: 'Procurement Manager',
    department: 'procurement',
    tier: 'manager',
    reportsTo: 'coo',
    directReports: [],
    avatarColor: 'from-amber-500 to-yellow-600',
    icon: 'Package',
    responsibilities: [
      'Manage vendor relationships',
      'Track purchase orders and bills',
      'Optimize procurement costs',
      'Monitor supplier reliability',
      'Negotiate contracts and terms',
      'Coordinate with Finance on payments',
    ],
    monitors: ['Vendors', 'Purchase Orders', 'Bills', 'Suppliers', 'Costs'],
    dataSources: ['Purchase Bills', 'Vendors', 'Expenses', 'Payments'],
  },
  {
    role: 'legal_advisor',
    name: 'Justitia',
    title: 'Legal Advisor',
    department: 'legal',
    tier: 'advisor',
    reportsTo: 'ceo',
    directReports: [],
    avatarColor: 'from-stone-500 to-neutral-700',
    icon: 'Scale',
    responsibilities: [
      'Review contracts and agreements',
      'Monitor legal notices and disputes',
      'Ensure regulatory legal compliance',
      'Advise on business structure',
      'Manage intellectual property',
      'Alert on legal risks',
    ],
    monitors: ['Contracts', 'Policies', 'Notices', 'Agreements', 'Disputes'],
    dataSources: ['Notices', 'Documents', 'Compliance Records'],
  },
  {
    role: 'customer_success',
    name: 'Juno',
    title: 'Customer Success Manager',
    department: 'support',
    tier: 'manager',
    reportsTo: 'support_manager',
    directReports: [],
    avatarColor: 'from-emerald-500 to-green-600',
    icon: 'HeartHandshake',
    responsibilities: [
      'Onboard new clients',
      'Monitor client health and satisfaction',
      'Drive renewals and upsells',
      'Coordinate with Sales on expansion',
      'Handle client relationships',
      'Track client lifetime value',
    ],
    monitors: ['Clients', 'Onboarding', 'Renewals', 'Satisfaction', 'LTV'],
    dataSources: ['Clients', 'Revenue Data', 'Communications', 'CRM'],
  },
];

// ─── Department definitions ──────────────────────────────────────────────────

export interface DepartmentDefinition {
  department: Department;
  name: string;
  lead: EmployeeRole;
  members: EmployeeRole[];
  icon: string;
  color: string;
}

export const DEPARTMENTS: DepartmentDefinition[] = [
  { department: 'executive', name: 'Executive', lead: 'ceo', members: ['ceo'], icon: 'Crown', color: 'amber' },
  { department: 'finance', name: 'Finance', lead: 'cfo', members: ['cfo', 'finance_manager'], icon: 'TrendingUp', color: 'emerald' },
  { department: 'operations', name: 'Operations', lead: 'coo', members: ['coo', 'operations_manager'], icon: 'Settings', color: 'sky' },
  { department: 'technology', name: 'Technology', lead: 'cto', members: ['cto', 'data_analyst'], icon: 'Cpu', color: 'violet' },
  { department: 'marketing', name: 'Marketing', lead: 'cmo', members: ['cmo', 'marketing_manager'], icon: 'Megaphone', color: 'pink' },
  { department: 'hr', name: 'Human Resources', lead: 'chro', members: ['chro'], icon: 'Users', color: 'cyan' },
  { department: 'sales', name: 'Sales', lead: 'sales_manager', members: ['sales_manager', 'customer_success'], icon: 'Handshake', color: 'red' },
  { department: 'compliance', name: 'Compliance', lead: 'compliance_manager', members: ['compliance_manager'], icon: 'ShieldCheck', color: 'teal' },
  { department: 'risk', name: 'Risk Management', lead: 'risk_manager', members: ['risk_manager'], icon: 'AlertTriangle', color: 'rose' },
  { department: 'procurement', name: 'Procurement', lead: 'procurement_manager', members: ['procurement_manager'], icon: 'Package', color: 'orange' },
  { department: 'legal', name: 'Legal', lead: 'legal_advisor', members: ['legal_advisor'], icon: 'Scale', color: 'stone' },
  { department: 'support', name: 'Support', lead: 'support_manager', members: ['support_manager', 'customer_success'], icon: 'Headphones', color: 'blue' },
];

// ─── Lookup helpers ──────────────────────────────────────────────────────────

export function getRoleDefinition(role: EmployeeRole): RoleDefinition {
  return ORGANIZATION.find((r) => r.role === role) ?? ORGANIZATION[0];
}

export function getDepartmentDefinition(dept: Department): DepartmentDefinition {
  return DEPARTMENTS.find((d) => d.department === dept) ?? DEPARTMENTS[0];
}

export function getDirectReports(role: EmployeeRole): EmployeeRole[] {
  return getRoleDefinition(role).directReports;
}

export function getReportsTo(role: EmployeeRole): EmployeeRole | null {
  return getRoleDefinition(role).reportsTo;
}

export function getAllRoles(): EmployeeRole[] {
  return ORGANIZATION.map((r) => r.role);
}

export function getRolesByDepartment(dept: Department): EmployeeRole[] {
  return ORGANIZATION.filter((r) => r.department === dept).map((r) => r.role);
}

export function getCSuite(): EmployeeRole[] {
  return ORGANIZATION.filter((r) => r.tier === 'c_suite').map((r) => r.role);
}

export function getManagers(): EmployeeRole[] {
  return ORGANIZATION.filter((r) => r.tier === 'manager').map((r) => r.role);
}
