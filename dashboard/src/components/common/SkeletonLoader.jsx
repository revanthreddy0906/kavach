export default function SkeletonLoader({ type = 'card' }) {
  if (type === 'map') {
    return <div className="skeleton skeleton-map" />;
  }

  if (type === 'chart') {
    return (
      <div className="chart-card">
        <div className="skeleton skeleton-text short" />
        <div className="skeleton skeleton-chart" />
      </div>
    );
  }

  if (type === 'stats') {
    return (
      <div className="stat-cards-row">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
    );
  }

  return <div className="skeleton skeleton-card" />;
}
