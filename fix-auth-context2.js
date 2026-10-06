const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

code = code.replace(
  "        if (result.error) {\n          console.warn('[Auth] Google sign-in failed:', result.error);\n          setError(result.error);\n          setIsLoading(false);\n        } else {\n          console.log('[Auth] Google sign-in successful \\u2014 waiting for onAuthStateChanged');\n        }",
  "        if (result.needsAccountLink) {\n          console.log('[Auth] Google sign-in requires account linking for:', result.linkingEmail);\n          setPendingGoogleLink(true);\n          setIsLoading(false);\n        } else if (result.error) {\n          console.warn('[Auth] Google sign-in failed:', result.error);\n          setError(result.error);\n          setIsLoading(false);\n        } else {\n          console.log('[Auth] Google sign-in successful \\u2014 waiting for onAuthStateChanged');\n        }"
);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
console.log('done context');
