import { useAnimatedCounter } from '../../hooks/useAnimatedCounter';

export default function StatCard({ label, value, decimals = 0, suffix = '', accent = 'var(--accent-primary)', subtext }) {
  const animatedValue = useAnimatedCounter(value, 1200, decimals);

  return (
    <div className="stat-card" style={{ '--stat-accent': accent }}>
      <span className="label">{label}</span>
      <span className="value data-number">
        {animatedValue}{suffix}
      </span>
      {subtext && <span className="subtext">{subtext}</span>}
    </div>
  );
}
