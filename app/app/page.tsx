'use client';

import { useEffect, useState } from 'react';
import { getUserConfig } from '@/lib/db';
import type { UserConfig } from '@/lib/types';
import Board from '@/app/components/board/Board';
import SetupWizard from '@/app/components/wizard/SetupWizard';

export default function Home() {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [loading, setLoading] = useState(true);

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

  return <Board />;
}
