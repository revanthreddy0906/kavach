import ThemeToggle from './ThemeToggle';

const TABS = [
  { id: 'live', label: 'Live Command' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'patrol', label: 'Patrol Planning' },
];

export default function Header({ activeTab, onTabChange }) {
  return (
    <header className="header">
      <div className="header-brand">
        <span className="shield">🛡️</span>
        <div>
          <h1>KAVACH</h1>
          <span className="tagline">Parking Congestion Intelligence</span>
        </div>
        <span className="live-badge">
          <span className="live-dot" />
          LIVE
        </span>
      </div>

      <nav className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="header-right">
        <ThemeToggle />
      </div>
    </header>
  );
}
