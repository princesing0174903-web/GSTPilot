const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

const oldSplash = `  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#030303] gap-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-600/30">
          <Zap className="h-7 w-7 text-white animate-pulse" />
        </div>
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/60 text-sm font-medium">Authenticating...</p>
      </div>
    );
  }`;

const newSplash = `  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#030303] text-zinc-200 font-sans gap-8">
        <BrandLogo variant="icon" size={48} animated={false} disableGlow={true} />
        <div className="flex flex-col items-center gap-4">
          <p className="text-zinc-300 text-sm font-medium">Signing you in...</p>
          <div className="animate-[spin_1.1s_linear_infinite] flex items-center justify-center shrink-0 w-6 h-6">
            <svg viewBox="0 0 100 100" className="w-full h-full text-zinc-500">
              <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="8" fill="none" className="opacity-20" />
              <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray="276" strokeDashoffset="100" />
            </svg>
          </div>
          <p className="text-zinc-500 text-xs tracking-wide">Securing your workspace</p>
        </div>
      </div>
    );
  }`;

code = code.replace(oldSplash, newSplash);

const oldGoogleBtn = `Continue with Google
              </Button>`;
const newGoogleBtn = `{combinedLoading ? '? Signing in...' : 'Continue with Google'}
              </Button>`;

const oldSignInBtn = `>
            {combinedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
          </Button>`;

const newSignInBtn = `>
            {showSuccess ? '? Done' : combinedLoading ? '? Signing in...' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
          </Button>`;

// Let's just do a simpler replace for buttons since they have JSX inside.
// Actually, it's easier to just use string replacement on the JSX.
fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
console.log('LoginPage patched.');
