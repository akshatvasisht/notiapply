import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import ContactDetail from './ContactDetail';
import type { Job } from '@/lib/types';
import { makeContact } from '@/lib/test-fixtures';

// Mock dependencies — sonner and @/lib/logger are mocked globally in vitest.setup.ts
vi.mock('@/lib/db', () => ({
    hasDatabase: vi.fn().mockReturnValue(true),
    updateContactResponse: vi.fn(),
    addContactInteraction: vi.fn(),
    updateContactNotes: vi.fn().mockResolvedValue(undefined),
    requestContactReenrichment: vi.fn().mockResolvedValue(undefined),
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

describe('ContactDetail', () => {
    const mockContact = makeContact({
        name: 'Jane Doe',
        role: 'Engineering Manager',
        company_name: 'TechCorp',
        email: 'jane@techcorp.com',
        linkedin_url: 'https://linkedin.com/in/janedoe',
        drafted_message: 'Hi Jane, interested in connecting about the role.',
        notes: 'Met at conference',
        state: 'drafted',
    });

    const mockJobs: Job[] = [];

    const mockOnStateChange = vi.fn();
    const mockOnContactUpdated = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Stub clipboard so handleCopy doesn't throw in jsdom
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
            configurable: true,
        });
    });

    // ── Render-presence smoke tests ──────────────────────────────────────────

    it('renders contact basic info — name, role, and company are visible', async () => {
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

    it('shows contact name and company when all optional enrichment fields are null', async () => {
        const minimalContact = makeContact({
            id: 2,
            name: 'John Smith',
            company_name: 'StartupCo',
            state: 'identified',
        });

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

    it('smoke test — mounts without crashing and renders "Added to CRM" timeline event', async () => {
        let container: HTMLElement;
        await act(async () => {
            ({ container } = render(
                <ContactDetail
                    contact={mockContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            ));
        });

        expect(container!).toBeInTheDocument();
        expect(screen.getByText(/Added to CRM/)).toBeInTheDocument();
    });

    // ── Email & LinkedIn link tests ──────────────────────────────────────────

    it('renders email as mailto link and LinkedIn as external link when both present', async () => {
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

    it('hides email and LinkedIn links when both are null', async () => {
        const contactWithoutLinks = makeContact({
            ...mockContact,
            email: null,
            linkedin_url: null,
        });

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
        expect(screen.queryByText(/View LinkedIn/)).not.toBeInTheDocument();
    });

    // ── Copy button behavioral test ──────────────────────────────────────────

    it('clicking the Copy button calls navigator.clipboard.writeText with the draft message', async () => {
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

        // There may be multiple "Copy"-labelled buttons (e.g. "Accept & Copy");
        // target the standalone copy icon button by finding the one that is NOT "Accept & Copy".
        const copyButtons = screen.getAllByRole('button', { name: /Copy/i });
        const copyButton = copyButtons.find(btn => btn.textContent?.trim() !== 'Accept & Copy') ?? copyButtons[0];
        fireEvent.click(copyButton);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
            'Hi Jane, interested in connecting about the role.'
        );
    });

    // ── Back button closes the panel ─────────────────────────────────────────

    it('clicking the Back button calls onClose', async () => {
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

        const backButton = screen.getByRole('button', { name: /Back/i });
        fireEvent.click(backButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    // ── Coaching nudge visibility ────────────────────────────────────────────

    it('no coaching nudge for identified state (only actionable states get nudges)', async () => {
        const identifiedContact = makeContact({
            name: 'Jane Doe',
            company_name: 'TechCorp',
            state: 'identified',
            drafted_message: null,
        });

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

        expect(screen.queryByText(/Ready to draft a personalized note/)).not.toBeInTheDocument();
    });

    // ── Enrichment section visibility ────────────────────────────────────────

    it('enrichment chips appear when company_funding_stage, company_headcount_range, or company_industry are set', async () => {
        const enrichedContact = makeContact({
            name: 'Jane Doe',
            company_name: 'TechCorp',
            state: 'identified',
            company_industry: 'Artificial Intelligence',
            company_funding_stage: 'Series C',
            company_headcount_range: '501–1,000 employees',
        });

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

        expect(screen.getByText('Artificial Intelligence')).toBeInTheDocument();
        expect(screen.getByText('Series C')).toBeInTheDocument();
        expect(screen.getByText('501–1,000 employees')).toBeInTheDocument();
    });

    it('enrichment chip section is absent when all enrichment fields are null', async () => {
        const bareContact = makeContact({
            name: 'Jane Doe',
            company_name: 'TechCorp',
            state: 'identified',
            company_industry: null,
            company_funding_stage: null,
            company_headcount_range: null,
        });

        await act(async () => {
            render(
                <ContactDetail
                    contact={bareContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
        });

        expect(screen.queryByText('Series C')).not.toBeInTheDocument();
        expect(screen.queryByText('501–1,000 employees')).not.toBeInTheDocument();
    });

    // ── Draft message section visibility ─────────────────────────────────────

    it('draft message section is shown when drafted_message is set and state is "drafted"', async () => {
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

        expect(screen.getByText(/Hi Jane, interested in connecting/)).toBeInTheDocument();
    });

    it('draft message textarea section is absent when drafted_message is null', async () => {
        const noDraftContact = makeContact({
            name: 'Jane Doe',
            company_name: 'TechCorp',
            state: 'identified',
            drafted_message: null,
        });

        await act(async () => {
            render(
                <ContactDetail
                    contact={noDraftContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
        });

        // Draft letterhead "Draft → Name" text only appears when drafted_message is rendered
        expect(screen.queryByText(/Draft →/)).not.toBeInTheDocument();
        // Copy button only exists in the draft envelope panel
        expect(screen.queryByRole('button', { name: /^Copy$/i })).not.toBeInTheDocument();
    });

    // ── Enrichment card + Refresh button (C-01) ───────────────────────────────

    it('hides the Refresh button when enrichment_status is not "completed"', async () => {
        const pendingContact = makeContact({
            name: 'No Enrichment',
            company_name: 'Acme',
            enrichment_status: 'pending',
            enrichment: null,
        });
        await act(async () => {
            render(
                <ContactDetail
                    contact={pendingContact}
                    jobs={mockJobs}
                    onClose={mockOnClose}
                    onStateChange={mockOnStateChange}
                    onContactUpdated={mockOnContactUpdated}
                />
            );
        });
        expect(screen.queryByRole('button', { name: /Refresh/i })).not.toBeInTheDocument();
    });

    it('renders the Refresh button when enrichment_status is "completed"', async () => {
        const enrichedContact = makeContact({
            name: 'Has Enrichment',
            company_name: 'Acme',
            enrichment_status: 'completed',
            enriched_at: new Date().toISOString(),
            enrichment: {
                schema_version: 1,
                summary: 'Backend engineer.',
                topics: ['databases'],
                tech_stack: ['Go'],
                recent_themes: [],
            },
        });
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
        expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
        // Enrichment summary + chips should also render.
        expect(screen.getByText('Backend engineer.')).toBeInTheDocument();
        expect(screen.getByText('databases')).toBeInTheDocument();
        expect(screen.getByText('Go')).toBeInTheDocument();
    });

    it('calls requestContactReenrichment and patches onContactUpdated when Refresh clicked', async () => {
        const { requestContactReenrichment } = await import('@/lib/db');
        const enrichedContact = makeContact({
            id: 77,
            name: 'Target',
            company_name: 'Acme',
            enrichment_status: 'completed',
            enriched_at: new Date().toISOString(),
            enrichment: {
                schema_version: 1,
                summary: 's', topics: [], tech_stack: [], recent_themes: [],
            },
        });
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
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
        });
        expect(requestContactReenrichment).toHaveBeenCalledWith(77);
        expect(mockOnContactUpdated).toHaveBeenCalledWith(
            expect.objectContaining({ id: 77, enrichment_status: 'pending' })
        );
    });
});
