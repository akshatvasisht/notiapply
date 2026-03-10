'use client';

import { useState } from 'react';

interface BaseCardProps {
    children: React.ReactNode;
    selected?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    borderColor?: string;
    padding?: string | number;
}

export default function BaseCard({
    children,
    selected = false,
    onClick,
    borderColor = 'var(--color-outline-variant)',
    padding
}: BaseCardProps) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: selected ? 'var(--color-primary-container)' : 'var(--color-surface-container)',
                border: selected ? '2px solid var(--color-primary)' : 'none',
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: 16,
                padding: padding ?? (selected ? '12px 14px' : '14px 16px'),
                cursor: 'pointer',
                boxShadow: isHovered ? 'var(--elevation-2)' : 'var(--elevation-1)',
                transform: isHovered ? 'translateY(-2px)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: 'fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minWidth: 0, // Ensure it doesn't overflow
            }}
        >
            {children}
        </div>
    );
}
