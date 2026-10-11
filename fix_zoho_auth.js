const fs = require('fs');
let code = fs.readFileSync('src/lib/integrations/zoho-books/auth.ts', 'utf8');

code = code.replace(
  `import { getValidAccessToken, resolveOrgUserFromHeaders, loadTokens } from './oauth';`,
  `import { getValidAccessToken, resolveOrgFromHeaders, loadTokens } from './oauth';`
);

code = code.replace(
  `const { orgId, userId } = resolveOrgUserFromHeaders(req);`,
  `const orgId = resolveOrgFromHeaders(req) || '';
  const userId = req.headers.get('x-gstpilot-userid') || '';`
);

fs.writeFileSync('src/lib/integrations/zoho-books/auth.ts', code, 'utf8');
console.log('Fixed zoho auth');
