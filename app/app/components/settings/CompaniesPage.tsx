'use client';

import { useEffect, useState } from 'react';
import { getScrapedCompanies, addScrapedCompany, removeScrapedCompany } from '@/lib/db';
import type { ScrapedCompany } from '@/lib/types';
import { MOCK_COMPANIES } from '@/lib/mock-data';
import { logger } from '@/lib/logger';

export default function CompaniesPage({ onBack }: { onBack: () => void }) {
    const [companies, setCompanies] = useState<ScrapedCompany[]>([]);

    const [name, setName] = useState('');
    const [platform, setPlatform] = useState<'greenhouse' | 'lever' | 'ashby'>('greenhouse');
    const [slug, setSlug] = useState('');

    useEffect(() => {
        getScrapedCompanies().then(setCompanies).catch((err) => {
            logger.warn('DB unavailable, using mock companies', 'CompaniesPage', err);
            setCompanies(MOCK_COMPANIES);
        });
    }, []);

    const handleAdd = async () => {
        if (!name || !slug) return;
        await addScrapedCompany({ name, ats_platform: platform, ats_slug: slug });
        setCompanies(await getScrapedCompanies());
        setName('');
        setSlug('');
    };

    const handleRemove = async (id: number) => {
        await removeScrapedCompany(id);
        setCompanies(cs => cs.filter(c => c.id !== id));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                height: 44, padding: '0 16px',
                background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
            }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-text-secondary)' }}>
                    ‹ Back
                </button>
                <span style={{ fontSize: 15, fontWeight: 500 }}>ATS Watchlist</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 700, margin: '0 auto', width: '100%' }}>
                {/* Add form */}
                <div style={{
                    display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap',
                    padding: 16, borderRadius: 8, border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-raised)',
                }}>
                    <input
                        value={name} onChange={e => setName(e.target.value)} placeholder="Company name"
                        style={{ flex: '1 1 140px', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', outline: 'none' }}
                    />
                    <select
                        value={platform} onChange={e => setPlatform(e.target.value as typeof platform)}
                        style={{ padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', outline: 'none' }}
                    >
                        <option value="greenhouse">Greenhouse</option>
                        <option value="lever">Lever</option>
                        <option value="ashby">Ashby</option>
                    </select>
                    <input
                        value={slug} onChange={e => setSlug(e.target.value)} placeholder="Board slug"
                        style={{ flex: '1 1 140px', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', outline: 'none' }}
                    />
                    <button
                        onClick={handleAdd} disabled={!name || !slug}
                        style={{
                            padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                            background: name && slug ? 'var(--color-primary)' : 'var(--color-border)',
                            color: name && slug ? 'var(--color-text-inverse)' : 'var(--color-text-disabled)',
                            border: 'none', cursor: name && slug ? 'pointer' : 'not-allowed',
                        }}
                    >
                        Add
                    </button>
                </div>

                {/* Help text */}
                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
                    Add companies you wish to monitor directly via their ATS API. The &ldquo;slug&rdquo; is the identifier in their job board URL —
                    e.g. for <code>boards.greenhouse.io/example</code>, the slug is <code>example</code>.
                </p>

                {/* Table */}
                {companies.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-disabled)' }}>
                        No companies in your watchlist yet. Add one above.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                {['Company', 'Platform', 'Slug', 'Added', ''].map(h => (
                                    <th key={h} style={{
                                        textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600,
                                        textTransform: 'uppercase', letterSpacing: '0.04em',
                                        color: 'var(--color-text-tertiary)',
                                    }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {companies.map(c => (
                                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>{c.name}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{
                                            fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                                            background: 'var(--color-success-container)', color: 'var(--color-success)',
                                        }}>
                                            {c.ats_platform}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                        <code style={{ fontSize: 12, background: 'var(--color-surface-raised)', padding: '1px 4px', borderRadius: 3 }}>{c.ats_slug}</code>
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--color-text-disabled)' }}>
                                        {new Date(c.added_at).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => handleRemove(c.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--color-error)', padding: '2px 6px' }}
                                            aria-label={`Remove ${c.name}`}
                                        >
                                            ×
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
