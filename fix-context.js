const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

// 1. Add state
code = code.replace(
  'const [needsOnboarding, setNeedsOnboarding] = useState(false);',
  'const [needsOnboarding, setNeedsOnboarding] = useState(false);\n  const [pendingGoogleLink, setPendingGoogleLink] = useState(false);'
);

// 2. Modify signInWithGoogle
const targetGoogle = `        if (result.error) {
          console.warn('[Auth] Google sign-in failed:', result.error);
          setError(result.error);
          setIsLoading(false);
        } else {`;
const replaceGoogle = `        if (result.error) {
          if (result.error.includes('already has a GSTPilot account')) {
            setPendingGoogleLink(true);
          }
          console.warn('[Auth] Google sign-in failed:', result.error);
          setError(result.error);
          setIsLoading(false);
        } else {`;
code = code.replace(targetGoogle, replaceGoogle);

// 3. Modify signInWithEmail
const targetEmail = `        const result = await firebaseSignInWithEmail(email, password);
        if (result.error) {
          console.warn('[Auth] Login failed:', result.error);
          setError(result.error);
          setIsLoading(false);
        } else {
          console.log('[Auth] Login successful — waiting for onAuthStateChanged + OrgContext');
        }
        return result;`;
const replaceEmail = `        const result = await firebaseSignInWithEmail(email, password);
        if (result.error) {
          console.warn('[Auth] Login failed:', result.error);
          setError(result.error);
          setIsLoading(false);
        } else {
          console.log('[Auth] Login successful — waiting for onAuthStateChanged + OrgContext');
          if (pendingGoogleLink) {
             const { linkGoogleAccount } = await loadAuth();
             const linkResult = await linkGoogleAccount();
             if (linkResult.error) {
               console.warn('[Auth] Failed to link Google account after sign in:', linkResult.error);
             } else {
               console.log('[Auth] Successfully linked Google account!');
             }
             setPendingGoogleLink(false);
          }
        }
        return result;`;

// NOTE: replace string literal if exact match doesn't work due to weird dash `—` character
// Let's do a more robust regex replacement for Email
code = code.replace(
  /const result = await firebaseSignInWithEmail\(email, password\);[\s\S]*?return result;/m,
  replaceEmail
);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
console.log('done AuthContext');
