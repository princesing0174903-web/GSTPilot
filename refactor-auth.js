const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
};

const dirsToSweep = [
  'src/app/api/integrations',
  'src/app/api/connect'
];

let files = [];
dirsToSweep.forEach(d => {
  if (fs.existsSync(d)) files = files.concat(walk(d));
});

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('resolveOrgUserFromHeaders')) {
    // 1. Update imports
    content = content.replace(/resolveOrgUserFromHeaders/g, 'resolveOrgFromHeaders');
    
    // Ensure requireOrgMembership is imported from @/lib/auth/session if requireAuth is
    if (content.includes('requireAuth') && !content.includes('requireOrgMembership')) {
      content = content.replace(/requireAuth/g, 'requireAuth, requireOrgMembership');
    } else if (!content.includes('requireOrgMembership')) {
       console.log('Needs manual fix for requireAuth:', file);
    }

    // 2. Refactor the destructuring
    const destructureRegex = /const\s+\{\s*orgId\s*,\s*userId(?:\s*,\s*userEmail)?\s*\}\s*=\s*resolveOrgFromHeaders\((.*?)\);/g;
    
    content = content.replace(destructureRegex, (match, reqVar) => {
      return `const orgId = resolveOrgFromHeaders(${reqVar});
  const userId = authResult.uid;
  
  const memberResult = await requireOrgMembership(userId, orgId);
  if (memberResult instanceof NextResponse) return memberResult;`;
    });
    
    // 3. Fix the if (!orgId || !userId) to just if (!orgId)
    content = content.replace(/if\s*\(\s*!orgId\s*\|\|\s*!userId\s*\)/g, 'if (!orgId)');

    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
});
