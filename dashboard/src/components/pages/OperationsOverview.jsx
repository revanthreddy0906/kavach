import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../layout/TopBar';
import StatCard from '../common/StatCard';
import { fetchHeatmap } from '../../utils/api';
import { MapPin, TrendingUp, AlertTriangle, Map, ArrowRight } from 'lucide-react';

export default function OperationsOverview() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHeatmap().then(d => { setZones(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const totalZones = zones.length;
  const avgCIQ = totalZones ? Math.round(zones.reduce((s, z) => s + (z.congestiq_score || 0), 0) / totalZones) : 0;
  const criticalCount = zones.filter(z => z.congestiq_score > 700).length;
  const moderateCount = zones.filter(z => z.congestiq_score > 300 && z.congestiq_score <= 700).length;
  const topRisk = [...zones].sort((a, b) => (b.congestiq_score || 0) - (a.congestiq_score || 0)).slice(0, 8);

  // Dominant violation type
  const violationCounts = {};
  zones.forEach(z => {
    violationCounts[z.primary_violation] = (violationCounts[z.primary_violation] || 0) + 1;
  });
  const topViolation = Object.entries(violationCounts).sort((a, b) => b[1] - a[1])[0];

  // Dominant vehicle
  const vehicleCounts = {};
  zones.forEach(z => {
    vehicleCounts[z.dominant_vehicle] = (vehicleCounts[z.dominant_vehicle] || 0) + 1;
  });
  const topVehicle = Object.entries(vehicleCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <PageHeader title="Operations Overview" description="High-level view of current operational status across the monitoring network." />

      <div className="stat-cards-row">
        <StatCard label="Zones Monitored" value={totalZones} icon={MapPin} accent="var(--accent)" />
        <StatCard label="Avg CongestionIQ" value={avgCIQ} icon={TrendingUp} accent="var(--warning)" />
        <StatCard label="Critical Zones" value={criticalCount} icon={AlertTriangle} accent="var(--danger)" subtext="CIQ > 700" />
      </div>

      {/* Operational insight */}
      <div className="insight-card" style={{ marginBottom: 24 }}>
        {criticalCount} zones are in critical status (CIQ &gt; 700) and {moderateCount} are moderate.
        {topViolation && <> Most common violation: <strong>{topViolation[0]}</strong> ({topViolation[1]} zones).</>}
        {topVehicle && <> Dominant vehicle type: <strong>{topVehicle[0]}</strong>.</>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Top risk zones */}
        <div className="panel">
          <div className="panel-header">
            <h3>Highest Risk Zones</h3>
            <Link to="/operations/high-risk" className="caption" style={{ color: 'var(--accent)' }}>View all</Link>
          </div>
          <div className="alert-list">
            {topRisk.map((z, i) => (
              <div key={i} className="alert-item">
                <div>
                  <span className="alert-station data-number" style={{ fontSize: 13 }}>{z.zone_id}</span>
                  <span className="alert-detail" style={{ marginLeft: 12 }}>{z.primary_violation}</span>
                </div>
                <span className={`severity-badge ${z.congestiq_score > 700 ? 'high' : z.congestiq_score > 300 ? 'medium' : 'low'}`}>
                  {Number(z.congestiq_score).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link to="/operations/live-map" className="quick-link-card" style={{ flex: 1 }}>
            <div className="ql-icon"><Map size={18} /></div>
            <div className="ql-text">
              <h4>Open Live Map</h4>
              <p>Real-time congestion map with zone markers, cascade patterns, and patrol deployments</p>
            </div>
          </Link>
          <Link to="/operations/high-risk" className="quick-link-card" style={{ flex: 1 }}>
            <div className="ql-icon"><AlertTriangle size={18} /></div>
            <div className="ql-text">
              <h4>High Risk Zones</h4>
              <p>Searchable and sortable table of all {totalZones} zones ranked by severity</p>
            </div>
          </Link>
          <Link to="/patrol/deployment" className="quick-link-card" style={{ flex: 1 }}>
            <div className="ql-icon"><TrendingUp size={18} /></div>
            <div className="ql-text">
              <h4>Patrol Deployment</h4>
              <p>24-hour patrol allocation across critical zones</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
