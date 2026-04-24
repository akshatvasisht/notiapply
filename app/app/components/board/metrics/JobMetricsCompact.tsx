'use client';

import { memo, useMemo } from 'react';
import MetricChip from '@/app/components/common/MetricChip';
import type { ATSFailure, AutomationStats, SourceCoverage, CallbackStats } from '@/lib/types';

export interface JobMetricsCompactProps {
    atsFailures: ATSFailure[];
    automationStats: AutomationStats;
    lastScrapeTime: Date | null;
    sourceCoverage: SourceCoverage;
    callbackStats: CallbackStats;
}

/**
 * Compact job metrics using MetricChip
 *
 * Design: Only show icons when there's an issue
 */
function JobMetricsCompact({
    atsFailures,
    automationStats,
    lastScrapeTime,
    sourceCoverage,
    callbackStats,
}: JobMetricsCompactProps) {
    const totalFailures = useMemo(() => atsFailures.reduce((sum, f) => sum + f.fill_failed_count, 0), [atsFailures]);
    const timeSince = useMemo(() => getTimeSinceLastScrape(lastScrapeTime), [lastScrapeTime]);
    const isStale = useMemo(() => lastScrapeTime && (new Date().getTime() - lastScrapeTime.getTime()) > 12 * 60 * 60 * 1000, [lastScrapeTime]);

    return (
        <>
            {/* ATS Failures - only show if there are failures */}
            {totalFailures > 0 && (
                <MetricChip
                    value={totalFailures}
                    label="ATS Failures"
                    tooltip={`${totalFailures} job${totalFailures > 1 ? 's' : ''} failed during auto-fill. Review attention column to identify patterns.`}
                    variant="error"
                    showIcon={true}
                />
            )}

            {/* Automation Rate */}
            {automationStats.total > 0 && (
                <MetricChip
                    value={`${automationStats.rate}%`}
                    label="Auto-Fill Success"
                    tooltip={`${automationStats.automated} of ${automationStats.total} jobs successfully auto-filled. Industry average: 60-80%.`}
                    variant={automationStats.rate >= 70 ? 'success' : automationStats.rate >= 50 ? 'warning' : 'error'}
                    showIcon={automationStats.rate < 50}
                />
            )}

            {/* Last Scrape - show icon if stale */}
            {timeSince && (
                <MetricChip
                    value={timeSince}
                    label="Last Scrape"
                    tooltip={isStale
                        ? `Last scrape was ${timeSince}. Pipeline is stale - consider running scraper.`
                        : `Pipeline last ran ${timeSince}. Fresh data.`
                    }
                    variant={isStale ? 'warning' : 'default'}
                    showIcon={!!isStale}
                />
            )}

            {/* Source Coverage - only show if there are sources configured */}
            {sourceCoverage.total > 0 && (
                <MetricChip
                    value={`${sourceCoverage.active}/${sourceCoverage.total}`}
                    label="Active Sources"
                    tooltip={`${sourceCoverage.active} of ${sourceCoverage.total} job board scrapers are enabled. Enable more in Settings for broader coverage.`}
                    variant={sourceCoverage.active < 2 ? 'warning' : 'default'}
                    showIcon={sourceCoverage.active < 2}
                />
            )}

            {/* Callback/Interview Rate - most important success metric */}
            {callbackStats.total_applications > 0 && (
                <MetricChip
                    value={`${callbackStats.callback_rate}%`}
                    label="Interview Rate"
                    tooltip={`${callbackStats.total_callbacks} interviews from ${callbackStats.total_applications} submitted apps. Target: 5-15%.`}
                    variant={callbackStats.callback_rate >= 10 ? 'success' : callbackStats.callback_rate < 3 ? 'warning' : 'default'}
                    showIcon={callbackStats.callback_rate >= 10 || callbackStats.callback_rate < 3}
                />
            )}
        </>
    );
}

export default memo(JobMetricsCompact);

function getTimeSinceLastScrape(lastScrapeTime: Date | null): string | null {
    if (!lastScrapeTime) return null;
    const now = new Date();
    const diff = now.getTime() - lastScrapeTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}
