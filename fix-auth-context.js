const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

code = code.replace(
  'signInWithGoogle: () => Promise<{ user: AuthUser | null; error: string | null; needsNewTab?: boolean }>;',
  'signInWithGoogle: () => Promise<{ user: AuthUser | null; error: string | null; needsNewTab?: boolean; needsAccountLink?: boolean; linkingEmail?: string }>;'
);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
console.log('done context');
