'use client';

import { useEffect, useState } from 'react';
import { getUserConfig } from '@/lib/db';
import type { UserConfig } from '@/lib/types';
import Board from '@/app/components/board/JobsBoard';
import ContactsBoard from '@/app/components/board/ContactsBoard';
import SetupWizard from '@/app/components/wizard/SetupWizard';
import BoardHeader from '@/app/components/common/BoardHeader';
import SettingsPage from '@/app/components/settings/SettingsPage';

export default function Home() {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'jobs' | 'contacts'>('jobs');
  const [view, setView] = useState<'board' | 'settings'>('board');
  const [searchQuery, setSearchQuery] = useState('');

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
        height: '100vh', color: 'var(--color-text-tertiary)',
      }}>
        Loading...
      </div>
    );
  }

  if (!config?.setup_complete) {
    return <SetupWizard onComplete={() => setConfig({ ...config, setup_complete: true })} />;
  }

  if (view === 'settings') {
    return <SettingsPage onBack={() => setView('board')} />;
  }

  const tabButtons = (
    <div style={{ display: 'flex', gap: 4, height: '100%', alignItems: 'center' }}>
      {(['jobs', 'contacts'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          style={{
            height: '100%',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === tab ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
            fontWeight: 600, fontSize: 13,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            padding: '0 12px',
          }}
        >
          {tab === 'jobs' ? 'Jobs Pipeline' : 'Outreach CRM'}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: 'var(--color-surface)' }}>
      <BoardHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={activeTab === 'jobs' ? 'Search by title, company, location…' : 'Search by name, role or company…'}
        onOpenSettings={() => setView('settings')}
        centerContent={tabButtons}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'jobs'
          ? <Board searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          : <ContactsBoard searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        }
      </div>
    </div>
  );
}
