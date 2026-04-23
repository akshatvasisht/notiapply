'use client';
import { getATSFailures, getAutomationStats, getLastScrapeTime, getSourceCoverage, getCallbackAnalytics } from '@/lib/db';
import { useDbQuery } from './useDbQuery';
import type { ATSFailure, AutomationStats, SourceCoverage, CallbackStats } from '@/lib/types';

export interface DashboardMetrics {
    atsFailures: ATSFailure[];
    automationStats: AutomationStats;
    lastScrapeTime: Date | null;
    sourceCoverage: SourceCoverage;
    callbackStats: CallbackStats;
}

const DEFAULT_METRICS: DashboardMetrics = {
    atsFailures: [],
    automationStats: { rate: 0, automated: 0, total: 0 },
    lastScrapeTime: null,
    sourceCoverage: { active: 0, total: 4 },
    callbackStats: { total_applications: 0, total_callbacks: 0, callback_rate: 0 },
};

async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
    const [atsFailures, automationStats, lastScrapeTime, sourceCoverage, callbackStats] = await Promise.all([
        getATSFailures().catch(() => [] as ATSFailure[]),
        getAutomationStats().catch(() => ({ rate: 0, automated: 0, total: 0 })),
        getLastScrapeTime().catch(() => null),
        getSourceCoverage().catch(() => ({ active: 0, total: 4 })),
        getCallbackAnalytics().catch(() => ({ total_applications: 0, total_callbacks: 0, callback_rate: 0 })),
    ]);
    return { atsFailures, automationStats, lastScrapeTime, sourceCoverage, callbackStats };
}

export function useDashboardMetrics() {
    return useDbQuery<DashboardMetrics>('dashboard-metrics', fetchDashboardMetrics, { fallback: DEFAULT_METRICS });
}
