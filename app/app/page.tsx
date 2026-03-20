'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getUserConfig } from '@/lib/db';
import type { UserConfig } from '@/lib/types';
import Board from '@/app/components/board/JobsBoard';
import ContactsBoard from '@/app/components/board/ContactsBoard';
import WelcomeScreen from '@/app/components/wizard/WelcomeScreen';
import BoardHeader from '@/app/components/common/BoardHeader';
import ViewToggle from '@/app/components/common/ViewToggle';
import PoolCleanup from '@/app/components/common/PoolCleanup';

// Lazy-load heavy components that are conditionally rendered
const SetupWizard = dynamic(() => import('@/app/components/wizard/SetupWizard'), {
  loading: () => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 14, color: 'var(--color-text-secondary)' }}>Loading setup...</div>,
  ssr: false
});

const SettingsPage = dynamic(() => import('@/app/components/settings/SettingsPage'), {
  loading: () => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 14, color: 'var(--color-text-secondary)' }}>Loading settings...</div>,
  ssr: false
});

export default function Home() {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeView, setActiveView] = useState<'jobs' | 'contacts'>('jobs');
  const [view, setView] = useState<'board' | 'settings'>('board');
  const [searchQuery, setSearchQuery] = useState('');

  // State to receive metrics and actions from active board
  const [metricsContent, setMetricsContent] = useState<React.ReactNode>(null);
  const [actionsContent, setActionsContent] = useState<React.ReactNode>(null);

  useEffect(() => {
    getUserConfig()
      .then(setConfig)
      .catch(() => setConfig({ setup_complete: false }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'var(--color-on-surface-variant)',
        fontSize: 14,
      }}>
        Loading...
      </div>
    );
  }

  if (!config?.setup_complete) {
    if (showWelcome) {
      return <WelcomeScreen onContinue={() => setShowWelcome(false)} />;
    }
    return <SetupWizard onComplete={() => setConfig({ ...config, setup_complete: true })} />;
  }

  if (view === 'settings') {
    return <SettingsPage onBack={() => setView('board')} />;
  }

  return (
    <>
      <PoolCleanup />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: 'var(--color-surface)' }}>
        <BoardHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={activeView === 'jobs' ? 'Search by title, company, location…' : 'Search by name, role or company…'}
        onOpenSettings={() => setView('settings')}
        toggleContent={
          <ViewToggle value={activeView} onChange={setActiveView} />
        }
        metricsContent={metricsContent}
        actionsContent={actionsContent}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeView === 'jobs' ? (
          <Board
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onMetricsChange={setMetricsContent}
            onActionsChange={setActionsContent}
          />
        ) : (
          <ContactsBoard
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onMetricsChange={setMetricsContent}
            onActionsChange={setActionsContent}
          />
        )}
      </div>
      </div>
    </>
  );
}
