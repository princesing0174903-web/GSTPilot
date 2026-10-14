'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, CheckCircle2, Zap, Shield, Sparkles, Layers, 
  Cpu, ArrowRight, BarChart3, Lock, FileText, Database,
  Workflow, Users, Compass, Code, Server, HelpCircle,
  Building2, Globe, Scale
} from 'lucide-react';

export type PublicPageType = 
  | 'product' 
  | 'solutions' 
  | 'resources' 
  | 'pricing' 
  | 'company' 
  | 'legal' 
  | 'privacy' 
  | 'security' 
  | 'terms';

interface PublicInfoPageProps {
  page: PublicPageType;
  onBack: () => void;
  onGetStarted: () => void;
  onNavigatePage: (page: PublicPageType) => void;
}

export default function PublicInfoPage({
  page,
  onBack,
  onGetStarted,
  onNavigatePage,
}: PublicInfoPageProps) {

  const handleNav = (target: PublicPageType) => {
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState(null, '', `/#${target}`);
      } catch {
        // ignore
      }
    }
    if (onNavigatePage) {
      onNavigatePage(target);
    } else if (typeof window !== 'undefined') {
      window.location.href = `/${target}`;
    }
  };

  const pageData: Record<PublicPageType, {
    badge: string;
    title: string;
    highlight: string;
    description: string;
    features: { title: string; desc: string; icon: any }[];
    sections?: { heading: string; body: string[] }[];
    ctaTitle: string;
    ctaSub: string;
  }> = {
    product: {
      badge: 'THE VEYRO PLATFORM',
      title: 'The Autonomous Business Engine,',
      highlight: 'Engineered for Scale.',
      description: 'VEYRO consolidates ERP, automated accounting, AI invoice intelligence, and compliance workflows into one seamless, unified operating system.',
      features: [
        {
          title: 'Autonomous Financial Hub',
          desc: 'Instant double-entry bookkeeping, smart multi-bank reconciliations, and continuous cash flow monitoring without manual effort.',
          icon: Zap
        },
        {
          title: 'Oracle AI Executive Intelligence',
          desc: 'Deep conversational data moat with multi-turn analytics, forward-looking cash forecasting, and autonomous decision routing.',
          icon: Cpu
        },
        {
          title: 'Full Spectrum Compliance Engine',
          desc: 'Automated GST, TDS, e-invoicing, and regulatory ledger alignment built with bulletproof multi-tenant separation.',
          icon: Shield
        },
        {
          title: 'Real-time Workflow Fabric',
          desc: 'Event-driven triggers, collaborative multi-firm management, and automated document processing pipelines.',
          icon: Layers
        }
      ],
      ctaTitle: 'Build your business on VEYRO',
      ctaSub: 'Experience zero-friction operations with intelligent automation.'
    },

    solutions: {
      badge: 'ENTERPRISE & SME SOLUTIONS',
      title: 'Architected for High-Growth Companies',
      highlight: 'and Modern Accounting Firms.',
      description: 'Whether scaling a multi-entity conglomerate or running an agile advisory practice, VEYRO adapts precisely to your operational workflow.',
      features: [
        {
          title: 'For Modern Enterprises',
          desc: 'Automate multi-entity consolidated financials, cross-subsidiary billing, and centralized treasury controls with role-based access.',
          icon: Building2
        },
        {
          title: 'For Advisory & CA Firms',
          desc: 'Manage hundreds of client workspaces effortlessly with single-pane monitoring, auto-reconciliation, and zero client data crosstalk.',
          icon: Users
        },
        {
          title: 'For High-Velocity Tech Startups',
          desc: 'Connect Stripe, banking, and vendor invoices directly. Ship products while VEYRO keeps your balance sheet audit-ready 24/7.',
          icon: Sparkles
        },
        {
          title: 'For Global Supply Chains',
          desc: 'Automate high-volume vendor invoice capture, tax withholding (TDS), three-way purchase order matching, and dynamic payments.',
          icon: Globe
        }
      ],
      ctaTitle: 'Ready to modernize your operations?',
      ctaSub: 'Schedule a tailored architecture walkthrough with our engineering team.'
    },

    resources: {
      badge: 'DEVELOPER & KNOWLEDGE HUB',
      title: 'Comprehensive Guides,',
      highlight: 'APIs, and Documentation.',
      description: 'Everything you need to integrate, scale, and master the VEYRO AI Operating System.',
      features: [
        {
          title: 'Developer Platform & Webhooks',
          desc: 'Integrate custom microservices, accounting feeds, and custom banking channels using standard REST & Webhook endpoints.',
          icon: Code
        },
        {
          title: 'Financial Intelligence Guides',
          desc: 'Best practices for managing autonomous tax compliance, cash velocity optimization, and predictive financial models.',
          icon: Compass
        },
        {
          title: 'System Architecture Blueprints',
          desc: 'In-depth documentation detailing data encryption, tenant isolation boundaries, and fail-safe redundancy clusters.',
          icon: Server
        },
        {
          title: '24/7 Expert Support & Knowledgebase',
          desc: 'Dedicated enterprise Slack channels, priority response SLAs, and direct access to senior financial platform architects.',
          icon: HelpCircle
        }
      ],
      ctaTitle: 'Explore the VEYRO ecosystem',
      ctaSub: 'Read our technical documentation and get started with real APIs.'
    },

    pricing: {
      badge: 'TRANSPARENT VALUE',
      title: 'Simple, Predictable Pricing',
      highlight: 'Built to Scale with You.',
      description: 'Start free with zero friction. Upgrade as your transaction volume and operational intelligence demands expand.',
      features: [
        {
          title: 'Starter — Free Forever',
          desc: 'Perfect for startups and independent consultants. Automated invoices, Google & GitHub SSO, and core bookkeeping features.',
          icon: CheckCircle2
        },
        {
          title: 'Professional — $49 / mo',
          desc: 'For growing companies. Unlimited automated bank reconciliations, custom invoicing templates, and automated tax filings.',
          icon: BarChart3
        },
        {
          title: 'Enterprise — Custom Volume',
          desc: 'For large teams and advisory networks. Dedicated Oracle AI instances, custom API integrations, SLA guarantees, and enterprise compliance.',
          icon: Shield
        },
        {
          title: 'Zero Hidden Fees',
          desc: 'No credit card required to start. Cancel anytime with instant, automated data exports in standard open formats.',
          icon: Sparkles
        }
      ],
      ctaTitle: 'Start your 14-day free trial',
      ctaSub: 'No credit card required. Full access to all platform features.'
    },

    company: {
      badge: 'OUR MISSION',
      title: 'Powering the Next Era of',
      highlight: 'Autonomous Business Operations.',
      description: 'VEYRO was founded on a simple thesis: modern businesses should not be trapped in fragmented, manual tools from the 1990s. We build software that works for you.',
      features: [
        {
          title: 'Engineering-First Culture',
          desc: 'We are builders, systems designers, and financial software veterans focused relentlessly on performance, security, and elegance.',
          icon: Cpu
        },
        {
          title: 'Obsessed with Reliability',
          desc: 'Finance systems cannot fail. Every database write, state transition, and authentication handshake is guaranteed with extreme rigor.',
          icon: Server
        },
        {
          title: 'Global by Design',
          desc: 'Built to handle multi-currency, multi-jurisdiction compliance and multi-cloud infrastructure right out of the box.',
          icon: Globe
        },
        {
          title: 'Customer Autonomy',
          desc: 'Your business data belongs to you. Zero proprietary lock-in with one-click exportable financial ledgers and event streams.',
          icon: Lock
        }
      ],
      ctaTitle: 'Join thousands of modern businesses',
      ctaSub: 'See why forward-thinking companies trust VEYRO every day.'
    },

    legal: {
      badge: 'LEGAL & COMPLIANCE',
      title: 'Legal Terms, Governance,',
      highlight: 'and Compliance Standards.',
      description: 'Transparent terms governing your use of the VEYRO platform, our service commitments, and mutual data responsibilities.',
      features: [
        {
          title: 'Enterprise Master Service Agreement',
          desc: 'Industry-standard SLAs, high availability uptime commitments (99.95%), and clear operational transparency.',
          icon: Scale
        },
        {
          title: 'Data Processing Addendum (DPA)',
          desc: 'Full GDPR and localized digital data protection compliance safeguarding customer data processing.',
          icon: FileText
        },
        {
          title: 'Customer Data Ownership',
          desc: 'You retain complete, exclusive ownership of all customer files, transaction ledgers, invoices, and organization data.',
          icon: Database
        },
        {
          title: 'Security Certifications',
          desc: 'Continuous auditing, encrypted data at rest and in transit, and regular third-party vulnerability scans.',
          icon: Shield
        }
      ],
      ctaTitle: 'Have compliance questions?',
      ctaSub: 'Contact our security and legal team for enterprise compliance documentation.'
    },

    privacy: {
      badge: 'DATA PRIVACY',
      title: 'Your Privacy and Data Rights',
      highlight: 'Are Non-Negotiable.',
      description: 'How VEYRO collects, protects, and strictly processes your information with uncompromising cryptographic isolation.',
      features: [
        {
          title: 'Zero Third-Party Data Selling',
          desc: 'We will never sell, rent, or monetize your company financial information, invoices, or customer databases. Period.',
          icon: Lock
        },
        {
          title: 'Granular Multi-Tenant Isolation',
          desc: 'Every organization is partitioned securely. Strict database row-level security and tenant boundaries prevent any cross-leakage.',
          icon: Shield
        },
        {
          title: 'Right to Erase & Portability',
          desc: 'Export your entire company ledger in open JSON / CSV formats at any time, or request complete account erasure with 1 click.',
          icon: Database
        },
        {
          title: 'SOC2 & GDPR Aligned Privacy Controls',
          desc: 'Strict role-based permissions, automated access logging, and credential masking on all platform logs.',
          icon: FileText
        }
      ],
      sections: [
        {
          heading: '1. Information We Collect and Process',
          body: [
            'We collect information necessary to operate your financial workflows: authentication identifiers (email, name, OAuth tokens from Google or GitHub), organization details, GSTIN tax identifiers, customer invoice metadata, bank ledger transactions, and audit timestamps.',
            'We strictly do not collect biometric identifiers, sensitive personal health records, or credit card numbers directly. Payments and bank verifications are handled through PCI-DSS Level 1 compliant gateways.'
          ]
        },
        {
          heading: '2. Zero Data Selling Commitment',
          body: [
            'VEYRO does not sell, rent, license, or monetize your company data or customer lists to any advertising network, data broker, or commercial third party under any circumstances.',
            'Your financial data is used solely to deliver the autonomous ERP, accounting, invoice generation, tax reconciliation, and Oracle AI assistance features you explicitly configure.'
          ]
        },
        {
          heading: '3. Multi-Tenant Cryptographic Isolation',
          body: [
            'Every organization within VEYRO is isolated with strict PostgreSQL row-level security and tenant-scoped Prisma middleware.',
            'No user or system query can bridge tenant boundaries. Access to organization ledgers requires validated cryptographic session tokens with verified active membership in that organization.'
          ]
        },
        {
          heading: '4. Data Retention, Portability & Deletion Rights',
          body: [
            'You retain full, unconditional ownership of all business records. You can export complete financial ledgers, invoice archives, and contact records in open JSON and CSV formats at any time.',
            'Upon organization workspace deletion or account termination, all corresponding databases, cached files, and credentials are permanently purged within 30 days in compliance with right-to-be-forgotten standards.'
          ]
        },
        {
          heading: '5. Regulatory Compliance & Global Standards',
          body: [
            'Our architecture is designed to comply with the European Union General Data Protection Regulation (GDPR), California Consumer Privacy Act (CCPA), and India Digital Personal Data Protection Act (DPDP Act 2023).',
            'All data processors and cloud service providers we utilize undergo rigorous enterprise security auditing and execute binding Data Processing Addendums (DPAs).'
          ]
        }
      ],
      ctaTitle: 'Review our complete commitment',
      ctaSub: 'Designed to protect the most sensitive financial records in the world.'
    },

    security: {
      badge: 'ENTERPRISE SECURITY',
      title: 'Defense in Depth Architecture,',
      highlight: 'Zero Compromise.',
      description: 'Security is not an afterthought at VEYRO — it is the bedrock foundation of every architectural decision we make.',
      features: [
        {
          title: 'End-to-End Encryption',
          desc: 'All communications secured with TLS 1.3 in transit and AES-256 encryption at rest across all databases and file stores.',
          icon: Lock
        },
        {
          title: 'Google & GitHub SSO Protection',
          desc: 'Enterprise OAuth 2.0 with session revocation, automated CSRF prevention, and biometric MFA integration.',
          icon: Zap
        },
        {
          title: 'Continuous Threat Intelligence',
          desc: 'Real-time anomaly monitoring, automated penetration tests, and instant security patch deployment pipelines.',
          icon: Shield
        },
        {
          title: 'Audited Database Backups',
          desc: 'Point-in-time recovery, distributed geographical replication, and automated disaster failover guarantees.',
          icon: Server
        }
      ],
      sections: [
        {
          heading: '1. Infrastructure and Network Defense',
          body: [
            'VEYRO is hosted on top-tier global cloud infrastructure protected by multi-layered DDoS mitigation, Web Application Firewalls (WAF), and automated intrusion prevention systems.',
            'All public and internal network communications are enforced over TLS 1.3 with Strict Transport Security (HSTS) and ephemeral Elliptic Curve Diffie-Hellman key exchanges.'
          ]
        },
        {
          heading: '2. Cryptographic Storage & Encryption at Rest',
          body: [
            'Production databases, storage volumes, and file backups are encrypted at rest using AES-256 with automatically rotated cryptographic keys managed by Hardware Security Modules (HSMs).',
            'Sensitive authentication secrets, API keys, and third-party integration tokens are double-encrypted with salted envelope cryptography prior to persistence.'
          ]
        },
        {
          heading: '3. Identity, SSO, and Access Controls',
          body: [
            'User authentication is powered by Google Identity Services and GitHub OAuth with biometric MFA support, session revocation on device change, and rate-limited brute-force guards.',
            'Administrative access to production clusters requires zero-trust ephemeral certificates, multi-party authorization, and comprehensive hardware-bound security keys.'
          ]
        },
        {
          heading: '4. Continuous Monitoring & Automated Vulnerability Auditing',
          body: [
            'We run automated static analysis (SAST), software composition analysis (SCA), and dynamic application security testing (DAST) on every git commit and pull request.',
            'Audit trails capture every sensitive administrative operation, login attempt, role update, and data export with tamper-evident, append-only logging.'
          ]
        },
        {
          heading: '5. Disaster Recovery and Incident Response',
          body: [
            'High-availability database replication ensures continuous failover across independent availability zones. Encrypted snapshots provide point-in-time recovery with a Recovery Point Objective (RPO) of under 5 minutes.',
            'Our dedicated security incident team maintains 24/7 on-call rotation with a maximum 15-minute SLA for critical threat escalation.'
          ]
        }
      ],
      ctaTitle: 'Security that enterprise teams trust',
      ctaSub: 'Built with the highest standards of financial cryptography.'
    },

    terms: {
      badge: 'TERMS OF SERVICE',
      title: 'Terms of Service',
      highlight: '& Operational Agreement.',
      description: 'Clear, straightforward terms regarding account usage, billing subscriptions, and platform availability.',
      features: [
        {
          title: 'Account Responsibilities',
          desc: 'Maintain authorized credentials, protect your authentication keys, and ensure authorized organization member access.',
          icon: Users
        },
        {
          title: 'Subscription & Billing Terms',
          desc: 'Transparent recurring billing, fair usage allowances, and clear refund guidelines for all subscription tiers.',
          icon: BarChart3
        },
        {
          title: 'Acceptable Use Guidelines',
          desc: 'Designed exclusively for legitimate commercial, accounting, invoicing, and business management workflows.',
          icon: Scale
        },
        {
          title: 'Service Continuity Guarantees',
          desc: 'Committed to maintaining uninterrupted platform operations with redundant cloud infrastructure.',
          icon: Server
        }
      ],
      sections: [
        {
          heading: '1. Agreement to Terms and Platform Scope',
          body: [
            'By accessing or using the VEYRO platform, you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a company or other legal entity, you represent that you have the authority to bind such entity.',
            'VEYRO provides autonomous enterprise software for accounting, invoice processing, banking reconciliation, tax analytics, and business intelligence.'
          ]
        },
        {
          heading: '2. Account Registration and Security Obligations',
          body: [
            'You are responsible for maintaining the confidentiality of your authentication credentials and for all activities conducted under your organization workspace.',
            'You agree to immediately notify VEYRO of any unauthorized use of your account or any other breach of security.'
          ]
        },
        {
          heading: '3. Permitted Commercial Use & Fair Conduct',
          body: [
            'The platform is intended exclusively for lawful business management, tax compliance, and commercial accounting operations.',
            'You may not reverse engineer, decompile, or attempt to derive source code from the platform, nor use the services to transmit unlawful, fraudulent, or malicious payloads.'
          ]
        },
        {
          heading: '4. Subscriptions, Fees & Billing Terms',
          body: [
            'Subscription plans are billed in advance on a recurring monthly or annual basis. You may upgrade, downgrade, or cancel your subscription at any time through your organization settings.',
            'Upon cancellation, your subscription remains active until the conclusion of the paid billing period, with zero cancellation penalties or lock-in restrictions.'
          ]
        },
        {
          heading: '5. Limitation of Liability and Warranties',
          body: [
            'VEYRO provides automated accounting and tax calculation tools designed to assist qualified professionals. You remain responsible for reviewing and verifying final tax filings submitted to governmental authorities.',
            'In no event shall VEYRO be liable for indirect, incidental, or consequential damages arising from service usage, beyond the total fees paid by you in the 12 months preceding the incident.'
          ]
        }
      ],
      ctaTitle: 'Experience modern enterprise software',
      ctaSub: 'Start using VEYRO today with full confidence and clarity.'
    }
  };

  const current = pageData[page] || pageData.product;

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-200 font-sans selection:bg-zinc-800 selection:text-white flex flex-col">
      
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-md bg-[#030303]/80 border-b border-zinc-900/50">
        <div 
          onClick={onBack} 
          className="cursor-pointer flex items-center gap-2 group"
        >
          <BrandLogo variant="wordmark" size={32} animated={false} disableGlow={true} />
        </div>

        {/* Centered navigation items with equal spacing */}
        <div className="hidden md:flex items-center justify-center gap-8 text-sm font-medium text-zinc-400 absolute left-1/2 -translate-x-1/2">
          <a 
            href="/product"
            onClick={(e) => { e.preventDefault(); handleNav('product'); }} 
            className={`transition-colors hover:text-white cursor-pointer ${page === 'product' ? 'text-white font-semibold' : ''}`}
          >
            Product
          </a>
          <a 
            href="/solutions"
            onClick={(e) => { e.preventDefault(); handleNav('solutions'); }} 
            className={`transition-colors hover:text-white cursor-pointer ${page === 'solutions' ? 'text-white font-semibold' : ''}`}
          >
            Solutions
          </a>
          <a 
            href="/resources"
            onClick={(e) => { e.preventDefault(); handleNav('resources'); }} 
            className={`transition-colors hover:text-white cursor-pointer ${page === 'resources' ? 'text-white font-semibold' : ''}`}
          >
            Resources
          </a>
          <a 
            href="/pricing"
            onClick={(e) => { e.preventDefault(); handleNav('pricing'); }} 
            className={`transition-colors hover:text-white cursor-pointer ${page === 'pricing' ? 'text-white font-semibold' : ''}`}
          >
            Pricing
          </a>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </button>
          <Button 
            onClick={onGetStarted} 
            className="bg-white text-black hover:bg-zinc-200 h-9 px-4 rounded-full text-sm font-medium"
          >
            Get Started
          </Button>
        </div>
      </nav>

      {/* HERO HEADER */}
      <section className="relative pt-36 pb-20 px-6 md:px-12 flex flex-col items-center justify-center text-center max-w-5xl mx-auto">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-xs font-semibold text-emerald-400 tracking-wider mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {current.badge}
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6 leading-[1.15]">
            {current.title} <br className="hidden md:inline" />
            <span className="text-zinc-500">{current.highlight}</span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto font-light leading-relaxed mb-10">
            {current.description}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              onClick={onGetStarted} 
              className="bg-white text-black hover:bg-zinc-200 h-11 px-8 rounded-full text-base font-medium w-full sm:w-auto"
            >
              Get Started for Free
            </Button>
            <Button 
              onClick={onBack} 
              variant="outline" 
              className="h-11 px-6 rounded-full border-zinc-800 bg-transparent text-white hover:bg-zinc-900 w-full sm:w-auto flex items-center gap-2"
            >
              Explore Dashboard
            </Button>
          </div>
        </motion.div>
      </section>

      {/* FEATURE TILES GRID */}
      <section className="py-16 px-6 md:px-12 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {current.features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="p-8 rounded-2xl bg-[#0A0A0A] border border-zinc-800/80 hover:border-zinc-700 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                    <Icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3 tracking-tight">
                    {feat.title}
                  </h3>
                  <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
                    {feat.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-900/60 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 group-hover:text-white transition-colors">
                  <span>Learn more</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* EXTENDED POLICY / ARCHITECTURE SECTIONS */}
      {current.sections && current.sections.length > 0 && (
        <section className="py-12 px-6 md:px-12 max-w-4xl mx-auto w-full">
          <div className="space-y-8">
            {current.sections.map((sec, sIdx) => (
              <div 
                key={sIdx} 
                className="p-8 rounded-2xl bg-[#090909] border border-zinc-800/80 hover:border-zinc-700 transition-colors"
              >
                <h3 className="text-xl md:text-2xl font-semibold text-white mb-4 tracking-tight flex items-center gap-3">
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                    0{sIdx + 1}
                  </span>
                  {sec.heading}
                </h3>
                <div className="space-y-3 text-zinc-400 text-sm md:text-base leading-relaxed">
                  {sec.body.map((p, pIdx) => (
                    <p key={pIdx}>{p}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PREMIUM DETAILS CALLOUT */}
      <section className="py-20 px-6 md:px-12 bg-zinc-950/60 border-y border-zinc-900">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-xs font-medium text-zinc-400 mb-6">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> VEYRO ENTERPRISE STANDARD
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight mb-4">
            {current.ctaTitle}
          </h2>
          <p className="text-base md:text-lg text-zinc-400 mb-8 max-w-xl mx-auto">
            {current.ctaSub}
          </p>
          <Button 
            onClick={onGetStarted} 
            className="bg-white text-black hover:bg-zinc-200 h-12 px-8 rounded-full text-base font-medium"
          >
            Start Now <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto py-12 px-6 md:px-12 border-t border-zinc-900 bg-[#030303]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <BrandLogo variant="icon" size={24} disableGlow={true} animated={false} />
            <span className="text-zinc-500 text-sm">© 2026 VEYRO Inc. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-zinc-500">
            <a href="/product" onClick={(e) => { e.preventDefault(); handleNav('product'); }} className="hover:text-white transition-colors cursor-pointer">Product</a>
            <a href="/solutions" onClick={(e) => { e.preventDefault(); handleNav('solutions'); }} className="hover:text-white transition-colors cursor-pointer">Solutions</a>
            <a href="/company" onClick={(e) => { e.preventDefault(); handleNav('company'); }} className="hover:text-white transition-colors cursor-pointer">Company</a>
            <a href="/resources" onClick={(e) => { e.preventDefault(); handleNav('resources'); }} className="hover:text-white transition-colors cursor-pointer">Resources</a>
            <a href="/pricing" onClick={(e) => { e.preventDefault(); handleNav('pricing'); }} className="hover:text-white transition-colors cursor-pointer">Pricing</a>
            <a href="/legal" onClick={(e) => { e.preventDefault(); handleNav('legal'); }} className="hover:text-white transition-colors cursor-pointer">Legal</a>
            <a href="/privacy" onClick={(e) => { e.preventDefault(); handleNav('privacy'); }} className="hover:text-white transition-colors cursor-pointer">Privacy</a>
            <a href="/security" onClick={(e) => { e.preventDefault(); handleNav('security'); }} className="hover:text-white transition-colors cursor-pointer">Security</a>
            <a href="/terms" onClick={(e) => { e.preventDefault(); handleNav('terms'); }} className="hover:text-white transition-colors cursor-pointer">Terms</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
