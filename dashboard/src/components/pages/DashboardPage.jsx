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

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Zone Severity Distribution</h3>
      </div>
      <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ width: `${(critical / total) * 100}%`, background: 'var(--danger)', transition: 'width 0.5s ease' }} />
        <div style={{ width: `${(moderate / total) * 100}%`, background: 'var(--warning)', transition: 'width 0.5s ease' }} />
        <div style={{ width: `${(normal / total) * 100}%`, background: 'var(--success)', transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
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
        <StatCard label="Highest Risk" value={highestRisk?.congestiq_score || 0} icon={AlertTriangle} accent="var(--danger)" subtext={highestRisk?.zone_id || '\u2014'} />
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
                <div>
                  <span className="alert-station data-number" style={{ fontSize: 13 }}>{z.zone_id}</span>
                  <span className="alert-detail" style={{ marginLeft: 12 }}>{z.primary_violation}</span>
                </div>
                <span className="severity-badge high data-number">
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
