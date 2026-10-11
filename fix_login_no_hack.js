const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

const newHandleGoogle = `  const handleGoogle = async () => {
    setLocalError(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result && result.error) {
        setLocalError(result.error);
        setGoogleLoading(false);
      } else if (result && result.needsAccountLink) {
        setLinkEmail(result.linkingEmail || '');
        setLocalError('ACCOUNT CONFLICT: Please enter your password to link your Google account to ' + (result.linkingEmail || 'your email') + '.');
        if (result.linkingEmail) setEmail(result.linkingEmail);
        setMode('login');
        setGoogleLoading(false);
      }
      // Otherwise keep loading state true while AppRouter transitions
    } catch (err: any) {
      setLocalError(err.message || 'Failed to sign in with Google');
      setGoogleLoading(false);
    }
  };`;

code = code.replace(/const handleGoogle = async \(\) => \{[\s\S]*?catch \(err: any\) \{[\s\S]*?\}\s*;\s*\n/m, newHandleGoogle + '\n');

fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
