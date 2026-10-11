const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

// 1. Add linkEmail state
if (!code.includes('const [linkEmail, setLinkEmail]')) {
  code = code.replace(
    'const [githubLoading, setGithubLoading] = useState(false);',
    'const [githubLoading, setGithubLoading] = useState(false);\n  const [linkEmail, setLinkEmail] = useState("");'
  );
}

// 2. Fix handleGoogle error handling
const newHandleGoogle = `  const handleGoogle = async () => {
    setLocalError(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result && result.error) {
        if (result.error.includes('Email or password is incorrect')) {
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
      }
      // Otherwise keep loading state true while AppRouter transitions
    } catch (err: any) {
      setLocalError(err.message || 'Failed to sign in with Google');
      setGoogleLoading(false);
    }
  };`;
code = code.replace(/const handleGoogle = async \(\) => \{[\s\S]*?catch \(err: any\) \{[\s\S]*?\}\s*;\s*\n/m, newHandleGoogle + '\n');

// 3. Conditional rendering for OAuth buttons
const oldOauthContainer = `<div className="w-full space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}`;
const newOauthContainer = `{!linkEmail && (
          <div className="w-full space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}`;
code = code.replace(oldOauthContainer, newOauthContainer);

const oldGithubEnd = `                  Continue with GitHub
                </>
              )}
            </Button>
          </div>

          <div className="relative w-full my-8">`;
const newGithubEnd = `                  Continue with GitHub
                </>
              )}
            </Button>
          </div>
          )}

          {!linkEmail && (
          <div className="relative w-full my-8">`;
code = code.replace(oldGithubEnd, newGithubEnd);

const oldDividerEnd = `            <div className="relative flex justify-center text-xs">
              <span className="bg-[#030303] px-3 text-zinc-500 font-medium tracking-widest uppercase">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">`;
const newDividerEnd = `            <div className="relative flex justify-center text-xs">
              <span className="bg-[#030303] px-3 text-zinc-500 font-medium tracking-widest uppercase">or</span>
            </div>
          </div>
          )}

          <form onSubmit={handleSubmit} className="w-full space-y-4">`;
code = code.replace(oldDividerEnd, newDividerEnd);

const oldEmailInput = `<Input
                type="email"
                required
                value={email}`;
const newEmailInput = `<Input
                type="email"
                required
                disabled={!!linkEmail}
                value={email}`;
code = code.replace(oldEmailInput, newEmailInput);

fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
