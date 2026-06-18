import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../layout/TopBar';
import { fetchHeatmap } from '../../utils/api';
import { Search, ArrowUpDown } from 'lucide-react';

export default function HighRiskZones() {
  const [zones, setZones] = useState([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('congestiq_score');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHeatmap().then(d => { setZones(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    let data = [...zones];
    if (search) data = data.filter(z => {
      const q = search.toLowerCase();
      return (z.display_name || '').toLowerCase().includes(q) ||
        z.zone_id.toLowerCase().includes(q) ||
        (z.primary_violation || '').toLowerCase().includes(q) ||
        (z.dominant_vehicle || '').toLowerCase().includes(q);
    });
    data.sort((a, b) => {
      const aVal = a[sortKey] || 0;
      const bVal = b[sortKey] || 0;
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
    return data;
  }, [zones, search, sortKey, sortDir]);

  const getSeverity = (score) => {
    if (score > 700) return 'high';
    if (score > 300) return 'medium';
    return 'low';
  };

  const getSuggestion = (zone) => {
    if (zone.congestiq_score > 700) return 'Immediate patrol deployment recommended';
    if (zone.congestiq_score > 300) return 'Schedule patrol within next shift';
    return 'Routine monitoring sufficient';
  };

  return (
    <div>
      <PageHeader title="High Risk Zones" description="All monitored zones ranked by CongestionIQ score with severity classification and suggested actions." />

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by zone name, violation type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="caption">{filtered.length} zones</span>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('zone_id')}>
                  Zone Name {sortKey === 'zone_id' && <ArrowUpDown size={10} style={{ display: 'inline', marginLeft: 4 }} />}
                </th>
                <th onClick={() => handleSort('congestiq_score')}>
                  CongestionIQ {sortKey === 'congestiq_score' && <ArrowUpDown size={10} style={{ display: 'inline', marginLeft: 4 }} />}
                </th>
                <th>Severity</th>
                <th>Primary Violation</th>
                <th>Dominant Vehicle</th>
                <th onClick={() => handleSort('cascade_reach')}>
                  Cascade Reach {sortKey === 'cascade_reach' && <ArrowUpDown size={10} style={{ display: 'inline', marginLeft: 4 }} />}
                </th>
                <th>Suggested Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((z, i) => (
                <tr key={i}>
                  <td className="data-number" style={{ fontWeight: 600 }}>
                    {z.display_name || z.zone_id}
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{z.zone_id}</span>
                  </td>
                  <td className="data-number">{Number(z.congestiq_score).toLocaleString()}</td>
                  <td>
                    <span className={`severity-badge ${getSeverity(z.congestiq_score)}`}>
                      {getSeverity(z.congestiq_score)}
                    </span>
                  </td>
                  <td>{z.primary_violation}</td>
                  <td>{z.dominant_vehicle}</td>
                  <td className="data-number">{z.cascade_reach}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{getSuggestion(z)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
