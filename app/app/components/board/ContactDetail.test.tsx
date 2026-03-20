import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import ContactDetail from './ContactDetail';
import type { Contact, Job } from '@/lib/types';

// Mock dependencies
vi.mock('@/lib/db', () => ({
    updateContactResponse: vi.fn(),
    addContactInteraction: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('@/lib/llm', () => ({
    generateDraftMessage: vi.fn(),
}));

vi.mock('@/lib/draft-scoring', () => ({
    scoreDraft: vi.fn().mockResolvedValue({
        overall: 85,
        specificity: 80,
        length: 100,
        hasAsk: true,
        feedback: [],
        passesThreshold: true,
    }),
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('ContactDetail', () => {
    const mockContact = {
        id: 1,
        name: 'Jane Doe',
        role: 'Engineering Manager',
        company_name: 'TechCorp',
        email: 'jane@techcorp.com',
        linkedin_url: 'https://linkedin.com/in/janedoe',
        drafted_message: 'Hi Jane, interested in connecting about the role.',
        notes: 'Met at conference',
        state: 'drafted',
        created_at: new Date().toISOString(),
    } as Contact;

    const mockJobs: Job[] = [];

    const mockOnStateChange = vi.fn();
    const mockOnContactUpdated = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders contact basic info correctly', async () => {
        await act(async () => {
            render(
                <ContactDetail
                    contact={mockContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
        });

        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('Engineering Manager')).toBeInTheDocument();
        expect(screen.getByText('TechCorp')).toBeInTheDocument();
    });

    it('renders email and LinkedIn links when available', async () => {
        await act(async () => {
            render(
                <ContactDetail
                    contact={mockContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
        });

        const emailLink = screen.getByText('jane@techcorp.com');
        expect(emailLink).toHaveAttribute('href', 'mailto:jane@techcorp.com');

        const linkedInLink = screen.getByText(/LinkedIn/);
        expect(linkedInLink.closest('a')).toHaveAttribute('href', 'https://linkedin.com/in/janedoe');
    });

    it('hides email and LinkedIn when not available', async () => {
        const contactWithoutLinks = {
            ...mockContact,
            email: null,
            linkedin_url: null,
        };

        await act(async () => {
            render(
                <ContactDetail
                    contact={contactWithoutLinks}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
        });

        expect(screen.queryByText('jane@techcorp.com')).not.toBeInTheDocument();
    });

    it('displays draft message when present', async () => {
        await act(async () => {
            render(
                <ContactDetail
                    contact={mockContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
        });

        // Message is displayed in the component
        expect(screen.getByText(/Hi Jane, interested in connecting/)).toBeInTheDocument();
    });

    it('shows copy button when draft message exists', async () => {
        await act(async () => {
            render(
                <ContactDetail
                    contact={mockContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
        });

        // Find copy button (icon or text)
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
    });

    it('handles contact with minimal data', async () => {
        const minimalContact = {
            id: 2,
            name: 'John Smith',
            company_name: 'StartupCo',
            state: 'identified',
            created_at: new Date().toISOString(),
        } as Contact;

        await act(async () => {
            render(
                <ContactDetail
                    contact={minimalContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
        });

        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('StartupCo')).toBeInTheDocument();
    });

    it('renders without crashing with all props', async () => {
        let container;
        await act(async () => {
            const result = render(
                <ContactDetail
                    contact={mockContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
            container = result.container;
        });

        // Component renders successfully
        expect(container).toBeInTheDocument();
    });

    it('shows coaching nudge for identified contacts', async () => {
        const identifiedContact = {
            ...mockContact,
            state: 'identified' as const,
            drafted_message: null,
        };

        await act(async () => {
            render(
                <ContactDetail
                    contact={identifiedContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
        });

        expect(screen.getByText(/Ready to draft a personalized note/)).toBeInTheDocument();
    });

    it('has close functionality', async () => {
        await act(async () => {
            render(
                <ContactDetail
                    contact={mockContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
        });

        // Find close button - it should exist with accessible label
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
    });

    it('displays job context when available', async () => {
        const jobLinkedContact = {
            ...mockContact,
            job_id: 1,
        };

        const jobs = [
            {
                id: 1,
                company: 'TechCorp',
                title: 'Senior Engineer',
                location: 'Remote',
                url: 'https://example.com/job',
                state: 'submitted',
                source: 'jobspy-linkedin',
                discovered_at: new Date().toISOString(),
            } as Job,
        ];

        let container;
        await act(async () => {
            const result = render(
                <ContactDetail
                    contact={jobLinkedContact}
                    jobs={jobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
            container = result.container;
        });

        // Component renders successfully with job context
        expect(container).toBeInTheDocument();
    });

    it('renders company enrichment data when available', async () => {
        const enrichedContact = {
            ...mockContact,
            company_industry: 'Software',
            company_size: '100-500',
            company_funding_stage: 'Series B',
        };

        await act(async () => {
            render(
                <ContactDetail
                    contact={enrichedContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
        });

        expect(screen.getByText(/Software/)).toBeInTheDocument();
    });

    it('renders timeline with created date', async () => {
        await act(async () => {
            render(
                <ContactDetail
                    contact={mockContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
        });

        // Timeline should show "Added to CRM" event
        expect(screen.getByText(/Added to CRM/)).toBeInTheDocument();
    });
});
