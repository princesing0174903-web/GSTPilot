// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Global Data Intelligence Cloud™ (UNIFIED ENTERPRISE DATA BRAIN)
// Type System — shared by all 16 subsystems.
// Every Data Point. One Enterprise Brain. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. Universal Data Catalog™ ──────────────────────────────────────────────
export type DataDomain =
  | 'finance' | 'sales' | 'hr' | 'gst' | 'compliance' | 'banking'
  | 'operations' | 'crm' | 'legal' | 'ai' | 'graph' | 'marketplace';

export type CatalogSourceType =
  | 'table' | 'document' | 'invoice' | 'customer' | 'employee' | 'vendor'
  | 'transaction' | 'payment' | 'tax' | 'payroll' | 'meeting' | 'email'
  | 'connector' | 'report' | 'dashboard' | 'ai_conversation' | 'graph_node' | 'knowledge_node';

export type CatalogSourceSystem =
  | 'prisma' | 'firestore' | 'connector' | 'oracle' | 'execution_cloud'
  | 'compliance_cloud' | 'business_graph' | 'knowledge_graph' | 'digital_twin'
  | 'autonomous' | 'software_factory' | 'marketplace';

export type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted' | 'pii' | 'financial';

export interface CatalogField {
  name: string;
  type: string;
  sample?: string;
}

export interface DataCatalogEntry {
  id: string;
  datasetKey: string;
  datasetName: string;
  domain: DataDomain;
  sourceType: CatalogSourceType;
  sourceSystem: CatalogSourceSystem;
  recordCount: number;
  fieldCount: number;
  sizeBytes: number;
  owner: string | null;
  sensitivity: SensitivityLevel;
  description: string | null;
  schemaFields: CatalogField[];
  sampleRecords: unknown[];
  freshnessLagMin: number;
  lastUpdated: string | null;
  qualityScore: number;
  linkedDatasetIds: string[];
  tags: string[];
  isActive: boolean;
  discoveredAt: string;
  updatedAt: string;
}

// ─── 2. Data Lineage™ ────────────────────────────────────────────────────────
export type LineageEventType =
  | 'origin' | 'create' | 'update' | 'delete' | 'ai_usage' | 'api_usage'
  | 'report_usage' | 'dashboard_usage' | 'compliance_usage' | 'execution_usage'
  | 'oracle_usage' | 'connector_sync' | 'pipeline_transform';

export type LineageActorType =
  | 'oracle' | 'ai_cfo' | 'ai_ceo' | 'ai_legal' | 'ai_coo' | 'human'
  | 'connector' | 'pipeline' | 'api' | 'system';

export interface DataLineageEvent {
  id: string;
  datasetKey: string;
  eventType: LineageEventType;
  actorId: string | null;
  actorType: LineageActorType;
  action: string;
  upstreamRefs: string[];
  downstreamRefs: string[];
  beforeSnapshot: Record<string, unknown>;
  afterSnapshot: Record<string, unknown>;
  replayToken: string;
  occurredAt: string;
}

// ─── 3. Real-Time Data Pipeline™ ─────────────────────────────────────────────
export type PipelineType =
  | 'streaming' | 'batch' | 'cdc' | 'event_sourcing' | 'connector_sync'
  | 'api_ingest' | 'file_ingest' | 'email_ingest' | 'document_ingest' | 'voice_ingest';

export type PipelineStatus = 'queued' | 'running' | 'completed' | 'failed' | 'retrying';

export interface DataPipelineRun {
  id: string;
  pipelineName: string;
  pipelineType: PipelineType;
  source: string;
  status: PipelineStatus;
  recordsIn: number;
  recordsOut: number;
  recordsRejected: number;
  bytesProcessed: number;
  latencyMs: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

// ─── 4. Master Data Management™ ──────────────────────────────────────────────
export type MasterEntityType =
  | 'customer' | 'employee' | 'vendor' | 'product' | 'service' | 'country'
  | 'currency' | 'organization' | 'department' | 'cost_center' | 'tax_id' | 'bank_account';

export interface MasterDataRecord {
  id: string;
  entityType: MasterEntityType;
  entityKey: string;
  displayName: string;
  attributes: Record<string, unknown>;
  sourceIds: string[];
  confidenceScore: number;
  duplicateCount: number;
  status: 'active' | 'merged' | 'archived';
  mergedIntoId: string | null;
  lastVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 5. Data Governance™ ─────────────────────────────────────────────────────
export type GovernancePolicyType =
  | 'classification' | 'sensitivity_label' | 'retention' | 'access'
  | 'masking' | 'encryption' | 'residency' | 'gdpr' | 'soc2' | 'iso27001';

export interface DataGovernancePolicy {
  id: string;
  policyName: string;
  policyType: GovernancePolicyType;
  datasetKey: string | null;
  domain: string | null;
  sensitivity: SensitivityLevel;
  retentionDays: number;
  accessRoles: string[];
  maskingRules: Record<string, string>;
  residencyRegion: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── 6. Data Observability™ ──────────────────────────────────────────────────
export type ObservabilityMetricType =
  | 'freshness' | 'completeness' | 'accuracy' | 'latency' | 'volume'
  | 'schema_drift' | 'pipeline_health' | 'connector_health' | 'api_health' | 'storage_growth';

export type ObservabilityStatus = 'healthy' | 'warning' | 'critical' | 'down';

export interface DataObservabilityMetric {
  id: string;
  datasetKey: string;
  metricType: ObservabilityMetricType;
  metricValue: number;
  metricUnit: string;
  status: ObservabilityStatus;
  threshold: number;
  message: string | null;
  measuredAt: string;
}

// ─── 7. AI Data Discovery™ ───────────────────────────────────────────────────
export type DiscoveryType =
  | 'revenue_trend' | 'fraud_pattern' | 'customer_segment' | 'cost_anomaly'
  | 'tax_optimization' | 'cashflow_risk' | 'operational_bottleneck' | 'growth_opportunity'
  | 'hidden_relationship' | 'churn_signal' | 'attrition_signal' | 'demand_shift';

export interface DataDiscoveryInsight {
  id: string;
  discoveryType: DiscoveryType;
  title: string;
  description: string;
  datasetKeys: string[];
  confidence: number;
  impactMagnitude: number;
  impactDirection: 'positive' | 'negative' | 'neutral';
  evidence: string[];
  recommendedAction: string | null;
  status: 'new' | 'acknowledged' | 'acted_on' | 'dismissed';
  detectedAt: string;
}

// ─── 8. Predictive Data Engine™ ──────────────────────────────────────────────
export type ForecastType =
  | 'revenue' | 'cash_flow' | 'expenses' | 'payroll' | 'demand' | 'inventory'
  | 'compliance_risk' | 'employee_attrition' | 'customer_churn' | 'tax_liability' | 'growth';

export type ForecastHorizon = '7d' | '30d' | '90d' | '1y';

export interface PredictiveForecast {
  id: string;
  forecastType: ForecastType;
  horizon: ForecastHorizon;
  predictedValue: number;
  confidenceLow: number;
  confidenceHigh: number;
  confidenceScore: number;
  drivers: string[];
  methodology: string | null;
  baselineValue: number;
  changePct: number;
  narrative: string | null;
  forecastFor: string;
  generatedAt: string;
}

// ─── 9. Enterprise Search™ ───────────────────────────────────────────────────
export interface EnterpriseSearchHit {
  recordKey: string;
  recordType: string;
  sourceSystem: string;
  title: string;
  snippet: string;
  score: number;
  datasetKey: string | null;
  metadata: Record<string, unknown>;
}

export interface EnterpriseSearchResult {
  query: string;
  totalHits: number;
  hits: EnterpriseSearchHit[];
  searchMode: 'keyword' | 'semantic' | 'hybrid' | 'graph';
  tookMs: number;
}

// ─── 10. AI Knowledge Synthesis™ ─────────────────────────────────────────────
export type SynthesisType =
  | 'executive_summary' | 'relationship_map' | 'risk_map' | 'growth_map'
  | 'opportunity_map' | 'operational_intelligence' | 'market_intelligence' | 'financial_intelligence';

export type SynthesisAudience = 'ceo' | 'cfo' | 'coo' | 'cto' | 'cro' | 'board' | 'all';

export interface DataKnowledgeSynthesis {
  id: string;
  synthesisType: SynthesisType;
  title: string;
  summary: string;
  keyPoints: string[];
  sourceDatasetKeys: string[];
  confidenceScore: number;
  audience: SynthesisAudience;
  generatedAt: string;
}

// ─── 11. Enterprise Analytics Engine™ ────────────────────────────────────────
export type AnalyticsType =
  | 'revenue' | 'cost' | 'profitability' | 'customer' | 'sales' | 'payroll'
  | 'compliance' | 'execution' | 'ai' | 'connector' | 'organization' | 'country';

export interface DataAnalyticsSnapshot {
  id: string;
  analyticsType: AnalyticsType;
  period: string;
  metrics: Record<string, number>;
  dimensionBreakdown: Record<string, Record<string, number>>;
  trendDelta: number;
  narrative: string | null;
  computedAt: string;
}

// ─── 12. Data Quality (extended, integrated with Catalog) ────────────────────
export interface DataQualityIssue {
  id: string;
  datasetKey: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  amount: number | null;
  suggestedFix: string | null;
  status: 'open' | 'fixing' | 'resolved' | 'ignored';
  detectedAt: string;
}

// ─── Unified Dashboard Bundle ────────────────────────────────────────────────
export interface DataIntelligenceDashboard {
  generatedAt: string;
  // Enterprise Data Fabric
  fabric: {
    connectedModules: number;
    totalDatasets: number;
    totalRecords: number;
    totalSizeBytes: number;
    connectionGraph: { module: string; datasets: number; records: number }[];
  };
  // Universal Data Catalog
  catalog: {
    totalDatasets: number;
    byDomain: Record<string, number>;
    bySourceSystem: Record<string, number>;
    bySensitivity: Record<string, number>;
    staleDatasets: number;
    avgQualityScore: number;
    recentEntries: DataCatalogEntry[];
  };
  // Data Lineage
  lineage: {
    totalEvents: number;
    byEventType: Record<string, number>;
    byActorType: Record<string, number>;
    recentEvents: DataLineageEvent[];
    replayableCount: number;
  };
  // Real-Time Data Pipeline
  pipelines: {
    totalRuns: number;
    activeRuns: number;
    completedToday: number;
    failedToday: number;
    totalRecordsIngested: number;
    avgLatencyMs: number;
    recentRuns: DataPipelineRun[];
  };
  // Master Data Management
  masterData: {
    totalGoldenRecords: number;
    byEntityType: Record<string, number>;
    duplicatesMerged: number;
    avgConfidence: number;
    recentRecords: MasterDataRecord[];
  };
  // Data Quality
  quality: {
    totalIssues: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    openIssues: number;
    avgQualityScore: number;
    recentIssues: DataQualityIssue[];
  };
  // Enterprise Search
  search: {
    indexedRecords: number;
    byRecordType: Record<string, number>;
    bySourceSystem: Record<string, number>;
    lastIndexedAt: string | null;
  };
  // AI Data Discovery
  discovery: {
    totalInsights: number;
    byType: Record<string, number>;
    newInsights: number;
    totalImpactINR: number;
    recentInsights: DataDiscoveryInsight[];
  };
  // Enterprise Analytics
  analytics: {
    totalSnapshots: number;
    byType: Record<string, number>;
    latestSnapshots: DataAnalyticsSnapshot[];
  };
  // Predictive Data Engine
  predictions: {
    totalForecasts: number;
    byType: Record<string, number>;
    byHorizon: Record<string, number>;
    avgConfidence: number;
    activeForecasts: PredictiveForecast[];
  };
  // Data Governance
  governance: {
    totalPolicies: number;
    byType: Record<string, number>;
    bySensitivity: Record<string, number>;
    complianceFrameworks: string[];
    coveragePct: number;
  };
  // Data Observability
  observability: {
    totalMetrics: number;
    byStatus: Record<string, number>;
    byMetricType: Record<string, number>;
    healthScore: number;
    criticalDatasets: number;
    recentMetrics: DataObservabilityMetric[];
  };
  // AI Knowledge Synthesis
  synthesis: {
    totalSummaries: number;
    byType: Record<string, number>;
    byAudience: Record<string, number>;
    recentSummaries: DataKnowledgeSynthesis[];
  };
}
