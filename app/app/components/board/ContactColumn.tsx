'use client';

import { useState } from 'react';
import type { Contact } from '@/lib/types';
import ContactCard from './ContactCard';
import BaseColumn from '../common/kanban/BaseColumn';
import CollapsedColumnRail from '../common/kanban/CollapsedColumnRail';

interface ContactColumnProps {
    label: string;
    contacts: Contact[];
    selectedIds: Set<number>;
    onCardClick: (contact: Contact, e: React.MouseEvent) => void;
    onDragStart?: (contactId: number) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
    isDragOver?: boolean;
    collapsible?: boolean;
}

const INITIAL_LIMIT = 20;

export default function ContactColumn({
    label,
    contacts,
    selectedIds,
    onCardClick,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    isDragOver,
    collapsible = false,
}: ContactColumnProps) {
    const [showAll, setShowAll] = useState(false);
    const [collapsed, setCollapsed] = useState(collapsible);

    const displayedContacts = showAll ? contacts : contacts.slice(0, INITIAL_LIMIT);
    const hasMore = contacts.length > INITIAL_LIMIT;

    if (collapsed) {
        return (
            <CollapsedColumnRail
                label={label}
                count={contacts.length}
                itemLabel="contact"
                onExpand={() => setCollapsed(false)}
            />
        );
    }

    return (
        <BaseColumn
            label={label}
            count={contacts.length}
            onCollapse={collapsible ? () => setCollapsed(true) : undefined}
        >
            <div
                onDragOver={onDragOver}
                onDrop={onDrop}
                style={{
                    minHeight: 200,
                    background: isDragOver ? 'var(--color-primary-container)' : 'transparent',
                    borderRadius: 8,
                    transition: 'background 0.2s',
                }}
            >
                {contacts.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '20px 0',
                        color: 'var(--color-on-surface-disabled)',
                        fontSize: 13,
                    }}>
                        —
                    </div>
                ) : (
                    <>
                        {displayedContacts.map(contact => (
                            <ContactCard
                                key={contact.id}
                                contact={contact}
                                selected={selectedIds.has(contact.id)}
                                onClick={(e) => onCardClick(contact, e)}
                                onDragStart={() => onDragStart?.(contact.id)}
                                onDragEnd={onDragEnd}
                            />
                        ))}

                        {hasMore && !showAll && (
                            <button
                                onClick={() => setShowAll(true)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    marginTop: 8,
                                    background: 'var(--color-surface-container-high)',
                                    border: '1px solid var(--color-outline-variant)',
                                    borderRadius: 8,
                                    color: 'var(--color-primary)',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--color-primary-container)';
                                    e.currentTarget.style.boxShadow = 'var(--elevation-1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--color-surface-container-high)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                Show all {contacts.length} contacts
                            </button>
                        )}
                    </>
                )}
            </div>
        </BaseColumn>
    );
}
