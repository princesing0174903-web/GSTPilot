'use client';

import React, { useState } from 'react';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface LoginPageProps {
  onBack?: () => void;
  onGetStarted?: () => void;
}

export default function LoginPage({ onBack, onGetStarted }: LoginPageProps) {
  const { isInitializing, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (isInitializing) {
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
  }

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // In a real app we would call Firebase auth here.
    // For now we just mock a loading state since the user's primary login is Google.
    setTimeout(() => {
      setIsLoading(false);
      setShowSuccess(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#030303] text-zinc-200 font-sans selection:bg-zinc-800 selection:text-white">
      <div className="flex-1 flex flex-col items-center pt-24 px-6 sm:px-12">
        <div className="w-full max-w-[360px] flex flex-col items-center">
          
          <BrandLogo variant="icon" size={40} animated={false} disableGlow={true} />
          
          <div className="mt-8 mb-8 text-center space-y-2">
            <h1 className="text-2xl font-semibold text-white tracking-tight">Welcome back</h1>
            <p className="text-sm text-zinc-400 font-medium">Sign in to continue to VEYRO</p>
          </div>

          <div className="w-full space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}
              disabled={googleLoading || isLoading}
              className="w-full bg-transparent border-zinc-800 text-white hover:bg-zinc-900 h-11 font-medium"
            >
              {googleLoading ? (
                <>? Signing in...</>
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
            </Button>
            
            <Button
              type="button"
              variant="outline"
              disabled={googleLoading || isLoading}
              className="w-full bg-transparent border-zinc-800 text-white hover:bg-zinc-900 h-11 font-medium"
            >
              <svg viewBox="0 0 21 21" className="mr-3 h-4 w-4" aria-hidden="true">
                <path fill="#f25022" d="M1 1h9v9H1z"/>
                <path fill="#7fba00" d="M11 1h9v9h-9z"/>
                <path fill="#00a4ef" d="M1 11h9v9H1z"/>
                <path fill="#ffb900" d="M11 11h9v9h-9z"/>
              </svg>
              Continue with Microsoft
            </Button>
          </div>

          <div className="relative w-full my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800/80"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#030303] px-3 text-zinc-500 font-medium tracking-widest uppercase">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-300">Email</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="bg-[#0A0A0A] border-zinc-800 h-11 focus-visible:ring-1 focus-visible:ring-zinc-700 text-white placeholder:text-zinc-600"
              />
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-300">Password</label>
                <button type="button" className="text-sm font-medium text-zinc-500 hover:text-white transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="���������������"
                  className="bg-[#0A0A0A] border-zinc-800 h-11 focus-visible:ring-1 focus-visible:ring-zinc-700 text-white placeholder:text-zinc-600 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || googleLoading}
              className="w-full bg-white text-black hover:bg-zinc-200 h-11 mt-2 font-medium"
            >
              {showSuccess ? '? Done' : isLoading ? '? Signing in...' : mode === 'login' ? 'Sign in' : 'Sign up'}
            </Button>
          </form>

          <div className="mt-8 text-sm">
            {mode === 'login' ? (
              <p className="text-zinc-400">Don't have an account? <button onClick={() => setMode('signup')} className="text-white font-medium ml-1">Sign up</button></p>
            ) : (
              <p className="text-zinc-400">Already have an account? <button onClick={() => setMode('login')} className="text-white font-medium ml-1">Sign in</button></p>
            )}
          </div>
        </div>
      </div>

      <div className="py-6 flex justify-center items-center gap-4 text-xs font-medium text-zinc-500">
        <a href="#" className="hover:text-white transition-colors">Privacy</a>
        <span>�</span>
        <a href="#" className="hover:text-white transition-colors">Terms</a>
        <span>�</span>
        <a href="#" className="hover:text-white transition-colors">Security</a>
      </div>
    </div>
  );
}
