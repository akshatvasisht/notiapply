import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import JobCard from './JobCard';
import { makeJob } from '@/lib/test-fixtures';

// next/image is mocked globally in vitest.setup.ts

const noop = () => {};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('JobCard stale/dead posting badges', () => {
    it('shows no stale badge for a recent live job', () => {
        const job = makeJob({
            is_live: true,
            discovered_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        });

        render(<JobCard job={job} onClick={noop} />);

        expect(screen.queryByText('Dead posting')).not.toBeInTheDocument();
        expect(screen.queryByText(/\d+d old/)).not.toBeInTheDocument();
    });

    it('shows "Dead posting" badge when is_live is false', () => {
        const job = makeJob({ is_live: false });

        render(<JobCard job={job} onClick={noop} />);

        expect(screen.getByText('Dead posting')).toBeInTheDocument();
    });

    it('shows "Xd old" badge for jobs older than 30 days', () => {
        const job = makeJob({
            is_live: true,
            discovered_at: new Date(Date.now() - 45 * 86400000).toISOString(), // 45 days ago
        });

        render(<JobCard job={job} onClick={noop} />);

        expect(screen.getByText(/45d old/)).toBeInTheDocument();
    });

    it('shows no "Xd old" badge for a job exactly 30 days old (strictly >30 required)', () => {
        // ageDays === 30 → ageDays <= 30 → returns null → no badge
        const job = makeJob({
            is_live: true,
            discovered_at: new Date(Date.now() - 30 * 86400000).toISOString(),
        });

        render(<JobCard job={job} onClick={noop} />);

        expect(screen.queryByText(/30d old/)).not.toBeInTheDocument();
    });

    it('shows no "Xd old" badge for a job 29 days old', () => {
        const job = makeJob({
            is_live: true,
            discovered_at: new Date(Date.now() - 29 * 86400000).toISOString(),
        });

        render(<JobCard job={job} onClick={noop} />);

        expect(screen.queryByText(/29d old/)).not.toBeInTheDocument();
    });

    it('shows only "Dead posting" (not age badge) when is_live is false and job is 45 days old', () => {
        const job = makeJob({
            is_live: false,
            discovered_at: new Date(Date.now() - 45 * 86400000).toISOString(), // 45 days ago
        });

        render(<JobCard job={job} onClick={noop} />);

        expect(screen.getByText('Dead posting')).toBeInTheDocument();
        expect(screen.queryByText(/45d old/)).not.toBeInTheDocument();
    });

    it('renders "Dead posting" badge for dead jobs with score', () => {
        const job = makeJob({
            is_live: false,
            relevance_score: 85,
        });

        render(<JobCard job={job} onClick={noop} />);

        expect(screen.getByText('Dead posting')).toBeInTheDocument();
    });
});
