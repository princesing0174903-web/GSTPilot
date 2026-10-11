const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

// 1. Add linkEmail state
if (!code.includes('const [linkEmail, setLinkEmail]')) {
  code = code.replace(
    `const [githubLoading, setGithubLoading] = useState(false);`,
    `const [githubLoading, setGithubLoading] = useState(false);\n  const [linkEmail, setLinkEmail] = useState('');`
  );
}

// 2. Fix the handleGoogle error handling
const oldGoogleBlock = `        if (result && result.error) {
          // Because Firebase Account Enumeration Protection maps provider conflicts to 'invalid-credential',
          // which friendlyAuthError maps to 'Email or password is incorrect', we provide a clearer message here.
          // However, we must not assume it's a Prisma database conflict. It's a Firebase Auth provider conflict.
          setLocalError('Account Conflict: An account with this email may already exist using a different sign-in method (like Email/Password). Please sign in with your email and password, then you can link your Google account in settings.');
          setGoogleLoading(false);
        } else if (result && result.needsAccountLink) {
          setLocalError('ACCOUNT_LINK_REQUIRED: This email is already associated with an email account. Please sign in with email and password to link your Google account.');
          setGoogleLoading(false);
        }`;

const newGoogleBlock = `        if (result && result.error) {
          if (result.error.includes('Email or password is incorrect')) {
            // Enumeration protection hides the real account-exists error and throws invalid-credential.
            setLocalError('Account Conflict: An account with this email may already exist. Please sign in with your password to link your Google account.');
          } else {
            setLocalError(result.error);
          }
          setGoogleLoading(false);
        } else if (result && result.needsAccountLink) {
          setLinkEmail(result.linkingEmail || '');
          setLocalError('Please enter your password to link your Google account to ' + (result.linkingEmail || 'your email') + '.');
          if (result.linkingEmail) setEmail(result.linkingEmail);
          setMode('login');
          setGoogleLoading(false);
        }`;

code = code.replace(oldGoogleBlock, newGoogleBlock);

// 3. Hide OAuth buttons if linkEmail is set
code = code.replace(
  `<div className="w-full space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}`,
  `{!linkEmail && (
          <div className="w-full space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}`
);

code = code.replace(
  `                  Continue with GitHub
                </>
              )}
            </Button>
          </div>

          <div className="relative w-full my-8">`,
  `                  Continue with GitHub
                </>
              )}
            </Button>
          </div>
          )}

          {!linkEmail && (
          <div className="relative w-full my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800/80"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#030303] px-3 text-zinc-500 font-medium tracking-widest uppercase">or</span>
            </div>
          </div>
          )}`
);

// 4. Update the email input to be disabled if linking
code = code.replace(
  `              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="bg-[#0A0A0A] border-zinc-800 h-11 focus-visible:ring-1 focus-visible:ring-zinc-700 text-white placeholder:text-zinc-600"
              />`,
  `              <Input
                type="email"
                required
                disabled={!!linkEmail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="bg-[#0A0A0A] border-zinc-800 h-11 focus-visible:ring-1 focus-visible:ring-zinc-700 text-white placeholder:text-zinc-600 disabled:opacity-50"
              />`
);

// 5. Update the submit button text
code = code.replace(
  `{showSuccess ? 'Done' : isLoading ? 'Signing in...' : mode === 'login' ? 'Sign in' : 'Sign up'}`,
  `{showSuccess ? 'Done' : isLoading ? 'Signing in...' : linkEmail ? 'Link Account & Sign In' : mode === 'login' ? 'Sign in' : 'Sign up'}`
);

fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
console.log('Fixed LoginPage.tsx UI');
