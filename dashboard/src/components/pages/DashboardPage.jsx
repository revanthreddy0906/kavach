import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Radio, BarChart3, CalendarClock, MapPin, TrendingUp, ShieldCheck, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { PageHeader } from '../layout/TopBar';
import StatCard from '../common/StatCard';
import { fetchHeatmap, fetchEnforcement } from '../../utils/api';

function SeverityDistribution({ zones }) {
  const critical = zones.filter(z => z.congestiq_score > 700).length;
  const moderate = zones.filter(z => z.congestiq_score > 300 && z.congestiq_score <= 700).length;
  const normal = zones.filter(z => z.congestiq_score <= 300).length;
  const total = zones.length || 1;

  // Compute hourly distribution for sparkline
  const hourCounts = Array.from({ length: 24 }, (_, h) =>
    zones.filter(z => z.peak_hour === h).length
  );
  const maxHour = Math.max(...hourCounts, 1);

  // Top violation types
  const violationCounts = {};
  zones.forEach(z => {
    const v = z.primary_violation || 'OTHER';
    violationCounts[v] = (violationCounts[v] || 0) + 1;
  });
  const topViolations = Object.entries(violationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Zone Severity Distribution</h3>
      </div>
      <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ width: `${(critical / total) * 100}%`, background: 'var(--danger)', transition: 'width 0.5s ease' }} />
        <div style={{ width: `${(moderate / total) * 100}%`, background: 'var(--warning)', transition: 'width 0.5s ease' }} />
        <div style={{ width: `${(normal / total) * 100}%`, background: 'var(--success)', transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Critical: <strong>{critical}</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Moderate: <strong>{moderate}</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Normal: <strong>{normal}</strong></span>
        </div>
      </div>

      {/* Peak hour distribution */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Peak Activity by Hour</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 56 }}>
          {hourCounts.map((c, h) => (
            <div key={h} style={{
              flex: 1, borderRadius: '2px 2px 0 0',
              height: `${(c / maxHour) * 100}%`,
              minHeight: 2,
              background: c === Math.max(...hourCounts) ? 'var(--danger)' : c > maxHour * 0.5 ? 'var(--warning)' : 'var(--accent)',
              opacity: 0.7,
              transition: 'height 0.3s ease',
            }} title={`${String(h).padStart(2, '0')}:00 — ${c} zones peak here`} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>
          <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5 }}>
          Most zones peak between <strong>{String(hourCounts.indexOf(Math.max(...hourCounts))).padStart(2, '0')}:00–{String(hourCounts.indexOf(Math.max(...hourCounts)) + 1).padStart(2, '0')}:00</strong>. 
          Late night and early morning hours show concentrated hotspot activity.
        </div>
      </div>

      {/* Violation type breakdown */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Top Violation Types</div>
        {topViolations.map(([type, count], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${(count / (topViolations[0]?.[1] || 1)) * 100}%`,
                background: i === 0 ? 'var(--danger)' : i === 1 ? 'var(--warning)' : 'var(--accent)',
                opacity: 0.75,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', minWidth: 140 }}>{type}</span>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', minWidth: 35, textAlign: 'right' }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [zones, setZones] = useState([]);
  const [enforcement, setEnforcement] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [h, e] = await Promise.all([fetchHeatmap(), fetchEnforcement()]);
        setZones(h);
        setEnforcement(e);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const totalZones = zones.length;
  const avgCIQ = totalZones ? Math.round(zones.reduce((s, z) => s + (z.congestiq_score || 0), 0) / totalZones) : 0;
  const highestRisk = zones.length > 0 ? zones.reduce((max, z) => (z.congestiq_score || 0) > (max.congestiq_score || 0) ? z : max, zones[0]) : null;
  const avgEnf = enforcement.length ? (enforcement.reduce((s, e) => s + e.enforcement_rate, 0) / enforcement.length * 100).toFixed(1) : 0;
  const anomalies = enforcement.filter(e => e.is_anomaly);
  const topViolators = [...zones].sort((a, b) => (b.congestiq_score || 0) - (a.congestiq_score || 0)).slice(0, 5);

  return (
    <div>
      <PageHeader title="Dashboard" description="Executive overview of KAVACH operations across Bengaluru." />

      {/* KPI Cards */}
      <div className="stat-cards-row">
        <StatCard label="Active Zones" value={totalZones} icon={MapPin} accent="var(--accent)" subtext="Monitored locations" />
        <StatCard label="Avg CongestionIQ" value={avgCIQ} icon={TrendingUp} accent="var(--warning)" subtext="Across all zones" />
        <StatCard label="Highest Risk" value={highestRisk?.congestiq_score || 0} icon={AlertTriangle} accent="var(--danger)" subtext={highestRisk?.display_name || highestRisk?.zone_id || '\u2014'} />
        <StatCard label="Enforcement Rate" value={parseFloat(avgEnf)} decimals={1} suffix="%" icon={ShieldCheck} accent="var(--success)" subtext="Avg across BTP" />
      </div>

      {/* Quick Links */}
      <div className="quick-links">
        <Link to="/operations/live-map" className="quick-link-card">
          <div className="ql-icon"><Radio size={18} /></div>
          <div className="ql-text">
            <h4>Live Operations</h4>
            <p>Real-time congestion map</p>
          </div>
        </Link>
        <Link to="/analytics/enforcement" className="quick-link-card">
          <div className="ql-icon"><BarChart3 size={18} /></div>
          <div className="ql-text">
            <h4>Analytics</h4>
            <p>Enforcement analysis</p>
          </div>
        </Link>
        <Link to="/patrol/simulation" className="quick-link-card">
          <div className="ql-icon"><CalendarClock size={18} /></div>
          <div className="ql-text">
            <h4>Patrol Planning</h4>
            <p>Simulate interventions</p>
          </div>
        </Link>
      </div>

      {/* Two-column layout: Severity + Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Severity distribution */}
        <SeverityDistribution zones={zones} />

        {/* Top risk zones */}
        <div className="panel">
          <div className="panel-header">
            <h3>Top Risk Zones</h3>
            <Link to="/operations/high-risk" className="caption" style={{ color: 'var(--accent)' }}>View all</Link>
          </div>
          <div className="alert-list">
            {topViolators.map((z, i) => (
              <div key={i} className="alert-item">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {z.display_name || z.zone_id}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                    <span>{z.primary_violation}</span>
                    <span>·</span>
                    <span>{z.dominant_vehicle}</span>
                    <span>·</span>
                    <span>{z.violations_per_day?.toFixed(0)}/day</span>
                  </div>
                </div>
                <span className="severity-badge high data-number" style={{ flexShrink: 0 }}>
                  {Number(z.congestiq_score).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Anomaly alerts */}
      {anomalies.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3>Enforcement Anomalies</h3>
            <Link to="/analytics/enforcement" className="caption" style={{ color: 'var(--accent)' }}>Analyse</Link>
          </div>
          <div className="insight-card" style={{ marginBottom: 16 }}>
            {anomalies.length} of {enforcement.length} police stations flagged with anomalous enforcement patterns.
            These stations require immediate attention and operational review.
          </div>
          <div className="alert-list">
            {anomalies.slice(0, 5).map((a, i) => (
              <div key={i} className="alert-item">
                <div>
                  <span className="alert-station">{a.police_station}</span>
                  <span className="alert-detail" style={{ marginLeft: 12 }}>
                    {Number(a.total_violations).toLocaleString()} violations
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="severity-badge high">
                    {(a.enforcement_rate * 100).toFixed(0)}%
                  </span>
                  {a.enforcement_rate < 0.8 && <ArrowDownRight size={14} style={{ color: 'var(--danger)' }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
