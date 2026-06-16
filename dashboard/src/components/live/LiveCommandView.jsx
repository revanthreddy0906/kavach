import { useState, useEffect } from 'react';
import { fetchHeatmap, fetchCascade, fetchPatrolPlan } from '../../utils/api';
import SkeletonLoader from '../common/SkeletonLoader';
import StatsBar from './StatsBar';
import HeatmapMap from './HeatmapMap';
import ZoneInfoPanel from './ZoneInfoPanel';

export default function LiveCommandView() {
  const [zones, setZones] = useState([]);
  const [patrolData, setPatrolData] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [cascadeData, setCascadeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [heatmapData, patrol] = await Promise.all([
          fetchHeatmap(),
          fetchPatrolPlan(new Date().getHours()),
        ]);
        setZones(heatmapData);
        setPatrolData(patrol);
      } catch (err) {
        console.error('Failed to load live data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleZoneClick = async (zone) => {
    setSelectedZone(zone);
    setCascadeData(null);
    try {
      const cascade = await fetchCascade(zone.zone_id);
      setCascadeData(cascade);
    } catch (err) {
      console.error('Failed to load cascade data:', err);
    }
  };

  const handleClosePanel = () => {
    setSelectedZone(null);
    setCascadeData(null);
  };

  if (loading) {
    return (
      <div>
        <SkeletonLoader type="stats" />
        <SkeletonLoader type="map" />
      </div>
    );
  }

  return (
    <div className={`live-view ${selectedZone ? '' : 'no-panel'}`}>
      <StatsBar zones={zones} />
      <HeatmapMap
        zones={zones}
        patrolData={patrolData}
        cascadeData={cascadeData}
        selectedZone={selectedZone}
        onZoneClick={handleZoneClick}
      />
      {selectedZone && (
        <ZoneInfoPanel
          zone={selectedZone}
          cascadeData={cascadeData}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}
