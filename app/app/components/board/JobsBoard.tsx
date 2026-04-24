'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { startFillSession, triggerPipelineRun } from '@/lib/tauri';
import { sendPipelineNotification } from '@/lib/notifications';
import { logger } from '@/lib/logger';
import { useJobs, useDashboardMetrics, useUserConfig, useCardSelection, useBoardKeyboard } from '@/lib/hooks';
import { MOCK_JOBS } from '@/lib/mock-data';
import type { Job, BoardColumn, SidecarEvent } from '@/lib/types';
import { COLUMN_STATES, COLUMN_LABELS, SOURCE_LABELS } from '@/lib/types';
import JobMetricsCompact from './metrics/JobMetricsCompact';
import JobActions from './actions/JobActions';
import Column from './Column';
import SystemBanner from './SystemBanner';
import Modal from '../common/Modal';
import CompaniesPage from '../settings/CompaniesPage';
import Toast, { type ToastType } from '../common/Toast';

// Lazy-load heavy conditionally-rendered components
const FocusMode = dynamic(() => import('../focus/FocusMode'), {
    loading: () => <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading focus mode...</div>,
    ssr: false
});

const SettingsPage = dynamic(() => import('../settings/SettingsPage'), {
    loading: () => <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading settings...</div>,
    ssr: false
});

const ShortcutsModal = dynamic(() => import('../help/ShortcutsModal'), {
    loading: () => <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading shortcuts...</div>,
    ssr: false
});


const BOARD_COLUMNS = ['incoming', 'ready', 'attention', 'submitted', 'archive'] as const;

type View = 'board' | 'settings' | 'companies';

export interface BoardProps {
    searchQuery?: string;
    onSearchChange?: (q: string) => void;
    onMetricsChange?: (metrics: React.ReactNode) => void;
    onActionsChange?: (actions: React.ReactNode) => void;
}

export default function Board({
    searchQuery: externalSearch,
    onSearchChange: onExternalSearchChange,
    onMetricsChange,
    onActionsChange
}: BoardProps) {
    const [view, setView] = useState<View>('board');
    const [focusedJob, setFocusedJob] = useState<Job | null>(null);
    const [sessionRunning, setSessionRunning] = useState(false);
    const [sessionResult, setSessionResult] = useState<SidecarEvent | null>(null);
    const [scraping, setScraping] = useState(false);
    const [extractingContacts, setExtractingContacts] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [_internalSearch, _setInternalSearch] = useState('');
    const searchQuery = externalSearch ?? _internalSearch;
    const setSearchQuery = onExternalSearchChange ?? _setInternalSearch;
    const { selectedIds: selectedJobIds, handleCardClick: handleCardClickRaw, selectAll: selectAllJobIds, clearSelection: clearJobSelection, setSelectedIds: setSelectedJobIds } = useCardSelection<Job>();
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastType] = useState<ToastType>('info');

    // Data hooks (cached, batched)
    const { data: jobs, refresh: refreshJobs } = useJobs();
    const { data: metrics, refresh: refreshMetrics } = useDashboardMetrics();
    const { data: config } = useUserConfig();

    const useMockData = jobs === MOCK_JOBS;

    const refresh = useCallback(() => {
        refreshJobs();
        refreshMetrics();
    }, [refreshJobs, refreshMetrics]);

    // Filter jobs by search query — memoized so it only recomputes when jobs or query changes
    const filteredJobs = useMemo(() => (jobs ?? []).filter(job => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const sourceLabel = SOURCE_LABELS[job.source]?.toLowerCase() || job.source.toLowerCase();
        return (
            job.title.toLowerCase().includes(query) ||
            job.company.toLowerCase().includes(query) ||
            (job.location ?? '').toLowerCase().includes(query) ||
            sourceLabel.includes(query) ||
            job.source.toLowerCase().includes(query)
        );
    }), [jobs, searchQuery]);

    // Group by column — memoized to avoid recomputing on every render
    const jobsByColumnMap = useMemo(() => {
        const map = new Map<BoardColumn, Job[]>();
        for (const col of BOARD_COLUMNS) {
            map.set(col, filteredJobs.filter(j => COLUMN_STATES[col].includes(j.state)));
        }
        return map;
    }, [filteredJobs]);

    const jobsByColumn = (column: BoardColumn) => jobsByColumnMap.get(column) ?? [];

    const queuedCount = jobsByColumnMap.get('ready')?.length ?? 0;

    // Handlers must be declared before the useMemo nodes that reference them in dependency arrays
    const handleStartSession = useCallback(async () => {
        if (sessionRunning) return;
        setSessionRunning(true);
        setSessionResult(null);
        try {
            await startFillSession(
                (event) => {
                    if (event.event === 'preflight_failed') {
                        setToastMessage(event.errors?.[0] ?? 'Sidecar preflight failed. Check Settings → Automation.');
                        setSessionRunning(false);
                    } else if (event.event === 'done') {
                        setSessionResult(event);
                        setSessionRunning(false);
                        refresh();
                        const total = event.filled + event.incomplete + event.failed;
                        sendPipelineNotification(
                            'Fill session complete',
                            total === 0
                                ? 'No jobs processed.'
                                : `Filled ${event.filled}/${total}. ${event.incomplete} need review. Open Notiapply.`,
                        );
                    } else {
                        refresh();
                    }
                },
                (code) => {
                    if (code !== 0 && code !== 2) {
                        logger.error(`Fill session exited with code ${code}`, 'Board');
                    }
                    setSessionRunning(false);
                    refresh();
                },
            );
        } catch (err) {
            logger.error('Failed to start session', 'Board', err);
            setSessionRunning(false);
        }
    }, [sessionRunning, refresh]);

    const handleScrapeNow = useCallback(async () => {
        if (scraping || !config?.n8n_webhook_url) return;
        setScraping(true);
        const ok = await triggerPipelineRun(config.n8n_webhook_url, config.n8n_webhook_secret ?? '');
        if (!ok) logger.warn('n8n not reachable', 'Board');
        setTimeout(() => setScraping(false), 3000);
    }, [scraping, config]);

    const handleExtractContacts = useCallback(async () => {
        if (extractingContacts || !config?.n8n_webhook_url) return;
        setExtractingContacts(true);
        const ok = await triggerPipelineRun(
            config.n8n_webhook_url,
            config.n8n_webhook_secret ?? '',
            { workflow: '12-extract-job-contacts' }
        );
        if (!ok) logger.warn('n8n not reachable for contact extraction', 'Board');
        setTimeout(() => setExtractingContacts(false), 3000);
    }, [extractingContacts, config]);

    const handleOpenCompanies = useCallback(() => setView('companies'), []);

    // Memoize header slot content — only reconstructs when the relevant data actually changes
    const metricsNode = useMemo(() => (
        <JobMetricsCompact
            atsFailures={metrics?.atsFailures ?? []}
            automationStats={metrics?.automationStats ?? { rate: 0, automated: 0, total: 0 }}
            lastScrapeTime={metrics?.lastScrapeTime ?? null}
            sourceCoverage={metrics?.sourceCoverage ?? { active: 0, total: 4 }}
            callbackStats={metrics?.callbackStats ?? { total_applications: 0, total_callbacks: 0, callback_rate: 0 }}
        />
    ), [metrics]);

    const actionsNode = useMemo(() => (
        <JobActions
            queuedCount={queuedCount}
            sessionRunning={sessionRunning}
            sessionResult={sessionResult}
            scraping={scraping}
            extractingContacts={extractingContacts}
            onStartSession={handleStartSession}
            onScrapeNow={handleScrapeNow}
            onExtractContacts={handleExtractContacts}
            onOpenCompanies={handleOpenCompanies}
        />
    ), [queuedCount, sessionRunning, sessionResult, scraping, extractingContacts, handleStartSession, handleScrapeNow, handleExtractContacts, handleOpenCompanies]);

    useEffect(() => { onMetricsChange?.(metricsNode); }, [metricsNode, onMetricsChange]);
    useEffect(() => { onActionsChange?.(actionsNode); }, [actionsNode, onActionsChange]);

    // Keyboard: Escape cascade + Ctrl+A select-all
    useBoardKeyboard(
        useMemo(() => [
            { active: showShortcuts, dismiss: () => setShowShortcuts(false) },
            { active: selectedJobIds.size > 0, dismiss: clearJobSelection },
            { active: !!focusedJob, dismiss: () => setFocusedJob(null) },
            { active: view !== 'board', dismiss: () => setView('board') },
        ], [showShortcuts, selectedJobIds, focusedJob, view, clearJobSelection]),
        useCallback(() => filteredJobs.map(j => j.id), [filteredJobs]),
        selectAllJobIds,
    );

    // Extra keyboard shortcut: '?' opens shortcuts modal
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === '?' && !e.shiftKey) {
                e.preventDefault();
                setShowShortcuts(true);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const handleCardClick = useCallback((job: Job, e: React.MouseEvent) => {
        handleCardClickRaw(job, e, setFocusedJob);
    }, [handleCardClickRaw]);

    if (view === 'settings') return <SettingsPage onBack={() => { setView('board'); refresh(); }} />;
    if (view === 'companies') return <CompaniesPage onBack={() => setView('board')} />;

    const mockDataBanner = useMockData ? (
        <div style={{
            padding: '8px 16px',
            background: 'var(--color-warning-container)',
            borderBottom: '1px solid var(--color-warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
        }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-warning)' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: 13, color: 'var(--color-warning)', fontWeight: 500 }}>
                Preview — representative data only (database not connected)
            </span>
        </div>
    ) : null;

    const sessionBanner = (sessionRunning || sessionResult) ? (
        <SystemBanner
            type="session"
            running={sessionRunning}
            result={sessionResult}
            onDismiss={() => setSessionResult(null)}
        />
    ) : null;

    const browserAgentWarning = (config?.browser_agent_enabled && !config?.user_email) ? (
        <div style={{
            padding: '8px 16px',
            background: 'var(--color-error-container)',
            borderBottom: '1px solid var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
        }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-error)' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontSize: 13, color: 'var(--color-error)', fontWeight: 500 }}>
                Browser Agent enabled but profile incomplete.
            </span>
            <button
                onClick={() => setView('settings')}
                style={{
                    padding: '4px 8px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--color-error)',
                    background: 'transparent',
                    border: '1px solid var(--color-error)',
                    borderRadius: 4,
                    cursor: 'pointer',
                }}
                className="jobs-agent-btn"
            >
                Configure in Settings
            </button>
        </div>
    ) : null;

    return (
        <>
            {/* Fixed position banners */}
            {sessionBanner}

            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Inline banners at top */}
                {mockDataBanner}
                {browserAgentWarning}

                <div style={{
                    display: 'flex', flex: 1, gap: 8, padding: '8px 12px',
                    background: 'var(--color-surface-raised)', overflowX: 'auto',
                }}>
                    {BOARD_COLUMNS.map(col => (
                        <Column
                            key={col}
                            label={COLUMN_LABELS[col]}
                            jobs={jobsByColumn(col)}
                            selectedIds={selectedJobIds}
                            onCardClick={handleCardClick}
                            collapsible={col === 'archive'}
                        />
                    ))}
                </div>

                {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

                {focusedJob && (
                    <Modal title={`${focusedJob.title} at ${focusedJob.company}`} onClose={() => { setFocusedJob(null); refresh(); }}>
                        <FocusMode job={focusedJob} onBack={() => { setFocusedJob(null); refresh(); }} />
                    </Modal>
                )}

                {toastMessage && (
                    <Toast
                        message={toastMessage}
                        type={toastType}
                        onDismiss={() => setToastMessage(null)}
                    />
                )}
            </div>
        </>
    );
}
