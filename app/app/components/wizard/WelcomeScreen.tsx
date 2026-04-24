'use client';

import { useState } from 'react';
import Logo from '../common/Logo';

interface WelcomeScreenProps {
    onContinue: () => void;
}

/**
 * Brutally minimal welcome screen
 *
 * Design philosophy: Precision over decoration. Every pixel earns its place.
 * Uses surgical spacing, restrained typography, and a single focal interaction.
 */
export default function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
    const [isExiting, setIsExiting] = useState(false);

    const handleContinue = () => {
        setIsExiting(true);
        setTimeout(onContinue, 400);
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: 'var(--color-surface)',
                padding: '40px 24px',
                opacity: isExiting ? 0 : 1,
                transform: isExiting ? 'scale(0.96)' : 'scale(1)',
                transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            {/* Logo with entrance animation */}
            <div
                style={{
                    marginBottom: 48,
                    animation: 'fadeUp 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                <Logo size={64} />
            </div>

            {/* Wordmark */}
            <h1
                style={{
                    fontSize: 28,
                    fontWeight: 500,
                    color: 'var(--color-on-surface)',
                    letterSpacing: '-0.02em',
                    marginBottom: 16,
                    textAlign: 'center',
                    animation: 'fadeUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.1s backwards',
                }}
            >
                Notiapply
            </h1>

            {/* Tagline */}
            <p
                style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: 'var(--color-on-surface-variant)',
                    letterSpacing: '0.01em',
                    marginBottom: 12,
                    textAlign: 'center',
                    animation: 'fadeUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s backwards',
                }}
            >
                Autonomous Job Application Pipeline
            </p>

            {/* Description */}
            <p
                style={{
                    fontSize: 14,
                    fontWeight: 400,
                    color: 'var(--color-on-surface-secondary)',
                    lineHeight: 1.6,
                    maxWidth: 460,
                    textAlign: 'center',
                    marginBottom: 56,
                    animation: 'fadeUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.3s backwards',
                }}
            >
                Self-hosted automation that replaces manual job board parsing with deterministic browser execution.
            </p>

            {/* CTA Button */}
            <button
                className="welcome-cta-btn"
                onClick={handleContinue}
                style={{
                    padding: '14px 32px',
                    fontSize: 14,
                    fontWeight: 500,
                    letterSpacing: '0.5px',
                    color: 'var(--color-on-primary)',
                    background: 'var(--color-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-pill)',
                    cursor: 'pointer',
                    boxShadow: 'var(--elevation-1)',
                    animation: 'fadeUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.4s backwards',
                }}
            >
                Get Started
            </button>

            <style jsx>{`
                @keyframes fadeUp {
                    from {
                        opacity: 0;
                        transform: translateY(12px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}
