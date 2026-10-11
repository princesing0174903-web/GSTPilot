const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

// Replace the Google error handler to be much more explicit if it catches an invalid credential
code = code.replace(
  `setLocalError("GOOGLE_SIGN_IN_ERROR: " + result.error);`,
  `if (result.error.includes('Email or password is incorrect')) {
          setLocalError('GOOGLE_ACCOUNT_CONFLICT: This email already exists in the database as a password-only account. Firebase security is blocking Google login. Please delete the user in Firebase Console or use the Email/Password form.');
        } else {
          setLocalError("GOOGLE_SIGN_IN_ERROR: " + result.error);
        }`
);

// Add signInDemo to the useAuth destructuring
code = code.replace(
  `const { isInitializing, signInWithGoogle, signInWithGitHub, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();`,
  `const { isInitializing, signInWithGoogle, signInWithGitHub, signInWithEmail, signUpWithEmail, resetPassword, signInDemo } = useAuth();`
);

// Add the dev bypass button at the bottom of the form
code = code.replace(
  `<div className="mt-8 text-sm">`,
  `<div className="mt-4 pt-4 border-t border-zinc-800/50 w-full text-center">
            <button type="button" onClick={signInDemo} className="text-xs text-zinc-600 hover:text-zinc-300 font-mono transition-colors">
              [DEV MODE] Bypass Login &rarr;
            </button>
          </div>
          <div className="mt-4 text-sm">`
);

fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
