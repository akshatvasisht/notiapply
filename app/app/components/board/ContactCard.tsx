'use client';

import { memo } from 'react';
import type { Contact } from '@/lib/types';
import { getContactBorderColor, CONTACT_CHANNEL_COLORS, getUrgencyTier, URGENCY_COLORS } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import CompanyAvatar from '../common/CompanyAvatar';
import Badge from '../common/Badge';
import BaseCard from '../common/kanban/BaseCard';

interface ContactCardProps {
    contact: Contact;
    selected?: boolean;
    onClick: (e: React.MouseEvent) => void;
    onDragStart?: (e: React.DragEvent, contact: Contact) => void;
    onDragEnd?: (e: React.DragEvent) => void;
}

/** CRM contact card — mirrors JobCard layout:
 *  Name (primary) → Role (secondary) → Company (tertiary)
 *  [date left] [channel tag right]
 */
function ContactCard({ contact, selected = false, onClick, onDragStart, onDragEnd }: ContactCardProps) {
    const borderColor = getContactBorderColor(contact.state);
    const urgency = getUrgencyTier(contact);
    const urgencyColor = URGENCY_COLORS[urgency];

    const channelTag = contact.linkedin_url
        ? { label: 'LinkedIn', colors: CONTACT_CHANNEL_COLORS.linkedin }
        : contact.email
            ? { label: 'Email', colors: CONTACT_CHANNEL_COLORS.email }
            : null;

    const urgencyLabel = urgency !== 'none' && contact.follow_up_date
        ? (() => {
            const daysAbs = Math.abs(Math.floor(
                (new Date(contact.follow_up_date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000
            ));
            return urgency === 'critical'
                ? 'Response pending'
                : urgency === 'overdue'
                    ? `Overdue ${daysAbs}d`
                    : `Due in ${daysAbs}d`;
        })()
        : null;

    return (
        <BaseCard
            selected={selected}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e as unknown as React.MouseEvent); } }}
            role="button"
            tabIndex={0}
            borderColor={urgency !== 'none' ? urgencyColor.border : borderColor}
            draggable
            aria-grabbed={false}
            aria-roledescription="draggable contact card"
            onDragStart={(e) => onDragStart?.(e, contact)}
            onDragEnd={onDragEnd}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <CompanyAvatar name={contact.name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Primary: Name */}
                    <div style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--color-on-surface)',
                        lineHeight: 1.4,
                        letterSpacing: '0.1px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                        title={contact.name}
                    >
                        {contact.name}
                    </div>

                    {/* Secondary: Role */}
                    {contact.role && (
                        <div style={{
                            fontSize: 14,
                            color: 'var(--color-on-surface-secondary)',
                            lineHeight: 1.4,
                            marginTop: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                            title={contact.role}
                        >
                            {contact.role}
                        </div>
                    )}

                    {/* Tertiary: Company */}
                    <div style={{
                        fontSize: 12,
                        color: 'var(--color-on-surface-variant)',
                        marginTop: 4,
                        letterSpacing: '0.4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                        title={contact.company_name}
                    >
                        {contact.company_name}
                    </div>

                    {/* Footer: [date left] [urgency badge + channel tag right] */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 6,
                        gap: 6,
                    }}>
                        <span style={{
                            fontSize: 11,
                            color: 'var(--color-on-surface-disabled)',
                            letterSpacing: '0.5px',
                        }}>
                            {timeAgo(contact.created_at)}
                        </span>

                        <div style={{ display: 'flex', gap: 4 }}>
                            {urgencyLabel && (
                                <Badge label={urgencyLabel} color={urgencyColor.text} bg={urgencyColor.bg} />
                            )}

                            {contact.bounce_type && (
                                <Badge
                                    label={contact.bounce_type === 'hard' ? 'Bounced' : 'Soft bounce'}
                                    color={contact.bounce_type === 'hard' ? 'var(--color-error)' : 'var(--color-warning)'}
                                    bg={contact.bounce_type === 'hard' ? 'var(--color-error-container)' : 'var(--color-warning-container)'}
                                />
                            )}

                            {channelTag && (
                                <Badge label={channelTag.label} color={channelTag.colors.text} bg={channelTag.colors.bg} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </BaseCard>
    );
}

export default memo(ContactCard);
