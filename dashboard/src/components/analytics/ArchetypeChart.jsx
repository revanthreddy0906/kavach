import { useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ARCHETYPE_COLORS = {
  'Commercial Morning Rush': '#f59e0b',
  'Transit Hub Chaos': '#ef4444',
  'IT Corridor Bottleneck': '#3b82f6',
  'Market Zone Persistent': '#f97316',
  'Residential Evening Surge': '#10b981',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="custom-tooltip">
      <div className="label">{d.junction_name}</div>
      <div className="item">Archetype: {d.archetype}</div>
      <div className="item">Peak Hour: {d.peak_hour}:00</div>
      <div className="item">Avg Violations/Day: {d.avg_violations_per_day}</div>
      <div className="item">Enforcement Rate: {(d.enforcement_rate * 100).toFixed(1)}%</div>
    </div>
  );
};

export default function ArchetypeChart({ data }) {
  const [selectedJunction, setSelectedJunction] = useState(null);

  if (!data || data.length === 0) return null;

  const uniqueArchetypes = [...new Set(data.map(d => d.archetype))];

  return (
    <div className="chart-card">
      <h3>Junction Archetypes</h3>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        {uniqueArchetypes.map(a => (
          <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: ARCHETYPE_COLORS[a] || '#8b5cf6'
            }} />
            <span style={{ color: 'var(--text-secondary)' }}>{a}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="peak_hour"
            name="Peak Hour"
            type="number"
            domain={[0, 23]}
            stroke="var(--text-muted)"
            fontSize={11}
            label={{ value: 'Peak Hour', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 11 }}
          />
          <YAxis
            dataKey="avg_violations_per_day"
            name="Avg Violations/Day"
            stroke="var(--text-muted)"
            fontSize={11}
            label={{ value: 'Violations/Day', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--text-muted)', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Scatter
            data={data}
            onClick={(e) => setSelectedJunction(e)}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={ARCHETYPE_COLORS[entry.archetype] || '#8b5cf6'}
                r={8}
                strokeWidth={selectedJunction?.junction_name === entry.junction_name ? 3 : 0}
                stroke="#fff"
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {selectedJunction && (
        <div className="playbook-card">
          <h4>{selectedJunction.junction_name}</h4>
          <p><strong>Archetype:</strong> {selectedJunction.archetype}</p>
          <p><strong>Playbook:</strong> {selectedJunction.playbook}</p>
          <p><strong>Dominant Vehicle:</strong> {selectedJunction.dominant_vehicle} | <strong>Weekend Ratio:</strong> {selectedJunction.weekend_ratio}</p>
        </div>
      )}
    </div>
  );
}
