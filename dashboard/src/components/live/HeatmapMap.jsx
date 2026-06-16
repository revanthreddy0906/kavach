import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Tooltip, useMap } from 'react-leaflet';

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; <a href="https://carto.com/">CARTO</a>';
const BENGALURU_CENTER = [12.9716, 77.5946];

function getZoneColor(score) {
  if (score > 700) return '#ef4444';
  if (score > 300) return '#f59e0b';
  return '#10b981';
}

function getZoneRadius(score) {
  const min = 6, max = 30;
  const clamped = Math.min(Math.max(score, 100), 2000);
  return min + ((clamped - 100) / (2000 - 100)) * (max - min);
}

/** Sub-component to switch tile layer when theme changes */
function ThemeAwareTiles() {
  const map = useMap();
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'dark');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return (
    <TileLayer
      key={theme}
      attribution={ATTRIBUTION}
      url={theme === 'dark' ? DARK_TILES : LIGHT_TILES}
    />
  );
}

/** Cascade animation rings */
function CascadeRings({ cascadeData }) {
  const [visibleFrames, setVisibleFrames] = useState(0);

  useEffect(() => {
    setVisibleFrames(0);
    const timers = [
      setTimeout(() => setVisibleFrames(1), 300),
      setTimeout(() => setVisibleFrames(2), 1300),
      setTimeout(() => setVisibleFrames(3), 2300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [cascadeData]);

  if (!cascadeData || !cascadeData.frames) return null;

  const colors = ['rgba(139, 92, 246, 0.6)', 'rgba(139, 92, 246, 0.35)', 'rgba(139, 92, 246, 0.15)'];
  const radii = [300, 700, 1400];

  return (
    <>
      {cascadeData.frames.slice(0, visibleFrames).map((frame, i) => (
        <Circle
          key={`cascade-${i}`}
          center={[cascadeData.center_lat, cascadeData.center_lng]}
          radius={radii[i]}
          pathOptions={{
            color: colors[i],
            fillColor: colors[i],
            fillOpacity: 0.15,
            weight: 2,
          }}
        />
      ))}
    </>
  );
}

export default function HeatmapMap({ zones, patrolData, cascadeData, selectedZone, onZoneClick }) {
  return (
    <div className="map-container">
      <MapContainer
        center={BENGALURU_CENTER}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <ThemeAwareTiles />

        {/* Heatmap zone circles */}
        {zones.map(zone => (
          <CircleMarker
            key={zone.zone_id}
            center={[zone.lat, zone.lng]}
            radius={getZoneRadius(zone.congestiq_score)}
            pathOptions={{
              color: getZoneColor(zone.congestiq_score),
              fillColor: getZoneColor(zone.congestiq_score),
              fillOpacity: 0.7,
              weight: selectedZone?.zone_id === zone.zone_id ? 3 : 1,
            }}
            eventHandlers={{
              click: () => onZoneClick(zone),
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
                <strong>{zone.zone_id}</strong><br />
                Score: {Number(zone.congestiq_score).toLocaleString()}<br />
                {zone.primary_violation}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Patrol markers */}
        {patrolData && patrolData.slice(0, 10).map((p, i) => (
          <CircleMarker
            key={`patrol-${i}`}
            center={[p.zone_lat, p.zone_lng]}
            radius={5}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11 }}>
                Patrol: {p.units_assigned} units<br />
                Priority: #{p.priority_rank}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Cascade animation */}
        {cascadeData && <CascadeRings cascadeData={cascadeData} />}
      </MapContainer>
    </div>
  );
}
