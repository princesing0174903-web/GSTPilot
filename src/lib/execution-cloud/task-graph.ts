// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 3: ENTERPRISE TASK GRAPH™
// Convert every activity into a graph. Models the full
//   lead → proposal → negotiation → invoice → payment → gst → accounting →
//   forecast → knowledge → graph → oracle chain.
// Edges come from: (a) ExecutionJob.sourceJobId + (b) TaskEdge rows + (c)
// inferred module-flow edges (e.g. crm→gst→banking→reports).
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrismaClient } from '@prisma/client';
import type {
  ExecutionJob, ExecutionModule, TaskEdge, TaskEdgeRelation,
  TaskGraphNode, TaskGraphPath, TaskGraphSummary,
} from './types';
import { MODULE_META } from './types';

// Infer a semantic edge relation between two modules based on the canonical
// business flow. Returns null if no natural edge exists.
function inferRelation(from: ExecutionModule, to: ExecutionModule): TaskEdgeRelation | null {
  const flow: Partial<Record<ExecutionModule, [ExecutionModule, TaskEdgeRelation]>> = {
    crm: ['gst', 'invoice_to'],
    gst: ['banking', 'gst_to'],
    banking: ['reports', 'payment_to'],
    reports: ['business_graph', 'forecast_to'],
    business_graph: ['knowledge_graph', 'graph_to'],
    knowledge_graph: ['oracle', 'knowledge_to'],
    oracle: ['ai_ceo', 'oracle_to'],
    ai_ceo: ['automation', 'triggers'],
    automation: ['crm', 'triggers'],
  };
  const entry = flow[from];
  if (entry && entry[0] === to) return entry[1];
  return null;
}

export async function buildTaskGraph(
  db: PrismaClient,
  jobs: ExecutionJob[],
): Promise<TaskGraphSummary> {
  // 1. Explicit TaskEdge rows.
  const edgeRows = await db.taskEdge.findMany({ take: 500 });
  const explicitEdges: TaskEdge[] = edgeRows.map((r) => ({
    id: r.id,
    fromJobId: r.fromJobId,
    toJobId: r.toJobId,
    relation: r.relation as TaskEdgeRelation,
    metadata: r.metadata ? safeParse(r.metadata) : {},
    createdAt: r.createdAt.toISOString(),
  }));

  // 2. sourceJobId-derived edges (depends_on).
  const sourceEdges: TaskEdge[] = [];
  for (const j of jobs) {
    if (j.sourceJobId) {
      sourceEdges.push({
        id: `edge-src-${j.id}`,
        fromJobId: j.sourceJobId,
        toJobId: j.id,
        relation: 'depends_on',
        metadata: { inferred: true },
        createdAt: j.createdAt,
      });
    }
  }

  // 3. Inferred module-flow edges. For each module present in the job stream,
  //    find the most recent job in the next module of the canonical flow and
  //    draw one representative edge. Keeps the graph readable.
  const inferredEdges: TaskEdge[] = [];
  const jobsByModule = new Map<ExecutionModule, ExecutionJob[]>();
  for (const j of jobs) {
    const arr = jobsByModule.get(j.module) ?? [];
    arr.push(j);
    jobsByModule.set(j.module, arr);
  }
  const flowPairs: [ExecutionModule, ExecutionModule][] = [
    ['crm', 'gst'], ['gst', 'banking'], ['banking', 'reports'],
    ['reports', 'business_graph'], ['business_graph', 'knowledge_graph'],
    ['knowledge_graph', 'oracle'], ['oracle', 'ai_ceo'], ['ai_ceo', 'automation'],
    ['automation', 'crm'], ['ai_ceo', 'ai_cfo'], ['ai_cfo', 'reports'],
    ['global_enterprise', 'oracle'], ['autonomous_enterprise', 'oracle'],
    ['ai_software_factory', 'ai_cto'],
  ];
  for (const [from, to] of flowPairs) {
    const fromJobs = jobsByModule.get(from);
    const toJobs = jobsByModule.get(to);
    if (!fromJobs?.length || !toJobs?.length) continue;
    const rel = inferRelation(from, to) ?? 'triggers';
    // Link the most recent from-job to the most recent to-job created after it.
    const fromJob = fromJobs[0];
    const toJob = toJobs.find((t) => new Date(t.createdAt).getTime() >= new Date(fromJob.createdAt).getTime()) ?? toJobs[0];
    inferredEdges.push({
      id: `edge-inf-${from}-${to}`,
      fromJobId: fromJob.id,
      toJobId: toJob.id,
      relation: rel,
      metadata: { inferred: true, fromModule: from, toModule: to },
      createdAt: toJob.createdAt,
    });
  }

  const edges = [...explicitEdges, ...sourceEdges, ...inferredEdges];

  // 4. Compute node degrees.
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.fromJobId, (degree.get(e.fromJobId) ?? 0) + 1);
    degree.set(e.toJobId, (degree.get(e.toJobId) ?? 0) + 1);
  }

  const nodes: TaskGraphNode[] = jobs
    .filter((j) => (degree.get(j.id) ?? 0) > 0)
    .map((j) => ({
      jobId: j.id,
      module: j.module,
      description: j.description,
      status: j.status,
      degree: degree.get(j.id) ?? 0,
    }))
    .sort((a, b) => b.degree - a.degree);

  const byRelation = {} as Record<TaskEdgeRelation, number>;
  const allRels: TaskEdgeRelation[] = [
    'lead_to','proposal_to','negotiation_to','invoice_to','payment_to','gst_to',
    'accounting_to','forecast_to','knowledge_to','graph_to','oracle_to',
    'depends_on','triggers','rollback_of',
  ];
  for (const r of allRels) byRelation[r] = 0;
  for (const e of edges) byRelation[e.relation] = (byRelation[e.relation] ?? 0) + 1;

  // 5. Longest path via BFS over the directed edge set (bounded for safety).
  const longestPath = findLongestPath(edges, jobs);

  // 6. Sample paths — the canonical lead→oracle chain if it exists.
  const samplePaths = buildSamplePaths(edges, jobs);

  return {
    nodes: nodes.length,
    edges: edges.length,
    longestPath,
    topHubs: nodes.slice(0, 8),
    byRelation,
    samplePaths,
  };
}

function findLongestPath(edges: TaskEdge[], jobs: ExecutionJob[]): TaskGraphPath | null {
  if (edges.length === 0) return null;
  const adj = new Map<string, { to: string; rel: TaskEdgeRelation }[]>();
  for (const e of edges) {
    const arr = adj.get(e.fromJobId) ?? [];
    arr.push({ to: e.toJobId, rel: e.relation });
    adj.set(e.fromJobId, arr);
  }
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  let best: { steps: string[]; rels: TaskEdgeRelation[] } | null = null as { steps: string[]; rels: TaskEdgeRelation[] } | null;

  const dfs = (node: string, path: string[], rels: TaskEdgeRelation[], visited: Set<string>) => {
    if (path.length > (best?.steps.length ?? 0)) best = { steps: [...path], rels: [...rels] };
    const next = adj.get(node) ?? [];
    for (const { to, rel } of next) {
      if (visited.has(to)) continue;
      visited.add(to);
      path.push(to);
      rels.push(rel);
      dfs(to, path, rels, visited);
      path.pop();
      rels.pop();
      visited.delete(to);
    }
  };
  // Bound the search to avoid pathological cases.
  const starts = Array.from(adj.keys()).slice(0, 30);
  for (const s of starts) {
    dfs(s, [s], [], new Set([s]));
  }
  if (!best || best.steps.length < 2) return null;
  const totalDurationMs = best.steps.reduce((sum, id) => sum + (jobMap.get(id)?.durationMs ?? 0), 0);
  return {
    steps: best.steps.map((id) => {
      const j = jobMap.get(id);
      return {
        jobId: id,
        module: j?.module ?? 'automation',
        description: j?.description ?? id,
        status: j?.status ?? 'completed',
      };
    }),
    totalDurationMs,
    edgeRelations: best.rels,
  };
}

function buildSamplePaths(edges: TaskEdge[], jobs: ExecutionJob[]): TaskGraphPath[] {
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const adj = new Map<string, { to: string; rel: TaskEdgeRelation }[]>();
  for (const e of edges) {
    const arr = adj.get(e.fromJobId) ?? [];
    arr.push({ to: e.toJobId, rel: e.relation });
    adj.set(e.fromJobId, arr);
  }
  const paths: TaskGraphPath[] = [];
  const seen = new Set<string>();
  for (const [start, outs] of adj) {
    if (outs.length === 0) continue;
    // Walk forward up to 5 hops.
    const steps: string[] = [start];
    const rels: TaskEdgeRelation[] = [];
    let cur = start;
    for (let hop = 0; hop < 5; hop++) {
      const next = adj.get(cur);
      if (!next || next.length === 0) break;
      const nx = next[0];
      steps.push(nx.to);
      rels.push(nx.rel);
      cur = nx.to;
    }
    if (steps.length < 2) continue;
    const key = steps.join('→');
    if (seen.has(key)) continue;
    seen.add(key);
    const totalDurationMs = steps.reduce((sum, id) => sum + (jobMap.get(id)?.durationMs ?? 0), 0);
    paths.push({
      steps: steps.map((id) => {
        const j = jobMap.get(id);
        return {
          jobId: id,
          module: j?.module ?? 'automation',
          description: j?.description ?? id,
          status: j?.status ?? 'completed',
        };
      }),
      totalDurationMs,
      edgeRelations: rels,
    });
    if (paths.length >= 6) break;
  }
  return paths;
}

function safeParse(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}

// Re-export for callers that want the module metadata lookup.
export { MODULE_META };
