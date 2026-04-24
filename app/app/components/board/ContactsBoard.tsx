'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { updateContactState, scheduleBatchEmails } from '@/lib/db';
import { getSecureConfig } from '@/lib/secure-config';
import { useJobs, useContacts, useEmailQueue, useCardSelection, useBoardKeyboard } from '@/lib/hooks';
import type { Contact, ContactBoardColumn } from '@/lib/types';
import { CONTACT_COLUMN_STATES, CONTACT_COLUMN_LABELS } from '@/lib/types';
import { MOCK_CONTACTS } from '@/lib/mock-data';
import { generateBatchMessages } from '@/lib/llm';
import ContactColumn from './ContactColumn';
import ContactMetricsCompact from './metrics/ContactMetricsCompact';
import ContactActions from './actions/ContactActions';
import Modal from '../common/Modal';
import Toast from '../common/Toast';

// Lazy-load the heavy ContactDetail modal (928 lines)
const ContactDetail = dynamic(() => import('./ContactDetail'), {
    loading: () => <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div>,
    ssr: false
});


const CONTACT_COLUMNS: ContactBoardColumn[] = ['identified', 'drafted', 'contacted', 'replied', 'rejected'];

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
    const { data: contactsData, refresh: refreshContacts, loading: contactsLoading } = useContacts();
    const { data: jobsData, refresh: refreshJobs } = useJobs();

    // Local contacts state for optimistic updates (draft messages, drag-drop)
    const [localContacts, setLocalContacts] = useState<Contact[] | null>(null);
    const contacts = localContacts ?? contactsData ?? [];
    const jobs = jobsData ?? [];

    // Sync hook data into local state when it changes
    useEffect(() => {
        if (contactsData) setLocalContacts(null);
    }, [contactsData]);

    const [focusedContact, setFocusedContact] = useState<Contact | null>(null);
    const loading = contactsLoading;
    const [_internalSearch, _setInternalSearch] = useState('');
    const searchQuery = externalSearch ?? _internalSearch;
    const setSearchQuery = onExternalSearchChange ?? _setInternalSearch;
    const { selectedIds: selectedContactIds, handleCardClick: handleCardClickRaw, selectAll: selectAllContactIds, clearSelection: clearContactSelection } = useCardSelection<Contact>();
    const useMockData = contactsData === MOCK_CONTACTS;
    const [draggedContactId, setDraggedContactId] = useState<number | null>(null);
    const draggedContactIdRef = useRef<number | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<ContactBoardColumn | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastType, setToastType] = useState<'success' | 'error'>('success');
    const [draftingMessages, setDraftingMessages] = useState(false);

    const refresh = useCallback(() => {
        refreshContacts();
        refreshJobs();
    }, [refreshContacts, refreshJobs]);

    const filtered = useMemo(() => contacts.filter(c => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            c.name.toLowerCase().includes(q) ||
            (c.role ?? '').toLowerCase().includes(q) ||
            c.company_name.toLowerCase().includes(q)
        );
    }), [contacts, searchQuery]);

    // Keyboard: Escape cascade + Ctrl+A select-all
    useBoardKeyboard(
        useMemo(() => [
            { active: selectedContactIds.size > 0, dismiss: clearContactSelection },
            { active: !!focusedContact, dismiss: () => setFocusedContact(null) },
        ], [selectedContactIds, focusedContact, clearContactSelection]),
        useCallback(() => filtered.map(c => c.id), [filtered]),
        selectAllContactIds,
    );

    const contactsByColumnMap = useMemo(() => {
        const cols: ContactBoardColumn[] = ['identified', 'drafted', 'contacted', 'replied', 'rejected'];
        const map = new Map<ContactBoardColumn, Contact[]>();
        for (const col of cols) {
            map.set(col, filtered.filter(c => CONTACT_COLUMN_STATES[col].includes(c.state)));
        }
        return map;
    }, [filtered]);

    const contactsByColumn = (column: ContactBoardColumn) => contactsByColumnMap.get(column) ?? [];

    const identifiedCount = contactsByColumnMap.get('identified')?.length ?? 0;
    const draftedWithEmailCount = useMemo(
        () => contacts.filter(c => c.state === 'drafted' && c.email && c.drafted_message).length,
        [contacts]
    );
    const emailQueue = useEmailQueue();

    const handleSendEmails = useCallback(async () => {
        const draftedContacts = contacts.filter(
            c => c.state === 'drafted' && c.email && c.drafted_message
        );
        if (draftedContacts.length === 0) return;
        try {
            const config = await getSecureConfig();
            const delayMinutes = config.smtp_min_delay_minutes ?? 10;
            const contactIds = draftedContacts.map(c => c.id);
            await scheduleBatchEmails(contactIds, new Date(), delayMinutes);
            const now = new Date();
            const updatedContacts = contacts.map(c => {
                const idx = contactIds.indexOf(c.id);
                if (idx === -1) return c;
                const sendAt = new Date(now.getTime() + idx * delayMinutes * 60_000);
                return { ...c, send_at: sendAt.toISOString() };
            });
            setLocalContacts(updatedContacts);
            setToastMessage(`✓ Scheduled ${draftedContacts.length} emails`);
            setToastType('success');
            setTimeout(() => setToastMessage(null), 3000);
        } catch (err) {
            setToastMessage(`Error scheduling emails: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setToastType('error');
            setTimeout(() => setToastMessage(null), 5000);
        }
    }, [contacts]);

    const handleDraftMessages = useCallback(async () => {
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
            const updatedContacts = contacts.map(c => {
                const message = messages.get(c.id);
                if (message) {
                    return { ...c, drafted_message: message, state: 'drafted' as Contact['state'] };
                }
                return c;
            });
            setLocalContacts(updatedContacts);
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
    }, [contacts]);

    const handleExportCSV = useCallback(() => {
        const csv = generateCSV(contacts);
        downloadCSV(csv, 'contacts.csv');
    }, [contacts]);

    // Memoize header slot content — only reconstructs when relevant data changes
    const metricsNode = useMemo(() => (
        <ContactMetricsCompact contacts={contacts} />
    ), [contacts]);

    const actionsNode = useMemo(() => (
        <ContactActions
            identifiedCount={identifiedCount}
            draftedWithEmailCount={draftedWithEmailCount}
            draftingMessages={draftingMessages}
            onSendEmails={handleSendEmails}
            onDraftMessages={handleDraftMessages}
            onExportCSV={handleExportCSV}
        />
    ), [identifiedCount, draftedWithEmailCount, draftingMessages, handleSendEmails, handleDraftMessages, handleExportCSV]);

    useEffect(() => { onMetricsChange?.(metricsNode); }, [metricsNode, onMetricsChange]);
    useEffect(() => { onActionsChange?.(actionsNode); }, [actionsNode, onActionsChange]);

    const handleStateChange = useCallback(async (contactId: number, newState: string) => {
        await updateContactState(contactId, newState);
        refresh();
    }, [refresh]);

    const handleCardClick = useCallback((contact: Contact, e: React.MouseEvent) => {
        handleCardClickRaw(contact, e, setFocusedContact);
    }, [handleCardClickRaw]);

    // ── Drag-and-Drop handlers ──────────────────────────────────────────────
    const handleDragStart = useCallback((e: React.DragEvent, contactId: number) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(contactId));
        draggedContactIdRef.current = contactId;
        setDraggedContactId(contactId);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, col: ContactBoardColumn) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(col);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent, col: ContactBoardColumn) => {
        e.preventDefault();
        setDragOverColumn(null);

        // Read from ref — immune to stale closures
        const dragId = draggedContactIdRef.current;
        if (dragId === null) return;

        const contact = contacts.find(c => c.id === dragId);
        if (!contact) return;

        const targetState = CONTACT_COLUMN_STATES[col][0];
        if (contact.state === targetState) return;

        setLocalContacts(contacts.map(c =>
            c.id === dragId ? { ...c, state: targetState as Contact['state'] } : c
        ));
        draggedContactIdRef.current = null;
        setDraggedContactId(null);

        await handleStateChange(dragId, targetState);
    }, [contacts, handleStateChange]);

    const handleDragEnd = useCallback(() => {
        draggedContactIdRef.current = null;
        setDraggedContactId(null);
        setDragOverColumn(null);
    }, []);

    if (loading) {
        return (
            <div style={{ padding: 20, color: 'var(--color-on-surface-secondary)' }}>
                Loading CRM...
            </div>
        );
    }


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
                Preview — representative data only (database not connected)
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
                {CONTACT_COLUMNS.map(col => (
                    <ContactColumn
                        key={col}
                        label={CONTACT_COLUMN_LABELS[col]}
                        contacts={contactsByColumn(col)}
                        selectedIds={selectedContactIds}
                        onCardClick={handleCardClick}
                        onDragStart={handleDragStart}
                        onDragOver={(e) => handleDragOver(e, col)}
                        onDrop={(e) => handleDrop(e, col)}
                        onDragEnd={handleDragEnd}
                        isDragOver={dragOverColumn === col}
                        collapsible={col === 'rejected'}
                    />
                ))}
            </div>

            {focusedContact && (
                <Modal title={`${focusedContact.name} — ${focusedContact.company_name}`} onClose={() => { setFocusedContact(null); refresh(); }}>
                    <ContactDetail
                        contact={focusedContact}
                        jobs={jobs}
                        onClose={() => { setFocusedContact(null); refresh(); }}
                        onStateChange={handleStateChange}
                        onContactUpdated={(updatedContact) => {
                            setFocusedContact(updatedContact);
                            refresh();
                        }}
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

            {emailQueue.pending > 0 && (
                <div role="status" aria-live="polite" style={{
                    position: 'fixed',
                    bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
                    right: 'max(24px, env(safe-area-inset-right, 24px))',
                    background: 'var(--color-surface-container-high)',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    color: 'var(--color-on-surface)',
                    boxShadow: 'var(--elevation-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    zIndex: 100,
                }}>
                    <span style={{
                        display: 'inline-block',
                        width: 8, height: 8,
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        animation: emailQueue.active ? 'pulse 1s infinite' : 'none',
                    }} />
                    {emailQueue.active ? 'Sending email…' : `${emailQueue.pending} email${emailQueue.pending > 1 ? 's' : ''} queued`}
                </div>
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
    try {
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } finally {
        URL.revokeObjectURL(url);
    }
}
