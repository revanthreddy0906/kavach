import { useState, useEffect } from 'react';
import { PageHeader } from '../layout/TopBar';
import { fetchPatrolPlan, fetchPatrolItineraries } from '../../utils/api';
import DeploymentGrid from '../patrol/DeploymentGrid';
import StatCard from '../common/StatCard';
import { Truck, Clock, Route, AlertTriangle, MapPin, ChevronDown, ChevronUp, CheckCircle, XCircle, Target } from 'lucide-react';

export default function DeploymentPage() {
  const [planData, setPlanData] = useState([]);
  const [itineraryData, setItineraryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedUnit, setExpandedUnit] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchPatrolPlan(),
      fetchPatrolItineraries(),
    ]).then(([plan, itin]) => {
      setPlanData(plan);
      setItineraryData(itin);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fleet = itineraryData?.fleet_summary || {};
  const itineraries = itineraryData?.unit_itineraries || [];

  // Compute demand coverage: what % of predicted demand is met by routed units
  const demandCoverage = (() => {
    if (!planData.length || !itineraries.length) return null;
    // Total predicted unit-slots across all plan entries
    const totalDemand = planData.reduce((s, e) => s + (e.units_assigned || 0), 0);
    // Total routed unit-slots from itineraries
    let totalRouted = 0;
    itineraries.forEach(u => {
      totalRouted += (u.assignments || []).length;
    });
    return totalDemand > 0 ? Math.round((totalRouted / totalDemand) * 100) : 0;
  })();

  return (
    <div>
      <PageHeader title="Deployment Schedule" description="ML-predicted unit demand mapped against routed fleet capacity across 24 hours." />

      {/* Fleet Summary KPIs */}
      {fleet.total_units && (
        <div className="stat-cards-row" style={{ marginBottom: 24 }}>
          <StatCard
            label="Demand Coverage"
            value={demandCoverage}
            suffix="%"
            icon={Target}
            accent={demandCoverage >= 70 ? 'var(--success)' : 'var(--warning)'}
            subtext="Predicted vs routed units"
          />
          <StatCard
            label="Fleet Efficiency"
            value={fleet.patrol_efficiency_pct}
            decimals={1}
            suffix="%"
            icon={Truck}
            accent="var(--success)"
            subtext="Patrol vs transit time"
          />
          <StatCard
            label="Avg Transit / Unit"
            value={fleet.avg_transit_min_per_unit}
            decimals={0}
            suffix=" min"
            icon={Clock}
            accent="var(--warning)"
            subtext={`${fleet.avg_distance_km_per_unit} km avg`}
          />
          <StatCard
            label="Fleet Distance"
            value={fleet.total_distance_km}
            decimals={0}
            suffix=" km"
            icon={Route}
            accent="var(--accent)"
            subtext={`${fleet.total_units} units deployed`}
          />
          <StatCard
            label="Infeasible Transits"
            value={fleet.infeasible_assignments}
            icon={AlertTriangle}
            accent={fleet.infeasible_assignments > 0 ? 'var(--danger)' : 'var(--success)'}
            subtext="> 45 min transit"
          />
        </div>
      )}

      {/* Deployment Grid */}
      {!loading && <DeploymentGrid data={planData} itineraries={itineraries} />}

      {/* Unit Itineraries */}
      {itineraries.length > 0 && (
        <div className="panel" style={{ marginTop: 24 }}>
          <div className="panel-header">
            <h3>Unit Itineraries</h3>
            <span className="badge" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
              {itineraries.length} units
            </span>
          </div>

          <div className="itinerary-list">
            {itineraries.map((unit) => {
              const isExpanded = expandedUnit === unit.unit_id;
              return (
                <div key={unit.unit_id} className="itinerary-card">
                  {/* Unit Header — always visible */}
                  <div
                    className="itinerary-header"
                    onClick={() => setExpandedUnit(isExpanded ? null : unit.unit_id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="unit-badge">{unit.unit_label}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {unit.shift_start} – {unit.shift_end}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {unit.total_assignments} stops · {unit.total_distance_km} km · {unit.total_transit_min} min transit
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        color: unit.effective_patrol_min > unit.total_transit_min ? 'var(--success)' : 'var(--warning)'
                      }}>
                        {Math.round(unit.effective_patrol_min / (unit.effective_patrol_min + unit.total_transit_min) * 100)}% patrol
                      </div>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expanded Detail — route steps */}
                  {isExpanded && (
                    <div className="itinerary-detail">
                      <div className="route-timeline">
                        {unit.assignments.map((a, i) => (
                          <div key={i} className="route-step">
                            <div className="route-dot-line">
                              <div className={`route-dot ${i === 0 ? 'start' : ''}`} />
                              {i < unit.assignments.length - 1 && <div className="route-line" />}
                            </div>
                            <div className="route-content">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                <MapPin size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{a.zone_name}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.block}</span>
                              </div>
                              {a.travel_from_prev_min !== null && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 20, fontSize: 12 }}>
                                  {a.feasible ? (
                                    <CheckCircle size={12} style={{ color: 'var(--success)' }} />
                                  ) : (
                                    <XCircle size={12} style={{ color: 'var(--danger)' }} />
                                  )}
                                  <span style={{ color: a.feasible ? 'var(--text-secondary)' : 'var(--danger)' }}>
                                    {a.distance_from_prev_km} km · ~{a.travel_from_prev_min} min
                                    {!a.feasible && ' (exceeds 45 min)'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
