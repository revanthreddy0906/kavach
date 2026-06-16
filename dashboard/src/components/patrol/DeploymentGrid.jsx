import { useMemo } from 'react';

function getCellColor(violations) {
  if (violations > 15) return 'rgba(239, 68, 68, 0.6)';
  if (violations > 10) return 'rgba(245, 158, 11, 0.5)';
  if (violations > 5) return 'rgba(59, 130, 246, 0.4)';
  return 'rgba(16, 185, 129, 0.2)';
}

export default function DeploymentGrid({ data }) {
  const currentHour = new Date().getHours();

  const { hours, zoneIds, gridMap } = useMemo(() => {
    if (!data || data.length === 0) return { hours: [], zoneIds: [], gridMap: {} };

    const allZones = [...new Set(data.map(d => d.zone_id))];
    // Take top 10 zones by frequency
    const zoneIds = allZones.slice(0, 10);
    const hours = [...new Set(data.map(d => d.hour))].sort((a, b) => a - b);

    const gridMap = {};
    data.forEach(d => {
      const key = `${d.hour}-${d.zone_id}`;
      gridMap[key] = d;
    });

    return { hours, zoneIds, gridMap };
  }, [data]);

  if (hours.length === 0) {
    return (
      <div className="deployment-grid-wrapper">
        <h3>24-Hour Deployment Timeline</h3>
        <p style={{ color: 'var(--text-muted)', padding: 20 }}>No patrol data available</p>
      </div>
    );
  }

  return (
    <div className="deployment-grid-wrapper">
      <h3>24-Hour Deployment Timeline</h3>
      <table className="deployment-grid">
        <thead>
          <tr>
            <th>Hour</th>
            {zoneIds.map(z => (
              <th key={z} title={z}>{z.substring(0, 6)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map(hour => (
            <tr key={hour} className={hour === currentHour ? 'current-hour' : ''}>
              <td className="hour-cell">
                {String(hour).padStart(2, '0')}:00
                {hour === currentHour && ' NOW'}
              </td>
              {zoneIds.map(zoneId => {
                const entry = gridMap[`${hour}-${zoneId}`];
                if (!entry) return <td key={zoneId} style={{ background: 'var(--bg-elevated)' }}>—</td>;
                return (
                  <td
                    key={zoneId}
                    style={{ background: getCellColor(entry.predicted_violations) }}
                    title={`${entry.units_assigned} units | ${entry.predicted_violations} predicted violations`}
                  >
                    {entry.units_assigned}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
