const fs = require('fs');
let code = fs.readFileSync('src/lib/auth.ts', 'utf8');

code = code.replace(
  'Promise<{ user: User | null; error: string | null; needsNewTab?: boolean }>',
  'Promise<{ user: User | null; error: string | null; needsNewTab?: boolean; needsAccountLink?: boolean; linkingEmail?: string }>'
);

code = code.replace(
  "return { user: null, error: 'This email already has a GSTPilot account. Sign in with your existing method to link Google.' };",
  "return { user: null, error: null, needsAccountLink: true, linkingEmail: (error as any)?.customData?.email || '' };"
);

fs.writeFileSync('src/lib/auth.ts', code);
console.log('done auth.ts');
