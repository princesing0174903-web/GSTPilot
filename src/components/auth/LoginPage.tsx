'use client';

import React, { useState } from 'react';
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
  Building2,
  UserCheck,
  Briefcase,
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
  const { loginWithDemo, isLoading, error, setError, clearError } = useAuth();

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
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  const combinedLoading = isLoading || localLoading;
  const displayError = localError || error;

  // ── Email/Password Sign In ──
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalLoading(true);

    try {
      const { signInWithEmail } = await import('@/lib/auth');
      const { user, error: authError } = await signInWithEmail(email, password);
      if (authError) {
        setLocalError(authError);
        return;
      }
      if (user) {
        setSuccessMessage('Login successful! Redirecting...');
        setShowSuccess(true);
      }
    } catch {
      setLocalError('An unexpected error occurred. Please try again.');
    } finally {
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
      const { signUpWithEmail } = await import('@/lib/auth');
      const { user, error: authError } = await signUpWithEmail(email, password, name);
      if (authError) {
        setLocalError(authError);
        return;
      }
      if (user) {
        setSuccessMessage('Account created! Redirecting to dashboard...');
        setShowSuccess(true);
      }
    } catch {
      setLocalError('An unexpected error occurred. Please try again.');
    } finally {
      setLocalLoading(false);
    }
  };

  // ── Google Sign In (redirect) ──
  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setLocalLoading(true);
    try {
      const { signInWithGoogle } = await import('@/lib/auth');
      await signInWithGoogle();
      // This will redirect the page, so we won't reach here
    } catch {
      setLocalError('Google sign-in failed. Please try again.');
      setLocalLoading(false);
    }
  };

  // ── Forgot Password ──
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalLoading(true);

    try {
      const { resetPassword } = await import('@/lib/auth');
      const { error: resetError } = await resetPassword(email);
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

  // ── Demo Login ──
  const handleDemoLogin = (role: string) => {
    setActiveDemo(role);
    loginWithDemo(role);
    setSuccessMessage('Logged in as demo user!');
    setShowSuccess(true);
    setTimeout(() => setActiveDemo(null), 1000);
  };

  const clearErrors = () => {
    setLocalError(null);
    clearError();
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
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Background effects */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/8 rounded-full blur-3xl" />

        <div className="relative flex flex-col justify-center px-12 xl:px-16">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2.5 mb-12"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-600/20">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">GSTPilot</span>
            <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              AI
            </span>
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-600/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">GSTPilot</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            {/* Back button for non-login modes */}
            {mode !== 'login' && (
              <button
                onClick={() => switchMode('login')}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </button>
            )}
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{modeTitles[mode]}</h2>
            <p className="text-sm text-slate-500 mt-1.5">{modeSubtitles[mode]}</p>
          </div>

          {/* Error State */}
          <AnimatePresence>
            {displayError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 rounded-lg bg-red-50 border border-red-200 p-3.5 flex items-start gap-3"
              >
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">{displayError}</p>
                  <button onClick={clearErrors} className="text-xs text-red-600 hover:text-red-800 mt-1 underline">
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
                className="mb-6 rounded-lg bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">{successMessage}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ FORGOT PASSWORD MODE ═══ */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-sm font-medium text-slate-700">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 pl-10 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                    required
                    disabled={combinedLoading}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={combinedLoading}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 font-semibold"
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
                className="w-full h-11 border-slate-200 hover:bg-slate-50 text-slate-700 font-medium gap-2.5 mb-4"
              >
                {combinedLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Chrome className="h-4 w-4" />
                )}
                Continue with Google
              </Button>

              {/* Divider */}
              <div className="relative my-6">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-slate-400">
                  or {mode === 'login' ? 'sign in' : 'sign up'} with email
                </span>
              </div>

              {/* Email Form */}
              <form onSubmit={mode === 'login' ? handleEmailSignIn : handleSignUp} className="space-y-4">
                {/* Name field (signup only) */}
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium text-slate-700">Full Name</Label>
                    <div className="relative">
                      <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Rajesh Kumar"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-11 pl-10 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                        required
                        disabled={combinedLoading}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 pl-10 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                      required
                      disabled={combinedLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter your password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pl-10 pr-10 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                      required
                      disabled={combinedLoading}
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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
                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                    <Label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">
                      Remember me for 30 days
                    </Label>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={combinedLoading}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 font-semibold"
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
            </>
          )}

          {/* Mode switch links */}
          {mode === 'login' && (
            <>
              {/* Divider */}
              <div className="relative my-6">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-slate-400">
                  quick demo access
                </span>
              </div>

              {/* Demo Logins */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {[
                  { role: 'admin', label: 'Admin', icon: Building2 },
                  { role: 'manager', label: 'Manager', icon: UserCheck },
                  { role: 'staff', label: 'Staff', icon: Briefcase },
                ].map((demo) => (
                  <Button
                    key={demo.role}
                    variant="outline"
                    size="sm"
                    onClick={() => handleDemoLogin(demo.role)}
                    disabled={combinedLoading}
                    className={`h-auto py-2.5 flex-col gap-0.5 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-600 ${
                      activeDemo === demo.role ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : ''
                    }`}
                  >
                    {activeDemo === demo.role ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                    ) : (
                      <demo.icon className="h-3.5 w-3.5" />
                    )}
                    <span className="text-[11px] font-semibold">{demo.label}</span>
                  </Button>
                ))}
              </div>

              {/* Create Account link */}
              <p className="text-center text-sm text-slate-500">
                Don&apos;t have an account?{' '}
                <button onClick={() => switchMode('signup')} className="text-emerald-600 hover:text-emerald-700 font-semibold">
                  Create account
                </button>
              </p>
            </>
          )}

          {mode === 'signup' && (
            <p className="text-center text-sm text-slate-500 mt-4">
              Already have an account?{' '}
              <button onClick={() => switchMode('login')} className="text-emerald-600 hover:text-emerald-700 font-semibold">
                Sign in
              </button>
            </p>
          )}

          {/* Back link */}
          <button
            onClick={onBack}
            className="mt-6 w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            ← Back to homepage
          </button>
        </motion.div>
      </div>
    </div>
  );
}
