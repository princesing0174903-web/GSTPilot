const fs = require('fs');

function patchAuthHelper(file, isZoho) {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Add imports
  if (!content.includes('requireAuth')) {
    content = content.replace(/import { NextResponse } from 'next\/server';/, "import { NextResponse } from 'next/server';\nimport { requireAuth, requireOrgMembership } from '@/lib/auth/session';");
  }

  // Refactor the function
  const funcName = isZoho ? 'resolveZohoAuth' : 'resolveGoogleAuth';
  const regex = new RegExp(`export async function ${funcName}\\(req: Request\\): Promise<[^>]+> \\{[\\s\\S]*?const \\{ orgId, userId \\} = resolveOrgFromHeaders\\(req\\);`, 'm');
  
  content = content.replace(regex, (match) => {
    return match.replace(/const \{ orgId, userId \} = resolveOrgFromHeaders\(req\);/, `
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return { accessToken: null, orgId: '', userId: '', ${isZoho ? 'zohoOrgId: null, ' : ''}response: authResult };
  }
  const userId = authResult.uid;
  
  const orgId = resolveOrgFromHeaders(req);
  if (!orgId) {
    return {
      accessToken: null,
      orgId: '',
      userId: '',
      ${isZoho ? 'zohoOrgId: null,\n      ' : ''}response: NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      ),
    };
  }
  
  const memberResult = await requireOrgMembership(userId, orgId);
  if (memberResult instanceof NextResponse) {
    return { accessToken: null, orgId: '', userId: '', ${isZoho ? 'zohoOrgId: null, ' : ''}response: memberResult };
  }
`);
  });
  
  // Strip out the old if (!orgId || !userId) check
  content = content.replace(/if \(!orgId \|\| !userId\) \{[\s\S]*?\}\s*const \{ accessToken/, 'const { accessToken');

  fs.writeFileSync(file, content);
  console.log('Patched', file);
}

patchAuthHelper('src/lib/google-workspace/route-auth.ts', false);
patchAuthHelper('src/lib/integrations/zoho-books/auth.ts', true);
