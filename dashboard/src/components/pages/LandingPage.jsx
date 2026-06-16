import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Shield, Radio, BarChart3, CalendarClock, ArrowRight, MapPin, AlertTriangle, TrendingUp, ShieldCheck, ArrowDown, ChevronRight } from 'lucide-react';
import { fetchHeatmap, fetchEnforcement } from '../../utils/api';
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter';

function SnapshotCard({ label, value, icon: Icon, color }) {
  const animated = useAnimatedCounter(value, 1400, value > 100 ? 0 : 1);
  return (
    <div className="snapshot-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="snap-label">{label}</span>
        <Icon size={16} style={{ color }} />
      </div>
      <span className="snap-value data-number">{animated}</span>
    </div>
  );
}

function CityTopologyVisual() {
  // Denser Bengaluru-inspired road topology with animated congestion pulses
  const junctions = [
    // Core cluster (Majestic/City Market area)
    { x: 240, y: 220, r: 10, color: 'var(--danger)', label: 'Core' },
    { x: 200, y: 180, r: 7, color: 'var(--danger)' },
    { x: 280, y: 180, r: 6, color: 'var(--warning)' },
    { x: 200, y: 260, r: 8, color: 'var(--danger)' },
    { x: 280, y: 260, r: 5, color: 'var(--warning)' },
    // Ring road junctions
    { x: 140, y: 140, r: 5, color: 'var(--warning)' },
    { x: 340, y: 140, r: 4, color: 'var(--success)' },
    { x: 140, y: 300, r: 4, color: 'var(--success)' },
    { x: 340, y: 300, r: 6, color: 'var(--warning)' },
    // Outer ring
    { x: 80, y: 100, r: 3, color: 'var(--success)' },
    { x: 400, y: 100, r: 3, color: 'var(--success)' },
    { x: 80, y: 340, r: 3, color: 'var(--success)' },
    { x: 400, y: 340, r: 3, color: 'var(--success)' },
    // Spokes (major roads)
    { x: 240, y: 80, r: 4, color: 'var(--accent)' },
    { x: 240, y: 360, r: 4, color: 'var(--accent)' },
    { x: 60, y: 220, r: 3, color: 'var(--success)' },
    { x: 420, y: 220, r: 3, color: 'var(--success)' },
    // IT Corridor (SE)
    { x: 360, y: 360, r: 5, color: 'var(--warning)' },
    { x: 440, y: 400, r: 4, color: 'var(--success)' },
    // North extensions
    { x: 180, y: 60, r: 3, color: 'var(--success)' },
    { x: 300, y: 60, r: 3, color: 'var(--success)' },
    // Satellite nodes
    { x: 120, y: 200, r: 2, color: 'var(--success)' },
    { x: 360, y: 200, r: 2, color: 'var(--success)' },
    { x: 160, y: 340, r: 2, color: 'var(--success)' },
    { x: 320, y: 340, r: 2, color: 'var(--success)' },
  ];

  const roads = [
    // Core mesh
    [0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [3, 4],
    // Core to ring
    [1, 5], [2, 6], [3, 7], [4, 8],
    // Ring road
    [5, 6], [6, 8], [8, 7], [7, 5],
    // Ring to outer
    [5, 9], [6, 10], [7, 11], [8, 12],
    // Spokes
    [0, 13], [0, 14], [1, 15], [2, 16],
    [13, 19], [13, 20],
    // IT corridor
    [8, 17], [17, 18],
    // Connections
    [9, 19], [10, 20], [5, 21], [6, 22],
    [7, 23], [8, 24], [14, 23], [14, 24],
    [15, 9], [15, 21], [16, 10], [16, 22],
  ];

  return (
    <div className="city-topology-visual">
      <svg viewBox="0 0 480 440" fill="none">
        {/* Grid background — subtle road grid */}
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="240" cy="220" r="200" fill="url(#glow)" />

        {/* Roads */}
        {roads.map(([a, b], i) => {
          const isHighTraffic = junctions[a].r > 5 && junctions[b].r > 5;
          return (
            <line
              key={`road-${i}`}
              x1={junctions[a].x} y1={junctions[a].y}
              x2={junctions[b].x} y2={junctions[b].y}
              stroke={isHighTraffic ? 'rgba(239, 68, 68, 0.15)' : 'var(--border-hover)'}
              strokeWidth={isHighTraffic ? 1.5 : 0.8}
              className="road-line"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: `${3 + Math.random() * 2}s` }}
            />
          );
        })}

        {/* Flow particles along high-traffic roads */}
        {roads.filter(([a, b]) => junctions[a].r > 5 || junctions[b].r > 5).slice(0, 8).map(([a, b], i) => (
          <circle key={`flow-${i}`} r="1.5" fill="var(--accent)" opacity="0.5">
            <animateMotion
              dur={`${2 + i * 0.3}s`}
              repeatCount="indefinite"
              path={`M${junctions[a].x},${junctions[a].y} L${junctions[b].x},${junctions[b].y}`}
            />
          </circle>
        ))}

        {/* Junction nodes */}
        {junctions.map((j, i) => (
          <g key={`junction-${i}`}>
            <circle
              cx={j.x} cy={j.y} r={j.r}
              fill={j.color}
              opacity="0.6"
              className="road-node"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
            {/* Pulse ring on critical junctions */}
            {j.r >= 7 && (
              <circle
                cx={j.x} cy={j.y} r={j.r + 16}
                fill="none"
                stroke={j.color}
                strokeWidth="0.8"
                opacity="0.2"
                className="road-node"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            )}
          </g>
        ))}

        {/* Labels on key junctions */}
        <text x="240" y="248" textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontFamily="Inter" fontWeight="500" opacity="0.6">CORE</text>
        <text x="440" y="418" textAnchor="middle" fill="var(--text-muted)" fontSize="7" fontFamily="Inter" fontWeight="500" opacity="0.4">IT CORRIDOR</text>
      </svg>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [zones, setZones] = useState(0);
  const [avgCIQ, setAvgCIQ] = useState(0);
  const [enfRate, setEnfRate] = useState(0);
  const [alerts, setAlerts] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [heatmap, enforcement] = await Promise.all([fetchHeatmap(), fetchEnforcement()]);
        setZones(heatmap.length);
        setAvgCIQ(Math.round(heatmap.reduce((s, z) => s + (z.congestiq_score || 0), 0) / heatmap.length));
        const avg = enforcement.reduce((s, e) => s + e.enforcement_rate, 0) / enforcement.length;
        setEnfRate(Math.round(avg * 100));
        setAlerts(enforcement.filter(e => e.is_anomaly).length);
      } catch (e) { /* silent */ }
    };
    load();
  }, []);

  return (
    <div className="landing-page">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <div className="brand-mark">
            <Shield size={18} />
          </div>
          <h1>KAVACH</h1>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-ghost" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            Enter Platform <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-eyebrow">Urban Intelligence Platform</div>
          <h2>
            From Reactive Enforcement to{' '}
            <strong>Predictive Intelligence.</strong>
          </h2>
          <p className="hero-description">
            Real-time monitoring, analytical intelligence, and enforcement planning
            for urban congestion management across Bengaluru.
          </p>
          <div className="hero-ctas">
            <button className="btn-primary" onClick={() => navigate('/operations/overview')}>
              Open Operations Center <ArrowRight size={14} />
            </button>
            <button className="btn-ghost" onClick={() => navigate('/analytics/summary')}>
              Explore Analytics
            </button>
            <button className="btn-ghost" onClick={() => navigate('/patrol/deployment')}>
              Patrol Planning
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <CityTopologyVisual />
        </div>
      </section>

      {/* Operational Snapshot */}
      <section className="landing-section">
        <div className="section-eyebrow">Live Intelligence</div>
        <h3>Operational Snapshot</h3>
        <p>Current state across Bengaluru's congestion monitoring network.</p>
        <div className="snapshot-grid">
          <SnapshotCard label="Active Zones" value={zones} icon={MapPin} color="var(--accent)" />
          <SnapshotCard label="Avg CongestionIQ" value={avgCIQ} icon={TrendingUp} color="var(--warning)" />
          <SnapshotCard label="Enforcement Rate" value={enfRate} icon={ShieldCheck} color="var(--success)" />
          <SnapshotCard label="Anomaly Alerts" value={alerts} icon={AlertTriangle} color="var(--danger)" />
        </div>
      </section>

      {/* Capabilities */}
      <section className="landing-section">
        <div className="section-eyebrow">Platform Capabilities</div>
        <h3>Intelligence at Every Level</h3>
        <div className="capabilities-grid">
          <div className="capability-card" onClick={() => navigate('/operations/overview')} style={{ cursor: 'pointer' }}>
            <div className="cap-icon"><Radio size={20} /></div>
            <h4>Live Operations</h4>
            <p>Monitor congestion in real time across 789 zones. Identify critical hotspots and cascade patterns before they escalate.</p>
          </div>
          <div className="capability-card" onClick={() => navigate('/analytics/summary')} style={{ cursor: 'pointer' }}>
            <div className="cap-icon"><BarChart3 size={20} /></div>
            <h4>Analytics</h4>
            <p>Measure enforcement effectiveness with anomaly detection. Classify junction behaviours into actionable archetypes.</p>
          </div>
          <div className="capability-card" onClick={() => navigate('/patrol/deployment')} style={{ cursor: 'pointer' }}>
            <div className="cap-icon"><CalendarClock size={20} /></div>
            <h4>Patrol Planning</h4>
            <p>Simulate enforcement scenarios. Optimise 24-hour deployment strategies. Quantify projected congestion reduction.</p>
          </div>
        </div>
      </section>

      {/* Why KAVACH — Before / With / Outcomes progression */}
      <section className="landing-section">
        <div className="section-eyebrow">The Problem We Solve</div>
        <h3>From Reactive to Predictive</h3>
        <p style={{ marginBottom: 40 }}>
          Illegal and spillover parking near commercial corridors, transit hubs, and event zones
          silently amplifies congestion across the city.
        </p>

        <div className="transformation-flow">
          {/* Before */}
          <div className="transform-card transform-before">
            <div className="transform-label">Before KAVACH</div>
            <ul>
              <li>Reactive patrols responding to complaints</li>
              <li>Limited visibility into parking-induced congestion</li>
              <li>Difficult prioritisation of enforcement hotspots</li>
              <li>Resource allocation based on intuition</li>
            </ul>
          </div>

          <div className="transform-arrow">
            <ArrowDown size={20} />
          </div>

          {/* With */}
          <div className="transform-card transform-with">
            <div className="transform-label">With KAVACH</div>
            <ul>
              <li>Predict congestion before it cascades</li>
              <li>Identify hotspots with CongestionIQ scoring</li>
              <li>Prioritise interventions with anomaly detection</li>
              <li>Simulate outcomes before deploying resources</li>
            </ul>
          </div>

          <div className="transform-arrow">
            <ArrowDown size={20} />
          </div>

          {/* Outcomes */}
          <div className="transform-card transform-outcomes">
            <div className="transform-label">Projected Outcomes</div>
            <div className="outcomes-grid">
              <div className="outcome-item">
                <span className="outcome-value data-number">5.8%</span>
                <span className="outcome-label">Congestion Reduction</span>
              </div>
              <div className="outcome-item">
                <span className="outcome-value data-number">7,226</span>
                <span className="outcome-label">Hours Saved / Month</span>
              </div>
              <div className="outcome-item">
                <span className="outcome-value data-number">217</span>
                <span className="outcome-label">Delivery Hours Saved</span>
              </div>
              <div className="outcome-item">
                <span className="outcome-value data-number">789</span>
                <span className="outcome-label">Zones Monitored</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
          <div className="brand-mark" style={{ width: 24, height: 24 }}>
            <Shield size={14} />
          </div>
          <span style={{ fontWeight: 600, letterSpacing: '0.04em' }}>KAVACH</span>
        </div>
        <p>Parking Congestion Cascade Intelligence Platform</p>
        <p style={{ marginTop: 4, fontSize: 11 }}>Flipkart Gridlock 2.0</p>
      </footer>
    </div>
  );
}
