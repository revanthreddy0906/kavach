import { useState, useEffect } from 'react';
import { fetchZoneAction } from '../../utils/api';
import {
  X, MapPin, TrendingUp, Clock, Truck, CloudRain,
  ShieldAlert, IndianRupee, ChevronRight, Zap, Network
} from 'lucide-react';

const ICON_MAP = {
  'truck': Truck,
  'cloud-rain': CloudRain,
  'shield-alert': ShieldAlert,
  'indian-rupee': IndianRupee,
};

const PRIORITY_COLORS = {
  high: 'var(--danger)',
  medium: 'var(--warning)',
  low: 'var(--text-muted)',
  info: 'var(--accent)',
};

export default function ZoneInfoPanel({ zone, cascadeData, onClose }) {
  const [actionData, setActionData] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    if (!zone) return;
    setLoadingAction(true);
    setActionData(null);
    fetchZoneAction(zone.zone_id)
      .then(d => { if (!d.error) setActionData(d); })
      .catch(() => {})
      .finally(() => setLoadingAction(false));
  }, [zone?.zone_id]);

  if (!zone) return null;

  const getSeverityColor = (sev) => {
    if (sev === 'critical') return 'var(--danger)';
    if (sev === 'high') return 'var(--warning)';
    return 'var(--success)';
  };

  const d = actionData || {};

  return (
    <div className="zone-panel">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {zone.display_name || zone.zone_id}
          </h3>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={10} />
            {zone.zone_id}
            {d.rank && (
              <span style={{
                background: 'var(--bg-hover)', padding: '1px 6px',
                borderRadius: 4, fontSize: 10, fontWeight: 600,
              }}>
                Rank #{d.rank} of {d.total_zones}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', padding: 4,
        }}>
          <X size={16} />
        </button>
      </div>

      {/* Severity + CongestIQ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginTop: 14,
        padding: '10px 12px', borderRadius: 8, background: 'var(--bg-hover)',
      }}>
        <div style={{
          fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace",
          color: getSeverityColor(zone.severity),
        }}>
          {Number(zone.congestiq_score || 0).toLocaleString()}
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CongestIQ Score</div>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            color: getSeverityColor(zone.severity), letterSpacing: 0.5,
          }}>
            {zone.severity}
          </span>
        </div>
      </div>

      {/* Quick stats grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 8, marginTop: 12,
      }}>
        <div className="zone-detail" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="detail-label"><Clock size={10} /> Peak Hour</span>
          <span className="detail-value">{String(zone.peak_hour || 0).padStart(2, '0')}:00</span>
        </div>
        <div className="zone-detail" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="detail-label"><TrendingUp size={10} /> Violations/Day</span>
          <span className="detail-value">{zone.violations_per_day}</span>
        </div>
        <div className="zone-detail" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="detail-label">Primary Offence</span>
          <span className="detail-value" style={{ fontSize: 11 }}>{zone.primary_violation}</span>
        </div>
        <div className="zone-detail" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="detail-label">Dominant Vehicle</span>
          <span className="detail-value" style={{ fontSize: 11 }}>{zone.dominant_vehicle}</span>
        </div>
      </div>

      {/* Cascade info */}
      {cascadeData && cascadeData.frames && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Network size={12} style={{ color: 'var(--accent)' }} /> Cascade Spread
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {cascadeData.frames.map((frame, i) => (
              <div key={i} style={{
                flex: 1, textAlign: 'center', padding: '6px 4px',
                borderRadius: 6, background: 'var(--bg-hover)', fontSize: 10,
              }}>
                <div style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {frame.affected_nodes?.toLocaleString()}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>+{frame.minutes}m</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items — the key differentiator */}
      {d.actions && d.actions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
            textTransform: 'uppercase', letterSpacing: 0.5,
            color: 'var(--text-muted)',
          }}>
            <Zap size={12} /> Recommended Actions
          </div>
          {d.actions.map((action, i) => {
            const Icon = ICON_MAP[action.icon] || ChevronRight;
            return (
              <div key={i} style={{
                display: 'flex', gap: 10, padding: '10px 0',
                borderTop: '1px solid var(--border)',
                alignItems: 'flex-start',
              }}>
                <Icon size={14} style={{
                  color: PRIORITY_COLORS[action.priority] || 'var(--text-muted)',
                  flexShrink: 0, marginTop: 2,
                }} />
                <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                  {action.text}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Patrol schedule strip */}
      {d.patrol && d.patrol.hours_covered && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            Patrol hours ({d.patrol.total_units_across_day} total units)
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {Array.from({ length: 24 }, (_, h) => {
              const isActive = d.patrol.hours_covered.includes(h);
              return (
                <div key={h} style={{
                  flex: 1, height: 14, borderRadius: 2,
                  background: isActive ? 'var(--accent)' : 'var(--bg-hover)',
                  opacity: isActive ? 0.85 : 0.4,
                  cursor: 'default',
                }} title={`${String(h).padStart(2, '0')}:00 ${isActive ? '— patrol active' : ''}`} />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
            <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loadingAction && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 16 }}>
          Loading action data...
        </div>
      )}
    </div>
  );
}
