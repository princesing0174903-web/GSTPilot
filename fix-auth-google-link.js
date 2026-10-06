const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

code = code.replace(
  `        if (result.error) {
          console.warn('[Auth] Google sign-in failed:', result.error);
          setError(result.error);
          setIsLoading(false);
        } else {`,
  `        if (result.needsAccountLink) {
          console.log('[Auth] Google sign-in requires account linking for:', result.linkingEmail);
          setPendingGoogleLink(true);
          setIsLoading(false);
        } else if (result.error) {
          console.warn('[Auth] Google sign-in failed:', result.error);
          setError(result.error);
          setIsLoading(false);
        } else {`
);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
console.log('done auth context link logic');
