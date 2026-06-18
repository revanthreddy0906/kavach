import { useState, useEffect } from 'react';
import { PageHeader } from '../layout/TopBar';
import { fetchCounterfactual } from '../../utils/api';
import StatCard from '../common/StatCard';
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter';
import { useZoneNames, resolveZoneName } from '../../utils/zoneNames';
import { Target, Clock, Truck, TrendingDown } from 'lucide-react';

export default function ImpactPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const zoneNameLookup = useZoneNames();

  useEffect(() => {
    fetchCounterfactual(0.9).then(d => { setResult(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

const reduction = useAnimatedCounter(result?.scenario?.reduction_pct || 0, 1000, 1);
const hoursSaved = useAnimatedCounter(result?.scenario?.hours_saved_monthly || 0, 1000, 0);
const deliveryHours = useAnimatedCounter(result?.scenario?.flipkart?.delivery_hours_saved_monthly || 0, 1000, 0);

  if (!result && !loading) return <div>No data available.</div>;

  return (
    <div>
      <PageHeader title="Impact Assessment" description="Quantified impact of increasing enforcement rate to 90% — before and after comparison." />

      {result && (
        <>
          <div className="stat-cards-row">
            <StatCard label="CongestionIQ Reduction" value={result.scenario.reduction_pct} decimals={1} suffix="%" icon={TrendingDown} accent="var(--success)"
              subtext={result.scenario.reduction_ci ? `95% CI: ${result.scenario.reduction_ci_lower}%\u2013${result.scenario.reduction_ci_upper}%` : undefined} />
            <StatCard label="Hours Saved / Month" value={result.scenario.hours_saved_monthly} icon={Clock} accent="var(--accent)"
              subtext={result.scenario.hours_ci_lower != null ? `95% CI: ${Number(result.scenario.hours_ci_lower).toLocaleString()}\u2013${Number(result.scenario.hours_ci_upper).toLocaleString()}` : undefined} />
            <StatCard label="Delivery Hours Saved" value={result.scenario.flipkart.delivery_hours_saved_monthly} icon={Truck} accent="var(--accent)"
              subtext={result.scenario.flipkart.delivery_hours_ci ? `95% CI: ${result.scenario.flipkart.delivery_hours_ci.replace('--', '\u2013')}` : undefined} />
            <StatCard label="Zones Impacted" value={result.scenario?.zones_affected || result.scenario?.top_zones_impacted?.length || 0} icon={Target} accent="var(--warning)" />
          </div>

          {/* Before / After comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div className="panel" style={{ textAlign: 'center' }}>
              <h3 style={{ marginBottom: 16 }}>Baseline CongestionIQ</h3>
              <div className="data-number" style={{ fontSize: 42, color: 'var(--danger)', letterSpacing: '-0.02em' }}>
                {Number(result.scenario.baseline_congestiq).toLocaleString()}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Current aggregate score</p>
              <div style={{ height: 8, background: 'var(--danger-subtle)', borderRadius: 4, marginTop: 16 }}>
                <div style={{ height: '100%', background: 'var(--danger)', borderRadius: 4, width: '100%' }} />
              </div>
            </div>
            <div className="panel" style={{ textAlign: 'center' }}>
              <h3 style={{ marginBottom: 16 }}>Simulated CongestionIQ</h3>
              <div className="data-number" style={{ fontSize: 42, color: 'var(--success)', letterSpacing: '-0.02em' }}>
                {Number(result.scenario.simulated_congestiq).toLocaleString()}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>At 90% enforcement rate</p>
              <div style={{ height: 8, background: 'var(--success-subtle)', borderRadius: 4, marginTop: 16 }}>
                <div style={{
                  height: '100%', background: 'var(--success)', borderRadius: 4,
                  width: `${(result.scenario.simulated_congestiq / result.scenario.baseline_congestiq * 100).toFixed(1)}%`,
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>
          </div>

          {/* Top impacted zones */}
          {result.scenario.top_zones_impacted && result.scenario.top_zones_impacted.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <h3>Top Impacted Zones</h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Zone Name</th>
                    <th>Baseline CIQ</th>
                    <th>Simulated CIQ</th>
                    <th>Reduction</th>
                  </tr>
                </thead>
                <tbody>
                  {result.scenario.top_zones_impacted.map((zone, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>
                        {resolveZoneName(zoneNameLookup, zone.zone_id)}
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{zone.zone_id}</span>
                      </td>
                      <td className="data-number">{Number(zone.baseline).toLocaleString()}</td>
                      <td className="data-number" style={{ color: 'var(--success)' }}>{Number(zone.simulated).toLocaleString()}</td>
                      <td>
                        <span className="severity-badge low">
                          -{((1 - zone.simulated / zone.baseline) * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
