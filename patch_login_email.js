const fs = require('fs');
let code = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');

// Replace the handleSubmit block
const oldSubmit = `  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLocalError(null);
    // In a real app we would call Firebase auth here for email/pass.
    // For now we just mock a loading state since the user's primary login is Google/GitHub.
    setTimeout(() => {
      setIsLoading(false);
      setShowSuccess(true);
    }, 1500);
  };`;

const newSubmit = `  const { signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [resetSent, setResetSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      setLocalError('Please enter your email address first.');
      return;
    }
    setLocalError(null);
    setIsLoading(true);
    try {
      const res = await resetPassword(email);
      if (res.error) {
        setLocalError(res.error);
      } else {
        setResetSent(true);
      }
    } catch (err: any) {
      setLocalError(err.message || 'Failed to send reset link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLocalError(null);
    
    try {
      if (mode === 'login') {
        const res = await signInWithEmail(email, password);
        if (res.error) {
          setLocalError(res.error);
          setIsLoading(false);
        } else {
          // Success! Leave isLoading true so AppRouter transitions smoothly
          setShowSuccess(true);
        }
      } else {
        // Sign up mode
        const res = await signUpWithEmail(email.split('@')[0], email, password); // Basic name from email
        if (res.error) {
          setLocalError(res.error);
          setIsLoading(false);
        } else {
          setShowSuccess(true);
        }
      }
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed');
      setIsLoading(false);
    }
  };`;

code = code.replace(oldSubmit, newSubmit);

// Replace "Forgot password?" button to call handleResetPassword
code = code.replace(
  `<button type="button" className="text-sm font-medium text-zinc-500 hover:text-white transition-colors">
                  Forgot password?
                </button>`,
  `<button type="button" onClick={handleResetPassword} disabled={isLoading} className="text-sm font-medium text-zinc-500 hover:text-white transition-colors">
                  {resetSent ? 'Check your email' : 'Forgot password?'}
                </button>`
);

fs.writeFileSync('src/components/auth/LoginPage.tsx', code, 'utf8');
