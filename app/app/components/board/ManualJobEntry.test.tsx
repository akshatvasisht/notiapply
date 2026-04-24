import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ManualJobEntry from './ManualJobEntry';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
    hasDatabase: vi.fn().mockReturnValue(true),
    addManualJob: vi.fn(),
    getUserConfig: vi.fn().mockResolvedValue({}),
}));

// Modal renders children directly — bypass the overlay/portal concerns in jsdom
vi.mock('../common/Modal', () => ({
    default: ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
        <div data-testid="modal">{children}</div>
    ),
}));

// ─── Import mocked DB functions for assertion ─────────────────────────────────

import { addManualJob } from '@/lib/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderEntry(overrides?: Partial<React.ComponentProps<typeof ManualJobEntry>>) {
    const props = {
        onClose: vi.fn(),
        onSuccess: vi.fn(),
        ...overrides,
    };
    render(<ManualJobEntry {...props} />);
    return props;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ManualJobEntry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // addManualJob succeeds by default
        vi.mocked(addManualJob).mockResolvedValue(undefined as never);
    });

    it('renders the modal with the Add Jobs Manually heading', () => {
        renderEntry();
        expect(screen.getByTestId('modal')).toBeInTheDocument();
        expect(screen.getByText('Add Jobs Manually')).toBeInTheDocument();
    });

    it('renders Job Title, Company, and URL input fields', () => {
        renderEntry();
        expect(screen.getByText('Job Title')).toBeInTheDocument();
        expect(screen.getByText('Company')).toBeInTheDocument();
        expect(screen.getByText('URL')).toBeInTheDocument();
    });

    it('shows validation error when submitting with all fields empty', async () => {
        renderEntry();
        const addBtn = screen.getByText('Add Job');
        await act(async () => {
            fireEvent.click(addBtn);
        });
        expect(screen.getByText('Title, Company, and URL are required')).toBeInTheDocument();
        expect(vi.mocked(addManualJob)).not.toHaveBeenCalled();
    });

    it('shows validation error when submitting with only title filled', async () => {
        renderEntry();

        const titleInput = screen.getByPlaceholderText('Software Engineer');
        fireEvent.change(titleInput, { target: { value: 'My Title' } });

        const addBtn = screen.getByText('Add Job');
        await act(async () => {
            fireEvent.click(addBtn);
        });

        expect(screen.getByText('Title, Company, and URL are required')).toBeInTheDocument();
        expect(vi.mocked(addManualJob)).not.toHaveBeenCalled();
    });

    it('calls addManualJob with correct arguments when all required fields filled', async () => {
        renderEntry();

        fireEvent.change(screen.getByPlaceholderText('Software Engineer'), {
            target: { value: 'SWE' },
        });
        fireEvent.change(screen.getByPlaceholderText('Anthropic'), {
            target: { value: 'Acme' },
        });
        fireEvent.change(screen.getByPlaceholderText('https://...'), {
            target: { value: 'https://acme.com/jobs/1' },
        });

        await act(async () => {
            fireEvent.click(screen.getByText('Add Job'));
        });

        expect(vi.mocked(addManualJob)).toHaveBeenCalledWith({
            title: 'SWE',
            company: 'Acme',
            url: 'https://acme.com/jobs/1',
            location: '',
            description: '',
        });
    });

    it('calls onSuccess with count 1 after a successful single submission', async () => {
        const { onSuccess } = renderEntry();

        fireEvent.change(screen.getByPlaceholderText('Software Engineer'), {
            target: { value: 'SWE' },
        });
        fireEvent.change(screen.getByPlaceholderText('Anthropic'), {
            target: { value: 'Acme' },
        });
        fireEvent.change(screen.getByPlaceholderText('https://...'), {
            target: { value: 'https://acme.com/jobs/1' },
        });

        await act(async () => {
            fireEvent.click(screen.getByText('Add Job'));
        });

        expect(onSuccess).toHaveBeenCalledWith(1);
    });

    it('renders Single Entry, CSV Import, and Bulk URLs tab buttons', () => {
        renderEntry();
        expect(screen.getByText('Single Entry')).toBeInTheDocument();
        expect(screen.getByText('CSV Import')).toBeInTheDocument();
        expect(screen.getByText('Bulk URLs')).toBeInTheDocument();
    });

    it('clicking CSV Import tab changes active view to CSV', async () => {
        renderEntry();

        fireEvent.click(screen.getByText('CSV Import'));

        // CSV tab content shows the CSV format hint
        await waitFor(() => {
            expect(screen.getByText('CSV Format:')).toBeInTheDocument();
        });

        // The submit button label changes to "Import Jobs" on non-single tabs
        expect(screen.getByText('Import Jobs')).toBeInTheDocument();

        // Single Entry form fields should no longer be visible
        expect(screen.queryByPlaceholderText('Software Engineer')).not.toBeInTheDocument();
    });
});
