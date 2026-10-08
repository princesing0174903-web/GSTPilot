// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Global AI App Marketplace™ — AI App Builder™
// Oracle™ can generate apps automatically from natural language.
// Build CRM Extension · Create Invoice Dashboard · Generate HR Workflow
// Create AI Employee · Generate Reports · Create Automation · Deploy App · Publish App
// ═══════════════════════════════════════════════════════════════════════════════

import type { AIAppBuilderIntent, AppCategory, AppPermission, AppType, GeneratedAppSpec } from './types';
import { getTemplateForAppType } from './sdk';

/** Intent templates — maps natural language to app specs. */
const BUILDER_INTENTS: { pattern: RegExp; appType: AppType; category: AppCategory; action: string; description: string; suggestedName: string; permissions: AppPermission[] }[] = [
  {
    pattern: /build.*crm.*extension|create.*crm.*extension|crm.*plugin/i,
    appType: 'native', category: 'crm', action: 'build_crm_extension',
    description: 'Build a CRM extension app with custom fields, workflows, and dashboards.',
    suggestedName: 'Custom CRM Extension',
    permissions: ['read:crm', 'write:crm', 'read:reports'],
  },
  {
    pattern: /create.*invoice.*dashboard|invoice.*dashboard|build.*invoice.*dashboard/i,
    appType: 'dashboard', category: 'finance', action: 'create_invoice_dashboard',
    description: 'Create an invoice analytics dashboard with charts, KPIs, and filters.',
    suggestedName: 'Invoice Analytics Dashboard',
    permissions: ['read:invoices', 'read:reports'],
  },
  {
    pattern: /generate.*hr.*workflow|hr.*workflow|create.*hr.*automation/i,
    appType: 'automation', category: 'hr', action: 'generate_hr_workflow',
    description: 'Generate an HR workflow for onboarding, leave approval, or payroll.',
    suggestedName: 'HR Workflow Automation',
    permissions: ['read:automation', 'write:automation', 'read:notifications'],
  },
  {
    pattern: /create.*ai.*employee|generate.*ai.*employee|new.*ai.*worker/i,
    appType: 'ai_employee', category: 'ai_tools', action: 'create_ai_employee',
    description: 'Create a specialized AI employee for a specific business domain.',
    suggestedName: 'Custom AI Employee',
    permissions: ['access:ai', 'access:ai_workforce', 'read:reports'],
  },
  {
    pattern: /generate.*report|create.*report|build.*report/i,
    appType: 'report', category: 'analytics', action: 'generate_reports',
    description: 'Generate a custom report template with scheduling and export.',
    suggestedName: 'Custom Report Template',
    permissions: ['read:reports', 'write:reports'],
  },
  {
    pattern: /create.*automation|build.*automation|generate.*automation/i,
    appType: 'automation', category: 'productivity', action: 'create_automation',
    description: 'Create an automation workflow with triggers and actions.',
    suggestedName: 'Custom Automation',
    permissions: ['read:automation', 'write:automation', 'read:notifications'],
  },
  {
    pattern: /build.*finance.*app|finance.*application|create.*finance.*app/i,
    appType: 'native', category: 'finance', action: 'build_finance_app',
    description: 'Build a finance app with budgeting, forecasting, and reporting.',
    suggestedName: 'Finance Manager',
    permissions: ['read:banking', 'read:invoices', 'read:reports', 'access:ai_cfo'],
  },
  {
    pattern: /create.*widget|build.*widget|custom.*widget/i,
    appType: 'widget', category: 'productivity', action: 'create_widget',
    description: 'Create a reusable UI widget for embedding in dashboards.',
    suggestedName: 'Custom Widget',
    permissions: ['read:reports'],
  },
  {
    pattern: /build.*connector|create.*connector|integration.*app/i,
    appType: 'connector', category: 'developer_tools', action: 'build_connector',
    description: 'Build a data connector for a third-party service.',
    suggestedName: 'Custom Connector',
    permissions: ['access:marketplace', 'read:invoices'],
  },
  {
    pattern: /deploy.*app|publish.*app|ship.*app/i,
    appType: 'native', category: 'productivity', action: 'deploy_app',
    description: 'Deploy and publish an app to the VEYRO marketplace.',
    suggestedName: 'Deployed App',
    permissions: ['publish:apps'],
  },
];

/** Parse a natural-language command into an app builder intent. */
export function parseAppBuilderIntent(command: string): AIAppBuilderIntent {
  for (const intent of BUILDER_INTENTS) {
    if (intent.pattern.test(command)) {
      return {
        matched: true,
        appType: intent.appType,
        category: intent.category,
        action: intent.action,
        description: intent.description,
        suggestedName: intent.suggestedName,
        suggestedPermissions: intent.permissions,
        confidence: 0.92,
      };
    }
  }
  return {
    matched: false, appType: null, category: null, action: 'unknown',
    description: 'Could not match the command to a known app builder intent.',
    suggestedName: '', suggestedPermissions: [], confidence: 0,
  };
}

/** Generate a full app specification from an intent (Oracle AI App Builder). */
export function generateAppSpec(intent: AIAppBuilderIntent): GeneratedAppSpec {
  if (!intent.matched || !intent.appType || !intent.category) {
    return {
      name: '', slug: '', type: 'native', category: 'productivity',
      tagline: '', description: '', permissions: [], extensionPoints: [],
      pricingModel: 'free', priceAmount: 0, features: [],
      estimatedBuildTimeMin: 0, sdkTemplate: 'native-app', ready: false,
    };
  }

  const slug = intent.suggestedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const features = generateFeaturesForType(intent.appType, intent.category);
  const extensionPoints = generateExtensionPointsForType(intent.appType);

  return {
    name: intent.suggestedName,
    slug,
    type: intent.appType,
    category: intent.category,
    tagline: `AI-generated ${intent.appType.replace('_', ' ')} for ${intent.category.replace('_', ' ')}`,
    description: intent.description,
    permissions: intent.suggestedPermissions,
    extensionPoints,
    pricingModel: intent.appType === 'ai_employee' ? 'subscription' : 'free',
    priceAmount: intent.appType === 'ai_employee' ? 999 : 0,
    features,
    estimatedBuildTimeMin: estimateBuildTime(intent.appType),
    sdkTemplate: getTemplateForAppType(intent.appType),
    ready: true,
  };
}

/** Generate feature list based on app type + category. */
function generateFeaturesForType(type: AppType, category: AppCategory): string[] {
  const base: Record<AppType, string[]> = {
    native: ['Full UI', 'Backend API', 'Database schema', 'Authentication', 'Permissions'],
    ai: ['AI model access', 'Oracle integration', 'Custom prompts', 'Training data', 'Inference API'],
    industry: ['Industry workflows', 'Compliance rules', 'Domain templates', 'Reports', 'Integrations'],
    dashboard: ['Drag-and-drop builder', '30+ chart types', 'Real-time data', 'Filters', 'Export'],
    widget: ['Embeddable widget', 'Configurable props', 'Theme support', 'Event handlers'],
    ai_employee: ['Specialized AI worker', 'Auto-connect engines', 'Task automation', 'Performance metrics', '24/7 operation'],
    report: ['Report template', 'Scheduling', 'Export (PDF/Excel)', 'Parameters', 'Distribution'],
    connector: ['OAuth authentication', 'Sync engine', 'Webhook support', 'Error handling', 'Rate limiting'],
    automation: ['Trigger builder', 'Action library', 'Conditions', 'Scheduling', 'Logs'],
    api: ['OpenAPI spec', 'Auth (OAuth/API Key)', 'Rate limiting', 'Versioning', 'SDK generation'],
    custom_page: ['Custom page', 'Routing', 'Components', 'Data fetching'],
  };
  const categoryBonus: Partial<Record<AppCategory, string[]>> = {
    finance: ['Bank integration', 'GST compliance', 'Financial reports'],
    crm: ['Lead management', 'Deal tracking', 'Contact sync'],
    hr: ['Employee management', 'Payroll', 'Attendance'],
    manufacturing: ['Production planning', 'Inventory', 'Quality control'],
    healthcare: ['Patient management', 'HIPAA compliance', 'Insurance claims'],
  };
  return [...(base[type] ?? []), ...(categoryBonus[category] ?? [])];
}

/** Generate extension points based on app type. */
function generateExtensionPointsForType(type: AppType): GeneratedAppSpec['extensionPoints'] {
  const map: Record<AppType, GeneratedAppSpec['extensionPoints']> = {
    native: ['navigation', 'dashboard', 'widget', 'page', 'settings'],
    ai: ['command', 'automation', 'notification'],
    industry: ['navigation', 'dashboard', 'report', 'page'],
    dashboard: ['dashboard', 'widget'],
    widget: ['widget'],
    ai_employee: ['ai_agent', 'command', 'automation'],
    report: ['report'],
    connector: ['automation'],
    automation: ['automation', 'notification'],
    api: [],
    custom_page: ['page', 'navigation'],
  };
  return map[type] ?? [];
}

/** Estimate build time in minutes based on app type. */
function estimateBuildTime(type: AppType): number {
  const times: Record<AppType, number> = {
    native: 45, ai: 30, industry: 60, dashboard: 20, widget: 10,
    ai_employee: 40, report: 15, connector: 35, automation: 20, api: 25, custom_page: 15,
  };
  return times[type] ?? 30;
}

/** Build the Oracle context block for the App Platform.
 *  Tells Oracle which apps are installed, recent installs/uninstalls, and that
 *  it can generate apps via the AI App Builder™. */
export async function buildOracleAppPlatformContext(tenantId?: string): Promise<string> {
  try {
    const { resolveDefaultTenantId, listInstalledApps } = await import('./registry');
    const { getPlatformAnalytics } = await import('./analytics');
    const tid = tenantId ?? (await resolveDefaultTenantId());

    const [installs, analytics] = await Promise.all([
      listInstalledApps(tid),
      getPlatformAnalytics(),
    ]);

    const installedList = installs.slice(0, 12).map((i) => `${i.appName} v${i.version} (${i.status})`).join(', ');
    const topApps = analytics.topApps.slice(0, 5).map((a) => `${a.name} (${a.installs} installs)`).join(', ');

    return `## VEYRO Global AI App Marketplace™ (Ecosystem Platform)
You are connected to the Global AI App Marketplace — a platform where developers build, publish, and install AI-powered applications.

### APP PLATFORM STATE (LIVE)
- Total Published Apps: ${analytics.byType.reduce((s, t) => s + t.count, 0)}
- Active Installs (this tenant): ${installs.length}
- Platform Installs (all-time): ${analytics.totalInstalls}
- Platform Revenue: ₹${analytics.totalRevenue.toLocaleString('en-IN')}
- Avg Rating: ${analytics.avgRating}/5
- Top Apps: ${topApps || 'none yet'}

### INSTALLED APPS (this tenant)
${installs.length > 0 ? installedList : 'No apps installed yet.'}

### AI APP BUILDER™ CAPABILITIES
You can generate apps automatically from natural language. When the user asks to "build a CRM extension", "create an invoice dashboard", "generate an HR workflow", "create an AI employee", "generate a report", "create an automation", "deploy an app", or "publish an app", parse the intent and generate an app specification.

### WHEN THE USER ASKS
- "Which apps are installed?" → use INSTALLED APPS list above.
- "What are the most popular apps?" → use Top Apps.
- "Build/create/generate an app" → parse intent with AI App Builder™ and present the generated app spec.
- "Install app <slug>" → instruct the user to use the App Store tab.
- "Publish my app" → guide through the Developer Portal.

Never fabricate app names, install counts, or revenue. Use only the LIVE data above.`;
  } catch {
    return '';
  }
}
