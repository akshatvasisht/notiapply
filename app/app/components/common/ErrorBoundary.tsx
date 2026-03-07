'use client';

import React, { Component, type ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        logger.error('React component error caught by ErrorBoundary', 'ErrorBoundary', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
        });
    }

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100vh',
                        padding: '32px',
                        textAlign: 'center',
                        background: 'var(--color-surface)',
                    }}
                >
                    <div
                        style={{
                            maxWidth: '500px',
                            background: 'var(--color-error-container)',
                            border: '1px solid var(--color-error)',
                            borderRadius: '12px',
                            padding: '24px',
                        }}
                    >
                        <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--color-error)"
                            strokeWidth="2"
                            style={{ margin: '0 auto 16px' }}
                        >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <h2
                            style={{
                                fontSize: '18px',
                                fontWeight: 600,
                                color: 'var(--color-error)',
                                marginBottom: '12px',
                            }}
                        >
                            Something went wrong
                        </h2>
                        <p
                            style={{
                                fontSize: '14px',
                                color: 'var(--color-on-surface-secondary)',
                                marginBottom: '16px',
                                lineHeight: 1.5,
                            }}
                        >
                            The application encountered an unexpected error. Try refreshing the page or
                            contact support if the problem persists.
                        </p>
                        {this.state.error && (
                            <details
                                style={{
                                    marginTop: '16px',
                                    textAlign: 'left',
                                    fontSize: '12px',
                                }}
                            >
                                <summary
                                    style={{
                                        cursor: 'pointer',
                                        color: 'var(--color-error)',
                                        fontWeight: 500,
                                        marginBottom: '8px',
                                    }}
                                >
                                    Error details
                                </summary>
                                <pre
                                    style={{
                                        background: 'var(--color-surface)',
                                        padding: '12px',
                                        borderRadius: '6px',
                                        overflow: 'auto',
                                        color: 'var(--color-on-surface-secondary)',
                                        fontFamily: 'monospace',
                                        fontSize: '11px',
                                    }}
                                >
                                    {this.state.error.message}
                                    {'\n\n'}
                                    {this.state.error.stack}
                                </pre>
                            </details>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                marginTop: '16px',
                                padding: '10px 20px',
                                background: 'var(--color-error)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                            }}
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
