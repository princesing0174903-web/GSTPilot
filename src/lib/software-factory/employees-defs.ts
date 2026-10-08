// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI SOFTWARE FACTORY™ — Employee Roster (Prisma-free static defs)
// ═══════════════════════════════════════════════════════════════════════════════
// Static definitions for the 10 specialist AI dev employees + the pipeline
// ordering. This module has ZERO Prisma imports so it can be safely imported
// by client components. The Prisma-backed metric aggregation
// (`loadDevEmployees`) lives in `./employees` (server-only).
// ═══════════════════════════════════════════════════════════════════════════════

import type { DevEmployeeId, LifecycleStage } from './types';

// ─── Employee Roster (static definitions) ────────────────────────────────────

export interface EmployeeDef {
  id: DevEmployeeId;
  name: string;
  role: string;
  specialty: string;
  icon: string;
  stage: LifecycleStage;
  responsibilities: string[];
  deliverables: string[];
}

export const DEV_EMPLOYEE_DEFS: EmployeeDef[] = [
  {
    id: 'ai_product_manager',
    name: 'AI Product Manager™',
    role: 'Product Manager',
    specialty: 'Requirements · Roadmap · User Stories',
    icon: '📋',
    stage: 'requirements',
    responsibilities: [
      'Translate natural-language prompts into product requirements',
      'Define functional & non-functional requirements',
      'Author user stories and acceptance criteria',
      'Prioritise backlog and sprint scope',
    ],
    deliverables: ['Requirements document', 'User stories', 'Product roadmap', 'Acceptance criteria'],
  },
  {
    id: 'ai_solution_architect',
    name: 'AI Solution Architect™',
    role: 'Solution Architect',
    specialty: 'System Design · Architecture · Tech Stack',
    icon: '🏗️',
    stage: 'architecture',
    responsibilities: [
      'Design end-to-end system architecture',
      'Select technology stack aligned to VEYRO standards',
      'Define service boundaries and data flow',
      'Ensure scalability, security, and maintainability',
    ],
    deliverables: ['Architecture diagram', 'Service map', 'Tech-stack decision', 'ADR records'],
  },
  {
    id: 'ai_ux_designer',
    name: 'AI UX Designer™',
    role: 'UX Designer',
    specialty: 'Wireframes · Flows · Accessibility',
    icon: '🎨',
    stage: 'design',
    responsibilities: [
      'Design page layouts and component hierarchy',
      'Map user flows and navigation',
      'Ensure WCAG 2.2 AA accessibility',
      'Apply VEYRO design system',
    ],
    deliverables: ['Wireframes', 'Page specs', 'Component list', 'Design tokens'],
  },
  {
    id: 'ai_frontend_engineer',
    name: 'AI Frontend Engineer™',
    role: 'Frontend Engineer',
    specialty: 'React · Next.js · TypeScript',
    icon: '⚛️',
    stage: 'development',
    responsibilities: [
      'Generate React / Next.js / TypeScript pages',
      'Build reusable shadcn/ui-based components',
      'Wire client state with Zustand / TanStack Query',
      'Implement responsive, accessible UI',
    ],
    deliverables: ['Page components', 'UI components', 'Client hooks', 'Theme config'],
  },
  {
    id: 'ai_backend_engineer',
    name: 'AI Backend Engineer™',
    role: 'Backend Engineer',
    specialty: 'Node.js · REST · GraphQL',
    icon: '🔧',
    stage: 'development',
    responsibilities: [
      'Generate API route handlers (REST + GraphQL)',
      'Implement business logic and validation',
      'Build background workers and webhooks',
      'Integrate AI services via z-ai-web-dev-sdk',
    ],
    deliverables: ['API routes', 'Business logic', 'Webhook handlers', 'AI service adapters'],
  },
  {
    id: 'ai_database_engineer',
    name: 'AI Database Engineer™',
    role: 'Database Engineer',
    specialty: 'Prisma · PostgreSQL · RLS',
    icon: '🗄️',
    stage: 'architecture',
    responsibilities: [
      'Design ER diagrams and relationships',
      'Author Prisma schema and migrations',
      'Define indexes, constraints, and RLS policies',
      'Generate seed data and rollback scripts',
    ],
    deliverables: ['Prisma schema', 'Migration scripts', 'Seed data', 'ER diagram'],
  },
  {
    id: 'ai_devops_engineer',
    name: 'AI DevOps Engineer™',
    role: 'DevOps Engineer',
    specialty: 'CI/CD · Docker · Kubernetes',
    icon: '🚀',
    stage: 'staging',
    responsibilities: [
      'Generate CI/CD pipelines (GitHub/GitLab/Azure)',
      'Provision Docker & Kubernetes manifests',
      'Configure edge deployments (Vercel/Cloudflare)',
      'Set up monitoring, scaling, and rollback',
    ],
    deliverables: ['Pipeline config', 'Dockerfile', 'K8s manifests', 'Monitoring setup'],
  },
  {
    id: 'ai_qa_engineer',
    name: 'AI QA Engineer™',
    role: 'QA Engineer',
    specialty: 'Unit · E2E · Performance Tests',
    icon: '🧪',
    stage: 'testing',
    responsibilities: [
      'Generate unit, integration, and E2E tests',
      'Run performance, load, and accessibility tests',
      'Continuously fix failing tests',
      'Track coverage and regression',
    ],
    deliverables: ['Test suites', 'Coverage report', 'Regression matrix', 'Bug reports'],
  },
  {
    id: 'ai_security_engineer',
    name: 'AI Security Engineer™',
    role: 'Security Engineer',
    specialty: 'Code Scanning · Secrets · SBOM',
    icon: '🛡️',
    stage: 'testing',
    responsibilities: [
      'Scan generated code for vulnerabilities',
      'Manage secrets and dependency scanning',
      'Generate SBOM and validate licenses',
      'Verify RLS and API security',
    ],
    deliverables: ['Security report', 'SBOM', 'Dependency audit', 'Pen-test summary'],
  },
  {
    id: 'ai_release_manager',
    name: 'AI Release Manager™',
    role: 'Release Manager',
    specialty: 'Releases · Rollback · Approvals',
    icon: '📦',
    stage: 'production',
    responsibilities: [
      'Manage releases across dev/staging/prod',
      'Orchestrate canary & blue-green deployments',
      'Coordinate approvals and feature flags',
      'Execute rollbacks on failure',
    ],
    deliverables: ['Release notes', 'Deployment plan', 'Feature flags', 'Rollback runbook'],
  },
];

// ─── Pipeline order (each employee owns one stage) ───────────────────────────

export const PIPELINE_ORDER: DevEmployeeId[] = [
  'ai_product_manager',
  'ai_solution_architect',
  'ai_database_engineer',
  'ai_ux_designer',
  'ai_frontend_engineer',
  'ai_backend_engineer',
  'ai_qa_engineer',
  'ai_security_engineer',
  'ai_devops_engineer',
  'ai_release_manager',
];
