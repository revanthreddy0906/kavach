import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Radio, Map, AlertTriangle,
  BarChart3, TrendingUp, Waypoints, ShieldCheck,
  CalendarClock, FlaskConical, Target, Settings,
  ChevronLeft, ChevronRight, Shield, CloudRain, FileText
} from 'lucide-react';
import { useState } from 'react';

const NAV_SECTIONS = [
  {
    label: '',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/briefing', icon: FileText, label: 'Daily Briefing' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { to: '/operations/overview', icon: Radio, label: 'Overview' },
      { to: '/operations/live-map', icon: Map, label: 'Live Map' },
      { to: '/operations/high-risk', icon: AlertTriangle, label: 'High Risk Zones' },
    ]
  },
  {
    label: 'Analytics',
    items: [
      { to: '/analytics/summary', icon: BarChart3, label: 'Executive Summary' },
      { to: '/analytics/enforcement', icon: ShieldCheck, label: 'Enforcement Analysis' },
      { to: '/analytics/trends', icon: TrendingUp, label: 'Violation Trends' },
      { to: '/analytics/archetypes', icon: Waypoints, label: 'Junction Archetypes' },
      { to: '/analytics/weather', icon: CloudRain, label: 'Weather Sensitivity' },
    ]
  },
  {
    label: 'Patrol Planning',
    items: [
      { to: '/patrol/deployment', icon: CalendarClock, label: 'Deployment Schedule' },
      { to: '/patrol/simulation', icon: FlaskConical, label: 'Simulation Lab' },
      { to: '/patrol/impact', icon: Target, label: 'Impact Assessment' },
    ]
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Shield size={18} />
        </div>
        <div className="brand-text">
          <h1>KAVACH</h1>
          <span>Urban Intelligence</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section, si) => (
          <div className="nav-section" key={si}>
            {section.label && (
              <div className="nav-section-label">{section.label}</div>
            )}
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav-item ${isActive || location.pathname.startsWith(item.to.split('/').slice(0, 3).join('/')) && item.to === location.pathname ? 'active' : ''}`
                }
              >
                <span className="nav-icon"><item.icon size={18} /></span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavLink to="/settings" className="nav-item">
          <span className="nav-icon"><Settings size={18} /></span>
          <span>Settings</span>
        </NavLink>
        <button
          className="nav-item"
          onClick={() => setCollapsed(!collapsed)}
          style={{ marginTop: 4 }}
        >
          <span className="nav-icon">
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </span>
          <span>Collapse</span>
        </button>
      </div>
    </aside>
  );
}
