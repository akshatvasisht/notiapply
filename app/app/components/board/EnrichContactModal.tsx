'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { updateContactCompanyData } from '@/lib/db';
import type { Contact } from '@/lib/types';

interface Props {
    contact: Contact;
    onClose: () => void;
    onUpdated: (contact: Contact) => void;
}

export default function EnrichContactModal({ contact, onClose, onUpdated }: Props) {
    const [industry, setIndustry] = useState(contact.company_industry || '');
    const [headcount, setHeadcount] = useState(contact.company_headcount_range || '');
    const [funding, setFunding] = useState(contact.company_funding_stage || '');
    const [notes, setNotes] = useState(contact.company_notes || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateContactCompanyData(contact.id, {
                company_industry: industry,
                company_headcount_range: headcount,
                company_funding_stage: funding,
                company_notes: notes,
            });

            onUpdated({
                ...contact,
                company_industry: industry,
                company_headcount_range: headcount,
                company_funding_stage: funding,
                company_notes: notes,
            });

            onClose();
        } catch (err) {
            toast.error('Failed to save: ' + (err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'var(--color-overlay)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                animation: 'fadeIn 0.15s ease-out',
            }}
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="enrich-modal-title"
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--color-surface)',
                    borderRadius: 12,
                    padding: 24,
                    width: '90%',
                    maxWidth: 500,
                    boxShadow: 'var(--elevation-modal)',
                    animation: 'slideUp 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                {/* Header */}
                <h2 id="enrich-modal-title" style={{
                    fontSize: 18,
                    fontWeight: 600,
                    marginBottom: 20,
                    color: 'var(--color-on-surface)',
                }}>
                    Enrich Company Data: {contact.company_name}
                </h2>

                {/* Form Fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Industry */}
                    <div>
                        <label htmlFor="contact-industry" style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--color-text-secondary)',
                            display: 'block',
                            marginBottom: 6,
                        }}>
                            Industry
                        </label>
                        <select
                            id="contact-industry"
                            className="enrich-field"
                            value={industry}
                            onChange={(e) => setIndustry(e.target.value)}
                            disabled={saving}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface)',
                                fontSize: 14,
                                color: 'var(--color-text-primary)',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                opacity: saving ? 0.5 : 1,
                                transition: 'border-color 0.15s ease',
                            }}
                        >
                            <option value="">Select...</option>
                            <option value="Software/SaaS">Software/SaaS</option>
                            <option value="AI/ML">AI/ML</option>
                            <option value="Fintech">Fintech</option>
                            <option value="E-commerce">E-commerce</option>
                            <option value="Healthcare">Healthcare</option>
                            <option value="Education">Education</option>
                            <option value="Consumer">Consumer</option>
                            <option value="Enterprise">Enterprise</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    {/* Company Size */}
                    <div>
                        <label htmlFor="contact-company-size" style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--color-text-secondary)',
                            display: 'block',
                            marginBottom: 6,
                        }}>
                            Company Size
                        </label>
                        <select
                            id="contact-company-size"
                            className="enrich-field"
                            value={headcount}
                            onChange={(e) => setHeadcount(e.target.value)}
                            disabled={saving}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface)',
                                fontSize: 14,
                                color: 'var(--color-text-primary)',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                opacity: saving ? 0.5 : 1,
                                transition: 'border-color 0.15s ease',
                            }}
                        >
                            <option value="">Select...</option>
                            <option value="1-10">1-10 employees</option>
                            <option value="11-50">11-50 employees</option>
                            <option value="51-200">51-200 employees</option>
                            <option value="201-500">201-500 employees</option>
                            <option value="501-1000">501-1000 employees</option>
                            <option value="1000+">1000+ employees</option>
                        </select>
                    </div>

                    {/* Funding Stage */}
                    <div>
                        <label htmlFor="contact-funding-stage" style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--color-text-secondary)',
                            display: 'block',
                            marginBottom: 6,
                        }}>
                            Funding Stage
                        </label>
                        <select
                            id="contact-funding-stage"
                            className="enrich-field"
                            value={funding}
                            onChange={(e) => setFunding(e.target.value)}
                            disabled={saving}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface)',
                                fontSize: 14,
                                color: 'var(--color-text-primary)',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                opacity: saving ? 0.5 : 1,
                                transition: 'border-color 0.15s ease',
                            }}
                        >
                            <option value="">Select...</option>
                            <option value="Pre-seed">Pre-seed</option>
                            <option value="Seed">Seed</option>
                            <option value="Series A">Series A</option>
                            <option value="Series B">Series B</option>
                            <option value="Series C+">Series C+</option>
                            <option value="Public">Public</option>
                            <option value="Bootstrapped">Bootstrapped</option>
                        </select>
                    </div>

                    {/* Notes */}
                    <div>
                        <label htmlFor="contact-notes" style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--color-text-secondary)',
                            display: 'block',
                            marginBottom: 6,
                        }}>
                            Notes (optional)
                        </label>
                        <textarea
                            id="contact-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Recent news, product launches, hiring sprees..."
                            rows={3}
                            disabled={saving}
                            className="enrich-field"
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface)',
                                fontSize: 14,
                                color: 'var(--color-text-primary)',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                lineHeight: 1.5,
                                cursor: saving ? 'not-allowed' : 'text',
                                opacity: saving ? 0.5 : 1,
                                transition: 'border-color 0.15s ease',
                            }}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 24,
                }}>
                    <button
                        className="enrich-cancel-btn"
                        onClick={onClose}
                        disabled={saving}
                        style={{
                            flex: 1,
                            padding: '10px 16px',
                            borderRadius: 6,
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'var(--color-text-secondary)',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.5 : 1,
                            transition: 'all 0.15s ease',
                        }}
                    >
                        Cancel
                    </button>

                    <button
                        className="enrich-save-btn"
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            flex: 1,
                            padding: '10px 16px',
                            borderRadius: 6,
                            border: 'none',
                            background: 'var(--color-success)',
                            color: 'var(--color-on-success)',
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.6 : 1,
                            transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s, filter 0.15s',
                        }}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
