import { useState } from 'react';
import Header from './components/common/Header';
import LiveCommandView from './components/live/LiveCommandView';
import AnalyticsView from './components/analytics/AnalyticsView';
import PatrolPlanningView from './components/patrol/PatrolPlanningView';

export default function App() {
  const [activeTab, setActiveTab] = useState('live');

  return (
    <>
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="main-content" key={activeTab}>
        {activeTab === 'live' && <LiveCommandView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'patrol' && <PatrolPlanningView />}
      </main>
    </>
  );
}
