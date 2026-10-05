const fs = require('fs');
let content = fs.readFileSync('src/app/api/invoices/send/route.ts', 'utf8');
content = content.replace(
  /const \{ orgId, userId \} = resolveOrgUserFromHeaders\(req\);\s*if \(orgId && userId\) \{\s*try \{\s*const status = await getConnectionStatus\(orgId, userId\);/,
  `const { orgId } = resolveOrgUserFromHeaders(req);\n      if (orgId && uid) {\n        try {\n          const status = await getConnectionStatus(orgId, uid);`
);
fs.writeFileSync('src/app/api/invoices/send/route.ts', content);
