'use client';

import { useEffect, useState, useCallback } from 'react';
import { getJobs, getUserConfig, getATSFailures, getAutomationStats, getLastScrapeTime, getSourceCoverage } from '@/lib/db';
import { startFillSession, triggerPipelineRun } from '@/lib/tauri';
import { logger } from '@/lib/logger';
import type { Job, BoardColumn, SidecarEvent, UserConfig, ATSFailure, AutomationStats, SourceCoverage } from '@/lib/types';
import { COLUMN_STATES, COLUMN_LABELS, SOURCE_LABELS } from '@/lib/types';
import { MOCK_JOBS, MOCK_CONFIG } from '@/lib/mock-data';
import JobMetricsCompact from './metrics/JobMetricsCompact';
import JobActions from './actions/JobActions';
import Column from './Column';
import SystemBanner from './SystemBanner';
import Modal from '../common/Modal';
import FocusMode from '../focus/FocusMode';
import SettingsPage from '../settings/SettingsPage';
import CompaniesPage from '../settings/CompaniesPage';
import ShortcutsModal from '../help/ShortcutsModal';
import Toast, { type ToastType } from '../common/Toast';


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
    const [jobs, setJobs] = useState<Job[]>([]);
    const [focusedJob, setFocusedJob] = useState<Job | null>(null);
    const [sessionRunning, setSessionRunning] = useState(false);
    const [sessionResult, setSessionResult] = useState<SidecarEvent | null>(null);
    const [config, setConfig] = useState<UserConfig>({});
    const [scraping, setScraping] = useState(false);
    const [useMockData, setUseMockData] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [_internalSearch, _setInternalSearch] = useState('');
    const searchQuery = externalSearch ?? _internalSearch;
    const setSearchQuery = onExternalSearchChange ?? _setInternalSearch;
    const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastType] = useState<ToastType>('info');

    // Metrics state
    const [atsFailures, setAtsFailures] = useState<ATSFailure[]>([]);
    const [automationStats, setAutomationStats] = useState<AutomationStats>({ rate: 0, automated: 0, total: 0 });
    const [lastScrapeTime, setLastScrapeTime] = useState<Date | null>(null);
    const [sourceCoverage, setSourceCoverage] = useState<SourceCoverage>({ active: 0, total: 4 });

    const refresh = useCallback(() => {
        getJobs()
            .then(data => {
                if (data.length === 0) {
                    setJobs(MOCK_JOBS);
                    setUseMockData(true);
                } else {
                    setJobs(data);
                    setUseMockData(false);
                }
            })
            .catch(() => {
                logger.warn('Database not available, using mock data', 'Board');
                setJobs(MOCK_JOBS);
                setUseMockData(true);
            });

        // Fetch metrics
        getATSFailures().then(setAtsFailures).catch(() => setAtsFailures([]));
        getAutomationStats().then(setAutomationStats).catch(() => setAutomationStats({ rate: 0, automated: 0, total: 0 }));
        getLastScrapeTime().then(setLastScrapeTime).catch(() => setLastScrapeTime(null));
        getSourceCoverage().then(setSourceCoverage).catch(() => setSourceCoverage({ active: 0, total: 4 }));
    }, []);

    useEffect(() => {
        refresh();
        getUserConfig()
            .then(setConfig)
            .catch(() => {
                logger.warn('Database not available, using mock config', 'Board');
                setConfig(MOCK_CONFIG);
            });
    }, [refresh]);

    // Filter jobs by search query
    const filteredJobs = jobs.filter(job => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const sourceLabel = SOURCE_LABELS[job.source]?.toLowerCase() || job.source.toLowerCase();

        return (
            job.title.toLowerCase().includes(query) ||
            job.company.toLowerCase().includes(query) ||
            job.location.toLowerCase().includes(query) ||
            sourceLabel.includes(query) ||
            job.source.toLowerCase().includes(query)
        );
    });

    const jobsByColumn = (column: BoardColumn) =>
        filteredJobs.filter(j => COLUMN_STATES[column].includes(j.state));

    const queuedCount = jobsByColumn('ready').length;

    // Push metrics and actions to header
    useEffect(() => {
        if (onMetricsChange) {
            onMetricsChange(
                <JobMetricsCompact
                    atsFailures={atsFailures}
                    automationStats={automationStats}
                    lastScrapeTime={lastScrapeTime}
                    sourceCoverage={sourceCoverage}
                />
            );
        }
        if (onActionsChange) {
            onActionsChange(
                <JobActions
                    queuedCount={queuedCount}
                    sessionRunning={sessionRunning}
                    sessionResult={sessionResult}
                    scraping={scraping}
                    onStartSession={handleStartSession}
                    onScrapeNow={handleScrapeNow}
                    onOpenCompanies={() => setView('companies')}
                />
            );
        }
    }, [atsFailures, automationStats, lastScrapeTime, sourceCoverage, queuedCount, sessionRunning, sessionResult, scraping, onMetricsChange, onActionsChange]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.key === 'Escape') {
                if (showShortcuts) setShowShortcuts(false);
                else if (selectedJobIds.size > 0) setSelectedJobIds(new Set());
                else if (focusedJob) setFocusedJob(null);
                else if (view !== 'board') setView('board');
            } else if (e.key === '?' && !e.shiftKey) {
                e.preventDefault();
                setShowShortcuts(true);
            } else if (e.key === 'a' && e.ctrlKey) {
                e.preventDefault();
                const allIds = new Set(filteredJobs.map(j => j.id));
                setSelectedJobIds(allIds);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [focusedJob, view, showShortcuts, selectedJobIds, filteredJobs]);

    const handleStartSession = async () => {
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
    };

    const handleScrapeNow = async () => {
        if (scraping || !config.n8n_webhook_url) return;
        setScraping(true);
        const ok = await triggerPipelineRun(config.n8n_webhook_url, config.n8n_webhook_secret ?? '');
        if (!ok) logger.warn('n8n not reachable', 'Board');
        setTimeout(() => setScraping(false), 3000);
    };

    const handleCardClick = (job: Job, e: React.MouseEvent) => {
        if (e.ctrlKey) {
            const newSelection = new Set(selectedJobIds);
            if (newSelection.has(job.id)) {
                newSelection.delete(job.id);
            } else {
                newSelection.add(job.id);
            }
            setSelectedJobIds(newSelection);
        } else if (selectedJobIds.size > 0) {
            setSelectedJobIds(new Set());
            setFocusedJob(job);
        } else {
            setFocusedJob(job);
        }
    };

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
                Preview Mode: Using mock data (database not connected)
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

    return (
        <>
            {/* Fixed position banners */}
            {sessionBanner}

            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Inline banner at top */}
                {mockDataBanner}

                <div style={{
                    display: 'flex', flex: 1, gap: 8, padding: '8px 12px',
                    background: 'var(--color-surface-raised)', overflowX: 'auto',
                }}>
                    {(['incoming', 'ready', 'attention', 'submitted', 'archive'] as BoardColumn[]).map(col => (
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
                    <Modal onClose={() => { setFocusedJob(null); refresh(); }}>
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
