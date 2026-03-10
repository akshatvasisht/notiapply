interface MetricIconProps {
    variant: 'success' | 'warning' | 'error' | 'info';
    size?: number;
}

export default function MetricIcon({ variant, size = 12 }: MetricIconProps) {
    const colors = {
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-primary)',
    };

    const color = colors[variant];

    if (variant === 'success') {
        return (
            <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" fill={color} opacity="0.12" />
                <path
                    d="M11.5 5.5L6.5 10.5L4.5 8.5"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }

    if (variant === 'warning') {
        return (
            <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
                <path
                    d="M8 1.5L14.5 13H1.5L8 1.5Z"
                    fill={color}
                    opacity="0.12"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                />
                <path
                    d="M8 6V9"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
                <circle cx="8" cy="11" r="0.5" fill={color} />
            </svg>
        );
    }

    if (variant === 'error') {
        return (
            <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" fill={color} opacity="0.12" />
                <path
                    d="M10.5 5.5L5.5 10.5M5.5 5.5L10.5 10.5"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
            </svg>
        );
    }

    // info variant
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" fill={color} opacity="0.12" />
            <path
                d="M8 11V7.5"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <circle cx="8" cy="5" r="0.5" fill={color} />
        </svg>
    );
}
