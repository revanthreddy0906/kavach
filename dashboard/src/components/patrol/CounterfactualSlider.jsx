import { useState, useEffect, useCallback } from 'react';
import { fetchCounterfactual } from '../../utils/api';
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter';
import { useZoneNames, resolveZoneName } from '../../utils/zoneNames';

export default function CounterfactualSlider() {
  const [rate, setRate] = useState(0.8);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const zoneNameLookup = useZoneNames();

  const loadCounterfactual = useCallback(async (r) => {
    setLoading(true);
    try {
      const data = await fetchCounterfactual(r);
      setResult(data);
    } catch (err) {
      console.error('Failed to load counterfactual:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCounterfactual(rate);
  }, []);

  const handleSliderChange = (e) => {
    const newRate = parseFloat(e.target.value);
    setRate(newRate);
  };

  const handleSliderRelease = () => {
    loadCounterfactual(rate);
  };

const reductionPct = useAnimatedCounter(result?.scenario?.reduction_pct || 0, 800, 1);
const hoursSaved = useAnimatedCounter(result?.scenario?.hours_saved_monthly || 0, 800, 0);
const deliveryHours = useAnimatedCounter(result?.scenario?.flipkart?.delivery_hours_saved_monthly || 0, 800, 0);

  return (
    <div className="sim-layout">
      <div className="sim-card">
        <h3>What-If Simulation</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Adjust enforcement rate to see projected impact on congestion
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
          <span>50%</span>
          <span>100%</span>
        </div>

        <input
          type="range"
          className="enforcement-slider"
          min="0.5"
          max="1.0"
          step="0.05"
          value={rate}
          onChange={handleSliderChange}
          onMouseUp={handleSliderRelease}
          onTouchEnd={handleSliderRelease}
        />

        <div className="slider-value">
          {(rate * 100).toFixed(0)}%
        </div>

        {result && (
          <div className="reduction-highlight">
            <div className="reduction-value">{reductionPct}%</div>
            <div className="reduction-label">CongestIQ Reduction</div>
            {result.scenario?.reduction_ci && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                95% CI: {result.scenario.reduction_ci_lower}%–{result.scenario.reduction_ci_upper}%
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="impact-stats">
            <div className="impact-stat">
              <div className="impact-value">{hoursSaved}</div>
              <div className="impact-label">Hours Saved / Month</div>
              {result.scenario?.hours_ci_lower != null && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  CI: {Number(result.scenario.hours_ci_lower).toLocaleString()}–{Number(result.scenario.hours_ci_upper).toLocaleString()}
                </div>
              )}
            </div>
            <div className="impact-stat">
              <div className="impact-value">{deliveryHours}</div>
              <div className="impact-label">Delivery Hours Saved</div>
              {result.scenario?.flipkart?.delivery_hours_ci && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  CI: {result.scenario.flipkart.delivery_hours_ci.replace('--', '–')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="sim-card">
        <h3>Before / After CongestIQ</h3>

        {result && (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Baseline
                </div>
                <div className="data-number" style={{ fontSize: 24, color: 'var(--danger)' }}>
                  {Number(result.scenario.baseline_congestiq).toLocaleString()}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Simulated
                </div>
                <div className="data-number" style={{ fontSize: 24, color: 'var(--success)' }}>
                  {Number(result.scenario.simulated_congestiq).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Visual bar comparison */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Baseline</div>
                <div style={{
                  height: 20, borderRadius: 4,
                  background: 'var(--danger)', width: '100%', opacity: 0.7
                }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Simulated</div>
                <div style={{
                  height: 20, borderRadius: 4,
                  background: 'var(--success)', opacity: 0.7,
                  width: `${((result.scenario.simulated_congestiq / result.scenario.baseline_congestiq) * 100).toFixed(1)}%`,
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>

            {/* Top impacted zones */}
            {result.scenario?.top_zones_impacted && result.scenario.top_zones_impacted.length > 0 && (
              <>
                <h3 style={{ marginTop: 8 }}>Top Impacted Zones</h3>
                <div className="impact-zones-list">
                  {result.scenario.top_zones_impacted.slice(0, 5).map((zone, i) => (
                    <div key={i} className="impact-zone-item">
                      <span className="zone-name">{resolveZoneName(zoneNameLookup, zone.zone_id)}</span>
                      <span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12, marginRight: 8 }}>
                          {Number(zone.baseline).toLocaleString()} → {Number(zone.simulated).toLocaleString()}
                        </span>
                        <span className="zone-reduction">
                          -{((1 - zone.simulated / zone.baseline) * 100).toFixed(1)}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {loading && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Loading...</p>}
      </div>
    </div>
  );
}
