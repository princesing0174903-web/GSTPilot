const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

// Remove DEV MODE button
code = code.replace(
  /<div className="mt-4 pt-4 border-t border-zinc-800\/50 w-full text-center">[\s\S]*?<\/div>\s*<div className="mt-4 text-sm">/,
  '<div className="mt-8 text-sm">'
);

// Remove signInDemo from useAuth
code = code.replace(
  'const { isInitializing, signInWithGoogle, signInWithGitHub, signInWithEmail, signUpWithEmail, resetPassword, signInDemo } = useAuth();',
  'const { isInitializing, signInWithGoogle, signInWithGitHub, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();'
);

fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
console.log('DEV MODE removed');
