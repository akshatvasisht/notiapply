import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { getUrgencyTier } from '@/lib/types';
import ContactCard from '@/app/components/board/ContactCard';
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

