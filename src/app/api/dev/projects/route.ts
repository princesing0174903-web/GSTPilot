// GET /api/dev/projects — list all software projects
import { NextResponse } from 'next/server';
import { getProjects } from '@/lib/software-factory/engine';

export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json({ ok: true, projects, count: projects.length });
  } catch (err) {
    console.error('[/api/dev/projects]', err);
    return NextResponse.json({ ok: false, error: 'Failed to load projects' }, { status: 500 });
  }
}
