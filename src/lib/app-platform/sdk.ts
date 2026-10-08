// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Global AI App Marketplace™ — Extension SDK
// Developer SDK metadata: languages, templates, CLI, emulator, packaging, publishing.
// ═══════════════════════════════════════════════════════════════════════════════

import type { AppType, ExtensionSDKInfo } from './types';

/** Current Extension SDK info — returned by GET /api/app-platform/sdk. */
export const EXTENSION_SDK: ExtensionSDKInfo = {
  version: '3.2.0',
  languages: [
    { key: 'react', name: 'React', logo: '⚛️', minVersion: '18.0' },
    { key: 'typescript', name: 'TypeScript', logo: '📘', minVersion: '5.0' },
    { key: 'node', name: 'Node.js', logo: '🟢', minVersion: '20.0' },
    { key: 'rest', name: 'REST', logo: '🌐', minVersion: '1.0' },
    { key: 'graphql', name: 'GraphQL', logo: '◈', minVersion: '16.0' },
    { key: 'webhooks', name: 'Webhooks', logo: '🔗', minVersion: '1.0' },
  ],
  templates: [
    { key: 'native-app', name: 'Native App', description: 'Full-featured app with UI, backend, and database', type: 'native' },
    { key: 'ai-app', name: 'AI App', description: 'AI-powered app with model access and Oracle integration', type: 'ai' },
    { key: 'industry-module', name: 'Industry Module', description: 'Industry-specific solution (manufacturing, retail, healthcare...)', type: 'industry' },
    { key: 'dashboard', name: 'Dashboard', description: 'Custom dashboard with widgets and charts', type: 'dashboard' },
    { key: 'widget', name: 'Widget', description: 'Reusable UI widget for embedding', type: 'widget' },
    { key: 'ai-employee', name: 'AI Employee', description: 'Specialized AI worker for a specific domain', type: 'ai_employee' },
    { key: 'report-template', name: 'Report Template', description: 'Custom report with scheduling and export', type: 'report' },
    { key: 'connector', name: 'Connector', description: 'Third-party data connector with sync engine', type: 'connector' },
    { key: 'automation', name: 'Automation', description: 'Automated workflow with triggers and actions', type: 'automation' },
    { key: 'api-extension', name: 'API Extension', description: 'Public API extension with OpenAPI spec', type: 'api' },
    { key: 'custom-page', name: 'Custom Page', description: 'Custom page in the workspace', type: 'custom_page' },
  ],
  cliVersion: '3.2.0',
  cliCommands: [
    { command: 'gstpilot init <template>', description: 'Scaffold a new app from a template' },
    { command: 'gstpilot dev', description: 'Start local development with live reload' },
    { command: 'gstpilot test', description: 'Run unit + integration tests' },
    { command: 'gstpilot emulate', description: 'Start local emulator with mock data' },
    { command: 'gstpilot package', description: 'Package app for publishing' },
    { command: 'gstpilot publish', description: 'Publish app to the marketplace' },
    { command: 'gstpilot version <bump>', description: 'Bump version (patch/minor/major)' },
    { command: 'gstpilot deploy', description: 'Deploy app to production' },
    { command: 'gstpilot logs', description: 'Stream production logs' },
    { command: 'gstpilot rollback <version>', description: 'Rollback to a previous version' },
  ],
  emulatorEnabled: true,
  packagingEnabled: true,
  publishingEnabled: true,
  liveReloadEnabled: true,
  documentationUrl: 'https://developers.gstpilot.com/sdk/v3',
  testingFrameworks: ['Jest', 'Vitest', 'Playwright', 'Testing Library', 'MSW'],
};

/** Get the SDK template recommendation for an app type. */
export function getTemplateForAppType(type: AppType): string {
  const map: Record<AppType, string> = {
    native: 'native-app',
    ai: 'ai-app',
    industry: 'industry-module',
    dashboard: 'dashboard',
    widget: 'widget',
    ai_employee: 'ai-employee',
    report: 'report-template',
    connector: 'connector',
    automation: 'automation',
    api: 'api-extension',
    custom_page: 'custom-page',
  };
  return map[type] ?? 'native-app';
}
