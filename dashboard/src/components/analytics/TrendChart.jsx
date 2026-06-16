import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock monthly trend data derived from analysis period (Nov 2023 - Apr 2024)
const MONTHLY_TRENDS = [
  { month: 'Nov 2023', violations: 42350, enforcement_rate: 0.78 },
  { month: 'Dec 2023', violations: 38200, enforcement_rate: 0.80 },
  { month: 'Jan 2024', violations: 51400, enforcement_rate: 0.82 },
  { month: 'Feb 2024', violations: 55800, enforcement_rate: 0.84 },
  { month: 'Mar 2024', violations: 62100, enforcement_rate: 0.85 },
  { month: 'Apr 2024', violations: 48427, enforcement_rate: 0.87 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      <div className="item">Violations: {Number(payload[0]?.value).toLocaleString()}</div>
    </div>
  );
};

export default function TrendChart() {
  return (
    <div className="chart-card">
      <h3>Violation Trends (Nov 2023 – Apr 2024)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={MONTHLY_TRENDS} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <defs>
            <linearGradient id="violationGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="month"
            stroke="var(--text-muted)"
            fontSize={11}
            tick={{ fill: 'var(--text-secondary)' }}
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={11}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="violations"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#violationGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
