const fs = require('fs');
const filesToFix = [
  'src/app/api/integrations/zoho/customers/auto-sync/route.ts',
  'src/app/api/integrations/zoho/customers/sync/route.ts',
  'src/app/api/integrations/zoho/customers/sync-status/route.ts',
  'src/app/api/integrations/zoho/customers/[id]/route.ts',
  'src/app/api/integrations/zoho/diagnostics/route.ts',
  'src/app/api/integrations/zoho/sync/route.ts',
  'src/app/api/integrations/zoho/sync/status/route.ts'
];

filesToFix.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // Add import if missing
  if (!content.includes('@/lib/auth/session')) {
    content = content.replace(/import { NextResponse } from 'next\/server';/, "import { NextResponse } from 'next/server';\nimport { requireAuth, requireOrgMembership } from '@/lib/auth/session';");
  }

  // Add requireAuth check
  content = content.replace(/(export async function (?:GET|POST|PATCH|DELETE)\([^)]+\)\s*\{)(?:\s*try\s*\{)?/g, (match, def) => {
    // If it already has requireAuth, don't duplicate
    if (content.substring(content.indexOf(match), content.indexOf(match) + 100).includes('requireAuth(')) {
      return match;
    }
    return `${match}\n  const authResult = await requireAuth(req);\n  if (authResult instanceof NextResponse) return authResult;\n`;
  });

  fs.writeFileSync(file, content);
  console.log('Patched', file);
});
