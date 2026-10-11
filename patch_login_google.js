const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

code = code.replace(
  `  const handleGoogle = async () => {
    setLocalError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // AppRouter automatically transitions on auth state change
    } catch (err: any) {
      setLocalError(err.message || 'Failed to sign in with Google');
      setGoogleLoading(false);
    }
  };`,
  `  const handleGoogle = async () => {
    setLocalError(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result && result.needsAccountLink) {
        setLocalError('This email is already associated with an email/password account. Please sign in with email and password to link your Google account.');
        setGoogleLoading(false);
      }
      // Otherwise AppRouter automatically transitions on auth state change
    } catch (err: any) {
      setLocalError(err.message || 'Failed to sign in with Google');
      setGoogleLoading(false);
    }
  };`
);

fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
