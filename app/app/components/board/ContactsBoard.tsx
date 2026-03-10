import { useEffect, useState, useCallback } from 'react';
import { getContacts, updateContactState } from '@/lib/db';
import type { Contact, ContactBoardColumn } from '@/lib/types';
import { CONTACT_COLUMN_STATES, CONTACT_COLUMN_LABELS } from '@/lib/types';
import ContactDetail from './ContactDetail';
import BaseColumn from '../common/kanban/BaseColumn';
import BaseCard from '../common/kanban/BaseCard';


export interface ContactsBoardProps {
    onOpenSettings?: () => void;
    searchQuery?: string;
    onSearchChange?: (q: string) => void;
}

export default function ContactsBoard({ onOpenSettings, searchQuery: externalSearch, onSearchChange: onExternalSearchChange }: ContactsBoardProps) {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [focusedContact, setFocusedContact] = useState<Contact | null>(null);
    const [loading, setLoading] = useState(true);
    const [_internalSearch, _setInternalSearch] = useState('');
    const searchQuery = externalSearch ?? _internalSearch;
    const setSearchQuery = onExternalSearchChange ?? _setInternalSearch;

    const refresh = useCallback(() => {
        getContacts().then(setContacts).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);


    const filtered = contacts.filter(c => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            c.name.toLowerCase().includes(q) ||
            (c.role ?? '').toLowerCase().includes(q) ||
            c.company_name.toLowerCase().includes(q)
        );
    });

    const contactsByColumn = (column: ContactBoardColumn) =>
        filtered.filter(c => CONTACT_COLUMN_STATES[column].includes(c.state));

    const handleStateChange = async (contactId: number, newState: string) => {
        await updateContactState(contactId, newState);
        refresh();
    };

    if (loading) return <div style={{ padding: 20, color: 'var(--color-on-surface-secondary)' }}>Loading CRM...</div>;

    const columns: ContactBoardColumn[] = ['identified', 'drafted', 'contacted', 'replied', 'rejected'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{
                display: 'flex', flex: 1, gap: 8, padding: '8px 12px',
                background: 'var(--color-surface-raised)', overflowX: 'auto',
            }}>
                {columns.map(col => (
                    <BaseColumn
                        key={col}
                        label={CONTACT_COLUMN_LABELS[col]}
                        count={contactsByColumn(col).length}
                        minWidth={300}
                    >
                        {contactsByColumn(col).length === 0 ? (
                            <div style={{
                                textAlign: 'center', padding: '20px 0',
                                color: 'var(--color-on-surface-disabled)', fontSize: 13,
                            }}>
                                —
                            </div>
                        ) : (
                            contactsByColumn(col).map(contact => (
                                <BaseCard
                                    key={contact.id}
                                    onClick={() => setFocusedContact(contact)}
                                    borderColor="var(--color-outline)"
                                >
                                    <div style={{
                                        fontWeight: 500,
                                        color: 'var(--color-on-surface)',
                                        fontSize: 14,
                                        letterSpacing: '0.1px'
                                    }}>
                                        {contact.name}
                                    </div>
                                    <div style={{
                                        fontSize: 13,
                                        color: 'var(--color-on-surface-secondary)',
                                        marginTop: 2,
                                        lineHeight: 1.4
                                    }}>
                                        {contact.role} @ {contact.company_name}
                                    </div>
                                    {contact.linkedin_url && (
                                        <div style={{
                                            fontSize: 11,
                                            color: 'var(--color-primary)',
                                            marginTop: 8,
                                            fontWeight: 600,
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase'
                                        }}>
                                            LinkedIn Connected
                                        </div>
                                    )}
                                </BaseCard>
                            ))
                        )}
                    </BaseColumn>
                ))}
            </div>

            {focusedContact && (
                <ContactDetail
                    contact={focusedContact}
                    onClose={() => setFocusedContact(null)}
                    onStateChange={handleStateChange}
                />
            )}
        </div>
    );
}
