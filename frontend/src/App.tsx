import { useState } from 'react';
import { TelemetryTab } from './tabs/TelemetryTab';
import { PredictorTab } from './tabs/PredictorTab';
import { FantasyTab } from './tabs/FantasyTab';

type Tab = 'telemetry' | 'predictor' | 'fantasy';

const TABS = [
  { id: 'telemetry' as Tab, label: 'Telemetry', icon: '📊', description: 'Live session data, car telemetry & timing' },
  { id: 'predictor' as Tab, label: 'Race Predictor', icon: '🔮', description: 'AI-powered outcome analysis & incident probabilities' },
  { id: 'fantasy' as Tab, label: 'Fantasy F1', icon: '🏆', description: 'Optimal team builder with official scoring rules' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('telemetry');

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0f0f0f', color: '#e5e5e5' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: '#1a1a1a', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: '56px', gap: '16px' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '22px', fontWeight: 900, color: '#e10600', letterSpacing: '-1px', fontStyle: 'italic' }}>F1</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#e5e5e5', letterSpacing: '3px', textTransform: 'uppercase' }}>TELEMETRY</span>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#2a2a2a' }} />
              <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '1px' }}>2025 SEASON</span>
            </div>

            {/* Tabs */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 500,
                    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                    backgroundColor: activeTab === tab.id ? '#0f0f0f' : 'transparent',
                    color: activeTab === tab.id ? '#e5e5e5' : '#6b7280',
                    borderBottom: activeTab === tab.id ? '2px solid #e10600' : '2px solid transparent',
                    position: 'relative',
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* Live indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#6b7280', flexShrink: 0 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              Live Data
            </div>
          </div>
        </div>
      </header>

      {/* Breadcrumb bar */}
      <div style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: '#1a1a1a', opacity: 0.7, padding: '6px 0' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 16px', fontSize: '11px', color: '#6b7280' }}>
          <span style={{ color: '#e10600', fontWeight: 600 }}>
            {TABS.find(t => t.id === activeTab)?.icon} {TABS.find(t => t.id === activeTab)?.label}
          </span>
          {' — '}
          {TABS.find(t => t.id === activeTab)?.description}
          {' · Data: '}
          <span style={{ color: '#9ca3af' }}>OpenF1 API</span>
          {' + '}
          <span style={{ color: '#9ca3af' }}>Ergast</span>
          {' + '}
          <span style={{ color: '#9ca3af' }}>FastF1</span>
        </div>
      </div>

      {/* Main */}
      <main style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px 16px' }}>
        {activeTab === 'telemetry' && <TelemetryTab />}
        {activeTab === 'predictor' && <PredictorTab />}
        {activeTab === 'fantasy' && <FantasyTab />}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #2a2a2a', backgroundColor: '#1a1a1a', marginTop: '32px' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: '#6b7280' }}>
          <span>F1 Telemetry Dashboard · 2025 · Built with FastAPI + React + Recharts</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>openf1.org</span>
            <span>ergast.com/api/f1</span>
            <span>github.com/whynotderp/FormulaOneDashboard</span>
          </div>
        </div>
      </footer>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #0f0f0f; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #1a1a1a; }
        ::-webkit-scrollbar-thumb { background: #e10600; border-radius: 3px; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        select option { background: #1a1a1a; }
      `}</style>
    </div>
  );
}
