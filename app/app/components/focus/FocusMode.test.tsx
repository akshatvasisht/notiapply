import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FocusMode from './FocusMode';
import type { Job } from '@/lib/types';
import { makeJob, makeApplication } from '@/lib/test-fixtures';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
    hasDatabase: vi.fn().mockReturnValue(true),
    getApplicationByJobId: vi.fn(),
    updateJobState: vi.fn().mockResolvedValue(undefined),
    getJobById: vi.fn(),
    updateJobCallback: vi.fn().mockResolvedValue(undefined),
    updateApplicationDraftAnswers: vi.fn().mockResolvedValue(undefined),
    getUserConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock('marked', () => ({
    marked: {
        parse: (s: string) => s,
        setOptions: vi.fn(),
    },
}));

vi.mock('dompurify', () => ({
    default: { sanitize: (s: string) => s },
}));

// sonner and @/lib/logger are globally mocked in vitest.setup.ts

// ─── Import mocked functions for assertion ───────────────────────────────────

import {
    getApplicationByJobId,
    updateJobCallback,
    updateApplicationDraftAnswers,
    getJobById,
} from '@/lib/db';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const noop = () => {};

// ─── StateActions tests (via FocusMode) ──────────────────────────────────────

describe('FocusMode — StateActions buttons', () => {
    beforeEach(() => {
        vi.mocked(getApplicationByJobId).mockResolvedValue(null);
    });

    it('shows "Archive" button for discovered state', async () => {
        const job = makeJob({ state: 'discovered' });
        await act(async () => {
            render(<FocusMode job={job} onBack={noop} />);
        });
        expect(screen.getByText('Archive')).toBeInTheDocument();
    });

    it('shows "Mark Submitted" and "Reject" buttons for review-ready state', async () => {
        const job = makeJob({ state: 'review-ready' });
        await act(async () => {
            render(<FocusMode job={job} onBack={noop} />);
        });
        expect(screen.getByText('Mark Submitted')).toBeInTheDocument();
        expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    it('shows "Track" and "Rejected" buttons for submitted state', async () => {
        const job = makeJob({ state: 'submitted', got_callback: null });
        await act(async () => {
            render(<FocusMode job={job} onBack={noop} />);
        });
        expect(screen.getByText('Track')).toBeInTheDocument();
        expect(screen.getByText('Rejected')).toBeInTheDocument();
    });

    it('shows "Re-queue" and "Archive" buttons for fill-failed state', async () => {
        const job = makeJob({ state: 'fill-failed' });
        await act(async () => {
            render(<FocusMode job={job} onBack={noop} />);
        });
        expect(screen.getByText('Re-queue')).toBeInTheDocument();
        expect(screen.getByText('Archive')).toBeInTheDocument();
    });
});

// ─── Draft Answers panel ──────────────────────────────────────────────────────

describe('FocusMode — draft answers panel', () => {
    beforeEach(() => {
        vi.mocked(getApplicationByJobId).mockResolvedValue(null);
    });

    it('does not show "Draft Answers" heading when getApplicationByJobId returns null', async () => {
        const job = makeJob();
        await act(async () => {
            render(<FocusMode job={job} onBack={noop} />);
        });
        expect(screen.queryByText('Draft Answers')).not.toBeInTheDocument();
    });

    it('does not show "Draft Answers" heading when application has draft_answers: null', async () => {
        vi.mocked(getApplicationByJobId).mockResolvedValue(makeApplication({ draft_answers: null }));
        const job = makeJob();
        await act(async () => {
            render(<FocusMode job={job} onBack={noop} />);
        });
        expect(screen.queryByText('Draft Answers')).not.toBeInTheDocument();
    });

    it('shows "Draft Answers" heading and textarea when application has draft_answers', async () => {
        vi.mocked(getApplicationByJobId).mockResolvedValue(
            makeApplication({
                draft_answers: [{ question: 'Why us?', answer: 'Because...' }],
            })
        );
        const job = makeJob();
        await act(async () => {
            render(<FocusMode job={job} onBack={noop} />);
        });
        expect(screen.getByText('Draft Answers')).toBeInTheDocument();
        const textarea = screen.getByDisplayValue('Because...');
        expect(textarea).toBeInTheDocument();
    });

    it('editing a textarea and clicking "Save answers" calls updateApplicationDraftAnswers', async () => {
        const app = makeApplication({
            id: 42,
            draft_answers: [{ question: 'Why us?', answer: 'Because...' }],
        });
        vi.mocked(getApplicationByJobId).mockResolvedValue(app);
        const job = makeJob();

        await act(async () => {
            render(<FocusMode job={job} onBack={noop} />);
        });

        const textarea = screen.getByDisplayValue('Because...');
        fireEvent.change(textarea, { target: { value: 'Updated answer' } });

        const saveBtn = screen.getByText('Save answers');
        await act(async () => {
            fireEvent.click(saveBtn);
        });

        expect(vi.mocked(updateApplicationDraftAnswers)).toHaveBeenCalledWith(
            42,
            [{ question: 'Why us?', answer: 'Updated answer' }]
        );
    });
});

// ─── Callback tracking ────────────────────────────────────────────────────────

describe('FocusMode — callback tracking', () => {
    beforeEach(() => {
        vi.mocked(getApplicationByJobId).mockResolvedValue(null);
        vi.mocked(getJobById).mockResolvedValue(null);
    });

    it('shows "Did you get a callback?" when state is submitted and got_callback is null', async () => {
        const job = makeJob({ state: 'submitted', got_callback: null });
        await act(async () => {
            render(<FocusMode job={job} onBack={noop} />);
        });
        expect(screen.getByText('Response?')).toBeInTheDocument();
        expect(screen.getByText('✓ Got Callback')).toBeInTheDocument();
        expect(screen.getByText('No Callback')).toBeInTheDocument();
    });

    it('"No Callback" button calls updateJobCallback(id, false, ...)', async () => {
        const job = makeJob({ id: 1, state: 'submitted', got_callback: null });
        // After clicking No Callback, refreshJobData calls getJobById — return same job so no crash
        vi.mocked(getJobById).mockResolvedValue({ ...job, got_callback: false });

        await act(async () => {
            render(<FocusMode job={job} onBack={noop} />);
        });

        const noCallbackBtn = screen.getByText('No Callback');
        await act(async () => {
            fireEvent.click(noCallbackBtn);
        });

        expect(vi.mocked(updateJobCallback)).toHaveBeenCalledWith(
            1,
            false,
            'No callback received'
        );
    });

    it('shows "Received callback" text when got_callback is true', async () => {
        const job = makeJob({ state: 'submitted', got_callback: true, callback_notes: null });
        await act(async () => {
            render(<FocusMode job={job} onBack={noop} />);
        });
        expect(screen.getByText('Received callback')).toBeInTheDocument();
    });
});

// ─── Notes toggle ─────────────────────────────────────────────────────────────

describe('FocusMode — notes toggle', () => {
    beforeEach(() => {
        vi.mocked(getApplicationByJobId).mockResolvedValue(null);
    });

    it('notes textarea is hidden by default', async () => {
        const job = makeJob();
        await act(async () => {
            render(<FocusMode job={job} onBack={noop} />);
        });
        expect(screen.queryByPlaceholderText('Add notes about this application...')).not.toBeInTheDocument();
    });

    it('clicking "Add notes" reveals the notes textarea', async () => {
        const job = makeJob();
        await act(async () => {
            render(<FocusMode job={job} onBack={noop} />);
        });

        const addNotesBtn = screen.getByRole('button', { name: /notes/i });
        fireEvent.click(addNotesBtn);

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Add notes about this application...')).toBeInTheDocument();
        });
    });
});
