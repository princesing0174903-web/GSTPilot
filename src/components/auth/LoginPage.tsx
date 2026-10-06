'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Eye,
  EyeOff,
  Zap,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  Github,
  CheckCircle2,
} from 'lucide-react';

interface LoginPageProps {
  onBack: () => void;
  onGetStarted: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot';

export default function LoginPage({ onBack, onGetStarted }: LoginPageProps) {
  const {
    isLoading,
    isInitializing,
    error,
    setError,
    signInWithEmail: ctxSignInWithEmail,
    signUpWithEmail: ctxSignUpWithEmail,
    signInWithGoogle: ctxSignInWithGoogle,
    signInWithGitHub: ctxSignInWithGitHub,
    resetPassword: ctxResetPassword,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Google specific states
  const [showNewTabPrompt, setShowNewTabPrompt] = useState(false);
  const [showAccountLinkModal, setShowAccountLinkModal] = useState(false);
  const [linkingEmail, setLinkingEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);

  // Helper
  const displayError = localError || error;
  const combinedLoading = isLoading || localLoading;

  // Clear errors on mode switch
  useEffect(() => {
    setLocalError(null);
    setError(null);
    setShowSuccess(false);
  }, [mode, setError]);

  // If initializing, show splash
  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-600/30">
          <Zap className="h-7 w-7 text-white animate-pulse" />
        </div>
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/60 text-sm font-medium">Authenticating...</p>
      </div>
    );
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalLoading(true);

    try {
      const { error: authError } = await ctxSignInWithEmail(email, password);
      if (authError) {
        setLocalError(authError);
        setLocalLoading(false);
        return;
      }
      setSuccessMessage('Login successful! Redirecting...');
      setShowSuccess(true);
      setLocalLoading(false);
    } catch {
      setLocalError('An unexpected error occurred. Please try again.');
      setLocalLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalLoading(true);

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      setLocalLoading(false);
      return;
    }

    try {
      const { error: authError } = await ctxSignUpWithEmail(name, email, password);
      if (authError) {
        setLocalError(authError);
        setLocalLoading(false);
        return;
      }
      setSuccessMessage('Account created! Please check your email to verify your account.');
      setShowSuccess(true);
      setLocalLoading(false);
    } catch {
      setLocalError('An unexpected error occurred. Please try again.');
      setLocalLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setLocalLoading(true);
    setShowNewTabPrompt(false);
    try {
      const { error: googleError, needsNewTab, needsAccountLink, linkingEmail: resolvedEmail } = await ctxSignInWithGoogle();
      
      if (needsNewTab) {
        setShowNewTabPrompt(true);
        setLocalLoading(false);
      } else if (needsAccountLink) {
        setLinkingEmail(resolvedEmail || email || '');
        setShowAccountLinkModal(true);
        setLocalLoading(false);
      } else if (googleError) {
        setLocalError(googleError);
        setLocalLoading(false);
      } else {
        // Success
        setLocalLoading(false);
      }
    } catch {
      setLocalError('An unexpected error occurred during Google sign-in.');
      setLocalLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setLocalError(null);
    setLocalLoading(true);
    try {
      const { error: githubError, notConfigured } = await ctxSignInWithGitHub();
      if (githubError) {
        setLocalError(
          notConfigured
            ? 'GitHub Sign-In is not configured on this server.'
            : githubError
        );
        setLocalLoading(false);
      }
    } catch {
      setLocalError('An unexpected error occurred during GitHub sign-in.');
      setLocalLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalLoading(true);
    try {
      const { error: authError } = await ctxResetPassword(email);
      if (authError) {
        setLocalError(authError);
      } else {
        setSuccessMessage('Password reset email sent! Check your inbox.');
        setShowSuccess(true);
      }
    } catch {
      setLocalError('Failed to send reset email.');
    }
    setLocalLoading(false);
  };

  const handleAccountLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLinkLoading(true);
    try {
      const { error: authError } = await ctxSignInWithEmail(linkingEmail, linkPassword);
      if (authError) {
        setLocalError(authError);
        setLinkLoading(false);
        return;
      }
      // Success linking!
      setLinkSuccess(true);
      setTimeout(() => {
        setLinkLoading(false);
        setShowAccountLinkModal(false);
      }, 1500);
    } catch {
      setLocalError('Failed to sign in. Please try again.');
      setLinkLoading(false);
    }
  };

  const handleOpenInNewTab = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/?googleSignIn=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex min-h-screen w-full bg-[#030303] text-zinc-200 selection:bg-emerald-500/30 font-sans overflow-hidden">
      
      {/* LEFT PANEL: Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 border-r border-zinc-900 bg-zinc-950/50">
        
        {/* Subtle Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
          <motion.div 
            animate={{ 
              backgroundPosition: ['0% 0%', '100% 100%'],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03)_0,transparent_50%)]"
          />
        </div>

        <div className="relative z-10">
          <BrandLogo size="lg" className="text-white" />
          <div className="mt-8 flex flex-col gap-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs font-medium text-zinc-400 backdrop-blur-md w-fit"
            >
              <Zap className="mr-2 h-3 w-3 text-emerald-500" />
              GSTPilot Infinity™
            </motion.div>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-6 leading-[1.1]"
          >
            The Financial Brain<br />
            <span className="text-zinc-500">of India.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="text-zinc-400 text-lg leading-relaxed font-light"
          >
            Intelligent financial operations, GST compliance, and enterprise control in one unified system.
          </motion.p>
        </div>
      </div>

      {/* RIGHT PANEL: Auth Card */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[420px] mx-auto">
          
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="bg-[#0A0A0A] border border-zinc-800/60 rounded-2xl p-8 shadow-2xl relative overflow-hidden"
          >
            {/* Top Right decorative gradient */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 blur-[40px] rounded-full pointer-events-none" />

            <div className="flex flex-col gap-2 mb-8">
              <div className="lg:hidden mb-4">
                <BrandLogo size="md" className="text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-white tracking-tight">
                {mode === 'login' && 'Welcome back'}
                {mode === 'signup' && 'Create your account'}
                {mode === 'forgot' && 'Reset password'}
              </h2>
              <p className="text-sm text-zinc-500">
                {mode === 'login' && 'Sign in to access your GSTPilot workspace.'}
                {mode === 'signup' && 'Get started with GSTPilot Infinity.'}
                {mode === 'forgot' && 'Enter your email to receive a reset link.'}
              </p>
            </div>

            {/* Error / Success Alerts */}
            <AnimatePresence mode="wait">
              {displayError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 flex items-start gap-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400"
                >
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{displayError}</div>
                </motion.div>
              )}
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 flex items-start gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-400"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{successMessage}</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Iframe Google Prompt */}
            {showNewTabPrompt && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 rounded-lg bg-zinc-900 border border-zinc-800 p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <h4 className="text-sm font-medium text-amber-500">Preview Mode Detected</h4>
                </div>
                <p className="text-xs text-zinc-400 mb-4">
                  Google blocks sign-in within preview iframes. Open the app in a new tab to continue.
                </p>
                <Button onClick={handleOpenInNewTab} className="w-full bg-white text-black hover:bg-zinc-200">
                  Open in New Tab
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            )}

            <form
              onSubmit={
                mode === 'login'
                  ? handleEmailSignIn
                  : mode === 'signup'
                  ? handleSignUp
                  : handleForgotPassword
              }
              className="flex flex-col gap-4"
            >
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <Label className="text-zinc-400">Full Name</Label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800 text-white focus:border-emerald-500/50 transition-colors"
                    placeholder="John Doe"
                    required
                    disabled={combinedLoading}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-zinc-400">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 bg-zinc-900/50 border-zinc-800 text-white focus:border-emerald-500/50 transition-colors"
                    placeholder="you@company.com"
                    required
                    disabled={combinedLoading}
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <Label className="text-zinc-400">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 bg-zinc-900/50 border-zinc-800 text-white focus:border-emerald-500/50 transition-colors pr-10"
                      placeholder="••••••••"
                      required
                      disabled={combinedLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'login' && (
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="rememberMe"
                      checked={rememberMe}
                      onCheckedChange={(c) => setRememberMe(c as boolean)}
                      className="border-zinc-700 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                    <Label htmlFor="rememberMe" className="text-xs text-zinc-400 cursor-pointer">
                      Remember me
                    </Label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                disabled={combinedLoading}
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.25)] h-11"
              >
                {combinedLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {mode === 'login' && 'Sign in'}
                    {mode === 'signup' && 'Create account'}
                    {mode === 'forgot' && 'Send reset link'}
                    <ArrowRight className="ml-2 h-4 w-4 opacity-70" />
                  </>
                )}
              </Button>
            </form>

            {/* OAuth Separator */}
            {mode !== 'forgot' && (
              <>
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-wider">
                    <span className="bg-[#0A0A0A] px-2 text-zinc-500 font-medium">Or continue with</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={combinedLoading}
                    onClick={handleGoogleSignIn}
                    className="w-full h-11 bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-all"
                  >
                    {combinedLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                    )}
                    Google
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={combinedLoading}
                    onClick={handleGitHubSignIn}
                    className="w-full h-11 bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-all"
                  >
                    {combinedLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Github className="mr-2 h-4 w-4" />
                    )}
                    GitHub
                  </Button>
                </div>
              </>
            )}

            {/* Bottom Links */}
            <div className="mt-8 text-center text-sm text-zinc-500">
              {mode === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button onClick={() => setMode('signup')} className="text-emerald-500 hover:text-emerald-400 font-medium transition-colors">
                    Sign up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button onClick={() => setMode('login')} className="text-emerald-500 hover:text-emerald-400 font-medium transition-colors">
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ACCOUNT LINKING MODAL */}
      <AnimatePresence>
        {showAccountLinkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => !linkLoading && setShowAccountLinkModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-[#0A0A0A] border border-zinc-800/80 rounded-2xl shadow-2xl p-6 sm:p-8"
            >
              <div className="mb-6 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800">
                  {linkSuccess ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  ) : (
                    <ShieldCheck className="h-6 w-6 text-emerald-500" />
                  )}
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-white text-center mb-2">
                Connect your Google Account
              </h3>
              <p className="text-sm text-zinc-400 text-center mb-6 leading-relaxed">
                The Google account <strong className="text-zinc-200">{linkingEmail}</strong> already has a GSTPilot account. Please enter your existing password to securely link them.
              </p>

              {displayError && !linkSuccess && (
                <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex gap-2 items-start">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{displayError}</span>
                </div>
              )}

              {linkSuccess ? (
                <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center">
                  <p className="font-medium">Google connected successfully!</p>
                  <p className="text-sm opacity-80 mt-1">Taking you to dashboard...</p>
                </div>
              ) : (
                <form onSubmit={handleAccountLinkSignIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-400">Password for {linkingEmail}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                      <Input
                        type="password"
                        value={linkPassword}
                        onChange={(e) => setLinkPassword(e.target.value)}
                        className="pl-9 bg-zinc-900/50 border-zinc-800 text-white focus:border-emerald-500/50"
                        placeholder="••••••••"
                        required
                        disabled={linkLoading}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-4">
                    <Button
                      type="submit"
                      disabled={linkLoading || !linkPassword}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-11"
                    >
                      {linkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in & Connect Google'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowAccountLinkModal(false)}
                      disabled={linkLoading}
                      className="w-full text-zinc-400 hover:text-white hover:bg-zinc-900 h-11"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
