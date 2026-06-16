import { useState, useEffect } from 'react';
import { fetchEnforcement, fetchArchetypes } from '../../utils/api';
import SkeletonLoader from '../common/SkeletonLoader';
import StatCard from '../common/StatCard';
import EnforcementChart from './EnforcementChart';
import ArchetypeChart from './ArchetypeChart';
import TrendChart from './TrendChart';

export default function AnalyticsView() {
  const [enforcement, setEnforcement] = useState([]);
  const [archetypes, setArchetypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [enfData, archData] = await Promise.all([
          fetchEnforcement(),
          fetchArchetypes(),
        ]);
        setEnforcement(enfData);
        setArchetypes(archData);
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="analytics-view">
        <SkeletonLoader type="stats" />
        <SkeletonLoader type="chart" />
        <SkeletonLoader type="chart" />
      </div>
    );
  }

  const totalViolations = enforcement.reduce((sum, e) => sum + e.total_violations, 0);
  const anomalousCount = enforcement.filter(e => e.is_anomaly).length;
  const avgEnforcementRate = enforcement.length > 0
    ? enforcement.reduce((sum, e) => sum + e.enforcement_rate, 0) / enforcement.length
    : 0;
  const archetypeCount = new Set(archetypes.map(a => a.archetype)).size;

  return (
    <div className="analytics-view">
      <div className="stat-cards-row">
        <StatCard
          label="Total Violations"
          value={totalViolations}
          accent="var(--accent-primary)"
          subtext="Across all stations"
        />
        <StatCard
          label="Anomalous Stations"
          value={anomalousCount}
          accent="var(--accent-danger)"
          subtext={`of ${enforcement.length} total`}
        />
        <StatCard
          label="Avg Enforcement Rate"
          value={avgEnforcementRate * 100}
          decimals={1}
          suffix="%"
          accent="var(--accent-success)"
          subtext="Across BTP"
        />
        <StatCard
          label="Junction Archetypes"
          value={archetypeCount}
          accent="var(--accent-purple)"
          subtext={`${archetypes.length} junctions classified`}
        />
      </div>

      <EnforcementChart data={enforcement} />

      <div className="charts-grid">
        <ArchetypeChart data={archetypes} />
        <TrendChart />
      </div>
    </div>
  );
}
