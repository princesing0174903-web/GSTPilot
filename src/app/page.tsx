import { Zap } from 'lucide-react'

export const metadata = {
  title: 'GSTPilot™ — The Financial Brain of India',
  description: 'The Financial Brain of India',
}

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        background: 'radial-gradient(1200px 600px at 50% -10%, #1e293b 0%, #020617 60%, #000 100%)',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Zap size={32} style={{ color: '#22d3ee', filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.7))' }} />
        <span style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em' }}>
          GSTPilot<span style={{ color: '#22d3ee' }}>™</span>
        </span>
      </div>
      <div style={{ fontSize: '14px', color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        The Financial Brain of India
      </div>
      <h1 style={{ fontSize: '40px', fontWeight: 700, maxWidth: '640px', lineHeight: 1.2, margin: 0 }}>
        Run your entire financial operation on one brain.
      </h1>
      <p style={{ fontSize: '16px', color: '#94a3b8', maxWidth: '520px', margin: 0 }}>
        GST, Banking, Invoicing, Reconciliation and an AI CFO — in one premium Financial Operating System.
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
        <span style={{ padding: '8px 16px', borderRadius: '999px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', fontSize: '13px', color: '#22d3ee' }}>SOC 2 Type II</span>
        <span style={{ padding: '8px 16px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px', color: '#94a3b8' }}>GSTN Compliant</span>
        <span style={{ padding: '8px 16px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px', color: '#94a3b8' }}>RBI Aligned</span>
        <span style={{ padding: '8px 16px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px', color: '#94a3b8' }}>India-hosted</span>
      </div>
      <div style={{ marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
        Loading dashboard…
      </div>
    </main>
  )
}
