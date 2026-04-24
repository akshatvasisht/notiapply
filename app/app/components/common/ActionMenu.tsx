'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface MenuItemDef {
    label: string;
    sublabel?: string;
    title?: string;
    icon?: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
    /** Render a separator line before this item */
    separatorBefore?: boolean;
}

export interface ActionMenuProps {
    items: MenuItemDef[];
    open: boolean;
    onClose: () => void;
    /** Ref to the container wrapping both the toggle button and this menu.
     *  Outside-click detection uses this ref so clicks on the toggle
     *  button are not treated as outside clicks. */
    containerRef?: React.RefObject<HTMLElement | null>;
}

export default function ActionMenu({ items, open, onClose, containerRef }: ActionMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const clickRef = containerRef ?? menuRef;

    // Close menu on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (clickRef.current && !clickRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, onClose, clickRef]);

    // Focus first enabled item on open
    useEffect(() => {
        if (!open || !menuRef.current) return;
        const first = menuRef.current.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)');
        first?.focus();
    }, [open]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const menu = menuRef.current;
        if (!menu) return;
        const menuItems = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
        const idx = menuItems.indexOf(document.activeElement as HTMLElement);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            menuItems[(idx + 1) % menuItems.length]?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            menuItems[(idx - 1 + menuItems.length) % menuItems.length]?.focus();
        } else if (e.key === 'Home') {
            e.preventDefault();
            menuItems[0]?.focus();
        } else if (e.key === 'End') {
            e.preventDefault();
            menuItems[menuItems.length - 1]?.focus();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    }, [onClose]);

    if (!open) return null;

    return (
        <div
            ref={menuRef}
            role="menu"
            onKeyDown={handleKeyDown}
            style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 50,
                background: 'var(--color-surface-container-high)',
                border: 'none',
                borderRadius: 16,
                boxShadow: 'var(--elevation-3)',
                minWidth: 220,
                overflow: 'hidden',
                padding: '8px 0',
                animation: 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            {items.map((item) => (
                <div key={item.label}>
                    {item.separatorBefore && (
                        <div style={{ height: 1, background: 'var(--color-outline-variant)', margin: '8px 0' }} role="separator" />
                    )}
                    <button
                        role="menuitem"
                        onClick={item.disabled ? undefined : item.onClick}
                        disabled={item.disabled}
                        title={item.title}
                        className="menu-item-btn"
                        tabIndex={-1}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            width: '100%',
                            padding: '10px 16px',
                            border: 'none',
                            cursor: item.disabled ? 'default' : 'pointer',
                            background: 'transparent',
                            opacity: item.disabled ? 0.5 : 1,
                            textAlign: 'left',
                        }}
                    >
                        <span
                            style={{
                                fontSize: 14,
                                color: item.danger ? 'var(--color-error)' : 'var(--color-on-surface)',
                                fontWeight: 500,
                                letterSpacing: '0.1px',
                            }}
                        >
                            {item.label}
                        </span>
                        {item.sublabel && (
                            <span
                                style={{
                                    fontSize: 12,
                                    color: 'var(--color-on-surface-variant)',
                                    marginTop: 2,
                                    letterSpacing: '0.4px',
                                }}
                            >
                                {item.sublabel}
                            </span>
                        )}
                    </button>
                </div>
            ))}
        </div>
    );
}
