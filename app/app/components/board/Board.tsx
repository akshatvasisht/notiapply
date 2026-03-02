'use client';

import { useEffect, useState, useCallback } from 'react';
import { getJobs, getUserConfig } from '@/lib/db';
import { startFillSession, triggerPipelineRun } from '@/lib/tauri';
import type { Job, BoardColumn, SidecarEvent, UserConfig } from '@/lib/types';
import { COLUMN_STATES, COLUMN_LABELS } from '@/lib/types';
import Topnav from './Topnav';
import Column from './Column';
import SessionBanner from './SessionBanner';
import FocusMode from '../focus/FocusMode';
import SettingsPage from '../settings/SettingsPage';
import CompaniesPage from '../settings/CompaniesPage';

type View = 'board' | 'settings' | 'companies';

export default function Board() {
    const [view, setView] = useState<View>('board');
    const [jobs, setJobs] = useState<Job[]>([]);
    const [focusedJob, setFocusedJob] = useState<Job | null>(null);
    const [sessionRunning, setSessionRunning] = useState(false);
    const [sessionResult, setSessionResult] = useState<SidecarEvent | null>(null);
    const [config, setConfig] = useState<UserConfig>({});
    const [scraping, setScraping] = useState(false);

    const refresh = useCallback(() => {
        getJobs().then(setJobs).catch(console.error);
    }, []);

    useEffect(() => {
        refresh();
        getUserConfig().then(setConfig).catch(console.error);
    }, [refresh]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (focusedJob) setFocusedJob(null);
                else if (view !== 'board') setView('board');
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [focusedJob, view]);

    const jobsByColumn = (column: BoardColumn) =>
        jobs.filter(j => COLUMN_STATES[column].includes(j.state));

    const queuedCount = jobsByColumn('ready').length;

    const handleStartSession = async () => {
        if (sessionRunning) return;
        setSessionRunning(true);
        setSessionResult(null);
        try {
            await startFillSession(
                (event) => {
                    if (event.event === 'done') { setSessionResult(event); setSessionRunning(false); refresh(); }
                    else { refresh(); }
                },
                (code) => {
                    if (code !== 0) console.error(`Fill session exited with code ${code}`);
                    setSessionRunning(false); refresh();
                },
            );
        } catch (err) {
            console.error('Failed to start session:', err);
            setSessionRunning(false);
        }
    };

    const handleScrapeNow = async () => {
        if (scraping || !config.n8n_webhook_url) return;
        setScraping(true);
        const ok = await triggerPipelineRun(config.n8n_webhook_url, config.n8n_webhook_secret ?? '');
        if (!ok) console.warn('n8n not reachable');
        setTimeout(() => setScraping(false), 3000);
    };

    // ─── Views ───────────────────────────────────────────────────────────────────

    if (view === 'settings') return <SettingsPage onBack={() => { setView('board'); refresh(); }} />;
    if (view === 'companies') return <CompaniesPage onBack={() => setView('board')} />;

    if (focusedJob) {
        return <FocusMode job={focusedJob} onBack={() => { setFocusedJob(null); refresh(); }} />;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <Topnav
                queuedCount={queuedCount}
                sessionRunning={sessionRunning}
                sessionResult={sessionResult}
                scraping={scraping}
                onStartSession={handleStartSession}
                onScrapeNow={handleScrapeNow}
                onOpenSettings={() => setView('settings')}
                onOpenCompanies={() => setView('companies')}
            />

            <div style={{
                display: 'flex', flex: 1, gap: 8, padding: '8px 12px',
                background: 'var(--color-surface-raised)', overflow: 'hidden',
            }}>
                {(['incoming', 'ready', 'attention', 'submitted', 'archive'] as BoardColumn[]).map(col => (
                    <Column key={col} label={COLUMN_LABELS[col]} jobs={jobsByColumn(col)} onCardClick={setFocusedJob} />
                ))}
            </div>

            {(sessionRunning || sessionResult) && (
                <SessionBanner running={sessionRunning} result={sessionResult} onDismiss={() => setSessionResult(null)} />
            )}
        </div>
    );
}
