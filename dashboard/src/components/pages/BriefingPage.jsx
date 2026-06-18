import { useState, useEffect } from 'react';
import { fetchDailyBriefing } from '../../utils/api';
import {
  Shield, AlertTriangle, Truck, ShieldAlert,
  CloudRain, Network, IndianRupee, Printer,
  ChevronRight, MapPin, Clock, TrendingUp
} from 'lucide-react';

export default function BriefingPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDailyBriefing()
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="briefing-page"><div className="skeleton skeleton-chart" /></div>;
  if (!data) return <div className="briefing-page">No briefing data available.</div>;

  const handlePrint = () => window.print();

  return (
    <div className="briefing-page">
      {/* Header */}
      <div className="briefing-header">
        <div className="briefing-header-left">
          <div className="briefing-logo">
            <Shield size={28} />
          </div>
          <div>
            <h1 className="briefing-title">Daily Intelligence Briefing</h1>
            <p className="briefing-date">{data.date}</p>
          </div>
        </div>
        <button className="briefing-print-btn" onClick={handlePrint}>
          <Printer size={16} />
          Print Briefing
        </button>
      </div>

      <div className="briefing-divider" />

      {/* Priority Zones */}
      <section className="briefing-section">
        <div className="briefing-section-header">
          <AlertTriangle size={18} className="section-icon priority" />
          <h2>Priority Zones</h2>
        </div>
        {(data.priority_zones || []).slice(0, 3).map((z, i) => (
          <div key={i} className="briefing-card priority">
            <div className="briefing-card-header">
              <div className="briefing-card-rank">{i + 1}</div>
              <div>
                <div className="briefing-card-title">{z.zone_name}</div>
                <div className="briefing-card-meta">
                  <span><MapPin size={12} /> {z.zone_id}</span>
                  <span><Clock size={12} /> Peak at {String(z.peak_hour).padStart(2, '0')}:00</span>
                  <span className={`severity-indicator ${z.severity}`}>{z.severity}</span>
                </div>
              </div>
            </div>
            <p className="briefing-card-text">{z.text}</p>
            <div className="briefing-card-stats">
              <div className="briefing-stat">
                <span className="briefing-stat-value">{(z.congestiq || 0).toLocaleString()}</span>
                <span className="briefing-stat-label">CongestIQ</span>
              </div>
              <div className="briefing-stat">
                <span className="briefing-stat-value">{z.violations_per_day}</span>
                <span className="briefing-stat-label">Violations/Day</span>
              </div>
              <div className="briefing-stat">
                <span className="briefing-stat-value">{z.primary_violation}</span>
                <span className="briefing-stat-label">Primary Offence</span>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="briefing-divider" />

      {/* Patrol Deployment */}
      <section className="briefing-section">
        <div className="briefing-section-header">
          <Truck size={18} className="section-icon patrol" />
          <h2>Patrol Deployment</h2>
        </div>
        <div className="briefing-card patrol">
          <p className="briefing-card-text">{data.patrol_summary?.text}</p>
          <div className="briefing-card-stats">
            <div className="briefing-stat">
              <span className="briefing-stat-value">{data.patrol_summary?.total_units}</span>
              <span className="briefing-stat-label">Units Deployed</span>
            </div>
            <div className="briefing-stat">
              <span className="briefing-stat-value">{data.patrol_summary?.zones_covered}</span>
              <span className="briefing-stat-label">Zones Covered</span>
            </div>
            <div className="briefing-stat">
              <span className="briefing-stat-value">{data.patrol_summary?.avg_reduction_pct}%</span>
              <span className="briefing-stat-label">Avg Reduction</span>
            </div>
            <div className="briefing-stat">
              <span className="briefing-stat-value">{data.patrol_summary?.fleet_efficiency_pct}%</span>
              <span className="briefing-stat-label">Fleet Efficiency</span>
            </div>
          </div>
        </div>
      </section>

      <div className="briefing-divider" />

      {/* Enforcement Gaps */}
      {data.enforcement_gaps?.length > 0 && (
        <section className="briefing-section">
          <div className="briefing-section-header">
            <ShieldAlert size={18} className="section-icon enforcement" />
            <h2>Enforcement Gaps</h2>
          </div>
          {data.enforcement_gaps.map((g, i) => (
            <div key={i} className="briefing-card enforcement">
              <div className="briefing-card-header">
                <ChevronRight size={16} className="section-icon enforcement" />
                <div className="briefing-card-title">{g.station}</div>
              </div>
              <p className="briefing-card-text">{g.text}</p>
              <div className="briefing-card-stats">
                <div className="briefing-stat">
                  <span className="briefing-stat-value" style={{ color: 'var(--danger)' }}>{g.enforcement_rate}%</span>
                  <span className="briefing-stat-label">Enforcement Rate</span>
                </div>
                <div className="briefing-stat">
                  <span className="briefing-stat-value">-{g.gap_pp}pp</span>
                  <span className="briefing-stat-label">Below Average</span>
                </div>
                <div className="briefing-stat">
                  <span className="briefing-stat-value">{(g.total_violations || 0).toLocaleString()}</span>
                  <span className="briefing-stat-label">Total Violations</span>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {data.enforcement_gaps?.length > 0 && <div className="briefing-divider" />}

      {/* Weather Alerts */}
      {data.weather_alerts?.length > 0 && (
        <section className="briefing-section">
          <div className="briefing-section-header">
            <CloudRain size={18} className="section-icon weather" />
            <h2>Weather Sensitivity Alerts</h2>
          </div>
          {data.weather_alerts.map((w, i) => (
            <div key={i} className="briefing-card weather">
              <div className="briefing-card-header">
                <CloudRain size={16} className="section-icon weather" />
                <div className="briefing-card-title">{w.zone_name}</div>
                <span className="briefing-badge surge">+{w.pct_change}% on rain</span>
              </div>
              <p className="briefing-card-text">{w.text}</p>
            </div>
          ))}
        </section>
      )}

      {data.weather_alerts?.length > 0 && <div className="briefing-divider" />}

      {/* Network Intelligence & Economic Impact */}
      <section className="briefing-section">
        <div className="briefing-section-header">
          <Network size={18} className="section-icon network" />
          <h2>Network Intelligence & Economic Impact</h2>
        </div>
        <div className="briefing-card network">
          <div className="briefing-card-stats" style={{ marginBottom: 16 }}>
            <div className="briefing-stat">
              <span className="briefing-stat-value">{data.network_stats?.spillover_events}</span>
              <span className="briefing-stat-label">Spillover Events</span>
            </div>
            <div className="briefing-stat">
              <span className="briefing-stat-value">{data.network_stats?.super_spreader_zones}</span>
              <span className="briefing-stat-label">Super-Spreader Zones</span>
            </div>
            <div className="briefing-stat">
              <span className="briefing-stat-value">₹{(data.economic_impact?.cost_per_violation_inr || 0).toLocaleString()}</span>
              <span className="briefing-stat-label">Cost Per Violation</span>
            </div>
          </div>
          <p className="briefing-card-text" style={{ fontSize: 14, lineHeight: 1.7 }}>
            Each violation at a major junction costs the city an estimated
            <strong> ₹{(data.economic_impact?.cost_per_violation_inr || 0).toLocaleString()}</strong> in
            lost productivity (45 vehicles affected, 8.4 min average delay, ₹175/hr value of time per NITI Aayog estimates).
          </p>
          {data.economic_impact?.annual_savings_crore > 0 && (
            <div className="briefing-highlight">
              <IndianRupee size={20} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  At 90% enforcement, KAVACH projects:
                </div>
                <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.7 }}>
                  <strong>₹{data.economic_impact.annual_savings_crore} crore</strong> annual savings &nbsp;·&nbsp;
                  <strong>{(data.economic_impact.delivery_hours_monthly || 0).toLocaleString()}</strong> delivery hours recovered/month &nbsp;·&nbsp;
                  <strong>{(data.economic_impact.sla_rescues_monthly || 0).toLocaleString()}</strong> SLA-at-risk deliveries rescued/month
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <div className="briefing-footer">
        <div>KAVACH — Parking Congestion Cascade Intelligence Platform</div>
        <div>Generated from historical data: Nov 9, 2023 – April 8, 2024 (298,277 violations across 789 zones)</div>
        <div>Bengaluru Traffic Police · Confidential</div>
      </div>
    </div>
  );
}
