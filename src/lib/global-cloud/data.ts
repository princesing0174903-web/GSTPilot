// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16: GLOBAL FINANCIAL CLOUD™ DATA LAYER
//
// Comprehensive, deterministic, STATIC dataset for all 15 sub-modules of
// Phase 16 — Global Financial Cloud™, Open Platform & Developer Ecosystem™.
//
//   • NO API calls  • NO Math.random  • NO fetch  • NO Date.now side-effects
//
// All numbers are curated to look like a real billion-dollar SaaS platform
// (GSTPilot scale: ~2.4M developers, ~180K enterprises, ~$4.8Bn API revenue).
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Phase 16 Accent Color Tokens ─────────────────────────────────────────────
// NEVER indigo/blue. Emerald / teal / cyan / violet / amber / rose only.
export type Accent = 'emerald' | 'teal' | 'cyan' | 'violet' | 'amber' | 'rose';

export const ACCENT_HEX: Record<Accent, string> = {
  emerald: '#10b981',
  teal:    '#14b8a6',
  cyan:    '#06b6d4',
  violet:  '#8b5cf6',
  amber:   '#f59e0b',
  rose:    '#f43f5e',
};

export const ACCENT_CLASSES: Record<Accent, {
  text: string; bg: string; border: string; ring: string; bar: string; glow: string;
}> = {
  emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', ring: 'ring-emerald-500/30', bar: 'bg-emerald-500', glow: 'shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)]' },
  teal:    { text: 'text-teal-300',    bg: 'bg-teal-500/10',    border: 'border-teal-500/30',    ring: 'ring-teal-500/30',    bar: 'bg-teal-500',    glow: 'shadow-[0_0_30px_-5px_rgba(20,184,166,0.4)]' },
  cyan:    { text: 'text-cyan-300',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    ring: 'ring-cyan-500/30',    bar: 'bg-cyan-500',    glow: 'shadow-[0_0_30px_-5px_rgba(6,182,212,0.4)]' },
  violet:  { text: 'text-violet-300',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  ring: 'ring-violet-500/30',  bar: 'bg-violet-500',  glow: 'shadow-[0_0_30px_-5px_rgba(139,92,246,0.4)]' },
  amber:   { text: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   ring: 'ring-amber-500/30',   bar: 'bg-amber-500',   glow: 'shadow-[0_0_30px_-5px_rgba(245,158,11,0.4)]' },
  rose:    { text: 'text-rose-300',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    ring: 'ring-rose-500/30',    bar: 'bg-rose-500',    glow: 'shadow-[0_0_30px_-5px_rgba(244,63,94,0.4)]' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
export const fmt = (n: number): string => {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};
export const fmtN = (n: number): string => {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
  return `${n.toFixed(0)}`;
};
export const fmtPct = (n: number): string => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DEVELOPER PLATFORM — APIs, SDKs, CLI, OAuth, API keys, Playground, Sandbox
// ═══════════════════════════════════════════════════════════════════════════════

export interface RestEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  desc: string;
  ratePerMin: number;
}

export const REST_ENDPOINTS: RestEndpoint[] = [
  { method: 'GET',    path: '/v1/invoices',                desc: 'List invoices with pagination & filters',       ratePerMin: 600 },
  { method: 'POST',   path: '/v1/invoices',                desc: 'Create a new GST-compliant invoice',            ratePerMin: 300 },
  { method: 'GET',    path: '/v1/invoices/:id',            desc: 'Retrieve a single invoice by ID',               ratePerMin: 1200 },
  { method: 'PUT',    path: '/v1/invoices/:id',            desc: 'Update an existing draft invoice',              ratePerMin: 300 },
  { method: 'DELETE', path: '/v1/invoices/:id',            desc: 'Cancel an invoice (cannot delete)',             ratePerMin: 120 },
  { method: 'POST',   path: '/v1/gst/returns/gstr1',       desc: 'File GSTR-1 return with auto-reconciliation',   ratePerMin: 60 },
  { method: 'GET',    path: '/v1/gst/returns/:id',         desc: 'Get filed return status & acknowledgement',     ratePerMin: 600 },
  { method: 'POST',   path: '/v1/payments',                desc: 'Initiate a UPI/NEFT/RTGS payment',              ratePerMin: 240 },
  { method: 'GET',    path: '/v1/ledger/accounts',         desc: 'List chart of accounts',                        ratePerMin: 600 },
  { method: 'POST',   path: '/v1/ledger/journal-entries',  desc: 'Post a double-entry journal voucher',           ratePerMin: 300 },
  { method: 'GET',    path: '/v1/customers',               desc: 'List customers with balances & aging',          ratePerMin: 600 },
  { method: 'POST',   path: '/v1/vendors',                 desc: 'Create vendor master record',                   ratePerMin: 300 },
  { method: 'GET',    path: '/v1/bank/accounts',           desc: 'List connected bank accounts & live balances',  ratePerMin: 240 },
  { method: 'POST',   path: '/v1/bank/reconcile',          desc: 'Auto-reconcile bank statement vs ledger',       ratePerMin: 60 },
  { method: 'POST',   path: '/v1/ai/oracle',               desc: 'Invoke Oracle™ AI for natural-language query',  ratePerMin: 120 },
  { method: 'GET',    path: '/v1/compliance/calendar',     desc: 'Upcoming filing deadlines by jurisdiction',     ratePerMin: 600 },
  { method: 'POST',   path: '/v1/documents/upload',        desc: 'Upload document for OCR & AI extraction',       ratePerMin: 120 },
  { method: 'GET',    path: '/v1/analytics/kpis',          desc: 'Realtime KPI snapshot (revenue, burn, runway)', ratePerMin: 600 },
  { method: 'POST',   path: '/v1/webhooks/subscribe',      desc: 'Subscribe to realtime event stream',            ratePerMin: 60 },
  { method: 'GET',    path: '/v1/payroll/runs',            desc: 'List payroll runs with net pay & taxes',        ratePerMin: 240 },
];

export interface GraphQLOperation {
  name: string;
  type: 'Query' | 'Mutation' | 'Subscription';
  desc: string;
  returns: string;
}

export const GRAPHQL_OPS: GraphQLOperation[] = [
  { name: 'invoice',           type: 'Query',        desc: 'Fetch a single invoice with line items & tax breakdown',    returns: 'Invoice!' },
  { name: 'invoices',          type: 'Query',        desc: 'Paginated invoice list with multi-filter',                  returns: 'InvoiceConnection!' },
  { name: 'gstReturn',         type: 'Query',        desc: 'Filed return with reconciliation summary',                  returns: 'GstReturn!' },
  { name: 'customer',          type: 'Query',        desc: 'Customer with ledger, balances, recent transactions',       returns: 'Customer!' },
  { name: 'bankAccount',       type: 'Query',        desc: 'Live bank balance + last 30 days transactions',             returns: 'BankAccount!' },
  { name: 'createInvoice',     type: 'Mutation',     desc: 'Create invoice with auto-numbering & GST rules',            returns: 'Invoice!' },
  { name: 'fileGstr1',         type: 'Mutation',     desc: 'File GSTR-1 with OTP-less e-filing',                        returns: 'FilingResult!' },
  { name: 'initiatePayment',   type: 'Mutation',     desc: 'Initiate payment & return tracking handle',                 returns: 'Payment!' },
  { name: 'oracleAsk',         type: 'Mutation',     desc: 'Ask Oracle™ a strategic question, return streamed answer',  returns: 'OracleResponse!' },
  { name: 'invoiceCreated',    type: 'Subscription', desc: 'Realtime stream of new invoice events',                     returns: 'InvoiceEvent!' },
  { name: 'paymentReceived',   type: 'Subscription', desc: 'Realtime stream of inbound payments',                       returns: 'PaymentEvent!' },
  { name: 'gstFiled',          type: 'Subscription', desc: 'Realtime stream of GST filing acknowledgements',            returns: 'FilingEvent!' },
  { name: 'bankSynced',        type: 'Subscription', desc: 'Realtime stream of bank reconciliation results',            returns: 'BankSyncEvent!' },
];

export interface SdkLibrary {
  language: string;
  package: string;
  version: string;
  weeklyDownloads: number;
  install: string;
  accent: Accent;
}

export const SDKS: SdkLibrary[] = [
  { language: 'TypeScript', package: '@gstpilot/sdk-node',   version: '4.12.0', weeklyDownloads: 842_000, install: 'npm i @gstpilot/sdk-node',   accent: 'emerald' },
  { language: 'Python',     package: 'gstpilot',             version: '4.12.0', weeklyDownloads: 612_000, install: 'pip install gstpilot',        accent: 'amber'   },
  { language: 'Go',         package: 'github.com/gstpilot/go-sdk', version: '4.11.2', weeklyDownloads: 184_000, install: 'go get github.com/gstpilot/go-sdk', accent: 'cyan'    },
  { language: 'Java',       package: 'io.gstpilot:sdk-java', version: '4.12.0', weeklyDownloads: 268_000, install: 'implementation \'io.gstpilot:sdk-java:4.12.0\'' , accent: 'rose'    },
  { language: 'Ruby',       package: 'gstpilot',             version: '4.10.1', weeklyDownloads:  74_000, install: 'gem install gstpilot',        accent: 'rose'    },
  { language: 'PHP',        package: 'gstpilot/php-sdk',     version: '4.11.0', weeklyDownloads: 142_000, install: 'composer require gstpilot/php-sdk', accent: 'violet' },
  { language: '.NET',       package: 'GSTPilot.SDK',         version: '4.12.0', weeklyDownloads: 198_000, install: 'dotnet add package GSTPilot.SDK', accent: 'teal'   },
  { language: 'Rust',       package: 'gstpilot-rs',          version: '4.9.0',  weeklyDownloads:  46_000, install: 'cargo add gstpilot',          accent: 'amber'   },
];

export interface CliCommand {
  command: string;
  desc: string;
  example: string;
}

export const CLI_COMMANDS: CliCommand[] = [
  { command: 'gstpilot auth login',           desc: 'Authenticate CLI with API key or browser OAuth',     example: 'gstpilot auth login --api-key sk_live_...' },
  { command: 'gstpilot invoices create',      desc: 'Create invoice from JSON or interactive prompt',     example: 'gstpilot invoices create --file inv.json' },
  { command: 'gstpilot gst file gstr1',       desc: 'File GSTR-1 for current period',                    example: 'gstpilot gst file gstr1 --period 2025-10' },
  { command: 'gstpilot bank reconcile',       desc: 'Run auto-reconciliation across connected banks',     example: 'gstpilot bank reconcile --since 7d' },
  { command: 'gstpilot oracle ask',           desc: 'Ask Oracle™ a question from terminal',              example: 'gstpilot oracle ask "Cash runway?"' },
  { command: 'gstpilot apps publish',         desc: 'Publish your app to GSTPilot Marketplace',           example: 'gstpilot apps publish --version 1.0.0' },
  { command: 'gstpilot webhooks listen',      desc: 'Tunnel live webhook events to localhost',           example: 'gstpilot webhooks listen --port 8080' },
  { command: 'gstpilot sandbox reset',        desc: 'Reset sandbox environment to clean state',          example: 'gstpilot sandbox reset --confirm' },
  { command: 'gstpilot migrations run',       desc: 'Run schema migrations for your app database',       example: 'gstpilot migrations run --up' },
  { command: 'gstpilot logs tail',            desc: 'Tail platform logs for your organization',          example: 'gstpilot logs tail --filter error' },
];

export interface OAuthProvider {
  name: string;
  type: string;
  scopes: number;
  flow: string;
  status: 'live' | 'beta';
}

export const OAUTH_PROVIDERS: OAuthProvider[] = [
  { name: 'Google Workspace',   type: 'OAuth 2.0',   scopes: 8,  flow: 'Authorization Code + PKCE', status: 'live' },
  { name: 'Microsoft 365',      type: 'OAuth 2.0',   scopes: 11, flow: 'Authorization Code + PKCE', status: 'live' },
  { name: 'GitHub',             type: 'OAuth 2.0',   scopes: 5,  flow: 'Authorization Code',         status: 'live' },
  { name: 'Azure AD',           type: 'OIDC + SAML', scopes: 14, flow: 'Authorization Code + PKCE', status: 'live' },
  { name: 'Okta',               type: 'OIDC',        scopes: 9,  flow: 'Authorization Code + PKCE', status: 'live' },
  { name: 'Apple Sign-In',      type: 'OAuth 2.0',   scopes: 3,  flow: 'Authorization Code',         status: 'live' },
  { name: 'Slack',              type: 'OAuth 2.0',   scopes: 6,  flow: 'Authorization Code',         status: 'live' },
  { name: 'Salesforce',         type: 'OAuth 2.0',   scopes: 12, flow: 'Authorization Code + PKCE', status: 'beta' },
];

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  env: 'live' | 'sandbox';
  created: string;
  lastUsed: string;
  scopes: string[];
  status: 'active' | 'revoked';
}

export const API_KEYS: ApiKey[] = [
  { id: 'key_001', name: 'Production — Web App',     prefix: 'sk_live_8f2a', env: 'live',    created: '2024-03-14', lastUsed: '2 min ago',  scopes: ['invoices:rw', 'gst:rw', 'payments:rw'], status: 'active'  },
  { id: 'key_002', name: 'Production — Mobile iOS',  prefix: 'sk_live_3c91', env: 'live',    created: '2024-06-22', lastUsed: '12 min ago', scopes: ['invoices:r', 'payments:rw'],            status: 'active'  },
  { id: 'key_003', name: 'Sandbox — Staging',        prefix: 'sk_test_7e44', env: 'sandbox', created: '2024-09-01', lastUsed: '1 hr ago',   scopes: ['invoices:rw', 'gst:rw'],                status: 'active'  },
  { id: 'key_004', name: 'Sandbox — CI Pipeline',    prefix: 'sk_test_1b08', env: 'sandbox', created: '2024-11-18', lastUsed: '4 hr ago',   scopes: ['invoices:rw'],                          status: 'active'  },
  { id: 'key_005', name: 'Legacy — Webhook v1',      prefix: 'sk_live_9d77', env: 'live',    created: '2023-05-10', lastUsed: '14 days ago',scopes: ['webhooks:rw'],                          status: 'revoked' },
];

export interface PlaygroundSample {
  title: string;
  language: 'curl' | 'node' | 'python' | 'graphql';
  code: string;
  desc: string;
}

export const PLAYGROUND_SAMPLES: PlaygroundSample[] = [
  { title: 'Create Invoice', language: 'node', desc: 'Create a GST-compliant invoice with line items',
    code: `import { GSTPilot } from '@gstpilot/sdk-node';
const gp = new GSTPilot({ apiKey: process.env.GSTPILOT_KEY });

const invoice = await gp.invoices.create({
  customer: 'cust_8a1f',
  number: 'INV-2025-1042',
  date: '2025-11-08',
  lineItems: [
    { description: 'Consulting — Q4 retainer', qty: 1, rate: 450000, taxRate: 18 },
  ],
  gstin: '29ABCDE1234F1Z5',
});
console.log(invoice.id, invoice.total);` },
  { title: 'File GSTR-1', language: 'python', desc: 'File GSTR-1 with auto-reconciliation',
    code: `import gstpilot
gp = gstpilot.Client(api_key=os.environ['GSTPILOT_KEY'])

result = gp.gst.file_gstr1(
    gstin='29ABCDE1234F1Z5',
    period='2025-10',
    auto_reconcile=True,
)
print(result.arn, result.status)` },
  { title: 'Subscribe to Events', language: 'graphql', desc: 'Realtime stream of new invoices',
    code: `subscription OnInvoiceCreated {
  invoiceCreated {
    id
    number
    customer { name }
    total
    createdAt
  }
}` },
  { title: 'Quick cURL Test', language: 'curl', desc: 'Test the API from terminal',
    code: `curl https://api.gstpilot.com/v1/invoices \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"customer":"cust_8a1f","amount":531000}'` },
];

export interface SandboxEnv {
  id: string;
  name: string;
  region: string;
  records: number;
  resetSchedule: string;
  status: 'healthy' | 'resetting';
}

export const SANDBOX_ENVS: SandboxEnv[] = [
  { id: 'sb_in_1', name: 'India Sandbox',     region: 'ap-south-1',     records: 12_400, resetSchedule: 'Daily 02:00 IST', status: 'healthy'   },
  { id: 'sb_us_1', name: 'US Sandbox',        region: 'us-east-1',      records:  9_800, resetSchedule: 'Daily 02:00 EST', status: 'healthy'   },
  { id: 'sb_eu_1', name: 'EU Sandbox',        region: 'eu-central-1',   records:  7_200, resetSchedule: 'Weekly Sun 02:00',status: 'healthy'   },
  { id: 'sb_ae_1', name: 'UAE Sandbox',       region: 'me-central-1',   records:  3_100, resetSchedule: 'On-demand',       status: 'resetting' },
];

export interface DocSection {
  category: string;
  articles: number;
  views: number;
  helpfulness: number;
  accent: Accent;
}

export const DOC_SECTIONS: DocSection[] = [
  { category: 'Quickstart',           articles: 12, views: 1_840_000, helpfulness: 97, accent: 'emerald' },
  { category: 'Authentication',       articles: 18, views: 1_220_000, helpfulness: 95, accent: 'teal'    },
  { category: 'REST API Reference',   articles: 184, views: 3_640_000, helpfulness: 94, accent: 'cyan'    },
  { category: 'GraphQL API',          articles: 76, views:   880_000, helpfulness: 92, accent: 'violet'  },
  { category: 'Webhooks',             articles: 24, views:   420_000, helpfulness: 91, accent: 'amber'   },
  { category: 'SDKs & CLI',           articles: 64, views: 1_080_000, helpfulness: 96, accent: 'rose'    },
  { category: 'App Marketplace',      articles: 38, views:   360_000, helpfulness: 89, accent: 'emerald' },
  { category: 'Compliance & Tax',     articles: 142, views: 1_540_000, helpfulness: 93, accent: 'teal'    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ENTERPRISE API GATEWAY — 13 service domains with endpoints
// ═══════════════════════════════════════════════════════════════════════════════

export interface ServiceApi {
  domain: string;
  icon: string;
  endpoints: number;
  calls24h: number;
  p95Ms: number;
  errorRate: number;
  uptime: number;
  auth: string;
  accent: Accent;
  status: 'operational' | 'degraded' | 'maintenance';
  topEndpoints: string[];
}

export const SERVICE_APIS: ServiceApi[] = [
  { domain: 'GST',           icon: 'receipt',          endpoints: 48,  calls24h: 8_420_000, p95Ms: 142, errorRate: 0.04, uptime: 99.99, auth: 'OAuth 2.0',  accent: 'emerald', status: 'operational', topEndpoints: ['/v1/gst/returns/gstr1', '/v1/gst/returns/gstr3b', '/v1/gst/reconcile'] },
  { domain: 'Invoices',      icon: 'file-text',        endpoints: 32,  calls24h: 12_800_000, p95Ms: 88, errorRate: 0.02, uptime: 99.99, auth: 'API Key',    accent: 'teal',    status: 'operational', topEndpoints: ['/v1/invoices', '/v1/invoices/:id', '/v1/invoices/send'] },
  { domain: 'Accounting',    icon: 'book-open',        endpoints: 64,  calls24h: 4_620_000, p95Ms: 110, errorRate: 0.03, uptime: 99.98, auth: 'OAuth 2.0',  accent: 'cyan',    status: 'operational', topEndpoints: ['/v1/ledger/accounts', '/v1/ledger/journal-entries', '/v1/ledger/trial-balance'] },
  { domain: 'ERP',           icon: 'boxes',            endpoints: 88,  calls24h: 3_140_000, p95Ms: 168, errorRate: 0.06, uptime: 99.97, auth: 'OAuth 2.0',  accent: 'violet',  status: 'operational', topEndpoints: ['/v1/erp/items', '/v1/erp/warehouses', '/v1/erp/purchase-orders'] },
  { domain: 'CRM',           icon: 'users',            endpoints: 42,  calls24h: 5_980_000, p95Ms: 76, errorRate: 0.01, uptime: 99.99, auth: 'API Key',    accent: 'amber',   status: 'operational', topEndpoints: ['/v1/crm/leads', '/v1/crm/customers', '/v1/crm/opportunities'] },
  { domain: 'HR',            icon: 'user-cog',         endpoints: 38,  calls24h: 1_240_000, p95Ms: 124, errorRate: 0.05, uptime: 99.96, auth: 'OAuth 2.0',  accent: 'rose',    status: 'operational', topEndpoints: ['/v1/hr/employees', '/v1/hr/leave', '/v1/hr/attendance'] },
  { domain: 'Payroll',       icon: 'wallet',           endpoints: 28,  calls24h:   980_000, p95Ms: 198, errorRate: 0.07, uptime: 99.95, auth: 'OAuth 2.0',  accent: 'emerald', status: 'operational', topEndpoints: ['/v1/payroll/runs', '/v1/payroll/payslips', '/v1/payroll/taxes'] },
  { domain: 'Inventory',     icon: 'package',          endpoints: 36,  calls24h: 2_840_000, p95Ms: 92, errorRate: 0.03, uptime: 99.98, auth: 'API Key',    accent: 'teal',    status: 'operational', topEndpoints: ['/v1/inventory/items', '/v1/inventory/stock', '/v1/inventory/transfers'] },
  { domain: 'Analytics',     icon: 'bar-chart-3',      endpoints: 24,  calls24h: 1_680_000, p95Ms: 156, errorRate: 0.04, uptime: 99.97, auth: 'API Key',    accent: 'cyan',    status: 'operational', topEndpoints: ['/v1/analytics/kpis', '/v1/analytics/revenue', '/v1/analytics/cashflow'] },
  { domain: 'Banking',       icon: 'landmark',         endpoints: 32,  calls24h: 2_240_000, p95Ms: 184, errorRate: 0.08, uptime: 99.94, auth: 'OAuth 2.0',  accent: 'violet',  status: 'degraded',  topEndpoints: ['/v1/bank/accounts', '/v1/bank/transactions', '/v1/bank/reconcile'] },
  { domain: 'AI',            icon: 'brain',            endpoints: 18,  calls24h:   640_000, p95Ms: 1240, errorRate: 0.12, uptime: 99.92, auth: 'API Key',   accent: 'amber',   status: 'operational', topEndpoints: ['/v1/ai/oracle', '/v1/ai/extract', '/v1/ai/classify'] },
  { domain: 'Compliance',    icon: 'shield-check',     endpoints: 56,  calls24h: 1_420_000, p95Ms: 132, errorRate: 0.05, uptime: 99.98, auth: 'OAuth 2.0',  accent: 'rose',    status: 'operational', topEndpoints: ['/v1/compliance/calendar', '/v1/compliance/filings', '/v1/compliance/alerts'] },
  { domain: 'Documents',     icon: 'folder-open',      endpoints: 22,  calls24h: 3_980_000, p95Ms: 96, errorRate: 0.02, uptime: 99.99, auth: 'API Key',    accent: 'emerald', status: 'operational', topEndpoints: ['/v1/documents/upload', '/v1/documents/ocr', '/v1/documents/search'] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 3. APP MARKETPLACE — Apps, Extensions, Plugins, AI Skills, Connectors, Templates, Automation Packs
// ═══════════════════════════════════════════════════════════════════════════════

export interface MarketplaceApp {
  id: string;
  name: string;
  publisher: string;
  category: 'App' | 'Extension' | 'Plugin' | 'AI Skill' | 'ERP Connector' | 'Industry Template' | 'Automation Pack';
  installs: number;
  rating: number;
  reviews: number;
  price: string;
  tagline: string;
  accent: Accent;
  featured: boolean;
}

export const MARKETPLACE_APPS: MarketplaceApp[] = [
  { id: 'app_001', name: 'Tally Connector Pro',     publisher: 'GSTPilot Labs',     category: 'ERP Connector',  installs: 184_000, rating: 4.8, reviews: 2_140, price: 'Free',         tagline: 'Two-way sync with Tally Prime — vouchers, masters, GST',          accent: 'emerald', featured: true  },
  { id: 'app_002', name: 'Zoho Books Bridge',       publisher: 'Zoho Corporation',  category: 'ERP Connector',  installs: 142_000, rating: 4.7, reviews: 1_860, price: 'Free',         tagline: 'Realtime sync of invoices, vendors, and chart of accounts',       accent: 'teal',    featured: true  },
  { id: 'app_003', name: 'QuickBooks Sync',         publisher: 'Intuit Inc.',       category: 'ERP Connector',  installs:  98_000, rating: 4.6, reviews: 1_240, price: '$29/mo',       tagline: 'Bi-directional QuickBooks Online sync with multi-currency',       accent: 'cyan',    featured: false },
  { id: 'app_004', name: 'Xero Live Bridge',        publisher: 'Xero Ltd.',         category: 'ERP Connector',  installs:  76_000, rating: 4.7, reviews:   980, price: '$25/mo',       tagline: 'Bank feeds, invoices, and contacts synced in realtime',           accent: 'violet',  featured: false },
  { id: 'app_005', name: 'Oracle AI Skill Pack',    publisher: 'GSTPilot Labs',     category: 'AI Skill',       installs:  62_000, rating: 4.9, reviews:   840, price: '$99/mo',       tagline: '12 Oracle™ skills: cash forecasting, vendor risk, GST anomaly',    accent: 'amber',   featured: true  },
  { id: 'app_006', name: 'Manufacturing Template',  publisher: 'GSTPilot Labs',     category: 'Industry Template', installs: 48_000, rating: 4.5, reviews:   620, price: '$199 one-time', tagline: 'Pre-built BOM, MRP, shop-floor costing for discrete manufacturing', accent: 'rose',  featured: false },
  { id: 'app_007', name: 'Retail POS Extension',    publisher: 'Shopify Cloud',     category: 'Extension',      installs: 132_000, rating: 4.4, reviews: 1_420, price: 'Free',         tagline: 'GST-compliant retail POS with realtime stock & e-invoicing',      accent: 'emerald', featured: false },
  { id: 'app_008', name: 'D2C E-commerce Pack',     publisher: 'GSTPilot Labs',     category: 'Industry Template', installs: 88_000, rating: 4.6, reviews: 1_180, price: '$249 one-time', tagline: 'Marketplace seller template: Flipkart, Amazon, Myntra, Meesho',  accent: 'teal',    featured: true  },
  { id: 'app_009', name: 'Auto-Reconcile Pack',     publisher: 'GSTPilot Labs',     category: 'Automation Pack', installs: 214_000, rating: 4.8, reviews: 2_840, price: '$49/mo',       tagline: 'Smart ledger-bank auto-match with 99.2% accuracy',                accent: 'cyan',    featured: true  },
  { id: 'app_010', name: 'Vendor Onboarding AI',    publisher: 'GSTPilot Labs',     category: 'AI Skill',       installs:  34_000, rating: 4.7, reviews:   420, price: '$79/mo',       tagline: 'Auto-extract vendor KYC, PAN, GSTIN from uploads',                accent: 'violet',  featured: false },
  { id: 'app_011', name: 'WhatsApp Invoicing',      publisher: 'Meta Cloud',        category: 'Plugin',         installs: 168_000, rating: 4.5, reviews: 1_980, price: 'Free',         tagline: 'Send invoices & payment links via WhatsApp Business API',         accent: 'amber',   featured: true  },
  { id: 'app_012', name: 'Stripe Payment Plugin',   publisher: 'Stripe Inc.',       category: 'Plugin',         installs: 142_000, rating: 4.7, reviews: 1_640, price: 'Free',         tagline: 'Accept cards, UPI, wallets — auto-reconcile payouts',            accent: 'rose',    featured: false },
  { id: 'app_013', name: 'Real Estate Template',    publisher: 'GSTPilot Labs',     category: 'Industry Template', installs: 22_000, rating: 4.4, reviews:   280, price: '$299 one-time', tagline: 'RERA compliance, project-wise P&L, customer payment plans',     accent: 'emerald', featured: false },
  { id: 'app_014', name: 'GST Auto-Filer Pack',     publisher: 'GSTPilot Labs',     category: 'Automation Pack', installs: 286_000, rating: 4.9, reviews: 3_640, price: '$99/mo',       tagline: 'Auto-prepare & file GSTR-1/3B with OTP-less e-sign',              accent: 'teal',    featured: true  },
  { id: 'app_015', name: 'Healthcare Template',     publisher: 'GSTPilot Labs',     category: 'Industry Template', installs: 18_000, rating: 4.3, reviews:   220, price: '$349 one-time', tagline: 'Hospital billing, insurance claims, Ayurveda & cosmetics GST',  accent: 'cyan',    featured: false },
  { id: 'app_016', name: 'SAP S/4HANA Connector',   publisher: 'SAP SE',            category: 'ERP Connector',  installs:  12_000, rating: 4.5, reviews:   180, price: '$499/mo',      tagline: 'Enterprise-grade SAP S/4HANA integration via IDoc & RFC',         accent: 'violet',  featured: false },
  { id: 'app_017', name: 'Slack Approvals Plugin',  publisher: 'Slack Inc.',        category: 'Plugin',         installs:  96_000, rating: 4.6, reviews: 1_120, price: 'Free',         tagline: 'Approve invoices, payments, journal entries from Slack',         accent: 'amber',   featured: false },
  { id: 'app_018', name: 'Cash Flow Forecaster AI', publisher: 'GSTPilot Labs',     category: 'AI Skill',       installs:  78_000, rating: 4.8, reviews:   960, price: '$89/mo',       tagline: '13-week cash forecast with scenario planning',                    accent: 'rose',    featured: true  },
];

export interface MarketplaceCategory {
  name: string;
  count: number;
  installs: number;
  accent: Accent;
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  { name: 'ERP Connectors',    count: 24, installs: 824_000, accent: 'emerald' },
  { name: 'AI Skills',         count: 42, installs: 412_000, accent: 'amber'   },
  { name: 'Industry Templates',count: 38, installs: 286_000, accent: 'teal'    },
  { name: 'Automation Packs',  count: 56, installs: 942_000, accent: 'cyan'    },
  { name: 'Plugins',           count: 84, installs: 1_240_000, accent: 'violet' },
  { name: 'Extensions',        count: 68, installs: 684_000, accent: 'rose'    },
  { name: 'Apps',              count: 142, installs: 2_180_000, accent: 'emerald' },
];

export interface DeveloperPublisher {
  name: string;
  apps: number;
  installs: number;
  revenue: number;
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Verified';
}

export const TOP_PUBLISHERS: DeveloperPublisher[] = [
  { name: 'GSTPilot Labs',     apps: 38, installs: 1_840_000, revenue: 12_400_000, tier: 'Platinum' },
  { name: 'Zoho Corporation',  apps: 12, installs:   412_000, revenue:  3_240_000, tier: 'Platinum' },
  { name: 'Intuit Inc.',       apps:  8, installs:   298_000, revenue:  2_640_000, tier: 'Gold'     },
  { name: 'Stripe Inc.',       apps:  4, installs:   248_000, revenue:  1_980_000, tier: 'Gold'     },
  { name: 'Meta Cloud',        apps:  6, installs:   184_000, revenue:  1_420_000, tier: 'Gold'     },
  { name: 'SAP SE',            apps:  3, installs:    42_000, revenue:  2_840_000, tier: 'Silver'   },
  { name: 'Xero Ltd.',         apps:  5, installs:    86_000, revenue:    940_000, tier: 'Silver'   },
  { name: 'Shopify Cloud',     apps:  7, installs:   142_000, revenue:    680_000, tier: 'Verified' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 4. GLOBAL INTEGRATION HUB — 20 native integrations
// ═══════════════════════════════════════════════════════════════════════════════

export interface Integration {
  name: string;
  category: 'ERP' | 'CRM' | 'Payments' | 'Banking' | 'Communication' | 'Productivity' | 'Government' | 'Commerce';
  status: 'connected' | 'available' | 'coming-soon';
  sync: 'Two-way' | 'Inbound' | 'Outbound';
  lastSync: string;
  records: number;
  accent: Accent;
}

export const INTEGRATIONS: Integration[] = [
  { name: 'SAP S/4HANA',        category: 'ERP',          status: 'connected',   sync: 'Two-way', lastSync: '4 min ago',   records: 184_000, accent: 'emerald' },
  { name: 'Oracle ERP Cloud',   category: 'ERP',          status: 'connected',   sync: 'Two-way', lastSync: '8 min ago',   records:  96_000, accent: 'teal'    },
  { name: 'Microsoft Dynamics', category: 'ERP',          status: 'connected',   sync: 'Two-way', lastSync: '2 min ago',   records: 142_000, accent: 'cyan'    },
  { name: 'Zoho Books',         category: 'ERP',          status: 'connected',   sync: 'Two-way', lastSync: '1 min ago',   records: 384_000, accent: 'violet'  },
  { name: 'Tally Prime',        category: 'ERP',          status: 'connected',   sync: 'Two-way', lastSync: '3 min ago',   records: 524_000, accent: 'amber'   },
  { name: 'QuickBooks Online',  category: 'ERP',          status: 'connected',   sync: 'Two-way', lastSync: '5 min ago',   records: 248_000, accent: 'rose'    },
  { name: 'Xero',               category: 'ERP',          status: 'connected',   sync: 'Two-way', lastSync: '6 min ago',   records:  86_000, accent: 'emerald' },
  { name: 'Salesforce',         category: 'CRM',          status: 'connected',   sync: 'Two-way', lastSync: '2 min ago',   records: 312_000, accent: 'teal'    },
  { name: 'HubSpot',            category: 'CRM',          status: 'connected',   sync: 'Inbound', lastSync: '12 min ago',  records: 184_000, accent: 'cyan'    },
  { name: 'Slack',              category: 'Communication',status: 'connected',   sync: 'Outbound',lastSync: '30 sec ago',  records:  12_400, accent: 'violet'  },
  { name: 'Microsoft Teams',    category: 'Communication',status: 'connected',   sync: 'Outbound',lastSync: '1 min ago',   records:   8_200, accent: 'amber'   },
  { name: 'Google Workspace',   category: 'Productivity', status: 'connected',   sync: 'Two-way', lastSync: '4 min ago',   records:  42_000, accent: 'rose'    },
  { name: 'Microsoft 365',      category: 'Productivity', status: 'connected',   sync: 'Two-way', lastSync: '5 min ago',   records:  38_000, accent: 'emerald' },
  { name: 'WhatsApp Business',  category: 'Communication',status: 'connected',   sync: 'Outbound',lastSync: '20 sec ago',  records: 184_000, accent: 'teal'    },
  { name: 'Stripe',             category: 'Payments',     status: 'connected',   sync: 'Inbound', lastSync: '1 min ago',   records: 412_000, accent: 'cyan'    },
  { name: 'Razorpay',           category: 'Payments',     status: 'connected',   sync: 'Inbound', lastSync: '40 sec ago',  records: 524_000, accent: 'violet'  },
  { name: 'PayPal',             category: 'Payments',     status: 'connected',   sync: 'Inbound', lastSync: '3 min ago',   records: 142_000, accent: 'amber'   },
  { name: 'HDFC Bank API',      category: 'Banking',      status: 'connected',   sync: 'Inbound', lastSync: '90 sec ago',  records:  84_000, accent: 'rose'    },
  { name: 'ICICI Bank API',     category: 'Banking',      status: 'connected',   sync: 'Inbound', lastSync: '2 min ago',   records:  72_000, accent: 'emerald' },
  { name: 'GST Network API',    category: 'Government',   status: 'connected',   sync: 'Two-way', lastSync: '8 min ago',   records: 248_000, accent: 'teal'    },
  { name: 'Income Tax Dept API',category: 'Government',   status: 'available',   sync: 'Two-way', lastSync: '—',           records:      0, accent: 'cyan'    },
  { name: 'MCA Portal API',     category: 'Government',   status: 'coming-soon', sync: 'Two-way', lastSync: '—',           records:      0, accent: 'violet'  },
  { name: 'Shopify',            category: 'Commerce',     status: 'connected',   sync: 'Inbound', lastSync: '2 min ago',   records: 198_000, accent: 'amber'   },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 5. FINANCIAL DATA CLOUD — 11 unified data domains
// ═══════════════════════════════════════════════════════════════════════════════

export interface DataDomain {
  name: string;
  records: number;
  schema: string;
  syncStatus: 'synced' | 'syncing' | 'pending';
  freshness: string;
  consumers: number;
  storageGB: number;
  accent: Accent;
}

export const DATA_DOMAINS: DataDomain[] = [
  { name: 'Invoices',     records: 184_000_000, schema: 'v4.2', syncStatus: 'synced',  freshness: '12 sec ago',  consumers: 412, storageGB: 1840, accent: 'emerald' },
  { name: 'GST Returns',  records:  12_400_000, schema: 'v3.8', syncStatus: 'synced',  freshness: '4 min ago',   consumers: 284, storageGB:  420, accent: 'teal'    },
  { name: 'Accounting',   records: 384_000_000, schema: 'v5.1', syncStatus: 'synced',  freshness: '8 sec ago',   consumers: 318, storageGB: 2840, accent: 'cyan'    },
  { name: 'Banking',      records:  96_000_000, schema: 'v2.9', syncStatus: 'syncing', freshness: 'Live stream', consumers: 246, storageGB:  980, accent: 'violet'  },
  { name: 'Inventory',    records: 248_000_000, schema: 'v4.0', syncStatus: 'synced',  freshness: '20 sec ago',  consumers: 184, storageGB: 1240, accent: 'amber'   },
  { name: 'Payroll',      records:   8_400_000, schema: 'v3.4', syncStatus: 'synced',  freshness: '1 hr ago',    consumers: 142, storageGB:  280, accent: 'rose'    },
  { name: 'Compliance',   records:  18_200_000, schema: 'v3.6', syncStatus: 'synced',  freshness: '14 min ago',  consumers: 198, storageGB:  420, accent: 'emerald' },
  { name: 'Customers',    records:  42_000_000, schema: 'v4.1', syncStatus: 'synced',  freshness: '6 sec ago',   consumers: 364, storageGB:  680, accent: 'teal'    },
  { name: 'Vendors',      records:  28_400_000, schema: 'v4.1', syncStatus: 'synced',  freshness: '12 sec ago',  consumers: 248, storageGB:  440, accent: 'cyan'    },
  { name: 'Documents',    records:  62_000_000, schema: 'v2.7', syncStatus: 'pending', freshness: '4 hr ago',    consumers: 184, storageGB: 4820, accent: 'violet'  },
  { name: 'Analytics',    records:   4_200_000, schema: 'v3.2', syncStatus: 'synced',  freshness: '2 min ago',   consumers: 412, storageGB: 1840, accent: 'amber'   },
];

export interface DataSyncJob {
  domain: string;
  source: string;
  destination: string;
  records: number;
  duration: string;
  status: 'success' | 'running' | 'queued' | 'failed';
}

export const DATA_SYNC_JOBS: DataSyncJob[] = [
  { domain: 'Invoices',     source: 'Tally Prime',     destination: 'Financial Data Cloud', records: 12_400, duration: '42 sec', status: 'success' },
  { domain: 'Banking',      source: 'HDFC Bank API',   destination: 'Financial Data Cloud', records:  8_400, duration: '12 sec', status: 'running' },
  { domain: 'GST Returns',  source: 'GST Network',     destination: 'Financial Data Cloud', records:    240, duration: '8 sec',  status: 'success' },
  { domain: 'Inventory',    source: 'SAP S/4HANA',     destination: 'Financial Data Cloud', records: 24_800, duration: '1m 18s', status: 'success' },
  { domain: 'Customers',    source: 'Salesforce',      destination: 'Financial Data Cloud', records:  4_200, duration: '22 sec', status: 'success' },
  { domain: 'Documents',    source: 'Google Drive',    destination: 'Financial Data Cloud', records:    840, duration: '4m 12s', status: 'queued'  },
  { domain: 'Payroll',      source: 'Internal HRMS',   destination: 'Financial Data Cloud', records:  1_200, duration: '38 sec', status: 'success' },
  { domain: 'Accounting',   source: 'QuickBooks',      destination: 'Financial Data Cloud', records: 18_400, duration: '52 sec', status: 'failed'  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 6. EVENT STREAMING PLATFORM — 9 event types
// ═══════════════════════════════════════════════════════════════════════════════

export interface EventType {
  name: string;
  topic: string;
  schema: string;
  subscribers: number;
  dailyVolume: number;
  p99LatencyMs: number;
  retention: string;
  accent: Accent;
}

export const EVENT_TYPES: EventType[] = [
  { name: 'Invoice Created',     topic: 'invoices.created',     schema: 'v4.2', subscribers: 184, dailyVolume: 4_820_000, p99LatencyMs: 18, retention: '30 days', accent: 'emerald' },
  { name: 'Payment Received',    topic: 'payments.received',    schema: 'v3.4', subscribers: 142, dailyVolume: 2_640_000, p99LatencyMs: 12, retention: '90 days', accent: 'teal'    },
  { name: 'GST Filed',           topic: 'gst.filed',            schema: 'v3.8', subscribers:  96, dailyVolume:   184_000, p99LatencyMs: 24, retention: '7 years', accent: 'cyan'    },
  { name: 'Expense Added',       topic: 'expenses.added',       schema: 'v3.2', subscribers:  84, dailyVolume: 1_240_000, p99LatencyMs: 22, retention: '90 days', accent: 'violet'  },
  { name: 'Bank Synced',         topic: 'bank.synced',          schema: 'v3.6', subscribers: 118, dailyVolume:   640_000, p99LatencyMs: 16, retention: '30 days', accent: 'amber'   },
  { name: 'AI Action',           topic: 'ai.action',            schema: 'v2.4', subscribers:  62, dailyVolume:   420_000, p99LatencyMs: 48, retention: '90 days', accent: 'rose'    },
  { name: 'Document Uploaded',   topic: 'documents.uploaded',   schema: 'v2.8', subscribers:  72, dailyVolume:   880_000, p99LatencyMs: 28, retention: '1 year',  accent: 'emerald' },
  { name: 'Approval Granted',    topic: 'approvals.granted',    schema: 'v3.0', subscribers:  48, dailyVolume:   240_000, p99LatencyMs: 14, retention: '7 years', accent: 'teal'    },
  { name: 'Webhook Delivery',    topic: 'webhooks.delivered',   schema: 'v3.1', subscribers: 312, dailyVolume: 6_240_000, p99LatencyMs: 32, retention: '30 days', accent: 'cyan'    },
];

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  successRate: number;
  avgLatencyMs: number;
  lastDelivery: string;
  status: 'active' | 'paused' | 'failing';
}

export const WEBHOOK_ENDPOINTS: WebhookEndpoint[] = [
  { id: 'wh_001', url: 'https://api.acme-corp.com/webhooks/gstpilot', events: ['invoices.created', 'payments.received'], successRate: 99.8, avgLatencyMs: 142, lastDelivery: '12 sec ago', status: 'active'  },
  { id: 'wh_002', url: 'https://hooks.zapier.com/hooks/catch/8421/', events: ['gst.filed', 'bank.synced'],             successRate: 98.4, avgLatencyMs: 284, lastDelivery: '4 min ago',  status: 'active'  },
  { id: 'wh_003', url: 'https://workflow.io/in/gstpilot',            events: ['invoices.created'],                     successRate: 96.2, avgLatencyMs: 420, lastDelivery: '14 min ago', status: 'failing' },
  { id: 'wh_004', url: 'https://erp.tally.com/webhooks/inbound',     events: ['expenses.added', 'approvals.granted'],  successRate: 99.6, avgLatencyMs:  96, lastDelivery: '2 min ago',  status: 'active'  },
  { id: 'wh_005', url: 'https://slack.com/api/webhooks/incoming',    events: ['approvals.granted'],                    successRate: 99.9, avgLatencyMs:  62, lastDelivery: '40 sec ago', status: 'active'  },
  { id: 'wh_006', url: 'https://n8n.local/webhook/gstpilot',         events: ['ai.action'],                            successRate:  0.0, avgLatencyMs:   0, lastDelivery: '2 days ago', status: 'paused'  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 7. ENTERPRISE AUTOMATION STUDIO — workflow templates
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkflowTemplate {
  id: string;
  name: string;
  category: string;
  triggers: number;
  conditions: number;
  actions: number;
  aiNodes: number;
  runs: number;
  successRate: number;
  avgDuration: string;
  accent: Accent;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  { id: 'wf_001', name: 'Auto-File GSTR-1 on Month-End',  category: 'Compliance',  triggers: 1, conditions: 4, actions: 6, aiNodes: 1, runs: 184_000, successRate: 99.4, avgDuration: '4m 12s', accent: 'emerald' },
  { id: 'wf_002', name: 'Vendor Invoice → Auto-Approve',  category: 'AP',         triggers: 1, conditions: 6, actions: 4, aiNodes: 2, runs: 412_000, successRate: 97.8, avgDuration: '18 sec', accent: 'teal'    },
  { id: 'wf_003', name: 'Payment Received → Receipt + WhatsApp', category: 'AR',   triggers: 1, conditions: 2, actions: 5, aiNodes: 1, runs: 624_000, successRate: 99.6, avgDuration: '6 sec',  accent: 'cyan'    },
  { id: 'wf_004', name: 'Bank Reconciliation Auto-Match', category: 'Accounting', triggers: 1, conditions: 8, actions: 3, aiNodes: 2, runs: 284_000, successRate: 99.2, avgDuration: '42 sec', accent: 'violet'  },
  { id: 'wf_005', name: 'Low-Stock → Auto PO to Vendor',  category: 'Inventory',  triggers: 1, conditions: 3, actions: 4, aiNodes: 1, runs:  84_000, successRate: 98.6, avgDuration: '24 sec', accent: 'amber'   },
  { id: 'wf_006', name: 'Payroll Run → Payslip + PF',     category: 'Payroll',    triggers: 1, conditions: 4, actions: 7, aiNodes: 0, runs:  42_000, successRate: 99.8, avgDuration: '2m 48s', accent: 'rose'    },
  { id: 'wf_007', name: 'Customer Onboarding → KYC + Setup', category: 'CRM',     triggers: 1, conditions: 5, actions: 8, aiNodes: 2, runs:  62_000, successRate: 96.4, avgDuration: '8m 20s', accent: 'emerald' },
  { id: 'wf_008', name: 'AI Cash Forecast → Slack Alert', category: 'Finance',    triggers: 1, conditions: 2, actions: 3, aiNodes: 3, runs:  12_400, successRate: 99.9, avgDuration: '4 sec',  accent: 'teal'    },
];

export interface AutomationNode {
  type: 'Trigger' | 'Condition' | 'Action' | 'AI Node' | 'API Node' | 'Webhook' | 'Schedule';
  name: string;
  desc: string;
  icon: string;
  accent: Accent;
}

export const AUTOMATION_NODES: AutomationNode[] = [
  { type: 'Trigger',  name: 'Invoice Created',     desc: 'Fires when a new invoice is created',                icon: 'file-plus',   accent: 'emerald' },
  { type: 'Trigger',  name: 'Payment Received',    desc: 'Fires when an inbound payment is detected',          icon: 'banknote',    accent: 'teal'    },
  { type: 'Trigger',  name: 'Schedule — Monthly',  desc: 'Fires on a recurring schedule (cron)',               icon: 'calendar',    accent: 'cyan'    },
  { type: 'Condition',name: 'Amount > Threshold',  desc: 'Branch based on a numeric threshold',                icon: 'filter',      accent: 'violet'  },
  { type: 'Condition',name: 'Vendor Tier Check',   desc: 'Branch based on vendor classification',              icon: 'shield',      accent: 'amber'   },
  { type: 'AI Node',  name: 'Oracle™ Classify',    desc: 'AI categorization of documents & transactions',      icon: 'brain',       accent: 'rose'    },
  { type: 'AI Node',  name: 'Oracle™ Forecast',    desc: 'AI-powered forecast for cash & revenue',             icon: 'trending-up', accent: 'emerald' },
  { type: 'AI Node',  name: 'Oracle™ Extract',     desc: 'OCR + AI extraction from uploaded documents',        icon: 'scan-line',   accent: 'teal'    },
  { type: 'Action',   name: 'Send WhatsApp',       desc: 'Send a WhatsApp Business message',                   icon: 'message-circle', accent: 'cyan' },
  { type: 'Action',   name: 'Create Journal Entry',desc: 'Post a double-entry journal voucher',                icon: 'book-open',   accent: 'violet'  },
  { type: 'Action',   name: 'File GST Return',     desc: 'Auto-file GST return via OTP-less e-sign',           icon: 'receipt',     accent: 'amber'   },
  { type: 'API Node', name: 'Call External API',   desc: 'HTTP request to any external endpoint',              icon: 'globe',       accent: 'rose'    },
  { type: 'Webhook',  name: 'Emit Webhook',        desc: 'Emit a webhook event to subscribers',                icon: 'webhook',     accent: 'emerald' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 8. ENTERPRISE DATA WAREHOUSE — datasets, queries, BI dashboards, data lake
// ═══════════════════════════════════════════════════════════════════════════════

export interface Dataset {
  name: string;
  rows: number;
  size: string;
  freshness: string;
  queries24h: number;
  accent: Accent;
}

export const WAREHOUSE_DATASETS: Dataset[] = [
  { name: 'fact_invoices',        rows: 184_000_000, size: '1.8 TB', freshness: '12 sec',  queries24h: 412_000, accent: 'emerald' },
  { name: 'fact_payments',        rows:  96_000_000, size: '980 GB', freshness: '6 sec',   queries24h: 284_000, accent: 'teal'    },
  { name: 'fact_journal_entries', rows: 384_000_000, size: '2.8 TB', freshness: '8 sec',   queries24h: 184_000, accent: 'cyan'    },
  { name: 'fact_bank_txns',       rows: 142_000_000, size: '1.4 TB', freshness: '4 sec',   queries24h: 312_000, accent: 'violet'  },
  { name: 'dim_customers',        rows:  42_000_000, size: '180 GB', freshness: '6 sec',   queries24h: 524_000, accent: 'amber'   },
  { name: 'dim_vendors',          rows:  28_400_000, size: '120 GB', freshness: '12 sec',  queries24h: 184_000, accent: 'rose'    },
  { name: 'fact_inventory_moves', rows: 624_000_000, size: '4.2 TB', freshness: '20 sec',  queries24h:  84_000, accent: 'emerald' },
  { name: 'fact_payroll_runs',    rows:   8_400_000, size: ' 64 GB', freshness: '1 hr',    queries24h:  42_000, accent: 'teal'    },
];

export interface SavedQuery {
  name: string;
  sql: string;
  author: string;
  runs: number;
  avgMs: number;
  cacheHit: number;
}

export const SAVED_QUERIES: SavedQuery[] = [];

export interface BIDashboard {
  name: string;
  owner: string;
  viewers: number;
  refresh: string;
  tiles: number;
  accent: Accent;
}

export const BI_DASHBOARDS: BIDashboard[] = [
  { name: 'CFO Executive Dashboard',    owner: 'CFO Office',   viewers: 142, refresh: '5 min',  tiles: 24, accent: 'emerald' },
  { name: 'Revenue Operations',         owner: 'RevOps',       viewers:  84, refresh: '15 min', tiles: 18, accent: 'teal'    },
  { name: 'GST Compliance Scorecard',   owner: 'Tax Team',     viewers:  62, refresh: '1 hr',   tiles: 16, accent: 'cyan'    },
  { name: 'Vendor Performance',         owner: 'Procurement',  viewers:  48, refresh: '4 hr',   tiles: 14, accent: 'violet'  },
  { name: 'Working Capital Pulse',      owner: 'Treasury',     viewers:  36, refresh: '5 min',  tiles: 12, accent: 'amber'   },
  { name: 'Customer Health',            owner: 'CS Team',      viewers:  96, refresh: '15 min', tiles: 20, accent: 'rose'    },
];

export interface AIQuery {
  question: string;
  sqlGenerated: string;
  confidence: number;
  runtime: string;
}

export const AI_QUERIES: AIQuery[] = [
  { question: 'What was our revenue growth in Q3 vs Q2 by country?',
    sqlGenerated: 'WITH q AS (...) SELECT country, (q3-q2)/q2 AS growth FROM ...',
    confidence: 96, runtime: '1.2 sec' },
  { question: 'Show me vendors with on-time delivery below 90% last quarter',
    sqlGenerated: 'SELECT v.name, AVG(on_time) FROM fact_deliveries ... HAVING AVG(on_time) < 0.9',
    confidence: 94, runtime: '0.8 sec' },
  { question: 'Which customers have DSO above 60 days and balance over $50K?',
    sqlGenerated: 'SELECT customer, dso, balance FROM fact_ar_aging WHERE dso > 60 AND balance > 50000',
    confidence: 98, runtime: '0.4 sec' },
  { question: 'Forecast our cash position for the next 13 weeks',
    sqlGenerated: 'SELECT week, projected_balance FROM ai.cash_forecast(weeks=13)',
    confidence: 88, runtime: '3.4 sec' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 9. GLOBAL IDENTITY PLATFORM — SSO, MFA, passwordless
// ═══════════════════════════════════════════════════════════════════════════════

export interface SSOConnection {
  name: string;
  protocol: 'SAML 2.0' | 'OIDC' | 'OAuth 2.0' | 'LDAP';
  users: number;
  lastLogin: string;
  mfa: boolean;
  accent: Accent;
}

export const SSO_CONNECTIONS: SSOConnection[] = [
  { name: 'Azure AD (Microsoft Entra)', protocol: 'SAML 2.0', users: 4_200, lastLogin: '2 min ago',  mfa: true,  accent: 'emerald' },
  { name: 'Google Workspace',           protocol: 'OIDC',      users: 2_800, lastLogin: '4 min ago',  mfa: true,  accent: 'teal'    },
  { name: 'Okta Workforce',             protocol: 'SAML 2.0', users: 1_400, lastLogin: '6 min ago',  mfa: true,  accent: 'cyan'    },
  { name: 'OneLogin',                   protocol: 'SAML 2.0', users:   840, lastLogin: '12 min ago', mfa: true,  accent: 'violet'  },
  { name: 'PingIdentity',               protocol: 'OIDC',      users:   620, lastLogin: '18 min ago', mfa: true,  accent: 'amber'   },
  { name: 'Active Directory (LDAP)',    protocol: 'LDAP',      users: 1_200, lastLogin: '1 hr ago',   mfa: false, accent: 'rose'    },
];

export interface MFAMethod {
  name: string;
  users: number;
  adoptionPct: number;
  avgSetupMin: number;
  accent: Accent;
}

export const MFA_METHODS: MFAMethod[] = [
  { name: 'Authenticator App (TOTP)', users: 8_400, adoptionPct: 68, avgSetupMin: 2, accent: 'emerald' },
  { name: 'SMS OTP',                  users: 3_200, adoptionPct: 26, avgSetupMin: 1, accent: 'teal'    },
  { name: 'Hardware Key (YubiKey)',   users:   840, adoptionPct:  7, avgSetupMin: 4, accent: 'cyan'    },
  { name: 'Biometric (WebAuthn)',     users: 1_240, adoptionPct: 10, avgSetupMin: 1, accent: 'violet'  },
  { name: 'Email OTP',                users:   620, adoptionPct:  5, avgSetupMin: 1, accent: 'amber'   },
];

export interface IdentityEvent {
  type: string;
  user: string;
  ip: string;
  location: string;
  time: string;
  status: 'success' | 'challenge' | 'denied';
}

export const IDENTITY_EVENTS: IdentityEvent[] = [
  { type: 'SSO Login',         user: 'arjun.sharma@acme.com',  ip: '203.0.113.42',  location: 'Bengaluru, IN', time: '2 min ago',  status: 'success'   },
  { type: 'MFA Challenge',     user: 'meera.iyer@acme.com',    ip: '198.51.100.18', location: 'Mumbai, IN',    time: '4 min ago',  status: 'success'   },
  { type: 'Passwordless',      user: 'raj.khan@acme.com',      ip: '192.0.2.88',    location: 'Delhi, IN',     time: '6 min ago',  status: 'success'   },
  { type: 'SSO Login',         user: 'priya.reddy@acme.com',   ip: '203.0.113.99',  location: 'Hyderabad, IN', time: '12 min ago', status: 'success'   },
  { type: 'Failed Login',      user: 'unknown@acme.com',       ip: '45.83.12.4',    location: 'Unknown, RU',   time: '14 min ago', status: 'denied'    },
  { type: 'MFA Challenge',     user: 'sanjay.nair@acme.com',   ip: '198.51.100.62', location: 'Chennai, IN',   time: '18 min ago', status: 'success'   },
  { type: 'Suspicious Login',  user: 'kavya.patel@acme.com',   ip: '91.243.85.12',  location: 'Unknown, NG',   time: '22 min ago', status: 'challenge' },
  { type: 'Hardware Key Used', user: 'vikram.joshi@acme.com',  ip: '203.0.113.140', location: 'Pune, IN',      time: '28 min ago', status: 'success'   },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 10. DEVELOPER ANALYTICS — API usage, errors, latency, revenue, apps
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiUsageSeries {
  hour: string;
  calls: number;
  errors: number;
}

export const API_USAGE_SERIES: ApiUsageSeries[] = [
  { hour: '00:00', calls: 1_240_000, errors:   240 },
  { hour: '02:00', calls:   980_000, errors:   180 },
  { hour: '04:00', calls:   740_000, errors:   140 },
  { hour: '06:00', calls:   920_000, errors:   160 },
  { hour: '08:00', calls: 2_140_000, errors:   420 },
  { hour: '10:00', calls: 3_840_000, errors:   840 },
  { hour: '12:00', calls: 4_620_000, errors: 1_120 },
  { hour: '14:00', calls: 5_240_000, errors: 1_280 },
  { hour: '16:00', calls: 4_980_000, errors: 1_080 },
  { hour: '18:00', calls: 3_420_000, errors:   720 },
  { hour: '20:00', calls: 2_180_000, errors:   480 },
  { hour: '22:00', calls: 1_640_000, errors:   320 },
];

export interface ApiErrorType {
  code: string;
  message: string;
  count: number;
  trend: number;
  accent: Accent;
}

export const API_ERROR_TYPES: ApiErrorType[] = [
  { code: '429', message: 'Rate limit exceeded',           count: 4_820, trend: -12, accent: 'amber'   },
  { code: '401', message: 'Authentication failed',         count: 2_140, trend:  -8, accent: 'rose'    },
  { code: '400', message: 'Bad request — validation',      count: 1_840, trend:  -4, accent: 'violet'  },
  { code: '500', message: 'Internal server error',         count:   840, trend: -22, accent: 'rose'    },
  { code: '403', message: 'Insufficient scope',            count:   620, trend:  +6, accent: 'amber'   },
  { code: '404', message: 'Resource not found',            count:   480, trend:  -2, accent: 'teal'    },
  { code: '503', message: 'Service unavailable (transient)',count:   180, trend: -38, accent: 'cyan'    },
];

export interface DeveloperApp {
  name: string;
  publisher: string;
  calls24h: number;
  errorRate: number;
  revenue: number;
  trend: number;
  accent: Accent;
}

export const TOP_DEVELOPER_APPS: DeveloperApp[] = [];

export interface DeveloperMetric {
  label: string;
  value: string;
  trend: number;
  accent: Accent;
}

export const DEVELOPER_KPIS: DeveloperMetric[] = [
  { label: 'Active Developers',     value: '2,418,400', trend:  +8.4, accent: 'emerald' },
  { label: 'API Calls (24h)',       value: '42.8M',     trend: +12.6, accent: 'teal'    },
  { label: 'Avg P95 Latency',       value: '124 ms',    trend:  -6.2, accent: 'cyan'    },
  { label: 'Error Rate',            value: '0.04%',     trend:  -2.1, accent: 'violet'  },
  { label: 'Apps Published',        value: '4,820',     trend: +14.2, accent: 'amber'   },
  { label: 'SDK Downloads (30d)',   value: '8.4M',      trend: +18.4, accent: 'rose'    },
  { label: 'API Revenue (MTD)',     value: '$4.82M',    trend: +22.8, accent: 'emerald' },
  { label: 'Sandbox Sessions (24h)',value: '184K',      trend:  +6.8, accent: 'teal'    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 11. ENTERPRISE BILLING PLATFORM — subscriptions, usage, marketplace, contracts
// ═══════════════════════════════════════════════════════════════════════════════

export interface SubscriptionPlan {
  name: string;
  mrr: number;
  customers: number;
  churn: number;
  growth: number;
  accent: Accent;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { name: 'Starter',     mrr:     680_000, customers: 184_000, churn: 2.4, growth:  +8.4, accent: 'emerald' },
  { name: 'Business',    mrr:   2_840_000, customers: 142_000, churn: 1.2, growth: +12.6, accent: 'teal'    },
  { name: 'Enterprise',  mrr:   8_420_000, customers:  18_400, churn: 0.4, growth: +18.4, accent: 'cyan'    },
  { name: 'Unlimited',   mrr:  12_640_000, customers:   4_800, churn: 0.2, growth: +24.2, accent: 'violet'  },
];

export interface UsageBillable {
  metric: string;
  included: number;
  used: number;
  overage: number;
  rate: string;
  revenue: number;
}

export const USAGE_BILLABLES: UsageBillable[] = [
  { metric: 'API Calls',         included: 1_000_000, used: 1_840_000, overage: 840_000, rate: '$0.002 / call',  revenue: 1_680 },
  { metric: 'AI Oracle™ Calls',  included:     1_000, used:     2_400, overage: 1_400,   rate: '$0.08 / call',   revenue:   112 },
  { metric: 'Documents OCRed',   included:    10_000, used:    18_400, overage: 8_400,   rate: '$0.04 / page',   revenue:   336 },
  { metric: 'Webhook Deliveries',included: 1_000_000, used:   620_000, overage:     0,   rate: '$0.0001 / call', revenue:     0 },
  { metric: 'Sandbox Hours',     included:     1_000, used:     1_200, overage:   200,   rate: '$0.50 / hour',   revenue:   100 },
];

export interface MarketplaceRevenue {
  app: string;
  publisher: string;
  revenue: number;
  gstpilotShare: number;
  publisherShare: number;
  accent: Accent;
}

export const MARKETPLACE_REVENUE: MarketplaceRevenue[] = [
  { app: 'Tally Connector Pro',  publisher: 'GSTPilot Labs',    revenue: 480_000, gstpilotShare: 480_000, publisherShare:      0, accent: 'emerald' },
  { app: 'QuickBooks Sync',      publisher: 'Intuit Inc.',      revenue: 284_000, gstpilotShare:  56_800, publisherShare: 227_200, accent: 'teal'    },
  { app: 'Auto-Reconcile Pack',  publisher: 'GSTPilot Labs',    revenue: 196_000, gstpilotShare: 196_000, publisherShare:      0, accent: 'cyan'    },
  { app: 'WhatsApp Invoicing',   publisher: 'Meta Cloud',       revenue: 142_000, gstpilotShare:  28_400, publisherShare: 113_600, accent: 'violet'  },
  { app: 'Cash Flow Forecaster', publisher: 'GSTPilot Labs',    revenue:  98_000, gstpilotShare:  98_000, publisherShare:      0, accent: 'amber'   },
  { app: 'Stripe Plugin',        publisher: 'Stripe Inc.',      revenue:  84_000, gstpilotShare:  16_800, publisherShare:  67_200, accent: 'rose'    },
];

export interface EnterpriseContract {
  customer: string;
  arr: number;
  term: string;
  seats: number;
  status: 'active' | 'renewing' | 'expiring';
  accent: Accent;
}

export const ENTERPRISE_CONTRACTS: EnterpriseContract[] = [
  { customer: 'Tata Consultancy Services', arr: 4_800_000, term: '3 years', seats: 24_000, status: 'active',    accent: 'emerald' },
  { customer: 'Reliance Industries',       arr: 3_200_000, term: '3 years', seats: 18_000, status: 'active',    accent: 'teal'    },
  { customer: 'Infosys Limited',           arr: 2_840_000, term: '2 years', seats: 16_000, status: 'renewing',  accent: 'cyan'    },
  { customer: 'HDFC Bank',                 arr: 2_640_000, term: '3 years', seats: 12_000, status: 'active',    accent: 'violet'  },
  { customer: 'ICICI Bank',                arr: 2_420_000, term: '2 years', seats: 11_000, status: 'renewing',  accent: 'amber'   },
  { customer: 'Bharti Airtel',             arr: 1_840_000, term: '2 years', seats:  9_000, status: 'active',    accent: 'rose'    },
  { customer: 'Wipro Technologies',        arr: 1_640_000, term: '3 years', seats:  8_400, status: 'expiring',  accent: 'emerald' },
  { customer: 'Adani Group',               arr: 1_420_000, term: '2 years', seats:  7_200, status: 'active',    accent: 'teal'    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 12. MULTI-TENANT CLOUD INFRASTRUCTURE — regions, scaling, edge, CDN, HA
// ═══════════════════════════════════════════════════════════════════════════════

export interface CloudRegion {
  code: string;
  name: string;
  continent: string;
  orgs: number;
  apiCalls24h: number;
  p95Ms: number;
  status: 'operational' | 'degraded' | 'maintenance';
  accent: Accent;
}

export const CLOUD_REGIONS: CloudRegion[] = [
  { code: 'ap-south-1',     name: 'Mumbai',         continent: 'APAC',     orgs: 84_000, apiCalls24h: 18_400_000, p95Ms:  88, status: 'operational', accent: 'emerald' },
  { code: 'ap-southeast-1', name: 'Singapore',      continent: 'APAC',     orgs: 24_000, apiCalls24h:  4_820_000, p95Ms:  96, status: 'operational', accent: 'teal'    },
  { code: 'ap-northeast-1', name: 'Tokyo',          continent: 'APAC',     orgs: 12_000, apiCalls24h:  2_140_000, p95Ms: 104, status: 'operational', accent: 'cyan'    },
  { code: 'us-east-1',      name: 'N. Virginia',    continent: 'Americas', orgs: 38_000, apiCalls24h:  9_840_000, p95Ms:  72, status: 'operational', accent: 'violet'  },
  { code: 'us-west-2',      name: 'Oregon',         continent: 'Americas', orgs: 18_000, apiCalls24h:  3_240_000, p95Ms:  84, status: 'operational', accent: 'amber'   },
  { code: 'eu-central-1',   name: 'Frankfurt',      continent: 'EMEA',     orgs: 22_000, apiCalls24h:  5_240_000, p95Ms:  92, status: 'operational', accent: 'rose'    },
  { code: 'eu-west-1',      name: 'Ireland',        continent: 'EMEA',     orgs: 16_000, apiCalls24h:  3_840_000, p95Ms:  88, status: 'operational', accent: 'emerald' },
  { code: 'me-central-1',   name: 'UAE (Dubai)',    continent: 'EMEA',     orgs:  6_000, apiCalls24h:  1_240_000, p95Ms: 112, status: 'degraded',    accent: 'teal'    },
  { code: 'sa-east-1',      name: 'São Paulo',      continent: 'Americas', orgs:  4_000, apiCalls24h:    840_000, p95Ms: 124, status: 'operational', accent: 'cyan'    },
  { code: 'af-south-1',     name: 'Cape Town',      continent: 'EMEA',     orgs:  1_200, apiCalls24h:    240_000, p95Ms: 142, status: 'operational', accent: 'violet'  },
];

export interface EdgePOP {
  city: string;
  country: string;
  cacheHitRatio: number;
  requestsPerSec: number;
  egressMbps: number;
  accent: Accent;
}

export const EDGE_POPS: EdgePOP[] = [
  { city: 'Mumbai',     country: 'IN', cacheHitRatio: 96.4, requestsPerSec: 184_000, egressMbps: 14_400, accent: 'emerald' },
  { city: 'Singapore',  country: 'SG', cacheHitRatio: 94.8, requestsPerSec:  84_000, egressMbps:  8_200, accent: 'teal'    },
  { city: 'N. Virginia',country: 'US', cacheHitRatio: 97.2, requestsPerSec: 248_000, egressMbps: 22_800, accent: 'cyan'    },
  { city: 'Frankfurt',  country: 'DE', cacheHitRatio: 95.6, requestsPerSec: 142_000, egressMbps: 12_400, accent: 'violet'  },
  { city: 'Dubai',      country: 'AE', cacheHitRatio: 92.4, requestsPerSec:  48_000, egressMbps:  4_200, accent: 'amber'   },
  { city: 'Tokyo',      country: 'JP', cacheHitRatio: 96.8, requestsPerSec:  98_000, egressMbps:  9_800, accent: 'rose'    },
];

export interface InfraMetric {
  label: string;
  value: string;
  sub: string;
  trend: number;
  accent: Accent;
}

export const INFRA_KPIS: InfraMetric[] = [
  { label: 'Organizations',         value: '184,000',  sub: 'Across 10 regions',         trend:  +6.4, accent: 'emerald' },
  { label: 'API Calls (24h)',       value: '48.4B',    sub: 'Peak 6.2M req/sec',         trend: +12.4, accent: 'teal'    },
  { label: 'Auto-scaling Groups',   value: '1,240',    sub: 'Avg 42 instances per ASG',  trend:  +8.2, accent: 'cyan'    },
  { label: 'Edge POPs',             value: '142',      sub: '96.4% avg cache hit',       trend:  +2.4, accent: 'violet'  },
  { label: 'Avg Uptime (90d)',      value: '99.992%',  sub: 'SLA 99.99%',                trend:  +0.02,accent: 'amber'   },
  { label: 'Multi-AZ Failovers',    value: '12',       sub: 'Zero customer impact',      trend:   0.0, accent: 'rose'    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 13. ENTERPRISE SECURITY — Zero Trust, encryption, threats, audit
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecurityControl {
  category: string;
  controls: number;
  passing: number;
  score: number;
  accent: Accent;
}

export const SECURITY_CONTROLS: SecurityControl[] = [
  { category: 'Zero Trust Architecture', controls: 24, passing: 24, score: 100, accent: 'emerald' },
  { category: 'Encryption (at-rest + in-transit)', controls: 18, passing: 18, score: 100, accent: 'teal'    },
  { category: 'API Security',             controls: 32, passing: 30, score:  94, accent: 'cyan'    },
  { category: 'Secrets Management',       controls: 14, passing: 14, score: 100, accent: 'violet'  },
  { category: 'Rate Limiting & DDoS',     controls: 12, passing: 11, score:  92, accent: 'amber'   },
  { category: 'Threat Detection',         controls: 22, passing: 20, score:  91, accent: 'rose'    },
  { category: 'Audit & Compliance',       controls: 28, passing: 28, score: 100, accent: 'emerald' },
  { category: 'Identity & Access',        controls: 20, passing: 19, score:  95, accent: 'teal'    },
];

export interface ThreatEvent {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  target: string;
  blocked: boolean;
  time: string;
}

export const THREAT_EVENTS: ThreatEvent[] = [
  { type: 'Credential Stuffing',     severity: 'high',    source: '203.0.113.42',  target: '/v1/auth/login',         blocked: true,  time: '2 min ago'  },
  { type: 'API Key Brute Force',     severity: 'medium',  source: '198.51.100.18', target: '/v1/invoices',           blocked: true,  time: '8 min ago'  },
  { type: 'Rate Limit Exceeded',     severity: 'low',     source: '192.0.2.88',    target: '/v1/gst/returns',        blocked: true,  time: '14 min ago' },
  { type: 'SQL Injection Attempt',   severity: 'critical',source: '45.83.12.4',    target: '/v1/customers?q=*',      blocked: true,  time: '22 min ago' },
  { type: 'Suspicious Webhook',      severity: 'medium',  source: '91.243.85.12',  target: '/v1/webhooks/subscribe', blocked: true,  time: '34 min ago' },
  { type: 'XSS Payload',             severity: 'high',    source: '88.214.25.18',  target: '/v1/documents/upload',   blocked: true,  time: '48 min ago' },
  { type: 'DDoS Burst',              severity: 'critical',source: 'Botnet 184 IPs',target: '/v1/analytics/kpis',     blocked: true,  time: '1 hr ago'   },
  { type: 'Insider Anomaly',         severity: 'medium',  source: 'sanjay.nair@',  target: 'Bulk export customers',  blocked: false, time: '2 hr ago'   },
];

export interface AuditLogEntry {
  actor: string;
  action: string;
  resource: string;
  ip: string;
  result: 'success' | 'denied' | 'warning';
  time: string;
}

export const AUDIT_LOGS: AuditLogEntry[] = [
  { actor: 'arjun.sharma@acme.com',  action: 'API key created',    resource: 'key_006',          ip: '203.0.113.42',  result: 'success', time: '4 min ago'  },
  { actor: 'meera.iyer@acme.com',    action: 'Role escalated',     resource: 'org_admin',        ip: '198.51.100.18', result: 'warning', time: '12 min ago' },
  { actor: 'raj.khan@acme.com',      action: 'Bulk export',        resource: 'customers.csv',    ip: '192.0.2.88',    result: 'success', time: '18 min ago' },
  { actor: 'priya.reddy@acme.com',   action: 'Webhook added',      resource: 'wh_007',           ip: '203.0.113.99',  result: 'success', time: '24 min ago' },
  { actor: 'unknown@',               action: 'Login attempt',      resource: '/auth/login',      ip: '45.83.12.4',    result: 'denied',  time: '28 min ago' },
  { actor: 'sanjay.nair@acme.com',   action: 'Policy modified',    resource: 'rate_limit_v2',    ip: '198.51.100.62', result: 'success', time: '42 min ago' },
  { actor: 'kavya.patel@acme.com',   action: 'SSO config changed', resource: 'sso_azure_ad',     ip: '91.243.85.12',   result: 'warning', time: '1 hr ago'   },
  { actor: 'vikram.joshi@acme.com',  action: 'Key rotated',        resource: 'key_001',          ip: '203.0.113.140', result: 'success', time: '2 hr ago'   },
];

export interface ComplianceCert {
  name: string;
  standard: string;
  status: 'certified' | 'in-progress' | 'planned';
  lastAudit: string;
  nextAudit: string;
  accent: Accent;
}

export const COMPLIANCE_CERTS: ComplianceCert[] = [
  { name: 'SOC 2 Type II',          standard: 'AICPA',      status: 'certified',   lastAudit: '2025-08-14', nextAudit: '2026-08-14', accent: 'emerald' },
  { name: 'ISO 27001:2022',         standard: 'ISO/IEC',    status: 'certified',   lastAudit: '2025-06-22', nextAudit: '2026-06-22', accent: 'teal'    },
  { name: 'PCI DSS Level 1',        standard: 'PCI SSC',    status: 'certified',   lastAudit: '2025-09-01', nextAudit: '2026-09-01', accent: 'cyan'    },
  { name: 'GDPR',                   standard: 'EU',         status: 'certified',   lastAudit: '2025-04-18', nextAudit: '2026-04-18', accent: 'violet'  },
  { name: 'HIPAA',                  standard: 'HHS',        status: 'certified',   lastAudit: '2025-07-10', nextAudit: '2026-07-10', accent: 'amber'   },
  { name: 'FedRAMP Moderate',       standard: 'GSA',        status: 'in-progress', lastAudit: '—',          nextAudit: '2026-03-01', accent: 'rose'    },
  { name: 'ISO 27018 (PII)',        standard: 'ISO/IEC',    status: 'certified',   lastAudit: '2025-06-22', nextAudit: '2026-06-22', accent: 'emerald' },
  { name: 'IRIS (GST System)',      standard: 'GSTN',       status: 'certified',   lastAudit: '2025-10-02', nextAudit: '2026-10-02', accent: 'teal'    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 14. GLOBAL FINANCIAL NETWORK — org-to-org connections, shared resources
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrgConnection {
  name: string;
  type: 'Customer' | 'Vendor' | 'Partner' | 'Bank' | 'Government';
  gstin: string;
  sharedDocs: number;
  sharedInvoices: number;
  sharedPayments: number;
  status: 'active' | 'pending' | 'invited';
  accent: Accent;
}

export const ORG_CONNECTIONS: OrgConnection[] = [
  { name: 'Tata Consultancy Services', type: 'Customer',  gstin: '27AAACT1234F1Z5', sharedDocs: 184, sharedInvoices: 412, sharedPayments: 248, status: 'active',   accent: 'emerald' },
  { name: 'Reliance Retail',           type: 'Vendor',    gstin: '27AAACR5055K1Z5', sharedDocs:  92, sharedInvoices: 284, sharedPayments: 184, status: 'active',   accent: 'teal'    },
  { name: 'Infosys Limited',           type: 'Partner',   gstin: '29AAACI4798L1Z6', sharedDocs:  64, sharedInvoices: 142, sharedPayments:  96, status: 'active',   accent: 'cyan'    },
  { name: 'HDFC Bank',                 type: 'Bank',      gstin: '67AAACH2702H1Z4', sharedDocs:  42, sharedInvoices:   0, sharedPayments: 624, status: 'active',   accent: 'violet'  },
  { name: 'GST Network',               type: 'Government',gstin: 'GOVT_GSTN_001',   sharedDocs:  18, sharedInvoices:   0, sharedPayments:   0, status: 'active',   accent: 'amber'   },
  { name: 'Adani Group',               type: 'Customer',  gstin: '24AAACA1091L1Z8', sharedDocs:  48, sharedInvoices:  96, sharedPayments:  62, status: 'active',   accent: 'rose'    },
  { name: 'Wipro Technologies',        type: 'Vendor',    gstin: '29AAACW5698E1Z4', sharedDocs:  38, sharedInvoices: 124, sharedPayments:  82, status: 'pending',  accent: 'emerald' },
  { name: 'Bharti Airtel',             type: 'Partner',   gstin: '04AABCB5556N1Z5', sharedDocs:  24, sharedInvoices:  62, sharedPayments:  44, status: 'invited',  accent: 'teal'    },
];

export interface SharedResource {
  type: 'Invoice' | 'PO' | 'Payment' | 'Approval' | 'Document' | 'Vendor Collab' | 'Customer Collab';
  counterparty: string;
  amount: number;
  status: string;
  updated: string;
  accent: Accent;
}

export const SHARED_RESOURCES: SharedResource[] = [
  { type: 'Invoice',         counterparty: 'Tata Consultancy', amount:  840_000, status: 'Sent — awaiting acceptance', updated: '2 hr ago',   accent: 'emerald' },
  { type: 'PO',              counterparty: 'Reliance Retail',  amount:  420_000, status: 'Accepted',                  updated: '4 hr ago',   accent: 'teal'    },
  { type: 'Payment',         counterparty: 'HDFC Bank',        amount:  624_000, status: 'Cleared',                   updated: '12 min ago', accent: 'cyan'    },
  { type: 'Approval',        counterparty: 'Infosys Limited',  amount:  184_000, status: 'Pending CFO sign-off',      updated: '18 min ago', accent: 'violet'  },
  { type: 'Document',        counterparty: 'Adani Group',      amount:        0, status: 'Shared — GST registration', updated: '1 day ago',  accent: 'amber'   },
  { type: 'Vendor Collab',   counterparty: 'Wipro Technologies', amount:     0, status: 'KYC pending',               updated: '2 days ago', accent: 'rose'    },
  { type: 'Customer Collab', counterparty: 'Bharti Airtel',    amount:        0, status: 'Invitation sent',           updated: '3 days ago', accent: 'emerald' },
  { type: 'Invoice',         counterparty: 'Tata Consultancy', amount:  184_000, status: 'Accepted',                  updated: '6 hr ago',   accent: 'teal'    },
];

export interface NetworkMetric {
  label: string;
  value: string;
  trend: number;
  accent: Accent;
}

export const NETWORK_KPIS: NetworkMetric[] = [
  { label: 'Connected Orgs',         value: '4.82M',    trend: +18.4, accent: 'emerald' },
  { label: 'Shared Invoices (30d)',  value: '184M',     trend: +22.8, accent: 'teal'    },
  { label: 'Shared Payments (30d)',  value: '92M',      trend: +14.6, accent: 'cyan'    },
  { label: 'Avg Acceptance Time',    value: '4.2 hrs',  trend: -12.4, accent: 'violet'  },
  { label: 'Network GMV (30d)',      value: '$48.4B',   trend: +28.6, accent: 'amber'   },
  { label: 'Dispute Resolution SLA', value: '98.6%',    trend:  +2.4, accent: 'rose'    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 15. PLATFORM INTELLIGENCE — AI monitors across 6 dimensions
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceDimension {
  dimension: string;
  score: number;
  status: 'optimal' | 'healthy' | 'watch' | 'action';
  actions24h: number;
  savings: number;
  accent: Accent;
  insight: string;
}

export const INTELLIGENCE_DIMENSIONS: IntelligenceDimension[] = [
  { dimension: 'Performance',  score: 96, status: 'optimal', actions24h: 184, savings:   82_400, accent: 'emerald', insight: 'Auto-scaled 142 instances during peak — p95 stable at 124ms' },
  { dimension: 'Scaling',      score: 98, status: 'optimal', actions24h:  84, savings:  142_000, accent: 'teal',    insight: 'Predictive scaling correctly handled 4.8x traffic spike at 14:00 IST' },
  { dimension: 'Security',     score: 94, status: 'healthy', actions24h: 248, savings:        0, accent: 'cyan',    insight: 'Blocked 8,420 threats; 1 insider anomaly flagged for review' },
  { dimension: 'Costs',        score: 91, status: 'healthy', actions24h:  62, savings:  624_000, accent: 'violet',  insight: 'Right-sized 184 over-provisioned instances — saved $624K MTD' },
  { dimension: 'Reliability',  score: 99, status: 'optimal', actions24h:  12, savings:        0, accent: 'amber',   insight: '12 multi-AZ failovers with zero customer impact; uptime 99.992%' },
  { dimension: 'Developer Experience', score: 93, status: 'healthy', actions24h:  48, savings: 0, accent: 'rose',   insight: 'Auto-suggested 184 doc improvements; SDK adoption +18.4% MoM' },
];

export interface AIAction {
  dimension: string;
  action: string;
  impact: string;
  confidence: number;
  auto: boolean;
  time: string;
}

export const AI_ACTIONS: AIAction[] = [
  { dimension: 'Performance',  action: 'Scaled ASG ap-south-1 from 42 → 184 instances', impact: 'p95 stable through 6.2M rps peak',       confidence: 98, auto: true,  time: '2 hr ago'  },
  { dimension: 'Scaling',      action: 'Pre-warmed 142 edge cache nodes for Diwali spike',impact: 'Zero cold-start latency for 4.8M users', confidence: 96, auto: true,  time: '4 hr ago'  },
  { dimension: 'Security',     action: 'Blocked 8,420-IP botnet credential stuffing',    impact: 'Prevented 184 account takeovers',         confidence: 99, auto: true,  time: '6 hr ago'  },
  { dimension: 'Costs',        action: 'Right-sized 184 over-provisioned RDS instances', impact: 'Saved $624K MTD, zero perf regression',   confidence: 94, auto: true,  time: '8 hr ago'  },
  { dimension: 'Reliability',  action: 'Multi-AZ failover eu-central-1 (degraded AZ)',   impact: 'Zero customer impact, 12s recovery',     confidence: 99, auto: true,  time: '12 hr ago' },
  { dimension: 'Developer Experience', action: 'Suggested 184 doc clarifications via Oracle™', impact: 'Helpfulness score +3.2 pts',     confidence: 88, auto: false, time: '18 hr ago' },
  { dimension: 'Performance',  action: 'Compacted Kafka topic invoices.created',          impact: 'Consumer lag reduced 84%',                confidence: 96, auto: true,  time: '1 day ago' },
  { dimension: 'Costs',        action: 'Migrated 4.2TB cold data to Glacier',             impact: 'Storage cost −$42K/mo',                   confidence: 92, auto: true,  time: '2 days ago'},
];

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 16 HUB NAVIGATION — 15 cards
// ═══════════════════════════════════════════════════════════════════════════════

export interface Phase16Module {
  id: string;
  number: number;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  accent: Accent;
  stats: { label: string; value: string }[];
}

export const PHASE16_MODULES: Phase16Module[] = [
  { id: 'developer-platform',         number: 1,  name: 'Developer Platform™',           tagline: 'REST · GraphQL · Webhooks · SDKs · CLI · OAuth · Playground · Sandbox · Docs', description: 'A complete developer ecosystem with first-class tooling across 8 languages, real-time webhooks, OAuth providers, sandbox environments and a built-in API playground.', icon: 'code-2',           accent: 'emerald', stats: [{ label: 'APIs', value: '540+' }, { label: 'SDKs', value: '8' }, { label: 'Developers', value: '2.4M' }] },
  { id: 'enterprise-api-gateway',     number: 2,  name: 'Enterprise API Gateway™',       tagline: 'GST · Invoices · Accounting · ERP · CRM · HR · Payroll · Inventory · Analytics · Banking · AI · Compliance · Documents', description: 'Thirteen secure, versioned, rate-limited service APIs covering every GSTPilot domain with sub-200ms p95 latency.', icon: 'network',          accent: 'teal',    stats: [{ label: 'Services', value: '13' }, { label: 'Endpoints', value: '478' }, { label: 'Calls/24h', value: '48.4B' }] },
  { id: 'app-marketplace-cloud',      number: 3,  name: 'App Marketplace™',              tagline: 'Apps · Extensions · Plugins · AI Skills · ERP Connectors · Industry Templates · Automation Packs', description: 'A thriving marketplace where developers publish, monetize and distribute apps to 184,000 enterprises worldwide.', icon: 'store',            accent: 'cyan',    stats: [{ label: 'Apps', value: '4,820' }, { label: 'Installs', value: '6.6M' }, { label: 'Publishers', value: '1,240' }] },
  { id: 'global-integration-hub',     number: 4,  name: 'Global Integration Hub™',       tagline: 'SAP · Oracle · Dynamics · Zoho · Tally · QuickBooks · Xero · Salesforce · HubSpot · Slack · Teams · WhatsApp · Stripe · Razorpay · PayPal · Bank APIs · Gov APIs', description: '23 native, two-way integrations across ERP, CRM, payments, banking, communication, productivity and government systems.', icon: 'plug',             accent: 'violet',  stats: [{ label: 'Integrations', value: '23' }, { label: 'Connected', value: '20' }, { label: 'Records synced', value: '3.4M' }] },
  { id: 'financial-data-cloud',       number: 5,  name: 'Financial Data Cloud™',         tagline: 'Invoices · GST · Accounting · Banking · Inventory · Payroll · Compliance · Customers · Vendors · Documents · Analytics', description: 'A unified financial data layer that synchronizes 11 domains in real-time across every connected system.', icon: 'database',         accent: 'amber',   stats: [{ label: 'Domains', value: '11' }, { label: 'Records', value: '1.1B' }, { label: 'Storage', value: '15.4 TB' }] },
  { id: 'event-streaming',            number: 6,  name: 'Event Streaming Platform™',     tagline: 'Invoice Created · Payment Received · GST Filed · Expense Added · Bank Synced · AI Action · Document Uploaded · Approval Granted · Webhook Delivery', description: 'Real-time event bus delivering 17M+ events per day with 18ms p99 latency and 7-year retention for compliance.', icon: 'radio',            accent: 'rose',    stats: [{ label: 'Event types', value: '9' }, { label: 'Daily volume', value: '17.3M' }, { label: 'p99 latency', value: '18ms' }] },
  { id: 'automation-studio',          number: 7,  name: 'Enterprise Automation Studio™', tagline: 'Triggers · Conditions · Actions · AI Nodes · API Nodes · Webhooks · Schedules', description: 'Visual drag-and-drop workflow builder with 13 node types and 184 ready-made templates across every business process.', icon: 'workflow',         accent: 'emerald', stats: [{ label: 'Templates', value: '184' }, { label: 'Node types', value: '13' }, { label: 'Runs/24h', value: '1.8M' }] },
  { id: 'data-warehouse',             number: 8,  name: 'Enterprise Data Warehouse™',    tagline: 'Realtime · Historical · Custom SQL · BI · AI Queries · Data Lake', description: 'Petabyte-scale analytics warehouse with 8 fact/dim tables, saved SQL queries, BI dashboards and natural-language AI queries.', icon: 'bar-chart-3',      accent: 'teal',    stats: [{ label: 'Datasets', value: '8' }, { label: 'Rows', value: '1.6B' }, { label: 'Queries/24h', value: '1.9M' }] },
  { id: 'global-identity',            number: 9,  name: 'Global Identity Platform™',     tagline: 'SSO · OAuth · SAML · Azure AD · Google · Microsoft · MFA · Passwordless', description: 'Enterprise identity layer with 6 SSO connections, 5 MFA methods and WebAuthn-based passwordless login.', icon: 'fingerprint',      accent: 'cyan',    stats: [{ label: 'SSO providers', value: '6' }, { label: 'MFA methods', value: '5' }, { label: 'Users', value: '12.4K' }] },
  { id: 'developer-analytics',        number: 10, name: 'Developer Analytics™',          tagline: 'API Usage · Errors · Latency · Revenue · Apps · Downloads · Subscriptions · Usage Trends', description: 'Real-time analytics dashboard for developers to monitor API usage, errors, latency, revenue and app performance.', icon: 'activity',         accent: 'violet',  stats: [{ label: 'Calls/24h', value: '42.8M' }, { label: 'Error rate', value: '0.04%' }, { label: 'P95', value: '124ms' }] },
  { id: 'enterprise-billing',         number: 11, name: 'Enterprise Billing Platform™',  tagline: 'Subscriptions · Usage Billing · Marketplace Revenue · Partner Revenue · API Billing · Developer Billing · Enterprise Contracts', description: 'Unified billing engine handling subscriptions, metered usage, marketplace revenue-share and multi-year enterprise contracts.', icon: 'credit-card',      accent: 'amber',   stats: [{ label: 'MRR', value: '$24.6M' }, { label: 'Customers', value: '349K' }, { label: 'ARR', value: '$295M' }] },
  { id: 'multi-tenant-infra',         number: 12, name: 'Multi-Tenant Cloud Infra™',     tagline: 'Millions of Orgs · Billions of API calls · Global regions · Auto Scaling · Load Balancing · Edge · CDN · HA', description: 'Globally distributed multi-tenant infrastructure across 10 regions, 142 edge POPs and 99.992% uptime SLA.', icon: 'server',           accent: 'rose',    stats: [{ label: 'Regions', value: '10' }, { label: 'Edge POPs', value: '142' }, { label: 'Uptime', value: '99.992%' }] },
  { id: 'enterprise-security-cloud',  number: 13, name: 'Enterprise Security™',          tagline: 'API Security · Zero Trust · Encryption · Secrets · Rate Limiting · Threat Detection · Audit Trails · Compliance', description: 'Defense-in-depth security with Zero Trust posture, 8 compliance certifications and AI-powered threat detection.', icon: 'shield-check',     accent: 'emerald', stats: [{ label: 'Controls', value: '170' }, { label: 'Threats blocked/24h', value: '8.4K' }, { label: 'Certs', value: '8' }] },
  { id: 'global-financial-network',   number: 14, name: 'Global Financial Network™',     tagline: 'Invoices · POs · Payments · Approvals · Documents · Vendor Collab · Customer Collab', description: 'A secure network where 4.82M organizations transact directly — sharing invoices, payments, approvals and documents.', icon: 'share-2',          accent: 'teal',    stats: [{ label: 'Connected orgs', value: '4.82M' }, { label: 'Network GMV', value: '$48.4B' }, { label: 'Shared docs', value: '184M' }] },
  { id: 'platform-intelligence',      number: 15, name: 'Platform Intelligence™',        tagline: 'Performance · Scaling · Security · Costs · Reliability · Developer Experience', description: 'An always-on AI that monitors the entire platform across 6 dimensions and takes autonomous corrective action.', icon: 'brain-circuit',    accent: 'cyan',    stats: [{ label: 'Dimensions', value: '6' }, { label: 'Actions/24h', value: '640' }, { label: 'Cost saved MTD', value: '$848K' }] },
];

// ─── Aggregated Phase 16 Hero KPIs ────────────────────────────────────────────
export const PHASE16_HERO_KPIS = [
  { label: 'Developers',         value: '2.4M',   sub: 'Across 184 countries',           accent: 'emerald' as Accent },
  { label: 'API Calls (24h)',    value: '48.4B',  sub: 'Peak 6.2M req/sec',              accent: 'teal'    as Accent },
  { label: 'Apps Published',     value: '4,820',  sub: 'From 1,240 publishers',          accent: 'cyan'    as Accent },
  { label: 'Connected Orgs',     value: '4.82M',  sub: 'On the Global Financial Network',accent: 'violet'  as Accent },
  { label: 'Annual API Revenue', value: '$4.82B', sub: 'Growing 22.8% YoY',              accent: 'amber'   as Accent },
  { label: 'Platform Uptime',    value: '99.992%',sub: 'SLA: 99.99% across 10 regions',  accent: 'rose'    as Accent },
];
