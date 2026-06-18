import { useState, useEffect } from 'react';
import { fetchHeatmap } from './api';

let cachedLookup = null;

/**
 * Returns a map of zone_id (geohash) -> display_name.
 * Loads once from the heatmap API and caches.
 */
export function useZoneNames() {
  const [lookup, setLookup] = useState(cachedLookup || {});

  useEffect(() => {
    if (cachedLookup) return;
    fetchHeatmap().then(zones => {
      const map = {};
      zones.forEach(z => {
        map[z.zone_id] = z.display_name || z.zone_id;
      });
      cachedLookup = map;
      setLookup(map);
    }).catch(() => {});
  }, []);

  return lookup;
}

/**
 * Resolve a zone_id to its display name, with optional fallback.
 */
export function resolveZoneName(lookup, zoneId) {
  return lookup[zoneId] || lookup[zoneId?.toLowerCase()] || zoneId;
}
