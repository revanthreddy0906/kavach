import { useMemo, useState, useRef, useEffect } from 'react';
import { useZoneNames, resolveZoneName } from '../../utils/zoneNames';

function getCellColor(units) {
  if (units >= 3) return 'rgba(239, 68, 68, 0.65)';
  if (units === 2) return 'rgba(245, 158, 11, 0.55)';
  if (units === 1) return 'rgba(59, 130, 246, 0.45)';
  return 'transparent';
}

export default function DeploymentGrid({ data, itineraries = [] }) {
  const currentHour = new Date().getHours();
  const zoneNameLookup = useZoneNames();
  const [popup, setPopup] = useState(null); // { zoneId, hour, x, y }
  const popupRef = useRef(null);

  // Close popup on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setPopup(null);
      }
    };
    if (popup) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popup]);

  // Build unit assignment lookup: { "hour-zone_id": [unit_label, ...] }
  const unitLookup = useMemo(() => {
    const lookup = {};
    itineraries.forEach(unit => {
      (unit.assignments || []).forEach(a => {
        // Each assignment covers a 2-hour block starting at start_hour
        const startHour = a.start_hour;
        for (let h = startHour; h < startHour + 2 && h < 24; h++) {
          const key = `${h}-${a.zone_id}`;
          if (!lookup[key]) lookup[key] = [];
          lookup[key].push({
            label: unit.unit_label,
            shift: `${unit.shift_start} – ${unit.shift_end}`,
            block: a.block,
            travel: a.travel_from_prev_min,
            distance: a.distance_from_prev_km,
            feasible: a.feasible,
          });
        }
      });
    });
    return lookup;
  }, [itineraries]);

  const { hours, zoneIds, gridMap } = useMemo(() => {
    if (!data || data.length === 0) return { hours: [], zoneIds: [], gridMap: {} };

    // Use ML-predicted plan as primary data source
    const allZones = [...new Set(data.map(d => d.zone_id))];
    const zoneIds = allZones.slice(0, 15);
    const hours = [...new Set(data.map(d => d.hour))].sort((a, b) => a - b);

    const gridMap = {};
    data.forEach(d => {
      const key = `${d.hour}-${d.zone_id}`;
      gridMap[key] = d;
    });

    return { hours, zoneIds, gridMap };
  }, [data]);

  const handleCellClick = (e, zoneId, hour, units) => {
    if (units === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({
      zoneId,
      hour,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 4,
    });
  };

  if (hours.length === 0) {
    return (
      <div className="deployment-grid-wrapper">
        <h3>24-Hour Deployment Timeline</h3>
        <p style={{ color: 'var(--text-muted)', padding: 20 }}>No patrol data available</p>
      </div>
    );
  }

  const popupUnits = popup ? (unitLookup[`${popup.hour}-${popup.zoneId}`] || []) : [];
  const popupEntry = popup ? gridMap[`${popup.hour}-${popup.zoneId}`] : null;
  const popupName = popup ? resolveZoneName(zoneNameLookup, popup.zoneId) : '';

  return (
    <div className="deployment-grid-wrapper" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>24-Hour Deployment Timeline</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Units predicted by LightGBM temporal model · Click cells to view routed unit assignments and coverage gaps
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', alignItems: 'center' }}>
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
              // Stats from ML-predicted demand
              let coveredHours = 0;
              let peakUnits = 0;
              hours.forEach(h => {
                const entry = gridMap[`${h}-${zoneId}`];
                const u = entry?.units_assigned || 0;
                if (u > 0) coveredHours++;
                if (u > peakUnits) peakUnits = u;
              });

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
                      {coveredHours}h coverage · peak {peakUnits} units
                    </div>
                  </td>
                  {hours.map(hour => {
                    const entry = gridMap[`${hour}-${zoneId}`];
                    // ML-predicted demand (from LightGBM temporal model)
                    const predicted = entry?.units_assigned || 0;
                    const isNow = hour === currentHour;
                    const isActive = popup?.zoneId === zoneId && popup?.hour === hour;

                    return (
                      <td
                        key={hour}
                        onClick={(e) => handleCellClick(e, zoneId, hour, predicted)}
                        style={{
                          textAlign: 'center', padding: '4px 2px',
                          background: isActive
                            ? '#6366f1'
                            : predicted > 0
                              ? getCellColor(predicted)
                              : isNow ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                          fontSize: 11, fontWeight: predicted > 0 || isActive ? 700 : 400,
                          color: predicted > 0 || isActive ? '#fff' : 'var(--text-muted)',
                          cursor: predicted > 0 ? 'pointer' : 'default',
                          borderLeft: isNow ? '1px solid rgba(99, 102, 241, 0.3)' : 'none',
                          borderRight: isNow ? '1px solid rgba(99, 102, 241, 0.3)' : 'none',
                          transition: 'background 0.15s ease',
                          outline: isActive ? '2px solid #818cf8' : 'none',
                          outlineOffset: isActive ? -1 : 0,
                          borderRadius: isActive ? 3 : 0,
                        }}
                      >
                        {predicted > 0 ? predicted : '\u00b7'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Unit detail popup */}
      {popup && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            left: Math.min(popup.x - 140, window.innerWidth - 300),
            top: popup.y,
            width: 280,
            background: '#1a1f2e',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
            zIndex: 100,
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{popupName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {String(popup.hour).padStart(2, '0')}:00 – {String(popup.hour + 1).padStart(2, '0')}:00
              </div>
            </div>
            <button
              onClick={() => setPopup(null)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1,
              }}
            >&times;</button>
          </div>

          {/* Stats row */}
          {popupEntry && (() => {
            const demanded = popupEntry.units_assigned;
            const routed = popupUnits.length;
            const gap = demanded - routed;
            return (
              <div style={{
                display: 'flex', gap: 8, marginBottom: 12, padding: '8px 0',
                borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                    {demanded}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Demand</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: routed >= demanded ? 'var(--success)' : 'var(--warning)' }}>
                    {routed}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Routed</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--warning)' }}>
                    {popupEntry.predicted_violations}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Violations</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--success)' }}>
                    {popupEntry.predicted_reduction_pct}%
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reduction</div>
                </div>
              </div>
            );
          })()}

          {/* Coverage gap alert */}
          {popupEntry && popupUnits.length < popupEntry.units_assigned && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 6, padding: '6px 8px', marginBottom: 10, fontSize: 11,
              color: 'var(--warning)',
            }}>
              ⚠ Coverage gap: model demands {popupEntry.units_assigned} but routing delivers {popupUnits.length}
            </div>
          )}

          {/* Unit list */}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, fontWeight: 600 }}>
            Routed Units
          </div>
          {popupUnits.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {popupUnits.map((u, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 8px', borderRadius: 6,
                  background: 'var(--bg-hover)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      background: 'var(--accent)', color: '#fff',
                      fontSize: 10, fontWeight: 700, padding: '2px 6px',
                      borderRadius: 4, fontFamily: "'JetBrains Mono', monospace",
                    }}>{u.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{u.block}</span>
                  </div>
                  {u.travel !== null && (
                    <span style={{
                      fontSize: 10,
                      color: u.feasible ? 'var(--text-muted)' : 'var(--danger)',
                    }}>
                      {u.distance}km
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0', fontStyle: 'italic' }}>
              No units routed — transit constraints prevent coverage at this hour.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
