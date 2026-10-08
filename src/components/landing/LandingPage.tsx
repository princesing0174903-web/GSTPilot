
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { ChevronRight, ArrowRight, CheckCircle2, PlayCircle, BarChart3, Bot, LayoutDashboard, Shield, Zap, Globe } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onBookDemo: () => void;
}

export default function LandingPage({ onGetStarted, onBookDemo }: LandingPageProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { staggerChildren: 0.1, delayChildren: 0.2 } 
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, y: 0, 
      transition: { duration: 0.7, ease: [0.25, 0.4, 0.1, 1] } 
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-200 font-sans selection:bg-zinc-800 selection:text-white overflow-x-hidden">
      
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-md bg-[#030303]/80 border-b border-zinc-900/50">
        <div className="flex items-center gap-8">
          <BrandLogo variant="wordmark" size={32} animated={false} disableGlow={true} />
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <a href="#product" className="hover:text-white transition-colors">Product</a>
            <a href="#solutions" className="hover:text-white transition-colors">Solutions</a>
            <a href="#resources" className="hover:text-white transition-colors">Resources</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onGetStarted} className="hidden md:block text-sm font-medium text-zinc-400 hover:text-white transition-colors">Sign in</button>
          <Button onClick={onGetStarted} className="bg-white text-black hover:bg-zinc-200 h-9 px-4 rounded-full text-sm font-medium">
            Get Started
          </Button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-40 pb-20 px-6 md:px-12 flex flex-col items-center justify-center min-h-[90vh]">
        
        {/* Subtle Background Lighting */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/5 rounded-[100%] blur-[120px] pointer-events-none" />

        <motion.div 
          variants={containerVariants} 
          initial="hidden" 
          animate="visible"
          className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-xs font-medium text-zinc-300 mb-8 backdrop-blur-sm">
            <span className="text-emerald-400">?</span> AI-POWERED BUSINESS OS
          </motion.div>

          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
            Your entire business.<br/>
            <span className="text-zinc-500">One intelligent system.</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl font-light">
            Automate operations, understand your data, and make faster decisions from one platform. Say goodbye to scattered tools.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-4 mb-12">
            <Button onClick={onGetStarted} className="bg-white text-black hover:bg-zinc-200 h-12 px-8 rounded-full text-base font-medium w-full sm:w-auto">
              Start Free
            </Button>
            <Button onClick={onBookDemo} variant="outline" className="h-12 px-8 rounded-full border-zinc-800 bg-transparent text-white hover:bg-zinc-900 w-full sm:w-auto flex items-center gap-2">
              See how it works <PlayCircle className="w-4 h-4" />
            </Button>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500 font-medium">
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500/70" /> No credit card</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500/70" /> 14-day free trial</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500/70" /> Setup in minutes</span>
          </motion.div>
        </motion.div>

        {/* HERO MOCKUP */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6, ease: [0.25, 0.4, 0.1, 1] }}
          className="relative mt-24 w-full max-w-6xl mx-auto rounded-xl border border-zinc-800 bg-[#0A0A0A] shadow-2xl overflow-hidden"
        >
          {/* Mockup Header */}
          <div className="h-12 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
            </div>
          </div>
          {/* Mockup Body */}
          <div className="flex h-[400px] md:h-[600px]">
            {/* Sidebar */}
            <div className="hidden md:flex w-64 border-r border-zinc-800/80 bg-zinc-950/50 p-4 flex-col gap-2">
              <div className="h-6 w-24 bg-zinc-800 rounded mb-4" />
              <div className="h-8 w-full bg-zinc-800/80 rounded" />
              <div className="h-8 w-full bg-zinc-900 rounded" />
              <div className="h-8 w-full bg-zinc-900 rounded" />
            </div>
            {/* Main Content */}
            <div className="flex-1 p-6 md:p-10 flex flex-col gap-6">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-xl font-medium text-white mb-1">Revenue Overview</h3>
                  <p className="text-sm text-zinc-500">Last 30 days</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-medium text-white">$128,420</p>
                  <p className="text-sm text-emerald-400">? 24.8% vs last month</p>
                </div>
              </div>
              
              {/* Chart Placeholder */}
              <div className="flex-1 bg-gradient-to-t from-zinc-900/50 to-transparent border border-zinc-800/50 rounded-lg flex items-end p-4 gap-2">
                {[40, 60, 30, 80, 50, 90, 70, 100, 60, 80, 40, 60].map((h, i) => (
                  <div key={i} className="flex-1 bg-zinc-800 rounded-t-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* TRUSTED BY */}
      <section className="py-12 border-y border-zinc-900 bg-[#030303]">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-xs uppercase tracking-widest text-zinc-600 font-semibold mb-8">Trusted by forward-thinking teams</p>
          <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-40 grayscale">
            {/* Faux Logos */}
            <div className="flex items-center gap-2 font-bold text-xl"><Globe className="w-6 h-6"/> Acme Corp</div>
            <div className="flex items-center gap-2 font-bold text-xl"><Zap className="w-6 h-6"/> Globex</div>
            <div className="flex items-center gap-2 font-bold text-xl"><Shield className="w-6 h-6"/> Initech</div>
            <div className="flex items-center gap-2 font-bold text-xl"><BarChart3 className="w-6 h-6"/> Soylent</div>
          </div>
        </div>
      </section>

      {/* THE PROBLEM */}
      <section className="py-32 px-6 md:px-12 max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-semibold text-white tracking-tight mb-4">Stop doing operations manually.</h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">VEYRO replaces fragmented tools with a single unified system powered by artificial intelligence.</p>
        </div>
      </section>

      {/* FEATURES / ONE PLATFORM */}
      <section className="py-24 px-6 md:px-12 bg-zinc-950 border-y border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-5xl font-semibold text-white tracking-tight mb-4">One Platform.<br/><span className="text-zinc-500">Everything Connected.</span></h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-8 rounded-2xl bg-[#0A0A0A] border border-zinc-800 hover:border-zinc-700 transition-colors">
              <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-medium text-white mb-3">Unified Finance</h3>
              <p className="text-zinc-400 leading-relaxed">Invoicing, expenses, and banking natively integrated. Real-time cash flow without the spreadsheet gymnastics.</p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-2xl bg-[#0A0A0A] border border-zinc-800 hover:border-zinc-700 transition-colors">
              <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-medium text-white mb-3">AI Automation</h3>
              <p className="text-zinc-400 leading-relaxed">Automate reconciliation, draft emails, and extract data from receipts instantly. Your AI workforce works 24/7.</p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-2xl bg-[#0A0A0A] border border-zinc-800 hover:border-zinc-700 transition-colors">
              <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-medium text-white mb-3">Deep Intelligence</h3>
              <p className="text-zinc-400 leading-relaxed">Ask questions about your business in plain English. Get instant charts, forecasts, and actionable insights.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CUSTOMER PROOF */}
      <section className="py-32 px-6 md:px-12 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-medium text-white italic mb-8">"VEYRO completely changed how we work. What used to take our finance team three days now takes our AI assistant four minutes."</h2>
        <div className="flex items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full bg-zinc-800" />
          <div className="text-left">
            <p className="text-white font-medium">Sarah Jenkins</p>
            <p className="text-zinc-500 text-sm">COO at TechFlow</p>
          </div>
        </div>
      </section>

      {/* MASSIVE CTA */}
      <section className="py-32 px-6 md:px-12 border-t border-zinc-900 bg-gradient-to-b from-[#030303] to-zinc-950">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-semibold text-white tracking-tight mb-6">Ready to transform your business?</h2>
          <p className="text-lg text-zinc-400 mb-10">Join thousands of modern teams running on VEYRO.</p>
          <Button onClick={onGetStarted} className="bg-white text-black hover:bg-zinc-200 h-14 px-10 rounded-full text-lg font-medium">
            Get Started for Free
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-6 md:px-12 border-t border-zinc-900 bg-[#030303]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <BrandLogo variant="icon" size={24} disableGlow={true} animated={false} />
            <span className="text-zinc-500 text-sm">� 2026 VEYRO Inc. All rights reserved.</span>
          </div>
          <div className="flex gap-8 text-sm font-medium text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">Product</a>
            <a href="#" className="hover:text-white transition-colors">Company</a>
            <a href="#" className="hover:text-white transition-colors">Resources</a>
            <a href="#" className="hover:text-white transition-colors">Legal</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
