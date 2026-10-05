// GET /api/dev/project/[id] — single project detail with builds, tests, deployments, releases, memory
import { NextResponse } from 'next/server';
import { getProject, getBuilds, getTests, getDeployments, getReleases, getReviews, getProjectMemory } from '@/lib/software-factory/engine';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [project, builds, tests, deployments, releases, reviews, memory] = await Promise.all([
      getProject(id),
      getBuilds(id),
      getTests(id),
      getDeployments(id),
      getReleases(id),
      getReviews(id),
      getProjectMemory(id),
    ]);
    if (!project) {
      return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, project, builds, tests, deployments, releases, reviews, memory });
  } catch (err) {
    console.error('[/api/dev/project/[id]]', err);
    return NextResponse.json({ ok: false, error: 'Failed to load project' }, { status: 500 });
  }
}
