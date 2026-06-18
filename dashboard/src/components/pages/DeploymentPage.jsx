import { useState, useEffect } from 'react';
import { PageHeader } from '../layout/TopBar';
import { fetchPatrolPlan, fetchPatrolItineraries } from '../../utils/api';
import DeploymentGrid from '../patrol/DeploymentGrid';
import StatCard from '../common/StatCard';
import { Truck, Clock, Route, AlertTriangle, MapPin, ChevronDown, ChevronUp, CheckCircle, XCircle, Target, Eye } from 'lucide-react';

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

          {/* Disclaimer */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 14px', marginBottom: 12,
            background: 'rgba(245, 158, 11, 0.06)',
            border: '1px solid rgba(245, 158, 11, 0.15)',
            borderRadius: 8, fontSize: 12, lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>&#x26A0;</span>
            <span>
              <strong style={{ color: 'var(--warning)' }}>Assumption-based scenario.</strong>{' '}
              Unit counts, distances, and travel times below are mathematical estimates using haversine distance with a 1.2x road
              factor and Bengaluru average speeds (20 km/h peak, 30 km/h off-peak). These are not real-time GPS readings.
              This represents how the system could operate with BTP's actual fleet configuration.
            </span>
          </div>

          {/* Feasibility rule */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 14px', marginBottom: 16,
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 8, fontSize: 12, lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>&#x2139;</span>
            <span>
              <strong style={{ color: 'var(--text-primary)' }}>Feasibility threshold: 45 minutes.</strong>{' '}
              Transits under 45 min are feasible — the unit arrives with patrol time remaining.
              Over 45 min means most of the 2-hour block is consumed by driving. Hover the
              <Eye size={12} style={{ verticalAlign: 'middle', margin: '0 3px' }} />
              icon at each stop for detailed breakdown.
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
                      {/* Patrol vs Transit visual bar */}
                      <div style={{ margin: '0 0 16px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                          <span style={{ color: 'var(--success)' }}>Patrol: {unit.effective_patrol_min} min</span>
                          <span style={{ color: 'var(--warning)' }}>Transit: {unit.total_transit_min} min</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden', display: 'flex' }}>
                          <div style={{
                            width: `${Math.round(unit.effective_patrol_min / (unit.effective_patrol_min + unit.total_transit_min) * 100)}%`,
                            background: 'var(--success)', borderRadius: '3px 0 0 3px',
                          }} />
                          <div style={{
                            flex: 1,
                            background: 'var(--warning)', borderRadius: '0 3px 3px 0',
                          }} />
                        </div>
                      </div>

                      <div className="route-timeline">
                        {unit.assignments.map((a, i) => {
                          const blockStart = a.start_hour;
                          const travelMin = a.travel_from_prev_min || 0;
                          const arrivalMin = i === 0 ? 0 : travelMin;
                          const patrolRemaining = Math.max(0, Math.round(120 - arrivalMin));
                          const arrivalTimeStr = i === 0 ? `${String(blockStart).padStart(2, '0')}:00`
                            : `${String(blockStart).padStart(2, '0')}:${String(Math.round(travelMin) % 60).padStart(2, '0')}`;

                          return (
                            <div key={i}>
                              {/* Stop */}
                              <div className="route-step">
                                <div className="route-dot-line">
                                  <div className={`route-dot ${i === 0 ? 'start' : a.feasible === false ? 'infeasible' : ''}`} />
                                  {i < unit.assignments.length - 1 && <div className="route-line" />}
                                </div>
                                <div className="route-content">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <MapPin size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>{a.zone_name}</span>
                                    <span style={{
                                      fontSize: 10, padding: '1px 6px', borderRadius: 4,
                                      background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent)',
                                    }}>{a.block}</span>

                                    {/* Hover info icon */}
                                    {i > 0 && a.travel_from_prev_min !== null && (
                                      <span className="itinerary-info-icon" style={{ position: 'relative', cursor: 'pointer' }}>
                                        <Eye size={14} style={{
                                          color: a.feasible ? 'var(--text-muted)' : 'var(--danger)',
                                        }} />
                                        <span className="itinerary-tooltip">
                                          <span style={{ fontWeight: 600, color: '#fff', display: 'block', marginBottom: 4 }}>
                                            Transit from {unit.assignments[i - 1].zone_name}
                                          </span>
                                          <span>Distance: {a.distance_from_prev_km} km</span>
                                          <span>Travel time: ~{a.travel_from_prev_min} min</span>
                                          <span>Arrives at: ~{arrivalTimeStr}</span>
                                          <span style={{ color: patrolRemaining > 60 ? 'var(--success)' : 'var(--warning)' }}>
                                            Patrol remaining: {patrolRemaining} min of 120 min block
                                          </span>
                                          {!a.feasible && (
                                            <span style={{ color: 'var(--danger)', fontWeight: 600, marginTop: 2 }}>
                                              Over 45 min threshold — low patrol value
                                            </span>
                                          )}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                  {i === 0 && (
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 20, marginTop: 2 }}>
                                      Shift starts here — full 120 min patrol block
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
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
