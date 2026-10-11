const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

const oldBtn = `{combinedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}`;
const newBtn = `{showSuccess ? '? Done' : combinedLoading ? '? Signing in...' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}`;

code = code.replace(oldBtn, newBtn);
fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
