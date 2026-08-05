'use client';

import React, { useState, useEffect } from 'react';
import { BrandLogo } from '@/components/brand';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import {
  Zap,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Brain,
  FileText,
  Loader2,
  AlertCircle,
  Chrome,
  UserPlus,
  ArrowLeft,
  KeyRound,
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
    signInDemo,
    signInWithEmail: ctxSignInWithEmail,
    signUpWithEmail: ctxSignUpWithEmail,
    signInWithGoogle: ctxSignInWithGoogle,
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
  const [showNewTabPrompt, setShowNewTabPrompt] = useState(false);

  const combinedLoading = isLoading || localLoading;
  const displayError = localError || error;

  // ── Show loading screen while Firebase processes redirect result ──
  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-600/30 glow-accent-btn">
          <Zap className="h-7 w-7 text-white animate-pulse" />
        </div>
        <div className="spinner-premium" />
        <p className="text-white/60 text-sm font-medium">Completing sign in...</p>
      </div>
    );
  }

  // ── Email/Password Sign In ──
  // Uses the AuthContext's wrapped method so `isLoading` is driven correctly
  // (gating the "Redirecting…" card) and OrgContext clears it when the org
  // resolves. No dynamic import — avoids Turbopack ChunkLoadError.
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
      // Clear localLoading — AppRouter will switch to 'app' immediately
      // when isAuthenticated becomes true.
      setLocalLoading(false);
    } catch {
      setLocalError('An unexpected error occurred. Please try again.');
      setLocalLoading(false);
    }
  };

  // ── Email Sign Up ──
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

  // ── Google Sign In (popup with redirect fallback) ──
  // Inside an iframe (sandbox preview), Google OAuth cannot run — Google
  // blocks cross-origin iframes. We detect this and show an "Open in new tab"
  // prompt instead of failing silently.
  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setLocalLoading(true);
    setShowNewTabPrompt(false);
    try {
      const { error: googleError, needsNewTab } = await ctxSignInWithGoogle();
      if (needsNewTab) {
        // Iframe detected — show the "Open in new tab" prompt.
        setShowNewTabPrompt(true);
        setLocalLoading(false);
      } else if (googleError) {
        setLocalError(googleError);
        setLocalLoading(false);
      } else {
        setLocalLoading(false);
      }
    } catch {
      setLocalError('An unexpected error occurred during Google sign-in. Please try again.');
      setLocalLoading(false);
    }
  };

  // ── Open Google sign-in in a new top-level tab ──
  // The new tab opens at the same origin with ?googleSignIn=1, which
  // triggers signInWithPopup automatically (top-level windows can do OAuth).
  const handleOpenInNewTab = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/?googleSignIn=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ── Forgot Password ──
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalLoading(true);

    try {
      const { error: resetError } = await ctxResetPassword(email);
      if (resetError) {
        setLocalError(resetError);
        return;
      }
      setSuccessMessage('Password reset email sent! Check your inbox.');
      setShowSuccess(true);
    } catch {
      setLocalError('Failed to send reset email. Please try again.');
    } finally {
      setLocalLoading(false);
    }
  };

  const clearErrors = () => {
    setLocalError(null);
    setError(null);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    clearErrors();
    setShowSuccess(false);
  };

  const leftBenefits = [
    { icon: Brain, title: 'AI-Powered Extraction', desc: '99.9% accuracy on GST invoices' },
    { icon: ShieldCheck, title: 'Automated Validation', desc: 'GSTIN, HSN, tax checks in seconds' },
    { icon: FileText, title: 'One-Click Filing', desc: 'GSTR-1/3B prepared automatically' },
    { icon: CheckCircle2, title: 'Audit Ready', desc: 'Complete compliance trail' },
  ];

  const modeTitles: Record<AuthMode, string> = {
    login: 'Sign in to your account',
    signup: 'Create your account',
    forgot: 'Reset your password',
  };

  const modeSubtitles: Record<AuthMode, string> = {
    login: 'Enter your credentials to access your workspace',
    signup: 'Start your free trial — no credit card required',
    forgot: 'We\'ll send you a link to reset your password',
  };

  return (
    <div className="min-h-screen flex bg-black">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-black via-[#050507] to-black">
        {/* Background effects */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#3B82F6]/8 rounded-full blur-3xl" />

        <div className="relative flex flex-col justify-center px-12 xl:px-16">
          {/* Logo — Official GSTPilot™ brand (fade + scale + glow, 0.8s) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }}
            className="flex items-center gap-3 mb-12"
          >
            <BrandLogo variant="horizontal" theme="dark" size={48} showTagline animated />
          </motion.div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-3">
              Welcome back to your
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
                GST Command Center
              </span>
            </h1>
            <p className="text-slate-400 text-base max-w-md">
              Sign in to manage compliance, file returns, and keep your clients audit-ready.
            </p>
          </motion.div>

          {/* Benefits */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-10 space-y-5"
          >
            {leftBenefits.map((benefit, i) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className="flex items-start gap-3.5"
              >
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <benefit.icon className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{benefit.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{benefit.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Floating visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-12 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium">Live Dashboard</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/10 p-2.5 text-center">
                <p className="text-lg font-bold text-emerald-400">94</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Health</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/10 p-2.5 text-center">
                <p className="text-lg font-bold text-blue-400">128</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Filed</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/10 p-2.5 text-center">
                <p className="text-lg font-bold text-amber-400">12</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Pending</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-black">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo — Official GSTPilot™ brand */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }}
            className="lg:hidden flex items-center gap-2.5 mb-8 justify-center"
          >
            <BrandLogo variant="horizontal" theme="dark" size={40} showTagline animated />
          </motion.div>

          {/* Header */}
          <div className="mb-8">
            {/* Back button for non-login modes */}
            {mode !== 'login' && (
              <button
                onClick={() => switchMode('login')}
                className="flex items-center gap-1 text-sm text-white/50 hover:text-white mb-4 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </button>
            )}
            <h2 className="text-2xl font-bold text-white tracking-tight">{modeTitles[mode]}</h2>
            <p className="text-sm text-white/55 mt-1.5">{modeSubtitles[mode]}</p>
          </div>

          {/* Error State */}
          <AnimatePresence>
            {displayError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 flex items-start gap-3"
              >
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-200">{displayError}</p>
                  <button onClick={clearErrors} className="text-xs text-red-400 hover:text-red-300 mt-1 underline">
                    Dismiss
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success State */}
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-200">{successMessage}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ FORGOT PASSWORD MODE ═══ */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-sm font-medium text-white/75">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 pl-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20"
                    required
                    disabled={combinedLoading}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={combinedLoading}
                className="w-full h-11 bg-white text-black hover:bg-white/90 press-scale glow-accent-btn rounded-xl font-semibold"
              >
                {combinedLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending reset link...</>
                ) : (
                  <><KeyRound className="mr-2 h-4 w-4" />Send Reset Link</>
                )}
              </Button>
            </form>
          )}

          {/* ═══ LOGIN & SIGNUP MODE ═══ */}
          {mode !== 'forgot' && (
            <>
              {/* Google Sign In */}
              <Button
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={combinedLoading}
                className="w-full h-11 glass-surface border-white/[0.10] hover:bg-white/[0.06] text-white font-medium gap-2.5 mb-4 press-scale rounded-xl"
              >
                {combinedLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Chrome className="h-4 w-4" />
                )}
                Continue with Google
              </Button>

              {/* Open in new tab prompt — shown when iframe is detected */}
              <AnimatePresence>
                {showNewTabPrompt && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-200 mb-1">
                          Google sign-in needs a new tab
                        </p>
                        <p className="text-xs text-amber-100/70 mb-3 leading-relaxed">
                          The preview panel blocks Google's pop-up. Open the app in a new tab to complete sign-in securely.
                        </p>
                        <button
                          onClick={handleOpenInNewTab}
                          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 text-xs font-semibold transition-colors press-scale"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                          Open in new tab
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Divider */}
              <div className="relative my-6">
                <Separator className="bg-white/[0.08]" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black px-3 text-xs text-white/40">
                  or {mode === 'login' ? 'sign in' : 'sign up'} with email
                </span>
              </div>

              {/* Email Form */}
              <form onSubmit={mode === 'login' ? handleEmailSignIn : handleSignUp} className="space-y-4">
                {/* Name field (signup only) */}
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium text-white/75">Full Name</Label>
                    <div className="relative">
                      <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Rajesh Kumar"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-11 pl-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20"
                        required
                        disabled={combinedLoading}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-white/75">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 pl-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20"
                      required
                      disabled={combinedLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-white/75">Password</Label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-xs text-[#3B82F6] hover:text-[#60A5FA] font-medium"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter your password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pl-10 pr-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20"
                      required
                      disabled={combinedLoading}
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {mode === 'login' && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                      className="data-[state=checked]:bg-[#3B82F6] data-[state=checked]:border-[#3B82F6] border-white/[0.12]"
                    />
                    <Label htmlFor="remember" className="text-sm text-white/60 cursor-pointer">
                      Remember me for 30 days
                    </Label>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={combinedLoading}
                  className="w-full h-11 bg-white text-black hover:bg-white/90 press-scale glow-accent-btn rounded-xl font-semibold"
                >
                  {combinedLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                    </>
                  ) : (
                    <>
                      {mode === 'login' ? 'Sign In' : 'Create Account'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Local workspace — explore the platform without an account */}
              <div className="mt-6 pt-6 border-t border-white/[0.06]">
                <p className="text-center text-xs text-white/35 mb-3">
                  Want to look around first? Start a local workspace.
                </p>
                <button
                  onClick={signInDemo}
                  className="w-full h-10 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.04] border border-white/[0.08] transition-all press-scale"
                >
                  Explore the platform
                </button>
              </div>
            </>
          )}

          {/* Mode switch links */}
          {mode === 'login' && (
            <>
              {/* Create Account link */}
              <div className="mt-6">
                <p className="text-center text-sm text-white/50">
                  Don&apos;t have an account?{' '}
                  <button onClick={() => switchMode('signup')} className="text-[#3B82F6] hover:text-[#60A5FA] font-semibold">
                    Create account
                  </button>
                </p>
              </div>
            </>
          )}

          {mode === 'signup' && (
            <p className="text-center text-sm text-white/50 mt-4">
              Already have an account?{' '}
              <button onClick={() => switchMode('login')} className="text-[#3B82F6] hover:text-[#60A5FA] font-semibold">
                Sign in
              </button>
            </p>
          )}

          {/* Back link */}
          <button
            onClick={onBack}
            className="mt-6 w-full text-center text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            ← Back to homepage
          </button>
        </motion.div>
      </div>
    </div>
  );
}
