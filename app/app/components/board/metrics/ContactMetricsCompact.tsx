'use client';

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
export default function ContactMetricsCompact({ contacts }: ContactMetricsCompactProps) {
    const stats = calculateMetrics(contacts);

    return (
        <>
            {/* Response Rate - show icon if exceptional (>30%) or poor (<15%) */}
            {stats.responseRate >= 0 && getContactedCount(contacts) > 0 && (
                <MetricChip
                    value={`${stats.responseRate}%`}
                    label="Response Rate"
                    tooltip={`${getRepliedCount(contacts)} of ${getContactedCount(contacts)} contacted leads replied. Industry avg: 15-25%.`}
                    variant={stats.responseRate >= 30 ? 'success' : stats.responseRate < 15 ? 'warning' : 'default'}
                    showIcon={stats.responseRate >= 30 || stats.responseRate < 15}
                />
            )}

            {/* Active Conversations - only show if > 0 */}
            {stats.activeConversations > 0 && (
                <MetricChip
                    value={stats.activeConversations}
                    label="Active Leads"
                    tooltip={`${stats.activeConversations} contact${stats.activeConversations > 1 ? 's' : ''} in active conversation or interviewing.`}
                    variant="success"
                    showIcon={true}
                />
            )}

            {/* Draft Completion */}
            {stats.draftCompletion >= 0 && getIdentifiedCount(contacts) > 0 && (
                <MetricChip
                    value={`${stats.draftCompletion}%`}
                    label="Drafts Ready"
                    tooltip={`${getDraftedCount(contacts)} of ${getIdentifiedCount(contacts)} identified contacts have drafted messages.`}
                    variant={stats.draftCompletion >= 80 ? 'success' : stats.draftCompletion < 50 ? 'warning' : 'default'}
                    showIcon={stats.draftCompletion < 50}
                />
            )}

            {/* LinkedIn Coverage - only show if there are contacts */}
            {contacts.length > 0 && (
                <MetricChip
                    value={`${stats.linkedinCoverage}%`}
                    label="LinkedIn"
                    tooltip={`${getLinkedInCount(contacts)} of ${contacts.length} contacts have LinkedIn profiles for networking.`}
                    variant={stats.linkedinCoverage >= 80 ? 'success' : stats.linkedinCoverage < 50 ? 'warning' : 'default'}
                    showIcon={stats.linkedinCoverage < 50}
                />
            )}
        </>
    );
}

// ─── Helper Functions ──────────────────────────────────────────────────────

interface MetricStats {
    responseRate: number;
    draftCompletion: number;
    activeConversations: number;
    linkedinCoverage: number;
}

function calculateMetrics(contacts: Contact[]): MetricStats {
    const contacted = getContactedCount(contacts);
    const replied = getRepliedCount(contacts);
    const identified = getIdentifiedCount(contacts);
    const drafted = getDraftedCount(contacts);
    const active = contacts.filter((c) => c.state === 'replied' || c.state === 'interviewing').length;
    const withLinkedIn = getLinkedInCount(contacts);

    return {
        responseRate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
        draftCompletion: identified > 0 ? Math.round((drafted / identified) * 100) : 0,
        activeConversations: active,
        linkedinCoverage: contacts.length > 0 ? Math.round((withLinkedIn / contacts.length) * 100) : 0,
    };
}

function getContactedCount(contacts: Contact[]): number {
    return contacts.filter((c) => c.state === 'contacted' || c.state === 'replied' || c.state === 'interviewing').length;
}

function getRepliedCount(contacts: Contact[]): number {
    return contacts.filter((c) => c.state === 'replied' || c.state === 'interviewing').length;
}

function getIdentifiedCount(contacts: Contact[]): number {
    return contacts.filter((c) => c.state !== 'rejected').length;
}

function getDraftedCount(contacts: Contact[]): number {
    return contacts.filter(
        (c) => c.state === 'drafted' || c.state === 'contacted' || c.state === 'replied' || c.state === 'interviewing'
    ).length;
}

function getLinkedInCount(contacts: Contact[]): number {
    return contacts.filter((c) => c.linkedin_url).length;
}
