'use client';

import { memo, useMemo } from 'react';
import MetricChip from '@/app/components/common/MetricChip';
import type { Contact } from '@/lib/types';

export interface ContactMetricsCompactProps {
    contacts: Contact[];
}

/**
 * Compact CRM metrics using MetricChip
 *
 * Design: Only show icons when metrics are exceptional or poor
 */
function ContactMetricsCompact({ contacts }: ContactMetricsCompactProps) {
    // Single pass over contacts — replaces 6+ separate filter calls per render
    const stats = useMemo(() => {
        let contacted = 0, replied = 0, identified = 0, drafted = 0, active = 0, withLinkedIn = 0;
        for (const c of contacts) {
            const s = c.state;
            if (s === 'contacted' || s === 'replied' || s === 'interviewing') contacted++;
            if (s === 'replied' || s === 'interviewing') { replied++; active++; }
            if (s !== 'rejected') identified++;
            if (s === 'drafted' || s === 'contacted' || s === 'replied' || s === 'interviewing') drafted++;
            if (c.linkedin_url) withLinkedIn++;
        }
        return {
            contacted,
            replied,
            identified,
            drafted,
            active,
            withLinkedIn,
            responseRate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
            draftCompletion: identified > 0 ? Math.round((drafted / identified) * 100) : 0,
            linkedinCoverage: contacts.length > 0 ? Math.round((withLinkedIn / contacts.length) * 100) : 0,
        };
    }, [contacts]);

    return (
        <>
            {/* Response Rate - show icon if exceptional (>30%) or poor (<15%) */}
            {stats.contacted > 0 && (
                <MetricChip
                    value={`${stats.responseRate}%`}
                    label="Response Rate"
                    tooltip={`${stats.replied} of ${stats.contacted} contacted leads replied. Industry avg: 15-25%.`}
                    variant={stats.responseRate >= 30 ? 'success' : stats.responseRate < 15 ? 'warning' : 'default'}
                    showIcon={stats.responseRate >= 30 || stats.responseRate < 15}
                />
            )}

            {/* Active Conversations - only show if > 0 */}
            {stats.active > 0 && (
                <MetricChip
                    value={stats.active}
                    label="Active Leads"
                    tooltip={`${stats.active} contact${stats.active > 1 ? 's' : ''} in active conversation or interviewing.`}
                    variant="success"
                    showIcon={true}
                />
            )}

            {/* Draft Completion */}
            {stats.identified > 0 && (
                <MetricChip
                    value={`${stats.draftCompletion}%`}
                    label="Drafts Ready"
                    tooltip={`${stats.drafted} of ${stats.identified} identified contacts have drafted messages.`}
                    variant={stats.draftCompletion >= 80 ? 'success' : stats.draftCompletion < 50 ? 'warning' : 'default'}
                    showIcon={stats.draftCompletion < 50}
                />
            )}

            {/* LinkedIn Coverage - only show if there are contacts */}
            {contacts.length > 0 && (
                <MetricChip
                    value={`${stats.linkedinCoverage}%`}
                    label="LinkedIn"
                    tooltip={`${stats.withLinkedIn} of ${contacts.length} contacts have LinkedIn profiles for networking.`}
                    variant={stats.linkedinCoverage >= 80 ? 'success' : stats.linkedinCoverage < 50 ? 'warning' : 'default'}
                    showIcon={stats.linkedinCoverage < 50}
                />
            )}
        </>
    );
}

export default memo(ContactMetricsCompact);
