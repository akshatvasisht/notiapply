'use client';

import { useState, useRef } from 'react';
import ActionMenu from '../../common/ActionMenu';
import type { MenuItemDef } from '../../common/ActionMenu';

export interface ContactActionsProps {
    identifiedCount: number;
    draftedWithEmailCount?: number;
    draftingMessages?: boolean;
    onDraftMessages?: () => void;
    onSendEmails?: () => void;
    onExportCSV?: () => void;
}

export default function ContactActions({
    identifiedCount,
    draftedWithEmailCount = 0,
    draftingMessages = false,
    onDraftMessages,
    onSendEmails,
    onExportCSV,
}: ContactActionsProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Draft button styling based on state (matching Start Session)
    const draftDisabled = identifiedCount === 0 || draftingMessages;
    const draftBtnStyle: React.CSSProperties = identifiedCount > 0 && !draftingMessages ? {
        background: 'var(--color-primary)',
        color: 'var(--color-on-primary)',
        boxShadow: 'var(--elevation-1)',
    } : {
        background: 'transparent',
        color: 'var(--color-primary)',
        border: '1px solid var(--color-outline)',
    };

    const menuItems: MenuItemDef[] = [
        {
            label: 'Export CSV',
            sublabel: 'Download contacts list',
            onClick: () => {
                onExportCSV?.();
                setMenuOpen(false);
            },
        },
        {
            label: 'Send Drafted Emails',
            sublabel: draftedWithEmailCount > 0 ? `${draftedWithEmailCount} contact${draftedWithEmailCount > 1 ? 's' : ''} ready to send` : 'No contacts with email ready',
            title: draftedWithEmailCount === 0 ? 'No drafted contacts with an email address are ready to send' : undefined,
            onClick: () => {
                onSendEmails?.();
                setMenuOpen(false);
            },
            disabled: draftedWithEmailCount === 0,
        },
    ];

    return (
        <>
            {/* Primary action: Draft Messages */}
            <button
                onClick={draftDisabled ? undefined : onDraftMessages}
                disabled={draftDisabled}
                style={{
                    padding: '8px 18px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: '0.5px',
                    cursor: draftDisabled ? 'not-allowed' : 'pointer',
                    border: 'none',
                    opacity: draftingMessages ? 0.6 : 1,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    ...draftBtnStyle,
                }}
            >
                {draftingMessages ? '⟳ Drafting…' : '▸ Draft Messages'}
            </button>

            {/* Overflow menu */}
            <div ref={menuRef} style={{ position: 'relative' }}>
                <button
                    onClick={() => setMenuOpen((o) => !o)}
                    style={{
                        background: menuOpen ? 'var(--color-secondary-container)' : 'transparent',
                        border: 'none',
                        borderRadius: 20,
                        cursor: 'pointer',
                        fontSize: 20,
                        color: 'var(--color-on-surface-variant)',
                        padding: '6px 12px',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        lineHeight: 1,
                    }}
                    aria-label="More options"
                >
                    ⋮
                </button>

                <ActionMenu
                    items={menuItems}
                    open={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    containerRef={menuRef}
                />
            </div>
        </>
    );
}
