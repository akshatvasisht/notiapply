'use client';

import { useEffect, useState, useCallback } from 'react';
import { getContacts, updateContactState, getJobs } from '@/lib/db';
import type { Contact, ContactBoardColumn, Job } from '@/lib/types';
import { CONTACT_COLUMN_STATES, CONTACT_COLUMN_LABELS } from '@/lib/types';
import { MOCK_CONTACTS, MOCK_JOBS } from '@/lib/mock-data';
import { generateBatchMessages } from '@/lib/llm';
import ContactColumn from './ContactColumn';
import ContactMetricsCompact from './metrics/ContactMetricsCompact';
import ContactActions from './actions/ContactActions';
import ContactDetail from './ContactDetail';
import Modal from '../common/Modal';
import Toast from '../common/Toast';


export interface ContactsBoardProps {
    onOpenSettings?: () => void;
    searchQuery?: string;
    onSearchChange?: (q: string) => void;
    onMetricsChange?: (metrics: React.ReactNode) => void;
    onActionsChange?: (actions: React.ReactNode) => void;
}

export default function ContactsBoard({
    onOpenSettings,
    searchQuery: externalSearch,
    onSearchChange: onExternalSearchChange,
    onMetricsChange,
    onActionsChange
}: ContactsBoardProps) {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [focusedContact, setFocusedContact] = useState<Contact | null>(null);
    const [loading, setLoading] = useState(true);
    const [_internalSearch, _setInternalSearch] = useState('');
    const searchQuery = externalSearch ?? _internalSearch;
    const setSearchQuery = onExternalSearchChange ?? _setInternalSearch;
    const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
    const [useMockData, setUseMockData] = useState(false);
    const [draggedContactId, setDraggedContactId] = useState<number | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<ContactBoardColumn | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastType, setToastType] = useState<'success' | 'error'>('success');
    const [draftingMessages, setDraftingMessages] = useState(false);

    const refresh = useCallback(() => {
        Promise.all([getContacts(), getJobs()])
            .then(([contactData, jobData]) => {
                if (contactData.length === 0) {
                    setContacts(MOCK_CONTACTS);
                    setJobs(MOCK_JOBS);
                    setUseMockData(true);
                } else {
                    setContacts(contactData);
                    setJobs(jobData);
                    setUseMockData(false);
                }
            })
            .catch(() => {
                setContacts(MOCK_CONTACTS);
                setJobs(MOCK_JOBS);
                setUseMockData(true);
            })
            .finally(() => setLoading(false));
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

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.key === 'Escape') {
                if (selectedContactIds.size > 0) setSelectedContactIds(new Set());
                else if (focusedContact) setFocusedContact(null);
            } else if (e.key === 'a' && e.ctrlKey) {
                e.preventDefault();
                const allIds = new Set(filtered.map(c => c.id));
                setSelectedContactIds(allIds);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [focusedContact, selectedContactIds, filtered]);

    const contactsByColumn = (column: ContactBoardColumn) =>
        filtered.filter(c => CONTACT_COLUMN_STATES[column].includes(c.state));

    const identifiedCount = contactsByColumn('identified').length;

    // Push metrics and actions to header
    useEffect(() => {
        if (onMetricsChange) {
            onMetricsChange(
                <ContactMetricsCompact contacts={contacts} />
            );
        }
        if (onActionsChange) {
            onActionsChange(
                <ContactActions
                    identifiedCount={identifiedCount}
                    onDraftMessages={async () => {
                        setDraftingMessages(true);
                        try {
                            const identifiedContacts = contacts.filter(c => c.state === 'identified');

                            const messages = await generateBatchMessages(
                                identifiedContacts,
                                (current, total) => {
                                    setToastMessage(`Generating messages... ${current}/${total}`);
                                    setToastType('success');
                                }
                            );

                            // Update contacts with drafted messages
                            const updatedContacts = contacts.map(c => {
                                const message = messages.get(c.id);
                                if (message) {
                                    return { ...c, drafted_message: message, state: 'drafted' as Contact['state'] };
                                }
                                return c;
                            });

                            setContacts(updatedContacts);
                            setToastMessage(`✓ Generated ${messages.size} draft messages`);
                            setToastType('success');

                            setTimeout(() => setToastMessage(null), 3000);
                        } catch (error) {
                            setToastMessage(`Error: ${error instanceof Error ? error.message : 'Failed to generate messages'}`);
                            setToastType('error');
                            setTimeout(() => setToastMessage(null), 5000);
                        } finally {
                            setDraftingMessages(false);
                        }
                    }}
                    onExportCSV={() => {
                        const csv = generateCSV(contacts);
                        downloadCSV(csv, 'contacts.csv');
                    }}
                />
            );
        }
    }, [contacts, identifiedCount, onMetricsChange, onActionsChange]);

    const handleStateChange = async (contactId: number, newState: string) => {
        await updateContactState(contactId, newState);
        refresh();
    };

    const handleCardClick = (contact: Contact, e: React.MouseEvent) => {
        if (e.ctrlKey) {
            const newSelection = new Set(selectedContactIds);
            if (newSelection.has(contact.id)) {
                newSelection.delete(contact.id);
            } else {
                newSelection.add(contact.id);
            }
            setSelectedContactIds(newSelection);
        } else if (selectedContactIds.size > 0) {
            setSelectedContactIds(new Set());
            setFocusedContact(contact);
        } else {
            setFocusedContact(contact);
        }
    };

    // ── Drag-and-Drop handlers ──────────────────────────────────────────────
    const handleDragStart = (_e: React.DragEvent, contact: Contact) => {
        setDraggedContactId(contact.id);
    };

    const handleDragOver = (e: React.DragEvent, col: ContactBoardColumn) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(col);
    };

    const handleDrop = async (e: React.DragEvent, col: ContactBoardColumn) => {
        e.preventDefault();
        setDragOverColumn(null);
        if (draggedContactId === null) return;

        const contact = contacts.find(c => c.id === draggedContactId);
        if (!contact) return;

        // Map column → target state (use first state in the column's states list)
        const targetState = CONTACT_COLUMN_STATES[col][0];
        if (contact.state === targetState) return;

        // Optimistic local update for snappy UI
        setContacts(prev => prev.map(c =>
            c.id === draggedContactId ? { ...c, state: targetState as Contact['state'] } : c
        ));
        setDraggedContactId(null);

        // Persist
        await handleStateChange(draggedContactId, targetState);
    };

    const handleDragEnd = () => {
        setDraggedContactId(null);
        setDragOverColumn(null);
    };

    if (loading) {
        return (
            <div style={{ padding: 20, color: 'var(--color-on-surface-secondary)' }}>
                Loading CRM...
            </div>
        );
    }

    const columns: ContactBoardColumn[] = ['identified', 'drafted', 'contacted', 'replied', 'rejected'];

    const mockDataBanner = useMockData ? (
        <div style={{
            padding: '8px 16px',
            background: 'var(--color-warning-container)',
            borderBottom: '1px solid var(--color-warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
        }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-warning)' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: 13, color: 'var(--color-warning)', fontWeight: 500 }}>
                Preview Mode: Using mock data (database not connected)
            </span>
        </div>
    ) : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {mockDataBanner}

            <div style={{
                display: 'flex', flex: 1, gap: 8, padding: '8px 12px',
                background: 'var(--color-surface-raised)', overflowX: 'auto',
            }}>
                {columns.map(col => (
                    <ContactColumn
                        key={col}
                        label={CONTACT_COLUMN_LABELS[col]}
                        contacts={contactsByColumn(col)}
                        selectedIds={selectedContactIds}
                        onCardClick={handleCardClick}
                        onDragStart={(contactId) => setDraggedContactId(contactId)}
                        onDragOver={(e) => handleDragOver(e, col)}
                        onDrop={(e) => handleDrop(e, col)}
                        onDragEnd={handleDragEnd}
                        isDragOver={dragOverColumn === col}
                        collapsible={col === 'rejected'}
                    />
                ))}
            </div>

            {focusedContact && (
                <Modal onClose={() => { setFocusedContact(null); refresh(); }}>
                    <ContactDetail
                        contact={focusedContact}
                        jobs={jobs}
                        onClose={() => { setFocusedContact(null); refresh(); }}
                        onStateChange={handleStateChange}
                    />
                </Modal>
            )}

            {toastMessage && (
                <Toast
                    message={toastMessage}
                    type={toastType}
                    onDismiss={() => setToastMessage(null)}
                />
            )}
        </div>
    );
}

// ─── CSV Export Helpers ────────────────────────────────────────────────────

function generateCSV(contacts: Contact[]): string {
    const headers = ['Name', 'Role', 'Company', 'Email', 'LinkedIn', 'State', 'Created At'];
    const rows = contacts.map(c => [
        c.name,
        c.role || '',
        c.company_name,
        c.email || '',
        c.linkedin_url || '',
        c.state,
        c.created_at,
    ]);

    return [
        headers.join(','),
        ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');
}

function escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function downloadCSV(csv: string, filename: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
