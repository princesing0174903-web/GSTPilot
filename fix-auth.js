const fs = require('fs');
let code = fs.readFileSync('src/lib/auth.ts', 'utf8');

code = code.replace(
  "const code = (error as { code?: string })?.code || '';\r\n    if (code === 'auth/invalid-credential' || code === 'auth/account-exists-with-different-credential') {\r\n      return { user: null, error: 'This email already has a GSTPilot account. Sign in with your existing method to link Google.' };\r\n    }\r\n    const code = (error as { code?: string })?.code || '';",
  "const code = (error as { code?: string })?.code || '';\r\n    if (code === 'auth/invalid-credential' || code === 'auth/account-exists-with-different-credential') {\r\n      return { user: null, error: 'This email already has a GSTPilot account. Sign in with your existing method to link Google.' };\r\n    }"
);

// Fallback if \n was used instead of \r\n
code = code.replace(
  "const code = (error as { code?: string })?.code || '';\n    if (code === 'auth/invalid-credential' || code === 'auth/account-exists-with-different-credential') {\n      return { user: null, error: 'This email already has a GSTPilot account. Sign in with your existing method to link Google.' };\n    }\n    const code = (error as { code?: string })?.code || '';",
  "const code = (error as { code?: string })?.code || '';\n    if (code === 'auth/invalid-credential' || code === 'auth/account-exists-with-different-credential') {\n      return { user: null, error: 'This email already has a GSTPilot account. Sign in with your existing method to link Google.' };\n    }"
);

fs.writeFileSync('src/lib/auth.ts', code);
console.log('done auth ts');
