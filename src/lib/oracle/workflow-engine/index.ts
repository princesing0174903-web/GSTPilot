// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Workflow Engine (barrel)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Oracle Priority 2 — Autonomous Workflow Engine.
//
// Orchestrates existing Action Engine actions into multi-step business workflows.
// Every step calls a registered action — zero business-logic duplication.
//
// Flow:
//   User message ("create an invoice for ABC and email it")
//     ↓
//   planner.planWorkflow()  → WorkflowPlan (template match OR LLM-built)
//     ↓
//   [UI shows WorkflowPlanCard — user confirms]
//     ↓
//   executor.executeWorkflow()  → streams per-step SSE events
//     ↓
//   [UI shows WorkflowProgressCard — live tick-by-tick]
//     ↓
//   WorkflowResult (success | partial | failed) + refreshed dashboard context
//
// The brain route emits a `workflow-plan` SSE event when the LLM calls the
// `runWorkflow` tool. The frontend renders the plan card; on user confirm it
// POSTs to /api/oracle/brain/workflow/execute which streams the executor's
// events back as SSE.
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  WorkflowStep,
  WorkflowPlan,
  WorkflowCategory,
  WorkflowRiskLevel,
  WorkflowStepStatus,
  WorkflowStepResult,
  WorkflowOverallStatus,
  WorkflowResult,
  WorkflowStreamEvent,
  WorkflowPlannerInput,
} from './types';

export {
  WORKFLOW_TEMPLATES,
  matchTemplate,
  getTemplate,
  listTemplateSummaries,
  buildCustomPlan,
  type WorkflowTemplate,
} from './templates';

export {
  planWorkflow,
  looksLikeWorkflowRequest,
  type PlannerResult,
} from './planner';

export {
  executeWorkflow,
  resolveTemplate,
  type ExecutorOptions,
} from './executor';
