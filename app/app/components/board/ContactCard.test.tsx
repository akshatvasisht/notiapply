import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { getUrgencyTier } from '@/lib/types';
import ContactCard from '@/app/components/board/ContactCard';
import ContactReminders from '@/app/components/board/ContactReminders';
import { makeContact, daysAgo, daysFromNow } from '@/lib/test-fixtures';

// ContactCard has no direct @/lib/db imports; vitest.setup.ts globally mocks db.
// next/image is mocked globally in vitest.setup.ts

// ─── Block 1: getUrgencyTier() pure logic ────────────────────────────────────

describe('getUrgencyTier()', () => {
    it('returns none when follow_up_date is null', () => {
        expect(getUrgencyTier(makeContact({ follow_up_date: null, state: 'contacted' }))).toBe('none');
    });

    it('returns none when state is identified even with a past follow_up_date', () => {
        expect(getUrgencyTier(makeContact({ follow_up_date: daysAgo(3), state: 'identified' }))).toBe('none');
    });

    it('returns none when state is drafted with a past follow_up_date', () => {
        expect(getUrgencyTier(makeContact({ follow_up_date: daysAgo(3), state: 'drafted' }))).toBe('none');
    });

    it('returns critical when got_response true, follow_up_date yesterday, state replied', () => {
        expect(
            getUrgencyTier(
                makeContact({ got_response: true, follow_up_date: daysAgo(1), state: 'replied' })
            )
        ).toBe('critical');
    });

    it('returns overdue when follow_up_date is 5 days ago, state contacted, got_response null', () => {
        expect(
            getUrgencyTier(
                makeContact({ follow_up_date: daysAgo(5), state: 'contacted', got_response: null })
            )
        ).toBe('overdue');
    });

    it('returns upcoming when follow_up_date is 2 days from now, state contacted', () => {
        expect(
            getUrgencyTier(makeContact({ follow_up_date: daysFromNow(2), state: 'contacted' }))
        ).toBe('upcoming');
    });

    it('returns none when follow_up_date is 10 days from now, state contacted', () => {
        expect(
            getUrgencyTier(makeContact({ follow_up_date: daysFromNow(10), state: 'contacted' }))
        ).toBe('none');
    });
});

// ─── Block 2: ContactCard rendering ─────────────────────────────────────────

describe('ContactCard rendering', () => {
    const noop = () => {};

    it('shows no urgency badge when tier is none', async () => {
        const contact = makeContact({ state: 'identified', follow_up_date: null });
        await act(async () => {
            render(<ContactCard contact={contact} onClick={noop} />);
        });
        expect(screen.queryByText('Response pending')).not.toBeInTheDocument();
        expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Due in/)).not.toBeInTheDocument();
    });

    it('shows "Response pending" badge for critical tier', async () => {
        const contact = makeContact({
            got_response: true,
            state: 'replied',
            follow_up_date: daysAgo(1),
        });
        await act(async () => {
            render(<ContactCard contact={contact} onClick={noop} />);
        });
        expect(screen.getByText('Response pending')).toBeInTheDocument();
    });

    it('shows "Overdue Nd" badge for overdue tier', async () => {
        const contact = makeContact({
            state: 'contacted',
            follow_up_date: daysAgo(5),
            got_response: null,
        });
        await act(async () => {
            render(<ContactCard contact={contact} onClick={noop} />);
        });
        expect(screen.getByText(/Overdue \d+d/)).toBeInTheDocument();
    });

    it('shows "Due in Nd" badge for upcoming tier', async () => {
        const contact = makeContact({
            state: 'contacted',
            follow_up_date: daysFromNow(2),
        });
        await act(async () => {
            render(<ContactCard contact={contact} onClick={noop} />);
        });
        expect(screen.getByText(/Due in \d+d/)).toBeInTheDocument();
    });
});

// ─── Block 3: ContactReminders rendering ─────────────────────────────────────

describe('ContactReminders rendering', () => {
    const noop = () => {};

    it('renders nothing when no actionable contacts exist', async () => {
        const contacts = [
            makeContact({ follow_up_date: null, state: 'contacted' }),
            makeContact({ follow_up_date: null, state: 'replied' }),
        ];
        let container!: HTMLElement;
        await act(async () => {
            ({ container } = render(
                <ContactReminders contacts={contacts} onFilterOverdue={noop} />
            ));
        });
        // Component returns null when count === 0 — container should be empty
        expect(container.firstChild).toBeNull();
    });

    it('shows critical and overdue counts when both present', async () => {
        const criticalContacts = [
            makeContact({ got_response: true, state: 'replied', follow_up_date: daysAgo(1) }),
            makeContact({ got_response: true, state: 'replied', follow_up_date: daysAgo(2) }),
        ];
        const overdueContacts = [
            makeContact({ state: 'contacted', follow_up_date: daysAgo(5) }),
            makeContact({ state: 'contacted', follow_up_date: daysAgo(6) }),
            makeContact({ state: 'contacted', follow_up_date: daysAgo(7) }),
        ];
        const contacts = [...criticalContacts, ...overdueContacts];

        await act(async () => {
            render(<ContactReminders contacts={contacts} onFilterOverdue={noop} />);
        });

        // Component renders a <p> with text "2 critical · 3 overdue"
        expect(screen.getByText(/2 critical/)).toBeInTheDocument();
        expect(screen.getByText(/3 overdue/)).toBeInTheDocument();
    });

    it('uses warning styling (not error) when there are only overdue contacts', async () => {
        const overdueContacts = [
            makeContact({ state: 'contacted', follow_up_date: daysAgo(5) }),
            makeContact({ state: 'contacted', follow_up_date: daysAgo(6) }),
            makeContact({ state: 'contacted', follow_up_date: daysAgo(7) }),
        ];

        await act(async () => {
            render(
                <ContactReminders contacts={overdueContacts} onFilterOverdue={noop} />
            );
        });

        // The heading is always present when banner is visible
        const heading = screen.getByText('Follow-up Reminders');
        expect(heading).toBeInTheDocument();

        // When no critical contacts, heading color should reference warning, not error
        expect(heading).toHaveStyle({ color: 'var(--color-warning)' });

        // Overdue-only description branch: "N contacts need follow-up today"
        expect(screen.getByText(/contacts need follow-up today/)).toBeInTheDocument();
    });
});
