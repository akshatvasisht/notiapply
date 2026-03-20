'use client';

import { useState } from 'react';
import MetricIcon from './icons/MetricIcon';

export interface MetricChipProps {
    /** Display value (e.g., "24%", "3", "2h") */
    value: string | number;
    /** Tooltip title */
    label: string;
    /** Detailed tooltip content */
    tooltip: React.ReactNode;
    /** Variant: success, warning, error, or default */
    variant?: 'success' | 'warning' | 'error' | 'default';
    /** Show alert icon (conditional - only when needed) */
    showIcon?: boolean;
    /** Click handler for modal details */
    onClick?: () => void;
}

/**
 * Compact Material 3 metric chip - tooltip-first design
 *
 * Design: Whisper-quiet, only speaks up when there's an issue
 * - 24px height (ultra-compact)
 * - Light Google-style tooltips
 * - Conditional icons (only show when alerting)
 */
export default function MetricChip({
    value,
    label,
    tooltip,
    variant = 'default',
    showIcon = false,
    onClick,
}: MetricChipProps) {
    const [hovered, setHovered] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    // Variant styling
    const variantStyles = {
        success: {
            bg: 'var(--color-success-container)',
            color: 'var(--color-success)',
        },
        warning: {
            bg: 'var(--color-warning-container)',
            color: 'var(--color-warning)',
        },
        error: {
            bg: 'var(--color-error-container)',
            color: 'var(--color-error)',
        },
        default: {
            bg: 'var(--color-surface-container-low)',
            color: 'var(--color-on-surface)',
        },
    };

    const style = variantStyles[variant];

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
                onClick={onClick}
                onMouseEnter={() => {
                    setHovered(true);
                    setShowTooltip(true);
                }}
                onMouseLeave={() => {
                    setHovered(false);
                    setShowTooltip(false);
                }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    height: 28,
                    padding: '0 12px',
                    borderRadius: 14,
                    background: hovered ? style.bg : 'var(--color-surface-container-low)',
                    border: `1px solid ${hovered ? style.color : 'var(--color-outline-variant)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: hovered ? style.color : 'var(--color-on-surface)',
                    letterSpacing: '-0.01em',
                    boxShadow: hovered ? 'var(--elevation-1)' : 'none',
                    transform: hovered ? 'translateY(-1px)' : 'none',
                }}
            >
                {/* Conditional icon - only show when there's an alert */}
                {showIcon && variant !== 'default' && (
                    <MetricIcon variant={variant} size={12} />
                )}

                {/* Value */}
                <span>{value}</span>
            </button>

            {/* Light Google-style tooltip */}
            {showTooltip && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        paddingTop: 8,
                        zIndex: 1000,
                        pointerEvents: 'none',
                    }}
                >
                    <div
                        style={{
                            background: 'var(--color-surface-container)',
                            color: 'var(--color-on-surface)',
                            border: '1px solid var(--color-outline-variant)',
                            borderRadius: 8,
                            padding: '12px 16px',
                            boxShadow: 'var(--elevation-2)',
                            fontSize: 12,
                            lineHeight: 1.6,
                            minWidth: 200,
                            maxWidth: 320,
                            whiteSpace: 'normal',
                            animation: 'fadeIn 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    >
                        {/* Tooltip title */}
                        <div
                            style={{
                                fontWeight: 600,
                                color: 'var(--color-on-surface)',
                                marginBottom: 4,
                            }}
                        >
                            {label}
                        </div>

                        {/* Tooltip content */}
                        <div
                            style={{
                                fontWeight: 400,
                                color: 'var(--color-on-surface-variant)',
                            }}
                        >
                            {tooltip}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
