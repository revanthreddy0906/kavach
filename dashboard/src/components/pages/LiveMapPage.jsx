import { useState, useEffect } from 'react';
import { fetchHeatmap, fetchCascade, fetchPatrolPlan } from '../../utils/api';
import { PageHeader } from '../layout/TopBar';
import HeatmapMap from '../live/HeatmapMap';
import ZoneInfoPanel from '../live/ZoneInfoPanel';
import StatCard from '../common/StatCard';
import { MapPin, TrendingUp, AlertTriangle, Layers } from 'lucide-react';

export default function LiveMapPage() {
  const [zones, setZones] = useState([]);
  const [patrolData, setPatrolData] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [cascadeData, setCascadeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ high: true, medium: true, low: true });
  const [showLegend, setShowLegend] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [h, p] = await Promise.all([fetchHeatmap(), fetchPatrolPlan(new Date().getHours())]);
        setZones(h);
        setPatrolData(p);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleZoneClick = async (zone) => {
    setSelectedZone(zone);
    setCascadeData(null);
    try {
      const c = await fetchCascade(zone.zone_id);
      setCascadeData(c);
    } catch (e) { console.error(e); }
  };

  const filteredZones = zones.filter(z => {
    const s = z.congestiq_score;
    if (s > 700 && !filters.high) return false;
    if (s > 300 && s <= 700 && !filters.medium) return false;
    if (s <= 300 && !filters.low) return false;
    return true;
  });

  const toggleFilter = (key) => setFilters(f => ({ ...f, [key]: !f[key] }));

  const criticalCount = zones.filter(z => z.congestiq_score > 700).length;
  const avgCIQ = zones.length ? Math.round(zones.reduce((s, z) => s + (z.congestiq_score || 0), 0) / zones.length) : 0;

  return (
    <div>
      <PageHeader title="Live Map" description="Real-time congestion monitoring across Bengaluru." />

      {/* KPI strip */}
      <div className="stat-cards-row" style={{ marginBottom: 16 }}>
        <StatCard label="Total Zones" value={zones.length} icon={MapPin} accent="var(--accent)" />
        <StatCard label="Avg CongestionIQ" value={avgCIQ} icon={TrendingUp} accent="var(--warning)" />
        <StatCard label="Critical Zones" value={criticalCount} icon={AlertTriangle} accent="var(--danger)" subtext="CIQ > 700" />
      </div>

      {/* Controls bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="map-filters">
          <button className={`filter-pill ${filters.high ? 'active' : ''}`} onClick={() => toggleFilter('high')} style={filters.high ? { background: 'var(--danger-subtle)', borderColor: 'var(--danger)', color: 'var(--danger)' } : {}}>
            Critical ({zones.filter(z => z.congestiq_score > 700).length})
          </button>
          <button className={`filter-pill ${filters.medium ? 'active' : ''}`} onClick={() => toggleFilter('medium')} style={filters.medium ? { background: 'var(--warning-subtle)', borderColor: 'var(--warning)', color: 'var(--warning)' } : {}}>
            Moderate ({zones.filter(z => z.congestiq_score > 300 && z.congestiq_score <= 700).length})
          </button>
          <button className={`filter-pill ${filters.low ? 'active' : ''}`} onClick={() => toggleFilter('low')} style={filters.low ? { background: 'var(--success-subtle)', borderColor: 'var(--success)', color: 'var(--success)' } : {}}>
            Normal ({zones.filter(z => z.congestiq_score <= 300).length})
          </button>
        </div>
        <button className="filter-pill" onClick={() => setShowLegend(!showLegend)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={12} /> Legend
        </button>
      </div>

      <div className={`map-layout ${selectedZone ? '' : 'no-panel'}`}>
        <div style={{ position: 'relative', height: '100%' }}>
          <HeatmapMap
            zones={filteredZones}
            patrolData={patrolData}
            cascadeData={cascadeData}
            selectedZone={selectedZone}
            onZoneClick={handleZoneClick}
          />
          {/* Map legend overlay */}
          {showLegend && (
            <div className="map-legend">
              <h4>Legend</h4>
              <div className="map-legend-item">
                <span className="dot" style={{ background: '#ef4444' }} />
                <span>Critical (CIQ &gt; 700)</span>
              </div>
              <div className="map-legend-item">
                <span className="dot" style={{ background: '#f59e0b' }} />
                <span>Moderate (300-700)</span>
              </div>
              <div className="map-legend-item">
                <span className="dot" style={{ background: '#10b981' }} />
                <span>Normal (&lt; 300)</span>
              </div>
              <div className="map-legend-item" style={{ marginTop: 6 }}>
                <span className="dot" style={{ background: '#3b82f6' }} />
                <span>Patrol deployed</span>
              </div>
              <div className="map-legend-item">
                <span className="dot" style={{ background: 'rgba(139, 92, 246, 0.5)', border: '1px solid rgba(139, 92, 246, 0.6)' }} />
                <span>Cascade radius</span>
              </div>
            </div>
          )}
        </div>
        {selectedZone && (
          <ZoneInfoPanel
            zone={selectedZone}
            cascadeData={cascadeData}
            onClose={() => { setSelectedZone(null); setCascadeData(null); }}
          />
        )}
      </div>
    </div>
  );
}
