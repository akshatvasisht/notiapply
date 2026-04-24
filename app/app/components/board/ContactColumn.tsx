'use client';

import { memo } from 'react';
import type { Contact } from '@/lib/types';
import ContactCard from './ContactCard';
import BaseColumn, { ShowMoreButton } from '../common/kanban/BaseColumn';

interface ContactColumnProps {
    label: string;
    contacts: Contact[];
    selectedIds: Set<number>;
    onCardClick: (contact: Contact, e: React.MouseEvent) => void;
    onDragStart?: (e: React.DragEvent, contactId: number) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    onDragEnd?: (e: React.DragEvent) => void;
    isDragOver?: boolean;
    collapsible?: boolean;
}

export default memo(function ContactColumn({
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
    return (
        <BaseColumn
            label={label}
            count={contacts.length}
            collapsible={collapsible}
            storageKey={collapsible ? `col-collapsed-crm-${label}` : undefined}
            itemLabel="contact"
            totalItems={contacts.length}
            renderItems={(limit, showAll, onShowAll) => (
                <div
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    style={{
                        flex: 1,
                        minHeight: 200,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
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
                            {(showAll ? contacts : contacts.slice(0, limit)).map(contact => (
                                <ContactCard
                                    key={contact.id}
                                    contact={contact}
                                    selected={selectedIds.has(contact.id)}
                                    onClick={(e) => onCardClick(contact, e)}
                                    onDragStart={(e, _c) => onDragStart?.(e, contact.id)}
                                    onDragEnd={onDragEnd}
                                />
                            ))}
                            {contacts.length > limit && !showAll && (
                                <ShowMoreButton total={contacts.length} itemLabel="contact" onClick={onShowAll} />
                            )}
                        </>
                    )}
                </div>
            )}
        />
    );
})
