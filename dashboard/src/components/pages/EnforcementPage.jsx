import { useState, useEffect } from 'react';
import { PageHeader } from '../layout/TopBar';
import { fetchEnforcement } from '../../utils/api';
import EnforcementChart from '../analytics/EnforcementChart';
import StatCard from '../common/StatCard';
import { Search, ShieldCheck, AlertTriangle, BarChart3 } from 'lucide-react';

export default function EnforcementPage() {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnforcement().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = search
    ? data.filter(d => d.police_station.toLowerCase().includes(search.toLowerCase()))
    : data;

  const anomalyCount = filtered.filter(d => d.is_anomaly).length;
  const avgRate = filtered.length ? (filtered.reduce((s, d) => s + d.enforcement_rate, 0) / filtered.length * 100) : 0;
  const totalViolations = filtered.reduce((s, d) => s + d.total_violations, 0);
  const lowestStation = [...filtered].sort((a, b) => a.enforcement_rate - b.enforcement_rate)[0];

  return (
    <div>
      <PageHeader title="Enforcement Analysis" description="Identify stations with anomalous enforcement patterns using Isolation Forest detection." />

      {/* KPI strip */}
      <div className="stat-cards-row" style={{ marginBottom: 20 }}>
        <StatCard label="Total Violations" value={totalViolations} icon={BarChart3} accent="var(--accent)" subtext={`${filtered.length} stations`} />
        <StatCard label="Anomalous Stations" value={anomalyCount} icon={AlertTriangle} accent="var(--danger)" subtext={`of ${filtered.length} total`} />
        <StatCard label="Avg Enforcement Rate" value={avgRate} decimals={1} suffix="%" icon={ShieldCheck} accent="var(--success)" subtext="Across filtered" />
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search stations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            Anomaly detected
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            Normal
          </span>
        </div>
      </div>

      {!loading && <EnforcementChart data={filtered} />}

      {/* Interactive explanation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
        <div className="insight-card">
          <strong>How Anomaly Detection Works</strong>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            KAVACH uses an Isolation Forest algorithm to identify police stations where the enforcement rate
            is statistically unusual given total violations, approval rates, and disposal patterns.
            Anomalous stations (red bars) may indicate under-enforcement or systemic resource constraints.
          </p>
        </div>
        <div className="insight-card" style={{ borderLeftColor: 'var(--danger)' }}>
          <strong>Key Finding</strong>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            {anomalyCount} of {filtered.length} stations flagged as anomalous.
            {lowestStation && <> Lowest enforcement: <strong>{lowestStation.police_station}</strong> at {(lowestStation.enforcement_rate * 100).toFixed(0)}%.</>}
            {' '}Average enforcement rate: {avgRate.toFixed(1)}%.
          </p>
        </div>
      </div>
    </div>
  );
}
