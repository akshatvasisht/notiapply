'use client';

import MetricChip from '@/app/components/common/MetricChip';
import type { ATSFailure, AutomationStats, SourceCoverage } from '@/lib/types';

export interface JobMetricsCompactProps {
    atsFailures: ATSFailure[];
    automationStats: AutomationStats;
    lastScrapeTime: Date | null;
    sourceCoverage: SourceCoverage;
}

/**
 * Compact job metrics using MetricChip
 *
 * Design: Only show icons when there's an issue
 */
export default function JobMetricsCompact({
    atsFailures,
    automationStats,
    lastScrapeTime,
    sourceCoverage,
}: JobMetricsCompactProps) {
    const totalFailures = atsFailures.reduce((sum, f) => sum + f.fill_failed_count, 0);
    const timeSince = getTimeSinceLastScrape(lastScrapeTime);
    const isStale = lastScrapeTime && (new Date().getTime() - lastScrapeTime.getTime()) > 12 * 60 * 60 * 1000;

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
        </>
    );
}

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
