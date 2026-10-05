// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI SOFTWARE FACTORY™ — Type System
//
// Every type maps 1:1 to a Prisma model or a computed view derived from REAL
// connected business data. The Software Factory designs, generates, tests,
// deploys, monitors & continuously improves enterprise applications.
//
// Tagline: "GSTPilot AI Software Factory™ — Think it. Build it. Deploy it. Scale it."
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Project Lifecycle ───────────────────────────────────────────────────────

export type ProjectStatus =
  | 'planning'
  | 'generating'
  | 'building'
  | 'testing'
  | 'reviewing'
  | 'deploying'
  | 'live'
  | 'failed'
  | 'archived';

export type LifecycleStage =
  | 'idea'
  | 'requirements'
  | 'architecture'
  | 'design'
  | 'development'
  | 'testing'
  | 'staging'
  | 'production';

export type AppType =
  | 'crm'
  | 'hr'
  | 'erp'
  | 'vendor_portal'
  | 'hospital_mgmt'
  | 'banking_dashboard'
  | 'manufacturing_erp'
  | 'invoice_system'
  | 'gst_suite'
  | 'analytics_dashboard'
  | 'workflow_engine'
  | 'custom';

export interface TechStack {
  frontend: string;
  backend: string;
  database: string;
  deployment: string;
}

// ─── Generated Spec (what the AI employees produce) ──────────────────────────

export interface RequirementSpec {
  functional: string[];
  nonFunctional: string[];
  userStories: Array<{ id: string; role: string; goal: string; benefit: string }>;
}

export interface DatabaseTable {
  name: string;
  columns: Array<{ name: string; type: string; required: boolean; indexed: boolean; ref?: string }>;
  rowCount: number; // derived from real data where applicable
}

export interface DatabaseSpec {
  tables: DatabaseTable[];
  relationships: Array<{ from: string; to: string; type: 'one-to-many' | 'many-to-many' | 'one-to-one' }>;
  indexes: string[];
  rlsPolicies: string[];
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth: boolean;
  scopes: string[];
}

export interface ApiSpec {
  rest: ApiEndpoint[];
  graphql: string[];
  openApiVersion: string;
  sdkLanguages: string[];
}

export interface AuthSpec {
  provider: string;
  roles: string[];
  permissions: Array<{ role: string; scopes: string[] }>;
}

export interface PageSpec {
  name: string;
  path: string;
  components: string[];
}

export interface GeneratedModules {
  pages: PageSpec[];
  apis: ApiEndpoint[];
  tables: DatabaseTable[];
  workflows: string[];
  reports: string[];
  automations: string[];
}

export interface ProjectSpec {
  requirements: RequirementSpec;
  architecture: string;
  database: DatabaseSpec;
  api: ApiSpec;
  auth: AuthSpec;
  frontend: PageSpec[];
  permissions: string[];
  aiIntegrations: string[];
  reports: string[];
  automation: string[];
  deployment: string;
  documentation: string;
}

// ─── AI Dev Employees (10 specialists) ───────────────────────────────────────

export interface DevEmployee {
  id: string;
  name: string;
  role: string;
  specialty: string;
  icon: string;
  stage: LifecycleStage;
  responsibilities: string[];
  deliverables: string[];
  active: boolean;
  projectsAssigned: number;
  tasksCompleted: number;
  successRate: number;
}

export type DevEmployeeId =
  | 'ai_product_manager'
  | 'ai_solution_architect'
  | 'ai_ux_designer'
  | 'ai_frontend_engineer'
  | 'ai_backend_engineer'
  | 'ai_database_engineer'
  | 'ai_devops_engineer'
  | 'ai_qa_engineer'
  | 'ai_security_engineer'
  | 'ai_release_manager';

// ─── Collaboration Pipeline ──────────────────────────────────────────────────

export interface PipelineStage {
  employeeId: DevEmployeeId;
  stage: LifecycleStage;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  output: string;
  durationMs: number;
  startedAt?: string;
  completedAt?: string;
}

export interface CollaborationPipeline {
  projectId: string;
  stages: PipelineStage[];
  currentStage: number;
  ceoApprovalRequired: boolean;
  ceoApproved: boolean;
}

// ─── Build / Test / Deploy / Release ─────────────────────────────────────────

export type BuildStatus = 'queued' | 'building' | 'success' | 'failed' | 'cancelled';
export type BuildStage = 'install' | 'compile' | 'lint' | 'test' | 'package' | 'upload';

export interface BuildRecord {
  id: string;
  projectId: string;
  buildNumber: number;
  status: BuildStatus;
  stage: BuildStage;
  trigger: string;
  triggeredBy: string;
  durationMs: number;
  fileSizeMb: number;
  errors: number;
  warnings: number;
  logTail: string;
  artifactUrl: string | null;
  createdAt: string;
}

export type TestType =
  | 'unit' | 'integration' | 'e2e' | 'performance'
  | 'load' | 'security' | 'accessibility' | 'regression' | 'visual';

export interface TestRun {
  id: string;
  projectId: string;
  buildId: string | null;
  testType: TestType;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  coveragePct: number;
  failures: Array<{ name: string; message: string }>;
  ranBy: string;
  createdAt: string;
}

export type DeploymentEnv = 'development' | 'staging' | 'production' | 'canary' | 'preview';
export type DeployStrategy = 'rolling' | 'blue_green' | 'canary' | 'recreate';
export type DeployStatus = 'pending' | 'deploying' | 'healthy' | 'unhealthy' | 'rolled_back';

export interface Deployment {
  id: string;
  projectId: string;
  environment: DeploymentEnv;
  strategy: DeployStrategy;
  status: DeployStatus;
  buildId: string | null;
  region: string;
  url: string | null;
  replicas: number;
  cpuUsagePct: number;
  memUsageMb: number;
  latencyMs: number;
  errorRatePct: number;
  uptimePct: number;
  deployedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ReleaseChannel = 'development' | 'staging' | 'production' | 'canary';
export type ReleaseStatus =
  | 'draft' | 'pending_approval' | 'approved'
  | 'releasing' | 'released' | 'rolled_back' | 'failed';

export interface Release {
  id: string;
  projectId: string;
  version: string;
  channel: ReleaseChannel;
  strategy: DeployStrategy;
  status: ReleaseStatus;
  featureFlags: string[];
  releaseNotes: string;
  rollbackOf: string | null;
  approvedBy: string | null;
  releasedBy: string | null;
  createdAt: string;
  releasedAt: string | null;
}

// ─── Code Review ─────────────────────────────────────────────────────────────

export interface ReviewFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  file: string;
  line: number;
  message: string;
  suggestion: string;
}

export interface CodeReview {
  id: string;
  projectId: string;
  reviewType: 'performance' | 'security' | 'architecture' | 'maintainability' | 'accessibility' | 'best_practices' | 'complexity' | 'test_coverage';
  reviewer: string;
  status: 'open' | 'approved' | 'changes_requested' | 'resolved';
  score: number;
  findings: ReviewFinding[];
  summary: string;
  prUrl: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// ─── Component Library ───────────────────────────────────────────────────────

export type ComponentKind =
  | 'page' | 'layout' | 'widget' | 'form' | 'report'
  | 'chart' | 'table' | 'workflow' | 'automation'
  | 'ai_employee' | 'theme' | 'template' | 'application';

export interface Component {
  id: string;
  projectId: string | null;
  name: string;
  kind: ComponentKind;
  description: string;
  category: string;
  tags: string[];
  version: string;
  usageCount: number;
  rating: number;
  isPublished: boolean;
  author: string;
  createdAt: string;
  updatedAt: string;
}

// ─── AI Memory ───────────────────────────────────────────────────────────────

export type DevMemoryType =
  | 'architecture' | 'decision' | 'bug' | 'deployment'
  | 'feedback' | 'performance' | 'code_evolution' | 'ai_discussion';

export interface DevMemoryEntry {
  id: string;
  projectId: string;
  memoryType: DevMemoryType;
  title: string;
  description: string;
  importance: number;
  tags: string[];
  occurredAt: string;
}

// ─── Project (full view) ─────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  appType: AppType;
  category: string;
  status: ProjectStatus;
  lifecycleStage: LifecycleStage;
  stack: TechStack;
  prompt: string;
  aiEmployees: string[];
  modules: GeneratedModules;
  spec: ProjectSpec;
  healthScore: number;
  coveragePct: number;
  fileCount: number;
  lineCount: number;
  version: string;
  repoUrl: string | null;
  previewUrl: string | null;
  liveUrl: string | null;
  businessDataSnapshot: BusinessDataSnapshot;
  createdAt: string;
  updatedAt: string;
}

// ─── Real Business Data Snapshot (captured at generation time) ───────────────

export interface BusinessDataSnapshot {
  clientCount: number;
  invoiceCount: number;
  returnCount: number;
  totalTaxVolume: number;
  filedReturns: number;
  pendingReturns: number;
  activeClients: number;
  averageHealthScore: number;
  firmHealth: number;
  complianceScore: number;
  capturedAt: string;
}

// ─── Dashboard / Observability ───────────────────────────────────────────────

export interface FactoryDashboard {
  totals: {
    projects: number;
    activeProjects: number;
    liveProjects: number;
    builds: number;
    successfulBuilds: number;
    failedBuilds: number;
    deployments: number;
    healthyDeployments: number;
    releases: number;
    releasedToProd: number;
    testRuns: number;
    passingTests: number;
    reviews: number;
    openReviews: number;
    components: number;
    repositories: number;
    pipelines: number;
  };
  health: {
    averageHealthScore: number;
    averageCoverage: number;
    buildSuccessRate: number;
    averageUptime: number;
    averageLatency: number;
    averageErrorRate: number;
  };
  velocity: {
    filesGenerated: number;
    linesGenerated: number;
    avgBuildDurationMs: number;
    avgTestDurationMs: number;
    releasesThisWeek: number;
    buildsToday: number;
  };
  employees: DevEmployee[];
  recentBuilds: BuildRecord[];
  recentDeployments: Deployment[];
  recentReleases: Release[];
  recentProjects: Project[];
  businessData: BusinessDataSnapshot;
}

// ─── App Templates (Natural Language App Builder) ────────────────────────────

export interface AppTemplate {
  id: string;
  name: string;
  keywords: string[];
  appType: AppType;
  category: string;
  description: string;
  defaultStack: TechStack;
  modules: GeneratedModules;
  spec: Partial<ProjectSpec>;
  examplePrompt: string;
}

// ─── API Request/Response shapes ─────────────────────────────────────────────

export interface GenerateRequest {
  prompt: string;
  appType?: AppType;
  stack?: Partial<TechStack>;
}

export interface GenerateResult {
  project: Project;
  pipeline: CollaborationPipeline;
  message: string;
}

export interface BuildRequest {
  projectId: string;
  trigger?: string;
}

export interface TestRequest {
  projectId: string;
  testType?: TestType;
}

export interface DeployRequest {
  projectId: string;
  environment: DeploymentEnv;
  strategy?: DeployStrategy;
}

export interface ReviewRequest {
  projectId: string;
  reviewType?: CodeReview['reviewType'];
}

export interface ReleaseRequest {
  projectId: string;
  channel: ReleaseChannel;
  strategy?: DeployStrategy;
  releaseNotes?: string;
}

export interface RollbackRequest {
  projectId: string;
  releaseId: string;
}

export const FACTORY_TAGLINE = 'GSTPilot AI Software Factory™ — Think it. Build it. Deploy it. Scale it.';
