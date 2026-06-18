import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import LandingPage from './components/pages/LandingPage';
import DashboardPage from './components/pages/DashboardPage';
import OperationsOverview from './components/pages/OperationsOverview';
import LiveMapPage from './components/pages/LiveMapPage';
import HighRiskZones from './components/pages/HighRiskZones';
import AnalyticsSummary from './components/pages/AnalyticsSummary';
import EnforcementPage from './components/pages/EnforcementPage';
import TrendsPage from './components/pages/TrendsPage';
import ArchetypesPage from './components/pages/ArchetypesPage';
import DeploymentPage from './components/pages/DeploymentPage';
import SimulationLab from './components/pages/SimulationLab';
import ImpactPage from './components/pages/ImpactPage';
import WeatherPage from './components/pages/WeatherPage';
import BriefingPage from './components/pages/BriefingPage';

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-content-area">
        <TopBar />
        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page — no sidebar */}
        <Route path="/" element={<LandingPage />} />

        {/* All app pages — with sidebar layout */}
        <Route path="/dashboard" element={<AppLayout><DashboardPage /></AppLayout>} />
        <Route path="/briefing" element={<AppLayout><BriefingPage /></AppLayout>} />

        <Route path="/operations/overview" element={<AppLayout><OperationsOverview /></AppLayout>} />
        <Route path="/operations/live-map" element={<AppLayout><LiveMapPage /></AppLayout>} />
        <Route path="/operations/high-risk" element={<AppLayout><HighRiskZones /></AppLayout>} />

        <Route path="/analytics/summary" element={<AppLayout><AnalyticsSummary /></AppLayout>} />
        <Route path="/analytics/enforcement" element={<AppLayout><EnforcementPage /></AppLayout>} />
        <Route path="/analytics/trends" element={<AppLayout><TrendsPage /></AppLayout>} />
        <Route path="/analytics/archetypes" element={<AppLayout><ArchetypesPage /></AppLayout>} />
        <Route path="/analytics/weather" element={<AppLayout><WeatherPage /></AppLayout>} />

        <Route path="/patrol/deployment" element={<AppLayout><DeploymentPage /></AppLayout>} />
        <Route path="/patrol/simulation" element={<AppLayout><SimulationLab /></AppLayout>} />
        <Route path="/patrol/impact" element={<AppLayout><ImpactPage /></AppLayout>} />

        <Route path="/settings" element={<AppLayout><div style={{ color: 'var(--text-muted)' }}>Settings coming soon.</div></AppLayout>} />

        {/* Redirects */}
        <Route path="/operations" element={<Navigate to="/operations/overview" replace />} />
        <Route path="/analytics" element={<Navigate to="/analytics/summary" replace />} />
        <Route path="/patrol" element={<Navigate to="/patrol/deployment" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
