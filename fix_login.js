const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

if (!code.includes('const [linkEmail, setLinkEmail]')) {
  code = code.replace(
    'const [githubLoading, setGithubLoading] = useState(false);',
    'const [githubLoading, setGithubLoading] = useState(false);\n  const [linkEmail, setLinkEmail] = useState("");'
  );
}

const handleGoogleRegex = /const handleGoogle = async \(\) => \{[\s\S]*?catch \(err: any\) \{/g;
const newHandleGoogle = `const handleGoogle = async () => {
    setLocalError(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result && result.error) {
        if (result.error.includes('Email or password is incorrect')) {
          setLocalError('Account Conflict: An account with this email may already exist. Please sign in with your password to link your Google account.');
        } else {
          setLocalError("Google sign in failed: " + result.error);
        }
        setGoogleLoading(false);
      } else if (result && result.needsAccountLink) {
        setLinkEmail(result.linkingEmail || '');
        setLocalError('Please enter your password to link your Google account to ' + (result.linkingEmail || 'your email') + '.');
        if (result.linkingEmail) setEmail(result.linkingEmail);
        setMode('login');
        setGoogleLoading(false);
      }
      // Otherwise keep loading state true while AppRouter transitions
    } catch (err: any) {`;

code = code.replace(handleGoogleRegex, newHandleGoogle);

const googleButtonRegex = /<div className="w-full space-y-3">[\s\S]*?<Button[\s\S]*?onClick=\{handleGoogle\}[\s\S]*?Continue with Google[\s\S]*?<\/Button>/;
const newGoogleButton = `{!linkEmail && (
          <div className="w-full space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}
              disabled={isAnyLoading}
              className="w-full bg-transparent border-zinc-800 text-white hover:bg-zinc-900 h-11 font-medium"
            >
              {googleLoading ? (
                <>Signing in...</>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="mr-3 h-4 w-4" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>`;
code = code.replace(googleButtonRegex, newGoogleButton);

const githubButtonRegex = /Continue with GitHub[\s\S]*?<\/Button>\s*<\/div>/;
const newGithubButton = `Continue with GitHub
                </>
              )}
            </Button>
          </div>
          )}`;
code = code.replace(githubButtonRegex, newGithubButton);

const separatorRegex = /<div className="relative w-full my-8">[\s\S]*?uppercase">or<\/span>\s*<\/div>\s*<\/div>/;
const newSeparator = `{!linkEmail && (
          <div className="relative w-full my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800/80"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#030303] px-3 text-zinc-500 font-medium tracking-widest uppercase">or</span>
            </div>
          </div>
          )}`;
code = code.replace(separatorRegex, newSeparator);

const emailInputRegex = /<Input\s*type="email"\s*required\s*value=\{email\}/;
const newEmailInput = `<Input
                type="email"
                required
                disabled={!!linkEmail}
                value={email}`;
code = code.replace(emailInputRegex, newEmailInput);

const submitTextRegex = /\{showSuccess \? 'Done' : isLoading \? 'Signing in\.\.\.' : mode === 'login' \? 'Sign in' : 'Sign up'\}/;
const newSubmitText = `{showSuccess ? 'Done' : isLoading ? 'Signing in...' : linkEmail ? 'Link Account & Sign In' : mode === 'login' ? 'Sign in' : 'Sign up'}`;
code = code.replace(submitTextRegex, newSubmitText);

fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
