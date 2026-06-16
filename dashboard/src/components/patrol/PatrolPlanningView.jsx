import { useState, useEffect } from 'react';
import { fetchPatrolPlan } from '../../utils/api';
import SkeletonLoader from '../common/SkeletonLoader';
import DeploymentGrid from './DeploymentGrid';
import CounterfactualSlider from './CounterfactualSlider';

export default function PatrolPlanningView() {
  const [patrolData, setPatrolData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchPatrolPlan();
        setPatrolData(data);
      } catch (err) {
        console.error('Failed to load patrol data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="patrol-view">
        <SkeletonLoader type="chart" />
        <SkeletonLoader type="chart" />
      </div>
    );
  }

  return (
    <div className="patrol-view">
      <DeploymentGrid data={patrolData} />
      <CounterfactualSlider />
    </div>
  );
}
