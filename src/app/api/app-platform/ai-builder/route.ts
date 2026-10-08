import { NextRequest, NextResponse } from 'next/server';
import { parseAppBuilderIntent, generateAppSpec } from '@/lib/app-platform/ai-builder';

/** POST /api/app-platform/ai-builder — VEYRO AI App Builder generates an app spec from natural language.
 *  Body: { command: "Build a CRM extension" } → returns parsed intent + generated app spec. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command, execute } = body;

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'command (string) is required' }, { status: 400 });
    }

    const intent = parseAppBuilderIntent(command);
    const spec = generateAppSpec(intent);

    return NextResponse.json({
      command,
      intent,
      spec,
      ready: spec.ready,
      message: spec.ready
        ? `Generated app spec for "${spec.name}" (${spec.type}, ${spec.category}). Estimated build time: ${spec.estimatedBuildTimeMin} min. SDK template: ${spec.sdkTemplate}.`
        : 'Could not match the command to a known app builder intent. Try: "Build a CRM extension", "Create an invoice dashboard", "Generate an HR workflow", "Create an AI employee", "Generate a report", "Create an automation", "Deploy an app", or "Publish an app".',
    });
  } catch (error) {
    console.error('[API /app-platform/ai-builder] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate app spec' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
