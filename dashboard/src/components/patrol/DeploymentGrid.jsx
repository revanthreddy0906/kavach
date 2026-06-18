import { useMemo } from 'react';
import { useZoneNames, resolveZoneName } from '../../utils/zoneNames';

function getCellColor(units) {
  if (units >= 3) return 'rgba(239, 68, 68, 0.65)';
  if (units === 2) return 'rgba(245, 158, 11, 0.55)';
  if (units === 1) return 'rgba(59, 130, 246, 0.45)';
  return 'transparent';
}

export default function DeploymentGrid({ data }) {
  const currentHour = new Date().getHours();
  const zoneNameLookup = useZoneNames();

  const { hours, zoneIds, gridMap } = useMemo(() => {
    if (!data || data.length === 0) return { hours: [], zoneIds: [], gridMap: {} };

    const allZones = [...new Set(data.map(d => d.zone_id))];
    const zoneIds = allZones.slice(0, 12);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>24-Hour Deployment Timeline</h3>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(59, 130, 246, 0.45)' }} /> 1 unit
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(245, 158, 11, 0.55)' }} /> 2 units
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(239, 68, 68, 0.65)' }} /> 3+ units
          </span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table className="deployment-grid" style={{ minWidth: 'auto' }}>
          <thead>
            <tr>
              <th style={{
                position: 'sticky', left: 0, zIndex: 2,
                background: 'var(--bg-card)', minWidth: 160,
                textAlign: 'left', padding: '8px 12px',
                borderRight: '2px solid var(--border)',
              }}>Zone</th>
              {hours.map(h => (
                <th key={h} style={{
                  padding: '6px 2px', minWidth: 32, textAlign: 'center',
                  fontSize: 10, fontWeight: h === currentHour ? 700 : 500,
                  color: h === currentHour ? 'var(--accent)' : 'var(--text-muted)',
                  background: h === currentHour ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                }}>
                  {String(h).padStart(2, '0')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zoneIds.map((zoneId, zi) => {
              const name = resolveZoneName(zoneNameLookup, zoneId);
              // Count total units across day for this zone
              const totalUnits = hours.reduce((sum, h) => {
                const entry = gridMap[`${h}-${zoneId}`];
                return sum + (entry?.units_assigned || 0);
              }, 0);

              return (
                <tr key={zoneId} style={{
                  background: zi % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 1,
                    background: zi % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)',
                    padding: '6px 12px',
                    borderRight: '2px solid var(--border)',
                    whiteSpace: 'nowrap',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {totalUnits} units/day
                    </div>
                  </td>
                  {hours.map(hour => {
                    const entry = gridMap[`${hour}-${zoneId}`];
                    const units = entry?.units_assigned || 0;
                    const isNow = hour === currentHour;

                    return (
                      <td
                        key={hour}
                        style={{
                          textAlign: 'center', padding: '4px 2px',
                          background: units > 0
                            ? getCellColor(units)
                            : isNow ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                          fontSize: 11, fontWeight: units > 0 ? 700 : 400,
                          color: units > 0 ? '#fff' : 'var(--text-muted)',
                          borderLeft: isNow ? '1px solid rgba(99, 102, 241, 0.3)' : 'none',
                          borderRight: isNow ? '1px solid rgba(99, 102, 241, 0.3)' : 'none',
                          transition: 'background 0.2s ease',
                        }}
                        title={units > 0
                          ? `${name} @ ${String(hour).padStart(2, '0')}:00 — ${units} unit${units > 1 ? 's' : ''}, ${entry.predicted_violations} predicted violations`
                          : `${name} @ ${String(hour).padStart(2, '0')}:00 — no deployment`
                        }
                      >
                        {units > 0 ? units : '·'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
