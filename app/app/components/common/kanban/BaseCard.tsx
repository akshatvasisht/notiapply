'use client';

import { useState } from 'react';
import React from 'react';

interface BaseCardProps {
    children: React.ReactNode;
    selected?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    borderColor?: string;
    padding?: string | number;
    draggable?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: (e: React.DragEvent) => void;
    role?: string;
    tabIndex?: number;
    'aria-grabbed'?: boolean;
    'aria-roledescription'?: string;
}

export default function BaseCard({
    children,
    selected = false,
    onClick,
    onKeyDown,
    borderColor = 'var(--color-outline-variant)',
    padding,
    draggable,
    onDragStart,
    onDragEnd,
    role,
    tabIndex,
    'aria-grabbed': ariaGrabbed,
    'aria-roledescription': ariaRoledescription,
}: BaseCardProps) {
    const [isDragging, setIsDragging] = useState(false);

    return (
        <div
            className="card-fade-in base-card"
            onClick={onClick}
            onKeyDown={onKeyDown}
            draggable={draggable}
            onDragStart={(e) => { setIsDragging(true); onDragStart?.(e); }}
            onDragEnd={(e) => { setIsDragging(false); onDragEnd?.(e); }}
            data-dragging={isDragging || undefined}
            role={role}
            tabIndex={tabIndex}
            aria-grabbed={ariaGrabbed}
            aria-roledescription={ariaRoledescription}
            style={{
                background: selected ? 'var(--color-primary-container)' : 'var(--color-surface-container)',
                borderTop: selected ? '2px solid var(--color-primary)' : 'none',
                borderRight: selected ? '2px solid var(--color-primary)' : 'none',
                borderBottom: selected ? '2px solid var(--color-primary)' : 'none',
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: 12,
                padding: padding ?? '10px 12px',
                cursor: draggable ? 'grab' : 'pointer',
                userSelect: draggable ? 'none' : undefined,
                WebkitUserSelect: draggable ? 'none' : undefined,
                boxShadow: 'var(--elevation-1)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minWidth: 0,
            }}
        >
            {children}
        </div>
    );
}
