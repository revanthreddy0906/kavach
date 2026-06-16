import { X } from 'lucide-react';

export default function ZoneInfoPanel({ zone, cascadeData, onClose }) {
  if (!zone) return null;

  const getSeverityClass = (score) => {
    if (score > 700) return 'severity-high';
    if (score > 300) return 'severity-medium';
    return 'severity-low';
  };

  return (
    <div className="zone-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Zone Details</h3>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 18, padding: 4
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div className="zone-id">{zone.zone_id}</div>

      <div className="zone-detail">
        <span className="detail-label">CongestIQ Score</span>
        <span className={`detail-value ${getSeverityClass(zone.congestiq_score)}`}>
          {Number(zone.congestiq_score).toLocaleString()}
        </span>
      </div>

      <div className="zone-detail">
        <span className="detail-label">Cascade Reach</span>
        <span className="detail-value">{zone.cascade_reach} nodes</span>
      </div>

      <div className="zone-detail">
        <span className="detail-label">Primary Violation</span>
        <span className="detail-value">{zone.primary_violation}</span>
      </div>

      <div className="zone-detail">
        <span className="detail-label">Dominant Vehicle</span>
        <span className="detail-value">{zone.dominant_vehicle}</span>
      </div>

      <div className="zone-detail">
        <span className="detail-label">Predicted (6h)</span>
        <span className={`detail-value ${getSeverityClass(zone.predicted_score_6h)}`}>
          {Number(zone.predicted_score_6h).toLocaleString()}
        </span>
      </div>

      {cascadeData && cascadeData.frames && (
        <>
          <h3 style={{ marginTop: 20 }}>Cascade Spread</h3>
          {cascadeData.frames.map((frame, i) => (
            <div key={i} className="zone-detail">
              <span className="detail-label">+{frame.minutes} min</span>
              <span className="detail-value" style={{ color: 'var(--accent)' }}>
                {frame.affected_nodes} nodes
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
