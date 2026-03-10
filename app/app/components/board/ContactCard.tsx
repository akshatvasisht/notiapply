'use client';

import type { Contact } from '@/lib/types';
import { getContactBorderColor, CONTACT_CHANNEL_COLORS } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import CompanyAvatar from '../common/CompanyAvatar';
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
export default function ContactCard({ contact, selected = false, onClick, onDragStart, onDragEnd }: ContactCardProps) {
    const borderColor = getContactBorderColor(contact.state);

    const channelTag = contact.linkedin_url
        ? { label: 'LinkedIn', colors: CONTACT_CHANNEL_COLORS.linkedin }
        : contact.email
            ? { label: 'Email', colors: CONTACT_CHANNEL_COLORS.email }
            : null;

    return (
        <BaseCard
            selected={selected}
            onClick={onClick}
            borderColor={borderColor}
            draggable
            onDragStart={(e) => onDragStart?.(e, contact)}
            onDragEnd={onDragEnd}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <CompanyAvatar name={contact.name} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Primary: Name */}
                    <div style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--color-on-surface)',
                        lineHeight: 1.4,
                        letterSpacing: '0.1px',
                    }}>
                        {contact.name}
                    </div>

                    {/* Secondary: Role */}
                    <div style={{
                        fontSize: 14,
                        color: 'var(--color-on-surface-secondary)',
                        lineHeight: 1.4,
                        marginTop: 2,
                    }}>
                        {contact.role}
                    </div>

                    {/* Tertiary: Company */}
                    <div style={{
                        fontSize: 12,
                        color: 'var(--color-on-surface-variant)',
                        marginTop: 6,
                        letterSpacing: '0.4px',
                    }}>
                        {contact.company_name}
                    </div>

                    {/* Footer: [date] ... [channel tag] */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 10,
                        gap: 8,
                    }}>
                        <span style={{
                            fontSize: 11,
                            color: 'var(--color-on-surface-disabled)',
                            letterSpacing: '0.5px',
                        }}>
                            {timeAgo(contact.created_at)}
                        </span>

                        {channelTag && (
                            <span style={{
                                fontSize: 11,
                                fontWeight: 500,
                                padding: '3px 10px',
                                borderRadius: 12,
                                color: channelTag.colors.text,
                                background: channelTag.colors.bg,
                                letterSpacing: '0.5px',
                                whiteSpace: 'nowrap',
                            }}>
                                {channelTag.label}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </BaseCard>
    );
}
