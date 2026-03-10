'use client';

import type { Contact } from '@/lib/types';
import Modal from '../common/Modal';

interface Props {
    contact: Contact;
    onClose: () => void;
    onStateChange: (id: number, state: string) => void;
}

export default function ContactDetail({ contact, onClose, onStateChange }: Props) {
    const handleCopy = () => {
        if (contact.drafted_message) {
            navigator.clipboard.writeText(contact.drafted_message);
        }
    };

    return (
        <Modal onClose={onClose}>
            <div style={{ padding: 24, maxWidth: 600, width: '100%' }}>
                <h2 style={{ margin: '0 0 8px', fontSize: 24 }}>{contact.name}</h2>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: 16 }}>
                    {contact.role} at <strong>{contact.company_name}</strong>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                    {contact.linkedin_url && (
                        <a href={contact.linkedin_url} target="_blank" rel="noreferrer"
                            style={{ color: 'var(--color-brand)', textDecoration: 'none' }}>
                            View LinkedIn
                        </a>
                    )}
                    {contact.email && (
                        <a href={`mailto:${contact.email}`}
                            style={{ color: 'var(--color-text-primary)', textDecoration: 'none' }}>
                            {contact.email}
                        </a>
                    )}
                </div>

                {contact.drafted_message && (
                    <div style={{ marginTop: 32 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Drafted Message</div>
                        <div style={{
                            padding: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                            borderRadius: 8, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.5
                        }}>
                            {contact.drafted_message}
                        </div>
                        <button
                            onClick={handleCopy}
                            style={{
                                marginTop: 12, padding: '8px 16px', background: 'var(--color-surface-raised)',
                                border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer',
                                color: 'var(--color-text-primary)'
                            }}
                        >
                            Copy to Clipboard
                        </button>
                    </div>
                )}

                <div style={{ marginTop: 40, borderTop: '1px solid var(--color-border)', paddingTop: 24 }}>
                    <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Update Status</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['identified', 'drafted', 'contacted', 'replied', 'interviewing', 'rejected'].map(state => (
                            <button
                                key={state}
                                onClick={() => { onStateChange(contact.id, state); onClose(); }}
                                style={{
                                    padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
                                    background: contact.state === state ? 'var(--color-brand)' : 'var(--color-surface)',
                                    color: contact.state === state ? 'white' : 'var(--color-text-primary)',
                                    border: contact.state === state ? 'none' : '1px solid var(--color-border)',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {state}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
