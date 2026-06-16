import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="custom-tooltip">
      <div className="label">{d.police_station}</div>
      <div className="item">Enforcement Rate: {(d.enforcement_rate * 100).toFixed(1)}%</div>
      <div className="item">Total Violations: {Number(d.total_violations).toLocaleString()}</div>
      <div className="item">Approval Rate: {(d.approval_rate * 100).toFixed(1)}%</div>
      <div className="item">Anomaly Score: {d.anomaly_score?.toFixed(4)}</div>
    </div>
  );
};

export default function EnforcementChart({ data }) {
  if (!data || data.length === 0) return null;

  const avgRate = data.reduce((sum, d) => sum + d.enforcement_rate, 0) / data.length;

  // Sort by enforcement_rate for visual clarity
  const sorted = [...data].sort((a, b) => a.enforcement_rate - b.enforcement_rate);

  return (
    <div className="chart-card full-width">
      <h3>Enforcement Anomaly Analysis</h3>
      <ResponsiveContainer width="100%" height={Math.max(400, sorted.length * 28)}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            stroke="var(--text-muted)"
            fontSize={11}
          />
          <YAxis
            dataKey="police_station"
            type="category"
            width={110}
            stroke="var(--text-muted)"
            fontSize={11}
            tick={{ fill: 'var(--text-secondary)' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <ReferenceLine
            x={avgRate}
            stroke="var(--accent)"
            strokeDasharray="5 5"
            label={{
              value: `Avg: ${(avgRate * 100).toFixed(1)}%`,
              position: 'top',
              fill: 'var(--accent)',
              fontSize: 11,
            }}
          />
          <Bar dataKey="enforcement_rate" radius={[0, 4, 4, 0]} barSize={18}>
            {sorted.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.is_anomaly ? '#ef4444' : '#10b981'}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
