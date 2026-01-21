import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LiveView from './views/LiveView';
import GalleryView from './views/GalleryView';
import SettingsView from './views/SettingsView';
import Dock from './components/Dock';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

type Section = 'live' | 'gallery' | 'settings';

function App() {
  const [activeSection, setActiveSection] = useState<Section>('live');

  const renderSection = () => {
    switch (activeSection) {
      case 'live':
        return <LiveView />;
      case 'gallery':
        return <GalleryView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <LiveView />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen">
        {/* Notification Container */}
        <div id="notification-container" className="fixed top-4 right-4 max-w-md z-40"></div>

        {/* Main Content */}
        <main className="overflow-y-auto">
          <div className="max-w-6xl mx-auto p-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Aquarium Timelapse</h1>
              <p className="text-base-content/60">Real-time monitoring and capture</p>
            </div>

            {/* Active Section */}
            {renderSection()}
          </div>
        </main>

        {/* Bottom Dock Navigation */}
        <Dock activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>
    </QueryClientProvider>
  );
}

export default App;
