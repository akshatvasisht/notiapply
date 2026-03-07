'use client';

import { useState } from 'react';
import Image from 'next/image';

interface CompanyAvatarProps {
    name: string;
    logoUrl?: string | null;
    size?: number;
}

/** Company avatar with logo fallback to letter-based initials */
export default function CompanyAvatar({ name, logoUrl, size = 32 }: CompanyAvatarProps) {
    const [imageError, setImageError] = useState(false);

    // Generate color based on company name hash
    const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = hash % 360;

    if (logoUrl && !imageError) {
        return (
            <div
                style={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: `hsl(${hue}, 65%, 88%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Image
                    src={logoUrl}
                    alt={`${name} logo`}
                    width={size}
                    height={size}
                    onError={() => setImageError(true)}
                    unoptimized
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />
            </div>
        );
    }

    // Fallback: letter-based avatar
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: `hsl(${hue}, 65%, 88%)`,
                color: `hsl(${hue}, 60%, 40%)`,
                fontSize: size * 0.4,
                fontWeight: 600,
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            {name.charAt(0).toUpperCase()}
        </div>
    );
}
