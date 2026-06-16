export default function StatsBar({ zones }) {
  if (!zones || zones.length === 0) return null;

  const totalZones = zones.length;
  const avgScore = (zones.reduce((sum, z) => sum + (z.congestiq_score || 0), 0) / totalZones).toFixed(1);
  const highestRisk = zones.reduce((max, z) => (z.congestiq_score || 0) > (max.congestiq_score || 0) ? z : max, zones[0]);

  return (
    <div className="stats-bar">
      <div className="stat-pill">
        📍 Zones Monitored: <span className="pill-value">{totalZones}</span>
      </div>
      <div className="stat-pill">
        📊 Avg CongestIQ: <span className="pill-value">{Number(avgScore).toLocaleString()}</span>
      </div>
      <div className="stat-pill">
        🔴 Highest Risk: <span className="pill-value">{highestRisk?.zone_id || '—'}</span>
        <span className="data-number" style={{ color: 'var(--accent-danger)', fontSize: 13 }}>
          ({Number(highestRisk?.congestiq_score || 0).toLocaleString()})
        </span>
      </div>
    </div>
  );
}
