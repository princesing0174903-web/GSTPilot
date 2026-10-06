const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

// Regex replace the `if (result.error)` block inside `signInWithGoogle`
code = code.replace(
  /if \(result\.error\) \{\s*console\.warn\('\[Auth\] Google sign-in failed:', result\.error\);\s*setError\(result\.error\);\s*setIsLoading\(false\);\s*\} else \{/,
  `if (result.needsAccountLink) {\n          console.log('[Auth] Google sign-in requires account linking for:', result.linkingEmail);\n          setPendingGoogleLink(true);\n          setIsLoading(false);\n        } else if (result.error) {\n          console.warn('[Auth] Google sign-in failed:', result.error);\n          setError(result.error);\n          setIsLoading(false);\n        } else {`
);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
console.log('done context regex');
